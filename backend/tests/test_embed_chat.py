"""Regression test for embedded AI chatbot endpoint used by /embed.js.

Validates POST /api/public/card/{slug}/chat returns a non-empty Spanish
reply for the test card slug `uni2mkt` (used by /embed-test.html which
simulates WordPress with only a <script> tag, no <div> wrapper).
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
SLUG = "uni2mkt"


@pytest.fixture(scope="module")
def chat_url():
    assert BASE_URL, "REACT_APP_BACKEND_URL not set"
    return f"{BASE_URL}/api/public/card/{SLUG}/chat"


def test_embed_chat_returns_spanish_reply(chat_url):
    payload = {
        "session_id": str(uuid.uuid4()),
        "message": "Hola, necesito un corte de cesped",
        "language": "es",
        "source_site": "test.com",
    }
    r = requests.post(chat_url, json=payload, timeout=30)
    assert r.status_code == 200, f"unexpected status {r.status_code}: {r.text[:300]}"
    data = r.json()
    assert "reply" in data, f"missing 'reply' field: {data}"
    assert isinstance(data["reply"], str) and data["reply"].strip(), "empty reply"
    # Must NOT be the fallback error string surfaced by the widget on failure
    assert "Ups, no pude responder" not in data["reply"]


def test_embed_chat_handles_empty_message(chat_url):
    """Endpoint should respond gracefully (not 500) to an empty message."""
    payload = {
        "session_id": str(uuid.uuid4()),
        "message": "",
        "language": "es",
        "source_site": "test.com",
    }
    r = requests.post(chat_url, json=payload, timeout=30)
    # Either 200 with a reply or a 4xx — but never a 5xx
    assert r.status_code < 500, f"server error on empty message: {r.status_code} {r.text[:200]}"
