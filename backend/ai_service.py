"""AI service: wraps LLM calls for quotes, messages, scope of work, photo analysis.

Uses Emergent LLM Universal Key with OpenAI GPT-5.2 (text + vision).
"""
from __future__ import annotations

import json
import logging
import os
import re
import uuid
import base64
from typing import Optional

from emergentintegrations.llm.chat import ImageContent, LlmChat, UserMessage

logger = logging.getLogger(__name__)

LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
# When self-hosting outside the Emergent platform, the Emergent Universal Key is
# blocked. If the owner provides their OWN OpenAI key, we use it directly via the
# official OpenAI SDK for all text generation (chat, quotes, messages, etc.).
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
MODEL_PROVIDER = "openai"
MODEL_NAME = os.environ.get("OPENAI_MODEL", "gpt-5.2")
# Model used when the OWNER supplies their OWN OpenAI key (self-hosted / production).
# GPT-5 aliases (e.g. gpt-5.2) require OpenAI org verification and many keys can't
# call them, so we default to gpt-4o which every valid OpenAI key can access.
# Override with OPENAI_OWN_MODEL if the account has GPT-5 access.
OPENAI_OWN_MODEL = os.environ.get("OPENAI_OWN_MODEL", "gpt-4o")
# Cheaper "mini" model used ONLY for the conversational chatbot (lead qualification
# on Smart Cards / website widget). Quotes, marketing and vision keep MODEL_NAME.
CHAT_MODEL = os.environ.get("OPENAI_CHAT_MODEL", "gpt-4o-mini")


class _OpenAIChat:
    """Drop-in replacement for emergentintegrations LlmChat that talks to OpenAI
    directly using the owner's own API key. Keeps an internal message history so
    multi-turn flows (replaying prior turns) work the same way."""

    def __init__(self, system_message: str, model: Optional[str] = None):
        from openai import AsyncOpenAI
        self._client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        self._model = model or OPENAI_OWN_MODEL
        self._messages = [{"role": "system", "content": system_message}]

    def with_model(self, provider, model):  # noqa: ARG002 - kept for interface parity
        return self

    def with_params(self, **_kwargs):
        return self

    async def send_message(self, message) -> str:
        content = []
        if getattr(message, "text", None):
            content.append({"type": "text", "text": message.text})
        for f in getattr(message, "file_contents", None) or []:
            b64 = getattr(f, "file_content_base64", None)
            if b64:
                try:
                    mime = f.get_mime_type()
                except Exception:
                    mime = "image/png"
                content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime};base64,{b64}"},
                })
        self._messages.append({"role": "user", "content": content or (message.text or "")})
        resp = await self._client.chat.completions.create(model=self._model, messages=self._messages)
        reply = (resp.choices[0].message.content or "").strip()
        self._messages.append({"role": "assistant", "content": reply})
        return reply

# Gemini "Nano Banana" image-editing model (image-to-image enhancement).
IMAGE_MODEL = "gemini-3.1-flash-image-preview"

# OpenAI image model (used when the owner provides their own OPENAI_API_KEY, so
# images run on their account instead of Emergent's Gemini key). Quality default
# "medium" balances cost vs quality (override with OPENAI_IMAGE_QUALITY).
OPENAI_IMAGE_MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1")
OPENAI_IMAGE_QUALITY = os.environ.get("OPENAI_IMAGE_QUALITY", "medium")


def _openai_image_size(aspect: str) -> str:
    """Map our aspect hints to gpt-image-1 supported sizes."""
    a = (aspect or "1x1").lower()
    if a in ("9x16", "4x5", "portrait"):
        return "1024x1536"
    if a in ("16x9", "landscape"):
        return "1536x1024"
    return "1024x1024"


async def _openai_generate_image(prompt: str, size: str = "1024x1024") -> tuple[bytes, str]:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    resp = await client.images.generate(
        model=OPENAI_IMAGE_MODEL, prompt=prompt, size=size,
        quality=OPENAI_IMAGE_QUALITY, n=1,
    )
    return base64.b64decode(resp.data[0].b64_json), "image/png"


async def _openai_edit_image(image_bytes: bytes, prompt: str, size: str = "1024x1024") -> tuple[bytes, str]:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    resp = await client.images.edit(
        model=OPENAI_IMAGE_MODEL, image=("photo.png", image_bytes, "image/png"),
        prompt=prompt, size=size, quality=OPENAI_IMAGE_QUALITY, n=1,
    )
    return base64.b64decode(resp.data[0].b64_json), "image/png"



_PROFILE_ENHANCE_PROMPT = (
    "Enhance this portrait photo so it looks like a clean, professional business "
    "headshot. Improve the lighting, color balance, white balance and sharpness; "
    "reduce noise; and gently clean up and soften the background so the person "
    "stands out. CRITICAL: keep the person's face, facial features, skin tone, "
    "hair, glasses, clothing and expression EXACTLY the same — do NOT change their "
    "identity, age, weight or appearance, and do not beautify or reshape the face. "
    "Return a natural, realistic, well-lit version of the SAME person and photo."
)

_COVER_ENHANCE_PROMPT = (
    "Enhance this photo so it works as a crisp, professional background/cover image "
    "for a contractor's digital business card. Improve brightness, contrast, color "
    "vibrancy and sharpness, fix exposure, and make it look clean and high quality. "
    "Keep the SAME scene, subject and composition — do not add, remove or invent "
    "objects, text or watermarks. Return a realistic, professional-looking version "
    "of the same photo."
)


async def enhance_image(image_bytes: bytes, kind: str = "profile") -> tuple[bytes, str]:
    """Enhance an uploaded image with Gemini Nano Banana (image-to-image).

    `kind` = "profile" (subtle headshot cleanup, face preserved) or "cover"
    (work/background photo enhancement). Returns (enhanced_bytes, mime_type).

    Nano Banana occasionally replies with text only (no image); we retry a
    couple of times and force an image-only instruction.
    """
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    base_prompt = _PROFILE_ENHANCE_PROMPT if kind == "profile" else _COVER_ENHANCE_PROMPT
    prompt = base_prompt + " Output ONLY the edited image, no text."
    last_err = "La IA no devolvió una imagen mejorada"
    if OPENAI_API_KEY:
        for attempt in range(2):
            try:
                return await _openai_edit_image(image_bytes, prompt)
            except Exception as e:
                last_err = str(e)
                logger.warning("enhance_image (openai) attempt %s/2 failed: %s", attempt + 1, e)
        raise RuntimeError(last_err)
    for attempt in range(3):
        try:
            chat = LlmChat(
                api_key=LLM_KEY,
                session_id=str(uuid.uuid4()),
                system_message="You are a professional photo retoucher. You always return an edited image.",
            ).with_model("gemini", IMAGE_MODEL).with_params(modalities=["image", "text"])
            msg = UserMessage(text=prompt, file_contents=[ImageContent(b64)])
            _text, images = await chat.send_message_multimodal_response(msg)
            if images:
                img = images[0]
                out = base64.b64decode(img["data"])
                return out, img.get("mime_type", "image/png")
            logger.warning("enhance_image: no image returned (attempt %s/3)", attempt + 1)
        except Exception as e:  # transient provider errors → retry
            last_err = str(e)
            logger.warning("enhance_image attempt %s/3 failed: %s", attempt + 1, e)
    raise RuntimeError(last_err)


def _new_chat(system_message: str, model: Optional[str] = None) -> LlmChat:
    if OPENAI_API_KEY:
        return _OpenAIChat(system_message, model)
    return LlmChat(
        api_key=LLM_KEY,
        session_id=str(uuid.uuid4()),
        system_message=system_message,
    ).with_model(MODEL_PROVIDER, model or MODEL_NAME)


def _extract_json(text: str) -> dict:
    """Best-effort JSON extraction from an LLM response."""
    if not text:
        return {}
    # Try direct parse
    try:
        return json.loads(text)
    except Exception:
        pass
    # Try fenced code block
    fence = re.search(r"```(?:json)?\s*(.+?)\s*```", text, re.DOTALL)
    if fence:
        try:
            return json.loads(fence.group(1))
        except Exception:
            pass
    # Try first {...}
    brace = re.search(r"\{.*\}", text, re.DOTALL)
    if brace:
        try:
            return json.loads(brace.group(0))
        except Exception:
            pass
    return {}


