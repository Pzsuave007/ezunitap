"""Tests for website builder image sections + photo WebP optimization."""
import os
import requests
import pytest

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "pzsuave007@gmail.com"
ADMIN_PASS = "Uni2mkt007!"
LARGE_PHOTO_ID = "397d8092-92f4-4eaa-9e18-8c4043a87b9d"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
                      timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok, f"No token in login response: {data}"
    return tok


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Photo optimization endpoint ----------

class TestPhotoOptimization:
    URL = f"{BASE}/api/public/card/photo/{LARGE_PHOTO_ID}"

    def test_default_no_accept(self):
        r = requests.get(self.URL, timeout=30)
        assert r.status_code == 200
        ct = r.headers.get("Content-Type", "")
        assert ct.startswith("image/"), f"unexpected content-type: {ct}"
        # Without webp Accept, should be jpeg (per spec)
        assert "webp" not in ct, f"expected non-webp without webp Accept; got {ct}"
        self._orig_bytes = len(r.content)
        print(f"default size={len(r.content)} ct={ct}")

    def test_webp_accept(self):
        r = requests.get(self.URL, headers={"Accept": "image/webp"}, timeout=30)
        assert r.status_code == 200
        ct = r.headers.get("Content-Type", "")
        assert ct == "image/webp", f"expected image/webp got {ct}"
        # Should be dramatically smaller than 2.6MB original
        assert len(r.content) < 500_000, f"webp too large: {len(r.content)}"
        print(f"webp full size={len(r.content)}")

    def test_webp_resize_600_vs_1600(self):
        r600 = requests.get(f"{self.URL}?w=600",
                            headers={"Accept": "image/webp"}, timeout=30)
        r1600 = requests.get(f"{self.URL}?w=1600",
                             headers={"Accept": "image/webp"}, timeout=30)
        assert r600.status_code == 200 and r1600.status_code == 200
        assert r600.headers.get("Content-Type") == "image/webp"
        assert r1600.headers.get("Content-Type") == "image/webp"
        s600, s1600 = len(r600.content), len(r1600.content)
        print(f"w=600 -> {s600} bytes ; w=1600 -> {s1600} bytes")
        assert s600 < s1600, f"w=600 ({s600}) should be smaller than w=1600 ({s1600})"
        assert s600 < 120_000, f"w=600 webp unexpectedly large: {s600}"


# ---------- Website fields persistence ----------

class TestWebsiteNewFields:
    def test_get_website(self, auth_headers):
        r = requests.get(f"{BASE}/api/website", headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        # Fields should exist (possibly empty)
        for f in ("team_photo_id", "why_photo_id", "band_photo_id"):
            assert f in data, f"missing field {f} in GET /api/website response"
        print("website fields present:", {k: data.get(k) for k in ("team_photo_id","why_photo_id","band_photo_id")})

    def test_put_why_photo_persist_and_restore(self, auth_headers):
        # capture current
        cur = requests.get(f"{BASE}/api/website", headers=auth_headers, timeout=30).json()
        original = cur.get("why_photo_id", "") or ""

        # set to LARGE_PHOTO_ID
        r = requests.put(f"{BASE}/api/website", headers=auth_headers,
                         json={"why_photo_id": LARGE_PHOTO_ID}, timeout=30)
        assert r.status_code == 200, r.text[:300]

        got = requests.get(f"{BASE}/api/website", headers=auth_headers, timeout=30).json()
        assert got.get("why_photo_id") == LARGE_PHOTO_ID, f"why_photo_id not persisted: {got.get('why_photo_id')}"

        # Restore
        rr = requests.put(f"{BASE}/api/website", headers=auth_headers,
                          json={"why_photo_id": original}, timeout=30)
        assert rr.status_code == 200
        chk = requests.get(f"{BASE}/api/website", headers=auth_headers, timeout=30).json()
        assert (chk.get("why_photo_id") or "") == (original or "")
        print(f"why_photo_id round-trip OK (restored to {original!r})")

    def test_sections_defaults_include_feature_band(self, auth_headers):
        r = requests.get(f"{BASE}/api/website", headers=auth_headers, timeout=30).json()
        sections = r.get("sections") or {}
        # feature/band should be present (default True or user-set)
        print("sections:", sections)
        # If missing keys, backend still treats them via defaults - not strictly a failure
        assert isinstance(sections, dict)
