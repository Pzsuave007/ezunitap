"""End-to-end backend tests for Unitap.

Tests every domain in order so resources build on each other:
auth -> dashboard -> clients -> AI quote -> quotes -> invoices -> jobs
-> messages -> photos -> reminders -> public quote -> auth gating.
"""
import base64
import io
import os
import time

import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://contractor-card-beta.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

EMAIL = "demo@servicioflow.com"
PASSWORD = "Demo1234!"

STATE = {}  # shared mutable state across tests


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def token(session):
    # try register, fallback to login
    r = session.post(f"{API}/auth/register", json={
        "email": EMAIL, "password": PASSWORD,
        "business_name": "Demo Contracting LLC",
        "owner_name": "Juan Perez", "phone": "555-0100",
    })
    if r.status_code == 200:
        return r.json()["token"]
    r = session.post(f"{API}/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200, f"login failed {r.status_code}: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
def test_root_ok(session):
    r = session.get(f"{API}/")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_login_works(session):
    r = session.post(f"{API}/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200
    data = r.json()
    assert "token" in data and isinstance(data["token"], str)
    assert data["user"]["email"] == EMAIL


def test_login_invalid(session):
    r = session.post(f"{API}/auth/login", json={"email": EMAIL, "password": "wrong"})
    assert r.status_code == 401


def test_me(session, auth_headers):
    r = session.get(f"{API}/auth/me", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["email"] == EMAIL


def test_update_me(session, auth_headers):
    r = session.put(f"{API}/auth/me", headers=auth_headers,
                    json={"business_address": "123 Main St, Houston TX"})
    assert r.status_code == 200
    assert r.json()["business_address"] == "123 Main St, Houston TX"


def test_auth_gating(session):
    r = session.get(f"{API}/clients")
    assert r.status_code in (401, 403)


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
def test_dashboard_stats(session, auth_headers):
    r = session.get(f"{API}/dashboard/stats", headers=auth_headers)
    assert r.status_code == 200
    for k in ("total_clients", "quotes_sent", "invoices_pending", "active_jobs", "pending_amount"):
        assert k in r.json()


# ---------------------------------------------------------------------------
# Clients CRUD
# ---------------------------------------------------------------------------
def test_create_client(session, auth_headers):
    r = session.post(f"{API}/clients", headers=auth_headers, json={
        "name": "TEST_Carlos Mendez", "phone": "555-0101",
        "email": "carlos@example.com", "address": "9 Oak Dr",
        "job_type": "Kitchen Remodel", "notes": "Wants granite",
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["name"] == "TEST_Carlos Mendez"
    STATE["client_id"] = data["id"]


def test_get_client(session, auth_headers):
    r = session.get(f"{API}/clients/{STATE['client_id']}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["id"] == STATE["client_id"]


def test_list_clients(session, auth_headers):
    r = session.get(f"{API}/clients", headers=auth_headers)
    assert r.status_code == 200
    assert any(c["id"] == STATE["client_id"] for c in r.json())


def test_update_client(session, auth_headers):
    r = session.put(f"{API}/clients/{STATE['client_id']}", headers=auth_headers, json={
        "name": "TEST_Carlos Mendez", "phone": "555-9999",
        "email": "carlos@example.com", "address": "9 Oak Dr",
        "job_type": "Kitchen Remodel", "notes": "Updated",
    })
    assert r.status_code == 200
    assert r.json()["phone"] == "555-9999"


def test_client_history(session, auth_headers):
    r = session.get(f"{API}/clients/{STATE['client_id']}/history", headers=auth_headers)
    assert r.status_code == 200
    for k in ("quotes", "invoices", "messages", "photos", "jobs"):
        assert k in r.json()


# ---------------------------------------------------------------------------
# AI Quote (uses real GPT)
# ---------------------------------------------------------------------------
def test_ai_quote(session, auth_headers):
    r = session.post(f"{API}/ai/quote", headers=auth_headers, json={
        "description_es": "Remodelacion de cocina con gabinetes nuevos, encimera de granito y plomeria. 12x14 pies."
    }, timeout=90)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "job_title" in data
    assert "line_items" in data and isinstance(data["line_items"], list)
    assert "total" in data
    STATE["ai_quote"] = data


def test_ai_scope(session, auth_headers):
    r = session.post(f"{API}/ai/scope", headers=auth_headers, json={
        "description_es": "Pintar exterior de casa de 2 pisos"
    }, timeout=90)
    assert r.status_code == 200, r.text
    data = r.json()
    # accept either {scope_of_work: [...]} or any structured response
    assert isinstance(data, dict)


def _make_real_jpeg_b64():
    img = Image.new("RGB", (200, 150), "white")
    for x in range(200):
        for y in range(150):
            img.putpixel((x, y), ((x * 3) % 255, (y * 5) % 255, (x + y) % 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80)
    return base64.b64encode(buf.getvalue()).decode()


def test_ai_photo_quote(session, auth_headers):
    b64 = _make_real_jpeg_b64()
    last_err = None
    for attempt in range(2):
        r = session.post(f"{API}/ai/photo-quote", headers=auth_headers,
                         json={"image_base64": b64, "extra_note_es": "cocina"}, timeout=120)
        if r.status_code == 200:
            data = r.json()
            assert isinstance(data, dict)
            return
        last_err = r.text
        time.sleep(2)
    pytest.fail(f"AI photo-quote failed: {last_err}")


# ---------------------------------------------------------------------------
# Quotes CRUD
# ---------------------------------------------------------------------------
def test_create_quote(session, auth_headers):
    ai = STATE.get("ai_quote") or {}
    line_items = ai.get("line_items") or [{
        "description": "Demolition", "quantity": 1, "unit": "job",
        "unit_price": 800, "amount": 800
    }]
    # normalize amounts
    for li in line_items:
        li.setdefault("quantity", 1)
        li.setdefault("unit", "ea")
        li.setdefault("unit_price", li.get("amount", 0))
        li.setdefault("amount", li["quantity"] * li["unit_price"])
    subtotal = sum(li["amount"] for li in line_items) or 1000
    payload = {
        "client_id": STATE["client_id"],
        "job_title": ai.get("job_title", "Kitchen Remodel"),
        "scope_of_work": ai.get("scope_of_work", ["Demo old kitchen", "Install new cabinets"]),
        "line_items": line_items,
        "subtotal": subtotal, "tax_rate": 8.25,
        "tax_amount": round(subtotal * 0.0825, 2),
        "total": round(subtotal * 1.0825, 2),
        "status": "draft",
    }
    r = session.post(f"{API}/quotes", headers=auth_headers, json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["client_id"] == STATE["client_id"]
    assert data["number"].startswith("Q-")
    STATE["quote_id"] = data["id"]
    STATE["quote_total"] = data["total"]


def test_get_quote(session, auth_headers):
    r = session.get(f"{API}/quotes/{STATE['quote_id']}", headers=auth_headers)
    assert r.status_code == 200


def test_list_quotes(session, auth_headers):
    r = session.get(f"{API}/quotes", headers=auth_headers)
    assert r.status_code == 200
    assert any(q["id"] == STATE["quote_id"] for q in r.json())


def test_set_quote_sent(session, auth_headers):
    r = session.post(f"{API}/quotes/{STATE['quote_id']}/status?status=sent", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "sent"


def test_public_quote(session):
    r = session.get(f"{API}/public/quotes/{STATE['quote_id']}")
    assert r.status_code == 200
    body = r.json()
    assert body["quote"]["id"] == STATE["quote_id"]
    assert body["business"]["email"] == EMAIL


def test_convert_quote_to_invoice(session, auth_headers):
    r = session.post(f"{API}/quotes/{STATE['quote_id']}/convert", headers=auth_headers)
    assert r.status_code == 200
    inv = r.json()
    assert inv["quote_id"] == STATE["quote_id"]
    STATE["invoice_id"] = inv["id"]


# ---------------------------------------------------------------------------
# Invoices CRUD
# ---------------------------------------------------------------------------
def test_get_invoice(session, auth_headers):
    r = session.get(f"{API}/invoices/{STATE['invoice_id']}", headers=auth_headers)
    assert r.status_code == 200


def test_list_invoices(session, auth_headers):
    r = session.get(f"{API}/invoices", headers=auth_headers)
    assert r.status_code == 200
    assert any(i["id"] == STATE["invoice_id"] for i in r.json())


def test_invoice_mark_paid(session, auth_headers):
    r = session.post(f"{API}/invoices/{STATE['invoice_id']}/status?status=paid", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "paid"
    # amount_paid should equal total
    assert abs(float(data["amount_paid"]) - float(data["total"])) < 0.01


# ---------------------------------------------------------------------------
# Jobs CRUD
# ---------------------------------------------------------------------------
def test_create_job(session, auth_headers):
    r = session.post(f"{API}/jobs", headers=auth_headers, json={
        "client_id": STATE["client_id"], "title": "TEST Kitchen Remodel Job",
        "status": "scheduled", "notes": "Start Monday",
    })
    assert r.status_code == 200
    STATE["job_id"] = r.json()["id"]


def test_update_job(session, auth_headers):
    r = session.put(f"{API}/jobs/{STATE['job_id']}", headers=auth_headers, json={
        "client_id": STATE["client_id"], "title": "TEST Kitchen Remodel Job",
        "status": "in_progress", "notes": "Started",
    })
    assert r.status_code == 200
    assert r.json()["status"] == "in_progress"


def test_list_jobs(session, auth_headers):
    r = session.get(f"{API}/jobs", headers=auth_headers)
    assert r.status_code == 200


# ---------------------------------------------------------------------------
# Messages (AI)
# ---------------------------------------------------------------------------
def test_generate_message(session, auth_headers):
    r = session.post(f"{API}/messages/generate", headers=auth_headers, json={
        "client_id": STATE["client_id"], "message_type": "follow_up_quote",
        "user_input_es": "Quiero hacer seguimiento sobre la cotizacion enviada ayer",
    }, timeout=90)
    assert r.status_code == 200, r.text
    text = r.json()["message_en"]
    assert isinstance(text, str) and len(text) > 5
    STATE["msg_en"] = text


def test_save_message(session, auth_headers):
    r = session.post(f"{API}/messages", headers=auth_headers, json={
        "client_id": STATE["client_id"], "message_type": "follow_up_quote",
        "user_input_es": "test", "message_en": STATE.get("msg_en", "Hi there"),
    })
    assert r.status_code == 200


def test_list_messages(session, auth_headers):
    r = session.get(f"{API}/messages", headers=auth_headers)
    assert r.status_code == 200


# ---------------------------------------------------------------------------
# Photos
# ---------------------------------------------------------------------------
def test_upload_photo(session, auth_headers, token):
    # multipart - send without Content-Type json header
    img = Image.new("RGB", (200, 150), "white")
    for x in range(200):
        for y in range(150):
            img.putpixel((x, y), ((x * 3) % 255, (y * 5) % 255, (x + y) % 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80)
    buf.seek(0)
    headers = {"Authorization": f"Bearer {token}"}
    files = {"file": ("test.jpg", buf, "image/jpeg")}
    params = {"client_id": STATE["client_id"], "label": "before"}
    last = None
    for _ in range(2):
        r = requests.post(f"{API}/photos", headers=headers, files=files, params=params, timeout=60)
        if r.status_code == 200:
            STATE["photo_id"] = r.json()["id"]
            return
        last = (r.status_code, r.text)
        buf.seek(0)
        time.sleep(2)
    pytest.fail(f"photo upload failed: {last}")


def test_list_photos(session, auth_headers):
    r = session.get(f"{API}/photos", headers=auth_headers, params={"client_id": STATE["client_id"]})
    assert r.status_code == 200
    assert any(p["id"] == STATE.get("photo_id") for p in r.json())


def test_get_photo_file(token):
    if "photo_id" not in STATE:
        pytest.skip("no photo")
    r = requests.get(f"{API}/photos/{STATE['photo_id']}/file", params={"auth": token}, timeout=30)
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("image/")


def test_delete_photo(session, auth_headers):
    if "photo_id" not in STATE:
        pytest.skip("no photo")
    r = session.delete(f"{API}/photos/{STATE['photo_id']}", headers=auth_headers)
    assert r.status_code == 200


# ---------------------------------------------------------------------------
# Reminders
# ---------------------------------------------------------------------------
def test_create_reminder(session, auth_headers):
    r = session.post(f"{API}/reminders", headers=auth_headers, json={
        "title": "TEST follow up", "type": "quote_follow_up",
        "client_id": STATE["client_id"], "due_date": "2026-02-01",
    })
    assert r.status_code == 200
    STATE["reminder_id"] = r.json()["id"]


def test_list_reminders(session, auth_headers):
    r = session.get(f"{API}/reminders", headers=auth_headers)
    assert r.status_code == 200


def test_complete_reminder(session, auth_headers):
    r = session.post(f"{API}/reminders/{STATE['reminder_id']}/complete", headers=auth_headers)
    assert r.status_code == 200


def test_delete_reminder(session, auth_headers):
    r = session.delete(f"{API}/reminders/{STATE['reminder_id']}", headers=auth_headers)
    assert r.status_code == 200


# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
def test_zz_cleanup(session, auth_headers):
    if STATE.get("job_id"):
        session.delete(f"{API}/jobs/{STATE['job_id']}", headers=auth_headers)
    if STATE.get("invoice_id"):
        session.delete(f"{API}/invoices/{STATE['invoice_id']}", headers=auth_headers)
    if STATE.get("quote_id"):
        session.delete(f"{API}/quotes/{STATE['quote_id']}", headers=auth_headers)
    if STATE.get("client_id"):
        session.delete(f"{API}/clients/{STATE['client_id']}", headers=auth_headers)
