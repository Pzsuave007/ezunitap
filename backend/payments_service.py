"""Stripe Subscriptions service for UniTech.

Implements:
- Real Stripe Subscriptions with `trial_period_days=14` (card-on-file)
- Auto-charge after trial ends if not cancelled
- Webhooks for subscription lifecycle events
- Customer Portal for self-service management

Three plans:
    pro_monthly  -> $49.00/month
    pro_yearly   -> $390.00/year
    founder      -> $290.00/year (Founder Deal — promotional)

Stripe Products / Prices are created lazily on first checkout request and
cached in the MongoDB `app_config` collection (key=`stripe_prices`) so the
business owner does not need to configure anything in the Stripe Dashboard.
"""
from __future__ import annotations

import logging
import os
import time
from typing import Optional

import stripe

logger = logging.getLogger(__name__)

stripe.api_key = os.environ.get("STRIPE_API_KEY", "")
# Emergent-managed Stripe test key uses a special proxy endpoint.
if "sk_test_emergent" in stripe.api_key:
    stripe.api_base = "https://integrations.emergentagent.com/stripe"

# ============================================================================
# MODULAR PLANS — each subscription is ONE plan: a single module OR the bundle.
# (Any 2 individual modules ≈ the bundle price, so customers realistically pick
#  one module or the bundle.) The `features` a plan unlocks drive per-module
# access control across the app.
#   Features: "card" (NFC card + mini-site + reviews),
#             "business" (quotes/invoices/contracts AI + CRM + calendar),
#             "marketing" (Marketing Studio: posts + reels).
# ============================================================================
FEATURES_ALL = ["card", "business", "marketing"]

MODULES = {
    "presencia": {
        "label": "Presencia Digital",
        "features": ["card"],
        "tagline": "Tarjeta digital NFC + mini-sitio web + Reseñas de Google",
        "ships_card": True,
    },
    "negocio": {
        "label": "Gestión de Negocio",
        "features": ["business"],
        "tagline": "Presupuestos, facturas y contratos con IA + CRM + Calendario",
        "ships_card": False,
    },
    "marketing": {
        "label": "Marketing",
        "features": ["marketing"],
        "tagline": "Estudio de Marketing: posts y videos con IA",
        "ships_card": False,
    },
    "presencia_negocio": {
        "label": "Presencia + Negocio",
        "features": ["card", "business"],
        "tagline": "Tarjeta digital + toda la gestión de negocio (CRM, facturas, presupuestos)",
        "ships_card": True,
    },
    "presencia_marketing": {
        "label": "Presencia + Marketing",
        "features": ["card", "marketing"],
        "tagline": "Tarjeta digital + Estudio de Marketing con IA",
        "ships_card": True,
    },
    "negocio_marketing": {
        "label": "Negocio + Marketing",
        "features": ["business", "marketing"],
        "tagline": "Gestión de negocio completa + Estudio de Marketing con IA",
        "ships_card": False,
    },
    "bundle": {
        "label": "Todo UniTech",
        "features": ["card", "business", "marketing"],
        "tagline": "Todas las herramientas en un solo plan",
        "ships_card": True,
    },
}

# Monthly price (cents) per base module. Yearly = x10 (2 months free).
# Combos of 2 modules = 30% off the sum of their individual monthly prices.
_MODULE_MONTHLY_CENTS = {
    "presencia": 1999,
    "negocio": 3999,
    "marketing": 2999,
    "presencia_negocio": 4199,    # (1999+3999) -30%
    "presencia_marketing": 3499,  # (1999+2999) -30%
    "negocio_marketing": 4899,    # (3999+2999) -30%
    "bundle": 5999,
}


def _build_plans() -> dict:
    plans = {}
    for base, mod in MODULES.items():
        monthly = _MODULE_MONTHLY_CENTS[base]
        for interval, cents in (("month", monthly), ("year", monthly * 10)):
            pid = f"{base}_{'monthly' if interval == 'month' else 'yearly'}"
            plans[pid] = {
                "id": pid,
                "base": base,
                "name": mod["label"] + (" (Anual)" if interval == "year" else ""),
                "description": mod["tagline"],
                "features": mod["features"],
                "amount_cents": cents,
                "currency": "usd",
                "interval": interval,
                "interval_count": 1,
                "display_price": f"${cents / 100:.2f}",
                "display_period": "/año" if interval == "year" else "/mes",
                "is_bundle": base == "bundle",
                "is_combo": ("_" in base) and base != "bundle",
                "ships_card": mod["ships_card"],
                "trial_period_days": 0,
            }
    return plans


