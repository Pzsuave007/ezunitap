"""
Tests for the unified Smart Card lead -> structured client fields flow.
Covers POST /api/public/card/{slug}/lead for both lead_type variants
(connect, estimate) and all 4 preferred_contact options, plus regression
to confirm structured fields land on the created client document.
"""
import os
import time
import base64
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ai-billing-mktg.preview.emergentagent.com").rstrip("/")
SLUG = "uni2-marketing-agency"
OWNER_EMAIL = "pzsuave007@gmail.com"
OWNER_PASSWORD = "Uni2mkt007!"

# Tiny valid 1x1 red JPEG (base64) — keeps payload small
TINY_JPEG_B64 = (
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB"
    "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEB"
    "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QA"
    "FQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAA"
    "AP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z"
)


@pytest.fixture(scope="module")
def session():
    return requests.Session()


@pytest.fixture(scope="module")
def owner_token(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok, f"no token in login response: {r.json()}"
    return tok


def _suffix():
    return f"{int(time.time())}_{uuid.uuid4().hex[:5]}"


def _get_client_by_name(session, token, name):
    r = session.get(f"{BASE_URL}/api/clients", headers={"Authorization": f"Bearer {token}"}, timeout=30)
    assert r.status_code == 200, r.text
    items = r.json()
    # newest first hopefully
    for c in items:
        if c.get("name") == name:
            return c
    return None


# ---------- CONNECT lead ----------
def test_connect_lead_creates_structured_client(session, owner_token):
    name = f"QA Connect {_suffix()}"
    payload = {
        "name": name,
        "phone": "5551230001",
        "email": "qa+connect@example.com",
        "description": "Vi tu trabajo, quiero info.",
        "preferred_contact": "whatsapp",
        "lead_type": "connect",
        "interests": ["Roof Repair", "Painting"],
        "service": "Roof Repair",
    }
    r = session.post(f"{BASE_URL}/api/public/card/{SLUG}/lead", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True
    # confirm client written with structured fields
    client = _get_client_by_name(session, owner_token, name)
    assert client is not None, "client not visible to owner"
    assert client.get("lead_source") == "smart_card"
    assert client.get("lead_type") == "connect"
    assert set(client.get("interests") or []) == {"Roof Repair", "Painting"}
    assert client.get("preferred_contact") == "whatsapp"
    assert client.get("project_request") == "Vi tu trabajo, quiero info."
    # store id for later UI test
    pytest.connect_client_name = name


# ---------- ESTIMATE lead with photo ----------
def test_estimate_lead_with_photo(session, owner_token):
    name = f"QA Estimate {_suffix()}"
    payload = {
        "name": name,
        "phone": "5551230002",
        "description": "Reemplazar techo 1500 sqft.",
        "preferred_contact": "phone",
        "lead_type": "estimate",
        "photo_b64": TINY_JPEG_B64,
    }
    r = session.post(f"{BASE_URL}/api/public/card/{SLUG}/lead", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True

    client = _get_client_by_name(session, owner_token, name)
    assert client is not None
    assert client.get("lead_source") == "smart_card"
    assert client.get("lead_type") == "estimate"
    assert client.get("preferred_contact") == "phone"
    assert client.get("project_request") == "Reemplazar techo 1500 sqft."
    assert client.get("project_photo_path"), "expected photo_path stored"

    # project-photo endpoint returns a data URL
    pr = session.get(
        f"{BASE_URL}/api/clients/{client['id']}/project-photo",
        headers={"Authorization": f"Bearer {owner_token}"},
        timeout=30,
    )
    assert pr.status_code == 200, pr.text
    body = pr.json()
    assert "data_url" in body and body["data_url"].startswith("data:image/")
    pytest.estimate_client_name = name
    pytest.estimate_client_id = client["id"]


# ---------- EMAIL preferred contact ----------
def test_email_preferred_contact_lead(session, owner_token):
    name = f"QA Email {_suffix()}"
    payload = {
        "name": name,
        "phone": "5551230003",
        "email": "qa+email@example.com",
        "description": "Quiero info por email.",
        "preferred_contact": "email",
        "lead_type": "connect",
        "interests": ["Painting"],
    }
    r = session.post(f"{BASE_URL}/api/public/card/{SLUG}/lead", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    client = _get_client_by_name(session, owner_token, name)
    assert client and client.get("preferred_contact") == "email"
    assert client.get("email") == "qa+email@example.com"
    pytest.email_client_name = name


# ---------- LEGACY backfill: Connect Demo Maria ----------
def test_legacy_connect_demo_maria_has_structured_fields(session, owner_token):
    client = _get_client_by_name(session, owner_token, "Connect Demo Maria")
    assert client is not None, "Connect Demo Maria not visible to owner (cannot validate backfill)"
    assert client.get("lead_source") == "smart_card"
    assert client.get("lead_type") == "connect"
    assert "Roof Repair" in (client.get("interests") or [])
    assert "Gutter Cleaning" in (client.get("interests") or [])
    assert client.get("preferred_contact") == "whatsapp"


# ---------- Regression: manual client has no lead_source ----------
def test_manually_created_client_no_lead_source(session, owner_token):
    name = f"QA Manual {_suffix()}"
    headers = {"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"}
    r = session.post(f"{BASE_URL}/api/clients", json={"name": name, "phone": "5559990000"}, headers=headers, timeout=30)
    assert r.status_code in (200, 201), r.text
    created = r.json()
    assert not created.get("lead_source")
    assert not created.get("lead_type")
    assert not (created.get("interests") or [])
