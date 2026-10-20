import { useState } from "react";
import axios from "axios";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function isLight(hex) {
  if (!hex) return false;
  const c = hex.replace("#", ""); if (c.length < 6) return false;
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150;
}

const T = (lang, en, es) => (lang === "es" ? es : en);

export function NewsletterSection({ ctx, bg }) {
  const nl = ctx?.data?.newsletter || {};
  const lang = ctx?.lang || "en";
  const slug = ctx?.slug;
  const accent = ctx?.accent || "#2563EB";
  const accentText = ctx?.accentText || (isLight(accent) ? "#0A0A0A" : "#FFFFFF");
  const light = isLight(bg);
  const ink = light ? "#0f172a" : "#ffffff";
  const muted = light ? "#64748b" : "rgba(255,255,255,.72)";
  const fieldBg = light ? "#ffffff" : "rgba(255,255,255,.07)";
  const fieldBorder = light ? "rgba(0,0,0,.14)" : "rgba(255,255,255,.18)";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const title = (lang === "es" ? nl.title_es : nl.title) || T(lang, "Join our newsletter", "Únete al boletín");
  const subtitle = (lang === "es" ? nl.subtitle_es : nl.subtitle) ||
    T(lang, "Get news about classes and events straight to your inbox.",
      "Recibe novedades de clases y eventos directo en tu correo.");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!email.trim() || !email.includes("@")) { setErr(T(lang, "Enter a valid email.", "Ingresa un correo válido.")); return; }
    setBusy(true);
    try {
      await axios.post(`${API}/public/newsletter/${slug}/subscribe`, { name: name.trim(), email: email.trim() });
      setDone(true);
    } catch (e2) {
      setErr(e2?.response?.data?.detail || T(lang, "Something went wrong. Try again.", "Algo salió mal. Intenta de nuevo."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ws-sec py-16 sm:py-24" style={{ background: bg }} data-testid="newsletter-section">
      <div className="max-w-2xl mx-auto px-5 sm:px-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-5" style={{ background: accent, color: accentText }}>
          <Mail className="w-6 h-6" />
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3" style={{ color: ink }} data-testid="newsletter-title">{title}</h2>
        <p className="text-base sm:text-lg mb-8" style={{ color: muted }}>{subtitle}</p>

        {done ? (
          <div className="inline-flex items-center gap-2 px-5 py-4 rounded-xl font-semibold" style={{ background: light ? "rgba(16,185,129,.1)" : "rgba(16,185,129,.18)", color: light ? "#047857" : "#6ee7b7" }} data-testid="newsletter-success">
            <CheckCircle2 className="w-5 h-5" /> {T(lang, "You're subscribed! Check your inbox.", "¡Listo! Revisa tu correo.")}
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto" data-testid="newsletter-form">
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder={T(lang, "Your name", "Tu nombre")}
              className="flex-1 px-4 py-3.5 rounded-xl text-base outline-none focus:ring-2 transition"
              style={{ background: fieldBg, border: `1px solid ${fieldBorder}`, color: ink }}
              data-testid="newsletter-name-input" />
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              placeholder={T(lang, "Email address", "Tu correo")}
              className="flex-1 px-4 py-3.5 rounded-xl text-base outline-none focus:ring-2 transition"
              style={{ background: fieldBg, border: `1px solid ${fieldBorder}`, color: ink }}
              data-testid="newsletter-email-input" />
            <button
              type="submit" disabled={busy}
              className="px-6 py-3.5 rounded-xl font-bold whitespace-nowrap transition hover:opacity-90 disabled:opacity-60 inline-flex items-center justify-center gap-2"
              style={{ background: accent, color: accentText }}
              data-testid="newsletter-submit">
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {T(lang, "Subscribe", "Suscribirme")}
            </button>
          </form>
        )}
        {err && <p className="text-sm mt-3 text-red-500" data-testid="newsletter-error">{err}</p>}
      </div>
    </section>
  );
}
