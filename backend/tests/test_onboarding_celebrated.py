"""
Onboarding "celebrated" field tests (iteration 3).
- PUT /api/onboarding/state accepts celebrated: bool
- GET /api/onboarding/status returns celebrated: bool
- Full E2E: fresh user → seed mongo → status returns completed=true, celebrated=false → PUT celebrated=true → persists
"""
import os
import sys
import time
import uuid
import pytest
import requests

# Allow importing pymongo from backend env
sys.path.insert(0, "/app/backend")
from pymongo import MongoClient  # noqa: E402

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "servicioflow_db")

SUPER_EMAIL = "pzsuave007@gmail.com"
SUPER_PASS = "Uni2mkt007!"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def db():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


@pytest.fixture(scope="module")
def super_headers():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": SUPER_EMAIL, "password": SUPER_PASS},
        timeout=15,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    token = r.json()["token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def fresh_user(db):
    """Create a brand-new user via /auth/register. Cleanup after module."""
    email = f"test_celeb_{uuid.uuid4().hex[:10]}@example.com"
    password = "TestPass123!"
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={
            "email": email,
            "password": password,
            "business_name": "TEST Celebration Co",
            "owner_name": "Test User",
            "phone": "+15555550100",
        },
        timeout=15,
    )
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    body = r.json()
    user_id = body["user"]["id"]
    token = body["token"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    yield {"id": user_id, "email": email, "password": password, "headers": headers}
    # Cleanup
    db.users.delete_one({"id": user_id})
    db.card_settings.delete_many({"user_id": user_id})
    db.clients.delete_many({"user_id": user_id})
    db.quotes.delete_many({"user_id": user_id})


# ---------- Tests: super-admin celebrated round-trip (no data seeding needed) ----------
class TestCelebratedFieldOnSuperAdmin:
    """Smoke test of new field on a real account (does not depend on completion state)."""

    def test_status_includes_celebrated_key(self, super_headers):
        r = requests.get(f"{BASE_URL}/api/onboarding/status", headers=super_headers, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "celebrated" in data, f"`celebrated` missing from status payload: keys={list(data.keys())}"
        assert isinstance(data["celebrated"], bool)

    def test_put_celebrated_true_persists(self, super_headers):
        # Reset to false
        r0 = requests.put(
            f"{BASE_URL}/api/onboarding/state",
            headers=super_headers,
            json={"celebrated": False},
            timeout=10,
        )
        assert r0.status_code == 200
        s0 = requests.get(f"{BASE_URL}/api/onboarding/status", headers=super_headers, timeout=10).json()
        assert s0["celebrated"] is False

        # Set true
        r1 = requests.put(
            f"{BASE_URL}/api/onboarding/state",
            headers=super_headers,
            json={"celebrated": True},
            timeout=10,
        )
        assert r1.status_code == 200
        assert r1.json().get("ok") is True
        s1 = requests.get(f"{BASE_URL}/api/onboarding/status", headers=super_headers, timeout=10).json()
        assert s1["celebrated"] is True

        # Reset to false for clean state for UI testing
        requests.put(
            f"{BASE_URL}/api/onboarding/state",
            headers=super_headers,
            json={"celebrated": False},
            timeout=10,
        )

    def test_partial_update_celebrated_does_not_clobber_welcome_seen(self, super_headers):
        # Set welcome_seen=true, celebrated=false explicitly
        requests.put(
            f"{BASE_URL}/api/onboarding/state",
            headers=super_headers,
            json={"welcome_seen": True, "celebrated": False},
            timeout=10,
        )
        # Now set only celebrated=true
        requests.put(
            f"{BASE_URL}/api/onboarding/state",
            headers=super_headers,
            json={"celebrated": True},
            timeout=10,
        )
        s = requests.get(f"{BASE_URL}/api/onboarding/status", headers=super_headers, timeout=10).json()
        assert s["welcome_seen"] is True, "welcome_seen got clobbered by celebrated update"
        assert s["celebrated"] is True
        # Reset
        requests.put(
            f"{BASE_URL}/api/onboarding/state",
            headers=super_headers,
            json={"celebrated": False},
            timeout=10,
        )


# ---------- E2E: fresh user seeded to completed=true ----------
class TestCelebrationE2EFreshUser:
    def test_fresh_user_starts_with_celebrated_false_and_not_complete(self, fresh_user):
        r = requests.get(f"{BASE_URL}/api/onboarding/status", headers=fresh_user["headers"], timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["celebrated"] is False
        # business_info already partially filled (phone set on register, but no address) → not done
        # So fresh user must NOT be completed
        assert data["completed"] is False
        # Confirms field exists too
        assert "celebrated" in data

    def test_seed_all_items_done_then_status_completed_true(self, db, fresh_user):
        uid = fresh_user["id"]
        # 1) business_info: set business_address (phone already set on register)
        db.users.update_one({"id": uid}, {"$set": {"business_address": "123 Test St, Miami FL"}})
        # 2) logo + smart_card: insert card_settings with logo + services
        db.card_settings.update_one(
            {"user_id": uid},
            {"$set": {
                "user_id": uid,
                "logo_photo_id": "test-logo-id",
                "profile_photo_id": "test-profile-id",
                "services": [{"name": "Test Service", "price": "$100"}],
            }},
            upsert=True,
        )
        # 3) first_client
        db.clients.insert_one({
            "id": f"test-client-{uuid.uuid4().hex[:8]}",
            "user_id": uid,
            "name": "TEST Client",
            "email": "client@test.com",
        })
        # 4) first_quote
        db.quotes.insert_one({
            "id": f"test-quote-{uuid.uuid4().hex[:8]}",
            "user_id": uid,
            "client_name": "TEST Client",
            "total": 100,
        })

        # Now GET status
        r = requests.get(f"{BASE_URL}/api/onboarding/status", headers=fresh_user["headers"], timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["done_count"] == 5, f"Expected 5 done, got {data['done_count']}: items={data['items']}"
        assert data["completed"] is True
        assert data["progress"] == 100
        assert data["celebrated"] is False, "Fresh user should not have celebrated yet"

    def test_simulate_frontend_celebration_persists(self, fresh_user):
        # Simulate what the UI does: PUT celebrated:true immediately after detecting completed && !celebrated
        r = requests.put(
            f"{BASE_URL}/api/onboarding/state",
            headers=fresh_user["headers"],
            json={"celebrated": True},
            timeout=10,
        )
        assert r.status_code == 200

        # Reload status → celebrated must be true now (so modal won't fire again)
        s = requests.get(f"{BASE_URL}/api/onboarding/status", headers=fresh_user["headers"], timeout=10).json()
        assert s["celebrated"] is True
        assert s["completed"] is True  # still completed

    def test_celebrated_field_idempotent_set(self, fresh_user):
        # Calling PUT celebrated:true again should still return ok
        r = requests.put(
            f"{BASE_URL}/api/onboarding/state",
            headers=fresh_user["headers"],
            json={"celebrated": True},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json().get("ok") is True
