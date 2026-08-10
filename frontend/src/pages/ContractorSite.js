import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Phone, MapPin, Clock, Star, ShieldCheck, CheckCircle2, Calendar, Send, Loader2, Menu, X, ArrowRight, ChevronDown, Quote, Plus } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const photoUrl = (id) => (id ? `${API}/public/card/photo/${id}` : null);

// ---- Trade-aware professional stock fallbacks (verified URLs) --------------
const STOCK = {
  bold: {
    hero: "https://images.unsplash.com/photo-1633759593085-1eaeb724fc88?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1Mjh8MHwxfHNlYXJjaHw0fHxyb29maW5nJTIwY29udHJhY3RvcnxlbnwwfHx8fDE3ODYzMzkzNTN8MA&ixlib=rb-4.1.0&q=85&w=1600",
    imgs: [
      "https://images.unsplash.com/photo-1635424709961-f3a150459ad4?ixlib=rb-4.1.0&q=85&w=900",
      "https://images.unsplash.com/photo-1558227691-41ea78d1f631?ixlib=rb-4.1.0&q=85&w=900",
      "https://images.unsplash.com/photo-1635424709845-3a85ad5e1f5e?ixlib=rb-4.1.0&q=85&w=900",
      "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?ixlib=rb-4.1.0&q=85&w=900",
    ],
  },
  warm: {
    hero: "https://images.unsplash.com/photo-1734303023491-db8037a21f09?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHwyfHxsYW5kc2NhcGluZyUyMHByb2Zlc3Npb25hbHxlbnwwfHx8fDE3ODYzMzkzNTN8MA&ixlib=rb-4.1.0&q=85&w=1600",
    imgs: [
      "https://images.unsplash.com/photo-1458245201577-fc8a130b8829?ixlib=rb-4.1.0&q=85&w=900",
      "https://images.unsplash.com/photo-1734079692160-fcbe4be6ab96?ixlib=rb-4.1.0&q=85&w=900",
      "https://images.unsplash.com/photo-1558904541-efa843a96f01?ixlib=rb-4.1.0&q=85&w=900",
      "https://images.unsplash.com/photo-1728917416100-40c8d78324b7?ixlib=rb-4.1.0&q=85&w=900",
    ],
  },
  clean: {
    hero: "https://images.unsplash.com/photo-1749532125405-70950966b0e5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTV8MHwxfHNlYXJjaHwyfHxwbHVtYmluZyUyMHByb2Zlc3Npb25hbHxlbnwwfHx8fDE3ODYzMzkzNTN8MA&ixlib=rb-4.1.0&q=85&w=1600",
    imgs: [
      "https://images.unsplash.com/photo-1581783898377-1c85bf937427?ixlib=rb-4.1.0&q=85&w=900",
      "https://images.unsplash.com/photo-1426927308491-6380b6a9936f?ixlib=rb-4.1.0&q=85&w=900",
      "https://images.unsplash.com/photo-1676311396794-f14881e9daaa?ixlib=rb-4.1.0&q=85&w=900",
      "https://images.unsplash.com/photo-1503789146722-cf137a3c0fea?ixlib=rb-4.1.0&q=85&w=900",
    ],
  },
};
function stockFor(businessType = "") {
  const s = (businessType || "").toLowerCase();
  if (/(roof|hvac|concret|constru|remodel|excav|demol|paver|deck|fenc|tow)/.test(s)) return STOCK.bold;
  if (/(landscap|lawn|garden|clean|maid|janitor|paint|tree|pressure)/.test(s)) return STOCK.warm;
  if (/(plumb|electric|handyman|drain|appliance|repair)/.test(s)) return STOCK.clean;
  return STOCK.bold;
}

