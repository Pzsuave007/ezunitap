"""
Onboarding API tests
- GET /api/onboarding/status structure
- PUT /api/onboarding/state persistence (welcome_seen, dismissed)
- Auth gating
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://unitap-staging-1.preview.emergentagent.com").rstrip("/")
SUPER_EMAIL = "pzsuave007@gmail.com"
SUPER_PASS = "Uni2mkt007!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": SUPER_EMAIL, "password": SUPER_PASS},
        timeout=15,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# Reset onboarding state before tests so we have known starting condition
@pytest.fixture(scope="module", autouse=True)
def reset_state(auth_headers):
    requests.put(
        f"{BASE_URL}/api/onboarding/state",
        headers=auth_headers,
        json={"welcome_seen": False, "dismissed": False},
        timeout=10,
    )
    yield


class TestOnboardingStatus:
    def test_status_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/onboarding/status", timeout=10)
        assert r.status_code in (401, 403)

    def test_status_structure(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/onboarding/status", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        data = r.json()
        # Required keys
        for k in [
            "welcome_seen",
            "dismissed",
            "items",
            "done_count",
            "total",
            "progress",
            "completed",
            "first_name",
            "business_name",
        ]:
            assert k in data, f"Missing key: {k}"
        # Types
        assert isinstance(data["items"], list)
        assert isinstance(data["welcome_seen"], bool)
        assert isinstance(data["dismissed"], bool)
        assert isinstance(data["done_count"], int)
        assert isinstance(data["total"], int)
        assert isinstance(data["progress"], int)
        assert isinstance(data["completed"], bool)

    def test_status_items_shape(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/onboarding/status", headers=auth_headers, timeout=10)
        data = r.json()
        ids = [it["id"] for it in data["items"]]
        assert ids == ["business_info", "smart_card"]
        # total must match items length
        assert data["total"] == len(data["items"]) == 2
        # Per-item shape & expected paths
        expected_paths = {
            "business_info": "/ajustes",
            "smart_card": "/tarjeta",
        }
        for it in data["items"]:
            for k in ("id", "label", "minutes", "done", "path"):
                assert k in it, f"item missing {k}: {it}"
            assert isinstance(it["done"], bool)
            assert it["path"] == expected_paths[it["id"]]

    def test_progress_math(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/onboarding/status", headers=auth_headers, timeout=10)
        data = r.json()
        done = sum(1 for it in data["items"] if it["done"])
        assert data["done_count"] == done
        assert data["progress"] == int(done * 100 / data["total"])
        assert data["completed"] == (done == data["total"])


class TestOnboardingState:
    def test_state_requires_auth(self):
        r = requests.put(
            f"{BASE_URL}/api/onboarding/state",
            json={"welcome_seen": True},
            timeout=10,
        )
        assert r.status_code in (401, 403)

    def test_set_welcome_seen_persists(self, auth_headers):
        # Reset
        requests.put(
            f"{BASE_URL}/api/onboarding/state",
            headers=auth_headers,
            json={"welcome_seen": False},
            timeout=10,
        )
        s0 = requests.get(f"{BASE_URL}/api/onboarding/status", headers=auth_headers, timeout=10).json()
        assert s0["welcome_seen"] is False

        # Set true
        r = requests.put(
            f"{BASE_URL}/api/onboarding/state",
            headers=auth_headers,
            json={"welcome_seen": True},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json().get("ok") is True

        s1 = requests.get(f"{BASE_URL}/api/onboarding/status", headers=auth_headers, timeout=10).json()
        assert s1["welcome_seen"] is True

    def test_set_dismissed_persists(self, auth_headers):
        r = requests.put(
            f"{BASE_URL}/api/onboarding/state",
            headers=auth_headers,
            json={"dismissed": True},
            timeout=10,
        )
        assert r.status_code == 200
        s = requests.get(f"{BASE_URL}/api/onboarding/status", headers=auth_headers, timeout=10).json()
        assert s["dismissed"] is True

        # Reset to false for UI testing
        requests.put(
            f"{BASE_URL}/api/onboarding/state",
            headers=auth_headers,
            json={"dismissed": False},
            timeout=10,
        )

    def test_partial_update_does_not_clobber_other_key(self, auth_headers):
        # Set both true
        requests.put(
            f"{BASE_URL}/api/onboarding/state",
            headers=auth_headers,
            json={"welcome_seen": True, "dismissed": True},
            timeout=10,
        )
        # Update only dismissed back to false
        requests.put(
            f"{BASE_URL}/api/onboarding/state",
            headers=auth_headers,
            json={"dismissed": False},
            timeout=10,
        )
        s = requests.get(f"{BASE_URL}/api/onboarding/status", headers=auth_headers, timeout=10).json()
        assert s["welcome_seen"] is True  # untouched
        assert s["dismissed"] is False
