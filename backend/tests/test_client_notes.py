"""
Tests for the new per-client NOTES (bitácora) endpoints:
- GET    /api/clients/{client_id}/notes
- POST   /api/clients/{client_id}/notes
- DELETE /api/clients/{client_id}/notes/{note_id}

Verifies: create -> list (newest-first) -> delete -> empty.
Also verifies ownership: 404 on unknown client, 400 on empty text.
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ai-billing-mktg.preview.emergentagent.com").rstrip("/")
OWNER_EMAIL = "pzsuave007@gmail.com"
OWNER_PASSWORD = "Uni2mkt007!"


@pytest.fixture(scope="module")
def session():
    return requests.Session()


@pytest.fixture(scope="module")
def owner_token(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok
    return tok


def _auth(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def test_client_id(session, owner_token):
    """Create a fresh test client we can attach notes to."""
    suffix = f"{int(time.time())}_{uuid.uuid4().hex[:5]}"
    payload = {"name": f"TEST_Notes Client {suffix}", "phone": "5550100200"}
    r = session.post(f"{BASE_URL}/api/clients", json=payload, headers=_auth(owner_token), timeout=30)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    cid = data.get("id")
    assert cid
    yield cid
    # cleanup
    try:
        session.delete(f"{BASE_URL}/api/clients/{cid}", headers=_auth(owner_token), timeout=15)
    except Exception:
        pass


def test_list_notes_empty_initially(session, owner_token, test_client_id):
    r = session.get(f"{BASE_URL}/api/clients/{test_client_id}/notes", headers=_auth(owner_token), timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    assert data == []


def test_create_note_returns_persisted_shape(session, owner_token, test_client_id):
    r = session.post(
        f"{BASE_URL}/api/clients/{test_client_id}/notes",
        json={"text": "Llamé al cliente y quiere visita el martes."},
        headers=_auth(owner_token),
        timeout=15,
    )
    assert r.status_code == 200, r.text
    note = r.json()
    # Validate shape
    assert "id" in note and isinstance(note["id"], str) and len(note["id"]) > 0
    assert note["client_id"] == test_client_id
    assert note["text"] == "Llamé al cliente y quiere visita el martes."
    assert "created_at" in note and note["created_at"]
    # NEVER expose Mongo _id
    assert "_id" not in note


def test_empty_text_rejected(session, owner_token, test_client_id):
    r = session.post(
        f"{BASE_URL}/api/clients/{test_client_id}/notes",
        json={"text": "   "},
        headers=_auth(owner_token),
        timeout=15,
    )
    assert r.status_code == 400, r.text


def test_notes_sorted_newest_first(session, owner_token, test_client_id):
    # Add two more notes with a small delay so created_at differs
    r1 = session.post(f"{BASE_URL}/api/clients/{test_client_id}/notes",
                      json={"text": "Segunda nota"}, headers=_auth(owner_token), timeout=15)
    assert r1.status_code == 200
    time.sleep(1.1)
    r2 = session.post(f"{BASE_URL}/api/clients/{test_client_id}/notes",
                      json={"text": "Tercera nota (más nueva)"}, headers=_auth(owner_token), timeout=15)
    assert r2.status_code == 200

    r = session.get(f"{BASE_URL}/api/clients/{test_client_id}/notes", headers=_auth(owner_token), timeout=15)
    assert r.status_code == 200
    notes = r.json()
    assert len(notes) >= 3
    # First (newest) should be 'Tercera nota'
    assert notes[0]["text"] == "Tercera nota (más nueva)"
    # And created_at must be strictly non-increasing
    ts = [n["created_at"] for n in notes]
    assert ts == sorted(ts, reverse=True), f"notes not sorted newest-first: {ts}"


def test_delete_note_removes_it(session, owner_token, test_client_id):
    # Pick the newest note id
    r = session.get(f"{BASE_URL}/api/clients/{test_client_id}/notes", headers=_auth(owner_token), timeout=15)
    notes_before = r.json()
    assert len(notes_before) >= 1
    target = notes_before[0]
    target_id = target["id"]

    d = session.delete(f"{BASE_URL}/api/clients/{test_client_id}/notes/{target_id}",
                       headers=_auth(owner_token), timeout=15)
    assert d.status_code == 200, d.text
    assert d.json().get("ok") is True

    # Verify it's gone
    r2 = session.get(f"{BASE_URL}/api/clients/{test_client_id}/notes", headers=_auth(owner_token), timeout=15)
    notes_after = r2.json()
    assert all(n["id"] != target_id for n in notes_after)
    assert len(notes_after) == len(notes_before) - 1


def test_delete_unknown_note_404(session, owner_token, test_client_id):
    d = session.delete(
        f"{BASE_URL}/api/clients/{test_client_id}/notes/does-not-exist-{uuid.uuid4().hex[:6]}",
        headers=_auth(owner_token), timeout=15
    )
    assert d.status_code == 404


def test_notes_on_unknown_client_404(session, owner_token):
    bogus = f"nope-{uuid.uuid4().hex[:8]}"
    r = session.get(f"{BASE_URL}/api/clients/{bogus}/notes", headers=_auth(owner_token), timeout=15)
    assert r.status_code == 404
    p = session.post(f"{BASE_URL}/api/clients/{bogus}/notes",
                     json={"text": "hola"}, headers=_auth(owner_token), timeout=15)
    assert p.status_code == 404


def test_notes_require_auth(session, test_client_id):
    r = session.get(f"{BASE_URL}/api/clients/{test_client_id}/notes", timeout=15)
    assert r.status_code in (401, 403)
