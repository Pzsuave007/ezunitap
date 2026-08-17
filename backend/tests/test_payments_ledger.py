"""
Invoice payments ledger (installments) tests.

- Add multiple partial payments → amount_paid accumulates, status='partial'
- Reaching total → status='paid' + auto-creates a Job
- Deleting a payment → recomputes balance + reverts status
- Setting a fixed installment plan
- Auth gating
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://latino-funnel.preview.emergentagent.com").rstrip("/")
EMAIL = "pzsuave007@gmail.com"
PASS = "Uni2mkt007!"


@pytest.fixture(scope="module")
def headers():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASS}, timeout=15)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def client_id(headers):
    r = requests.get(f"{BASE_URL}/api/clients", headers=headers, timeout=15)
    data = r.json()
    clients = data["clients"] if isinstance(data, dict) else data
    assert clients, "Need at least one client to test"
    return clients[0]["id"]


@pytest.fixture
def invoice_id(headers, client_id):
    r = requests.post(
        f"{BASE_URL}/api/invoices",
        headers=headers,
        json={"client_id": client_id, "job_title": "Payments ledger test", "total": 900, "subtotal": 900, "status": "sent"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    iid = r.json()["id"]
    yield iid
    requests.delete(f"{BASE_URL}/api/invoices/{iid}", headers=headers, timeout=15)


def test_add_payments_accumulate_and_complete(headers, invoice_id):
    # First partial
    r = requests.post(f"{BASE_URL}/api/invoices/{invoice_id}/payments", headers=headers,
                      json={"amount": 300, "method": "zelle", "note": "abono 1"}, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["amount_paid"] == 300
    assert d["status"] == "partial"
    assert len(d["payments"]) == 1

    # Second partial
    r = requests.post(f"{BASE_URL}/api/invoices/{invoice_id}/payments", headers=headers,
                      json={"amount": 300, "method": "cash"}, timeout=15)
    assert r.json()["amount_paid"] == 600

    # Final payment completes it → paid + auto job
    r = requests.post(f"{BASE_URL}/api/invoices/{invoice_id}/payments", headers=headers,
                      json={"amount": 300, "method": "check"}, timeout=15)
    d = r.json()
    assert d["amount_paid"] == 900
    assert d["status"] == "paid"
    assert d.get("auto_created_job_id")


def test_delete_payment_recomputes(headers, invoice_id):
    requests.post(f"{BASE_URL}/api/invoices/{invoice_id}/payments", headers=headers,
                  json={"amount": 400, "method": "cash"}, timeout=15)
    r = requests.post(f"{BASE_URL}/api/invoices/{invoice_id}/payments", headers=headers,
                      json={"amount": 200, "method": "zelle"}, timeout=15)
    d = r.json()
    assert d["amount_paid"] == 600
    pid = d["payments"][0]["id"]
    r = requests.delete(f"{BASE_URL}/api/invoices/{invoice_id}/payments/{pid}", headers=headers, timeout=15)
    d = r.json()
    assert d["amount_paid"] == 200
    assert d["status"] == "partial"


def test_reject_zero_amount(headers, invoice_id):
    r = requests.post(f"{BASE_URL}/api/invoices/{invoice_id}/payments", headers=headers,
                      json={"amount": 0, "method": "cash"}, timeout=15)
    assert r.status_code == 400


def test_set_payment_plan(headers, invoice_id):
    r = requests.put(f"{BASE_URL}/api/invoices/{invoice_id}/payment-plan", headers=headers,
                     json={"installments": [
                         {"label": "Mes 1", "amount": 300, "due_date": "2026-07-01"},
                         {"amount": 300, "due_date": "2026-08-01"},
                         {"amount": 300, "due_date": "2026-09-01"},
                     ]}, timeout=15)
    assert r.status_code == 200, r.text
    plan = r.json()["payment_plan"]
    assert len(plan) == 3
    assert plan[0]["label"] == "Mes 1"
    assert plan[1]["label"] == "Pago 2"  # auto-labeled
    assert all(it.get("id") for it in plan)


def test_payments_require_auth(invoice_id):
    r = requests.post(f"{BASE_URL}/api/invoices/{invoice_id}/payments", json={"amount": 50}, timeout=15)
    assert r.status_code in (401, 403)
