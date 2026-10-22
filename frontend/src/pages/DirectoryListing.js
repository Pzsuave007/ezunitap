import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Store, MapPin, Phone, Mail, Globe, BadgeCheck, Loader2, Send,
  ArrowLeft, CheckCircle2, MessageSquare, ChevronLeft, ChevronRight,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND = process.env.REACT_APP_BACKEND_URL;
const lang = () => (typeof navigator !== "undefined" && (navigator.language || "es").startsWith("en") ? "en" : "es");

export default function DirectoryListing() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const es = lang() === "es";
  const T = (en, esT) => (es ? esT : en);

  const [data, setData] = useState(null);
  const [config, setConfig] = useState(null);
  const [cats, setCats] = useState([]);
  const [err, setErr] = useState(false);
  const [gi, setGi] = useState(0);
  const [form, setForm] = useState({ name: "", phone: "", email: "", service: "", description: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    axios.get(`${API}/public/directory/config`).then((r) => { setConfig(r.data.config); setCats(r.data.categories || []); }).catch(() => {});
    axios.get(`${API}/public/directory/listing/${slug}`)
      .then((r) => { setData(r.data); document.title = r.data.business_name; })
      .catch(() => setErr(true));
  }, [slug]);

  const catLabel = (s) => { const c = cats.find((x) => x.slug === s); return c ? (es ? c.es : c.en) : s; };
  const primary = config?.primary_color || "#0f5f46";

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || (!form.phone.trim() && !form.email.trim())) {
      return;
    }
    setSending(true);
    try {
      await axios.post(`${API}/public/directory/listing/${slug}/lead`, { ...form, lead_type: "estimate" });
      setSent(true);
    } catch { /* noop */ }
    finally { setSending(false); }
  };

  if (err) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-slate-500 px-4">
      <Store className="w-10 h-10 mb-3 text-slate-300" />
      <p className="font-semibold">{T("Profile not found", "Ficha no encontrada")}</p>
      <button onClick={() => navigate("/directorio")} className="mt-4 text-emerald-700 font-semibold">{T("Back to directory", "Volver al directorio")}</button>
    </div>
  );
  if (!data) return <div className="min-h-screen flex justify-center items-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const gallery = data.gallery || [];
  const dirName = config?.name || "Pro Finder";

  return (
    <div className="min-h-screen bg-slate-50" data-testid="directory-listing">
      {/* Top bar */}
      <header className="text-white sticky top-0 z-20" style={{ background: primary }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate("/directorio")} className="flex items-center gap-1.5 text-sm font-medium opacity-90" data-testid="listing-back">
            <ArrowLeft className="w-4 h-4" /> {dirName}
          </button>
          <a href={`tel:${data.phone}`} data-testid="listing-top-call"
            className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors">
            <Phone className="w-4 h-4" /> {T("Call", "Llamar")}
          </a>
        </div>
      </header>

      {/* Hero */}
      <div className="relative h-52 sm:h-64 bg-slate-200">
        {data.hero_url ? <img src={`${BACKEND}${data.hero_url}`} alt={data.business_name} className="w-full h-full object-cover" /> :
          <div className="w-full h-full flex items-center justify-center text-slate-300"><Store className="w-12 h-12" /></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      <main className="max-w-4xl mx-auto px-4 -mt-16 relative z-10 pb-28">
        {/* Identity card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-start gap-4">
          <div className="w-20 h-20 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 flex-none -mt-10 shadow-md">
            {data.logo_url ? <img src={`${BACKEND}${data.logo_url}`} alt="" className="w-full h-full object-cover" /> :
              <div className="w-full h-full flex items-center justify-center text-slate-300"><Store className="w-7 h-7" /></div>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900">{data.business_name}</h1>
              {data.badge && (
                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full" data-testid="listing-badge">
                  <BadgeCheck className="w-3.5 h-3.5" /> {T("Verified", "Verificado")}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 flex items-center gap-1 mt-1"><MapPin className="w-3.5 h-3.5" /> {data.city}{data.state ? `, ${data.state}` : ""}{data.service_area ? ` · ${data.service_area}` : ""}</p>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {(data.categories || []).map((c) => (
                <span key={c} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{catLabel(c)}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Primary CTAs */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <a href={`tel:${data.phone}`} data-testid="listing-call-btn"
            className="flex items-center justify-center gap-2 h-12 rounded-xl text-white font-semibold" style={{ background: primary }}>
            <Phone className="w-5 h-5" /> {T("Call now", "Llamar ahora")}
          </a>
          <a href="#contact" data-testid="listing-quote-btn"
            className="flex items-center justify-center gap-2 h-12 rounded-xl bg-emerald-600 text-white font-semibold">
            <MessageSquare className="w-5 h-5" /> {T("Get a quote", "Pedir cotización")}
          </a>
        </div>

        {/* About */}
        {data.about && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mt-4">
            <h2 className="font-heading text-lg font-bold text-slate-800 mb-2">{T("About", "Sobre el negocio")}</h2>
            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{data.about}</p>
          </section>
        )}

        {/* Gallery */}
        {gallery.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mt-4">
            <h2 className="font-heading text-lg font-bold text-slate-800 mb-3">{T("Our work", "Nuestro trabajo")}</h2>
            <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-100" data-testid="listing-gallery">
              <img src={`${BACKEND}${gallery[gi]}`} alt="" className="w-full h-full object-cover" />
              {gallery.length > 1 && (
                <>
                  <button onClick={() => setGi((i) => Math.max(0, i - 1))} disabled={gi === 0}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center disabled:opacity-0">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button onClick={() => setGi((i) => Math.min(gallery.length - 1, i + 1))} disabled={gi === gallery.length - 1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center disabled:opacity-0">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <div className="absolute bottom-2 right-2 bg-black/55 text-white text-xs font-bold px-2 py-0.5 rounded-full">{gi + 1}/{gallery.length}</div>
                </>
              )}
            </div>
          </section>
        )}

        {/* Contact form */}
        <section id="contact" className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mt-4 scroll-mt-20">
          <h2 className="font-heading text-lg font-bold text-slate-800">{T("Request a free quote", "Pide una cotización gratis")}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{T(`Send your info to ${data.business_name}. They'll contact you directly.`, `Envía tus datos a ${data.business_name}. Te contactará directamente.`)}</p>
          {sent ? (
            <div className="flex flex-col items-center text-center py-8" data-testid="listing-sent">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
              <p className="font-bold text-slate-800">{T("Sent!", "¡Enviado!")}</p>
              <p className="text-sm text-slate-500 mt-1">{T(`${data.business_name} got your request and will reach out soon.`, `${data.business_name} recibió tu solicitud y te contactará pronto.`)}</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3 mt-4" data-testid="listing-form">
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="listing-form-name"
                placeholder={T("Your name", "Tu nombre")} className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-400" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="listing-form-phone"
                  placeholder={T("Phone", "Teléfono")} className="h-11 px-3.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-400" />
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="listing-form-email"
                  placeholder={T("Email", "Correo")} className="h-11 px-3.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-400" />
              </div>
              <select value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} data-testid="listing-form-service"
                className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:border-emerald-400">
                <option value="">{T("What do you need?", "¿Qué necesitas?")}</option>
                {(data.categories || []).map((c) => <option key={c} value={catLabel(c)}>{catLabel(c)}</option>)}
              </select>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="listing-form-message"
                placeholder={T("Tell them about your project…", "Cuéntale sobre tu proyecto…")} rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-400 resize-none" />
              <p className="text-[11px] text-slate-400">{T("Your phone or email is required so they can reply.", "Tu teléfono o correo es obligatorio para que puedan responderte.")}</p>
              <button type="submit" disabled={sending} data-testid="listing-form-submit"
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                {T("Send request", "Enviar solicitud")}
              </button>
            </form>
          )}
          {/* quick contact row */}
          <div className="flex flex-wrap gap-4 mt-5 pt-4 border-t border-slate-100 text-sm">
            {data.phone && <a href={`tel:${data.phone}`} className="flex items-center gap-1.5 text-slate-600"><Phone className="w-4 h-4" /> {data.phone}</a>}
            {data.email && <a href={`mailto:${data.email}`} className="flex items-center gap-1.5 text-slate-600"><Mail className="w-4 h-4" /> {data.email}</a>}
            {data.website_url && <a href={data.website_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-slate-600"><Globe className="w-4 h-4" /> {T("Website", "Sitio web")}</a>}
          </div>
        </section>

        <p className="text-center text-xs text-slate-400 mt-6">{T("Powered by", "Con tecnología de")} {dirName}</p>
      </main>
    </div>
  );
}
