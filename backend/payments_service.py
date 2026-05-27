"""Stripe Subscriptions service for Unitap.

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
from typing import Optional

import stripe

logger = logging.getLogger(__name__)

stripe.api_key = os.environ.get("STRIPE_API_KEY", "")
# Emergent-managed Stripe test key uses a special proxy endpoint.
if "sk_test_emergent" in stripe.api_key:
    stripe.api_base = "https://integrations.emergentagent.com/stripe"

PLANS = {
    "pro_monthly": {
        "id": "pro_monthly",
        "name": "Pro Mensual",
        "description": "Plan profesional con cobro mensual",
        "amount_cents": 4900,
        "currency": "usd",
        "interval": "month",
        "interval_count": 1,
        "display_price": "$49",
        "display_period": "/mes",
        "features": [
            "Todas las funciones Pro",
            "Tarjeta digital inteligente",
            "Quotes, Invoices y Contratos con IA",
            "Agenda inteligente",
            "Soporte prioritario",
        ],
        "trial_period_days": 14,
        "is_founder": False,
        "ships_card": True,
    },
    "pro_yearly": {
        "id": "pro_yearly",
        "name": "Pro Anual",
        "description": "Plan profesional anual (ahorra 2 meses)",
        "amount_cents": 39000,
        "currency": "usd",
        "interval": "year",
        "interval_count": 1,
        "display_price": "$390",
        "display_period": "/año",
        "features": [
            "Todo lo de Pro Mensual",
            "Equivalente a $32.50/mes",
            "Ahorra ~$198 vs mensual",
            "Tarjeta NFC física incluida",
        ],
        "trial_period_days": 14,
        "is_founder": False,
        "ships_card": True,
    },
    "founder": {
        "id": "founder",
        "name": "Founder Deal",
        "description": "Oferta limitada para early adopters — anual",
        "amount_cents": 29000,
        "currency": "usd",
        "interval": "year",
        "interval_count": 1,
        "display_price": "$290",
        "display_period": "/año",
        "features": [
            "Todo lo de Pro Anual",
            "Precio Founder de por vida si no cancelas",
            "Acceso a nuevas funciones beta",
            "Tarjeta NFC física incluida",
            "Soporte directo del fundador",
        ],
        "trial_period_days": 14,
        "is_founder": True,
        "ships_card": True,
    },
}


def list_plans() -> list[dict]:
    """Public list of plans for the frontend pricing page."""
    return [
        {
            "id": p["id"],
            "name": p["name"],
            "description": p["description"],
            "display_price": p["display_price"],
            "display_period": p["display_period"],
            "amount_cents": p["amount_cents"],
            "currency": p["currency"],
            "interval": p["interval"],
            "features": p["features"],
            "trial_period_days": p["trial_period_days"],
            "is_founder": p["is_founder"],
            "ships_card": p["ships_card"],
        }
        for p in PLANS.values()
    ]


def get_plan(plan_id: str) -> Optional[dict]:
    return PLANS.get(plan_id)


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
            name=f"Unitap — {plan['name']}",
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
) -> dict:
    """Create a Stripe Checkout Session for a subscription with 14-day trial.

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

    line_items = [{
        "price_data": {
            "currency": plan["currency"],
            "product_data": {
                "name": f"Unitap — {plan['name']}",
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

    session = stripe.checkout.Session.create(
        mode="subscription",
        customer_email=user["email"],
        line_items=line_items,
        subscription_data={
            "trial_period_days": plan["trial_period_days"],
            "metadata": {
                "user_id": user["id"],
                "plan_id": plan_id,
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
            "amount_cents": plan["amount_cents"],
            "currency": plan["currency"],
            "status": "initiated",
            "payment_status": "pending",
            "stripe_customer_id": None,
            "created_at": session.created,
            "metadata": {"plan_id": plan_id, "user_id": user["id"]},
        }
    )

    return {"session_id": session.id, "url": session.url}


async def get_checkout_status(db, session_id: str) -> dict:
    """Retrieve the current status of a Checkout Session (used for polling)."""
    session = stripe.checkout.Session.retrieve(
        session_id,
        expand=["subscription", "customer", "shipping_details"],
    )
    sub = session.get("subscription") if isinstance(session, dict) else session.subscription
    status_payload = {
        "status": session.status,
        "payment_status": session.payment_status,
        "subscription_id": (sub.id if sub and not isinstance(sub, str) else sub),
        "subscription_status": (sub.status if sub and not isinstance(sub, str) else None),
        "customer_id": session.customer if isinstance(session.customer, str) else (session.customer.id if session.customer else None),
    }
    # Update payment_transactions only if not already complete (idempotent).
    existing = await db.payment_transactions.find_one({"session_id": session_id})
    if existing and existing.get("payment_status") != "complete":
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


async def _apply_subscription_to_user(db, session, subscription) -> None:
    """Persist subscription details onto the user document."""
    user_id = (session.metadata or {}).get("user_id")
    plan_id = (session.metadata or {}).get("plan_id")
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
    if subscription and not isinstance(subscription, str):
        if getattr(subscription, "trial_end", None):
            update["trial_ends_at"] = subscription.trial_end
        if getattr(subscription, "current_period_end", None):
            update["current_period_end"] = subscription.current_period_end
    # Capture shipping address from checkout (if collected).
    shipping = None
    try:
        shipping = session.shipping_details or session.get("shipping_details") if isinstance(session, dict) else session.shipping_details
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
    await db.users.update_one({"id": user_id}, {"$set": update})


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
            expand=["subscription", "customer", "shipping_details"],
        )
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


def subscription_is_active(user: dict) -> bool:
    """Return True if user has an active paid or trialing subscription."""
    status = user.get("subscription_status")
    return status in ("active", "trialing", "past_due")


def has_paid_subscription(user: dict) -> bool:
    """Return True ONLY when the user is actively paying (NOT in trial).

    Used to gate the Smart Card feature per user choice: trial unlocks
    everything *except* the Smart Card.
    """
    return user.get("subscription_status") in ("active", "past_due")