QUOTE_SYSTEM = """You are an expert assistant for U.S. construction/service contractors.
You receive a brief description in Spanish from a Latino business owner and must produce
a PROFESSIONAL, customer-ready quote in ENGLISH (the customer reads English).

Output ONLY valid JSON with this exact schema (no markdown, no commentary):
{
  "job_title": "short professional title",
  "description": "1-2 sentence professional description of the project",
  "scope_of_work": ["bullet 1", "bullet 2", "..."],
  "line_items": [
    {"description": "item or service", "quantity": 1, "unit": "ea|sqft|lf|hr", "unit_price": 0.0, "amount": 0.0}
  ],
  "materials_estimate": 0.0,
  "labor_estimate": 0.0,
  "subtotal": 0.0,
  "tax_rate": 0.0,
  "tax_amount": 0.0,
  "total": 0.0,
  "deposit_amount": 0.0,
  "payment_terms": "e.g., 50% deposit, 50% on completion",
  "notes": "professional notes, warranty mentions, exclusions"
}

Rules:
- All client-facing strings MUST be in English.
- Use realistic ballpark U.S. residential pricing.
- Ensure totals are arithmetically consistent: the sum of line_items amounts MUST equal
  subtotal; subtotal + tax_amount MUST equal total.
- Return ONLY the JSON, nothing else.

BUILD A DETAILED, IMPRESSIVE QUOTE — NEVER a single lump-sum line:
- ALWAYS break the job into MULTIPLE itemized line_items (aim for 5-9) that a customer would
  expect to see for this trade: demolition/prep, materials (grouped by category), labor,
  fixtures/equipment, permits, haul-away/disposal, and final cleanup as relevant.
- Even when the user gives only a vague description OR a single lump-sum price, you MUST
  decompose it into realistic, professional sub-line-items. If the user gave a target total
  or ballpark price, make the sub-items ADD UP to that amount (distribute it realistically
  across the items). NEVER output a single line whose amount equals the total.
- Always write 5-8 clear, benefit-driven scope_of_work bullets, and professional notes
  (workmanship warranty, what's excluded). Fill materials_estimate and labor_estimate.
- The goal is a polished quote that WOWS the client and makes the contractor look premium.

PRESERVE THE USER'S OWN ITEMIZATION (only when they actually provide it):
- If the user already lists individual sub-items WITH their own price (per day, per unit,
  per room, per material, etc.), output ONE separate line item for EACH sub-item and keep
  their exact dollar amount. In that case do NOT merge, group, collapse, or re-price them,
  and do NOT create "weekly totals" or "lump sums".
- Make each description self-explanatory in English: include the period/day, the crew,
  the hours and the rate when the user provided them.

EXAMPLE A — user gave a per-item breakdown (PRESERVE each line):
"Week 1 Labor (Apr 20-26, 2026): Mon 2 guys x 10 hrs ($2,000); Tue 2 guys x 10 hrs ($2,000);
Wed 3 guys x 10 hrs ($2,500)"
CORRECT line_items (one line PER day, NOT one weekly total):
[
  {"description": "Week 1 - Mon (Apr 20): 2 workers x 10 hrs", "quantity": 1, "unit": "ea", "unit_price": 2000.0, "amount": 2000.0},
  {"description": "Week 1 - Tue (Apr 21): 2 workers x 10 hrs", "quantity": 1, "unit": "ea", "unit_price": 2000.0, "amount": 2000.0},
  {"description": "Week 1 - Wed (Apr 22): 3 workers x 10 hrs", "quantity": 1, "unit": "ea", "unit_price": 2500.0, "amount": 2500.0}
]

EXAMPLE B — user gave a SIMPLE description + lump price (DECOMPOSE into a rich breakdown):
"Complete bathroom remodel, gut everything and install new. Around $6,000"
CORRECT line_items (several realistic items that SUM to ~$6,000, never one $6,000 line):
[
  {"description": "Demolition & removal of existing fixtures, tile and vanity", "quantity": 1, "unit": "ea", "unit_price": 700.0, "amount": 700.0},
  {"description": "Debris haul-away & disposal fees", "quantity": 1, "unit": "ea", "unit_price": 300.0, "amount": 300.0},
  {"description": "Plumbing rough-in & fixture reconnection", "quantity": 1, "unit": "ea", "unit_price": 900.0, "amount": 900.0},
  {"description": "Waterproofing & new tile installation (floor & shower walls)", "quantity": 1, "unit": "ea", "unit_price": 1400.0, "amount": 1400.0},
  {"description": "New vanity, sink, faucet & toilet — supply & install", "quantity": 1, "unit": "ea", "unit_price": 1200.0, "amount": 1200.0},
  {"description": "Paint, trim, accessories & fixtures", "quantity": 1, "unit": "ea", "unit_price": 700.0, "amount": 700.0},
  {"description": "Labor, project management & final cleanup", "quantity": 1, "unit": "ea", "unit_price": 800.0, "amount": 800.0}
]
WRONG (never do this for a simple input): a single line "Complete bathroom remodel ... $6,000".
"""


async def generate_quote_from_text(description_es: str, language: str = "es") -> dict:
    chat = _new_chat(QUOTE_SYSTEM)
    in_lang = "Spanish/Spanglish" if language == "es" else "English"
    msg = UserMessage(text=f"Job description (input language: {in_lang}). Always produce the quote in English:\n{description_es}")
    response = await chat.send_message(msg)
    data = _extract_json(response)
    if not data:
        raise ValueError("AI could not produce a valid quote. Try again.")
    return data


GUIDED_QUOTE_SYSTEM = """You help a U.S. service/home-improvement contractor turn a few
SIMPLE answers into a clean, professional quote or invoice. Many of these contractors don't
know how to describe the job well, so you do the professional writing for them.

Output ONLY valid JSON (no markdown, no commentary):
{
  "job_title": "Short professional job title (3-6 words, English)",
  "summary_line": "ONE polished, detailed customer-facing line describing ALL the work in this job (English, 1-2 sentences, include prep, materials handling, execution and cleanup as relevant). This is what most clients will see.",
  "line_items": [{"description": "...", "quantity": 1, "unit": "ea", "unit_price": 0.0, "amount": 0.0}],
  "scope_of_work": ["Short English bullet", "..."],
  "notes": "",
  "payment_terms": "Short English payment terms sentence",
  "price_estimated": false,
  "estimated_total": 0.0
}

RULES:
- ALL customer-facing text in ENGLISH (their clients read English). The contractor's answers may be in Spanish/Spanglish.
- Always produce BOTH: (1) a single rich `summary_line` covering the whole job, AND (2) a detailed `line_items` breakdown of 4-8 realistic items (prep, materials, labor, disposal, cleanup) for contractors who want it.
- PRICE:
  * If the contractor GAVE a total price: the detailed line_items MUST sum to that exact total. Set `price_estimated` false and `estimated_total` to that total.
  * If the contractor did NOT give a price: estimate a realistic market total for the trade and scope, make the line_items sum to it, set `price_estimated` true and `estimated_total` to your estimate.
- MATERIALS: if materials are NOT included, make that clear in scope_of_work/notes ("Materials provided by client" / "Materials not included") and price for labor only. If included, include materials in the breakdown. If unsure, assume materials included and note it can be adjusted.
- Keep it realistic and specific to the trade. No emojis. `summary_line` must read like a pro wrote it.
"""


async def generate_quote_from_answers(
    trade: str = "",
    work_es: str = "",
    total_price: Optional[float] = None,
    includes_materials: str = "unsure",  # yes | no | unsure
    deposit_kind: str = "none",          # none | half | custom
    deposit_percent: Optional[float] = None,
    language: str = "es",
) -> dict:
    """Turn the guided assistant's simple answers into a normalized quote dict.
    Defaults to a single summary line + total, but also returns a detailed
    breakdown so the UI can offer a 'show breakdown' toggle."""
    chat = _new_chat(GUIDED_QUOTE_SYSTEM)
    has_price = total_price is not None and float(total_price) > 0
    parts = [
        f"Trade / business type: {trade or 'general home services'}",
        f"What needs to be done (contractor's words): {work_es or trade}",
        ("Total price the contractor will charge: $%.2f (use EXACTLY this total)" % float(total_price))
            if has_price else "The contractor does NOT have a price — estimate a realistic total.",
        f"Materials included: {includes_materials}",
    ]
    response = await chat.send_message(UserMessage(text="\n".join(parts)))
    data = _extract_json(response)
    if not data:
        raise ValueError("AI could not produce a quote. Try again.")

    # --- Normalize numbers server-side for reliability ---
    def _num(x):
        try:
            return round(float(x), 2)
        except Exception:
            return 0.0

    items = []
    for li in (data.get("line_items") or []):
        if not isinstance(li, dict):
            continue
        qty = _num(li.get("quantity")) or 1.0
        up = _num(li.get("unit_price"))
        amt = _num(li.get("amount")) or round(qty * up, 2)
        items.append({
            "description": (li.get("description") or "").strip(),
            "quantity": qty, "unit": (li.get("unit") or "ea"),
            "unit_price": up or (amt / qty if qty else 0.0), "amount": amt,
        })
    detailed_sum = round(sum(i["amount"] for i in items), 2)

    if has_price:
        total = round(float(total_price), 2)
        # Rescale the detailed breakdown so it sums EXACTLY to the given total.
        if items and detailed_sum > 0 and abs(detailed_sum - total) > 0.5:
            factor = total / detailed_sum
            for i in items:
                i["unit_price"] = round(i["unit_price"] * factor, 2)
                i["amount"] = round(i["amount"] * factor, 2)
            drift = round(total - sum(i["amount"] for i in items), 2)
            if items and abs(drift) >= 0.01:
                items[-1]["amount"] = round(items[-1]["amount"] + drift, 2)
                items[-1]["unit_price"] = items[-1]["amount"]
    else:
        total = detailed_sum or _num(data.get("estimated_total"))
        if total <= 0:
            total = _num(data.get("estimated_total"))

    # Deposit
    deposit = 0.0
    if deposit_kind == "half":
        deposit = round(total * 0.5, 2)
    elif deposit_kind == "custom" and deposit_percent:
        deposit = round(total * (float(deposit_percent) / 100.0), 2)

    summary_line = (data.get("summary_line") or data.get("job_title") or work_es or "").strip()
    summary_item = {
        "description": summary_line, "quantity": 1, "unit": "ea",
        "unit_price": total, "amount": total,
    }
    return {
        "job_title": (data.get("job_title") or "").strip() or (trade or "Service"),
        "summary_line": summary_line,
        "summary_item": summary_item,       # the single-line default
        "line_items": items,                # the detailed breakdown (for the toggle)
        "scope_of_work": [s for s in (data.get("scope_of_work") or []) if isinstance(s, str) and s.strip()],
        "notes": (data.get("notes") or "").strip(),
        "payment_terms": (data.get("payment_terms") or "").strip(),
        "subtotal": total, "tax_rate": 0.0, "tax_amount": 0.0, "total": total,
        "deposit_amount": deposit,
        "price_estimated": bool(data.get("price_estimated")) and not has_price,
    }



