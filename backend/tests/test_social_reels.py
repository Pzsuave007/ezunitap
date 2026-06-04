"""Backend tests for Estudio de Marketing Phase 2 — Reels (vertical video).

Covers:
- GET /api/social/music (3 bundled tracks)
- GET /api/social/music/{track_id} (mp3 bytes)
- POST /api/social/reels (multipart): happy path with bundled music + accent_color
- Polling GET /api/social/reels/{id} until ready
- Served MP4 has correct content-type & is non-empty
- POST /api/social/reels with no photos -> 400 Spanish error
- POST /api/social/reels with music=none -> ready reel
- GET /api/social/reels list, DELETE /api/social/reels/{id}
- Regression: POST /api/social/posts (showcase, brand_color + accent_color)
- Regression: DELETE /api/card/logo not shadowed by /card/{card_id}
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
POLL_TIMEOUT = 120
GEN_TIMEOUT = 180


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


# ---------------------------------------------------------------------------
# Music endpoints
# ---------------------------------------------------------------------------
class TestMusic:
    def test_list_music_has_three_bundled(self):
        r = requests.get(f"{BASE_URL}/api/social/music", timeout=30)
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        ids = {t["id"] for t in items}
        assert {"energetica", "corporativa", "lofi"}.issubset(ids), f"got {ids}"
        for t in items:
            assert "url" in t and t["url"].startswith("/api/social/music/")

    def test_get_track_returns_audio_bytes(self):
        r = requests.get(f"{BASE_URL}/api/social/music/energetica", timeout=30)
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert "audio" in ct, f"unexpected ct {ct}"
        assert len(r.content) > 1024, "audio too small"

    def test_unknown_track_404(self):
        r = requests.get(f"{BASE_URL}/api/social/music/doesnotexist", timeout=30)
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Reels happy path
# ---------------------------------------------------------------------------
class TestReelsHappyPath:
    def test_create_reel_with_music_and_poll_ready(self, auth_headers, created_reels):
        files = [
            ("files", ("a.jpg", _jpeg((200, 80, 60)), "image/jpeg")),
            ("files", ("b.jpg", _jpeg((40, 120, 200)), "image/jpeg")),
        ]
        data = {
            "brief": "Servicio profesional de jardineria. Cotizacion gratis.",
            "language": "en",
            "music": "energetica",
            "accent_color": "#f97316",
        }
        r = requests.post(
            f"{BASE_URL}/api/social/reels",
            data=data, files=files, headers=auth_headers, timeout=GEN_TIMEOUT,
        )
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["status"] == "processing"
        assert "id" in doc
        rid = doc["id"]
        created_reels.append(rid)

        final = _wait_for_ready(rid, auth_headers, timeout=POLL_TIMEOUT)
        assert final is not None
        assert final["status"] == "ready", f"reel failed: {final}"
        video = final.get("video") or {}
        assert "url" in video, f"no video url in {final}"

        # Fetch the served mp4
        vr = requests.get(f"{BASE_URL}{video['url']}", timeout=60)
        assert vr.status_code == 200, vr.text
        ct = vr.headers.get("content-type", "")
        assert "video" in ct or "mp4" in ct, f"unexpected ct {ct}"
        assert len(vr.content) > 10_000, f"mp4 too small: {len(vr.content)} bytes"

    def test_create_reel_no_music(self, auth_headers, created_reels):
        files = [("files", ("c.jpg", _jpeg((50, 200, 90)), "image/jpeg"))]
        data = {"brief": "Limpieza profesional.", "language": "es", "music": "none"}
        r = requests.post(
            f"{BASE_URL}/api/social/reels",
            data=data, files=files, headers=auth_headers, timeout=GEN_TIMEOUT,
        )
        assert r.status_code == 200, r.text
        rid = r.json()["id"]
        created_reels.append(rid)
        final = _wait_for_ready(rid, auth_headers, timeout=POLL_TIMEOUT)
        assert final["status"] == "ready", f"reel failed: {final}"
        assert final["music"] == "none"
        assert (final.get("video") or {}).get("url")


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
class TestReelsValidation:
    def test_no_photos_returns_400_spanish(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/social/reels",
            data={"brief": "x", "language": "en", "music": "none"},
            files=[],
            headers=auth_headers, timeout=30,
        )
        assert r.status_code == 400
        body = r.text.lower()
        assert "foto" in body, f"non-spanish msg: {r.text}"


# ---------------------------------------------------------------------------
# List & delete
# ---------------------------------------------------------------------------
class TestReelsListDelete:
    def test_list_then_delete(self, auth_headers, created_reels):
        assert created_reels, "no reel to delete"
        r = requests.get(f"{BASE_URL}/api/social/reels", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        ids = [d["id"] for d in r.json()]
        for rid in created_reels:
            assert rid in ids, f"reel {rid} missing from list"

        for rid in list(created_reels):
            d = requests.delete(f"{BASE_URL}/api/social/reels/{rid}", headers=auth_headers, timeout=30)
            assert d.status_code == 200, d.text
            assert d.json().get("ok") is True

        r2 = requests.get(f"{BASE_URL}/api/social/reels", headers=auth_headers, timeout=30)
        remaining = {d["id"] for d in r2.json()}
        for rid in created_reels:
            assert rid not in remaining
        # 404 on second delete
        rd = requests.delete(f"{BASE_URL}/api/social/reels/{created_reels[0]}", headers=auth_headers, timeout=30)
        assert rd.status_code == 404
        created_reels.clear()


# ---------------------------------------------------------------------------
# Regressions
# ---------------------------------------------------------------------------
class TestRegression:
    def test_image_post_still_works_with_brand_colors(self, auth_headers):
        files = [("files", ("p.jpg", _jpeg((150, 90, 60)), "image/jpeg"))]
        data = {
            "template": "showcase",
            "brief": "Promo de prueba.",
            "language": "en",
            "formats": "1x1",
            "brand_color": "#171717",
            "accent_color": "#f59e0b",
        }
        r = requests.post(
            f"{BASE_URL}/api/social/posts",
            data=data, files=files, headers=auth_headers, timeout=GEN_TIMEOUT,
        )
        assert r.status_code == 200, r.text
        post = r.json()
        assert post.get("brand_color") == "#171717", post
        assert post.get("accent_color") == "#f59e0b", post
        assert len(post["images"]) == 1
        # cleanup
        requests.delete(f"{BASE_URL}/api/social/posts/{post['id']}", headers=auth_headers, timeout=30)

    def test_delete_card_logo_not_shadowed(self, auth_headers):
        # Should hit logo handler, NOT delete_card({card_id=logo}) which would 404 'Tarjeta no encontrada'.
        r = requests.delete(f"{BASE_URL}/api/card/logo", headers=auth_headers, timeout=30)
        # Acceptable: 200 (no logo to delete still ok) OR 404 with a message that is NOT 'Tarjeta no encontrada'.
        assert r.status_code in (200, 404), r.text
        if r.status_code == 404:
            assert "Tarjeta no encontrada" not in r.text, \
                f"route shadowed by /card/{{card_id}}: {r.text}"
