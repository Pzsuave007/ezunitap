/**
 * AgencyHome — bilingual (EN/ES) marketing home for Growth Ally / Uni2 Marketing.
 * Faithful replica of the existing WordPress sites, publishable to both domains.
 * EN = growthally.agency · ES = uni2mkt.com. Public route (no auth).
 */
import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  Globe2, Bot, MapPin, Star, Zap, Target, Phone, ArrowRight,
  Search, PenTool, Workflow, Rocket, TrendingUp, Menu, X,
} from "lucide-react";

const PHONE = "888-689-4979";
const HERO_EN = "https://growthally.agency/wp-content/uploads/2025/11/growthally1.jpg";
const HERO_ES = "https://uni2mkt.com/wp-content/uploads/2025/10/en-directo-clases-1.png";
const CTA_IMG = "https://growthally.agency/wp-content/uploads/2025/02/Lucy-and-paul-scaled.jpg";
const LOGOS = [
  "GA-Client-Showcase-fristcall", "GA-Client-Showcase-BAJALTO", "GA-Client-Showcase-CASALOLA",
  "GA-Client-Showcase-GRILL68", "GA-Client-Showcase-MARZ",
].map((n) => `https://growthally.agency/wp-content/uploads/2025/02/${n}.png`);

const SERVICE_ICONS = [Globe2, Bot, MapPin, Star, Zap, Target];
const STEP_ICONS = [Search, PenTool, Workflow, Rocket, TrendingUp];

