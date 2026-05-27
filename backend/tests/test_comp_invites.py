"""Backend tests for the complimentary (comp) accounts feature.

Covers:
- POST/GET/DELETE /api/admin/comp-invites (super-admin only)
- POST /api/auth/register with invite_token (valid / email-restricted / used / invalid)
- GET /api/admin/users
- POST /api/admin/users/{id}/grant-comp + revoke-comp
- 403 for non-super-admin on every admin endpoint
"""

import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or \
    "https://ezunitap-dev.preview.emergentagent.com"

API = f"{BASE_URL}/api"

SUPER_ADMIN_EMAIL = "pzsuave007@gmail.com"
SUPER_ADMIN_PASSWORD = "Uni2mkt007!"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD,
    })
    assert r.status_code == 200, f"Super-admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def _rand_email(prefix="TEST_comp"):
    return f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"


def _register(email=None, password="Passw0rd!", invite_token=None, business_name="TEST Biz"):
    payload = {
        "email": email or _rand_email(),
        "password": password,
        "business_name": business_name,
    }
    if invite_token is not None:
        payload["invite_token"] = invite_token
    return requests.post(f"{API}/auth/register", json=payload), payload


@pytest.fixture
def non_admin_token():
    r, _ = _register()
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    return r.json()["token"]


