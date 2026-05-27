"""Unitap — FastAPI backend.

Spanish-speaking Latino contractor SaaS.
Interface in Spanish, AI-generated client documents in English.
"""
from __future__ import annotations

import base64
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, File, Header, HTTPException, Query, Response, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import ai_service  # noqa: E402  (must be after load_dotenv so EMERGENT_LLM_KEY is set)
import storage_service  # noqa: E402
from auth_utils import create_token, get_current_user_id, hash_password, verify_password, decode_token  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

mongo_url = os.environ["MONGO_URL"]
db_name = os.environ["DB_NAME"]
app_name = os.environ.get("APP_NAME", "servicioflow")

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

app = FastAPI(title="Unitap")
api_router = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())


# ============================================================================
# MODELS
# ============================================================================
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    business_name: str
    owner_name: Optional[str] = ""
    phone: Optional[str] = ""


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    business_name: str
    owner_name: str
    phone: str
    business_address: Optional[str] = ""
    business_email: Optional[str] = ""


class BusinessUpdate(BaseModel):
    business_name: Optional[str] = None
    owner_name: Optional[str] = None
    phone: Optional[str] = None
    business_address: Optional[str] = None
    business_email: Optional[str] = None


class ClientIn(BaseModel):
    name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    job_type: Optional[str] = ""
    notes: Optional[str] = ""


class LineItem(BaseModel):
    description: str
    quantity: float = 1
    unit: str = "ea"
    unit_price: float = 0
    amount: float = 0


class QuoteIn(BaseModel):
    client_id: str
    job_title: str
    description: Optional[str] = ""
    scope_of_work: List[str] = []
    line_items: List[LineItem] = []
    materials_estimate: float = 0
    labor_estimate: float = 0
    subtotal: float = 0
    tax_rate: float = 0
    tax_amount: float = 0
    total: float = 0
    deposit_amount: float = 0
    payment_terms: Optional[str] = ""
    notes: Optional[str] = ""
    status: str = "draft"  # draft, sent, approved, declined, converted


class InvoiceIn(BaseModel):
    client_id: str
    quote_id: Optional[str] = None
    job_title: str
    line_items: List[LineItem] = []
    subtotal: float = 0
    tax_rate: float = 0
    tax_amount: float = 0
    total: float = 0
    amount_paid: float = 0
    due_date: Optional[str] = None
    notes: Optional[str] = ""
    status: str = "draft"  # draft, sent, paid, partial, overdue


class JobIn(BaseModel):
    client_id: str
    title: str
    quote_id: Optional[str] = None
    invoice_id: Optional[str] = None
    status: str = "new_lead"  # new_lead, estimate_sent, approved, scheduled, in_progress, waiting_payment, completed
    scheduled_date: Optional[str] = None  # YYYY-MM-DD, start date
    end_date: Optional[str] = None        # YYYY-MM-DD, for multi-day projects
    start_time: Optional[str] = ""        # HH:MM 24h
    end_time: Optional[str] = ""          # HH:MM 24h
    all_day: bool = False
    address: Optional[str] = ""           # job site address; falls back to client address
    # Recurrence
    recurrence: Optional[str] = "none"    # none | weekly | biweekly | monthly
    recurrence_days: List[str] = []       # ["mon","tue","wed","thu","fri","sat","sun"]
    recurrence_end_date: Optional[str] = None  # YYYY-MM-DD
    notes: Optional[str] = ""


class MessageIn(BaseModel):
    client_id: Optional[str] = None
    message_type: str  # follow_up_quote, payment_reminder, ...
    user_input_es: Optional[str] = ""


class AIQuoteRequest(BaseModel):
    description_es: str
    client_id: Optional[str] = None


class AIScopeRequest(BaseModel):
    description_es: str


class AIPhotoRequest(BaseModel):
    image_base64: str
    extra_note_es: Optional[str] = ""


class AIAgreementRequest(BaseModel):
    description_es: str
    client_id: Optional[str] = None
    quote_id: Optional[str] = None
    total: Optional[float] = 0
    deposit: Optional[float] = 0


class AgreementIn(BaseModel):
    client_id: str
    quote_id: Optional[str] = None
    title: str
    description_es: Optional[str] = ""
    sections: dict = {}  # AI-generated structured content
    total: float = 0
    deposit: float = 0
    status: str = "draft"  # draft, sent, signed, declined
    # Signature fields (set when client signs publicly)
    signed_at: Optional[str] = None
    signed_method: Optional[str] = None  # "drawn" | "button"
    signature_image: Optional[str] = None  # base64 data URL
    signer_name: Optional[str] = None
    signer_ip: Optional[str] = None


class ReminderIn(BaseModel):
    title: str
    type: str  # quote_follow_up, invoice_payment, job_scheduled, review_request
    client_id: Optional[str] = None
    quote_id: Optional[str] = None
    invoice_id: Optional[str] = None
    job_id: Optional[str] = None
    due_date: str
    notes: Optional[str] = ""


# ============================================================================
# Smart Business Card models
# ============================================================================
class CardService(BaseModel):
    name: str
    description: Optional[str] = ""
    starting_price: Optional[str] = ""  # free-form string e.g., "Starting at $500"
    icon: Optional[str] = ""  # emoji or icon name


class CardSettingsIn(BaseModel):
    slug: Optional[str] = None  # public URL slug; auto-generated if missing
    tagline: Optional[str] = ""  # e.g., "Trusted Roofing Experts"
    business_type: Optional[str] = ""  # e.g., "Roofing"
    service_area: Optional[str] = ""  # e.g., "Houston, TX and surrounding areas"
    years_in_business: Optional[int] = 0
    is_licensed: bool = False
    is_insured: bool = False
    license_number: Optional[str] = ""
    rating: Optional[float] = 0.0
    brand_color: Optional[str] = "#1E3A8A"
    accent_color: Optional[str] = "#10B981"
    hero_overlay: Optional[int] = 60  # 0-100, darkness over hero photo
    services: List[CardService] = []
    hours: Optional[str] = ""  # e.g., "Mon-Fri 8am-6pm"
    whatsapp: Optional[str] = ""  # E.164 phone for WhatsApp link
    website: Optional[str] = ""
    facebook: Optional[str] = ""
    instagram: Optional[str] = ""
    google_review_url: Optional[str] = ""
    enabled: bool = True
    languages: List[str] = ["en", "es"]
    # New: hero photo + about me
    about_me: Optional[str] = ""  # short bio paragraph (English)
    role: Optional[str] = ""  # e.g., "Owner & Lead Contractor"
    theme: Optional[str] = "auto"  # "auto" | "light" | "dark"
    # Layout style for the hero of the public card.
    # "photo" = full-bleed portrait (premium / personal). "logo_circle" = work/cover
    # photo as background + small circular avatar (for people who prefer not to be on full display).
    hero_layout: Optional[str] = "photo"  # "photo" | "logo_circle"
    # Private AI knowledge base (NOT shown to customers, only fed to the chat AI)
    ai_context: Optional[str] = ""


class CardLeadIn(BaseModel):
    name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    service: Optional[str] = ""
    description: str
    preferred_contact: Optional[str] = "phone"  # phone, text, email, whatsapp
    photo_b64: Optional[str] = None  # optional base64 image


class CardChatIn(BaseModel):
    session_id: str  # client-generated UUID kept per visitor session
    message: str
    language: Optional[str] = "en"


class ReviewIn(BaseModel):
    customer_name: str
    rating: int = Field(ge=1, le=5)
    text: str
    job_title: Optional[str] = ""


class AnalyticsEventIn(BaseModel):
    event: str  # profile_visit, call_click, text_click, whatsapp_click, email_click,
                # directions_click, quote_request, contact_save, review_click, qr_scan
    meta: Optional[dict] = None


class SocialPostIn(BaseModel):
    job_title: str
    description_es: Optional[str] = ""
    service_area: Optional[str] = ""


# ============================================================================
# HELPERS
# ============================================================================
def _strip_id(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


async def _user_doc(user_id: str) -> dict:
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    # Attach card-related public-facing fields so frontend has them in one fetch
    card = await db.cards.find_one({"user_id": user_id}, {"_id": 0})
    if card:
        u["logo_photo_id"] = card.get("logo_photo_id")
        u["profile_photo_id"] = card.get("profile_photo_id")
        u["about_me"] = card.get("about_me", "")
        u["role"] = card.get("role", "")
        u["card_slug"] = card.get("slug", "")
    else:
        u["logo_photo_id"] = None
        u["profile_photo_id"] = None
        u["about_me"] = ""
        u["role"] = ""
        u["card_slug"] = None
    return u


# ============================================================================
# AUTH
# ============================================================================
@api_router.post("/auth/register")
async def register(payload: RegisterIn):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email ya registrado")
    user = {
        "id": _new_id(),
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password),
        "business_name": payload.business_name,
        "owner_name": payload.owner_name or "",
        "phone": payload.phone or "",
        "business_address": "",
        "business_email": payload.email.lower(),
        "created_at": _now_iso(),
    }
    await db.users.insert_one(user)
    token = create_token(user["id"])
    return {
        "token": token,
        "user": UserOut(
            id=user["id"],
            email=user["email"],
            business_name=user["business_name"],
            owner_name=user["owner_name"],
            phone=user["phone"],
            business_address=user["business_address"],
            business_email=user["business_email"],
        ).model_dump(),
    }


