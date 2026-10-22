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

# ── Central system map (single source of truth, shared with the frontend) ──
# /app/frontend/src/assistant/pages.json lists every page the assistant can open
# and what it's for. Both the nav buttons and the bot's knowledge read from here,
# so adding a new feature = one line in that file (no re-programming the bot).
_PAGES_PATH = os.path.join(os.path.dirname(__file__), "..", "frontend", "src", "assistant", "pages.json")


def _load_pages():
    try:
        with open(_PAGES_PATH, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception as exc:  # pragma: no cover - map is optional for chat to work
        logger.warning("assistant: could not load page map: %s", exc)
        return []


def _pages_catalog(es: bool) -> str:
    """Human-readable list the model uses to know WHERE everything lives."""
    lines = []
    for p in _load_pages():
        label = p.get("es" if es else "en", p.get("key"))
        desc = p.get("desc_es" if es else "desc_en", "")
        lines.append(f"[[OPEN:{p['key']}]] {label}" + (f" — {desc}" if desc else ""))
    return "; ".join(lines)


# Tools that CHANGE data — never executed inside this service. When the model
# calls one, we stop and hand a "pending action" back to the server, which shows
# the user a confirmation before applying it.
WRITE_TOOLS = {"update_card_photo", "update_logo", "update_business_info", "upsert_service", "create_event",
               "update_contact_links", "create_client", "create_invoice", "record_payment",
               "toggle_website_section", "update_website_photo", "update_website_text", "update_website_color",
               "add_faq", "add_gallery_photo", "add_product", "create_social_post",
               "update_cover_photo", "remove_service", "send_invoice", "fill_website_photos"}

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
            "tagline": {"type": "string", "description": "Short slogan under the business name."},
            "about": {"type": "string", "description": "Short about/description text."},
        }},
    }},
    {"type": "function", "function": {
        "name": "update_cover_photo",
        "description": "Set the digital card's cover/banner photo using an image the user attached.",
        "parameters": {"type": "object", "properties": {
            "image_id": {"type": "string", "description": "The image_id of the photo the user attached."},
        }},
    }},
    {"type": "function", "function": {
        "name": "remove_service",
        "description": "Remove a service from the card/website by its name.",
        "parameters": {"type": "object", "properties": {
            "name": {"type": "string", "description": "Exact name of the service to remove."},
        }, "required": ["name"]},
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
    # ---- Digital card (complete) ----
    {"type": "function", "function": {
        "name": "get_card_stats",
        "description": "Get the digital card's stats: total views, leads captured, reviews.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "update_contact_links",
        "description": "Update the card's contact links and hours. Only include the fields the user wants to change.",
        "parameters": {"type": "object", "properties": {
            "whatsapp": {"type": "string", "description": "Phone for WhatsApp, digits only or E.164."},
            "facebook": {"type": "string"},
            "instagram": {"type": "string"},
            "website": {"type": "string"},
            "hours": {"type": "string"},
        }},
    }},
    # ---- Website ----
    {"type": "function", "function": {
        "name": "get_website_status",
        "description": "Get the website's state: which sections are on/off, how many services/events/products, and the public link.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "toggle_website_section",
        "description": "Turn a website section on or off. Valid sections: services, events, newsletter, about, gallery, reviews, faq, map, products, areas, contact, booking.",
        "parameters": {"type": "object", "properties": {
            "section": {"type": "string"},
            "enabled": {"type": "boolean"},
        }, "required": ["section", "enabled"]},
    }},
    {"type": "function", "function": {
        "name": "update_website_photo",
        "description": "Change a photo on the website using an image the user attached. Targets: 'about' (About Us photo), 'hero' (main top banner image), 'why' (Why-choose-us image), 'band' (mid-page CTA background).",
        "parameters": {"type": "object", "properties": {
            "target": {"type": "string", "description": "one of: about, hero, why, band"},
            "image_id": {"type": "string", "description": "The image_id of the photo the user attached."},
        }, "required": ["target"]},
    }},
    {"type": "function", "function": {
        "name": "update_website_text",
        "description": "Edit the website's text. Only include the fields the user wants to change.",
        "parameters": {"type": "object", "properties": {
            "headline": {"type": "string", "description": "Main hero headline (H1)."},
            "subheadline": {"type": "string", "description": "Subtitle under the headline."},
            "hero_tagline": {"type": "string", "description": "Short slogan above/under the H1."},
            "about": {"type": "string", "description": "Short About Us text on the home page."},
            "about_title": {"type": "string", "description": "About page heading."},
            "about_story": {"type": "string", "description": "Longer About page story."},
        }},
    }},
    {"type": "function", "function": {
        "name": "update_website_color",
        "description": "Change the website's main theme/accent color. Pass a hex code (e.g. scarlet red = #FF2400, royal blue = #1D4ED8). Convert the color the user names into the closest hex.",
        "parameters": {"type": "object", "properties": {
            "color": {"type": "string", "description": "Hex color code, e.g. #FF2400"},
        }, "required": ["color"]},
    }},
    {"type": "function", "function": {
        "name": "add_faq",
        "description": "Add a question & answer to the website's FAQ section.",
        "parameters": {"type": "object", "properties": {
            "question": {"type": "string"},
            "answer": {"type": "string"},
        }, "required": ["question", "answer"]},
    }},
    {"type": "function", "function": {
        "name": "add_gallery_photo",
        "description": "Add a photo the user attached to the website 'Recent Work' / gallery.",
        "parameters": {"type": "object", "properties": {
            "image_id": {"type": "string", "description": "The image_id of the photo the user attached."},
        }},
    }},
    {"type": "function", "function": {
        "name": "add_product",
        "description": "Add a product to the website. Optionally use a photo the user attached.",
        "parameters": {"type": "object", "properties": {
            "name": {"type": "string"},
            "description": {"type": "string"},
            "price": {"type": "string", "description": "Price text, e.g. '$30'."},
            "image_id": {"type": "string", "description": "The image_id of a photo the user attached (optional)."},
        }, "required": ["name"]},
    }},
    {"type": "function", "function": {
        "name": "fill_website_photos",
        "description": "Automatically fill the EMPTY photo slots across the whole website (hero/main banner, About Us, Why-choose-us, the CTA band and EVERY service) AND the digital card background with professional stock photos related to the owner's trade. Never replaces a photo the owner uploaded. Use this whenever the user asks to fill all the photos, auto-add photos, put pictures on the site, or make the site/card look complete with images.",
        "parameters": {"type": "object", "properties": {}},
    }},
    # ---- Invoicing ----
    {"type": "function", "function": {
        "name": "get_pending_payments",
        "description": "Get the owner's outstanding balance and a short list of unpaid/overdue invoices.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "list_invoices",
        "description": "List the most recent invoices with their number, client, total, amount paid and status.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "list_clients",
        "description": "List the owner's clients/customers with phone and email.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "send_invoice",
        "description": "Send the payment link for an invoice to the client by email (needs the client's email on file). Also returns the link to share manually.",
        "parameters": {"type": "object", "properties": {
            "invoice_number": {"type": "string"},
        }, "required": ["invoice_number"]},
    }},
    {"type": "function", "function": {
        "name": "create_client",
        "description": "Add a new client/customer.",
        "parameters": {"type": "object", "properties": {
            "name": {"type": "string"},
            "phone": {"type": "string"},
            "email": {"type": "string"},
            "company": {"type": "string"},
        }, "required": ["name"]},
    }},
    {"type": "function", "function": {
        "name": "create_invoice",
        "description": "Create an invoice for a client. Gather the client name, a job title, and line items (description + amount each) before calling. Ask for anything missing.",
        "parameters": {"type": "object", "properties": {
            "client_name": {"type": "string", "description": "Client's name; if they don't exist yet, they'll be created."},
            "job_title": {"type": "string"},
            "line_items": {"type": "array", "description": "List of line items.", "items": {"type": "object", "properties": {
                "description": {"type": "string"},
                "quantity": {"type": "number"},
                "unit_price": {"type": "number"},
            }, "required": ["description", "unit_price"]}},
            "tax_rate": {"type": "number", "description": "Tax percent, e.g. 8.25. Optional."},
            "due_date": {"type": "string", "description": "ISO date, optional."},
            "notes": {"type": "string"},
        }, "required": ["client_name", "job_title", "line_items"]},
    }},
    {"type": "function", "function": {
        "name": "record_payment",
        "description": "Record a payment received on an invoice (marks it paid/partial).",
        "parameters": {"type": "object", "properties": {
            "invoice_number": {"type": "string", "description": "The invoice number, e.g. INV-2001."},
            "amount": {"type": "number"},
            "method": {"type": "string", "description": "cash, check, zelle, transfer, card, other."},
        }, "required": ["invoice_number", "amount"]},
    }},
    {"type": "function", "function": {
        "name": "get_invoice_link",
        "description": "Get the public shareable payment link for an invoice so the owner can send it to the client.",
        "parameters": {"type": "object", "properties": {
            "invoice_number": {"type": "string"},
        }, "required": ["invoice_number"]},
    }},
    # ---- Marketing Studio ----
    {"type": "function", "function": {
        "name": "list_social_templates",
        "description": "List the available social post design templates the owner can use.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "list_social_posts",
        "description": "List the owner's most recent social media posts (template + headline).",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "create_social_post",
        "description": "Create a branded social media post using one of the templates and a photo the user attached (their work or product). Writes AI copy from the brief. Uses AI credits and takes a few seconds.",
        "parameters": {"type": "object", "properties": {
            "template": {"type": "string", "description": "Template id, e.g. 'showcase', 'promo', 'coupon', 'review_5star'. Default 'showcase'."},
            "brief": {"type": "string", "description": "What the post is about (in the owner's words)."},
            "image_id": {"type": "string", "description": "The image_id of the photo the user attached to use in the post."},
            "language": {"type": "string", "description": "'es' or 'en'."},
        }, "required": ["brief"]},
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
            "Puedes HACER cosas por el usuario usando tus herramientas en las 4 áreas de su panel: "
            "(1) Tarjeta digital: cambiar foto, portada, logo, datos, eslogan, servicios (agregar/quitar), redes/horario, ver vistas y leads. "
            "(2) Sitio web: activar u ocultar secciones, CAMBIAR FOTOS (Sobre Nosotros, banner principal, etc.), RELLENAR AUTOMÁTICAMENTE todas las fotos que faltan con fotos de stock de su oficio (incluido el fondo de la tarjeta digital), CAMBIAR EL COLOR del tema, editar TEXTOS (título, subtítulo, Sobre Nosotros), agregar preguntas frecuentes, fotos a la galería y productos; ver su estado y enlace público. "
            "(3) Facturación: ver pagos pendientes, listar facturas y clientes, crear clientes, CREAR FACTURAS, registrar pagos, ENVIAR la factura al cliente por correo y dar el enlace de cobro. "
            "(4) Marketing: listar plantillas y CREAR posts para redes con la foto que suba el usuario (de su trabajo o productos). "
            "Cuando el usuario quiera cambiar una foto, el logo, o usar una foto en un post y haya adjuntado una imagen, usa la "
            "herramienta correspondiente pasando el image_id que te da el sistema. "
            "En facturación trata el dinero con cuidado: junta primero el cliente, los conceptos y los montos, y si falta algo, pregúntalo. "
            "Si te faltan datos (por ejemplo la fecha de un evento o el monto de un concepto), pregúntalos ANTES de usar la herramienta. "
            "Para ayudar con la configuración de la cuenta, primero usa get_account_status para ver qué falta "
            "y guía al usuario paso a paso, uno a la vez. "
            "Cada cambio se le confirmará al usuario antes de aplicarse, así que propón la acción con confianza. "
            "Si el usuario prefiere hacer el cambio él mismo, quiere ver dónde se hace, o pregunta DÓNDE está algo, "
            "llévalo a la página correcta agregando AL FINAL de tu mensaje la etiqueta [[OPEN:clave]] que corresponda (sin explicarla). "
            "Conoces TODO el sistema; estas son las páginas y para qué sirve cada una: "
            + _pages_catalog(True) +
            ". El sistema convierte la etiqueta en un botón. Elige la clave cuya descripción mejor coincida con lo que pide el usuario. "
            "Sé breve y cálido."
        )
    return (
        "You are the Unitech Assistant, a friendly, patient virtual employee who helps non-technical "
        f"business owners use their Unitech account (digital card, website, services, events, newsletter).{who} "
        "Speak plainly, no jargon, in English. "
        "You can DO things for the user with your tools across the 4 areas of their dashboard: "
        "(1) Digital card: change photo, cover, logo, business info, tagline, services (add/remove), contact links/hours, view visits and leads. "
        "(2) Website: turn sections on/off, CHANGE PHOTOS (About Us, main banner, etc.), AUTO-FILL every missing photo with trade-relevant stock photos (including the digital card background), CHANGE THE theme COLOR, edit TEXT (headline, subtitle, About), add FAQs, gallery photos and products; see its status and public link. "
        "(3) Invoicing: see pending payments, list invoices and clients, create clients, CREATE INVOICES, record payments, EMAIL the invoice to the client, and get the payment link. "
        "(4) Marketing: list templates and CREATE social posts using a photo the user uploads (their work or products). "
        "When the user wants to change a photo, the logo, or use a photo in a post and has attached an image, call the "
        "matching tool passing the image_id the system gives you. In invoicing, handle money carefully: gather the client, "
        "line items and amounts first, and ask for anything missing. "
        "If details are missing (e.g. an event date or a line-item amount), ask first. To help set up the account, call "
        "get_account_status first to see what's missing and guide step by step. Every change is confirmed "
        "with the user before applying. If the user prefers to make a change themselves, wants to see where it's done, "
        "or asks WHERE something is, take them to the right page by adding the matching [[OPEN:key]] tag AT THE END of your message (don't explain it). "
        "You know the WHOLE system; these are the pages and what each is for: "
        + _pages_catalog(False) +
        ". The system turns the tag into a button. Pick the key whose description best matches what the user asked. Be brief and warm."
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
    if name == "update_contact_links":
        parts = [f"{k}: {v}" for k, v in args.items() if v]
        joined = "; ".join(parts)
        return (f"Voy a actualizar tus contactos → {joined}. ¿Confirmas?") if es \
            else (f"I'll update your contact links → {joined}. Confirm?")
    if name == "toggle_website_section":
        state = ("activar" if args.get("enabled") else "ocultar") if es else ("show" if args.get("enabled") else "hide")
        return (f"Voy a {state} la sección \"{args.get('section','')}\" de tu sitio. ¿Confirmas?") if es \
            else (f"I'll {state} the \"{args.get('section','')}\" section on your site. Confirm?")
    if name == "update_website_photo":
        labels = {"about": "Sobre Nosotros", "hero": "banner principal", "why": "por qué elegirnos", "band": "banner de llamada a la acción"}
        labels_en = {"about": "About Us", "hero": "main banner", "why": "why-choose-us", "band": "CTA band"}
        tgt = (args.get("target") or "about")
        return (f"Voy a cambiar la foto de \"{labels.get(tgt, tgt)}\" en tu sitio con la imagen que enviaste. ¿Confirmas?") if es \
            else (f"I'll change the \"{labels_en.get(tgt, tgt)}\" photo on your site with the image you sent. Confirm?")
    if name == "update_website_text":
        parts = [f"{k}: {str(v)[:60]}" for k, v in args.items() if v]
        joined = "; ".join(parts)
        return (f"Voy a actualizar el texto de tu sitio → {joined}. ¿Confirmas?") if es \
            else (f"I'll update your website text → {joined}. Confirm?")
    if name == "update_website_color":
        return (f"Voy a cambiar el color principal de tu sitio a {args.get('color','')}. ¿Confirmas?") if es \
            else (f"I'll change your website's main color to {args.get('color','')}. Confirm?")
    if name == "add_faq":
        return (f"Voy a agregar esta pregunta frecuente: \"{args.get('question','')}\". ¿Confirmas?") if es \
            else (f"I'll add this FAQ: \"{args.get('question','')}\". Confirm?")
    if name == "add_gallery_photo":
        return ("Voy a agregar la foto que enviaste a tu galería de trabajos. ¿Confirmas?") if es \
            else ("I'll add the photo you sent to your work gallery. Confirm?")
    if name == "add_product":
        return (f"Voy a agregar el producto \"{args.get('name','')}\" a tu sitio. ¿Confirmas?") if es \
            else (f"I'll add the product \"{args.get('name','')}\" to your site. Confirm?")
    if name == "fill_website_photos":
        return ("Voy a rellenar con fotos profesionales de tu oficio todos los espacios vacíos de tu sitio "
                "(portada, Sobre Nosotros, \u201cpor qué elegirnos\u201d, el banner y todos tus servicios) y el fondo de tu "
                "tarjeta digital. No reemplazaré las fotos que tú subiste. ¿Confirmas?") if es \
            else ("I'll fill every empty photo slot on your site (hero, About Us, why-us, the CTA band and all your "
                  "services) and your digital card background with professional photos from your trade. I won't "
                  "replace photos you uploaded. Confirm?")
    if name == "create_client":
        return (f"Voy a agregar al cliente \"{args.get('name','')}\". ¿Confirmas?") if es \
            else (f"I'll add the client \"{args.get('name','')}\". Confirm?")
    if name == "create_invoice":
        items = args.get("line_items") or []
        total = sum(float(i.get("unit_price", 0) or 0) * float(i.get("quantity", 1) or 1) for i in items)
        return (f"Voy a crear una factura para \"{args.get('client_name','')}\" ({args.get('job_title','')}), {len(items)} concepto(s), subtotal ~${total:,.2f}. ¿Confirmas?") if es \
            else (f"I'll create an invoice for \"{args.get('client_name','')}\" ({args.get('job_title','')}), {len(items)} item(s), subtotal ~${total:,.2f}. Confirm?")
    if name == "record_payment":
        return (f"Voy a registrar un pago de ${float(args.get('amount',0)):,.2f} ({args.get('method','efectivo')}) en la factura {args.get('invoice_number','')}. ¿Confirmas?") if es \
            else (f"I'll record a ${float(args.get('amount',0)):,.2f} payment ({args.get('method','cash')}) on invoice {args.get('invoice_number','')}. Confirm?")
    if name == "create_social_post":
        return (f"Voy a crear un post de marketing (plantilla \"{args.get('template','showcase')}\") con tu foto y el texto que generaré. Usa créditos de IA y tarda unos segundos. ¿Confirmas?") if es \
            else (f"I'll create a marketing post (template \"{args.get('template','showcase')}\") with your photo and AI-written copy. Uses AI credits, takes a few seconds. Confirm?")
    if name == "update_cover_photo":
        return ("Voy a poner la imagen que enviaste como la foto de portada de tu tarjeta. ¿Confirmas?") if es \
            else ("I'll set the image you sent as your card's cover photo. Confirm?")
    if name == "remove_service":
        return (f"Voy a quitar el servicio \"{args.get('name','')}\" de tu tarjeta y sitio. ¿Confirmas?") if es \
            else (f"I'll remove the service \"{args.get('name','')}\" from your card and site. Confirm?")
    if name == "send_invoice":
        return (f"Voy a enviar el enlace de pago de la factura {args.get('invoice_number','')} al correo del cliente. ¿Confirmas?") if es \
            else (f"I'll email the payment link for invoice {args.get('invoice_number','')} to the client. Confirm?")
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