SUGGEST_SERVICES_SYSTEM = """You help a U.S. service/home-improvement contractor list the
services they offer, for their public website. Given their trade/business type, output a
list of the most common, sellable services a customer would search for in that trade.

Output ONLY valid JSON (no markdown, no commentary):
{"services": [{"name": "Short service name", "description": "One customer-facing sentence (max ~18 words) describing the service and its benefit."}]}

Rules:
- ALL text in ENGLISH (customers read English).
- Return 10-12 distinct, realistic services for the trade — specific, not generic filler.
- Names are short (2-4 words). Descriptions are one polished, benefit-driven sentence.
- No prices, no emojis, no numbering. Order from most popular to more specialized.
"""


async def describe_services(business_type: str = "", business_name: str = "", names: Optional[list] = None) -> dict:
    """Write a short customer-facing description for each service NAME the owner
    already offers. Returns {name: description}. One LLM call for the whole list."""
    names = [n for n in (names or []) if (n or "").strip()]
    if not names:
        return {}
    import json as _json
    system = (
        "You are a marketing copywriter for U.S. local service businesses "
        "(contractors, beauty/nail salons, cleaning, auto detailing, and other home & personal services). "
        "For EACH service name given, write ONE polished, benefit-driven customer-facing sentence in ENGLISH "
        "(max ~22 words, no price, no quotes). "
        "Return ONLY a JSON object mapping each exact service name to its description. No markdown."
    )
    brief = (
        f"Business: {business_name or 'a local service business'}\n"
        f"Trade: {business_type or 'general services'}\n"
        f"Services:\n" + "\n".join(f"- {n}" for n in names)
    )
    try:
        chat = _new_chat(system)
        response = await chat.send_message(UserMessage(text=brief))
        data = _extract_json(response) or {}
    except Exception:
        return {}
    out = {}
    if isinstance(data, dict):
        low = { (k or "").strip().lower(): v for k, v in data.items() }
        for n in names:
            v = low.get(n.strip().lower())
            if isinstance(v, str) and v.strip():
                out[n] = v.strip().strip('"')
    return out


async def suggest_services(business_type: str = "", brief: str = "") -> list:
    """Return a list of {name, description} service suggestions for the trade."""
    chat = _new_chat(SUGGEST_SERVICES_SYSTEM)
    parts = [f"Trade / business type: {business_type or 'general home services contractor'}"]
    if brief:
        parts.append(f"Extra context about the business: {brief}")
    response = await chat.send_message(UserMessage(text="\n".join(parts)))
    data = _extract_json(response)
    out = []
    for s in (data.get("services") or []):
        if isinstance(s, dict) and (s.get("name") or "").strip():
            out.append({"name": s["name"].strip(), "description": (s.get("description") or "").strip()})
    if not out:
        raise ValueError("AI could not suggest services. Try again.")
    return out[:12]


_WRITE_KINDS = {
    "service_desc": "a customer-facing description of this SERVICE the contractor offers",
    "why_desc": "a short supporting sentence for this 'Why choose us' selling point",
    "how_desc": "a short explanation of this step in the contractor's process",
    "faq_answer": "a helpful, reassuring answer to this customer FAQ question",
    "bio": "a warm, first-person professional bio for the business owner",
}


async def write_field(kind: str, name: str, business_type: str = "", business_name: str = "", context: str = "") -> str:
    """Write one short English text field for the website editor (service description,
    why-us point, how-it-works step, FAQ answer, or owner bio)."""
    what = _WRITE_KINDS.get(kind, "a short professional website text")
    if kind == "faq_answer":
        length = "2-3 sentences"
    elif kind == "bio":
        length = "2 warm sentences, first person"
    else:
        length = "one polished sentence (max ~25 words)"
    system = (
        "You are a professional copywriter for U.S. local service businesses "
        "(contractors, beauty/nail salons, cleaning, auto, and other home & personal services). "
        "Write clear, benefit-driven, trustworthy marketing copy in ENGLISH. "
        f"Write {what}. Length: {length}. "
        "Output ONLY the finished text — no quotes, no labels, no preamble, no markdown."
    )
    chat = _new_chat(system)
    parts = []
    if business_name:
        parts.append(f"Business: {business_name}")
    if business_type:
        parts.append(f"Trade: {business_type}")
    parts.append(f"Topic / title: {name}")
    if context:
        parts.append(f"Extra context: {context}")
    response = await chat.send_message(UserMessage(text="\n".join(parts)))
    return (response or "").strip().strip('"').strip("\u201c\u201d").strip()



SCOPE_SYSTEM = """You generate a professional Scope of Work in ENGLISH for U.S. clients,
based on a Spanish description from a contractor.

Output ONLY JSON:
{
  "what_is_included": ["..."],
  "what_is_not_included": ["..."],
  "timeline": "e.g., 3-5 business days",
  "materials": ["..."],
  "payment_terms": "...",
  "warranty_notes": "...",
  "change_order_note": "..."
}
"""


async def generate_scope_of_work(description_es: str) -> dict:
    chat = _new_chat(SCOPE_SYSTEM)
    response = await chat.send_message(UserMessage(text=description_es))
    data = _extract_json(response)
    if not data:
        raise ValueError("AI could not produce scope of work. Try again.")
    return data


WEBSITE_CONTENT_SYSTEM = """You are an elite conversion copywriter and local-SEO specialist for
U.S. home-service contractors (roofing, plumbing, HVAC, landscaping, cleaning, painting, concrete, etc.).
You write the marketing copy for a contractor's public website, read by U.S. customers, so ALL copy MUST
be in natural, professional ENGLISH (never Spanish, never translated phrasing).

You are given the business name, trade, services, service area, credentials, real reviews, and — most
importantly — the OWNER'S KNOWLEDGE BASE (a detailed description of their business). TREAT THE KNOWLEDGE
BASE AS YOUR PRIMARY SOURCE OF TRUTH: mine it for the owner's real specialties, process, materials,
guarantees, differentiators and typical projects, and weave those concrete specifics into the copy.
Like an expert estimator, use your deep knowledge of THIS trade to add credible, industry-accurate detail
(common services, process steps, materials, what customers worry about) — but NEVER invent exact prices,
fake awards, or specific numbers that aren't supported.

Output ONLY valid JSON with this EXACT schema (no markdown, no commentary):
{
  "headline": "punchy hero headline, 4-9 words, includes trade + city if known",
  "subheadline": "1-2 sentence value proposition, benefit-driven and specific to this business",
  "about": "5-7 sentence 'About' story that builds real trust: who they are, years/experience, their specialties and typical projects (from the knowledge base), materials/brands they trust, guarantees, why customers choose them. Specific, warm, human — never generic filler.",
  "how_it_works": [
    {"title": "step title (2-4 words)", "desc": "1 concrete sentence describing what happens in this step for THIS trade"}
  ],
  "why_us": [
    {"title": "benefit (2-4 words)", "desc": "1 specific sentence proving the benefit"}
  ],
  "faqs": [
    {"q": "a real question this trade's customers ask", "a": "clear, reassuring, specific answer (1-3 sentences) grounded in the knowledge base"}
  ],
  "services": [
    {"name": "service name", "description": "2-3 vivid, specific sentences describing this service, what's included, materials/process, and its value to the customer"}
  ],
  "areas": ["City or neighborhood 1", "City 2", "City 3", "City 4", "City 5", "City 6"],
  "seo_title": "SEO page title, ~55-60 chars, trade + city + brand",
  "seo_description": "SEO meta description, ~150 chars, includes trade + city + call to action"
}

Rules:
- Provide 4 how_it_works steps, 6 why_us items, and 7 faqs. Make each one specific and non-repetitive.
- "services": rewrite/enrich the owner's listed services (keep the same service NAMES if given) with compelling
  descriptions; if no services are listed, propose 4-6 realistic services for this trade.
- "areas": derive 5-8 realistic nearby cities/neighborhoods from the service area. If unknown, use "Your local area" once.
- Reference the specific trade and services naturally for SEO — do NOT keyword-stuff.
- Prioritize concrete detail from the knowledge base over generic phrasing. Keep it warm, trustworthy and locally focused.
- Return ONLY the JSON.
"""


async def generate_website_content(
    business_name: str = "",
    business_type: str = "",
    services: Optional[list] = None,
    service_area: str = "",
    tagline: str = "",
    about_me: str = "",
    years_in_business: int = 0,
    is_licensed: bool = False,
    is_insured: bool = False,
    hours: str = "",
    ai_context: str = "",
    reviews: Optional[list] = None,
) -> dict:
    def _svc_line(s):
        if not isinstance(s, dict):
            return f"- {s}"
        name = s.get("name", "")
        desc = s.get("description", "")
        price = s.get("starting_price", "")
        extra = " — ".join([x for x in [desc, price] if x])
        return f"- {name}" + (f" ({extra})" if extra else "")

    svc_block = "\n".join([_svc_line(s) for s in (services or [])]).strip() or "(none listed)"
    creds = []
    if is_licensed:
        creds.append("licensed")
    if is_insured:
        creds.append("insured")
    if years_in_business:
        creds.append(f"{years_in_business}+ years in business")
    review_snips = ""
    for r in (reviews or [])[:5]:
        txt = (r.get("text") or r.get("comment") or "").strip() if isinstance(r, dict) else str(r)
        if txt:
            review_snips += f"- \"{txt[:200]}\"\n"

    brief = (
        f"Business name: {business_name or 'a local contractor'}\n"
        f"Trade / business type: {business_type or 'general home services'}\n"
        f"Tagline: {tagline or '(none)'}\n"
        f"Owner's about/bio: {about_me or '(none)'}\n"
        f"Credentials: {', '.join(creds) or '(none stated)'}\n"
        f"Hours: {hours or '(not specified)'}\n"
        f"Service area: {service_area or 'local area (unknown)'}\n"
        f"Services offered:\n{svc_block}\n"
        + (f"Real customer reviews (use their tone/themes, do NOT fabricate):\n{review_snips}" if review_snips else "")
        + (f"\nOwner's private notes / knowledge base (use to sound accurate, never expose verbatim secrets or pricing not meant to be public):\n{ai_context}\n" if ai_context else "")
    )
    chat = _new_chat(WEBSITE_CONTENT_SYSTEM)
    response = await chat.send_message(UserMessage(text=brief))
    data = _extract_json(response)
    if not data:
        raise ValueError("AI could not produce website content. Try again.")
    return data


