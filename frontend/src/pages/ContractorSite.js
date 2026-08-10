import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Phone, MapPin, Clock, Star, ShieldCheck, CheckCircle2, Calendar, Send, Loader2, Menu, X } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const photoUrl = (id) => (id ? `${API}/public/card/photo/${id}` : null);

// Per-template visual system (from design_guidelines.json)
const TPL = {
  bold: {
    name: "Bold & Industrial",
    fonts: "'Anton', sans-serif", body: "'Manrope', sans-serif",
    heading: "font-black tracking-tight uppercase",
    bg: "#F5F5F5", surface: "#FFFFFF", ink: "#0A0A0A", muted: "#525252",
    card: "rounded-none border-2 border-[#0A0A0A] shadow-[6px_6px_0_0_#0A0A0A]",
    btn: "rounded-none uppercase tracking-widest font-bold",
    radius: "rounded-none",
    heroOverlay: "bg-black/60",
  },
  clean: {
    name: "Clean & Modern",
    fonts: "'Outfit', sans-serif", body: "'IBM Plex Sans', sans-serif",
    heading: "font-bold tracking-tight",
    bg: "#FFFFFF", surface: "#F9FAFB", ink: "#111827", muted: "#6B7280",
    card: "rounded-2xl border border-gray-100 shadow-sm",
    btn: "rounded-xl font-semibold",
    radius: "rounded-2xl",
    heroOverlay: "bg-black/45",
  },
  warm: {
    name: "Warm & Trustworthy",
    fonts: "'Playfair Display', serif", body: "'Nunito', sans-serif",
    heading: "font-semibold tracking-normal",
    bg: "#FAFAFA", surface: "#FFFFFF", ink: "#2F5233", muted: "#5b6b57",
    card: "rounded-2xl border border-[#EDE6D6] shadow-[0_8px_30px_rgba(0,0,0,0.05)]",
    btn: "rounded-full font-bold",
    radius: "rounded-3xl",
    heroOverlay: "bg-[#2F5233]/55",
  },
};

const FALLBACK_HERO = "https://images.unsplash.com/photo-1721815693498-cc28507c0ba2?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600";

