"""In-app AI assistant ("Asistente Unitech") with tool calling.

Helps non-technical owners run their account by chatting: it can guide them and
PERFORM a safe set of actions (change card photo / logo, update business info,
add a service, create an event) — always with an explicit confirmation step
handled by the server (write tools never auto-execute here).

Runs on the Emergent universal key for development/testing, and on the owner's
own OpenAI key in production (set OPENAI_API_KEY). Mirrors ai_service's key logic.
"""
from __future__ import annotations

import json
import logging
import os
import uuid

from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
EMERGENT_MODEL = os.environ.get("ASSISTANT_MODEL", "gpt-5.4")
OPENAI_OWN_MODEL = os.environ.get("OPENAI_OWN_MODEL", "gpt-4o")

# Tools that CHANGE data — never executed inside this service. When the model
# calls one, we stop and hand a "pending action" back to the server, which shows
# the user a confirmation before applying it.
WRITE_TOOLS = {"update_card_photo", "update_logo", "update_business_info", "upsert_service", "create_event"}

TOOLS = [
    {"type": "function", "function": {
        "name": "get_account_status",
        "description": "Get a checklist of what is set up on the owner's account (card photo, logo, business info, services, published website, events). Call this to guide account setup or answer 'what's missing'.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "list_services",
        "description": "List the services currently on the owner's website/card.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "update_card_photo",
        "description": "Set the owner's digital card profile photo. Requires an image the user attached; pass its image_id.",
        "parameters": {"type": "object", "properties": {
            "image_id": {"type": "string", "description": "The image_id of the photo the user attached."},
        }, "required": ["image_id"]},
    }},
    {"type": "function", "function": {
        "name": "update_logo",
        "description": "Set the business logo. Requires an image the user attached; pass its image_id.",
        "parameters": {"type": "object", "properties": {
            "image_id": {"type": "string", "description": "The image_id of the logo the user attached."},
        }, "required": ["image_id"]},
    }},
    {"type": "function", "function": {
        "name": "update_business_info",
        "description": "Update the owner's business details. Only include the fields the user wants to change.",
        "parameters": {"type": "object", "properties": {
            "name": {"type": "string", "description": "Person or business name shown on the card."},
            "phone": {"type": "string"},
            "email": {"type": "string"},
            "hours": {"type": "string", "description": "Business hours, free text."},
            "service_area": {"type": "string"},
            "business_type": {"type": "string", "description": "e.g. salsa instructor, gym, plumber."},
            "about": {"type": "string", "description": "Short about/description text."},
        }},
    }},
    {"type": "function", "function": {
        "name": "upsert_service",
        "description": "Add a new service or edit an existing one on the website/card.",
        "parameters": {"type": "object", "properties": {
            "name": {"type": "string", "description": "Service name."},
            "description": {"type": "string"},
            "price": {"type": "string", "description": "Optional price text, e.g. '$50' or 'desde $20'."},
            "replace_name": {"type": "string", "description": "If editing, the exact current name of the service to replace."},
        }, "required": ["name"]},
    }},
    {"type": "function", "function": {
        "name": "create_event",
        "description": "Create an event on the owner's site. Ask for a title and a start date/time first.",
        "parameters": {"type": "object", "properties": {
            "title": {"type": "string"},
            "start": {"type": "string", "description": "ISO 8601 start datetime, e.g. 2026-07-15T19:00:00."},
            "description": {"type": "string"},
            "location_name": {"type": "string"},
            "online_url": {"type": "string"},
            "price": {"type": "number"},
            "capacity": {"type": "integer"},
        }, "required": ["title", "start"]},
    }},
]


def system_prompt(lang: str, business_name: str = "") -> str:
    es = (lang or "es").lower().startswith("es")
    who = f" El negocio se llama {business_name}." if business_name else ""
    if es:
        return (
            "Eres el Asistente de Unitech, un empleado virtual amable y paciente que ayuda a dueños "
            "de negocios que NO son expertos en tecnología a usar su cuenta de Unitech (tarjeta digital, "
            f"sitio web, servicios, eventos y boletín).{who} "
            "Hablas claro y sencillo, sin tecnicismos, en español. "
            "Puedes HACER cosas por el usuario usando tus herramientas: cambiar la foto de la tarjeta, "
            "cambiar el logo, actualizar datos del negocio, agregar o editar servicios y crear eventos. "
            "Cuando el usuario quiera cambiar una foto o el logo y haya adjuntado una imagen, usa la "
            "herramienta correspondiente pasando el image_id que te da el sistema. "
            "Si te faltan datos (por ejemplo la fecha de un evento), pregúntalos ANTES de usar la herramienta. "
            "Para ayudar con la configuración de la cuenta, primero usa get_account_status para ver qué falta "
            "y guía al usuario paso a paso, uno a la vez. "
            "Cada cambio se le confirmará al usuario antes de aplicarse, así que propón la acción con confianza. "
            "Sé breve y cálido."
        )
    return (
        "You are the Unitech Assistant, a friendly, patient virtual employee who helps non-technical "
        f"business owners use their Unitech account (digital card, website, services, events, newsletter).{who} "
        "Speak plainly, no jargon, in English. "
        "You can DO things for the user with your tools: change the card photo, change the logo, update "
        "business info, add/edit services, and create events. When the user wants to change a photo or logo "
        "and has attached an image, call the matching tool passing the image_id the system gives you. "
        "If details are missing (e.g. an event date), ask first. To help set up the account, call "
        "get_account_status first to see what's missing and guide step by step. Every change is confirmed "
        "with the user before applying. Be brief and warm."
    )


