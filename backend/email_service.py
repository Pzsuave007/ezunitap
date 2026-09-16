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
    # NOTIFY_FROM takes precedence (per-account notification system); falls back
    # to the legacy SENDER_EMAIL used by SaaS-owner emails.
    return (
        os.environ.get("NOTIFY_FROM", "").strip()
        or os.environ.get("SENDER_EMAIL", "").strip()
        or "UniTech <onboarding@resend.dev>"
    )


def _notify_enabled() -> bool:
    return (os.environ.get("NOTIFY_ENABLED", "true").strip().lower()
            in ("1", "true", "yes", "on"))


def is_configured() -> bool:
    """True when at least one backend (SMTP or Resend) is wired up AND the
    notification feature switch is on."""
    if not _notify_enabled():
        return False
    return bool(_smtp_config() or os.environ.get("RESEND_API_KEY", "").strip())


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
async def send_to(to_email: str, subject: str, html: str) -> dict:
    """Fire-and-forget email to any recipient. Never raises. Returns a status
    dict so callers (e.g. the admin test endpoint) can surface the result."""
    to_email = (to_email or "").strip()
    if not to_email:
        return {"ok": False, "skipped": "no_recipient"}
    if not _notify_enabled():
        return {"ok": False, "skipped": "disabled"}

    sender = _sender_email()
    smtp = _smtp_config()
    if smtp:
        try:
            backend_id = await asyncio.to_thread(
                _send_smtp_sync, smtp, sender, to_email, subject, html
            )
            logger.info(f"[email sent via SMTP] {backend_id} to={to_email} subject={subject!r}")
            return {"ok": True, "backend": "smtp", "id": backend_id}
        except Exception as e:
            logger.error(f"[SMTP send failed] {e!r} — will try Resend if configured")

    client = _resend_client()
    if client:
        try:
            email_id = await asyncio.to_thread(
                _send_resend_sync, client, sender, to_email, subject, html
            )
            logger.info(f"[email sent via Resend] id={email_id} to={to_email} subject={subject!r}")
            return {"ok": True, "backend": "resend", "id": email_id}
        except Exception as e:
            logger.error(f"[Resend send failed] {e!r}")
            return {"ok": False, "error": str(e)}

    logger.info(f"[email skipped — no backend configured] {subject}")
    return {"ok": False, "skipped": "no_backend"}


async def notify_owner(subject: str, html: str) -> None:
    """Fire-and-forget email to the SaaS owner (OWNER_EMAIL). Never raises."""
    owner = _owner_email()
    if not owner:
        logger.info(f"[email skipped — OWNER_EMAIL not set] {subject}")
        return
    await send_to(owner, subject, html)