PROBLEM_PAGE_SYSTEM = """You are a direct-response copywriter for U.S. local-service businesses. Your job: turn ONE service
into a "Problem/Solution" page written from the CUSTOMER'S point of view — a real person who just hit a
problem and opened Google (or is about to) looking for help. All copy is natural, plain, professional ENGLISH.

===========================================================================
STEP 0 — MANDATORY INTERNAL ANALYSIS (do this silently BEFORE writing anything).
Do NOT skip. Do NOT turn the SERVICE NAME into a headline. Start from the CUSTOMER, not the service.
Answer these 4 questions to yourself first:
  1) SERVICE — what service is this? (e.g. "Graphic Design")
  2) REAL SITUATION/PROBLEM — what actually happened in the customer's life that makes them need it?
     (e.g. "My business looks unprofessional", "I need a logo/flyer", "My materials look outdated".)
  3) WHAT WOULD THEY TYPE INTO GOOGLE — the literal, plain search terms, often with "near me"
     (e.g. "graphic designer near me", "logo designer", "flyer design", "graphic design for small business").
  4) WHAT DO THEY ULTIMATELY WANT — the outcome in their words (e.g. "I want my business to look professional").
ONLY AFTER answering 1-4 do you write the page, mirroring that exact search language and desired outcome.

THE PATTERN TO LEARN (reproduce the LOGIC, never copy the wording):
  SERVICE → REAL CUSTOMER SITUATION → WHAT THEY'D SEARCH → WHAT THEY ACTUALLY WANT
         → PROBLEM (hero) → REALISTIC CONSEQUENCE (next section) → SIMPLE SOLUTION → NATURAL CTA

===========================================================================
BANNED LANGUAGE — never use these words/phrases or anything that sounds like an ad agency or AI:
  Elevate, Transform, Enhance, Unlock, Empower, Streamline, Seamless, Cutting-edge, Stunning, Stunning visuals,
  Capture attention, Comprehensive solutions, Take your business to the next level, In today's world,
  Effortlessly, Engaging, Engaging visuals, "brand's impact", "brand's voice", "aligned with your brand",
  "convey your professionalism", "How We Elevate ...", "Need Help with <service>?", "Struggling with <anything>?",
  "Professional <service> Services".
Never make the headline (or any heading) a rephrase of the service name. Use words a normal customer would actually say.

Style contrasts (learn the direction, don't copy):
  BAD  "Need Help with Graphic Design?"      GOOD "Does Your Business Look as Professional as the Work You Do?"
  BAD  "We'll create stunning visuals that capture attention."
  GOOD "We create professional graphics that make your business look credible, consistent, and ready for customers."
  BAD  "ENHANCE MY BRAND"                     GOOD "MAKE MY BUSINESS LOOK PROFESSIONAL"
  BAD  "No hot water? Elevate your comfort."  GOOD "No Hot Water?"

===========================================================================
THE SECOND SECTION MUST NOT REPEAT THE HERO.
The hero IDENTIFIES the problem. The next section explains WHY IT MATTERS / the realistic consequence, and
advances the customer's story with NEW information. Same idea worded twice = failure.
  Example — Hero: "Does Your Business Look as Professional as the Work You Do?"
  Next section heading: "Customers Notice Your Business Before They Know Your Work."
  Next section body: "If your logo, signs, menus, flyers, website, or marketing materials look outdated or
  inconsistent, potential customers may form the wrong impression before they ever give your business a chance."
So: s_problem_title / s_problem must NOT restate problem_headline — they move the story forward to consequences.

===========================================================================
WORKED EXAMPLES — these show the THINKING ONLY. Never reuse this exact copy; regenerate for the real business.
- Roof Repair → searches "roof leak repair / leaking roof". Hero "Roof Leaking?" / agitation "A small leak can
  turn into damaged ceilings, insulation, and costly repairs." / solution "We'll find the source and fix the leak
  before it gets worse." / CTA "FIX MY ROOF LEAK". Next section "Don't Let a Small Leak Become a Bigger Repair".
- Drain Cleaning → "clogged drain / sink won't drain". Hero "Drain Clogged or Backing Up?" / CTA "UNCLOG MY DRAIN".
  Next section "A Clogged Drain Usually Doesn't Fix Itself".
- Drywall Repair → "fix hole in drywall". Hero "Got a Hole or Damage in Your Drywall?" / CTA "FIX MY DRYWALL".
  Next section "Small Damage Can Make the Whole Wall Stand Out".
- Water Heater Repair → "no hot water". Hero "No Hot Water?" / CTA "GET MY HOT WATER BACK".
  Next section "No Hot Water Is Often a Sign Something Isn't Working Right".
- Exterior Painting → "peeling exterior paint". Hero "Is Your Home's Paint Faded, Peeling, or Cracking?" /
  CTA "GET MY PAINTING ESTIMATE". Next section "Your Home May Be Ready for a Fresh Coat".
- House Cleaning → "house cleaning near me". Hero "Wish You Could Come Home to a Clean House?" / CTA "CLEAN MY HOME".
  Next section "You Have Better Things to Do Than Spend Hours Cleaning".
- Graphic Design (NO emergency — find the underlying BUSINESS problem, no fake urgency) →
  "graphic designer near me / logo designer". Hero "Does Your Business Look as Professional as the Work You Do?" /
  CTA "MAKE MY BUSINESS LOOK PROFESSIONAL". Next section "Customers See Your Business Before They Experience Your Work".
- SEO (customer describes the RESULT they're not getting) → "why is my business not showing on Google".
  Hero "Can't Find Your Business on Google?" / CTA "HELP CUSTOMERS FIND ME". Next section "Customers Are Searching. Can They Find You?".
For services WITHOUT a physical emergency (design, marketing, branding, consulting, cleaning subscriptions, etc.),
do NOT invent urgency — surface the underlying real-world business problem the way the owner would describe it.

===========================================================================
PLAIN LANGUAGE APPLIES TO EVERY SECTION — not just the hero.
EVERY heading and paragraph (s_problem, s_why_matters, s_how, why_choose, how_steps, faqs, final_cta_headline)
must pass this test before you accept it: "Would the actual business owner or customer naturally SAY this in a
normal conversation?" If it sounds like an ad, a brochure, or AI, rewrite it in simpler, direct words.
Supporting-section contrasts (learn the direction, don't copy):
  BAD "How We Elevate Your Brand's Impact"          GOOD "Design That Fits Your Business"
  BAD "convey your professionalism effortlessly"    GOOD "give customers the right impression"
  BAD "engaging visuals aligned with your brand's voice"
  GOOD "graphics that fit your business and give customers the right impression"
  BAD "The first click or view can influence how seriously customers take your business."
  GOOD "Customers often form an opinion about your business before they ever call you."
Keep all copy: simple, direct, conversational, specific, customer-focused. No filler marketing vocabulary anywhere.

===========================================================================
CRITICAL RULES:
- The CUSTOMER is the main character; the business is the guide. Prefer "you / your".
- Keep urgency REALISTIC. No fear-mongering, fake scarcity, or misleading claims.
- NEVER invent trust signals, certifications, guarantees, review counts, awards, prices, response times, or
  credentials. Only reference facts explicitly provided in the input.
- Make this page UNIQUE to THIS problem (headline, copy, FAQs, CTA). No template text with the service name swapped in.
- FAQs (5-6) must handle real OBJECTIONS that block action (cost, free estimates, how fast, can I send photos,
  small jobs, do I need to be home). Never invent policies.

Output ONLY valid JSON with this EXACT schema (no markdown, no commentary):
{
  "page_slug": "short-url-slug based on how the customer SEARCHES the problem (2-4 words, lowercase, hyphens, no brand name, e.g. 'roof-leaking', 'clogged-drain', 'cant-find-on-google', 'graphic-designer')",
  "problem_headline": "the customer's problem in THEIR OWN search/spoken words, 3-9 words, ends with ? when natural — NEVER the service name",
  "agitation": "1 sentence, realistic consequence of not dealing with it",
  "solution": "1 short sentence: the business is the fix, in plain words",
  "cta_type": "call | quote | service",
  "cta_label": "natural customer outcome, e.g. FIX MY ROOF LEAK, UNCLOG MY DRAIN, MAKE MY BUSINESS LOOK PROFESSIONAL, HELP CUSTOMERS FIND ME",
  "s_problem_title": "heading that ADVANCES the story (why it matters / consequence) — must NOT restate the hero",
  "s_problem": "2-3 plain sentences explaining WHY IT MATTERS: the concrete signs, situations, or consequences — NEW info, never a paraphrase of the hero",
  "s_why_matters_title": "heading for a further, distinct consequence angle",
  "s_why_matters": "2-3 factual, non-exaggerated sentences on what continues to happen if ignored (distinct from s_problem)",
  "s_how_title": "section heading about the solution",
  "s_how": "2-4 plain sentences on how the business solves this for this customer",
  "why_choose": [{"title": "benefit (2-4 words)", "desc": "1 sentence, grounded ONLY in provided facts"}],
  "faqs": [{"q": "real customer question about this problem", "a": "useful, concise answer, 1-3 sentences"}],
  "how_steps": [{"title": "3-4 word step", "desc": "1 short sentence"}],
  "final_cta_headline": "closing headline that returns to the customer's desired OUTCOME",
  "seo_title": "~55-60 chars, mirrors the customer's search + city + brand (natural, not stuffed)",
  "meta_description": "~150 chars, speaks to the problem in the customer's words + a call to action",
  "h1": "the on-page H1 (can equal problem_headline)"
}

Rules: provide 4 why_choose items (only from provided facts), 5-6 faqs, exactly 3 how_steps.

===========================================================================
FINAL SELF-CHECK before returning (silently verify EVERY heading and paragraph, rewrite if it fails):
  1) Would a REAL customer or the business owner actually SAY or search this in conversation? If not, simplify it.
  2) Does the headline start from the customer's SITUATION (not the service name)?
  3) Does the second section (s_problem_title/s_problem) ADVANCE the story instead of repeating the hero?
  4) Does ANY section (headings AND paragraphs) sound like an ad agency, brochure, or generic AI, or use a banned phrase? If yes, rewrite it in plain words.
The goal is the reader thinking "That's exactly my problem" — NOT "That sounds like good marketing copy."
Return ONLY the JSON."""


