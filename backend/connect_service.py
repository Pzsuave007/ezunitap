"""Stripe Connect (Express) — lets each tenant connect their OWN Stripe account
and collect invoice payments directly into it (with their own business name on
the receipt). Uses an isolated StripeClient bound to the platform's REAL Stripe
secret key (STRIPE_CONNECT_SECRET_KEY), so it never touches the Emergent proxy
used by the platform subscription billing.

Charges are created as DIRECT CHARGES on the connected account (via the
`stripe_account` request option) so the client sees the contractor's business
name — not the platform's.
"""
import os
from datetime import datetime, timezone

import stripe

CONNECT_KEY = os.environ.get("STRIPE_CONNECT_SECRET_KEY", "")
WEBHOOK_SECRET = os.environ.get("STRIPE_CONNECT_WEBHOOK_SECRET", "")
# Platform application fee in basis points (0 = take nothing). Configurable.
APP_FEE_BPS = int(os.environ.get("STRIPE_CONNECT_FEE_BPS", "0") or "0")

_client = stripe.StripeClient(api_key=CONNECT_KEY) if CONNECT_KEY else None


def connect_enabled() -> bool:
    return bool(CONNECT_KEY)


def _v1():
    if not _client:
        raise RuntimeError("Stripe Connect no está configurado (falta STRIPE_CONNECT_SECRET_KEY)")
    return _client.v1


# ---------------------------------------------------------------- onboarding
def create_express_account(email: str = "", business_name: str = "", country: str = "US") -> str:
    params = {
        "type": "express",
        "country": country or "US",
        "capabilities": {
            "card_payments": {"requested": True},
            "transfers": {"requested": True},
        },
    }
    if email:
        params["email"] = email
    if business_name:
        params["business_profile"] = {"name": business_name[:120]}
    acct = _v1().accounts.create(params=params)
    return acct.id


def create_onboarding_link(account_id: str, refresh_url: str, return_url: str) -> str:
    link = _v1().account_links.create(params={
        "account": account_id,
        "refresh_url": refresh_url,
        "return_url": return_url,
        "type": "account_onboarding",
    })
    return link.url


def get_account_status(account_id: str) -> dict:
    acct = _v1().accounts.retrieve(account_id)
    bp = acct.get("business_profile") or {}
    return {
        "account_id": account_id,
        "charges_enabled": bool(acct.get("charges_enabled")),
        "details_submitted": bool(acct.get("details_submitted")),
        "payouts_enabled": bool(acct.get("payouts_enabled")),
        "business_name": bp.get("name") or "",
    }


def create_login_link(account_id: str) -> str:
    """Express dashboard link so the connected user can see payouts/balance."""
    link = _v1().accounts.login_links.create(account_id)
    return link.url


# ----------------------------------------------------------------- charges
async def create_invoice_checkout_connect(
    db,
    invoice: dict,
    amount: float,
    success_url: str,
    cancel_url: str,
    account_id: str,
    label: str = "",
    request_id: str = None,
) -> dict:
    """Direct-charge Checkout Session on the connected account. Records a pending
    payment_transactions doc (flagged is_connect) so the poller can reconcile."""
    amount_cents = int(round(float(amount) * 100))
    number = (invoice.get("number") or "").strip()
    title = (invoice.get("job_title") or "Invoice").strip()[:90]
    product_name = (label or "").strip()[:120] or (f"{title}" + (f" — Invoice {number}" if number else ""))
    pay_type = "payment_request" if request_id else "invoice_payment"

    metadata = {
        "type": pay_type,
        "invoice_id": invoice["id"],
        "user_id": invoice["user_id"],
        "app": "unitap",
    }
    if request_id:
        metadata["request_id"] = request_id

    params = {
        "mode": "payment",
        "line_items": [{
            "price_data": {
                "currency": "usd",
                "product_data": {"name": product_name},
                "unit_amount": amount_cents,
            },
            "quantity": 1,
        }],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata": metadata,
    }
    fee_cents = int(amount_cents * APP_FEE_BPS / 10000) if APP_FEE_BPS > 0 else 0
    if fee_cents > 0:
        params["payment_intent_data"] = {"application_fee_amount": fee_cents}

    session = _v1().checkout.sessions.create(params=params, options={"stripe_account": account_id})

    await db.payment_transactions.insert_one({
        "id": session.id,
        "session_id": session.id,
        "type": pay_type,
        "invoice_id": invoice["id"],
        "request_id": request_id,
        "user_id": invoice["user_id"],
        "amount_cents": amount_cents,
        "currency": "usd",
        "description": product_name,
        "status": "initiated",
        "payment_status": "pending",
        "recorded": False,
        "is_connect": True,
        "connect_account_id": account_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "metadata": metadata,
    })

    return {"session_id": session.id, "url": session.url}


def get_checkout_status_connect(session_id: str, account_id: str) -> dict:
    session = _v1().checkout.sessions.retrieve(session_id, options={"stripe_account": account_id})
    return {
        "payment_status": session.get("payment_status"),
        "status": session.get("status"),
        "amount_total": (session.get("amount_total") or 0) / 100,
    }


def construct_webhook_event(payload: bytes, sig_header: str):
    return stripe.Webhook.construct_event(payload, sig_header, WEBHOOK_SECRET)
