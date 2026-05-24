"""ServicioFlow AI - FastAPI backend.

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

app = FastAPI(title="ServicioFlow AI")
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
    scheduled_date: Optional[str] = None
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
    services: List[CardService] = []
    hours: Optional[str] = ""  # e.g., "Mon-Fri 8am-6pm"
    whatsapp: Optional[str] = ""  # E.164 phone for WhatsApp link
    website: Optional[str] = ""
    facebook: Optional[str] = ""
    instagram: Optional[str] = ""
    google_review_url: Optional[str] = ""
    enabled: bool = True
    languages: List[str] = ["en", "es"]


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
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
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
    """Upload business logo. Stored under cards/logos/{user_id}/{uuid}.{ext}."""
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, "Tipo de imagen no permitido (JPEG/PNG/WEBP)")
    data = await file.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(400, "Imagen demasiado grande (máx 8MB)")
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "png"
    logo_id = _new_id()
    path = f"{app_name}/cards/logos/{user_id}/{logo_id}.{ext}"
    try:
        backend = storage_service.get_storage()
        result = backend.put(path, data, content_type)
    except Exception as e:
        raise HTTPException(500, f"Storage error: {e}")
    # Track as a photo record so the public photo endpoint can serve it
    photo_doc = {
        "id": logo_id,
        "user_id": user_id,
        "client_id": None,
        "job_id": None,
        "label": "logo",
        "storage_path": result.get("path", path),
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "is_logo": True,
        "created_at": _now_iso(),
    }
    await db.photos.insert_one(photo_doc)
    # Update card with logo reference
    await _ensure_card(user_id)
    await db.cards.update_one(
        {"user_id": user_id},
        {"$set": {"logo_photo_id": logo_id, "updated_at": _now_iso()}},
    )
    return {"ok": True, "logo_photo_id": logo_id}


@api_router.delete("/card/logo")
async def delete_card_logo(user_id: str = Depends(get_current_user_id)):
    card = await _ensure_card(user_id)
    pid = card.get("logo_photo_id")
    if pid:
        await db.photos.update_one({"id": pid, "user_id": user_id}, {"$set": {"is_deleted": True}})
    await db.cards.update_one({"user_id": user_id}, {"$set": {"logo_photo_id": None}})
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
        {"user_id": card["user_id"], "is_deleted": False, "is_logo": {"$ne": True}, "label": {"$ne": "logo"}},
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
        lead = {
            "id": _new_id(),
            "card_id": card["id"],
            "user_id": card["user_id"],
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
        await db.card_leads.insert_one(lead)
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
# HEALTH
# ============================================================================
@api_router.get("/")
async def root():
    return {"app": "ServicioFlow AI", "ok": True}


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


@app.on_event("startup")
async def startup():
    try:
        storage_service.init_storage_at_startup()
    except Exception as e:
        logger.error(f"Storage init at startup failed: {e}")


@app.on_event("shutdown")
async def shutdown():
    client.close()