async def generate_problem_page(
    business_name: str = "",
    business_type: str = "",
    service_name: str = "",
    service_description: str = "",
    service_area: str = "",
    years_in_business: int = 0,
    is_licensed: bool = False,
    is_insured: bool = False,
    rating: float = 0.0,
    review_count: int = 0,
    reviews: Optional[list] = None,
    problem_hint: str = "",
) -> dict:
    creds = []
    if is_licensed:
        creds.append("licensed")
    if is_insured:
        creds.append("insured")
    if years_in_business:
        creds.append(f"{years_in_business}+ years in business")
    if rating and review_count:
        creds.append(f"{rating:.1f}-star rating from {review_count} reviews")
    creds.append("locally owned / local business")
    review_snips = ""
    for r in (reviews or [])[:4]:
        txt = (r.get("text") or r.get("comment") or "").strip() if isinstance(r, dict) else str(r)
        if txt:
            review_snips += f"- \"{txt[:180]}\"\n"
    brief = (
        f"Business name: {business_name or 'a local contractor'}\n"
        f"Trade / business type: {business_type or 'general home services'}\n"
        f"Service to turn into a problem page: {service_name}\n"
        f"Service description (if any): {service_description or '(none)'}\n"
        f"Service area / city: {service_area or 'local area (unknown)'}\n"
        f"REAL credentials/facts you may reference (do NOT add any others): {', '.join(creds)}\n"
        + (f"Real customer reviews (tone only, do NOT fabricate):\n{review_snips}" if review_snips else "")
        + (f"\nIMPORTANT — the business owner wants THIS page to focus specifically on this customer problem/angle: \"{problem_hint}\". Build the entire page (headline, agitation, sections, FAQs, slug) around THIS specific problem.\n" if (problem_hint or "").strip() else "")
        + "\nGenerate the Problem/Solution page JSON now."
    )
    chat = _new_chat(PROBLEM_PAGE_SYSTEM)
    response = await chat.send_message(UserMessage(text=brief))
    data = _extract_json(response)
    if not data:
        raise ValueError("AI could not produce the problem page. Try again.")
    return data



WEBSITE_TRANSLATE_SYSTEM = """You are a professional bilingual (English↔Spanish) marketing translator
for U.S. Latino home-service contractors. You translate a website's content JSON from English to natural,
warm, professional LATIN-AMERICAN SPANISH (the kind a U.S. Hispanic customer expects — friendly, clear,
not robotic). Keep it persuasive and locally focused.

You receive a JSON object of website content. Translate ONLY the human-readable TEXT values to Spanish.
Rules:
- Keep the EXACT same JSON structure and keys. Do not add or remove keys.
- Translate: headline, subheadline, about, each how_it_works/why_us title+desc, each faq q+a,
  each service name+description, seo_title, seo_description.
- For "areas": keep city/neighborhood names as-is (do NOT translate proper place names).
- Do not translate brand/business names or phone numbers.
- Return ONLY the translated JSON (no markdown, no commentary)."""


async def translate_website_content(content: dict) -> dict:
    """Translate a website content dict to Spanish, preserving structure."""
    import json as _json
    chat = _new_chat(WEBSITE_TRANSLATE_SYSTEM)
    response = await chat.send_message(UserMessage(text=_json.dumps(content, ensure_ascii=False)))
    data = _extract_json(response)
    if not data:
        raise ValueError("AI could not translate the content. Try again.")
    return data


WEBSITE_DESIGN_SYSTEM = """You are a brand & web-design consultant for U.S. home-service contractors.
Given a contractor's trade, pick the single best website TEMPLATE and a brand ACCENT color.

Available templates (choose ONE key exactly):
- "cinematic": bold, premium, dark, full-screen photo. Roofing, construction, high-impact trades.
- "responder": high-energy, 24/7, call-first, red urgency. Towing, emergency plumbing/electrical, restoration.
- "bento": clean modern app-like with side menu. General contractors, handyman, multi-service.
- "craftsman": elegant editorial, warm, serif. Landscaping, remodeling, painting, fine work.
- "trust": familiar, form-first, converts. Local plumbing/HVAC/electrical, cleaning.
- "slider": before/after transformations slider. Painting, cleaning, roofing, restoration, landscaping.
- "onepage": ultra-minimal single page, calm, refined. Consultants, inspectors, boutique services.
- "neon": futuristic dark tech UI with glow. Smart-home, security, EV chargers, solar, low-voltage.
- "playful": colorful, friendly, rounded. Junk removal, moving, cleaning, pet services.
- "luxe": luxury elegant, sophisticated. High-end remodels, custom builds, pools, luxury landscaping.

Output ONLY valid JSON: {"template":"<key>","accent_color":"#RRGGBB","reason":"one short sentence why"}
Pick a professional accent color that fits the trade (e.g. deep blue for plumbing, forest green for
landscaping, red for emergency/towing, gold/emerald for luxury). Return ONLY the JSON."""


async def suggest_website_design(business_name: str = "", business_type: str = "", services: Optional[list] = None) -> dict:
    svc = ", ".join([s.get("name", "") if isinstance(s, dict) else str(s) for s in (services or [])]).strip(", ")
    brief = f"Business: {business_name or 'a local contractor'}\nTrade: {business_type or 'general home services'}\nServices: {svc or 'general services'}"
    chat = _new_chat(WEBSITE_DESIGN_SYSTEM)
    response = await chat.send_message(UserMessage(text=brief))
    data = _extract_json(response)
    valid = {"cinematic", "responder", "bento", "craftsman", "trust", "slider", "onepage", "neon", "playful", "luxe"}
    if not data or data.get("template") not in valid:
        raise ValueError("AI could not suggest a design.")
    color = str(data.get("accent_color") or "").strip()
    if not (color.startswith("#") and len(color) in (4, 7)):
        color = "#2563EB"
    return {"template": data["template"], "accent_color": color, "reason": data.get("reason", "")}



MESSAGE_TEMPLATES = {
    "follow_up_quote": "Polite follow-up on a previously sent quote, ask if they have questions, gentle nudge.",
    "payment_reminder": "Professional payment reminder for an unpaid invoice, friendly but firm.",
    "ask_for_deposit": "Request a deposit to start the project, explain why deposit is needed.",
    "confirm_appointment": "Confirm appointment details (date/time/address).",
    "reschedule_appointment": "Ask to reschedule the appointment, apologize, propose alternatives.",
    "ask_for_review": "Thank customer and politely ask for a Google review with a link placeholder.",
    "explain_delay": "Apologize for a delay, explain reason briefly, give updated timeline.",
    "thank_you": "Warm thank-you note after completing the job, mention referrals.",
    "custom": "Custom message based on user input.",
}


async def generate_message(message_type: str, user_input_es: str, client_name: Optional[str] = None, sender_name: str = "", language: str = "es") -> str:
    intent = MESSAGE_TEMPLATES.get(message_type, MESSAGE_TEMPLATES["custom"])
    name_hint = f"Address the client by name: {client_name}." if client_name else "Use a generic greeting."
    sign_hint = (
        f"End with a sign-off on its own line exactly: '— {sender_name}'. Do NOT use any other name."
        if sender_name else
        "Do NOT add any sign-off line or invented name."
    )
    system = (
        "You write professional client-facing messages in ENGLISH for U.S. customers of a "
        "service business (roofing, drywall, painting, cleaning, etc.). "
        "Keep it short (under 120 words), warm, professional, and clear. "
        f"{sign_hint} "
        f"Intent: {intent} {name_hint}"
    )
    chat = _new_chat(system)
    in_lang = "Spanish" if language == "es" else "English"
    response = await chat.send_message(
        UserMessage(text=f"Contractor's note ({in_lang}). Always reply in English: {user_input_es or '(none)'}")
    )
    return (response or "").strip()


REVIEW_REPLY_SYSTEM = """You write the PUBLIC reply (in ENGLISH) that a U.S. service
contractor posts under a Google review of their own business.

Rules:
- 1-3 short sentences. Warm, human and professional — like a real small-business
  owner, never robotic or corporate.
- 4-5 stars: thank them warmly (use their first name if given), reinforce one
  positive point, and gently invite them back or to refer friends.
- 1-3 stars: stay calm and gracious, sincerely apologize for their experience,
  take light responsibility, and invite them to reach out so you can make it right.
  NEVER argue, blame the customer, or sound defensive.
- No hashtags, no markdown, no sign-off line. At most one subtle emoji (usually none).
Output ONLY the reply text — no quotes, no preamble."""


