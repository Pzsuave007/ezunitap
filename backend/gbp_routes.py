"""Google Business Profile (GBP / "Google My Business") integration.

Lets each contractor connect THEIR OWN verified Google Business Profile via
OAuth 2.0, then publish local posts (updates) and read / reply to reviews
directly from UniTech.

The whole OAuth flow runs server-side (the React frontend only triggers a
redirect). One refresh token is stored per user in MongoDB; access tokens are
refreshed transparently when they expire.

NOTE: Google access is approved per Cloud project. Until the project is
approved AND the OAuth client credentials are set in the environment
(GOOGLE_GBP_CLIENT_ID / GOOGLE_GBP_CLIENT_SECRET / GOOGLE_GBP_REDIRECT_URI),
the `/status` endpoint reports `configured=false` and the UI shows a friendly
"pending" state instead of failing.
"""
from __future__ import annotations

import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from starlette.responses import RedirectResponse

from auth_utils import get_current_user_id

# --- Config --------------------------------------------------------------
CLIENT_ID = os.environ.get("GOOGLE_GBP_CLIENT_ID", "").strip()
CLIENT_SECRET = os.environ.get("GOOGLE_GBP_CLIENT_SECRET", "").strip()
REDIRECT_URI = os.environ.get("GOOGLE_GBP_REDIRECT_URI", "").strip()
SCOPE = "https://www.googleapis.com/auth/business.manage"

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
ACCT_MGMT = "https://mybusinessaccountmanagement.googleapis.com"
BIZ_INFO = "https://mybusinessbusinessinformation.googleapis.com"
MB_V4 = "https://mybusiness.googleapis.com"

# Where to send the browser back after the OAuth dance. Relative path works
# because frontend + backend share the same domain in prod and preview.
FRONTEND_RETURN = "/reviews"

# --- DB (own handle to avoid a circular import with server.py) ------------
_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
_db = _client[os.environ["DB_NAME"]]
conns = _db["gbp_connections"]
states = _db["gbp_oauth_states"]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def is_configured() -> bool:
    return bool(CLIENT_ID and CLIENT_SECRET and REDIRECT_URI)


router = APIRouter(prefix="/api/google-business", tags=["google-business"])


# ========================================================================
# OAuth flow
# ========================================================================
@router.get("/status")
async def status(user_id: str = Depends(get_current_user_id)):
    """Snapshot the connection so the UI can render the right state."""
    doc = await conns.find_one({"user_id": user_id})
    connected = bool(doc and doc.get("refresh_token"))
    return {
        "configured": is_configured(),
        "connected": connected,
        "google_email": (doc or {}).get("google_email") or "",
        "account_name": (doc or {}).get("account_name") or "",
        "location_id": (doc or {}).get("location_id") or "",
        "location_title": (doc or {}).get("location_title") or "",
    }


@router.get("/connect")
async def connect(user_id: str = Depends(get_current_user_id)):
    """Return the Google consent URL (frontend then redirects the browser)."""
    if not is_configured():
        raise HTTPException(
            status_code=503,
            detail="La integración con Google aún no está habilitada (pendiente de aprobación de Google).",
        )
    state = secrets.token_urlsafe(24)
    await states.insert_one({"state": state, "user_id": user_id, "created_at": _now()})
    params = {
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent",
        "state": state,
    }
    return {"auth_url": f"{AUTH_URL}?{urlencode(params)}"}


@router.get("/callback")
async def callback(code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None):
    """Google redirects here. Exchange the code, store tokens, bounce back."""
    if error:
        return RedirectResponse(f"{FRONTEND_RETURN}?gmb=error")
    if not code or not state:
        return RedirectResponse(f"{FRONTEND_RETURN}?gmb=error")

    st = await states.find_one_and_delete({"state": state})
    if not st:
        return RedirectResponse(f"{FRONTEND_RETURN}?gmb=error")
    user_id = st["user_id"]

    async with httpx.AsyncClient() as cli:
        resp = await cli.post(
            TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "redirect_uri": REDIRECT_URI,
            },
            timeout=30.0,
        )
    if resp.status_code != 200:
        return RedirectResponse(f"{FRONTEND_RETURN}?gmb=error")

    data = resp.json()
    refresh_token = data.get("refresh_token")
    access_token = data.get("access_token")
    expires_in = int(data.get("expires_in", 3600))

    if not refresh_token:
        existing = await conns.find_one({"user_id": user_id})
        refresh_token = (existing or {}).get("refresh_token")
        if not refresh_token:
            return RedirectResponse(f"{FRONTEND_RETURN}?gmb=error")

    google_email = await _fetch_email(access_token)

    await conns.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "user_id": user_id,
                "refresh_token": refresh_token,
                "access_token": access_token,
                "access_token_expires_at": (_now() + timedelta(seconds=expires_in)).isoformat(),
                "google_email": google_email,
                "updated_at": _now().isoformat(),
            },
            "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": _now().isoformat()},
        },
        upsert=True,
    )
    # Best-effort: auto-pick the first account + location so the UI is ready.
    try:
        await _auto_select_location(user_id, access_token)
    except Exception:
        pass

    return RedirectResponse(f"{FRONTEND_RETURN}?gmb=connected")