PLANS = _build_plans()
PLAN_FEATURES = {base: set(mod["features"]) for base, mod in MODULES.items()}


def plan_base(plan_type: Optional[str]) -> str:
    """`presencia_monthly` -> `presencia`. Legacy `pro_monthly` -> `pro`."""
    if not plan_type:
        return ""
    return plan_type.rsplit("_", 1)[0]


def list_plans() -> list[dict]:
    """Grouped plans for the pricing page: one card per module, each with
    monthly + yearly options."""
    out = []
    for base, mod in MODULES.items():
        m = PLANS[f"{base}_monthly"]
        y = PLANS[f"{base}_yearly"]
        out.append({
            "base": base,
            "label": mod["label"],
            "tagline": mod["tagline"],
            "features": mod["features"],
            "is_bundle": base == "bundle",
            "is_combo": ("_" in base) and base != "bundle",
            "ships_card": mod["ships_card"],
            "monthly": {
                "plan_id": m["id"],
                "amount_cents": m["amount_cents"],
                "display_price": m["display_price"],
            },
            "yearly": {
                "plan_id": y["id"],
                "amount_cents": y["amount_cents"],
                "display_price": y["display_price"],
                "per_month": f"${(y['amount_cents'] / 12) / 100:.2f}",
            },
        })
    return out


def get_plan(plan_id: str) -> Optional[dict]:
    return PLANS.get(plan_id)


# Price for each ADDITIONAL digital card (the base plan already includes 1).
# Keyed by billing interval so monthly plans bill monthly and yearly plans yearly.
EXTRA_CARD_PRICE_CENTS = {
    "month": 1500,   # $15.00 / month per extra card
    "year": 15000,   # $150.00 / year per extra card (~2 months free)
}


def extra_card_display_price(interval: str) -> str:
    cents = EXTRA_CARD_PRICE_CENTS.get(interval, 1500)
    return f"${cents // 100}"


async def ensure_extra_card_price(db, interval: str) -> str:
    """Return a reusable Stripe Price id for the extra-card add-on at the given
    interval, creating the Product/Price once and caching it in app_config."""
    config = await db.app_config.find_one({"key": "stripe_extra_card_prices"})
    cache: dict = (config or {}).get("data") or {}
    if cache.get(interval, {}).get("price_id"):
        return cache[interval]["price_id"]
    product = stripe.Product.create(
        name="UniTech — Tarjeta digital adicional",
        description="Tarjeta digital inteligente adicional para tu equipo",
        metadata={"app": "unitap", "kind": "extra_card", "interval": interval},
    )
    price = stripe.Price.create(
        product=product.id,
        unit_amount=EXTRA_CARD_PRICE_CENTS.get(interval, 1500),
        currency="usd",
        recurring={"interval": interval, "interval_count": 1},
        metadata={"app": "unitap", "kind": "extra_card"},
    )
    cache[interval] = {"product_id": product.id, "price_id": price.id}
    await db.app_config.update_one(
        {"key": "stripe_extra_card_prices"},
        {"$set": {"key": "stripe_extra_card_prices", "data": cache}},
        upsert=True,
    )
    return price.id


def _extra_card_price_ids(cache: dict) -> set:
    return {v.get("price_id") for v in (cache or {}).values() if v.get("price_id")}


