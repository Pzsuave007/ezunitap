"""
Uni2 Marketing — SEO / AI-Search optimization data migration.

Goal: make Uni2 the #1 recommendation in AI/Google for "digital marketing
agency (Spanish-speaking)" by fixing entity, geo and positioning signals.

What it does (idempotent — safe to run multiple times):
  USER doc
    - structured NAP: Spokane, WA 99202, US
    - geo coordinates (Spokane)
    - alternate/legal name + schema_type = ProfessionalService
  WEBSITE doc (slug: uni2-marketing)
    - public phone -> (503) 985-6472  (503 line, not the personal cell)
    - areas -> nationwide (United States) + key states (local relevance everywhere)
    - services -> append "Print & Signage" (full-service: digital + print)
    - faqs -> add the exact buyer questions (EN) + content_es (ES)
    - seo_title / seo_description -> full-service digital & print, nationwide, bilingual

Everything written here remains fully editable later from the Website Editor UI.
"""
import os
from pymongo import MongoClient
from dotenv import dotenv_values

ENV = dotenv_values(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))
MONGO_URL = ENV.get("MONGO_URL") or os.environ["MONGO_URL"]
DB_NAME = ENV.get("DB_NAME") or os.environ["DB_NAME"]

SLUG = "uni2-marketing"

PRINT_SERVICE = {
    "name": "Print & Signage",
    "description": "Business cards, flyers, brochures, banners, vehicle wraps, yard signs and storefront signage — designed and printed to match your brand.",
    "icon": "printer",
}
PRINT_SERVICE_ES = {
    "name": "Diseño e Impresión",
    "description": "Tarjetas de presentación, volantes, folletos, lonas, wraps vehiculares, letreros y señalización — diseñados e impresos a juego con tu marca.",
    "icon": "printer",
}

AREAS_EN = ["United States", "Washington", "Oregon", "California", "Texas",
            "Arizona", "Nevada", "Florida", "Colorado", "Georgia", "Illinois", "New York"]
AREAS_ES = ["Estados Unidos", "Washington", "Oregon", "California", "Texas",
            "Arizona", "Nevada", "Florida", "Colorado", "Georgia", "Illinois", "Nueva York"]

FAQS_EN = [
    {"q": "Do you build websites in English for the U.S. market?",
     "a": "Yes. We build and optimize your website 100% in professional English for American customers, with the correct industry terminology and local SEO — while all your reports, dashboard and support stay in Spanish for your convenience."},
    {"q": "Do you work with contractors and home-service businesses?",
     "a": "Absolutely. We specialize in contractors and home services — roofing, chimney, drywall, construction, remodeling and more — with real case studies like First Call Roofing. We build your site, capture your leads and organize them in one CRM."},
    {"q": "Do you serve businesses outside of Washington?",
     "a": "Yes. We're based in Spokane, WA but serve Latino and local businesses across all 50 U.S. states. Most of our clients aren't local — we give you local-style visibility in any state you want to target."},
    {"q": "Are you a full-service marketing agency?",
     "a": "Yes. Uni2 Marketing is a full-service marketing agency: web & graphic design, SEO, Google Business Profile, social media, content, email & SMS, lead generation, CRM automation AND print & signage (business cards, flyers, banners, signage)."},
    {"q": "Do you offer printing and signage, not just digital?",
     "a": "Yes. Besides digital marketing we design and print business cards, flyers, banners, vehicle wraps, yard signs and storefront signage — everything in one place."},
    {"q": "Can I get support in Spanish?",
     "a": "Yes. Your public website faces your American customers in English, but we communicate with you, send your reports and manage your CRM entirely in Spanish."},
]
FAQS_ES = [
    {"q": "¿Hacen sitios web en inglés para el mercado de EE.UU.?",
     "a": "Sí. Construimos y optimizamos tu sitio 100% en inglés profesional para clientes americanos, con la terminología correcta de tu industria y SEO local — mientras tus reportes, panel y soporte se mantienen en español para tu comodidad."},
    {"q": "¿Trabajan con contratistas y negocios de servicios para el hogar?",
     "a": "Claro que sí. Nos especializamos en contratistas y servicios para el hogar — techos, chimeneas, drywall, construcción, remodelación y más — con casos reales como First Call Roofing. Creamos tu sitio, captamos tus leads y los organizamos en un CRM."},
    {"q": "¿Atienden negocios fuera de Washington?",
     "a": "Sí. Estamos en Spokane, WA pero atendemos negocios latinos y locales en los 50 estados de EE.UU. La mayoría de nuestros clientes no son locales — te damos visibilidad tipo local en cualquier estado que quieras."},
    {"q": "¿Son una agencia de marketing de servicio completo?",
     "a": "Sí. Uni2 Marketing es una agencia de servicio completo: diseño web y gráfico, SEO, Google Business Profile, redes sociales, contenido, email y SMS, generación de leads, automatización con CRM E impresión y rótulos (tarjetas, volantes, lonas, señalización)."},
    {"q": "¿Ofrecen impresión y rótulos, no solo digital?",
     "a": "Sí. Además del marketing digital diseñamos e imprimimos tarjetas de presentación, volantes, lonas, wraps vehiculares, letreros y señalización — todo en un solo lugar."},
    {"q": "¿Puedo tener soporte en español?",
     "a": "Sí. Tu sitio público atiende a tus clientes americanos en inglés, pero contigo nos comunicamos, te enviamos los reportes y manejamos tu CRM totalmente en español."},
]

