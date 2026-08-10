import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Phone, MapPin, Clock, Star, ShieldCheck, CheckCircle2, Calendar, Send, Loader2, Menu, X, ArrowRight, Quote } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const photoUrl = (id) => (id ? `${API}/public/card/photo/${id}` : null);

// ---------------------------------------------------------------------------
// Per-template visual system (image-forward, premium). Accent color is dynamic.
// ---------------------------------------------------------------------------
const TPL = {
  bold: {
    name: "Bold & Industrial",
    dark: true,
    fonts: "'Anton', sans-serif", body: "'Manrope', sans-serif",
    heading: "font-normal tracking-wide uppercase",
    bg: "#0B0B0C", surface: "#151517", surface2: "#1E1E21", ink: "#FFFFFF", muted: "#A1A1AA", border: "#2A2A2E",
    card: "rounded-none border border-[#2A2A2E]",
    btn: "rounded-none uppercase tracking-[0.15em] font-bold",
    radius: "rounded-none",
    heroOverlay: "linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.35) 40%, rgba(0,0,0,.85) 100%)",
    footerBg: "#000000",
  },
  clean: {
    name: "Clean & Modern",
    dark: false,
    fonts: "'Outfit', sans-serif", body: "'IBM Plex Sans', sans-serif",
    heading: "font-bold tracking-tight",
    bg: "#FFFFFF", surface: "#F6F8FB", surface2: "#EEF2F7", ink: "#0F172A", muted: "#64748B", border: "#E5E9F0",
    card: "rounded-2xl border border-slate-100 shadow-sm",
    btn: "rounded-xl font-semibold",
    radius: "rounded-2xl",
    heroOverlay: "linear-gradient(90deg, rgba(15,23,42,.92) 0%, rgba(15,23,42,.6) 45%, rgba(15,23,42,.15) 100%)",
    footerBg: "#0F172A",
  },
  warm: {
    name: "Warm & Trustworthy",
    dark: false,
    fonts: "'Playfair Display', serif", body: "'Nunito', sans-serif",
    heading: "font-semibold tracking-normal",
    bg: "#FAF8F4", surface: "#FFFFFF", surface2: "#F3EEE4", ink: "#2A2723", muted: "#7A736A", border: "#ECE4D5",
    card: "rounded-3xl border border-[#ECE4D5] shadow-[0_12px_40px_rgba(0,0,0,0.06)]",
    btn: "rounded-full font-bold",
    radius: "rounded-3xl",
    heroOverlay: "linear-gradient(180deg, rgba(42,39,35,.35) 0%, rgba(42,39,35,.25) 50%, rgba(42,39,35,.6) 100%)",
    footerBg: "#2A2723",
  },
};

