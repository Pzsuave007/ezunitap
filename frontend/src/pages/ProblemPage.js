import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Phone, ArrowRight, CheckCircle2, Star, Loader2, Camera, ShieldCheck } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const photoUrl = (id, w) => (id ? `${API}/public/card/photo/${id}${w ? `?w=${w}` : ""}` : null);

function readUtm() {
  const p = new URLSearchParams(window.location.search);
  return { utm_source: p.get("utm_source") || "", utm_medium: p.get("utm_medium") || "", utm_campaign: p.get("utm_campaign") || "" };
}

function Stars({ n = 5, color = "#F5B301" }) {
  return <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="w-4 h-4" fill={i < n ? color : "none"} style={{ color }} />)}</div>;
}

export default function ProblemPage({ injected }) {
  const { slug: routeSlug, pageSlug } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const preview = new URLSearchParams(window.location.search).get("preview") ? "?preview=1" : "";
  const slug = injected?.website_slug || routeSlug;

  useEffect(() => {
    if (injected) { setData(injected); return; }
    axios.get(`${API}/public/problem-page/${slug}/${pageSlug}${preview}`)
      .then((r) => setData(r.data)).catch(() => setErr(true));
  }, [slug, pageSlug]); // eslint-disable-line

  const accent = data?.theme?.accent || "#2563EB";
  const page = data?.page?.content || {};
  const seo = data?.page?.seo || {};
  const biz = data?.business || {};
  const phone = biz.phone || "";

  useEffect(() => {
    if (!data) return;
    const title = seo.title || page.problem_headline || biz.name || "";
    document.title = title;
    const desc = seo.meta_description || page.solution || "";
    const canonical = `${window.location.origin}/sitio/${slug}/p/${data.page.page_slug}`;
    const meta = (key, val, prop) => {
      const attr = prop ? "property" : "name";
      let el = document.head.querySelector(`meta[${attr}="${key}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.setAttribute("content", val || "");
    };
    meta("description", desc);
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) { link = document.createElement("link"); link.setAttribute("rel", "canonical"); document.head.appendChild(link); }
    link.setAttribute("href", canonical);
    if (data.page.indexable === false) meta("robots", "noindex,nofollow");
    meta("og:title", title, true); meta("og:description", desc, true); meta("og:type", "website", true);
    meta("og:url", canonical, true);
    const og = photoUrl(data.photos?.[0]?.id, 1200) || photoUrl(biz.logo_photo_id, 600);
    if (og) meta("og:image", og, true);
    // JSON-LD: Service + FAQPage
    const faqs = (page.faqs || []).filter((f) => f && f.q && f.a);
    const ld = [
      { "@context": "https://schema.org", "@type": "Service", name: `${data.page.service_name} — ${biz.name}`, areaServed: data.service_area || undefined, provider: { "@type": "LocalBusiness", name: biz.name, telephone: phone || undefined } },
    ];
    if (faqs.length) ld.push({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) });
    let s = document.getElementById("pp-jsonld");
    if (!s) { s = document.createElement("script"); s.type = "application/ld+json"; s.id = "pp-jsonld"; document.head.appendChild(s); }
    s.textContent = JSON.stringify(ld);
  }, [data]); // eslint-disable-line

  if (err) return <div className="min-h-screen flex items-center justify-center text-slate-500">Page not available.</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const logo = photoUrl(biz.logo_photo_id, 200);
  const hero = photoUrl(data.photos?.[0]?.id, 1600);
  const badges = data.trust_badges || [];
  const ctaLabel = page.cta_label || (page.cta_type === "call" ? "Call Now" : "Get a Free Estimate");

  return (
    <div className="min-h-screen bg-white text-slate-900" data-testid="problem-page" style={{ ["--accent"]: accent }}>
      {/* Sticky header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <a href={data.website_path} className="flex items-center gap-2 min-w-0">
            {logo ? <img src={logo} alt="" className="w-9 h-9 rounded-lg object-cover" /> : <div className="w-9 h-9 rounded-lg" style={{ background: accent }} />}
            <span className="font-bold truncate">{biz.name}</span>
          </a>
          {phone && <a href={`tel:${phone}`} data-testid="pp-header-call" className="inline-flex items-center gap-2 px-4 h-10 rounded-full font-bold text-white text-sm" style={{ background: accent }}><Phone className="w-4 h-4" /> Call</a>}
        </div>
      </header>

      {/* HERO: Problem → Agitate → Solution → Action */}
      <section className="relative overflow-hidden">
        {hero && <img src={hero} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0" style={{ background: hero ? "linear-gradient(120deg, rgba(15,23,42,.92) 45%, rgba(15,23,42,.55))" : "#0f172a" }} />
        <div className="relative max-w-6xl mx-auto px-4 py-12 md:py-20 grid md:grid-cols-2 gap-8 items-center">
          <div className="text-white">
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight" data-testid="pp-headline">{page.problem_headline || data.page.service_name}</h1>
            {page.agitation && <p className="mt-4 text-lg text-white/85">{page.agitation}</p>}
            {page.solution && <p className="mt-3 text-xl font-bold" style={{ color: "#fff" }}>{page.solution}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              {badges.map((b, i) => <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/15 text-white backdrop-blur"><CheckCircle2 className="w-3.5 h-3.5" style={{ color: accent }} /> {b}</span>)}
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              {phone && <a href={`tel:${phone}`} data-testid="pp-hero-call" className="inline-flex items-center gap-2 px-7 h-14 rounded-full font-bold text-white text-lg shadow-lg" style={{ background: accent }}><Phone className="w-5 h-5" /> Call Now</a>}
              <a href="#lead" className="inline-flex items-center gap-2 px-7 h-14 rounded-full font-bold text-slate-900 bg-white text-lg">{ctaLabel} <ArrowRight className="w-5 h-5" /></a>
            </div>
          </div>
          <div id="lead"><LeadForm data={data} accent={accent} ctaLabel={ctaLabel} /></div>
        </div>
      </section>

      {/* Problem */}
      {page.s_problem && <Sec title={page.s_problem_title || "The problem"} accent={accent}><p className="text-lg leading-relaxed text-slate-600 max-w-3xl">{page.s_problem}</p></Sec>}
      {/* Why it matters */}
      {page.s_why_matters && <Sec title={page.s_why_matters_title || "Why it matters"} accent={accent} alt><p className="text-lg leading-relaxed text-slate-600 max-w-3xl">{page.s_why_matters}</p></Sec>}
      {/* How we solve it */}
      {page.s_how && <Sec title={page.s_how_title || "How we solve it"} accent={accent}><p className="text-lg leading-relaxed text-slate-600 max-w-3xl">{page.s_how}</p></Sec>}

      {/* Why choose us */}
      {(page.why_choose || []).length > 0 && (
        <Sec title="Why choose us" accent={accent} alt>
          <div className="grid sm:grid-cols-2 gap-4">
            {page.why_choose.map((x, i) => (
              <div key={i} className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 font-bold"><ShieldCheck className="w-5 h-5" style={{ color: accent }} /> {x.title}</div>
                <p className="mt-1.5 text-sm text-slate-500">{x.desc}</p>
              </div>
            ))}
          </div>
        </Sec>
      )}

      {/* Gallery */}
      {(data.photos || []).length > 0 && (
        <Sec title="Recent work" accent={accent}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.photos.slice(0, 8).map((p) => <div key={p.id} className="aspect-square overflow-hidden rounded-xl"><img src={photoUrl(p.id, 700)} loading="lazy" alt="" className="w-full h-full object-cover" /></div>)}
          </div>
        </Sec>
      )}

      {/* Reviews */}
      {(data.reviews || []).length > 0 && (
        <Sec title="What customers say" accent={accent} alt>
          <div className="grid md:grid-cols-3 gap-4">
            {data.reviews.slice(0, 3).map((r, i) => (
              <div key={i} className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm">
                <Stars n={r.rating || 5} />
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">"{r.text}"</p>
                <div className="mt-2 text-xs font-semibold text-slate-400">{r.customer_name}</div>
              </div>
            ))}
          </div>
        </Sec>
      )}

      {/* FAQs */}
      {(page.faqs || []).length > 0 && (
        <Sec title="Frequently asked questions" accent={accent}>
          <div className="max-w-3xl space-y-3">
            {page.faqs.map((f, i) => <Faq key={i} q={f.q} a={f.a} accent={accent} />)}
          </div>
        </Sec>
      )}

      {/* Final CTA */}
      <section className="py-16 text-center text-white" style={{ background: "#0f172a" }}>
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl md:text-4xl font-extrabold">{page.final_cta_headline || "Ready to get it fixed?"}</h2>
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            {phone && <a href={`tel:${phone}`} className="inline-flex items-center gap-2 px-7 h-14 rounded-full font-bold text-white text-lg" style={{ background: accent }}><Phone className="w-5 h-5" /> Call Now</a>}
            <a href="#lead" className="inline-flex items-center gap-2 px-7 h-14 rounded-full font-bold text-slate-900 bg-white text-lg">{ctaLabel}</a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-sm text-slate-400">
        <a href={data.website_path} className="font-semibold" style={{ color: accent }}>← Back to {biz.name}</a>
        <div className="mt-2">{data.service_area}</div>
      </footer>

      {/* Sticky mobile CTA */}
      <div className="fixed bottom-0 inset-x-0 z-50 md:hidden grid grid-cols-2 gap-px bg-slate-200 border-t border-slate-200">
        {phone
          ? <a href={`tel:${phone}`} data-testid="pp-sticky-call" className="py-3.5 text-center font-bold text-white flex items-center justify-center gap-2" style={{ background: accent }}><Phone className="w-4 h-4" /> Call Now</a>
          : <a href="#lead" className="py-3.5 text-center font-bold text-white" style={{ background: accent }}>Contact</a>}
        <a href="#lead" className="py-3.5 text-center font-bold bg-slate-900 text-white">{ctaLabel}</a>
      </div>
      <div className="h-16 md:hidden" />
    </div>
  );
}

function Sec({ title, children, accent, alt }) {
  return (
    <section className={`py-14 md:py-20 ${alt ? "bg-slate-50" : "bg-white"}`}>
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-extrabold mb-6" style={{ color: "#0f172a" }}>{title}</h2>
        {children}
      </div>
    </section>
  );
}

function Faq({ q, a, accent }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white" data-testid="pp-faq-item">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 p-4 text-left font-bold">
        <span>{q}</span>
        <span className="flex-none w-7 h-7 rounded-full flex items-center justify-center text-white font-bold transition-transform" style={{ background: accent, transform: open ? "rotate(45deg)" : "none" }}>+</span>
      </button>
      {open && <div className="px-4 pb-4 -mt-1 text-sm text-slate-600 leading-relaxed">{a}</div>}
    </div>
  );
}

function LeadForm({ data, accent, ctaLabel }) {
  const utm = useMemo(readUtm, []);
  const [form, setForm] = useState({ name: "", phone: "", description: "" });
  const [photos, setPhotos] = useState([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 3);
    const b64s = await Promise.all(files.map((f) => new Promise((res) => {
      const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f);
    })));
    setPhotos(b64s);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) return;
    setSending(true);
    try {
      await axios.post(`${API}/public/problem-page/${data.website_slug}/${data.page.page_slug}/lead`, {
        name: form.name, phone: form.phone, description: form.description,
        service: data.page.service_name, source: "problem_page",
        problem_page: data.page.page_slug, problem_label: data.page.content?.problem_headline || "",
        photos_b64: photos, ...utm,
      });
      setDone(true);
    } catch { setSending(false); }
  };

  if (done) return (
    <div className="bg-white rounded-2xl p-6 shadow-xl text-center" data-testid="pp-lead-done">
      <CheckCircle2 className="w-12 h-12 mx-auto" style={{ color: accent }} />
      <h3 className="mt-3 font-extrabold text-xl">Thank you!</h3>
      <p className="text-slate-500 mt-1">We got your request and will reach out shortly.</p>
    </div>
  );

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl p-5 shadow-xl" data-testid="pp-lead-form">
      <h3 className="font-extrabold text-lg" style={{ color: "#0f172a" }}>Get help now</h3>
      <p className="text-sm text-slate-500 mb-3">Tell us what's happening — we'll respond fast.</p>
      <div className="space-y-2.5">
        <input required value={form.name} onChange={set("name")} placeholder="Your name" data-testid="pp-input-name" className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2" style={{ ["--tw-ring-color"]: accent }} />
        <input required value={form.phone} onChange={set("phone")} placeholder="Phone number" data-testid="pp-input-phone" className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2" />
        <textarea value={form.description} onChange={set("description")} placeholder="Describe the problem (optional)" data-testid="pp-input-desc" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2" rows={3} />
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 cursor-pointer">
          <Camera className="w-4 h-4" style={{ color: accent }} /> Show us what's happening
          <input type="file" accept="image/*" multiple onChange={onFiles} className="hidden" data-testid="pp-input-photos" />
        </label>
        {photos.length > 0 && <div className="flex gap-2">{photos.map((p, i) => <img key={i} src={p} alt="" className="w-12 h-12 rounded-lg object-cover" />)}</div>}
      </div>
      <button type="submit" disabled={sending} data-testid="pp-lead-submit" className="mt-3 w-full h-13 py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2" style={{ background: accent }}>
        {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{ctaLabel} <ArrowRight className="w-4 h-4" /></>}
      </button>
    </form>
  );
}