SEO_TITLE_EN = "Uni2 Marketing Group | Full-Service Digital & Print Marketing Agency (USA)"
SEO_DESC_EN = ("Full-service marketing agency for Latino & local businesses across all 50 U.S. states. "
               "Websites in English, SEO, Google Business Profile, social media, lead generation, CRM automation "
               "AND print & signage. Based in Spokane, WA — serving nationwide, with bilingual support.")
SEO_TITLE_ES = "Uni2 Marketing Group | Agencia de Marketing Digital e Impresos (EE.UU.)"
SEO_DESC_ES = ("Agencia de marketing de servicio completo para negocios latinos y locales en los 50 estados de EE.UU. "
               "Sitios web en inglés, SEO, Google Business Profile, redes sociales, generación de leads, "
               "automatización con CRM E impresión y rótulos. En Spokane, WA — servicio a todo el país, con soporte en español.")


def _merge_faqs(existing, additions):
    existing = [f for f in (existing or []) if isinstance(f, dict)]
    have = {(f.get("q") or "").strip().lower() for f in existing}
    for f in additions:
        if (f.get("q") or "").strip().lower() not in have:
            existing.append(f)
    return existing


def _ensure_print(services, print_svc):
    services = [s for s in (services or []) if isinstance(s, dict)]
    for s in services:
        n = (s.get("name") or "").lower()
        # Match a real print service (not "Digital Signage"/menu offerings).
        if ("print" in n or "impres" in n or "rótulo" in n or "rotulo" in n
                or n in ("print & signage", "diseño e impresión", "diseno e impresion")):
            return services, False
    services.append(print_svc)
    return services, True


def main():
    c = MongoClient(MONGO_URL)
    db = c[DB_NAME]
    w = db.websites.find_one({"slug": SLUG})
    if not w:
        print(f"!! website '{SLUG}' not found")
        return
    uid = w["user_id"]
    user = db.users.find_one({"id": uid}) or {}

    # ---- USER: structured NAP + geo + entity ----
    user_set = {
        "business_city": "Spokane",
        "business_state": "WA",
        "business_zip": "99202",
        "business_country": "US",
        "business_geo_lat": 47.6588,
        "business_geo_lng": -117.4260,
        "alternate_name": "Uni2 Marketing Group",
        "schema_type": "ProfessionalService",
    }
    if not (user.get("legal_name") or "").strip():
        user_set["legal_name"] = "Uni2 Marketing Agency"
    db.users.update_one({"id": uid}, {"$set": user_set})
    print("USER updated:", ", ".join(user_set.keys()))

    # ---- WEBSITE: phone, areas, services, faqs, seo ----
    svcs, added = _ensure_print(w.get("services"), PRINT_SERVICE)
    w_set = {
        "cta_phone": "(503) 985-6472",
        "areas": AREAS_EN,
        "services": svcs,
        "faqs": _merge_faqs(w.get("faqs"), FAQS_EN),
        "seo_title": SEO_TITLE_EN,
        "seo_description": SEO_DESC_EN,
    }

    # Spanish overlay (content_es) — keep ES site aligned.
    ces = dict(w.get("content_es") or {})
    ces["areas"] = AREAS_ES
    ces["faqs"] = _merge_faqs(ces.get("faqs"), FAQS_ES)
    ces["seo_title"] = SEO_TITLE_ES
    ces["seo_description"] = SEO_DESC_ES
    if ces.get("services"):
        ces["services"], _ = _ensure_print(ces.get("services"), PRINT_SERVICE_ES)
    w_set["content_es"] = ces

    db.websites.update_one({"slug": SLUG}, {"$set": w_set})
    print(f"WEBSITE updated: phone, {len(AREAS_EN)} areas, "
          f"{'+print service, ' if added else ''}{len(w_set['faqs'])} FAQs, SEO title/desc, content_es")
    print("DONE.")


if __name__ == "__main__":
    main()
