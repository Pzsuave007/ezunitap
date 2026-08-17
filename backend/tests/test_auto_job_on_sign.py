"""
Auto-create Job when an agreement is signed + scheduling tests.

- Signing a quote (accept-and-sign) creates a Job in 'approved' status
- The Job notes are filled with the scope (quote line items)
- Marking the invoice paid does NOT duplicate the job (idempotent)
- The job can be scheduled (date + times) which feeds the Agenda
"""
import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://latino-funnel.preview.emergentagent.com").rstrip("/")
EMAIL = "pzsuave007@gmail.com"
PASS = "Uni2mkt007!"


def _headers():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASS}, timeout=15)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}


def _client_id(h):
    data = requests.get(f"{BASE_URL}/api/clients", headers=h, timeout=15).json()
    clients = data["clients"] if isinstance(data, dict) else data
    return clients[0]["id"]


def _find_job(h, quote_id):
    jobs = requests.get(f"{BASE_URL}/api/jobs", headers=h, timeout=15).json()
    m = [j for j in jobs if j.get("quote_id") == quote_id]
    return m[0] if m else None


def test_sign_creates_job_with_scope_and_schedules():
    h = _headers()
    q = requests.post(f"{BASE_URL}/api/quotes", headers=h, json={
        "client_id": _client_id(h),
        "job_title": "Auto job test",
        "require_signature": True,
        "line_items": [
            {"description": "Demoler azulejo", "quantity": 1, "unit_price": 500, "amount": 500},
            {"description": "Pintura", "quantity": 2, "unit_price": 100, "amount": 200},
        ],
        "subtotal": 700, "total": 700,
    }, timeout=15).json()
    qid = q["id"]
    job_id = None
    invoice_id = None
    try:
        # Sign → should create invoice + job
        r = requests.post(f"{BASE_URL}/api/public/quotes/{qid}/accept-and-sign",
                          json={"signer_name": "Test Signer"}, timeout=20)
        assert r.status_code == 200, r.text
        invoice_id = r.json().get("invoice_id")

        job = _find_job(h, qid)
        assert job is not None, "Job was not auto-created on sign"
        job_id = job["id"]
        assert job["status"] == "approved"
        assert "Demoler azulejo" in (job.get("notes") or "")
        assert "Pintura" in (job.get("notes") or "")

        # Pay the invoice → must NOT duplicate the job
        requests.post(f"{BASE_URL}/api/invoices/{invoice_id}/status?status=paid", headers=h, timeout=15)
        jobs = requests.get(f"{BASE_URL}/api/jobs", headers=h, timeout=15).json()
        assert len([j for j in jobs if j.get("quote_id") == qid]) == 1

        # Schedule it
        job.update({"scheduled_date": "2026-07-10", "end_date": "2026-07-11", "all_day": False,
                    "start_time": "09:00", "end_time": "15:00", "status": "scheduled"})
        upd = requests.put(f"{BASE_URL}/api/jobs/{job_id}", headers=h, json=job, timeout=15).json()
        assert upd["scheduled_date"] == "2026-07-10"
        assert upd["start_time"] == "09:00"
        assert upd["status"] == "scheduled"
    finally:
        if job_id:
            requests.delete(f"{BASE_URL}/api/jobs/{job_id}", headers=h, timeout=15)
        if invoice_id:
            requests.delete(f"{BASE_URL}/api/invoices/{invoice_id}", headers=h, timeout=15)
        requests.delete(f"{BASE_URL}/api/quotes/{qid}", headers=h, timeout=15)


def test_create_job_from_invoice_button_idempotent():
    """The 'Crear Trabajo' button: create a job from an invoice (no quote)."""
    h = _headers()
    r = requests.post(f"{BASE_URL}/api/invoices", headers=h, json={
        "client_id": _client_id(h), "job_title": "Direct invoice job", "total": 400, "subtotal": 400, "status": "draft",
        "line_items": [{"description": "Fix faucet", "quantity": 1, "unit_price": 400, "amount": 400}],
    }, timeout=15)
    iid = r.json()["id"]
    job_id = None
    try:
        # No job yet
        assert requests.get(f"{BASE_URL}/api/invoices/{iid}/job", headers=h, timeout=15).json()["job"] is None
        # Create
        c = requests.post(f"{BASE_URL}/api/invoices/{iid}/create-job", headers=h, timeout=15).json()
        assert c["created"] is True
        assert c["job"]["status"] == "approved"
        assert "Fix faucet" in c["job"]["notes"]
        job_id = c["job"]["id"]
        # Idempotent
        c2 = requests.post(f"{BASE_URL}/api/invoices/{iid}/create-job", headers=h, timeout=15).json()
        assert c2["created"] is False
        assert c2["job"]["id"] == job_id
    finally:
        if job_id:
            requests.delete(f"{BASE_URL}/api/jobs/{job_id}", headers=h, timeout=15)
        requests.delete(f"{BASE_URL}/api/invoices/{iid}", headers=h, timeout=15)