async def ensure_stripe_prices(db) -> dict:
    """Create Stripe products + recurring prices for each plan if missing.

    Caches resulting IDs in MongoDB `app_config` (one document keyed by
    `stripe_prices`). Returns a {plan_id: price_id} mapping.
    """
    config = await db.app_config.find_one({"key": "stripe_prices"})
    cache: dict = (config or {}).get("data") or {}

    changed = False
    for plan_id, plan in PLANS.items():
        if plan_id in cache and cache[plan_id].get("price_id"):
            continue
        # Create product
        product = stripe.Product.create(
            name=f"UniTech — {plan['name']}",
            description=plan["description"],
            metadata={"plan_id": plan_id, "app": "unitap"},
        )
        # Create recurring price
        price = stripe.Price.create(
            product=product.id,
            unit_amount=plan["amount_cents"],
            currency=plan["currency"],
            recurring={
                "interval": plan["interval"],
                "interval_count": plan["interval_count"],
            },
            metadata={"plan_id": plan_id, "app": "unitap"},
        )
        cache[plan_id] = {"product_id": product.id, "price_id": price.id}
        changed = True
        logger.info(f"Created Stripe price for {plan_id}: {price.id}")

    if changed:
        await db.app_config.update_one(
            {"key": "stripe_prices"},
            {"$set": {"key": "stripe_prices", "data": cache}},
            upsert=True,
        )
    return cache


async def get_or_create_customer(db, user: dict) -> str:
    """Return a Stripe Customer ID for the user. Creates one if missing."""
    if user.get("stripe_customer_id"):
        return user["stripe_customer_id"]
    customer = stripe.Customer.create(
        email=user["email"],
        name=user.get("business_name") or user.get("owner_name") or user["email"],
        metadata={"user_id": user["id"], "app": "unitap"},
    )
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"stripe_customer_id": customer.id}},
    )
    return customer.id


async def create_checkout_session(
    db,
    user: dict,
    plan_id: str,
    success_url: str,
    cancel_url: str,
    num_cards: int = 1,
) -> dict:
    """Create a Stripe Checkout Session for a subscription with 14-day trial.

    `num_cards` is the total number of digital cards the user wants. The base
    plan includes 1; each extra card is billed as an additional recurring line
    item in the SAME subscription, so the customer sees one combined charge.

    Card is REQUIRED at signup (Stripe requires it for trials). After 14 days,
    Stripe auto-charges the card unless the user cancels via the Customer
    Portal.

    NOTE: We do NOT pre-create a Stripe Customer because the Emergent Stripe
    proxy is stateless across requests. Instead we pass `customer_email` and
    let Stripe Checkout create the customer at session-completion time; we
    capture the resulting `customer` ID from the webhook / status poll.
    """
    plan = get_plan(plan_id)
    if not plan:
        raise ValueError(f"Unknown plan_id: {plan_id}")

    num_cards = max(1, int(num_cards or 1))
    extra_cards = num_cards - 1

    line_items = [{
        "price_data": {
            "currency": plan["currency"],
            "product_data": {
                "name": f"UniTech — {plan['name']}",
                "description": plan["description"],
            },
            "unit_amount": plan["amount_cents"],
            "recurring": {
                "interval": plan["interval"],
                "interval_count": plan["interval_count"],
            },
        },
        "quantity": 1,
    }]

    # Add the extra-card add-on as a reusable priced item (so we can later bump
    # the quantity for an existing subscriber).
    if extra_cards > 0:
        extra_price_id = await ensure_extra_card_price(db, plan["interval"])
        line_items.append({"price": extra_price_id, "quantity": extra_cards})

    session = stripe.checkout.Session.create(
        mode="subscription",
        customer_email=user["email"],
        line_items=line_items,
        subscription_data={
            "trial_period_days": plan["trial_period_days"],
            "metadata": {
                "user_id": user["id"],
                "plan_id": plan_id,
                "num_cards": str(num_cards),
                "app": "unitap",
            },
        },
        # Card REQUIRED even with trial — user-requested behaviour:
        # "si el cliente pone su forma de pago y a los 14 dias despues del
        # trial no cancela, entonces se activa todo"
        payment_method_collection="always",
        # Collect a shipping address so we can mail the physical NFC card.
        shipping_address_collection={
            "allowed_countries": ["US", "MX", "CA", "PR"],
        },
        phone_number_collection={"enabled": True},
        allow_promotion_codes=True,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": user["id"],
            "plan_id": plan_id,
            "num_cards": str(num_cards),
            "app": "unitap",
        },
    )

    # Persist a payment_transactions record (per playbook guidance).
    await db.payment_transactions.insert_one(
        {
            "id": session.id,
            "session_id": session.id,
            "user_id": user["id"],
            "user_email": user["email"],
            "plan_id": plan_id,
            "num_cards": num_cards,
            "amount_cents": plan["amount_cents"] + extra_cards * EXTRA_CARD_PRICE_CENTS.get(plan["interval"], 1500),
            "currency": plan["currency"],
            "status": "initiated",
            "payment_status": "pending",
            "stripe_customer_id": None,
            "created_at": session.created,
            "metadata": {"plan_id": plan_id, "user_id": user["id"], "num_cards": num_cards},
        }
    )

    return {"session_id": session.id, "url": session.url}


