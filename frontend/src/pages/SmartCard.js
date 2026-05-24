/**
 * Smart Business Card - PUBLIC page.
 * Photo-first premium design inspired by modern digital business cards
 * with our luxury touches: mesh gradients, holographic shimmer, glassmorphism.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import axios from "axios";
import {
  Phone, MessageSquare, Mail, MapPin, Save, ChevronRight,
  Loader2, Star, ShieldCheck, BadgeCheck, Send, Sparkles, X, Camera,
  Globe, Facebook, Instagram, Hammer, Calendar, ArrowUpRight,
  QrCode, Share2,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SS_KEY = "sf_card_session";
const getSession = () => {
  let s = sessionStorage.getItem(SS_KEY);
  if (!s) { s = crypto.randomUUID(); sessionStorage.setItem(SS_KEY, s); }
  return s;
};

const I18N = {
  en: {
    callNow: "Call", text: "Text", whatsapp: "WhatsApp", email: "Email",
    directions: "Directions", saveContact: "Save Contact", share: "Share",
    qrCode: "QR Code", getQuote: "Get Quote",
    requestQuote: "Request a Free Estimate", services: "Services",
    gallery: "Recent work", reviews: "Reviews", aboutMe: "About",
    licensed: "Licensed", insured: "Insured", verified: "Verified",
    years: "Years", yearsLong: "years experience", projects: "Projects",
    askAnything: "Ask anything", placeholder: "Type your question…",
    quoteFormTitle: "Let's get started", yourName: "Your name",
    phone: "Phone", emailLabel: "Email", address: "Project address",
    service: "Service needed", description: "Describe your project",
    addPhoto: "Add photo (optional)", preferred: "Best way to reach you",
    sendRequest: "Send request", sending: "Sending…",
    success: "We received your request",
    successSub: "We'll reach out to you within 24 hours.",
    error: "Something went wrong. Please try again.",
    poweredBy: "Powered by ServicioFlow",
    chatGreeting: (b) => `Hi 👋 I'm here on behalf of ${b}. Ask me anything.`,
    copied: "Link copied",
  },
  es: {
    callNow: "Llamar", text: "Mensaje", whatsapp: "WhatsApp", email: "Email",
    directions: "Dirección", saveContact: "Guardar Contacto", share: "Compartir",
    qrCode: "Código QR", getQuote: "Cotizar",
    requestQuote: "Pedir Cotización Gratis", services: "Servicios",
    gallery: "Trabajos recientes", reviews: "Reseñas", aboutMe: "Sobre",
    licensed: "Con Licencia", insured: "Asegurado", verified: "Verificado",
    years: "Años", yearsLong: "años de experiencia", projects: "Proyectos",
    askAnything: "Pregunta lo que sea", placeholder: "Escribe tu pregunta…",
    quoteFormTitle: "Empecemos", yourName: "Tu nombre",
    phone: "Teléfono", emailLabel: "Email", address: "Dirección del proyecto",
    service: "Servicio requerido", description: "Describe tu proyecto",
    addPhoto: "Agregar foto (opcional)", preferred: "Mejor forma de contactarte",
    sendRequest: "Enviar solicitud", sending: "Enviando…",
    success: "¡Recibimos tu solicitud!",
    successSub: "Te contactaremos en menos de 24 horas.",
    error: "Algo salió mal. Inténtalo de nuevo.",
    poweredBy: "Hecho con ServicioFlow",
    chatGreeting: (b) => `Hola 👋 Estoy aquí de parte de ${b}. Pregúntame lo que quieras.`,
    copied: "Link copiado",
  },
};

const fileToBase64 = (file) =>
  new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });

const track = (slug, event, meta = {}) =>
  axios.post(`${API}/public/card/${slug}/track`, { event, meta }).catch(() => {});

const adjustColor = (hex, amt) => {
  try {
    const h = hex.replace("#", "");
    let r = parseInt(h.substring(0, 2), 16);
    let g = parseInt(h.substring(2, 4), 16);
    let b = parseInt(h.substring(4, 6), 16);
    r = Math.max(0, Math.min(255, r + amt));
    g = Math.max(0, Math.min(255, g + amt));
    b = Math.max(0, Math.min(255, b + amt));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  } catch { return hex; }
};

const useCountUp = (target, duration = 1200) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) return setVal(0);
    let raf, start;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
};

export default function SmartCard() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const [lang, setLang] = useState(() => (navigator.language || "en").startsWith("es") ? "es" : "en");
  const t = I18N[lang];
  const [chatOpen, setChatOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const trackedVisit = useRef(false);

  useEffect(() => {
    axios.get(`${API}/public/card/${slug}`).then((r) => setData(r.data)).catch(() => setErr(true));
  }, [slug]);

  useEffect(() => {
    if (data && !trackedVisit.current) {
      track(slug, "profile_visit");
      const params = new URLSearchParams(window.location.search);
      if (params.get("src") === "qr") track(slug, "qr_scan");
      trackedVisit.current = true;
    }
  }, [data, slug]);

  const rating = useCountUp(data?.card?.rating || 0);
  const years = useCountUp(data?.card?.years_in_business || 0);
  const reviewCount = useCountUp(data?.reviews?.length || 0);

  if (err) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        <div className="text-center">
          <Hammer className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p>This card is not available.</p>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-7 h-7 animate-spin text-white/50" />
      </div>
    );
  }

  const { business, card, reviews, photos } = data;
  const brand = card.brand_color || "#1E3A8A";
  const brandDeep = adjustColor(brand, -50);
  const brandLight = adjustColor(brand, 70);
  const accent = "#10B981";
  const logoUrl = card.logo_photo_id ? `${API}/public/card/photo/${card.logo_photo_id}` : null;
  const profileUrl = card.profile_photo_id ? `${API}/public/card/photo/${card.profile_photo_id}` : null;

  const phoneClean = (business.phone || "").replace(/\D/g, "");
  const whatsappClean = (card.whatsapp || business.phone || "").replace(/\D/g, "");
  const ownerName = business.owner_name || business.name;

  const initials = (ownerName || business.name || "")
    .split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  const publicUrl = `${window.location.origin}/c/${slug}`;

  const shareCard = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: business.name, url: publicUrl }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(publicUrl); alert(t.copied); } catch {}
    }
  };

  return (
    <div
      className="smartcard min-h-screen text-white relative overflow-x-hidden"
      style={{ background: `radial-gradient(ellipse at top, ${brandDeep} 0%, #050810 65%)` }}
    >
      <CardStyles brand={brand} brandLight={brandLight} accent={accent} brandDeep={brandDeep} />

      {/* Mesh gradient orbs */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="mesh-orb mesh-orb-1" style={{ background: brand }} />
        <div className="mesh-orb mesh-orb-2" style={{ background: accent }} />
        <div className="mesh-orb mesh-orb-3" style={{ background: brandLight }} />
        <div className="grain-overlay" />
      </div>

      <div className="relative z-10 pb-32">
        {/* HERO — Photo-first or initials-first */}
        <div className="hero relative">
          {/* Top bar overlay */}
          <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-5 pt-6">
            {logoUrl ? (
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-xl border border-white/25 p-1.5 shadow-lg">
                <img src={logoUrl} alt="logo" className="w-full h-full object-contain rounded-xl" />
              </div>
            ) : (
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-white/55">{t.verified}</span>
            )}
            <button
              onClick={() => { track(slug, "language_switch", { to: lang === "en" ? "es" : "en" }); setLang(lang === "en" ? "es" : "en"); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-xl text-[11px] font-bold border border-white/20 tap"
              data-testid="card-lang-toggle"
            >
              <Globe className="w-3 h-3" /> {lang === "en" ? "ES" : "EN"}
            </button>
          </div>

          {/* The hero image / placeholder */}
          {profileUrl ? (
            <div className="hero-photo">
              <img src={profileUrl} alt={ownerName} className="absolute inset-0 w-full h-full object-cover" />
              <div className="hero-gradient" />
            </div>
          ) : (
            <div className="hero-placeholder">
              <div className="initials-hero">
                <div className="initials-halo" style={{ background: `radial-gradient(circle, ${brand}80 0%, transparent 70%)` }} />
                <div className="initials-text font-heading">{initials || <Hammer className="w-16 h-16" />}</div>
              </div>
            </div>
          )}

          {/* Name + role overlay */}
          <div className="absolute bottom-0 inset-x-0 z-10 px-6 pb-7 reveal">
            {card.business_type && (
              <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-white/75 mb-2">
                {card.business_type}
              </div>
            )}
            <h1 className="font-heading font-extrabold tracking-tight leading-[0.95] text-white drop-shadow-2xl text-[44px]" data-testid="card-business-name">
              {business.name}
            </h1>
            {(card.role || ownerName !== business.name) && (
              <div className="text-base font-semibold text-white/85 mt-2 drop-shadow">
                {card.role || ownerName}
              </div>
            )}
            {card.tagline && (
              <p className="text-sm text-white/75 mt-1.5 leading-snug max-w-xs">{card.tagline}</p>
            )}
          </div>
        </div>

        {/* Circular action ring — overlapping hero */}
        <div className="px-5 -mt-7 relative z-10 reveal" style={{ animationDelay: "100ms" }}>
          <div className="action-ring">
            {phoneClean && <CircleAction icon={Phone} label={t.callNow} href={`tel:${phoneClean}`} onClick={() => track(slug, "call_click")} brand={brand} />}
            {phoneClean && <CircleAction icon={MessageSquare} label={t.text} href={`sms:${phoneClean}`} onClick={() => track(slug, "text_click")} brand={brand} />}
            {whatsappClean && <CircleAction icon={Send} label={t.whatsapp} href={`https://wa.me/${whatsappClean}`} onClick={() => track(slug, "whatsapp_click")} brand={brand} />}
            {business.email && <CircleAction icon={Mail} label={t.email} href={`mailto:${business.email}`} onClick={() => track(slug, "email_click")} brand={brand} />}
          </div>
        </div>

        {/* Stats row */}
        {(card.rating > 0 || card.years_in_business > 0 || reviews.length > 0) && (
          <div className="px-5 pt-5 reveal" style={{ animationDelay: "150ms" }}>
            <div className="stats-row">
              {card.rating > 0 && (
                <StatBox value={<span className="inline-flex items-center gap-1">{rating.toFixed(1)} <Star className="w-4 h-4 fill-amber-300 text-amber-300" /></span>} label="rating" />
              )}
              {card.years_in_business > 0 && (
                <StatBox value={Math.round(years)} label={t.years} />
              )}
              {reviews.length > 0 && (
                <StatBox value={Math.round(reviewCount)} label={t.reviews} />
              )}
            </div>
          </div>
        )}

        {/* Badges */}
        {(card.is_licensed || card.is_insured || card.service_area) && (
          <div className="px-5 pt-3 reveal" style={{ animationDelay: "200ms" }}>
            <div className="flex items-center gap-2 flex-wrap">
              {card.is_licensed && <Pill icon={ShieldCheck}>{t.licensed}</Pill>}
              {card.is_insured && <Pill icon={BadgeCheck}>{t.insured}</Pill>}
              {card.service_area && <Pill icon={MapPin}>{card.service_area}</Pill>}
            </div>
          </div>
        )}

        {/* Primary CTA */}
        <div className="px-5 pt-5 reveal" style={{ animationDelay: "250ms" }}>
          <button data-testid="card-request-quote" onClick={() => setFormOpen(true)} className="primary-cta w-full">
            <span className="cta-shimmer" />
            <span className="relative z-10 flex items-center justify-between w-full">
              <span className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5" />
                <span className="font-heading font-bold text-base tracking-tight">{t.requestQuote}</span>
              </span>
              <ChevronRight className="w-5 h-5 opacity-80" />
            </span>
          </button>
        </div>

        {/* About me */}
        {card.about_me && (
          <Section title={t.aboutMe + (ownerName ? ` ${ownerName}` : "")} delay={300}>
            <div className="about-card">
              <p className="text-sm text-white/80 leading-relaxed">{card.about_me}</p>
            </div>
          </Section>
        )}

        {/* Services */}
        {card.services?.length > 0 && (
          <Section title={t.services} delay={350}>
            <div className="grid grid-cols-2 gap-2">
              {card.services.map((s, i) => (
                <div
                  key={i}
                  className="service-card tap"
                  onClick={() => track(slug, "service_click", { name: s.name })}
                  style={{ animationDelay: `${400 + i * 60}ms` }}
                >
                  {s.icon ? (
                    <div className="text-2xl mb-2 leading-none">{s.icon}</div>
                  ) : (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-heading text-xs font-bold tracking-[0.2em]" style={{ color: brandLight }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
                    </div>
                  )}
                  <div className="font-heading font-bold text-sm tracking-tight leading-tight">{s.name}</div>
                  {s.description && <div className="text-[11px] text-white/55 mt-1 line-clamp-2 leading-snug">{s.description}</div>}
                  {s.starting_price && (
                    <div className="text-[11px] font-bold mt-2 inline-flex items-center gap-1" style={{ color: brandLight }}>
                      {s.starting_price}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Photo gallery */}
        {photos.length > 0 && (
          <Section title={t.gallery} delay={450}>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5 pb-2 snap-x snap-mandatory">
              {photos.map((p, i) => (
                <a
                  key={p.id}
                  href={`${API}/public/card/photo/${p.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="gallery-card snap-center"
                  style={{ animationDelay: `${500 + i * 50}ms` }}
                >
                  <img src={`${API}/public/card/photo/${p.id}`} alt={p.label} className="w-full h-full object-cover" loading="lazy" />
                  {p.label && p.label !== "logo" && (
                    <span className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-xl text-white text-[9px] font-bold uppercase tracking-[0.15em] border border-white/10">
                      {p.label}
                    </span>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                </a>
              ))}
            </div>
          </Section>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <Section title={t.reviews} delay={550} right={card.google_review_url && (
            <a href={card.google_review_url} target="_blank" rel="noreferrer" onClick={() => track(slug, "review_click")}
               className="text-[11px] font-semibold flex items-center gap-1 text-white/70 hover:text-white">
              Google <ArrowUpRight className="w-3 h-3" />
            </a>
          )}>
            <div className="space-y-2">
              {reviews.slice(0, 5).map((r, i) => (
                <div key={r.id} className="review-card" style={{ animationDelay: `${600 + i * 80}ms` }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"
                           style={{ background: `linear-gradient(135deg, ${brand}, ${accent})` }}>
                        {(r.customer_name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="font-semibold text-sm">{r.customer_name}</div>
                    </div>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map((n) => (
                        <Star key={n} className={`w-3 h-3 ${n <= r.rating ? "fill-amber-300 text-amber-300" : "text-white/15"}`} />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-white/75 leading-relaxed">{r.text}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Socials */}
        {(card.facebook || card.instagram || card.website) && (
          <div className="px-5 pt-7 reveal" style={{ animationDelay: "700ms" }}>
            <div className="flex items-center justify-center gap-2.5">
              {card.website && <SocialBtn href={card.website} icon={Globe} onClick={() => track(slug, "social_click", { type: "web" })} />}
              {card.facebook && <SocialBtn href={card.facebook} icon={Facebook} onClick={() => track(slug, "social_click", { type: "fb" })} />}
              {card.instagram && <SocialBtn href={card.instagram} icon={Instagram} onClick={() => track(slug, "social_click", { type: "ig" })} />}
            </div>
          </div>
        )}

        {card.hours && (
          <div className="px-5 pt-3 reveal" style={{ animationDelay: "750ms" }}>
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-white/45 font-medium">
              <Calendar className="w-3 h-3" /> {card.hours}
            </div>
          </div>
        )}

        <div className="text-center text-[10px] text-white/30 pt-8 tracking-widest uppercase font-semibold">
          {t.poweredBy}
        </div>
      </div>

      {/* Floating bottom action toolbar */}
      <div className="bottom-toolbar">
        <button data-testid="toolbar-qr" onClick={() => setQrOpen(true)} className="tool-btn">
          <QrCode className="w-4 h-4" />
        </button>
        <button data-testid="toolbar-share" onClick={shareCard} className="tool-btn">
          <Share2 className="w-4 h-4" />
        </button>
        <a
          data-testid="toolbar-save"
          href={`${API}/public/card/${slug}/vcard`}
          onClick={() => track(slug, "contact_save")}
          className="tool-pill"
        >
          <Save className="w-4 h-4" /> {t.saveContact}
        </a>
        <button
          data-testid="toolbar-chat"
          onClick={() => setChatOpen(true)}
          className="tool-pill-primary"
          style={{ background: `linear-gradient(135deg, ${brand}, ${accent})` }}
        >
          <Sparkles className="w-4 h-4" />
        </button>
      </div>

      {chatOpen && (
        <ChatPanel slug={slug} brand={brand} accent={accent} businessName={business.name} lang={lang} t={t} onClose={() => setChatOpen(false)} />
      )}
      {formOpen && (
        <QuoteForm slug={slug} brand={brand} accent={accent} card={card} lang={lang} t={t} onClose={() => setFormOpen(false)} />
      )}
      {qrOpen && (
        <QrModal url={`${publicUrl}?src=qr`} brand={brand} accent={accent} businessName={business.name} onClose={() => setQrOpen(false)} />
      )}
    </div>
  );
}

// ===================== SUBCOMPONENTS =====================
const StatBox = ({ value, label }) => (
  <div className="stat-box">
    <div className="font-heading text-xl font-bold tracking-tight">{value}</div>
    <div className="text-[9px] uppercase tracking-[0.2em] text-white/45 mt-0.5 font-bold">{label}</div>
  </div>
);

const Pill = ({ icon: Icon, children }) => (
  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/8 backdrop-blur border border-white/12 text-[10px] font-semibold text-white/85">
    <Icon className="w-3 h-3" /> {children}
  </span>
);

const CircleAction = ({ icon: Icon, label, href, onClick, brand }) => (
  <a href={href} onClick={onClick} className="circle-action tap">
    <div className="circle-action-btn" style={{ '--brand': brand }}>
      <Icon className="w-5 h-5" strokeWidth={2.2} />
    </div>
    <span className="text-[10px] font-semibold tracking-wide text-white/75 mt-1.5">{label}</span>
  </a>
);

const SocialBtn = ({ href, icon: Icon, onClick }) => (
  <a href={href} target="_blank" rel="noreferrer" onClick={onClick}
     className="w-11 h-11 rounded-full bg-white/8 backdrop-blur-xl border border-white/12 flex items-center justify-center text-white/85 tap">
    <Icon className="w-4 h-4" />
  </a>
);

const Section = ({ title, children, delay = 0, right }) => (
  <section className="px-5 pt-7 reveal" style={{ animationDelay: `${delay}ms` }}>
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-heading text-base font-bold tracking-tight text-white/95 flex items-center gap-2">
        <span className="w-1 h-4 rounded-full bg-gradient-to-b from-white/60 to-white/10" />
        {title}
      </h2>
      {right}
    </div>
    {children}
  </section>
);

// ===================== QR Modal =====================
function QrModal({ url, brand, accent, businessName, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-5" onClick={onClose}>
      <div className="w-full max-w-xs rounded-3xl p-6 text-white text-center"
           style={{
             background: "linear-gradient(180deg, #0c1424 0%, #050810 100%)",
             border: "1px solid rgba(255,255,255,.10)",
             boxShadow: `0 30px 80px -10px ${brand}80`,
           }}
           onClick={(e) => e.stopPropagation()}>
        <div className="font-heading font-bold text-lg mb-1">{businessName}</div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-white/45 mb-5">Scan me</div>
        <div className="p-4 rounded-2xl bg-white inline-block">
          <QRCodeCanvas value={url} size={180} fgColor={brand} bgColor="#ffffff" level="H" includeMargin={false} />
        </div>
        <button onClick={onClose} className="mt-5 rounded-xl px-6 py-2.5 text-sm font-semibold tap"
                style={{ background: `linear-gradient(135deg, ${brand}, ${accent})` }}>
          Close
        </button>
      </div>
    </div>
  );
}

// ===================== Styles =====================
function CardStyles({ brand, brandLight, accent, brandDeep }) {
  const css = `
    .smartcard { font-feature-settings: "ss01","cv11"; }

    @keyframes meshFloat1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(8%,-6%) scale(1.1); } }
    @keyframes meshFloat2 { 0%,100% { transform: translate(0,0) scale(1.1); } 50% { transform: translate(-10%,4%) scale(1); } }
    @keyframes meshFloat3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(6%,8%) scale(1.05); } }
    .mesh-orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: .35; will-change: transform; }
    .mesh-orb-1 { width: 500px; height: 500px; top: -150px; left: -120px; animation: meshFloat1 18s ease-in-out infinite; }
    .mesh-orb-2 { width: 420px; height: 420px; top: 30%; right: -160px; animation: meshFloat2 22s ease-in-out infinite; opacity: .28; }
    .mesh-orb-3 { width: 380px; height: 380px; bottom: 8%; left: -100px; animation: meshFloat3 26s ease-in-out infinite; opacity: .22; }
    .grain-overlay { position: absolute; inset: 0; opacity: .06; mix-blend-mode: overlay;
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
      background-size: 200px;
    }

    @keyframes reveal { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    .reveal { animation: reveal .7s cubic-bezier(.16,1,.3,1) both; }

    /* HERO */
    .hero { position: relative; height: 62vh; min-height: 480px; max-height: 640px; overflow: hidden; }
    .hero-photo { position: absolute; inset: 0; overflow: hidden; }
    .hero-gradient { position: absolute; inset: 0;
      background:
        linear-gradient(180deg, transparent 0%, transparent 35%, rgba(5,8,16,0.4) 60%, rgba(5,8,16,0.95) 100%),
        linear-gradient(180deg, ${brandDeep}40 0%, transparent 30%);
    }
    .hero-placeholder { position: absolute; inset: 0; display:flex; align-items: center; justify-content: center; }
    .initials-hero { position: relative; }
    .initials-halo { position: absolute; inset: -60px; filter: blur(40px); }
    .initials-text { position: relative; z-index: 1; font-size: 160px; font-weight: 800; letter-spacing: -.05em;
      background: linear-gradient(135deg, rgba(255,255,255,.95), rgba(255,255,255,.4));
      -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
      filter: drop-shadow(0 8px 40px rgba(255,255,255,0.15));
    }

    /* CIRCULAR ACTIONS */
    .action-ring {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;
      padding: 18px 12px;
      border-radius: 28px;
      background: linear-gradient(135deg, rgba(255,255,255,.07) 0%, rgba(255,255,255,.02) 100%);
      backdrop-filter: blur(28px);
      border: 1px solid rgba(255,255,255,.10);
      box-shadow: 0 20px 60px -10px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.08);
    }
    .circle-action { display: flex; flex-direction: column; align-items: center; text-decoration: none; }
    .circle-action-btn {
      width: 52px; height: 52px; border-radius: 999px;
      display: flex; align-items: center; justify-content: center;
      color: white;
      background: linear-gradient(135deg, var(--brand) 0%, ${adjustColor(brand, -25)} 100%);
      box-shadow: 0 8px 20px -4px var(--brand), inset 0 1px 0 rgba(255,255,255,.25);
      transition: transform .15s;
    }
    .circle-action:active .circle-action-btn { transform: scale(.92); }

    /* STAT BOXES */
    .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(0,1fr)); gap: 8px; }
    .stat-box { padding: 12px 10px; border-radius: 18px; text-align: center;
      background: rgba(255,255,255,.04);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,.08);
    }

    /* PRIMARY CTA */
    .primary-cta {
      position:relative; overflow: hidden;
      height: 60px; border-radius: 22px;
      display:flex; align-items:center; padding: 0 22px;
      background: linear-gradient(135deg, ${brand} 0%, ${adjustColor(brand, -10)} 50%, ${accent} 110%);
      color:white;
      box-shadow:
        0 14px 40px -10px ${brand}80,
        0 2px 0 rgba(255,255,255,.15) inset,
        0 0 0 1px rgba(255,255,255,.12) inset;
      transition: transform .2s;
    }
    .primary-cta:active { transform: scale(.98); }
    .cta-shimmer { position:absolute; top:0; left:-60%; width: 60%; height:100%;
      background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,.22) 50%, transparent 70%);
      animation: shimmer 3.5s cubic-bezier(.4,0,.2,1) infinite;
    }
    @keyframes shimmer { 0% { transform: translateX(0); } 60%,100% { transform: translateX(260%); } }

    /* ABOUT */
    .about-card { padding: 18px; border-radius: 20px;
      background: linear-gradient(135deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
      border: 1px solid rgba(255,255,255,.08);
      backdrop-filter: blur(18px);
    }

    /* SERVICE CARDS */
    .service-card { animation: reveal .7s cubic-bezier(.16,1,.3,1) both;
      padding: 16px; border-radius: 20px;
      background: linear-gradient(135deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
      border: 1px solid rgba(255,255,255,.08);
      backdrop-filter: blur(20px);
      transition: transform .2s, border-color .2s;
    }
    .service-card:hover { border-color: rgba(255,255,255,.18); transform: translateY(-2px); }

    /* GALLERY */
    .gallery-card { animation: reveal .7s cubic-bezier(.16,1,.3,1) both;
      position:relative; flex-shrink:0;
      width: 200px; height: 260px;
      border-radius: 22px; overflow: hidden;
      background: #111;
      border: 1px solid rgba(255,255,255,.08);
      box-shadow: 0 8px 30px -8px rgba(0,0,0,.6);
    }

    /* REVIEW */
    .review-card { animation: reveal .7s cubic-bezier(.16,1,.3,1) both;
      padding: 16px; border-radius: 20px;
      background: linear-gradient(135deg, rgba(255,255,255,.05), rgba(255,255,255,.015));
      border: 1px solid rgba(255,255,255,.08);
      backdrop-filter: blur(16px);
    }

    /* BOTTOM TOOLBAR */
    .bottom-toolbar {
      position: fixed; left: 16px; right: 16px; bottom: 16px;
      z-index: 30;
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px;
      border-radius: 999px;
      background: rgba(10,14,24,0.75);
      backdrop-filter: blur(32px) saturate(180%);
      border: 1px solid rgba(255,255,255,.10);
      box-shadow: 0 20px 50px -10px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.08);
      padding-bottom: calc(10px + env(safe-area-inset-bottom, 0));
    }
    .tool-btn { width: 42px; height: 42px; border-radius: 999px;
      display:flex; align-items:center; justify-content:center;
      background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.10);
      color: white; transition: transform .15s;
    }
    .tool-btn:active { transform: scale(.92); }
    .tool-pill { flex: 1;
      display:flex; align-items:center; justify-content:center; gap: 6px;
      height: 42px; border-radius: 999px;
      background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.10);
      color: white; text-decoration: none;
      font-size: 12px; font-weight: 700; letter-spacing: -.01em;
    }
    .tool-pill-primary { width: 42px; height: 42px; border-radius: 999px;
      display:flex; align-items:center; justify-content:center;
      color: white; flex-shrink: 0;
      box-shadow: 0 6px 16px -4px ${brand}aa, inset 0 1px 0 rgba(255,255,255,.2);
    }
  `;
  return <style>{css}</style>;
}

// ===================== AI Chat Panel =====================
function ChatPanel({ slug, brand, accent, businessName, lang, t, onClose }) {
  const [messages, setMessages] = useState([
    { role: "assistant", content: t.chatGreeting(businessName) },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const session = useMemo(() => getSession(), []);
  const bodyRef = useRef(null);

  useEffect(() => { bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/public/card/${slug}/chat`, { session_id: session, message: text, language: lang });
      setMessages((m) => [...m, { role: "assistant", content: data.reply, leadCreated: data.lead_created }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: lang === "es" ? "Hubo un error." : "Something went wrong." }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div className="w-full lg:max-w-md rounded-t-3xl lg:rounded-3xl flex flex-col max-h-[88vh] lg:max-h-[640px] overflow-hidden text-white"
           style={{ background: "linear-gradient(180deg, #0c1424 0%, #050810 100%)", border: "1px solid rgba(255,255,255,.08)", boxShadow: `0 30px 80px -10px ${brand}80` }}
           onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center gap-3 border-b border-white/8" style={{ background: `linear-gradient(135deg, ${brand}40, ${accent}30)` }}>
          <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center"><Sparkles className="w-5 h-5" /></div>
          <div className="flex-1 min-w-0">
            <div className="font-heading font-bold tracking-tight leading-none">{t.askAnything}</div>
            <div className="text-[11px] text-white/65 mt-1">{businessName}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center tap" data-testid="chat-close"><X className="w-4 h-4" /></button>
        </div>
        <div ref={bodyRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "text-white rounded-br-md" : "text-white/90 rounded-bl-md border border-white/8"}`}
                   style={m.role === "user" ? { background: `linear-gradient(135deg, ${brand}, ${accent})` } : { background: "rgba(255,255,255,.04)" }}>
                {m.content}
                {m.leadCreated && (
                  <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-400/30">
                    <BadgeCheck className="w-3 h-3" /> Captured
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md px-4 py-2.5 text-sm text-white/50 border border-white/8" style={{ background: "rgba(255,255,255,.04)" }}>
                <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> …
              </div>
            </div>
          )}
        </div>
        <div className="p-3 border-t border-white/8 flex items-center gap-2" style={{ background: "rgba(255,255,255,.02)" }}>
          <input data-testid="chat-input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
                 placeholder={t.placeholder}
                 className="flex-1 h-12 rounded-full bg-white/5 border border-white/8 px-4 text-sm placeholder-white/35 focus:outline-none focus:border-white/20" />
          <button data-testid="chat-send" onClick={send} disabled={loading || !input.trim()}
                  className="w-12 h-12 rounded-full text-white flex items-center justify-center tap disabled:opacity-40"
                  style={{ background: `linear-gradient(135deg, ${brand}, ${accent})` }}>
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ===================== Quote Form =====================
function QuoteForm({ slug, brand, accent, card, lang, t, onClose }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", service: "", description: "", preferred_contact: "phone" });
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
      if (photo) { try { photo_b64 = await fileToBase64(photo); } catch {} }
      await axios.post(`${API}/public/card/${slug}/lead`, { ...form, photo_b64 });
      setDone(true);
    } catch { setError(t.error); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div className="w-full lg:max-w-md rounded-t-3xl lg:rounded-3xl max-h-[92vh] overflow-y-auto text-white"
           style={{ background: "linear-gradient(180deg, #0c1424 0%, #050810 100%)", border: "1px solid rgba(255,255,255,.08)", boxShadow: `0 30px 80px -10px ${brand}80` }}
           onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 px-5 py-4 border-b border-white/8 flex items-center gap-3 bg-black/40 backdrop-blur-xl">
          <div className="flex-1 min-w-0"><div className="font-heading font-bold tracking-tight">{t.quoteFormTitle}</div></div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center tap" data-testid="form-close"><X className="w-4 h-4" /></button>
        </div>
        {done ? (
          <div className="p-10 text-center">
            <div className="w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center relative">
              <div className="absolute inset-0 rounded-full blur-2xl opacity-60" style={{ background: `linear-gradient(135deg, ${brand}, ${accent})` }} />
              <div className="relative w-20 h-20 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${brand}, ${accent})` }}>
                <BadgeCheck className="w-10 h-10 text-white" />
              </div>
            </div>
            <h3 className="font-heading text-2xl font-bold tracking-tight mb-1">{t.success}</h3>
            <p className="text-sm text-white/60">{t.successSub}</p>
            <button onClick={onClose} className="mt-8 rounded-xl px-8 py-3 text-white font-semibold tap" style={{ background: `linear-gradient(135deg, ${brand}, ${accent})` }}>OK</button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-3">
            <DarkField label={t.yourName + " *"}><input data-testid="lead-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="dark-input" /></DarkField>
            <div className="grid grid-cols-2 gap-2">
              <DarkField label={t.phone}><input data-testid="lead-phone" type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="dark-input" /></DarkField>
              <DarkField label={t.emailLabel}><input data-testid="lead-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="dark-input" /></DarkField>
            </div>
            <DarkField label={t.address}><input data-testid="lead-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="dark-input" /></DarkField>
            {card.services?.length > 0 && (
              <DarkField label={t.service}>
                <select data-testid="lead-service" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} className="dark-input">
                  <option value="">—</option>
                  {card.services.map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
                </select>
              </DarkField>
            )}
            <DarkField label={t.description + " *"}>
              <textarea data-testid="lead-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required rows={4} className="dark-input py-3" />
            </DarkField>
            <DarkField label={t.addPhoto}>
              <label className="rounded-xl bg-white/5 border border-dashed border-white/15 px-4 py-3 w-full flex items-center justify-center gap-2 cursor-pointer text-sm text-white/65">
                {photoPreview ? <img src={photoPreview} alt="preview" className="h-16 rounded-lg" /> : <><Camera className="w-4 h-4" /> Tap to add</>}
                <input type="file" accept="image/*" hidden onChange={onPhoto} data-testid="lead-photo" />
              </label>
            </DarkField>
            <DarkField label={t.preferred}>
              <div className="flex gap-2 flex-wrap">
                {["phone", "text", "email", "whatsapp"].map((p) => (
                  <button key={p} type="button" onClick={() => setForm({ ...form, preferred_contact: p })}
                          className={`px-4 py-2 rounded-full text-xs font-semibold ${form.preferred_contact === p ? "text-white" : "bg-white/5 text-white/65 border border-white/10"}`}
                          style={form.preferred_contact === p ? { background: `linear-gradient(135deg, ${brand}, ${accent})` } : {}}>{p}</button>
                ))}
              </div>
            </DarkField>
            {error && <div className="text-sm text-red-400">{error}</div>}
            <button data-testid="lead-submit" type="submit" disabled={loading}
                    className="w-full h-14 rounded-2xl text-white font-bold text-base shadow-2xl flex items-center justify-center gap-2 tap relative overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${brand}, ${accent})`, boxShadow: `0 14px 40px -10px ${brand}` }}>
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> {t.sending}</> : <><Send className="w-5 h-5" /> {t.sendRequest}</>}
            </button>
            <style>{`
              .dark-input { width:100%; height:48px; padding:0 16px; border-radius:14px;
                background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.10);
                color: white; font-size: 14px; outline: none; transition: border-color .15s, background .15s; }
              .dark-input:focus { border-color: rgba(255,255,255,.25); background: rgba(255,255,255,.06); }
              textarea.dark-input { height: auto; }
            `}</style>
          </form>
        )}
      </div>
    </div>
  );
}

const DarkField = ({ label, children }) => (
  <div>
    <div className="text-[11px] font-semibold text-white/55 mb-1.5 uppercase tracking-wider">{label}</div>
    {children}
  </div>
);
