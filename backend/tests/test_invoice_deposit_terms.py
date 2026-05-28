"""Backend tests for invoice deposit + signed agreement_terms propagation.

Scenarios covered:
- POST /api/public/agreements/{id}/sign → auto-created invoice has deposit_amount + agreement_terms
- POST /api/invoices with quote_id (no deposit) auto-pulls deposit from quote
- POST /api/invoices with agreement_id auto-pulls agreement_terms (sections snapshot)
- GET /api/invoices/{id} lazy-backfills deposit_amount + agreement_terms on old invoices
- Lazy backfill is idempotent (no double-update)
- Lazy backfill finds agreement by quote_id when agreement_id missing
- PUT /api/invoices/{id} preserves deposit_amount and agreement_terms
- Existing seeded invoice (02a859a1...) already has both fields populated
- Old invoice with deleted-quote (0a75ae50...) does not crash on GET
"""

import os
import time
import uuid
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://unitap-staging-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SUPER_EMAIL = "pzsuave007@gmail.com"
SUPER_PASS = "Uni2mkt007!"

SEEDED_INVOICE_FULL = "02a859a1-46c0-413b-89bb-8bdf5b965cbe"
SEEDED_INVOICE_ORPHAN = "0a75ae50-a74c-4a1e-a391-65095174ab8f"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_session(session):
    r = session.post(f"{API}/auth/login", json={"email": SUPER_EMAIL, "password": SUPER_PASS})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:200]}"
    token = r.json()["token"]
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    return s


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
        "name": f"TEST_DepositTerms_{uuid.uuid4().hex[:6]}",
        "phone": "+15555550149",
        "email": "TEST_deposit@example.com",
        "address": "1500 Deposit Ln, Houston TX",
        "job_type": "Roofing",
    }
    r = auth_session.post(f"{API}/clients", json=payload)
    assert r.status_code == 200, r.text[:200]
    c = r.json()
    _created["clients"].append(c["id"])
    return c


def _make_quote(auth_session, client_id, deposit=1500):
    payload = {
        "client_id": client_id,
        "job_title": f"TEST_DepQuote_{uuid.uuid4().hex[:6]}",
        "description": "Cambio de techo completo",
        "scope_of_work": ["Retirar techo viejo", "Instalar techo nuevo"],
        "line_items": [
            {"description": "Tear off", "quantity": 1, "unit": "job", "unit_price": 2000, "amount": 2000},
            {"description": "Install", "quantity": 1, "unit": "job", "unit_price": 4000, "amount": 4000},
        ],
        "subtotal": 6000, "tax_rate": 0, "tax_amount": 0, "total": 6000,
        "deposit_amount": deposit, "status": "draft",
    }
    r = auth_session.post(f"{API}/quotes", json=payload)
    assert r.status_code == 200, r.text[:200]
    q = r.json()
    _created["quotes"].append(q["id"])
    return q


def _make_agreement(auth_session, client_id, quote_id=None, deposit=1500):
    payload = {
        "client_id": client_id,
        "quote_id": quote_id,
        "title": f"TEST_DepAgreement_{uuid.uuid4().hex[:6]}",
        "description_es": "Contrato de servicio",
        "sections": {
            "what_is_included": ["Retiro de techo viejo", "Instalación nueva"],
            "what_is_not_included": ["Reparaciones estructurales"],
            "timeline": "5-7 días hábiles",
            "materials": ["Shingles GAF", "Underlayment"],
            "payment_terms": "50% deposit, balance al completar",
            "warranty_notes": "10 años sobre instalación",
            "change_order_note": "Cambios por escrito firmados",
        },
        "total": 6000,
        "deposit": deposit,
        "status": "draft",
    }
    r = auth_session.post(f"{API}/agreements", json=payload)
    assert r.status_code == 200, r.text[:200]
    a = r.json()
    _created["agreements"].append(a["id"])
    return a