async def generate_review_reply(comment: str, star_rating: int = 5, reviewer_name: str = "", business_type: str = "") -> str:
    chat = _new_chat(REVIEW_REPLY_SYSTEM)
    ctx = (
        f"Business type: {business_type or 'service contractor'}\n"
        f"Reviewer name: {reviewer_name or '(unknown)'}\n"
        f"Star rating: {star_rating}/5\n"
        f"Review text: {comment or '(no written review, only a star rating)'}"
    )
    response = await chat.send_message(UserMessage(text=ctx))
    return (response or "").strip()


FIELD_GUIDANCE = {
    "about": "a warm, professional 'About Me' bio of 2-4 sentences that builds trust with potential customers and highlights experience, quality and reliability.",
    "tagline": "a short, punchy business tagline/slogan in ONE line, under 10 words, no period at the end.",
    "role": "a concise professional job title or role of 2-5 words (e.g., 'Owner & Lead Contractor').",
    "service": "a short, clear single-sentence service description, under 18 words, focused on the customer benefit.",
    "service_area": "a clean, professional service-area line (e.g., 'Houston, TX and surrounding areas').",
    "hours": "a clean business-hours line in U.S. format (e.g., 'Mon-Fri 8am-6pm, Sat by appointment').",
    "gmb_post": "an engaging Google Business Profile update of 2-3 sentences that highlights the work/offer, builds trust, and ends with a friendly call to action (e.g., 'Call us for a free estimate!'). No hashtags.",
    "generic": "polished, professional English text suitable for a public business profile.",
}


async def polish_to_english(field_type: str, text_es: str, business_type: str = "") -> str:
    """Take a Latino contractor's Spanish input and return ONLY polished, public-facing English."""
    guidance = FIELD_GUIDANCE.get(field_type, FIELD_GUIDANCE["generic"])
    biz = f" The business type is: {business_type}." if business_type else ""
    system = (
        "You help Latino service contractors in the U.S. write the PUBLIC, customer-facing "
        "text of their business profile in professional ENGLISH. The owner writes in Spanish; "
        "you output ONLY the polished English version — no quotes, no Spanish, no explanations, "
        "no markdown, no labels. Preserve the owner's meaning and any specific details "
        "(years, brands, guarantees, prices). Make it natural and persuasive for U.S. customers. "
        f"Write {guidance}{biz}"
    )
    chat = _new_chat(system)
    response = await chat.send_message(
        UserMessage(text=f"Spanish input from the owner: {text_es}")
    )
    out = (response or "").strip()
    # Strip wrapping quotes the model sometimes adds
    if len(out) >= 2 and out[0] in "\"'“”" and out[-1] in "\"'“”":
        out = out[1:-1].strip()
    return out


PHOTO_QUOTE_SYSTEM = """You analyze a contractor's job-site photo and propose a quote draft.

Output ONLY JSON:
{
  "job_type": "e.g., drywall repair, roof shingle replacement",
  "observations": ["visible issue 1", "visible issue 2"],
  "suggested_scope": ["..."],
  "possible_materials": ["..."],
  "questions_for_contractor": ["specific question needed to finalize pricing"],
  "rough_price_range": "USD low-high (clearly mark as estimate, do not commit)"
}

Do NOT invent exact prices. Always ask clarifying questions.
All output strings in ENGLISH.
"""


async def analyze_photo_for_quote(image_base64: str, extra_note_es: str = "", language: str = "es") -> dict:
    chat = _new_chat(PHOTO_QUOTE_SYSTEM)
    img = ImageContent(image_base64=image_base64)
    text = "Analyze this job-site photo and propose a quote draft."
    if extra_note_es:
        in_lang = "Spanish" if language == "es" else "English"
        text += f"\n\nContractor's note ({in_lang}): {extra_note_es}"
    response = await chat.send_message(UserMessage(text=text, file_contents=[img]))
    data = _extract_json(response)
    if not data:
        raise ValueError("AI could not analyze photo. Try another image.")
    return data


# ============================================================================
# Smart Card AI Assistant (public chat for end customers)
# ============================================================================
CARD_ASSISTANT_SYSTEM_TEMPLATE = """You are a friendly customer service assistant for {business_name}, a {business_type} business.

Business info:
- Name: {business_name}
- Services: {services}
- Service area: {service_area}
- Hours: {hours}
- Phone: {phone}
- Email: {email}

About the business (public):
{about_me}

Owner's private knowledge base (use this to answer accurately; do not quote it verbatim):
{ai_context}

Your job:
1. Greet warmly. Be conversational, brief, helpful.
2. Answer questions about services, service area, what's included, typical project timelines, hours, what makes this business different. Use the knowledge base above as your source of truth.
3. If the customer asks something you don't know AND it's not in the knowledge base, say "Let me have the owner follow up on that" — never invent facts.
4. If the customer wants a quote, ask for: their name, phone (or email), property address, brief project description. Gather these step by step (one or two questions at a time, not all at once).
5. When you have enough info (name + phone OR email + a project description), respond with a short confirmation AND end your message with a line on its own:
   LEAD_READY: {{"name":"...","phone":"...","email":"...","address":"...","description":"...","service":"..."}}
6. Never invent exact prices. If a price range is in the knowledge base, share that range and say "the owner will follow up with a custom quote within 24 hours".
7. Reply in {language} ({language_code}). Keep responses under 80 words.
8. Stay on-topic (services, scheduling, quotes). Decline politely if off-topic.
"""


async def card_assistant_chat(
    history: list,
    user_message: str,
    business_name: str,
    business_type: str,
    services: str,
    service_area: str,
    phone: str,
    email: str,
    language_code: str = "en",
    about_me: str = "",
    ai_context: str = "",
    hours: str = "",
) -> str:
    """Chat assistant for the public Smart Business Card. history is a list of {role, content}."""
    language = "English" if language_code == "en" else "Spanish"
    system = CARD_ASSISTANT_SYSTEM_TEMPLATE.format(
        business_name=business_name or "this business",
        business_type=business_type or "service",
        services=services or "various services",
        service_area=service_area or "the local area",
        hours=hours or "not specified",
        phone=phone or "n/a",
        email=email or "n/a",
        about_me=about_me.strip() if about_me else "(no description provided)",
        ai_context=ai_context.strip() if ai_context else "(no extra knowledge provided)",
        language=language,
        language_code=language_code,
    )
    chat = _new_chat(system, model=CHAT_MODEL)
    # Replay prior conversation as alternating user/assistant
    for turn in history[-12:]:
        role = turn.get("role")
        content = turn.get("content", "")
        if role == "user":
            await chat.send_message(UserMessage(text=content))
        # Note: emergentintegrations LlmChat handles history per session_id internally.
        # We use a fresh session each call so we feed the prior turns ourselves.
    response = await chat.send_message(UserMessage(text=user_message))
    return (response or "").strip()


SOCIAL_POST_SYSTEM = """You write short, engaging social media captions for a contractor's completed project.

Output ONLY JSON:
{
  "facebook": "1-2 short paragraphs, friendly tone, with 2-3 emojis and 3-4 hashtags",
  "instagram": "Eye-catching first line, then short body, ending with 6-8 hashtags",
  "google": "Professional Google Business post, 1-2 sentences, no hashtags"
}

Match the tone to a small local service business. Mention service area if provided.
All output in ENGLISH unless told otherwise.
"""


async def generate_social_posts(job_title: str, description_es: str = "", service_area: str = "") -> dict:
    chat = _new_chat(SOCIAL_POST_SYSTEM)
    text = f"Project title: {job_title}\nService area: {service_area or 'local'}\nContext (Spanish): {description_es or '(none)'}"
    response = await chat.send_message(UserMessage(text=text))
    data = _extract_json(response)
    if not data:
        raise ValueError("AI could not produce social posts.")
    return data



# ============================================================================
# UniTech Platform Assistant (public chat for prospective contractors on landing)
# ============================================================================
UNITAP_ASSISTANT_SYSTEM = """You are the AI assistant for UniTech (ezunitech.com / ezunitap.com), an all-in-one, mobile-first SaaS app for service contractors in the United States (roofing, drywall, painting, landscaping, cleaning, concrete, construction, etc).

About UniTech — organized in 3 modules:
1. PRESENCE ($19.99/mo): NFC Smart Business Card + mini-website (Linktree-style, with QR code; tap a phone to share, captures leads automatically), plus Google Reviews gating to collect more 5-star reviews. A physical NFC card is shipped.
2. BUSINESS ($39.99/mo): AI Quote Builder (even from a photo + a 1-line description), AI Service Agreements/Contracts (digitally signed by the client), Invoices with online payment links, Clients CRM, Job Tracker, and Calendar (Day/Week/Month). AI also writes SMS/email follow-up messages.
3. MARKETING ($29.99/mo): AI Marketing Studio — branded social posts (20+ designs), video Reels with voiceovers, and AI image generation, ready for Instagram/Facebook/WhatsApp.

Pricing:
- Single-module prices above. Any 2 modules = 30% off the combined price. The full bundle "Todo UniTech" (all 3 modules) = $59.99/mo.
- Yearly billing = pay for 10 months, get 2 months free.
- 14-day FREE trial, no credit card required to start.

Key capabilities to highlight:
- Stripe Connect: contractors connect their own Stripe account and collect invoice/deposit payments DIRECTLY to themselves (card, etc.). UniTech never holds their money.
- The entire app is fully BILINGUAL (English & Spanish) — the user picks their language at any time.
- Mobile-first: run the whole business from a phone while on the job site.
- Originally built for Latino contractors; now serves all service pros.

Your job:
1. Greet warmly. Be conversational, brief, helpful. Match the visitor's language.
2. Answer questions about features, modules, who it's for, how it works, pricing, mobile use, payments (Stripe Connect), and what makes UniTech different vs Jobber/Housecall Pro/QuickBooks (UniTech is mobile-first, AI-powered, bilingual, and bundles the NFC card + marketing studio that competitors don't).
3. If the visitor seems interested or wants to be contacted, gather their NAME, PHONE or EMAIL, their TRADE, and what they want to achieve. Ask one or two questions at a time.
4. When you have at least NAME + (PHONE or EMAIL) + trade or interest, give a short confirmation AND end your message with a line on its own:
   LEAD_READY: {{"name":"...","phone":"...","email":"...","trade":"...","interest":"...","language":"es|en"}}
5. Use the real prices above when asked. Always mention the 14-day free trial (no card needed). Do not invent features that aren't listed here.
6. Reply in {language} ({language_code}). Keep responses under 90 words. Friendly, no jargon.
7. LANGUAGE ANGLE: when replying in English, sell the capabilities generically — do NOT pitch "translate from Spanish to English" (English-speaking users don't need that). When replying in Spanish, you MAY mention that UniTech writes the client-facing documents in perfect English while the owner works in Spanish.
8. Stay on-topic (UniTech features, contractor business pain points, signup). Decline politely if off-topic.
"""