// Trade-aware professional stock fallbacks so a site is NEVER empty.
const STOCK = {
  clean: {
    hero: "https://images.unsplash.com/photo-1749532125405-70950966b0e5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTV8MHwxfHNlYXJjaHwyfHxwbHVtYmluZyUyMHByb2Zlc3Npb25hbHxlbnwwfHx8fDE3ODYzMzkzNTN8MA&ixlib=rb-4.1.0&q=85&w=1600",
    imgs: [
      "https://images.unsplash.com/photo-1581783898377-1c85bf937427?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2OTF8MHwxfHNlYXJjaHwxfHxoYW5keW1hbnxlbnwwfHx8fDE3ODYzMzk0NDF8MA&ixlib=rb-4.1.0&q=85&w=900",
      "https://images.unsplash.com/photo-1426927308491-6380b6a9936f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2OTF8MHwxfHNlYXJjaHw0fHxoYW5keW1hbnxlbnwwfHx8fDE3ODYzMzk0NDF8MA&ixlib=rb-4.1.0&q=85&w=900",
      "https://images.unsplash.com/photo-1676311396794-f14881e9daaa?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2OTF8MHwxfHNlYXJjaHwzfHxoYW5keW1hbnxlbnwwfHx8fDE3ODYzMzk0NDF8MA&ixlib=rb-4.1.0&q=85&w=900",
      "https://images.unsplash.com/photo-1503789146722-cf137a3c0fea?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA4Mzl8MHwxfHNlYXJjaHwzfHxwbHVtYmluZ3xlbnwwfHx8fDE3ODYzMzk0NDF8MA&ixlib=rb-4.1.0&q=85&w=900",
    ],
  },
  bold: {
    hero: "https://images.unsplash.com/photo-1633759593085-1eaeb724fc88?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1Mjh8MHwxfHNlYXJjaHw0fHxyb29maW5nJTIwY29udHJhY3RvcnxlbnwwfHx8fDE3ODYzMzkzNTN8MA&ixlib=rb-4.1.0&q=85&w=1600",
    imgs: [
      "https://images.unsplash.com/photo-1635424709961-f3a150459ad4?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzF8MHwxfHNlYXJjaHw0fHxyb29maW5nfGVufDB8fHx8MTc4NjMzOTQzMnww&ixlib=rb-4.1.0&q=85&w=900",
      "https://images.unsplash.com/photo-1558227691-41ea78d1f631?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzF8MHwxfHNlYXJjaHwzfHxyb29maW5nfGVufDB8fHx8MTc4NjMzOTQzMnww&ixlib=rb-4.1.0&q=85&w=900",
      "https://images.unsplash.com/photo-1635424709845-3a85ad5e1f5e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzF8MHwxfHNlYXJjaHwyfHxyb29maW5nfGVufDB8fHx8MTc4NjMzOTQzMnww&ixlib=rb-4.1.0&q=85&w=900",
      "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzF8MHwxfHNlYXJjaHwxfHxyb29maW5nfGVufDB8fHx8MTc4NjMzOTQzMnww&ixlib=rb-4.1.0&q=85&w=900",
    ],
  },
  warm: {
    hero: "https://images.unsplash.com/photo-1734303023491-db8037a21f09?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHwyfHxsYW5kc2NhcGluZyUyMHByb2Zlc3Npb25hbHxlbnwwfHx8fDE3ODYzMzkzNTN8MA&ixlib=rb-4.1.0&q=85&w=1600",
    imgs: [
      "https://images.unsplash.com/photo-1458245201577-fc8a130b8829?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjV8MHwxfHNlYXJjaHwyfHxsYW5kc2NhcGluZ3xlbnwwfHx8fDE3ODYzMzk0MzJ8MA&ixlib=rb-4.1.0&q=85&w=900",
      "https://images.unsplash.com/photo-1734079692160-fcbe4be6ab96?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjV8MHwxfHNlYXJjaHwxfHxsYW5kc2NhcGluZ3xlbnwwfHx8fDE3ODYzMzk0MzJ8MA&ixlib=rb-4.1.0&q=85&w=900",
      "https://images.unsplash.com/photo-1558904541-efa843a96f01?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjV8MHwxfHNlYXJjaHw0fHxsYW5kc2NhcGluZ3xlbnwwfHx8fDE3ODYzMzk0MzJ8MA&ixlib=rb-4.1.0&q=85&w=900",
      "https://images.unsplash.com/photo-1734303023491-db8037a21f09?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHwyfHxsYW5kc2NhcGluZyUyMHByb2Zlc3Npb25hbHxlbnwwfHx8fDE3ODYzMzkzNTN8MA&ixlib=rb-4.1.0&q=85&w=900",
    ],
  },
};

// Pick fallback set: template default, overridden by business_type keywords.
function stockFor(template, businessType = "") {
  const s = (businessType || "").toLowerCase();
  if (/(roof|hvac|concret|constru|remodel|excav|demol|paver|deck|fenc)/.test(s)) return STOCK.bold;
  if (/(landscap|lawn|garden|clean|maid|janitor|paint|tree|pressure)/.test(s)) return STOCK.warm;
  if (/(plumb|electric|handyman|drain|appliance|repair|hvac)/.test(s)) return STOCK.clean;
  return STOCK[template] || STOCK.clean;
}

function isLightColor(hex) {
  if (!hex) return false;
  const c = hex.replace("#", "");
  if (c.length < 6) return false;
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 155;
}

