#!/usr/bin/env python3
"""
Fix de datos AI/SEO para Uni2 Marketing Group / Growth Ally.
- Teléfono muerto (888) 689-4979  ->  (503) 985-6472 (en TODOS los campos/idiomas)
- Nombre "Uni2 Marketing Agency" / "Agencia Uni2 Marketing" -> "Uni2 Marketing Group"
- "por más de 25 años"  ->  "con más de 25 años de experiencia" (claim honesto)
- Define NAP + entidad en el usuario: ciudad Spokane, estado WA, país US,
  legalName "Growth Ally LLC", alternateName "Growth Ally Agency",
  schema_type "ProfessionalService", areaServed = United States.

SOLO toca el sitio cuyo dominio es uni2mkt.com / growthally.agency (y www).
No toca ningún otro inquilino.

USO:
  # 1) Previsualizar (no escribe nada):
  /opt/ezunitap/backend/venv/bin/python /home/ezunitap/repo/deploy/fix_uni2_seo.py
  # 2) Aplicar de verdad:
  /opt/ezunitap/backend/venv/bin/python /home/ezunitap/repo/deploy/fix_uni2_seo.py --apply
"""
import os
import re
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None

# Cargar MONGO_URL / DB_NAME del .env del backend en producción.
for _p in (os.environ.get("ENV_FILE"),
           "/opt/ezunitap/backend/.env",
           "/home/ezunitap/repo/backend/.env"):
    if _p and Path(_p).exists() and load_dotenv:
        load_dotenv(_p)
        break

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
if not MONGO_URL or not DB_NAME:
    print("ERROR: no encontré MONGO_URL / DB_NAME. Exporta ENV_FILE=/ruta/.env o corre con el venv del backend.")
    sys.exit(1)

APPLY = "--apply" in sys.argv
PHONE = "(503) 985-6472"
DOMAINS = ["uni2mkt.com", "www.uni2mkt.com", "growthally.agency", "www.growthally.agency"]


def fix_str(s: str) -> str:
    out = s
    # Teléfono muerto en cualquier formato -> canónico.
    # Primero los enlaces tel: (sin separadores) para no romperlos, luego el display.
    out = re.sub(r"(tel:\+?1?)8886894979", r"\g<1>5039856472", out)
    out = out.replace("8886894979", "5039856472")
    out = re.sub(r"\(?888\)?[\s.\-]*689[\s.\-]*4979", PHONE, out)
    # Nombre de marca estandarizado
    out = out.replace("Uni2 Marketing Agency", "Uni2 Marketing Group")
    out = out.replace("Agencia Uni2 Marketing", "Uni2 Marketing Group")
    # Claim de experiencia honesto (sin crear "de experiencia de experiencia")
    out = out.replace(
        "empoderar emprendedores latinos por más de 25 años",
        "empoderar emprendedores latinos con más de 25 años de experiencia",
    )
    out = re.sub(r"por más de 25 años(?! de experiencia)",
                 "con más de 25 años de experiencia", out)
    out = re.sub(r"(founded )?(more than|over) 25 years ago",
                 "with more than 25 years of experience", out, flags=re.I)
    return out


def walk(obj):
    if isinstance(obj, str):
        return fix_str(obj)
    if isinstance(obj, list):
        return [walk(x) for x in obj]
    if isinstance(obj, dict):
        return {k: walk(v) for k, v in obj.items()}
    return obj


def main():
    from pymongo import MongoClient
    db = MongoClient(MONGO_URL)[DB_NAME]

    sites = list(db.websites.find({"$or": [
        {"custom_domain": {"$in": DOMAINS}},
        {"custom_domain_2": {"$in": DOMAINS}},
    ]}))
    if not sites:
        print("No se encontró ningún sitio con dominio uni2mkt.com / growthally.agency. Nada que hacer.")
        sys.exit(1)

    print(f"{'=== APLICANDO CAMBIOS ===' if APPLY else '=== VISTA PREVIA (no se escribe nada) ==='}\n")
    user_ids = set()

    for w in sites:
        user_ids.add(w["user_id"])
        new = walk(w)
        new["cta_phone"] = PHONE
        changed = {k: v for k, v in new.items() if k != "_id" and w.get(k) != v}
        # Service area nacional (para areaServed del schema)
        if not (w.get("service_area") or "").strip():
            changed["service_area"] = "United States"
        print(f"SITIO slug={w.get('slug')} dom={w.get('custom_domain')} / {w.get('custom_domain_2')}")
        for k in sorted(changed):
            print(f"   - {k}: {str(w.get(k))[:60]!r} -> {str(changed[k])[:60]!r}")
        if APPLY and changed:
            db.websites.update_one({"_id": w["_id"]}, {"$set": changed})

    for uid in user_ids:
        u = db.users.find_one({"id": uid})
        if not u:
            continue
        nu = walk(u)
        nu.update({
            "business_name": "Uni2 Marketing Group",
            "business_city": "Spokane",
            "business_state": "WA",
            "business_country": "US",
            "legal_name": "Growth Ally LLC",
            "alternate_name": "Growth Ally Agency",
            "schema_type": "ProfessionalService",
            "phone": PHONE,
        })
        if not (u.get("business_address") or "").strip():
            nu["business_address"] = "Spokane, WA"
        changed = {k: v for k, v in nu.items() if k != "_id" and u.get(k) != v}
        print(f"\nUSUARIO email={u.get('email')} id={uid}")
        for k in sorted(changed):
            print(f"   - {k}: {str(u.get(k))[:60]!r} -> {str(changed[k])[:60]!r}")
        if APPLY and changed:
            db.users.update_one({"id": uid}, {"$set": changed})
        # Teléfono de la tarjeta (fallback) -> canónico
        cards = list(db.cards.find({"user_id": uid}))
        for c in cards:
            if (c.get("contact_phone") or "") != PHONE:
                print(f"   - card.contact_phone: {str(c.get('contact_phone'))[:40]!r} -> {PHONE!r}")
                if APPLY:
                    db.cards.update_one({"_id": c["_id"]}, {"$set": {"contact_phone": PHONE}})

    print("\n" + ("✅ Cambios aplicados." if APPLY else "ℹ️  Vista previa. Para aplicar: agrega  --apply"))


if __name__ == "__main__":
    main()
