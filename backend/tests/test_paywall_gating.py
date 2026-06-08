"""
Phase 2 backend tests — Modular subscription paywall gating + admin set-plan.
"""

import os
import time
import uuid
import requests
import pytest
from pymongo import MongoClient

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "servicioflow_db")

ADMIN_EMAIL = "pzsuave007@gmail.com"
ADMIN_PASS = "Uni2mkt007!"

LOCKED_DETAIL = "Tu prueba gratis terminó. Elige un plan para seguir usando UniTech."


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["token"]


def _register():
    email = f"TEST_paywall_{uuid.uuid4().hex[:10]}@example.com"
    payload = {
        "email": email,
        "password": "Test1234!",
        "business_name": "Paywall Co",
        "owner_name": "Paywall Tester",
        "phone": "+15555550100",
    }
    r = requests.post(f"{API}/auth/register", json=payload, timeout=20)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return email, data["token"], data["user"]["id"]


def _hdrs(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="module")
def mongo():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


def _expire_trial(mongo, user_id):
    mongo.users.update_one(
        {"id": user_id},
        {"$set": {
            "subscription_status": "canceled",
            "trial_ends_at": int(time.time()) - 100,
            "manual_plan": None,
            "is_comp": False,
            "stripe_subscription_id": None,
        }},
    )


def _cleanup_user(mongo, user_id):
    try:
        mongo.users.delete_one({"id": user_id})
        mongo.clients.delete_many({"owner_user_id": user_id})
        mongo.cards.delete_many({"owner_user_id": user_id})
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Trial user — full access
# ---------------------------------------------------------------------------

class TestTrialFullAccess:
    def test_trial_user_features_and_create_client(self, mongo):
        email, token, uid = _register()
        try:
            me = requests.get(f"{API}/auth/me", headers=_hdrs(token), timeout=20)
            assert me.status_code == 200
            feats = set(me.json().get("features") or [])
            assert feats == {"business", "card", "marketing"}, feats

            r = requests.post(
                f"{API}/clients", headers=_hdrs(token),
                json={"name": "TEST_TrialClient", "email": "x@y.com", "phone": "+15555550111"},
                timeout=20,
            )
            assert r.status_code == 200, f"{r.status_code} {r.text}"
            assert r.json().get("name") == "TEST_TrialClient"
        finally:
            _cleanup_user(mongo, uid)


# ---------------------------------------------------------------------------
# Locked user — 403 writes, 200 reads
# ---------------------------------------------------------------------------

class TestLockedUserGating:
    @pytest.fixture(scope="class")
    def locked(self, mongo):
        email, token, uid = _register()
        requests.post(
            f"{API}/clients", headers=_hdrs(token),
            json={"name": "TEST_PreLockClient", "phone": "+15555550112"}, timeout=20,
        )
        _expire_trial(mongo, uid)
        yield {"email": email, "token": token, "uid": uid}
        _cleanup_user(mongo, uid)

    def test_features_empty(self, locked):
        r = requests.get(f"{API}/auth/me", headers=_hdrs(locked["token"]), timeout=20)
        assert r.status_code == 200
        assert (r.json().get("features") or []) == [], r.json().get("features")

    def test_read_clients_open(self, locked):
        r = requests.get(f"{API}/clients", headers=_hdrs(locked["token"]), timeout=20)
        assert r.status_code == 200, r.text

    def test_read_quotes_open(self, locked):
        r = requests.get(f"{API}/quotes", headers=_hdrs(locked["token"]), timeout=20)
        assert r.status_code == 200

    def test_read_invoices_open(self, locked):
        r = requests.get(f"{API}/invoices", headers=_hdrs(locked["token"]), timeout=20)
        assert r.status_code == 200

    @pytest.mark.parametrize("method,path,body", [
        ("POST", "/clients", {"name": "x", "phone": "+15555550113"}),
        ("POST", "/quotes", {"client_id": "x", "items": []}),
        ("POST", "/invoices", {"client_id": "x", "items": []}),
        ("POST", "/jobs", {"title": "x"}),
        ("POST", "/ai/quote", {"prompt": "hi"}),
        ("POST", "/ai/scope", {"prompt": "hi"}),
        ("POST", "/ai/photo-quote", {"prompt": "hi"}),
        ("POST", "/ai/agreement", {"prompt": "hi"}),
        ("POST", "/agreements", {"title": "x"}),
        ("POST", "/card", {}),
        ("PUT",  "/card/settings", {}),
        ("POST", "/social/copy", {"prompt": "hi"}),
    ])
    def test_write_endpoints_403(self, locked, method, path, body):
        r = requests.request(method, f"{API}{path}", headers=_hdrs(locked["token"]),
                             json=body, timeout=25)
        assert r.status_code == 403, f"{method} {path} -> {r.status_code} {r.text[:200]}"
        detail = ""
        try:
            detail = r.json().get("detail", "")
        except Exception:
            pass
        assert detail == LOCKED_DETAIL, f"{method} {path} detail={detail!r}"


