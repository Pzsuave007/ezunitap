import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Phone, MapPin, Clock, Star, ShieldCheck, CheckCircle2, Calendar, Send, Loader2, Menu, X, ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Quote, Plus, Mail, Facebook, Instagram } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const photoUrl = (id, w) => (id ? `${API}/public/card/photo/${id}${w ? `?w=${w}` : ""}` : null);


// ---- Per-template design tokens (5 DISTINCT templates) ---------------------
const THEME = {
  cinematic: { dark: true, h: "'Anton',sans-serif", b: "'Inter',sans-serif", hc: "font-normal tracking-tight uppercase",
    bg: "#08080A", surface: "#141418", ink: "#FFFFFF", muted: "#A1A1AA", border: "rgba(255,255,255,.12)", radius: "rounded-none", btn: "rounded-none font-semibold tracking-wide" },
  responder: { dark: false, h: "'Anton',sans-serif", b: "'Roboto',sans-serif", hc: "font-normal uppercase tracking-wide",
    bg: "#F3F4F6", surface: "#FFFFFF", ink: "#111827", muted: "#4B5563", border: "#111827", radius: "rounded-md", btn: "rounded-md uppercase font-bold tracking-wide" },
  bento: { dark: false, h: "'Plus Jakarta Sans',sans-serif", b: "'Inter',sans-serif", hc: "font-extrabold tracking-tight",
    bg: "#FFFFFF", surface: "#F8FAFC", ink: "#0F172A", muted: "#64748B", border: "#E2E8F0", radius: "rounded-2xl", btn: "rounded-xl font-semibold" },
  craftsman: { dark: false, h: "'Playfair Display',serif", b: "'DM Sans',sans-serif", hc: "font-bold tracking-tight",
    bg: "#F7F5F1", surface: "#FFFFFF", ink: "#2C2A28", muted: "#7C756B", border: "#E7E2D8", radius: "rounded-3xl", btn: "rounded-full font-bold" },
  trust: { dark: false, h: "'Montserrat',sans-serif", b: "'Open Sans',sans-serif", hc: "font-extrabold tracking-tight",
    bg: "#F1F5F9", surface: "#FFFFFF", ink: "#1F2937", muted: "#6B7280", border: "#E5E7EB", radius: "rounded-lg", btn: "rounded-lg font-bold" },
  slider: { dark: false, h: "'Archivo',sans-serif", b: "'Inter',sans-serif", hc: "font-extrabold uppercase tracking-tight",
    bg: "#FFFFFF", surface: "#F5F5F5", ink: "#111827", muted: "#4B5563", border: "#111827", radius: "rounded-none", btn: "rounded-none uppercase font-bold tracking-wide" },
  onepage: { dark: false, h: "'Fraunces',serif", b: "'Inter',sans-serif", hc: "font-semibold tracking-tight",
    bg: "#FAFAFA", surface: "#FFFFFF", ink: "#111111", muted: "#6B7280", border: "#E5E7EB", radius: "rounded-sm", btn: "rounded-full font-medium" },
  neon: { dark: true, h: "'Space Grotesk',sans-serif", b: "'Inter',sans-serif", hc: "font-bold tracking-tight",
    bg: "#0A0A0C", surface: "#141417", ink: "#E5E7EB", muted: "#8B8B93", border: "rgba(255,255,255,.1)", radius: "rounded-xl", btn: "rounded-xl font-semibold" },
  playful: { dark: false, h: "'Baloo 2',cursive", b: "'Nunito',sans-serif", hc: "font-extrabold tracking-tight",
    bg: "#FFF8F0", surface: "#FFFFFF", ink: "#33302E", muted: "#7A736A", border: "transparent", radius: "rounded-[2rem]", btn: "rounded-full font-extrabold" },
  luxe: { dark: true, h: "'Cormorant Garamond',serif", b: "'Jost',sans-serif", hc: "font-semibold tracking-tight",
    bg: "#141414", surface: "#1C1C1C", ink: "#F5F5F0", muted: "#A8A29A", border: "rgba(212,175,55,.28)", radius: "rounded-none", btn: "rounded-none uppercase tracking-[0.15em] font-medium" },
  agency: { dark: true, h: "'Plus Jakarta Sans',sans-serif", b: "'Inter',sans-serif", hc: "font-black tracking-tight",
    bg: "#0a1130", surface: "#111a3a", ink: "#FFFFFF", muted: "#94A3B8", border: "rgba(255,255,255,.1)", radius: "rounded-2xl", btn: "rounded-full font-bold" },
};
const LEGACY = { clean: "bento", bold: "cinematic", warm: "craftsman" };
const resolveTpl = (v) => (THEME[v] ? v : (LEGACY[v] || "trust"));

function isLight(hex) {
  if (!hex) return false;
  const c = hex.replace("#", ""); if (c.length < 6) return false;
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150;
}