export default function ContractorSite() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const [menu, setMenu] = useState(false);
  const contactRef = useRef(null);

  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Anton&family=Manrope:wght@400;600;800&family=Outfit:wght@400;600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=Playfair+Display:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap";
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
  const b = data.business;
  const sec = w.sections || {};
  const heroImg = photoUrl(w.hero_photo_id) || photoUrl(data.photos?.[0]?.id) || FALLBACK_HERO;
  const scrollToContact = () => contactRef.current?.scrollIntoView({ behavior: "smooth" });
  const nav = [
    sec.services && ["Services", "services"],
    sec.gallery && data.photos.length > 0 && ["Work", "gallery"],
    sec.reviews && ["Reviews", "reviews"],
    sec.contact && ["Contact", "contact"],
  ].filter(Boolean);

  return (
    <div style={{ background: t.bg, color: t.ink, fontFamily: t.body }} className="min-h-screen antialiased">
      <style>{`.wsite-h{font-family:${t.fonts}} .wsite a,.wsite button{transition:transform .2s,box-shadow .2s,background-color .2s,opacity .2s}`}</style>
      <div className="wsite pb-20 md:pb-0">
        {/* Header */}
        <header className="sticky top-0 z-40 backdrop-blur-xl border-b" style={{ background: `${t.surface}ee`, borderColor: "rgba(0,0,0,.08)" }}>
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              {photoUrl(b.logo_photo_id)
                ? <img src={photoUrl(b.logo_photo_id)} alt="logo" className="w-9 h-9 rounded-lg object-cover flex-none" />
                : <div className="w-9 h-9 rounded-lg flex-none flex items-center justify-center text-white font-bold" style={{ background: accent }}>{(b.name || "?")[0]}</div>}
              <span className={`wsite-h ${t.heading} text-lg truncate`}>{b.name}</span>
            </div>
            <nav className="hidden md:flex items-center gap-7 text-sm font-semibold" style={{ color: t.muted }}>
              {nav.map(([label, id]) => <a key={id} href={`#${id}`} className="hover:opacity-70">{label}</a>)}
            </nav>
            <div className="flex items-center gap-2">
              {b.phone && <a href={`tel:${b.phone}`} data-testid="site-header-call" className={`hidden sm:inline-flex items-center gap-2 px-4 h-10 text-white text-sm ${t.btn}`} style={{ background: accent }}><Phone className="w-4 h-4" /> Call</a>}
              <button className="md:hidden p-2" aria-label="menu" onClick={() => setMenu(!menu)}>{menu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}</button>
            </div>
          </div>
          {menu && (
            <div className="md:hidden border-t px-4 py-3 space-y-2" style={{ borderColor: "rgba(0,0,0,.08)", background: t.surface }}>
              {nav.map(([label, id]) => <a key={id} href={`#${id}`} onClick={() => setMenu(false)} className="block py-2 font-semibold">{label}</a>)}
            </div>
          )}
        </header>

        {/* Hero */}
        <section className="relative">
          <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className={`absolute inset-0 ${t.heroOverlay}`} />
          <div className="relative max-w-6xl mx-auto px-4 py-24 md:py-36 text-white">
            <div className="flex flex-wrap gap-2 mb-5">
              {b.is_licensed && <Badge t={t}><ShieldCheck className="w-3.5 h-3.5" /> Licensed</Badge>}
              {b.is_insured && <Badge t={t}><ShieldCheck className="w-3.5 h-3.5" /> Insured</Badge>}
              {b.years_in_business > 0 && <Badge t={t}>{b.years_in_business}+ Years</Badge>}
            </div>
            <h1 className={`wsite-h ${t.heading} text-4xl sm:text-5xl lg:text-6xl max-w-3xl leading-[1.05] drop-shadow`}>
              {w.headline || b.name}
            </h1>
            {w.subheadline && <p className="mt-5 text-lg md:text-xl max-w-xl text-white/90">{w.subheadline}</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={scrollToContact} data-testid="site-hero-quote" className={`px-7 h-14 text-white text-base ${t.btn} shadow-lg hover:-translate-y-0.5`} style={{ background: accent }}>Get a Free Quote</button>
              {b.phone && <a href={`tel:${b.phone}`} className={`px-7 h-14 inline-flex items-center gap-2 bg-white/95 text-base ${t.btn} hover:-translate-y-0.5`} style={{ color: t.ink }}><Phone className="w-5 h-5" /> Call Now</a>}
            </div>
          </div>
        </section>

        {/* Services */}
        {sec.services && (
          <Section id="services" title="Our Services" t={t}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {(data.services.length ? data.services : DEFAULT_SERVICES).map((s, i) => (
                <div key={i} className={`p-6 ${t.card}`} style={{ background: t.surface }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: `${accent}1a` }}>
                    <CheckCircle2 className="w-6 h-6" style={{ color: accent }} />
                  </div>
                  <h3 className={`wsite-h ${t.heading} text-xl`} style={{ color: t.ink }}>{s.name}</h3>
                  {s.description && <p className="mt-2 text-sm leading-relaxed" style={{ color: t.muted }}>{s.description}</p>}
                  {s.starting_price && <p className="mt-3 text-sm font-bold" style={{ color: accent }}>{s.starting_price}</p>}
                  {b.phone && <a href={`tel:${b.phone}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: accent }}><Phone className="w-4 h-4" /> Call now</a>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* How It Works */}
        {sec.how !== false && (
          <Section id="how" title="How It Works" t={t} alt>
            <div className="grid sm:grid-cols-3 gap-5">
              {(w.how_it_works?.length ? w.how_it_works : DEFAULT_HOW).map((s, i) => (
                <div key={i} className={`p-6 ${t.card} relative`} style={{ background: t.bg }}>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-xl mb-4" style={{ background: accent }}>{i + 1}</div>
                  <h3 className={`wsite-h ${t.heading} text-lg`} style={{ color: t.ink }}>{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: t.muted }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Why Choose Us */}
        {sec.why !== false && (
          <Section id="why" title="Why Choose Us" t={t}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {(w.why_us?.length ? w.why_us : DEFAULT_WHY).map((s, i) => {
                const WhyIcon = [Clock, ShieldCheck, CheckCircle2, Star][i % 4];
                return (
                  <div key={i} className={`p-5 ${t.card} text-center`} style={{ background: t.surface }}>
                    <div className="w-11 h-11 rounded-xl mx-auto flex items-center justify-center mb-3" style={{ background: `${accent}1a` }}>
                      <WhyIcon className="w-5 h-5" style={{ color: accent }} />
                    </div>
                    <h3 className={`wsite-h ${t.heading} text-base`} style={{ color: t.ink }}>{s.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed" style={{ color: t.muted }}>{s.desc}</p>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Gallery */}
        {sec.gallery && data.photos.length > 0 && (
          <Section id="gallery" title="Recent Work" t={t} alt>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {data.photos.slice(0, 12).map((p) => (
                <div key={p.id} className={`overflow-hidden ${t.radius} aspect-square`}>
                  <img src={photoUrl(p.id)} alt={p.label} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Reviews */}
        {sec.reviews && (
          <Section id="reviews" title="What Our Customers Say" t={t}>
            {data.reviews.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {data.reviews.slice(0, 6).map((r, i) => (
                  <div key={i} className={`p-6 ${t.card}`} style={{ background: t.surface }}>
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
                <a href={b.google_review_url} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 px-6 h-12 text-white ${t.btn}`} style={{ background: accent }}><Star className="w-4 h-4" /> Leave us a review</a>
              </div>
            )}
          </Section>
        )}

        {/* About / hours / area */}
        {sec.about && (w.about || data.hours || data.service_area) && (
          <Section id="about" title="About Us" t={t} alt>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                {w.about && <p className="text-base leading-loose" style={{ color: t.muted }}>{w.about}</p>}
              </div>
              <div className="space-y-4">
                {data.service_area && <InfoRow t={t} icon={MapPin} label="Service Area" value={data.service_area} />}
                {data.hours && <InfoRow t={t} icon={Clock} label="Hours" value={data.hours} />}
                {b.address && <InfoRow t={t} icon={MapPin} label="Address" value={b.address} />}
              </div>
            </div>
          </Section>
        )}

        {/* Contact + form */}
        {sec.contact && (
          <div ref={contactRef}>
            <Section id="contact" title="Get Your Free Estimate" t={t}>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <p className="text-base leading-relaxed" style={{ color: t.muted }}>Tell us about your project and we'll get back to you fast.</p>
                  {b.phone && <a href={`tel:${b.phone}`} className="flex items-center gap-3 font-semibold" style={{ color: t.ink }}><span className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ background: accent }}><Phone className="w-5 h-5" /></span> {b.phone}</a>}
                  {(sec.booking || data.appt_enabled) && data.card_slug && (
                    <a href={`/c/${data.card_slug}`} className={`inline-flex items-center gap-2 px-5 h-12 ${t.btn} border-2`} style={{ borderColor: accent, color: accent }}><Calendar className="w-4 h-4" /> Book an appointment</a>
                  )}
                </div>
                <LeadForm slug={slug} t={t} accent={accent} services={data.services} />
              </div>
            </Section>
          </div>
        )}

        {/* Footer */}
        <footer className="py-16 mt-4" style={{ background: t.ink, color: "#fff" }}>
          <div className="max-w-6xl mx-auto px-4">
            <h2 className={`wsite-h ${t.heading} text-3xl md:text-4xl max-w-xl`}>Ready to get started?</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={scrollToContact} className={`px-7 h-13 py-3 text-white ${t.btn}`} style={{ background: accent }}>Get Your Free Estimate</button>
              {b.phone && <a href={`tel:${b.phone}`} className={`px-7 py-3 inline-flex items-center gap-2 ${t.btn} bg-white/10`}><Phone className="w-4 h-4" /> {b.phone}</a>}
            </div>
            <div className="mt-10 pt-6 border-t border-white/15 text-sm text-white/60 flex flex-wrap justify-between gap-3">
              <span>© {new Date().getFullYear()} {b.name}. All rights reserved.</span>
              <span>Powered by UniTech</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Sticky mobile CTA */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-50 flex gap-2 p-3 border-t bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.08)]" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}>
        {b.phone && <a href={`tel:${b.phone}`} data-testid="site-sticky-call" className={`flex-1 h-12 inline-flex items-center justify-center gap-2 font-bold ${t.btn} border-2`} style={{ borderColor: accent, color: accent }}><Phone className="w-4 h-4" /> Call</a>}
        <button onClick={scrollToContact} data-testid="site-sticky-quote" className={`flex-1 h-12 text-white font-bold ${t.btn}`} style={{ background: accent }}>Free Quote</button>
      </div>
    </div>
  );
}

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