const T = {
  en: {
    domain: "growthally.agency",
    nav: { services: "Services", process: "Process", results: "Results", contact: "Contact", cta: "Free Demo" },
    heroKicker: "Driving Growth Through Smart Digital Systems",
    heroTitle: "Empowering Business Growth!",
    heroText: "We help businesses grow with strategic marketing, modern design, and intelligent digital systems that work around the clock — attracting the right customers and improving your presence across every platform.",
    heroCta: "Schedule a Free Demo",
    heroCall: "Call Us",
    servicesTitle: "Smart tools to grow your business",
    services: [
      ["Smart Websites", "Websites that think, learn, and turn visitors into customers — with AI features, pro design, and automations working 24/7."],
      ["AI-Powered Chatbots", "Virtual assistants that chat with customers, schedule appointments, and qualify leads in seconds — even when you're offline."],
      ["Google Business Optimization", "We optimize your Google profile so you stand out on Maps, gain local visibility, and get more calls and visits."],
      ["Reputation Management", "Collect more positive reviews, protect your brand image, and build trust so customers choose you with confidence."],
      ["Marketing Automation", "Automated systems that send emails, messages, and personalized follow-ups — without you lifting a finger."],
      ["Custom Digital Strategies", "We analyze your industry, audience, and goals to craft a tailored strategy that drives measurable growth."],
    ],
    resultsKicker: "150+ Businesses Trust Growth Ally",
    resultsTitle: "Results That Speak for Themselves",
    resultsText: "We've helped companies across the United States strengthen their digital presence and consistently attract more customers.",
    processTitle: "How We Transform Your Digital Presence",
    steps: [
      ["Discovery & Strategy", "We analyze your business, audience, and goals to build a customized strategy blending technology, design, and smart marketing."],
      ["Design & Setup", "We build your Smart Website, optimize your Google presence, and connect every tool that powers your digital system."],
      ["Integration & Automation", "We activate chatbots, forms, and automated workflows so every interaction becomes an opportunity — 24/7."],
      ["Launch & Optimization", "We launch your system and track performance, continually refining campaigns and tools to maximize results."],
      ["Growth & Support", "Clear reporting, ongoing support, and fresh ideas so you keep scaling: more customers, more visibility, better results."],
    ],
    formTitle: "Ready to Elevate Your Business?",
    formText: "Fill out the form to schedule a free demo. We'd love to learn about your goals and show you how smart digital systems can work for you.",
    fields: { name: "Name", email: "Email", phone: "Phone", business: "Business name", message: "Tell us about your goals" },
    send: "Get My Free Demo",
    hours: "Mon–Fri 8:00AM – 6:00PM · Sat & Sun Closed",
    sent: "Thanks! We'll be in touch shortly.",
  },
  es: {
    domain: "uni2mkt.com",
    nav: { services: "Servicios", process: "Proceso", results: "Resultados", contact: "Contacto", cta: "Demo Gratis" },
    heroKicker: "Impulsando negocios con sistemas digitales inteligentes",
    heroTitle: "¡Impulsando Negocios Latinos!",
    heroText: "Ayudamos a emprendedores latinos a destacar y crecer en el mercado estadounidense con estrategias digitales que combinan creatividad, automatización e inteligencia artificial. No solo diseñamos sitios: creamos sistemas que generan clientes reales.",
    heroCta: "Agenda un Demo Gratis",
    heroCall: "Llámanos",
    servicesTitle: "Herramientas inteligentes para hacer crecer tu negocio",
    services: [
      ["Websites Inteligentes", "Sitios que piensan, aprenden y generan clientes por ti — con IA, diseño profesional y automatizaciones que convierten visitantes en ventas 24/7."],
      ["Chatbots con IA", "Asistentes virtuales que conversan con tus clientes, agendan citas y califican prospectos en segundos, incluso cuando no estás disponible."],
      ["Google Business", "Optimizamos tu perfil de Google para que destaques en los mapas, ganes visibilidad local y recibas más llamadas y visitas."],
      ["Gestión de Reputación", "Recolecta más reseñas positivas, protege tu imagen y genera confianza para que los clientes te elijan con seguridad."],
      ["Automatización de Marketing", "Sistemas automáticos que envían correos, mensajes y recordatorios personalizados sin que muevas un dedo."],
      ["Estrategias Personalizadas", "Analizamos tu industria, público y objetivos para diseñar una estrategia digital que haga crecer tu marca de forma medible."],
    ],
    resultsKicker: "Más de 150 negocios confían en Uni2 Marketing",
    resultsTitle: "¡Resultados que hablan por sí mismos!",
    resultsText: "Hemos ayudado a negocios latinos en todo Estados Unidos a digitalizarse y atraer más clientes de forma constante.",
    processTitle: "Cómo transformamos tu presencia digital",
    steps: [
      ["Descubrimiento y Estrategia", "Analizamos tu negocio, audiencia y metas para crear una estrategia a la medida que combina tecnología, diseño y marketing inteligente."],
      ["Diseño y Configuración", "Creamos tu Website Inteligente, optimizamos tu presencia en Google y conectamos todas las herramientas de tu sistema."],
      ["Integración y Automatización", "Activamos chatbots, formularios y automatizaciones para que cada contacto se convierta en oportunidad — 24/7."],
      ["Lanzamiento y Optimización", "Lanzamos tu sistema y medimos resultados, ajustando constantemente campañas y herramientas para maximizar el rendimiento."],
      ["Crecimiento y Seguimiento", "Reportes claros, soporte continuo e ideas frescas para seguir escalando: más clientes, más visibilidad, mejores resultados."],
    ],
    formTitle: "¿Listo para Elevar tu Negocio?",
    formText: "Completa el formulario y agenda una demostración gratuita. Queremos conocer tus metas y mostrarte cómo la tecnología puede trabajar a tu favor.",
    fields: { name: "Nombre", email: "Correo", phone: "Teléfono", business: "Nombre del negocio", message: "Cuéntanos sobre tus metas" },
    send: "Quiero mi Demo Gratis",
    hours: "Lun–Vie 8:00AM – 6:00PM · Sáb y Dom Cerrado",
    sent: "¡Gracias! Te contactaremos muy pronto.",
  },
};