# ---------------------------------------------------------------------------
# Admin set-plan: features-array for every plan value
# ---------------------------------------------------------------------------

PLAN_TO_FEATURES = {
    "presencia": ["card"],
    "negocio":   ["business"],
    "marketing": ["marketing"],
    "bundle":    ["business", "card", "marketing"],
    "comp":      ["business", "card", "marketing"],
    "trial":     ["business", "card", "marketing"],
    "locked":    [],
}


class TestAdminSetPlanFeatures:
    @pytest.fixture(scope="class")
    def victim(self, mongo):
        email, token, uid = _register()
        yield {"email": email, "token": token, "uid": uid}
        _cleanup_user(mongo, uid)

    @pytest.mark.parametrize("plan", list(PLAN_TO_FEATURES.keys()))
    def test_set_plan_returns_expected_features(self, admin_token, victim, plan):
        r = requests.post(
            f"{API}/admin/users/{victim['uid']}/set-plan",
            headers=_hdrs(admin_token), json={"plan": plan}, timeout=20,
        )
        assert r.status_code == 200, f"{plan} -> {r.status_code} {r.text}"
        data = r.json()
        assert data["plan"] == plan
        assert sorted(data["features"]) == sorted(PLAN_TO_FEATURES[plan]), \
            f"plan={plan} features={data['features']}"


# ---------------------------------------------------------------------------
# Modular enforcement end-to-end
# ---------------------------------------------------------------------------

class TestModularEnforcement:
    def _set_plan(self, admin_token, uid, plan):
        r = requests.post(
            f"{API}/admin/users/{uid}/set-plan",
            headers=_hdrs(admin_token), json={"plan": plan}, timeout=20,
        )
        assert r.status_code == 200, r.text
        return r.json()

    def test_locked_then_negocio_can_create_client_but_not_card_or_social(self, admin_token, mongo):
        email, token, uid = _register()
        try:
            self._set_plan(admin_token, uid, "locked")
            r = requests.post(f"{API}/clients", headers=_hdrs(token),
                              json={"name": "TEST_Blocked", "phone": "+15555550114"}, timeout=20)
            assert r.status_code == 403

            data = self._set_plan(admin_token, uid, "negocio")
            assert data["features"] == ["business"]

            r = requests.post(f"{API}/clients", headers=_hdrs(token),
                              json={"name": "TEST_NegocioClient", "phone": "+15555550115"}, timeout=20)
            assert r.status_code == 200, f"negocio /clients: {r.status_code} {r.text}"

            # PUT /card/settings is also gated by 'card' module
            r = requests.put(f"{API}/card/settings", headers=_hdrs(token), json={}, timeout=20)
            assert r.status_code == 403, f"negocio /card/settings expected 403: {r.status_code}"
            assert "Presencia" in r.json().get("detail", "")

            r = requests.post(f"{API}/social/copy", headers=_hdrs(token),
                              json={"prompt": "hi"}, timeout=20)
            assert r.status_code == 403, f"negocio /social/copy expected 403: {r.status_code}"
            assert "Marketing" in r.json().get("detail", "")
        finally:
            _cleanup_user(mongo, uid)

    def test_presencia_can_edit_card_but_clients_403(self, admin_token, mongo):
        email, token, uid = _register()
        try:
            self._set_plan(admin_token, uid, "presencia")

            # Use PUT /card/settings — should pass paywall (200 or other non-403)
            r = requests.put(f"{API}/card/settings", headers=_hdrs(token), json={}, timeout=20)
            assert r.status_code != 403, f"presencia /card/settings got 403: {r.text}"

            # business module -> 403 with 'Negocio'
            r = requests.post(f"{API}/clients", headers=_hdrs(token),
                              json={"name": "TEST_Nope", "phone": "+15555550116"}, timeout=20)
            assert r.status_code == 403
            assert "Negocio" in r.json().get("detail", "")
        finally:
            _cleanup_user(mongo, uid)

    def test_marketing_unlocks_social_copy_only(self, admin_token, mongo):
        email, token, uid = _register()
        try:
            self._set_plan(admin_token, uid, "marketing")
            r = requests.post(f"{API}/social/copy", headers=_hdrs(token),
                              json={"prompt": "Promo de jardinería"}, timeout=60)
            assert r.status_code != 403, f"marketing /social/copy got 403: {r.text}"

            r = requests.post(f"{API}/clients", headers=_hdrs(token),
                              json={"name": "TEST_Nope2", "phone": "+15555550117"}, timeout=20)
            assert r.status_code == 403
            assert "Negocio" in r.json().get("detail", "")

            r = requests.put(f"{API}/card/settings", headers=_hdrs(token), json={}, timeout=20)
            assert r.status_code == 403
            assert "Presencia" in r.json().get("detail", "")
        finally:
            _cleanup_user(mongo, uid)
