"""Backend tests for the new online appointment booking feature.

Covers:
- Public availability endpoint shape (enabled, duration, dates, slots)
- Public booking endpoint: success, validation errors, 409 double-booking
- Authenticated owner endpoints: list appointments, mark viewed
- Side-effects: client + job created on booking
"""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
SLUG = "uni2-marketing-agency"
OWNER_EMAIL = "pzsuave007@gmail.com"
OWNER_PASSWORD = "Uni2mkt007!"


@pytest.fixture(scope="session")
def owner_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    j = r.json()
    return j.get("access_token") or j.get("token")


@pytest.fixture(scope="session")
def auth_headers(owner_token):
    return {"Authorization": f"Bearer {owner_token}"}


@pytest.fixture(scope="session")
def availability():
    r = requests.get(f"{BASE_URL}/api/public/card/{SLUG}/availability", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("enabled") is True, "Appointments should be enabled on uni2-marketing-agency"
    assert isinstance(data.get("dates"), list)
    assert len(data["dates"]) > 0, "Expected at least one available date"
    assert isinstance(data.get("duration"), int)
    return data


class TestAvailability:
    def test_availability_shape(self, availability):
        first = availability["dates"][0]
        assert "date" in first and "weekday" in first and "slots" in first
        assert isinstance(first["slots"], list) and len(first["slots"]) > 0
        # weekday must be one of Mon-Fri (0..4) per fixture config
        for d in availability["dates"]:
            assert d["weekday"] in {0, 1, 2, 3, 4}

    def test_duration_is_60(self, availability):
        assert availability["duration"] == 60


class TestBooking:
    booked = {}

    def test_book_success_creates_client_job_appointment(self, availability, auth_headers):
        # Pick the first available date+slot dynamically
        date_obj = availability["dates"][0]
        date_str = date_obj["date"]
        slot = date_obj["slots"][0]
        name = f"TEST_Booking_{int(time.time())}"
        payload = {
            "name": name,
            "phone": "5551234567",
            "email": "test_appt@example.com",
            "date": date_str,
            "start_time": slot,
            "notes": "Automated pytest booking",
        }
        r = requests.post(
            f"{BASE_URL}/api/public/card/{SLUG}/appointment",
            json=payload, timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        appt = data["appointment"]
        assert appt["name"] == name
        assert appt["date"] == date_str
        assert appt["start_time"] == slot
        assert appt["status"] == "confirmed"
        assert appt["viewed"] is False
        assert "_id" not in appt
        assert appt.get("client_id") and appt.get("job_id")
        TestBooking.booked = {
            "date": date_str, "slot": slot, "appt_id": appt["id"],
            "client_id": appt["client_id"], "job_id": appt["job_id"],
            "name": name,
        }

        # Side effect: client present in CRM list
        rc = requests.get(f"{BASE_URL}/api/clients", headers=auth_headers, timeout=20)
        assert rc.status_code == 200
        clients = rc.json() if isinstance(rc.json(), list) else rc.json().get("clients", [])
        assert any(c.get("id") == appt["client_id"] for c in clients), "Booked client should show in /api/clients"

        # Side effect: job present in /api/jobs (Calendar)
        rj = requests.get(f"{BASE_URL}/api/jobs", headers=auth_headers, timeout=20)
        assert rj.status_code == 200
        jobs = rj.json() if isinstance(rj.json(), list) else rj.json().get("jobs", [])
        job = next((j for j in jobs if j.get("id") == appt["job_id"]), None)
        assert job, "Booked job should show in /api/jobs"
        assert job.get("scheduled_date") == date_str
        assert job.get("start_time") == slot
        assert job.get("source") == "appointment"

    def test_double_book_returns_409(self):
        b = TestBooking.booked
        assert b, "Run test_book_success first"
        r = requests.post(
            f"{BASE_URL}/api/public/card/{SLUG}/appointment",
            json={
                "name": "TEST_DoubleBook",
                "phone": "5550000000",
                "date": b["date"],
                "start_time": b["slot"],
            },
            timeout=20,
        )
        assert r.status_code == 409, r.text

    def test_slot_removed_from_availability(self):
        b = TestBooking.booked
        r = requests.get(f"{BASE_URL}/api/public/card/{SLUG}/availability", timeout=20)
        assert r.status_code == 200
        data = r.json()
        for d in data["dates"]:
            if d["date"] == b["date"]:
                assert b["slot"] not in d["slots"], "Booked slot must not reappear"
                break

    def test_validation_missing_name(self, availability):
        first = availability["dates"][0]
        r = requests.post(
            f"{BASE_URL}/api/public/card/{SLUG}/appointment",
            json={"name": "  ", "date": first["date"], "start_time": first["slots"][-1]},
            timeout=20,
        )
        assert r.status_code == 400

    def test_validation_past_date(self):
        r = requests.post(
            f"{BASE_URL}/api/public/card/{SLUG}/appointment",
            json={"name": "TEST_Past", "date": "2020-01-01", "start_time": "10:00"},
            timeout=20,
        )
        assert r.status_code == 400

    def test_validation_invalid_slot(self, availability):
        first = availability["dates"][0]
        r = requests.post(
            f"{BASE_URL}/api/public/card/{SLUG}/appointment",
            json={"name": "TEST_Invalid", "date": first["date"], "start_time": "03:13"},
            timeout=20,
        )
        assert r.status_code == 400


class TestOwnerEndpoints:
    def test_list_appointments_contains_booking(self, auth_headers):
        b = TestBooking.booked
        assert b
        r = requests.get(f"{BASE_URL}/api/appointments", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data.get("appointments"), list)
        assert isinstance(data.get("new_count"), int)
        ours = next((a for a in data["appointments"] if a.get("id") == b["appt_id"]), None)
        assert ours, "Booked appt must be present in /api/appointments"
        assert ours.get("viewed") is False
        assert "_id" not in ours

    def test_list_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/appointments", timeout=20)
        assert r.status_code in (401, 403)

    def test_mark_viewed(self, auth_headers):
        b = TestBooking.booked
        r = requests.post(
            f"{BASE_URL}/api/appointments/{b['appt_id']}/viewed",
            headers=auth_headers, timeout=20,
        )
        assert r.status_code == 200
        assert r.json().get("ok") is True

        r2 = requests.get(f"{BASE_URL}/api/appointments", headers=auth_headers, timeout=20)
        assert r2.status_code == 200
        ours = next((a for a in r2.json()["appointments"] if a.get("id") == b["appt_id"]), None)
        assert ours and ours.get("viewed") is True


class TestCardSettingsToggle:
    """Toggle request_estimate_enabled off/on via the API."""

    def test_toggle_request_estimate(self, auth_headers):
        # OFF
        r = requests.put(
            f"{BASE_URL}/api/card/settings",
            headers=auth_headers,
            json={"request_estimate_enabled": False},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        r2 = requests.get(f"{BASE_URL}/api/public/card/{SLUG}", timeout=20)
        assert r2.status_code == 200
        card2 = r2.json().get("card", r2.json())
        assert card2.get("request_estimate_enabled") is False

        # ON
        r3 = requests.put(
            f"{BASE_URL}/api/card/settings",
            headers=auth_headers,
            json={"request_estimate_enabled": True},
            timeout=20,
        )
        assert r3.status_code == 200
        r4 = requests.get(f"{BASE_URL}/api/public/card/{SLUG}", timeout=20)
        card4 = r4.json().get("card", r4.json())
        assert card4.get("request_estimate_enabled") is True