def confirm_summary(name: str, args: dict, lang: str) -> str:
    es = (lang or "es").lower().startswith("es")
    if name == "update_card_photo":
        return "Voy a poner la imagen que enviaste como la foto de tu tarjeta digital. ¿Confirmas?" if es \
            else "I'll set the image you sent as your digital card photo. Confirm?"
    if name == "update_logo":
        return "Voy a poner la imagen que enviaste como el logo de tu negocio. ¿Confirmas?" if es \
            else "I'll set the image you sent as your business logo. Confirm?"
    if name == "update_business_info":
        parts = [f"{k}: {v}" for k, v in args.items() if v]
        joined = "; ".join(parts)
        return (f"Voy a actualizar estos datos de tu negocio → {joined}. ¿Confirmas?") if es \
            else (f"I'll update these business details → {joined}. Confirm?")
    if name == "upsert_service":
        nm = args.get("name", "")
        verb = "editar" if args.get("replace_name") else "agregar"
        return (f"Voy a {verb} el servicio \"{nm}\". ¿Confirmas?") if es \
            else (f"I'll {'edit' if args.get('replace_name') else 'add'} the service \"{nm}\". Confirm?")
    if name == "create_event":
        return (f"Voy a crear el evento \"{args.get('title','')}\" para el {args.get('start','')}. ¿Confirmas?") if es \
            else (f"I'll create the event \"{args.get('title','')}\" on {args.get('start','')}. Confirm?")
    return "¿Confirmas esta acción?" if es else "Confirm this action?"


async def respond(system_base: str, transcript: list, user_text: str, lang: str, read_dispatch) -> dict:
    """Run one assistant turn. Returns {"reply": str, "pending": {name, arguments} | None}.

    transcript: prior turns as [{"role": "user"|"assistant", "content": str}].
    read_dispatch: async callable(name, args) -> dict, for read-only tools.
    """
    if OPENAI_API_KEY:
        return await _run_openai(system_base, transcript, user_text, lang, read_dispatch)
    return await _run_emergent(system_base, transcript, user_text, lang, read_dispatch)


async def _run_openai(system_base, transcript, user_text, lang, read_dispatch) -> dict:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    messages = [{"role": "system", "content": system_base}]
    for m in transcript:
        messages.append({"role": m["role"], "content": m["content"]})
    messages.append({"role": "user", "content": user_text})

    for _ in range(4):
        resp = await client.chat.completions.create(
            model=OPENAI_OWN_MODEL, messages=messages, tools=TOOLS, tool_choice="auto",
        )
        msg = resp.choices[0].message
        tcs = msg.tool_calls or []
        if not tcs:
            return {"reply": (msg.content or "").strip(), "pending": None}
        write = next((tc for tc in tcs if tc.function.name in WRITE_TOOLS), None)
        if write:
            args = _safe_json(write.function.arguments)
            return {"reply": confirm_summary(write.function.name, args, lang),
                    "pending": {"name": write.function.name, "arguments": args}}
        messages.append(msg)
        for tc in tcs:
            res = await read_dispatch(tc.function.name, _safe_json(tc.function.arguments))
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": json.dumps(res)})
    return {"reply": "", "pending": None}


async def _run_emergent(system_base, transcript, user_text, lang, read_dispatch) -> dict:
    context = ""
    if transcript:
        lines = []
        for m in transcript[-12:]:
            who = "Usuario" if m["role"] == "user" else "Asistente"
            lines.append(f"{who}: {m['content']}")
        context = "\n\nConversación hasta ahora:\n" + "\n".join(lines)
    base = LlmChat(
        api_key=LLM_KEY, session_id=str(uuid.uuid4()),
        system_message=system_base + context,
    ).with_model("openai", EMERGENT_MODEL)

    # Older emergentintegrations builds (<0.2) have no tool-calling support. In
    # that case fall back to a plain conversational reply (no actions) so the
    # assistant never crashes. Production uses the owner's own OpenAI key path.
    if not hasattr(base, "with_tools"):
        reply = await base.send_message(UserMessage(text=user_text))
        return {"reply": (reply or "").strip(), "pending": None}

    chat = base.with_tools(TOOLS, tool_choice="auto")
    response = await chat.send_message_with_tools(UserMessage(text=user_text))
    for _ in range(4):
        tcs = getattr(response, "tool_calls", None) or []
        if not tcs:
            return {"reply": (getattr(response, "content", "") or "").strip(), "pending": None}
        write = next((tc for tc in tcs if tc.name in WRITE_TOOLS), None)
        if write:
            args = write.arguments if isinstance(write.arguments, dict) else _safe_json(write.arguments)
            return {"reply": confirm_summary(write.name, args, lang),
                    "pending": {"name": write.name, "arguments": args}}
        for tc in tcs:
            args = tc.arguments if isinstance(tc.arguments, dict) else _safe_json(tc.arguments)
            res = await read_dispatch(tc.name, args)
            chat.add_tool_result(tc.id, json.dumps(res))
        response = await chat.send_message_with_tools()
    return {"reply": "", "pending": None}


def _safe_json(s):
    if isinstance(s, dict):
        return s
    try:
        return json.loads(s or "{}")
    except Exception:
        return {}
