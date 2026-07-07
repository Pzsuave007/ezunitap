"""
Invoice card payments (Stripe, Option A) tests.

- Public invoice exposes `card_payment` (enabled for the owner-gated case)
- Checkout creation returns a Stripe session + url
- Amount is server-side (full remaining balance)
- Status polling endpoint returns a sane shape
- A fully-paid invoice rejects checkout

Gating note: card collection is enabled ONLY for the platform owner (super
admin). The test account IS the super admin, so card_payment.enabled is True.
"""
import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ai-billing-mktg.preview.emergentagent.com").rstrip("/")
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


def _make_invoice(h, total=250, status="sent"):
    r = requests.post(f"{BASE_URL}/api/invoices", headers=h,
                      json={"client_id": _client_id(h), "job_title": "Card pay test", "total": total, "subtotal": total, "status": status}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_public_invoice_exposes_card_payment():
    h = _headers()
    iid = _make_invoice(h, total=250)
    try:
        r = requests.get(f"{BASE_URL}/api/public/invoices/{iid}", timeout=15)
        assert r.status_code == 200
        cp = r.json().get("card_payment")
        assert cp is not None
        assert cp["enabled"] is True
        assert cp["remaining"] == 250.0
    finally:
        requests.delete(f"{BASE_URL}/api/invoices/{iid}", headers=h, timeout=15)


def test_create_checkout_returns_session():
    h = _headers()
    iid = _make_invoice(h, total=250)
    try:
        r = requests.post(f"{BASE_URL}/api/public/invoices/{iid}/checkout",
                          json={"origin_url": BASE_URL}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("url", "").startswith("http")
        assert d.get("session_id", "").startswith("cs_")

        # Status poll should return a shape (unpaid before paying).
        st = requests.get(f"{BASE_URL}/api/public/invoices/checkout/status/{d['session_id']}", timeout=20).json()
        assert "payment_status" in st
        assert "status" in st
    finally:
        requests.delete(f"{BASE_URL}/api/invoices/{iid}", headers=h, timeout=15)


def test_checkout_rejects_fully_paid_invoice():
    h = _headers()
    iid = _make_invoice(h, total=100)
    # Pay it off via the ledger
    requests.post(f"{BASE_URL}/api/invoices/{iid}/payments", headers=h,
                  json={"amount": 100, "method": "cash"}, timeout=15)
    try:
        r = requests.post(f"{BASE_URL}/api/public/invoices/{iid}/checkout",
                          json={"origin_url": BASE_URL}, timeout=20)
        assert r.status_code == 400
    finally:
        requests.delete(f"{BASE_URL}/api/invoices/{iid}", headers=h, timeout=15)


def test_checkout_rejects_bad_origin():
    h = _headers()
    iid = _make_invoice(h, total=120)
    try:
        r = requests.post(f"{BASE_URL}/api/public/invoices/{iid}/checkout",
                          json={"origin_url": "not-a-url"}, timeout=20)
        assert r.status_code == 400
    finally:
        requests.delete(f"{BASE_URL}/api/invoices/{iid}", headers=h, timeout=15)
