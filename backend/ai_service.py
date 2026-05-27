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
    chat = _new_chat(system)
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
# Unitap Platform Assistant (public chat for prospective contractors on landing)
# ============================================================================
UNITAP_ASSISTANT_SYSTEM = """You are the AI assistant for Unitap (ezunitap.com), a SaaS app designed for Latino service contractors in the United States (roofing, drywall, painting, landscaping, cleaning, concrete, construction, etc).

About Unitap:
- All-in-one app: Dashboard, Clients (CRM), AI Quote Builder, Invoices, Job Tracker, Calendar (Day/Week/Month), AI Message Writer, Photo notes, and a premium "Smart Business Card" (Linktree-style digital card with QR code that captures leads automatically).
- The owner's interface is in SPANISH. Client-facing documents (quotes, invoices, messages, smart card) are generated in ENGLISH by AI.
- Mobile-first: built to be used from a phone while on the job site.
- AI features: generate quotes from a photo + 1 line description, write SMS/email follow-ups, create scope of work, answer client questions via a chatbot on each Smart Card.
- Pricing: free to start (no credit card required). Premium plans coming soon for advanced features.
- Built FOR Latino contractors, BY a team that understands the language barrier (your client speaks English, you speak Spanish — Unitap bridges that).

Your job:
1. Greet warmly. Be conversational, brief, helpful. Match the visitor's language (Spanish or English).
2. Answer questions about features, who Unitap is for, how it works, pricing, mobile use, languages, what makes Unitap different vs. competitors like Jobber/Housecall Pro/QuickBooks.
3. If the visitor seems interested in trying Unitap or wants to be contacted, gather: their NAME, PHONE or EMAIL, what TRADE they work in (roofing, painting, etc.), and what they want to achieve with the app. Ask step by step (one or two questions at a time).
4. When you have at least NAME + (PHONE or EMAIL) + trade or interest, respond with a short confirmation AND end your message with a line on its own:
   LEAD_READY: {{"name":"...","phone":"...","email":"...","trade":"...","interest":"...","language":"es|en"}}
5. Never invent specific pricing numbers. If asked "how much?" say "Unitap is free to start. Premium plans are coming soon — would you like the founder to follow up with details when they're ready?"
6. Reply in {language} ({language_code}). Keep responses under 90 words. Friendly, no jargon.
7. Stay on-topic (Unitap features, contractor business pain points, signup). Decline politely if off-topic.
"""


async def unitap_assistant_chat(
    history: list,
    user_message: str,
    language_code: str = "es",
) -> str:
    """Chat assistant for the Unitap landing page (prospective contractor leads)."""
    language = "Spanish" if language_code == "es" else "English"
    system = UNITAP_ASSISTANT_SYSTEM.format(language=language, language_code=language_code)
    chat = _new_chat(system)
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