async def get_checkout_status(db, session_id: str) -> dict:
    """Retrieve the current status of a Checkout Session (used for polling).

    Falls back to the locally-stored payment_transactions record if Stripe
    cannot find the session (e.g. when running through a stateless test proxy).
    """
    try:
        session = stripe.checkout.Session.retrieve(
            session_id,
            expand=["subscription", "customer"],
        )
    except stripe.error.InvalidRequestError as e:
        if getattr(e, "code", None) == "resource_missing":
            local = await db.payment_transactions.find_one(
                {"session_id": session_id}, {"_id": 0}
            )
            if not local:
                raise
            return {
                "status": local.get("status", "pending"),
                "payment_status": local.get("payment_status", "pending"),
                "subscription_id": None,
                "subscription_status": None,
                "customer_id": local.get("stripe_customer_id"),
                "source": "local_fallback",
            }
        raise
    sub = session.get("subscription") if isinstance(session, dict) else session.subscription
    status_payload = {
        "status": session.status,
        "payment_status": session.payment_status,
        "subscription_id": (sub.id if sub and not isinstance(sub, str) else sub),
        "subscription_status": (sub.status if sub and not isinstance(sub, str) else None),
        "customer_id": session.customer if isinstance(session.customer, str) else (session.customer.id if session.customer else None),
    }
    # Update payment_transactions and re-apply subscription. Calling
    # _apply_subscription_to_user is idempotent ($set with same data) so we
    # ALWAYS run it on `complete` — this lets old transactions backfill
    # missing shipping_address / stripe_customer_id after bug fixes.
    if session.status == "complete":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "complete", "payment_status": "complete"}},
        )
        await _apply_subscription_to_user(db, session, sub)
    elif session.status == "expired":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "expired", "payment_status": "expired"}},
        )
    return status_payload


def _md(session, key):
    """Safely read a metadata key from a Stripe Session across SDK versions.

    In some Stripe SDK versions `session.metadata` is a `StripeObject` that
    does NOT expose `.get()` (only `__getitem__`), so the standard
    `(session.metadata or {}).get(key)` raises AttributeError. Convert
    defensively.
    """
    md = getattr(session, "metadata", None)
    if md is None:
        return None
    try:
        return dict(md).get(key)
    except Exception:
        try:
            return md[key]
        except Exception:
            return None


