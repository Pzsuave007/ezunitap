"""
Payment Requests ("payment slips") tests.

- Create from free amount + from a plan installment
- List, public view (with card_payment flag + invoice ref), delete
- Public checkout creates a Stripe session bound to the request
- Auth gating on the owner endpoints
"""
import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://unitech-preview-2.preview.emergentagent.com").rstrip("/")
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


def _make_invoice(h, total=2000):
    r = requests.post(f"{BASE_URL}/api/invoices", headers=h,
                      json={"client_id": _client_id(h), "job_title": "Payment request test", "total": total, "subtotal": total, "status": "sent"}, timeout=15)
    return r.json()["id"]


def test_create_list_public_delete():
    h = _headers()
    iid = _make_invoice(h)
    try:
        # Create from free amount
        r = requests.post(f"{BASE_URL}/api/invoices/{iid}/payment-requests", headers=h,
                          json={"amount": 500, "description": "Pago 1 de 4"}, timeout=15)
        assert r.status_code == 200, r.text
        req = r.json()
        assert req["amount"] == 500.0
        assert req["status"] == "pending"
        rid = req["id"]

        # List
        lst = requests.get(f"{BASE_URL}/api/invoices/{iid}/payment-requests", headers=h, timeout=15).json()
        assert len(lst["requests"]) == 1

        # Public view
        pub = requests.get(f"{BASE_URL}/api/public/payment-requests/{rid}", timeout=15).json()
        assert pub["request"]["amount"] == 500.0
        assert pub["card_payment"]["enabled"] is True
        assert pub["card_payment"]["amount"] == 500.0
        assert pub["invoice"]["job_title"] == "Payment request test"

        # Public checkout
        co = requests.post(f"{BASE_URL}/api/public/payment-requests/{rid}/checkout",
                           json={"origin_url": BASE_URL}, timeout=20).json()
        assert co.get("url", "").startswith("http")
        assert co.get("session_id", "").startswith("cs_")

        # Delete
        d = requests.delete(f"{BASE_URL}/api/payment-requests/{rid}", headers=h, timeout=15)
        assert d.status_code == 200
        lst2 = requests.get(f"{BASE_URL}/api/invoices/{iid}/payment-requests", headers=h, timeout=15).json()
        assert len(lst2["requests"]) == 0
    finally:
        requests.delete(f"{BASE_URL}/api/invoices/{iid}", headers=h, timeout=15)


def test_create_from_plan_installment():
    h = _headers()
    iid = _make_invoice(h, total=900)
    try:
        # Set a 3-installment plan
        plan = requests.put(f"{BASE_URL}/api/invoices/{iid}/payment-plan", headers=h,
                            json={"installments": [{"label": "Mes 1", "amount": 300}, {"amount": 300}, {"amount": 300}]}, timeout=15).json()
        item = plan["payment_plan"][0]
        # Request that installment (amount derived server-side from the plan)
        r = requests.post(f"{BASE_URL}/api/invoices/{iid}/payment-requests", headers=h,
                          json={"amount": 1, "description": "ignored", "plan_item_id": item["id"]}, timeout=15)
        assert r.status_code == 200
        assert r.json()["amount"] == 300.0  # server used the installment amount
        assert r.json()["plan_item_id"] == item["id"]
    finally:
        requests.delete(f"{BASE_URL}/api/invoices/{iid}", headers=h, timeout=15)


def test_reject_zero_amount():
    h = _headers()
    iid = _make_invoice(h)
    try:
        r = requests.post(f"{BASE_URL}/api/invoices/{iid}/payment-requests", headers=h,
                          json={"amount": 0}, timeout=15)
        assert r.status_code == 400
    finally:
        requests.delete(f"{BASE_URL}/api/invoices/{iid}", headers=h, timeout=15)


def test_owner_endpoints_require_auth():
    r = requests.get(f"{BASE_URL}/api/invoices/whatever/payment-requests", timeout=15)
    assert r.status_code in (401, 403)