// Reveal-on-scroll: adds `.wshow` when the element enters the viewport.
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (typeof IntersectionObserver === "undefined") { el.classList.add("wshow"); return; }
    const io = new IntersectionObserver((ents) => ents.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("wshow"); io.unobserve(e.target); }
    }), { threshold: 0.1, rootMargin: "0px 0px -6% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

// ===========================================================================
export default function ContractorSite({ injected, page, byDomain }) {
  const { slug, caseSlug, serviceSlug } = useParams();
  const [data, setData] = useState(injected || null);
  const [err, setErr] = useState(false);
  const [lang, setLang] = useState("en");
  const [workOpen, setWorkOpen] = useState(null);

  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@600;700;800;900&family=Baloo+2:wght@500;600;700;800&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=DM+Sans:wght@400;500;700&family=Fraunces:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@300;400;500;600;700&family=Jost:wght@300;400;500;600&family=Montserrat:wght@600;700;800&family=Open+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Roboto:wght@400;500;700;900&family=Space+Grotesk:wght@400;500;600;700&family=Syne:wght@500;700;800&display=swap";
    document.head.appendChild(l);
    return () => { document.head.removeChild(l); };
  }, []);

  // Safety net: if any image fails to load (e.g. a missing photo), hide it so a
  // broken-image icon is never shown to a visitor.
  useEffect(() => {
    const onErr = (e) => {
      const el = e.target;
      if (el && el.tagName === "IMG") el.style.display = "none";
    };
    document.addEventListener("error", onErr, true);
    return () => document.removeEventListener("error", onErr, true);
  }, []);


  useEffect(() => {
    if (injected) { setData(injected); return; }
    const preview = new URLSearchParams(window.location.search).get("preview") ? "?preview=1" : "";
    const url = byDomain
      ? `${API}/public/website-by-domain/${window.location.hostname}${preview}`
      : `${API}/public/website/${slug}${preview}`;
    axios.get(url).then((r) => setData(r.data)).catch(() => setErr(true));
  }, [slug, injected, byDomain]);

  // Open in the default language: ?lang= query param wins, then the domain's
  // configured default (growthally.agency -> EN, uni2mkt.com -> ES), else EN.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (q === "es" || q === "en") { setLang(q); return; }
    const dl = (data && data.default_lang) || (injected && injected.default_lang);
    if (dl === "es" || dl === "en") setLang(dl);
  }, [data, injected]);

  // Inject <link rel="alternate" hreflang> tags so Google links the EN/ES
  // versions of the same site (bilingual SEO, avoids duplicate-content issues).
  useEffect(() => {
    const alts = (data && data.hreflang_alts) || (injected && injected.hreflang_alts) || [];
    const path = window.location.pathname || "/";
    const created = [];
    const add = (hreflang, domain) => {
      const el = document.createElement("link");
      el.setAttribute("rel", "alternate");
      el.setAttribute("hreflang", hreflang);
      el.setAttribute("href", `https://${domain}${path}`);
      el.setAttribute("data-hreflang", "1");
      document.head.appendChild(el);
      created.push(el);
    };
    alts.forEach((a) => a.domain && add(a.lang, a.domain));
    if (alts.length) {
      const def = (alts.find((a) => a.lang === "en") || alts[0]).domain;
      add("x-default", def);
    }
    return () => created.forEach((el) => el.remove());
  }, [data, injected]);

  // Optional UniTech AI chat widget on the public site
  useEffect(() => {
    if (!data) return;
    const ww = data.website;
    if (!ww.chat_enabled || !data.card_slug) return;
    const s = document.createElement("script");
    s.src = `${window.location.origin}/embed.js`;
    s.async = true;
    s.setAttribute("data-unitech-chat", "");
    s.setAttribute("data-slug", data.card_slug);
    s.setAttribute("data-lang", lang === "es" ? "es" : "en");
    s.setAttribute("data-accent", ww.accent_color || "#2563EB");
    if (ww.chat_position === "left") s.setAttribute("data-position", "left");
    if (ww.chat_launcher) s.setAttribute("data-launcher", ww.chat_launcher);
    if (ww.chat_bot_name) s.setAttribute("data-bot-name", ww.chat_bot_name);
    if (ww.chat_bot_avatar) s.setAttribute("data-bot-avatar", `${API}/public/card/photo/${ww.chat_bot_avatar}`);
    const chatGreeting = lang === "es" ? ww.chat_greeting_es : ww.chat_greeting_en;
    if (chatGreeting) s.setAttribute("data-greeting", chatGreeting);
    document.body.appendChild(s);
    return () => {
      document.body.removeChild(s);
      document.querySelectorAll("[data-unitech-widget],#unitech-chat-root,.unitech-chat-launcher,#unitech-chat-fab").forEach((n) => n.remove());
    };
  }, [data, lang]);

  useEffect(() => {
    if (!data) return;
    const ww = data.website, bb = data.business;
    const title = ww.seo_title || `${bb.name}${data.service_area ? " — " + data.service_area : ""}`;
    const desc = ww.seo_description || ww.subheadline || `${bb.name} — professional, licensed & insured service you can trust.`;
    const abs = (u) => (u && u.startsWith("/") ? window.location.origin + u : u);
    const ogImage = abs(photoUrl(ww.hero_photo_id)) || abs(photoUrl(bb.logo_photo_id)) || "";
    const canonical = window.location.origin + window.location.pathname;
    document.title = title;
    const meta = (key, val, prop) => {
      if (!val) return;
      const attr = prop ? "property" : "name";
      let el = document.head.querySelector(`meta[${attr}="${key}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.setAttribute("content", val);
    };
    const link = (rel, href) => {
      if (!href) return;
      let el = document.head.querySelector(`link[rel="${rel}"]`);
      if (!el) { el = document.createElement("link"); el.setAttribute("rel", rel); document.head.appendChild(el); }
      el.setAttribute("href", href);
    };
    meta("description", desc);
    meta("og:title", title, true); meta("og:description", desc, true); meta("og:type", "website", true);
    meta("og:url", canonical, true); meta("og:site_name", bb.name, true);
    if (ogImage) meta("og:image", ogImage, true);
    meta("twitter:card", ogImage ? "summary_large_image" : "summary");
    meta("twitter:title", title); meta("twitter:description", desc);
    if (ogImage) meta("twitter:image", ogImage);
    link("canonical", canonical);
    if (photoUrl(bb.logo_photo_id)) link("icon", abs(photoUrl(bb.logo_photo_id)));
    // JSON-LD LocalBusiness structured data (local SEO / rich results)
    const areas = (ww.areas && ww.areas.length ? ww.areas : (data.service_area ? [data.service_area] : []));
    const ratings = (data.reviews || []).filter((r) => r.rating);
    const jsonld = {
      "@context": "https://schema.org", "@type": "HomeAndConstructionBusiness",
      name: bb.name, telephone: bb.phone || undefined, email: bb.email || undefined,
      url: canonical, image: ogImage || undefined, description: desc, priceRange: "$$",
      address: bb.address ? { "@type": "PostalAddress", streetAddress: bb.address } : undefined,
      areaServed: areas.length ? areas : undefined,
      aggregateRating: ratings.length ? {
        "@type": "AggregateRating",
        ratingValue: (ratings.reduce((a, r) => a + r.rating, 0) / ratings.length).toFixed(1),
        reviewCount: ratings.length,
      } : undefined,
      makesOffer: (data.services || []).length ? data.services.map((s) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: s.name } })) : undefined,
    };
    let ld = document.getElementById("unitech-jsonld");
    if (!ld) { ld = document.createElement("script"); ld.type = "application/ld+json"; ld.id = "unitech-jsonld"; document.head.appendChild(ld); }
    ld.textContent = JSON.stringify(jsonld);
  }, [data]);

  if (err) return <div className="min-h-screen flex items-center justify-center text-slate-500 p-8 text-center">This website is not available.</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  const w = data.website;
  const esOn = lang === "es" && w.content_es && typeof w.content_es === "object";
  const wl = esOn ? { ...w, ...w.content_es } : w;
  const key = resolveTpl(w.template);
  const th = THEME[key];
  const accent = w.accent_color || "#2563EB";
  const accentText = isLight(accent) ? "#0A0A0A" : "#FFFFFF";
  const b = data.business;
  const sec = w.sections || {};
  // Images come ONLY from photos the owner assigned (upload / AI / stock button).
  // No hardcoded fallbacks — an empty slot renders nothing, never a random photo.
  const heroImg = photoUrl(w.hero_photo_id, 1600) || null;
  const poolAt = () => null;
  const esServices = esOn && Array.isArray(w.content_es.services) && w.content_es.services.length ? w.content_es.services : null;
  const _rawServices = esServices || (data.services.length ? data.services : DEFAULT_SERVICES);
  const services = _rawServices.map((s, i) => ({ ...s, img: photoUrl(s.image_id, 800) || null }));
  const goContact = () => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });

  const teamImg = photoUrl(w.team_photo_id, 700) || null;
  const whyImg = photoUrl(w.why_photo_id, 900) || null;
  const bandImg = photoUrl(w.band_photo_id, 1600) || null;
  const heroImgOn = !!heroImg;
  const whyImgOn = !!whyImg;
  const bandImgOn = !!bandImg;
  const _aboutIds = (Array.isArray(w.about_photo_ids) && w.about_photo_ids.length) ? w.about_photo_ids : (w.team_photo_id ? [w.team_photo_id] : []);
  const aboutImgs = _aboutIds.length ? _aboutIds.map((id) => photoUrl(id, 700)) : [];

  // Keep the chosen language across full-page navigations to sub-pages (service,
  // case, about). Without this the sub-page reloads in the default language and a
  // Spanish slug can't be matched against English content -> "Service not found".
  const siteDefault = (data && data.default_lang) || (injected && injected.default_lang) || "en";
  const langQ = (wl.content_es && lang !== siteDefault) ? `?lang=${lang}` : "";
  const onDom = byDomain || !!injected;
  const ctx = { w: wl, b, data, sec, accent, accentText, th, heroImg, heroImgOn, poolAt, services, goContact, slug, key, lang, teamImg, whyImg, bandImg, whyImgOn, bandImgOn, aboutImgs, onDomain: !!injected, ppHref: (ps) => (onDom ? `/p/${ps}${langQ}` : `/sitio/${w.slug}/p/${ps}${langQ}`), openWork: setWorkOpen };
  // Central, business-aware CTA labels so every template converts whether the
  // business takes appointments (Book) or projects/estimates (Quote).
  ctx.bookingOn = !!(sec?.booking && data?.card_slug);
  ctx.cta = lang === "es" ? (ctx.bookingOn ? "Agenda ahora" : "Cotiza gratis") : (ctx.bookingOn ? "Book Now" : "Get a Free Quote");
  ctx.ctaShort = lang === "es" ? (ctx.bookingOn ? "Agendar" : "Cotizar") : (ctx.bookingOn ? "Book Now" : "Free Quote");
  const Layout = { cinematic: Cinematic, responder: Responder, bento: Bento, craftsman: Craftsman, trust: Trust, slider: Slider, onepage: OnePage, neon: Neon, playful: Playful, luxe: Luxe, agency: Agency }[key];
  ctx.pageHref = (p) => (onDom ? `/${p}${langQ}` : `/sitio/${w.slug}/${p}${langQ}`);
  ctx.homeHref = (onDom ? "/" : `/sitio/${w.slug}`) + langQ;
  ctx.page = page || null;
  ctx.caseSlug = caseSlug || null;
  ctx.serviceSlug = serviceSlug || null;
  if (page) ctx.goContact = () => { window.location.href = `${ctx.homeHref}#contact`; };

  return (
    <div style={{ background: th.bg, color: th.ink, fontFamily: th.b }} className="min-h-screen antialiased" data-testid={`site-tpl-${key}`}>
      <style>{`
        .wh{font-family:${th.h}${th.h.includes("Anton") ? ";letter-spacing:.04em" : ""}}
        .ws a,.ws button{transition:transform .25s ease,box-shadow .25s ease,background-color .25s ease,opacity .25s ease,color .2s,filter .3s}
        .ws ::selection{background:${accent};color:${accentText}}
        @keyframes wfade{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
        @keyframes wmarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes wpulse{0%,100%{box-shadow:0 0 0 0 ${accent}66}50%{box-shadow:0 0 0 10px ${accent}00}}
        .wfade{animation:wfade .8s ease both}
        .wreveal{opacity:0;transform:translateY(28px);transition:opacity .75s cubic-bezier(.2,.7,.2,1),transform .75s cubic-bezier(.2,.7,.2,1)}
        .wreveal.wshow{opacity:1;transform:none}
        @media (prefers-reduced-motion:reduce){.wreveal{opacity:1 !important;transform:none !important}}
        .wmarq{display:flex;width:max-content;animation:wmarquee 22s linear infinite}
        #gallery img{cursor:zoom-in}
        /* On phones, lift the floating chat button above the sticky Call/Quote bar */
        @media (max-width:767px){#unitech-chat-fab{bottom:88px !important}}
      `}</style>
      {w.content_es && (w.lang_toggle !== false) && (
        <div className="fixed left-3 bottom-24 md:bottom-6 md:left-6 z-[55] flex rounded-full overflow-hidden shadow-lg border border-black/10 bg-white/95 backdrop-blur text-xs font-bold" data-testid="site-lang-switch">
          {["en", "es"].map((lg) => (
            <button key={lg} onClick={() => setLang(lg)} data-testid={`site-lang-${lg}`}
              className={`px-3 py-1.5 ${lang === lg ? "text-white" : "text-slate-600"}`}
              style={lang === lg ? { background: accent, color: accentText } : {}}>
              {lg.toUpperCase()}
            </button>
          ))}
        </div>
      )}
      <div className="ws overflow-x-clip" onClick={(e) => {
        const img = e.target.closest && e.target.closest("img");
        if (!img || !e.target.closest("#gallery")) return;
        const m = (img.getAttribute("src") || "").match(/\/public\/card\/photo\/([^?]+)/);
        if (!m) return;
        const p = (data.photos || []).find((x) => x.id === m[1]);
        if (p) setWorkOpen(p);
      }}>
        {page
          ? <SubPageRouter ctx={ctx} />
          : <><Layout ctx={ctx} />{key !== "agency" && <SharedExtras ctx={ctx} />}</>}
      </div>
      <MobileBar ctx={ctx} />
      {workOpen && <SiteWorkModal photo={workOpen} accent={accent} accentText={accentText} onClose={() => setWorkOpen(null)} onQuote={() => { setWorkOpen(null); goContact(); }} />}
    </div>
  );
}

function SiteWorkModal({ photo, accent, accentText, onClose, onQuote }) {
  const p = photo || {};
  const label = { before: "Before", during: "During", after: "After" }[p.label] || "";
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4" onClick={onClose} data-testid="site-work-modal">
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <img src={photoUrl(p.id, 1200)} alt="" className="w-full max-h-[56vh] object-cover" />
          {label && <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur text-white text-[10px] font-bold uppercase tracking-[0.15em]">{label}</span>}
          <button onClick={onClose} className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/50 backdrop-blur text-white flex items-center justify-center" data-testid="site-work-close"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 sm:p-6 space-y-4">
          {p.caption && <div className="space-y-3" data-testid="site-work-caption">{p.caption.split(/\n{2,}/).map((para, i) => <p key={i} className="text-base sm:text-lg leading-relaxed text-slate-700 whitespace-pre-line">{para}</p>)}</div>}
          <a href="#contact" onClick={(e) => { e.preventDefault(); onQuote(); }} data-testid="site-work-quote"
             className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-full font-bold text-base shadow-lg" style={{ background: accent, color: accentText }}>
            Get a Free Quote <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </div>
    </div>
  );
}

function NavMenu({ ctx, light }) {
  const { th, sec, w } = ctx;
  const [open, setOpen] = useState(false);
  const links = [
    sec.services !== false && ["Services", "#services"],
    sec.gallery !== false && ["Work", "#gallery"],
    (sec.about !== false && w.about) && ["About", "#about"],
    sec.reviews !== false && ["Reviews", "#reviews"],
    sec.faq !== false && ["FAQ", "#faq"],
    ["Contact", "#contact"],
  ].filter(Boolean);
  return (
    <div className="relative flex-none">
      <button onClick={() => setOpen(!open)} data-testid="site-menu-toggle" aria-label="Menu" className="relative z-[60] p-2 -mr-2" style={{ color: light ? "#fff" : th.ink }}>
        {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>
      {open && (<>
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
        <div className="absolute right-0 top-full mt-2 w-56 py-2 z-50 shadow-2xl border" data-testid="site-menu-panel" style={{ background: th.surface, borderColor: th.border, borderRadius: 12 }}>
          {links.map(([l, href], i) => <a key={i} href={href} onClick={() => setOpen(false)} className="block px-5 py-2.5 text-sm font-semibold hover:opacity-70" style={{ color: th.ink }}>{l}</a>)}
        </div>
      </>)}
    </div>
  );
}

// ===========================================================================
// TEMPLATE 1 — CINEMATIC DARK
// ===========================================================================
function Cinematic({ ctx }) {
  const { w, b, data, sec, accent, accentText, th, heroImg, poolAt, services, goContact } = ctx;
  // Cream sub-theme so we can alternate light sections and break the all-dark look.
  const lightCtx = { ...ctx, th: { ...th, dark: false, bg: "#FBF7F0", surface: "#F3ECE0", ink: "#171412", muted: "#6b6259", border: "rgba(0,0,0,.10)" } };
  const grayCtx = { ...ctx, th: { ...th, dark: false, bg: "#ECECEF", surface: "#ECECEF", ink: "#1a1a1a", muted: "#57534e", border: "rgba(0,0,0,.10)" } };
  const [scr, setScr] = useState(false);
  useEffect(() => { const f = () => setScr(window.scrollY > 40); window.addEventListener("scroll", f); return () => window.removeEventListener("scroll", f); }, []);
  return (
    <div className="pb-20 md:pb-0">
      <header className="fixed top-0 inset-x-0 z-40" style={{ background: scr ? "rgba(8,8,10,.7)" : "transparent", backdropFilter: scr ? "blur(16px)" : "none", borderBottom: scr ? `1px solid ${th.border}` : "1px solid transparent" }}>
        <div className="max-w-6xl mx-auto px-5 h-16 md:h-20 flex items-center justify-between gap-3 text-white">
          <div className="min-w-0 flex-1"><Brand ctx={ctx} light /></div>
          <NavMenu ctx={ctx} light />
        </div>
      </header>

      {/* Hero 75vh */}
      <section className="relative min-h-[75svh] flex items-end">
        {heroImg && <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #08080A 4%, rgba(8,8,10,.55) 45%, rgba(8,8,10,.25) 100%)" }} />
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
        <div className="relative max-w-6xl mx-auto px-5 pb-16 pt-24 md:pb-24 md:pt-32 text-white w-full wfade">
          <HeroBadges ctx={ctx} />
          <h1 className="wh font-extrabold tracking-tight text-4xl sm:text-6xl lg:text-7xl mt-6 leading-[0.98] max-w-4xl break-words">{w.headline || b.name}</h1>
          {w.subheadline && <p className="mt-6 text-lg md:text-2xl text-white/80 max-w-2xl font-light break-words">{w.subheadline}</p>}
          <div className="mt-9 flex flex-col sm:flex-row flex-wrap gap-3">
            <button onClick={goContact} data-testid="site-hero-quote" className={`px-8 h-14 ${th.btn} text-base inline-flex items-center justify-center gap-2 hover:-translate-y-0.5`} style={{ background: accent, color: accentText }}>{ctx.cta} <ArrowRight className="w-4 h-4" /></button>
            {b.phone && <a href={`tel:${b.phone}`} className={`px-8 h-14 ${th.btn} text-base inline-flex items-center justify-center gap-2 border border-white/25 text-white hover:bg-white/10`}><Phone className="w-5 h-5" /> {b.phone}</a>}
          </div>
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 bottom-6 text-white/70 animate-bounce"><ChevronDown className="w-6 h-6" style={{ color: accent }} /></div>
      </section>

      <HeroFormBand ctx={grayCtx} />

      {/* Services: edge-to-edge image cards */}
      {sec.services !== false && (
        <SectionDark id="services" kicker="What we do" title="Our Services" ctx={ctx}>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {services.map((s, i) => (
              <div key={i} className="group relative min-h-[320px] flex items-end overflow-hidden border" style={{ background: "#0d0d10", borderColor: th.border }} data-testid={`site-service-${i}`}>
                {s.img && <img src={s.img} loading="lazy" decoding="async" alt={s.name} className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-70 group-hover:scale-105 transition-all duration-500" />}
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(8,8,10,.95), rgba(8,8,10,.2))" }} />
                <div className="relative p-7 w-full">
                  <h3 className="wh font-bold text-2xl">{s.name}</h3>
                  {s.description && <p className="mt-2 text-sm text-white/70 max-h-0 overflow-hidden group-hover:max-h-40 transition-all duration-500">{s.description}</p>}
                  {s.starting_price && <p className="mt-3 text-sm font-bold" style={{ color: accent }}>{s.starting_price}</p>}
                </div>
              </div>
            ))}
          </div>
        </SectionDark>
      )}

      {/* How it works: vertical timeline */}
      {(data.problem_pages || []).length > 0 && <ProblemsSection ctx={ctx} />}
      {sec.about !== false && <AboutBlock ctx={ctx} />}
      {sec.feature !== false && <div style={{ background: "#FBF7F0" }}><FeatureBlock ctx={lightCtx} /></div>}
      {sec.how !== false && (
        <SectionDark id="how" kicker="The process" title="How It Works" ctx={ctx} alt>
          <div className="relative max-w-2xl border-l ml-3" style={{ borderColor: th.border }}>
            {(w.how_it_works?.length ? w.how_it_works : DEFAULT_HOW).map((s, i) => (
              <div key={i} className="relative pl-10 pb-10 last:pb-0">
                <span className="absolute -left-[9px] top-1 w-4 h-4 rounded-full" style={{ background: accent, boxShadow: `0 0 20px ${accent}` }} />
                <div className="text-xs font-bold tracking-widest" style={{ color: accent }}>STEP {i + 1}</div>
                <h3 className="wh font-bold text-xl mt-1">{s.title}</h3>
                <p className="mt-1.5 text-white/70 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </SectionDark>
      )}

      {/* Why us: big outlined numbers */}
      {sec.why !== false && sec.feature === false && (
        <SectionDark id="why" kicker="Why us" title="The difference is in the details" ctx={ctx}>
          <div className="grid sm:grid-cols-2 gap-x-10 gap-y-8">
            {(w.why_us?.length ? w.why_us : DEFAULT_WHY).map((s, i) => (
              <div key={i} className="flex gap-5">
                <div className="wh text-5xl font-extrabold leading-none" style={{ color: "transparent", WebkitTextStroke: `1.5px ${accent}` }}>{String(i + 1).padStart(2, "0")}</div>
                <div><h3 className="wh font-bold text-lg">{s.title}</h3><p className="text-white/65 text-sm mt-1">{s.desc}</p></div>
              </div>
            ))}
          </div>
        </SectionDark>
      )}

      {/* Gallery masonry */}
      {sec.gallery !== false && data.photos.length > 0 && (
        <SectionLight id="gallery" kicker="Our craft" title="Recent Work" ctx={lightCtx} alt>
          <div className="columns-2 md:columns-3 gap-3 [column-fill:_balance]">
            {data.photos.slice(0, 12).map((p) => (
              <div key={p.id} className="mb-3 break-inside-avoid overflow-hidden">
                <img src={photoUrl(p.id, 700)} loading="lazy" decoding="async" alt={p.label} className="w-full object-cover hover:opacity-90 transition" />
              </div>
            ))}
          </div>
        </SectionLight>
      )}

      {sec.reviews !== false && <ReviewsBlock ctx={ctx} dark />}
      {sec.band !== false && <CtaBand ctx={ctx} />}
      {sec.faq !== false && <FaqBlock ctx={ctx} />}
      {sec.areas !== false && <AreasBlock ctx={ctx} />}
      {sec.contact !== false && <div style={{ background: "#ECECEF" }}><ContactBlock ctx={grayCtx} /></div>}
      <FooterBlock ctx={ctx} />
    </div>
  );
}

// ===========================================================================
// TEMPLATE 2 — URGENT RESPONDER
// ===========================================================================
function Responder({ ctx }) {
  const { w, b, data, sec, accent, accentText, th, heroImg, poolAt, services, goContact } = ctx;
  const badges = [b.is_licensed && "Licensed", b.is_insured && "Insured", "24/7 Availability", "Fast Response", "5-Star Rated", b.years_in_business > 0 && `${b.years_in_business}+ Yrs`].filter(Boolean);
  return (
    <div className="pb-24 md:pb-0">
      {/* Top urgency band */}
      <div style={{ background: accent, color: accentText }} className="text-center py-2 px-4 text-sm font-bold flex flex-wrap items-center justify-center gap-x-4">
        <span className="inline-flex items-center gap-1"><ShieldCheck className="w-4 h-4" /> Licensed & Insured</span>
        {b.phone && <a href={`tel:${b.phone}`} className="inline-flex items-center gap-1 underline"><Phone className="w-4 h-4" /> {b.phone}</a>}
      </div>
      <header className="sticky top-0 z-40 border-b-2" style={{ background: th.surface, borderColor: th.ink }}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1"><Brand ctx={ctx} /></div>
          <NavMenu ctx={ctx} />
        </div>
      </header>

      {/* Hero with diagonal cut */}
      <section className="relative">
        <div className={`grid ${heroImg ? "md:grid-cols-2" : "grid-cols-1"}`}>
          <div className="px-5 py-10 md:py-24 max-w-xl mx-auto md:mx-0 md:ml-auto md:pr-12 wfade">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-black uppercase mb-4" style={{ background: `${accent}1a`, color: accent }}>Open 24/7 · Emergency Service</div>
            <h1 className="wh uppercase text-5xl sm:text-6xl leading-[0.95]" style={{ color: th.ink }}>{w.headline || b.name}</h1>
            {w.subheadline && <p className="mt-5 text-lg" style={{ color: th.muted }}>{w.subheadline}</p>}
            <div className="mt-7 flex flex-wrap gap-3">
              {b.phone && <a href={`tel:${b.phone}`} data-testid="site-hero-call" className={`px-7 h-14 ${th.btn} inline-flex items-center gap-2`} style={{ background: accent, color: accentText, animation: "wpulse 2s infinite" }}><Phone className="w-5 h-5" /> Call Now</a>}
              <button onClick={goContact} data-testid="site-hero-quote" className={`px-7 h-14 ${th.btn} inline-flex items-center gap-2 border-2`} style={{ borderColor: th.ink, color: th.ink }}>{ctx.cta}</button>
            </div>
          </div>
          {heroImg && (
          <div className="relative min-h-[280px] md:min-h-full">
            <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
          </div>
          )}
        </div>
        {/* trust marquee */}
        <div className="overflow-hidden py-3 border-y-2" style={{ background: "#000000", borderColor: "#000000" }}>
          <div className="wmarq">
            {[...badges, ...badges].map((x, i) => <span key={i} className="text-white font-bold uppercase text-sm inline-flex items-center gap-2 mr-8"><CheckCircle2 className="w-4 h-4" style={{ color: accent }} /> {x}</span>)}
          </div>
        </div>
      </section>

      {/* Free estimate / booking form band (moved out of hero) */}
      <HeroFormBand ctx={ctx} dark />

      {/* How it works: 3 bold blocks */}
      {(data.problem_pages || []).length > 0 && <ProblemsSection ctx={ctx} />}
      {sec.about !== false && <AboutBlock ctx={ctx} />}
      {sec.feature !== false && <FeatureBlock ctx={ctx} />}
      {sec.how !== false && (
        <SectionLight id="how" kicker="Simple" title="How It Works" ctx={ctx} bg="#374151" onDark>
          <div className="grid sm:grid-cols-3 gap-5">
            {(w.how_it_works?.length ? w.how_it_works : DEFAULT_HOW).map((s, i) => (
              <div key={i} className="p-7 border-2 relative" style={{ background: th.surface, borderColor: th.ink, boxShadow: "8px 8px 0 0 rgba(0,0,0,1)" }}>
                <div className="wh text-6xl leading-none" style={{ color: accent }}>{i + 1}</div>
                <h3 className="wh uppercase text-xl mt-2" style={{ color: th.ink }}>{s.title}</h3>
                <p className="mt-2 text-sm" style={{ color: th.muted }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </SectionLight>
      )}

      {/* Services — bold photo cards */}
      {sec.services !== false && (
        <SectionLight id="services" kicker="What we fix" title="Our Services" ctx={ctx} alt>
          <ServiceCardsBold ctx={ctx} />
        </SectionLight>
      )}

      {/* Why us marquee row already above; add cards */}
      {sec.why !== false && sec.feature === false && (
        <SectionLight id="why" kicker="Why choose us" title="Neighbors trust us" ctx={ctx}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {(w.why_us?.length ? w.why_us : DEFAULT_WHY).map((s, i) => {
              const I = [Clock, ShieldCheck, CheckCircle2, Star][i % 4];
              return <div key={i} className="p-5 border-2 text-center" style={{ background: th.surface, borderColor: th.ink }}>
                <I className="w-7 h-7 mx-auto" style={{ color: accent }} /><h3 className="wh uppercase text-base mt-2" style={{ color: th.ink }}>{s.title}</h3><p className="text-xs mt-1" style={{ color: th.muted }}>{s.desc}</p>
              </div>;
            })}
          </div>
        </SectionLight>
      )}

      {sec.gallery !== false && data.photos.length > 0 && (
        <SectionLight id="gallery" kicker="Proof" title="Recent Work" ctx={ctx} bg="#000000" onDark>
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-5 px-5 snap-x">
            {data.photos.slice(0, 12).map((p) => (
              <div key={p.id} className="snap-start flex-none w-64 h-64 overflow-hidden border-2" style={{ borderColor: th.ink }}>
                <img src={photoUrl(p.id, 700)} loading="lazy" decoding="async" alt={p.label} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </SectionLight>
      )}

      {sec.reviews !== false && <ReviewsBlock ctx={ctx} />}
      {sec.band !== false && <CtaBand ctx={ctx} />}
      {sec.faq !== false && <FaqBlock ctx={ctx} dark />}
      {sec.areas !== false && <AreasBlock ctx={ctx} bg="#000000" dark />}
      {sec.contact !== false && <ContactBlock ctx={ctx} />}
      <FooterBlock ctx={ctx} />
    </div>
  );
}

function Accordion({ title, price, body, ctx }) {
  const { th, accent, accentText } = ctx;
  const [open, setOpen] = useState(false);
  return (
    <div className="border-2" style={{ borderColor: th.ink, background: th.surface }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 p-4 text-left" data-testid="site-service-acc">
        <span className="wh uppercase text-lg" style={{ color: th.ink }}>{title}</span>
        <span className="flex-none w-8 h-8 flex items-center justify-center font-bold" style={{ background: accent, color: accentText, transform: open ? "rotate(45deg)" : "none", transition: "transform .2s" }}><Plus className="w-4 h-4" /></span>
      </button>
      {open && <div className="px-4 pb-4 text-sm" style={{ color: th.muted }}>{body}{price && <div className="mt-2 font-bold" style={{ color: accent }}>{price}</div>}</div>}
    </div>
  );
}

// ===========================================================================
// TEMPLATE 3 — MODERN SAAS BENTO (left sidebar on desktop)
// ===========================================================================
function Bento({ ctx }) {
  const { w, b, data, sec, accent, accentText, th, heroImg, poolAt, services, goContact } = ctx;
  const [menu, setMenu] = useState(false);
  const nav = [["Services", "services"], ["Work", "gallery"], ["Reviews", "reviews"], ["Contact", "contact"]];
  return (
    <div className="md:pl-64 pb-20 md:pb-0">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 flex-col justify-between p-7 border-r z-40" style={{ background: th.surface, borderColor: th.border }}>
        <div>
          <Brand ctx={ctx} />
          <nav className="mt-10 space-y-1">
            {nav.map(([l, id]) => <a key={id} href={`#${id}`} className="block px-3 py-2 rounded-lg text-sm font-semibold hover:bg-black/5" style={{ color: th.muted }}>{l}</a>)}
          </nav>
        </div>
        <div>
          {b.phone && <a href={`tel:${b.phone}`} className={`w-full h-12 ${th.btn} inline-flex items-center justify-center gap-2`} style={{ background: accent, color: accentText }}><Phone className="w-4 h-4" /> <span className="hidden sm:inline">Call Now</span></a>}
          <div className="mt-3 text-xs" style={{ color: th.muted }}>{b.is_licensed && "Licensed"} {b.is_insured && "· Insured"}</div>
        </div>
      </aside>
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-40 border-b backdrop-blur-md" style={{ background: `${th.surface}e6`, borderColor: th.border }}>
        <div className="px-5 h-16 flex items-center justify-between">
          <Brand ctx={ctx} />
          <button onClick={() => setMenu(!menu)} className="p-2" style={{ color: th.ink }}>{menu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}</button>
        </div>
        {menu && <div className="px-5 py-3 space-y-1 border-t" style={{ borderColor: th.border }}>{nav.map(([l, id]) => <a key={id} href={`#${id}`} onClick={() => setMenu(false)} className="block py-2 font-semibold" style={{ color: th.ink }}>{l}</a>)}</div>}
      </header>

      {/* Hero — full image background with quote form */}
      <section className="relative px-4 md:px-6 pt-6 md:pt-8">
        <div className="relative overflow-hidden rounded-3xl min-h-[540px] md:min-h-[600px] flex items-center" style={!heroImg ? { background: th.ink } : undefined}>
          {heroImg && <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute inset-0" style={{ background: "linear-gradient(105deg, rgba(15,23,42,.88) 30%, rgba(15,23,42,.35))" }} />
          <div className="relative grid md:grid-cols-2 gap-8 items-center w-full p-7 md:p-12">
            <div className="text-white wfade">
              <HeroBadges ctx={ctx} />
              <h1 className="wh font-extrabold tracking-tight text-4xl md:text-6xl mt-5 leading-[1.02] break-words">{w.headline || b.name}</h1>
              {w.subheadline && <p className="mt-4 text-lg md:text-xl text-white/85 max-w-xl">{w.subheadline}</p>}
              <div className="mt-7 flex flex-wrap gap-3">
                <button onClick={goContact} data-testid="site-hero-quote" className={`px-7 h-13 py-3.5 ${th.btn} inline-flex items-center gap-2 hover:-translate-y-0.5`} style={{ background: accent, color: accentText }}>{ctx.cta} <ArrowRight className="w-4 h-4" /></button>
                {b.phone && <a href={`tel:${b.phone}`} data-testid="site-hero-call" className={`px-7 h-13 py-3.5 ${th.btn} inline-flex items-center gap-2 border border-white/30 text-white`}><Phone className="w-4 h-4" /> Call</a>}
              </div>
            </div>
            <div className="md:justify-self-end w-full"><HeroForm ctx={ctx} dark /></div>
          </div>
        </div>
      </section>

      {sec.services !== false && (
        <SectionLight id="services" kicker="What we do" title="Our Services" ctx={ctx}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((s, i) => (
              <div key={i} className={`p-6 ${th.radius} border hover:-translate-y-1 hover:shadow-xl`} style={{ borderColor: th.border, background: th.surface, boxShadow: "0 1px 2px rgba(0,0,0,.04)" }} data-testid={`site-service-${i}`}>
                {s.img && <div className="-mx-6 -mt-6 mb-4 h-40 overflow-hidden"><img src={s.img} alt={s.name} className="w-full h-full object-cover" /></div>}
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: `${accent}1a` }}><CheckCircle2 className="w-6 h-6" style={{ color: accent }} /></div>
                <h3 className="wh font-bold text-lg" style={{ color: th.ink }}>{s.name}</h3>
                {s.description && <p className="mt-1.5 text-sm" style={{ color: th.muted }}>{s.description}</p>}
                {s.starting_price && <p className="mt-4 wh text-xl font-extrabold" style={{ color: th.ink }}>{s.starting_price}</p>}
                {b.phone && <a href={`tel:${b.phone}`} className="mt-3 inline-flex text-sm font-bold" style={{ color: accent }}>Call now →</a>}
              </div>
            ))}
          </div>
        </SectionLight>
      )}

      {(data.problem_pages || []).length > 0 && <ProblemsSection ctx={ctx} />}
      {sec.about !== false && <AboutBlock ctx={ctx} bg="#FAF5EA" />}
      {sec.feature !== false && <FeatureBlock ctx={ctx} />}
      {sec.how !== false && (
        <SectionLight id="how" kicker="Easy" title="How It Works" ctx={ctx} alt>
          <div className="flex gap-4 overflow-x-auto snap-x pb-3 md:grid md:grid-cols-3 md:overflow-visible">
            {(w.how_it_works?.length ? w.how_it_works : DEFAULT_HOW).map((s, i) => (
              <div key={i} className={`snap-start flex-none w-72 md:w-auto p-6 ${th.radius} border`} style={{ background: th.bg, borderColor: th.border }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold" style={{ background: accent, color: accentText }}>{i + 1}</div>
                <h3 className="wh font-bold text-lg mt-4" style={{ color: th.ink }}>{s.title}</h3>
                <p className="mt-1.5 text-sm" style={{ color: th.muted }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </SectionLight>
      )}

      {/* Why us bento */}
      {sec.why !== false && sec.feature === false && (
        <SectionLight id="why" kicker="Why us" title="Built on trust" ctx={ctx}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 auto-rows-[150px]">
            {(w.why_us?.length ? w.why_us : DEFAULT_WHY).map((s, i) => {
              const I = [Clock, ShieldCheck, CheckCircle2, Star][i % 4];
              const big = i === 0;
              return <div key={i} className={`p-6 ${th.radius} border ${big ? "col-span-2 row-span-2" : ""} flex flex-col justify-center`} style={{ background: big ? accent : th.surface, color: big ? accentText : th.ink, borderColor: th.border }}>
                <I className="w-7 h-7" style={{ color: big ? accentText : accent }} /><h3 className="wh font-bold text-lg mt-3">{s.title}</h3><p className={`mt-1 text-sm ${big ? "opacity-90" : ""}`} style={{ color: big ? accentText : th.muted }}>{s.desc}</p>
              </div>;
            })}
          </div>
        </SectionLight>
      )}

      {sec.gallery !== false && data.photos.length > 0 && (
        <SectionLight id="gallery" kicker="Portfolio" title="Recent Work" ctx={ctx} bg="#FAF5EA">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.photos.slice(0, 8).map((p) => <div key={p.id} className={`overflow-hidden ${th.radius} aspect-square`}><img src={photoUrl(p.id, 700)} loading="lazy" decoding="async" alt={p.label} className="w-full h-full object-cover hover:scale-105 transition" /></div>)}
          </div>
        </SectionLight>
      )}

      {sec.reviews !== false && <ReviewsBlock ctx={ctx} />}
      {sec.band !== false && <CtaBand ctx={ctx} />}
      {sec.faq !== false && <FaqBlock ctx={ctx} dark />}
      {sec.areas !== false && <AreasBlock ctx={ctx} dark />}
      {sec.contact !== false && <ContactBlock ctx={ctx} />}
      <FooterBlock ctx={ctx} />
    </div>
  );
}

// ===========================================================================
// TEMPLATE 4 — ORGANIC CRAFTSMAN (editorial, offset, serif)
// ===========================================================================
function Craftsman({ ctx }) {
  const { w, b, data, sec, accent, accentText, th, heroImg, poolAt, services, goContact } = ctx;
  return (
    <div className="pb-20 md:pb-0">
      <header className="sticky top-0 z-40 backdrop-blur-md" style={{ background: `${th.bg}cc` }}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1"><Brand ctx={ctx} /></div>
          <NavMenu ctx={ctx} />
        </div>
      </header>

      {/* Hero: padded rounded container */}
      <section className="md:px-6 pt-0 md:pt-10">
        <div className="max-w-6xl mx-auto relative overflow-hidden rounded-none md:rounded-[3rem] min-h-[420px] md:min-h-[600px] flex items-center" style={!heroImg ? { background: "#1b1714" } : undefined}>
          {heroImg && <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(20,16,12,.7), rgba(20,16,12,.25))" }} />
          <div className="relative p-7 md:p-12 w-full grid md:grid-cols-2 gap-8 items-center text-white wfade">
            <div>
              <HeroBadges ctx={ctx} />
              <h1 className="wh font-bold text-4xl sm:text-5xl lg:text-6xl mt-5 leading-[1.05] break-words">{w.headline || b.name}</h1>
              {w.subheadline && <p className="mt-5 text-lg md:text-xl text-white/85 font-light">{w.subheadline}</p>}
              <div className="mt-8 flex flex-wrap gap-3">
                <button onClick={goContact} data-testid="site-hero-quote" className={`px-8 h-14 ${th.btn} inline-flex items-center gap-2`} style={{ background: accent, color: accentText }}>{ctx.cta}</button>
                {b.phone && <a href={`tel:${b.phone}`} className={`px-8 h-14 ${th.btn} inline-flex items-center gap-2 bg-white/95 text-stone-900`}><Phone className="w-4 h-4" /> Call</a>}
              </div>
            </div>
            <div className="w-full md:justify-self-end"><HeroForm ctx={ctx} dark /></div>
          </div>
        </div>
      </section>

      {/* Services alternating offset */}
      {sec.services !== false && (
        <section id="services" className="py-20 md:py-28">
          <div className="max-w-6xl mx-auto px-5">
            <Kicker ctx={ctx}>What we do</Kicker>
            <h2 className="wh font-bold text-4xl md:text-5xl mb-12" style={{ color: th.ink }}>Our Services</h2>
            <div className="space-y-16 md:space-y-24">
              {services.map((s, i) => (
                <div key={i} className={`grid ${s.img ? "md:grid-cols-2" : "grid-cols-1"} gap-6 md:gap-10 items-center ${i % 2 && s.img ? "md:[direction:rtl]" : ""}`} data-testid={`site-service-${i}`}>
                  {s.img && <div className="overflow-hidden rounded-3xl shadow-lg [direction:ltr]"><img src={s.img} loading="lazy" decoding="async" alt={s.name} className="w-full aspect-[4/3] object-cover hover:scale-105 transition duration-700" /></div>}
                  <div className="[direction:ltr]">
                    <div className="wh text-6xl italic font-normal" style={{ color: `${accent}55` }}>{String(i + 1).padStart(2, "0")}</div>
                    <h3 className="wh font-bold text-3xl -mt-4" style={{ color: th.ink }}>{s.name}</h3>
                    {s.description && <p className="mt-3 text-lg leading-relaxed" style={{ color: th.muted }}>{s.description}</p>}
                    {s.starting_price && <p className="mt-3 font-bold" style={{ color: accent }}>{s.starting_price}</p>}
                    {b.phone && <a href={`tel:${b.phone}`} className="mt-4 inline-flex items-center gap-2 font-bold" style={{ color: accent }}><Phone className="w-4 h-4" /> Call now</a>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {(data.problem_pages || []).length > 0 && <ProblemsSection ctx={ctx} />}
      {sec.about !== false && <AboutBlock ctx={ctx} />}
      {sec.feature !== false && <FeatureBlock ctx={ctx} />}
      {sec.how !== false && (
        <SectionLight id="how" kicker="Our process" title="How It Works" ctx={ctx} alt>
          <div className="max-w-2xl mx-auto space-y-8">
            {(w.how_it_works?.length ? w.how_it_works : DEFAULT_HOW).map((s, i) => (
              <div key={i} className="flex gap-6 items-start">
                <div className="wh text-5xl italic font-normal flex-none w-16" style={{ color: accent }}>{i + 1}</div>
                <div><h3 className="wh font-bold text-2xl" style={{ color: th.ink }}>{s.title}</h3><p className="mt-1 text-lg" style={{ color: th.muted }}>{s.desc}</p></div>
              </div>
            ))}
          </div>
        </SectionLight>
      )}

      {sec.why !== false && sec.feature === false && (
        <SectionLight id="why" kicker="Why families choose us" title="Craft you can trust" ctx={ctx}>
          <div className="grid sm:grid-cols-2 gap-6">
            {(w.why_us?.length ? w.why_us : DEFAULT_WHY).map((s, i) => {
              const I = [Clock, ShieldCheck, CheckCircle2, Star][i % 4];
              return <div key={i} className={`p-7 ${th.radius}`} style={{ background: `${accent}0d` }}>
                <I className="w-8 h-8" style={{ color: accent }} /><h3 className="wh font-bold text-xl mt-3" style={{ color: th.ink }}>{s.title}</h3><p className="mt-1.5" style={{ color: th.muted }}>{s.desc}</p>
              </div>;
            })}
          </div>
        </SectionLight>
      )}

      {sec.gallery !== false && data.photos.length > 0 && (
        <SectionLight id="gallery" kicker="Portfolio" title="Recent Work" ctx={ctx} dark>
          <div className="columns-2 md:columns-3 gap-4">
            {data.photos.slice(0, 12).map((p, i) => <div key={p.id} className={`mb-4 overflow-hidden rounded-2xl ${i % 3 === 1 ? "md:mt-8" : ""}`}><img src={photoUrl(p.id, 700)} loading="lazy" decoding="async" alt={p.label} className="w-full object-cover" /></div>)}
          </div>
        </SectionLight>
      )}

      {sec.reviews !== false && <ReviewsBlock ctx={ctx} editorial />}
      {sec.band !== false && <CtaBand ctx={ctx} />}
      {sec.faq !== false && <FaqBlock ctx={ctx} dark />}
      {sec.areas !== false && <AreasBlock ctx={ctx} dark />}
      {sec.contact !== false && <ContactBlock ctx={ctx} />}
      <FooterBlock ctx={ctx} />
    </div>
  );
}

// ===========================================================================
// TEMPLATE 5 — LOCAL TRUST (centered hero + floating form + wavy dividers)
// ===========================================================================
function Trust({ ctx }) {
  const { w, b, data, sec, accent, accentText, th, heroImg, poolAt, services, goContact, slug } = ctx;
  const nav = [["Services", "services"], ["Work", "gallery"], ["Reviews", "reviews"], ["FAQ", "faq"]];
  const [menu, setMenu] = useState(false);
  return (
    <div className="pb-20 md:pb-0">
      <header className="sticky top-0 z-40 backdrop-blur-md border-b" style={{ background: `${th.surface}e6`, borderColor: th.border }}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Brand ctx={ctx} />
          <nav className="hidden md:flex gap-7 text-sm font-semibold" style={{ color: th.muted }}>{nav.map(([l, id]) => <a key={id} href={`#${id}`}>{l}</a>)}</nav>
          <div className="flex items-center gap-2">
            <button className="md:hidden p-2" onClick={() => setMenu(!menu)} style={{ color: th.ink }}>{menu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}</button>
          </div>
        </div>
        {menu && <div className="md:hidden border-t px-5 py-3 space-y-1" style={{ borderColor: th.border }}>{nav.map(([l, id]) => <a key={id} href={`#${id}`} onClick={() => setMenu(false)} className="block py-2 font-semibold" style={{ color: th.ink }}>{l}</a>)}</div>}
      </header>

      {/* Centered hero with floating form */}
      <section className="relative">
        <div className="relative" style={!heroImg ? { background: "#111827" } : undefined}>
          {heroImg && <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(17,24,39,.78), rgba(17,24,39,.62))" }} />
          <div className="relative max-w-3xl mx-auto px-5 pt-12 pb-40 md:pt-20 md:pb-52 text-center text-white wfade">
            <div className="flex justify-center"><HeroBadges ctx={ctx} /></div>
            <h1 className="wh font-extrabold tracking-tight text-4xl sm:text-5xl lg:text-6xl mt-5 leading-[1.05]">{w.headline || b.name}</h1>
            {w.subheadline && <p className="mt-5 text-lg md:text-xl text-white/85 max-w-2xl mx-auto">{w.subheadline}</p>}
            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              <button onClick={goContact} data-testid="site-hero-quote" className={`px-8 h-14 ${th.btn} inline-flex items-center gap-2`} style={{ background: accent, color: accentText }}>{ctx.cta}</button>
              {b.phone && <a href={`tel:${b.phone}`} data-testid="site-hero-call" className={`px-8 h-14 ${th.btn} inline-flex items-center gap-2 bg-white text-gray-900`}><Phone className="w-5 h-5" /> Call Now</a>}
            </div>
          </div>
        </div>
        {/* floating form overlapping */}
        <div id="contact" className="max-w-4xl mx-auto px-5 -mt-28 md:-mt-36 relative z-10">
          <div className={`p-6 md:p-8 ${th.radius} shadow-2xl`} style={{ background: th.surface, border: `1px solid ${th.border}` }}>
            {(() => {
              const bookingOn = ctx.sec?.booking && ctx.data?.card_slug;
              return (<>
                <h2 className="wh font-extrabold text-2xl mb-1" style={{ color: th.ink }}>{bookingOn ? "Book an Appointment" : "Get Your Free Estimate"}</h2>
                <p className="text-sm mb-4" style={{ color: th.muted }}>{bookingOn ? "Pick a day and time — we'll confirm fast" : "Fast response · No obligation"}</p>
                {bookingOn ? <BookingForm ctx={ctx} inline /> : <LeadForm ctx={ctx} inline />}
              </>);
            })()}
          </div>
        </div>
      </section>

      {sec.services !== false && (
        <SectionLight id="services" kicker="What we do" title="Our Services" ctx={ctx}>
          <ServiceBento ctx={ctx} />
        </SectionLight>
      )}

      {(data.problem_pages || []).length > 0 && <ProblemsSection ctx={ctx} />}
      {sec.about !== false && <AboutBlock ctx={ctx} />}
      {sec.feature !== false && <FeatureBlock ctx={ctx} />}
      {sec.how !== false && (
        <SectionLight id="how" kicker="Easy as 1-2-3" title="How It Works" ctx={ctx} alt>
          <div className="grid sm:grid-cols-3 gap-6">
            {(w.how_it_works?.length ? w.how_it_works : DEFAULT_HOW).map((s, i) => (
              <div key={i} className="text-center px-4">
                <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center font-extrabold text-2xl" style={{ background: `${accent}1a`, color: accent }}>{i + 1}</div>
                <h3 className="wh font-extrabold text-lg mt-4" style={{ color: th.ink }}>{s.title}</h3>
                <p className="mt-1.5 text-sm" style={{ color: th.muted }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </SectionLight>
      )}

      {sec.why !== false && sec.feature === false && (
        <SectionLight id="why" kicker="Why choose us" title="Your trusted local pros" ctx={ctx}>
          <div className="grid grid-cols-2 gap-4 max-w-3xl">
            {(w.why_us?.length ? w.why_us : DEFAULT_WHY).map((s, i) => {
              const I = [Clock, ShieldCheck, CheckCircle2, Star][i % 4];
              return <div key={i} className={`p-6 ${th.radius} flex gap-4`} style={{ background: th.surface, boxShadow: "0 10px 30px rgba(0,0,0,.06)" }}>
                <span className="w-11 h-11 rounded-lg flex items-center justify-center flex-none" style={{ background: `${accent}1a` }}><I className="w-5 h-5" style={{ color: accent }} /></span>
                <div><h3 className="wh font-bold text-base" style={{ color: th.ink }}>{s.title}</h3><p className="text-sm mt-0.5" style={{ color: th.muted }}>{s.desc}</p></div>
              </div>;
            })}
          </div>
        </SectionLight>
      )}

      {sec.gallery !== false && data.photos.length > 0 && (
        <SectionLight id="gallery" kicker="See our work" title="Recent Projects" ctx={ctx} dark>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {data.photos.slice(0, 9).map((p) => <div key={p.id} className={`overflow-hidden ${th.radius} aspect-[4/3] shadow-md`}><img src={photoUrl(p.id, 700)} loading="lazy" decoding="async" alt={p.label} className="w-full h-full object-cover hover:scale-105 transition" /></div>)}
          </div>
        </SectionLight>
      )}

      {sec.reviews !== false && <ReviewsBlock ctx={ctx} />}
      {sec.band !== false && <CtaBand ctx={ctx} />}
      {sec.faq !== false && <FaqBlock ctx={ctx} dark />}
      {sec.areas !== false && <AreasBlock ctx={ctx} dark />}
      {sec.contact !== false && <ContactBlock ctx={ctx} id="contact2" />}
      <FooterBlock ctx={ctx} />
    </div>
  );
}

// ===========================================================================
// Before/After draggable slider (used by T6)
// ===========================================================================
function BeforeAfter({ before, after, accent, tall }) {
  const [pos, setPos] = useState(50);
  const ref = useRef(null);
  const move = (clientX) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  };
  return (
    <div ref={ref} className={`relative w-full ${tall ? "h-full" : "aspect-[4/3]"} overflow-hidden select-none cursor-ew-resize`}
      onMouseMove={(e) => e.buttons === 1 && move(e.clientX)} onClick={(e) => move(e.clientX)}
      onTouchMove={(e) => move(e.touches[0].clientX)} data-testid="site-before-after">
      <img src={after} alt="after" className="absolute inset-0 w-full h-full object-cover" draggable="false" />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        <img src={before} alt="before" className="absolute inset-0 h-full object-cover max-w-none" style={{ width: ref.current ? ref.current.offsetWidth : "100%" }} draggable="false" />
        <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-widest bg-black/60 text-white px-2 py-1">Before</span>
      </div>
      <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-widest px-2 py-1" style={{ background: accent, color: isLight(accent) ? "#000" : "#fff" }}>After</span>
      <div className="absolute inset-y-0" style={{ left: `${pos}%`, width: 3, background: "#fff", transform: "translateX(-50%)" }}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white shadow-lg flex items-center justify-center" style={{ color: accent }}><ArrowRight className="w-4 h-4 -mr-1" /><ArrowRight className="w-4 h-4 rotate-180 -ml-1" /></div>
      </div>
    </div>
  );
}

// ===========================================================================
// TEMPLATE 6 — BEFORE / AFTER
// ===========================================================================
function Slider({ ctx }) {
  const { w, b, data, sec, accent, accentText, th, poolAt, services, goContact, heroImg } = ctx;
  const ba = (w.before_after || []).filter((p) => p && p.before && p.after);
  const heroBefore = ba[0] ? photoUrl(ba[0].before) : null;
  const heroAfter = ba[0] ? photoUrl(ba[0].after) : null;
  const showBA = !!(heroBefore && heroAfter);
  return (
    <div className="pb-24 md:pb-0">
      <header className="sticky top-0 z-40 border-b-2 bg-white" style={{ borderColor: th.ink }}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="min-w-0 flex-1"><Brand ctx={ctx} /></div>
          <NavMenu ctx={ctx} />
        </div>
      </header>
      <section className={`grid ${(showBA || heroImg) ? "md:grid-cols-2" : "grid-cols-1"}`}>
        <div className="px-5 py-10 md:py-0 md:flex md:flex-col md:justify-center md:px-12 order-2 md:order-1" style={{ background: th.ink }}>
          <div className="text-white wfade max-w-lg">
            <HeroBadges ctx={ctx} />
            <h1 className="wh uppercase text-4xl sm:text-5xl lg:text-6xl mt-5 leading-[0.98] break-words">{w.headline || b.name}</h1>
            {w.subheadline && <p className="mt-5 text-lg text-white/80">{w.subheadline}</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={goContact} data-testid="site-hero-quote" className={`px-8 h-14 ${th.btn} inline-flex items-center gap-2 group`} style={{ background: accent, color: accentText }}>See Your Transformation <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" /></button>
              {b.phone && <a href={`tel:${b.phone}`} className={`px-8 h-14 ${th.btn} inline-flex items-center gap-2 border-2 border-white/40 text-white`}><Phone className="w-4 h-4" /> Call</a>}
            </div>
            <div className="mt-6 max-w-sm"><HeroForm ctx={ctx} dark /></div>
          </div>
        </div>
        {(showBA || heroImg) && (
        <div className="relative min-h-[280px] md:min-h-[560px] order-1 md:order-2">
          {showBA ? <BeforeAfter before={heroBefore} after={heroAfter} accent={accent} tall /> : <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        </div>
        )}
      </section>

      {(data.problem_pages || []).length > 0 && <ProblemsSection ctx={ctx} />}
      {sec.about !== false && <AboutBlock ctx={ctx} />}
      {sec.feature !== false && <FeatureBlock ctx={ctx} />}
      {sec.how !== false && (
        <SectionLight id="how" kicker="Our process" title="How It Works" ctx={ctx}>
          <div className="grid sm:grid-cols-3 gap-4 items-stretch">
            {(w.how_it_works?.length ? w.how_it_works : DEFAULT_HOW).map((s, i, arr) => (
              <div key={i} className="relative p-6 border-2" style={{ borderColor: th.ink, background: th.surface }}>
                <div className="wh text-5xl" style={{ color: accent }}>{i + 1}</div>
                <h3 className="wh uppercase text-lg mt-2" style={{ color: th.ink }}>{s.title}</h3>
                <p className="mt-2 text-sm" style={{ color: th.muted }}>{s.desc}</p>
                {i < arr.length - 1 && <ArrowRight className="hidden sm:block absolute -right-5 top-1/2 -translate-y-1/2 w-7 h-7 z-10" style={{ color: accent }} />}
              </div>
            ))}
          </div>
        </SectionLight>
      )}

      {sec.services !== false && (
        <SectionLight id="services" kicker="What we do" title="Our Services" ctx={ctx} alt>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((s, i) => (
              <div key={i} className="border-2 overflow-hidden group" style={{ borderColor: th.ink, background: "#fff" }} data-testid={`site-service-${i}`}>
                {s.img && <div className="aspect-[16/10] overflow-hidden"><img src={s.img} loading="lazy" decoding="async" alt={s.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" /></div>}
                <div className="p-5">
                  <h3 className="wh uppercase text-xl" style={{ color: th.ink }}>{s.name}</h3>
                  {s.description && <p className="mt-2 text-sm" style={{ color: th.muted }}>{s.description}</p>}
                  {s.starting_price && <p className="mt-2 font-bold" style={{ color: accent }}>{s.starting_price}</p>}
                </div>
              </div>
            ))}
          </div>
        </SectionLight>
      )}

      {sec.why !== false && sec.feature === false && (
        <SectionLight id="why" kicker="Why choose us" title="Results that speak" ctx={ctx}>
          <div className="grid sm:grid-cols-2 gap-x-10 gap-y-4 max-w-3xl">
            {(w.why_us?.length ? w.why_us : DEFAULT_WHY).map((s, i) => (
              <div key={i} className="flex gap-3 items-start"><CheckCircle2 className="w-6 h-6 flex-none" style={{ color: accent }} /><div><h3 className="wh uppercase text-base" style={{ color: th.ink }}>{s.title}</h3><p className="text-sm" style={{ color: th.muted }}>{s.desc}</p></div></div>
            ))}
          </div>
        </SectionLight>
      )}

      {sec.gallery !== false && (ba.length > 0 || data.photos.length > 1) && (
        <SectionLight id="gallery" kicker="Transformations" title="See The Difference" ctx={ctx} dark>
          <div className="grid md:grid-cols-2 gap-5">
            {ba.length > 0
              ? ba.map((p, i) => (
                  <div key={i} className="border-2" style={{ borderColor: th.ink }} data-testid={`site-ba-${i}`}>
                    <BeforeAfter before={photoUrl(p.before)} after={photoUrl(p.after)} accent={accent} />
                  </div>
                ))
              : [0, 2].map((base) => data.photos[base] && data.photos[base + 1] && (
                  <div key={base} className="border-2" style={{ borderColor: th.ink }}>
                    <BeforeAfter before={photoUrl(data.photos[base].id)} after={photoUrl(data.photos[base + 1].id)} accent={accent} />
                  </div>
                ))}
          </div>
        </SectionLight>
      )}

      {sec.reviews !== false && <ReviewsBlock ctx={ctx} />}
      {sec.band !== false && <CtaBand ctx={ctx} />}
      {sec.faq !== false && <FaqBlock ctx={ctx} dark />}
      {sec.areas !== false && <AreasBlock ctx={ctx} dark />}
      {sec.contact !== false && <ContactBlock ctx={ctx} />}
      <FooterBlock ctx={ctx} />
    </div>
  );
}

// ===========================================================================
// TEMPLATE 7 — MINIMAL ONE-PAGE
// ===========================================================================
function OnePage({ ctx }) {
  const { w, b, data, sec, accent, th, poolAt, services, goContact, heroImg } = ctx;
  const nav = [["Services", "services"], ["Work", "gallery"], ["Reviews", "reviews"], ["Contact", "contact"]];
  return (
    <div className="pb-20 md:pb-0">
      <header className="sticky top-0 z-40 bg-[#FAFAFA]/90 backdrop-blur border-b" style={{ borderColor: th.border }}>
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Brand ctx={ctx} />
          <NavMenu ctx={ctx} />
        </div>
      </header>

      <section className="relative min-h-[60svh] md:min-h-[80svh] flex items-center md:items-end">
        {heroImg && <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0" style={{ background: heroImg ? "linear-gradient(to top, rgba(10,10,10,.82), rgba(10,10,10,.15))" : th.ink }} />
        <div className="relative max-w-5xl mx-auto px-6 pb-14 pt-24 md:pt-32 w-full grid md:grid-cols-2 gap-10 items-end">
          <div className="text-white wfade">
            <div className="flex items-center gap-2 text-sm mb-6 text-white/80"><span className="w-2 h-2 rounded-full" style={{ background: accent }} /> {b.is_licensed || b.is_insured ? "Licensed & Insured" : "Trusted local service"}</div>
            <h1 className="wh text-4xl sm:text-5xl lg:text-6xl leading-[1.03] break-words">{w.headline || b.name}</h1>
            {w.subheadline && <p className="mt-6 text-lg leading-relaxed max-w-lg text-white/85">{w.subheadline}</p>}
            <div className="mt-9 flex flex-wrap gap-3">
              <button onClick={goContact} data-testid="site-hero-quote" className={`px-7 h-13 py-3.5 ${th.btn} inline-flex items-center gap-2`} style={{ background: accent, color: isLight(accent) ? "#000" : "#fff" }}>{ctx.cta}</button>
              {b.phone && <a href={`tel:${b.phone}`} data-testid="site-hero-call" className={`px-7 h-13 py-3.5 ${th.btn} inline-flex items-center gap-2 border border-white/40 text-white`}>Call now</a>}
            </div>
          </div>
          <div className="w-full md:justify-self-end"><HeroForm ctx={ctx} dark /></div>
        </div>
      </section>

      {sec.services !== false && (
        <section id="services" className="max-w-5xl mx-auto px-6 py-24 border-t" style={{ borderColor: th.border }}>
          <div className="flex items-baseline justify-between mb-10"><h2 className="wh text-4xl" style={{ color: th.ink }}>Services</h2><span className="text-sm" style={{ color: th.muted }}>What we offer</span></div>
          <div>{services.map((s, i) => <OneAccordion key={i} s={s} ctx={ctx} />)}</div>
        </section>
      )}

      {(data.problem_pages || []).length > 0 && <ProblemsSection ctx={ctx} />}
      {sec.about !== false && <AboutBlock ctx={ctx} bg="#FAF5EA" />}
      {sec.feature !== false && <FeatureBlock ctx={ctx} />}
      {sec.how !== false && (
        <section id="how" className="max-w-5xl mx-auto px-6 py-24 border-t" style={{ borderColor: th.border }}>
          <h2 className="wh text-4xl mb-10" style={{ color: th.ink }}>How it works</h2>
          {(w.how_it_works?.length ? w.how_it_works : DEFAULT_HOW).map((s, i) => (
            <div key={i} className="grid md:grid-cols-12 gap-4 py-8 border-t items-baseline" style={{ borderColor: th.border }}>
              <div className="md:col-span-1 wh text-3xl" style={{ color: th.border === "#E5E7EB" ? "#D1D5DB" : th.muted }}>{String(i + 1).padStart(2, "0")}</div>
              <h3 className="md:col-span-4 wh text-2xl" style={{ color: th.ink }}>{s.title}</h3>
              <p className="md:col-span-7 text-lg leading-relaxed" style={{ color: th.muted }}>{s.desc}</p>
            </div>
          ))}
        </section>
      )}

      {sec.why !== false && sec.feature === false && (
        <section id="why" className="max-w-3xl mx-auto px-6 py-24 border-t" style={{ borderColor: th.border }}>
          <h2 className="wh text-4xl mb-8" style={{ color: th.ink }}>Why us</h2>
          <div className="space-y-6">
            {(w.why_us?.length ? w.why_us : DEFAULT_WHY).map((s, i) => (
              <p key={i} className="text-xl leading-loose" style={{ color: th.muted }}><span className="wh" style={{ color: th.ink }}>{s.title}.</span> {s.desc}</p>
            ))}
          </div>
        </section>
      )}

      {sec.gallery !== false && data.photos.length > 0 && (
        <section id="gallery" className="py-24" style={{ background: "#FAF5EA" }}>
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="wh text-4xl mb-10" style={{ color: th.ink }}>Recent work</h2>
            <div className="columns-1 sm:columns-2 gap-8">
              {data.photos.slice(0, 8).map((p, i) => <div key={p.id} className={`mb-8 overflow-hidden rounded-sm ${i % 2 ? "sm:ml-10" : "sm:mr-10"}`}><img src={photoUrl(p.id, 700)} loading="lazy" decoding="async" alt={p.label} className="w-full object-cover" /></div>)}
            </div>
          </div>
        </section>
      )}

      {sec.reviews !== false && data.reviews.length > 0 && (
        <section id="reviews" className="py-28 text-center" style={{ background: th.ink }}>
          <div className="max-w-3xl mx-auto px-6">
            <Stars n={data.reviews[0].rating} />
            <p className="wh text-xl md:text-2xl leading-relaxed mt-4" style={{ color: "#FFFFFF" }}>"{data.reviews[0].text}"</p>
            <div className="mt-5 text-sm tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.6)" }}>{data.reviews[0].customer_name}</div>
          </div>
        </section>
      )}

      {sec.band !== false && <CtaBand ctx={ctx} />}
      {sec.contact !== false && <ContactBlock ctx={ctx} />}
      <FooterBlock ctx={ctx} />
    </div>
  );
}
function OneAccordion({ s, ctx }) {
  const { th, accent, accentText } = ctx;
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t" style={{ borderColor: th.border }} data-testid="site-service-acc">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center justify-between gap-4 py-6 text-left">
        <span className="wh text-2xl" style={{ color: th.ink }}>{s.name}</span>
        <span className="flex items-center gap-4">{s.starting_price && <span className="text-sm" style={{ color: accent }}>{s.starting_price}</span>}<span className="text-2xl leading-none" style={{ color: accent, transform: open ? "rotate(45deg)" : "none", transition: "transform .3s" }}>+</span></span>
      </button>
      <div className="grid transition-all duration-500 ease-out" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
        <div className="overflow-hidden">
          <div className="grid md:grid-cols-2 gap-6 pb-8 items-center">
            {s.img && <div className="overflow-hidden rounded-lg order-1"><img src={s.img} loading="lazy" decoding="async" alt={s.name} className="w-full aspect-video object-cover" /></div>}
            <div className="order-2">
              {s.description && <p className="text-lg leading-relaxed" style={{ color: th.muted }}>{s.description}</p>}
              <button onClick={ctx.goContact} className={`mt-5 px-6 h-12 ${th.btn} inline-flex items-center gap-2`} style={{ background: accent, color: accentText }}>{ctx.cta} <ArrowRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Reusable photo-forward service layouts (shared across templates) -----------
function ServiceBento({ ctx }) {
  const { services, accent, accentText, goContact } = ctx;
  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-4 md:gap-5">
      {services.map((s, i) => {
        const wide = i % 4 === 0 || i % 4 === 3;
        return (
          <div key={i} className={`group relative overflow-hidden rounded-3xl min-h-[300px] md:min-h-[340px] flex items-end col-span-1 ${wide ? "md:col-span-4" : "md:col-span-2"}`} style={{ background: "#0b0b0d" }} data-testid={`site-service-${i}`}>
            {s.img && <img src={s.img} loading="lazy" decoding="async" alt={s.name} className="absolute inset-0 w-full h-full object-cover opacity-75 group-hover:opacity-95 group-hover:scale-105 transition-all duration-700" />}
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,.92), rgba(0,0,0,.35) 55%, rgba(0,0,0,.05))" }} />
            <div className="relative p-7 w-full text-white">
              <h3 className="wh font-bold text-2xl md:text-3xl">{s.name}</h3>
              {s.description && <p className="mt-2 text-sm text-white/85 max-w-xl">{s.description}</p>}
              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <button onClick={goContact} className="text-sm font-bold inline-flex items-center gap-1.5 px-5 h-10 rounded-full hover:-translate-y-0.5 transition-transform" style={{ background: accent, color: accentText }}>{ctx.cta} <ArrowRight className="w-3.5 h-3.5" /></button>
                {s.starting_price && <span className="text-sm font-bold text-white">{s.starting_price}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ServiceCardsBold({ ctx }) {
  const { services, accent, accentText, th, goContact } = ctx;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {services.map((s, i) => (
        <div key={i} className="group overflow-hidden bg-white border-2 flex flex-col" style={{ borderColor: th.ink, boxShadow: "6px 6px 0 0 rgba(17,24,39,1)" }} data-testid={`site-service-${i}`}>
          {s.img && <div className="aspect-[16/10] overflow-hidden border-b-2" style={{ borderColor: th.ink }}><img src={s.img} loading="lazy" decoding="async" alt={s.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /></div>}
          <div className="p-5 flex flex-col flex-1">
            <h3 className="wh uppercase text-xl" style={{ color: th.ink }}>{s.name}</h3>
            {s.description && <p className="mt-2 text-sm flex-1" style={{ color: th.muted }}>{s.description}</p>}
            <div className="mt-4 flex items-center justify-between gap-2">
              {s.starting_price ? <span className="font-bold" style={{ color: accent }}>{s.starting_price}</span> : <span />}
              <button onClick={goContact} className={`px-4 h-10 ${th.btn} text-sm inline-flex items-center gap-1.5`} style={{ background: accent, color: accentText }}>{ctx.cta}</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ===========================================================================
// TEMPLATE 8 — NEON APP/TECH
// ===========================================================================
function Neon({ ctx }) {
  const { w, b, data, sec, accent, accentText, th, poolAt, services, goContact, heroImg } = ctx;
  const grid = "radial-gradient(rgba(255,255,255,.06) 1px, transparent 1px)";
  const glow = { boxShadow: `0 0 24px ${accent}55` };
  return (
    <div className="pb-24 md:pb-0" style={{ backgroundImage: grid, backgroundSize: "26px 26px" }}>
      <header className="sticky top-0 z-40 backdrop-blur-md border-b" style={{ background: "rgba(10,10,12,.8)", borderColor: th.border }}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Brand ctx={ctx} light />
          <NavMenu ctx={ctx} light />
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl opacity-40" style={{ background: accent }} />
        <div className="pointer-events-none absolute top-10 right-0 w-80 h-80 rounded-full blur-3xl opacity-20" style={{ background: "#22D3EE" }} />
        <div className="pointer-events-none absolute inset-0 opacity-[0.10]" style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,.6) 0px, rgba(255,255,255,.6) 1px, transparent 1px, transparent 3px)" }} />
        <div className={`relative max-w-6xl mx-auto px-5 py-12 md:py-28 grid ${heroImg ? "md:grid-cols-2" : "grid-cols-1"} gap-10 items-stretch`}>
          <div className="wfade">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono border" style={{ borderColor: `${accent}66`, color: accent, boxShadow: `inset 0 0 14px ${accent}44` }}><span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accent, boxShadow: `0 0 10px ${accent}` }} /> SYSTEM ONLINE · 24/7</div>
            <h1 className="wh text-5xl lg:text-6xl mt-5 leading-[1.02] break-words" style={{ backgroundImage: `linear-gradient(90deg,#ffffff,${accent})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", filter: `drop-shadow(0 0 22px ${accent}55)` }}>{w.headline || b.name}</h1>
            {w.subheadline && <p className="mt-5 text-lg font-mono" style={{ color: th.muted }}>{w.subheadline}</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={goContact} data-testid="site-hero-quote" className={`px-7 h-13 py-3.5 ${th.btn} inline-flex items-center gap-2 hover:-translate-y-0.5`} style={{ background: accent, color: accentText, ...glow }}>{ctx.cta} <ArrowRight className="w-4 h-4" /></button>
              {b.phone && <a href={`tel:${b.phone}`} data-testid="site-hero-call" className={`px-7 h-13 py-3.5 ${th.btn} inline-flex items-center gap-2 border`} style={{ borderColor: `${accent}66`, color: "#fff" }}><Phone className="w-4 h-4" /> Call</a>}
            </div>
            <div className="mt-6 max-w-sm"><HeroForm ctx={ctx} dark /></div>
          </div>
          {heroImg && (
          <div className="relative rounded-2xl overflow-hidden border h-full min-h-[340px] self-stretch" style={{ borderColor: `${accent}66`, boxShadow: `0 0 40px ${accent}55` }}>
            <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ filter: "grayscale(.35) contrast(1.12)" }} />
            <div className="absolute inset-0 mix-blend-color" style={{ background: accent, opacity: 0.42 }} />
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,.6) 0px, rgba(0,0,0,.6) 1px, transparent 1px, transparent 3px)" }} />
          </div>
          )}
        </div>
      </section>

      {sec.services !== false && (
        <SectionLight id="services" kicker="Capabilities" title="Our Services" ctx={ctx}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((s, i) => (
              <div key={i} className="p-6 rounded-xl border transition-all hover:-translate-y-1" style={{ background: "rgba(255,255,255,.04)", borderColor: th.border }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.boxShadow = `0 0 22px ${accent}44`; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = th.border; e.currentTarget.style.boxShadow = "none"; }} data-testid={`site-service-${i}`}>
                {s.img && <div className="-mx-6 -mt-6 mb-4 h-40 overflow-hidden"><img src={s.img} alt={s.name} className="w-full h-full object-cover" /></div>}
                <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-4" style={{ background: `${accent}1a`, border: `1px solid ${accent}55` }}><CheckCircle2 className="w-5 h-5" style={{ color: accent }} /></div>
                <h3 className="wh text-lg" style={{ color: "#fff" }}>{s.name}</h3>
                {s.description && <p className="mt-1.5 text-sm" style={{ color: th.muted }}>{s.description}</p>}
                {s.starting_price && <p className="mt-3 font-mono text-sm" style={{ color: accent }}>{s.starting_price}</p>}
              </div>
            ))}
          </div>
        </SectionLight>
      )}

      {(data.problem_pages || []).length > 0 && <ProblemsSection ctx={ctx} />}
      {sec.about !== false && <AboutBlock ctx={ctx} light />}
      {sec.feature !== false && <FeatureBlock ctx={ctx} />}
      {sec.how !== false && (
        <SectionLight id="how" kicker="Process" title="How It Works" ctx={ctx} alt>
          <div className="grid sm:grid-cols-3 gap-6">
            {(w.how_it_works?.length ? w.how_it_works : DEFAULT_HOW).map((s, i) => (
              <div key={i} className="relative">
                <div className="w-12 h-12 rounded-full flex items-center justify-center font-mono font-bold border" style={{ borderColor: accent, color: accent, boxShadow: `0 0 16px ${accent}66` }}>{i + 1}</div>
                <h3 className="wh text-lg mt-4" style={{ color: "#fff" }}>{s.title}</h3>
                <p className="mt-1.5 text-sm" style={{ color: th.muted }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </SectionLight>
      )}

      {sec.why !== false && sec.feature === false && (
        <SectionLight id="why" kicker="//advantages" title="Why Choose Us" ctx={ctx}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {(w.why_us?.length ? w.why_us : DEFAULT_WHY).map((s, i) => {
              const I = [Clock, ShieldCheck, CheckCircle2, Star][i % 4];
              return <div key={i} className="p-6 rounded-xl border text-center" style={{ background: "rgba(255,255,255,.04)", borderColor: th.border }}>
                <I className="w-7 h-7 mx-auto" style={{ color: accent }} /><h3 className="wh text-sm uppercase mt-2 font-mono" style={{ color: "#fff" }}>{s.title}</h3><p className="text-xs mt-1" style={{ color: th.muted }}>{s.desc}</p>
              </div>;
            })}
          </div>
        </SectionLight>
      )}

      {sec.gallery !== false && data.photos.length > 0 && (
        <SectionLight id="gallery" kicker="Portfolio" title="Recent Work" ctx={ctx} light>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.photos.slice(0, 8).map((p) => <div key={p.id} className="overflow-hidden rounded-xl aspect-square"><img src={photoUrl(p.id, 700)} loading="lazy" decoding="async" alt={p.label} className="w-full h-full object-cover grayscale hover:grayscale-0 transition duration-500" /></div>)}
          </div>
        </SectionLight>
      )}

      {sec.reviews !== false && <ReviewsBlock ctx={ctx} dark />}
      {sec.band !== false && <CtaBand ctx={ctx} />}
      {sec.faq !== false && <FaqBlock ctx={ctx} light />}
      {sec.areas !== false && <AreasBlock ctx={ctx} />}
      {sec.contact !== false && <ContactBlock ctx={ctx} />}
      <FooterBlock ctx={ctx} />
    </div>
  );
}

// ===========================================================================
// TEMPLATE 9 — PLAYFUL & FRIENDLY
// ===========================================================================
function Playful({ ctx }) {
  const { w, b, data, sec, accent, accentText, th, poolAt, services, goContact, heroImg } = ctx;
  const pastels = [`${accent}1f`, "#FDE68A66", "#A7F3D066", "#BFDBFE66", "#FBCFE866", "#DDD6FE66"];
  return (
    <div className="pb-24 md:pb-0">
      <header className="sticky top-0 z-40 pt-4 px-4">
        <div className="max-w-5xl mx-auto rounded-full bg-white shadow-md px-5 h-14 flex items-center justify-between">
          <div className="min-w-0 flex-1"><Brand ctx={ctx} /></div>
          <NavMenu ctx={ctx} />
        </div>
      </header>

      <section className="relative overflow-hidden">
        {heroImg && <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0" style={{ background: heroImg ? "linear-gradient(115deg, rgba(51,48,46,.86) 35%, rgba(51,48,46,.4))" : `${accent}18` }} />
        <div className="absolute -top-10 -left-10 w-72 h-72 rounded-full opacity-60" style={{ background: `${accent}33` }} />
        <div className="absolute top-40 right-0 w-56 h-56 rounded-full opacity-50" style={{ background: "#FDE68A55" }} />
        <div className="relative max-w-6xl mx-auto px-5 py-10 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <div className="wfade" style={{ color: heroImg ? "#fff" : th.ink }}>
            <div className="flex flex-wrap gap-2 mb-4">{[b.is_licensed && "✓ Licensed", b.is_insured && "✓ Insured", "★ 5-Star"].filter(Boolean).map((x, i) => <span key={i} className="px-3 py-1 rounded-full text-xs font-extrabold bg-white/90" style={{ color: th.ink }}>{x}</span>)}</div>
            <h1 className="wh text-4xl sm:text-6xl leading-[1] tracking-tight break-words">{w.headline || b.name}</h1>
            {w.subheadline && <p className="mt-5 text-lg" style={{ color: heroImg ? "rgba(255,255,255,.9)" : th.muted }}>{w.subheadline}</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={goContact} data-testid="site-hero-quote" className={`px-8 h-14 ${th.btn} inline-flex items-center gap-2 hover:scale-105 active:scale-95 transition`} style={{ background: accent, color: accentText }}>{ctx.cta}</button>
              {b.phone && <a href={`tel:${b.phone}`} data-testid="site-hero-call" className={`px-8 h-14 ${th.btn} inline-flex items-center gap-2 bg-white shadow`} style={{ color: th.ink }}><Phone className="w-4 h-4" style={{ color: accent }} /> Call</a>}
            </div>
          </div>
          <div className="w-full md:justify-self-end"><HeroForm ctx={ctx} dark={!!heroImg} /></div>
        </div>
      </section>

      {sec.services !== false && (
        <SectionLight id="services" kicker="What we do" title="Our Services" ctx={ctx}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((s, i) => (
              <div key={i} className={`overflow-hidden ${th.radius} hover:-translate-y-2 transition-transform duration-300`} style={{ background: pastels[i % pastels.length], border: "3px solid #33302E", boxShadow: "6px 6px 0 0 #33302E" }} data-testid={`site-service-${i}`}>
                {s.img && <div className="h-44 overflow-hidden border-b-[3px]" style={{ borderColor: "#33302E" }}><img src={s.img} loading="lazy" decoding="async" alt={s.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" /></div>}
                <div className="p-6">
                  <h3 className="wh text-xl" style={{ color: th.ink }}>{s.name}</h3>
                  {s.description && <p className="mt-1.5 text-sm" style={{ color: th.muted }}>{s.description}</p>}
                  <div className="mt-4 flex items-center justify-between gap-2">
                    {s.starting_price ? <span className="font-extrabold" style={{ color: accent }}>{s.starting_price}</span> : <span />}
                    <button onClick={goContact} className={`px-4 h-10 ${th.btn} text-sm`} style={{ background: accent, color: accentText }}>{ctx.cta}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionLight>
      )}

      {(data.problem_pages || []).length > 0 && <ProblemsSection ctx={ctx} />}
      {sec.about !== false && <AboutBlock ctx={ctx} />}
      {sec.feature !== false && <FeatureBlock ctx={ctx} />}
      {sec.how !== false && (
        <SectionLight id="how" kicker="Easy peasy" title="How It Works" ctx={ctx} alt>
          <div className="grid sm:grid-cols-3 gap-8">
            {(w.how_it_works?.length ? w.how_it_works : DEFAULT_HOW).map((s, i) => (
              <div key={i} className="text-center">
                <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center wh text-3xl text-white shadow-lg" style={{ background: accent }}>{i + 1}</div>
                <h3 className="wh text-xl mt-4" style={{ color: th.ink }}>{s.title}</h3>
                <p className="mt-1.5 text-sm" style={{ color: th.muted }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </SectionLight>
      )}

      {sec.why !== false && sec.feature === false && (
        <SectionLight id="why" kicker="Why choose us" title="Neighbors love us" ctx={ctx}>
          <div className="flex flex-wrap gap-4 justify-center">
            {(w.why_us?.length ? w.why_us : DEFAULT_WHY).map((s, i) => (
              <div key={i} className={`px-6 py-5 rounded-[1.5rem] shadow-md max-w-[240px] ${i % 2 ? "rotate-2" : "-rotate-2"}`} style={{ background: pastels[i % pastels.length] }}>
                <h3 className="wh text-lg" style={{ color: th.ink }}>{s.title}</h3><p className="text-sm mt-1" style={{ color: th.muted }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </SectionLight>
      )}

      {sec.gallery !== false && data.photos.length > 0 && (
        <SectionLight id="gallery" kicker="Our work" title="Recent Projects" ctx={ctx} dark>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.photos.slice(0, 8).map((p, i) => <div key={p.id} className={`overflow-hidden ${i % 3 === 0 ? "rounded-[2rem]" : "rounded-full aspect-square"}`}><img src={photoUrl(p.id, 700)} loading="lazy" decoding="async" alt={p.label} className="w-full h-full object-cover" /></div>)}
          </div>
        </SectionLight>
      )}

      {sec.reviews !== false && <ReviewsBlock ctx={ctx} />}
      {sec.band !== false && <CtaBand ctx={ctx} />}
      {sec.faq !== false && <FaqBlock ctx={ctx} dark />}
      {sec.areas !== false && <AreasBlock ctx={ctx} dark />}
      {sec.contact !== false && <ContactBlock ctx={ctx} />}
      <FooterBlock ctx={ctx} />
    </div>
  );
}

// ===========================================================================
// TEMPLATE 10 — LUXURY ELEGANT
// ===========================================================================
function Luxe({ ctx }) {
  const { w, b, data, sec, accent, th, poolAt, services, goContact, heroImg, aboutImgs } = ctx;
  const gold = accent || "#C9A227";
  const roman = ["I", "II", "III", "IV", "V"];
  return (
    <div className="pb-20 md:pb-0">
      <header className="absolute top-0 inset-x-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between gap-3 text-white">
          <div className="min-w-0 flex-1"><Brand ctx={ctx} light /></div>
          <NavMenu ctx={ctx} light />
        </div>
      </header>

      <section className="relative min-h-[75svh] flex items-center">
        {heroImg && <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ transition: "transform 10s ease" }} />}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(20,20,20,.5), rgba(20,20,20,.8))" }} />
        <div className="absolute inset-6 md:inset-10 border pointer-events-none" style={{ borderColor: `${gold}55` }} />
        <div className="relative max-w-4xl mx-auto px-8 text-center text-white wfade">
          <div className="text-xs uppercase tracking-[0.35em] mb-5" style={{ color: gold }}>{b.years_in_business > 0 ? `Est. — ${b.years_in_business}+ Years of Excellence` : "Crafted to Perfection"}</div>
          <h1 className="wh text-4xl sm:text-5xl lg:text-7xl leading-[1.05] break-words">{w.headline || b.name}</h1>
          {w.subheadline && <p className="mt-6 text-lg md:text-xl font-light max-w-2xl mx-auto" style={{ color: "rgba(245,245,240,.85)" }}>{w.subheadline}</p>}
          <div className="mt-10 flex flex-wrap gap-4 justify-center">
            <button onClick={goContact} data-testid="site-hero-quote" className={`px-9 h-14 ${th.btn} border`} style={{ borderColor: gold, color: "#fff" }}>Request a Consultation</button>
          </div>
        </div>
      </section>

      <HeroFormBand ctx={ctx} />

      {sec.services !== false && (
        <section id="services" className="py-28" style={{ background: th.bg }}>
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-14"><div className="text-xs uppercase tracking-[0.3em] mb-3" style={{ color: gold }}>What we offer</div><h2 className="wh text-4xl md:text-5xl" style={{ color: th.ink }}>Services</h2></div>
            <div className="divide-y" style={{ borderColor: th.border }}>
              {services.map((s, i) => (
                <div key={i} className="group relative py-8 overflow-hidden" data-testid={`site-service-${i}`} style={{ borderColor: th.border }}>
                  {s.img && <img src={s.img} alt="" className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-20 transition-opacity duration-700" />}
                  <div className="relative flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="wh text-3xl" style={{ color: th.ink }}>{s.name}</h3>
                    {s.starting_price && <span className="text-sm tracking-widest" style={{ color: gold }}>{s.starting_price}</span>}
                  </div>
                  {s.description && <p className="relative mt-2 max-w-2xl font-light" style={{ color: th.muted }}>{s.description}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {(data.problem_pages || []).length > 0 && <ProblemsSection ctx={ctx} />}
      {sec.about !== false && <AboutBlock ctx={ctx} light />}
      {sec.feature !== false && <FeatureBlock ctx={ctx} />}
      {sec.how !== false && (
        <section id="how" className="py-28" style={{ background: th.surface }}>
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-14"><div className="text-xs uppercase tracking-[0.3em] mb-3" style={{ color: gold }}>The experience</div><h2 className="wh text-4xl md:text-5xl" style={{ color: th.ink }}>How It Works</h2></div>
            <div className="space-y-10">
              {(w.how_it_works?.length ? w.how_it_works : DEFAULT_HOW).map((s, i) => (
                <div key={i} className="flex gap-8 items-start border-l pl-8" style={{ borderColor: `${gold}55` }}>
                  <div className="wh text-4xl flex-none w-12" style={{ color: gold }}>{roman[i]}</div>
                  <div><h3 className="wh text-2xl" style={{ color: th.ink }}>{s.title}</h3><p className="mt-1 font-light" style={{ color: th.muted }}>{s.desc}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {sec.why !== false && sec.feature === false && (
        <section id="why" className="py-28" style={{ background: th.bg }}>
          <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] mb-3" style={{ color: gold }}>Distinction</div>
              <h2 className="wh text-4xl md:text-5xl mb-6" style={{ color: th.ink }}>Why Choose Us</h2>
              <div className="space-y-5">
                {(w.why_us?.length ? w.why_us : DEFAULT_WHY).map((s, i) => (
                  <div key={i} className="border-b pb-4" style={{ borderColor: th.border }}><h3 className="wh text-xl" style={{ color: th.ink }}>{s.title}</h3><p className="mt-1 font-light" style={{ color: th.muted }}>{s.desc}</p></div>
                ))}
              </div>
            </div>
            {aboutImgs.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              {aboutImgs.slice(0, 2).map((src, i) => (
                <img key={i} src={src} alt="" className={`w-full aspect-[3/4] object-cover ${i === 0 ? "mt-8" : ""}`} />
              ))}
            </div>
            )}
          </div>
        </section>
      )}

      {sec.gallery !== false && data.photos.length > 0 && (
        <SectionLight id="gallery" kicker="Portfolio" title="Recent Work" ctx={ctx} light>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.photos.slice(0, 8).map((p) => <div key={p.id} className="overflow-hidden rounded-xl aspect-square"><img src={photoUrl(p.id, 700)} loading="lazy" decoding="async" alt={p.label} className="w-full h-full object-cover hover:scale-105 transition" /></div>)}
          </div>
        </SectionLight>
      )}

      {sec.reviews !== false && <ReviewsBlock ctx={ctx} dark />}
      {sec.band !== false && <CtaBand ctx={ctx} />}
      {sec.faq !== false && <FaqBlock ctx={ctx} light />}
      {sec.areas !== false && <AreasBlock ctx={ctx} />}
      {sec.contact !== false && <ContactBlock ctx={ctx} />}
      <FooterBlock ctx={ctx} />
    </div>
  );
}

// ===========================================================================
// Shared blocks
// ===========================================================================
function Brand({ ctx, light, center }) {
  const { b, th, accent, accentText } = ctx;
  const logo = photoUrl(b.logo_photo_id);
  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${center ? "justify-center" : ""}`}>
      {logo ? <img src={logo} alt="logo" className="w-9 h-9 rounded-lg object-cover flex-none" />
        : <div className="w-9 h-9 rounded-lg flex-none flex items-center justify-center font-bold" style={{ background: accent, color: accentText }}>{(b.name || "?")[0]}</div>}
      <span className="wh font-bold text-base sm:text-lg truncate" style={{ color: light ? "#fff" : th.ink }}>{b.name}</span>
    </div>
  );
}

function HeroBadges({ ctx, solid }) {
  const { b, accent } = ctx;
  const items = [b.is_licensed && "Licensed", b.is_insured && "Insured", b.years_in_business > 0 && `${b.years_in_business}+ Years`, "5-Star Rated"].filter(Boolean);
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((x, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
          style={solid ? { background: `${accent}1a`, color: accent } : { background: "rgba(255,255,255,.16)", color: "#fff", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,.2)" }}>
          {i === items.length - 1 ? <Star className="w-3.5 h-3.5" style={{ fill: "#F5B301", color: "#F5B301" }} /> : <ShieldCheck className="w-3.5 h-3.5" />} {x}
        </span>
      ))}
    </div>
  );
}

function Kicker({ ctx, children }) { return <div className="text-xs font-bold uppercase tracking-[0.2em] mb-2" style={{ color: ctx.accent }}>{children}</div>; }

// Shared: About Us — photo collage + story + trust badges + CTA
function AboutBlock({ ctx, bg, light }) {
  const { w, b, th, accent, accentText, aboutImgs, goContact } = ctx;
  if (!w.about) return null;
  const S = light ? SectionLight : (th.dark ? SectionDark : SectionLight);
  const paras = String(w.about).split(/\n{1,}/).map((p) => p.trim()).filter(Boolean).slice(0, 4);
  const badges = [b.is_licensed && "Licensed", b.is_insured && "Insured", b.years_in_business > 0 && `${b.years_in_business}+ Years`, "Locally Owned"].filter(Boolean);
  const bodyColor = light ? "#4B5563" : th.muted;
  const badgeText = light ? "#141414" : th.ink;
  return (
    <S id="about" kicker="About" title="About Us" ctx={ctx} bg={bg} alt={!bg && !light} light={light}>
      <div className={`grid ${aboutImgs.length ? "md:grid-cols-2" : "grid-cols-1"} gap-8 md:gap-14 items-center`}>
        {aboutImgs.length > 0 && (
        <div className={aboutImgs.length === 1 ? "" : "grid grid-cols-2 gap-4"} data-testid="site-about-collage">
          {aboutImgs.map((src, i) => (
            <img key={i} src={src} alt="" loading="lazy" decoding="async" className={aboutImgs.length === 1
              ? `w-full h-auto max-h-[620px] object-contain ${th.radius} shadow-md`
              : `w-full object-cover ${th.radius} shadow-md aspect-[4/5] ${i % 2 ? "mt-6" : ""}`} />
          ))}
        </div>
        )}
        <div>
          {paras.map((p, i) => (
            <p key={i} className={`text-lg leading-relaxed ${i ? "mt-4" : ""}`} style={{ color: bodyColor }}>{p}</p>
          ))}
          {badges.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {badges.map((x, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-full" style={{ background: `${accent}14`, color: badgeText, border: `1px solid ${accent}33` }}><CheckCircle2 className="w-4 h-4" style={{ color: accent }} /> {x}</span>
              ))}
            </div>
          )}
          <a href={b.phone ? `tel:${b.phone}` : "#contact"} onClick={(e) => { if (!b.phone) { e.preventDefault(); goContact(); } }} data-testid="site-about-cta" className={`mt-8 px-7 h-14 ${th.btn} inline-flex items-center gap-2 hover:-translate-y-0.5`} style={{ background: accent, color: accentText }}>
            {b.phone ? <><Phone className="w-4 h-4" /> Call us at {b.phone}</> : <>{ctx.cta} <ArrowRight className="w-4 h-4" /></>}
          </a>
        </div>
      </div>
    </S>
  );
}

// Shared: image-beside-text highlight (checklist + CTA), opt-in via why photo
function FeatureBlock({ ctx }) {
  const { w, th, accent, accentText, whyImg, goContact } = ctx;
  const S = th.dark ? SectionDark : SectionLight;
  const points = (w.why_us?.length ? w.why_us : DEFAULT_WHY).slice(0, 4);
  return (
    <S id="feature" kicker="Why choose us" title="Service you can trust" ctx={ctx}>
      <div className={`grid ${whyImg ? "md:grid-cols-2" : "grid-cols-1"} gap-8 md:gap-14 items-center`}>
        <div>
          {w.subheadline && <p className="text-lg leading-relaxed" style={{ color: th.muted }}>{w.subheadline}</p>}
          <ul className="mt-6 space-y-3.5">
            {points.map((p, i) => (
              <li key={i} className="flex items-start gap-3" data-testid={`site-feature-point-${i}`}>
                <CheckCircle2 className="w-5 h-5 flex-none mt-0.5" style={{ color: accent }} />
                <span><span className="font-semibold" style={{ color: th.ink }}>{p.title}</span>{p.desc ? <span className="text-sm" style={{ color: th.muted }}> — {p.desc}</span> : null}</span>
              </li>
            ))}
          </ul>
          <button onClick={goContact} data-testid="site-feature-cta" className={`mt-8 px-7 h-14 ${th.btn} inline-flex items-center gap-2 hover:-translate-y-0.5`} style={{ background: accent, color: accentText }}>Get Started Today <ArrowRight className="w-4 h-4" /></button>
        </div>
        {whyImg && (
        <div className="order-first md:order-last">
          <img src={whyImg} alt="" loading="lazy" decoding="async" className={`w-full aspect-[4/3] object-cover ${th.radius} shadow-2xl`} />
        </div>
        )}
      </div>
    </S>
  );
}

// Shared: full-bleed CTA band with background image, opt-in via band photo
function CtaBand({ ctx }) {
  const { b, th, accent, accentText, bandImg, goContact } = ctx;
  return (
    <section className="relative overflow-hidden" data-testid="site-cta-band" style={!bandImg ? { background: accent } : undefined}>
      {bandImg && <img src={bandImg} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />}
      <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(8,10,20,.86), rgba(8,10,20,.55))" }} />
      <div className="relative max-w-4xl mx-auto px-5 py-20 md:py-28 text-center text-white">
        <h2 className="wh font-extrabold text-4xl md:text-5xl leading-tight">Ready when you are</h2>
        <p className="mt-3 text-lg md:text-xl text-white/80">We're just one call away.</p>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          {b.phone
            ? <a href={`tel:${b.phone}`} data-testid="site-band-call" className={`px-8 h-14 ${th.btn} inline-flex items-center gap-2 font-bold hover:-translate-y-0.5`} style={{ background: accent, color: accentText }}><Phone className="w-5 h-5" /> Call Now — {b.phone}</a>
            : <button onClick={goContact} data-testid="site-band-quote" className={`px-8 h-14 ${th.btn} inline-flex items-center gap-2 font-bold hover:-translate-y-0.5`} style={{ background: accent, color: accentText }}>{ctx.cta} <ArrowRight className="w-4 h-4" /></button>}
        </div>
      </div>
    </section>
  );
}

function SectionLight({ id, kicker, title, ctx, alt, bg, onDark, dark, light, children }) {
  const { th } = ctx;
  const r = useReveal();
  const background = bg || (light ? "#F4F3EF" : (dark ? th.ink : (alt ? th.surface : undefined)));
  const titleColor = light ? "#141414" : ((onDark || dark) ? "#FFFFFF" : th.ink);
  return (
    <section id={id} className="py-16 md:py-24" style={background ? { background } : undefined}>
      <div ref={r} className="max-w-6xl mx-auto px-5 wreveal">
        <Kicker ctx={ctx}>{kicker}</Kicker>
        <h2 className="wh text-3xl md:text-4xl font-extrabold mb-8" style={{ color: titleColor }}>{title}</h2>
        {children}
      </div>
    </section>
  );
}
function SectionDark({ id, kicker, title, ctx, alt, children }) {
  const { th } = ctx;
  const r = useReveal();
  return (
    <section id={id} className="py-20 md:py-28" style={{ background: alt ? th.surface : th.bg }}>
      <div ref={r} className="max-w-6xl mx-auto px-5 wreveal">
        <Kicker ctx={ctx}>{kicker}</Kicker>
        <h2 className="wh text-3xl md:text-5xl font-extrabold mb-10" style={{ color: th.ink }}>{title}</h2>
        {children}
      </div>
    </section>
  );
}

function ReviewsBlock({ ctx, dark, editorial }) {
  const { data, th, accent, accentText, b } = ctx;
  const S = dark ? SectionDark : SectionLight;
  return (
    <S id="reviews" kicker="Real reviews" title="What Our Customers Say" ctx={ctx} alt={!dark}>
      {data.reviews.length > 0 ? (
        editorial ? (
          <div className="space-y-10 max-w-3xl">
            {data.reviews.slice(0, 4).map((r, i) => (
              <div key={i}>
                <Stars n={r.rating} />
                <p className="italic text-lg leading-relaxed mt-3" style={{ color: th.ink }}>"{r.text}"</p>
                <div className="mt-3 font-bold" style={{ color: th.ink }}>— {r.customer_name}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {data.reviews.slice(0, 6).map((r, i) => (
              <div key={i} className={`p-6 ${th.radius} relative`} style={{ background: dark ? th.bg : th.bg, border: `1px solid ${th.border}` }}>
                <Quote className="absolute top-5 right-5 w-8 h-8" style={{ color: `${accent}2e` }} />
                <Stars n={r.rating} />
                <p className="mt-3 text-sm leading-relaxed" style={{ color: th.ink }}>"{r.text}"</p>
                <div className="mt-4 text-sm font-bold" style={{ color: th.ink }}>{r.customer_name}</div>
                <div className="text-xs" style={{ color: th.muted }}>Verified via Google</div>
              </div>
            ))}
          </div>
        )
      ) : <p style={{ color: th.muted }}>Great reviews coming soon.</p>}
      {b.google_review_url && <div className="mt-8"><a href={b.google_review_url} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 px-6 h-12 ${th.btn}`} style={{ background: accent, color: accentText }}><Star className="w-4 h-4" /> Leave us a review</a></div>}
    </S>
  );
}

function FaqBlock({ ctx, dark, light }) {
  const { w, th, accent } = ctx;
  return (
    <SectionLight id="faq" kicker="Good to know" title="Frequently Asked Questions" ctx={ctx} dark={dark} light={light}>
      <div className="max-w-3xl space-y-3">
        {(w.faqs?.length ? w.faqs : DEFAULT_FAQ).map((f, i) => <FaqItem key={i} q={f.q} a={f.a} th={th} accent={accent} light={light} />)}
      </div>
    </SectionLight>
  );
}
function FaqItem({ q, a, th, accent, light }) {
  const [open, setOpen] = useState(false);
  const cardBg = light ? "#FFFFFF" : th.surface;
  const cardBorder = light ? "#E5E7EB" : th.border;
  const qColor = light ? "#141414" : th.ink;
  const aColor = light ? "#4B5563" : th.muted;
  return (
    <div className={`overflow-hidden ${th.radius}`} style={{ background: cardBg, border: `1px solid ${cardBorder}` }} data-testid="site-faq-item">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 p-5 text-left">
        <span className="font-bold text-base" style={{ color: qColor }}>{q}</span>
        <span className="flex-none w-7 h-7 rounded-full flex items-center justify-center font-bold transition-transform" style={{ background: accent, color: isLight(accent) ? "#0A0A0A" : "#fff", transform: open ? "rotate(45deg)" : "none" }}>+</span>
      </button>
      {open && <div className="px-5 pb-5 -mt-1 text-sm leading-relaxed" style={{ color: aColor }}>{a}</div>}
    </div>
  );
}

function AreasBlock({ ctx, bg, dark }) {
  const { w, data, th, accent } = ctx;
  if (!(w.areas?.length || data.service_area)) return null;
  const areas = w.areas?.length ? w.areas : (data.service_area ? [data.service_area] : []);
  const pillText = dark ? "#FFFFFF" : th.ink;
  const pillBg = dark ? "rgba(255,255,255,0.06)" : `${accent}14`;
  const bodyColor = dark ? "rgba(255,255,255,0.7)" : th.muted;
  return (
    <SectionLight id="areas" kicker="Local & nearby" title="Areas We Serve" ctx={ctx} bg={bg} dark={dark} alt={!bg && !dark}>
      {data.service_area && <p className="mb-6" style={{ color: bodyColor }}>Proudly serving {data.service_area} and surrounding communities.</p>}
      <div className="flex flex-wrap gap-2.5">
        {areas.map((a, i) => <span key={i} className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold ${th.radius}`} style={{ background: pillBg, color: pillText, border: `1px solid ${accent}55` }}><MapPin className="w-4 h-4" style={{ color: accent }} /> {a}</span>)}
      </div>
    </SectionLight>
  );
}

// ---- SHARED, THEME-AWARE, TOGGLEABLE SECTIONS ------------------------------
// These three sections (Samples / Client logos / Client map) read their content
// from the website record and adapt to the active template's theme, so they can
// be reused across templates — not just Agency.
const AGENCY_MAP_BG = "https://static.prod-images.emergentagent.com/jobs/64839280-8aef-47d9-a8ba-849b3a374595/images/0442e9106c53a96e2ee8f6221eed60095621df3b34fc90cd3d75120c21ae53e4.jpeg";
// Equirectangular projection over a North-America bounding box (lng −125..−78, lat 14..50).
const _mapXY = (lat, lng) => ({
  x: Math.max(2, Math.min(98, ((lng - (-125)) / 47) * 100)),
  y: Math.max(4, Math.min(96, ((50 - lat) / 36) * 100)),
});
const agT = (lang, en, es) => (lang === "es" ? es : en);
// Normalize a Google My Maps value (embed URL, viewer/edit URL, or a pasted
// <iframe>) into a clean embeddable src.
const mapEmbedSrc = (v) => {
  if (!v || typeof v !== "string") return null;
  const iframe = v.match(/src="([^"]+)"/);
  if (iframe) v = iframe[1];
  const mid = v.match(/[?&]mid=([^&"'\s]+)/);
  if (mid) return `https://www.google.com/maps/d/embed?mid=${mid[1]}`;
  if (/^https?:\/\//.test(v) && v.includes("google.com/maps")) return v;
  return null;
};
// A sample/logo image value may be an absolute URL (imported from another site)
// or one of the owner's uploaded photo ids.
const imgSrc = (v, w) => (!v ? null : (/^https?:\/\//.test(v) ? v : photoUrl(v, w)));

// URL-safe slug for a service. Mirrors the backend _slugify (used in sitemap.xml)
// so the link generated here and the sitemap entry always resolve to the same page.
const slugify = (t) => ((t || "").toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""));
const svcSlug = (s, i) => ((s && s.slug) ? s.slug : (slugify(s && s.name) || `servicio-${i}`));
// Match a service to an existing Problem/Solution conversion page by name.
const ppForService = (data, name, i) => {
  const norm = (x) => (x || "").toLowerCase().trim();
  const pages = data?.problem_pages || [];
  const enName = (typeof i === "number" && data?.services?.[i]?.name) || "";
  return pages.find((p) => norm(p.service_name) === norm(name) || (enName && norm(p.service_name) === norm(enName)));
};

// ---- Rich text (WYSIWYG HTML) rendering ----
const isHtml = (t) => /<\/?(p|div|span|b|strong|i|em|u|a|ul|ol|li|br|h[1-6]|font)\b/i.test(t || "");
const stripHtml = (t) => String(t || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/\s+/g, " ").trim();
const sanitizeHtml = (html) => String(html || "")
  .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
  .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?>/gi, "")
  .replace(/ on\w+\s*=\s*"[^"]*"/gi, "")
  .replace(/ on\w+\s*=\s*'[^']*'/gi, "")
  .replace(/\s(href|src)\s*=\s*"(\s*javascript:[^"]*)"/gi, "")
  .replace(/javascript:/gi, "");
function RichHTML({ html, th, className = "" }) {
  return <div className={`rte-content ${className}`} style={{ color: th?.muted }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
}
// Renders a field that may contain WYSIWYG HTML or plain text.
function Prose({ text, th, className = "" }) {
  const t = (text || "").trim();
  if (!t) return null;
  if (isHtml(t)) return <RichHTML html={t} th={th} className={className} />;
  return <p className={`leading-relaxed whitespace-pre-line ${className}`} style={{ color: th?.muted }}>{t}</p>;
}

// Resolve a section's colors: either from a per-section override {bg} or the template theme.
const secTheme = (th, sty) => {
  if (sty && sty.bg) {
    const light = isLight(sty.bg);
    return { dark: !light, bg: sty.bg, ink: light ? "#0f172a" : "#ffffff", muted: light ? "#64748b" : "rgba(255,255,255,.72)", border: light ? "rgba(0,0,0,.08)" : "rgba(255,255,255,.14)", surface: light ? "#ffffff" : "rgba(255,255,255,.06)" };
  }
  return { dark: th.dark, bg: th.dark ? "rgba(255,255,255,.02)" : th.surface, ink: th.ink, muted: th.muted, border: th.border, surface: th.surface };
};

function LogosStrip({ ctx, sty }) {
  const logos = (Array.isArray(ctx.w.client_logos) ? ctx.w.client_logos : []).filter(Boolean);
  if (!logos.length) return null;
  const { lang } = ctx;
  const T = secTheme(ctx.th, sty);
  const row = [...logos, ...logos];
  return (
    <section className="py-10 md:py-14 border-y overflow-hidden" style={{ borderColor: T.border, background: T.bg }} data-testid="site-logos">
      <p className="text-center text-xs font-bold uppercase tracking-[0.2em] mb-6" style={{ color: T.muted }}>{agT(lang, "Trusted by 150+ businesses", "Más de 150 negocios confían en nosotros")}</p>
      <div className="relative">
        <div className="wmarq gap-8 md:gap-12 items-center px-6">
          {row.map((l, i) => (
            <div key={i} className="flex-none h-28 md:h-32 px-8 rounded-2xl bg-white flex items-center shadow-sm">
              <img src={imgSrc(l, 520)} alt="" className="h-20 md:h-24 w-auto max-w-[300px] object-contain" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SamplesSection({ ctx, sty }) {
  const r = useReveal();
  const items = (Array.isArray(ctx.w.samples) ? ctx.w.samples : []).filter((s) => s && (s.img || s.title));
  const { accent, lang } = ctx;
  const T = secTheme(ctx.th, sty);
  if (!items.length) return null;
  return (
    <section id="samples" className="py-16 md:py-24" style={{ background: T.bg }} data-testid="site-samples">
      <div ref={r} className="max-w-6xl mx-auto px-5 wreveal">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-2" style={{ color: accent }}>{agT(lang, "Client showcase", "Casos reales")}</p>
          <h2 className="wh text-3xl md:text-4xl" style={{ color: T.ink }}>{agT(lang, "Results that speak for themselves", "Resultados que hablan por sí mismos")}</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((s, i) => {
            const inner = (
              <div className="relative aspect-[4/3] overflow-hidden">
                {imgSrc(s.img, 800) && <img src={imgSrc(s.img, 800)} alt={s.title || ""} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />}
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top,rgba(0,0,0,.78),transparent 62%)" }} />
                <div className="absolute bottom-0 inset-x-0 p-5">
                  {s.title && <h3 className="text-white font-bold text-lg leading-tight">{s.title}</h3>}
                  {s.subtitle && <p className="text-white/75 text-sm mt-0.5">{s.subtitle}</p>}
                </div>
              </div>
            );
            const cls = "group block rounded-2xl overflow-hidden border transition-all hover:-translate-y-1 hover:shadow-xl";
            const stl = { borderColor: T.border, background: T.surface };
            const internal = s.caseSlug && ctx.pageHref;
            const href = internal ? ctx.pageHref(`caso/${s.caseSlug}`) : s.link;
            if (!href) return <div key={i} data-testid={`site-sample-${i}`} className={cls} style={stl}>{inner}</div>;
            return <a key={i} href={href} {...(internal ? {} : { target: "_blank", rel: "noreferrer" })} data-testid={`site-sample-${i}`} className={cls} style={stl}>{inner}</a>;
          })}
        </div>
      </div>
    </section>
  );
}

function ClientMap({ ctx, sty }) {
  const embed = mapEmbedSrc(ctx.w.map_embed);
  const pins = (Array.isArray(ctx.w.client_pins) ? ctx.w.client_pins : []).filter((p) => p && p.lat != null && p.lng != null && p.lat !== "" && p.lng !== "");
  if (!embed && !pins.length) return null;
  const { accent, lang } = ctx;
  const T = secTheme(ctx.th, sty);
  return (
    <section id="map" className="py-16 md:py-24" style={{ background: T.bg }} data-testid="site-map">
      <div className="max-w-5xl mx-auto px-5 text-center mb-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] mb-2" style={{ color: accent }}>{agT(lang, "Where we work", "Dónde trabajamos")}</p>
        <h2 className="wh text-3xl md:text-4xl" style={{ color: T.ink }}>{agT(lang, "Clients across North America", "Clientes en toda Norteamérica")}</h2>
        <p className="mt-3" style={{ color: T.muted }}>{agT(lang, "Thank you for trusting us!", "¡Gracias por confiar en nosotros!")}</p>
      </div>
      {embed ? (
        <div className="w-full" data-testid="site-map-embed">
          <iframe title="client-map" src={embed} className="w-full block" style={{ height: "600px", border: 0 }} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
        </div>
      ) : (
        <div className="max-w-5xl mx-auto px-5">
          <div className="relative w-full rounded-3xl overflow-hidden border" style={{ borderColor: T.border, background: "#0a1130" }}>
            <img src={AGENCY_MAP_BG} alt="" className="w-full h-auto block opacity-90" />
            {pins.map((p, i) => {
              const { x, y } = _mapXY(Number(p.lat), Number(p.lng));
              return (
                <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2 group" style={{ left: `${x}%`, top: `${y}%` }} data-testid={`site-pin-${i}`}>
                  <span className="relative flex w-3 h-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: accent }} />
                    <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: accent, boxShadow: `0 0 10px ${accent}` }} />
                  </span>
                  {p.label && <span className="absolute left-1/2 -translate-x-1/2 top-5 whitespace-nowrap text-[11px] font-bold px-2 py-0.5 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity">{p.label}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

// Renders the shared toggleable sections for NON-agency templates (Agency lays
// them out inline in its own order).
function SharedExtras({ ctx }) {
  const sec = ctx.sec || {};
  return (
    <>
      {sec.samples !== false && <SamplesSection ctx={ctx} />}
      {sec.logos !== false && <LogosStrip ctx={ctx} />}
      {sec.map !== false && <ClientMap ctx={ctx} />}
      <PageLinks ctx={ctx} />
    </>
  );
}

// ---- MULTI-PAGE: Case Studies / Solutions / About (all templates) ----------
function RichText({ text, th }) {
  if (isHtml(text)) return <RichHTML html={text} th={th} />;
  const blocks = (text || "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const isBullet = (l) => /^\s*([-*•✅✔️➤])\s+/.test(l);
  const renderBody = (body, key) => {
    const lines = body.split(/\n/).filter((l) => l.trim());
    if (lines.length && lines.every(isBullet)) {
      return (
        <ul key={key} className="space-y-2">
          {lines.map((l, j) => (
            <li key={j} className="flex gap-2.5 leading-relaxed" style={{ color: th.muted }}>
              <span className="mt-1 flex-none" style={{ color: th.ink === "#ffffff" ? "#22c55e" : "#16a34a" }}>•</span>
              <span>{l.replace(/^\s*([-*•✅✔️➤])\s+/, "")}</span>
            </li>
          ))}
        </ul>
      );
    }
    return <p key={key} className="leading-relaxed whitespace-pre-line" style={{ color: th.muted }}>{body}</p>;
  };
  return (
    <div className="space-y-4">
      {blocks.map((t, i) => {
        if (t.startsWith("### ") || t.startsWith("## ")) {
          const nl = t.indexOf("\n");
          const headLine = nl === -1 ? t : t.slice(0, nl);
          const rest = nl === -1 ? "" : t.slice(nl + 1).trim();
          const h3 = headLine.startsWith("### ");
          const htxt = headLine.replace(/^#{2,3}\s+/, "");
          return (
            <div key={i} className="space-y-3">
              {h3 ? <h3 className="wh text-xl md:text-2xl font-bold" style={{ color: th.ink }}>{htxt}</h3> : <h2 className="wh text-2xl md:text-3xl font-bold" style={{ color: th.ink }}>{htxt}</h2>}
              {rest && renderBody(rest, `${i}-r`)}
            </div>
          );
        }
        return renderBody(t, i);
      })}
    </div>
  );
}

function PageLinks({ ctx }) {
  const { th, accent, lang, w, pageHref } = ctx;
  const items = [
    (w.solutions_intro || (ctx.services && ctx.services.length > 2)) && [pageHref("soluciones"), agT(lang, "Solutions", "Soluciones")],
    (Array.isArray(w.case_studies) && w.case_studies.length) && [pageHref("casos"), agT(lang, "Case studies", "Casos de éxito")],
    (w.about_story || "").trim() && [pageHref("nosotros"), agT(lang, "About us", "Nosotros")],
  ].filter(Boolean);
  if (!items.length) return null;
  return (
    <section className="py-8 border-t" style={{ borderColor: th.border }} data-testid="site-page-links">
      <div className="max-w-6xl mx-auto px-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-semibold">
        {items.map(([href, label], i) => <a key={i} href={href} className="inline-flex items-center gap-1.5 hover:opacity-80" style={{ color: th.ink }}><ArrowRight className="w-4 h-4" style={{ color: accent }} />{label}</a>)}
      </div>
    </section>
  );
}

function SubNav({ ctx, active }) {
  const { th, accent, accentText, b, w, lang, pageHref, homeHref } = ctx;
  const links = [
    [homeHref, agT(lang, "Home", "Inicio"), "home"],
    (ctx.services && ctx.services.length) && [pageHref("soluciones"), agT(lang, "Solutions", "Soluciones"), "soluciones"],
    (Array.isArray(w.case_studies) && w.case_studies.length) && [pageHref("casos"), agT(lang, "Case studies", "Casos"), "casos"],
    (w.about_story || "").trim() && [pageHref("nosotros"), agT(lang, "About", "Nosotros"), "nosotros"],
  ].filter(Boolean);
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl border-b" style={{ background: th.dark ? "rgba(10,10,15,.85)" : `${th.surface}f2`, borderColor: th.border }}>
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
        <a href={homeHref} className="wh text-lg font-black truncate" style={{ color: th.ink }} data-testid="subnav-brand">{b?.name || w.headline}</a>
        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold">
          {links.map(([href, label, k], i) => <a key={i} href={href} data-testid={`subnav-${k}`} className="transition-colors hover:opacity-80" style={{ color: active === k ? accent : th.muted }}>{label}</a>)}
        </nav>
        <a href={`${homeHref}#contact`} className="inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-full" style={{ background: accent, color: accentText }}>{ctx.ctaShort}<ArrowRight className="w-4 h-4" /></a>
      </div>
    </header>
  );
}

function SubFooter({ ctx }) {
  const { th, w, b, lang, pageHref, homeHref } = ctx;
  const phone = w.cta_phone || b?.phone;
  return (
    <footer className="border-t py-10" style={{ borderColor: th.border }}>
      <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm" style={{ color: th.muted }}>
        <span className="wh font-black" style={{ color: th.ink }}>© {new Date().getFullYear()} {b?.name || w.headline}</span>
        <div className="flex items-center gap-5">
          <a href={homeHref} className="hover:opacity-80">{agT(lang, "Home", "Inicio")}</a>
          {Array.isArray(w.case_studies) && w.case_studies.length > 0 && <a href={pageHref("casos")} className="hover:opacity-80">{agT(lang, "Cases", "Casos")}</a>}
          {(w.about_story || "").trim() && <a href={pageHref("nosotros")} className="hover:opacity-80">{agT(lang, "About", "Nosotros")}</a>}
          {phone && <a href={`tel:${phone}`} className="hover:opacity-80">{phone}</a>}
        </div>
      </div>
    </footer>
  );
}

function SubHero({ ctx, kicker, title, sub }) {
  const { th, accent } = ctx;
  return (
    <section className="border-b" style={{ borderColor: th.border, background: th.dark ? "rgba(255,255,255,.02)" : th.surface }}>
      <div className="max-w-5xl mx-auto px-5 py-16 md:py-20 text-center">
        {kicker && <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: accent }}>{kicker}</p>}
        <h1 className="wh text-4xl md:text-5xl" style={{ color: th.ink }}>{title}</h1>
        {sub && <p className="mt-4 max-w-2xl mx-auto leading-relaxed" style={{ color: th.muted }}>{sub}</p>}
      </div>
    </section>
  );
}

function CaseCTA({ ctx }) {
  const { th, lang } = ctx;
  return (
    <section id="contact" className="py-16 md:py-20 border-t" style={{ borderColor: th.border, background: th.dark ? "rgba(255,255,255,.02)" : th.surface }} data-testid="case-cta">
      <div className="max-w-2xl mx-auto px-5 text-center">
        <h2 className="wh text-3xl md:text-4xl" style={{ color: th.ink }}>{agT(lang, "Ready to be our next success story?", "¿Listo para ser nuestro próximo caso de éxito?")}</h2>
        <p className="mt-3" style={{ color: th.muted }}>{agT(lang, "Tell us about your project and we'll get back to you shortly.", "Cuéntanos sobre tu proyecto y te contactaremos muy pronto.")}</p>
      </div>
      <div className="max-w-xl mx-auto px-5 mt-8">
        <LeadForm ctx={ctx} />
      </div>
    </section>
  );
}

function CaseList({ ctx }) {
  const { th, accent, accentText, lang, pageHref, w } = ctx;
  const cases = Array.isArray(w.case_studies) ? w.case_studies : [];
  return (
    <>
      <SubHero ctx={ctx} kicker={agT(lang, "Case studies", "Casos de éxito")} title={agT(lang, "Results that speak for themselves", "Resultados que hablan por sí mismos")} sub={agT(lang, "Explore how we've helped businesses like yours grow.", "Descubre cómo hemos ayudado a negocios como el tuyo a crecer.")} />
      <section className="max-w-6xl mx-auto px-5 py-16" data-testid="case-list">
        {cases.length === 0 ? <p className="text-center" style={{ color: th.muted }}>{agT(lang, "No case studies yet.", "Aún no hay casos.")}</p> : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {cases.map((c, i) => (
              <a key={i} href={pageHref(`caso/${c.slug || i}`)} data-testid={`case-card-${i}`} className="group rounded-2xl overflow-hidden border transition-all hover:-translate-y-1 hover:shadow-xl" style={{ borderColor: th.border, background: th.surface }}>
                <div className="relative aspect-[4/3] overflow-hidden">
                  {imgSrc(c.cover, 800) && <img src={imgSrc(c.cover, 800)} alt={c.client || ""} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />}
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top,rgba(0,0,0,.72),transparent 60%)" }} />
                  {c.category && <span className="absolute top-3 left-3 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: accent, color: accentText }}>{c.category}</span>}
                  <div className="absolute bottom-0 inset-x-0 p-4"><h3 className="text-white font-bold text-lg">{c.client}</h3></div>
                </div>
                {c.summary && <p className="p-4 text-sm leading-relaxed line-clamp-3" style={{ color: th.muted }}>{stripHtml(c.summary)}</p>}
              </a>
            ))}
          </div>
        )}
      </section>
      <CaseCTA ctx={ctx} />
    </>
  );
}

const caseSecTheme = (bg) => {
  const light = isLight(bg);
  return { bg, dark: !light, ink: light ? "#0f172a" : "#ffffff", muted: light ? "#64748b" : "rgba(255,255,255,.75)", card: light ? "#ffffff" : "rgba(255,255,255,.06)", surface: light ? "#ffffff" : "rgba(255,255,255,.06)", cardBorder: light ? "rgba(0,0,0,.08)" : "rgba(255,255,255,.14)", border: light ? "rgba(0,0,0,.08)" : "rgba(255,255,255,.14)" };
};

function PhotoGallery({ items, th, cols = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4", square = true, testidPrefix = "gallery" }) {
  const [open, setOpen] = useState(null);
  const close = () => setOpen(null);
  const go = (d) => setOpen((i) => (i === null ? null : (i + d + items.length) % items.length));
  useEffect(() => {
    if (open === null) return;
    const onKey = (e) => { if (e.key === "Escape") close(); else if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, items.length]);
  return (
    <>
      <div className={`grid ${cols} gap-4`}>
        {items.map((p, i) => (
          <button key={i} type="button" onClick={() => setOpen(i)} className="block w-full rounded-xl overflow-hidden border group cursor-zoom-in" style={{ borderColor: th.border }} data-testid={`${testidPrefix}-${i}`}>
            <img src={p.thumb} loading="lazy" alt="" className={`w-full object-cover ${square ? "aspect-square" : "aspect-[4/3]"} transition-transform duration-500 group-hover:scale-105`} />
          </button>
        ))}
      </div>
      {open !== null && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-8 bg-black/85 backdrop-blur-sm" onClick={close} data-testid={`${testidPrefix}-lightbox`}>
          <button type="button" onClick={close} className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition" data-testid={`${testidPrefix}-close`} aria-label="Close"><X className="w-6 h-6" /></button>
          {items.length > 1 && <button type="button" onClick={(e) => { e.stopPropagation(); go(-1); }} className="absolute left-3 sm:left-6 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition" aria-label="Previous"><ChevronLeft className="w-6 h-6" /></button>}
          {items.length > 1 && <button type="button" onClick={(e) => { e.stopPropagation(); go(1); }} className="absolute right-3 sm:right-6 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition" aria-label="Next"><ChevronRight className="w-6 h-6" /></button>}
          <img src={items[open].full} alt="" className="max-w-full max-h-[86vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          {items.length > 1 && <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/80 text-sm font-medium">{open + 1} / {items.length}</div>}
        </div>
      )}
    </>
  );
}

function CaseSection({ id, kicker, title, th, accent, children }) {
  return (
    <section id={id} className="py-14 md:py-20" style={{ background: th.bg }} data-testid={id ? `case-sec-${id}` : undefined}>
      <div className="max-w-5xl mx-auto px-5">
        {kicker && <p className="text-xs font-bold uppercase tracking-[0.2em] mb-2" style={{ color: accent }}>{kicker}</p>}
        {title && <h2 className="wh text-3xl md:text-4xl mb-8" style={{ color: th.ink }}>{title}</h2>}
        {children}
      </div>
    </section>
  );
}

function CaseDetail({ ctx }) {
  const { accent, lang, w, caseSlug, pageHref } = ctx;
  const cases = Array.isArray(w.case_studies) ? w.case_studies : [];
  const want = decodeURIComponent(caseSlug || "");
  const wantS = slugify(want);
  const c = cases.find((x) => (x.slug || "") === want)
    || cases.find((x, i) => slugify(x.slug || `caso-${i}`) === wantS)
    || cases.find((x) => slugify(x.client || "") === wantS)
    || cases.find((x) => slugify(x.title || "") === wantS);
  if (!c) return <SubHero ctx={ctx} title={agT(lang, "Case not found", "Caso no encontrado")} sub={<a href={pageHref("casos")} style={{ color: accent }}>{agT(lang, "Back to cases", "Volver a casos")}</a>} />;
  const cc = w.case_colors || {};
  const CDEF = { hero: "#0a1130", info: "#f8fafc", challenge: "#ffffff", solution: "#f8fafc", tailored: "#ffffff", results: "#0a1130", portfolio: "#ffffff" };
  const CS = (k) => caseSecTheme(cc[k] || CDEF[k]);
  const tHero = CS("hero"), tInfo = CS("info"), tChal = CS("challenge"), tSol = CS("solution"), tTail = CS("tailored"), tRes = CS("results"), tPort = CS("portfolio");
  const photos = (Array.isArray(c.photos) ? c.photos : []).filter(Boolean);
  const services = Array.isArray(c.services) ? c.services : [];
  const results = Array.isArray(c.results) ? c.results.filter((r) => r && (r.value || r.label)) : [];
  const solCards = (Array.isArray(c.solution_cards) ? c.solution_cards : []).filter((x) => x && (x.title || x.desc));
  const challenge = (c.challenge || "").trim();
  const solServices = (c.solution_services || "").trim();
  const solStrategies = (c.solution_strategies || "").trim();
  const before = (c.result_before || "").trim();
  const after = (c.result_after || "").trim();
  const info = [
    c.location && ["📍", agT(lang, "Location", "Ubicación"), c.location],
    c.industry && ["🍽️", agT(lang, "Industry", "Industria"), c.industry],
    c.ideal_clients && ["📈", agT(lang, "Ideal clients", "Clientes ideales"), c.ideal_clients],
    c.website_url && ["🔗", "Website", c.website_url],
  ].filter(Boolean);
  const hasSolution = solServices || solStrategies || services.length > 0;
  const heroImg = imgSrc(c.cover, 1600);
  const heroInk = tHero.ink;
  const heroSub = tHero.muted;
  return (
    <>
      {/* HERO — split layout: image card + text on a solid background */}
      <section className="border-b" style={{ background: tHero.bg, borderColor: tHero.border }} data-testid="case-detail">
        <div className="max-w-6xl mx-auto px-5 py-12 md:py-20">
          <a href={pageHref("casos")} className="text-sm hover:opacity-80 inline-block mb-8" style={{ color: heroSub }} data-testid="case-back">← {agT(lang, "All cases", "Todos los casos")}</a>
          <div className={`grid ${heroImg ? "md:grid-cols-2" : ""} gap-8 md:gap-14 items-center`}>
            {heroImg && (
              <div className="rounded-2xl overflow-hidden shadow-2xl border" style={{ borderColor: tHero.border }}>
                <img src={heroImg} alt={c.client || ""} className="w-full h-full object-cover aspect-[4/3]" />
              </div>
            )}
            <div>
              {c.category && <p className="text-sm font-bold uppercase tracking-[0.2em] mb-3" style={{ color: accent }}>{c.category}</p>}
              <h1 className="wh text-4xl md:text-5xl lg:text-6xl leading-[1.05]" style={{ color: heroInk }}>{c.client}</h1>
              {c.summary && (isHtml(c.summary)
                ? <div className="mt-5 text-lg rte-content" style={{ color: heroSub }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(c.summary) }} />
                : <p className="mt-5 text-lg leading-relaxed" style={{ color: heroSub }}>{c.summary}</p>)}
            </div>
          </div>
        </div>
      </section>

      {/* CLIENT INFO */}
      {info.length > 0 && (
        <CaseSection id="info" title={agT(lang, "Client information", "Información del cliente")} th={tInfo} accent={accent}>
          <div className="grid sm:grid-cols-2 gap-4">
            {info.map(([icon, label, val], i) => (
              <div key={i} className="rounded-2xl border p-5 flex gap-4" style={{ borderColor: tInfo.border, background: tInfo.surface }}>
                <span className="text-2xl flex-none">{icon}</span>
                <div><div className="text-xs font-bold uppercase tracking-wider" style={{ color: accent }}>{label}</div>
                  {label === "Website" ? <a href={/^https?:\/\//.test(val) ? val : `https://${val}`} target="_blank" rel="noreferrer" className="font-semibold break-all hover:underline" style={{ color: tInfo.ink }}>{val}</a> : <div className="font-semibold mt-0.5" style={{ color: tInfo.ink }}>{val}</div>}
                </div>
              </div>
            ))}
          </div>
        </CaseSection>
      )}

      {/* EL RETO */}
      {challenge && (
        <CaseSection id="challenge" kicker={agT(lang, "Challenges faced", "Los desafíos")} title={agT(lang, "The challenge", "El reto")} th={tChal} accent={accent}>
          <RichText text={challenge} th={tChal} />
        </CaseSection>
      )}

      {/* LA SOLUCIÓN */}
      {hasSolution && (
        <CaseSection id="solution" kicker={agT(lang, "What we did", "Lo que hicimos")} title={agT(lang, "The solution", "La solución")} th={tSol} accent={accent}>
          {services.length > 0 && <div className="flex flex-wrap gap-2 mb-8">{services.map((s, i) => <span key={i} className="text-xs px-3 py-1.5 rounded-full font-semibold" style={{ background: `${accent}18`, color: accent }}>{s}</span>)}</div>}
          <div className="grid md:grid-cols-2 gap-8">
            {solServices && <div><h3 className="wh text-lg md:text-xl font-bold mb-3" style={{ color: tSol.ink }}>{agT(lang, "Services provided", "Servicios proporcionados")}</h3><RichText text={solServices} th={tSol} /></div>}
            {solStrategies && <div><h3 className="wh text-lg md:text-xl font-bold mb-3" style={{ color: tSol.ink }}>{agT(lang, "Strategies implemented", "Estrategias implementadas")}</h3><RichText text={solStrategies} th={tSol} /></div>}
          </div>
        </CaseSection>
      )}

      {/* SOLUCIONES A LA MEDIDA (3 cards) */}
      {solCards.length > 0 && (
        <CaseSection id="tailored" title={agT(lang, "Tailored solutions", "Soluciones a la medida")} th={tTail} accent={accent}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {solCards.map((card, i) => (
              <div key={i} data-testid={`case-solcard-${i}`} className="rounded-2xl border p-6" style={{ borderColor: tTail.border, background: tTail.surface }}>
                <h3 className="wh font-bold text-lg" style={{ color: tTail.ink }}>{card.title}</h3>
                {card.desc && <Prose text={card.desc} th={tTail} className="mt-2.5 text-sm" />}
              </div>
            ))}
          </div>
        </CaseSection>
      )}

      {/* RESULTADOS IMPACTANTES */}
      {(before || after || results.length > 0) && (
        <CaseSection id="results" kicker={agT(lang, "The outcome", "El resultado")} title={agT(lang, "Impactful results", "Resultados impactantes")} th={tRes} accent={accent}>
          {(before || after) && (
            <div className="grid md:grid-cols-2 gap-5 mb-10">
              {before && <div className="rounded-2xl border p-6" style={{ borderColor: "#ef444455", background: tRes.dark ? "rgba(239,68,68,.14)" : "rgba(239,68,68,.05)" }}><div className="font-bold mb-2" style={{ color: "#ef4444" }}>🔴 {agT(lang, "Before", "Antes")}</div><Prose text={before} th={tRes} className="text-sm" /></div>}
              {after && <div className="rounded-2xl border p-6" style={{ borderColor: "#22c55e55", background: tRes.dark ? "rgba(34,197,94,.14)" : "rgba(34,197,94,.05)" }}><div className="font-bold mb-2" style={{ color: "#22c55e" }}>🟢 {agT(lang, "After", "Después")}</div><Prose text={after} th={tRes} className="text-sm" /></div>}
            </div>
          )}
          {results.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-center">
              {results.map((r, i) => <div key={i} className="rounded-2xl border py-8 px-4" style={{ borderColor: tRes.border, background: tRes.surface }}><div className="wh text-4xl md:text-5xl font-black" style={{ color: accent }}>{r.value}</div><div className="text-sm mt-2" style={{ color: tRes.muted }}>{r.label}</div></div>)}
            </div>
          )}
        </CaseSection>
      )}

      {/* PORTAFOLIO VISUAL */}
      {photos.length > 0 && (
        <CaseSection id="portfolio" kicker={agT(lang, "Explore our creative showcase", "Explora nuestro trabajo")} title={agT(lang, "Captivating visual portfolio", "Portafolio visual")} th={tPort} accent={accent}>
          <PhotoGallery items={photos.map((p) => ({ thumb: imgSrc(p, 700), full: imgSrc(p, 1600) }))} th={tPort} testidPrefix="case-portfolio" />
        </CaseSection>
      )}

      <CaseCTA ctx={ctx} />
    </>
  );
}

function SolutionsPage({ ctx }) {
  const { th, accent, lang, services, w, sec } = ctx;
  return (
    <>
      <SubHero ctx={ctx} kicker={agT(lang, "Our solutions", "Nuestras soluciones")} title={agT(lang, "Marketing to grow your business", "Marketing para impulsar tu crecimiento")} sub={(w.solutions_intro || "").trim() || agT(lang, "Custom strategies that fit your budget and audience.", "Estrategias personalizadas que se ajustan a tu presupuesto y público.")} />
      <section className="max-w-6xl mx-auto px-5 py-16" data-testid="solutions-list">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((s, i) => (
            <div key={i} data-testid={`solution-${i}`} className="rounded-2xl border p-7 transition-all hover:-translate-y-1" style={{ borderColor: th.border, background: th.surface }}>
              {s.img ? <div className="w-14 h-14 rounded-xl overflow-hidden mb-5"><img src={s.img} alt="" className="w-full h-full object-contain" /></div> : <div className="w-11 h-11 rounded-xl grid place-items-center mb-5 wh font-black" style={{ background: `${accent}22`, color: accent }}>{String(i + 1).padStart(2, "0")}</div>}
              <h3 className="font-bold text-lg" style={{ color: th.ink }}>{s.name || s.title}</h3>
              {s.description && <p className="mt-2.5 text-sm leading-relaxed" style={{ color: th.muted }}>{s.description}</p>}
            </div>
          ))}
        </div>
      </section>
      {sec.map !== false && <ClientMap ctx={ctx} />}
      <CaseCTA ctx={ctx} />
    </>
  );
}

function AboutPage({ ctx }) {
  const { th, accent, lang, w, aboutImgs } = ctx;
  const milestones = Array.isArray(w.milestones) ? w.milestones : [];
  const values = Array.isArray(w.about_values) ? w.about_values : [];
  const team = Array.isArray(w.team) ? w.team : [];
  const story = (w.about_story || "").trim();
  const aboutSecs = (Array.isArray(w.about_sections) ? w.about_sections : []).filter((s) => s && ((s.body || "").trim() || (s.title || "").trim() || (s.images || []).length));
  return (
    <>
      <SubHero ctx={ctx} kicker={agT(lang, "About us", "Sobre nosotros")} title={w.about_title || agT(lang, "Our story", "Nuestra historia")} />
      {milestones.length > 0 && (
        <section className="border-b" style={{ borderColor: th.border, background: th.dark ? "rgba(255,255,255,.02)" : th.surface }} data-testid="about-milestones">
          <div className="max-w-5xl mx-auto px-5 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {milestones.map((m, i) => <div key={i} data-testid={`milestone-${i}`}><div className="wh text-3xl md:text-4xl font-black" style={{ color: accent }}>{m.value}</div><div className="text-sm mt-1" style={{ color: th.muted }}>{m.label}</div></div>)}
          </div>
        </section>
      )}
      {aboutSecs.length > 0 ? (
        aboutSecs.map((s, i) => {
          const imgs = (Array.isArray(s.images) ? s.images : []).filter(Boolean).map((id) => imgSrc(id, 1000));
          const reverse = i % 2 === 1;
          const alt = i % 2 === 1;
          return (
            <section key={i} className="py-12 md:py-16" style={alt ? { background: th.dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)" } : {}} data-testid={`about-section-${i}`}>
              <div className={`max-w-6xl mx-auto px-5 grid ${imgs.length > 0 ? (reverse ? "md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]" : "md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]") : ""} gap-8 md:gap-12 items-center`}>
                <div className={reverse && imgs.length > 0 ? "md:order-2" : ""}>
                  {s.title && <h2 className="wh text-2xl md:text-4xl mb-4" style={{ color: th.ink }}>{s.title}</h2>}
                  <RichText text={s.body} th={th} />
                </div>
                {imgs.length > 0 && (
                  <div className={`grid grid-cols-1 gap-4 ${reverse ? "md:order-1" : ""}`}>
                    {imgs.map((src, k) => <div key={k} className="rounded-2xl overflow-hidden shadow-xl border" style={{ borderColor: th.border }}><img src={src} loading="lazy" alt="" className="w-full h-auto block" /></div>)}
                  </div>
                )}
              </div>
            </section>
          );
        })
      ) : (story && (
        <section className="max-w-3xl mx-auto px-5 py-16" data-testid="about-story">
          {aboutImgs && aboutImgs.length > 0 && <img src={aboutImgs[0]} alt="" className="w-full rounded-2xl mb-8 object-cover max-h-96" />}
          <RichText text={story} th={th} />
        </section>
      ))}
      {values.length > 0 && (
        <section className="max-w-6xl mx-auto px-5 pb-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {values.map((v, i) => <div key={i} className="rounded-2xl border p-6 flex items-start gap-3" style={{ borderColor: th.border, background: th.surface }}><CheckCircle2 className="w-5 h-5 mt-0.5 flex-none" style={{ color: accent }} /><div><h3 className="font-bold" style={{ color: th.ink }}>{v.title}</h3>{v.desc && <p className="mt-1.5 text-sm leading-relaxed" style={{ color: th.muted }}>{v.desc}</p>}</div></div>)}
          </div>
        </section>
      )}
      {team.length > 0 && (
        <section className="max-w-6xl mx-auto px-5 py-16" data-testid="about-team">
          <h2 className="wh text-3xl md:text-4xl text-center mb-10" style={{ color: th.ink }}>{agT(lang, "Meet the team", "Conoce al equipo")}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {team.map((m, i) => (
              <div key={i} data-testid={`team-${i}`} className="text-center">
                <div className="w-28 h-28 mx-auto rounded-full overflow-hidden border-2" style={{ borderColor: `${accent}55` }}>{imgSrc(m.photo, 300) && <img src={imgSrc(m.photo, 300)} alt={m.name || ""} className="w-full h-full object-cover" />}</div>
                <h3 className="mt-3 font-bold" style={{ color: th.ink }}>{m.name}</h3>
                {m.role && <p className="text-sm" style={{ color: accent }}>{m.role}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
      <CaseCTA ctx={ctx} />
    </>
  );
}

function ServiceDetail({ ctx }) {
  const { th, accent, accentText, lang, services, serviceSlug, pageHref, homeHref, w, b } = ctx;
  let s = null;
  services.forEach((x, i) => { if (svcSlug(x, i) === serviceSlug) s = x; });
  if (!s) return <SubHero ctx={ctx} title={agT(lang, "Service not found", "Servicio no encontrado")} sub={<a href={pageHref("soluciones")} style={{ color: accent }}>{agT(lang, "Back to solutions", "Volver a soluciones")}</a>} />;
  const photos = (Array.isArray(s.photos) ? s.photos : []).filter((p) => p && p.id);
  const beforeP = photos.filter((p) => p.kind === "before");
  const afterP = photos.filter((p) => p.kind === "after");
  const gallery = photos.filter((p) => !["before", "after"].includes(p.kind));
  const others = services.filter((x, i) => svcSlug(x, i) !== serviceSlug).slice(0, 3);
  return (
    <>
      <section className="relative" data-testid="service-detail">
        {s.img && <div className="absolute inset-0"><img src={s.img} alt="" className="w-full h-full object-cover" /><div className="absolute inset-0" style={{ background: "linear-gradient(180deg,rgba(0,0,0,.5),rgba(0,0,0,.82))" }} /></div>}
        <div className="relative max-w-5xl mx-auto px-5 py-20 md:py-28">
          <a href={pageHref("soluciones")} className={`text-sm ${s.img ? "text-white/80 hover:text-white" : ""}`} style={s.img ? {} : { color: th.muted }} data-testid="service-back">← {agT(lang, "All services", "Todos los servicios")}</a>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: accent }}>{agT(lang, "Service", "Servicio")}</p>
          <h1 className="wh text-4xl md:text-6xl mt-2" style={{ color: s.img ? "#fff" : th.ink }}>{s.name || s.title}</h1>
          {s.starting_price && <p className="mt-4 text-lg font-semibold" style={{ color: s.img ? "rgba(255,255,255,.9)" : accent }}>{agT(lang, "From", "Desde")} {s.starting_price}</p>}
        </div>
      </section>
      <section className="max-w-3xl mx-auto px-5 py-16">
        {(s.description || "").trim() ? <RichText text={s.description} th={th} /> : <p className="leading-relaxed" style={{ color: th.muted }}>{agT(lang, "Contact us to learn more about this service.", "Contáctanos para conocer más sobre este servicio.")}</p>}
        <a href={`${homeHref}#contact`} data-testid="service-cta" className="mt-8 inline-flex items-center gap-2 font-bold px-8 py-4 rounded-full hover:-translate-y-0.5 transition-transform" style={{ background: accent, color: accentText }}>{ctx.cta}<ArrowRight className="w-5 h-5" /></a>
      </section>
      {(beforeP.length > 0 && afterP.length > 0) && (
        <section className="max-w-5xl mx-auto px-5 pb-8" data-testid="service-beforeafter">
          <h2 className="wh text-2xl md:text-3xl mb-6" style={{ color: th.ink }}>{agT(lang, "Before & after", "Antes y después")}</h2>
          <BeforeAfter before={photoUrl(beforeP[0].id, 900)} after={photoUrl(afterP[0].id, 900)} accent={accent} />
        </section>
      )}
      {gallery.length > 0 && (
        <section className="max-w-6xl mx-auto px-5 pb-16" data-testid="service-gallery">
          <h2 className="wh text-2xl md:text-3xl mb-6" style={{ color: th.ink }}>{agT(lang, "Our work", "Nuestro trabajo")}</h2>
          <PhotoGallery items={gallery.map((p) => ({ thumb: photoUrl(p.id, 800), full: photoUrl(p.id, 1600) }))} th={th} cols="grid-cols-2 sm:grid-cols-3" square={false} testidPrefix="service-gallery-img" />
        </section>
      )}
      {others.length > 0 && (
        <section className="max-w-6xl mx-auto px-5 pb-16" data-testid="service-more">
          <h2 className="wh text-2xl md:text-3xl mb-6" style={{ color: th.ink }}>{agT(lang, "Other services", "Otros servicios")}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {others.map((x) => {
              const i = services.indexOf(x);
              const pp = ppForService(ctx.data, x.name, i);
              const href = pp ? ctx.ppHref(pp.page_slug) : pageHref(`servicio/${svcSlug(x, i)}`);
              return (
                <a key={i} href={href} className="group rounded-2xl border overflow-hidden transition-all hover:-translate-y-1 flex flex-col" style={{ background: th.surface, borderColor: th.border }}>
                  {x.img && <div className="aspect-[16/10] overflow-hidden"><img src={x.img} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" /></div>}
                  <div className="p-5"><h3 className="font-bold" style={{ color: th.ink }}>{x.name}</h3><span className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: accent }}>{agT(lang, "Learn more", "Ver más")}<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" /></span></div>
                </a>
              );
            })}
          </div>
        </section>
      )}
      <CaseCTA ctx={ctx} />
    </>
  );
}

function AgencyFooter({ ctx }) {
  const { w, b, accent, lang } = ctx;
  const sc = w.section_colors || {};
  const bg = sc.footer || "#0a1130";
  const light = isLight(bg);
  const ink = light ? "#0f172a" : "#ffffff";
  const muted = light ? "#64748b" : "rgba(255,255,255,.72)";
  const cardBorder = light ? "rgba(0,0,0,.08)" : "rgba(255,255,255,.14)";
  const phone = w.cta_phone || b?.phone;
  const areas = Array.isArray(w.areas) ? w.areas : [];
  const aboutText = (w.subheadline || w.about || "").trim();
  const logo = photoUrl(b?.logo_photo_id, 220);
  const socials = [b?.facebook && [Facebook, b.facebook], b?.instagram && [Instagram, b.instagram]].filter(Boolean);
  const hours = w.hours || ctx.data?.hours || "";
  const home = ctx.homeHref;
  const sec = w.sections || {};
  const steps = Array.isArray(w.how_it_works) ? w.how_it_works : [];
  const services = ctx.services || [];
  const fnav = [
    (services.length && sec.services !== false) && [`${home}#services`, agT(lang, "Services", "Servicios")],
    (Array.isArray(w.samples) && w.samples.length && sec.samples !== false) && [`${home}#samples`, agT(lang, "Work", "Casos")],
    (Array.isArray(w.case_studies) && w.case_studies.length) && [ctx.pageHref("casos"), agT(lang, "Case studies", "Casos de éxito")],
    (steps.length && sec.how !== false) && [`${home}#how`, agT(lang, "Process", "Proceso")],
    (w.about_story || "").trim() && [ctx.pageHref("nosotros"), agT(lang, "About us", "Nosotros")],
    [`${home}#contact`, agT(lang, "Contact", "Contacto")],
  ].filter(Boolean);
  return (
    <footer className="relative overflow-hidden border-t" style={{ background: bg, color: ink, borderColor: cardBorder }} data-testid="agency-footer">
      <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ background: accent }} />
      <div className="max-w-6xl mx-auto px-5 pt-14 pb-10 relative grid md:grid-cols-3 gap-10 md:gap-12">
        <div>
          {logo ? <img src={logo} alt={b?.name || ""} className="h-16 md:h-20 w-auto object-contain" /> : <div className="wh font-black text-2xl md:text-3xl" style={{ color: ink }}>{b?.name || w.headline}</div>}
          {aboutText && <p className="mt-5 text-sm leading-relaxed max-w-sm line-clamp-3" style={{ color: muted }}>{aboutText}</p>}
          {socials.length > 0 && (
            <div className="mt-5 flex gap-3">
              {socials.map(([Icon, href], i) => (
                <a key={i} href={href} target="_blank" rel="noreferrer" data-testid={`agency-footer-social-${i}`} className="w-9 h-9 rounded-full flex items-center justify-center border transition hover:opacity-80" style={{ borderColor: cardBorder, color: muted }}><Icon className="w-4 h-4" /></a>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.25em] mb-5" style={{ color: accent }}>{agT(lang, "Contact", "Contacto")}</div>
          <ul className="space-y-3.5 text-sm" style={{ color: muted }}>
            {b?.address && <li className="flex gap-3"><MapPin className="w-4 h-4 flex-none mt-0.5" style={{ color: accent }} /><span>{b.address}</span></li>}
            {phone && <li><a href={`tel:${phone}`} data-testid="agency-footer-phone" className="flex gap-3 hover:opacity-80"><Phone className="w-4 h-4 flex-none mt-0.5" style={{ color: accent }} /><span>{phone}</span></a></li>}
            {b?.email && <li><a href={`mailto:${b.email}`} className="flex gap-3 hover:opacity-80 break-all"><Mail className="w-4 h-4 flex-none mt-0.5" style={{ color: accent }} /><span>{b.email}</span></a></li>}
            {hours && <li className="flex gap-3"><Clock className="w-4 h-4 flex-none mt-0.5" style={{ color: accent }} /><span>{hours}</span></li>}
          </ul>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.25em] mb-5" style={{ color: accent }}>{agT(lang, "Navigate", "Navegación")}</div>
          <ul className="space-y-3">
            {fnav.map(([href, label], i) => <li key={i}><a href={href} data-testid={`agency-footer-link-${i}`} className="text-sm font-semibold hover:opacity-80" style={{ color: muted }}>{label}</a></li>)}
          </ul>
        </div>
      </div>
      <div className="border-t relative" style={{ borderColor: cardBorder }}>
        <div className="max-w-6xl mx-auto px-5 py-6 flex flex-wrap justify-between items-center gap-3 text-xs" style={{ color: muted }}>
          <span>© {new Date().getFullYear()} {b?.name || w.headline}. {agT(lang, "All rights reserved.", "Todos los derechos reservados.")}</span>
          {areas.length > 0 && <span className="uppercase tracking-widest" style={{ opacity: 0.7 }}>{areas.slice(0, 3).join(" • ")}</span>}
          <span style={{ opacity: 0.7 }}>{agT(lang, "Powered by UniTech", "Hecho con UniTech")}</span>
        </div>
      </div>
    </footer>
  );
}

function SubPageRouter({ ctx }) {
  let th = ctx.th;
  if (ctx.key === "agency") {
    // Agency sub-pages (casos/soluciones/nosotros/servicio) keep a clean WHITE
    // content area — color lives only in the hero and the footer.
    th = { ...ctx.th, bg: "#ffffff", surface: "#ffffff", ink: "#0f172a", muted: "#64748b", border: "rgba(0,0,0,.08)", dark: false };
    ctx = { ...ctx, th };
  }
  const Page = { casos: CaseList, caso: CaseDetail, soluciones: SolutionsPage, nosotros: AboutPage, servicio: ServiceDetail }[ctx.page];
  return (
    <div style={{ background: th.bg, color: th.ink }} data-testid={`site-subpage-${ctx.page}`}>
      <SubNav ctx={ctx} active={ctx.page === "caso" ? "casos" : (ctx.page === "servicio" ? "soluciones" : ctx.page)} />
      {Page ? <Page ctx={ctx} /> : null}
      {ctx.key === "agency" ? <AgencyFooter ctx={ctx} /> : <SubFooter ctx={ctx} />}
    </div>
  );
}

// ---- AGENCY: premium bilingual template (exclusive) ------------------------
function Agency({ ctx }) {
  const { w, b, accent, accentText, heroImg, bandImg, services, goContact, lang, sec } = ctx;
  const steps = Array.isArray(w.how_it_works) ? w.how_it_works : [];
  const faqs = Array.isArray(w.faqs) ? w.faqs : [];
  const areas = Array.isArray(w.areas) ? w.areas : [];
  const reviews = (Array.isArray(ctx.data?.reviews) ? ctx.data.reviews : []).filter((r) => (r.text || "").trim());
  const phone = w.cta_phone || b?.phone;
  const aboutText = (w.subheadline || w.about || "").trim();
  const [scr, setScr] = useState(false);
  useEffect(() => { const f = () => setScr(window.scrollY > 30); window.addEventListener("scroll", f); return () => window.removeEventListener("scroll", f); }, []);
  const sc = w.section_colors || {};
  const DEF = { hero: "#0a1130", services: "#ffffff", samples: "#f8fafc", logos: "#ffffff", map: "#f8fafc", process: "#0a1130", reviews: "#f8fafc", cta: accent, faq: "#f8fafc", contact: "#ffffff", footer: "#0a1130" };
  const S = (k) => { const bg = sc[k] || DEF[k]; const light = isLight(bg); return { bg, dark: !light, ink: light ? "#0f172a" : "#ffffff", muted: light ? "#64748b" : "rgba(255,255,255,.72)", card: light ? "#ffffff" : "rgba(255,255,255,.05)", cardBorder: light ? "rgba(0,0,0,.08)" : "rgba(255,255,255,.12)", pill: light ? "rgba(0,0,0,.05)" : "rgba(255,255,255,.08)" }; };
  const H = S("hero"), SV = S("services"), PR = S("process"), CT = S("cta"), CO = S("contact"), RV = S("reviews"), FQ = S("faq");
  const navLinks = [
    services.length > 0 && sec.services !== false && ["#services", agT(lang, "Services", "Servicios")],
    (Array.isArray(w.samples) && w.samples.length && sec.samples !== false) && ["#samples", agT(lang, "Work", "Casos")],
    (Array.isArray(w.case_studies) && w.case_studies.length) && [ctx.pageHref("casos"), agT(lang, "Case studies", "Casos de éxito")],
    (steps.length > 0 && sec.how !== false) && ["#how", agT(lang, "Process", "Proceso")],
    (w.about_story || "").trim() && [ctx.pageHref("nosotros"), agT(lang, "About", "Nosotros")],
    ["#contact", agT(lang, "Contact", "Contacto")],
  ].filter(Boolean);
  return (
    <div style={{ background: CO.bg }}>
      {/* NAV */}
      <header className="sticky top-0 z-40 backdrop-blur-xl border-b transition-colors" style={{ background: H.dark ? (scr ? "rgba(10,10,20,.92)" : "rgba(10,10,20,.5)") : (scr ? "rgba(255,255,255,.95)" : "rgba(255,255,255,.7)"), borderColor: scr ? H.cardBorder : "transparent" }}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <span className="wh text-lg font-black truncate" style={{ color: H.ink }}>{b?.name || w.headline}</span>
          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold">
            {navLinks.map(([href, label], i) => <a key={i} href={href} className="hover:opacity-70 transition-opacity" style={{ color: H.muted }}>{label}</a>)}
          </nav>
          <div className="flex items-center gap-3">
            {phone && <a href={`tel:${phone}`} className="hidden lg:inline-flex items-center gap-1.5 text-sm hover:opacity-70" style={{ color: H.muted }}><Phone className="w-4 h-4" style={{ color: accent }} /> {phone}</a>}
            <button onClick={goContact} data-testid="agency-nav-cta" className="inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-full hover:-translate-y-0.5 transition-transform" style={{ background: accent, color: accentText }}>{ctx.ctaShort} <ArrowRight className="w-4 h-4" /></button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden" style={{ background: H.bg }}>
        {heroImg && <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url(${heroImg})`, backgroundSize: "cover", backgroundPosition: "center" }} />}
        {heroImg && <div className="absolute inset-0" style={{ background: H.dark ? "linear-gradient(180deg,rgba(0,0,0,.5),rgba(0,0,0,.75))" : "linear-gradient(180deg,rgba(255,255,255,.6),rgba(255,255,255,.85))" }} />}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl opacity-25" style={{ background: accent }} />
        <div className="relative max-w-6xl mx-auto px-5 py-20 md:py-28 grid lg:grid-cols-2 gap-12 items-center">
          <div className="wreveal wshow">
            <p className="font-semibold text-sm uppercase tracking-widest mb-4" style={{ color: accent }}>{agT(lang, "Empowering Latino businesses", "Impulsando negocios latinos")}</p>
            <h1 className="wh text-4xl sm:text-5xl lg:text-6xl leading-[1.05]" style={{ color: H.ink }}>{w.headline || b?.name}</h1>
            {aboutText && <p className="mt-6 text-base sm:text-lg max-w-xl leading-relaxed line-clamp-5" style={{ color: H.muted }}>{aboutText}</p>}
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <button onClick={goContact} data-testid="agency-hero-cta" className="inline-flex items-center gap-2 font-bold px-7 py-3.5 rounded-full hover:-translate-y-0.5 transition-transform" style={{ background: accent, color: accentText }}>{ctx.cta} <ArrowRight className="w-5 h-5" /></button>
              {phone && <a href={`tel:${phone}`} className="inline-flex items-center gap-2 border px-6 py-3.5 rounded-full font-semibold hover:opacity-80 transition-opacity" style={{ borderColor: H.cardBorder, color: H.ink }}><Phone className="w-4 h-4" style={{ color: accent }} /> {phone}</a>}
            </div>
          </div>
          <div className="w-full lg:justify-self-end max-w-md"><HeroForm ctx={ctx} dark={H.dark} /></div>
        </div>
      </section>

      {/* SERVICES */}
      {services.length > 0 && sec.services !== false && (
        <section id="services" className="py-16 md:py-24" style={{ background: SV.bg }}>
          <div className="max-w-6xl mx-auto px-5">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-2" style={{ color: accent }}>{agT(lang, "What we do", "Qué hacemos")}</p>
              <h2 className="wh text-3xl md:text-4xl" style={{ color: SV.ink }}>{w.services_title || agT(lang, "Smart tools to grow your business", "Herramientas inteligentes para crecer tu negocio")}</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {services.map((s, i) => {
                const pp = ppForService(ctx.data, s.name, i);
                const href = pp ? ctx.ppHref(pp.page_slug) : ctx.pageHref(`servicio/${svcSlug(s, i)}`);
                return (
                  <a key={i} href={href} data-testid={`agency-svc-${i}`} className="group rounded-2xl border overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg flex flex-col" style={{ background: SV.card, borderColor: SV.cardBorder }}>
                    {s.img && <div className="aspect-[16/10] overflow-hidden"><img src={s.img} alt={s.name || ""} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" /></div>}
                    <div className="p-7 flex-1 flex flex-col">
                      {!s.img && <div className="w-11 h-11 rounded-xl grid place-items-center mb-5 wh text-lg font-black" style={{ background: `${accent}22`, color: accent }}>{String(i + 1).padStart(2, "0")}</div>}
                      <h3 className="font-bold text-lg" style={{ color: SV.ink }}>{s.name || s.title}</h3>
                      {s.description && <p className="mt-2.5 text-sm leading-relaxed line-clamp-3" style={{ color: SV.muted }}>{s.description}</p>}
                      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: accent }}>{agT(lang, "Learn more", "Ver más")}<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" /></span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {sec.samples !== false && <SamplesSection ctx={ctx} sty={{ bg: sc.samples || DEF.samples }} />}
      {sec.logos !== false && <LogosStrip ctx={ctx} sty={{ bg: sc.logos || DEF.logos }} />}
      {sec.map !== false && <ClientMap ctx={ctx} sty={{ bg: sc.map || DEF.map }} />}

      {/* PROCESS */}
      {steps.length > 0 && sec.how !== false && (
        <section id="how" className="border-y py-16 md:py-24" style={{ background: PR.bg, borderColor: PR.cardBorder }}>
          <div className="max-w-6xl mx-auto px-5">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-2" style={{ color: accent }}>{agT(lang, "How it works", "Cómo funciona")}</p>
              <h2 className="wh text-3xl md:text-4xl" style={{ color: PR.ink }}>{w.how_it_works_title || agT(lang, "We transform your digital presence step by step", "Transformamos tu presencia digital paso a paso")}</h2>
            </div>
            <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-5">
              {steps.slice(0, 5).map((s, i) => (
                <div key={i} className="relative rounded-2xl border p-6" style={{ background: PR.card, borderColor: PR.cardBorder }}>
                  <span className="wh absolute -top-3 -left-1 text-5xl font-black" style={{ color: `${accent}33` }}>{i + 1}</span>
                  <h3 className="font-bold text-base relative mt-2" style={{ color: PR.ink }}>{s.title}</h3>
                  {s.desc && <p className="mt-2 text-xs leading-relaxed relative" style={{ color: PR.muted }}>{s.desc}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* REVIEWS */}
      {sec.reviews !== false && reviews.length > 0 && (
        <section id="reviews" className="py-16 md:py-24" style={{ background: RV.bg }} data-testid="site-reviews">
          <div className="max-w-6xl mx-auto px-5">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-2" style={{ color: accent }}>{agT(lang, "Reviews", "Reseñas")}</p>
              <h2 className="wh text-3xl md:text-4xl" style={{ color: RV.ink }}>{agT(lang, "What our clients say", "Lo que dicen nuestros clientes")}</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {reviews.slice(0, 6).map((r, i) => (
                <div key={i} data-testid={`agency-review-${i}`} className="rounded-2xl border p-6" style={{ background: RV.card, borderColor: RV.cardBorder }}>
                  <Stars n={r.rating || 5} />
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: RV.muted }}>"{r.text}"</p>
                  {r.customer_name && <div className="mt-4 font-bold text-sm" style={{ color: RV.ink }}>{r.customer_name}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA BAND */}
      {sec.band !== false && (
        <section className="relative py-20 md:py-28 overflow-hidden" style={{ background: CT.bg }}>
          {bandImg && <img src={bandImg} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          {bandImg && <div className="absolute inset-0" style={{ background: CT.dark ? "linear-gradient(180deg,rgba(0,0,0,.7),rgba(0,0,0,.82))" : "linear-gradient(180deg,rgba(255,255,255,.6),rgba(255,255,255,.85))" }} />}
          <div className="relative max-w-3xl mx-auto px-5 text-center">
            <h2 className="wh text-3xl md:text-5xl" style={{ color: CT.ink }}>{agT(lang, "Ready to elevate your business?", "¿Listo para elevar tu negocio?")}</h2>
            <p className="mt-5 leading-relaxed" style={{ color: CT.muted }}>{agT(lang, "Book a free demo and see how a smart digital system can bring you more clients.", "Agenda una demostración gratuita y descubre cómo un sistema digital inteligente puede traerte más clientes.")}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <button onClick={goContact} className="inline-flex items-center gap-2 font-bold px-8 py-4 rounded-full hover:-translate-y-0.5 transition-transform" style={{ background: CT.dark ? accent : "#0a1130", color: CT.dark ? accentText : "#ffffff" }}>{ctx.cta} <ArrowRight className="w-5 h-5" /></button>
              {phone && <a href={`tel:${phone}`} className="inline-flex items-center gap-2 border px-7 py-4 rounded-full font-semibold hover:opacity-80" style={{ borderColor: CT.cardBorder, color: CT.ink }}><Phone className="w-4 h-4" /> {phone}</a>}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {faqs.length > 0 && sec.faq !== false && (
        <section className="py-16 md:py-20" style={{ background: FQ.bg }}>
          <div className="max-w-3xl mx-auto px-5">
            <h2 className="wh text-3xl md:text-4xl text-center mb-8" style={{ color: FQ.ink }}>{agT(lang, "Frequently asked questions", "Preguntas frecuentes")}</h2>
            <div className="space-y-3">
              {faqs.map((f, i) => (
                <details key={i} className="group rounded-xl border p-4" style={{ background: FQ.card, borderColor: FQ.cardBorder }}>
                  <summary className="flex items-center justify-between cursor-pointer font-semibold text-sm list-none" style={{ color: FQ.ink }}>{f.q}<ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" style={{ color: accent }} /></summary>
                  {f.a && <p className="mt-3 text-sm leading-relaxed" style={{ color: FQ.muted }}>{f.a}</p>}
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CONTACT */}
      <section id="contact" className="py-16 md:py-24" style={{ background: CO.bg }}>
        <div className="max-w-6xl mx-auto px-5 grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="wh text-3xl md:text-4xl" style={{ color: CO.ink }}>{ctx.bookingOn ? agT(lang, "Book your appointment", "Agenda tu cita") : agT(lang, "Ready to grow?", "¿Listo para crecer?")}</h2>
            <p className="mt-4 leading-relaxed max-w-md" style={{ color: CO.muted }}>{ctx.bookingOn ? agT(lang, "Pick a time that works — we'll confirm right away.", "Elige un horario — te confirmamos de inmediato.") : agT(lang, "Tell us about your goals and we'll show you how we can help. No obligation.", "Cuéntanos tus metas y te mostramos cómo ayudarte. Sin compromiso.")}</p>
            {phone && <a href={`tel:${phone}`} className="mt-6 inline-flex items-center gap-2 text-sm" style={{ color: CO.muted }}><Phone className="w-4 h-4" style={{ color: accent }} /> {phone}</a>}
            {areas.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {areas.map((a, i) => <span key={i} className="text-xs px-3 py-1 rounded-full" style={{ background: CO.pill, color: CO.muted }}><MapPin className="w-3 h-3 inline mr-1" style={{ color: accent }} />{a}</span>)}
              </div>
            )}
          </div>
          <div className="w-full max-w-md"><HeroForm ctx={ctx} dark={CO.dark} /></div>
        </div>
      </section>

      <AgencyFooter ctx={ctx} />
    </div>
  );
}

function HeroForm({ ctx, dark }) {
  const { w, data, th, accent, accentText, slug } = ctx;
  const es = ctx.lang === "es";
  const L = es ? {
    quote: "Cotiza gratis", book: "Agenda tu cita",
    name: "Tu nombre", phone: "Teléfono", svc: "¿Qué necesitas? (opcional)", svcBook: "Servicio (opcional)",
    submit: "Quiero mi cotización", submitBook: "Solicitar cita", thanks: "¡Gracias! Te contactaremos muy pronto.",
  } : {
    quote: "Get your free quote", book: "Book your appointment",
    name: "Your name", phone: "Phone number", svc: "What do you need? (optional)", svcBook: "Service (optional)",
    submit: "Get My Free Quote", submitBook: "Request Appointment", thanks: "Thanks! We'll reach out shortly.",
  };
  const sec = w.sections || {};
  const bookingOn = sec.booking && data.card_slug;
  const [form, setForm] = useState({ name: "", phone: "", service: "" });
  const [sending, setSending] = useState(false);
  const [ok, setOk] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) return;
    setSending(true);
    try { await axios.post(`${API}/public/website/${slug}/lead`, { name: form.name, phone: form.phone, service: form.service, description: form.service, source: "hero" }); setOk(true); }
    catch { setOk(true); } finally { setSending(false); }
  };
  const cardBg = dark ? "rgba(20,20,24,.72)" : "#fff";
  const cardBorder = dark ? "rgba(255,255,255,.28)" : "#e2e8f0";
  const txt = dark ? "#ffffff" : "#0f172a";
  const inpBg = dark ? "rgba(255,255,255,.16)" : "#ffffff";
  const inpBorder = dark ? "rgba(255,255,255,.45)" : "#cbd5e1";
  const phClass = dark ? "placeholder-white/80" : "placeholder-slate-500";
  const wrap = `p-5 sm:p-6 ${th.radius} shadow-2xl w-full max-w-sm backdrop-blur-md`;
  if (ok) return (
    <div className={`${wrap} text-center`} style={{ background: cardBg, border: `1px solid ${cardBorder}` }} data-testid="site-hero-form-success">
      <CheckCircle2 className="w-10 h-10 mx-auto" style={{ color: accent }} />
      <p className="mt-2 font-bold" style={{ color: txt }}>{L.thanks}</p>
    </div>
  );
  const inp = `w-full h-11 px-3.5 rounded-xl border outline-none mb-2.5 text-sm font-medium ${phClass}`;
  return (
    <form onSubmit={submit} className={wrap} style={{ background: cardBg, border: `1px solid ${cardBorder}` }} data-testid="site-hero-form">
      <div className="wh font-bold text-lg mb-3" style={{ color: txt }}>{bookingOn ? L.book : L.quote}</div>
      <input required placeholder={L.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="site-hero-form-name" className={inp} style={{ background: inpBg, borderColor: inpBorder, color: txt }} />
      <input required placeholder={L.phone} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="site-hero-form-phone" className={inp} style={{ background: inpBg, borderColor: inpBorder, color: txt }} />
      <input placeholder={bookingOn ? L.svcBook : L.svc} value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} data-testid="site-hero-form-service" className={inp} style={{ background: inpBg, borderColor: inpBorder, color: txt }} />
      <button type="submit" disabled={sending} className={`w-full h-12 ${th.btn} inline-flex items-center justify-center gap-2 font-bold mt-1`} style={{ background: accent, color: accentText }}>{sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{bookingOn ? L.submitBook : L.submit} <ArrowRight className="w-4 h-4" /></>}</button>
    </form>
  );
}

function HeroFormBand({ ctx, dark }) {
  const { w, data, th, accent } = ctx;
  const sec = w.sections || {};
  const bookingOn = sec.booking && data.card_slug;
  const headColor = dark ? "#ffffff" : th.ink;
  const bodyColor = dark ? "rgba(255,255,255,0.75)" : th.muted;
  return (
    <section className="py-12 md:py-16" style={{ background: dark ? th.ink : th.surface }} data-testid="site-heroform-band">
      <div className="max-w-6xl mx-auto px-5 grid md:grid-cols-2 gap-8 md:gap-12 items-center">
        <div>
          <Kicker ctx={ctx}>{bookingOn ? "Book online" : "Free estimate"}</Kicker>
          <h2 className="wh text-3xl md:text-4xl font-extrabold" style={{ color: headColor }}>{bookingOn ? "Reserve your spot in seconds" : "Get your free quote today"}</h2>
          <p className="mt-3 text-lg" style={{ color: bodyColor }}>{bookingOn ? "Pick a time that works for you — we'll confirm right away." : "Tell us what you need and we'll respond fast with a no-obligation quote."}</p>
          <ul className="mt-5 space-y-2.5">
            {[bookingOn ? "Quick online booking" : "Fast response", "No obligation", "Friendly local service"].map((x, i) => (
              <li key={i} className="flex items-center gap-2 text-sm font-semibold" style={{ color: headColor }}><CheckCircle2 className="w-4 h-4" style={{ color: accent }} /> {x}</li>
            ))}
          </ul>
        </div>
        <div className="w-full flex md:justify-end"><HeroForm ctx={ctx} /></div>
      </div>
    </section>
  );
}

function ProblemsSection({ ctx }) {
  const { w, th, accent, data } = ctx;
  const pages = data.problem_pages || [];
  if (!pages.length) return null;
  const S = th.dark ? SectionDark : SectionLight;
  return (
    <S id="solutions" kicker="How can we help?" title="Problems We Solve" ctx={ctx}>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {pages.map((p, i) => (
          <a key={i} href={ctx.ppHref(p.page_slug)} data-testid={`site-problem-card-${i}`}
             className={`group block p-6 ${th.radius} transition hover:-translate-y-1`}
             style={{ background: th.surface, border: `1px solid ${th.border}` }}>
            <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: accent }}>{p.service_name}</div>
            <div className="text-lg font-bold leading-snug" style={{ color: th.ink }}>{p.headline || p.service_name}</div>
            <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: accent }}>See how we help <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" /></div>
          </a>
        ))}
      </div>
    </S>
  );
}


function ContactBlock({ ctx, id = "contact" }) {
  const { b, data, th, accent, accentText, w } = ctx;
  const sec = w.sections || {};
  const bookingOn = sec.booking && data.card_slug;
  const r = useReveal();
  return (
    <>
    <section id={id} className="py-16 md:py-24">
      <div ref={r} className="max-w-6xl mx-auto px-5 wreveal">
        <div className="grid md:grid-cols-2 gap-8 items-start">
          <div className="space-y-5">
            <Kicker ctx={ctx}>Let's talk</Kicker>
            <h2 className="wh text-3xl md:text-4xl font-extrabold" style={{ color: th.ink }}>{bookingOn ? "Book an Appointment" : "Get Your Free Estimate"}</h2>
            <p className="text-lg leading-relaxed" style={{ color: th.muted }}>{bookingOn ? "Pick a day and time that works for you and we'll confirm your appointment." : "Tell us what you need and we'll get back to you fast — no obligation."}</p>
            {b.phone && <a href={`tel:${b.phone}`} data-testid="site-contact-call" className="flex items-center gap-3 font-bold text-lg" style={{ color: th.ink }}><span className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: accent, color: accentText }}><Phone className="w-5 h-5" /></span> {b.phone}</a>}
            <div className="flex items-center gap-2 pt-1"><Stars n={5} /><span className="text-sm font-semibold" style={{ color: th.muted }}>Trusted by our community</span></div>
            <p className="text-base leading-relaxed" style={{ color: th.muted }}>{bookingOn ? "Have a question before you book? Send us a message or give us a call — we're happy to help and usually reply within the hour." : "Not sure exactly what you need? Reach out with any question and we'll walk you through your options with a clear, honest quote — no pressure."}</p>
          </div>
          {bookingOn ? <BookingForm ctx={ctx} /> : <LeadForm ctx={ctx} />}
        </div>
      </div>
    </section>
    </>
  );
}

function BookingForm({ ctx, inline }) {
  const { data, th, accent, accentText } = ctx;
  const cslug = data.card_slug;
  const [avail, setAvail] = useState(null);
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    axios.get(`${API}/public/card/${cslug}/availability?days=21`).then((r) => setAvail(r.data)).catch(() => setAvail({ enabled: false, dates: [] }));
  }, [cslug]);
  const dates = (avail?.dates || []).slice(0, 14);
  const slots = (dates.find((d) => d.date === date) || {}).slots || [];
  const fmtDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const fmtSlot = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); const ap = h >= 12 ? "PM" : "AM"; const h12 = ((h + 11) % 12) + 1; return `${h12}:${String(m).padStart(2, "0")} ${ap}`; };
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !date || !slot) { setErr("Please choose a date, a time and enter your name."); return; }
    setSending(true); setErr("");
    try { await axios.post(`${API}/public/card/${cslug}/appointment`, { ...form, date, start_time: slot }); setDone(true); }
    catch (ex) { setErr(ex?.response?.data?.detail || "That time is no longer available — please pick another."); setSending(false); }
  };
  const inpStyle = { borderColor: th.border, background: th.dark ? "rgba(255,255,255,.06)" : "#fff", color: th.ink };
  const inp = "w-full h-12 px-4 rounded-xl border outline-none focus-visible:ring-2";
  const box = inline ? "space-y-4" : `p-6 space-y-4 ${th.radius}`;
  const boxStyle = inline ? undefined : { background: th.surface, border: `1px solid ${th.border}` };
  if (done) return (
    <div className={`p-8 text-center ${th.radius}`} style={boxStyle} data-testid="site-booking-success">
      <CheckCircle2 className="w-12 h-12 mx-auto" style={{ color: accent }} />
      <h3 className="wh font-bold text-2xl mt-3" style={{ color: th.ink }}>Appointment requested!</h3>
      <p className="mt-2 text-sm" style={{ color: th.muted }}>We'll confirm your {fmtDate(date)} at {fmtSlot(slot)} appointment shortly.</p>
    </div>
  );
  if (avail && avail.enabled === false) return (
    <div className={box} style={boxStyle} data-testid="site-booking-unavailable"><LeadForm ctx={ctx} /></div>
  );
  return (
    <form onSubmit={submit} className={box} style={boxStyle} data-testid="site-booking-form">
      <div>
        <div className="text-sm font-bold mb-2" style={{ color: th.ink }}>1. Choose a day</div>
        {!avail ? <div className="flex items-center gap-2 text-sm" style={{ color: th.muted }}><Loader2 className="w-4 h-4 animate-spin" /> Loading availability…</div>
          : dates.length === 0 ? <p className="text-sm" style={{ color: th.muted }}>No open days right now — please call us.</p>
          : <div className="flex flex-wrap gap-2">
              {dates.map((d) => (
                <button type="button" key={d.date} onClick={() => { setDate(d.date); setSlot(""); }} data-testid={`site-booking-date-${d.date}`}
                  className="px-3 py-2 rounded-lg text-xs font-semibold border" style={date === d.date ? { background: accent, color: accentText, borderColor: accent } : { ...inpStyle }}>
                  {fmtDate(d.date)}
                </button>
              ))}
            </div>}
      </div>
      {date && (
        <div>
          <div className="text-sm font-bold mb-2" style={{ color: th.ink }}>2. Pick a time</div>
          <div className="flex flex-wrap gap-2">
            {slots.length === 0 ? <p className="text-sm" style={{ color: th.muted }}>No times left on this day.</p>
              : slots.map((s) => (
                <button type="button" key={s} onClick={() => setSlot(s)} data-testid={`site-booking-slot-${s}`}
                  className="px-3 py-2 rounded-lg text-xs font-semibold border" style={slot === s ? { background: accent, color: accentText, borderColor: accent } : { ...inpStyle }}>
                  {fmtSlot(s)}
                </button>
              ))}
          </div>
        </div>
      )}
      <div className="pt-1 space-y-3">
        <div className="text-sm font-bold" style={{ color: th.ink }}>3. Your details</div>
        <input required data-testid="site-booking-name" placeholder="Your name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} style={inpStyle} />
        <input required data-testid="site-booking-phone" placeholder="Phone *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inp} style={inpStyle} />
        <input type="email" data-testid="site-booking-email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inp} style={inpStyle} />
        <textarea placeholder="Anything we should know? (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full min-h-[72px] p-4 rounded-xl border outline-none focus-visible:ring-2" style={inpStyle} />
      </div>
      {err && <p className="text-sm font-semibold" style={{ color: "#DC2626" }} data-testid="site-booking-error">{err}</p>}
      <button type="submit" disabled={sending} data-testid="site-booking-submit" className={`w-full h-13 py-3.5 font-bold flex items-center justify-center gap-2 ${th.btn}`} style={{ background: accent, color: accentText }}>
        {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Calendar className="w-4 h-4" /> Request Appointment</>}
      </button>
    </form>
  );
}

const FOOTER_BG = {
  cinematic: "#08080A", responder: "#141821", bento: "#0F172A", craftsman: "#241F1B",
  trust: "#111827", slider: "#0E1116", onepage: "#141414", neon: "#0A0A0C",
  playful: "#2A2520", luxe: "#0E0E0E",
};

function FooterBlock({ ctx }) {
  const { w, b, data, sec, th, accent, accentText, goContact, key } = ctx;
  const bg = FOOTER_BG[key] || "#0F172A";
  const logo = photoUrl(b.logo_photo_id, 220);
  const about = (w.about ? String(w.about).split(/\n+/)[0] : "") || w.subheadline || `${b.name} — licensed & insured local service you can trust.`;
  const hours = w.hours || data.hours || "";
  const areas = (w.areas?.length ? w.areas : (data.service_area ? [data.service_area] : []));
  const nav = [
    sec.services !== false && ["Services", "#services"],
    sec.gallery !== false && ["Gallery", "#gallery"],
    (sec.about !== false && w.about) && ["About", "#about"],
    sec.reviews !== false && ["Reviews", "#reviews"],
    sec.faq !== false && ["FAQ", "#faq"],
  ].filter(Boolean);
  const socials = [
    b.facebook && [Facebook, b.facebook],
    b.instagram && [Instagram, b.instagram],
  ].filter(Boolean);
  return (
    <footer className="relative overflow-hidden" style={{ background: bg, color: "#fff" }} data-testid="site-footer">
      <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full blur-3xl opacity-20" style={{ background: accent }} />
      {/* CTA */}
      <div className="max-w-6xl mx-auto px-5 pt-20 relative">
        <div className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: accent }}>Ready when you are</div>
        <h2 className="wh font-extrabold text-4xl md:text-5xl max-w-2xl leading-tight">{ctx.bookingOn ? "Let's get you booked in." : "Let's get you taken care of."}</h2>
        <div className="mt-8 flex flex-wrap gap-3">
          <button onClick={goContact} data-testid="site-footer-quote" className={`px-8 h-14 font-bold ${th.btn} inline-flex items-center gap-2 hover:-translate-y-0.5`} style={{ background: accent, color: accentText }}>{ctx.cta} <ArrowRight className="w-4 h-4" /></button>
          {b.phone && <a href={`tel:${b.phone}`} className={`px-8 h-14 inline-flex items-center gap-2 ${th.btn} bg-white/10 hover:bg-white/20 font-bold`}><Phone className="w-4 h-4" /> {b.phone}</a>}
        </div>
      </div>
      {/* Internal links to Problem/Solution pages (SEO + navigation) */}
      {(data.problem_pages || []).length > 0 && (
        <div className="max-w-6xl mx-auto px-5 pt-12 relative" data-testid="site-problem-links">
          <div className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: accent }}>Common problems we solve</div>
          <div className="flex flex-wrap gap-2">
            {data.problem_pages.map((p, i) => (
              <a key={i} href={ctx.ppHref(p.page_slug)} className="px-3.5 py-1.5 rounded-full text-sm bg-white/10 hover:bg-white/20 text-white/85 transition">{p.service_name}</a>
            ))}
          </div>
        </div>
      )}
      {/* Info columns (SEO-rich) */}
      <div className="max-w-6xl mx-auto px-5 pt-14 mt-14 pb-12 relative grid md:grid-cols-3 gap-10 md:gap-12 border-t border-white/10">
        <div>
          {logo ? <img src={logo} alt={b.name} className="h-20 md:h-24 w-auto object-contain" /> : <div className="wh font-extrabold text-3xl md:text-4xl">{b.name}</div>}
          <p className="mt-5 text-sm leading-relaxed text-white/55 max-w-sm line-clamp-3">{about}</p>
          {socials.length > 0 && (
            <div className="mt-5 flex gap-3">
              {socials.map(([Icon, href], i) => (
                <a key={i} href={href} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full flex items-center justify-center border border-white/15 text-white/70 hover:text-white hover:border-white/40 transition"><Icon className="w-4 h-4" /></a>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.25em] mb-5" style={{ color: accent }}>Contact</div>
          <ul className="space-y-3.5 text-sm text-white/75">
            {b.address && <li className="flex gap-3"><MapPin className="w-4 h-4 flex-none mt-0.5" style={{ color: accent }} /><span>{b.address}</span></li>}
            {b.phone && <li><a href={`tel:${b.phone}`} data-testid="site-footer-phone" className="flex gap-3 hover:text-white"><Phone className="w-4 h-4 flex-none mt-0.5" style={{ color: accent }} /><span>{b.phone}</span></a></li>}
            {b.email && <li><a href={`mailto:${b.email}`} className="flex gap-3 hover:text-white break-all"><Mail className="w-4 h-4 flex-none mt-0.5" style={{ color: accent }} /><span>{b.email}</span></a></li>}
            {hours && <li className="flex gap-3"><Clock className="w-4 h-4 flex-none mt-0.5" style={{ color: accent }} /><span>{hours}</span></li>}
          </ul>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.25em] mb-5" style={{ color: accent }}>Navigate</div>
          <ul className="space-y-3">
            {nav.map(([l, href], i) => <li key={i}><a href={href} className="text-white/75 hover:text-white uppercase tracking-wide text-[13px] font-semibold">{l}</a></li>)}
            <li><button onClick={goContact} className="text-white/75 hover:text-white uppercase tracking-wide text-[13px] font-semibold">{ctx.cta}</button></li>
          </ul>
        </div>
      </div>
      {/* Bottom bar */}
      <div className="border-t border-white/10 relative">
        <div className="max-w-6xl mx-auto px-5 py-6 flex flex-wrap justify-between items-center gap-3 text-xs text-white/45">
          <span>© {new Date().getFullYear()} {b.name}. All rights reserved.</span>
          {areas.length > 0 && <span className="uppercase tracking-widest text-white/35">{areas.slice(0, 3).join(" • ")}</span>}
          <span>Powered by UniTech</span>
        </div>
      </div>
    </footer>
  );
}

function MobileBar({ ctx }) {
  const { b, th, accent, accentText, goContact } = ctx;
  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-50 flex gap-2 p-3 border-t shadow-[0_-4px_20px_rgba(0,0,0,0.14)]" style={{ background: th.surface, borderColor: th.border, paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}>
      {b.phone && <a href={`tel:${b.phone}`} data-testid="site-sticky-call" className={`flex-1 h-12 inline-flex items-center justify-center gap-2 font-bold ${th.btn} border-2`} style={{ borderColor: accent, color: accent }}><Phone className="w-4 h-4" /> Call</a>}
      <button onClick={goContact} data-testid="site-sticky-quote" className={`flex-1 h-12 font-bold ${th.btn}`} style={{ background: accent, color: accentText }}>{ctx.ctaShort}</button>
    </div>
  );
}

function Stars({ n = 5 }) {
  return <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className="w-4 h-4" style={{ fill: i <= n ? "#F5B301" : "none", color: i <= n ? "#F5B301" : "#D1D5DB" }} />)}</div>;
}

function LeadForm({ ctx, inline }) {
  const { slug, th, accent, accentText, data, lang } = ctx;
  const services = data.services;
  const [form, setForm] = useState({ name: "", phone: "", email: "", service: "", description: "" });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) return;
    setSending(true);
    try { await axios.post(`${API}/public/website/${slug}/lead`, form); setDone(true); } catch { setSending(false); }
  };
  const inpStyle = { borderColor: th.border, background: th.dark ? "rgba(255,255,255,.06)" : "#fff", color: th.ink };
  const inp = "w-full h-12 px-4 rounded-xl border outline-none focus-visible:ring-2";
  if (done) return (
    <div className={`p-8 text-center ${th.radius}`} style={{ background: inline ? "transparent" : th.surface, border: inline ? "none" : `1px solid ${th.border}` }} data-testid="site-lead-success">
      <CheckCircle2 className="w-12 h-12 mx-auto" style={{ color: accent }} />
      <h3 className="wh font-bold text-2xl mt-3" style={{ color: th.ink }}>{agT(lang, "Thank you!", "¡Gracias!")}</h3>
      <p className="mt-2 text-sm" style={{ color: th.muted }}>{agT(lang, "We received your request and will contact you shortly.", "Recibimos tu solicitud y te contactaremos muy pronto.")}</p>
    </div>
  );
  const body = (
    <form onSubmit={submit} className={inline ? "grid sm:grid-cols-2 gap-3" : `p-6 space-y-3 ${th.radius}`} style={inline ? undefined : { background: th.surface, border: `1px solid ${th.border}` }} data-testid="site-lead-form">
      <input required data-testid="site-lead-name" placeholder={agT(lang, "Your name *", "Tu nombre *")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} style={inpStyle} />
      <input required data-testid="site-lead-phone" placeholder={agT(lang, "Phone *", "Teléfono *")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inp} style={inpStyle} />
      <input type="email" data-testid="site-lead-email" placeholder={agT(lang, "Email", "Correo electrónico")} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={`${inp} ${inline ? "sm:col-span-2" : ""}`} style={inpStyle} />
      {services?.length > 0 && (
        <select data-testid="site-lead-service" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} className={`${inp} ${inline ? "sm:col-span-2" : ""}`} style={inpStyle}>
          <option value="">{agT(lang, "What do you need?", "¿Qué necesitas?")}</option>
          {services.map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
        </select>
      )}
      <textarea placeholder={agT(lang, "Tell us what you need (optional)", "Cuéntanos qué necesitas (opcional)")} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`w-full min-h-[84px] p-4 rounded-xl border outline-none focus-visible:ring-2 ${inline ? "sm:col-span-2" : ""}`} style={inpStyle} />
      <button type="submit" disabled={sending} data-testid="site-lead-submit" className={`h-13 py-3.5 font-bold flex items-center justify-center gap-2 ${th.btn} ${inline ? "sm:col-span-2" : "w-full"}`} style={{ background: accent, color: accentText }}>
        {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> {agT(lang, "Send Request", "Enviar solicitud")}</>}
      </button>
    </form>
  );
  return body;
}

// ===========================================================================
const DEFAULT_SERVICES = [
  { name: "Free Estimates", description: "Fast, no-obligation quotes for your project." },
  { name: "Quality Work", description: "Licensed, insured, and done right the first time." },
  { name: "On-Time Service", description: "We show up when we say we will." },
];
const DEFAULT_HOW = [
  { title: "Reach Out", desc: "Call us or request a free quote online — we respond fast." },
  { title: "We Assess", desc: "We evaluate the job and give you a clear, upfront price." },
  { title: "We Get It Done", desc: "Professional, reliable work done right the first time." },
];
const DEFAULT_WHY = [
  { title: "Fast Response", desc: "We show up on time, every time." },
  { title: "Upfront Pricing", desc: "No hidden fees — you know the cost before we start." },
  { title: "Licensed & Insured", desc: "Fully covered for your peace of mind." },
  { title: "5-Star Service", desc: "Trusted by our local community." },
];
const DEFAULT_FAQ = [
  { q: "How much does it cost?", a: "Every job is different — contact us for a fast, free, no-obligation quote." },
  { q: "How soon can you come out?", a: "We offer fast scheduling with same-week availability in most cases." },
  { q: "Are you licensed and insured?", a: "Yes — we are fully licensed and insured for your protection." },
];