async def _apply_subscription_to_user(db, session, subscription) -> None:
    """Persist subscription details onto the user document."""
    user_id = _md(session, "user_id")
    plan_id = _md(session, "plan_id")
    if not user_id:
        return
    update: dict = {
        "stripe_subscription_id": (
            subscription.id if subscription and not isinstance(subscription, str) else subscription
        ),
        "plan_type": plan_id,
        "subscription_status": (
            subscription.status if subscription and not isinstance(subscription, str) else "active"
        ),
    }
    # Number of cards chosen at checkout → drives the account's card limit.
    num_cards = _md(session, "num_cards")
    if num_cards:
        try:
            update["card_limit"] = max(1, int(num_cards))
        except (TypeError, ValueError):
            pass
    # Persist stripe_customer_id so the Customer Portal can open later.
    try:
        customer = session.customer if not isinstance(session, dict) else session.get("customer")
        if customer:
            update["stripe_customer_id"] = (
                customer if isinstance(customer, str)
                else (customer.id if hasattr(customer, "id") else customer.get("id"))
            )
    except Exception:
        pass
    if subscription and not isinstance(subscription, str):
        if getattr(subscription, "trial_end", None):
            update["trial_ends_at"] = subscription.trial_end
        if getattr(subscription, "current_period_end", None):
            update["current_period_end"] = subscription.current_period_end
    # Capture shipping address from checkout (if collected).
    # Stripe API 2025-02-24+: `session.shipping_details` was moved to
    # `session.collected_information.shipping_details`. Try the new field
    # first, fall back to the legacy one for older API versions.
    shipping = None
    try:
        collected = (
            getattr(session, "collected_information", None)
            or (session.get("collected_information") if isinstance(session, dict) else None)
        )
        if collected:
            shipping = (
                getattr(collected, "shipping_details", None)
                or (collected.get("shipping_details") if isinstance(collected, dict) else None)
            )
        if not shipping:
            shipping = (
                getattr(session, "shipping_details", None)
                or (session.get("shipping_details") if isinstance(session, dict) else None)
            )
    except Exception:
        shipping = None
    if shipping:
        addr = getattr(shipping, "address", None) or (shipping.get("address") if isinstance(shipping, dict) else None)
        name = getattr(shipping, "name", None) or (shipping.get("name") if isinstance(shipping, dict) else None)
        if addr:
            update["shipping_address"] = {
                "name": name or "",
                "line1": getattr(addr, "line1", None) or addr.get("line1") if isinstance(addr, dict) else getattr(addr, "line1", ""),
                "line2": getattr(addr, "line2", None) or (addr.get("line2") if isinstance(addr, dict) else ""),
                "city": getattr(addr, "city", None) or (addr.get("city") if isinstance(addr, dict) else ""),
                "state": getattr(addr, "state", None) or (addr.get("state") if isinstance(addr, dict) else ""),
                "postal_code": getattr(addr, "postal_code", None) or (addr.get("postal_code") if isinstance(addr, dict) else ""),
                "country": getattr(addr, "country", None) or (addr.get("country") if isinstance(addr, dict) else ""),
            }
            # Mark card as needing to ship (admin will fulfill).
            update["card_shipping_status"] = "pending"
    # Track whether this is the first time we apply (new sub) vs a backfill.
    existing_user = await db.users.find_one({"id": user_id})
    was_new_sub = not (existing_user or {}).get("stripe_subscription_id")

    await db.users.update_one({"id": user_id}, {"$set": update})

    # Owner notification — only on the FIRST successful apply for this user.
    if was_new_sub:
        try:
            from email_service import (
                notify_owner,
                render_new_subscription_email,
            )
            plan_labels = {
                "pro_monthly": "Pro Mensual ($49/mes)",
                "pro_yearly":  "Pro Anual ($390/año)",
                "founder":     "Founder Deal ($290/año)",
            }
            updated = await db.users.find_one({"id": user_id}) or {}
            trial_end = updated.get("trial_ends_at")
            import time as _t
            trial_days = max(0, int((trial_end - int(_t.time())) / 86400)) if trial_end else 14
            html = render_new_subscription_email(
                business_name=updated.get("business_name") or "",
                user_email=updated.get("email") or "",
                plan_label=plan_labels.get(plan_id, plan_id or "Pro"),
                trial_days=trial_days,
                shipping_address=updated.get("shipping_address"),
            )
            await notify_owner(
                subject=f"🎉 Nueva suscripción — {updated.get('email')}",
                html=html,
            )
        except Exception as e:
            logger.error(f"Owner notification failed (non-fatal): {e!r}")


