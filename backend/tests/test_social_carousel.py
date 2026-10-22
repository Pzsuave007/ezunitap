# Carousel feature regression tests: Marketing Studio endpoint + assistant draft->approve/discard/regenerate
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
EMAIL = "pzsuave007@gmail.com"
PASSWORD = "Uni2mkt007!"
IMG_DIR = "/tmp/carousel_imgs"
CREATED = []


def _files(n):
    return [("files", (f"photo{i + 1}.jpg", open(f"{IMG_DIR}/photo{i + 1}.jpg", "rb"), "image/jpeg")) for i in range(n)]


@pytest.fixture(scope="module")
def s():
    if not os.path.exists(f"{IMG_DIR}/photo1.jpg"):
        os.system("python /app/tests/make_test_images.py")
    ses = requests.Session()
    r = ses.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    tok = r.json().get("token") or r.json().get("access_token")
    ses.headers.update({"Authorization": f"Bearer {tok}"})
    yield ses
    for pid in CREATED:
        ses.delete(f"{BASE_URL}/api/social/posts/{pid}")


# --- Marketing Studio carousel endpoint
class TestCarouselEndpoint:
    def test_gallery_3_photos(self, s):
        r = s.post(f"{BASE_URL}/api/social/carousel", data={"kind": "gallery", "brief": "TEST_ remodel de cocina", "language": "es"},
                   files=_files(3), timeout=180)
        assert r.status_code == 200, r.text
        d = r.json()
        CREATED.append(d["id"])
        assert d["type"] == "carousel" and d["carousel_kind"] == "gallery"
        kinds = [x["kind"] for x in d["slides"]]
        assert kinds == ["cover", "photo", "photo", "photo", "cta"], kinds
        assert d["images"][0]["url"] == d["slides"][0]["url"]
        assert "_id" not in d
        # slide image publicly fetchable (download uses unauthenticated fetch)
        img = requests.get(f"{BASE_URL}{d['slides'][1]['url']}")
        assert img.status_code == 200 and img.headers.get("content-type", "").startswith("image")

    def test_before_after(self, s):
        r = s.post(f"{BASE_URL}/api/social/carousel", data={"kind": "before_after", "brief": "TEST_ pintura", "language": "es"},
                   files=_files(3), timeout=180)
        assert r.status_code == 200, r.text
        d = r.json()
        CREATED.append(d["id"])
        assert [x["kind"] for x in d["slides"]] == ["before", "after", "cta"]
        assert len(d["source_photo_ids"]) == 2

    def test_one_photo_400(self, s):
        r = s.post(f"{BASE_URL}/api/social/carousel", data={"kind": "gallery", "brief": "TEST_x"}, files=_files(1))
        assert r.status_code == 400
        assert "al menos 2 fotos" in r.json()["detail"]

    def test_listed_in_posts(self, s):
        r = s.get(f"{BASE_URL}/api/social/posts")
        assert r.status_code == 200
        ids = {p["id"] for p in r.json()}
        for pid in CREATED:
            assert pid in ids


# --- Assistant carousel draft flow
def _upload_chat(s, sid, msg, n):
    data = {"message": msg, "lang": "es", "session_id": sid}
    return s.post(f"{BASE_URL}/api/assistant/chat", data=data, files=_files(n) if n else None, timeout=180)


def _post_id(reply):
    import re
    m = re.search(r"\[\[POST:([^\]]+)\]\]", reply)
    return m.group(1) if m else None


class TestAssistantCarousel:
    def test_assistant_one_photo_guard(self, s):
        sid = f"TEST_sess_{int(time.time())}_a"
        r = _upload_chat(s, sid, "Hazme un carrusel galería con esta foto", 1)
        print(r.status_code, r.text[:400])
        assert r.status_code == 200, r.text
        d = r.json()
        assert not (d.get("action") == "create_carousel" and d.get("needs_confirmation"))
        assert "2 fotos" in d["reply"] or "fotos" in d["reply"].lower()

    def test_assistant_full_flow(self, s):
        sid = f"TEST_sess_{int(time.time())}_b"
        r = _upload_chat(s, sid, "Hazme un carrusel galería con estas fotos de una cocina remodelada", 3)
        assert r.status_code == 200, r.text
        d = r.json()
        print("chat:", d)
        if not d.get("needs_confirmation"):
            r = _upload_chat(s, sid, "Sí, hazlo así", 0)
            d = r.json()
            print("chat2:", d)
        assert d.get("needs_confirmation") and d.get("action") == "create_carousel", d
        ex = s.post(f"{BASE_URL}/api/assistant/execute", json={"session_id": sid, "lang": "es"}, timeout=180)
        assert ex.status_code == 200, ex.text
        reply = ex.json()["reply"]
        print("exec:", reply)
        pid = _post_id(reply)
        assert pid and "[[IMG:" in reply
        # Draft must NOT be listed
        assert pid not in {p["id"] for p in s.get(f"{BASE_URL}/api/social/posts").json()}
        # Regenerate -> new draft id, old removed
        rg = s.post(f"{BASE_URL}/api/assistant/post-regenerate", json={"post_id": pid, "session_id": sid, "lang": "es"}, timeout=180)
        assert rg.status_code == 200, rg.text
        pid2 = _post_id(rg.json()["reply"])
        assert pid2 and pid2 != pid
        # Approve -> listed as carousel
        ap = s.post(f"{BASE_URL}/api/assistant/post-approve", json={"post_id": pid2, "session_id": sid, "lang": "es"})
        assert ap.status_code == 200
        CREATED.append(pid2)
        posts = {p["id"]: p for p in s.get(f"{BASE_URL}/api/social/posts").json()}
        assert pid2 in posts and posts[pid2]["type"] == "carousel" and posts[pid2]["status"] == "active"
        assert len(posts[pid2]["slides"]) == 5

    def test_assistant_discard(self, s):
        sid = f"TEST_sess_{int(time.time())}_c"
        r = _upload_chat(s, sid, "Hazme un carrusel de antes y después con estas 2 fotos de una pared pintada", 2)
        d = r.json()
        print("chat:", d)
        if not d.get("needs_confirmation"):
            d = _upload_chat(s, sid, "Sí, hazlo", 0).json()
        assert d.get("needs_confirmation"), d
        reply = s.post(f"{BASE_URL}/api/assistant/execute", json={"session_id": sid, "lang": "es"}, timeout=180).json()["reply"]
        print("exec:", reply)
        pid = _post_id(reply)
        assert pid and "3 tarjetas" in reply
        dc = s.post(f"{BASE_URL}/api/assistant/post-discard", json={"post_id": pid, "session_id": sid, "lang": "es"})
        assert dc.status_code == 200
        assert pid not in {p["id"] for p in s.get(f"{BASE_URL}/api/social/posts").json()}
