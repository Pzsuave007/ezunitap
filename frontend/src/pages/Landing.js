/**
 * Public landing page for UniTech.
 * Spanish for the contractor (visitor). Narrative follows the full business
 * flow: get a client → quote with AI → accept → invoice → payments → schedule
 * → photos → reviews. All customer-facing docs are in English.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import PlatformChat from "@/components/PlatformChat";
import {
  Hammer, Sparkles, CalendarDays, IdCard, Receipt, Users,
  MessageSquare, Camera, Globe, Smartphone, Zap, ArrowRight, Check, Star,
  Phone, MapPin, Languages, Bot, Send, Mail, Save, QrCode, Share2, Sprout,
  PaintBucket, Wind, LayoutDashboard, DollarSign, TrendingUp, Clock, FileBadge, Package, CalendarCheck,
  LogOut, User, Settings, Play, Film,
} from "lucide-react";

const SERVICES = [
  "Roofing", "Drywall", "Painting", "Concrete", "Cleaning",
  "Landscaping", "Catering", "Plumbing", "Electrical", "HVAC",
];

// ── "Así Funciona" — icons per step (text comes from i18n landing.flow) ──
const FLOW_ICONS = [IdCard, Globe, CalendarCheck, Sparkles, FileBadge, Receipt, DollarSign, CalendarDays, Camera, Share2, MapPin, Star, Bot];
// Product modules — meta (text comes from i18n landing.products)
const PRODUCT_META = [
  { id: "presencia", icon: IdCard, price: "$34.99" },
  { id: "negocio", icon: LayoutDashboard, price: "$39.99" },
  { id: "marketing", icon: Sparkles, price: "$29.99" },
];
const NFC_CARD_IMGS = ["/nfc-sample.png", "/nfc-google-review.png"];
const NFC_STEP_ICONS = [Package, Smartphone, Sparkles];

export default function Landing() {
  const { t, i18n } = useTranslation();
  const isEn = (i18n.language || "").toLowerCase().startsWith("en");
  const L = (es, en) => (isEn ? en : es);
  const FLOW = t("landing.flow", { returnObjects: true }).map((s, i) => ({
    ...s, n: String(i + 1).padStart(2, "0"), icon: FLOW_ICONS[i],
  }));
  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">
      <PlatformChat />
      {/* Top nav */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 tap" data-testid="landing-logo">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center">
              <Hammer className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="leading-none">
              <div className="font-heading font-bold text-base">UniTech</div>
              <div className="text-[10px] text-slate-500">{t("common.brandTagline")}</div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#como-funciona" className="hover:text-slate-900 tap">{t("landing.navHow")}</a>
            <Link to="/demo" data-testid="nav-demo" className="text-emerald-700 font-bold hover:text-emerald-800 tap">{t("landing.navDemo")}</Link>
            <a href="#tarjeta" className="hover:text-slate-900 tap">{t("landing.navNfc")}</a>
            <a href="#productos" className="hover:text-slate-900 tap">{t("landing.navTools")}</a>
            {!isEn && <a href="#espanol" className="hover:text-slate-900 tap">{t("landing.navSpanish")}</a>}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" data-testid="nav-login" className="hidden sm:inline-flex items-center px-4 h-10 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 tap">
              {t("landing.signIn")}
            </Link>
            <Link to="/register" data-testid="nav-register" className="inline-flex items-center gap-1.5 px-4 h-10 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-black tap">
              {t("landing.createAccount")} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ====== HERO ====== */}
      <section className="relative pt-32 lg:pt-40 pb-20 lg:pb-28 overflow-hidden">
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full opacity-30 blur-3xl"
               style={{ background: "radial-gradient(circle, #1E3A8A 0%, transparent 70%)" }} />
          <div className="absolute top-20 right-0 w-[480px] h-[480px] rounded-full opacity-25 blur-3xl"
               style={{ background: "radial-gradient(circle, #10B981 0%, transparent 70%)" }} />
          <div className="absolute inset-0 opacity-[0.025]" style={{
            backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)",
            backgroundSize: "28px 28px"
          }} />
        </div>

        <div className="max-w-7xl mx-auto px-5 lg:px-8 grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-6">
              <Languages className="w-3.5 h-3.5" /> {t("landing.heroBadge")}
            </div>
            <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight">
              {t("landing.heroTitle")}<span className="bg-gradient-to-br from-blue-900 via-blue-700 to-emerald-500 bg-clip-text text-transparent">{t("landing.heroTitleHighlight")}</span>
            </h1>
            <p className="mt-7 text-lg lg:text-xl text-slate-600 leading-relaxed max-w-2xl">
              <Trans i18nKey="landing.heroSubtitle" components={{ b: <strong className="text-slate-900" /> }} />
            </p>

            <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3 max-w-2xl">
              <Link
                to="/demo"
                data-testid="hero-demo"
                className="inline-flex items-center justify-center gap-2 h-14 px-7 rounded-2xl bg-gradient-to-br from-blue-900 to-emerald-600 text-white font-bold text-base shadow-lg shadow-blue-900/20 hover:shadow-xl hover:-translate-y-0.5 transition-all tap"
              >
                <Play className="w-4 h-4" fill="currentColor" /> {t("landing.heroTryLive")}
              </Link>
              <Link
                to="/register"
                data-testid="hero-register"
                className="inline-flex items-center justify-center gap-2 h-14 px-7 rounded-2xl border-2 border-emerald-500 bg-emerald-50 text-emerald-800 font-bold text-base hover:bg-emerald-100 transition-all tap"
              >
                {t("landing.heroCreateFree")} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                data-testid="hero-login"
                className="inline-flex items-center justify-center h-14 px-7 rounded-2xl border border-slate-200 bg-white text-slate-900 font-bold text-base hover:border-slate-400 tap"
              >
                {t("landing.heroHaveAccount")}
              </Link>
            </div>

            <div className="mt-8 max-w-xl" data-testid="hero-results">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 mb-3">{t("landing.resultsTitle")}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                {t("landing.results", { returnObjects: true }).map((r) => (
                  <div key={r} className="flex items-center gap-2 text-slate-700 font-medium">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 text-emerald-700" strokeWidth={3} />
                    </span>
                    {r}
                  </div>
                ))}
              </div>
            </div>


            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
              <div className="inline-flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-600" /> {t("landing.noCard")}</div>
              <div className="inline-flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-600" /> {t("landing.worksPhone")}</div>
              <div className="inline-flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-600" /> {t("landing.cancelAnytime")}</div>
            </div>
          </div>

          <div className="lg:col-span-5 relative">
            <PhoneMockup />
          </div>
        </div>
      </section>

      {/* ====== ¿PARA QUIÉN ES? — filtro de audiencia ====== */}
      <section id="para-quien" className="py-14 lg:py-20 bg-white border-y border-slate-100">
        <div className="max-w-5xl mx-auto px-5 lg:px-8 text-center">
          <h2 className="font-heading text-3xl lg:text-4xl font-bold tracking-tight">{t("landing.whoTitle")}</h2>
          <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
            {t("landing.whoSubtitle")}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2.5">
            {SERVICES.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold">
                <Check className="w-3.5 h-3.5" strokeWidth={3} /> {s}
              </span>
            ))}
          </div>
          <p className="mt-6 text-sm text-slate-400">{t("landing.whoNote")}</p>
        </div>
      </section>

      {/* ====== PAIN CONSOLIDATION BAND ====== */}
      <section className="py-16 lg:py-20 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #fff 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="max-w-4xl mx-auto px-5 lg:px-8 text-center relative">
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
            {t("landing.painTitle")}<br className="hidden lg:block" />{t("landing.painTitle2")}
          </h2>
          <p className="mt-5 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">
            <Trans i18nKey="landing.painSubtitle" components={{ b: <strong className="text-white" /> }} />
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3 text-sm">
            {t("landing.painTags", { returnObjects: true }).map((x) => (
              <span key={x} className="px-4 py-2 rounded-full bg-white/[0.06] border border-white/10 text-white/50 line-through">{x}</span>
            ))}
            <ArrowRight className="w-5 h-5 text-emerald-400 hidden sm:block" />
            <span className="px-5 py-2 rounded-full bg-emerald-500 text-slate-900 font-bold inline-flex items-center gap-2">
              <Hammer className="w-4 h-4" /> UniTech
            </span>
          </div>
        </div>
      </section>

      {/* ====== ASÍ FUNCIONA — 8 pasos ====== */}
      <section id="como-funciona" className="py-20 lg:py-28">
        <div className="max-w-4xl mx-auto px-5 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 mb-3">{t("landing.howEyebrow")}</div>
            <h2 className="font-heading text-4xl lg:text-5xl font-bold tracking-tight">
              {t("landing.howTitle")}<span className="bg-gradient-to-br from-blue-900 to-emerald-500 bg-clip-text text-transparent">{t("landing.howTitleHighlight")}</span>
            </h2>
            <p className="mt-5 text-lg text-slate-600 leading-relaxed">
              {t("landing.howSubtitle")}
            </p>
          </div>

          <div className="relative">
            {/* Connecting line */}
            <div className="absolute left-6 lg:left-8 top-6 bottom-6 w-px bg-gradient-to-b from-blue-900 via-emerald-500 to-emerald-300" />
            <div className="space-y-5 lg:space-y-6">
              {FLOW.map((step) => (
                <div key={step.n} className="relative flex gap-5 lg:gap-7" data-testid={`flow-step-${step.n}`}>
                  <div className="relative z-10 flex-shrink-0">
                    <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-2xl bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-900/20 ring-4 ring-white">
                      <step.icon className="w-6 h-6 lg:w-7 lg:h-7 text-white" strokeWidth={2} />
                    </div>
                  </div>
                  <div className="flex-1 rounded-2xl bg-white border border-slate-200 p-5 lg:p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-1">{t("landing.stepLabel")} {step.n}</div>
                    <h3 className="font-heading font-bold text-xl lg:text-2xl tracking-tight">{step.title}</h3>
                    <p className="text-slate-600 mt-1.5 leading-relaxed">{step.lead}</p>
                    <ul className="mt-4 grid sm:grid-cols-2 gap-2.5">
                      {step.points.map((p) => (
                        <li key={p} className="flex items-start gap-2 text-sm text-slate-700">
                          <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" strokeWidth={3} />
                          <span className="leading-snug">{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Flywheel close */}
          <div className="mt-12 rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-emerald-950 p-8 lg:p-10 text-center text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #fff 1px, transparent 0)", backgroundSize: "28px 28px" }} />
            <div className="relative">
              <TrendingUp className="w-10 h-10 text-emerald-300 mx-auto mb-4" strokeWidth={2} />
              <h3 className="font-heading text-2xl lg:text-3xl font-bold leading-tight">
                {t("landing.flywheelTitle")}<span className="text-emerald-300">{t("landing.flywheelHighlight")}</span>
              </h3>
              <p className="mt-4 text-white/75 max-w-2xl mx-auto leading-relaxed">
                {t("landing.flywheelSubtitle")}
              </p>
              <Link
                to="/register"
                data-testid="flow-register"
                className="mt-7 inline-flex items-center gap-2 h-14 px-7 rounded-2xl bg-white text-slate-900 font-bold text-base hover:bg-emerald-300 transition-colors tap"
              >
                {t("landing.flywheelCta")} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ====== MARKETING STUDIO — qué crea (demo visual) ====== */}
      <section id="marketing" className="py-20 lg:py-28 bg-white" data-testid="landing-marketing-showcase">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 mb-3">
              <Sparkles className="w-3.5 h-3.5" /> {t("landing.mktEyebrow")}
            </div>
            <h2 className="font-heading text-4xl lg:text-5xl font-bold tracking-tight">
              {t("landing.mktTitle")}<span className="bg-gradient-to-br from-blue-900 to-emerald-500 bg-clip-text text-transparent">{t("landing.mktTitleHighlight")}</span>
            </h2>
            <p className="mt-5 text-lg text-slate-600 leading-relaxed">
              <Trans i18nKey="landing.mktSubtitle" components={{ b: <strong className="text-slate-900" /> }} />
            </p>
            <ul className="mt-7 space-y-3">
              {t("landing.mktPoints", { returnObjects: true }).map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" strokeWidth={3} />
                  <span className="text-slate-700">{p}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Visual: 1 Reel (9:16) + 2 posts (1:1), ejemplos reales generados */}
          <div className="relative">
            <div className="rounded-3xl bg-slate-50 border border-slate-200 p-5 lg:p-6">
              <div className="grid grid-cols-2 gap-4">
                {/* Reel card */}
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-md aspect-[9/16] bg-slate-900" data-testid="showcase-reel">
                  <img src="/social-previews/before_after.jpg" alt="Reel Antes y Después" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/55 text-white text-[10px] font-bold">
                    <Film className="w-3 h-3" /> Reel · 0:10
                  </span>
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                      <Play className="w-5 h-5 text-slate-900 ml-0.5" fill="currentColor" />
                    </span>
                  </span>
                </div>
                {/* 2 posts stacked */}
                <div className="flex flex-col gap-4">
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-md aspect-square" data-testid="showcase-post-1">
                    <img src="/social-previews/promo.jpg" alt="Post promoción" className="w-full h-full object-cover" />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white/85 text-slate-700 text-[9px] font-bold uppercase tracking-wide">Promo</span>
                  </div>
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-md aspect-square" data-testid="showcase-post-2">
                    <img src="/social-previews/bold_bar.jpg" alt="Post showcase" className="w-full h-full object-cover" />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white/85 text-slate-700 text-[9px] font-bold uppercase tracking-wide">Post</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> {t("landing.mktExample")}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====== GOOGLE + REVIEWS (AI) — reemplaza herramientas caras ====== */}
      <section id="google-ia" className="py-20 lg:py-28 bg-slate-50" data-testid="landing-google-reviews">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 mb-3">
              <Star className="w-3.5 h-3.5" /> {L("Google + Reseñas con IA", "Google + AI Reviews")}
            </div>
            <h2 className="font-heading text-4xl lg:text-5xl font-bold tracking-tight">
              {L("Tu Google, en ", "Your Google, on ")}
              <span className="bg-gradient-to-br from-blue-900 to-emerald-500 bg-clip-text text-transparent">{L("piloto automático", "autopilot")}</span>
            </h2>
            <p className="mt-5 text-lg text-slate-600 leading-relaxed">
              {L(
                "Publica en tu Google Business, responde reseñas con IA y captura clientes desde cualquier sitio web — todo directo a tu CRM.",
                "Post to your Google Business, reply to reviews with AI, and capture leads from any website — straight into your CRM."
              )}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: Star, title: L("Publica en Google", "Post to Google"), desc: L("Crea y publica posts en tu perfil de Google Business directo desde UniTech. Más visibilidad y mejor SEO local.", "Create and publish posts to your Google Business profile straight from UniTech. More visibility and better local SEO.") },
              { icon: Bot, title: L("Responde reseñas con IA", "AI review replies"), desc: L("La IA redacta respuestas profesionales a tus reseñas en segundos. Tú solo apruebas y publicas.", "AI drafts professional replies to your reviews in seconds. You just approve and post.") },
              { icon: Globe, title: L("Captura leads en cualquier web", "Capture leads on any site"), desc: L("Pon un chatbot y formularios en el sitio de tus clientes. Cada lead entra a tu CRM automáticamente.", "Add a chatbot and forms to your clients' websites. Every lead lands in your CRM automatically.") },
            ].map((f) => (
              <div key={f.title} className="rounded-3xl bg-white border border-slate-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center shadow-md">
                  <f.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="mt-4 font-heading text-xl font-bold">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Replace expensive tools band */}
          <div className="mt-6 rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-emerald-950 p-8 lg:p-10 text-white relative overflow-hidden" data-testid="google-replace-band">
            <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #fff 1px, transparent 0)", backgroundSize: "28px 28px" }} />
            <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
              <div className="flex-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-400/15 border border-emerald-300/20 text-emerald-300 text-[11px] font-bold uppercase tracking-wider mb-3">
                  <TrendingUp className="w-3.5 h-3.5" /> {L("Ahorra cada mes", "Save every month")}
                </div>
                <h3 className="font-heading text-2xl lg:text-3xl font-bold leading-tight">
                  {L("Reemplaza herramientas que cuestan ", "Replace tools that cost ")}
                  <span className="text-emerald-300">$200+{L("/mes", "/mo")}</span>
                </h3>
                <p className="mt-3 text-white/75 max-w-2xl leading-relaxed">
                  {L(
                    "CRM, reseñas, chatbot, formularios y marketing — todo en una sola plataforma. Deja de pagar por varias apps.",
                    "CRM, reviews, chatbot, forms and marketing — all in one platform. Stop paying for multiple apps."
                  )}
                </p>
              </div>
              <Link to="/register" data-testid="google-replace-cta" className="inline-flex items-center justify-center gap-2 h-14 px-7 rounded-2xl bg-white text-slate-900 font-bold text-base hover:bg-emerald-300 transition-colors tap flex-none">
                {L("Empieza gratis", "Start free")} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ====== SMART CARD HIGHLIGHT (NFC) — conservada ====== */}
      <section
        id="tarjeta"
        className="py-20 lg:py-28 relative overflow-hidden text-white"
        style={{ background: "radial-gradient(ellipse at top right, #050810 0%, #0F172A 60%, #1E1B4B 100%)" }}
      >
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 rounded-full blur-3xl" style={{ background: "#7C3AED" }} />
          <div className="absolute bottom-10 right-1/4 w-80 h-80 rounded-full blur-3xl" style={{ background: "#10B981" }} />
        </div>

        <div className="max-w-7xl mx-auto px-5 lg:px-8 grid lg:grid-cols-12 gap-12 items-center relative">
          <div className="lg:col-span-6 text-white">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 text-xs font-bold uppercase tracking-wider mb-6">
              <Star className="w-3.5 h-3.5 text-amber-300" /> {t("landing.nfcBadge")}
            </div>
            <h2 className="font-heading text-4xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
              {t("landing.nfcTitle")}<span className="text-emerald-300">{t("landing.nfcHighlight")}</span>
            </h2>
            <p className="mt-6 text-lg text-white/75 leading-relaxed">
              <Trans i18nKey="landing.nfcSubtitle" components={{ b: <strong className="text-white" /> }} />
            </p>
            <div className="grid grid-cols-2 gap-4 mt-8">
              {[Phone, MessageSquare, Star, Bot, MapPin, Globe].map((Icon, i) => (
                <div key={i} className="flex items-center gap-2.5 text-white/90 text-sm">
                  <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="font-medium">{t("landing.nfcFeatures", { returnObjects: true })[i]}</span>
                </div>
              ))}
            </div>
            <Link
              to="/register"
              data-testid="card-register"
              className="mt-10 inline-flex items-center gap-2 h-14 px-7 rounded-2xl bg-white text-slate-900 font-bold text-base hover:bg-emerald-300 transition-colors tap"
            >
              {t("landing.nfcCreateCard")} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="lg:col-span-6 relative">
            <SmartCardPreview />
          </div>
        </div>

        {/* What is NFC + physical card explainer */}
        <div className="max-w-5xl mx-auto px-5 lg:px-8 mt-16 lg:mt-24 relative">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-bold uppercase tracking-wider mb-4 text-white">
              <Package className="w-3.5 h-3.5 text-emerald-300" /> {t("landing.nfcWhatBadge")}
            </div>
            <h3 className="font-heading text-3xl lg:text-4xl font-bold text-white tracking-tight">
              {t("landing.nfcWhatTitle")}
            </h3>
            <p className="mt-4 text-white/70 leading-relaxed">
              <Trans i18nKey="landing.nfcWhatSubtitle" components={{ b: <strong className="text-white" /> }} />
            </p>
          </div>

          {/* Two physical NFC cards showcase */}
          <div className="grid sm:grid-cols-2 gap-5 mb-12 max-w-3xl mx-auto">
            {NFC_CARD_IMGS.map((img, i) => {
              const c = { ...t("landing.nfcCards", { returnObjects: true })[i], img };
              return (
              <div
                key={i}
                data-testid={`nfc-card-${i}`}
                className="rounded-3xl bg-white/[0.05] border border-white/10 p-5 text-white"
              >
                <div className="rounded-2xl overflow-hidden bg-white/[0.03] border border-white/10 mb-4 flex items-center justify-center aspect-[16/10]">
                  <img
                    src={c.img}
                    alt={c.title}
                    loading="lazy"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-400/15 border border-emerald-300/20 text-[11px] font-bold uppercase tracking-wider text-emerald-300 mb-2">
                  <Star className="w-3 h-3" /> {c.tag}
                </div>
                <h4 className="font-heading font-bold text-lg">{c.title}</h4>
                <p className="text-white/70 text-sm mt-1.5 leading-relaxed">{c.desc}</p>
              </div>
              );
            })}
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {NFC_STEP_ICONS.map((Icon, i) => {
              const s = { ...t("landing.nfcSteps", { returnObjects: true })[i], n: String(i + 1) };
              return (
              <div key={i} className="rounded-2xl bg-white/[0.05] border border-white/10 p-6 text-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-white" strokeWidth={2} />
                  </div>
                  <span className="font-heading text-3xl font-bold text-white/15">{s.n}</span>
                </div>
                <h4 className="font-heading font-bold text-lg">{s.t}</h4>
                <p className="text-white/70 text-sm mt-1.5 leading-relaxed">{s.d}</p>
              </div>
              );
            })}
          </div>

          <div className="mt-7 rounded-2xl bg-white/[0.05] border border-white/10 p-5 flex items-start gap-3 text-white/85">
            <Sparkles className="w-5 h-5 text-emerald-300 flex-shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed">
              <Trans i18nKey="landing.nfcFootnote" components={{ b: <strong className="text-white" /> }} />
            </p>
          </div>
        </div>
      </section>

      {/* ====== Bilingüe (solo se muestra en español; no aplica al mercado anglo) ====== */}
      {!isEn && (
      <section id="espanol" className="py-20 lg:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 mb-3">Hecho para ti</div>
            <h2 className="font-heading text-4xl lg:text-5xl font-bold tracking-tight">
              Tú trabajas en español. <span className="bg-gradient-to-br from-blue-900 to-emerald-500 bg-clip-text text-transparent">Tus clientes reciben inglés.</span>
            </h2>
            <p className="mt-5 text-lg text-slate-600 leading-relaxed">
              UniTech está diseñado especialmente para dueños de negocios latinos. Tú manejas todo en español; tus clientes reciben documentos profesionales en inglés.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                "Sin traductores, sin complicaciones, sin perder tiempo",
                "100% del software en español, 100% de los documentos en inglés",
                "Mobile-first: se siente nativo en tu celular",
                "Mandas PDF y cobras como siempre — sin trámites",
              ].map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" strokeWidth={3} />
                  <span className="text-slate-700">{p}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ES → EN visual */}
          <div className="relative">
            <div className="rounded-3xl bg-slate-50 border border-slate-200 p-6 lg:p-8 space-y-4">
              <div className="rounded-2xl bg-white border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Languages className="w-4 h-4 text-blue-700" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("landing.esYouWrite")}</span>
                </div>
                <p className="text-slate-700 text-sm">{t("landing.esYouWriteEx")}</p>
              </div>
              <div className="flex items-center justify-center">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-blue-900 to-emerald-700 p-5 text-white shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-4 h-4 text-emerald-200" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">{t("landing.esClientGets")}</span>
                </div>
                <p className="text-sm font-medium leading-relaxed">{t("landing.esClientGetsEx")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ====== 3 PRODUCTOS / MÓDULOS — individual o bundle (movida al final, tras mostrar el valor) ====== */}
      <section id="productos" className="py-20 lg:py-28 bg-slate-50" data-testid="landing-products">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 mb-3">{t("landing.productsEyebrow")}</div>
            <h2 className="font-heading text-4xl lg:text-5xl font-bold tracking-tight">
              {t("landing.productsTitle")}<span className="bg-gradient-to-br from-blue-900 to-emerald-500 bg-clip-text text-transparent">{t("landing.productsTitleHighlight")}</span>
            </h2>
            <p className="mt-5 text-lg text-slate-600 leading-relaxed">
              {t("landing.productsSubtitle")}
            </p>
          </div>

          <div className="mt-10 grid md:grid-cols-3 gap-5">
            {PRODUCT_META.map((meta, i) => {
              const p = { ...t("landing.products", { returnObjects: true })[i], ...meta };
              return (
              <div key={p.id} data-testid={`product-card-${p.id}`}
                className={`relative rounded-3xl bg-white border p-6 flex flex-col tap transition-all hover:shadow-lg hover:-translate-y-0.5 ${p.badge ? "border-emerald-300 ring-1 ring-emerald-200" : "border-slate-200"}`}>
                {p.badge && (
                  <span className="absolute top-5 right-5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">{p.badge}</span>
                )}
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center shadow-md">
                  <p.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="mt-4 font-heading text-xl font-bold">{p.name}</h3>
                <div className="text-sm font-semibold text-emerald-700">{p.tagline}</div>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{p.desc}</p>
                {p.value && (
                  <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-emerald-800" data-testid={`product-value-${p.id}`}>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">{t("landing.valuePrefix")}</div>
                    <div className="mt-0.5 text-[12px] leading-snug">{p.value}</div>
                  </div>
                )}
                <ul className="mt-4 space-y-2 flex-1">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2 text-sm text-slate-700">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" strokeWidth={3} />
                      {pt}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-end justify-between">
                  <div>
                    <span className="font-heading text-2xl font-bold">{p.price}</span>
                    <span className="text-sm text-slate-400">{t("landing.perMonth")}</span>
                  </div>
                  <Link to={`/register?plan=${p.id}&billing=month`} data-testid={`product-cta-${p.id}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800 tap">
                    {t("landing.subscribe")} <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
              );
            })}
          </div>

          {/* Bundle highlight */}
          <div className="mt-6 rounded-3xl bg-gradient-to-br from-blue-900 to-emerald-700 p-6 lg:p-8 text-white shadow-xl flex flex-col lg:flex-row lg:items-center gap-6" data-testid="product-bundle">
            <div className="flex-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-emerald-100 text-[11px] font-bold uppercase tracking-wider mb-3">
                <Zap className="w-3.5 h-3.5" /> {t("landing.bundleBadge")}
              </div>
              <h3 className="font-heading text-2xl lg:text-3xl font-bold">{t("landing.bundleTitle")}</h3>
              <p className="mt-2 text-white/80 text-sm lg:text-base leading-relaxed">
                <Trans i18nKey="landing.bundleDesc" components={{ b: <strong className="text-white" /> }} />
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-semibold text-emerald-50" data-testid="bundle-replaces">
                {t("landing.bundleReplaces")}
              </div>
            </div>
            <div className="flex flex-col items-start lg:items-end gap-3">
              <div>
                <span className="font-heading text-4xl font-bold">$75</span>
                <span className="text-white/70">{t("landing.perMonth")}</span>
              </div>
              <Link to="/register?plan=bundle&billing=month" data-testid="bundle-cta"
                className="inline-flex items-center gap-1.5 px-6 h-12 rounded-xl bg-white text-slate-900 font-semibold hover:bg-slate-100 tap">
                {t("landing.bundleCta")} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-slate-400">{t("landing.bundleNote")}</p>
        </div>
      </section>

      {/* ====== STATS — banda de credibilidad ====== */}
      <section id="beneficios" className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
            <StatCard icon={Clock} label={t("landing.statsQuote")} value="< 30s" accent="emerald" />
            <StatCard icon={Languages} label={t("landing.statsLangs")} value="EN + ES" accent="blue" />
            <StatCard icon={Smartphone} label={t("landing.statsMobile")} value="iOS + Android" accent="purple" />
            <StatCard icon={Zap} label={t("landing.statsSetup")} value={t("landing.statsSetupVal")} accent="amber" />
          </div>
        </div>
      </section>

      {/* ====== FINAL CTA — Todo tu negocio. Conectado. ====== */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-4xl mx-auto px-5 lg:px-8">
          <div className="rounded-[2.5rem] bg-gradient-to-br from-blue-900 to-emerald-700 p-10 lg:p-16 text-center text-white relative overflow-hidden shadow-2xl shadow-blue-900/30">
            <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #fff 1px, transparent 0)", backgroundSize: "28px 28px" }} />
            <div className="relative">
              <Zap className="w-12 h-12 text-emerald-300 mx-auto mb-5" strokeWidth={2} />
              <h2 className="font-heading text-4xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
                {t("landing.finalTitle")}
              </h2>
              <p className="mt-6 text-lg text-white/80 max-w-2xl mx-auto leading-relaxed">
                {t("landing.finalSubtitle")}
              </p>
              <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
                <Link
                  to="/register"
                  data-testid="final-register"
                  className="inline-flex items-center justify-center gap-2 h-14 px-8 rounded-2xl bg-white text-slate-900 font-bold text-base hover:bg-emerald-300 transition-colors tap"
                >
                  {t("landing.heroCreateFree")} <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center h-14 px-8 rounded-2xl border border-white/30 text-white font-bold text-base hover:bg-white/10 tap"
                >
                  {t("landing.signIn")}
                </Link>
              </div>
              <div className="mt-6 text-xs text-white/60">{t("landing.finalNote")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ====== FOOTER ====== */}
      <footer className="py-10 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center">
              <Hammer className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-heading font-bold text-slate-900">UniTech</span>
            <span className="text-slate-400">{t("landing.footerTagline")}</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <Link to="/privacidad" className="hover:text-slate-900 transition-colors" data-testid="footer-privacy-link">{t("landing.footerPrivacy")}</Link>
            <Link to="/terminos" className="hover:text-slate-900 transition-colors" data-testid="footer-terms-link">{t("landing.footerTerms")}</Link>
            <span>© {new Date().getFullYear()} UniTech. {t("landing.footerRights")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// VISUAL COMPONENTS
// ============================================================================
function PhoneMockup() {
  const { t, i18n } = useTranslation();
  const isEn = (i18n.language || "").toLowerCase().startsWith("en");
  return (
    <div className="relative mx-auto max-w-xs lg:max-w-sm">
      <div className="aspect-[9/19] rounded-[3rem] bg-slate-900 p-3 shadow-2xl shadow-blue-900/30 relative">
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-5 rounded-full bg-slate-900 z-10" />
        <div className="w-full h-full rounded-[2.3rem] bg-slate-50 overflow-hidden relative flex flex-col">
          {/* Top bar */}
          <div className="h-11 flex items-center justify-between px-4 bg-white border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center">
                <Hammer className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-heading font-bold text-sm">UniTech</span>
            </div>
            <LogOut className="w-4 h-4 text-slate-400" />
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-hidden px-3.5 pt-3 pb-2 space-y-2.5">
            {/* Greeting */}
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="text-[11px] text-slate-400 leading-none">{t("landing.mockGreeting")}</div>
                <h3 className="font-heading text-lg font-bold leading-tight mt-1 truncate">Carlos García 👋</h3>
                <div className="text-[11px] text-slate-400 leading-none">García Landscaping</div>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Settings className="w-4 h-4 text-slate-500" />
              </div>
            </div>

            {/* Earnings hero (slim) */}
            <div className="rounded-2xl bg-gradient-to-br from-blue-900 to-emerald-700 px-3 py-2.5 text-white shadow-md flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">{t("landing.mockEarned")}</div>
                <div className="font-heading text-xl font-bold leading-none">$8,940</div>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-200 bg-white/10 rounded-full px-2 py-1">
                <TrendingUp className="w-3.5 h-3.5" /> +24%
              </div>
            </div>

            {/* THE MAGIC: Spanish -> professional English quote (compact) */}
            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
              {/* Spanish input */}
              <div className="px-2.5 py-2.5 bg-slate-50/80 border-b border-slate-100">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{t("landing.mockWriteEs")}</span>
                  {!isEn && <span className="text-[11px]">🇲🇽</span>}
                </div>
                <p className="text-[12px] text-slate-700 leading-snug">{t("landing.mockInputEx")}</p>
              </div>
              {/* Transform */}
              <div className="flex items-center justify-center gap-1.5 py-2 bg-gradient-to-r from-blue-900 to-emerald-600">
                <Sparkles className="w-3.5 h-3.5 text-white" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white">{t("landing.mockAiWrites")}</span>
              </div>
              {/* Quote document */}
              <div className="px-3 py-2.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Receipt className="w-4 h-4 text-blue-700 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700 leading-tight">Quote #1042</div>
                      <div className="text-[9px] text-slate-400 leading-tight truncate">García Landscaping → Maria R.</div>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold uppercase text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5 flex items-center gap-0.5 flex-shrink-0"><Check className="w-3 h-3" /> Sent</span>
                </div>
                {/* Line items */}
                <div className="space-y-1.5">
                  {[
                    { d: "Remove & replace 20 roof shingles", p: "$1,000" },
                    { d: "Roof sealing & waterproofing", p: "$250" },
                    { d: "Site cleanup & haul-away", p: "$90" },
                  ].map((li) => (
                    <div key={li.d} className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="text-slate-700 truncate">{li.d}</span>
                      <span className="font-semibold text-slate-900 flex-shrink-0">{li.p}</span>
                    </div>
                  ))}
                </div>
                {/* Totals */}
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>Subtotal $1,340 · Tax (8.25%) $110</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total</span>
                    <span className="font-heading text-lg font-bold text-slate-900">$1,450.00</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stat grid (real dashboard) */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Users, label: t("landing.mockStatClients"), value: "24", color: "text-blue-700", bg: "bg-blue-50" },
                { icon: FileBadge, label: t("landing.mockStatQuotes"), value: "8", color: "text-purple-700", bg: "bg-purple-50" },
                { icon: DollarSign, label: t("landing.mockStatDue"), value: "$1,200", color: "text-amber-700", bg: "bg-amber-50" },
                { icon: Star, label: t("landing.mockStatReviews"), value: "4.9★", color: "text-emerald-700", bg: "bg-emerald-50" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-white border border-slate-100 shadow-sm p-2.5 flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
                    <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400 leading-tight truncate">{s.label}</div>
                    <div className="font-heading text-sm font-bold text-slate-900 leading-tight">{s.value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent quote */}
            <div className="rounded-xl bg-white border border-slate-100 shadow-sm px-2.5 py-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-900 leading-tight truncate">Backyard Landscape Design</div>
                <div className="text-[9px] text-slate-400">Q-1001 · $1,200.00 · Maria R.</div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
            </div>

            {/* Next job */}
            <div className="rounded-xl bg-white border border-slate-100 shadow-sm px-2.5 py-2 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <CalendarDays className="w-3.5 h-3.5 text-blue-700" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-blue-700">{t("landing.mockNextJob")}</span>
                  <span className="text-[9px] font-semibold text-slate-400">{t("landing.mockTomorrow")}</span>
                </div>
                <div className="text-[11px] font-bold text-slate-900 leading-tight mt-0.5 truncate">Sod &amp; sprinkler install · Houston</div>
              </div>
            </div>
          </div>

          {/* Bottom navigation (like real app) */}
          <div className="flex-shrink-0 bg-white border-t border-slate-100 px-2 pt-1.5 pb-2 flex items-end justify-around relative">
            {[
              { icon: LayoutDashboard, label: t("landing.mockNavHome") },
              { icon: Users, label: t("landing.mockNavClients") },
            ].map((n) => (
              <div key={n.label} className="flex flex-col items-center gap-0.5 text-slate-400">
                <n.icon className="w-4 h-4" />
                <span className="text-[8px] font-semibold">{n.label}</span>
              </div>
            ))}
            {/* Center highlighted: Tarjeta */}
            <div className="flex flex-col items-center gap-0.5 -mt-5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 ring-4 ring-white">
                <IdCard className="w-5 h-5 text-white" strokeWidth={2} />
              </div>
              <span className="text-[8px] font-bold text-emerald-700">{t("landing.mockNavCard")}</span>
            </div>
            {[
              { icon: CalendarDays, label: t("landing.mockNavSchedule") },
              { icon: User, label: t("landing.mockNavProfile") },
            ].map((n) => (
              <div key={n.label} className="flex flex-col items-center gap-0.5 text-slate-400">
                <n.icon className="w-4 h-4" />
                <span className="text-[8px] font-semibold">{n.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Floating chip */}
      <div className="absolute -right-4 lg:-right-10 top-[12%] bg-white rounded-2xl shadow-xl px-3 py-2 flex items-center gap-2 border border-slate-100">
        <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
          <Languages className="w-4 h-4 text-purple-600" />
        </div>
        <div className="text-[11px]">
          <div className="font-bold leading-tight">{t("landing.chipEsEn")}</div>
          <div className="text-slate-500">{t("landing.chipSeconds")}</div>
        </div>
      </div>
      <div className="absolute -left-4 lg:-left-10 bottom-[6%] bg-white rounded-2xl shadow-xl px-3 py-2 flex items-center gap-2 border border-slate-100">
        <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <Smartphone className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="text-[11px]">
          <div className="font-bold leading-tight">{t("landing.chipFromSite")}</div>
          <div className="text-slate-500">📍 Houston, TX</div>
        </div>
      </div>
    </div>
  );
}

// ---------- Card variants for the rotating mockup ----------
const CARD_VARIANTS = [
  {
    key: "landscaping",
    brand: "#15803D",
    accent: "#FACC15",
    brandDeep: "#052E16",
    cover: "/landing-yard.jpg",
    avatar: "https://images.unsplash.com/photo-1562925436-0a158efba8dc?w=400&q=80&auto=format&fit=crop&crop=faces",
    businessNameTop: "García",
    businessNameBot: "Landscaping",
    role: "Carlos García · Owner",
    Icon: Sprout,
    logoFrom: "from-emerald-600",
    logoTo: "to-emerald-900",
    chipColor: "text-emerald-600",
  },
  {
    key: "construction",
    brand: "#B91C1C",
    accent: "#F59E0B",
    brandDeep: "#3F0A0A",
    cover: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=900&q=80&auto=format&fit=crop",
    avatar: "https://images.unsplash.com/photo-1606931169057-67d79ff54b67?w=400&q=80&auto=format&fit=crop&crop=faces",
    businessNameTop: "Rivera",
    businessNameBot: "Construction",
    role: "Miguel Rivera · Owner",
    Icon: Hammer,
    logoFrom: "from-red-700",
    logoTo: "to-red-950",
    chipColor: "text-red-700",
  },
  {
    key: "cleaning",
    brand: "#0E7490",
    accent: "#FBBF24",
    brandDeep: "#083344",
    cover: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=900&q=80&auto=format&fit=crop",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80&auto=format&fit=crop&crop=faces",
    businessNameTop: "Hernández",
    businessNameBot: "Cleaning Co.",
    role: "María Hernández · Owner",
    Icon: Sparkles,
    logoFrom: "from-cyan-600",
    logoTo: "to-cyan-900",
    chipColor: "text-cyan-700",
  },
  {
    key: "painting",
    brand: "#2563EB",
    accent: "#F472B6",
    brandDeep: "#0C1B4A",
    cover: "https://images.unsplash.com/photo-1562259929-b4e1fd3aef09?w=900&q=80&auto=format&fit=crop",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80&auto=format&fit=crop&crop=faces",
    businessNameTop: "Ramos",
    businessNameBot: "Painting",
    role: "José Ramos · Owner",
    Icon: PaintBucket,
    logoFrom: "from-blue-600",
    logoTo: "to-blue-900",
    chipColor: "text-blue-700",
  },
  {
    key: "hvac",
    brand: "#EA580C",
    accent: "#10B981",
    brandDeep: "#431407",
    cover: "https://images.unsplash.com/photo-1581094288338-2314dddb7ece?w=900&q=80&auto=format&fit=crop",
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&q=80&auto=format&fit=crop&crop=faces",
    businessNameTop: "Cruz",
    businessNameBot: "HVAC Services",
    role: "Roberto Cruz · Tech",
    Icon: Wind,
    logoFrom: "from-orange-600",
    logoTo: "to-orange-900",
    chipColor: "text-orange-700",
  },
];

function CardPhoneMockup({ variant, visible }) {
  const v = variant;
  return (
    <div
      className="absolute inset-0 transition-opacity duration-1000 ease-out"
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none" }}
    >
      <div className="aspect-[9/18] rounded-[3rem] bg-slate-950 p-3 shadow-2xl shadow-slate-900/40 relative border border-white/5">
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-5 rounded-full bg-slate-900 z-30" />
        <div
          className="w-full h-full rounded-[2.3rem] overflow-hidden relative flex flex-col"
          style={{ background: `radial-gradient(ellipse at top, ${v.brand} 0%, ${v.brandDeep} 80%)` }}
        >
          {/* Cover */}
          <div className="absolute inset-0">
            <img src={v.cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0" style={{
              background:
                "linear-gradient(180deg, rgba(5,8,16,0.4) 0%, transparent 25%, transparent 55%, rgba(5,8,16,0.85) 88%, rgba(5,8,16,0.98) 100%)",
            }} />
            <div className="absolute inset-0 mix-blend-overlay opacity-40" style={{
              background: `radial-gradient(ellipse at top, ${v.brand}99 0%, transparent 60%)`,
            }} />
          </div>

          {/* Top bar */}
          <div className="absolute top-7 inset-x-5 flex items-center justify-between z-20">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-lg p-2">
              <div className={`w-full h-full rounded-xl bg-gradient-to-br ${v.logoFrom} ${v.logoTo} flex items-center justify-center`}>
                <v.Icon className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-white inline-flex items-center gap-1.5">
              <Globe className="w-3 h-3" />
              <span className="text-[11px] font-bold">ES</span>
            </div>
          </div>

          {/* Avatar */}
          <div className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="w-[124px] h-[124px] rounded-full p-[3px]"
                 style={{ background: `linear-gradient(135deg, ${v.brand}, ${v.accent})` }}>
              <div className="w-full h-full rounded-full bg-white p-[3px]">
                <img src={v.avatar} alt="" className="w-full h-full object-cover rounded-full" />
              </div>
            </div>
          </div>

          {/* Bottom content */}
          <div className="mt-auto relative z-10 px-5 pb-5 text-white text-center">
            <h3 className="font-heading font-bold text-3xl leading-[1.05] drop-shadow-lg">{v.businessNameTop}</h3>
            <h3 className="font-heading font-bold text-3xl leading-[1.05] drop-shadow-lg">{v.businessNameBot}</h3>
            <div className="text-base text-white/85 mt-2 drop-shadow">{v.role}</div>

            <div className="grid grid-cols-4 gap-2 mt-5 px-3 py-3 rounded-2xl backdrop-blur-md text-left"
                 style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              {[
                { Icon: Phone, label: "Call" },
                { Icon: MessageSquare, label: "Text" },
                { Icon: Send, label: "WhatsApp" },
                { Icon: Mail, label: "Email" },
              ].map(({ Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-1">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg"
                       style={{ background: v.brand, boxShadow: `0 4px 12px ${v.brand}66` }}>
                    <Icon className="w-5 h-5 text-white" strokeWidth={2.2} />
                  </div>
                  <div className="text-[10px] text-white/85 font-semibold">{label}</div>
                </div>
              ))}
            </div>

            <div className="mt-2 rounded-2xl px-3 py-2.5 flex items-center gap-2 backdrop-blur-md"
                 style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center">
                <QrCode className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center">
                <Share2 className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex-1 flex items-center justify-center gap-1.5 text-white text-xs font-bold">
                <Save className="w-3.5 h-3.5" />
                Save Contact
              </div>
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: v.accent }}>
                <Sparkles className="w-3.5 h-3.5 text-slate-900" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SmartCardPreview() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % CARD_VARIANTS.length), 5000);
    return () => clearInterval(id);
  }, [paused]);

  const active = CARD_VARIANTS[idx];

  return (
    <div
      className="relative mx-auto max-w-xs lg:max-w-sm"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Two stacked phones — fade between them */}
      <div className="relative aspect-[9/18]">
        {CARD_VARIANTS.map((v, i) => (
          <CardPhoneMockup key={v.key} variant={v} visible={i === idx} />
        ))}
      </div>

      {/* Industry indicator dots */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 z-30">
        {CARD_VARIANTS.map((v, i) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setIdx(i)}
            aria-label={`Show ${v.key} card`}
            data-testid={`mockup-dot-${v.key}`}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i === idx ? "w-8 bg-white" : "w-1.5 bg-white/35 hover:bg-white/60"
            }`}
          />
        ))}
      </div>

      {/* Floating chips — adapt color to active variant */}
      <div className="hidden sm:flex absolute right-0 lg:-right-4 top-16 bg-white rounded-2xl shadow-xl px-3 py-2 items-center gap-2 z-20">
        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
        <div className="text-[11px]">
          <div className="font-bold leading-tight">5.0 reseñas</div>
          <div className="text-slate-500">147 clientes</div>
        </div>
      </div>
      <div className="hidden sm:flex absolute left-0 lg:-left-4 top-40 bg-white rounded-2xl shadow-xl px-3 py-2 items-center gap-2 z-20">
        <Bot className={`w-4 h-4 transition-colors duration-500 ${active.chipColor}`} />
        <div className="text-[11px]">
          <div className="font-bold leading-tight">AI respondió</div>
          <div className="text-slate-500">12 leads esta semana</div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }) {
  const palette = {
    emerald: "from-emerald-500 to-emerald-700",
    blue: "from-blue-700 to-blue-900",
    purple: "from-purple-600 to-pink-600",
    amber: "from-amber-500 to-orange-600",
  };
  return (
    <div className="rounded-3xl bg-white border border-slate-100 p-6 lg:p-7 flex flex-col items-center text-center shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${palette[accent]} flex items-center justify-center mb-4 shadow-md`}>
        {Icon && <Icon className="w-6 h-6 text-white" strokeWidth={2} />}
      </div>
      <div className={`font-heading text-3xl lg:text-4xl font-bold bg-gradient-to-br ${palette[accent]} bg-clip-text text-transparent`}>
        {value}
      </div>
      <div className="mt-2 text-sm font-medium text-slate-500 leading-snug">{label}</div>
    </div>
  );
}