async def handle_webhook_event(db, payload: bytes, sig_header: str) -> dict:
    """Process a Stripe webhook event. Returns a small status dict."""
    secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
    try:
        if secret:
            event = stripe.Webhook.construct_event(payload, sig_header, secret)
        else:
            # Dev mode: parse without signature verification (test keys only)
            import json
            event = stripe.Event.construct_from(json.loads(payload.decode("utf-8")), stripe.api_key)
    except Exception as e:
        logger.error(f"Stripe webhook verification failed: {e}")
        return {"received": False, "error": str(e)}

    event_type = event.get("type") if isinstance(event, dict) else event.type
    data_obj = (event.get("data") or {}).get("object") if isinstance(event, dict) else event.data.object

    logger.info(f"Stripe webhook received: {event_type}")

    if event_type == "checkout.session.completed":
        # Fetch fresh session with expansions to capture sub + shipping.
        session = stripe.checkout.Session.retrieve(
            data_obj["id"] if isinstance(data_obj, dict) else data_obj.id,
            expand=["subscription", "customer"],
        )
        # Invoice card payments are one-time charges (NOT subscriptions). Handle
        # them separately and bail out BEFORE the subscription logic, so they
        # never corrupt a user's subscription state.
        if _md(session, "type") in ("invoice_payment", "payment_request"):
            await _record_invoice_card_payment(db, session)
            return {"received": True, "type": event_type, "handled": _md(session, "type")}
        sub = session.subscription
        await _apply_subscription_to_user(db, session, sub)
        await db.payment_transactions.update_one(
            {"session_id": session.id},
            {"$set": {"status": "complete", "payment_status": "complete"}},
        )

    elif event_type in (
        "customer.subscription.updated",
        "customer.subscription.created",
        "customer.subscription.deleted",
    ):
        sub = data_obj
        customer_id = sub["customer"] if isinstance(sub, dict) else sub.customer
        user = await db.users.find_one({"stripe_customer_id": customer_id})
        if user:
            sub_status = sub["status"] if isinstance(sub, dict) else sub.status
            update = {"subscription_status": sub_status}
            if isinstance(sub, dict):
                update["stripe_subscription_id"] = sub.get("id")
                if sub.get("trial_end"):
                    update["trial_ends_at"] = sub["trial_end"]
                if sub.get("current_period_end"):
                    update["current_period_end"] = sub["current_period_end"]
                if sub.get("cancel_at_period_end"):
                    update["cancel_at_period_end"] = True
                else:
                    update["cancel_at_period_end"] = False
            else:
                update["stripe_subscription_id"] = sub.id
                if getattr(sub, "trial_end", None):
                    update["trial_ends_at"] = sub.trial_end
                if getattr(sub, "current_period_end", None):
                    update["current_period_end"] = sub.current_period_end
                update["cancel_at_period_end"] = bool(getattr(sub, "cancel_at_period_end", False))
            await db.users.update_one({"id": user["id"]}, {"$set": update})

    elif event_type == "invoice.payment_succeeded":
        invoice = data_obj
        customer_id = invoice["customer"] if isinstance(invoice, dict) else invoice.customer
        user = await db.users.find_one({"stripe_customer_id": customer_id})
        if user:
            await db.users.update_one(
                {"id": user["id"]},
                {"$set": {"subscription_status": "active"}},
            )

    elif event_type == "invoice.payment_failed":
        invoice = data_obj
        customer_id = invoice["customer"] if isinstance(invoice, dict) else invoice.customer
        user = await db.users.find_one({"stripe_customer_id": customer_id})
        if user:
            await db.users.update_one(
                {"id": user["id"]},
                {"$set": {"subscription_status": "past_due"}},
            )

    return {"received": True, "event_type": event_type}


async def create_portal_session(db, user: dict, return_url: str) -> dict:
    """Create a Stripe Customer Portal session for managing subscription."""
    if not user.get("stripe_customer_id"):
        raise ValueError("User does not have a Stripe customer profile")
    portal = stripe.billing_portal.Session.create(
        customer=user["stripe_customer_id"],
        return_url=return_url,
    )
    return {"url": portal.url}


