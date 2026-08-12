"""Backend tests for card lead -> CRM flow and language banner-related public endpoints.

Covers:
 - POST /api/public/card/{slug}/lead (with and without photo_b64)
 - Owner login + GET /api/clients (to find newly created client)
 - GET /api/clients/{id}/project-photo (only when a photo was submitted)
"""
import os
import uuid
import base64

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://unitech-ai-site.preview.emergentagent.com").rstrip("/")
SLUG = "uni2-marketing-agency"
OWNER_EMAIL = "pzsuave007@gmail.com"
OWNER_PASS = "Uni2mkt007!"

# Real 10x10 red JPEG produced by Pillow (valid file, not a corrupted stub)
TINY_JPEG_B64 = (
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/"
    "2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAKAAoDASIAAhEBAxEB/8QA"
    "HwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkK"
    "FhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXG"
    "x8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAEC"
    "AxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOE"
    "hYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDi6KKK+ZP3"
    "E//Z"
)


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def owner_token(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASS}, timeout=20)
    assert r.status_code == 200, f"Owner login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok, f"No token in login response: {data}"
    return tok


@pytest.fixture(scope="module")
def owner_session(owner_token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {owner_token}"})
    return s


# ------- Public card resolution (sanity) -------
def test_public_card_resolves(session):
    r = session.get(f"{BASE_URL}/api/public/card/{SLUG}", timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "card" in body or "id" in body or "slug" in body or body, "card payload missing"


# ------- Lead submission WITHOUT photo -------
def test_submit_lead_without_photo_creates_client_with_project_request(session, owner_session):
    suffix = uuid.uuid4().hex[:6]
    name = f"QA Project Lead NoPhoto {suffix}"
    description = "Necesito reemplazar el techo de mi casa de 1500 sqft, quitar el viejo y poner shingles nuevos."
    payload = {
        "name": name,
        "phone": "5557778888",
        "email": f"qa+lead+{suffix}@example.com",
        "description": description,
        "preferred_contact": "phone",
        "lead_type": "estimate",
    }
    r = session.post(f"{BASE_URL}/api/public/card/{SLUG}/lead", json=payload, timeout=30)
    assert r.status_code == 200, f"lead POST failed: {r.status_code} {r.text[:300]}"
    body = r.json()
    assert body.get("ok") is True
    assert body.get("lead_id"), body

    # Find the new client in the owner's CRM
    rc = owner_session.get(f"{BASE_URL}/api/clients", timeout=20)
    assert rc.status_code == 200, rc.text
    clients = rc.json()
    if isinstance(clients, dict):
        clients = clients.get("clients") or clients.get("items") or []
    match = next((c for c in clients if c.get("name") == name), None)
    assert match, f"Newly created client '{name}' not found among {len(clients)} clients"
    assert match.get("project_request") == description, f"project_request mismatch: {match.get('project_request')!r}"
    # No photo expected
    assert not match.get("project_photo_path")
    # store id for downstream use
    pytest.client_id_no_photo = match["id"]


# ------- Lead submission WITH tiny photo -------
def test_submit_lead_with_photo_creates_client_and_photo(session, owner_session):
    suffix = uuid.uuid4().hex[:6]
    name = f"QA Project Lead Photo {suffix}"
    description = "Tengo una gotera grande en el techo, mira la foto que mando."
    payload = {
        "name": name,
        "phone": "5557778889",
        "email": f"qa+leadphoto+{suffix}@example.com",
        "description": description,
        "preferred_contact": "phone",
        "lead_type": "estimate",
        "photo_b64": f"data:image/jpeg;base64,{TINY_JPEG_B64}",
    }
    r = session.post(f"{BASE_URL}/api/public/card/{SLUG}/lead", json=payload, timeout=30)
    assert r.status_code == 200, f"lead+photo POST failed: {r.status_code} {r.text[:300]}"
    body = r.json()
    assert body.get("ok") is True

    rc = owner_session.get(f"{BASE_URL}/api/clients", timeout=20)
    clients = rc.json()
    if isinstance(clients, dict):
        clients = clients.get("clients") or clients.get("items") or []
    match = next((c for c in clients if c.get("name") == name), None)
    assert match, f"Client with photo '{name}' not found"
    assert match.get("project_request") == description
    # photo_path may not be exposed in list endpoint; just record id
    pytest.client_id_with_photo = match["id"]


# ------- project-photo endpoint -------
def test_project_photo_endpoint_returns_data_url(owner_session):
    cid = getattr(pytest, "client_id_with_photo", None)
    if not cid:
        pytest.skip("photo lead not created")
    r = owner_session.get(f"{BASE_URL}/api/clients/{cid}/project-photo", timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("data_url", "").startswith("data:image"), body


def test_project_photo_endpoint_404_for_no_photo(owner_session):
    cid = getattr(pytest, "client_id_no_photo", None)
    if not cid:
        pytest.skip("no-photo lead not created")
    r = owner_session.get(f"{BASE_URL}/api/clients/{cid}/project-photo", timeout=20)
    assert r.status_code == 404, r.text


# ------- project-photo requires auth -------
def test_project_photo_requires_auth(session):
    cid = getattr(pytest, "client_id_with_photo", None) or "anything"
    r = session.get(f"{BASE_URL}/api/clients/{cid}/project-photo", timeout=15)
    assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"