@api_router.post("/auth/login")
async def login(payload: LoginIn):
    u = await db.users.find_one({"email": payload.email.lower()})
    if not u or not verify_password(payload.password, u["password_hash"]):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    token = create_token(u["id"])
    return {
        "token": token,
        "user": UserOut(
            id=u["id"],
            email=u["email"],
            business_name=u.get("business_name", ""),
            owner_name=u.get("owner_name", ""),
            phone=u.get("phone", ""),
            business_address=u.get("business_address", ""),
            business_email=u.get("business_email", u["email"]),
        ).model_dump(),
    }


@api_router.get("/auth/me")
async def me(user_id: str = Depends(get_current_user_id)):
    return await _user_doc(user_id)


@api_router.put("/auth/me")
async def update_me(payload: BusinessUpdate, user_id: str = Depends(get_current_user_id)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if update:
        await db.users.update_one({"id": user_id}, {"$set": update})
    return await _user_doc(user_id)


# ============================================================================
# DASHBOARD
# ============================================================================
@api_router.get("/dashboard/stats")
async def dashboard_stats(user_id: str = Depends(get_current_user_id)):
    total_clients = await db.clients.count_documents({"user_id": user_id})
    quotes_sent = await db.quotes.count_documents({"user_id": user_id, "status": "sent"})
    invoices_pending = await db.invoices.count_documents(
        {"user_id": user_id, "status": {"$in": ["sent", "partial", "overdue"]}}
    )
    active_jobs = await db.jobs.count_documents(
        {"user_id": user_id, "status": {"$in": ["approved", "scheduled", "in_progress", "waiting_payment"]}}
    )

    # Pending payments sum
    pending_pipeline = [
        {"$match": {"user_id": user_id, "status": {"$in": ["sent", "partial", "overdue"]}}},
        {"$group": {"_id": None, "total": {"$sum": {"$subtract": ["$total", "$amount_paid"]}}}},
    ]
    pending_agg = await db.invoices.aggregate(pending_pipeline).to_list(1)
    pending_amount = pending_agg[0]["total"] if pending_agg else 0

    return {
        "total_clients": total_clients,
        "quotes_sent": quotes_sent,
        "invoices_pending": invoices_pending,
        "active_jobs": active_jobs,
        "pending_amount": round(pending_amount, 2),
    }


# ============================================================================
# CLIENTS CRUD
# ============================================================================
@api_router.get("/clients")
async def list_clients(user_id: str = Depends(get_current_user_id)):
    docs = await db.clients.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs


@api_router.post("/clients")
async def create_client(payload: ClientIn, user_id: str = Depends(get_current_user_id)):
    doc = {
        "id": _new_id(),
        "user_id": user_id,
        **payload.model_dump(),
        "created_at": _now_iso(),
    }
    await db.clients.insert_one(doc)
    return _strip_id(doc)


@api_router.get("/clients/{client_id}")
async def get_client(client_id: str, user_id: str = Depends(get_current_user_id)):
    doc = await db.clients.find_one({"id": client_id, "user_id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Cliente no encontrado")
    return doc


@api_router.put("/clients/{client_id}")
async def update_client(client_id: str, payload: ClientIn, user_id: str = Depends(get_current_user_id)):
    await db.clients.update_one(
        {"id": client_id, "user_id": user_id}, {"$set": payload.model_dump()}
    )
    doc = await db.clients.find_one({"id": client_id, "user_id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Cliente no encontrado")
    return doc


@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str, user_id: str = Depends(get_current_user_id)):
    await db.clients.delete_one({"id": client_id, "user_id": user_id})
    return {"ok": True}


@api_router.get("/clients/{client_id}/history")
async def client_history(client_id: str, user_id: str = Depends(get_current_user_id)):
    quotes = await db.quotes.find({"user_id": user_id, "client_id": client_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    invoices = await db.invoices.find({"user_id": user_id, "client_id": client_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    messages = await db.messages.find({"user_id": user_id, "client_id": client_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    photos = await db.photos.find({"user_id": user_id, "client_id": client_id, "is_deleted": False}, {"_id": 0}).sort("created_at", -1).to_list(500)
    jobs = await db.jobs.find({"user_id": user_id, "client_id": client_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"quotes": quotes, "invoices": invoices, "messages": messages, "photos": photos, "jobs": jobs}


# ============================================================================
# QUOTES CRUD
# ============================================================================
@api_router.get("/quotes")
async def list_quotes(user_id: str = Depends(get_current_user_id), status: Optional[str] = None):
    q = {"user_id": user_id}
    if status:
        q["status"] = status
    docs = await db.quotes.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs


@api_router.post("/quotes")
async def create_quote(payload: QuoteIn, user_id: str = Depends(get_current_user_id)):
    # Determine quote number
    count = await db.quotes.count_documents({"user_id": user_id})
    doc = {
        "id": _new_id(),
        "user_id": user_id,
        "number": f"Q-{1000 + count + 1}",
        **payload.model_dump(),
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await db.quotes.insert_one(doc)
    return _strip_id(doc)


@api_router.get("/quotes/{quote_id}")
async def get_quote(quote_id: str, user_id: str = Depends(get_current_user_id)):
    doc = await db.quotes.find_one({"id": quote_id, "user_id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Quote no encontrado")
    return doc


@api_router.put("/quotes/{quote_id}")
async def update_quote(quote_id: str, payload: QuoteIn, user_id: str = Depends(get_current_user_id)):
    await db.quotes.update_one(
        {"id": quote_id, "user_id": user_id},
        {"$set": {**payload.model_dump(), "updated_at": _now_iso()}},
    )
    doc = await db.quotes.find_one({"id": quote_id, "user_id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Quote no encontrado")
    return doc


@api_router.post("/quotes/{quote_id}/status")
async def set_quote_status(quote_id: str, status: str, user_id: str = Depends(get_current_user_id)):
    valid = {"draft", "sent", "approved", "declined", "converted"}
    if status not in valid:
        raise HTTPException(400, "Status inválido")
    await db.quotes.update_one(
        {"id": quote_id, "user_id": user_id},
        {"$set": {"status": status, "updated_at": _now_iso()}},
    )
    doc = await db.quotes.find_one({"id": quote_id, "user_id": user_id}, {"_id": 0})
    # Auto-create a Service Agreement when quote moves to "approved" (only once per quote)
    if doc and status == "approved":
        existing = await db.agreements.find_one(
            {"user_id": user_id, "quote_id": quote_id}, {"_id": 0, "id": 1}
        )
        if not existing:
            try:
                desc_parts = [doc.get("job_title", "")]
                if doc.get("description"):
                    desc_parts.append(doc["description"])
                if doc.get("scope_of_work"):
                    desc_parts.append("Scope: " + "; ".join(doc["scope_of_work"]))
                description_es = "\n".join([p for p in desc_parts if p])
                await _build_agreement_from_quote_and_desc(
                    user_id=user_id,
                    client_id=doc["client_id"],
                    quote_id=quote_id,
                    description_es=description_es,
                    total=float(doc.get("total") or 0),
                    deposit=float(doc.get("deposit_amount") or 0),
                )
            except Exception as e:
                logger.exception(f"Auto-agreement on quote approval failed: {e}")
                # Don't break status update on AI failure
    return doc


@api_router.delete("/quotes/{quote_id}")
async def delete_quote(quote_id: str, user_id: str = Depends(get_current_user_id)):
    await db.quotes.delete_one({"id": quote_id, "user_id": user_id})
    return {"ok": True}


@api_router.post("/quotes/{quote_id}/convert")
async def convert_to_invoice(quote_id: str, user_id: str = Depends(get_current_user_id)):
    q = await db.quotes.find_one({"id": quote_id, "user_id": user_id}, {"_id": 0})
    if not q:
        raise HTTPException(404, "Quote no encontrado")
    count = await db.invoices.count_documents({"user_id": user_id})
    inv = {
        "id": _new_id(),
        "user_id": user_id,
        "number": f"INV-{2000 + count + 1}",
        "client_id": q["client_id"],
        "quote_id": q["id"],
        "job_title": q.get("job_title", ""),
        "line_items": q.get("line_items", []),
        "subtotal": q.get("subtotal", 0),
        "tax_rate": q.get("tax_rate", 0),
        "tax_amount": q.get("tax_amount", 0),
        "total": q.get("total", 0),
        "amount_paid": 0,
        "due_date": None,
        "notes": q.get("notes", ""),
        "status": "draft",
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await db.invoices.insert_one(inv)
    await db.quotes.update_one(
        {"id": quote_id, "user_id": user_id},
        {"$set": {"status": "converted", "updated_at": _now_iso()}},
    )
    return _strip_id(inv)


# Public share-link quote (no auth)
@api_router.get("/public/quotes/{quote_id}")
async def public_quote(quote_id: str):
    q = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not q:
        raise HTTPException(404, "Not found")
    user = await db.users.find_one({"id": q["user_id"]}, {"_id": 0, "password_hash": 0})
    client_doc = await db.clients.find_one({"id": q["client_id"]}, {"_id": 0})
    return {"quote": q, "business": user, "client": client_doc}


# ============================================================================
# INVOICES CRUD
# ============================================================================
@api_router.get("/invoices")
async def list_invoices(user_id: str = Depends(get_current_user_id), status: Optional[str] = None):
    q = {"user_id": user_id}
    if status:
        q["status"] = status
    docs = await db.invoices.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs


@api_router.post("/invoices")
async def create_invoice(payload: InvoiceIn, user_id: str = Depends(get_current_user_id)):
    count = await db.invoices.count_documents({"user_id": user_id})
    doc = {
        "id": _new_id(),
        "user_id": user_id,
        "number": f"INV-{2000 + count + 1}",
        **payload.model_dump(),
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await db.invoices.insert_one(doc)
    return _strip_id(doc)


@api_router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, user_id: str = Depends(get_current_user_id)):
    doc = await db.invoices.find_one({"id": invoice_id, "user_id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Invoice no encontrado")
    return doc


@api_router.put("/invoices/{invoice_id}")
async def update_invoice(invoice_id: str, payload: InvoiceIn, user_id: str = Depends(get_current_user_id)):
    await db.invoices.update_one(
        {"id": invoice_id, "user_id": user_id},
        {"$set": {**payload.model_dump(), "updated_at": _now_iso()}},
    )
    doc = await db.invoices.find_one({"id": invoice_id, "user_id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Invoice no encontrado")
    return doc


@api_router.post("/invoices/{invoice_id}/status")
async def set_invoice_status(invoice_id: str, status: str, user_id: str = Depends(get_current_user_id)):
    valid = {"draft", "sent", "paid", "partial", "overdue"}
    if status not in valid:
        raise HTTPException(400, "Status inválido")
    update = {"status": status, "updated_at": _now_iso()}
    if status == "paid":
        doc = await db.invoices.find_one({"id": invoice_id, "user_id": user_id}, {"_id": 0})
        if doc:
            update["amount_paid"] = doc.get("total", 0)
    await db.invoices.update_one({"id": invoice_id, "user_id": user_id}, {"$set": update})
    doc = await db.invoices.find_one({"id": invoice_id, "user_id": user_id}, {"_id": 0})
    return doc


@api_router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, user_id: str = Depends(get_current_user_id)):
    await db.invoices.delete_one({"id": invoice_id, "user_id": user_id})
    return {"ok": True}


@api_router.get("/public/invoices/{invoice_id}")
async def public_invoice(invoice_id: str):
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Not found")
    user = await db.users.find_one({"id": inv["user_id"]}, {"_id": 0, "password_hash": 0})
    client_doc = await db.clients.find_one({"id": inv["client_id"]}, {"_id": 0})
    return {"invoice": inv, "business": user, "client": client_doc}


# ============================================================================
# JOBS CRUD
# ============================================================================
@api_router.get("/jobs")
async def list_jobs(user_id: str = Depends(get_current_user_id), status: Optional[str] = None):
    q = {"user_id": user_id}
    if status:
        q["status"] = status
    docs = await db.jobs.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs


@api_router.post("/jobs")
async def create_job(payload: JobIn, user_id: str = Depends(get_current_user_id)):
    doc = {
        "id": _new_id(),
        "user_id": user_id,
        **payload.model_dump(),
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await db.jobs.insert_one(doc)
    return _strip_id(doc)


@api_router.get("/jobs/{job_id}")
async def get_job(job_id: str, user_id: str = Depends(get_current_user_id)):
    doc = await db.jobs.find_one({"id": job_id, "user_id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Trabajo no encontrado")
    return doc


@api_router.put("/jobs/{job_id}")
async def update_job(job_id: str, payload: JobIn, user_id: str = Depends(get_current_user_id)):
    await db.jobs.update_one(
        {"id": job_id, "user_id": user_id},
        {"$set": {**payload.model_dump(), "updated_at": _now_iso()}},
    )
    doc = await db.jobs.find_one({"id": job_id, "user_id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Trabajo no encontrado")
    return doc


@api_router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, user_id: str = Depends(get_current_user_id)):
    await db.jobs.delete_one({"id": job_id, "user_id": user_id})
    return {"ok": True}


# ============================================================================
# CALENDAR — expands jobs (single, multi-day, recurring) into per-day events
# ============================================================================
from datetime import date, timedelta  # noqa: E402

_WEEKDAYS = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}


def _parse_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return date.fromisoformat(s[:10])
    except (ValueError, TypeError):
        return None


def _expand_job_occurrences(job: dict, range_start: date, range_end: date) -> list[dict]:
    """Return per-day occurrences of a job that fall within [range_start, range_end]."""
    start = _parse_date(job.get("scheduled_date"))
    if not start:
        return []
    rec = (job.get("recurrence") or "none").lower()
    rec_end = _parse_date(job.get("recurrence_end_date")) or range_end
    end_date_field = _parse_date(job.get("end_date"))

    occurrences: list[date] = []

    if rec == "none":
        # Multi-day project: one event per day from start..end_date (inclusive). Single day if no end_date.
        last = end_date_field or start
        d = start
        while d <= last:
            if range_start <= d <= range_end:
                occurrences.append(d)
            d += timedelta(days=1)
            if d > range_end:
                break
    elif rec in ("weekly", "biweekly"):
        step = 7 if rec == "weekly" else 14
        days_set = {_WEEKDAYS[x] for x in (job.get("recurrence_days") or []) if x in _WEEKDAYS}
        if not days_set:
            days_set = {start.weekday()}
        # Walk week-by-week from start week
        week_anchor = start - timedelta(days=start.weekday())  # Monday of start week
        d = max(week_anchor, range_start - timedelta(days=6))
        # Snap d back to a valid anchor
        delta_weeks = (d - week_anchor).days // 7
        d = week_anchor + timedelta(days=delta_weeks * 7)
        while d <= min(rec_end, range_end):
            # Only include this week if it matches biweekly cadence
            weeks_since_start = (d - week_anchor).days // 7
            if step == 7 or weeks_since_start % 2 == 0:
                for offset in range(7):
                    occ = d + timedelta(days=offset)
                    if (
                        occ.weekday() in days_set
                        and start <= occ <= rec_end
                        and range_start <= occ <= range_end
                    ):
                        occurrences.append(occ)
            d += timedelta(days=7)
    elif rec == "monthly":
        d = start
        while d <= min(rec_end, range_end):
            if range_start <= d <= range_end:
                occurrences.append(d)
            # next month, same day-of-month (clamp)
            year = d.year + (1 if d.month == 12 else 0)
            month = 1 if d.month == 12 else d.month + 1
            day = min(start.day, _last_day_of_month(year, month))
            d = date(year, month, day)

    return [
        {
            "job_id": job["id"],
            "title": job.get("title", ""),
            "client_id": job.get("client_id"),
            "status": job.get("status", "scheduled"),
            "date": occ.isoformat(),
            "start_time": job.get("start_time") or "",
            "end_time": job.get("end_time") or "",
            "all_day": bool(job.get("all_day") or (not job.get("start_time"))),
            "address": job.get("address") or "",
            "notes": job.get("notes") or "",
            "recurrence": rec,
            "is_project": rec == "none" and end_date_field is not None and end_date_field > start,
        }
        for occ in sorted(occurrences)
    ]


def _last_day_of_month(year: int, month: int) -> int:
    if month == 12:
        return 31
    nxt = date(year, month + 1, 1)
    return (nxt - timedelta(days=1)).day


@api_router.get("/calendar/events")
async def calendar_events(
    start: str = Query(..., description="YYYY-MM-DD inclusive"),
    end: str = Query(..., description="YYYY-MM-DD inclusive"),
    user_id: str = Depends(get_current_user_id),
):
    range_start = _parse_date(start)
    range_end = _parse_date(end)
    if not range_start or not range_end or range_end < range_start:
        raise HTTPException(400, "Rango de fechas inválido")
    if (range_end - range_start).days > 400:
        raise HTTPException(400, "Rango máximo 400 días")

    jobs_cur = db.jobs.find({"user_id": user_id}, {"_id": 0})
    jobs = await jobs_cur.to_list(2000)

    # Enrich with client info (single query)
    client_ids = list({j.get("client_id") for j in jobs if j.get("client_id")})
    clients = {}
    if client_ids:
        async for c in db.clients.find({"user_id": user_id, "id": {"$in": client_ids}}, {"_id": 0}):
            clients[c["id"]] = c

    events: list[dict] = []
    for j in jobs:
        for ev in _expand_job_occurrences(j, range_start, range_end):
            cl = clients.get(ev["client_id"], {})
            ev["client_name"] = cl.get("name", "")
            ev["client_phone"] = cl.get("phone", "")
            ev["client_email"] = cl.get("email", "")
            if not ev["address"]:
                ev["address"] = cl.get("address", "")
            events.append(ev)

    events.sort(key=lambda e: (e["date"], e["start_time"] or "00:00"))
    return {"events": events, "range_start": start, "range_end": end}


# ============================================================================
# MESSAGES (with AI)
# ============================================================================
@api_router.get("/messages")
async def list_messages(user_id: str = Depends(get_current_user_id), client_id: Optional[str] = None):
    q = {"user_id": user_id}
    if client_id:
        q["client_id"] = client_id
    docs = await db.messages.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs


@api_router.post("/messages/generate")
async def generate_message(payload: MessageIn, user_id: str = Depends(get_current_user_id)):
    client_name = None
    if payload.client_id:
        c = await db.clients.find_one({"id": payload.client_id, "user_id": user_id}, {"_id": 0})
        if c:
            client_name = c.get("name")
    try:
        text_en = await ai_service.generate_message(payload.message_type, payload.user_input_es or "", client_name)
    except Exception as e:
        logger.exception("AI message gen failed")
        raise HTTPException(500, f"AI error: {e}")
    return {"message_en": text_en}


class SaveMessageIn(BaseModel):
    client_id: Optional[str] = None
    message_type: str
    user_input_es: Optional[str] = ""
    message_en: str


@api_router.post("/messages")
async def save_message(payload: SaveMessageIn, user_id: str = Depends(get_current_user_id)):
    doc = {
        "id": _new_id(),
        "user_id": user_id,
        **payload.model_dump(),
        "created_at": _now_iso(),
    }
    await db.messages.insert_one(doc)
    return _strip_id(doc)


# ============================================================================
# AI ENDPOINTS
# ============================================================================
@api_router.post("/ai/quote")
async def ai_quote(payload: AIQuoteRequest, user_id: str = Depends(get_current_user_id)):
    try:
        data = await ai_service.generate_quote_from_text(payload.description_es)
    except Exception as e:
        logger.exception("AI quote failed")
        raise HTTPException(500, f"AI error: {e}")
    return data


@api_router.post("/ai/scope")
async def ai_scope(payload: AIScopeRequest, user_id: str = Depends(get_current_user_id)):
    try:
        data = await ai_service.generate_scope_of_work(payload.description_es)
    except Exception as e:
        logger.exception("AI scope failed")
        raise HTTPException(500, f"AI error: {e}")
    return data


@api_router.post("/ai/photo-quote")
async def ai_photo(payload: AIPhotoRequest, user_id: str = Depends(get_current_user_id)):
    # Strip data: prefix if present
    b64 = payload.image_base64
    if "," in b64 and b64.strip().startswith("data:"):
        b64 = b64.split(",", 1)[1]
    try:
        data = await ai_service.analyze_photo_for_quote(b64, payload.extra_note_es or "")
    except Exception as e:
        logger.exception("AI photo failed")
        raise HTTPException(500, f"AI error: {e}")
    return data


# ============================================================================
# PHOTO UPLOAD (Emergent Object Storage)
# ============================================================================
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 8 * 1024 * 1024


@api_router.post("/photos")
async def upload_photo(
    file: UploadFile = File(...),
    client_id: Optional[str] = None,
    job_id: Optional[str] = None,
    label: str = "during",  # before, during, after
    user_id: str = Depends(get_current_user_id),
):
    content_type = (file.content_type or "application/octet-stream").lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, "Tipo de imagen no permitido (JPEG/PNG/WEBP)")
    data = await file.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(400, "Imagen demasiado grande (máx 8MB)")
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "jpg"
    photo_id = _new_id()
    path = f"{app_name}/photos/{user_id}/{photo_id}.{ext}"
    try:
        backend = storage_service.get_storage()
        result = backend.put(path, data, content_type)
    except Exception as e:
        logger.exception("Storage upload failed")
        raise HTTPException(500, f"Storage error: {e}")
    doc = {
        "id": photo_id,
        "user_id": user_id,
        "client_id": client_id,
        "job_id": job_id,
        "label": label,
        "storage_path": result.get("path", path),
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "created_at": _now_iso(),
    }
    await db.photos.insert_one(doc)
    return _strip_id(doc)


@api_router.get("/photos")
async def list_photos(
    user_id: str = Depends(get_current_user_id),
    client_id: Optional[str] = None,
    job_id: Optional[str] = None,
):
    q = {"user_id": user_id, "is_deleted": False}
    if client_id:
        q["client_id"] = client_id
    if job_id:
        q["job_id"] = job_id
    docs = await db.photos.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs


@api_router.get("/photos/{photo_id}/file")
async def get_photo_file(
    photo_id: str,
    authorization: Optional[str] = Header(None),
    auth: Optional[str] = Query(None),
):
    # Support query-param auth for <img src=...&auth=token>
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
    elif auth:
        token = auth
    if not token:
        raise HTTPException(401, "Missing token")
    user_id = decode_token(token)
    if not user_id:
        raise HTTPException(401, "Invalid token")

    doc = await db.photos.find_one({"id": photo_id, "user_id": user_id, "is_deleted": False}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Foto no encontrada")
    try:
        backend = storage_service.get_storage()
        data, ct = backend.get(doc["storage_path"])
    except Exception as e:
        logger.exception("Storage download failed")
        raise HTTPException(500, f"Storage error: {e}")
    return Response(content=data, media_type=doc.get("content_type", ct))


@api_router.delete("/photos/{photo_id}")
async def delete_photo(photo_id: str, user_id: str = Depends(get_current_user_id)):
    await db.photos.update_one(
        {"id": photo_id, "user_id": user_id}, {"$set": {"is_deleted": True}}
    )
    return {"ok": True}


# ============================================================================
# REMINDERS
# ============================================================================
@api_router.get("/reminders")
async def list_reminders(user_id: str = Depends(get_current_user_id)):
    docs = await db.reminders.find({"user_id": user_id, "completed": False}, {"_id": 0}).sort("due_date", 1).to_list(1000)
    return docs


@api_router.post("/reminders")
async def create_reminder(payload: ReminderIn, user_id: str = Depends(get_current_user_id)):
    doc = {
        "id": _new_id(),
        "user_id": user_id,
        **payload.model_dump(),
        "completed": False,
        "created_at": _now_iso(),
    }
    await db.reminders.insert_one(doc)
    return _strip_id(doc)


@api_router.post("/reminders/{reminder_id}/complete")
async def complete_reminder(reminder_id: str, user_id: str = Depends(get_current_user_id)):
    await db.reminders.update_one(
        {"id": reminder_id, "user_id": user_id}, {"$set": {"completed": True}}
    )
    return {"ok": True}


@api_router.delete("/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str, user_id: str = Depends(get_current_user_id)):
    await db.reminders.delete_one({"id": reminder_id, "user_id": user_id})
    return {"ok": True}


# ============================================================================
# SMART BUSINESS CARD
# ============================================================================
def _slugify(text: str) -> str:
    import re as _re
    s = (text or "").lower().strip()
    s = _re.sub(r"[^a-z0-9]+", "-", s)
    s = _re.sub(r"-+", "-", s).strip("-")
    return s or "card"


async def _ensure_card(user_id: str) -> dict:
    """Return the user's card settings, creating defaults if absent."""
    card = await db.cards.find_one({"user_id": user_id}, {"_id": 0})
    if card:
        return card
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    base_slug = _slugify(user.get("business_name", "") or user.get("email", "").split("@")[0])
    slug = base_slug
    n = 1
    while await db.cards.find_one({"slug": slug}, {"_id": 0}):
        n += 1
        slug = f"{base_slug}-{n}"
    doc = {
        "id": _new_id(),
        "user_id": user_id,
        "slug": slug,
        "tagline": "",
        "business_type": "",
        "service_area": "",
        "years_in_business": 0,
        "is_licensed": False,
        "is_insured": False,
        "license_number": "",
        "rating": 0.0,
        "brand_color": "#1E3A8A",
        "accent_color": "#10B981",
        "hero_overlay": 60,
        "hero_layout": "photo",
        "cover_photo_id": None,
        "services": [],
        "hours": "",
        "whatsapp": user.get("phone", ""),
        "website": "",
        "facebook": "",
        "instagram": "",
        "google_review_url": "",
        "enabled": True,
        "languages": ["en", "es"],
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await db.cards.insert_one(doc)
    return _strip_id(doc)


@api_router.get("/card/settings")
async def get_card_settings(user_id: str = Depends(get_current_user_id)):
    return await _ensure_card(user_id)


@api_router.put("/card/settings")
async def update_card_settings(payload: CardSettingsIn, user_id: str = Depends(get_current_user_id)):
    card = await _ensure_card(user_id)
    # exclude_unset = only fields explicitly sent by the client (true PATCH/merge).
    # This prevents Pydantic defaults ("", [], False, 0) from wiping out saved data
    # when the frontend omits a field from the payload.
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    # If slug is provided, ensure unique
    if "slug" in update and update["slug"] and update["slug"] != card["slug"]:
        new_slug = _slugify(update["slug"])
        existing = await db.cards.find_one({"slug": new_slug, "user_id": {"$ne": user_id}}, {"_id": 0})
        if existing:
            raise HTTPException(400, "Ese link ya está tomado, prueba otro")
        update["slug"] = new_slug
    update["updated_at"] = _now_iso()
    await db.cards.update_one({"user_id": user_id}, {"$set": update})
    return await _ensure_card(user_id)


@api_router.post("/card/logo")
async def upload_card_logo(file: UploadFile = File(...), user_id: str = Depends(get_current_user_id)):
    return await _upload_card_asset(file, user_id, kind="logo")


@api_router.delete("/card/logo")
async def delete_card_logo(user_id: str = Depends(get_current_user_id)):
    return await _delete_card_asset(user_id, kind="logo")


@api_router.post("/card/profile-photo")
async def upload_card_profile_photo(file: UploadFile = File(...), user_id: str = Depends(get_current_user_id)):
    return await _upload_card_asset(file, user_id, kind="profile_photo")


@api_router.delete("/card/profile-photo")
async def delete_card_profile_photo(user_id: str = Depends(get_current_user_id)):
    return await _delete_card_asset(user_id, kind="profile_photo")


@api_router.post("/card/cover-photo")
async def upload_card_cover_photo(file: UploadFile = File(...), user_id: str = Depends(get_current_user_id)):
    return await _upload_card_asset(file, user_id, kind="cover")


@api_router.delete("/card/cover-photo")
async def delete_card_cover_photo(user_id: str = Depends(get_current_user_id)):
    return await _delete_card_asset(user_id, kind="cover")


async def _upload_card_asset(file: UploadFile, user_id: str, kind: str):
    """Shared helper for logo, profile photo and cover photo uploads."""
    label_map = {"logo": "logo", "profile_photo": "profile_photo", "cover": "cover"}
    field_map = {"logo": "logo_photo_id", "profile_photo": "profile_photo_id", "cover": "cover_photo_id"}
    label = label_map[kind]
    field = field_map[kind]

    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, "Tipo de imagen no permitido (JPEG/PNG/WEBP)")
    data = await file.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(400, "Imagen demasiado grande (máx 8MB)")
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "png"
    asset_id = _new_id()
    path = f"{app_name}/cards/{kind}/{user_id}/{asset_id}.{ext}"
    try:
        backend = storage_service.get_storage()
        result = backend.put(path, data, content_type)
    except Exception as e:
        raise HTTPException(500, f"Storage error: {e}")
    photo_doc = {
        "id": asset_id,
        "user_id": user_id,
        "client_id": None,
        "job_id": None,
        "label": label,
        "storage_path": result.get("path", path),
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "is_logo": (kind == "logo"),
        "is_profile": (kind == "profile_photo"),
        "is_cover": (kind == "cover"),
        "created_at": _now_iso(),
    }
    await db.photos.insert_one(photo_doc)
    await _ensure_card(user_id)
    await db.cards.update_one(
        {"user_id": user_id},
        {"$set": {field: asset_id, "updated_at": _now_iso()}},
    )
    return {"ok": True, field: asset_id}


async def _delete_card_asset(user_id: str, kind: str):
    field_map = {"logo": "logo_photo_id", "profile_photo": "profile_photo_id", "cover": "cover_photo_id"}
    field = field_map[kind]
    card = await _ensure_card(user_id)
    pid = card.get(field)
    if pid:
        await db.photos.update_one({"id": pid, "user_id": user_id}, {"$set": {"is_deleted": True}})
    await db.cards.update_one({"user_id": user_id}, {"$set": {field: None}})
    return {"ok": True}


@api_router.get("/card/analytics")
async def card_analytics(user_id: str = Depends(get_current_user_id)):
    card = await _ensure_card(user_id)
    pipeline = [
        {"$match": {"card_id": card["id"]}},
        {"$group": {"_id": "$event", "count": {"$sum": 1}}},
    ]
    rows = await db.card_events.aggregate(pipeline).to_list(50)
    counts = {r["_id"]: r["count"] for r in rows}
    # Last 30d total visits
    total = sum(counts.values())
    return {
        "totals": counts,
        "all_events": total,
        "leads": await db.card_leads.count_documents({"card_id": card["id"]}),
        "reviews": await db.reviews.count_documents({"user_id": user_id}),
    }


# Reviews (admin)
@api_router.get("/card/reviews")
async def list_reviews_admin(user_id: str = Depends(get_current_user_id)):
    docs = await db.reviews.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api_router.post("/card/reviews")
async def create_review(payload: ReviewIn, user_id: str = Depends(get_current_user_id)):
    doc = {
        "id": _new_id(),
        "user_id": user_id,
        **payload.model_dump(),
        "created_at": _now_iso(),
    }
    await db.reviews.insert_one(doc)
    # Recompute card rating average
    pipeline = [{"$match": {"user_id": user_id}}, {"$group": {"_id": None, "avg": {"$avg": "$rating"}}}]
    res = await db.reviews.aggregate(pipeline).to_list(1)
    avg = round(res[0]["avg"], 1) if res else 0.0
    await db.cards.update_one({"user_id": user_id}, {"$set": {"rating": avg, "updated_at": _now_iso()}})
    return _strip_id(doc)


@api_router.delete("/card/reviews/{review_id}")
async def delete_review(review_id: str, user_id: str = Depends(get_current_user_id)):
    await db.reviews.delete_one({"id": review_id, "user_id": user_id})
    pipeline = [{"$match": {"user_id": user_id}}, {"$group": {"_id": None, "avg": {"$avg": "$rating"}}}]
    res = await db.reviews.aggregate(pipeline).to_list(1)
    avg = round(res[0]["avg"], 1) if res else 0.0
    await db.cards.update_one({"user_id": user_id}, {"$set": {"rating": avg}})
    return {"ok": True}


# AI Social Posts
@api_router.post("/card/social-posts")
async def ai_social_posts(payload: SocialPostIn, user_id: str = Depends(get_current_user_id)):
    try:
        data = await ai_service.generate_social_posts(
            payload.job_title, payload.description_es or "", payload.service_area or ""
        )
    except Exception as e:
        raise HTTPException(500, f"AI error: {e}")
    return data


# Leads list (admin)
@api_router.get("/card/leads")
async def list_card_leads(user_id: str = Depends(get_current_user_id)):
    card = await _ensure_card(user_id)
    docs = await db.card_leads.find({"card_id": card["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


# ============================================================================
# PUBLIC SMART CARD ENDPOINTS (no auth)
# ============================================================================
async def _public_card_by_slug(slug: str) -> tuple[dict, dict]:
    card = await db.cards.find_one({"slug": slug, "enabled": True}, {"_id": 0})
    if not card:
        raise HTTPException(404, "Card not found")
    user = await db.users.find_one({"id": card["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(404, "Card not found")
    return card, user


@api_router.get("/public/card/{slug}")
async def public_get_card(slug: str):
    card, user = await _public_card_by_slug(slug)
    # Gather public-safe data
    reviews = await db.reviews.find({"user_id": card["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)
    # Photos from completed jobs OR all photos (exclude logo)
    photos = await db.photos.find(
        {
            "user_id": card["user_id"],
            "is_deleted": False,
            "is_logo": {"$ne": True},
            "is_profile": {"$ne": True},
            "is_cover": {"$ne": True},
            "label": {"$nin": ["logo", "profile_photo", "cover"]},
        },
        {"_id": 0},
    ).sort("created_at", -1).to_list(30)
    return {
        "business": {
            "name": user.get("business_name", ""),
            "owner_name": user.get("owner_name", ""),
            "phone": user.get("phone", ""),
            "email": user.get("business_email") or user.get("email"),
            "address": user.get("business_address", ""),
        },
        "card": card,
        "reviews": reviews,
        "photos": [{"id": p["id"], "label": p.get("label", ""), "created_at": p.get("created_at")} for p in photos],
    }


@api_router.get("/public/card/photo/{photo_id}")
async def public_photo(photo_id: str):
    """Public endpoint to serve photos referenced on a Smart Card."""
    doc = await db.photos.find_one({"id": photo_id, "is_deleted": False}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    # Confirm the owner has an active card so we don't leak private photos
    card = await db.cards.find_one({"user_id": doc["user_id"], "enabled": True}, {"_id": 0})
    if not card:
        raise HTTPException(404, "Not found")
    try:
        backend = storage_service.get_storage()
        data, ct = backend.get(doc["storage_path"])
    except Exception:
        raise HTTPException(500, "Storage error")
    return Response(content=data, media_type=doc.get("content_type", ct))


@api_router.get("/public/card/{slug}/vcard")
async def public_vcard(slug: str):
    card, user = await _public_card_by_slug(slug)
    bn = user.get("business_name", "")
    on = user.get("owner_name", "")
    phone = user.get("phone", "")
    email = user.get("business_email") or user.get("email", "")
    addr = user.get("business_address", "")
    web = card.get("website", "")
    lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        f"FN:{on or bn}",
        f"ORG:{bn}",
    ]
    if phone:
        lines.append(f"TEL;TYPE=CELL:{phone}")
    if email:
        lines.append(f"EMAIL:{email}")
    if addr:
        lines.append(f"ADR;TYPE=WORK:;;{addr};;;;")
    if web:
        lines.append(f"URL:{web}")
    note = card.get("tagline", "")
    if note:
        lines.append(f"NOTE:{note}")
    lines.append("END:VCARD")
    vcf = "\r\n".join(lines) + "\r\n"
    filename = _slugify(bn or on or "contact") + ".vcf"
    return Response(
        content=vcf,
        media_type="text/vcard",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.post("/public/card/{slug}/lead")
async def public_card_lead(slug: str, payload: CardLeadIn):
    card, user = await _public_card_by_slug(slug)
    # Optional photo upload to storage
    photo_path = None
    if payload.photo_b64:
        try:
            b64 = payload.photo_b64
            if "," in b64 and b64.strip().startswith("data:"):
                b64 = b64.split(",", 1)[1]
            data = base64.b64decode(b64)
            if len(data) <= MAX_IMAGE_BYTES:
                pid = _new_id()
                path = f"{app_name}/leads/{card['user_id']}/{pid}.jpg"
                backend = storage_service.get_storage()
                res = backend.put(path, data, "image/jpeg")
                photo_path = res.get("path", path)
        except Exception:
            logger.exception("Lead photo upload failed (non-fatal)")
    lead = {
        "id": _new_id(),
        "card_id": card["id"],
        "user_id": card["user_id"],
        **payload.model_dump(exclude={"photo_b64"}),
        "photo_path": photo_path,
        "status": "new",
        "created_at": _now_iso(),
    }
    await db.card_leads.insert_one(lead)
    # Also create a Client + Job (new_lead) automatically
    client_doc = {
        "id": _new_id(),
        "user_id": card["user_id"],
        "name": payload.name,
        "phone": payload.phone or "",
        "email": payload.email or "",
        "address": payload.address or "",
        "job_type": payload.service or "",
        "notes": f"[From Smart Card]\n{payload.description}\nPreferred contact: {payload.preferred_contact}",
        "created_at": _now_iso(),
    }
    await db.clients.insert_one(client_doc)
    job_doc = {
        "id": _new_id(),
        "user_id": card["user_id"],
        "client_id": client_doc["id"],
        "title": payload.service or "New Lead from Card",
        "quote_id": None,
        "invoice_id": None,
        "status": "new_lead",
        "scheduled_date": None,
        "notes": payload.description,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await db.jobs.insert_one(job_doc)
    # Track analytics
    await db.card_events.insert_one({
        "id": _new_id(),
        "card_id": card["id"],
        "user_id": card["user_id"],
        "event": "quote_request",
        "meta": {"service": payload.service or ""},
        "created_at": _now_iso(),
    })
    return {"ok": True, "lead_id": lead["id"]}


@api_router.post("/public/card/{slug}/chat")
async def public_card_chat(slug: str, payload: CardChatIn):
    import re as _re
    import json as _json
    card, user = await _public_card_by_slug(slug)
    # Load conversation history
    history_docs = await db.card_chat_turns.find(
        {"card_id": card["id"], "session_id": payload.session_id},
        {"_id": 0},
    ).sort("created_at", 1).to_list(50)
    history = [{"role": d["role"], "content": d["content"]} for d in history_docs]
    services_str = ", ".join([s.get("name", "") for s in card.get("services", []) if s.get("name")]) or card.get("business_type", "")
    try:
        reply = await ai_service.card_assistant_chat(
            history=history,
            user_message=payload.message,
            business_name=user.get("business_name", ""),
            business_type=card.get("business_type", ""),
            services=services_str,
            service_area=card.get("service_area", ""),
            phone=user.get("phone", ""),
            email=user.get("business_email") or user.get("email", ""),
            language_code=(payload.language or "en"),
            about_me=card.get("about_me", ""),
            ai_context=card.get("ai_context", ""),
            hours=card.get("hours", ""),
        )
    except Exception as e:
        logger.exception("Card chat failed")
        raise HTTPException(500, f"AI error: {e}")

    # Persist turn
    now = _now_iso()
    await db.card_chat_turns.insert_one({
        "id": _new_id(),
        "card_id": card["id"],
        "user_id": card["user_id"],
        "session_id": payload.session_id,
        "role": "user",
        "content": payload.message,
        "created_at": now,
    })
    await db.card_chat_turns.insert_one({
        "id": _new_id(),
        "card_id": card["id"],
        "user_id": card["user_id"],
        "session_id": payload.session_id,
        "role": "assistant",
        "content": reply,
        "created_at": now,
    })

    # Detect LEAD_READY signal and auto-create lead
    visible_reply = reply
    lead_payload = None
    m = _re.search(r"LEAD_READY:\s*(\{.*\})", reply)
    if m:
        try:
            lead_payload = _json.loads(m.group(1))
            visible_reply = reply[:m.start()].strip() or "Thanks! We'll be in touch shortly."
        except Exception:
            lead_payload = None

    lead_id = None
    if lead_payload and lead_payload.get("name"):
        # ANTI-DUPLICATE: don't create another lead/client/job if this session already has one.
        # Instead, update the existing lead with any new info the AI provided.
        existing_lead = await db.card_leads.find_one({
            "card_id": card["id"],
            "session_id": payload.session_id,
        })
        if existing_lead:
            # Merge any non-empty fields from the latest LEAD_READY
            updates = {}
            for k in ("name", "phone", "email", "address", "service", "description"):
                v = (lead_payload.get(k) or "").strip()
                if v and v != (existing_lead.get(k) or ""):
                    updates[k] = v
            if updates:
                await db.card_leads.update_one({"id": existing_lead["id"]}, {"$set": updates})
                # Also update the client + job notes
                if existing_lead.get("client_id"):
                    client_updates = {k: v for k, v in updates.items() if k in ("name", "phone", "email", "address")}
                    if updates.get("service"):
                        client_updates["job_type"] = updates["service"]
                    if client_updates:
                        await db.clients.update_one({"id": existing_lead["client_id"]}, {"$set": client_updates})
            lead_id = existing_lead["id"]
        else:
            lead = {
                "id": _new_id(),
                "card_id": card["id"],
                "user_id": card["user_id"],
                "session_id": payload.session_id,
                "name": lead_payload.get("name", ""),
                "phone": lead_payload.get("phone", ""),
                "email": lead_payload.get("email", ""),
                "address": lead_payload.get("address", ""),
                "service": lead_payload.get("service", ""),
                "description": lead_payload.get("description", ""),
                "preferred_contact": "phone",
                "photo_path": None,
                "status": "new",
                "source": "ai_chat",
                "created_at": now,
            }
            # Create client + job too
            client_doc = {
                "id": _new_id(),
                "user_id": card["user_id"],
                "name": lead["name"],
                "phone": lead["phone"],
                "email": lead["email"],
                "address": lead["address"],
                "job_type": lead["service"],
                "notes": f"[AI Chat Lead]\n{lead['description']}",
                "created_at": now,
            }
            await db.clients.insert_one(client_doc)
            lead["client_id"] = client_doc["id"]
            await db.card_leads.insert_one(lead)
            job_doc = {
                "id": _new_id(),
                "user_id": card["user_id"],
                "client_id": client_doc["id"],
                "title": lead["service"] or "New Lead (AI Chat)",
                "quote_id": None,
                "invoice_id": None,
                "status": "new_lead",
                "scheduled_date": None,
                "notes": lead["description"],
                "created_at": now,
                "updated_at": now,
            }
            await db.jobs.insert_one(job_doc)
            await db.card_events.insert_one({
                "id": _new_id(),
                "card_id": card["id"],
                "user_id": card["user_id"],
                "event": "quote_request",
                "meta": {"via": "ai_chat"},
                "created_at": now,
            })
            lead_id = lead["id"]

    return {"reply": visible_reply, "lead_created": bool(lead_id)}


@api_router.post("/public/card/{slug}/track")
async def public_card_track(slug: str, payload: AnalyticsEventIn):
    card, _ = await _public_card_by_slug(slug)
    valid = {
        "profile_visit", "call_click", "text_click", "whatsapp_click",
        "email_click", "directions_click", "quote_request", "contact_save",
        "review_click", "qr_scan", "service_click", "social_click", "language_switch",
    }
    if payload.event not in valid:
        raise HTTPException(400, "Invalid event")
    await db.card_events.insert_one({
        "id": _new_id(),
        "card_id": card["id"],
        "user_id": card["user_id"],
        "event": payload.event,
        "meta": payload.meta or {},
        "created_at": _now_iso(),
    })
    return {"ok": True}


# ============================================================================
# UNITAP PLATFORM CHAT + ADMIN LEADS (super-admin only follow-up)
# ============================================================================
class PlatformChatIn(BaseModel):
    session_id: str
    message: str
    language: Optional[str] = "es"


class PlatformLeadUpdate(BaseModel):
    status: Optional[str] = None  # new | contacted | converted | dismissed
    notes: Optional[str] = None


def _is_super_admin(user_doc: dict) -> bool:
    sa_email = (os.environ.get("SUPER_ADMIN_EMAIL", "") or "").strip().lower()
    return bool(sa_email) and user_doc.get("email", "").lower() == sa_email


async def _require_super_admin(user_id: str = Depends(get_current_user_id)) -> dict:
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(status_code=403, detail="Forbidden")
    # Direct match
    if _is_super_admin(u):
        return u
    # Fallback: if THIS user's email matches the super-admin email (even with case/
    # whitespace differences), trust it. Covers cases where there are duplicate
    # user docs with the same email in the DB.
    sa_email = (os.environ.get("SUPER_ADMIN_EMAIL", "") or "").strip().lower()
    user_email = (u.get("email") or "").strip().lower()
    if sa_email and user_email == sa_email:
        return u
    raise HTTPException(status_code=403, detail="Forbidden")


@api_router.post("/public/unitap/chat")
async def unitap_platform_chat(payload: PlatformChatIn):
    import re as _re
    import json as _json
    history_docs = await db.platform_chat_turns.find(
        {"session_id": payload.session_id},
        {"_id": 0},
    ).sort("created_at", 1).to_list(50)
    history = [{"role": d["role"], "content": d["content"]} for d in history_docs]
    try:
        reply = await ai_service.unitap_assistant_chat(
            history=history,
            user_message=payload.message,
            language_code=(payload.language or "es"),
        )
    except Exception as e:
        logger.exception("Unitap chat failed")
        raise HTTPException(500, f"AI error: {e}")

    now = _now_iso()
    await db.platform_chat_turns.insert_one({
        "id": _new_id(),
        "session_id": payload.session_id,
        "role": "user",
        "content": payload.message,
        "created_at": now,
    })
    await db.platform_chat_turns.insert_one({
        "id": _new_id(),
        "session_id": payload.session_id,
        "role": "assistant",
        "content": reply,
        "created_at": now,
    })

    # Detect LEAD_READY and persist platform_lead
    m = _re.search(r"LEAD_READY:\s*(\{.*?\})", reply, _re.DOTALL)
    if m:
        try:
            data = _json.loads(m.group(1))
        except Exception:
            data = {}
        if data.get("name") and (data.get("phone") or data.get("email")):
            # Avoid duplicates per session
            existing = await db.platform_leads.find_one({"session_id": payload.session_id})
            if not existing:
                await db.platform_leads.insert_one({
                    "id": _new_id(),
                    "session_id": payload.session_id,
                    "name": (data.get("name") or "").strip(),
                    "phone": (data.get("phone") or "").strip(),
                    "email": (data.get("email") or "").strip().lower(),
                    "trade": (data.get("trade") or "").strip(),
                    "interest": (data.get("interest") or "").strip(),
                    "language": (data.get("language") or payload.language or "es"),
                    "status": "new",
                    "notes": "",
                    "created_at": now,
                    "contacted_at": None,
                })
    # Strip LEAD_READY line from the reply shown to user
    clean_reply = _re.sub(r"\n?LEAD_READY:\s*\{.*?\}\s*$", "", reply, flags=_re.DOTALL).strip()
    return {"reply": clean_reply}


@api_router.get("/admin/platform-leads")
async def admin_list_platform_leads(_admin: dict = Depends(_require_super_admin)):
    docs = await db.platform_leads.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"leads": docs, "total": len(docs)}


@api_router.put("/admin/platform-leads/{lead_id}")
async def admin_update_platform_lead(
    lead_id: str,
    payload: PlatformLeadUpdate,
    _admin: dict = Depends(_require_super_admin),
):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "status" in update and update["status"] == "contacted":
        update["contacted_at"] = _now_iso()
    if not update:
        return {"ok": True}
    res = await db.platform_leads.update_one({"id": lead_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Lead not found")
    doc = await db.platform_leads.find_one({"id": lead_id}, {"_id": 0})
    return {"ok": True, "lead": doc}


@api_router.delete("/admin/platform-leads/{lead_id}")
async def admin_delete_platform_lead(
    lead_id: str,
    _admin: dict = Depends(_require_super_admin),
):
    res = await db.platform_leads.delete_one({"id": lead_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Lead not found")
    return {"ok": True}


@api_router.get("/auth/is-super-admin")
async def is_super_admin_check(user_id: str = Depends(get_current_user_id)):
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return {"is_super_admin": bool(u) and _is_super_admin(u)}



# ============================================================================
# SERVICE AGREEMENTS — AI-generated contracts with digital signature
# ============================================================================
async def _build_agreement_from_quote_and_desc(
    user_id: str,
    client_id: str,
    quote_id: Optional[str],
    description_es: str,
    total: float = 0,
    deposit: float = 0,
) -> dict:
    """Generates AI agreement content + creates the DB doc. Returns the doc (no _id)."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0}) or {}
    client_doc = await db.clients.find_one({"id": client_id, "user_id": user_id}, {"_id": 0}) or {}
    business_name = user.get("business_name") or user.get("owner_name") or ""
    client_name = client_doc.get("name") or ""
    sections = await ai_service.generate_service_agreement(
        description_es=description_es or "",
        business_name=business_name,
        client_name=client_name,
        total=total,
        deposit=deposit,
    )
    count = await db.agreements.count_documents({"user_id": user_id})
    doc = {
        "id": _new_id(),
        "user_id": user_id,
        "number": f"SA-{3000 + count + 1}",
        "client_id": client_id,
        "quote_id": quote_id,
        "title": sections.get("title") or "Service Agreement",
        "description_es": description_es or "",
        "sections": sections,
        "total": float(total or 0),
        "deposit": float(deposit or 0),
        "status": "draft",
        "signed_at": None,
        "signed_method": None,
        "signature_image": None,
        "signer_name": None,
        "signer_ip": None,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await db.agreements.insert_one(doc)
    return _strip_id(doc)


@api_router.post("/ai/agreement")
async def ai_generate_agreement(payload: AIAgreementRequest, user_id: str = Depends(get_current_user_id)):
    """Generate agreement content only (no DB write). Used by the create form for live preview."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0}) or {}
    business_name = user.get("business_name") or user.get("owner_name") or ""
    client_name = ""
    if payload.client_id:
        c = await db.clients.find_one({"id": payload.client_id, "user_id": user_id}, {"_id": 0}) or {}
        client_name = c.get("name") or ""
    try:
        sections = await ai_service.generate_service_agreement(
            description_es=payload.description_es,
            business_name=business_name,
            client_name=client_name,
            total=payload.total or 0,
            deposit=payload.deposit or 0,
        )
    except Exception as e:
        logger.exception("AI agreement failed")
        raise HTTPException(500, f"AI error: {e}")
    return sections


@api_router.get("/agreements")
async def list_agreements(user_id: str = Depends(get_current_user_id), status: Optional[str] = None):
    q = {"user_id": user_id}
    if status:
        q["status"] = status
    docs = await db.agreements.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs


@api_router.post("/agreements")
async def create_agreement(payload: AgreementIn, user_id: str = Depends(get_current_user_id)):
    count = await db.agreements.count_documents({"user_id": user_id})
    doc = {
        "id": _new_id(),
        "user_id": user_id,
        "number": f"SA-{3000 + count + 1}",
        **payload.model_dump(),
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await db.agreements.insert_one(doc)
    return _strip_id(doc)


@api_router.get("/agreements/{agreement_id}")
async def get_agreement(agreement_id: str, user_id: str = Depends(get_current_user_id)):
    doc = await db.agreements.find_one({"id": agreement_id, "user_id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Contrato no encontrado")
    return doc


@api_router.put("/agreements/{agreement_id}")
async def update_agreement(agreement_id: str, payload: AgreementIn, user_id: str = Depends(get_current_user_id)):
    await db.agreements.update_one(
        {"id": agreement_id, "user_id": user_id},
        {"$set": {**payload.model_dump(), "updated_at": _now_iso()}},
    )
    doc = await db.agreements.find_one({"id": agreement_id, "user_id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Contrato no encontrado")
    return doc


@api_router.delete("/agreements/{agreement_id}")
async def delete_agreement(agreement_id: str, user_id: str = Depends(get_current_user_id)):
    await db.agreements.delete_one({"id": agreement_id, "user_id": user_id})
    return {"ok": True}


# Public (no auth) — client receives a link and signs
@api_router.get("/public/agreements/{agreement_id}")
async def public_get_agreement(agreement_id: str):
    a = await db.agreements.find_one({"id": agreement_id}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Not found")
    user = await db.users.find_one({"id": a["user_id"]}, {"_id": 0, "password_hash": 0}) or {}
    client_doc = await db.clients.find_one({"id": a["client_id"]}, {"_id": 0}) or {}
    business = {
        "business_name": user.get("business_name", ""),
        "business_email": user.get("business_email", "") or user.get("email", ""),
        "phone": user.get("phone", ""),
        "business_address": user.get("business_address", ""),
    }
    client = {
        "name": client_doc.get("name", ""),
        "email": client_doc.get("email", ""),
        "phone": client_doc.get("phone", ""),
        "address": client_doc.get("address", ""),
    }
    return {"agreement": a, "business": business, "client": client}


class PublicSignRequest(BaseModel):
    method: str = "button"  # "button" | "drawn"
    signature_image: Optional[str] = None  # required when method == "drawn" (data URL)
    signer_name: Optional[str] = None


@api_router.post("/public/agreements/{agreement_id}/sign")
async def public_sign_agreement(agreement_id: str, payload: PublicSignRequest):
    a = await db.agreements.find_one({"id": agreement_id}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Not found")
    if a.get("status") == "signed":
        raise HTTPException(400, "Este contrato ya fue firmado.")
    if payload.method not in {"button", "drawn"}:
        raise HTTPException(400, "Método de firma inválido")
    signer_name = (payload.signer_name or "").strip()
    if not signer_name:
        raise HTTPException(400, "Nombre del firmante requerido")
    if payload.method == "drawn" and not (payload.signature_image and payload.signature_image.startswith("data:image/")):
        raise HTTPException(400, "Firma requerida")
    await db.agreements.update_one(
        {"id": agreement_id},
        {"$set": {
            "status": "signed",
            "signed_at": _now_iso(),
            "signed_method": payload.method,
            "signature_image": payload.signature_image if payload.method == "drawn" else None,
            "signer_name": signer_name,
            "updated_at": _now_iso(),
        }},
    )
    updated = await db.agreements.find_one({"id": agreement_id}, {"_id": 0})
    return {"ok": True, "agreement": updated}



# ============================================================================
# ONBOARDING — guides new users through setup
# ============================================================================
class OnboardingStateUpdate(BaseModel):
    welcome_seen: Optional[bool] = None
    dismissed: Optional[bool] = None
    celebrated: Optional[bool] = None


@api_router.get("/onboarding/status")
async def onboarding_status(user_id: str = Depends(get_current_user_id)):
    """Returns checklist progress (auto-computed from real data) + persisted UI state."""
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(404, "User not found")

    onb = u.get("onboarding_state") or {}
    welcome_seen = bool(onb.get("welcome_seen"))
    dismissed = bool(onb.get("dismissed"))
    celebrated = bool(onb.get("celebrated"))

    # Compute checklist items from real data
    business_filled = bool(
        (u.get("phone") or "").strip() and (u.get("business_address") or "").strip()
    )
    card = await db.card_settings.find_one({"user_id": user_id}, {"_id": 0}) or {}
    logo_uploaded = bool(card.get("logo_photo_id"))
    card_created = bool(
        (card.get("services") or []) or card.get("profile_photo_id") or card.get("cover_photo_id")
    )
    clients_count = await db.clients.count_documents({"user_id": user_id})
    quotes_count = await db.quotes.count_documents({"user_id": user_id})

    items = [
        {"id": "business_info", "label": "Llena tu info de negocio", "minutes": 2, "done": business_filled, "path": "/ajustes"},
        {"id": "logo", "label": "Sube tu logo", "minutes": 1, "done": logo_uploaded, "path": "/tarjeta"},
        {"id": "smart_card", "label": "Crea tu Tarjeta Inteligente", "minutes": 3, "done": card_created, "path": "/tarjeta"},
        {"id": "first_client", "label": "Agrega tu primer cliente", "minutes": 1, "done": clients_count > 0, "path": "/clientes"},
        {"id": "first_quote", "label": "Genera tu primer quote con AI", "minutes": 2, "done": quotes_count > 0, "path": "/quotes/nuevo?ai=1"},
    ]
    done_count = sum(1 for i in items if i["done"])
    progress = int(done_count * 100 / len(items)) if items else 0
    completed = done_count == len(items)

    return {
        "welcome_seen": welcome_seen,
        "dismissed": dismissed,
        "celebrated": celebrated,
        "items": items,
        "done_count": done_count,
        "total": len(items),
        "progress": progress,
        "completed": completed,
        "first_name": (u.get("owner_name") or u.get("business_name") or "").split(" ")[0],
        "business_name": u.get("business_name", ""),
    }


@api_router.put("/onboarding/state")
async def onboarding_set_state(
    payload: OnboardingStateUpdate,
    user_id: str = Depends(get_current_user_id),
):
    update = {}
    for k, v in payload.model_dump().items():
        if v is not None:
            update[f"onboarding_state.{k}"] = v
    if update:
        await db.users.update_one({"id": user_id}, {"$set": update})
    return {"ok": True}



# ============================================================================
# HEALTH
# ============================================================================
@api_router.get("/")
async def root():
    return {"app": "Unitap", "ok": True}


# ============================================================================
# APP SETUP
# ============================================================================
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _seed_admin_from_env(email_key: str, pw_key: str, biz_key: str, default_biz: str) -> None:
    """Idempotent admin seed. Creates the user if it doesn't already exist."""
    email = os.environ.get(email_key, "").strip().lower()
    password = os.environ.get(pw_key, "").strip()
    if not email or not password:
        return
    existing = await db.users.find_one({"email": email})
    if existing:
        return
    business_name = os.environ.get(biz_key, default_biz)
    user = {
        "id": _new_id(),
        "email": email,
        "password_hash": hash_password(password),
        "business_name": business_name,
        "owner_name": "",
        "phone": "",
        "business_address": "",
        "business_email": email,
        "created_at": _now_iso(),
    }
    await db.users.insert_one(user)
    logger.info(f"Seeded admin user: {email}")


@app.on_event("startup")
async def startup():
    try:
        storage_service.init_storage_at_startup()
    except Exception as e:
        logger.error(f"Storage init at startup failed: {e}")
    try:
        await _seed_admin_from_env(
            "SUPER_ADMIN_EMAIL", "SUPER_ADMIN_PASSWORD",
            "SUPER_ADMIN_BUSINESS_NAME", "Unitap HQ",
        )
        await _seed_admin_from_env(
            "ADMIN_EMAIL", "ADMIN_PASSWORD",
            "ADMIN_BUSINESS_NAME", "Unitap Admin",
        )
    except Exception as e:
        logger.error(f"Admin seed at startup failed: {e}")


@app.on_event("shutdown")
async def shutdown():
    client.close()