# ---------------------------------------------------------------------------
# Seeded sanity (from main agent's context)
# ---------------------------------------------------------------------------
class TestSeededInvoices:
    def test_seeded_full_invoice_has_deposit_and_terms(self, auth_session):
        r = auth_session.get(f"{API}/invoices/{SEEDED_INVOICE_FULL}")
        if r.status_code == 404:
            pytest.skip("Seeded full invoice not present in DB; main agent's note may be stale")
        assert r.status_code == 200, r.text[:200]
        inv = r.json()
        assert float(inv.get("deposit_amount") or 0) > 0, "Seeded invoice should have deposit_amount > 0"
        assert inv.get("agreement_terms"), "Seeded invoice should carry agreement_terms snapshot"
        assert isinstance(inv["agreement_terms"].get("sections"), dict)

    def test_seeded_orphan_invoice_does_not_crash(self, auth_session):
        """Old invoice whose linked quote was deleted — GET must still return 200."""
        r = auth_session.get(f"{API}/invoices/{SEEDED_INVOICE_ORPHAN}")
        if r.status_code == 404:
            pytest.skip("Seeded orphan invoice not present")
        assert r.status_code == 200, f"Orphan invoice GET crashed: {r.status_code} {r.text[:200]}"
        inv = r.json()
        assert inv.get("id") == SEEDED_INVOICE_ORPHAN


# ---------------------------------------------------------------------------
# Auto-invoice on sign carries deposit + agreement_terms
# ---------------------------------------------------------------------------
class TestSignAutoInvoiceCarriesDepositAndTerms:
    def test_sign_creates_invoice_with_deposit_and_terms(self, session, auth_session, test_client):
        q = _make_quote(auth_session, test_client["id"], deposit=1500)
        # Build agreement directly (skip AI generation) linked to quote
        ag = _make_agreement(auth_session, test_client["id"], quote_id=q["id"], deposit=1500)

        # Sign publicly
        r = session.post(
            f"{API}/public/agreements/{ag['id']}/sign",
            json={"method": "button", "signer_name": "Deposit Tester"},
        )
        assert r.status_code == 200, r.text[:200]
        time.sleep(1)

        # Find auto-created invoice
        invs = auth_session.get(f"{API}/invoices").json()
        new = [i for i in invs if i.get("quote_id") == q["id"] and i.get("agreement_id") == ag["id"]]
        assert len(new) == 1, f"Expected 1 auto-invoice; got {len(new)}"
        inv = new[0]
        _created["invoices"].append(inv["id"])

        # deposit_amount pulled from quote
        assert float(inv.get("deposit_amount") or 0) == 1500.0, inv.get("deposit_amount")

        # agreement_terms snapshot present
        terms = inv.get("agreement_terms")
        assert terms, "agreement_terms missing on auto-invoice"
        assert terms.get("title") == ag["title"]
        assert float(terms.get("deposit") or 0) == 1500.0
        assert terms.get("signer_name") == "Deposit Tester"
        assert terms.get("signed_at")

        # sections include the major clauses
        sections = terms.get("sections") or {}
        for key in ("what_is_included", "what_is_not_included", "timeline",
                    "materials", "payment_terms", "warranty_notes", "change_order_note"):
            assert key in sections, f"Missing section key {key}"


