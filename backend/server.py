"""UniTech — FastAPI backend.

Spanish-speaking Latino contractor SaaS.
Interface in Spanish, AI-generated client documents in English.
"""
from __future__ import annotations

import asyncio
import base64
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, BackgroundTasks, Depends, FastAPI, File, Form, Header, HTTPException, Query, Response, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import ai_service  # noqa: E402  (must be after load_dotenv so EMERGENT_LLM_KEY is set)
import storage_service  # noqa: E402
import social_service  # noqa: E402
import video_service  # noqa: E402
import tts_service  # noqa: E402
import payments_service  # noqa: E402
from auth_utils import create_token, get_current_user_id, hash_password, verify_password, decode_token  # noqa: E402
from fastapi import Request  # noqa: E402
from fastapi.responses import HTMLResponse  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

mongo_url = os.environ["MONGO_URL"]
db_name = os.environ["DB_NAME"]
app_name = os.environ.get("APP_NAME", "servicioflow")

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

app = FastAPI(title="UniTech")
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
    invite_token: Optional[str] = None


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
    # Subscription / trial state
    plan_type: Optional[str] = None
    subscription_status: Optional[str] = None
    trial_ends_at: Optional[int] = None
    current_period_end: Optional[int] = None
    cancel_at_period_end: Optional[bool] = False
    stripe_customer_id: Optional[str] = None
    shipping_address: Optional[dict] = None
    card_shipping_status: Optional[str] = None


class BusinessUpdate(BaseModel):
    business_name: Optional[str] = None
    owner_name: Optional[str] = None
    phone: Optional[str] = None
    business_address: Optional[str] = None
    business_email: Optional[str] = None
    shipping_address: Optional[dict] = None


class CheckoutCreateIn(BaseModel):
    plan_id: str
    origin_url: str
    num_cards: int = 1


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


class QuoteTerms(BaseModel):
    what_is_included: Optional[str] = ""
    what_is_not_included: Optional[str] = ""
    payment_terms: Optional[str] = ""
    warranty: Optional[str] = ""
    change_order_note: Optional[str] = ""


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
    # Embedded short agreement (5 clauses) so clients can accept+sign in one
    # step. Optional — when present, the public quote page asks for signature
    # and the accept flow auto-generates an Agreement + Invoice.
    terms: Optional[QuoteTerms] = None
    require_signature: bool = False


class InvoiceIn(BaseModel):
    client_id: str
    quote_id: Optional[str] = None
    agreement_id: Optional[str] = None
    job_title: str
    line_items: List[LineItem] = []
    subtotal: float = 0
    tax_rate: float = 0
    tax_amount: float = 0
    total: float = 0
    amount_paid: float = 0
    deposit_amount: float = 0  # Deposit due upfront (copied from quote/agreement)
    deposit_paid: bool = False
    due_date: Optional[str] = None
    notes: Optional[str] = ""
    agreement_terms: Optional[dict] = None  # Snapshot of signed agreement clauses
    status: str = "draft"  # draft, sent, paid, partial, overdue


class PaymentIn(BaseModel):
    amount: float
    method: str = "cash"  # cash, check, zelle, transfer, card, other
    date: Optional[str] = None  # ISO date; defaults to today
    note: Optional[str] = ""
    plan_item_id: Optional[str] = None  # links the payment to a plan installment


class InstallmentIn(BaseModel):
    label: str = ""
    amount: float
    due_date: Optional[str] = None


class PaymentPlanIn(BaseModel):
    installments: List[InstallmentIn] = []


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
    # Multi-card: owner-facing internal name + the person shown on this card.
    label: Optional[str] = None  # e.g. "Tarjeta Principal", "Vendedor Juan"
    person_name: Optional[str] = None  # name displayed on the public card
    contact_phone: Optional[str] = None  # this person's direct phone (overrides business phone)
    contact_email: Optional[str] = None  # this person's direct email (overrides business email)
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
    # Surface subscription-related fields (already on user doc; ensure present)
    u.setdefault("plan_type", None)
    u.setdefault("subscription_status", None)
    u.setdefault("trial_ends_at", None)
    u.setdefault("current_period_end", None)
    u.setdefault("cancel_at_period_end", False)
    u.setdefault("stripe_customer_id", None)
    u.setdefault("shipping_address", None)
    u.setdefault("card_shipping_status", None)
    # Compute derived flags for UI consumption
    u["smart_card_unlocked"] = payments_service.has_paid_subscription(u)
    u["subscription_active"] = payments_service.subscription_is_active(u)
    return u


# ============================================================================
# AUTH
# ============================================================================
@api_router.post("/auth/register")
async def register(payload: RegisterIn):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email ya registrado")
    import time as _time
    now_ts = int(_time.time())
    trial_ends_at = now_ts + 14 * 24 * 3600  # 14-day local trial

    # Process invite token if provided (grants comp access on signup).
    invite = None
    if payload.invite_token:
        invite = await db.comp_invites.find_one({
            "token": payload.invite_token,
            "status": "active",
        })
        if invite:
            # If invite is restricted to a specific email, enforce it.
            if invite.get("email") and invite["email"].lower() != payload.email.lower():
                raise HTTPException(
                    status_code=400,
                    detail="Esta invitación es para otro email",
                )

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
        "plan_type": None,
        "subscription_status": "trialing",
        "trial_ends_at": trial_ends_at,
        "trial_extended": False,
        "trial_notifs": [],
        "current_period_end": None,
        "stripe_customer_id": None,
        "stripe_subscription_id": None,
        "shipping_address": None,
        "card_shipping_status": None,
        "is_comp": False,
        "comp_note": None,
        "comp_expires_at": None,
        "comp_granted_by": None,
    }

    # Apply invite comp access if valid.
    if invite:
        user["is_comp"] = True
        user["comp_note"] = invite.get("note") or "Invitado por admin"
        user["comp_expires_at"] = invite.get("comp_expires_at")
        user["comp_granted_by"] = invite.get("created_by")
        user["plan_type"] = "comp"
        user["subscription_status"] = "active"  # show as active for UI

    await db.users.insert_one(user)

    # Mark invite as used.
    if invite:
        await db.comp_invites.update_one(
            {"id": invite["id"]},
            {"$set": {
                "status": "used",
                "used_by_user_id": user["id"],
                "used_at": _now_iso(),
            }},
        )

    token = create_token(user["id"])
    # Welcome notification for new local-trial users (skip invited comp accounts).
    if not invite:
        try:
            await _create_notification(
                user_id=user["id"],
                title="👋 ¡Bienvenido a UniTech!",
                body=(
                    "Tienes <strong>14 días gratis</strong> para probar todo — sin tarjeta. "
                    "Empieza creando tu primer quote profesional en inglés y comparte tu "
                    "tarjeta digital. ¡Estamos para ayudarte a crecer tu negocio!"
                ),
                kind="success",
                action_url="/quotes",
                action_label="Crear mi primer quote",
            )
            await db.users.update_one(
                {"id": user["id"]}, {"$addToSet": {"trial_notifs": "welcome"}}
            )
        except Exception as e:
            logger.error(f"welcome notif failed: {e!r}")
    return {
        "token": token,
        "user": await _user_doc(user["id"]),
    }