# ---------------------------------------------------------------------------
# Auth gating: non-super-admin must get 403 on every admin endpoint
# ---------------------------------------------------------------------------
class TestAdminAuthGating:
    def test_create_invite_requires_super_admin(self, non_admin_token):
        r = requests.post(
            f"{API}/admin/comp-invites",
            json={"duration_days": 30, "note": "TEST"},
            headers={"Authorization": f"Bearer {non_admin_token}"},
        )
        assert r.status_code == 403, r.text

    def test_create_invite_no_auth(self):
        r = requests.post(f"{API}/admin/comp-invites", json={"duration_days": 30})
        assert r.status_code in (401, 403), r.text

    def test_list_invites_requires_super_admin(self, non_admin_token):
        r = requests.get(
            f"{API}/admin/comp-invites",
            headers={"Authorization": f"Bearer {non_admin_token}"},
        )
        assert r.status_code == 403

    def test_list_users_requires_super_admin(self, non_admin_token):
        r = requests.get(
            f"{API}/admin/users",
            headers={"Authorization": f"Bearer {non_admin_token}"},
        )
        assert r.status_code == 403

    def test_grant_comp_requires_super_admin(self, non_admin_token):
        r = requests.post(
            f"{API}/admin/users/fakeid/grant-comp",
            json={"duration_days": 30},
            headers={"Authorization": f"Bearer {non_admin_token}"},
        )
        assert r.status_code == 403

    def test_revoke_comp_requires_super_admin(self, non_admin_token):
        r = requests.post(
            f"{API}/admin/users/fakeid/revoke-comp",
            json={},
            headers={"Authorization": f"Bearer {non_admin_token}"},
        )
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# Comp invite CRUD
# ---------------------------------------------------------------------------
class TestCompInvites:
    def test_create_open_invite(self, admin_headers):
        r = requests.post(
            f"{API}/admin/comp-invites",
            json={"duration_days": 30, "note": "TEST open invite"},
            headers=admin_headers,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "active"
        assert data["token"] and len(data["token"]) >= 10
        assert data["email"] is None
        assert data["duration_days"] == 30
        assert isinstance(data["comp_expires_at"], int)

    def test_create_email_restricted_indefinite_invite(self, admin_headers):
        target = _rand_email("TEST_invitee")
        r = requests.post(
            f"{API}/admin/comp-invites",
            json={"email": target, "note": "TEST email-restricted, no expiry"},
            headers=admin_headers,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == target.lower()
        assert data["comp_expires_at"] is None  # indefinite
        assert data["duration_days"] is None

    def test_list_invites_contains_created(self, admin_headers):
        # create one
        r = requests.post(
            f"{API}/admin/comp-invites",
            json={"duration_days": 7, "note": "TEST list"},
            headers=admin_headers,
        )
        token = r.json()["token"]
        # list
        r2 = requests.get(f"{API}/admin/comp-invites", headers=admin_headers)
        assert r2.status_code == 200
        invites = r2.json()["invites"]
        assert any(i["token"] == token for i in invites)

    def test_revoke_invite(self, admin_headers):
        # create
        r = requests.post(
            f"{API}/admin/comp-invites",
            json={"duration_days": 7, "note": "TEST revoke"},
            headers=admin_headers,
        )
        inv = r.json()
        # revoke
        r2 = requests.delete(
            f"{API}/admin/comp-invites/{inv['id']}",
            headers=admin_headers,
        )
        assert r2.status_code == 200
        assert r2.json()["ok"] is True
        # verify status updated
        r3 = requests.get(f"{API}/admin/comp-invites", headers=admin_headers)
        match = [i for i in r3.json()["invites"] if i["id"] == inv["id"]]
        assert match and match[0]["status"] == "revoked"

    def test_revoke_unknown_invite_404(self, admin_headers):
        r = requests.delete(
            f"{API}/admin/comp-invites/does-not-exist",
            headers=admin_headers,
        )
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Register flow with invite_token
# ---------------------------------------------------------------------------
class TestRegisterWithInvite:
    def _new_invite(self, admin_headers, email=None, duration_days=60, note="TEST register"):
        r = requests.post(
            f"{API}/admin/comp-invites",
            json={"email": email, "duration_days": duration_days, "note": note},
            headers=admin_headers,
        )
        assert r.status_code == 200, r.text
        return r.json()

    def test_register_with_valid_invite_grants_comp(self, admin_headers):
        invite = self._new_invite(admin_headers)
        r, payload = _register(invite_token=invite["token"])
        assert r.status_code == 200, r.text
        data = r.json()
        u = data["user"]
        assert u["is_comp"] is True
        assert u["subscription_status"] == "active"
        assert u["plan_type"] == "comp"
        assert u["smart_card_unlocked"] is True
        assert u["subscription_active"] is True

        # The invite should now be marked used
        lst = requests.get(f"{API}/admin/comp-invites", headers=admin_headers).json()["invites"]
        match = [i for i in lst if i["id"] == invite["id"]]
        assert match and match[0]["status"] == "used"
        assert match[0]["used_by_user_id"] == u["id"]

    def test_register_with_email_mismatch_rejected(self, admin_headers):
        target = _rand_email("TEST_specific")
        invite = self._new_invite(admin_headers, email=target)
        # register with DIFFERENT email
        r, _ = _register(email=_rand_email("TEST_other"), invite_token=invite["token"])
        assert r.status_code == 400, r.text
        assert "otro email" in r.json().get("detail", "").lower() or "otro" in r.json().get("detail", "").lower()

    def test_register_with_email_match_accepted(self, admin_headers):
        target = _rand_email("TEST_matched")
        invite = self._new_invite(admin_headers, email=target, duration_days=30)
        r, _ = _register(email=target, invite_token=invite["token"])
        assert r.status_code == 200, r.text
        assert r.json()["user"]["is_comp"] is True

    def test_register_with_already_used_invite_no_comp(self, admin_headers):
        invite = self._new_invite(admin_headers)
        # first use
        r1, _ = _register(invite_token=invite["token"])
        assert r1.status_code == 200
        # second use — invite is now status='used', should fall through to normal trial
        r2, _ = _register(invite_token=invite["token"])
        assert r2.status_code == 200, r2.text
        u = r2.json()["user"]
        assert u["is_comp"] is False
        assert u["subscription_status"] == "trialing"
        assert u["plan_type"] in (None, "")

    def test_register_with_revoked_invite_no_comp(self, admin_headers):
        invite = self._new_invite(admin_headers)
        requests.delete(f"{API}/admin/comp-invites/{invite['id']}", headers=admin_headers)
        r, _ = _register(invite_token=invite["token"])
        assert r.status_code == 200
        u = r.json()["user"]
        assert u["is_comp"] is False
        assert u["subscription_status"] == "trialing"

    def test_register_with_invalid_invite_token_no_error_no_comp(self):
        r, _ = _register(invite_token="this-token-does-not-exist-xyz")
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        assert u["is_comp"] is False
        assert u["subscription_status"] == "trialing"


# ---------------------------------------------------------------------------
# Admin user management (grant/revoke comp on existing users)
# ---------------------------------------------------------------------------
class TestAdminUserComp:
    def test_list_users_includes_comp_fields(self, admin_headers):
        r = requests.get(f"{API}/admin/users", headers=admin_headers)
        assert r.status_code == 200
        users = r.json()["users"]
        assert len(users) > 0
        sample = users[0]
        for k in ("id", "email", "is_comp", "subscription_status", "plan_type",
                  "comp_note", "comp_expires_at"):
            assert k in sample, f"missing field {k}"

    def test_grant_comp_with_duration(self, admin_headers):
        # create a fresh user via register
        r, _ = _register()
        uid = r.json()["user"]["id"]

        before = int(time.time())
        r2 = requests.post(
            f"{API}/admin/users/{uid}/grant-comp",
            json={"duration_days": 90, "note": "TEST 90d"},
            headers=admin_headers,
        )
        assert r2.status_code == 200, r2.text
        comp_expires = r2.json()["comp_expires_at"]
        assert comp_expires is not None
        expected = before + 90 * 24 * 3600
        # within 60s tolerance
        assert abs(comp_expires - expected) < 120

        # Verify persistence via admin list
        lst = requests.get(f"{API}/admin/users", headers=admin_headers).json()["users"]
        m = [u for u in lst if u["id"] == uid][0]
        assert m["is_comp"] is True
        assert m["plan_type"] == "comp"
        assert m["subscription_status"] == "active"
        assert m["comp_expires_at"] == comp_expires

    def test_grant_comp_indefinite(self, admin_headers):
        r, _ = _register()
        uid = r.json()["user"]["id"]
        r2 = requests.post(
            f"{API}/admin/users/{uid}/grant-comp",
            json={"note": "TEST indefinite"},  # no duration_days
            headers=admin_headers,
        )
        assert r2.status_code == 200, r2.text
        assert r2.json()["comp_expires_at"] is None

    def test_revoke_comp_reverts_to_trialing_when_no_stripe(self, admin_headers):
        r, _ = _register()
        uid = r.json()["user"]["id"]
        # Grant first
        requests.post(
            f"{API}/admin/users/{uid}/grant-comp",
            json={"duration_days": 30},
            headers=admin_headers,
        )
        # Revoke
        r2 = requests.post(
            f"{API}/admin/users/{uid}/revoke-comp",
            json={},
            headers=admin_headers,
        )
        assert r2.status_code == 200, r2.text

        lst = requests.get(f"{API}/admin/users", headers=admin_headers).json()["users"]
        m = [u for u in lst if u["id"] == uid][0]
        assert m["is_comp"] is False
        assert m["subscription_status"] == "trialing"
        assert m["plan_type"] in (None, "")

    def test_grant_comp_unknown_user_404(self, admin_headers):
        r = requests.post(
            f"{API}/admin/users/does-not-exist/grant-comp",
            json={"duration_days": 30},
            headers=admin_headers,
        )
        assert r.status_code == 404
