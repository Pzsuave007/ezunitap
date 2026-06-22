"""
Backend tests for the MULTI-CARD per-account feature.

Covers: GET/POST/DELETE /api/card, /api/card/list, /api/card/settings,
admin card-limit override, public card display + lead consolidation,
and Stripe checkout num_cards.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://unitech-preview-2.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "pzsuave007@gmail.com"
ADMIN_PASSWORD = "Uni2mkt007!"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("token")
    assert tok, "Admin login returned no token"
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_user_id(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/auth/me", timeout=20)
    assert r.status_code == 200
    uid = r.json().get("id") or r.json().get("user_id")
    assert uid, f"/api/auth/me missing id: {r.text}"
    return uid


@pytest.fixture(scope="module")
def state():
    return {}


# --- 1. /api/card/list ----------------------------------------------------
def test_01_card_list_shape(admin_session, state):
    r = admin_session.get(f"{BASE_URL}/api/card/list", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    for k in ("cards", "limit", "count", "can_add"):
        assert k in data, f"Missing key {k} in {data}"
    assert isinstance(data["cards"], list)
    assert data["count"] == len(data["cards"])
    assert data["can_add"] == (data["count"] < data["limit"])
    state["initial_limit"] = data["limit"]
    state["initial_count"] = data["count"]
    # Primary card present
    primary = next((c for c in data["cards"] if c.get("is_primary")), None)
    assert primary, "No primary card returned"
    state["primary_id"] = primary["id"]


# --- 2. Admin override raises limit --------------------------------------
def test_02_admin_set_card_limit(admin_session, admin_user_id, state):
    r = admin_session.post(
        f"{BASE_URL}/api/admin/users/{admin_user_id}/card-limit",
        json={"card_limit": 3}, timeout=20,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True
    assert int(body.get("card_limit")) == 3

    r2 = admin_session.get(f"{BASE_URL}/api/card/list", timeout=20)
    assert r2.status_code == 200
    d = r2.json()
    assert d["limit"] == 3
    assert d["can_add"] is True


# --- 3. Create a 2nd (non-primary) card ----------------------------------
def test_03_create_second_card(admin_session, state):
    r = admin_session.post(
        f"{BASE_URL}/api/card",
        json={"label": "TEST_Vendedor Juan", "person_name": "Juan Perez"},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    card = r.json()
    assert card.get("is_primary") is False
    assert card.get("person_name") == "Juan Perez"
    assert card.get("label") == "TEST_Vendedor Juan"
    assert card.get("slug")
    state["second_id"] = card["id"]
    state["second_slug"] = card["slug"]

    # Confirm shared company fields were copied from the primary card
    primary = admin_session.get(
        f"{BASE_URL}/api/card/settings?card_id={state['primary_id']}", timeout=20
    ).json()
    for f in ("website", "services", "business_type"):
        assert card.get(f) == primary.get(f), f"Shared field {f} not inherited"


# --- 4. PUT /api/card/settings personalises per-card fields --------------
def test_04_put_card_settings(admin_session, state):
    payload = {
        "contact_phone": "+15551234567",
        "contact_email": "TEST_juan@example.com",
        "role": "Salesperson",
        "person_name": "Juan Perez",
        "whatsapp": "+15557654321",
    }
    r = admin_session.put(
        f"{BASE_URL}/api/card/settings?card_id={state['second_id']}",
        json=payload, timeout=20,
    )
    assert r.status_code == 200, r.text
    updated = r.json()
    for k, v in payload.items():
        assert updated.get(k) == v, f"{k} not persisted: {updated.get(k)} != {v}"

    # GET with card_id returns that specific card
    r2 = admin_session.get(
        f"{BASE_URL}/api/card/settings?card_id={state['second_id']}", timeout=20,
    )
    assert r2.status_code == 200
    assert r2.json().get("contact_phone") == "+15551234567"

    # GET with no card_id returns primary
    r3 = admin_session.get(f"{BASE_URL}/api/card/settings", timeout=20)
    assert r3.status_code == 200
    assert r3.json().get("id") == state["primary_id"]
    assert r3.json().get("is_primary") is True


# --- 5. Public display merges shared+person --------------------------------
def test_05_public_card_overrides(admin_session, state):
    slug = state["second_slug"]
    r = requests.get(f"{BASE_URL}/api/public/card/{slug}", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    biz = data.get("business") or {}
    card = data.get("card") or {}
    # company name from account/primary
    assert biz.get("name"), "business.name empty"
    # person overrides
    assert biz.get("owner_name") == "Juan Perez"
    assert biz.get("phone") == "+15551234567"
    assert biz.get("email") == "TEST_juan@example.com"
    # website inherited from primary
    primary = admin_session.get(
        f"{BASE_URL}/api/card/settings?card_id={state['primary_id']}", timeout=20
    ).json()
    if primary.get("website"):
        assert card.get("website") == primary.get("website")


# --- 6. Public lead -> consolidated under same account -------------------
def test_06_public_lead_consolidates(admin_session, state):
    slug = state["second_slug"]
    lead_payload = {
        "name": "TEST_Lead From Salesperson",
        "phone": "+15550009999",
        "email": "TEST_lead@example.com",
        "service": "Roofing",
        "description": "Need a new roof",
        "preferred_contact": "phone",
        "address": "123 Main St",
    }
    r = requests.post(
        f"{BASE_URL}/api/public/card/{slug}/lead", json=lead_payload, timeout=30,
    )
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True

    r2 = admin_session.get(f"{BASE_URL}/api/card/leads", timeout=20)
    assert r2.status_code == 200
    leads = r2.json()
    assert isinstance(leads, list)
    match = [
        l for l in leads
        if l.get("name") == "TEST_Lead From Salesperson"
        and l.get("card_id") == state["second_id"]
    ]
    assert match, "Lead not found under account or wrong card_id"
    assert match[0].get("card_label") == "TEST_Vendedor Juan", f"card_label = {match[0].get('card_label')}"


# --- 7. Limit enforcement (403 Spanish) -----------------------------------
def test_07_create_third_card_then_block(admin_session, state):
    # Currently 2 cards / limit 3 -> create the 3rd
    r = admin_session.post(
        f"{BASE_URL}/api/card",
        json={"label": "TEST_Third", "person_name": "Tester Three"}, timeout=20,
    )
    assert r.status_code == 200, r.text
    state["third_id"] = r.json()["id"]

    # 4th should 403
    r2 = admin_session.post(
        f"{BASE_URL}/api/card",
        json={"label": "TEST_Fourth", "person_name": "Tester Four"}, timeout=20,
    )
    assert r2.status_code == 403, r2.text
    body = r2.json()
    msg = (body.get("detail") or body.get("message") or "").lower()
    assert any(w in msg for w in ["límite", "limite", "tarjeta"]), f"Expected Spanish message, got: {body}"


# --- 8. DELETE non-primary OK, primary blocked ----------------------------
def test_08_delete_non_primary_and_block_primary(admin_session, state):
    # Delete the third (test cleanup)
    r = admin_session.delete(f"{BASE_URL}/api/card/{state['third_id']}", timeout=20)
    assert r.status_code == 200, r.text

    # Attempt to delete primary -> 400
    r2 = admin_session.delete(f"{BASE_URL}/api/card/{state['primary_id']}", timeout=20)
    assert r2.status_code == 400, r2.text


# --- 9. Stripe checkout with num_cards ------------------------------------
def test_09_checkout_num_cards_2(admin_session):
    payload = {
        "plan_id": "pro_monthly",
        "origin_url": "https://unitech-preview-2.preview.emergentagent.com",
        "num_cards": 2,
    }
    r = admin_session.post(f"{BASE_URL}/api/payments/checkout", json=payload, timeout=45)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("url", "").startswith("https://checkout.stripe.com"), data
    sid = data.get("session_id")
    assert sid and sid.startswith("cs_"), sid


def test_10_checkout_num_cards_1(admin_session):
    payload = {
        "plan_id": "pro_monthly",
        "origin_url": "https://unitech-preview-2.preview.emergentagent.com",
        "num_cards": 1,
    }
    r = admin_session.post(f"{BASE_URL}/api/payments/checkout", json=payload, timeout=45)
    assert r.status_code == 200, r.text
    assert r.json().get("session_id", "").startswith("cs_")


# --- cleanup: delete TEST_ second card, leave card_limit at 3 -----------
def test_99_cleanup(admin_session, state):
    if state.get("second_id"):
        admin_session.delete(f"{BASE_URL}/api/card/{state['second_id']}", timeout=20)
    # NOTE: leaving card_limit=3 per review instructions ("fine to leave raised").