// ---- Per-template design tokens (5 DISTINCT templates) ---------------------
const THEME = {
  cinematic: { dark: true, h: "'Syne',sans-serif", b: "'Inter',sans-serif", hc: "font-extrabold tracking-tight",
    bg: "#08080A", surface: "#141418", ink: "#FFFFFF", muted: "#A1A1AA", border: "rgba(255,255,255,.12)", radius: "rounded-none", btn: "rounded-none font-semibold tracking-wide" },
  responder: { dark: false, h: "'Anton',sans-serif", b: "'Roboto',sans-serif", hc: "font-normal uppercase tracking-wide",
    bg: "#F3F4F6", surface: "#FFFFFF", ink: "#111827", muted: "#4B5563", border: "#111827", radius: "rounded-md", btn: "rounded-md uppercase font-bold tracking-wide" },
  bento: { dark: false, h: "'Plus Jakarta Sans',sans-serif", b: "'Inter',sans-serif", hc: "font-extrabold tracking-tight",
    bg: "#FFFFFF", surface: "#F8FAFC", ink: "#0F172A", muted: "#64748B", border: "#E2E8F0", radius: "rounded-2xl", btn: "rounded-xl font-semibold" },
  craftsman: { dark: false, h: "'Playfair Display',serif", b: "'DM Sans',sans-serif", hc: "font-bold tracking-tight",
    bg: "#F7F5F1", surface: "#FFFFFF", ink: "#2C2A28", muted: "#7C756B", border: "#E7E2D8", radius: "rounded-3xl", btn: "rounded-full font-bold" },
  trust: { dark: false, h: "'Montserrat',sans-serif", b: "'Open Sans',sans-serif", hc: "font-extrabold tracking-tight",
    bg: "#F1F5F9", surface: "#FFFFFF", ink: "#1F2937", muted: "#6B7280", border: "#E5E7EB", radius: "rounded-lg", btn: "rounded-lg font-bold" },
};
const LEGACY = { clean: "bento", bold: "cinematic", warm: "craftsman" };
const resolveTpl = (v) => (THEME[v] ? v : (LEGACY[v] || "trust"));

function isLight(hex) {
  if (!hex) return false;
  const c = hex.replace("#", ""); if (c.length < 6) return false;
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150;
}

// ===========================================================================
export default function ContractorSite() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Anton&family=DM+Sans:wght@400;500;700&family=Inter:wght@300;400;500;600;700&family=Montserrat:wght@600;700;800&family=Open+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Roboto:wght@400;500;700;900&family=Syne:wght@500;700;800&display=swap";
    document.head.appendChild(l);
    return () => { document.head.removeChild(l); };
  }, []);

  useEffect(() => {
    axios.get(`${API}/public/website/${slug}`).then((r) => setData(r.data)).catch(() => setErr(true));
  }, [slug]);

  useEffect(() => {
    if (!data) return;
    const ww = data.website, bb = data.business;
    document.title = ww.seo_title || `${bb.name}${data.service_area ? " — " + data.service_area : ""}`;
    let m = document.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement("meta"); m.name = "description"; document.head.appendChild(m); }
    m.setAttribute("content", ww.seo_description || ww.subheadline || `${bb.name} — professional, licensed & insured service you can trust.`);
  }, [data]);

  if (err) return <div className="min-h-screen flex items-center justify-center text-slate-500 p-8 text-center">This website is not available.</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  const w = data.website;
  const key = resolveTpl(w.template);
  const th = THEME[key];
  const accent = w.accent_color || "#2563EB";
  const accentText = isLight(accent) ? "#0A0A0A" : "#FFFFFF";
  const b = data.business;
  const sec = w.sections || {};
  const stock = stockFor(b.business_type);
  const realPhotos = (data.photos || []).map((p) => photoUrl(p.id));
  const heroImg = photoUrl(w.hero_photo_id) || realPhotos[0] || stock.hero;
  const pool = [...realPhotos, ...stock.imgs];
  const poolAt = (i) => pool[i % pool.length] || stock.hero;
  const services = data.services.length ? data.services : DEFAULT_SERVICES;
  const goContact = () => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });

  const ctx = { w, b, data, sec, accent, accentText, th, heroImg, poolAt, services, goContact, slug, key };
  const Layout = { cinematic: Cinematic, responder: Responder, bento: Bento, craftsman: Craftsman, trust: Trust }[key];

  return (
    <div style={{ background: th.bg, color: th.ink, fontFamily: th.b }} className="min-h-screen antialiased" data-testid={`site-tpl-${key}`}>
      <style>{`
        .wh{font-family:${th.h}}
        .ws a,.ws button{transition:transform .25s ease,box-shadow .25s ease,background-color .25s ease,opacity .25s ease,color .2s,filter .3s}
        .ws ::selection{background:${accent};color:${accentText}}
        @keyframes wfade{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
        @keyframes wmarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes wpulse{0%,100%{box-shadow:0 0 0 0 ${accent}66}50%{box-shadow:0 0 0 10px ${accent}00}}
        .wfade{animation:wfade .8s ease both}
        .wmarq{display:flex;gap:2rem;width:max-content;animation:wmarquee 22s linear infinite}
      `}</style>
      <div className="ws">
        <Layout ctx={ctx} />
      </div>
      <MobileBar ctx={ctx} />
    </div>
  );
}

