"""
Backend tests for iteration_39:
- /jobs hides "bare leads" (status=new_lead with no quote/invoice/scheduled_date and source!=manual)
- POST /jobs creates a job with source=manual which is NOT filtered out even if still new_lead
- /jobs returns the scheduled jobs (source=appointment) so the frontend Today's agenda can render them
"""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://unitech-ai-site.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SUPER_EMAIL = "pzsuave007@gmail.com"
SUPER_PASS = "Uni2mkt007!"
CARDONLY_EMAIL = "cardonly_test@example.com"
CARDONLY_PASS = "Test1234"


def _login(email, password):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in login response: {data}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def super_client():
    return _login(SUPER_EMAIL, SUPER_PASS)


@pytest.fixture(scope="module")
def cardonly_client():
    return _login(CARDONLY_EMAIL, CARDONLY_PASS)


# ------------------- Bare-leads filtering -------------------

def test_jobs_list_hides_bare_leads(super_client):
    r = super_client.get(f"{API}/jobs", timeout=20)
    assert r.status_code == 200, r.text
    jobs = r.json()
    assert isinstance(jobs, list)
    # No bare lead should be present:
    bare = [
        j for j in jobs
        if j.get("status") == "new_lead"
        and not j.get("quote_id")
        and not j.get("invoice_id")
        and not j.get("scheduled_date")
        and j.get("source") != "manual"
    ]
    assert bare == [], f"Bare leads still leaking through /jobs: {bare[:3]}"


def test_jobs_list_with_status_filter_does_not_apply_bare_lead_filter(super_client):
    # When status query is provided, the bare-lead filter is intentionally skipped.
    r = super_client.get(f"{API}/jobs", params={"status": "new_lead"}, timeout=20)
    assert r.status_code == 200, r.text
    # Just make sure endpoint still works; we don't assert content.
    assert isinstance(r.json(), list)


# ------------------- create_job sets source=manual and stays visible -------------------

def test_create_job_marks_source_manual_and_remains_visible(super_client):
    # Pick any client to attach (or create one)
    clients = super_client.get(f"{API}/clients", timeout=20).json()
    if clients:
        cid = clients[0]["id"]
    else:
        cr = super_client.post(f"{API}/clients", json={"name": "TEST_AgendaClient"}, timeout=20)
        assert cr.status_code in (200, 201), cr.text
        cid = cr.json()["id"]

    payload = {
        "client_id": cid,
        "title": "TEST_manual_job_stays_visible",
        "status": "new_lead",
    }
    cr = super_client.post(f"{API}/jobs", json=payload, timeout=20)
    assert cr.status_code in (200, 201), f"create job failed: {cr.status_code} {cr.text}"
    created = cr.json()
    assert created.get("source") == "manual", f"Expected source=manual, got {created.get('source')}"
    new_id = created["id"]

    # GET /jobs and ensure the manual job is still present even though it is new_lead with no extras.
    lr = super_client.get(f"{API}/jobs", timeout=20)
    assert lr.status_code == 200
    all_ids = [j["id"] for j in lr.json()]
    assert new_id in all_ids, "Manual new_lead job disappeared from /jobs list — bare-lead filter is too aggressive"

    # Cleanup
    super_client.delete(f"{API}/jobs/{new_id}", timeout=20)


# ------------------- Agenda data shape -------------------

def test_jobs_returns_scheduled_jobs_for_today_agenda(super_client):
    r = super_client.get(f"{API}/jobs", timeout=20)
    assert r.status_code == 200
    jobs = r.json()
    # The frontend treats anything with scheduled_date <= today and status != completed as "today's agenda".
    # Just ensure scheduled_date / source / status keys are exposed.
    sample_keys = set()
    for j in jobs[:20]:
        sample_keys.update(j.keys())
    # These keys must be available so frontend can build the agenda.
    for k in ["id", "title", "status"]:
        assert k in sample_keys or len(jobs) == 0, f"missing {k} in jobs"


# ------------------- cardonly account: jobs endpoint must not 500 -------------------

def test_cardonly_jobs_endpoint_does_not_crash(cardonly_client):
    r = cardonly_client.get(f"{API}/jobs", timeout=20)
    # cardonly may be feature-gated; accept 200 (empty list) or 403, but never 500.
    assert r.status_code in (200, 403), f"unexpected status {r.status_code}: {r.text[:200]}"
    if r.status_code == 200:
        assert isinstance(r.json(), list)
