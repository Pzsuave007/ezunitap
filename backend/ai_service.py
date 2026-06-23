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
MODEL_PROVIDER = "openai"
MODEL_NAME = "gpt-5.2"

# Gemini "Nano Banana" image-editing model (image-to-image enhancement).
IMAGE_MODEL = "gemini-3.1-flash-image-preview"

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

CRITICAL — PRESERVE THE USER'S ITEMIZATION (DO NOT GROUP OR SUMMARIZE):
- If the user already lists individual sub-items WITH their own price (per day, per unit,
  per room, per material, etc.), you MUST output ONE separate line item for EACH sub-item.
- NEVER merge, group, or collapse several priced sub-items into a single combined line.
  Do NOT create "weekly totals", "lump sums", or "grouped" lines when the user gave detail.
- Keep the user's exact dollar amount for each sub-item. quantity=1, unit="ea",
  unit_price = that sub-item's amount, amount = the same value. Do not re-price.
- Make each description self-explanatory in English: include the period/day, the crew,
  the hours and the rate when the user provided them.
- Only invent grouped/estimated lines when the user did NOT provide a per-item breakdown.

EXAMPLE — user input (Spanish/Spanglish):
"Week 1 Labor (Apr 20-26, 2026): Mon 2 guys x 10 hrs ($2,000); Tue 2 guys x 10 hrs ($2,000);
Wed 3 guys x 10 hrs ($2,500)"
CORRECT line_items output (one line PER day, NOT one weekly total):
[
  {"description": "Week 1 - Mon (Apr 20): 2 workers x 10 hrs", "quantity": 1, "unit": "ea", "unit_price": 2000.0, "amount": 2000.0},
  {"description": "Week 1 - Tue (Apr 21): 2 workers x 10 hrs", "quantity": 1, "unit": "ea", "unit_price": 2000.0, "amount": 2000.0},
  {"description": "Week 1 - Wed (Apr 22): 3 workers x 10 hrs", "quantity": 1, "unit": "ea", "unit_price": 2500.0, "amount": 2500.0}
]
WRONG (do NOT do this): a single line "Week 1 Labor ... $6,500".
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
