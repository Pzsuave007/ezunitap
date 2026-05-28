"""Lightweight email notifier using Resend.

Used to notify the SaaS owner when business events occur (new subscription,
trial expiring, payment failed). Falls back to a no-op log if RESEND_API_KEY
or OWNER_EMAIL is not configured — so dev/preview envs don't require setup.
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)


def _resend_client():
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        import resend
        resend.api_key = api_key
        return resend
    except ImportError:
        logger.warning("resend package not installed — skipping email")
        return None


def _owner_email() -> Optional[str]:
    return os.environ.get("OWNER_EMAIL", "").strip() or None


def _sender_email() -> str:
    # Resend's default sandbox sender. Owner can override via env.
    return os.environ.get("SENDER_EMAIL", "Unitap <onboarding@resend.dev>").strip()


async def notify_owner(subject: str, html: str) -> None:
    """Fire-and-forget email to the owner. Never raises.

    Safe to call from inside webhook handlers or BackgroundTasks.
    """
    owner = _owner_email()
    client = _resend_client()
    if not owner or not client:
        logger.info(f"[email skipped — missing config] {subject}")
        return
    params = {
        "from": _sender_email(),
        "to": [owner],
        "subject": subject,
        "html": html,
    }
    try:
        result = await asyncio.to_thread(client.Emails.send, params)
        logger.info(f"[email sent] id={result.get('id')} subject={subject!r}")
    except Exception as e:
        logger.error(f"[email failed] {e!r} — subject={subject!r}")


def render_new_subscription_email(
    *,
    business_name: str,
    user_email: str,
    plan_label: str,
    trial_days: int,
    shipping_address: Optional[dict] = None,
    admin_url: str = "https://ezunitap.com/admin/envios",
) -> str:
    """Plain HTML body for a new-subscription notification."""
    addr_html = ""
    if shipping_address:
        a = shipping_address
        addr_lines = [
            a.get("name") or "",
            a.get("line1") or "",
            a.get("line2") or "",
            f"{a.get('city','')}, {a.get('state','')} {a.get('postal_code','')}",
            a.get("country") or "",
        ]
        addr_html = (
            '<tr><td style="padding:12px 16px;background:#fffbeb;'
            'border-left:4px solid #f59e0b;border-radius:8px;">'
            '<div style="font-weight:bold;color:#78350f;margin-bottom:6px;">'
            '📦 Dirección de envío NFC</div>'
            f'<div style="color:#92400e;line-height:1.5;">{"<br>".join(l for l in addr_lines if l)}</div>'
            "</td></tr>"
        )
    return f"""
<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
    <tr><td style="padding:24px 24px 8px;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;color:#059669;">🎉 Nueva suscripción</div>
      <h1 style="font-size:22px;margin:8px 0 0;">{business_name or user_email}</h1>
      <div style="color:#64748b;font-size:14px;margin-top:4px;">{user_email}</div>
    </td></tr>
    <tr><td style="padding:0 24px 16px;">
      <table cellpadding="0" cellspacing="6" width="100%">
        <tr>
          <td style="padding:10px 14px;background:#ecfdf5;border-radius:8px;color:#065f46;">
            <div style="font-size:11px;text-transform:uppercase;font-weight:700;opacity:0.7;">Plan</div>
            <div style="font-size:15px;font-weight:bold;margin-top:2px;">{plan_label}</div>
          </td>
          <td style="padding:10px 14px;background:#eff6ff;border-radius:8px;color:#1e3a8a;">
            <div style="font-size:11px;text-transform:uppercase;font-weight:700;opacity:0.7;">Trial</div>
            <div style="font-size:15px;font-weight:bold;margin-top:2px;">{trial_days} días gratis</div>
          </td>
        </tr>
        {addr_html}
      </table>
    </td></tr>
    <tr><td style="padding:8px 24px 24px;">
      <a href="{admin_url}" style="display:inline-block;background:#0f172a;color:#ffffff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:14px;">
        Ver en panel de envíos →
      </a>
    </td></tr>
  </table>
</body></html>
""".strip()
