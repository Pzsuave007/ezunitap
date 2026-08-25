"""Pexels stock-photo helper.

Fetches trade-relevant stock photos from the Pexels API so the Website Builder
can auto-fill hero / service / section images when the owner clicks
"Generate with AI" (or the dedicated "get stock photos" button).

Best-effort: every function returns empty / raises softly so a Pexels outage
never breaks content generation.
"""
from __future__ import annotations

import logging
import os
import random

import httpx

logger = logging.getLogger(__name__)

PEXELS_API_KEY = os.environ.get("PEXELS_API_KEY", "")
_BASE = "https://api.pexels.com/v1/search"

# Substring → English Pexels search hint for the trade. Matched case-insensitive
# against the owner's business_type (which may be English or Spanish).
_TRADE_QUERIES = {
    "plumb": "plumber working pipes",
    "plomer": "plumber working pipes",
    "hvac": "hvac technician air conditioning unit",
    "aire": "hvac air conditioning technician",
    "climatiz": "hvac air conditioning technician",
    "electric": "electrician working wiring",
    "roof": "roofing contractor roof shingles",
    "techo": "roofing contractor roof shingles",
    "paint": "house painter painting wall",
    "pintur": "house painter painting wall",
    "clean": "professional home cleaning service",
    "limpiez": "professional home cleaning service",
    "landscap": "landscaping lawn garden yard",
    "jardin": "landscaping lawn garden yard",
    "garden": "landscaping lawn garden yard",
    "cesped": "lawn care mowing grass",
    "construct": "construction worker job site",
    "construc": "construction worker job site",
    "concrete": "concrete driveway construction",
    "concreto": "concrete driveway construction",
    "handyman": "handyman home repair tools",
    "remodel": "home remodeling renovation interior",
    "floor": "flooring installation hardwood",
    "piso": "flooring installation hardwood",
    "fenc": "fence installation backyard",
    "cerca": "fence installation backyard",
    "tree": "tree service arborist trimming",
    "arbol": "tree service arborist trimming",
    "pest": "pest control exterminator service",
    "plaga": "pest control exterminator service",
    "pool": "swimming pool cleaning service",
    "piscina": "swimming pool cleaning service",
    "alberca": "swimming pool cleaning service",
    "window": "window installation home",
    "ventana": "window installation home",
    "junk": "junk removal hauling crew",
    "mov": "moving company movers boxes",
    "mudanz": "moving company movers boxes",
    "kitchen": "kitchen remodel renovation",
    "cocina": "kitchen remodel renovation",
    "bath": "bathroom remodel renovation",
    "baño": "bathroom remodel renovation",
    "drywall": "drywall installation contractor",
    "tabla": "drywall installation contractor",
    "auto": "auto repair mechanic garage",
    "mecanic": "auto repair mechanic garage",
    "nail": "nail salon manicure",
    "uña": "nail salon manicure",
    "una": "nail salon manicure",
    "manicur": "manicure nail salon",
    "pedicur": "pedicure nail spa",
    "salon": "beauty salon interior",
    "salón": "beauty salon interior",
    "beauty": "beauty salon interior",
    "belleza": "beauty salon interior",
    "spa": "spa wellness treatment",
    "lash": "eyelash extensions beauty",
    "pestañ": "eyelash extensions beauty",
    "makeup": "makeup artist beauty",
    "maquill": "makeup artist beauty",
    "hair": "hair salon stylist",
    "cabello": "hair salon stylist",
    "peluqu": "hair salon stylist",
    "barber": "barber shop haircut",
    "estilis": "hair salon stylist",
    "tattoo": "tattoo studio artist",
    "tatua": "tattoo studio artist",
    "photo": "professional photographer camera",
    "foto": "professional photographer camera",
    "cater": "catering food service event",
    "bak": "bakery pastry chef",
    "panad": "bakery pastry chef",
    "reposter": "bakery pastry desserts",
}


def trade_query(business_type: str = "") -> str:
    """Best English search phrase for the owner's trade."""
    bt = (business_type or "").lower().strip()
    for key, q in _TRADE_QUERIES.items():
        if key in bt:
            return q
    if bt:
        return f"{business_type} professional service"
    return "home service contractor at work"


async def search_photos(query: str, per_page: int = 12, orientation: str = "landscape", page: int = 1) -> list[str]:
    """Return a list of large image URLs for `query`. Empty list on any failure."""
    if not PEXELS_API_KEY:
        logger.warning("PEXELS_API_KEY not set; skipping stock photo fetch")
        return []
    params = {
        "query": query,
        "per_page": max(1, min(int(per_page or 12), 40)),
        "orientation": orientation,
        "page": max(1, int(page or 1)),
    }
    headers = {"Authorization": PEXELS_API_KEY}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(_BASE, params=params, headers=headers)
        if r.status_code != 200:
            logger.warning("pexels search %r -> HTTP %s", query, r.status_code)
            return []
        photos = (r.json() or {}).get("photos", []) or []
        urls = []
        for p in photos:
            src = p.get("src") or {}
            url = src.get("large2x") or src.get("large") or src.get("original")
            if url:
                urls.append(url)
        return urls
    except Exception as e:  # noqa: BLE001
        logger.warning("pexels search %r failed: %r", query, e)
        return []


async def download_image(url: str) -> tuple[bytes, str]:
    """Download an image URL → (bytes, content_type). Raises on failure."""
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        r = await client.get(url)
        r.raise_for_status()
        return r.content, (r.headers.get("content-type") or "image/jpeg")


async def fetch_trade_pool(business_type: str = "", count: int = 12, refresh: bool = False) -> list[str]:
    """Return a pool of landscape stock-photo URLs for the trade."""
    q = trade_query(business_type)
    # When refreshing (owner asked for different photos) pull a random page for variety.
    page = random.randint(1, 3) if refresh else 1
    urls = await search_photos(q, per_page=count, orientation="landscape", page=page)
    if not urls and page != 1:
        urls = await search_photos(q, per_page=count, orientation="landscape", page=1)
    return urls
