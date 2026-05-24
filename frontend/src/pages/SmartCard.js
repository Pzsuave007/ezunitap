/**
 * Smart Business Card - PUBLIC page (no auth).
 * Premium mobile-first experience: glassmorphism, gradients, animations.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import {
  Phone, MessageSquare, Mail, MapPin, Save, FileText, ChevronRight,
  Loader2, Star, ShieldCheck, BadgeCheck, Send, Sparkles, X, Camera,
  Globe, Facebook, Instagram, Hammer, Calendar, ArrowUpRight,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SS_KEY = "sf_card_session";
const getSession = () => {
  let s = sessionStorage.getItem(SS_KEY);
  if (!s) {
    s = crypto.randomUUID();
    sessionStorage.setItem(SS_KEY, s);
  }
  return s;
};

const I18N = {
  en: {
    callNow: "Call",
    text: "Text",
    whatsapp: "WhatsApp",
    email: "Email",
    directions: "Directions",
    saveContact: "Save Contact",
    requestQuote: "Get a Free Estimate",
    services: "Services",
    gallery: "Recent Work",
    reviews: "Reviews",
    licensed: "Licensed",
    insured: "Insured",
    verified: "Verified",
    years: "yrs",
    yearsInBusiness: "years in business",
    askAnything: "Chat with our assistant",
    placeholder: "Type your question…",
    you: "You",
    assistant: "Assistant",
    quoteFormTitle: "Tell us about your project",
    yourName: "Your name",
    phone: "Phone",
    emailLabel: "Email",
    address: "Project address",
    service: "Service needed",
    description: "Describe your project",
    addPhoto: "Add photo (optional)",
    preferred: "Best way to reach you",
    sendRequest: "Send request",
    sending: "Sending…",
    success: "Thank you! We'll reach out shortly.",
    error: "Something went wrong. Please try again.",
    poweredBy: "Powered by ServicioFlow",
    cantTalk: "Can't talk now? Send a quick message",
  },
  es: {
    callNow: "Llamar",
    text: "Mensaje",
    whatsapp: "WhatsApp",
    email: "Email",
    directions: "Dirección",
    saveContact: "Guardar Contacto",
    requestQuote: "Pedir Cotización Gratis",
    services: "Servicios",
    gallery: "Trabajos Recientes",
    reviews: "Reseñas",
    licensed: "Licencia",
    insured: "Asegurado",
    verified: "Verificado",
    years: "años",
    yearsInBusiness: "años de experiencia",
    askAnything: "Habla con nuestro asistente",
    placeholder: "Escribe tu pregunta…",
    you: "Tú",
    assistant: "Asistente",
    quoteFormTitle: "Cuéntanos sobre tu proyecto",
    yourName: "Tu nombre",
    phone: "Teléfono",
    emailLabel: "Email",
    address: "Dirección del proyecto",
    service: "Servicio requerido",
    description: "Describe tu proyecto",
    addPhoto: "Agregar foto (opcional)",
    preferred: "Mejor forma de contactarte",
    sendRequest: "Enviar solicitud",
    sending: "Enviando…",
    success: "¡Gracias! Te contactaremos pronto.",
    error: "Algo salió mal. Inténtalo de nuevo.",
    poweredBy: "Hecho con ServicioFlow",
    cantTalk: "¿No puedes llamar ahora? Manda un mensaje",
  },
};

const fileToBase64 = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

const track = (slug, event, meta = {}) => {
  axios.post(`${API}/public/card/${slug}/track`, { event, meta }).catch(() => {});
};

export default function SmartCard() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const [lang, setLang] = useState(() => {
    const n = navigator.language || "en";
    return n.startsWith("es") ? "es" : "en";
  });
  const t = I18N[lang];
  const [chatOpen, setChatOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const trackedVisit = useRef(false);

  useEffect(() => {
    axios.get(`${API}/public/card/${slug}`).then((r) => setData(r.data)).catch(() => setErr(true));
  }, [slug]);

  useEffect(() => {
    if (data && !trackedVisit.current) {
      track(slug, "profile_visit");
      // QR-scan heuristic
      const params = new URLSearchParams(window.location.search);
      if (params.get("src") === "qr") track(slug, "qr_scan");
      trackedVisit.current = true;
    }
  }, [data, slug]);

  if (err) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-400">
        <div className="text-center">
          <Hammer className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p>This card is not available.</p>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
      </div>
    );
  }

  const { business, card, reviews, photos } = data;
  const brand = card.brand_color || "#1E3A8A";
  const phoneClean = (business.phone || "").replace(/\D/g, "");
  const whatsappClean = (card.whatsapp || business.phone || "").replace(/\D/g, "");

  const QuickAction = ({ icon: Icon, label, onClick, href, primary }) => {
    const cls = `tap flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl ${
      primary
        ? "text-white shadow-lg"
        : "bg-white/80 backdrop-blur text-slate-800 border border-white/60 shadow-sm"
    }`;
    const style = primary ? { background: `linear-gradient(135deg, ${brand}, #10B981)` } : {};
    const content = (
      <>
        <Icon className="w-5 h-5" strokeWidth={2.2} />
        <span className="text-[11px] font-semibold">{label}</span>
      </>
    );
    if (href) {
      return (
        <a href={href} onClick={onClick} className={cls} style={style}>{content}</a>
      );
    }
    return (
      <button onClick={onClick} className={cls} style={style}>{content}</button>
    );
  };

  const initials = (business.name || "")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${brand} 0%, #0f172a 70%, #10B981 130%)`,
          }}
        />
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }} />
        <div className="relative px-5 pt-8 pb-6 text-white">
          <div className="flex items-center justify-end gap-2 mb-4">
            <button
              onClick={() => { track(slug, "language_switch", { to: lang === "en" ? "es" : "en" }); setLang(lang === "en" ? "es" : "en"); }}
              className="tap flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur text-xs font-semibold border border-white/20"
              data-testid="card-lang-toggle"
            >
              <Globe className="w-3.5 h-3.5" /> {lang === "en" ? "ES" : "EN"}
            </button>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-3xl bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center text-2xl font-heading font-bold flex-shrink-0">
              {initials || <Hammer className="w-8 h-8" />}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-heading text-2xl font-bold tracking-tight leading-tight" data-testid="card-business-name">
                {business.name}
              </h1>
              {card.tagline && <p className="text-white/85 text-sm mt-1">{card.tagline}</p>}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {card.rating > 0 && (
                  <div className="flex items-center gap-1 text-amber-300 text-xs font-bold">
                    <Star className="w-3.5 h-3.5 fill-amber-300" /> {card.rating.toFixed(1)}
                  </div>
                )}
                {card.years_in_business > 0 && (
                  <span className="text-xs text-white/80">· {card.years_in_business} {t.years}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {card.is_licensed && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-100 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" /> {t.licensed}
              </span>
            )}
            {card.is_insured && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-100 text-xs font-semibold">
                <BadgeCheck className="w-3.5 h-3.5" /> {t.insured}
              </span>
            )}
            {card.service_area && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white/90 text-xs font-semibold">
                <MapPin className="w-3.5 h-3.5" /> {card.service_area}
              </span>
            )}
          </div>
        </div>

        {/* Quick actions overlap hero */}
        <div className="relative px-4 -mt-2 pb-3">
          <div className="grid grid-cols-4 gap-2">
            {phoneClean && (
              <QuickAction icon={Phone} label={t.callNow} href={`tel:${phoneClean}`} onClick={() => track(slug, "call_click")} />
            )}
            {phoneClean && (
              <QuickAction icon={MessageSquare} label={t.text} href={`sms:${phoneClean}`} onClick={() => track(slug, "text_click")} />
            )}
            {whatsappClean && (
              <QuickAction icon={Send} label={t.whatsapp} href={`https://wa.me/${whatsappClean}`} onClick={() => track(slug, "whatsapp_click")} />
            )}
            {business.email && (
              <QuickAction icon={Mail} label={t.email} href={`mailto:${business.email}`} onClick={() => track(slug, "email_click")} />
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-5 max-w-2xl mx-auto">
        {/* Primary CTA */}
        <button
          data-testid="card-request-quote"
          onClick={() => setFormOpen(true)}
          className="tap w-full rounded-2xl px-6 py-5 text-white font-bold text-base shadow-xl flex items-center justify-between"
          style={{ background: `linear-gradient(135deg, ${brand} 0%, #10B981 100%)` }}
        >
          <span className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" /> {t.requestQuote}
          </span>
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Save Contact + Directions row */}
        <div className="grid grid-cols-2 gap-2">
          <a
            href={`${API}/public/card/${slug}/vcard`}
            onClick={() => track(slug, "contact_save")}
            data-testid="card-save-contact"
            className="tap rounded-2xl bg-white border border-slate-200 px-4 py-3.5 flex items-center justify-center gap-2 font-semibold text-sm text-slate-800"
          >
            <Save className="w-4 h-4" /> {t.saveContact}
          </a>
          {business.address && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(business.address)}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => track(slug, "directions_click")}
              className="tap rounded-2xl bg-white border border-slate-200 px-4 py-3.5 flex items-center justify-center gap-2 font-semibold text-sm text-slate-800"
            >
              <MapPin className="w-4 h-4" /> {t.directions}
            </a>
          )}
        </div>

        {/* Services */}
        {card.services?.length > 0 && (
          <section>
            <h2 className="font-heading text-lg font-bold tracking-tight mb-3">{t.services}</h2>
            <div className="grid grid-cols-2 gap-2">
              {card.services.map((s, i) => (
                <div key={i} className="rounded-2xl bg-white border border-slate-200 p-4 tap" onClick={() => track(slug, "service_click", { name: s.name })}>
                  <div className="text-2xl mb-1">{s.icon || "🔨"}</div>
                  <div className="font-semibold text-sm">{s.name}</div>
                  {s.description && <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{s.description}</div>}
                  {s.starting_price && <div className="text-xs font-bold mt-1.5" style={{ color: brand }}>{s.starting_price}</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Photo gallery */}
        {photos.length > 0 && (
          <section>
            <h2 className="font-heading text-lg font-bold tracking-tight mb-3">{t.gallery}</h2>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2 snap-x">
              {photos.map((p) => (
                <a
                  key={p.id}
                  href={`${API}/public/card/photo/${p.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="relative flex-shrink-0 w-44 h-56 rounded-2xl overflow-hidden bg-slate-200 snap-start tap"
                >
                  <img
                    src={`${API}/public/card/photo/${p.id}`}
                    alt={p.label}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {p.label && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/55 text-white text-[10px] font-bold uppercase tracking-wider">
                      {p.label}
                    </span>
                  )}
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-heading text-lg font-bold tracking-tight">{t.reviews}</h2>
              {card.google_review_url && (
                <a
                  href={card.google_review_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => track(slug, "review_click")}
                  className="text-xs font-semibold flex items-center gap-1"
                  style={{ color: brand }}
                >
                  Google <ArrowUpRight className="w-3 h-3" />
                </a>
              )}
            </div>
            <div className="space-y-2">
              {reviews.slice(0, 5).map((r) => (
                <div key={r.id} className="rounded-2xl bg-white border border-slate-200 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs">
                      {(r.customer_name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="font-semibold text-sm">{r.customer_name}</div>
                    <div className="ml-auto flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={`w-3.5 h-3.5 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-slate-700">{r.text}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Social links */}
        {(card.facebook || card.instagram || card.website) && (
          <section className="flex items-center justify-center gap-3 pt-2">
            {card.website && (
              <a href={card.website} target="_blank" rel="noreferrer" onClick={() => track(slug, "social_click", { type: "web" })} className="w-11 h-11 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700">
                <Globe className="w-4 h-4" />
              </a>
            )}
            {card.facebook && (
              <a href={card.facebook} target="_blank" rel="noreferrer" onClick={() => track(slug, "social_click", { type: "fb" })} className="w-11 h-11 rounded-full bg-white border border-slate-200 flex items-center justify-center text-blue-700">
                <Facebook className="w-4 h-4" />
              </a>
            )}
            {card.instagram && (
              <a href={card.instagram} target="_blank" rel="noreferrer" onClick={() => track(slug, "social_click", { type: "ig" })} className="w-11 h-11 rounded-full bg-white border border-slate-200 flex items-center justify-center text-pink-600">
                <Instagram className="w-4 h-4" />
              </a>
            )}
          </section>
        )}

        {card.hours && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
            <Calendar className="w-3.5 h-3.5" /> {card.hours}
          </div>
        )}

        <div className="text-center text-[11px] text-slate-400 pt-4 pb-32">
          {t.poweredBy}
        </div>
      </div>

      {/* AI Chat floating button */}
      <button
        onClick={() => setChatOpen(true)}
        data-testid="card-chat-fab"
        className="fixed bottom-5 right-5 z-30 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white tap"
        style={{ background: `linear-gradient(135deg, ${brand}, #10B981)` }}
      >
        <Sparkles className="w-6 h-6" />
      </button>

      {chatOpen && (
        <ChatPanel
          slug={slug}
          brand={brand}
          businessName={business.name}
          lang={lang}
          t={t}
          onClose={() => setChatOpen(false)}
        />
      )}

      {formOpen && (
        <QuoteForm
          slug={slug}
          brand={brand}
          card={card}
          lang={lang}
          t={t}
          onClose={() => setFormOpen(false)}
        />
      )}
    </div>
  );
}

// =========================== AI Chat Panel ===========================
function ChatPanel({ slug, brand, businessName, lang, t, onClose }) {
  const [messages, setMessages] = useState([
    { role: "assistant", content: lang === "es"
      ? `¡Hola! 👋 Soy el asistente de ${businessName}. ¿En qué puedo ayudarte hoy?`
      : `Hi! 👋 I'm the assistant for ${businessName}. How can I help you today?` },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const session = useMemo(() => getSession(), []);
  const bodyRef = useRef(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/public/card/${slug}/chat`, {
        session_id: session,
        message: text,
        language: lang,
      });
      setMessages((m) => [...m, { role: "assistant", content: data.reply, leadCreated: data.lead_created }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: lang === "es" ? "Disculpa, hubo un error. Intenta de nuevo." : "Sorry, something went wrong. Try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full lg:max-w-md bg-white rounded-t-3xl lg:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] lg:max-h-[640px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 rounded-t-3xl"
             style={{ background: `linear-gradient(135deg, ${brand}, #10B981)` }}>
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="text-white flex-1 min-w-0">
            <div className="font-heading font-bold leading-none">{t.askAnything}</div>
            <div className="text-[11px] text-white/80 mt-1">{businessName}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white tap" data-testid="chat-close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div ref={bodyRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "text-white rounded-br-sm"
                  : "bg-white text-slate-800 border border-slate-200 rounded-bl-sm"
              }`} style={m.role === "user" ? { background: brand } : {}}>
                {m.content}
                {m.leadCreated && (
                  <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                    <BadgeCheck className="w-3 h-3" /> Lead captured
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> …
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-slate-100 flex items-center gap-2">
          <input
            data-testid="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={t.placeholder}
            className="flex-1 h-12 rounded-full bg-slate-100 px-4 text-sm focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': brand }}
          />
          <button
            data-testid="chat-send"
            onClick={send}
            disabled={loading || !input.trim()}
            className="w-12 h-12 rounded-full text-white flex items-center justify-center tap disabled:opacity-40"
            style={{ background: brand }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================== Quick Quote Form ===========================
function QuoteForm({ slug, brand, card, lang, t, onClose }) {
  const [form, setForm] = useState({
    name: "", phone: "", email: "", address: "",
    service: "", description: "", preferred_contact: "phone",
  });
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const onPhoto = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhoto(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || (!form.phone.trim() && !form.email.trim()) || !form.description.trim()) {
      setError(lang === "es" ? "Por favor completa nombre, teléfono o email, y descripción." : "Please fill name, phone or email, and description.");
      return;
    }
    setLoading(true);
    try {
      let photo_b64 = null;
      if (photo) {
        try { photo_b64 = await fileToBase64(photo); } catch {}
      }
      await axios.post(`${API}/public/card/${slug}/lead`, { ...form, photo_b64 });
      setDone(true);
    } catch (err) {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full lg:max-w-md bg-white rounded-t-3xl lg:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 px-5 py-4 border-b border-slate-100 flex items-center gap-3 rounded-t-3xl bg-white">
          <div className="flex-1 min-w-0">
            <div className="font-heading font-bold tracking-tight">{t.quoteFormTitle}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 tap" data-testid="form-close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${brand}, #10B981)` }}>
              <BadgeCheck className="w-8 h-8 text-white" />
            </div>
            <h3 className="font-heading text-xl font-bold mb-1">{t.success}</h3>
            <button onClick={onClose} className="mt-6 rounded-xl px-6 py-3 text-white font-semibold tap" style={{ background: brand }}>
              OK
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-3">
            <Field label={t.yourName + " *"}>
              <input data-testid="lead-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="h-12 rounded-xl bg-slate-50 border border-slate-200 px-4 w-full focus:outline-none focus:bg-white" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t.phone}>
                <input data-testid="lead-phone" type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-12 rounded-xl bg-slate-50 border border-slate-200 px-4 w-full focus:outline-none focus:bg-white" />
              </Field>
              <Field label={t.emailLabel}>
                <input data-testid="lead-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-12 rounded-xl bg-slate-50 border border-slate-200 px-4 w-full focus:outline-none focus:bg-white" />
              </Field>
            </div>
            <Field label={t.address}>
              <input data-testid="lead-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="h-12 rounded-xl bg-slate-50 border border-slate-200 px-4 w-full focus:outline-none focus:bg-white" />
            </Field>
            {card.services?.length > 0 && (
              <Field label={t.service}>
                <select data-testid="lead-service" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} className="h-12 rounded-xl bg-slate-50 border border-slate-200 px-4 w-full focus:outline-none focus:bg-white">
                  <option value="">—</option>
                  {card.services.map((s, i) => (
                    <option key={i} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </Field>
            )}
            <Field label={t.description + " *"}>
              <textarea data-testid="lead-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required rows={4} className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 w-full focus:outline-none focus:bg-white" />
            </Field>
            <Field label={t.addPhoto}>
              <label className="rounded-xl bg-slate-50 border border-dashed border-slate-300 px-4 py-3 w-full flex items-center justify-center gap-2 cursor-pointer text-sm text-slate-600">
                {photoPreview ? (
                  <img src={photoPreview} alt="preview" className="h-16 rounded-lg" />
                ) : (
                  <><Camera className="w-4 h-4" /> Tap to add</>
                )}
                <input type="file" accept="image/*" hidden onChange={onPhoto} data-testid="lead-photo" />
              </label>
            </Field>
            <Field label={t.preferred}>
              <div className="flex gap-2 flex-wrap">
                {["phone", "text", "email", "whatsapp"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm({ ...form, preferred_contact: p })}
                    className={`px-4 py-2 rounded-full text-xs font-semibold ${form.preferred_contact === p ? "text-white" : "bg-slate-100 text-slate-600"}`}
                    style={form.preferred_contact === p ? { background: brand } : {}}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </Field>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <button
              data-testid="lead-submit"
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-2xl text-white font-bold text-base shadow-lg flex items-center justify-center gap-2 tap"
              style={{ background: `linear-gradient(135deg, ${brand}, #10B981)` }}
            >
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> {t.sending}</> : <><Send className="w-5 h-5" /> {t.sendRequest}</>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const Field = ({ label, children }) => (
  <div>
    <div className="text-xs font-semibold text-slate-600 mb-1.5">{label}</div>
    {children}
  </div>
);
