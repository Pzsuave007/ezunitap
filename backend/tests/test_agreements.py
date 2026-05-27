"""Backend tests for Service Agreements feature (AI + CRUD + public sign + auto-trigger)."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://contractor-dash-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SUPER_EMAIL = "pzsuave007@gmail.com"
SUPER_PASS = "Uni2mkt007!"

EXPECTED_SECTION_KEYS = {
    "title",
    "services_included",
    "services_excluded",
    "schedule",
    "pricing",
    "payment_terms",
    "cancellation_policy",
    "client_responsibilities",
    "warranty",
    "liability_and_indemnity",
    "insurance_statement",
    "change_orders",
    "dispute_resolution",
    "industry_specific_clauses",
}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def token(session):
    r = session.post(f"{API}/auth/login", json={"email": SUPER_EMAIL, "password": SUPER_PASS})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:200]}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_session(session, token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def test_client(auth_session):
    # Create a dedicated TEST client (cleanup after suite)
    payload = {
        "name": f"TEST_AgreementClient_{uuid.uuid4().hex[:6]}",
        "phone": "+15555550199",
        "email": "TEST_agree@example.com",
        "address": "123 Test St, Houston TX",
        "job_type": "Roofing",
    }
    r = auth_session.post(f"{API}/clients", json=payload)
    assert r.status_code == 200
    client = r.json()
    yield client
    # cleanup
    auth_session.delete(f"{API}/clients/{client['id']}")


# Tracks all agreement IDs created during the suite for cleanup
_created_agreement_ids: list[str] = []


@pytest.fixture(scope="module", autouse=True)
def cleanup_agreements(auth_session):
    yield
    for aid in _created_agreement_ids:
        try:
            auth_session.delete(f"{API}/agreements/{aid}")
        except Exception:
            pass


# ---------------------------------------------------------------------------
# AI generation
# ---------------------------------------------------------------------------
class TestAIAgreement:
    def test_ai_agreement_requires_auth(self, session):
        r = session.post(f"{API}/ai/agreement", json={"description_es": "Pintura interior"})
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"

    def test_ai_agreement_generates_sections(self, auth_session, test_client):
        payload = {
            "description_es": "Instalación de techo nuevo de asfalto, retirar el viejo. 2000 sqft.",
            "client_id": test_client["id"],
            "total": 8500.0,
            "deposit": 2500.0,
        }
        # AI can take 5-15s
        r = auth_session.post(f"{API}/ai/agreement", json=payload, timeout=60)
        assert r.status_code == 200, f"AI agreement failed: {r.status_code} {r.text[:300]}"
        data = r.json()
        assert isinstance(data, dict)
        missing = EXPECTED_SECTION_KEYS - set(data.keys())
        assert not missing, f"Missing AI section keys: {missing}"
        assert isinstance(data.get("title"), str) and len(data["title"]) > 0


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------
class TestAgreementsCRUD:
    def test_list_agreements_requires_auth(self, session):
        r = session.get(f"{API}/agreements")
        assert r.status_code in (401, 403)

    def test_create_get_update_delete(self, auth_session, test_client):
        payload = {
            "client_id": test_client["id"],
            "title": "TEST_Agreement_Title",
            "description_es": "Trabajo de prueba",
            "sections": {"title": "TEST_Agreement_Title", "services_included": ["x"]},
            "total": 1000.0,
            "deposit": 200.0,
            "status": "draft",
        }
        r = auth_session.post(f"{API}/agreements", json=payload)
        assert r.status_code == 200, r.text[:200]
        created = r.json()
        assert created["title"] == "TEST_Agreement_Title"
        assert created["status"] == "draft"
        assert created.get("number", "").startswith("SA-"), f"Expected SA- number, got {created.get('number')}"
        assert "id" in created
        _created_agreement_ids.append(created["id"])
        aid = created["id"]

        # GET single
        r = auth_session.get(f"{API}/agreements/{aid}")
        assert r.status_code == 200
        got = r.json()
        assert got["id"] == aid
        assert got["title"] == "TEST_Agreement_Title"

        # GET list contains it
        r = auth_session.get(f"{API}/agreements")
        assert r.status_code == 200
        ids = [a["id"] for a in r.json()]
        assert aid in ids

        # UPDATE
        payload["title"] = "TEST_Agreement_Updated"
        payload["status"] = "sent"
        r = auth_session.put(f"{API}/agreements/{aid}", json=payload)
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_Agreement_Updated"

        # Verify persisted
        r = auth_session.get(f"{API}/agreements/{aid}")
        assert r.json()["title"] == "TEST_Agreement_Updated"
        assert r.json()["status"] == "sent"

        # DELETE
        r = auth_session.delete(f"{API}/agreements/{aid}")
        assert r.status_code == 200

        # Confirm removed
        r = auth_session.get(f"{API}/agreements/{aid}")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Public endpoints + signing
# ---------------------------------------------------------------------------
class TestPublicAgreement:
    @pytest.fixture(scope="class")
    def public_agreement(self, auth_session, test_client):
        payload = {
            "client_id": test_client["id"],
            "title": "TEST_PublicAgreement",
            "sections": {"title": "TEST_PublicAgreement"},
            "total": 500,
            "deposit": 100,
            "status": "sent",
        }
        r = auth_session.post(f"{API}/agreements", json=payload)
        assert r.status_code == 200
        ag = r.json()
        _created_agreement_ids.append(ag["id"])
        return ag

    def test_public_get_no_auth(self, session, public_agreement):
        r = session.get(f"{API}/public/agreements/{public_agreement['id']}")
        assert r.status_code == 200
        data = r.json()
        assert "agreement" in data and "business" in data and "client" in data
        assert data["agreement"]["id"] == public_agreement["id"]

    def test_sign_drawn_requires_image(self, session, public_agreement):
        r = session.post(
            f"{API}/public/agreements/{public_agreement['id']}/sign",
            json={"method": "drawn"},
        )
        assert r.status_code == 400

    def test_sign_invalid_method(self, session, public_agreement):
        r = session.post(
            f"{API}/public/agreements/{public_agreement['id']}/sign",
            json={"method": "thumbprint"},
        )
        assert r.status_code == 400

    def test_sign_button_success(self, session, auth_session, test_client):
        # Need a fresh unsigned agreement
        payload = {
            "client_id": test_client["id"],
            "title": "TEST_SignButton",
            "sections": {"title": "TEST_SignButton"},
            "total": 300,
            "deposit": 0,
            "status": "sent",
        }
        ag = auth_session.post(f"{API}/agreements", json=payload).json()
        _created_agreement_ids.append(ag["id"])

        r = session.post(
            f"{API}/public/agreements/{ag['id']}/sign",
            json={"method": "button", "signer_name": "Jane Client"},
        )
        assert r.status_code == 200, r.text[:200]
        # Verify status persisted via authenticated GET
        got = auth_session.get(f"{API}/agreements/{ag['id']}").json()
        assert got["status"] == "signed"
        assert got["signed_method"] == "button"
        assert got["signed_at"]
        assert got["signer_name"] == "Jane Client"

        # Second sign should fail
        r = session.post(
            f"{API}/public/agreements/{ag['id']}/sign",
            json={"method": "button", "signer_name": "Jane Client"},
        )
        assert r.status_code == 400

    def test_sign_drawn_success(self, session, auth_session, test_client):
        payload = {
            "client_id": test_client["id"],
            "title": "TEST_SignDrawn",
            "sections": {"title": "TEST_SignDrawn"},
            "total": 700,
            "deposit": 100,
            "status": "sent",
        }
        ag = auth_session.post(f"{API}/agreements", json=payload).json()
        _created_agreement_ids.append(ag["id"])

        # tiny PNG data URL
        png_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wcAAwAB/epv2gAAAABJRU5ErkJggg=="
        r = session.post(
            f"{API}/public/agreements/{ag['id']}/sign",
            json={"method": "drawn", "signature_image": png_b64, "signer_name": "John Sig"},
        )
        assert r.status_code == 200, r.text[:200]
        got = auth_session.get(f"{API}/agreements/{ag['id']}").json()
        assert got["status"] == "signed"
        assert got["signed_method"] == "drawn"
        assert got["signature_image"]
        assert got["signature_image"].startswith("data:image/")


# ---------------------------------------------------------------------------
# Auto-trigger on quote approval
# ---------------------------------------------------------------------------
class TestQuoteApprovalAutoAgreement:
    def test_quote_approval_auto_creates_agreement_and_no_duplicate(self, auth_session, test_client):
        # create a quote
        quote_payload = {
            "client_id": test_client["id"],
            "job_title": "TEST_AutoAgreementJob",
            "description": "Cambio de techo completo",
            "scope_of_work": ["Retirar techo viejo", "Instalar techo nuevo"],
            "line_items": [],
            "subtotal": 5000,
            "total": 5000,
            "deposit_amount": 1000,
            "status": "draft",
        }
        r = auth_session.post(f"{API}/quotes", json=quote_payload)
        assert r.status_code == 200
        quote = r.json()
        quote_id = quote["id"]

        try:
            # snapshot agreements before
            before = auth_session.get(f"{API}/agreements").json()
            before_ids = {a["id"] for a in before}

            # approve quote (AI runs synchronously; up to ~30s)
            r = auth_session.post(f"{API}/quotes/{quote_id}/status?status=approved", timeout=90)
            assert r.status_code == 200, r.text[:200]

            # poll up to 60s for the auto-agreement to appear (in case it's queued)
            found = None
            for _ in range(20):
                lst = auth_session.get(f"{API}/agreements").json()
                for a in lst:
                    if a.get("quote_id") == quote_id and a["id"] not in before_ids:
                        found = a
                        break
                if found:
                    break
                time.sleep(3)
            assert found is not None, "Auto-agreement was not created on quote approval"
            _created_agreement_ids.append(found["id"])
            assert found["client_id"] == test_client["id"]
            assert found["quote_id"] == quote_id
            assert found.get("number", "").startswith("SA-")

            # Idempotency: re-set status to approved -> still only one
            r = auth_session.post(f"{API}/quotes/{quote_id}/status?status=approved", timeout=30)
            assert r.status_code == 200
            time.sleep(2)
            lst = auth_session.get(f"{API}/agreements").json()
            matching = [a for a in lst if a.get("quote_id") == quote_id]
            assert len(matching) == 1, f"Expected exactly 1 auto-agreement, got {len(matching)}"
        finally:
            auth_session.delete(f"{API}/quotes/{quote_id}")