// ===========================================================================
// TEMPLATE 1 — CINEMATIC DARK
// ===========================================================================
function Cinematic({ ctx }) {
  const { w, b, data, sec, accent, accentText, th, heroImg, poolAt, services, goContact } = ctx;
  const [scr, setScr] = useState(false);
  useEffect(() => { const f = () => setScr(window.scrollY > 40); window.addEventListener("scroll", f); return () => window.removeEventListener("scroll", f); }, []);
  return (
    <div className="pb-20 md:pb-0">
      <header className="fixed top-0 inset-x-0 z-40" style={{ background: scr ? "rgba(8,8,10,.7)" : "transparent", backdropFilter: scr ? "blur(16px)" : "none", borderBottom: scr ? `1px solid ${th.border}` : "1px solid transparent" }}>
        <div className="max-w-6xl mx-auto px-5 h-20 flex items-center justify-between text-white">
          <Brand ctx={ctx} light />
          <a href={b.phone ? `tel:${b.phone}` : "#contact"} data-testid="site-header-call" className={`px-5 h-11 inline-flex items-center gap-2 text-sm ${th.btn}`} style={{ background: accent, color: accentText }}><Phone className="w-4 h-4" /> Call Now</a>
        </div>
      </header>

      {/* Hero 100vh */}
      <section className="relative min-h-[100svh] flex items-end">
        <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #08080A 4%, rgba(8,8,10,.55) 45%, rgba(8,8,10,.25) 100%)" }} />
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
        <div className="relative max-w-6xl mx-auto px-5 pb-24 pt-32 text-white w-full wfade">
          <HeroBadges ctx={ctx} />
          <h1 className="wh font-extrabold tracking-tight text-5xl sm:text-6xl lg:text-7xl mt-6 leading-[0.98] max-w-4xl">{w.headline || b.name}</h1>
          {w.subheadline && <p className="mt-6 text-lg md:text-2xl text-white/80 max-w-2xl font-light">{w.subheadline}</p>}
          <div className="mt-9 flex flex-wrap gap-3">
            <button onClick={goContact} data-testid="site-hero-quote" className={`px-8 h-14 ${th.btn} text-base inline-flex items-center gap-2 hover:-translate-y-0.5`} style={{ background: accent, color: accentText }}>Get a Free Quote <ArrowRight className="w-4 h-4" /></button>
            {b.phone && <a href={`tel:${b.phone}`} className={`px-8 h-14 ${th.btn} text-base inline-flex items-center gap-2 border border-white/25 text-white hover:bg-white/10`}><Phone className="w-5 h-5" /> {b.phone}</a>}
          </div>
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 bottom-6 text-white/70 animate-bounce"><ChevronDown className="w-6 h-6" style={{ color: accent }} /></div>
      </section>

      {/* Services: edge-to-edge image cards */}
      {sec.services !== false && (
        <SectionDark id="services" kicker="What we do" title="Our Services" ctx={ctx}>
          <div className="grid md:grid-cols-3 gap-px" style={{ background: th.border }}>
            {services.map((s, i) => (
              <div key={i} className="group relative min-h-[320px] flex items-end overflow-hidden" style={{ background: th.surface }} data-testid={`site-service-${i}`}>
                <img src={poolAt(i)} alt={s.name} className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-70 group-hover:scale-105 transition-all duration-500" />
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
      {sec.why !== false && (
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
        <SectionDark id="gallery" kicker="Our craft" title="Recent Work" ctx={ctx} alt>
          <div className="columns-2 md:columns-3 gap-3 [column-fill:_balance]">
            {data.photos.slice(0, 12).map((p) => (
              <div key={p.id} className="mb-3 break-inside-avoid overflow-hidden">
                <img src={photoUrl(p.id)} alt={p.label} className="w-full object-cover hover:opacity-90 transition" />
              </div>
            ))}
          </div>
        </SectionDark>
      )}

      {sec.reviews !== false && <ReviewsBlock ctx={ctx} dark />}
      {sec.faq !== false && <FaqBlock ctx={ctx} />}
      {sec.areas !== false && <AreasBlock ctx={ctx} />}
      {sec.contact !== false && <ContactBlock ctx={ctx} />}
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
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Brand ctx={ctx} />
          <a href={b.phone ? `tel:${b.phone}` : "#contact"} data-testid="site-header-call" className={`px-5 h-11 inline-flex items-center gap-2 text-sm ${th.btn}`} style={{ background: accent, color: accentText }}><Phone className="w-4 h-4" /> Call Now</a>
        </div>
      </header>

      {/* Hero with diagonal cut */}
      <section className="relative">
        <div className="grid md:grid-cols-2">
          <div className="px-5 py-14 md:py-24 max-w-xl mx-auto md:mx-0 md:ml-auto md:pr-12 wfade">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-black uppercase mb-4" style={{ background: `${accent}1a`, color: accent }}>Open 24/7 · Emergency Service</div>
            <h1 className="wh uppercase text-5xl sm:text-6xl leading-[0.95]" style={{ color: th.ink }}>{w.headline || b.name}</h1>
            {w.subheadline && <p className="mt-5 text-lg" style={{ color: th.muted }}>{w.subheadline}</p>}
            <div className="mt-7 flex flex-wrap gap-3">
              {b.phone && <a href={`tel:${b.phone}`} data-testid="site-hero-call" className={`px-7 h-14 ${th.btn} inline-flex items-center gap-2`} style={{ background: accent, color: accentText, animation: "wpulse 2s infinite" }}><Phone className="w-5 h-5" /> Call Now</a>}
              <button onClick={goContact} data-testid="site-hero-quote" className={`px-7 h-14 ${th.btn} inline-flex items-center gap-2 border-2`} style={{ borderColor: th.ink, color: th.ink }}>Get a Fast Quote</button>
            </div>
          </div>
          <div className="relative min-h-[280px] md:min-h-full">
            <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
          </div>
        </div>
        {/* trust marquee */}
        <div className="overflow-hidden py-3 border-y-2" style={{ background: th.ink, borderColor: th.ink }}>
          <div className="wmarq">
            {[...badges, ...badges].map((x, i) => <span key={i} className="text-white font-bold uppercase text-sm inline-flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color: accent }} /> {x}</span>)}
          </div>
        </div>
      </section>

      {/* How it works: 3 bold blocks */}
      {sec.how !== false && (
        <SectionLight id="how" kicker="Simple" title="How It Works" ctx={ctx}>
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

      {/* Services accordion */}
      {sec.services !== false && (
        <SectionLight id="services" kicker="What we fix" title="Our Services" ctx={ctx} alt>
          <div className="max-w-3xl space-y-3">
            {services.map((s, i) => <Accordion key={i} title={s.name} price={s.starting_price} body={s.description} ctx={ctx} />)}
          </div>
        </SectionLight>
      )}

      {/* Why us marquee row already above; add cards */}
      {sec.why !== false && (
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
        <SectionLight id="gallery" kicker="Proof" title="Recent Work" ctx={ctx} alt>
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-5 px-5 snap-x">
            {data.photos.slice(0, 12).map((p) => (
              <div key={p.id} className="snap-start flex-none w-64 h-64 overflow-hidden border-2" style={{ borderColor: th.ink }}>
                <img src={photoUrl(p.id)} alt={p.label} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </SectionLight>
      )}

      {sec.reviews !== false && <ReviewsBlock ctx={ctx} />}
      {sec.faq !== false && <FaqBlock ctx={ctx} />}
      {sec.areas !== false && <AreasBlock ctx={ctx} />}
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
          {b.phone && <a href={`tel:${b.phone}`} className={`w-full h-12 ${th.btn} inline-flex items-center justify-center gap-2`} style={{ background: accent, color: accentText }}><Phone className="w-4 h-4" /> Call Now</a>}
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

      {/* Hero bento */}
      <section className="px-5 pt-10 md:pt-16 max-w-5xl">
        <div className="wfade">
          <HeroBadges ctx={ctx} solid />
          <h1 className="wh font-extrabold tracking-tight text-4xl md:text-6xl mt-5 leading-[1.02]" style={{ color: th.ink }}>{w.headline || b.name}</h1>
          {w.subheadline && <p className="mt-4 text-lg md:text-xl max-w-2xl" style={{ color: th.muted }}>{w.subheadline}</p>}
          <div className="mt-7 flex flex-wrap gap-3">
            <button onClick={goContact} data-testid="site-hero-quote" className={`px-7 h-13 py-3.5 ${th.btn} inline-flex items-center gap-2 hover:-translate-y-0.5`} style={{ background: accent, color: accentText }}>Get a Free Quote <ArrowRight className="w-4 h-4" /></button>
            {b.phone && <a href={`tel:${b.phone}`} data-testid="site-hero-call" className={`px-7 h-13 py-3.5 ${th.btn} inline-flex items-center gap-2 border`} style={{ borderColor: th.border, color: th.ink }}><Phone className="w-4 h-4" /> Call</a>}
          </div>
        </div>
        {/* bento mosaic */}
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-[130px] md:auto-rows-[150px]">
          <div className="col-span-2 row-span-2 overflow-hidden rounded-2xl"><img src={heroImg} alt="" className="w-full h-full object-cover" /></div>
          <div className="rounded-2xl p-5 flex flex-col justify-center" style={{ background: accent, color: accentText }}><div className="wh text-4xl font-extrabold">{b.years_in_business > 0 ? `${b.years_in_business}+` : "5.0"}</div><div className="text-sm font-semibold opacity-90">{b.years_in_business > 0 ? "Years experience" : "Star rating"}</div></div>
          <div className="overflow-hidden rounded-2xl"><img src={poolAt(1)} alt="" className="w-full h-full object-cover" /></div>
          <div className="col-span-2 overflow-hidden rounded-2xl"><img src={poolAt(2)} alt="" className="w-full h-full object-cover" /></div>
        </div>
      </section>

      {sec.services !== false && (
        <SectionLight id="services" kicker="What we do" title="Our Services" ctx={ctx}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((s, i) => (
              <div key={i} className={`p-6 ${th.radius} border hover:-translate-y-1 hover:shadow-xl`} style={{ borderColor: th.border, background: th.surface, boxShadow: "0 1px 2px rgba(0,0,0,.04)" }} data-testid={`site-service-${i}`}>
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
      {sec.why !== false && (
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
        <SectionLight id="gallery" kicker="Portfolio" title="Recent Work" ctx={ctx} alt>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.photos.slice(0, 8).map((p) => <div key={p.id} className={`overflow-hidden ${th.radius} aspect-square`}><img src={photoUrl(p.id)} alt={p.label} className="w-full h-full object-cover hover:scale-105 transition" /></div>)}
          </div>
        </SectionLight>
      )}

      {sec.reviews !== false && <ReviewsBlock ctx={ctx} />}
      {sec.faq !== false && <FaqBlock ctx={ctx} />}
      {sec.areas !== false && <AreasBlock ctx={ctx} />}
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
        <div className="max-w-6xl mx-auto px-5 h-16 grid grid-cols-3 items-center">
          <nav className="hidden md:flex gap-6 text-sm font-semibold" style={{ color: th.muted }}><a href="#services">Services</a><a href="#gallery">Work</a></nav>
          <div className="col-start-2 flex justify-center"><Brand ctx={ctx} center /></div>
          <div className="flex justify-end">{b.phone && <a href={`tel:${b.phone}`} data-testid="site-header-call" className={`px-5 h-10 ${th.btn} inline-flex items-center gap-2 text-sm`} style={{ background: accent, color: accentText }}><Phone className="w-4 h-4" /> Call</a>}</div>
        </div>
      </header>

      {/* Hero: padded rounded container */}
      <section className="px-4 md:px-6 pt-6 md:pt-10">
        <div className="max-w-6xl mx-auto relative overflow-hidden rounded-[2rem] md:rounded-[3rem] min-h-[460px] md:min-h-[600px] flex items-center">
          <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(20,16,12,.7), rgba(20,16,12,.25))" }} />
          <div className="relative p-8 md:p-16 text-white max-w-2xl wfade">
            <HeroBadges ctx={ctx} />
            <h1 className="wh font-bold text-4xl sm:text-5xl lg:text-6xl mt-5 leading-[1.05]">{w.headline || b.name}</h1>
            {w.subheadline && <p className="mt-5 text-lg md:text-xl text-white/85 font-light">{w.subheadline}</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={goContact} data-testid="site-hero-quote" className={`px-8 h-14 ${th.btn} inline-flex items-center gap-2`} style={{ background: accent, color: accentText }}>Request an Estimate</button>
              {b.phone && <a href={`tel:${b.phone}`} className={`px-8 h-14 ${th.btn} inline-flex items-center gap-2 bg-white/95 text-stone-900`}><Phone className="w-4 h-4" /> Call</a>}
            </div>
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
                <div key={i} className={`grid md:grid-cols-2 gap-6 md:gap-10 items-center ${i % 2 ? "md:[direction:rtl]" : ""}`} data-testid={`site-service-${i}`}>
                  <div className="overflow-hidden rounded-3xl shadow-lg [direction:ltr]"><img src={poolAt(i)} alt={s.name} className="w-full aspect-[4/3] object-cover hover:scale-105 transition duration-700" /></div>
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

      {sec.why !== false && (
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
        <SectionLight id="gallery" kicker="Portfolio" title="Recent Work" ctx={ctx} alt>
          <div className="columns-2 md:columns-3 gap-4">
            {data.photos.slice(0, 12).map((p, i) => <div key={p.id} className={`mb-4 overflow-hidden rounded-2xl ${i % 3 === 1 ? "md:mt-8" : ""}`}><img src={photoUrl(p.id)} alt={p.label} className="w-full object-cover" /></div>)}
          </div>
        </SectionLight>
      )}

      {sec.reviews !== false && <ReviewsBlock ctx={ctx} editorial />}
      {sec.faq !== false && <FaqBlock ctx={ctx} />}
      {sec.areas !== false && <AreasBlock ctx={ctx} />}
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
            {b.phone && <a href={`tel:${b.phone}`} data-testid="site-header-call" className={`hidden sm:inline-flex px-5 h-10 items-center gap-2 text-sm ${th.btn}`} style={{ background: accent, color: accentText }}><Phone className="w-4 h-4" /> Call Now</a>}
            <button className="md:hidden p-2" onClick={() => setMenu(!menu)} style={{ color: th.ink }}>{menu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}</button>
          </div>
        </div>
        {menu && <div className="md:hidden border-t px-5 py-3 space-y-1" style={{ borderColor: th.border }}>{nav.map(([l, id]) => <a key={id} href={`#${id}`} onClick={() => setMenu(false)} className="block py-2 font-semibold" style={{ color: th.ink }}>{l}</a>)}</div>}
      </header>

      {/* Centered hero with floating form */}
      <section className="relative">
        <div className="relative">
          <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(17,24,39,.78), rgba(17,24,39,.62))" }} />
          <div className="relative max-w-3xl mx-auto px-5 pt-20 pb-40 md:pb-52 text-center text-white wfade">
            <div className="flex justify-center"><HeroBadges ctx={ctx} /></div>
            <h1 className="wh font-extrabold tracking-tight text-4xl sm:text-5xl lg:text-6xl mt-5 leading-[1.05]">{w.headline || b.name}</h1>
            {w.subheadline && <p className="mt-5 text-lg md:text-xl text-white/85 max-w-2xl mx-auto">{w.subheadline}</p>}
            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              <button onClick={goContact} data-testid="site-hero-quote" className={`px-8 h-14 ${th.btn} inline-flex items-center gap-2`} style={{ background: accent, color: accentText }}>Get a Free Quote</button>
              {b.phone && <a href={`tel:${b.phone}`} data-testid="site-hero-call" className={`px-8 h-14 ${th.btn} inline-flex items-center gap-2 bg-white text-gray-900`}><Phone className="w-5 h-5" /> Call Now</a>}
            </div>
          </div>
        </div>
        {/* floating form overlapping */}
        <div id="contact" className="max-w-4xl mx-auto px-5 -mt-28 md:-mt-36 relative z-10">
          <div className={`p-6 md:p-8 ${th.radius} shadow-2xl`} style={{ background: th.surface, border: `1px solid ${th.border}` }}>
            <h2 className="wh font-extrabold text-2xl mb-1" style={{ color: th.ink }}>Get Your Free Estimate</h2>
            <p className="text-sm mb-4" style={{ color: th.muted }}>Fast response · No obligation</p>
            <LeadForm ctx={ctx} inline />
          </div>
        </div>
      </section>

      {sec.services !== false && (
        <SectionLight id="services" kicker="What we do" title="Our Services" ctx={ctx}>
          <div className="space-y-10">
            {services.map((s, i) => (
              <div key={i} className={`grid md:grid-cols-2 gap-6 items-center ${i % 2 ? "" : "md:[direction:rtl]"}`} data-testid={`site-service-${i}`}>
                <div className="overflow-hidden rounded-lg shadow-lg [direction:ltr]"><img src={poolAt(i)} alt={s.name} className="w-full aspect-video object-cover" /></div>
                <div className="[direction:ltr]">
                  <h3 className="wh font-extrabold text-2xl" style={{ color: th.ink }}>{s.name}</h3>
                  {s.description && <p className="mt-2" style={{ color: th.muted }}>{s.description}</p>}
                  {s.starting_price && <p className="mt-2 font-bold" style={{ color: accent }}>{s.starting_price}</p>}
                  <button onClick={goContact} className={`mt-4 px-5 h-11 ${th.btn} inline-flex items-center gap-2`} style={{ background: accent, color: accentText }}>Get a quote</button>
                </div>
              </div>
            ))}
          </div>
        </SectionLight>
      )}

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

      {sec.why !== false && (
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
        <SectionLight id="gallery" kicker="See our work" title="Recent Projects" ctx={ctx} alt>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {data.photos.slice(0, 9).map((p) => <div key={p.id} className={`overflow-hidden ${th.radius} aspect-[4/3] shadow-md`}><img src={photoUrl(p.id)} alt={p.label} className="w-full h-full object-cover hover:scale-105 transition" /></div>)}
          </div>
        </SectionLight>
      )}

      {sec.reviews !== false && <ReviewsBlock ctx={ctx} />}
      {sec.faq !== false && <FaqBlock ctx={ctx} />}
      {sec.areas !== false && <AreasBlock ctx={ctx} />}
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
      <span className="wh font-bold text-lg truncate" style={{ color: light ? "#fff" : th.ink }}>{b.name}</span>
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

function SectionLight({ id, kicker, title, ctx, alt, children }) {
  const { th } = ctx;
  return (
    <section id={id} className="py-16 md:py-24" style={alt ? { background: th.surface } : undefined}>
      <div className="max-w-6xl mx-auto px-5">
        <Kicker ctx={ctx}>{kicker}</Kicker>
        <h2 className="wh text-3xl md:text-4xl font-extrabold mb-8" style={{ color: th.ink }}>{title}</h2>
        {children}
      </div>
    </section>
  );
}
function SectionDark({ id, kicker, title, ctx, alt, children }) {
  const { th } = ctx;
  return (
    <section id={id} className="py-20 md:py-28" style={{ background: alt ? th.surface : th.bg }}>
      <div className="max-w-6xl mx-auto px-5">
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
                <p className="wh italic text-2xl md:text-3xl leading-snug mt-3" style={{ color: th.ink }}>"{r.text}"</p>
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

function FaqBlock({ ctx }) {
  const { w, th, accent } = ctx;
  return (
    <SectionLight id="faq" kicker="Good to know" title="Frequently Asked Questions" ctx={ctx}>
      <div className="max-w-3xl space-y-3">
        {(w.faqs?.length ? w.faqs : DEFAULT_FAQ).map((f, i) => <FaqItem key={i} q={f.q} a={f.a} th={th} accent={accent} />)}
      </div>
    </SectionLight>
  );
}
function FaqItem({ q, a, th, accent }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`overflow-hidden ${th.radius}`} style={{ background: th.surface, border: `1px solid ${th.border}` }} data-testid="site-faq-item">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 p-5 text-left">
        <span className="font-bold text-base" style={{ color: th.ink }}>{q}</span>
        <span className="flex-none w-7 h-7 rounded-full flex items-center justify-center font-bold transition-transform" style={{ background: accent, color: isLight(accent) ? "#0A0A0A" : "#fff", transform: open ? "rotate(45deg)" : "none" }}>+</span>
      </button>
      {open && <div className="px-5 pb-5 -mt-1 text-sm leading-relaxed" style={{ color: th.muted }}>{a}</div>}
    </div>
  );
}

function AreasBlock({ ctx }) {
  const { w, data, th, accent } = ctx;
  if (!(w.areas?.length || data.service_area)) return null;
  const areas = w.areas?.length ? w.areas : (data.service_area ? [data.service_area] : []);
  return (
    <SectionLight id="areas" kicker="Local & nearby" title="Areas We Serve" ctx={ctx} alt>
      {data.service_area && <p className="mb-6" style={{ color: th.muted }}>Proudly serving {data.service_area} and surrounding communities.</p>}
      <div className="flex flex-wrap gap-2.5">
        {areas.map((a, i) => <span key={i} className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold ${th.radius}`} style={{ background: `${accent}14`, color: th.ink, border: `1px solid ${accent}33` }}><MapPin className="w-4 h-4" style={{ color: accent }} /> {a}</span>)}
      </div>
    </SectionLight>
  );
}

function ContactBlock({ ctx }) {
  const { b, data, th, accent, accentText, w } = ctx;
  const sec = w.sections || {};
  return (
    <SectionLight id="contact" kicker="Let's talk" title="Get Your Free Estimate" ctx={ctx}>
      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-5">
          <p className="text-lg leading-relaxed" style={{ color: th.muted }}>Tell us about your project and we'll get back to you fast — no obligation.</p>
          {b.phone && <a href={`tel:${b.phone}`} data-testid="site-contact-call" className="flex items-center gap-3 font-bold text-lg" style={{ color: th.ink }}><span className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: accent, color: accentText }}><Phone className="w-5 h-5" /></span> {b.phone}</a>}
          {(sec.booking || data.appt_enabled) && data.card_slug && <a href={`/c/${data.card_slug}`} className={`inline-flex items-center gap-2 px-5 h-12 ${th.btn} border-2`} style={{ borderColor: accent, color: accent }}><Calendar className="w-4 h-4" /> Book an appointment</a>}
          <div className="flex items-center gap-2 pt-1"><Stars n={5} /><span className="text-sm font-semibold" style={{ color: th.muted }}>Trusted by our community</span></div>
        </div>
        <LeadForm ctx={ctx} />
      </div>
    </SectionLight>
  );
}

function FooterBlock({ ctx }) {
  const { b, th, accent, accentText, goContact } = ctx;
  return (
    <footer className="py-20 relative overflow-hidden" style={{ background: th.dark ? "#000" : "#0F172A", color: "#fff" }}>
      <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full blur-3xl opacity-20" style={{ background: accent }} />
      <div className="max-w-6xl mx-auto px-5 relative">
        <div className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: accent }}>Ready when you are</div>
        <h2 className="wh font-extrabold text-4xl md:text-5xl max-w-2xl leading-tight">Let's get your project done right.</h2>
        <div className="mt-8 flex flex-wrap gap-3">
          <button onClick={goContact} data-testid="site-footer-quote" className={`px-8 h-14 font-bold ${th.btn} inline-flex items-center gap-2 hover:-translate-y-0.5`} style={{ background: accent, color: accentText }}>Get Your Free Estimate <ArrowRight className="w-4 h-4" /></button>
          {b.phone && <a href={`tel:${b.phone}`} className={`px-8 h-14 inline-flex items-center gap-2 ${th.btn} bg-white/10 hover:bg-white/20 font-bold`}><Phone className="w-4 h-4" /> {b.phone}</a>}
        </div>
        <div className="mt-12 pt-6 border-t border-white/15 text-sm text-white/60 flex flex-wrap justify-between gap-3">
          <span>© {new Date().getFullYear()} {b.name}. All rights reserved.</span><span>Powered by UniTech</span>
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
      <button onClick={goContact} data-testid="site-sticky-quote" className={`flex-1 h-12 font-bold ${th.btn}`} style={{ background: accent, color: accentText }}>Free Quote</button>
    </div>
  );
}

function Stars({ n = 5 }) {
  return <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className="w-4 h-4" style={{ fill: i <= n ? "#F5B301" : "none", color: i <= n ? "#F5B301" : "#D1D5DB" }} />)}</div>;
}

function LeadForm({ ctx, inline }) {
  const { slug, th, accent, accentText, data } = ctx;
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
      <h3 className="wh font-bold text-2xl mt-3" style={{ color: th.ink }}>Thank you!</h3>
      <p className="mt-2 text-sm" style={{ color: th.muted }}>We received your request and will contact you shortly.</p>
    </div>
  );
  const body = (
    <form onSubmit={submit} className={inline ? "grid sm:grid-cols-2 gap-3" : `p-6 space-y-3 ${th.radius}`} style={inline ? undefined : { background: th.surface, border: `1px solid ${th.border}` }} data-testid="site-lead-form">
      <input required data-testid="site-lead-name" placeholder="Your name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} style={inpStyle} />
      <input required data-testid="site-lead-phone" placeholder="Phone *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inp} style={inpStyle} />
      <input type="email" data-testid="site-lead-email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={`${inp} ${inline ? "sm:col-span-2" : ""}`} style={inpStyle} />
      {services?.length > 0 && (
        <select data-testid="site-lead-service" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} className={`${inp} ${inline ? "sm:col-span-2" : ""}`} style={inpStyle}>
          <option value="">What do you need?</option>
          {services.map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
        </select>
      )}
      <textarea placeholder="Tell us about your project" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`w-full min-h-[84px] p-4 rounded-xl border outline-none focus-visible:ring-2 ${inline ? "sm:col-span-2" : ""}`} style={inpStyle} />
      <button type="submit" disabled={sending} data-testid="site-lead-submit" className={`h-13 py-3.5 font-bold flex items-center justify-center gap-2 ${th.btn} ${inline ? "sm:col-span-2" : "w-full"}`} style={{ background: accent, color: accentText }}>
        {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> Send Request</>}
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
