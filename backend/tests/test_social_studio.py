"""Backend tests for Estudio de Marketing (/api/social/*) endpoints.

Covers:
- POST /api/social/posts (validation, generation, output formats)
- POST /api/social/posts/{id}/rerender (image diff + soft-delete)
- GET  /api/social/posts (list ordering)
- DELETE /api/social/posts/{id} (cleanup)
- Language=es Spanish output sanity check
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
GEN_TIMEOUT = 180  # generation hits real LLM, can be slow


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _jpeg_bytes(color=(180, 80, 60), size=(640, 480)) -> bytes:
    img = Image.new("RGB", size, color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


@pytest.fixture(scope="session")
def token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok, f"no token in {data}"
    return tok


@pytest.fixture(scope="session")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def created_post_ids():
    return []


def _post_multipart(template, files, language="en", formats="9x16,1x1",
                    brief="Transformamos este jardin descuidado en uno hermoso. Servicio profesional con cotizacion gratis.",
                    headers=None):
    data = {
        "template": template,
        "brief": brief,
        "language": language,
        "formats": formats,
    }
    return requests.post(
        f"{BASE_URL}/api/social/posts",
        data=data,
        files=files,
        headers=headers,
        timeout=GEN_TIMEOUT,
    )


# ---------------------------------------------------------------------------
# Validation tests (fast, no LLM)
# ---------------------------------------------------------------------------

class TestValidation:
    def test_invalid_template_returns_400(self, auth_headers):
        files = [("files", ("a.jpg", _jpeg_bytes(), "image/jpeg"))]
        r = _post_multipart("not_a_template", files, headers=auth_headers)
        assert r.status_code == 400
        assert "Plantilla" in r.text or "invalid" in r.text.lower()

    def test_before_after_requires_two_photos(self, auth_headers):
        # 1 photo only -> 400 (Spanish msg)
        files = [("files", ("a.jpg", _jpeg_bytes(), "image/jpeg"))]
        r = _post_multipart("before_after", files, headers=auth_headers)
        assert r.status_code == 400
        assert "2 fotos" in r.text or "Antes" in r.text

    def test_showcase_requires_one_photo(self, auth_headers):
        # 0 photos -> 400
        r = _post_multipart("showcase", files=[], headers=auth_headers)
        assert r.status_code == 400
        assert "foto" in r.text.lower()

    def test_unauthenticated_rejected(self):
        files = [("files", ("a.jpg", _jpeg_bytes(), "image/jpeg"))]
        r = _post_multipart("showcase", files)
        assert r.status_code in (401, 403)


# ---------------------------------------------------------------------------
# Generation tests (slow, hit real LLM)
# ---------------------------------------------------------------------------

class TestShowcaseGeneration:
    def test_showcase_en_two_formats(self, auth_headers, created_post_ids):
        files = [("files", ("photo.jpg", _jpeg_bytes((40, 120, 200)), "image/jpeg"))]
        r = _post_multipart("showcase", files, language="en",
                            formats="9x16,1x1", headers=auth_headers)
        assert r.status_code == 200, r.text
        post = r.json()
        # shape
        assert "id" in post
        assert post["template"] == "showcase"
        copy = post["copy"]
        for k in ("headline", "subheadline", "cta", "caption", "hashtags"):
            assert k in copy, f"missing {k}"
        assert isinstance(copy["hashtags"], list)
        # 2 images, one per format
        imgs = post["images"]
        assert len(imgs) == 2
        formats_set = {i["format"] for i in imgs}
        assert formats_set == {"9x16", "1x1"}
        # Each image URL must serve real JPEG bytes
        for img in imgs:
            url = f"{BASE_URL}{img['url']}"
            resp = requests.get(url, timeout=30)
            assert resp.status_code == 200, f"image fetch failed: {url}"
            ct = resp.headers.get("content-type", "")
            assert "image" in ct, f"unexpected content-type {ct}"
            # JPEG magic bytes
            assert resp.content[:3] == b"\xff\xd8\xff", "not a JPEG"
            # sanity: PIL can open
            Image.open(io.BytesIO(resp.content)).verify()
        created_post_ids.append(post["id"])


class TestBeforeAfterGeneration:
    def test_before_after_two_photos_ok(self, auth_headers, created_post_ids):
        files = [
            ("files", ("before.jpg", _jpeg_bytes((90, 70, 50)), "image/jpeg")),
            ("files", ("after.jpg", _jpeg_bytes((30, 160, 90)), "image/jpeg")),
        ]
        r = _post_multipart("before_after", files, language="en",
                            formats="1x1", headers=auth_headers)
        assert r.status_code == 200, r.text
        post = r.json()
        assert post["template"] == "before_after"
        assert len(post["images"]) == 1
        assert post["images"][0]["format"] == "1x1"
        created_post_ids.append(post["id"])


class TestSpanishOutput:
    def test_language_es_returns_spanish_copy(self, auth_headers, created_post_ids):
        files = [("files", ("p.jpg", _jpeg_bytes((200, 150, 90)), "image/jpeg"))]
        r = _post_multipart("promo", files, language="es",
                            formats="1x1", headers=auth_headers,
                            brief="Promocion especial: 20% de descuento en limpieza de canaletas este mes. Llama para reservar.")
        assert r.status_code == 200, r.text
        post = r.json()
        assert post["language"] == "es"
        text_blob = " ".join(
            str(post["copy"].get(k, "")) for k in ("headline", "subheadline", "cta", "caption")
        ).lower()
        # Heuristic: Spanish copy should contain at least one common Spanish token.
        es_markers = ["á", "é", "í", "ó", "ú", "ñ", "¿", "¡",
                      " gratis", " ahora", " llama", " hoy", " nuestro",
                      " nuestra", " oferta", "descuento", "calidad", " con ",
                      " para ", " tu ", " su ", "servicio"]
        assert any(m in text_blob for m in es_markers), f"no spanish markers in: {text_blob[:200]}"
        created_post_ids.append(post["id"])


# ---------------------------------------------------------------------------
# Rerender / List / Delete
# ---------------------------------------------------------------------------

class TestRerenderListDelete:
    def test_rerender_changes_image_ids(self, auth_headers, created_post_ids):
        assert created_post_ids, "no post available for rerender"
        post_id = created_post_ids[0]
        # fetch current
        r = requests.get(f"{BASE_URL}/api/social/posts", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        original = next(p for p in r.json() if p["id"] == post_id)
        original_photo_ids = [i["photo_id"] for i in original["images"]]

        payload = {
            "headline": "Edited Headline TEST",
            "cta": "Call Today",
        }
        r2 = requests.post(
            f"{BASE_URL}/api/social/posts/{post_id}/rerender",
            json=payload,
            headers=auth_headers,
            timeout=GEN_TIMEOUT,
        )
        assert r2.status_code == 200, r2.text
        updated = r2.json()
        assert updated["copy"]["headline"] == "Edited Headline TEST"
        assert updated["copy"]["cta"] == "Call Today"
        new_photo_ids = [i["photo_id"] for i in updated["images"]]
        # New images must differ from old ones
        assert set(new_photo_ids).isdisjoint(set(original_photo_ids)), \
            f"rerender returned same photo_ids: {new_photo_ids} vs {original_photo_ids}"
        # New image URLs return valid JPEGs
        for img in updated["images"]:
            resp = requests.get(f"{BASE_URL}{img['url']}", timeout=30)
            assert resp.status_code == 200
            assert resp.content[:3] == b"\xff\xd8\xff"
        # Old image URLs should now 404 (soft-deleted)
        old_url = f"{BASE_URL}/api/public/card/photo/{original_photo_ids[0]}"
        old_resp = requests.get(old_url, timeout=30)
        assert old_resp.status_code in (404, 410), \
            f"old image still served: {old_resp.status_code}"

    def test_list_returns_user_posts_recent_first(self, auth_headers, created_post_ids):
        r = requests.get(f"{BASE_URL}/api/social/posts", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        # All our created IDs should appear
        ids = [p["id"] for p in items]
        for pid in created_post_ids:
            assert pid in ids, f"missing post {pid} in history"
        # ordering: created_at descending
        if len(items) >= 2:
            assert items[0]["created_at"] >= items[1]["created_at"]

    def test_delete_post_and_404_on_relist(self, auth_headers, created_post_ids):
        # delete every post we created
        for pid in list(created_post_ids):
            r = requests.delete(
                f"{BASE_URL}/api/social/posts/{pid}",
                headers=auth_headers, timeout=30,
            )
            assert r.status_code == 200, r.text
            assert r.json().get("ok") is True
        # verify gone
        r = requests.get(f"{BASE_URL}/api/social/posts", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        remaining_ids = {p["id"] for p in r.json()}
        for pid in created_post_ids:
            assert pid not in remaining_ids
        # 2nd delete -> 404
        r2 = requests.delete(
            f"{BASE_URL}/api/social/posts/{created_post_ids[0]}",
            headers=auth_headers, timeout=30,
        )
        assert r2.status_code == 404
        created_post_ids.clear()
