"""Regression tests for the _public_cors HTTP middleware (server.py ~L6582).

The embed widget runs on arbitrary client domains, so /api/public/* must
accept cross-origin requests regardless of CORS_ORIGINS. CORS headers must
be validated against the LOCAL backend (the preview ingress overrides them).
"""
import requests

LOCAL = "http://localhost:8001"
EXT_ORIGIN = "https://some-external-client.com"


def test_options_public_chat_echoes_external_origin():
    r = requests.options(
        f"{LOCAL}/api/public/card/uni2mkt/chat",
        headers={
            "Origin": EXT_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
        timeout=10,
    )
    assert r.status_code == 200, r.text
    assert r.headers.get("access-control-allow-origin") == EXT_ORIGIN
    assert "POST" in r.headers.get("access-control-allow-methods", "")


def test_post_public_chat_includes_cors_and_returns_spanish_reply():
    r = requests.post(
        f"{LOCAL}/api/public/card/uni2mkt/chat",
        headers={"Origin": EXT_ORIGIN, "Content-Type": "application/json"},
        json={"session_id": "qa-cors-1", "message": "Hola", "language": "es"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    assert r.headers.get("access-control-allow-origin") == EXT_ORIGIN
    data = r.json()
    assert isinstance(data.get("reply"), str) and data["reply"].strip()
    assert "Ups, no pude responder" not in data["reply"]


def test_auth_login_still_works_after_public_cors_middleware():
    """Public-cors must NOT break /api/auth/login. (CORS_ORIGINS='*' in preview
    means the auth endpoint will also reflect the origin — we only assert the
    endpoint is reachable and responds with a normal 4xx for bad creds.)"""
    r = requests.post(
        f"{LOCAL}/api/auth/login",
        headers={"Content-Type": "application/json"},
        json={"email": "nope-test@example.com", "password": "bad"},
        timeout=10,
    )
    assert r.status_code in (400, 401, 403, 422), f"unexpected: {r.status_code} {r.text[:200]}"