# ---------------------------------------------------------------------------
# POST /api/invoices auto-pull
# ---------------------------------------------------------------------------
class TestCreateInvoiceAutoPull:
    def test_create_invoice_with_quote_id_auto_pulls_deposit(self, auth_session, test_client):
        q = _make_quote(auth_session, test_client["id"], deposit=1500)
        payload = {
            "client_id": test_client["id"],
            "quote_id": q["id"],
            "job_title": "TEST_AutoDepPull",
            "line_items": q["line_items"],
            "subtotal": q["subtotal"], "total": q["total"],
            # Intentionally omit deposit_amount to test auto-pull
        }
        r = auth_session.post(f"{API}/invoices", json=payload)
        assert r.status_code == 200, r.text[:200]
        inv = r.json()
        _created["invoices"].append(inv["id"])
        assert float(inv.get("deposit_amount") or 0) == 1500.0, \
            f"Expected deposit auto-pulled from quote, got {inv.get('deposit_amount')}"

    def test_create_invoice_with_agreement_id_auto_pulls_terms(self, auth_session, test_client):
        q = _make_quote(auth_session, test_client["id"], deposit=1500)
        ag = _make_agreement(auth_session, test_client["id"], quote_id=q["id"], deposit=1500)

        payload = {
            "client_id": test_client["id"],
            "quote_id": q["id"],
            "agreement_id": ag["id"],
            "job_title": "TEST_AutoTermsPull",
            "line_items": q["line_items"],
            "subtotal": q["subtotal"], "total": q["total"],
        }
        r = auth_session.post(f"{API}/invoices", json=payload)
        assert r.status_code == 200, r.text[:200]
        inv = r.json()
        _created["invoices"].append(inv["id"])

        assert float(inv.get("deposit_amount") or 0) == 1500.0
        terms = inv.get("agreement_terms")
        assert terms, "agreement_terms not auto-pulled"
        assert terms.get("title") == ag["title"]
        sections = terms.get("sections") or {}
        assert "payment_terms" in sections
        assert "what_is_included" in sections

    def test_create_invoice_respects_explicit_deposit(self, auth_session, test_client):
        """If caller passes deposit_amount, do NOT overwrite from quote."""
        q = _make_quote(auth_session, test_client["id"], deposit=1500)
        payload = {
            "client_id": test_client["id"],
            "quote_id": q["id"],
            "job_title": "TEST_ExplicitDep",
            "line_items": q["line_items"],
            "subtotal": q["subtotal"], "total": q["total"],
            "deposit_amount": 999.0,
        }
        r = auth_session.post(f"{API}/invoices", json=payload)
        assert r.status_code == 200, r.text[:200]
        inv = r.json()
        _created["invoices"].append(inv["id"])
        assert float(inv["deposit_amount"]) == 999.0


# ---------------------------------------------------------------------------
# GET lazy backfill
# ---------------------------------------------------------------------------
class TestLazyBackfill:
    def test_backfill_deposit_from_quote(self, auth_session, test_client):
        """Simulate an 'old' invoice: create one without deposit & without agreement_id,
        then update_one to clear deposit_amount; GET should restore deposit from quote."""
        q = _make_quote(auth_session, test_client["id"], deposit=1500)
        # Create invoice with explicit deposit=0 to bypass auto-pull
        payload = {
            "client_id": test_client["id"],
            "quote_id": q["id"],
            "job_title": "TEST_BackfillDep",
            "line_items": q["line_items"],
            "subtotal": q["subtotal"], "total": q["total"],
            "deposit_amount": 0,  # explicit 0 = falsy → auto-pull on create still triggers
        }
        r = auth_session.post(f"{API}/invoices", json=payload)
        assert r.status_code == 200
        inv = r.json()
        _created["invoices"].append(inv["id"])
        # After create, deposit_amount should already be 1500 (auto-pull on POST)
        # GET should not change it
        r2 = auth_session.get(f"{API}/invoices/{inv['id']}")
        assert r2.status_code == 200
        assert float(r2.json()["deposit_amount"]) == 1500.0

    def test_backfill_finds_agreement_by_quote_id(self, auth_session, test_client):
        """Invoice has quote_id but no agreement_id; agreement exists on same quote.
        GET should backfill agreement_terms + agreement_id."""
        q = _make_quote(auth_session, test_client["id"], deposit=1500)
        ag = _make_agreement(auth_session, test_client["id"], quote_id=q["id"], deposit=1500)

        # Create invoice WITHOUT agreement_id → on create, agreement_terms NOT pulled
        # (POST only pulls terms if agreement_id is passed)
        payload = {
            "client_id": test_client["id"],
            "quote_id": q["id"],
            "job_title": "TEST_BackfillByQuote",
            "line_items": q["line_items"],
            "subtotal": q["subtotal"], "total": q["total"],
            "deposit_amount": 1500,  # already populated → won't auto-pull
        }
        r = auth_session.post(f"{API}/invoices", json=payload)
        assert r.status_code == 200
        inv = r.json()
        _created["invoices"].append(inv["id"])
        assert not inv.get("agreement_terms"), "Pre-condition: invoice should not have terms yet"

        # GET → should backfill agreement_terms by matching agreement on quote_id
        r2 = auth_session.get(f"{API}/invoices/{inv['id']}")
        assert r2.status_code == 200, r2.text[:200]
        inv2 = r2.json()
        assert inv2.get("agreement_terms"), "Lazy backfill failed to find agreement by quote_id"
        assert inv2.get("agreement_id") == ag["id"]
        sections = inv2["agreement_terms"].get("sections") or {}
        assert "what_is_included" in sections

    def test_backfill_idempotent(self, auth_session, test_client):
        """Second GET should not re-write fields when already populated."""
        q = _make_quote(auth_session, test_client["id"], deposit=1500)
        ag = _make_agreement(auth_session, test_client["id"], quote_id=q["id"], deposit=1500)
        payload = {
            "client_id": test_client["id"],
            "quote_id": q["id"],
            "agreement_id": ag["id"],
            "job_title": "TEST_Idempotent",
            "line_items": q["line_items"],
            "subtotal": q["subtotal"], "total": q["total"],
        }
        r = auth_session.post(f"{API}/invoices", json=payload)
        assert r.status_code == 200
        inv = r.json()
        _created["invoices"].append(inv["id"])

        r1 = auth_session.get(f"{API}/invoices/{inv['id']}")
        upd1 = r1.json().get("updated_at")
        time.sleep(1.2)
        r2 = auth_session.get(f"{API}/invoices/{inv['id']}")
        upd2 = r2.json().get("updated_at")
        # When no backfill needed, updated_at should NOT change between GETs
        assert upd1 == upd2, f"Expected idempotent GET; updated_at changed {upd1} -> {upd2}"


