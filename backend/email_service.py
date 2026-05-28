"""Lightweight email notifier with two backends: SMTP (preferred for self-hosted
servers) and Resend (cloud service).

Backend selection (in order):
  1. If SMTP_HOST is set in env  → use plain SMTP (your VPS / cPanel email)
  2. Else if RESEND_API_KEY is set → use Resend API
  3. Else → log and skip (dev/preview environments)

Used to notify the SaaS owner when business events occur (new subscription,
trial expiring, payment failed). Never raises — emails are best-effort.
"""
from __future__ import annotations

import asyncio
import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

logger = logging.getLogger(__name__)


def _owner_email() -> Optional[str]:
    return os.environ.get("OWNER_EMAIL", "").strip() or None


def _sender_email() -> str:
    return os.environ.get("SENDER_EMAIL", "Unitap <onboarding@resend.dev>").strip()


# ---- SMTP backend (preferred for self-hosted) -----------------------------
def _smtp_config():
    """Return SMTP settings dict if configured, else None."""
    host = os.environ.get("SMTP_HOST", "").strip()
    if not host:
        return None
    return {
        "host": host,
        "port": int(os.environ.get("SMTP_PORT", "587")),
        "user": os.environ.get("SMTP_USER", "").strip(),
        "password": os.environ.get("SMTP_PASSWORD", "").strip(),
        # ssl = port 465 (implicit TLS), tls = port 587 (STARTTLS), none = plain
        "security": os.environ.get("SMTP_SECURITY", "tls").strip().lower(),
    }


def _send_smtp_sync(cfg: dict, sender: str, to: str, subject: str, html: str) -> str:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to
    msg.attach(MIMEText(html, "html", "utf-8"))

    if cfg["security"] == "ssl":
        server = smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=15)
    else:
        server = smtplib.SMTP(cfg["host"], cfg["port"], timeout=15)
        server.ehlo()
        if cfg["security"] == "tls":
            server.starttls()
            server.ehlo()
    try:
        if cfg["user"] and cfg["password"]:
            server.login(cfg["user"], cfg["password"])
        from_addr = sender.split("<")[-1].rstrip(">").strip()
        server.sendmail(from_addr, [to], msg.as_string())
    finally:
        try:
            server.quit()
        except Exception:
            pass
    return "smtp-ok"


# ---- Resend backend (fallback) --------------------------------------------
def _resend_client():
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        import resend
        resend.api_key = api_key
        return resend
    except ImportError:
        logger.warning("resend package not installed")
        return None


def _send_resend_sync(client, sender: str, to: str, subject: str, html: str) -> str:
    result = client.Emails.send({
        "from": sender,
        "to": [to],
        "subject": subject,
        "html": html,
    })
    return result.get("id", "resend-ok")


# ---- Public API ------------------------------------------------------------
async def notify_owner(subject: str, html: str) -> None:
    """Fire-and-forget email to the owner. Never raises."""
    owner = _owner_email()
    if not owner:
        logger.info(f"[email skipped — OWNER_EMAIL not set] {subject}")
        return

    sender = _sender_email()
    smtp = _smtp_config()
    if smtp:
        try:
            backend_id = await asyncio.to_thread(
                _send_smtp_sync, smtp, sender, owner, subject, html
            )
            logger.info(f"[email sent via SMTP] {backend_id} subject={subject!r}")
            return
        except Exception as e:
            logger.error(f"[SMTP send failed] {e!r} — will try Resend if configured")

    client = _resend_client()
    if client:
        try:
            email_id = await asyncio.to_thread(
                _send_resend_sync, client, sender, owner, subject, html
            )
            logger.info(f"[email sent via Resend] id={email_id} subject={subject!r}")
            return
        except Exception as e:
            logger.error(f"[Resend send failed] {e!r}")

    logger.info(f"[email skipped — no backend configured] {subject}")


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
            f'<div style="color:#92400e;line-height:1.5;">{"<br>".join(x for x in addr_lines if x)}</div>'
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
