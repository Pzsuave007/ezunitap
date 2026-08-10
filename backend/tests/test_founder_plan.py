"""Tests for the Founder Bundle plan ($59/mo, first 30 subscribers, lifetime)."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://unitech-builder.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "pzsuave007@gmail.com"
ADMIN_PASS = "Uni2mkt007!"
MKT_EMAIL = "mktonly_test@example.com"
MKT_PASS = "Test1234"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": MKT_EMAIL, "password": MKT_PASS}, timeout=30)
    if r.status_code != 200:
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"no token in login response: {data}"
    return tok


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# --- Founder status endpoint -------------------------------------------------
def test_founder_status_shape():
    r = requests.get(f"{API}/payments/founder-status", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("plan_id") == "bundle_founder"
    assert data.get("limit") == 30
    assert data.get("amount_cents") == 5900
    assert data.get("display_price") == "$59"
    assert isinstance(data.get("remaining"), int)
    assert 0 <= data["remaining"] <= 30
    # Available should be true unless 30 already taken
    assert data.get("available") == (data["remaining"] > 0)


# --- Founder checkout: $59/mo -----------------------------------------------
def test_founder_checkout_charges_5900_cents(auth_headers):
    payload = {
        "plan_id": "bundle_founder",
        "origin_url": "https://unitech-builder.preview.emergentagent.com",
        "num_cards": 1,
    }
    r = requests.post(f"{API}/payments/checkout", json=payload, headers=auth_headers, timeout=60)
    assert r.status_code == 200, f"checkout failed: {r.status_code} {r.text}"
    data = r.json()
    session_id = data.get("session_id")
    url = data.get("url")
    assert session_id and session_id.startswith("cs_"), f"bad session id: {session_id}"
    assert url and "stripe.com" in url or "checkout" in (url or ""), f"bad url: {url}"

    # Verify payment_transactions row has amount_cents == 5900
    from pymongo import MongoClient
    client = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db = client[os.environ.get("DB_NAME", "servicioflow_db")]
    tx = db.payment_transactions.find_one({"session_id": session_id})
    assert tx is not None, "payment_transactions row not created"
    assert tx["plan_id"] == "bundle_founder"
    assert tx["amount_cents"] == 5900, f"expected 5900, got {tx['amount_cents']}"


# --- Regression: normal bundle_monthly still charges $75 --------------------
def test_bundle_monthly_still_charges_7500_cents(auth_headers):
    payload = {
        "plan_id": "bundle_monthly",
        "origin_url": "https://unitech-builder.preview.emergentagent.com",
        "num_cards": 1,
    }
    r = requests.post(f"{API}/payments/checkout", json=payload, headers=auth_headers, timeout=60)
    assert r.status_code == 200, f"checkout failed: {r.status_code} {r.text}"
    session_id = r.json().get("session_id")
    assert session_id
    from pymongo import MongoClient
    client = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db = client[os.environ.get("DB_NAME", "servicioflow_db")]
    tx = db.payment_transactions.find_one({"session_id": session_id})
    assert tx is not None
    assert tx["plan_id"] == "bundle_monthly"
    assert tx["amount_cents"] == 7500, f"expected 7500, got {tx['amount_cents']}"