@router.post("/disconnect")
async def disconnect(user_id: str = Depends(get_current_user_id)):
    await conns.delete_one({"user_id": user_id})
    return {"ok": True}


# ========================================================================
# Token helper
# ========================================================================
async def _valid_token(user_id: str) -> str:
    doc = await conns.find_one({"user_id": user_id})
    if not doc or not doc.get("refresh_token"):
        raise HTTPException(status_code=404, detail="Google Business Profile no está conectado.")

    exp = doc.get("access_token_expires_at")
    access = doc.get("access_token")
    expired = True
    if access and exp:
        try:
            expired = datetime.fromisoformat(exp) <= _now() + timedelta(seconds=60)
        except Exception:
            expired = True

    if not expired:
        return access

    async with httpx.AsyncClient() as cli:
        resp = await cli.post(
            TOKEN_URL,
            data={
                "grant_type": "refresh_token",
                "refresh_token": doc["refresh_token"],
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
            },
            timeout=30.0,
        )
    if resp.status_code != 200:
        if resp.json().get("error") == "invalid_grant":
            await conns.update_one(
                {"user_id": user_id},
                {"$unset": {"refresh_token": "", "access_token": "", "access_token_expires_at": ""}},
            )
            raise HTTPException(status_code=401, detail="La conexión con Google expiró. Vuelve a conectar tu cuenta.")
        raise HTTPException(status_code=502, detail="No se pudo refrescar el token de Google.")

    data = resp.json()
    access = data.get("access_token")
    expires_in = int(data.get("expires_in", 3600))
    await conns.update_one(
        {"user_id": user_id},
        {"$set": {
            "access_token": access,
            "access_token_expires_at": (_now() + timedelta(seconds=expires_in)).isoformat(),
        }},
    )
    return access


async def _fetch_email(access_token: str) -> str:
    try:
        async with httpx.AsyncClient() as cli:
            r = await cli.get(
                "https://openidconnect.googleapis.com/v1/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=15.0,
            )
        if r.status_code == 200:
            return r.json().get("email", "")
    except Exception:
        pass
    return ""


async def _auto_select_location(user_id: str, access_token: str) -> None:
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient() as cli:
        acc = await cli.get(f"{ACCT_MGMT}/v1/accounts", headers=headers, timeout=30.0)
        if acc.status_code != 200:
            return
        accounts = acc.json().get("accounts", [])
        if not accounts:
            return
        account_name = accounts[0]["name"]  # "accounts/123"
        loc = await cli.get(
            f"{BIZ_INFO}/v1/{account_name}/locations",
            headers=headers,
            params={"readMask": "name,title", "pageSize": 1},
            timeout=30.0,
        )
        location_id, location_title = "", ""
        if loc.status_code == 200:
            locs = loc.json().get("locations", [])
            if locs:
                location_id = locs[0]["name"].split("/")[-1]  # "locations/456" -> "456"
                location_title = locs[0].get("title", "")
    await conns.update_one(
        {"user_id": user_id},
        {"$set": {
            "account_name": account_name,
            "account_id": account_name.split("/")[-1],
            "location_id": location_id,
            "location_title": location_title,
        }},
    )


async def _require_location(user_id: str):
    doc = await conns.find_one({"user_id": user_id})
    if not doc or not doc.get("account_id") or not doc.get("location_id"):
        raise HTTPException(status_code=400, detail="No hay una ubicación de Google seleccionada.")
    return doc


# ========================================================================
# Business Profile operations
# ========================================================================
@router.get("/locations")
async def locations(user_id: str = Depends(get_current_user_id)):
    token = await _valid_token(user_id)
    headers = {"Authorization": f"Bearer {token}"}
    out = []
    async with httpx.AsyncClient() as cli:
        # Accounts can also paginate — follow nextPageToken to get them all.
        accounts = []
        acc_token = None
        while True:
            acc_params = {"pageSize": 100}
            if acc_token:
                acc_params["pageToken"] = acc_token
            acc = await cli.get(f"{ACCT_MGMT}/v1/accounts", headers=headers, params=acc_params, timeout=30.0)
            acc.raise_for_status()
            acc_data = acc.json()
            accounts.extend(acc_data.get("accounts", []))
            acc_token = acc_data.get("nextPageToken")
            if not acc_token:
                break

        for a in accounts:
            # Locations paginate too (default page = 10). Loop until exhausted so
            # users managing many profiles (agencies) see ALL their businesses.
            page_token = None
            while True:
                params = {"readMask": "name,title,storefrontAddress", "pageSize": 100}
                if page_token:
                    params["pageToken"] = page_token
                loc = await cli.get(
                    f"{BIZ_INFO}/v1/{a['name']}/locations",
                    headers=headers,
                    params=params,
                    timeout=30.0,
                )
                if loc.status_code != 200:
                    break
                loc_data = loc.json()
                for loc_item in loc_data.get("locations", []):
                    out.append({
                        "account_id": a["name"].split("/")[-1],
                        "location_id": loc_item["name"].split("/")[-1],
                        "title": loc_item.get("title", ""),
                    })
                page_token = loc_data.get("nextPageToken")
                if not page_token:
                    break
    return {"locations": out}


