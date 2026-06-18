"""Backend tests for the PUBLIC LIVE DEMO endpoints (/api/public/demo/*) and the
super-admin GET /api/admin/demo-leads endpoint. Uses REAL AI generation, so
quote/agreement requests get generous timeouts.
"""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://servicios-beta.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SUPER_EMAIL = "pzsuave007@gmail.com"
SUPER_PASSWORD = "Uni2mkt007!"

# Generous timeout for real AI calls (quote/agreement).
AI_TIMEOUT = 90


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def super_token(session):
    r = session.post(f"{API}/auth/login", json={"email": SUPER_EMAIL, "password": SUPER_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"super-admin login failed: {r.status_code} {r.text}"
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def demo_id(session):
    """Start one demo session reused by quote/agreement tests."""
    payload = {
        "name": "TEST_Demo Carlos",
        "email": f"test_demo_{int(time.time())}@example.com",
        "phone": "(555) 111-2222",
        "trade": "roofing",
    }
    r = session.post(f"{API}/public/demo/start", json=payload, timeout=30)
    assert r.status_code == 200, f"demo/start failed: {r.status_code} {r.text}"
    data = r.json()
    assert "demo_id" in data and "business" in data
    assert data["business"]["business_name"] == "Demo Contractors"
    return data["demo_id"]


# --- /api/public/demo/start ------------------------------------------------
class TestDemoStart:
    def test_start_success(self, session):
        r = session.post(f"{API}/public/demo/start", json={
            "name": "TEST_Ana",
            "email": f"test_ana_{int(time.time())}@example.com",
            "phone": "(555) 000-1111",
            "trade": "painting",
        }, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("demo_id")
        assert d["business"]["business_name"] == "Demo Contractors"
        assert d["business"]["business_email"] == "hello@democontractors.com"

    def test_start_invalid_email(self, session):
        r = session.post(f"{API}/public/demo/start", json={
            "name": "TEST_NoEmail",
            "email": "not-an-email",
            "phone": "",
            "trade": "",
        }, timeout=30)
        assert r.status_code == 400, r.text

    def test_start_missing_name(self, session):
        r = session.post(f"{API}/public/demo/start", json={
            "name": "",
            "email": "ok@example.com",
        }, timeout=30)
        assert r.status_code == 400, r.text


# --- /api/public/demo/quote ------------------------------------------------
class TestDemoQuote:
    DESC = "Reemplazar techo de 1500 pies cuadrados con shingles nuevos, incluyendo retiro del techo viejo y limpieza."

    def test_quote_success(self, session, demo_id):
        r = session.post(f"{API}/public/demo/quote", json={
            "demo_id": demo_id,
            "description_es": self.DESC,
        }, timeout=AI_TIMEOUT)
        assert r.status_code == 200, f"quote failed: {r.status_code} {r.text}"
        body = r.json()
        assert "quote" in body and "business" in body
        q = body["quote"]
        assert q.get("job_title"), "missing job_title"
        assert isinstance(q.get("line_items"), list) and len(q["line_items"]) > 0
        for key in ("subtotal", "tax_amount", "total", "number"):
            assert key in q, f"missing {key} in quote"
        assert q["number"].startswith("Q-")
        assert body["business"]["business_name"] == "Demo Contractors"

    def test_quote_invalid_demo_id(self, session):
        r = session.post(f"{API}/public/demo/quote", json={
            "demo_id": "does-not-exist-123",
            "description_es": self.DESC,
        }, timeout=30)
        assert r.status_code == 404, r.text

    def test_quote_short_description(self, session, demo_id):
        r = session.post(f"{API}/public/demo/quote", json={
            "demo_id": demo_id,
            "description_es": "hi",
        }, timeout=30)
        assert r.status_code == 400, r.text


# --- /api/public/demo/agreement -------------------------------------------
class TestDemoAgreement:
    def test_agreement_success(self, session, demo_id):
        r = session.post(f"{API}/public/demo/agreement", json={
            "demo_id": demo_id,
            "description_es": "Reemplazar techo de 1500 pies cuadrados con shingles nuevos.",
            "job_title": "Roof Replacement",
            "total": 12000,
            "deposit": 6000,
        }, timeout=AI_TIMEOUT)
        assert r.status_code == 200, f"agreement failed: {r.status_code} {r.text}"
        body = r.json()
        assert "agreement" in body
        a = body["agreement"]
        # Loose schema check - AI should return at least some of these standard keys.
        expected_any = {"title", "services_included", "pricing"}
        present = set(a.keys()) & expected_any if isinstance(a, dict) else set()
        assert isinstance(a, dict) and len(a) > 0
        assert len(present) >= 1, f"agreement missing expected keys, got: {list(a.keys())[:10]}"


# --- Abuse cap (lighter version: confirm cap field increments) ------------
class TestDemoCap:
    def test_quote_count_increments(self, session, demo_id, super_token):
        """Sanity: after at least one /quote call from previous tests, the
        demo lead in admin_demo_leads shows quote_count >= 1."""
        h = {"Authorization": f"Bearer {super_token}"}
        r = requests.get(f"{API}/admin/demo-leads", headers=h, timeout=30)
        assert r.status_code == 200, r.text
        leads = r.json().get("leads", [])
        ours = [l for l in leads if l.get("id") == demo_id]
        assert ours, "our test demo lead not in admin list"
        assert int(ours[0].get("quote_count") or 0) >= 1


# --- /api/admin/demo-leads -------------------------------------------------
class TestAdminDemoLeads:
    def test_unauth_returns_401_or_403(self):
        r = requests.get(f"{API}/admin/demo-leads", timeout=30)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_admin_returns_leads(self, super_token, demo_id):
        h = {"Authorization": f"Bearer {super_token}"}
        r = requests.get(f"{API}/admin/demo-leads", headers=h, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "leads" in data and isinstance(data["leads"], list)
        ids = {l.get("id") for l in data["leads"]}
        assert demo_id in ids, "demo lead from this run should be in admin list"