async def set_subscription_card_seats(db, user: dict, total_cards: int) -> dict:
    """Set the TOTAL number of cards on an existing subscriber's plan by adjusting
    the extra-card add-on quantity (total - 1). Stripe prorates the change onto
    the next invoice (default proration). Returns {ok, total_cards, extra}.

    Used when an existing customer wants to add/remove a paid card later.
    """
    sub_id = user.get("stripe_subscription_id")
    if not sub_id:
        raise ValueError("El usuario no tiene una suscripción activa de Stripe")
    total_cards = max(1, int(total_cards))
    extra = total_cards - 1

    plan = get_plan(user.get("plan_type") or "pro_monthly") or PLANS["pro_monthly"]
    interval = plan["interval"]
    extra_price_id = await ensure_extra_card_price(db, interval)

    sub = stripe.Subscription.retrieve(sub_id, expand=["items"])
    items = sub["items"]["data"] if isinstance(sub, dict) else sub.items.data

    config = await db.app_config.find_one({"key": "stripe_extra_card_prices"})
    extra_ids = _extra_card_price_ids((config or {}).get("data") or {})

    existing_item = None
    for it in items:
        price = it["price"] if isinstance(it, dict) else it.price
        pid = price["id"] if isinstance(price, dict) else price.id
        if pid in extra_ids or pid == extra_price_id:
            existing_item = it
            break

    item_id = (existing_item["id"] if isinstance(existing_item, dict) else existing_item.id) if existing_item else None

    if extra <= 0:
        if item_id:
            stripe.Subscription.modify(
                sub_id,
                items=[{"id": item_id, "deleted": True}],
                proration_behavior="create_prorations",
            )
    elif item_id:
        stripe.Subscription.modify(
            sub_id,
            items=[{"id": item_id, "quantity": extra}],
            proration_behavior="create_prorations",
        )
    else:
        stripe.Subscription.modify(
            sub_id,
            items=[{"price": extra_price_id, "quantity": extra}],
            proration_behavior="create_prorations",
        )

    await db.users.update_one({"id": user["id"]}, {"$set": {"card_limit": total_cards}})
    return {"ok": True, "total_cards": total_cards, "extra": extra}


def user_features(user: dict) -> set:
    """The set of unlocked features for a user. Drives per-module access.

    Priority: admin comp (grandfathered = all) > real paid subscription
    (the plan's features; legacy/unknown plans grant all) > self-managed
    14-day free trial (all, no card) > LOCKED (nothing) once the trial
    expires with no active subscription.
    """
    now = int(time.time())
    # Comp / grandfathered (admin-granted lifetime/free)
    if user.get("is_comp"):
        exp = user.get("comp_expires_at")
        if not (exp and exp < now):
            return set(FEATURES_ALL)
    # Admin MANUAL plan grant (no Stripe) — lets the owner assign a specific
    # module (or the bundle) to a user from the admin panel without charging.
    # Overrides trial/locked but NOT a real comp grant above.
    mp = user.get("manual_plan")
    if mp:
        if mp in ("bundle", "comp", "all"):
            return set(FEATURES_ALL)
        return set(PLAN_FEATURES.get(mp, set()))
    status = user.get("subscription_status")
    sub_id = user.get("stripe_subscription_id")
    # Real paying subscriber
    if status in ("active", "past_due") and sub_id:
        base = plan_base(user.get("plan_type"))
        return set(PLAN_FEATURES.get(base, FEATURES_ALL))  # legacy/unknown -> all
    # Self-managed free trial (no card) — full access until it expires
    te = user.get("trial_ends_at")
    if status == "trialing" and te and now < int(te):
        return set(FEATURES_ALL)
    # Trial expired and no active subscription -> LOCKED
    return set()


def user_has_feature(user: dict, feature: str) -> bool:
    return feature in user_features(user)


def subscription_is_active(user: dict) -> bool:
    """True if the user has ANY unlocked access (paid, comp, or within the
    free trial)."""
    return bool(user_features(user))


def has_paid_subscription(user: dict) -> bool:
    """Back-compat: True when the user can access the digital Smart Card
    (comp, an active plan that includes `card`, or the active free trial)."""
    return "card" in user_features(user)



