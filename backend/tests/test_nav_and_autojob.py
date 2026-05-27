"""
Iteration 11 tests:
- /api/clients/{id}/history returns agreements + scopes arrays (plus existing keys)
- POST /api/invoices/{id}/status?status=paid auto-creates Job (and is idempotent)
- POST /api/invoices/{id}/status?status=sent does NOT create a job
- Auto-created job appears in client history -> jobs[]
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
EMAIL = "pzsuave007@gmail.com"
PASSWORD = "Uni2mkt007!"


@pytest.fixture(scope="module")
def auth():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    token = r.json().get("access_token") or r.json().get("token")
    assert token, f"no token in {r.json()}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def client_id(auth):
    """Create a fresh test client to keep tests self-contained."""
    payload = {
        "name": f"TEST_Iter11_{int(time.time())}",
        "phone": "555-000-1111",
        "email": "test_iter11@example.com",
        "address": "1 Test Way",
        "job_type": "Plumbing repair",
        "notes": "Auto created by iter11 tests",
    }
    r = auth.post(f"{BASE_URL}/api/clients", json=payload)
    assert r.status_code in (200, 201), r.text
    cid = r.json()["id"]
    yield cid
    try:
        auth.delete(f"{BASE_URL}/api/clients/{cid}")
    except Exception:
        pass


def _make_invoice(auth, client_id, title="TEST_Iter11_Invoice"):
    payload = {
        "client_id": client_id,
        "job_title": title,
        "items": [{"description": "Service", "quantity": 1, "unit_price": 250.0, "amount": 250.0}],
        "subtotal": 250.0,
        "tax_rate": 0.0,
        "tax_amount": 0.0,
        "total": 250.0,
        "amount_paid": 0.0,
        "status": "draft",
        "notes": "",
    }
    r = auth.post(f"{BASE_URL}/api/invoices", json=payload)
    assert r.status_code in (200, 201), r.text
    return r.json()


# ---------------------------------------------------------------------------
# /clients/{id}/history extended fields
# ---------------------------------------------------------------------------
class TestClientHistoryExtended:
    def test_history_returns_agreements_and_scopes(self, auth, client_id):
        r = auth.get(f"{BASE_URL}/api/clients/{client_id}/history")
        assert r.status_code == 200, r.text
        data = r.json()
        # all keys present
        for key in ["quotes", "invoices", "messages", "photos", "jobs", "agreements", "scopes"]:
            assert key in data, f"missing key {key} in history"
            assert isinstance(data[key], list), f"{key} is not a list"

    def test_history_empty_for_fresh_client(self, auth, client_id):
        r = auth.get(f"{BASE_URL}/api/clients/{client_id}/history")
        d = r.json()
        assert d["agreements"] == []
        assert d["scopes"] == []
        assert d["jobs"] == []


# ---------------------------------------------------------------------------
# Invoice status -> paid auto-creates Job
# ---------------------------------------------------------------------------
class TestInvoicePaidAutoJob:
    def test_status_sent_does_not_create_job(self, auth, client_id):
        inv = _make_invoice(auth, client_id, "TEST_NoJob_Sent")
        inv_id = inv["id"]
        r = auth.post(f"{BASE_URL}/api/invoices/{inv_id}/status?status=sent")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "sent"
        assert body.get("auto_created_job_id") in (None,)
        # verify history.jobs still empty for this invoice
        h = auth.get(f"{BASE_URL}/api/clients/{client_id}/history").json()
        assert all(j.get("invoice_id") != inv_id for j in h["jobs"])

    def test_status_paid_creates_job(self, auth, client_id):
        inv = _make_invoice(auth, client_id, "TEST_AutoJob_Paid")
        inv_id = inv["id"]
        r = auth.post(f"{BASE_URL}/api/invoices/{inv_id}/status?status=paid")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "paid"
        job_id = body.get("auto_created_job_id")
        assert job_id, f"expected auto_created_job_id, got {body}"
        # GET to verify job actually exists with required fields
        jr = auth.get(f"{BASE_URL}/api/jobs/{job_id}")
        assert jr.status_code == 200, jr.text
        job = jr.json()
        assert job["client_id"] == client_id
        assert job["invoice_id"] == inv_id
        assert job["status"] == "approved"
        assert job.get("auto_created") is True
        assert "Auto-creado" in (job.get("notes") or "")

    def test_status_paid_is_idempotent(self, auth, client_id):
        inv = _make_invoice(auth, client_id, "TEST_Idempotent_Paid")
        inv_id = inv["id"]
        r1 = auth.post(f"{BASE_URL}/api/invoices/{inv_id}/status?status=paid")
        assert r1.status_code == 200
        job_id_1 = r1.json().get("auto_created_job_id")
        assert job_id_1
        # call again
        r2 = auth.post(f"{BASE_URL}/api/invoices/{inv_id}/status?status=paid")
        assert r2.status_code == 200
        job_id_2 = r2.json().get("auto_created_job_id")
        # idempotency: 2nd call should not return a new id (None) since job exists
        assert job_id_2 is None, f"duplicate job created: {job_id_2}"
        # verify only one job for this invoice in history
        h = auth.get(f"{BASE_URL}/api/clients/{client_id}/history").json()
        matching = [j for j in h["jobs"] if j.get("invoice_id") == inv_id]
        assert len(matching) == 1, f"expected exactly 1 job, found {len(matching)}"

    def test_auto_job_appears_in_history(self, auth, client_id):
        inv = _make_invoice(auth, client_id, "TEST_HistoryJobs")
        inv_id = inv["id"]
        r = auth.post(f"{BASE_URL}/api/invoices/{inv_id}/status?status=paid")
        assert r.status_code == 200
        job_id = r.json().get("auto_created_job_id")
        h = auth.get(f"{BASE_URL}/api/clients/{client_id}/history").json()
        assert any(j["id"] == job_id for j in h["jobs"])

    def test_other_transitions_still_work(self, auth, client_id):
        inv = _make_invoice(auth, client_id, "TEST_Transitions")
        inv_id = inv["id"]
        for st in ["draft", "sent", "partial", "overdue"]:
            r = auth.post(f"{BASE_URL}/api/invoices/{inv_id}/status?status={st}")
            assert r.status_code == 200, f"{st} -> {r.status_code} {r.text}"
            assert r.json()["status"] == st
            assert r.json().get("auto_created_job_id") in (None,)