function Section({ id, title, t, alt, children }) {
  return (
    <section id={id} className="py-16 md:py-24" style={alt ? { background: t.surface } : undefined}>
      <div className="max-w-6xl mx-auto px-4">
        <h2 className={`wsite-h ${t.heading} text-3xl md:text-4xl mb-8`} style={{ color: t.ink }}>{title}</h2>
        {children}
      </div>
    </section>
  );
}

function Badge({ t, children }) {
  return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-xs font-bold uppercase tracking-wide">{children}</span>;
}

function Stars({ n = 5 }) {
  return <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className="w-4 h-4" style={{ fill: i <= n ? "#F59E0B" : "none", color: i <= n ? "#F59E0B" : "#D1D5DB" }} />)}</div>;
}

function InfoRow({ t, icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-5 h-5 mt-0.5 flex-none" style={{ color: t.ink }} />
      <div><div className="text-xs font-bold uppercase tracking-wide" style={{ color: t.muted }}>{label}</div><div className="font-semibold" style={{ color: t.ink }}>{value}</div></div>
    </div>
  );
}

function LeadForm({ slug, t, accent, services }) {
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
  const inp = "w-full h-12 px-4 rounded-xl border outline-none focus:ring-2";
  return (
    <form onSubmit={submit} className={`p-6 space-y-3 ${t.card}`} style={{ background: t.surface }} data-testid="site-lead-form">
      <input required data-testid="site-lead-name" placeholder="Your name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} style={{ borderColor: "#e5e7eb" }} />
      <input required data-testid="site-lead-phone" placeholder="Phone *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inp} style={{ borderColor: "#e5e7eb" }} />
      <input type="email" data-testid="site-lead-email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inp} style={{ borderColor: "#e5e7eb" }} />
      {services?.length > 0 && (
        <select data-testid="site-lead-service" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} className={inp} style={{ borderColor: "#e5e7eb" }}>
          <option value="">What do you need?</option>
          {services.map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
        </select>
      )}
      <textarea placeholder="Tell us about your project" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full min-h-[90px] p-4 rounded-xl border outline-none focus:ring-2" style={{ borderColor: "#e5e7eb" }} />
      <button type="submit" disabled={sending} data-testid="site-lead-submit" className={`w-full h-13 py-3 text-white font-bold flex items-center justify-center gap-2 ${t.btn}`} style={{ background: accent }}>
        {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> Send Request</>}
      </button>
    </form>
  );
}
