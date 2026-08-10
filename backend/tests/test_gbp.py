"""
Google Business Profile integration tests.

These cover the pre-approval state (no OAuth credentials configured yet):
- /status requires auth and reports configured=false / connected=false
- /connect returns 503 while not configured
- /callback redirects to the frontend reviews page on error/invalid state

Once GOOGLE_GBP_CLIENT_ID/SECRET are set + Google approves the project, the
live OAuth + post + reviews flows become testable end-to-end.
"""
import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://all-in-one-web-15.preview.emergentagent.com").rstrip("/")
SUPER_EMAIL = "pzsuave007@gmail.com"
SUPER_PASS = "Uni2mkt007!"


def _token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": SUPER_EMAIL, "password": SUPER_PASS},
        timeout=15,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["token"]


def test_status_requires_auth():
    r = requests.get(f"{BASE_URL}/api/google-business/status", timeout=15)
    assert r.status_code in (401, 403)


def test_status_shape_when_not_configured():
    h = {"Authorization": f"Bearer {_token()}"}
    r = requests.get(f"{BASE_URL}/api/google-business/status", headers=h, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["configured"] is False
    assert data["connected"] is False
    assert "location_id" in data


def test_connect_blocked_until_configured():
    h = {"Authorization": f"Bearer {_token()}"}
    r = requests.get(f"{BASE_URL}/api/google-business/connect", headers=h, timeout=15)
    assert r.status_code == 503


def test_callback_redirects_on_error():
    r = requests.get(
        f"{BASE_URL}/api/google-business/callback?error=access_denied",
        timeout=15,
        allow_redirects=False,
    )
    assert r.status_code in (302, 307)
    assert "/google-reviews" in r.headers.get("location", "")