@api_router.post("/auth/login")
async def login(payload: LoginIn):
    u = await db.users.find_one({"email": payload.email.lower()})
    if not u or not verify_password(payload.password, u["password_hash"]):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    token = create_token(u["id"])
    return {
        "token": token,
        "user": await _user_doc(u["id"]),
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
    agreements = await db.agreements.find({"user_id": user_id, "client_id": client_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    scopes = await db.scope_drafts.find({"user_id": user_id, "client_id": client_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {
        "quotes": quotes,
        "invoices": invoices,
        "messages": messages,
        "photos": photos,
        "jobs": jobs,
        "agreements": agreements,
        "scopes": scopes,
    }


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
async def set_quote_status(quote_id: str, status: str, background_tasks: BackgroundTasks, user_id: str = Depends(get_current_user_id)):
    valid = {"draft", "sent", "approved", "declined", "converted"}
    if status not in valid:
        raise HTTPException(400, "Status inválido")
    await db.quotes.update_one(
        {"id": quote_id, "user_id": user_id},
        {"$set": {"status": status, "updated_at": _now_iso()}},
    )
    doc = await db.quotes.find_one({"id": quote_id, "user_id": user_id}, {"_id": 0})
    # Pre-generate the Service Agreement in the background as soon as the quote is
    # sent (or approved) so it's ready instantly when the client accepts.
    if doc and status in ("sent", "approved"):
        background_tasks.add_task(_auto_create_agreement_from_quote, doc)
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
async def public_quote(quote_id: str, background_tasks: BackgroundTasks):
    q = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not q:
        raise HTTPException(404, "Not found")
    user = await db.users.find_one({"id": q["user_id"]}, {"_id": 0, "password_hash": 0})
    client_doc = await db.clients.find_one({"id": q["client_id"]}, {"_id": 0})
    # Pre-generate the Service Agreement in the background the moment the client opens
    # the quote — by the time they read it and click Accept, it's ready instantly.
    if q.get("status") not in ("declined",):
        background_tasks.add_task(_auto_create_agreement_from_quote, q)
    return {"quote": q, "business": user, "client": client_doc}


# Public quote acceptance (no auth) — client clicks "Accept this Quote" from the share link.
# Marks the quote approved AND synchronously creates the AI service agreement (built from
# the project + the contractor's own terms) so we can send the client straight to it to
# review & sign — no extra link needed. Returns the agreement_id for the next step.
@api_router.post("/public/quotes/{quote_id}/accept")
async def public_accept_quote(quote_id: str):
    q = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not q:
        raise HTTPException(404, "Not found")
    if q.get("status") in ("declined",):
        raise HTTPException(400, "This quote can't be accepted in its current state")

    now_iso = _now_iso()
    if q.get("status") not in ("approved", "converted"):
        await db.quotes.update_one(
            {"id": quote_id},
            {"$set": {"status": "approved", "approved_at": now_iso, "updated_at": now_iso}},
        )

    # Find or create the linked service agreement (idempotent + race-safe).
    existing = await db.agreements.find_one(
        {"user_id": q["user_id"], "quote_id": quote_id}, {"_id": 0, "id": 1}
    )
    if existing:
        return {"ok": True, "agreement_id": existing["id"]}

    # If a background task (triggered on send/open) is already generating it, wait
    # for it instead of creating a duplicate — usually it's already done by now.
    claim = await db.quotes.find_one_and_update(
        {"id": quote_id, "agreement_generating": {"$ne": True}},
        {"$set": {"agreement_generating": True}},
    )
    if not claim:
        for _ in range(30):
            await asyncio.sleep(1)
            doc = await db.agreements.find_one(
                {"user_id": q["user_id"], "quote_id": quote_id}, {"_id": 0, "id": 1}
            )
            if doc:
                return {"ok": True, "agreement_id": doc["id"]}
        # Still not ready after waiting — claim it and generate ourselves.
        await db.quotes.update_one({"id": quote_id}, {"$set": {"agreement_generating": True}})

    # Build a rich Spanish description that includes any contractor terms so the
    # AI service agreement reflects exactly this project.
    desc_parts = [q.get("job_title", "")]
    if q.get("description"):
        desc_parts.append(q["description"])
    if q.get("scope_of_work"):
        desc_parts.append("Scope of work: " + "; ".join(q["scope_of_work"]))
    terms = q.get("terms") or {}
    for k, label in (
        ("what_is_included", "Incluye"),
        ("what_is_not_included", "No incluye"),
        ("payment_terms", "Términos de pago"),
        ("warranty", "Garantía"),
        ("change_order_note", "Órdenes de cambio"),
    ):
        if terms.get(k):
            desc_parts.append(f"{label}: {terms[k]}")
    if q.get("payment_terms"):
        desc_parts.append(f"Términos de pago: {q['payment_terms']}")
    description_es = "\n".join([p for p in desc_parts if p])

    try:
        agreement = await _build_agreement_from_quote_and_desc(
            user_id=q["user_id"],
            client_id=q["client_id"],
            quote_id=quote_id,
            description_es=description_es,
            total=float(q.get("total") or 0),
            deposit=float(q.get("deposit_amount") or 0),
        )
    except Exception as e:
        logger.exception(f"Sync agreement creation on accept failed for quote {quote_id}: {e}")
        raise HTTPException(500, "No se pudo preparar el acuerdo. Intenta de nuevo.")
    finally:
        await db.quotes.update_one({"id": quote_id}, {"$unset": {"agreement_generating": ""}})

    # Notify the contractor.
    try:
        await _create_notification(
            user_id=q["user_id"],
            title="✅ Cliente aceptó tu quote",
            body=f"{q.get('client_name','El cliente')} aceptó el quote. Ahora puede firmar el acuerdo de servicio.",
            kind="success",
            action_url=f"/agreements/{agreement['id']}",
            action_label="Ver acuerdo",
        )
    except Exception as e:
        logger.error(f"accept notif failed: {e!r}")

    return {"ok": True, "agreement_id": agreement["id"]}


# Public quote accept-and-sign — client accepts the quote AND signs the embedded
# short agreement in one step. Synchronously creates: (1) Agreement snapshot,
# (2) Invoice. Used when the quote was created with `require_signature=True`.
class PublicAcceptSignIn(BaseModel):
    signer_name: str
    signature: Optional[str] = ""   # data URL for drawn signature, optional


@api_router.post("/public/quotes/{quote_id}/accept-and-sign")
async def public_accept_and_sign_quote(quote_id: str, payload: PublicAcceptSignIn):
    q = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not q:
        raise HTTPException(404, "Quote not found")
    if q.get("status") in ("declined",):
        raise HTTPException(400, "Quote declined")
    signer = (payload.signer_name or "").strip()
    if len(signer) < 2:
        raise HTTPException(400, "Por favor ingresa tu nombre completo para firmar")

    now_iso = _now_iso()
    # Mark quote as approved + signed.
    await db.quotes.update_one(
        {"id": quote_id},
        {"$set": {
            "status": "approved",
            "approved_at": now_iso,
            "signer_name": signer,
            "signed_at_iso": now_iso,
            "updated_at": now_iso,
        }},
    )

    # Build agreement snapshot from the quote's embedded terms.
    terms = q.get("terms") or {}
    agreement_doc = {
        "id": _new_id(),
        "user_id": q["user_id"],
        "client_id": q["client_id"],
        "quote_id": quote_id,
        "client_name": q.get("client_name", ""),
        "title": f"Service Agreement — {q.get('job_title','')}",
        "deposit_amount": float(q.get("deposit_amount") or 0),
        "sections": {
            "what_is_included":       terms.get("what_is_included", ""),
            "what_is_not_included":   terms.get("what_is_not_included", ""),
            "payment_terms":          terms.get("payment_terms", ""),
            "warranty":               terms.get("warranty", ""),
            "change_order_note":      terms.get("change_order_note", ""),
        },
        "status": "signed",
        "signer_name": signer,
        "signed_at_iso": now_iso,
        "signature_data": payload.signature or "",
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    # If an agreement already exists (re-sign), reuse the ID idempotently.
    existing_agree = await db.agreements.find_one(
        {"user_id": q["user_id"], "quote_id": quote_id}, {"_id": 0, "id": 1}
    )
    if existing_agree:
        agreement_doc["id"] = existing_agree["id"]
        await db.agreements.update_one(
            {"id": agreement_doc["id"]}, {"$set": agreement_doc}
        )
    else:
        await db.agreements.insert_one(dict(agreement_doc))

    # Auto-create invoice (or reuse if already there).
    existing_inv = await db.invoices.find_one(
        {"user_id": q["user_id"], "quote_id": quote_id}, {"_id": 0, "id": 1}
    )
    invoice_id = existing_inv["id"] if existing_inv else None
    if not invoice_id:
        inv_count = await db.invoices.count_documents({"user_id": q["user_id"]})
        invoice_doc = {
            "id": _new_id(),
            "user_id": q["user_id"],
            "client_id": q["client_id"],
            "quote_id": quote_id,
            "agreement_id": agreement_doc["id"],
            "client_name": q.get("client_name", ""),
            "job_title": q.get("job_title", ""),
            "line_items": q.get("line_items", []),
            "subtotal": q.get("subtotal", 0),
            "tax_rate": q.get("tax_rate", 0),
            "tax_amount": q.get("tax_amount", 0),
            "total": q.get("total", 0),
            "deposit_amount": q.get("deposit_amount", 0),
            "agreement_terms": {
                "title": agreement_doc["title"],
                "sections": agreement_doc["sections"],
                "deposit": agreement_doc["deposit_amount"],
                "signer_name": signer,
                "signed_at": now_iso,
            },
            "number": f"INV-{2000 + inv_count + 1}",
            "status": "draft",
            "due_date": None,
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        await db.invoices.insert_one(dict(invoice_doc))
        invoice_id = invoice_doc["id"]

    # Mark quote as converted now that an invoice exists.
    await db.quotes.update_one(
        {"id": quote_id},
        {"$set": {"status": "converted", "invoice_id": invoice_id, "updated_at": now_iso}},
    )

    # Create the Job right away (filled with the quote's scope) so it can be
    # scheduled before payment.
    try:
        await _ensure_job_for_signed_quote(q, invoice_id, q["user_id"], agreement_doc)
    except Exception as e:
        logger.error(f"accept-and-sign auto-job failed: {e!r}")

    # Notify the contractor.
    try:
        await _create_notification(
            user_id=q["user_id"],
            title="✍️ Cliente aceptó y firmó tu quote",
            body=(
                f"{signer} aceptó el quote y firmó el acuerdo. "
                f"Ya creamos el invoice automáticamente — listo para enviarlo."
            ),
            kind="success",
            action_url=f"/invoices/{invoice_id}",
            action_label="Ver invoice",
        )
    except Exception as e:
        logger.error(f"accept-and-sign notif failed: {e!r}")

    return {
        "ok": True,
        "agreement_id": agreement_doc["id"],
        "invoice_id": invoice_id,
    }


async def _auto_create_agreement_from_quote(quote: dict):
    """Background task: builds the AI agreement for a quote (idempotent + race-safe)."""
    try:
        existing = await db.agreements.find_one(
            {"user_id": quote["user_id"], "quote_id": quote["id"]}, {"_id": 0, "id": 1}
        )
        if existing:
            return
        # Atomic claim so two triggers (sent + open) can't generate duplicates.
        claim = await db.quotes.find_one_and_update(
            {"id": quote["id"], "agreement_generating": {"$ne": True}},
            {"$set": {"agreement_generating": True}},
        )
        if not claim:
            return  # another worker is already generating it
        try:
            desc_parts = [quote.get("job_title", "")]
            if quote.get("description"):
                desc_parts.append(quote["description"])
            if quote.get("scope_of_work"):
                desc_parts.append("Scope: " + "; ".join(quote["scope_of_work"]))
            description_es = "\n".join([p for p in desc_parts if p])
            await _build_agreement_from_quote_and_desc(
                user_id=quote["user_id"],
                client_id=quote["client_id"],
                quote_id=quote["id"],
                description_es=description_es,
                total=float(quote.get("total") or 0),
                deposit=float(quote.get("deposit_amount") or 0),
            )
        finally:
            await db.quotes.update_one({"id": quote["id"]}, {"$unset": {"agreement_generating": ""}})
    except Exception as e:
        logger.exception(f"Background auto-agreement failed for quote {quote.get('id')}: {e}")


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
    data = payload.model_dump()
    # Auto-pull deposit and agreement terms if quote/agreement linked and the
    # caller didn't override them — keeps invoices consistent with what the
    # client already saw and signed.
    if payload.quote_id and not data.get("deposit_amount"):
        q = await db.quotes.find_one(
            {"id": payload.quote_id, "user_id": user_id}, {"_id": 0}
        )
        if q:
            data["deposit_amount"] = float(q.get("deposit_amount") or 0)
    if payload.agreement_id and not data.get("agreement_terms"):
        a = await db.agreements.find_one(
            {"id": payload.agreement_id, "user_id": user_id}, {"_id": 0}
        )
        if a:
            data["agreement_terms"] = {
                "title": a.get("title", ""),
                "sections": a.get("sections", {}),
                "deposit": float(a.get("deposit") or 0),
                "signer_name": a.get("signer_name", ""),
                "signed_at": a.get("signed_at"),
            }
            if not data.get("deposit_amount"):
                data["deposit_amount"] = float(a.get("deposit") or 0)
    doc = {
        "id": _new_id(),
        "user_id": user_id,
        "number": f"INV-{2000 + count + 1}",
        **data,
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
    # Lazy backfill: invoices created before deposit/agreement-terms support
    # get those fields populated on first read so the UI shows them.
    backfill = {}
    if not doc.get("deposit_amount") and doc.get("quote_id"):
        q = await db.quotes.find_one(
            {"id": doc["quote_id"], "user_id": user_id}, {"_id": 0}
        )
        if q and float(q.get("deposit_amount") or 0) > 0:
            backfill["deposit_amount"] = float(q.get("deposit_amount"))
    if not doc.get("agreement_terms"):
        # Try linked agreement first, then any agreement on the same quote.
        a = None
        if doc.get("agreement_id"):
            a = await db.agreements.find_one(
                {"id": doc["agreement_id"], "user_id": user_id}, {"_id": 0}
            )
        if not a and doc.get("quote_id"):
            a = await db.agreements.find_one(
                {"quote_id": doc["quote_id"], "user_id": user_id}, {"_id": 0}
            )
        if a:
            backfill["agreement_id"] = a["id"]
            backfill["agreement_terms"] = {
                "title": a.get("title", ""),
                "sections": a.get("sections", {}),
                "deposit": float(a.get("deposit") or 0),
                "signer_name": a.get("signer_name", ""),
                "signed_at": a.get("signed_at"),
            }
            if not backfill.get("deposit_amount") and not doc.get("deposit_amount"):
                backfill["deposit_amount"] = float(a.get("deposit") or 0)
    if backfill:
        backfill["updated_at"] = _now_iso()
        await db.invoices.update_one(
            {"id": invoice_id, "user_id": user_id},
            {"$set": backfill},
        )
        doc.update(backfill)
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
    # If a payments ledger exists, it is the source of truth for amount_paid +
    # status — don't let a plain invoice edit clobber it.
    if doc.get("payments"):
        doc = await _recalc_invoice_payments(invoice_id, user_id)
    return doc


@api_router.get("/invoices/{invoice_id}/job")
async def get_invoice_job(invoice_id: str, user_id: str = Depends(get_current_user_id)):
    """Return the Job linked to this invoice (or its quote), if any."""
    inv = await db.invoices.find_one({"id": invoice_id, "user_id": user_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice no encontrado")
    job = await db.jobs.find_one({
        "user_id": user_id,
        "$or": [
            {"invoice_id": invoice_id},
            {"quote_id": inv.get("quote_id")} if inv.get("quote_id") else {"invoice_id": invoice_id},
        ],
    }, {"_id": 0})
    return {"job": job}


@api_router.post("/invoices/{invoice_id}/create-job")
async def create_job_from_invoice(invoice_id: str, user_id: str = Depends(get_current_user_id)):
    """Manually create a Job from an invoice (e.g. when the quote step was
    skipped). Idempotent — returns the existing job if one already exists."""
    inv = await db.invoices.find_one({"id": invoice_id, "user_id": user_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice no encontrado")
    if not inv.get("client_id"):
        raise HTTPException(400, "Este invoice no tiene un cliente asignado.")
    existing = await db.jobs.find_one({
        "user_id": user_id,
        "$or": [
            {"invoice_id": invoice_id},
            {"quote_id": inv.get("quote_id")} if inv.get("quote_id") else {"invoice_id": invoice_id},
        ],
    }, {"_id": 0})
    if existing:
        return {"job": existing, "created": False}
    job_id = await _ensure_job_for_invoice(inv, user_id, default_note="Trabajo creado desde el invoice")
    job = await db.jobs.find_one({"id": job_id, "user_id": user_id}, {"_id": 0})
    return {"job": job, "created": True}


async def _ensure_job_for_invoice(inv: dict, user_id: str, default_note: str = "Auto-creado al marcar invoice como pagado") -> Optional[str]:
    """Create a Job for an invoice (idempotent). Returns new job_id or None."""
    # Idempotent: skip if a job already exists for this invoice OR its quote
    # (the job is usually created earlier, when the agreement is signed).
    existing_job = await db.jobs.find_one({
        "user_id": user_id,
        "$or": [
            {"invoice_id": inv["id"]},
            {"quote_id": inv.get("quote_id")} if inv.get("quote_id") else {"invoice_id": inv["id"]},
        ],
    })
    if existing_job or not inv.get("client_id"):
        return None
    client = await db.clients.find_one(
        {"id": inv["client_id"], "user_id": user_id}, {"_id": 0}
    ) or {}
    job_doc = {
        "id": _new_id(),
        "user_id": user_id,
        "client_id": inv["client_id"],
        "title": inv.get("job_title") or "Trabajo",
        "quote_id": inv.get("quote_id"),
        "invoice_id": inv["id"],
        "status": "approved",  # paid → ready to schedule
        "scheduled_date": None,
        "end_date": None,
        "start_time": "",
        "end_time": "",
        "all_day": False,
        "address": client.get("address") or "",
        "recurrence": "none",
        "recurrence_days": [],
        "recurrence_end_date": None,
        "notes": _scope_from_line_items(inv.get("line_items", [])) or default_note,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
        "auto_created": True,
    }
    await db.jobs.insert_one(job_doc)
    return job_doc["id"]


def _scope_from_line_items(line_items: list) -> str:
    """Build a checklist of work to do from quote/invoice line items."""
    lines = []
    for li in (line_items or []):
        desc = (li.get("description") or li.get("name") or "").strip()
        if not desc:
            continue
        qty = li.get("quantity")
        try:
            qn = float(qty)
            qty_str = str(int(qn)) if qn.is_integer() else str(qn)
        except (TypeError, ValueError):
            qty_str = None
        lines.append(f"• {desc}" + (f" (x{qty_str})" if qty_str and qty_str != "1" else ""))
    return "\n".join(lines)


async def _ensure_job_for_signed_quote(quote: dict, invoice_id: Optional[str], user_id: str, agreement: Optional[dict] = None) -> Optional[str]:
    """Create a Job as soon as the agreement is signed (before payment), filled
    with the scope copied from the quote line items. Idempotent per quote."""
    if not quote or not quote.get("client_id"):
        return None
    existing = await db.jobs.find_one({
        "user_id": user_id,
        "$or": [{"quote_id": quote.get("id")}] + ([{"invoice_id": invoice_id}] if invoice_id else []),
    })
    if existing:
        return None
    client = await db.clients.find_one(
        {"id": quote["client_id"], "user_id": user_id}, {"_id": 0}
    ) or {}
    scope = _scope_from_line_items(quote.get("line_items", []))
    extra_notes = (quote.get("notes") or "").strip()
    notes = "\n\n".join([p for p in [scope, extra_notes] if p]) or "Trabajo creado al firmarse el acuerdo"
    job_doc = {
        "id": _new_id(),
        "user_id": user_id,
        "client_id": quote["client_id"],
        "title": quote.get("job_title") or "Trabajo",
        "quote_id": quote.get("id"),
        "invoice_id": invoice_id,
        "status": "approved",  # signed → ready to schedule
        "scheduled_date": None,
        "end_date": None,
        "start_time": "",
        "end_time": "",
        "all_day": False,
        "address": client.get("address") or "",
        "recurrence": "none",
        "recurrence_days": [],
        "recurrence_end_date": None,
        "notes": notes,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
        "auto_created": True,
    }
    await db.jobs.insert_one(job_doc)
    return job_doc["id"]



async def _recalc_invoice_payments(invoice_id: str, user_id: str) -> dict:
    """Recompute amount_paid + status from the payments ledger, then persist.

    Status rules: paid>=total>0 → 'paid' (auto-creates job); 0<paid<total →
    'partial'; paid<=0 keeps the current non-paid status. Never overrides a
    manual 'overdue'/'sent' when nothing has been paid yet.
    """
    inv = await db.invoices.find_one({"id": invoice_id, "user_id": user_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice no encontrado")
    total = float(inv.get("total") or 0)
    paid = round(sum(float(p.get("amount") or 0) for p in inv.get("payments", [])), 2)
    update = {"amount_paid": paid, "updated_at": _now_iso()}
    auto_job_id = None
    if total > 0 and paid >= total:
        if inv.get("status") != "paid":
            update["status"] = "paid"
            auto_job_id = await _ensure_job_for_invoice(inv, user_id)
    elif paid > 0:
        update["status"] = "partial"
    elif inv.get("status") == "partial":
        # All payments removed → fall back to 'sent'.
        update["status"] = "sent"
    await db.invoices.update_one({"id": invoice_id, "user_id": user_id}, {"$set": update})
    doc = await db.invoices.find_one({"id": invoice_id, "user_id": user_id}, {"_id": 0})
    if auto_job_id:
        doc["auto_created_job_id"] = auto_job_id
    return doc


@api_router.post("/invoices/{invoice_id}/payments")
async def add_invoice_payment(invoice_id: str, payload: PaymentIn, user_id: str = Depends(get_current_user_id)):
    if payload.amount is None or float(payload.amount) <= 0:
        raise HTTPException(400, "El monto del abono debe ser mayor a 0")
    inv = await db.invoices.find_one({"id": invoice_id, "user_id": user_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice no encontrado")
    payment = {
        "id": _new_id(),
        "amount": round(float(payload.amount), 2),
        "method": payload.method or "cash",
        "date": payload.date or _now_iso(),
        "note": (payload.note or "").strip(),
        "plan_item_id": payload.plan_item_id,
        "created_at": _now_iso(),
    }
    await db.invoices.update_one(
        {"id": invoice_id, "user_id": user_id},
        {"$push": {"payments": payment}},
    )
    return await _recalc_invoice_payments(invoice_id, user_id)


@api_router.delete("/invoices/{invoice_id}/payments/{payment_id}")
async def delete_invoice_payment(invoice_id: str, payment_id: str, user_id: str = Depends(get_current_user_id)):
    res = await db.invoices.update_one(
        {"id": invoice_id, "user_id": user_id},
        {"$pull": {"payments": {"id": payment_id}}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Invoice no encontrado")
    return await _recalc_invoice_payments(invoice_id, user_id)


@api_router.put("/invoices/{invoice_id}/payment-plan")
async def set_invoice_payment_plan(invoice_id: str, payload: PaymentPlanIn, user_id: str = Depends(get_current_user_id)):
    inv = await db.invoices.find_one({"id": invoice_id, "user_id": user_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice no encontrado")
    plan = [
        {
            "id": _new_id(),
            "label": (it.label or f"Pago {i + 1}").strip(),
            "amount": round(float(it.amount or 0), 2),
            "due_date": it.due_date or None,
        }
        for i, it in enumerate(payload.installments)
    ]
    await db.invoices.update_one(
        {"id": invoice_id, "user_id": user_id},
        {"$set": {"payment_plan": plan, "updated_at": _now_iso()}},
    )
    doc = await db.invoices.find_one({"id": invoice_id, "user_id": user_id}, {"_id": 0})
    return doc


@api_router.post("/invoices/{invoice_id}/status")
async def set_invoice_status(invoice_id: str, status: str, user_id: str = Depends(get_current_user_id)):
    valid = {"draft", "sent", "paid", "partial", "overdue"}
    if status not in valid:
        raise HTTPException(400, "Status inválido")
    update = {"status": status, "updated_at": _now_iso()}
    auto_created_job_id = None
    if status == "paid":
        inv = await db.invoices.find_one({"id": invoice_id, "user_id": user_id}, {"_id": 0})
        if inv:
            update["amount_paid"] = inv.get("total", 0)
            auto_created_job_id = await _ensure_job_for_invoice(inv, user_id)
    await db.invoices.update_one({"id": invoice_id, "user_id": user_id}, {"$set": update})
    doc = await db.invoices.find_one({"id": invoice_id, "user_id": user_id}, {"_id": 0})
    if auto_created_job_id:
        doc["auto_created_job_id"] = auto_created_job_id
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
    # Surface the owner's payment methods so the public invoice page can
    # render pay-by-app buttons.
    payment_methods = (user or {}).get("payment_methods") or {}
    remaining = round(max(0, float(inv.get("total") or 0) - float(inv.get("amount_paid") or 0)), 2)
    card_payment = {
        "enabled": bool(_stripe_collect_enabled_for(user) and remaining > 0 and inv.get("status") != "paid"),
        "remaining": remaining,
    }
    return {
        "invoice": inv,
        "business": user,
        "client": client_doc,
        "payment_methods": payment_methods,
        "card_payment": card_payment,
    }


class InvoiceCheckoutIn(BaseModel):
    origin_url: str
    plan_item_id: Optional[str] = None


@api_router.post("/public/invoices/{invoice_id}/checkout")
async def public_invoice_checkout(invoice_id: str, payload: InvoiceCheckoutIn):
    """Create a Stripe Checkout Session so the client can pay an invoice by card.
    The amount is computed server-side; card collection is gated to the owner."""
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    owner = await db.users.find_one({"id": inv["user_id"]}, {"_id": 0})
    if not _stripe_collect_enabled_for(owner):
        raise HTTPException(403, "Card payments are not available for this business.")
    total = float(inv.get("total") or 0)
    paid = float(inv.get("amount_paid") or 0)
    amount = round(max(0, total - paid), 2)
    if payload.plan_item_id:
        item = next((p for p in (inv.get("payment_plan") or []) if p.get("id") == payload.plan_item_id), None)
        if item:
            amount = round(float(item.get("amount") or 0), 2)
    if amount <= 0:
        raise HTTPException(400, "This invoice is already paid in full.")
    origin = (payload.origin_url or "").rstrip("/")
    if not origin.startswith("http"):
        raise HTTPException(400, "origin_url inválido")
    success_url = f"{origin}/p/invoice/{inv['id']}?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/p/invoice/{inv['id']}"
    return await payments_service.create_invoice_checkout(db, inv, amount, success_url, cancel_url)


async def _record_card_payment_from_tx(tx: dict) -> None:
    """Push a card abono onto the invoice ledger and (if any) mark the
    originating payment request as paid. Caller must have already claimed the
    payment_transactions.recorded flag atomically."""
    amount = round((tx.get("amount_cents") or 0) / 100, 2)
    payment = {
        "id": _new_id(),
        "amount": amount,
        "method": "card",
        "date": _now_iso(),
        "note": tx.get("description") or "Pago con tarjeta (Stripe)",
        "plan_item_id": None,
        "created_at": _now_iso(),
    }
    await db.invoices.update_one({"id": tx["invoice_id"]}, {"$push": {"payments": payment}})
    await _recalc_invoice_payments(tx["invoice_id"], tx["user_id"])
    if tx.get("request_id"):
        await db.payment_requests.update_one(
            {"id": tx["request_id"]},
            {"$set": {"status": "paid", "paid_at": _now_iso()}},
        )


@api_router.get("/public/invoices/checkout/status/{session_id}")
async def public_invoice_checkout_status(session_id: str):
    """Poll a card payment (invoice or payment-request). On first 'paid',
    records the abono on the invoice ledger (idempotent via the
    payment_transactions.recorded flag)."""
    result = await payments_service.get_invoice_checkout_status(db, session_id)
    if result.get("payment_status") == "paid":
        tx = await db.payment_transactions.find_one_and_update(
            {"session_id": session_id, "type": {"$in": ["invoice_payment", "payment_request"]}, "recorded": {"$ne": True}},
            {"$set": {"recorded": True, "payment_status": "paid", "status": "complete"}},
        )
        if tx:
            await _record_card_payment_from_tx(tx)
    return result


# ============================================================================
# PAYMENT REQUESTS — owner sends a focused "payment slip" for a specific amount
# ============================================================================
class PaymentRequestIn(BaseModel):
    amount: float
    description: str = ""
    plan_item_id: Optional[str] = None


@api_router.post("/invoices/{invoice_id}/payment-requests")
async def create_payment_request(invoice_id: str, payload: PaymentRequestIn, user_id: str = Depends(get_current_user_id)):
    inv = await db.invoices.find_one({"id": invoice_id, "user_id": user_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice no encontrado")
    amount = round(float(payload.amount or 0), 2)
    plan_item_id = payload.plan_item_id
    if plan_item_id:
        item = next((p for p in (inv.get("payment_plan") or []) if p.get("id") == plan_item_id), None)
        if item:
            amount = round(float(item.get("amount") or 0), 2)
    if amount <= 0:
        raise HTTPException(400, "El monto debe ser mayor a 0")
    req = {
        "id": _new_id(),
        "invoice_id": invoice_id,
        "user_id": user_id,
        "client_id": inv.get("client_id"),
        "amount": amount,
        "description": (payload.description or "").strip(),
        "plan_item_id": plan_item_id,
        "status": "pending",
        "created_at": _now_iso(),
        "paid_at": None,
    }
    await db.payment_requests.insert_one({**req})
    return req


@api_router.get("/invoices/{invoice_id}/payment-requests")
async def list_payment_requests(invoice_id: str, user_id: str = Depends(get_current_user_id)):
    items = await db.payment_requests.find(
        {"invoice_id": invoice_id, "user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return {"requests": items}


@api_router.delete("/payment-requests/{request_id}")
async def delete_payment_request(request_id: str, user_id: str = Depends(get_current_user_id)):
    res = await db.payment_requests.delete_one({"id": request_id, "user_id": user_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Solicitud no encontrada")
    return {"ok": True}


@api_router.get("/public/payment-requests/{request_id}")
async def public_payment_request(request_id: str):
    req = await db.payment_requests.find_one({"id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(404, "Request not found")
    inv = await db.invoices.find_one({"id": req["invoice_id"]}, {"_id": 0}) or {}
    owner = await db.users.find_one({"id": req["user_id"]}, {"_id": 0, "password_hash": 0})
    client_doc = await db.clients.find_one({"id": req.get("client_id")}, {"_id": 0})
    return {
        "request": req,
        "invoice": {
            "id": inv.get("id"),
            "number": inv.get("number"),
            "job_title": inv.get("job_title"),
            "total": inv.get("total"),
            "amount_paid": inv.get("amount_paid"),
            "status": inv.get("status"),
        },
        "business": owner,
        "client": client_doc,
        "payment_methods": (owner or {}).get("payment_methods") or {},
        "card_payment": {
            "enabled": bool(_stripe_collect_enabled_for(owner) and req["status"] != "paid"),
            "amount": req["amount"],
        },
    }


class PaymentRequestCheckoutIn(BaseModel):
    origin_url: str


@api_router.post("/public/payment-requests/{request_id}/checkout")
async def public_payment_request_checkout(request_id: str, payload: PaymentRequestCheckoutIn):
    req = await db.payment_requests.find_one({"id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(404, "Request not found")
    if req["status"] == "paid":
        raise HTTPException(400, "This request has already been paid.")
    owner = await db.users.find_one({"id": req["user_id"]}, {"_id": 0})
    if not _stripe_collect_enabled_for(owner):
        raise HTTPException(403, "Card payments are not available for this business.")
    inv = await db.invoices.find_one({"id": req["invoice_id"]}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    origin = (payload.origin_url or "").rstrip("/")
    if not origin.startswith("http"):
        raise HTTPException(400, "origin_url inválido")
    success_url = f"{origin}/p/pay/{request_id}?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/p/pay/{request_id}"
    label = req.get("description") or f"Pago — Invoice {inv.get('number', '')}".strip()
    return await payments_service.create_invoice_checkout(
        db, inv, req["amount"], success_url, cancel_url, label=label, request_id=request_id
    )


# ============================================================================
# PAYMENT METHODS — owner-configured payment links shown on public invoices
# ============================================================================
PAYMENT_METHOD_KEYS = ("venmo", "paypal", "cashapp", "zelle", "cash", "check")


def _normalize_payment_methods(pm: dict) -> dict:
    """Validate/normalize the payment_methods dict from the user."""
    out: dict = {}
    if not isinstance(pm, dict):
        return out
    for k in PAYMENT_METHOD_KEYS:
        entry = pm.get(k) or {}
        out[k] = {
            "enabled": bool(entry.get("enabled")),
            "value": (entry.get("value") or "").strip(),
            "note": (entry.get("note") or "").strip(),
        }
    return out


@api_router.get("/payment-methods")
async def get_payment_methods(user_id: str = Depends(get_current_user_id)):
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "payment_methods": 1})
    return {"payment_methods": _normalize_payment_methods((u or {}).get("payment_methods") or {})}


class PaymentMethodsIn(BaseModel):
    payment_methods: dict


@api_router.put("/payment-methods")
async def set_payment_methods(
    payload: PaymentMethodsIn,
    user_id: str = Depends(get_current_user_id),
):
    pm = _normalize_payment_methods(payload.payment_methods)
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"payment_methods": pm}},
    )
    return {"payment_methods": pm}


class PublicMarkPaidIn(BaseModel):
    method: str = ""           # which method the client used to pay
    payer_name: str = ""       # optional, client may type their name
    note: str = ""


@api_router.post("/public/invoices/{invoice_id}/mark-paid-notice")
async def public_mark_paid_notice(invoice_id: str, payload: PublicMarkPaidIn):
    """Public endpoint — client clicks 'I've paid' on the invoice page.
    Does NOT auto-mark as paid (to prevent abuse). Creates an in-app
    notification for the owner to verify and approve manually.
    """
    inv = await db.invoices.find_one({"id": invoice_id})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    user_id = inv.get("user_id")
    if not user_id:
        raise HTTPException(404, "Invoice has no owner")
    method = (payload.method or "").strip()[:20]
    payer = (payload.payer_name or "").strip()[:80]
    note = (payload.note or "").strip()[:300]
    method_label = {
        "venmo": "Venmo", "paypal": "PayPal", "cashapp": "Cash App",
        "zelle": "Zelle", "cash": "Efectivo", "check": "Cheque",
        "other": "Otro método",
    }.get(method, method or "Otro método")
    body = (
        f"{payer or 'Tu cliente'} marcó como pagado el invoice "
        f"<strong>{inv.get('number','')}</strong> vía "
        f"<strong>{method_label}</strong>. Confirma que recibiste el pago y "
        "márcalo como pagado en la app."
    )
    if note:
        body += f' Nota del cliente: "{note}"'
    try:
        await _create_notification(
            user_id=user_id,
            title="💰 Cliente reporta pago de invoice",
            body=body,
            kind="success",
            action_url=f"/invoices/{invoice_id}",
            action_label="Ver invoice",
        )
    except Exception as e:
        logger.error(f"mark-paid-notice notif failed: {e!r}")
    return {"ok": True}


# ============================================================================
# GOOGLE REVIEWS — sentiment-gated review collection
# ============================================================================
class GoogleReviewSettingsIn(BaseModel):
    google_review_url: Optional[str] = ""
    review_intro_text: Optional[str] = ""
    review_filter_enabled: Optional[bool] = True


@api_router.get("/google-reviews/settings")
async def get_review_settings(user_id: str = Depends(get_current_user_id)):
    u = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "google_review_url": 1, "review_intro_text": 1, "review_filter_enabled": 1},
    ) or {}
    return {
        "google_review_url": u.get("google_review_url") or "",
        "review_intro_text": u.get("review_intro_text") or "",
        "review_filter_enabled": u.get("review_filter_enabled", True),
    }


@api_router.put("/google-reviews/settings")
async def set_review_settings(
    payload: GoogleReviewSettingsIn,
    user_id: str = Depends(get_current_user_id),
):
    url = (payload.google_review_url or "").strip()
    if url and not (url.startswith("http://") or url.startswith("https://")):
        url = "https://" + url
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "google_review_url": url,
            "review_intro_text": (payload.review_intro_text or "").strip(),
            "review_filter_enabled": bool(payload.review_filter_enabled),
        }},
    )
    return {"ok": True, "google_review_url": url}


class PublicReviewFeedbackIn(BaseModel):
    sentiment: str
    rating: Optional[int] = None
    feedback: Optional[str] = ""
    name: Optional[str] = ""
    contact: Optional[str] = ""


@api_router.get("/public/reviews/{slug}")
async def public_review_page(slug: str):
    card, user = await _public_card_by_slug(slug)
    google_url = (user.get("google_review_url") or "").strip()
    if not google_url:
        raise HTTPException(404, "This business hasn't set up Google Reviews yet.")
    return {
        "business_name": user.get("business_name", ""),
        "owner_name": user.get("owner_name", ""),
        "logo_url": user.get("logo_url") or card.get("logo_url"),
        "card_slug": card.get("slug"),
        "google_review_url": google_url,
        "intro_text": user.get("review_intro_text") or "",
        "filter_enabled": user.get("review_filter_enabled", True),
    }


@api_router.post("/public/reviews/{slug}/feedback")
async def public_review_feedback(slug: str, payload: PublicReviewFeedbackIn):
    """Capture private feedback when client picks neutral/sad sentiment."""
    card, user = await _public_card_by_slug(slug)
    if payload.sentiment not in ("happy", "neutral", "sad"):
        raise HTTPException(400, "Invalid sentiment")
    doc = {
        "id": _new_id(),
        "user_id": user["id"],
        "card_slug": slug,
        "sentiment": payload.sentiment,
        "rating": payload.rating if isinstance(payload.rating, int) and 1 <= payload.rating <= 5 else None,
        "feedback": (payload.feedback or "").strip()[:1000],
        "name": (payload.name or "").strip()[:80],
        "contact": (payload.contact or "").strip()[:120],
        "created_at": _now_iso(),
    }
    await db.review_feedback.insert_one(dict(doc))
    if payload.sentiment != "happy":
        emoji = "😐" if payload.sentiment == "neutral" else "😞"
        try:
            await _create_notification(
                user_id=user["id"],
                title=f"{emoji} Feedback privado de un cliente",
                body=(
                    f"{doc['name'] or 'Un cliente'} compartió feedback privado en lugar de "
                    f"dejar reseña pública. Contáctalo para arreglar la situación.<br><br>"
                    f"<em>\"{doc['feedback'] or '(sin mensaje)'}\"</em>"
                    + (f"<br><br>Contacto: <strong>{doc['contact']}</strong>" if doc['contact'] else "")
                ),
                kind="warning",
                action_url="/feedback",
                action_label="Ver feedback",
            )
        except Exception as e:
            logger.error(f"feedback notif failed: {e!r}")
    return {"ok": True}


@api_router.get("/review-feedback")
async def list_review_feedback(user_id: str = Depends(get_current_user_id)):
    docs = await db.review_feedback.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(200).to_list(200)
    return {"feedback": docs}




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
class TranslateFieldIn(BaseModel):
    field_type: str = "generic"
    text_es: str
    business_type: Optional[str] = ""


@api_router.post("/ai/translate-field")
async def ai_translate_field(payload: TranslateFieldIn, user_id: str = Depends(get_current_user_id)):
    """Turn a contractor's Spanish input into polished public-facing English for a profile field."""
    if not (payload.text_es or "").strip():
        raise HTTPException(400, "Escribe algo en español primero")
    try:
        text_en = await ai_service.polish_to_english(
            payload.field_type, payload.text_es.strip(), payload.business_type or ""
        )
    except Exception as e:
        logger.exception("AI translate-field failed")
        raise HTTPException(500, f"AI error: {e}")
    return {"text_en": text_en}


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
    """Return the user's PRIMARY card settings, creating defaults if absent."""
    card = await db.cards.find_one({"user_id": user_id, "is_primary": True}, {"_id": 0})
    if card:
        return card
    # Back-compat: a pre-multicard account may have a card without is_primary.
    legacy = await db.cards.find_one({"user_id": user_id}, {"_id": 0})
    if legacy:
        await db.cards.update_one({"id": legacy["id"]}, {"$set": {"is_primary": True}})
        legacy["is_primary"] = True
        if not legacy.get("label"):
            await db.cards.update_one({"id": legacy["id"]}, {"$set": {"label": "Tarjeta Principal"}})
            legacy["label"] = "Tarjeta Principal"
        return legacy
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
        "is_primary": True,
        "label": "Tarjeta Principal",
        "person_name": user.get("owner_name", ""),
        "contact_phone": "",
        "contact_email": "",
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


# Company-level fields that are SHARED across all of an account's cards. They are
# always sourced from the PRIMARY card so the owner edits them once.
SHARED_CARD_FIELDS = [
    "business_type", "service_area", "years_in_business", "is_licensed",
    "is_insured", "license_number", "services", "hours", "website",
    "facebook", "instagram", "google_review_url", "logo_photo_id",
]


async def _effective_card_limit(user: dict) -> int:
    """How many digital cards this account may have. Driven by the admin
    override (`card_limit`) which is also bumped automatically by the number of
    paid card seats on the subscription. Defaults to 1."""
    return max(1, int(user.get("card_limit") or 1))


async def _resolve_card(user_id: str, card_id: Optional[str]) -> dict:
    """Return a specific card owned by the user, or the primary card if no id."""
    await _ensure_card(user_id)  # guarantee a primary exists
    if card_id:
        card = await db.cards.find_one({"id": card_id, "user_id": user_id}, {"_id": 0})
        if not card:
            raise HTTPException(404, "Tarjeta no encontrada")
        return card
    return await _ensure_card(user_id)


@api_router.get("/card/list")
async def list_cards(user_id: str = Depends(get_current_user_id)):
    """All cards for the account + how many more can be created."""
    await _ensure_card(user_id)
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    limit = await _effective_card_limit(user)
    cards = await db.cards.find({"user_id": user_id}, {"_id": 0}).sort("is_primary", -1).to_list(50)
    slim = [{
        "id": c["id"],
        "slug": c.get("slug"),
        "label": c.get("label") or ("Tarjeta Principal" if c.get("is_primary") else "Tarjeta"),
        "person_name": c.get("person_name", ""),
        "is_primary": bool(c.get("is_primary")),
        "enabled": c.get("enabled", True),
        "profile_photo_id": c.get("profile_photo_id"),
    } for c in cards]
    return {"cards": slim, "limit": limit, "count": len(cards), "can_add": len(cards) < limit}


@api_router.post("/card")
async def create_card(payload: CardSettingsIn, user_id: str = Depends(get_current_user_id)):
    """Create an additional digital card (enforces the account's card limit).
    Company-level info is shared from the primary card; the owner personalizes
    the person fields (name, photo, role, phone, email)."""
    primary = await _ensure_card(user_id)
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    limit = await _effective_card_limit(user)
    count = await db.cards.count_documents({"user_id": user_id})
    if count >= limit:
        raise HTTPException(403, f"Alcanzaste tu límite de {limit} tarjeta(s). Agrega tarjetas en tu plan para crear más.")
    label = (payload.label or "Nueva tarjeta").strip()[:60]
    person = (payload.person_name or "").strip()[:80]
    base_slug = _slugify(person or label or (primary.get("slug") + "-2"))
    slug = base_slug
    n = 1
    while await db.cards.find_one({"slug": slug}, {"_id": 0}):
        n += 1
        slug = f"{base_slug}-{n}"
    doc = {
        "id": _new_id(),
        "user_id": user_id,
        "is_primary": False,
        "label": label,
        "person_name": person,
        "contact_phone": "",
        "contact_email": "",
        "slug": slug,
        "tagline": primary.get("tagline", ""),
        "business_type": primary.get("business_type", ""),
        "service_area": primary.get("service_area", ""),
        "years_in_business": primary.get("years_in_business", 0),
        "is_licensed": primary.get("is_licensed", False),
        "is_insured": primary.get("is_insured", False),
        "license_number": primary.get("license_number", ""),
        "rating": primary.get("rating", 0.0),
        "brand_color": primary.get("brand_color", "#1E3A8A"),
        "accent_color": primary.get("accent_color", "#10B981"),
        "hero_overlay": primary.get("hero_overlay", 60),
        "hero_layout": primary.get("hero_layout", "photo"),
        "cover_photo_id": None,
        "profile_photo_id": None,
        "logo_photo_id": primary.get("logo_photo_id"),
        "services": primary.get("services", []),
        "hours": primary.get("hours", ""),
        "whatsapp": "",
        "website": primary.get("website", ""),
        "facebook": primary.get("facebook", ""),
        "instagram": primary.get("instagram", ""),
        "google_review_url": primary.get("google_review_url", ""),
        "about_me": "",
        "role": "",
        "enabled": True,
        "languages": primary.get("languages", ["en", "es"]),
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await db.cards.insert_one(doc)
    return _strip_id(doc)


@api_router.get("/card/settings")
async def get_card_settings(card_id: Optional[str] = None, user_id: str = Depends(get_current_user_id)):
    return await _resolve_card(user_id, card_id)


@api_router.put("/card/settings")
async def update_card_settings(payload: CardSettingsIn, card_id: Optional[str] = None, user_id: str = Depends(get_current_user_id)):
    card = await _resolve_card(user_id, card_id)
    # exclude_unset = only fields explicitly sent by the client (true PATCH/merge).
    # This prevents Pydantic defaults ("", [], False, 0) from wiping out saved data
    # when the frontend omits a field from the payload.
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    # If slug is provided, ensure unique
    if "slug" in update and update["slug"] and update["slug"] != card["slug"]:
        new_slug = _slugify(update["slug"])
        existing = await db.cards.find_one({"slug": new_slug, "id": {"$ne": card["id"]}}, {"_id": 0})
        if existing:
            raise HTTPException(400, "Ese link ya está tomado, prueba otro")
        update["slug"] = new_slug
    update["updated_at"] = _now_iso()
    await db.cards.update_one({"id": card["id"]}, {"$set": update})
    return await db.cards.find_one({"id": card["id"]}, {"_id": 0})


@api_router.post("/card/logo")
async def upload_card_logo(file: UploadFile = File(...), card_id: Optional[str] = None, user_id: str = Depends(get_current_user_id)):
    return await _upload_card_asset(file, user_id, kind="logo", card_id=card_id)


@api_router.delete("/card/logo")
async def delete_card_logo(card_id: Optional[str] = None, user_id: str = Depends(get_current_user_id)):
    return await _delete_card_asset(user_id, kind="logo", card_id=card_id)


@api_router.post("/card/profile-photo")
async def upload_card_profile_photo(file: UploadFile = File(...), card_id: Optional[str] = None, user_id: str = Depends(get_current_user_id)):
    return await _upload_card_asset(file, user_id, kind="profile_photo", card_id=card_id)


@api_router.delete("/card/profile-photo")
async def delete_card_profile_photo(card_id: Optional[str] = None, user_id: str = Depends(get_current_user_id)):
    return await _delete_card_asset(user_id, kind="profile_photo", card_id=card_id)


@api_router.post("/card/cover-photo")
async def upload_card_cover_photo(file: UploadFile = File(...), card_id: Optional[str] = None, user_id: str = Depends(get_current_user_id)):
    return await _upload_card_asset(file, user_id, kind="cover", card_id=card_id)


@api_router.delete("/card/cover-photo")
async def delete_card_cover_photo(card_id: Optional[str] = None, user_id: str = Depends(get_current_user_id)):
    return await _delete_card_asset(user_id, kind="cover", card_id=card_id)


@api_router.delete("/card/{card_id}")
async def delete_card(card_id: str, user_id: str = Depends(get_current_user_id)):
    card = await db.cards.find_one({"id": card_id, "user_id": user_id}, {"_id": 0})
    if not card:
        raise HTTPException(404, "Tarjeta no encontrada")
    if card.get("is_primary"):
        raise HTTPException(400, "No puedes eliminar la tarjeta principal")
    await db.cards.delete_one({"id": card_id, "user_id": user_id})
    return {"ok": True}


async def _upload_card_asset(file: UploadFile, user_id: str, kind: str, card_id: Optional[str] = None):
    """Shared helper for logo, profile photo and cover photo uploads."""
    label_map = {"logo": "logo", "profile_photo": "profile_photo", "cover": "cover"}
    field_map = {"logo": "logo_photo_id", "profile_photo": "profile_photo_id", "cover": "cover_photo_id"}
    label = label_map[kind]
    field = field_map[kind]
    card = await _resolve_card(user_id, card_id)

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
    await db.cards.update_one(
        {"id": card["id"]},
        {"$set": {field: asset_id, "updated_at": _now_iso()}},
    )
    return {"ok": True, field: asset_id}


async def _delete_card_asset(user_id: str, kind: str, card_id: Optional[str] = None):
    field_map = {"logo": "logo_photo_id", "profile_photo": "profile_photo_id", "cover": "cover_photo_id"}
    field = field_map[kind]
    card = await _resolve_card(user_id, card_id)
    pid = card.get(field)
    if pid:
        await db.photos.update_one({"id": pid, "user_id": user_id}, {"$set": {"is_deleted": True}})
    await db.cards.update_one({"id": card["id"]}, {"$set": {field: None}})
    return {"ok": True}


async def _store_card_photo(user_id: str, data: bytes, content_type: str, kind: str, ext: str = "png") -> str:
    """Store image bytes to object storage + create a photo doc (without binding
    it to a card). Returns the new photo asset_id."""
    asset_id = _new_id()
    path = f"{app_name}/cards/{kind}/{user_id}/{asset_id}.{ext}"
    backend = storage_service.get_storage()
    result = backend.put(path, data, content_type)
    await db.photos.insert_one({
        "id": asset_id,
        "user_id": user_id,
        "client_id": None,
        "job_id": None,
        "label": {"logo": "logo", "profile_photo": "profile_photo", "cover": "cover"}.get(kind, kind),
        "storage_path": result.get("path", path),
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "is_logo": (kind == "logo"),
        "is_profile": (kind == "profile_photo"),
        "is_cover": (kind == "cover"),
        "created_at": _now_iso(),
    })
    return asset_id


def _photo_public_url(photo_id: str) -> str:
    return f"/api/public/card/photo/{photo_id}"


@api_router.post("/card/photo-enhance")
async def card_photo_enhance(
    file: UploadFile = File(...),
    kind: str = "profile_photo",
    card_id: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
):
    """Upload an image and return BOTH the original and an AI-enhanced version
    (Gemini Nano Banana) for a before/after preview. Nothing is bound to the
    card yet — the user picks one via /card/photo-choose."""
    if kind not in ("profile_photo", "cover"):
        raise HTTPException(400, "kind inválido")
    await _resolve_card(user_id, card_id)  # validate ownership
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, "Tipo de imagen no permitido (JPEG/PNG/WEBP)")
    data = await file.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(400, "Imagen demasiado grande (máx 8MB)")
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "png"

    enhance_kind = "profile" if kind == "profile_photo" else "cover"
    try:
        enhanced_bytes, enhanced_ct = await ai_service.enhance_image(data, kind=enhance_kind)
    except Exception as e:
        logger.exception("AI image enhance failed")
        raise HTTPException(502, f"No se pudo mejorar la imagen con IA: {e}")

    original_id = await _store_card_photo(user_id, data, content_type, kind, ext)
    enhanced_ext = "png" if "png" in enhanced_ct else ("webp" if "webp" in enhanced_ct else "jpg")
    enhanced_id = await _store_card_photo(user_id, enhanced_bytes, enhanced_ct, kind, enhanced_ext)

    return {
        "kind": kind,
        "original": {"photo_id": original_id, "url": _photo_public_url(original_id)},
        "enhanced": {"photo_id": enhanced_id, "url": _photo_public_url(enhanced_id)},
    }


class CardPhotoChooseIn(BaseModel):
    kind: str  # "profile_photo" | "cover"
    photo_id: str  # the chosen photo
    discard_photo_id: Optional[str] = None  # the rejected one to soft-delete


@api_router.post("/card/photo-choose")
async def card_photo_choose(payload: CardPhotoChooseIn, card_id: Optional[str] = None, user_id: str = Depends(get_current_user_id)):
    """Bind a previously-uploaded/enhanced photo to the card and discard the other."""
    field_map = {"profile_photo": "profile_photo_id", "cover": "cover_photo_id"}
    if payload.kind not in field_map:
        raise HTTPException(400, "kind inválido")
    field = field_map[payload.kind]
    card = await _resolve_card(user_id, card_id)
    chosen = await db.photos.find_one({"id": payload.photo_id, "user_id": user_id}, {"_id": 0})
    if not chosen:
        raise HTTPException(404, "Foto no encontrada")
    # Soft-delete the previous card photo (if different) and the rejected one.
    prev = card.get(field)
    for pid in (prev, payload.discard_photo_id):
        if pid and pid != payload.photo_id:
            await db.photos.update_one({"id": pid, "user_id": user_id}, {"$set": {"is_deleted": True}})
    await db.cards.update_one({"id": card["id"]}, {"$set": {field: payload.photo_id, "updated_at": _now_iso()}})
    return {"ok": True, field: payload.photo_id}



@api_router.get("/card/analytics")
async def card_analytics(card_id: Optional[str] = None, user_id: str = Depends(get_current_user_id)):
    card = await _resolve_card(user_id, card_id)
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

# ============================================================================
# SOCIAL POST STUDIO — branded image posts (AI copy + Pillow rendering)
# ============================================================================
import io as _io  # noqa: E402
from PIL import Image as _PILImage  # noqa: E402

SOCIAL_TEMPLATES = set(social_service.DESIGN_PHOTOS.keys())
SOCIAL_FORMATS = {"9x16", "1x1"}


async def _load_pil_image(photo_id: str, user_id: str):
    doc = await db.photos.find_one({"id": photo_id, "user_id": user_id}, {"_id": 0})
    if not doc:
        return None
    try:
        data, _ct = storage_service.get_storage().get(doc["storage_path"])
        return _PILImage.open(_io.BytesIO(data)).convert("RGB")
    except Exception:
        return None


def _valid_hex(value: str) -> str:
    """Return a normalized #RRGGBB hex if valid, else empty string."""
    v = (value or "").strip()
    if not v:
        return ""
    if not v.startswith("#"):
        v = "#" + v
    body = v[1:]
    if len(body) == 3:
        body = "".join(c * 2 for c in body)
    if len(body) != 6:
        return ""
    try:
        int(body, 16)
    except ValueError:
        return ""
    return "#" + body.lower()


async def _social_brand(user_id: str, language: str, brand_override: str = None, accent_override: str = None):
    card = await _ensure_card(user_id)
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    logo_bytes = None
    if card.get("logo_photo_id"):
        ld = await db.photos.find_one({"id": card["logo_photo_id"], "user_id": user_id}, {"_id": 0})
        if ld:
            try:
                logo_bytes, _ = storage_service.get_storage().get(ld["storage_path"])
            except Exception:
                logo_bytes = None
    return social_service.build_brand(
        card, user, logo_bytes, language=language,
        brand_override=brand_override, accent_override=accent_override,
    )


async def _render_social_images(template, formats, source_ids, copy, brand, user_id):
    pil_photos = []
    for pid in source_ids:
        img = await _load_pil_image(pid, user_id)
        if img is not None:
            pil_photos.append(img)
    images = []
    for fmt in formats:
        png = social_service.render_post(template, fmt, pil_photos, copy, brand)
        out_id = await _store_card_photo(user_id, png, "image/jpeg", "social_out", "jpg")
        images.append({"format": fmt, "photo_id": out_id, "url": _photo_public_url(out_id)})
    return images


@api_router.post("/social/enhance")
async def enhance_social_photo(file: UploadFile = File(...), user_id: str = Depends(get_current_user_id)):
    """Enhance an uploaded work/scene photo with AI (brighten, sharpen, pro look)
    so social posts look great even if the original photo is dark or low quality.
    Returns the enhanced image; the frontend shows a before/after and lets the
    user keep it or the original."""
    ct = (file.content_type or "").lower()
    if ct not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, "Tipo de imagen no permitido (JPEG/PNG/WEBP)")
    data = await file.read()
    if not data or len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(400, "Imagen demasiado grande (máx 8MB)")
    try:
        enhanced_bytes, enhanced_ct = await ai_service.enhance_image(data, kind="cover")
    except Exception as e:
        raise HTTPException(502, f"No se pudo mejorar la imagen con IA: {e}")
    ext = "png" if "png" in enhanced_ct else ("webp" if "webp" in enhanced_ct else "jpg")
    eid = await _store_card_photo(user_id, enhanced_bytes, enhanced_ct, "social_src", ext)
    return {"enhanced": {"photo_id": eid, "url": _photo_public_url(eid)}}


@api_router.post("/social/posts")
async def create_social_post(
    template: str = Form(...),
    brief: str = Form(""),
    language: str = Form("en"),
    formats: str = Form("9x16,1x1"),
    brand_color: str = Form(""),
    accent_color: str = Form(""),
    files: List[UploadFile] = File(default=[]),
    user_id: str = Depends(get_current_user_id),
):
    """Generate a branded social post: AI copy (ES brief -> chosen language) +
    rendered graphics in the requested formats, using the user's card branding."""
    if template not in SOCIAL_TEMPLATES:
        raise HTTPException(400, "Plantilla inválida")
    language = "es" if language == "es" else "en"
    fmts = [f.strip() for f in formats.split(",") if f.strip() in SOCIAL_FORMATS] or ["1x1"]
    brand_color = _valid_hex(brand_color)
    accent_color = _valid_hex(accent_color)

    # Store uploaded source photos
    source_ids = []
    skipped = 0
    for f in (files or []):
        ct = (f.content_type or "").lower()
        if ct not in ALLOWED_IMAGE_TYPES:
            skipped += 1
            continue
        data = await f.read()
        if not data or len(data) > MAX_IMAGE_BYTES:
            skipped += 1
            continue
        ext = f.filename.rsplit(".", 1)[-1].lower() if f.filename and "." in f.filename else "png"
        pid = await _store_card_photo(user_id, data, ct, "social_src", ext)
        source_ids.append(pid)

    needed = social_service.DESIGN_PHOTOS.get(template, 1)
    if len(source_ids) < needed:
        if skipped:
            raise HTTPException(400, "Una o más fotos no se pudieron usar (formato no soportado o más de 8MB). Sube JPG/PNG de menos de 8MB.")
        raise HTTPException(400, f"Este diseño necesita {needed} foto{'s' if needed > 1 else ''}")

    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    card = await _ensure_card(user_id)
    try:
        copy = await ai_service.generate_social_copy(
            brief, template=template, language=language,
            business_name=user.get("business_name", ""),
            business_type=card.get("business_type", ""),
            phone=card.get("contact_phone") or user.get("phone", ""),
        )
    except Exception as e:
        raise HTTPException(502, f"Error generando el texto con IA: {e}")

    brand = await _social_brand(user_id, language, brand_override=brand_color, accent_override=accent_color)
    images = await _render_social_images(template, fmts, source_ids, copy, brand, user_id)

    doc = {
        "id": _new_id(),
        "user_id": user_id,
        "template": template,
        "brief": brief,
        "language": language,
        "formats": fmts,
        "brand_color": brand_color or "",
        "accent_color": accent_color or "",
        "copy": copy,
        "source_photo_ids": source_ids,
        "images": images,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await db.social_posts.insert_one(doc)
    return _strip_id(doc)


class SocialCopyIn(BaseModel):
    headline: Optional[str] = None
    subheadline: Optional[str] = None
    cta: Optional[str] = None
    caption: Optional[str] = None
    hashtags: Optional[List[str]] = None


@api_router.post("/social/posts/{post_id}/rerender")
async def rerender_social_post(post_id: str, payload: SocialCopyIn, user_id: str = Depends(get_current_user_id)):
    """Re-render a post's graphics after the user edits the copy (reuses the
    already-uploaded source photos)."""
    post = await db.social_posts.find_one({"id": post_id, "user_id": user_id}, {"_id": 0})
    if not post:
        raise HTTPException(404, "Post no encontrado")
    copy = dict(post.get("copy") or {})
    for k in ("headline", "subheadline", "cta", "caption"):
        v = getattr(payload, k)
        if v is not None:
            copy[k] = v
    if payload.hashtags is not None:
        copy["hashtags"] = ["#" + h.lstrip("#") for h in payload.hashtags if h][:8]
    # soft-delete previous output images
    for img in post.get("images", []):
        await db.photos.update_one({"id": img["photo_id"], "user_id": user_id}, {"$set": {"is_deleted": True}})
    brand = await _social_brand(
        user_id, post.get("language", "en"),
        brand_override=post.get("brand_color") or None,
        accent_override=post.get("accent_color") or None,
    )
    images = await _render_social_images(post["template"], post.get("formats", ["1x1"]), post.get("source_photo_ids", []), copy, brand, user_id)
    await db.social_posts.update_one(
        {"id": post_id, "user_id": user_id},
        {"$set": {"copy": copy, "images": images, "updated_at": _now_iso()}},
    )
    post.update({"copy": copy, "images": images})
    return post


@api_router.get("/social/posts")
async def list_social_posts(user_id: str = Depends(get_current_user_id)):
    docs = await db.social_posts.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return docs


@api_router.delete("/social/posts/{post_id}")
async def delete_social_post(post_id: str, user_id: str = Depends(get_current_user_id)):
    post = await db.social_posts.find_one({"id": post_id, "user_id": user_id}, {"_id": 0})
    if not post:
        raise HTTPException(404, "Post no encontrado")
    for img in post.get("images", []):
        await db.photos.update_one({"id": img["photo_id"], "user_id": user_id}, {"$set": {"is_deleted": True}})
    await db.social_posts.delete_one({"id": post_id, "user_id": user_id})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Reels (vertical video) — Marketing Studio Phase 2
# ---------------------------------------------------------------------------
ALLOWED_AUDIO_TYPES = {"audio/mpeg", "audio/mp3", "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac", "audio/wav", "audio/x-wav", "audio/ogg"}
MAX_AUDIO_BYTES = 15 * 1024 * 1024
REEL_DURATION = 10.0
REEL_MAX_PHOTOS = 5


@api_router.get("/social/music")
async def list_reel_music():
    """Bundled royalty-free music tracks the user can pick for a reel."""
    return [
        {**t, "url": f"/api/social/music/{t['id']}"}
        for t in video_service.MUSIC_TRACKS
        if video_service.bundled_music_path(t["id"])
    ]


@api_router.post("/social/copy")
async def generate_reel_copy(
    brief: str = Form(""),
    language: str = Form("en"),
    template: str = Form("showcase"),
    user_id: str = Depends(get_current_user_id),
):
    """Generate (preview) the AI copy for a reel/post so the user can review &
    edit it BEFORE rendering the video. Returns headline/subheadline/cta/caption."""
    language = "es" if language == "es" else "en"
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    card = await _ensure_card(user_id)
    copy = await ai_service.generate_social_copy(
        brief, template=template if template in social_service.DESIGN_PHOTOS else "showcase",
        language=language,
        business_name=user.get("business_name", ""),
        business_type=card.get("business_type", ""),
        phone=card.get("contact_phone") or user.get("phone", ""),
    )
    return {
        "headline": copy.get("headline", ""),
        "subheadline": copy.get("subheadline", ""),
        "cta": copy.get("cta", ""),
        "caption": copy.get("caption", ""),
    }


@api_router.get("/social/music/{track_id}")
async def get_reel_music(track_id: str):
    path = video_service.bundled_music_path(track_id)
    if not path:
        raise HTTPException(404, "Pista no encontrada")
    with open(path, "rb") as f:
        data = f.read()
    return Response(content=data, media_type="audio/mpeg")


async def _process_reel(reel_id: str, user_id: str, source_ids: List[str], brief: str,
                        language: str, music_choice: str, music_audio_id: Optional[str],
                        brand_color: str, accent_color: str, template: str, motion: str,
                        transition: str, subtitles: bool, outro: bool, voiceover: bool,
                        duration: float, voice_mode: str = "short", cta_override: str = "",
                        voice_say_phone: bool = False, copy_override: Optional[dict] = None):
    """Background: AI copy -> branded overlays -> FFmpeg render -> store MP4."""
    import re as _re
    import math as _math
    import tempfile as _tf
    music_tmp = None
    voice_tmp = None

    def _clean(t):
        t = _re.sub(r"#\w+", "", t or "")
        t = _re.sub(r"https?://\S+", "", t)
        t = _re.sub(r"[\U0001F000-\U0001FAFF\u2600-\u27BF\u2190-\u21FF\u2B00-\u2BFF]", "", t)
        return _re.sub(r"\s+", " ", t).strip()

    def _strip_phone(t, phone):
        """Drop any sentence that contains a phone number, keeping clean sentences."""
        if not t:
            return t
        sentences = _re.split(r"(?<=[.!?])\s+", t)
        kept = [s for s in sentences if not _re.search(r"\+?\d[\d\-\(\)\s\.]{5,}\d", s)]
        out = " ".join(kept).strip()
        out = _re.sub(r"\+?\d[\d\-\(\)\s\.]{6,}\d", "", out)  # remove any lingering number
        return _re.sub(r"\s{2,}", " ", out).strip(" ,.-")

    try:
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        card = await _ensure_card(user_id)
        if copy_override and (copy_override.get("headline") or copy_override.get("caption")):
            copy = {
                "headline": copy_override.get("headline", ""),
                "subheadline": copy_override.get("subheadline", ""),
                "cta": copy_override.get("cta", ""),
                "caption": copy_override.get("caption", ""),
                "hashtags": [],
            }
        else:
            copy = await ai_service.generate_social_copy(
                brief, template=template if template in social_service.DESIGN_PHOTOS else "showcase",
                language=language,
                business_name=user.get("business_name", ""),
                business_type=card.get("business_type", ""),
                phone=card.get("contact_phone") or user.get("phone", ""),
            )
        if cta_override:
            copy["cta"] = cta_override
        brand = await _social_brand(user_id, language, brand_override=brand_color or None, accent_override=accent_color or None)

        images = []
        for pid in source_ids:
            im = await _load_pil_image(pid, user_id)
            if im is not None:
                images.append(im)
        if not images:
            raise RuntimeError("No se pudieron cargar las fotos")

        # Resolve music
        music_path = None
        if music_choice in {t["id"] for t in video_service.MUSIC_TRACKS}:
            music_path = video_service.bundled_music_path(music_choice)
        elif music_choice == "upload" and music_audio_id:
            adoc = await db.photos.find_one({"id": music_audio_id, "user_id": user_id}, {"_id": 0})
            if adoc:
                try:
                    abytes, _ = storage_service.get_storage().get(adoc["storage_path"])
                    fd, music_tmp = _tf.mkstemp(suffix=".audio")
                    with os.fdopen(fd, "wb") as f:
                        f.write(abytes)
                    music_path = music_tmp
                except Exception:
                    music_path = None

        # Optional AI voice-over (short = headline/sub/cta; full = whole post caption)
        voice_path = None
        voice_script = None
        eff_duration = duration
        if voiceover:
            if voice_mode == "full":
                voice_script = _clean(copy.get("caption") or "") or _clean(
                    ". ".join([p for p in [copy.get("headline"), copy.get("subheadline"), copy.get("cta")] if p]))
            else:
                voice_script = _clean(". ".join([p for p in [copy.get("headline"), copy.get("subheadline"), copy.get("cta")] if p]))
            if not voice_say_phone:
                phone = card.get("contact_phone") or user.get("phone", "")
                voice_script = _strip_phone(voice_script, phone)
                if not voice_script.strip():
                    voice_script = _strip_phone(_clean(". ".join(
                        [p for p in [copy.get("headline"), copy.get("subheadline")] if p])), phone)
                if not voice_script.strip():
                    voice_script = _clean(copy.get("headline") or "Contáctanos hoy")
            try:
                vbytes = await tts_service.generate_voiceover(voice_script, language=language)
                fd, voice_tmp = _tf.mkstemp(suffix=".mp3")
                with os.fdopen(fd, "wb") as f:
                    f.write(vbytes)
                voice_path = voice_tmp
                # Auto-extend the video so a long ("full") voice-over is never cut.
                if voice_mode == "full":
                    vdur = video_service.audio_duration(voice_path)
                    if vdur > 0:
                        eff_duration = min(60.0, max(duration, _math.ceil(vdur) + 1.0))
            except Exception:
                voice_path = None
                voice_script = None

        # Subtitles synced to the voice text when voice-over is on
        subtitle_text = voice_script if (voiceover and voice_script) else None

        mp4 = await asyncio.to_thread(
            video_service.render_reel_full, images, copy, brand,
            template=template, motion=motion, transition=transition, duration=eff_duration,
            subtitles=subtitles, outro=outro, music_path=music_path, voice_path=voice_path,
            subtitle_text=subtitle_text,
        )
        out_id = await _store_card_photo(user_id, mp4, "video/mp4", "social_reel", "mp4")
        await db.social_reels.update_one(
            {"id": reel_id, "user_id": user_id},
            {"$set": {"status": "ready", "copy": copy, "music": music_choice,
                      "final_duration": eff_duration,
                      "video": {"photo_id": out_id, "url": _photo_public_url(out_id)},
                      "updated_at": _now_iso()}},
        )
    except Exception as e:
        await db.social_reels.update_one(
            {"id": reel_id, "user_id": user_id},
            {"$set": {"status": "error", "error": str(e)[:300], "updated_at": _now_iso()}},
        )
    finally:
        for tmp in (music_tmp, voice_tmp):
            if tmp:
                try:
                    os.remove(tmp)
                except Exception:
                    pass


@api_router.post("/social/reels")
async def create_reel(
    background_tasks: BackgroundTasks,
    brief: str = Form(""),
    language: str = Form("en"),
    music: str = Form("none"),
    brand_color: str = Form(""),
    accent_color: str = Form(""),
    template: str = Form("showcase"),
    cta_override: str = Form(""),
    headline: str = Form(""),
    subheadline: str = Form(""),
    caption: str = Form(""),
    motion: str = Form("auto"),
    transition: str = Form("fade"),
    subtitles: bool = Form(False),
    outro: bool = Form(False),
    voiceover: bool = Form(False),
    voice_mode: str = Form("short"),
    voice_say_phone: bool = Form(False),
    duration: float = Form(10.0),
    files: List[UploadFile] = File(default=[]),
    music_file: Optional[UploadFile] = File(default=None),
    user_id: str = Depends(get_current_user_id),
):
    """Create a vertical reel from photos. Renders in the background;
    poll GET /social/reels/{id} for status ('processing' -> 'ready'/'error')."""
    language = "es" if language == "es" else "en"
    if template not in video_service.REEL_TEMPLATE_PHOTOS:
        template = "showcase"
    if motion not in video_service.MOTIONS:
        motion = "auto"
    if transition not in video_service.TRANSITIONS:
        transition = "fade"
    duration = float(duration) if duration in (10.0, 15.0, 20.0) else 10.0
    voice_mode = "full" if voice_mode == "full" else "short"
    cta_override = (cta_override or "").strip()[:40]
    copy_override = None
    if (headline or "").strip() or (caption or "").strip():
        copy_override = {
            "headline": (headline or "").strip()[:120],
            "subheadline": (subheadline or "").strip()[:200],
            "caption": (caption or "").strip()[:1500],
        }
    pmin, pmax = video_service.REEL_TEMPLATE_PHOTOS[template]

    source_ids = []
    skipped = 0
    for f in (files or [])[:pmax]:
        ct = (f.content_type or "").lower()
        if ct not in ALLOWED_IMAGE_TYPES:
            skipped += 1
            continue
        data = await f.read()
        if not data or len(data) > MAX_IMAGE_BYTES:
            skipped += 1
            continue
        ext = f.filename.rsplit(".", 1)[-1].lower() if f.filename and "." in f.filename else "png"
        pid = await _store_card_photo(user_id, data, ct, "social_src", ext)
        source_ids.append(pid)

    if len(source_ids) < pmin:
        if skipped:
            raise HTTPException(400, "Las fotos no se pudieron usar (formato no soportado o más de 8MB). Sube JPG/PNG.")
        raise HTTPException(400, f"Este diseño necesita {pmin} foto{'s' if pmin > 1 else ''}")

    brand_color = _valid_hex(brand_color)
    accent_color = _valid_hex(accent_color)

    # Optional uploaded music
    music_audio_id = None
    if music == "upload" and music_file is not None:
        act = (music_file.content_type or "").lower()
        if act not in ALLOWED_AUDIO_TYPES:
            raise HTTPException(400, "Audio no soportado. Sube MP3, M4A, WAV o AAC.")
        adata = await music_file.read()
        if not adata or len(adata) > MAX_AUDIO_BYTES:
            raise HTTPException(400, "El audio es muy grande (máx 15MB).")
        aext = music_file.filename.rsplit(".", 1)[-1].lower() if music_file.filename and "." in music_file.filename else "mp3"
        music_audio_id = await _store_card_photo(user_id, adata, act, "social_audio", aext)

    reel = {
        "id": _new_id(),
        "user_id": user_id,
        "status": "processing",
        "brief": brief,
        "language": language,
        "music": music,
        "music_audio_id": music_audio_id,
        "brand_color": brand_color or "",
        "accent_color": accent_color or "",
        "template": template,
        "cta_override": cta_override,
        "motion": motion,
        "transition": transition,
        "subtitles": subtitles,
        "outro": outro,
        "voiceover": voiceover,
        "voice_mode": voice_mode,
        "voice_say_phone": voice_say_phone,
        "duration": duration,
        "copy": None,
        "source_photo_ids": source_ids,
        "video": None,
        "error": None,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await db.social_reels.insert_one(reel)
    background_tasks.add_task(
        _process_reel, reel["id"], user_id, source_ids, brief, language,
        music, music_audio_id, brand_color, accent_color, template, motion,
        transition, subtitles, outro, voiceover, duration, voice_mode, cta_override, voice_say_phone,
        copy_override,
    )
    return _strip_id(reel)


@api_router.get("/social/reels")
async def list_reels(user_id: str = Depends(get_current_user_id)):
    docs = await db.social_reels.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return docs


@api_router.get("/social/reels/{reel_id}")
async def get_reel(reel_id: str, user_id: str = Depends(get_current_user_id)):
    doc = await db.social_reels.find_one({"id": reel_id, "user_id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Reel no encontrado")
    return doc


@api_router.delete("/social/reels/{reel_id}")
async def delete_reel(reel_id: str, user_id: str = Depends(get_current_user_id)):
    doc = await db.social_reels.find_one({"id": reel_id, "user_id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Reel no encontrado")
    vid = (doc.get("video") or {}).get("photo_id")
    if vid:
        await db.photos.update_one({"id": vid, "user_id": user_id}, {"$set": {"is_deleted": True}})
    await db.social_reels.delete_one({"id": reel_id, "user_id": user_id})
    return {"ok": True}





# Leads list (admin) — consolidated across ALL of the account's cards, each
# annotated with the source card label so the owner sees who brought the lead.
@api_router.get("/card/leads")
async def list_card_leads(user_id: str = Depends(get_current_user_id)):
    await _ensure_card(user_id)
    cards = await db.cards.find({"user_id": user_id}, {"_id": 0, "id": 1, "label": 1, "is_primary": 1}).to_list(50)
    label_by_id = {c["id"]: (c.get("label") or ("Tarjeta Principal" if c.get("is_primary") else "Tarjeta")) for c in cards}
    docs = await db.card_leads.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for d in docs:
        d["card_label"] = label_by_id.get(d.get("card_id"), "")
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
    # Merge shared company-level fields from the PRIMARY card so every card of an
    # account shows the same company info (website, services, social, logo...).
    if not card.get("is_primary"):
        primary = await db.cards.find_one({"user_id": card["user_id"], "is_primary": True}, {"_id": 0})
        if primary:
            for f in SHARED_CARD_FIELDS:
                card[f] = primary.get(f)
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
            # Per-card person overrides (salesperson name/phone/email), with fallback.
            "owner_name": card.get("person_name") or user.get("owner_name", ""),
            "phone": card.get("contact_phone") or user.get("phone", ""),
            "email": card.get("contact_email") or user.get("business_email") or user.get("email"),
            "address": user.get("business_address", ""),
            "google_review_url": user.get("google_review_url") or "",
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


def _public_base_from_request(request: Request) -> str:
    """Best-effort PUBLIC base URL (e.g. https://ezunitech.com).

    Prefers the page the user is on (Origin/Referer), then the proxy's
    X-Forwarded-Host (set by Apache mod_proxy in prod / ingress in preview),
    finally request.base_url. Avoids leaking the internal cluster host.
    """
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


def _esc(s: str) -> str:
    """Escape a string for safe insertion into HTML attributes/text."""
    return (
        (s or "")
        .replace("&", "&amp;")
        .replace('"', "&quot;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


@api_router.get("/public/card/{slug}/og", response_class=HTMLResponse)
async def public_card_og(slug: str, request: Request):
    """HTML page with per-card Open Graph / Twitter Card meta tags, served to
    social crawlers (WhatsApp, Facebook, etc.) via an Apache rewrite so shared
    card links show the PERSON + COMPANY, not generic UniTech branding.
    Humans that land here are redirected to the real card page."""
    card, user = await _public_card_by_slug(slug)
    base = _public_base_from_request(request)
    # Shared company fields come from the primary card.
    if not card.get("is_primary"):
        primary = await db.cards.find_one({"user_id": card["user_id"], "is_primary": True}, {"_id": 0})
        if primary:
            for f in SHARED_CARD_FIELDS:
                card[f] = primary.get(f)

    company = (user.get("business_name", "") or "").strip()
    person = (card.get("person_name") or user.get("owner_name", "") or "").strip()
    title = " · ".join([p for p in [person, company] if p]) or company or person or "Digital Card"

    desc = (card.get("tagline") or "").strip()
    if not desc:
        bits = []
        if card.get("business_type"):
            bits.append(card["business_type"])
        if card.get("service_area"):
            bits.append(card["service_area"])
        desc = " · ".join(bits) if bits else f"Contact {title}. Save my digital card and contact info."

    img_id = card.get("profile_photo_id") or card.get("cover_photo_id") or card.get("logo_photo_id")
    image = f"{base}/api/public/card/photo/{img_id}" if img_id else ""
    card_url = f"{base}/c/{card.get('slug')}"

    og_image_tags = (
        f'<meta property="og:image" content="{_esc(image)}"/>'
        f'<meta name="twitter:image" content="{_esc(image)}"/>'
        if image else ""
    )
    html = f"""<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>{_esc(title)}</title>
<meta name="description" content="{_esc(desc)}"/>
<meta property="og:type" content="profile"/>
<meta property="og:site_name" content="{_esc(company or title)}"/>
<meta property="og:title" content="{_esc(title)}"/>
<meta property="og:description" content="{_esc(desc)}"/>
<meta property="og:url" content="{_esc(card_url)}"/>
<meta name="twitter:card" content="{'summary_large_image' if image else 'summary'}"/>
<meta name="twitter:title" content="{_esc(title)}"/>
<meta name="twitter:description" content="{_esc(desc)}"/>
{og_image_tags}
<link rel="canonical" href="{_esc(card_url)}"/>
<meta http-equiv="refresh" content="0; url={_esc(card_url)}"/>
</head><body>
<p>Redirigiendo a la tarjeta de {_esc(title)}… <a href="{_esc(card_url)}">Abrir tarjeta</a></p>
<script>window.location.replace({card_url!r});</script>
</body></html>"""
    return HTMLResponse(content=html)


@api_router.get("/public/reviews/{slug}/og", response_class=HTMLResponse)
async def public_reviews_og(slug: str, request: Request):
    """Per-business Open Graph meta tags for a shared Google Reviews link (/r/<slug>),
    so it shows the BUSINESS name + info instead of generic UniTech branding.
    Humans are redirected to the real reviews page."""
    card, user = await _public_card_by_slug(slug)
    base = _public_base_from_request(request)
    if not card.get("is_primary"):
        primary = await db.cards.find_one({"user_id": card["user_id"], "is_primary": True}, {"_id": 0})
        if primary:
            for f in SHARED_CARD_FIELDS:
                card[f] = primary.get(f)

    company = (user.get("business_name", "") or "").strip() or "Our business"
    title = f"Review {company}"
    desc = (user.get("review_intro_text") or "").strip()
    if not desc:
        desc = f"How was your experience with {company}? Leave us a Google review ⭐ — it only takes 10 seconds."

    img_id = card.get("logo_photo_id") or card.get("cover_photo_id") or card.get("profile_photo_id")
    image = f"{base}/api/public/card/photo/{img_id}" if img_id else ""
    reviews_url = f"{base}/r/{card.get('slug')}"

    og_image_tags = (
        f'<meta property="og:image" content="{_esc(image)}"/>'
        f'<meta name="twitter:image" content="{_esc(image)}"/>'
        if image else ""
    )
    html = f"""<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>{_esc(title)}</title>
<meta name="description" content="{_esc(desc)}"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="{_esc(company)}"/>
<meta property="og:title" content="{_esc(title)}"/>
<meta property="og:description" content="{_esc(desc)}"/>
<meta property="og:url" content="{_esc(reviews_url)}"/>
<meta name="twitter:card" content="{'summary_large_image' if image else 'summary'}"/>
<meta name="twitter:title" content="{_esc(title)}"/>
<meta name="twitter:description" content="{_esc(desc)}"/>
{og_image_tags}
<link rel="canonical" href="{_esc(reviews_url)}"/>
<meta http-equiv="refresh" content="0; url={_esc(reviews_url)}"/>
</head><body>
<p>Redirecting… <a href="{_esc(reviews_url)}">Leave {_esc(company)} a review</a></p>
<script>window.location.replace({reviews_url!r});</script>
</body></html>"""
    return HTMLResponse(content=html)


@api_router.get("/public/card/{slug}/vcard")
async def public_vcard(slug: str, request: Request):
    card, user = await _public_card_by_slug(slug)
    bn = user.get("business_name", "")
    on = card.get("person_name") or user.get("owner_name", "")
    phone = card.get("contact_phone") or user.get("phone", "")
    email = card.get("contact_email") or user.get("business_email") or user.get("email", "")
    addr = user.get("business_address", "")
    web = card.get("website", "")
    # Public link to this digital card (real frontend domain via Referer/proxy).
    def _public_base() -> str:
        return _public_base_from_request(request)
    card_link = f"{_public_base().rstrip('/')}/c/{card.get('slug')}"
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
    # Labeled digital-card link (Apple Contacts shows the X-ABLabel; Android/Google
    # shows the URL). Listed first so it's the primary URL on the contact.
    lines.append(f"item1.URL:{card_link}")
    lines.append("item1.X-ABLabel:Tarjeta Digital")
    if web and web.rstrip("/") != card_link.rstrip("/"):
        lines.append(f"item2.URL:{web}")
        lines.append("item2.X-ABLabel:Website")
    note_parts = []
    if card.get("tagline"):
        note_parts.append(card["tagline"])
    note_parts.append(f"Tarjeta digital: {card_link}")
    lines.append("NOTE:" + " — ".join(note_parts))
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


def _stripe_collect_enabled_for(user_doc: Optional[dict]) -> bool:
    """Whether THIS invoice owner may collect card payments via the platform's
    Stripe account. Gated to the platform owner (super admin) ONLY, so no other
    tenant can route payments into the owner's Stripe. Optionally extendable via
    STRIPE_COLLECT_EMAILS (comma-separated allowlist)."""
    if not user_doc:
        return False
    if _is_super_admin(user_doc):
        return True
    allow = (os.environ.get("STRIPE_COLLECT_EMAILS", "") or "").lower()
    emails = {e.strip() for e in allow.split(",") if e.strip()}
    return (user_doc.get("email", "") or "").lower() in emails



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
        logger.exception("UniTech chat failed")
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
    signed_at_iso = _now_iso()
    await db.agreements.update_one(
        {"id": agreement_id},
        {"$set": {
            "status": "signed",
            "signed_at": signed_at_iso,
            "signed_method": payload.method,
            "signature_image": payload.signature_image if payload.method == "drawn" else None,
            "signer_name": signer_name,
            "updated_at": signed_at_iso,
        }},
    )
    # Auto-create a draft invoice from the linked quote (if any) — idempotent.
    invoice_id = None
    if a.get("quote_id"):
        existing_inv = await db.invoices.find_one(
            {"user_id": a["user_id"], "quote_id": a["quote_id"]}, {"_id": 0, "id": 1}
        )
        if existing_inv:
            invoice_id = existing_inv["id"]
        else:
            try:
                q = await db.quotes.find_one(
                    {"id": a["quote_id"], "user_id": a["user_id"]}, {"_id": 0}
                )
                if q:
                    count = await db.invoices.count_documents({"user_id": a["user_id"]})
                    # Pull deposit from quote first, fall back to agreement.
                    deposit_amount = float(
                        q.get("deposit_amount")
                        or a.get("deposit")
                        or 0
                    )
                    inv = {
                        "id": _new_id(),
                        "user_id": a["user_id"],
                        "number": f"INV-{2000 + count + 1}",
                        "client_id": q["client_id"],
                        "quote_id": q["id"],
                        "agreement_id": agreement_id,
                        "job_title": q.get("job_title", ""),
                        "line_items": q.get("line_items", []),
                        "subtotal": q.get("subtotal", 0),
                        "tax_rate": q.get("tax_rate", 0),
                        "tax_amount": q.get("tax_amount", 0),
                        "total": q.get("total", 0),
                        "amount_paid": 0,
                        "deposit_amount": deposit_amount,
                        "deposit_paid": False,
                        "due_date": None,
                        "notes": q.get("notes", ""),
                        # Snapshot the signed agreement clauses so the invoice
                        # carries the same terms (deposit, scope, payment
                        # terms, warranty, change-order, etc.) the client
                        # already accepted.
                        "agreement_terms": {
                            "title": a.get("title", ""),
                            "sections": a.get("sections", {}),
                            "deposit": float(a.get("deposit") or 0),
                            "signer_name": signer_name,
                            "signed_at": signed_at_iso,
                        },
                        "status": "draft",
                        "created_at": _now_iso(),
                        "updated_at": _now_iso(),
                    }
                    await db.invoices.insert_one(inv)
                    invoice_id = inv["id"]
            except Exception as e:
                logger.exception(f"Auto-invoice on agreement sign failed: {e}")
                # Don't break the signing on invoice failure
    # Create the Job (filled with the quote scope) so it can be scheduled now.
    try:
        if a.get("quote_id"):
            q_for_job = await db.quotes.find_one({"id": a["quote_id"], "user_id": a["user_id"]}, {"_id": 0})
            if q_for_job:
                await _ensure_job_for_signed_quote(q_for_job, invoice_id, a["user_id"], a)
    except Exception as e:
        logger.error(f"Auto-job on agreement sign failed: {e!r}")
    updated = await db.agreements.find_one({"id": agreement_id}, {"_id": 0})
    return {"ok": True, "agreement": updated, "invoice_id": invoice_id}



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

    # Compute checklist items from real data. Only ACCOUNT SETUP items —
    # actions like "create a client" or "make a quote" are work, not setup.
    card = await db.cards.find_one({"user_id": user_id}, {"_id": 0}) or {}
    business_filled = bool(
        (u.get("phone") or "").strip()
        and (u.get("business_address") or "").strip()
        and card.get("logo_photo_id")
    )
    card_created = bool(
        card.get("profile_photo_id")
        or card.get("cover_photo_id")
        or (card.get("services") or [])
        or (card.get("about_me") or "").strip()
        or (card.get("tagline") or "").strip()
        or (card.get("business_type") or "").strip()
    )

    # Activation item — creating the FIRST CLIENT is the gateway to everything
    # (you must have a client before you can make a quote or send an invoice).
    clients_count = await db.clients.count_documents({"user_id": user_id})

    items = [
        {"id": "business_info", "label": "Llena tu info de negocio (incluye logo)", "minutes": 2, "done": business_filled, "path": "/ajustes"},
        {"id": "smart_card", "label": "Crea y comparte tu Tarjeta Digital", "minutes": 3, "done": card_created, "path": "/tarjeta"},
        {"id": "first_client", "label": "Crea tu primer cliente", "minutes": 1, "done": clients_count > 0, "path": "/clientes"},
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
# TRIAL — status, +7-day extension (engaged users only), milestone notifs
# ============================================================================
TRIAL_EXTEND_DAYS = 7


def _ceil_days(diff_seconds: int) -> int:
    if diff_seconds <= 0:
        return 0
    return (diff_seconds + 86399) // 86400


async def _trial_state(user_id: str):
    """Compute the user's trial state + extension eligibility."""
    import time as _t
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(404, "User not found")
    now = int(_t.time())
    status = u.get("subscription_status")
    is_comp = bool(u.get("is_comp"))
    has_card = bool(u.get("stripe_customer_id"))
    ts = u.get("trial_ends_at")
    days_left = None if ts is None else _ceil_days(ts - now)
    is_trialing = (status == "trialing") and not is_comp and not has_card
    expired = bool(is_trialing and ts is not None and ts <= now)

    clients_count = await db.clients.count_documents({"user_id": user_id})
    invoices_count = await db.invoices.count_documents({"user_id": user_id})
    active = clients_count > 0 and invoices_count > 0
    trial_extended = bool(u.get("trial_extended"))

    near_end = days_left is not None and days_left <= 3
    within_grace = expired and ts is not None and (now - ts) <= 3 * 86400
    extend_eligible = bool(
        is_trialing and active and not trial_extended and (near_end or within_grace)
    )

    state = {
        "status": status,
        "is_comp": is_comp,
        "has_card": has_card,
        "trial_ends_at": ts,
        "days_left": days_left,
        "is_trialing": is_trialing,
        "expired": expired,
        "active": active,
        "clients_count": clients_count,
        "invoices_count": invoices_count,
        "trial_extended": trial_extended,
        "extend_eligible": extend_eligible,
    }
    return u, state


async def _sync_trial_notifications(u: dict, st: dict):
    """Create milestone notifications once each (idempotent via trial_notifs)."""
    if not st["is_trialing"]:
        return
    import time as _t
    now = int(_t.time())
    ts = st["trial_ends_at"]
    days_left = st["days_left"]
    sent = set(u.get("trial_notifs") or [])
    to_add: list[str] = []

    if days_left is not None and 3 < days_left <= 7 and "mid" not in sent:
        await _create_notification(
            user_id=u["id"], title="⏳ Vas a mitad de tu prueba",
            body=(
                f"Te quedan <strong>{days_left} días</strong> de tu prueba gratis. "
                "Crea tu primer quote y manda tu primer invoice para sacarle todo el jugo a UniTech."
            ),
            kind="info", action_url="/quotes", action_label="Crear quote",
        )
        to_add.append("mid")

    if days_left is not None and 0 < days_left <= 3 and "urgency" not in sent:
        unit = "día" if days_left == 1 else "días"
        await _create_notification(
            user_id=u["id"], title="🔔 Últimos días de tu prueba",
            body=(
                f"Solo te quedan <strong>{days_left} {unit}</strong>. "
                "Suscríbete para no perder tu trabajo ni la tarjeta NFC física."
            ),
            kind="warning", action_url="/precios", action_label="Ver planes",
        )
        to_add.append("urgency")

    if st["expired"] and "expired" not in sent:
        await _create_notification(
            user_id=u["id"], title="⌛ Tu prueba terminó",
            body=(
                "Tu prueba gratis terminó. Suscríbete para seguir creando quotes, "
                "invoices y conservar todo tu trabajo."
            ),
            kind="warning", action_url="/precios", action_label="Suscribirme",
        )
        to_add.append("expired")

    if ts is not None and (now - ts) >= 2 * 86400 and "post_expiry" not in sent:
        await _create_notification(
            user_id=u["id"], title="👋 Tu negocio te espera en UniTech",
            body=(
                "Tu información sigue guardada. Reactiva tu cuenta y sigue cobrando "
                "más rápido con quotes e invoices profesionales."
            ),
            kind="info", action_url="/precios", action_label="Reactivar",
        )
        to_add.append("post_expiry")

    if to_add:
        await db.users.update_one(
            {"id": u["id"]}, {"$addToSet": {"trial_notifs": {"$each": to_add}}}
        )


@api_router.get("/trial/status")
async def trial_status(user_id: str = Depends(get_current_user_id)):
    u, st = await _trial_state(user_id)
    try:
        await _sync_trial_notifications(u, st)
    except Exception as e:
        logger.error(f"trial notif sync failed: {e!r}")
    return st


@api_router.post("/trial/extend")
async def trial_extend(user_id: str = Depends(get_current_user_id)):
    """Grant a one-time +7-day extension to engaged trial users (has clients + invoices)."""
    import time as _t
    u, st = await _trial_state(user_id)
    if not st["extend_eligible"]:
        raise HTTPException(400, "No elegible para extensión")
    now = int(_t.time())
    base = st["trial_ends_at"] if (st["trial_ends_at"] and st["trial_ends_at"] > now) else now
    new_ends = base + TRIAL_EXTEND_DAYS * 86400
    await db.users.update_one(
        {"id": user_id}, {"$set": {"trial_ends_at": new_ends, "trial_extended": True}}
    )
    try:
        await _create_notification(
            user_id=user_id, title="🎁 ¡Te regalamos 7 días más!",
            body=(
                "Como estás usando UniTech activamente, extendimos tu prueba "
                "<strong>7 días gratis</strong>. Aprovéchalos para cerrar más trabajos."
            ),
            kind="success", action_url="/", action_label="Seguir",
        )
    except Exception as e:
        logger.error(f"extend notif failed: {e!r}")
    return {"ok": True, "trial_ends_at": new_ends, "days_left": _ceil_days(new_ends - now)}





# ============================================================================
# ADMIN — COMPLIMENTARY ACCOUNTS (free access for friends, testers, reviewers)
# ============================================================================
class CompInviteIn(BaseModel):
    email: Optional[str] = None  # Optional restriction
    duration_days: Optional[int] = None  # None = indefinite
    note: Optional[str] = ""


class CompGrantIn(BaseModel):
    duration_days: Optional[int] = None  # None = indefinite
    note: Optional[str] = ""


class AdminCreateUserIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    business_name: str
    owner_name: Optional[str] = ""
    phone: Optional[str] = ""
    grant_comp: bool = False
    comp_duration_days: Optional[int] = None
    comp_note: Optional[str] = ""


def _short_token() -> str:
    import secrets
    return secrets.token_urlsafe(16)


@api_router.post("/admin/comp-invites")
async def admin_create_comp_invite(
    payload: CompInviteIn,
    admin: dict = Depends(_require_super_admin),
):
    """Create a single-use invite link that grants comp access on signup."""
    import time as _time
    now_ts = int(_time.time())
    comp_expires = None
    if payload.duration_days:
        comp_expires = now_ts + payload.duration_days * 24 * 3600
    invite = {
        "id": _new_id(),
        "token": _short_token(),
        "email": (payload.email or "").lower() or None,
        "note": payload.note or "",
        "duration_days": payload.duration_days,
        "comp_expires_at": comp_expires,
        "status": "active",
        "created_by": admin["id"],
        "created_by_email": admin["email"],
        "created_at": _now_iso(),
        "used_by_user_id": None,
        "used_at": None,
    }
    await db.comp_invites.insert_one(invite)
    invite.pop("_id", None)
    return invite


@api_router.get("/admin/comp-invites")
async def admin_list_comp_invites(admin: dict = Depends(_require_super_admin)):
    items = await db.comp_invites.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return {"invites": items}


@api_router.delete("/admin/comp-invites/{invite_id}")
async def admin_revoke_comp_invite(
    invite_id: str,
    admin: dict = Depends(_require_super_admin),
):
    res = await db.comp_invites.update_one(
        {"id": invite_id, "status": "active"},
        {"$set": {"status": "revoked", "revoked_at": _now_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invitación no encontrada o ya usada")
    return {"ok": True}


@api_router.get("/admin/users")
async def admin_list_users(admin: dict = Depends(_require_super_admin)):
    """List all users with their subscription/comp state for admin management."""
    users = await db.users.find(
        {}, {"_id": 0, "password_hash": 0}
    ).sort("created_at", -1).to_list(1000)
    # Slim each user down for the table.
    out = []
    for u in users:
        out.append({
            "id": u.get("id"),
            "email": u.get("email"),
            "business_name": u.get("business_name", ""),
            "owner_name": u.get("owner_name", ""),
            "phone": u.get("phone", ""),
            "created_at": u.get("created_at"),
            "subscription_status": u.get("subscription_status"),
            "plan_type": u.get("plan_type"),
            "trial_ends_at": u.get("trial_ends_at"),
            "current_period_end": u.get("current_period_end"),
            "is_comp": bool(u.get("is_comp")),
            "comp_note": u.get("comp_note"),
            "comp_expires_at": u.get("comp_expires_at"),
            "card_limit": int(u.get("card_limit") or 1),
            "shipping_address": u.get("shipping_address"),
            "card_shipping_status": u.get("card_shipping_status"),
            "card_shipped_at": u.get("card_shipped_at"),
            "card_delivered_at": u.get("card_delivered_at"),
            "card_tracking_number": u.get("card_tracking_number"),
            "card_shipping_note": u.get("card_shipping_note"),
        })
    return {"users": out}


# ============================================================================
# ADMIN — BUSINESS METRICS DASHBOARD
# ============================================================================
@api_router.get("/admin/metrics")
async def admin_metrics(admin: dict = Depends(_require_super_admin)):
    """Aggregate metrics for the super-admin dashboard.

    Returns counts by subscription state, MRR estimate, and recent growth.
    """
    import time as _t
    now = int(_t.time())
    one_day = 86400

    users = await db.users.find(
        {}, {"_id": 0, "password_hash": 0}
    ).to_list(5000)

    # Pricing (dollars/month, normalised). Yearly plans → annual / 12.
    PLAN_MRR = {
        "pro_monthly": 49.0,
        "pro_yearly":  390.0 / 12.0,   # 32.5
        "founder":     290.0 / 12.0,   # 24.17 (one-time but tracked monthly-equivalent)
    }

    buckets = {
        "total": 0,
        "trialing": 0,
        "active": 0,
        "past_due": 0,
        "canceled": 0,
        "comp": 0,
        "no_subscription": 0,
        "new_last_7d": 0,
        "new_last_30d": 0,
    }
    mrr_cents = 0
    plan_breakdown: dict = {}
    recent_signups = []
    trial_expiring_soon = []  # trials ending within next 3 days

    for u in users:
        buckets["total"] += 1
        status = u.get("subscription_status") or "none"
        is_comp = bool(u.get("is_comp"))
        plan = u.get("plan_type") or "—"
        created = u.get("created_at")
        created_ts = None
        if isinstance(created, str):
            try:
                created_ts = int(datetime.fromisoformat(created.replace("Z", "+00:00")).timestamp())
            except Exception:
                created_ts = None
        elif isinstance(created, (int, float)):
            created_ts = int(created)

        # Recency
        if created_ts:
            age = now - created_ts
            if age <= 7 * one_day:
                buckets["new_last_7d"] += 1
            if age <= 30 * one_day:
                buckets["new_last_30d"] += 1

        # Bucket priority: comp > status
        if is_comp:
            buckets["comp"] += 1
        elif status == "trialing":
            buckets["trialing"] += 1
        elif status == "active":
            buckets["active"] += 1
            mrr_cents += int(PLAN_MRR.get(plan, 0) * 100)
        elif status == "past_due":
            buckets["past_due"] += 1
            mrr_cents += int(PLAN_MRR.get(plan, 0) * 100)
        elif status in ("canceled", "cancelled"):
            buckets["canceled"] += 1
        else:
            buckets["no_subscription"] += 1

        # Plan breakdown (paying only)
        if status in ("active", "past_due") and not is_comp:
            plan_breakdown[plan] = plan_breakdown.get(plan, 0) + 1

        # Recent signups (last 10, newest first)
        if created_ts:
            recent_signups.append({
                "id": u.get("id"),
                "email": u.get("email"),
                "business_name": u.get("business_name", ""),
                "created_at": u.get("created_at"),
                "subscription_status": status if not is_comp else "comp",
                "plan_type": plan,
            })

        # Trials expiring soon
        trial_end = u.get("trial_ends_at")
        if status == "trialing" and isinstance(trial_end, (int, float)):
            days_left = (int(trial_end) - now) / one_day
            if 0 < days_left <= 3:
                trial_expiring_soon.append({
                    "id": u.get("id"),
                    "email": u.get("email"),
                    "business_name": u.get("business_name", ""),
                    "trial_ends_at": int(trial_end),
                    "days_left": round(days_left, 1),
                })

    # Sort recent signups by created_at desc, take 10
    def _ts(s):
        c = s.get("created_at")
        if isinstance(c, str):
            try:
                return datetime.fromisoformat(c.replace("Z", "+00:00")).timestamp()
            except Exception:
                return 0
        if isinstance(c, (int, float)):
            return c
        return 0
    recent_signups.sort(key=_ts, reverse=True)
    trial_expiring_soon.sort(key=lambda x: x["trial_ends_at"])

    # Pending shipments count
    pending_shipments = await db.users.count_documents({
        "card_shipping_status": "pending",
    })

    return {
        "counts": buckets,
        "mrr_usd": round(mrr_cents / 100.0, 2),
        "arr_usd": round(mrr_cents / 100.0 * 12.0, 2),
        "paying_users": buckets["active"] + buckets["past_due"],
        "plan_breakdown": plan_breakdown,
        "recent_signups": recent_signups[:10],
        "trial_expiring_soon": trial_expiring_soon[:20],
        "pending_shipments": pending_shipments,
        "generated_at": now,
    }


# ============================================================================
# ADMIN — NFC CARD SHIPMENTS (Phase 2)
# ============================================================================
@api_router.get("/admin/shipments")
async def admin_list_shipments(
    status: Optional[str] = None,
    admin: dict = Depends(_require_super_admin),
):
    """List users that need (or have already received) their NFC card.

    A user becomes a shipment candidate when:
      - they have a `shipping_address` on file (collected via Stripe Checkout), OR
      - their `card_shipping_status` is set (pending/shipped/delivered).

    Optional `status` filter: pending | shipped | delivered | all
    """
    query: dict = {
        "$or": [
            {"shipping_address": {"$exists": True, "$ne": None}},
            {"card_shipping_status": {"$exists": True, "$ne": None}},
        ]
    }
    if status and status != "all":
        query = {"$and": [query, {"card_shipping_status": status}]}
    docs = await db.users.find(
        query, {"_id": 0, "password_hash": 0}
    ).sort("card_shipping_status", 1).to_list(2000)
    out = []
    for u in docs:
        out.append({
            "id": u.get("id"),
            "email": u.get("email"),
            "business_name": u.get("business_name", ""),
            "owner_name": u.get("owner_name", ""),
            "phone": u.get("phone", ""),
            "subscription_status": u.get("subscription_status"),
            "plan_type": u.get("plan_type"),
            "is_comp": bool(u.get("is_comp")),
            "shipping_address": u.get("shipping_address"),
            "card_shipping_status": u.get("card_shipping_status") or "pending",
            "card_shipped_at": u.get("card_shipped_at"),
            "card_delivered_at": u.get("card_delivered_at"),
            "card_tracking_number": u.get("card_tracking_number"),
            "card_shipping_note": u.get("card_shipping_note"),
            "created_at": u.get("created_at"),
        })
    # Sort: pending first, then shipped, then delivered.
    order = {"pending": 0, "shipped": 1, "delivered": 2}
    out.sort(key=lambda r: order.get(r.get("card_shipping_status") or "pending", 9))
    return {"shipments": out}


class ShipmentUpdateIn(BaseModel):
    status: str  # pending | shipped | delivered
    tracking_number: Optional[str] = None
    note: Optional[str] = None


@api_router.post("/admin/shipments/{user_id}")
async def admin_update_shipment(
    user_id: str,
    payload: ShipmentUpdateIn,
    admin: dict = Depends(_require_super_admin),
):
    """Update an NFC-card shipment status for a user."""
    if payload.status not in {"pending", "shipped", "delivered"}:
        raise HTTPException(status_code=400, detail="status inválido")
    u = await db.users.find_one({"id": user_id})
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    import time as _t
    now_ts = int(_t.time())
    update: dict = {"card_shipping_status": payload.status}
    if payload.tracking_number is not None:
        update["card_tracking_number"] = payload.tracking_number.strip() or None
    if payload.note is not None:
        update["card_shipping_note"] = payload.note.strip() or None
    if payload.status == "shipped" and not u.get("card_shipped_at"):
        update["card_shipped_at"] = now_ts
    if payload.status == "delivered" and not u.get("card_delivered_at"):
        update["card_delivered_at"] = now_ts
        # If we never recorded a ship date, fill it now too.
        if not u.get("card_shipped_at"):
            update["card_shipped_at"] = now_ts
    await db.users.update_one({"id": user_id}, {"$set": update})

    # Auto-create an in-app notification when status changes to a milestone.
    try:
        if payload.status == "shipped" and u.get("card_shipping_status") != "shipped":
            track = (payload.tracking_number or "").strip()
            track_text = f" Tu número de tracking: <strong>{track}</strong>." if track else ""
            await _create_notification(
                user_id=user_id,
                title="📦 ¡Tu tarjeta NFC fue enviada!",
                body=(
                    f"Ya enviamos tu tarjeta NFC física a la dirección que registraste.{track_text} "
                    "Te llegará en los próximos 5-10 días hábiles."
                ),
                kind="success",
                action_url="/tarjeta",
                action_label="Ver mi tarjeta",
            )
        elif payload.status == "delivered" and u.get("card_shipping_status") != "delivered":
            await _create_notification(
                user_id=user_id,
                title="🎉 Tu tarjeta NFC llegó",
                body=(
                    "Acerca un teléfono a la tarjeta y comparte tu Smart Card al instante. "
                    "Si tu cliente la escanea, recibes una reseña en Google automáticamente."
                ),
                kind="success",
                action_url="/tarjeta",
                action_label="Ver mi tarjeta",
            )
    except Exception as e:
        logger.error(f"Notification auto-create failed (non-fatal): {e!r}")

    return {"ok": True, "user_id": user_id, **update}


# ============================================================================
# IN-APP NOTIFICATIONS / MESSAGES
# ============================================================================
NOTIF_KINDS = {"info", "success", "warning", "announcement"}

SEGMENTS = {
    "all":                "Todos los usuarios",
    "user":               "Un usuario específico",
    "trial":              "Todos en trial",
    "trial_expiring_3d":  "Trials que vencen en ≤ 3 días",
    "active":             "Pagando activamente",
    "pro_monthly":        "Plan Pro Mensual",
    "pro_yearly":         "Plan Pro Anual",
    "founder":            "Plan Founder",
    "comp":               "Cuentas cortesía",
    "ship_pending":       "Envíos NFC pendientes",
    "ship_shipped":       "Envíos NFC enviados",
}


async def _resolve_segment(segment: str, user_id: Optional[str]) -> list[str]:
    """Translate a segment name into a list of user_ids to target."""
    import time as _t
    now = int(_t.time())
    q: dict = {}
    if segment == "user":
        return [user_id] if user_id else []
    if segment == "all":
        q = {}
    elif segment == "trial":
        q = {"subscription_status": "trialing", "is_comp": {"$ne": True}}
    elif segment == "trial_expiring_3d":
        q = {
            "subscription_status": "trialing",
            "is_comp": {"$ne": True},
            "trial_ends_at": {"$gt": now, "$lt": now + 3 * 86400},
        }
    elif segment == "active":
        q = {"subscription_status": "active"}
    elif segment in ("pro_monthly", "pro_yearly", "founder"):
        q = {"plan_type": segment, "is_comp": {"$ne": True}}
    elif segment == "comp":
        q = {"is_comp": True}
    elif segment == "ship_pending":
        q = {"card_shipping_status": "pending"}
    elif segment == "ship_shipped":
        q = {"card_shipping_status": "shipped"}
    else:
        return []
    cursor = db.users.find(q, {"_id": 0, "id": 1})
    return [u["id"] async for u in cursor]


async def _create_notification(
    *,
    user_id: Optional[str],
    title: str,
    body: str,
    kind: str = "info",
    action_url: Optional[str] = None,
    action_label: Optional[str] = None,
    created_by: Optional[str] = None,
    segment: str = "user",
) -> dict:
    """Insert a notification document. `user_id=None` means broadcast to all."""
    import time as _t
    if kind not in NOTIF_KINDS:
        kind = "info"
    doc = {
        "id": _new_id(),
        "user_id": user_id,           # None for broadcast
        "segment": segment,
        "title": title.strip(),
        "body": body.strip(),
        "kind": kind,
        "action_url": (action_url or "").strip() or None,
        "action_label": (action_label or "").strip() or None,
        "created_at": int(_t.time()),
        "created_by": created_by,
        "dismissed_by": [],
    }
    await db.notifications.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/notifications")
async def list_user_notifications(user_id: str = Depends(get_current_user_id)):
    """Active notifications for the logged-in user (targeted + broadcast that
    they haven't dismissed). Newest first."""
    uid = user_id
    cur = db.notifications.find(
        {
            "$or": [{"user_id": uid}, {"user_id": None}],
            "dismissed_by": {"$nin": [uid]},
        },
        {"_id": 0},
    ).sort("created_at", -1).limit(50)
    items = await cur.to_list(50)
    return {"notifications": items}


@api_router.post("/notifications/{notif_id}/dismiss")
async def dismiss_notification(notif_id: str, user_id: str = Depends(get_current_user_id)):
    res = await db.notifications.update_one(
        {"id": notif_id},
        {"$addToSet": {"dismissed_by": user_id}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    return {"ok": True}


class NotificationCreateIn(BaseModel):
    title: str
    body: str
    kind: str = "info"            # info | success | warning | announcement
    segment: str = "all"          # see SEGMENTS dict
    user_id: Optional[str] = None # required when segment="user"
    action_url: Optional[str] = ""
    action_label: Optional[str] = ""


@api_router.get("/admin/notifications")
async def admin_list_notifications(admin: dict = Depends(_require_super_admin)):
    """All notifications, newest first. Augment with recipient count + read
    count so admin can see how many people have seen each message."""
    docs = await db.notifications.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).limit(200).to_list(200)
    # Cache user lookups for performance
    users = {}
    if any(d.get("user_id") for d in docs):
        ids = [d["user_id"] for d in docs if d.get("user_id")]
        async for u in db.users.find(
            {"id": {"$in": ids}}, {"_id": 0, "id": 1, "email": 1, "business_name": 1}
        ):
            users[u["id"]] = u
    out = []
    for d in docs:
        d["recipient_email"] = (
            users.get(d.get("user_id"), {}).get("email") if d.get("user_id") else None
        )
        d["recipient_business"] = (
            users.get(d.get("user_id"), {}).get("business_name") if d.get("user_id") else None
        )
        d["dismissed_count"] = len(d.get("dismissed_by", []))
        out.append(d)
    return {
        "notifications": out,
        "segments": SEGMENTS,
    }


@api_router.post("/admin/notifications")
async def admin_create_notification(
    payload: NotificationCreateIn,
    admin: dict = Depends(_require_super_admin),
):
    """Create one or many notifications based on segment.

    - segment="user"  → single doc with that user_id
    - segment="all"   → single broadcast doc (user_id=None)
    - other segments  → one doc per matched user (so each user can dismiss
                        independently). For very large segments we may
                        choose later to use the broadcast doc with a
                        segment filter, but per-user is simpler/safer now.
    """
    title = payload.title.strip()
    body = payload.body.strip()
    if not title or not body:
        raise HTTPException(status_code=400, detail="Título y cuerpo son obligatorios")
    if payload.segment not in SEGMENTS:
        raise HTTPException(status_code=400, detail="Segmento inválido")
    if payload.kind not in NOTIF_KINDS:
        raise HTTPException(status_code=400, detail="Tipo inválido")

    if payload.segment == "user":
        if not payload.user_id:
            raise HTTPException(status_code=400, detail="user_id requerido para segmento 'user'")
        doc = await _create_notification(
            user_id=payload.user_id,
            title=title, body=body, kind=payload.kind,
            action_url=payload.action_url, action_label=payload.action_label,
            created_by=admin["id"], segment="user",
        )
        return {"created": 1, "notifications": [doc]}

    if payload.segment == "all":
        doc = await _create_notification(
            user_id=None,
            title=title, body=body, kind=payload.kind,
            action_url=payload.action_url, action_label=payload.action_label,
            created_by=admin["id"], segment="all",
        )
        return {"created": 1, "notifications": [doc], "estimated_reach": "broadcast"}

    # Segmented: create one notif per matched user so each user can dismiss
    user_ids = await _resolve_segment(payload.segment, None)
    if not user_ids:
        raise HTTPException(status_code=400, detail="El segmento no tiene usuarios")
    created = []
    for uid in user_ids:
        doc = await _create_notification(
            user_id=uid,
            title=title, body=body, kind=payload.kind,
            action_url=payload.action_url, action_label=payload.action_label,
            created_by=admin["id"], segment=payload.segment,
        )
        created.append(doc)
    return {"created": len(created), "notifications": created[:3]}


@api_router.delete("/admin/notifications/{notif_id}")
async def admin_delete_notification(
    notif_id: str,
    admin: dict = Depends(_require_super_admin),
):
    res = await db.notifications.delete_one({"id": notif_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    return {"ok": True}


@api_router.get("/admin/segments/preview")
async def admin_segment_preview(
    segment: str,
    admin: dict = Depends(_require_super_admin),
):
    """Return count + sample of users a segment will hit (for preview before
    sending a bulk message)."""
    if segment not in SEGMENTS:
        raise HTTPException(status_code=400, detail="Segmento inválido")
    if segment == "user":
        return {"count": 0, "sample": [], "label": SEGMENTS[segment]}
    if segment == "all":
        total = await db.users.count_documents({})
        return {"count": total, "sample": [], "label": SEGMENTS[segment]}
    uids = await _resolve_segment(segment, None)
    sample = []
    if uids:
        async for u in db.users.find(
            {"id": {"$in": uids[:5]}},
            {"_id": 0, "id": 1, "email": 1, "business_name": 1},
        ):
            sample.append(u)
    return {"count": len(uids), "sample": sample, "label": SEGMENTS[segment]}


@api_router.post("/admin/users/{user_id}/grant-comp")
async def admin_grant_comp(
    user_id: str,
    payload: CompGrantIn,
    admin: dict = Depends(_require_super_admin),
):
    u = await db.users.find_one({"id": user_id})
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    import time as _time
    comp_expires = None
    if payload.duration_days:
        comp_expires = int(_time.time()) + payload.duration_days * 24 * 3600
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "is_comp": True,
            "comp_note": payload.note or "",
            "comp_expires_at": comp_expires,
            "comp_granted_by": admin["id"],
            "comp_granted_at": _now_iso(),
            "plan_type": "comp",
            "subscription_status": "active",
        }},
    )
    return {"ok": True, "user_id": user_id, "comp_expires_at": comp_expires}


@api_router.post("/admin/users/{user_id}/revoke-comp")
async def admin_revoke_comp(
    user_id: str,
    admin: dict = Depends(_require_super_admin),
):
    u = await db.users.find_one({"id": user_id})
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    # If they have a real Stripe sub, fall back to that status; otherwise
    # restore trialing.
    new_status = "trialing"
    new_plan = None
    if u.get("stripe_subscription_id"):
        new_status = u.get("subscription_status") if u.get("subscription_status") not in (None, "active", "trialing") else "active"
        new_plan = u.get("plan_type") if u.get("plan_type") != "comp" else None
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "is_comp": False,
            "subscription_status": new_status,
            "plan_type": new_plan,
        }},
    )
    return {"ok": True}


class CardLimitIn(BaseModel):
    card_limit: int = Field(ge=1, le=50)


@api_router.post("/admin/users/{user_id}/card-limit")
async def admin_set_card_limit(
    user_id: str,
    payload: CardLimitIn,
    admin: dict = Depends(_require_super_admin),
):
    """Manually set how many digital cards an account may create (free override).
    Use this to grant extra cards to a paying customer without changing Stripe."""
    u = await db.users.find_one({"id": user_id})
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"card_limit": int(payload.card_limit)}},
    )
    return {"ok": True, "user_id": user_id, "card_limit": int(payload.card_limit)}


@api_router.post("/admin/users/{user_id}/card-seats")
async def admin_set_card_seats(
    user_id: str,
    payload: CardLimitIn,
    admin: dict = Depends(_require_super_admin),
):
    """Set the TOTAL paid cards on a subscriber's Stripe plan. Stripe prorates
    the difference onto the next invoice (the customer pays +$15/mo per extra
    card from the next billing cycle)."""
    u = await db.users.find_one({"id": user_id})
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if not u.get("stripe_subscription_id"):
        raise HTTPException(status_code=400, detail="Este usuario no tiene suscripción de Stripe. Usa 'card-limit' para un override gratis.")
    try:
        result = await payments_service.set_subscription_card_seats(db, u, int(payload.card_limit))
    except Exception as e:
        logger.exception("Stripe card-seats update failed")
        raise HTTPException(status_code=500, detail=f"Error actualizando Stripe: {e}")
    return result


@api_router.post("/admin/users")
async def admin_create_user(
    payload: AdminCreateUserIn,
    admin: dict = Depends(_require_super_admin),
):
    """Manually create a user account from the admin panel.

    Optionally grants comp (free) access immediately so you can hand the
    account to a friend / tester pre-activated.
    """
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email ya registrado")
    import time as _time
    now_ts = int(_time.time())
    trial_ends_at = now_ts + 14 * 24 * 3600
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
        "plan_type": None,
        "subscription_status": "trialing",
        "trial_ends_at": trial_ends_at,
        "current_period_end": None,
        "stripe_customer_id": None,
        "stripe_subscription_id": None,
        "shipping_address": None,
        "card_shipping_status": None,
        "is_comp": False,
        "comp_note": None,
        "comp_expires_at": None,
        "comp_granted_by": None,
        "created_by_admin": admin["id"],
    }
    if payload.grant_comp:
        comp_expires = None
        if payload.comp_duration_days:
            comp_expires = now_ts + payload.comp_duration_days * 24 * 3600
        user.update({
            "is_comp": True,
            "comp_note": payload.comp_note or "Creada por admin",
            "comp_expires_at": comp_expires,
            "comp_granted_by": admin["id"],
            "comp_granted_at": _now_iso(),
            "plan_type": "comp",
            "subscription_status": "active",
        })
    await db.users.insert_one(user)
    return {"ok": True, "user_id": user["id"], "is_comp": user["is_comp"]}


@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(
    user_id: str,
    admin: dict = Depends(_require_super_admin),
):
    """Permanently delete a user account.

    Cannot delete yourself. Cascades to delete their cards, clients, quotes,
    invoices, agreements, jobs, calendar events, and onboarding state so the
    DB doesn't accumulate orphans.
    """
    if user_id == admin["id"]:
        raise HTTPException(
            status_code=400,
            detail="No puedes eliminar tu propia cuenta de admin",
        )
    u = await db.users.find_one({"id": user_id})
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    # Cascade delete owned records.
    collections = [
        "cards", "clients", "quotes", "invoices", "agreements",
        "jobs", "calendar_events", "messages", "scope_drafts",
        "onboarding_state", "payment_transactions",
    ]
    for c in collections:
        try:
            await db[c].delete_many({"user_id": user_id})
        except Exception as e:
            logger.warning(f"Cascade delete on {c} failed: {e}")
    await db.users.delete_one({"id": user_id})
    return {"ok": True, "deleted_user_email": u.get("email")}


@api_router.post("/admin/users/{user_id}/impersonate")
async def admin_impersonate_user(
    user_id: str,
    admin: dict = Depends(_require_super_admin),
):
    """Generate a JWT for another user so the super-admin can log in as them
    to help with onboarding, NFC card setup, or troubleshooting.

    The returned token works exactly like a normal login token. The frontend
    is responsible for storing the admin's own token separately so the user
    can return to their own session.
    """
    if user_id == admin["id"]:
        raise HTTPException(
            status_code=400, detail="Ya estás logueado como ti mismo"
        )
    u = await db.users.find_one({"id": user_id})
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    token = create_token(u["id"])
    logger.info(
        f"[IMPERSONATE] admin={admin.get('email')} -> user={u.get('email')} ({user_id})"
    )
    return {
        "token": token,
        "user": await _user_doc(u["id"]),
    }


# ============================================================================
# PAYMENTS / STRIPE SUBSCRIPTIONS
# ============================================================================
@api_router.get("/payments/plans")
async def payments_plans():
    """Public — list of subscription plans for the pricing page."""
    return {"plans": payments_service.list_plans()}


@api_router.post("/payments/checkout")
async def payments_checkout(
    payload: CheckoutCreateIn,
    user_id: str = Depends(get_current_user_id),
):
    """Create a Stripe Checkout Session for a subscription (14-day trial)."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if not payments_service.get_plan(payload.plan_id):
        raise HTTPException(status_code=400, detail="Plan inválido")
    # Build dynamic success / cancel URLs from frontend origin (per playbook).
    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/pago/exito?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/precios?cancelled=1"
    try:
        result = await payments_service.create_checkout_session(
            db, user, payload.plan_id, success_url, cancel_url,
            num_cards=max(1, int(payload.num_cards or 1)),
        )
    except Exception as e:
        logger.exception("Stripe checkout creation failed")
        raise HTTPException(status_code=500, detail=f"Error al crear sesión de pago: {e}")
    return result


@api_router.get("/payments/status/{session_id}")
async def payments_status(session_id: str, user_id: str = Depends(get_current_user_id)):
    """Poll the current status of a Checkout Session (used after redirect)."""
    try:
        return await payments_service.get_checkout_status(db, session_id)
    except Exception as e:
        logger.exception("Stripe status fetch failed")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/payments/subscription")
async def payments_subscription(user_id: str = Depends(get_current_user_id)):
    """Return current user's subscription summary."""
    u = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "password_hash": 0},
    )
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {
        "plan_type": u.get("plan_type"),
        "subscription_status": u.get("subscription_status"),
        "trial_ends_at": u.get("trial_ends_at"),
        "current_period_end": u.get("current_period_end"),
        "cancel_at_period_end": u.get("cancel_at_period_end", False),
        "stripe_customer_id": u.get("stripe_customer_id"),
        "shipping_address": u.get("shipping_address"),
        "card_shipping_status": u.get("card_shipping_status"),
        "is_comp": bool(u.get("is_comp")),
        "comp_note": u.get("comp_note"),
        "comp_expires_at": u.get("comp_expires_at"),
        "smart_card_unlocked": payments_service.has_paid_subscription(u),
        "subscription_active": payments_service.subscription_is_active(u),
    }


@api_router.post("/payments/portal")
async def payments_portal(
    payload: dict,
    user_id: str = Depends(get_current_user_id),
):
    """Create a Stripe Customer Portal session for self-service management."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if not user.get("stripe_customer_id"):
        raise HTTPException(
            status_code=400,
            detail="Aún no tienes una suscripción. Suscríbete primero.",
        )
    return_url = (payload.get("origin_url") or "").rstrip("/") + "/ajustes"
    try:
        return await payments_service.create_portal_session(db, user, return_url)
    except payments_service.stripe.error.InvalidRequestError as e:
        # Stale stripe_customer_id (deleted in Stripe). Clear it and inform user.
        if getattr(e, "code", None) == "resource_missing":
            await db.users.update_one(
                {"id": user_id},
                {"$set": {"stripe_customer_id": None}},
            )
            raise HTTPException(
                status_code=400,
                detail="Aún no tienes una suscripción. Suscríbete primero.",
            )
        logger.exception("Stripe portal session creation failed (InvalidRequest)")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Stripe portal session creation failed")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Stripe webhook receiver. Updates user subscription state on events."""
    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature", "")
    return await payments_service.handle_webhook_event(db, payload, sig_header)


# ============================================================================
# HEALTH
# ============================================================================
@api_router.get("/")
async def root():
    return {"app": "UniTech", "ok": True}


# ============================================================================
# APP SETUP
# ============================================================================
app.include_router(api_router)

# Optional Google Business Profile integration. Isolated so a missing optional
# dependency (e.g. httpx) or any import error here can NEVER take down the core
# app (login, payments, etc.). If it fails, we log and continue without it.
try:
    from gbp_routes import router as gbp_router  # noqa: E402

    app.include_router(gbp_router)
except Exception as _gbp_err:  # pragma: no cover
    logger.error("Google Business Profile routes disabled (import failed): %s", _gbp_err)

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
            "SUPER_ADMIN_BUSINESS_NAME", "UniTech HQ",
        )
        await _seed_admin_from_env(
            "ADMIN_EMAIL", "ADMIN_PASSWORD",
            "ADMIN_BUSINESS_NAME", "UniTech Admin",
        )
    except Exception as e:
        logger.error(f"Admin seed at startup failed: {e}")
    # Backfill: existing users (pre-Stripe rollout) get a fresh 14-day local
    # trial so they can keep exploring before being asked to subscribe.
    try:
        import time as _t
        trial_ts = int(_t.time()) + 14 * 24 * 3600
        await db.users.update_many(
            {"subscription_status": {"$in": [None, ""]}},
            {"$set": {
                "subscription_status": "trialing",
                "trial_ends_at": trial_ts,
            }},
        )
    except Exception as e:
        logger.error(f"Trial backfill failed: {e}")


@app.on_event("shutdown")
async def shutdown():
    client.close()