class SelectLocationIn(BaseModel):
    account_id: str
    location_id: str
    title: str = ""


@router.post("/select-location")
async def select_location(payload: SelectLocationIn, user_id: str = Depends(get_current_user_id)):
    await conns.update_one(
        {"user_id": user_id},
        {"$set": {
            "account_name": f"accounts/{payload.account_id}",
            "account_id": payload.account_id,
            "location_id": payload.location_id,
            "location_title": payload.title,
        }},
    )
    return {"ok": True}


class PostIn(BaseModel):
    summary: str
    media_url: str = ""
    photo_id: str = ""
    cta_url: str = ""


def _public_base(request: Request) -> str:
    """PUBLIC base URL (e.g. https://ezunitech.com) so Google can fetch media."""
    import re as _re
    for h in (request.headers.get("origin"), request.headers.get("referer")):
        if h:
            m = _re.match(r"^(https?://[^/]+)", h)
            if m:
                return m.group(1).rstrip("/")
    xf_host = request.headers.get("x-forwarded-host")
    if xf_host:
        proto = request.headers.get("x-forwarded-proto", "https")
        host = xf_host.split(",")[0].strip()
        if host and "127.0.0.1" not in host and "localhost" not in host:
            return f"{proto}://{host}"
    return str(request.base_url).rstrip("/")


@router.post("/posts")
async def create_post(payload: PostIn, request: Request, user_id: str = Depends(get_current_user_id)):
    if not payload.summary.strip():
        raise HTTPException(status_code=400, detail="El texto del post es obligatorio.")
    doc = await _require_location(user_id)
    token = await _valid_token(user_id)
    body: dict = {
        "languageCode": "en-US",
        "summary": payload.summary.strip(),
        "topicType": "STANDARD",
    }
    if payload.cta_url.strip():
        body["callToAction"] = {"actionType": "LEARN_MORE", "url": payload.cta_url.strip()}

    # Media: a direct URL, or a Studio image referenced by photo_id (we build a
    # public URL Google can fetch from).
    media_url = payload.media_url.strip()
    if not media_url and payload.photo_id.strip():
        media_url = f"{_public_base(request)}/api/public/gmb-media/{payload.photo_id.strip()}"
    if media_url:
        body["media"] = [{"mediaFormat": "PHOTO", "sourceUrl": media_url}]

    path = f"{MB_V4}/v4/accounts/{doc['account_id']}/locations/{doc['location_id']}/localPosts"
    async with httpx.AsyncClient() as cli:
        resp = await cli.post(path, headers={"Authorization": f"Bearer {token}"}, json=body, timeout=30.0)
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail=f"Google rechazó el post: {resp.text[:300]}")
    return resp.json()


class AiReplyIn(BaseModel):
    comment: str = ""
    star_rating: int = 5
    reviewer_name: str = ""
    business_type: str = ""


@router.post("/reviews/ai-draft")
async def ai_review_reply(payload: AiReplyIn, user_id: str = Depends(get_current_user_id)):
    """Generate a professional English reply draft for a Google review."""
    from ai_service import generate_review_reply
    try:
        text = await generate_review_reply(
            payload.comment, payload.star_rating, payload.reviewer_name, payload.business_type
        )
    except Exception:
        raise HTTPException(status_code=502, detail="No se pudo generar la respuesta con AI.")
    return {"reply": text}


@router.get("/reviews")
async def reviews(user_id: str = Depends(get_current_user_id)):
    doc = await _require_location(user_id)
    token = await _valid_token(user_id)
    path = f"{MB_V4}/v4/accounts/{doc['account_id']}/locations/{doc['location_id']}/reviews"
    async with httpx.AsyncClient() as cli:
        resp = await cli.get(
            path,
            headers={"Authorization": f"Bearer {token}"},
            params={"pageSize": 50, "orderBy": "updateTime desc"},
            timeout=30.0,
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Google rechazó la consulta: {resp.text[:300]}")
    return resp.json()


class ReplyIn(BaseModel):
    comment: str


@router.put("/reviews/{review_id}/reply")
async def reply_review(review_id: str, payload: ReplyIn, user_id: str = Depends(get_current_user_id)):
    if not payload.comment.strip():
        raise HTTPException(status_code=400, detail="La respuesta no puede estar vacía.")
    doc = await _require_location(user_id)
    token = await _valid_token(user_id)
    path = f"{MB_V4}/v4/accounts/{doc['account_id']}/locations/{doc['location_id']}/reviews/{review_id}/reply"
    async with httpx.AsyncClient() as cli:
        resp = await cli.put(
            path,
            headers={"Authorization": f"Bearer {token}"},
            json={"comment": payload.comment.strip()},
            timeout=30.0,
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Google rechazó la respuesta: {resp.text[:300]}")
    return resp.json()
