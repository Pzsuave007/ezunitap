"""Tests for website AI generation endpoints and public chat regression."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to /app/frontend/.env
    from pathlib import Path
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

EMAIL = "pzsuave007@gmail.com"
PASSWORD = "Uni2mkt007!"
SLUG = "uni2-marketing-agency"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": EMAIL, "password": PASSWORD}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def test_ai_generate_website_content(auth_headers):
    r = requests.post(f"{BASE_URL}/api/website/ai-generate",
                      headers=auth_headers, json={}, timeout=120)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:500]}"
    data = r.json()
    required = ["headline", "subheadline", "about", "how_it_works",
                "why_us", "faqs", "areas", "seo_title", "seo_description"]
    missing = [k for k in required if k not in data]
    assert not missing, f"missing keys: {missing}. keys={list(data.keys())}"
    # Non-empty content checks
    assert isinstance(data["headline"], str) and data["headline"].strip()
    assert isinstance(data["about"], str) and data["about"].strip()
    assert data["how_it_works"], "how_it_works empty"
    assert data["why_us"], "why_us empty"
    assert data["faqs"], "faqs empty"


def test_ai_suggest_design(auth_headers):
    r = requests.post(f"{BASE_URL}/api/website/ai-suggest-design",
                      headers=auth_headers, json={}, timeout=120)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:500]}"
    data = r.json()
    allowed_templates = {"cinematic", "responder", "bento", "craftsman",
                         "trust", "slider", "onepage", "neon", "playful", "luxe"}
    assert data.get("template") in allowed_templates, f"template={data.get('template')}"
    ac = data.get("accent_color", "")
    assert isinstance(ac, str) and len(ac) == 7 and ac.startswith("#"), f"accent_color={ac}"
    # hex check
    int(ac[1:], 16)
    assert isinstance(data.get("reason"), str) and data["reason"].strip()


def test_public_card_chat_regression():
    body = {"session_id": str(uuid.uuid4()),
            "message": "What services do you offer?",
            "language": "en"}
    r = requests.post(f"{BASE_URL}/api/public/card/{SLUG}/chat",
                      json=body, timeout=90)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:500]}"
    data = r.json()
    reply = data.get("reply", "")
    assert isinstance(reply, str) and reply.strip(), f"empty reply: {data}"
