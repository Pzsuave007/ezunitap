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