def render_new_subscription_email(
    *,
    business_name: str,
    user_email: str,
    plan_label: str,
    trial_days: int,
    shipping_address: Optional[dict] = None,
    admin_url: str = "https://ezunitech.com/admin/envios",
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



# ===========================================================================
# ACCOUNT-OWNER ALERT TEMPLATES (bilingual es/en) — new lead, payment, review
# ===========================================================================
_BRAND = "#1E3A8A"
_ACCENT = "#10B981"


def _shell(*, lang: str, heading: str, intro: str, rows, cta_url: str,
           cta_label: str, footer: str, accent: str = _ACCENT) -> str:
    """Email-client-safe HTML shell (inline CSS + tables)."""
    row_html = ""
    for label, value in rows:
        if not value:
            continue
        row_html += (
            '<tr>'
            '<td style="padding:6px 16px 6px 0;color:#64748b;font-size:13px;'
            'font-family:Arial,Helvetica,sans-serif;vertical-align:top;'
            f'white-space:nowrap;">{label}</td>'
            '<td style="padding:6px 0;color:#0f172a;font-size:14px;'
            f'font-family:Arial,Helvetica,sans-serif;font-weight:600;">{value}</td>'
            '</tr>'
        )
    cta_block = ""
    if cta_url and cta_label:
        cta_block = (
            '<tr><td colspan="2" style="padding-top:22px;">'
            f'<a href="{cta_url}" style="background:{_BRAND};color:#ffffff;'
            'text-decoration:none;padding:12px 26px;border-radius:9999px;'
            'font-family:Arial,Helvetica,sans-serif;font-size:14px;'
            f'font-weight:700;display:inline-block;">{cta_label}</a>'
            '</td></tr>'
        )
    return f"""<!DOCTYPE html>
<html lang="{lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
<tr><td style="height:6px;background:{accent};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:32px 32px 8px;">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:{accent};font-weight:700;">UniTech</div>
<h1 style="font-family:Arial,Helvetica,sans-serif;font-size:22px;color:#0f172a;margin:10px 0 0;">{heading}</h1>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#475569;line-height:1.5;margin:12px 0 0;">{intro}</p>
</td></tr>
<tr><td style="padding:16px 32px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;padding:14px 18px;">
{row_html}{cta_block}
</table>
</td></tr>
<tr><td style="padding:24px 32px 32px;">
<p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#94a3b8;line-height:1.5;margin:0;">{footer}</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>"""


def build_lead_email(*, lang: str, business_name: str, lead: dict, cta_url: str):
    name = (lead.get("name") or "").strip()
    if lang == "en":
        subject = f"New lead: {name or 'someone'} wants an estimate"
        heading = "You have a new lead!"
        intro = f"Someone just contacted {business_name} through your online presence. Reply fast to win the job."
        rows = [("Name", name), ("Phone", lead.get("phone")), ("Email", lead.get("email")),
                ("Service", lead.get("service")), ("Message", lead.get("description")),
                ("Source", lead.get("source_label"))]
        cta, footer = "View in CRM", "You're receiving this because lead alerts are on for your UniTech account."
    else:
        subject = f"Nuevo lead: {name or 'alguien'} quiere un estimado"
        heading = "¡Tienes un nuevo lead!"
        intro = f"Alguien acaba de contactar a {business_name} desde tu presencia en línea. Responde rápido para ganar el trabajo."
        rows = [("Nombre", name), ("Teléfono", lead.get("phone")), ("Email", lead.get("email")),
                ("Servicio", lead.get("service")), ("Mensaje", lead.get("description")),
                ("Origen", lead.get("source_label"))]
        cta, footer = "Ver en el CRM", "Recibes este correo porque los avisos de leads están activados en tu cuenta UniTech."
    return subject, _shell(lang=lang, heading=heading, intro=intro, rows=rows,
                           cta_url=cta_url, cta_label=cta, footer=footer)


def build_payment_email(*, lang: str, business_name: str, amount: str, method: str,
                        client_name: str, invoice_number: str, remaining: str, cta_url: str):
    if lang == "en":
        subject = f"Payment received: {amount}"
        heading = "You just got paid!"
        intro = f"A payment was recorded for {business_name}. Nice work."
        rows = [("Amount", amount), ("Method", method), ("Client", client_name),
                ("Invoice", invoice_number), ("Balance left", remaining)]
        cta, footer = "View invoice", "You're receiving this because payment alerts are on for your UniTech account."
    else:
        subject = f"Pago recibido: {amount}"
        heading = "¡Acabas de recibir un pago!"
        intro = f"Se registró un pago para {business_name}. ¡Buen trabajo!"
        rows = [("Monto", amount), ("Método", method), ("Cliente", client_name),
                ("Factura", invoice_number), ("Saldo pendiente", remaining)]
        cta, footer = "Ver factura", "Recibes este correo porque los avisos de pagos están activados en tu cuenta UniTech."
    return subject, _shell(lang=lang, heading=heading, intro=intro, rows=rows,
                           cta_url=cta_url, cta_label=cta, footer=footer)


def build_review_email(*, lang: str, business_name: str, sentiment: str, rating,
                       name: str, feedback: str, contact: str, cta_url: str):
    happy = sentiment == "happy"
    stars = ("★" * int(rating)) if isinstance(rating, int) and rating else ""
    accent = _ACCENT if happy else "#F59E0B"
    if lang == "en":
        if happy:
            subject = f"New review for {business_name}"
            heading = "A client left you a great review!"
            intro = "A happy customer just shared feedback. Keep it up!"
        else:
            subject = f"A client left private feedback for {business_name}"
            heading = "A client shared private feedback"
            intro = "Reach out to fix the situation before it becomes a public review."
        rows = [("Rating", stars or (str(rating) if rating else "")), ("Name", name),
                ("Feedback", feedback), ("Contact", contact)]
        cta, footer = "View feedback", "You're receiving this because review alerts are on for your UniTech account."
    else:
        if happy:
            subject = f"Nueva reseña para {business_name}"
            heading = "¡Un cliente te dejó una gran reseña!"
            intro = "Un cliente feliz acaba de dejarte su opinión. ¡Sigue así!"
        else:
            subject = f"Un cliente dejó feedback privado para {business_name}"
            heading = "Un cliente compartió feedback privado"
            intro = "Contáctalo para arreglar la situación antes de que se vuelva una reseña pública."
        rows = [("Calificación", stars or (str(rating) if rating else "")), ("Nombre", name),
                ("Comentario", feedback), ("Contacto", contact)]
        cta, footer = "Ver feedback", "Recibes este correo porque los avisos de reseñas están activados en tu cuenta UniTech."
    return subject, _shell(lang=lang, heading=heading, intro=intro, rows=rows,
                           cta_url=cta_url, cta_label=cta, footer=footer, accent=accent)


def build_test_email(*, lang: str, business_name: str):
    if lang == "en":
        subject = "UniTech test notification"
        heading = "Email notifications are working!"
        intro = f"This is a test alert for {business_name}. If you're reading this, Resend is set up correctly."
        rows = [("Status", "Connected"), ("Provider", "Resend")]
        footer = "Test email sent from your UniTech account."
    else:
        subject = "Notificación de prueba de UniTech"
        heading = "¡Las notificaciones por email funcionan!"
        intro = f"Esta es una alerta de prueba para {business_name}. Si estás leyendo esto, Resend quedó configurado correctamente."
        rows = [("Estado", "Conectado"), ("Proveedor", "Resend")]
        footer = "Correo de prueba enviado desde tu cuenta UniTech."
    return subject, _shell(lang=lang, heading=heading, intro=intro, rows=rows,
                           cta_url="", cta_label="", footer=footer)
