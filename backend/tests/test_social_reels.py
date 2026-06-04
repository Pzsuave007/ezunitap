"""Backend tests for Estudio de Marketing Phase 2 — Reels (vertical video) EXPANDED.

Covers:
- GET /api/social/music returns the 6 bundled tracks each with /api/social/music/{id} URL
- GET /api/social/music/epica returns audio bytes
- POST /api/social/reels happy path A: showcase (2 photos, fade, motion=auto, outro, energetica, 10s)
- POST /api/social/reels happy path B: services + subtitles + voiceover + outro + epica + deslizar + 15s
- POST /api/social/reels happy path C: before_after (exactly 2 photos, music=none, 10s, voiceover=false)
- Validation: before_after with 1 photo -> 400 Spanish; showcase with 0 photos -> 400
- Stored reel reflects all phase-2 params; DELETE returns {ok:true}
- REGRESSION: POST /api/social/posts (showcase, 1 photo, accent_color) still works; GET /api/social/posts ok
"""
import io
import os
import time

import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "pzsuave007@gmail.com"
ADMIN_PASSWORD = "Uni2mkt007!"
POLL_TIMEOUT = 150  # 15s reel with voice can take 30-60s; allow 150s
GEN_TIMEOUT = 60


def _jpeg(color=(180, 80, 60), size=(640, 480)) -> bytes:
    im = Image.new("RGB", size, color)
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


@pytest.fixture(scope="session")
def token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="session")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def created_reels():
    return []


def _wait_for_ready(reel_id, headers, timeout=POLL_TIMEOUT):
    start = time.time()
    last = None
    while time.time() - start < timeout:
        r = requests.get(f"{BASE_URL}/api/social/reels/{reel_id}", headers=headers, timeout=30)
        assert r.status_code == 200, r.text
        last = r.json()
        if last.get("status") in ("ready", "error"):
            return last
        time.sleep(3)
    return last


# --- Music endpoints ---------------------------------------------------------
class TestMusic:
    def test_list_music_has_six_bundled(self):
        r = requests.get(f"{BASE_URL}/api/social/music", timeout=30)
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        ids = {t["id"] for t in items}
        expected = {"energetica", "corporativa", "lofi", "epica", "alegre", "urbana"}
        assert expected.issubset(ids), f"missing tracks; got {ids}"
        for t in items:
            assert "url" in t and t["url"].startswith("/api/social/music/")

    def test_get_epica_returns_audio_bytes(self):
        r = requests.get(f"{BASE_URL}/api/social/music/epica", timeout=30)
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert "audio" in ct, f"unexpected ct {ct}"
        assert len(r.content) > 1024, "audio too small"

    def test_unknown_track_404(self):
        r = requests.get(f"{BASE_URL}/api/social/music/doesnotexist", timeout=30)
        assert r.status_code == 404


# --- Happy path A: showcase + outro + energetica + 10s -----------------------
class TestReelShowcase:
    def test_showcase_with_outro_and_music(self, auth_headers, created_reels):
        files = [
            ("files", ("a.jpg", _jpeg((200, 80, 60)), "image/jpeg")),
            ("files", ("b.jpg", _jpeg((40, 120, 200)), "image/jpeg")),
        ]
        data = {
            "brief": "Servicio profesional de jardineria. Cotizacion gratis.",
            "language": "en",
            "template": "showcase",
            "motion": "auto",
            "transition": "fade",
            "outro": "true",
            "subtitles": "false",
            "voiceover": "false",
            "duration": "10",
            "music": "energetica",
            "accent_color": "#f97316",
        }
        r = requests.post(f"{BASE_URL}/api/social/reels",
                          data=data, files=files, headers=auth_headers, timeout=GEN_TIMEOUT)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["status"] == "processing"
        assert doc["template"] == "showcase"
        assert doc["motion"] == "auto"
        assert doc["transition"] == "fade"
        assert doc["outro"] is True
        assert doc["duration"] in (10, 10.0)
        rid = doc["id"]
        created_reels.append(rid)

        final = _wait_for_ready(rid, auth_headers)
        assert final and final["status"] == "ready", f"reel failed: {final}"
        vurl = (final.get("video") or {}).get("url")
        assert vurl
        vr = requests.get(f"{BASE_URL}{vurl}", timeout=60)
        assert vr.status_code == 200
        ct = vr.headers.get("content-type", "")
        assert "video" in ct or "mp4" in ct, f"unexpected ct {ct}"
        assert len(vr.content) > 10_000


