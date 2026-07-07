"""Dynamic QR code generator.

Each contractor (with the "card" feature — Presencia / Bundle) can create QR
codes whose destination is stored in UniTech. Dynamic QRs encode a stable
short link `/api/public/q/{slug}` that 302-redirects to the current
destination, so the printed QR keeps working even if the destination changes.
This is what frees users from being locked to a third party like HighLevel.

Static QRs simply encode the destination URL directly (not editable after
printing) — the frontend handles that case client-side.
"""
from __future__ import annotations

import os
import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from starlette.responses import RedirectResponse

from auth_utils import get_current_user_id
import payments_service

_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
_db = _client[os.environ["DB_NAME"]]

router = APIRouter(tags=["qr"])

_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"


def _now():
    return datetime.now(timezone.utc).isoformat()


def _slug(n: int = 7) -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(n))


def _normalize_url(url: str) -> str:
    url = (url or "").strip()
    if not url:
        return url
    if url.startswith(("http://", "https://", "tel:", "mailto:", "sms:", "https://wa.me")):
        return url
    return "https://" + url


async def _require_card_user(user_id: str) -> dict:
    user = await _db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if "card" not in payments_service.user_features(user):
        raise HTTPException(status_code=403, detail="Tu plan no incluye el generador de QR (requiere Presencia o Bundle).")
    return user


class QrIn(BaseModel):
    label: str = "Mi QR"
    mode: str = "dynamic"          # "dynamic" | "static"
    dest: str = ""                 # destination URL
    dest_type: str = "url"         # url | card | reviews | whatsapp
    fg: str = "#0f172a"
    bg: str = "#ffffff"
    logo: bool = False


class QrUpdate(BaseModel):
    label: str | None = None
    dest: str | None = None
    dest_type: str | None = None
    fg: str | None = None
    bg: str | None = None
    logo: bool | None = None


def _public(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


@router.post("/api/qr")
async def create_qr(payload: QrIn, user_id: str = Depends(get_current_user_id)):
    await _require_card_user(user_id)
    mode = "static" if payload.mode == "static" else "dynamic"
    dest = _normalize_url(payload.dest)
    if not dest:
        raise HTTPException(status_code=400, detail="Falta el destino del QR")
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "label": (payload.label or "Mi QR").strip(),
        "mode": mode,
        "dest": dest,
        "dest_type": payload.dest_type or "url",
        "fg": payload.fg or "#0f172a",
        "bg": payload.bg or "#ffffff",
        "logo": bool(payload.logo),
        "scan_count": 0,
        "last_scan_at": None,
        "created_at": _now(),
        "updated_at": _now(),
    }
    if mode == "dynamic":
        slug = _slug()
        while await _db.qr_codes.find_one({"slug": slug}, {"_id": 1}):
            slug = _slug()
        doc["slug"] = slug
    await _db.qr_codes.insert_one(dict(doc))
    return _public(doc)


@router.get("/api/qr")
async def list_qr(user_id: str = Depends(get_current_user_id)):
    await _require_card_user(user_id)
    cur = _db.qr_codes.find({"user_id": user_id}).sort("created_at", -1)
    return [_public(d) async for d in cur]


@router.put("/api/qr/{qr_id}")
async def update_qr(qr_id: str, payload: QrUpdate, user_id: str = Depends(get_current_user_id)):
    await _require_card_user(user_id)
    doc = await _db.qr_codes.find_one({"id": qr_id, "user_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="QR no encontrado")
    upd = {}
    if payload.label is not None:
        upd["label"] = payload.label.strip()
    if payload.dest is not None:
        d = _normalize_url(payload.dest)
        if not d:
            raise HTTPException(status_code=400, detail="Destino inválido")
        upd["dest"] = d
    if payload.dest_type is not None:
        upd["dest_type"] = payload.dest_type
    if payload.fg is not None:
        upd["fg"] = payload.fg
    if payload.bg is not None:
        upd["bg"] = payload.bg
    if payload.logo is not None:
        upd["logo"] = bool(payload.logo)
    upd["updated_at"] = _now()
    await _db.qr_codes.update_one({"id": qr_id}, {"$set": upd})
    doc = await _db.qr_codes.find_one({"id": qr_id})
    return _public(doc)


@router.delete("/api/qr/{qr_id}")
async def delete_qr(qr_id: str, user_id: str = Depends(get_current_user_id)):
    await _require_card_user(user_id)
    res = await _db.qr_codes.delete_one({"id": qr_id, "user_id": user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="QR no encontrado")
    return {"ok": True}


@router.get("/api/public/q/{slug}")
async def resolve_qr(slug: str):
    """Public — increment scan counter and redirect to the current destination."""
    doc = await _db.qr_codes.find_one({"slug": slug})
    if not doc or not doc.get("dest"):
        raise HTTPException(status_code=404, detail="QR no encontrado")
    await _db.qr_codes.update_one(
        {"slug": slug},
        {"$inc": {"scan_count": 1}, "$set": {"last_scan_at": _now()}},
    )
    return RedirectResponse(url=doc["dest"], status_code=302)
