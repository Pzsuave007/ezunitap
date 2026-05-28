"""Backend tests for Stripe real-test-keys checkout + Phase-2 admin shipments.

Coverage (per review_request iteration_13):
 1. POST /api/payments/checkout — real Stripe Checkout Session creation
 2. GET /api/payments/plans — public, 3 plans w/ trial_period_days=14 + ships_card
 3. POST /api/webhook/stripe — invalid signature => {received: False, error: ...}, NOT 500
 4. GET /api/admin/shipments — super-admin only, ?status= filter
 5. POST /api/admin/shipments/{user_id} — status + auto-timestamps + 400 on bad status
 6. GET /api/admin/users — now includes shipping_address + card_shipping_* fields
 7. GET /api/payments/subscription — shipping_address + card_shipping_status fields
"""
import os
import uuid
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://unitap-staging-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "pzsuave007@gmail.com"
ADMIN_PASSWORD = "Uni2mkt007!"
ADMIN_USER_ID = "13d02667-2685-46ac-846a-5362ad569f1f"
ORIGIN = "https://ezunitap.com"


# ---------- shared fixtures ----------
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(session):
    r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code} {r.text}")
    body = r.json()
    return body.get("token") or body.get("access_token")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def non_admin_headers(session):
    """Register a fresh non-admin user and return auth headers."""
    unique = uuid.uuid4().hex[:8]
    email = f"TEST_nonadmin_{unique}@example.com"
    r = session.post(f"{API}/auth/register", json={
        "email": email,
        "password": "TestPass123!",
        "owner_name": "TEST NonAdmin",
        "business_name": "TEST Biz",
    })
    if r.status_code != 200:
        pytest.skip(f"register non-admin failed: {r.status_code} {r.text}")
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    user_id = (data.get("user") or {}).get("id") or data.get("id")
    return {
        "headers": {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
        "user_id": user_id,
        "email": email,
    }


# ============================================================================
# 2. /api/payments/plans (public)
# ============================================================================
class TestPlans:
    def test_plans_public_three_plans(self, session):
        r = session.get(f"{API}/payments/plans")
        assert r.status_code == 200, r.text
        plans = r.json().get("plans", [])
        assert len(plans) == 3
        by_id = {p["id"]: p for p in plans}
        assert set(by_id.keys()) == {"pro_monthly", "pro_yearly", "founder"}

    def test_plans_trial_and_ships_card(self, session):
        plans = session.get(f"{API}/payments/plans").json()["plans"]
        for p in plans:
            assert p.get("trial_period_days") == 14, f"plan {p['id']} trial_period_days={p.get('trial_period_days')}"
            assert p.get("ships_card") is True, f"plan {p['id']} ships_card={p.get('ships_card')}"


# ============================================================================
# 1. /api/payments/checkout — real Stripe Test API key creates cs_test_ session
# ============================================================================
class TestCheckout:
    def test_checkout_pro_monthly_real_stripe(self, session, admin_headers):
        r = session.post(
            f"{API}/payments/checkout",
            headers=admin_headers,
            json={"plan_id": "pro_monthly", "origin_url": ORIGIN},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "session_id" in data
        assert data["session_id"].startswith("cs_test_"), f"session_id should start cs_test_; got {data['session_id']}"
        assert "url" in data and data["url"]
        assert "stripe.com" in data["url"], data["url"]


# ============================================================================
# 3. /api/webhook/stripe — invalid signature must NOT 500
# ============================================================================
class TestWebhookSignature:
    def test_webhook_invalid_signature_returns_clean_error(self, session):
        # Send raw bytes with bogus Stripe-Signature so the SDK rejects it.
        url = f"{API}/webhook/stripe"
        r = requests.post(
            url,
            data=b'{"id":"evt_test","type":"ping","data":{"object":{}}}',
            headers={"Content-Type": "application/json", "Stripe-Signature": "t=1,v1=invalid"},
        )
        # Must NOT be 500
        assert r.status_code != 500, f"webhook 500'd on bad signature: {r.status_code} {r.text}"
        # 200 with received:false + error per spec, or 400. Both acceptable.
        assert r.status_code in (200, 400), f"unexpected status {r.status_code} body={r.text}"
        try:
            body = r.json()
        except Exception:
            pytest.fail(f"webhook did not return JSON: {r.text}")
        if r.status_code == 200:
            assert body.get("received") is False
            assert "error" in body and body["error"]


# ============================================================================
# 7. /api/payments/subscription includes shipping_address + card_shipping_status
# ============================================================================
class TestSubscriptionFields:
    def test_subscription_has_shipping_fields(self, session, admin_headers):
        r = session.get(f"{API}/payments/subscription", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        # keys must be present even if null
        assert "shipping_address" in data, f"missing shipping_address: {data}"
        assert "card_shipping_status" in data, f"missing card_shipping_status: {data}"


# ============================================================================
# 6. /api/admin/users includes new shipment fields
# ============================================================================
class TestAdminUsersShipmentFields:
    REQUIRED_KEYS = {
        "shipping_address", "card_shipping_status", "card_shipped_at",
        "card_delivered_at", "card_tracking_number", "card_shipping_note",
    }

    def test_admin_users_includes_shipment_keys(self, session, admin_headers):
        r = session.get(f"{API}/admin/users", headers=admin_headers)
        assert r.status_code == 200, r.text
        users = r.json().get("users", [])
        assert len(users) > 0
        missing = self.REQUIRED_KEYS - set(users[0].keys())
        assert not missing, f"first user missing keys: {missing}; keys={list(users[0].keys())}"

    def test_admin_users_requires_super_admin(self, session, non_admin_headers):
        r = session.get(f"{API}/admin/users", headers=non_admin_headers["headers"])
        assert r.status_code == 403, f"non-admin should be 403; got {r.status_code} {r.text}"


# ============================================================================
# 4. /api/admin/shipments — listing + filtering + auth
# ============================================================================
class TestAdminShipmentsList:
    def test_shipments_super_admin_only(self, session, non_admin_headers):
        r = session.get(f"{API}/admin/shipments", headers=non_admin_headers["headers"])
        assert r.status_code == 403

    def test_shipments_returns_list(self, session, admin_headers):
        r = session.get(f"{API}/admin/shipments", headers=admin_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "shipments" in body
        assert isinstance(body["shipments"], list)

    def test_shipments_status_filter_pending(self, session, admin_headers):
        r = session.get(f"{API}/admin/shipments?status=pending", headers=admin_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        # All returned shipments (if any) must be pending
        for s in body.get("shipments", []):
            assert s.get("card_shipping_status") in ("pending", None), f"non-pending row: {s}"

    def test_shipments_status_all(self, session, admin_headers):
        r = session.get(f"{API}/admin/shipments?status=all", headers=admin_headers)
        assert r.status_code == 200, r.text


# ============================================================================
# 5. /api/admin/shipments/{user_id} — update flow
# ============================================================================
class TestAdminShipmentUpdate:
    @pytest.fixture(autouse=True)
    def _cleanup_admin_shipping(self, session, admin_headers):
        """Revert admin's shipping fields to None after this class."""
        yield
        try:
            # Use mongosh-equivalent via API: set back to pending/None via update endpoint,
            # then clear via direct field clear. We don't have a direct API; the simplest
            # approach is to set status=pending with empty tracking/note (the endpoint
            # converts empty strings to None).
            session.post(
                f"{API}/admin/shipments/{ADMIN_USER_ID}",
                headers=admin_headers,
                json={"status": "pending", "tracking_number": "", "note": ""},
            )
        except Exception:
            pass

    def test_update_invalid_status_400(self, session, admin_headers):
        r = session.post(
            f"{API}/admin/shipments/{ADMIN_USER_ID}",
            headers=admin_headers,
            json={"status": "bogus"},
        )
        assert r.status_code == 400, f"expected 400 for invalid status; got {r.status_code} {r.text}"

    def test_update_unknown_user_404(self, session, admin_headers):
        r = session.post(
            f"{API}/admin/shipments/{uuid.uuid4().hex}",
            headers=admin_headers,
            json={"status": "pending"},
        )
        assert r.status_code == 404, f"expected 404 for unknown user; got {r.status_code} {r.text}"

    def test_update_requires_super_admin(self, session, non_admin_headers):
        r = session.post(
            f"{API}/admin/shipments/{ADMIN_USER_ID}",
            headers=non_admin_headers["headers"],
            json={"status": "pending"},
        )
        assert r.status_code == 403

    def test_update_shipped_autofills_shipped_at(self, session, admin_headers):
        r = session.post(
            f"{API}/admin/shipments/{ADMIN_USER_ID}",
            headers=admin_headers,
            json={"status": "shipped", "tracking_number": "TEST_TRACK_123", "note": "TEST shipment"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        # response includes the $set fields
        assert body.get("card_shipping_status") == "shipped"
        assert body.get("card_shipped_at") is not None, f"card_shipped_at not auto-filled: {body}"
        # Verify via GET /api/admin/users
        users = session.get(f"{API}/admin/users", headers=admin_headers).json()["users"]
        admin_row = next((u for u in users if u["id"] == ADMIN_USER_ID), None)
        assert admin_row is not None
        assert admin_row["card_shipping_status"] == "shipped"
        assert admin_row["card_shipped_at"] is not None
        assert admin_row["card_tracking_number"] == "TEST_TRACK_123"

    def test_update_delivered_autofills_delivered_at(self, session, admin_headers):
        r = session.post(
            f"{API}/admin/shipments/{ADMIN_USER_ID}",
            headers=admin_headers,
            json={"status": "delivered"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("card_shipping_status") == "delivered"
        assert body.get("card_delivered_at") is not None, f"card_delivered_at not auto-filled: {body}"

    def test_update_appears_in_shipments_list(self, session, admin_headers):
        # First, force shipped status
        session.post(
            f"{API}/admin/shipments/{ADMIN_USER_ID}",
            headers=admin_headers,
            json={"status": "shipped"},
        )
        # Then verify the admin user appears in the shipped filter
        r = session.get(f"{API}/admin/shipments?status=shipped", headers=admin_headers)
        assert r.status_code == 200
        ids = [s["id"] for s in r.json()["shipments"]]
        assert ADMIN_USER_ID in ids, f"admin not in shipped list: {ids}"