export default function AgencyHome() {
  // Language auto-picks from domain; defaults ES on uni2mkt, EN elsewhere.
  const initialLang = useMemo(() => {
    const h = (typeof window !== "undefined" ? window.location.hostname : "").toLowerCase();
    const q = new URLSearchParams(window.location.search).get("lang");
    if (q === "es" || q === "en") return q;
    if (h.includes("uni2mkt")) return "es";
    return "en";
  }, []);
  const [lang, setLang] = useState(initialLang);
  const t = T[lang];
  const [form, setForm] = useState({ name: "", email: "", phone: "", business_name: "", message: "" });
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.title = lang === "es"
      ? "Uni2 Marketing Group | Marketing Inteligente. Resultados Reales."
      : "Growth Ally Agency | Smart Marketing. Real Results.";
  }, [lang]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSending(true);
    try {
      await api.post("/agency/lead", {
        ...form, lang, source_site: t.domain,
      });
      toast.success(t.sent);
      setForm({ name: "", email: "", phone: "", business_name: "", message: "" });
    } catch {
      toast.error(lang === "es" ? "No se pudo enviar. Intenta de nuevo." : "Couldn't send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="min-h-screen bg-[#0a1130] text-white font-sans selection:bg-emerald-400/30" data-testid="agency-home">
      {/* NAV */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#0a1130]/80 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <span className="font-black text-lg tracking-tight">
            {lang === "es" ? "Uni2" : "Growth"} <span className="text-emerald-400">{lang === "es" ? "Marketing" : "Ally"}</span>
          </span>
          <nav className="hidden md:flex items-center gap-7 text-sm text-slate-300">
            <a href="#services" className="hover:text-white transition-colors">{t.nav.services}</a>
            <a href="#process" className="hover:text-white transition-colors">{t.nav.process}</a>
            <a href="#results" className="hover:text-white transition-colors">{t.nav.results}</a>
            <a href="#contact" className="hover:text-white transition-colors">{t.nav.contact}</a>
          </nav>
          <div className="flex items-center gap-3">
            <div className="flex rounded-full bg-white/10 p-0.5 text-xs font-bold" data-testid="agency-lang-toggle">
              {["en", "es"].map((l) => (
                <button key={l} onClick={() => setLang(l)} data-testid={`agency-lang-${l}`}
                  className={`px-3 py-1 rounded-full transition-colors ${lang === l ? "bg-emerald-400 text-[#0a1130]" : "text-slate-300"}`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <a href="#contact" data-testid="agency-nav-cta"
              className="hidden sm:inline-flex items-center gap-1.5 bg-emerald-400 text-[#0a1130] font-bold text-sm px-4 py-2 rounded-full hover:bg-emerald-300 transition-colors">
              {t.nav.cta} <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url(${lang === "es" ? HERO_ES : HERO_EN})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a1130]/70 via-[#0a1130]/90 to-[#0a1130]" />
        <div className="relative max-w-6xl mx-auto px-5 py-24 md:py-32">
          <p className="text-emerald-400 font-semibold text-sm uppercase tracking-widest mb-4">{t.heroKicker}</p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] max-w-3xl">{t.heroTitle}</h1>
          <p className="mt-6 text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">{t.heroText}</p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <a href="#contact" data-testid="agency-hero-cta"
              className="inline-flex items-center gap-2 bg-emerald-400 text-[#0a1130] font-bold px-7 py-3.5 rounded-full hover:bg-emerald-300 hover:-translate-y-0.5 transition-all">
              {t.heroCta} <ArrowRight className="w-5 h-5" />
            </a>
            <a href={`tel:${PHONE}`} className="inline-flex items-center gap-2 border border-white/25 px-6 py-3.5 rounded-full font-semibold hover:bg-white/10 transition-colors">
              <Phone className="w-4 h-4 text-emerald-400" /> {t.heroCall}: {PHONE}
            </a>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="max-w-6xl mx-auto px-5 py-20 md:py-28">
        <h2 className="text-3xl md:text-4xl font-black text-center max-w-3xl mx-auto">{t.servicesTitle}</h2>
        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {t.services.map(([name, desc], i) => {
            const Icon = SERVICE_ICONS[i];
            return (
              <div key={name} data-testid={`agency-service-${i}`}
                className="group rounded-2xl bg-white/[0.04] border border-white/10 p-7 hover:border-emerald-400/50 hover:bg-white/[0.07] transition-all hover:-translate-y-1">
                <div className="w-12 h-12 rounded-xl bg-emerald-400/15 grid place-items-center mb-5 group-hover:bg-emerald-400/25 transition-colors">
                  <Icon className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="font-bold text-lg">{name}</h3>
                <p className="mt-2.5 text-sm text-slate-400 leading-relaxed">{desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* RESULTS */}
      <section id="results" className="bg-white/[0.03] border-y border-white/10 py-20">
        <div className="max-w-6xl mx-auto px-5 text-center">
          <p className="text-emerald-400 font-semibold text-sm uppercase tracking-widest">{t.resultsKicker}</p>
          <h2 className="mt-3 text-3xl md:text-4xl font-black">{t.resultsTitle}</h2>
          <p className="mt-4 text-slate-400 max-w-2xl mx-auto">{t.resultsText}</p>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8">
            {LOGOS.map((src, i) => (
              <img key={i} src={src} alt="client" loading="lazy"
                className="h-14 md:h-16 object-contain opacity-80 hover:opacity-100 transition-opacity" />
            ))}
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section id="process" className="max-w-6xl mx-auto px-5 py-20 md:py-28">
        <h2 className="text-3xl md:text-4xl font-black text-center">{t.processTitle}</h2>
        <div className="mt-14 grid md:grid-cols-5 gap-5">
          {t.steps.map(([title, desc], i) => {
            const Icon = STEP_ICONS[i];
            return (
              <div key={title} data-testid={`agency-step-${i}`} className="relative rounded-2xl bg-white/[0.04] border border-white/10 p-6">
                <span className="absolute -top-3 -left-2 text-5xl font-black text-emerald-400/15">{i + 1}</span>
                <Icon className="w-7 h-7 text-emerald-400 mb-4 relative" />
                <h3 className="font-bold text-base relative">{title}</h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed relative">{desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CONTACT / CTA */}
      <section id="contact" className="relative py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-5 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <img src={CTA_IMG} alt="team" className="rounded-2xl w-full object-cover shadow-2xl mb-8" loading="lazy" />
            <h2 className="text-3xl md:text-4xl font-black">{t.formTitle}</h2>
            <p className="mt-4 text-slate-400 leading-relaxed">{t.formText}</p>
            <p className="mt-6 inline-flex items-center gap-2 text-sm text-slate-300">
              <Phone className="w-4 h-4 text-emerald-400" /> {PHONE}
            </p>
            <p className="mt-2 text-xs text-slate-500">{t.hours}</p>
          </div>
          <form onSubmit={submit} data-testid="agency-lead-form"
            className="rounded-2xl bg-white/[0.05] border border-white/10 p-7 space-y-4">
            {[
              ["name", t.fields.name, "text", true],
              ["email", t.fields.email, "email", false],
              ["phone", t.fields.phone, "tel", false],
              ["business_name", t.fields.business, "text", false],
            ].map(([k, label, type, req]) => (
              <div key={k}>
                <label className="text-xs font-semibold text-slate-300">{label}{req && " *"}</label>
                <input type={type} required={req} value={form[k]} onChange={(e) => upd(k, e.target.value)}
                  data-testid={`agency-field-${k}`}
                  className="mt-1.5 w-full rounded-xl bg-[#0a1130] border border-white/15 px-4 py-3 text-sm outline-none focus:border-emerald-400 transition-colors" />
              </div>
            ))}
            <div>
              <label className="text-xs font-semibold text-slate-300">{t.fields.message}</label>
              <textarea rows={3} value={form.message} onChange={(e) => upd("message", e.target.value)}
                data-testid="agency-field-message"
                className="mt-1.5 w-full rounded-xl bg-[#0a1130] border border-white/15 px-4 py-3 text-sm outline-none focus:border-emerald-400 transition-colors resize-none" />
            </div>
            <button type="submit" disabled={sending} data-testid="agency-submit"
              className="w-full bg-emerald-400 text-[#0a1130] font-bold py-3.5 rounded-full hover:bg-emerald-300 transition-colors disabled:opacity-60">
              {sending ? "…" : t.send}
            </button>
          </form>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} {lang === "es" ? "Uni2 Marketing Group" : "Growth Ally Agency"} · {PHONE}
      </footer>
    </div>
  );
}
