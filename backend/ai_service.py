"""AI service: wraps LLM calls for quotes, messages, scope of work, photo analysis.

Uses Emergent LLM Universal Key with OpenAI GPT-5.2 (text + vision).
"""
from __future__ import annotations

import json
import logging
import os
import re
import uuid
from typing import Optional

from emergentintegrations.llm.chat import ImageContent, LlmChat, UserMessage

logger = logging.getLogger(__name__)

LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
MODEL_PROVIDER = "openai"
MODEL_NAME = "gpt-5.2"


def _new_chat(system_message: str) -> LlmChat:
    return LlmChat(
        api_key=LLM_KEY,
        session_id=str(uuid.uuid4()),
        system_message=system_message,
    ).with_model(MODEL_PROVIDER, MODEL_NAME)


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
- Use realistic ballpark U.S. residential pricing if not specified.
- Ensure totals are arithmetically consistent.
- Return ONLY the JSON, nothing else.
"""


async def generate_quote_from_text(description_es: str) -> dict:
    chat = _new_chat(QUOTE_SYSTEM)
    msg = UserMessage(text=f"Descripcion del trabajo (espanol):\n{description_es}")
    response = await chat.send_message(msg)
    data = _extract_json(response)
    if not data:
        raise ValueError("AI could not produce a valid quote. Try again.")
    return data


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


async def generate_message(message_type: str, user_input_es: str, client_name: Optional[str] = None) -> str:
    intent = MESSAGE_TEMPLATES.get(message_type, MESSAGE_TEMPLATES["custom"])
    name_hint = f"Address the client by name: {client_name}." if client_name else "Use a generic greeting."
    system = (
        "You write professional client-facing messages in ENGLISH for U.S. customers of a "
        "Latino-owned service business (roofing, drywall, painting, cleaning, etc.). "
        "Keep it short (under 120 words), warm, professional, and clear. "
        "Sign with: '— [Your Name]'. "
        f"Intent: {intent} {name_hint}"
    )
    chat = _new_chat(system)
    response = await chat.send_message(
        UserMessage(text=f"Contractor's note (Spanish): {user_input_es or '(none)'}")
    )
    return (response or "").strip()


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


async def analyze_photo_for_quote(image_base64: str, extra_note_es: str = "") -> dict:
    chat = _new_chat(PHOTO_QUOTE_SYSTEM)
    img = ImageContent(image_base64=image_base64)
    text = "Analyze this job-site photo and propose a quote draft."
    if extra_note_es:
        text += f"\n\nContractor's note (Spanish): {extra_note_es}"
    response = await chat.send_message(UserMessage(text=text, file_contents=[img]))
    data = _extract_json(response)
    if not data:
        raise ValueError("AI could not analyze photo. Try another image.")
    return data