# --- Happy path B: services + subtitles + voiceover + epica + 15s ------------
class TestReelServicesVoiceover:
    def test_services_full_options(self, auth_headers, created_reels):
        files = [
            ("files", ("s1.jpg", _jpeg((90, 60, 200)), "image/jpeg")),
            ("files", ("s2.jpg", _jpeg((60, 200, 90)), "image/jpeg")),
        ]
        data = {
            "brief": "Limpieza, mantenimiento y poda. Servicio premium.",
            "language": "en",
            "template": "services",
            "motion": "auto",
            "transition": "deslizar",
            "outro": "true",
            "subtitles": "true",
            "voiceover": "true",
            "duration": "15",
            "music": "epica",
        }
        r = requests.post(f"{BASE_URL}/api/social/reels",
                          data=data, files=files, headers=auth_headers, timeout=GEN_TIMEOUT)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["template"] == "services"
        assert doc["subtitles"] is True
        assert doc["voiceover"] is True
        assert doc["outro"] is True
        assert doc["transition"] == "deslizar"
        assert doc["duration"] in (15, 15.0)
        rid = doc["id"]
        created_reels.append(rid)

        final = _wait_for_ready(rid, auth_headers, timeout=POLL_TIMEOUT)
        assert final and final["status"] == "ready", f"reel failed: {final}"
        vurl = (final.get("video") or {}).get("url")
        assert vurl
        vr = requests.get(f"{BASE_URL}{vurl}", timeout=60)
        assert vr.status_code == 200
        assert len(vr.content) > 20_000


# --- Happy path C: before_after exactly 2 photos, no music -------------------
class TestReelBeforeAfter:
    def test_before_after_two_photos_no_music(self, auth_headers, created_reels):
        files = [
            ("files", ("before.jpg", _jpeg((60, 60, 60)), "image/jpeg")),
            ("files", ("after.jpg", _jpeg((220, 220, 80)), "image/jpeg")),
        ]
        data = {
            "brief": "Transformacion completa de jardin.",
            "language": "en",
            "template": "before_after",
            "motion": "auto",
            "transition": "fade",  # backend forces slider transition internally
            "outro": "false",
            "subtitles": "false",
            "voiceover": "false",
            "duration": "10",
            "music": "none",
        }
        r = requests.post(f"{BASE_URL}/api/social/reels",
                          data=data, files=files, headers=auth_headers, timeout=GEN_TIMEOUT)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["template"] == "before_after"
        assert doc["music"] == "none"
        rid = doc["id"]
        created_reels.append(rid)

        final = _wait_for_ready(rid, auth_headers)
        assert final and final["status"] == "ready", f"reel failed: {final}"
        vurl = (final.get("video") or {}).get("url")
        assert vurl
        vr = requests.get(f"{BASE_URL}{vurl}", timeout=60)
        assert vr.status_code == 200
        assert len(vr.content) > 10_000


# --- Validation --------------------------------------------------------------
class TestReelsValidation:
    def test_before_after_with_one_photo_400_spanish(self, auth_headers):
        files = [("files", ("one.jpg", _jpeg((100, 100, 100)), "image/jpeg"))]
        data = {"brief": "x", "language": "en", "template": "before_after",
                "music": "none", "duration": "10"}
        r = requests.post(f"{BASE_URL}/api/social/reels",
                          data=data, files=files, headers=auth_headers, timeout=30)
        assert r.status_code == 400, r.text
        body = r.text.lower()
        assert "foto" in body, f"non-spanish msg: {r.text}"
        # Should mention needing 2 photos
        assert "2" in r.text, f"expected '2 fotos' message, got: {r.text}"

    def test_showcase_with_no_photos_400(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/social/reels",
            data={"brief": "x", "language": "en", "template": "showcase", "music": "none"},
            files=[],
            headers=auth_headers, timeout=30,
        )
        assert r.status_code == 400
        assert "foto" in r.text.lower()


# --- List & delete -----------------------------------------------------------
class TestReelsListDelete:
    def test_list_then_delete(self, auth_headers, created_reels):
        assert created_reels, "no reel to delete"
        r = requests.get(f"{BASE_URL}/api/social/reels", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        ids = [d["id"] for d in r.json()]
        for rid in created_reels:
            assert rid in ids, f"reel {rid} missing"

        for rid in list(created_reels):
            d = requests.delete(f"{BASE_URL}/api/social/reels/{rid}", headers=auth_headers, timeout=30)
            assert d.status_code == 200, d.text
            assert d.json().get("ok") is True
        # 404 on repeat delete
        rd = requests.delete(f"{BASE_URL}/api/social/reels/{created_reels[0]}", headers=auth_headers, timeout=30)
        assert rd.status_code == 404
        created_reels.clear()


# --- Regression: image post --------------------------------------------------
class TestRegressionImagePost:
    def test_image_post_showcase_with_accent_color(self, auth_headers):
        files = [("files", ("p.jpg", _jpeg((150, 90, 60)), "image/jpeg"))]
        data = {
            "template": "showcase",
            "brief": "Promo de prueba.",
            "language": "en",
            "formats": "1x1",
            "accent_color": "#f59e0b",
        }
        r = requests.post(f"{BASE_URL}/api/social/posts",
                          data=data, files=files, headers=auth_headers, timeout=GEN_TIMEOUT)
        assert r.status_code == 200, r.text
        post = r.json()
        assert post.get("accent_color") == "#f59e0b", post
        assert len(post["images"]) == 1
        # list
        lr = requests.get(f"{BASE_URL}/api/social/posts", headers=auth_headers, timeout=30)
        assert lr.status_code == 200
        # cleanup
        requests.delete(f"{BASE_URL}/api/social/posts/{post['id']}", headers=auth_headers, timeout=30)
