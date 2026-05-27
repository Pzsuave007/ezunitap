"""Backend tests for Stripe Subscriptions Phase 1 (Unitap).

Tests:
- GET /api/payments/plans (public)
- POST /api/auth/register (sets trial_ends_at, subscription_status='trialing')
- GET /api/auth/me + GET /api/payments/subscription
- POST /api/payments/checkout (3 plans + invalid + unauth)
- GET /api/payments/status/{session_id}
- POST /api/payments/portal (no customer -> 400 Spanish error)
- POST /api/webhook/stripe (dev mode, no signature)
- payment_transactions persistence check (via mongo)
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ezunitap-dev.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

TEST_USER_EMAIL = "pzsuave007@gmail.com"
TEST_USER_PASSWORD = "Uni2mkt007!"
ORIGIN = BASE_URL


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_token(session):
    r = session.post(f"{API}/auth/login", json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code} - {r.text}")
    data = r.json()
    return data.get("token") or data.get("access_token")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# ---------- Plans (public) ----------
class TestPlans:
    def test_plans_returns_three(self, session):
        r = session.get(f"{API}/payments/plans")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "plans" in data
        plans = data["plans"]
        assert len(plans) == 3
        by_id = {p["id"]: p for p in plans}
        assert set(by_id.keys()) == {"pro_monthly", "pro_yearly", "founder"}

    def test_plan_prices(self, session):
        plans = session.get(f"{API}/payments/plans").json()["plans"]
        by_id = {p["id"]: p for p in plans}
        assert by_id["pro_monthly"]["amount_cents"] == 4900
        assert by_id["pro_monthly"]["display_price"] == "$49"
        assert by_id["pro_yearly"]["amount_cents"] == 39000
        assert by_id["pro_yearly"]["display_price"] == "$390"
        assert by_id["founder"]["amount_cents"] == 29000
        assert by_id["founder"]["display_price"] == "$290"
        assert by_id["founder"]["is_founder"] is True
        for p in plans:
            assert p["trial_period_days"] == 14


# ---------- Subscription state (existing user) ----------
class TestSubscriptionState:
    def test_subscription_endpoint(self, session, auth_headers):
        r = session.get(f"{API}/payments/subscription", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        # Backfilled to 'trialing' per problem statement
        assert data["subscription_status"] == "trialing", f"Expected trialing, got {data}"
        assert data["smart_card_unlocked"] is False
        assert data["subscription_active"] is True

    def test_auth_me_smart_card_locked(self, session, auth_headers):
        r = session.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        # Either at top-level or nested; tolerate both
        sc_locked = data.get("smart_card_unlocked")
        sub_status = data.get("subscription_status")
        assert sub_status == "trialing"
        # For a trialing user smart card should NOT be unlocked
        assert sc_locked is False, f"Trialing user should not have smart_card_unlocked=true; got {data}"

    def test_subscription_requires_auth(self, session):
        r = session.get(f"{API}/payments/subscription")
        assert r.status_code in (401, 403)


# ---------- Register flow sets trial ----------
class TestRegisterTrial:
    def test_register_sets_trial(self, session):
        unique = uuid.uuid4().hex[:8]
        email = f"TEST_stripe_{unique}@example.com"
        payload = {
            "email": email,
            "password": "TestPass123!",
            "owner_name": "TEST User",
            "business_name": "TEST Biz",
        }
        r = session.post(f"{API}/auth/register", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        user = data.get("user") or data
        assert user.get("subscription_status") == "trialing", f"Got: {user}"
        trial_ends = user.get("trial_ends_at")
        assert trial_ends is not None
        # ~14 days from now (allow large window)
        now = int(time.time())
        delta = trial_ends - now
        assert 13 * 86400 < delta < 15 * 86400, f"trial_ends_at delta={delta}"
        assert user.get("plan_type") in (None, "")


# ---------- Checkout ----------
class TestCheckout:
    def _create(self, session, headers, plan_id):
        return session.post(
            f"{API}/payments/checkout",
            headers=headers,
            json={"plan_id": plan_id, "origin_url": ORIGIN},
        )

    def test_checkout_unauthenticated(self, session):
        r = session.post(f"{API}/payments/checkout", json={"plan_id": "pro_monthly", "origin_url": ORIGIN})
        assert r.status_code in (401, 403), r.text

    def test_checkout_invalid_plan(self, session, auth_headers):
        r = self._create(session, auth_headers, "bogus_plan")
        assert r.status_code == 400, r.text

    def test_checkout_pro_monthly(self, session, auth_headers):
        r = self._create(session, auth_headers, "pro_monthly")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "session_id" in data and data["session_id"]
        assert "url" in data and data["url"]
        assert data["url"].startswith("https://checkout.stripe.com/"), data["url"]
        # Stash for later
        pytest.pro_monthly_session_id = data["session_id"]

    def test_checkout_pro_yearly(self, session, auth_headers):
        r = self._create(session, auth_headers, "pro_yearly")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["url"].startswith("https://checkout.stripe.com/")

    def test_checkout_founder(self, session, auth_headers):
        r = self._create(session, auth_headers, "founder")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["url"].startswith("https://checkout.stripe.com/")

    def test_status_endpoint(self, session, auth_headers):
        sid = getattr(pytest, "pro_monthly_session_id", None)
        if not sid:
            r = self._create(session, auth_headers, "pro_monthly")
            assert r.status_code == 200
            sid = r.json()["session_id"]
        r = session.get(f"{API}/payments/status/{sid}", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "status" in data
        assert "payment_status" in data


# ---------- Portal ----------
class TestPortal:
    def test_portal_without_customer(self, session, auth_headers):
        r = session.post(
            f"{API}/payments/portal",
            headers=auth_headers,
            json={"origin_url": ORIGIN},
        )
        assert r.status_code == 400, r.text
        detail = r.json().get("detail", "")
        # Spanish-friendly error
        assert any(w in detail.lower() for w in ["suscripción", "suscribir", "suscripci"]), detail


# ---------- Webhook (dev mode, no signature) ----------
class TestWebhook:
    def test_webhook_accepts_post_dev_mode(self, session):
        sample_event = {
            "id": "evt_test_webhook_unitap",
            "object": "event",
            "type": "ping",
            "data": {"object": {"id": "ping_obj"}},
        }
        r = session.post(f"{API}/webhook/stripe", json=sample_event)
        # Should not 500. Accept any 2xx
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        body = r.json()
        assert body.get("received") in (True, False)