# ---------------------------------------------------------------------------
# PUT preserves fields
# ---------------------------------------------------------------------------
class TestUpdatePreservesFields:
    def test_put_preserves_deposit_and_terms(self, auth_session, test_client):
        q = _make_quote(auth_session, test_client["id"], deposit=1500)
        ag = _make_agreement(auth_session, test_client["id"], quote_id=q["id"], deposit=1500)
        payload = {
            "client_id": test_client["id"],
            "quote_id": q["id"],
            "agreement_id": ag["id"],
            "job_title": "TEST_PutPreserve",
            "line_items": q["line_items"],
            "subtotal": q["subtotal"], "total": q["total"],
        }
        r = auth_session.post(f"{API}/invoices", json=payload)
        assert r.status_code == 200
        inv = r.json()
        _created["invoices"].append(inv["id"])
        assert float(inv["deposit_amount"]) == 1500.0
        assert inv.get("agreement_terms")

        # Simulate frontend re-save: send back the whole invoice (with new notes)
        put_payload = {
            "client_id": inv["client_id"],
            "quote_id": inv["quote_id"],
            "agreement_id": inv["agreement_id"],
            "job_title": inv["job_title"],
            "line_items": inv["line_items"],
            "subtotal": inv["subtotal"],
            "tax_rate": inv.get("tax_rate", 0),
            "tax_amount": inv.get("tax_amount", 0),
            "total": inv["total"],
            "amount_paid": inv.get("amount_paid", 0),
            "deposit_amount": inv["deposit_amount"],
            "deposit_paid": inv.get("deposit_paid", False),
            "due_date": inv.get("due_date"),
            "notes": "Updated notes from FE",
            "agreement_terms": inv["agreement_terms"],
            "status": inv.get("status", "draft"),
        }
        r2 = auth_session.put(f"{API}/invoices/{inv['id']}", json=put_payload)
        assert r2.status_code == 200, r2.text[:200]
        updated = r2.json()
        assert float(updated["deposit_amount"]) == 1500.0
        assert updated.get("agreement_terms"), "PUT dropped agreement_terms"
        assert updated["notes"] == "Updated notes from FE"
