"""Backend tests for:
- POST /api/public/quotes/:id/accept (public, no auth) → marks approved + auto-creates agreement (idempotent)
- POST /api/public/agreements/:id/sign → when agreement has quote_id, auto-creates a draft invoice (idempotent)
- Regression: POST /api/quotes/:id/status?status=approved still creates an agreement
- Regression: Signing an agreement WITHOUT quote_id does not break and creates no invoice
"""

import os
import time
import uuid
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://contractor-dash-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SUPER_EMAIL = "pzsuave007@gmail.com"
SUPER_PASS = "Uni2mkt007!"


# ---------------------------------------------------------------------------
# Session / auth fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def token(session):
    r = session.post(f"{API}/auth/login", json={"email": SUPER_EMAIL, "password": SUPER_PASS})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:200]}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_session(token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    return s


# Tracks ids for cleanup
_created = {"clients": [], "quotes": [], "agreements": [], "invoices": []}


@pytest.fixture(scope="module", autouse=True)
def cleanup(auth_session):
    yield
    for inv_id in _created["invoices"]:
        try: auth_session.delete(f"{API}/invoices/{inv_id}")
        except Exception: pass
    for ag_id in _created["agreements"]:
        try: auth_session.delete(f"{API}/agreements/{ag_id}")
        except Exception: pass
    for q_id in _created["quotes"]:
        try: auth_session.delete(f"{API}/quotes/{q_id}")
        except Exception: pass
    for c_id in _created["clients"]:
        try: auth_session.delete(f"{API}/clients/{c_id}")
        except Exception: pass


@pytest.fixture(scope="module")
def test_client(auth_session):
    payload = {
        "name": f"TEST_PubAcceptClient_{uuid.uuid4().hex[:6]}",
        "phone": "+15555550133",
        "email": "TEST_pubacc@example.com",
        "address": "999 Pub St, Houston TX",
        "job_type": "Roofing",
    }
    r = auth_session.post(f"{API}/clients", json=payload)
    assert r.status_code == 200, r.text[:200]
    c = r.json()
    _created["clients"].append(c["id"])
    return c


def _make_quote(auth_session, client_id, title_suffix=""):
    payload = {
        "client_id": client_id,
        "job_title": f"TEST_AcceptJob_{title_suffix or uuid.uuid4().hex[:6]}",
        "description": "Cambio de techo completo",
        "scope_of_work": ["Retirar techo viejo", "Instalar techo nuevo"],
        "line_items": [
            {"description": "Tear off", "quantity": 1, "unit": "job", "unit_price": 1500, "amount": 1500},
            {"description": "Asphalt shingles install", "quantity": 1, "unit": "job", "unit_price": 3500, "amount": 3500},
        ],
        "subtotal": 5000,
        "tax_rate": 0,
        "tax_amount": 0,
        "total": 5000,
        "deposit_amount": 1000,
        "status": "draft",
    }
    r = auth_session.post(f"{API}/quotes", json=payload)
    assert r.status_code == 200, r.text[:200]
    q = r.json()
    _created["quotes"].append(q["id"])
    return q


def _wait_for_auto_agreement(auth_session, quote_id, timeout_s=90):
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        lst = auth_session.get(f"{API}/agreements").json()
        match = [a for a in lst if a.get("quote_id") == quote_id]
        if match:
            return match
        time.sleep(3)
    return []


# ---------------------------------------------------------------------------
# Public accept of quote
# ---------------------------------------------------------------------------
class TestPublicAcceptQuote:
    def test_public_accept_marks_approved_and_creates_agreement(self, session, auth_session, test_client):
        q = _make_quote(auth_session, test_client["id"], "accept_ok")

        r = session.post(f"{API}/public/quotes/{q['id']}/accept", timeout=30)
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        assert body.get("ok") is True

        # Quote now marked approved
        got = auth_session.get(f"{API}/quotes/{q['id']}").json()
        assert got["status"] == "approved"
        assert got.get("approved_at")

        # Auto-agreement appears (AI synchronous, may take up to ~30s)
        matches = _wait_for_auto_agreement(auth_session, q["id"], timeout_s=90)
        assert len(matches) >= 1, "No agreement auto-created on public accept"
        ag = matches[0]
        _created["agreements"].append(ag["id"])
        assert ag["client_id"] == test_client["id"]
        assert ag["quote_id"] == q["id"]
        assert ag.get("number", "").startswith("SA-")

    def test_idempotent_already_approved(self, session, auth_session, test_client):
        q = _make_quote(auth_session, test_client["id"], "idemp")
        r1 = session.post(f"{API}/public/quotes/{q['id']}/accept", timeout=30)
        assert r1.status_code == 200
        assert r1.json().get("ok") is True

        # Second call should return already_approved: True
        r2 = session.post(f"{API}/public/quotes/{q['id']}/accept", timeout=30)
        assert r2.status_code == 200
        body = r2.json()
        assert body.get("ok") is True
        assert body.get("already_approved") is True

        # Wait for any auto-agreement and ensure only one
        matches = _wait_for_auto_agreement(auth_session, q["id"], timeout_s=90)
        assert len(matches) == 1, f"Expected exactly 1 agreement, got {len(matches)}"
        _created["agreements"].append(matches[0]["id"])

    def test_rejects_declined_quote(self, session, auth_session, test_client):
        q = _make_quote(auth_session, test_client["id"], "declined")
        # Mark declined via authenticated endpoint
        r = auth_session.post(f"{API}/quotes/{q['id']}/status?status=declined")
        assert r.status_code == 200

        r2 = session.post(f"{API}/public/quotes/{q['id']}/accept")
        assert r2.status_code == 400

    def test_rejects_converted_quote(self, session, auth_session, test_client):
        q = _make_quote(auth_session, test_client["id"], "converted")
        # Forcefully set as converted via update (direct status change)
        # Use status endpoint with "converted" if supported, else PUT
        r = auth_session.post(f"{API}/quotes/{q['id']}/status?status=converted")
        if r.status_code != 200:
            # Fall back: update via PUT
            r = auth_session.put(f"{API}/quotes/{q['id']}", json={**q, "status": "converted"})
            assert r.status_code == 200, r.text[:200]
        r2 = session.post(f"{API}/public/quotes/{q['id']}/accept")
        assert r2.status_code == 400

    def test_not_found(self, session):
        r = session.post(f"{API}/public/quotes/nonexistent-id-xyz/accept")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Auto-invoice on agreement sign
# ---------------------------------------------------------------------------
class TestAutoInvoiceOnSign:
    def test_sign_with_quote_id_creates_draft_invoice(self, session, auth_session, test_client):
        # 1. Create quote → approve via authenticated endpoint (regression: ensure still creates agreement)
        q = _make_quote(auth_session, test_client["id"], "auto_inv")
        r = auth_session.post(f"{API}/quotes/{q['id']}/status?status=approved", timeout=60)
        assert r.status_code == 200, r.text[:200]

        # Wait for auto agreement
        matches = _wait_for_auto_agreement(auth_session, q["id"], timeout_s=90)
        assert len(matches) == 1
        ag = matches[0]
        _created["agreements"].append(ag["id"])

        # 2. Snapshot invoices before
        before = auth_session.get(f"{API}/invoices").json()
        before_ids = {i["id"] for i in before}

        # 3. Sign agreement publicly (button method)
        r = session.post(
            f"{API}/public/agreements/{ag['id']}/sign",
            json={"method": "button", "signer_name": "Auto Invoice Tester"},
        )
        assert r.status_code == 200, r.text[:200]

        # 4. Verify invoice exists, in draft, with quote_id and agreement_id linked
        time.sleep(1)
        invs = auth_session.get(f"{API}/invoices").json()
        new_invs = [i for i in invs if i["id"] not in before_ids and i.get("quote_id") == q["id"]]
        assert len(new_invs) == 1, f"Expected 1 new invoice, got {len(new_invs)}"
        inv = new_invs[0]
        _created["invoices"].append(inv["id"])
        assert inv["status"] == "draft"
        assert inv["quote_id"] == q["id"]
        assert inv["agreement_id"] == ag["id"]
        assert inv["client_id"] == test_client["id"]
        # line items copied
        assert len(inv.get("line_items", [])) == len(q["line_items"])
        assert inv.get("number", "").startswith("INV-")

    def test_idempotent_no_duplicate_invoice(self, session, auth_session, test_client):
        """Manually craft an agreement with a quote_id (already signed scenario can't re-sign,
        so simulate by creating quote+agreement and signing once; assert single invoice."""
        # New quote
        q = _make_quote(auth_session, test_client["id"], "idemp_inv")

        # Create an agreement directly with quote_id (bypass AI for speed)
        ag_payload = {
            "client_id": test_client["id"],
            "quote_id": q["id"],
            "title": "TEST_IdempInvAgreement",
            "sections": {"title": "TEST_IdempInvAgreement"},
            "total": 5000,
            "deposit": 1000,
            "status": "sent",
        }
        r = auth_session.post(f"{API}/agreements", json=ag_payload)
        assert r.status_code == 200, r.text[:200]
        ag = r.json()
        _created["agreements"].append(ag["id"])

        # Sign it
        r = session.post(
            f"{API}/public/agreements/{ag['id']}/sign",
            json={"method": "button", "signer_name": "Idemp Tester"},
        )
        assert r.status_code == 200, r.text[:200]
        time.sleep(1)

        # Confirm an invoice exists
        invs = auth_session.get(f"{API}/invoices").json()
        linked = [i for i in invs if i.get("quote_id") == q["id"]]
        assert len(linked) == 1, f"Expected exactly 1 invoice linked to quote, got {len(linked)}"
        _created["invoices"].append(linked[0]["id"])

        # Trying to sign again must 400 (already signed) — confirms no duplicate creation
        r2 = session.post(
            f"{API}/public/agreements/{ag['id']}/sign",
            json={"method": "button", "signer_name": "Idemp Tester"},
        )
        assert r2.status_code == 400

        # And there is still only one
        invs2 = auth_session.get(f"{API}/invoices").json()
        linked2 = [i for i in invs2 if i.get("quote_id") == q["id"]]
        assert len(linked2) == 1

    def test_sign_without_quote_id_does_not_create_invoice(self, session, auth_session, test_client):
        # Create an agreement directly WITHOUT a quote_id
        ag_payload = {
            "client_id": test_client["id"],
            "title": "TEST_NoQuoteAg",
            "sections": {"title": "TEST_NoQuoteAg"},
            "total": 800,
            "deposit": 0,
            "status": "sent",
        }
        r = auth_session.post(f"{API}/agreements", json=ag_payload)
        assert r.status_code == 200
        ag = r.json()
        _created["agreements"].append(ag["id"])
        assert ag.get("quote_id") in (None, "", )

        before = auth_session.get(f"{API}/invoices").json()
        before_ids = {i["id"] for i in before}

        r = session.post(
            f"{API}/public/agreements/{ag['id']}/sign",
            json={"method": "button", "signer_name": "No Quote Tester"},
        )
        assert r.status_code == 200, r.text[:200]
        time.sleep(1)

        after = auth_session.get(f"{API}/invoices").json()
        new = [i for i in after if i["id"] not in before_ids]
        # Must not have created any invoice tied to this signing
        ag_linked = [i for i in new if i.get("agreement_id") == ag["id"]]
        assert len(ag_linked) == 0, f"Unexpected invoice created when no quote_id present: {ag_linked}"