async def unitap_assistant_chat(
    history: list,
    user_message: str,
    language_code: str = "es",
) -> str:
    """Chat assistant for the UniTech landing page (prospective contractor leads)."""
    language = "Spanish" if language_code == "es" else "English"
    system = UNITAP_ASSISTANT_SYSTEM.format(language=language, language_code=language_code)
    chat = _new_chat(system, model=CHAT_MODEL)
    for turn in history[-12:]:
        role = turn.get("role")
        content = turn.get("content", "")
        if role == "user":
            await chat.send_message(UserMessage(text=content))
    response = await chat.send_message(UserMessage(text=user_message))
    return (response or "").strip()


# ============================================================================
# Service Agreement Generator (legal-style contract in English)
# ============================================================================
AGREEMENT_SYSTEM = """You are a paralegal-grade assistant for U.S. service contractors.
You produce a customer-ready Service Agreement in ENGLISH based on a brief Spanish description
from a Latino business owner. The agreement must read as a clean, plain-English legal document
appropriate for U.S. residential / small commercial clients.

Output ONLY valid JSON with this exact schema (no markdown, no commentary):
{
  "title": "Service Agreement — <Service Type>",
  "preamble": "1-2 sentence opener naming both parties and effective date language.",
  "services_included": ["specific bullet 1", "specific bullet 2", "..."],
  "services_excluded": ["clear out-of-scope item 1", "..."],
  "schedule": "Brief paragraph: timeline, start/end, recurrence if any.",
  "pricing": "Plain-English pricing summary: total, deposit, payment schedule, accepted methods.",
  "payment_terms": "Late fee policy, NSF fee policy, when payment is due.",
  "cancellation_policy": "Notice required, refund logic, no-show fees.",
  "client_responsibilities": ["water access", "clear work area", "..."],
  "warranty": "Plain-English warranty / guarantee language.",
  "liability_and_indemnity": "Plain-English liability limitation + indemnification clause. NOT legal advice — practical contractor protection.",
  "insurance_statement": "1 sentence: contractor carries general liability insurance (placeholder amount if not provided).",
  "change_orders": "Any changes to scope require written approval and may incur additional charges.",
  "dispute_resolution": "Mediation / small claims / governing law clause.",
  "signatures_note": "Reminder that both parties sign electronically below.",
  "industry_specific_clauses": ["Any clauses specific to the trade described — e.g. for lawn care: 'sprinkler heads visible to be flagged by client'; for painting: 'lead-safe practices for pre-1978 homes'."]
}

Rules:
- ALL client-facing strings MUST be in English.
- Use the contractor's business name and the client's name where appropriate (placeholders {{BUSINESS_NAME}} and {{CLIENT_NAME}} are acceptable if not supplied).
- Stay plain-English. No "WHEREAS" or "HEREINAFTER" jargon.
- This is NOT a substitute for legal advice; do NOT make any disclaimer beyond what's in the JSON.
- Adapt clauses to the trade implied by the description. (Lawn care, cleaning, painting, plumbing, electrical, handyman, HVAC, etc.)
- Return ONLY the JSON, nothing else.
"""


async def generate_service_agreement(
    description_es: str,
    business_name: str = "",
    client_name: str = "",
    total: float = 0,
    deposit: float = 0,
) -> dict:
    chat = _new_chat(AGREEMENT_SYSTEM)
    ctx = (
        f"Business name: {business_name or '(not provided)'}\n"
        f"Client name: {client_name or '(not provided)'}\n"
        f"Project total (USD): {total or 'not specified'}\n"
        f"Deposit (USD): {deposit or 'not specified'}\n"
        f"Service description (Spanish):\n{description_es}"
    )
    response = await chat.send_message(UserMessage(text=ctx))
    data = _extract_json(response)
    if not data:
        raise ValueError("AI could not produce a valid service agreement. Try again.")
    return data



SOCIAL_SYSTEM = """You are a senior social-media marketer for U.S. home-service
contractors (roofing, landscaping, cleaning, painting, concrete, drywall, etc.).

A Latino business owner writes a short brief in SPANISH about a job or offer. You
craft a punchy, scroll-stopping social media post. Keep it concrete, benefit-driven,
and local-business friendly. Avoid corporate fluff and emojis inside headline/cta.

TEMPLATE TYPES:
- before_after: highlight the transformation (before vs after).
- showcase: show off one finished job.
- promo: a limited-time offer / discount.

Output ONLY valid JSON (no markdown, no commentary) with this schema:
{
  "headline": "3-6 words, bold hook (UPPERCASE-friendly)",
  "subheadline": "one short supporting line, max ~8 words",
  "cta": "2-4 word call to action, e.g. 'Get a Free Quote'",
  "caption": "2-4 sentence post caption for the feed",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
}

Write headline, subheadline, cta and caption in the requested OUTPUT LANGUAGE.
Hashtags should be relevant and include 1-2 local/industry tags.
"""


async def generate_social_copy(
    brief_es: str,
    template: str = "showcase",
    language: str = "en",
    business_name: str = "",
    business_type: str = "",
    phone: str = "",
) -> dict:
    """Spanish brief -> structured social post copy in the requested language."""
    lang_name = {"en": "English", "es": "Spanish"}.get(language, "English")
    chat = _new_chat(SOCIAL_SYSTEM)
    ctx = (
        f"TEMPLATE TYPE: {template}\n"
        f"OUTPUT LANGUAGE: {lang_name}\n"
        f"Business name: {business_name or '(not provided)'}\n"
        f"Business type / trade: {business_type or '(not provided)'}\n"
        f"Contact phone: {phone or '(not provided)'}\n"
        f"Owner's brief (Spanish):\n{brief_es}"
    )
    response = await chat.send_message(UserMessage(text=ctx))
    data = _extract_json(response)
    if not data:
        raise ValueError("La IA no pudo generar el texto del post. Intenta de nuevo.")
    # Normalize
    data["headline"] = (data.get("headline") or "").strip()
    data["subheadline"] = (data.get("subheadline") or "").strip()
    data["cta"] = (data.get("cta") or "").strip()
    data["caption"] = (data.get("caption") or "").strip()
    hashtags = data.get("hashtags") or []
    if isinstance(hashtags, str):
        hashtags = [h.strip() for h in hashtags.replace(",", " ").split() if h.strip()]
    data["hashtags"] = ["#" + h.lstrip("#") for h in hashtags if h][:8]
    return data



# ============================================================================
# Reel — Testimonial cleanup (VERBATIM, never paraphrase the customer)
# ============================================================================
TESTIMONIAL_SYSTEM = """You receive a REAL customer review/testimonial for a contractor's business.
Your ONLY job is to lightly clean it up so it can be shown on a short video card —
WITHOUT changing the customer's message, meaning, tone, or claims.

STRICT RULES:
- Do NOT rewrite, rephrase, paraphrase, summarize, embellish, or add marketing language.
- Do NOT invent details, names, numbers, or results the customer did not state.
- ONLY fix spelling, obvious typos, capitalization, and basic punctuation.
- Keep it in the customer's own words.
- If the review is written in a different language than the requested OUTPUT LANGUAGE,
  translate it LITERALLY and faithfully (same meaning, same tone) — NOT as a marketing message.
- Keep the wording intact (do not shorten unless it is extremely long and only trim trailing repetition).

Output ONLY valid JSON (no markdown):
{
  "quote": "the cleaned (and, if needed, literally translated) review text",
  "cta": "a short 2-4 word call to action in the OUTPUT LANGUAGE, e.g. 'Call us today'"
}"""


async def clean_testimonial(review_text: str, language: str = "en") -> dict:
    """Lightly clean a real customer review (spelling only) — never paraphrase.
    Translates literally if the review language differs from the output language."""
    review_text = (review_text or "").strip()
    if not review_text:
        return {"quote": "", "cta": ""}
    lang_name = {"en": "English", "es": "Spanish"}.get(language, "English")
    chat = _new_chat(TESTIMONIAL_SYSTEM)
    ctx = f"OUTPUT LANGUAGE: {lang_name}\nCustomer review (verbatim):\n{review_text}"
    try:
        response = await chat.send_message(UserMessage(text=ctx))
        data = _extract_json(response) or {}
    except Exception:
        data = {}
    quote = (data.get("quote") or "").strip().strip('"').strip("\u201c\u201d")
    if not quote:
        quote = review_text
    cta = (data.get("cta") or "").strip()
    return {"quote": quote, "cta": cta}