# ============================================================================
# INVOICE CARD PAYMENTS — one-time Checkout Sessions to collect client payments
# (Option A: uses the platform's own Stripe account; gated to the owner only by
#  the caller in server.py). Kept separate from the subscription webhook flow.
# ============================================================================
async def create_invoice_checkout(
    db,
    invoice: dict,
    amount: float,
    success_url: str,
    cancel_url: str,
    label: str = "",
    request_id: Optional[str] = None,
) -> dict:
    """Create a one-time Stripe Checkout Session for an invoice (or a payment
    request for it). `amount` is computed server-side (never from the client).
    Returns {session_id, url}. Records a pending payment_transactions entry that
    carries enough info (invoice_id, request_id) to record the abono later.
    """
    from datetime import datetime, timezone

    inv_id = invoice["id"]
    amount_cents = int(round(float(amount) * 100))
    number = (invoice.get("number") or "").strip()
    title = (invoice.get("job_title") or "Invoice").strip()[:90]
    product_name = (label or "").strip()[:120] or (f"{title}" + (f" — Invoice {number}" if number else ""))
    pay_type = "payment_request" if request_id else "invoice_payment"

    metadata = {
        "type": pay_type,
        "invoice_id": inv_id,
        "user_id": invoice["user_id"],
        "app": "unitap",
    }
    if request_id:
        metadata["request_id"] = request_id

    session = stripe.checkout.Session.create(
        mode="payment",
        line_items=[{
            "price_data": {
                "currency": "usd",
                "product_data": {"name": product_name},
                "unit_amount": amount_cents,
            },
            "quantity": 1,
        }],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )

    await db.payment_transactions.insert_one({
        "id": session.id,
        "session_id": session.id,
        "type": pay_type,
        "invoice_id": inv_id,
        "request_id": request_id,
        "user_id": invoice["user_id"],
        "amount_cents": amount_cents,
        "currency": "usd",
        "description": product_name,
        "status": "initiated",
        "payment_status": "pending",
        "recorded": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "metadata": metadata,
    })

    return {"session_id": session.id, "url": session.url}


async def get_invoice_checkout_status(db, session_id: str) -> dict:
    """Poll a one-time invoice Checkout Session. Returns payment_status/status/amount."""
    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except stripe.error.InvalidRequestError as e:
        if getattr(e, "code", None) == "resource_missing":
            local = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
            if not local:
                raise
            return {
                "payment_status": local.get("payment_status", "pending"),
                "status": local.get("status", "pending"),
                "amount_total": (local.get("amount_cents") or 0) / 100,
                "source": "local_fallback",
            }
        raise

    def _g(obj, key, default=None):
        if isinstance(obj, dict):
            return obj.get(key, default)
        return getattr(obj, key, default)

    return {
        "payment_status": _g(session, "payment_status", "unpaid"),
        "status": _g(session, "status", "open"),
        "amount_total": (_g(session, "amount_total", 0) or 0) / 100,
    }



async def _record_invoice_card_payment(db, session) -> bool:
    """Idempotently record a completed card payment as an abono on the invoice.

    Used by the webhook (backup path). The frontend polling endpoint in
    server.py records via the full ledger recalc. Both claim the
    payment_transactions.recorded flag atomically, so the abono is added once.
    Returns True if THIS call recorded it.
    """
    from datetime import datetime, timezone

    session_id = session.id if hasattr(session, "id") else session.get("id")
    invoice_id = _md(session, "invoice_id")
    if not invoice_id:
        return False

    tx = await db.payment_transactions.find_one_and_update(
        {"session_id": session_id, "type": {"$in": ["invoice_payment", "payment_request"]}, "recorded": {"$ne": True}},
        {"$set": {"recorded": True, "payment_status": "paid", "status": "complete"}},
    )
    if not tx:
        return False

    amount = round((tx.get("amount_cents") or 0) / 100, 2)
    now = datetime.now(timezone.utc).isoformat()
    payment = {
        "id": __import__("uuid").uuid4().hex,
        "amount": amount,
        "method": "card",
        "date": now,
        "note": tx.get("description") or "Pago con tarjeta (Stripe)",
        "plan_item_id": None,
        "created_at": now,
    }
    await db.invoices.update_one({"id": invoice_id}, {"$push": {"payments": payment}})

    # Mark the originating payment request as paid (if any).
    if tx.get("request_id"):
        await db.payment_requests.update_one(
            {"id": tx["request_id"]},
            {"$set": {"status": "paid", "paid_at": now}},
        )

    # Self-contained recompute (no auto-job here; the polling path handles that).
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if inv:
        total = float(inv.get("total") or 0)
        paid = round(sum(float(p.get("amount") or 0) for p in inv.get("payments", [])), 2)
        new_status = inv.get("status")
        if total > 0 and paid >= total:
            new_status = "paid"
        elif paid > 0:
            new_status = "partial"
        await db.invoices.update_one(
            {"id": invoice_id},
            {"$set": {"amount_paid": paid, "status": new_status, "updated_at": now}},
        )
    return True