export default function ContractorSite() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const [menu, setMenu] = useState(false);
  const contactRef = useRef(null);

  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Anton&family=Manrope:wght@400;600;700;800&family=Outfit:wght@400;600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=Playfair+Display:wght@500;600;700;800&family=Nunito:wght@400;600;700;800&display=swap";
    document.head.appendChild(l);
    return () => { document.head.removeChild(l); };
  }, []);

  useEffect(() => {
    axios.get(`${API}/public/website/${slug}`)
      .then((r) => setData(r.data))
      .catch(() => setErr(true));
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
  const t = TPL[w.template] || TPL.clean;
  const accent = w.accent_color || "#007AFF";
  const accentText = isLightColor(accent) ? "#0A0A0A" : "#FFFFFF";
  const b = data.business;
  const sec = w.sections || {};
  const stock = stockFor(w.template, b.business_type);
  const realPhotos = (data.photos || []).map((p) => photoUrl(p.id));
  const heroImg = photoUrl(w.hero_photo_id) || realPhotos[0] || stock.hero;
  // pool of images used to decorate service cards / how-it-works (real first, then stock)
  const imgPool = [...realPhotos, ...stock.imgs];
  const poolAt = (i) => imgPool[i % imgPool.length];

  const scrollToContact = () => contactRef.current?.scrollIntoView({ behavior: "smooth" });
  const nav = [
    sec.services !== false && ["Services", "services"],
    sec.gallery !== false && data.photos.length > 0 && ["Work", "gallery"],
    sec.reviews !== false && ["Reviews", "reviews"],
    sec.faq !== false && ["FAQ", "faq"],
    sec.contact !== false && ["Contact", "contact"],
  ].filter(Boolean);

  const ctx = { t, accent, accentText, b, data, w, sec, poolAt, scrollToContact };

  return (
    <div style={{ background: t.bg, color: t.ink, fontFamily: t.body }} className="min-h-screen antialiased">
      <style>{`
        .wsite-h{font-family:${t.fonts}}
        .wsite a,.wsite button{transition:transform .2s ease,box-shadow .2s ease,background-color .2s ease,opacity .2s ease,color .2s}
        .wsite ::selection{background:${accent};color:${accentText}}
        @keyframes wfade{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
        .wfade{animation:wfade .7s ease both}
      `}</style>
      <div className="wsite pb-20 md:pb-0">
        {/* ===== Header ===== */}
        <Header ctx={ctx} nav={nav} menu={menu} setMenu={setMenu} />

        {/* ===== Hero ===== */}
        <Hero ctx={ctx} heroImg={heroImg} />

        {/* ===== Trust strip ===== */}
        <TrustStrip ctx={ctx} />

        {/* ===== Services ===== */}
        {sec.services !== false && <Services ctx={ctx} />}

        {/* ===== How It Works ===== */}
        {sec.how !== false && <HowItWorks ctx={ctx} />}

        {/* ===== Why Choose Us ===== */}
        {sec.why !== false && <WhyUs ctx={ctx} />}

        {/* ===== Gallery ===== */}
        {sec.gallery !== false && data.photos.length > 0 && <Gallery ctx={ctx} />}

        {/* ===== Reviews ===== */}
        {sec.reviews !== false && <Reviews ctx={ctx} />}

        {/* ===== FAQ ===== */}
        {sec.faq !== false && (
          <Section id="faq" title="Frequently Asked Questions" kicker="Good to know" t={t} accent={accent} alt>
            <div className="max-w-3xl space-y-3">
              {(w.faqs?.length ? w.faqs : DEFAULT_FAQ).map((f, i) => (
                <FaqItem key={i} q={f.q} a={f.a} t={t} accent={accent} />
              ))}
            </div>
          </Section>
        )}

        {/* ===== Areas We Serve ===== */}
        {sec.areas !== false && (w.areas?.length || data.service_area) && (
          <Section id="areas" title="Areas We Serve" kicker="Local & nearby" t={t} accent={accent}>
            {data.service_area && <p className="mb-6 text-base" style={{ color: t.muted }}>Proudly serving {data.service_area} and surrounding communities.</p>}
            <div className="flex flex-wrap gap-2.5">
              {(w.areas?.length ? w.areas : (data.service_area ? [data.service_area] : [])).map((a, i) => (
                <span key={i} className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold ${t.radius}`} style={{ background: `${accent}14`, color: t.ink, border: `1px solid ${accent}33` }}>
                  <MapPin className="w-4 h-4" style={{ color: accent }} /> {a}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* ===== About ===== */}
        {sec.about !== false && (w.about || data.hours || data.service_area) && (
          <Section id="about" title="About Us" kicker="Who we are" t={t} accent={accent} alt>
            <div className="grid md:grid-cols-5 gap-8 items-start">
              <div className="md:col-span-3">
                {w.about && <p className="text-lg leading-loose" style={{ color: t.muted }}>{w.about}</p>}
                <div className="mt-6 flex flex-wrap gap-2">
                  {b.is_licensed && <Chip t={t} accent={accent}><ShieldCheck className="w-4 h-4" /> Licensed</Chip>}
                  {b.is_insured && <Chip t={t} accent={accent}><ShieldCheck className="w-4 h-4" /> Insured</Chip>}
                  {b.years_in_business > 0 && <Chip t={t} accent={accent}>{b.years_in_business}+ Years Experience</Chip>}
                </div>
              </div>
              <div className="md:col-span-2 space-y-4">
                {data.service_area && <InfoRow t={t} accent={accent} icon={MapPin} label="Service Area" value={data.service_area} />}
                {data.hours && <InfoRow t={t} accent={accent} icon={Clock} label="Hours" value={data.hours} />}
                {b.address && <InfoRow t={t} accent={accent} icon={MapPin} label="Address" value={b.address} />}
              </div>
            </div>
          </Section>
        )}

        {/* ===== Contact ===== */}
        {sec.contact !== false && (
          <div ref={contactRef}>
            <Section id="contact" title="Get Your Free Estimate" kicker="Let's talk" t={t} accent={accent}>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-5">
                  <p className="text-lg leading-relaxed" style={{ color: t.muted }}>Tell us about your project and we'll get back to you fast — no obligation.</p>
                  {b.phone && <a href={`tel:${b.phone}`} data-testid="site-contact-call" className="flex items-center gap-3 font-bold text-lg" style={{ color: t.ink }}><span className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: accent, color: accentText }}><Phone className="w-5 h-5" /></span> {b.phone}</a>}
                  {(sec.booking || data.appt_enabled) && data.card_slug && (
                    <a href={`/c/${data.card_slug}`} className={`inline-flex items-center gap-2 px-5 h-12 ${t.btn} border-2`} style={{ borderColor: accent, color: accent }}><Calendar className="w-4 h-4" /> Book an appointment</a>
                  )}
                  <div className="flex items-center gap-2 pt-2">
                    <Stars n={5} /><span className="text-sm font-semibold" style={{ color: t.muted }}>Trusted by our local community</span>
                  </div>
                </div>
                <LeadForm slug={slug} t={t} accent={accent} accentText={accentText} services={data.services} />
              </div>
            </Section>
          </div>
        )}

        {/* ===== Footer CTA ===== */}
        <footer className="py-20 mt-2 relative overflow-hidden" style={{ background: t.footerBg, color: "#fff" }}>
          <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full blur-3xl opacity-20" style={{ background: accent }} />
          <div className="max-w-6xl mx-auto px-4 relative">
            <div className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: accent }}>Ready when you are</div>
            <h2 className={`wsite-h ${t.heading} text-4xl md:text-5xl max-w-2xl leading-tight`}>Let's get your project done right.</h2>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={scrollToContact} data-testid="site-footer-quote" className={`px-8 h-14 font-bold ${t.btn} hover:-translate-y-0.5 inline-flex items-center gap-2`} style={{ background: accent, color: accentText }}>Get Your Free Estimate <ArrowRight className="w-4 h-4" /></button>
              {b.phone && <a href={`tel:${b.phone}`} className={`px-8 h-14 inline-flex items-center gap-2 ${t.btn} bg-white/10 hover:bg-white/20 font-bold`}><Phone className="w-4 h-4" /> {b.phone}</a>}
            </div>
            <div className="mt-12 pt-6 border-t border-white/15 text-sm text-white/60 flex flex-wrap justify-between gap-3">
              <span>© {new Date().getFullYear()} {b.name}. All rights reserved.</span>
              <span>Powered by UniTech</span>
            </div>
          </div>
        </footer>
      </div>

      {/* ===== Sticky mobile CTA ===== */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-50 flex gap-2 p-3 border-t shadow-[0_-4px_20px_rgba(0,0,0,0.12)]" style={{ background: t.surface, borderColor: t.border, paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}>
        {b.phone && <a href={`tel:${b.phone}`} data-testid="site-sticky-call" className={`flex-1 h-12 inline-flex items-center justify-center gap-2 font-bold ${t.btn} border-2`} style={{ borderColor: accent, color: accent }}><Phone className="w-4 h-4" /> Call</a>}
        <button onClick={scrollToContact} data-testid="site-sticky-quote" className={`flex-1 h-12 font-bold ${t.btn}`} style={{ background: accent, color: accentText }}>Free Quote</button>
      </div>
    </div>
  );
}

// ===========================================================================
// Sections
// ===========================================================================
function Header({ ctx, nav, menu, setMenu }) {
  const { t, accent, accentText, b, w } = ctx;
  const isWarm = w.template === "warm";
  const logo = photoUrl(b.logo_photo_id);
  const inner = (
    <div className={`max-w-6xl mx-auto px-4 h-16 flex items-center justify-between ${isWarm ? "md:h-14" : ""}`}>
      <div className="flex items-center gap-2.5 min-w-0">
        {logo
          ? <img src={logo} alt="logo" className="w-9 h-9 rounded-lg object-cover flex-none" />
          : <div className="w-9 h-9 rounded-lg flex-none flex items-center justify-center font-bold" style={{ background: accent, color: accentText }}>{(b.name || "?")[0]}</div>}
        <span className={`wsite-h ${t.heading} text-lg truncate`} style={{ color: t.ink }}>{b.name}</span>
      </div>
      <nav className="hidden md:flex items-center gap-7 text-sm font-semibold" style={{ color: t.muted }}>
        {nav.map(([label, id]) => <a key={id} href={`#${id}`} className="hover:opacity-70" style={{ color: t.muted }}>{label}</a>)}
      </nav>
      <div className="flex items-center gap-2">
        {b.phone && <a href={`tel:${b.phone}`} data-testid="site-header-call" className={`hidden sm:inline-flex items-center gap-2 px-4 h-10 text-sm ${t.btn}`} style={{ background: accent, color: accentText }}><Phone className="w-4 h-4" /> Call Now</a>}
        <button className="md:hidden p-2" aria-label="menu" onClick={() => setMenu(!menu)} style={{ color: t.ink }}>{menu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}</button>
      </div>
    </div>
  );
  if (isWarm) {
    return (
      <header className="sticky top-0 z-40 pt-3 px-3">
        <div className="max-w-6xl mx-auto rounded-full backdrop-blur-xl shadow-sm" style={{ background: `${t.surface}e6`, border: `1px solid ${t.border}` }}>{inner}</div>
        {menu && (
          <div className="md:hidden mt-2 rounded-2xl px-4 py-3 space-y-1" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
            {nav.map(([label, id]) => <a key={id} href={`#${id}`} onClick={() => setMenu(false)} className="block py-2 font-semibold" style={{ color: t.ink }}>{label}</a>)}
          </div>
        )}
      </header>
    );
  }
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl border-b" style={{ background: `${t.surface}e6`, borderColor: w.template === "bold" ? accent : t.border, borderBottomWidth: w.template === "bold" ? 3 : 1 }}>
      {inner}
      {menu && (
        <div className="md:hidden border-t px-4 py-3 space-y-1" style={{ borderColor: t.border, background: t.surface }}>
          {nav.map(([label, id]) => <a key={id} href={`#${id}`} onClick={() => setMenu(false)} className="block py-2 font-semibold" style={{ color: t.ink }}>{label}</a>)}
        </div>
      )}
    </header>
  );
}

function Hero({ ctx, heroImg }) {
  const { t, accent, accentText, b, w, scrollToContact } = ctx;
  const isWarm = w.template === "warm";
  const isBold = w.template === "bold";
  const badges = (
    <div className={`flex flex-wrap gap-2 ${isBold ? "justify-center" : ""}`}>
      {b.is_licensed && <HeroBadge><ShieldCheck className="w-3.5 h-3.5" /> Licensed</HeroBadge>}
      {b.is_insured && <HeroBadge><ShieldCheck className="w-3.5 h-3.5" /> Insured</HeroBadge>}
      {b.years_in_business > 0 && <HeroBadge>{b.years_in_business}+ Years</HeroBadge>}
      <HeroBadge><Star className="w-3.5 h-3.5" style={{ fill: "#F5B301", color: "#F5B301" }} /> 5-Star Rated</HeroBadge>
    </div>
  );
  const content = (
    <div className={`wfade ${isBold ? "text-center mx-auto max-w-3xl" : "max-w-2xl"}`}>
      {badges}
      <h1 className={`wsite-h ${t.heading} text-4xl sm:text-5xl lg:text-6xl mt-5 leading-[1.04] drop-shadow-md`}>{w.headline || b.name}</h1>
      {w.subheadline && <p className={`mt-5 text-lg md:text-xl text-white/90 ${isBold ? "mx-auto" : ""} max-w-xl`}>{w.subheadline}</p>}
      <div className={`mt-8 flex flex-wrap gap-3 ${isBold ? "justify-center" : ""}`}>
        <button onClick={scrollToContact} data-testid="site-hero-quote" className={`px-8 h-14 text-base ${t.btn} shadow-xl hover:-translate-y-0.5 inline-flex items-center gap-2`} style={{ background: accent, color: accentText }}>Get a Free Quote <ArrowRight className="w-4 h-4" /></button>
        {b.phone && <a href={`tel:${b.phone}`} data-testid="site-hero-call" className={`px-8 h-14 inline-flex items-center gap-2 bg-white text-base ${t.btn} hover:-translate-y-0.5`} style={{ color: "#111" }}><Phone className="w-5 h-5" /> Call Now</a>}
      </div>
    </div>
  );

  if (isWarm) {
    return (
      <section className="px-3 md:px-4 pt-5 md:pt-8">
        <div className="max-w-6xl mx-auto relative overflow-hidden rounded-[2rem] min-h-[440px] md:min-h-[560px] flex items-end">
          <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: t.heroOverlay }} />
          <div className="relative p-6 md:p-14 text-white w-full">{content}</div>
        </div>
      </section>
    );
  }
  return (
    <section className="relative">
      <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0" style={{ background: t.heroOverlay }} />
      <div className={`relative max-w-6xl mx-auto px-4 py-24 md:py-36 text-white ${isBold ? "flex justify-center" : ""}`}>{content}</div>
    </section>
  );
}

function TrustStrip({ ctx }) {
  const { t, accent, b, data } = ctx;
  const items = [
    b.years_in_business > 0 && [`${b.years_in_business}+`, "Years Experience"],
    (b.is_licensed || b.is_insured) && ["100%", "Licensed & Insured"],
    ["5.0", "Average Rating"],
    ["Fast", "Free Estimates"],
  ].filter(Boolean);
  return (
    <div style={{ background: accent }}>
      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map(([big, small], i) => {
          const txt = isLightColor(accent) ? "#0A0A0A" : "#FFFFFF";
          return (
            <div key={i} className="text-center" style={{ color: txt }}>
              <div className={`wsite-h ${t.heading} text-3xl md:text-4xl`}>{big}</div>
              <div className="text-xs md:text-sm font-semibold opacity-90 mt-0.5">{small}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Services({ ctx }) {
  const { t, accent, accentText, b, data, poolAt } = ctx;
  const services = data.services.length ? data.services : DEFAULT_SERVICES;
  return (
    <Section id="services" title="Our Services" kicker="What we do" t={t} accent={accent}>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((s, i) => (
          <div key={i} className={`group overflow-hidden ${t.card} hover:-translate-y-1 hover:shadow-lg`} style={{ background: t.surface }} data-testid={`site-service-${i}`}>
            <div className="relative aspect-[16/10] overflow-hidden">
              <img src={poolAt(i)} alt={s.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,rgba(0,0,0,0) 40%,rgba(0,0,0,.35) 100%)" }} />
            </div>
            <div className="p-5">
              <h3 className={`wsite-h ${t.heading} text-xl`} style={{ color: t.ink }}>{s.name}</h3>
              {s.description && <p className="mt-2 text-sm leading-relaxed" style={{ color: t.muted }}>{s.description}</p>}
              {s.starting_price && <p className="mt-3 text-sm font-bold" style={{ color: accent }}>{s.starting_price}</p>}
              {b.phone && <a href={`tel:${b.phone}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: accent }}><Phone className="w-4 h-4" /> Call now</a>}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function HowItWorks({ ctx }) {
  const { t, accent, accentText, w } = ctx;
  const steps = w.how_it_works?.length ? w.how_it_works : DEFAULT_HOW;
  const isBold = w.template === "bold";
  return (
    <Section id="how" title="How It Works" kicker="Simple & easy" t={t} accent={accent} alt>
      <div className="grid sm:grid-cols-3 gap-6">
        {steps.map((s, i) => (
          <div key={i} className={`p-6 ${t.card} relative`} style={{ background: t.bg }}>
            {isBold ? (
              <div className="wsite-h text-6xl leading-none mb-3" style={{ color: "transparent", WebkitTextStroke: `2px ${accent}` }}>{String(i + 1).padStart(2, "0")}</div>
            ) : (
              <div className="w-12 h-12 rounded-full flex items-center justify-center font-black text-xl mb-4" style={{ background: accent, color: accentText }}>{i + 1}</div>
            )}
            <h3 className={`wsite-h ${t.heading} text-lg`} style={{ color: t.ink }}>{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: t.muted }}>{s.desc}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function WhyUs({ ctx }) {
  const { t, accent, w } = ctx;
  const items = w.why_us?.length ? w.why_us : DEFAULT_WHY;
  return (
    <Section id="why" title="Why Choose Us" kicker="The difference" t={t} accent={accent}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((s, i) => {
          const WhyIcon = [Clock, ShieldCheck, CheckCircle2, Star][i % 4];
          return (
            <div key={i} className={`p-6 ${t.card} text-center`} style={{ background: w.template === "warm" ? `${accent}0d` : t.surface }}>
              <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3" style={{ background: `${accent}1a` }}>
                <WhyIcon className="w-6 h-6" style={{ color: accent }} />
              </div>
              <h3 className={`wsite-h ${t.heading} text-base`} style={{ color: t.ink }}>{s.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed" style={{ color: t.muted }}>{s.desc}</p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function Gallery({ ctx }) {
  const { t, data } = ctx;
  return (
    <Section id="gallery" title="Recent Work" kicker="See our craftsmanship" t={t} accent={ctx.accent} alt>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {data.photos.slice(0, 12).map((p) => (
          <div key={p.id} className={`overflow-hidden ${t.radius} aspect-square group`}>
            <img src={photoUrl(p.id)} alt={p.label} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
          </div>
        ))}
      </div>
    </Section>
  );
}

function Reviews({ ctx }) {
  const { t, accent, b, data } = ctx;
  return (
    <Section id="reviews" title="What Our Customers Say" kicker="Real reviews" t={t} accent={accent}>
      {data.reviews.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {data.reviews.slice(0, 6).map((r, i) => (
            <div key={i} className={`p-6 ${t.card} relative`} style={{ background: t.surface }}>
              <Quote className="absolute top-5 right-5 w-8 h-8" style={{ color: `${accent}33` }} />
              <Stars n={r.rating} />
              <p className="mt-3 text-sm leading-relaxed" style={{ color: t.ink }}>"{r.text}"</p>
              <div className="mt-4 text-sm font-bold" style={{ color: t.ink }}>{r.customer_name}</div>
              <div className="text-xs mt-0.5" style={{ color: t.muted }}>Verified via Google</div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: t.muted }}>Great reviews coming soon.</p>
      )}
      {b.google_review_url && (
        <div className="mt-8">
          <a href={b.google_review_url} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 px-6 h-12 ${t.btn}`} style={{ background: accent, color: ctx.accentText }}><Star className="w-4 h-4" /> Leave us a review</a>
        </div>
      )}
    </Section>
  );
}

// ===========================================================================
// Data defaults
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

// ===========================================================================
// Small building blocks
// ===========================================================================
function Section({ id, title, kicker, t, accent, alt, children }) {
  return (
    <section id={id} className="py-16 md:py-24" style={alt ? { background: t.surface } : undefined}>
      <div className="max-w-6xl mx-auto px-4">
        {kicker && <div className="text-xs font-bold uppercase tracking-[0.2em] mb-2" style={{ color: accent }}>{kicker}</div>}
        <h2 className={`wsite-h ${t.heading} text-3xl md:text-4xl mb-8`} style={{ color: t.ink }}>{title}</h2>
        {children}
      </div>
    </section>
  );
}

function HeroBadge({ children }) {
  return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur border border-white/20 text-xs font-bold uppercase tracking-wide">{children}</span>;
}

function Chip({ t, accent, children }) {
  return <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: `${accent}14`, color: t.ink, border: `1px solid ${accent}33` }}>{children}</span>;
}

function Stars({ n = 5 }) {
  return <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className="w-4 h-4" style={{ fill: i <= n ? "#F5B301" : "none", color: i <= n ? "#F5B301" : "#D1D5DB" }} />)}</div>;
}

function InfoRow({ t, accent, icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-none" style={{ background: `${accent}1a` }}><Icon className="w-4 h-4" style={{ color: accent }} /></span>
      <div><div className="text-xs font-bold uppercase tracking-wide" style={{ color: t.muted }}>{label}</div><div className="font-semibold" style={{ color: t.ink }}>{value}</div></div>
    </div>
  );
}

function FaqItem({ q, a, t, accent }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`overflow-hidden ${t.card}`} style={{ background: t.bg }} data-testid="site-faq-item">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 p-5 text-left">
        <span className="font-bold text-base" style={{ color: t.ink }}>{q}</span>
        <span className="flex-none w-7 h-7 rounded-full flex items-center justify-center font-bold transition-transform" style={{ background: accent, color: isLightColor(accent) ? "#0A0A0A" : "#fff", transform: open ? "rotate(45deg)" : "none" }}>+</span>
      </button>
      {open && <div className="px-5 pb-5 -mt-1 text-sm leading-relaxed" style={{ color: t.muted }}>{a}</div>}
    </div>
  );
}

function LeadForm({ slug, t, accent, accentText, services }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", service: "", description: "" });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) return;
    setSending(true);
    try {
      await axios.post(`${API}/public/website/${slug}/lead`, form);
      setDone(true);
    } catch { setSending(false); }
  };
  if (done) return (
    <div className={`p-8 text-center ${t.card}`} style={{ background: t.surface }} data-testid="site-lead-success">
      <CheckCircle2 className="w-12 h-12 mx-auto" style={{ color: accent }} />
      <h3 className={`wsite-h ${t.heading} text-2xl mt-3`} style={{ color: t.ink }}>Thank you!</h3>
      <p className="mt-2 text-sm" style={{ color: t.muted }}>We received your request and will contact you shortly.</p>
    </div>
  );
  const inp = "w-full h-12 px-4 rounded-xl border outline-none focus:ring-2 focus-visible:ring-2";
  const inpStyle = { borderColor: t.border, background: t.dark ? t.surface2 : "#fff", color: t.ink };
  return (
    <form onSubmit={submit} className={`p-6 space-y-3 ${t.card}`} style={{ background: t.surface }} data-testid="site-lead-form">
      <input required data-testid="site-lead-name" placeholder="Your name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} style={inpStyle} />
      <input required data-testid="site-lead-phone" placeholder="Phone *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inp} style={inpStyle} />
      <input type="email" data-testid="site-lead-email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inp} style={inpStyle} />
      {services?.length > 0 && (
        <select data-testid="site-lead-service" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} className={inp} style={inpStyle}>
          <option value="">What do you need?</option>
          {services.map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
        </select>
      )}
      <textarea placeholder="Tell us about your project" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full min-h-[90px] p-4 rounded-xl border outline-none focus:ring-2" style={inpStyle} />
      <button type="submit" disabled={sending} data-testid="site-lead-submit" className={`w-full h-13 py-3.5 font-bold flex items-center justify-center gap-2 ${t.btn}`} style={{ background: accent, color: accentText }}>
        {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> Send Request</>}
      </button>
    </form>
  );
}