# ============================================================================
# Reel — Services per-photo labels cleanup (spelling only, keep them short)
# ============================================================================
SERVICE_LINES_SYSTEM = """You receive a list of short service labels a contractor typed (one per photo)
for a marketing video. Clean each line WITHOUT changing its meaning:
- Fix spelling, typos, and capitalization.
- Keep it SHORT (a few words, like a title) — these are on-screen labels, not sentences.
- Do NOT add marketing fluff or invent services.
- If a line is in a different language than the OUTPUT LANGUAGE, translate it literally.
- Return EXACTLY the same number of lines, in the same order.

Output ONLY valid JSON (no markdown): {"lines": ["clean line 1", "clean line 2", "..."]}"""


async def clean_service_lines(lines: list, language: str = "en") -> list:
    """Spelling-clean each per-photo service label, keeping order and count."""
    src = [(l or "").strip() for l in (lines or [])]
    if not any(src):
        return src
    lang_name = {"en": "English", "es": "Spanish"}.get(language, "English")
    chat = _new_chat(SERVICE_LINES_SYSTEM)
    ctx = (f"OUTPUT LANGUAGE: {lang_name}\nLines (one per photo, in order):\n" +
           "\n".join(f"{i + 1}. {t or '(empty)'}" for i, t in enumerate(src)))
    try:
        response = await chat.send_message(UserMessage(text=ctx))
        data = _extract_json(response) or {}
        out = [(x or "").strip() for x in (data.get("lines") or [])]
    except Exception:
        out = []
    return [out[i] if i < len(out) and out[i] else src[i] for i in range(len(src))]



# ============================================================================
# Marketing Studio — Text-to-image generation (Gemini Nano Banana)
# ============================================================================
IMAGE_GEN_MODEL = "gemini-3.1-flash-image-preview"

_IMG_STYLE = {
    "realistic": (
        "Ultra-realistic professional photograph. Natural lighting, sharp focus, "
        "high detail, shot on a DSLR camera, photojournalistic and authentic. "
        "NO text, NO words, NO captions, NO logos, NO watermark."
    ),
    "graphic": (
        "Clean modern marketing graphic / illustration. Bold flat design, vibrant "
        "cohesive colors, polished poster look. NO text, NO words, NO watermark."
    ),
}
_IMG_ASPECT_HINT = {
    "9x16": "Vertical 9:16 portrait composition (tall, full-frame vertical).",
    "1x1": "Square 1:1 composition, centered subject.",
    "4x5": "Vertical 4:5 portrait composition.",
}


async def generate_image(idea: str, aspect: str = "1x1", style: str = "realistic") -> tuple[bytes, str]:
    """Generate a marketing image from a text idea (no source photo) with Gemini
    Nano Banana. Returns (image_bytes, mime_type). Retries a few times because
    the model occasionally replies with text only."""
    idea = (idea or "").strip()
    style_txt = _IMG_STYLE.get(style, _IMG_STYLE["realistic"])
    aspect_txt = _IMG_ASPECT_HINT.get(aspect, _IMG_ASPECT_HINT["1x1"])
    prompt = (
        "Create ONE high-quality marketing image for a contractor / home-services "
        f"business to use on social media. Subject / idea: {idea}. "
        f"{aspect_txt} {style_txt} Output ONLY the image, no text."
    )
    last_err = "La IA no devolvió una imagen"
    if OPENAI_API_KEY:
        for attempt in range(2):
            try:
                return await _openai_generate_image(prompt, _openai_image_size(aspect))
            except Exception as e:
                last_err = str(e)
                logger.warning("generate_image (openai) attempt %s/2 failed: %s", attempt + 1, e)
        raise RuntimeError(last_err)
    for attempt in range(3):
        try:
            chat = LlmChat(
                api_key=LLM_KEY,
                session_id=str(uuid.uuid4()),
                system_message="You are an expert visual content generator. You always return an image.",
            ).with_model("gemini", IMAGE_GEN_MODEL).with_params(modalities=["image", "text"])
            _text, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
            if images:
                img = images[0]
                return base64.b64decode(img["data"]), img.get("mime_type", "image/png")
            logger.warning("generate_image: no image returned (attempt %s/3)", attempt + 1)
        except Exception as e:
            last_err = str(e)
            logger.warning("generate_image attempt %s/3 failed: %s", attempt + 1, e)
    raise RuntimeError(last_err)


# ============================================================================
# Marketing Studio — AI post-idea generator ("no sé qué postear")
# ============================================================================
async def generate_post_ideas(
    business_type: str = "",
    business_name: str = "",
    topic: str = "",
    count: int = 6,
    language: str = "es",
    category: str = "",
    service_area: str = "",
    extra_context: str = "",
) -> list[dict]:
    """Return practical, personalized social post ideas for the contractor's trade.
    Each item: {category, title, idea (ES brief), photo_tip (what to shoot),
    image_prompt (EN prompt to generate the image with AI)}."""
    count = max(3, min(int(count or 6), 10))
    lang_name = {"en": "English", "es": "Spanish"}.get(language, "Spanish")
    cat_map = {
        "trabajo_terminado": "showing off a finished / completed job",
        "oferta": "a promotion, discount or special offer",
        "resena": "a happy customer review / testimonial",
        "antes_despues": "a before & after transformation",
        "contratando": "a 'now hiring / we are hiring' post",
        "temporada": "a seasonal / holiday themed post",
        "tips": "an educational tip that builds trust",
    }
    focus = cat_map.get(category, "")
    chat = _new_chat("You are a social media marketing expert helping a local small business grow.")
    ctx = (
        f"Generate {count} practical social media post ideas for a "
        f"{business_type or 'local small business'} business named '{business_name or 'the business'}'"
        + (f", serving {service_area}" if (service_area or '').strip() else "")
        + ". "
        + (f"EVERY idea must be about: {focus}. " if focus else
           "Mix finished-work, offer, review, before/after, seasonal, hiring and educational-tip ideas. ")
        + (f"Use this extra context from the owner: {topic or extra_context}. " if (topic or extra_context or '').strip() else "")
        + "STRICT RULE: base ideas ONLY on this business's own industry and services. Do NOT invent or assume specific client niches/industries (e.g. plumbing, HVAC, roofing) that the owner did not mention. "
        + f"For EACH idea provide: 'title' (short catchy, in {lang_name}); "
        + f"'idea' (ONE practical sentence in {lang_name} the owner can paste as a brief describing what to post); "
        + f"'photo_tip' (in {lang_name}: exactly what photo or short video they should take with their phone for this post); "
        + "'image_prompt' (in ENGLISH: a vivid prompt to generate this image with AI in case they have no photo). "
        + 'Output ONLY valid JSON (no markdown): {"ideas":[{"category":"trabajo_terminado|oferta|resena|antes_despues|contratando|temporada|tips","title":"...","idea":"...","photo_tip":"...","image_prompt":"..."}]}'
    )
    try:
        response = await chat.send_message(UserMessage(text=ctx))
        data = _extract_json(response) or {}
    except Exception as e:
        logger.warning("generate_post_ideas failed: %s", e)
        data = {}
    out = []
    for it in (data.get("ideas") or []):
        title = (it.get("title") or "").strip()
        idea = (it.get("idea") or "").strip()
        if not (title or idea):
            continue
        out.append({
            "category": (it.get("category") or category or "tips").strip(),
            "title": title or idea[:40],
            "idea": idea or title,
            "photo_tip": (it.get("photo_tip") or "").strip(),
            "image_prompt": (it.get("image_prompt") or "").strip(),
        })
    return out[:count]



_TOPIC_CATEGORIES = ["trabajo_terminado", "oferta", "resena", "antes_despues", "contratando", "temporada", "tips"]


async def generate_idea_topics(
    business_type: str = "",
    business_name: str = "",
    service_area: str = "",
    services: str = "",
    language: str = "es",
    count: int = 6,
) -> list[dict]:
    """Short post-topic 'chips' tailored to the contractor's specific trade.
    Each item: {label (short, in the user's language), category (one of the 7 types)}."""
    count = max(4, min(int(count or 6), 8))
    lang_name = {"en": "English", "es": "Spanish"}.get(language, "Spanish")
    chat = _new_chat("You are a social media marketing expert helping a local small business grow.")
    ctx = (
        f"This business's industry is: {business_type or 'general local services'}."
        + (f" Business name: '{business_name}'." if (business_name or '').strip() else "")
        + (f" Service area: {service_area}." if (service_area or '').strip() else "")
        + (f" Their OWN services/offer: {services}." if (services or '').strip() else "")
        + f" Suggest exactly {count} SHORT post-topic buttons (max 4 words each) in {lang_name}, each specific to what THIS business itself does or offers. "
        + "STRICT RULE: base topics ONLY on this business's own industry and listed services. Do NOT invent or assume specific client niches/industries (e.g. plumbing, HVAC, roofing, landscaping) that are NOT explicitly listed in their services — talk about what the business does in general, not about made-up clients. "
        + "Map each topic to ONE type from: trabajo_terminado, oferta, resena, antes_despues, contratando, temporada, tips. "
        + 'Output ONLY valid JSON (no markdown): {"topics":[{"label":"short topic","category":"one_type"}]}'
    )
    try:
        response = await chat.send_message(UserMessage(text=ctx))
        data = _extract_json(response) or {}
    except Exception as e:
        logger.warning("generate_idea_topics failed: %s", e)
        data = {}
    out = []
    for it in (data.get("topics") or []):
        label = (it.get("label") or "").strip()
        cat = (it.get("category") or "tips").strip()
        if not label:
            continue
        if cat not in _TOPIC_CATEGORIES:
            cat = "tips"
        out.append({"label": label[:40], "category": cat})
    return out[:count]
