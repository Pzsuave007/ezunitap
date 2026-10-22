import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import {
  Store, MapPin, Phone, Mail, Globe, BadgeCheck, Loader2, Send,
  ArrowLeft, CheckCircle2, MessageSquare, ChevronLeft, ChevronRight,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND = process.env.REACT_APP_BACKEND_URL;

function LangToggle() {
  const { i18n } = useTranslation();
  const cur = (i18n.language || "en").startsWith("es") ? "es" : "en";
  return (
    <div className="inline-flex rounded-full bg-white/20 p-0.5 text-xs font-bold" data-testid="directory-lang-toggle">
      {["en", "es"].map((l) => (
        <button key={l} onClick={() => i18n.changeLanguage(l)} data-testid={`directory-lang-${l}`}
          className={`px-2.5 py-1 rounded-full transition-colors ${cur === l ? "bg-white text-slate-900" : "text-white/90"}`}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export default function DirectoryListing() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const es = (i18n.language || "en").startsWith("es");

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
    if (!form.name.trim() || (!form.phone.trim() && !form.email.trim())) return;
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
      <p className="font-semibold">{t("directory.notFound")}</p>
      <button onClick={() => navigate("/directorio")} className="mt-4 text-emerald-700 font-semibold">{t("directory.backToDirectory")}</button>
    </div>
  );
  if (!data) return <div className="min-h-screen flex justify-center items-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const gallery = data.gallery || [];
  const dirName = config?.name || "Pro Finder";

  return (
    <div className="min-h-screen bg-slate-50" data-testid="directory-listing">
      <header className="text-white sticky top-0 z-20" style={{ background: primary }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button onClick={() => navigate("/directorio")} className="flex items-center gap-1.5 text-sm font-medium opacity-90" data-testid="listing-back">
            <ArrowLeft className="w-4 h-4" /> {dirName}
          </button>
          <div className="flex items-center gap-2">
            <LangToggle />
            <a href={`tel:${data.phone}`} data-testid="listing-top-call"
              className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors">
              <Phone className="w-4 h-4" /> {t("directory.call")}
            </a>
          </div>
        </div>
      </header>

      <div className="relative h-52 sm:h-64 bg-slate-200">
        {data.hero_url ? <img src={`${BACKEND}${data.hero_url}`} alt={data.business_name} className="w-full h-full object-cover" /> :
          <div className="w-full h-full flex items-center justify-center text-slate-300"><Store className="w-12 h-12" /></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      <main className="max-w-4xl mx-auto px-4 -mt-16 relative z-10 pb-28">
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
                  <BadgeCheck className="w-3.5 h-3.5" /> {t("directory.verified")}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 flex items-center gap-1 mt-1"><MapPin className="w-3.5 h-3.5" /> {data.city}{data.state ? `, ${data.state}` : ""}{data.service_area ? ` · ${data.service_area}` : ""}</p>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {(data.categories || []).map((c) => (
                <span key={c} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{catLabel(c)}</span>
              ))}
              {(data.custom_services || []).map((s) => (
                <span key={s} className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">{s}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <a href={`tel:${data.phone}`} data-testid="listing-call-btn"
            className="flex items-center justify-center gap-2 h-12 rounded-xl text-white font-semibold" style={{ background: primary }}>
            <Phone className="w-5 h-5" /> {t("directory.callNow")}
          </a>
          <a href="#contact" data-testid="listing-quote-btn"
            className="flex items-center justify-center gap-2 h-12 rounded-xl bg-emerald-600 text-white font-semibold">
            <MessageSquare className="w-5 h-5" /> {t("directory.getQuote")}
          </a>
        </div>

        {data.about && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mt-4">
            <h2 className="font-heading text-lg font-bold text-slate-800 mb-2">{t("directory.about")}</h2>
            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{data.about}</p>
          </section>
        )}

        {gallery.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mt-4">
            <h2 className="font-heading text-lg font-bold text-slate-800 mb-3">{t("directory.ourWork")}</h2>
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

        <section id="contact" className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mt-4 scroll-mt-20">
          <h2 className="font-heading text-lg font-bold text-slate-800">{t("directory.requestQuoteTitle")}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{t("directory.requestQuoteDesc", { business: data.business_name })}</p>
          {sent ? (
            <div className="flex flex-col items-center text-center py-8" data-testid="listing-sent">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
              <p className="font-bold text-slate-800">{t("directory.sentTitle")}</p>
              <p className="text-sm text-slate-500 mt-1">{t("directory.sentDesc", { business: data.business_name })}</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3 mt-4" data-testid="listing-form">
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="listing-form-name"
                placeholder={t("directory.yourName")} className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-400" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="listing-form-phone"
                  placeholder={t("directory.phone")} className="h-11 px-3.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-400" />
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="listing-form-email"
                  placeholder={t("directory.email")} className="h-11 px-3.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-400" />
              </div>
              <select value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} data-testid="listing-form-service"
                className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm text-slate-700 outline-none focus:border-emerald-400">
                <option value="">{t("directory.whatNeed")}</option>
                {(data.categories || []).map((c) => <option key={c} value={catLabel(c)}>{catLabel(c)}</option>)}
                {(data.custom_services || []).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="listing-form-message"
                placeholder={t("directory.tellProject")} rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-400 resize-none" />
              <p className="text-[11px] text-slate-400">{t("directory.contactRequired")}</p>
              <button type="submit" disabled={sending} data-testid="listing-form-submit"
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                {t("directory.sendRequest")}
              </button>
            </form>
          )}
          <div className="flex flex-wrap gap-4 mt-5 pt-4 border-t border-slate-100 text-sm">
            {data.phone && <a href={`tel:${data.phone}`} className="flex items-center gap-1.5 text-slate-600"><Phone className="w-4 h-4" /> {data.phone}</a>}
            {data.email && <a href={`mailto:${data.email}`} className="flex items-center gap-1.5 text-slate-600"><Mail className="w-4 h-4" /> {data.email}</a>}
            {data.website_url && <a href={data.website_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-slate-600"><Globe className="w-4 h-4" /> {t("directory.website")}</a>}
          </div>
        </section>

        <p className="text-center text-xs text-slate-400 mt-6">{t("directory.poweredBy")} {dirName}</p>
      </main>
    </div>
  );
}
