/**
 * Public landing page for Unitap.
 * Spanish for the contractor (visitor). Narrative follows the full business
 * flow: get a client → quote with AI → accept → invoice → payments → schedule
 * → photos → reviews. All customer-facing docs are in English.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PlatformChat from "@/components/PlatformChat";
import {
  Hammer, Sparkles, CalendarDays, IdCard, Receipt, Users,
  MessageSquare, Camera, Globe, Smartphone, Zap, ArrowRight, Check, Star,
  Phone, MapPin, Languages, Bot, Send, Mail, Save, QrCode, Share2, Sprout,
  PaintBucket, Wind, LayoutDashboard, DollarSign, TrendingUp, Clock, FileBadge, Package,
} from "lucide-react";

const SERVICES = [
  "Roofing", "Drywall", "Painting", "Concrete", "Cleaning",
  "Landscaping", "Catering", "Plumbing", "Electrical", "HVAC",
];

// ── "Así Funciona" — el flujo completo del negocio, conectado ──
const FLOW = [
  {
    n: "01", icon: IdCard, title: "Consigue nuevos clientes",
    lead: "Comparte tu Tarjeta Inteligente por código QR, NFC, link directo o redes sociales.",
    points: ["Ven tus servicios y fotos de tus trabajos", "Guardan tu contacto al instante", "Solicitan una cotización y te contactan fácil", "Todo entra automático a tu sistema"],
  },
  {
    n: "02", icon: Sparkles, title: "Crea presupuestos “quote” en segundos",
    lead: "Describe el trabajo en español — la inteligencia artificial hace el resto.",
    points: ["Presupuesto “quote” profesional automático", "Alcance del trabajo “Scope of Work” detallado", "Documento en inglés para tu cliente", "PDF listo para enviar"],
  },
  {
    n: "03", icon: FileBadge, title: "Tu cliente acepta el presupuesto “quote”",
    lead: "Recibe una propuesta profesional y la aprueba desde su celular.",
    points: ["Revisa servicios, términos y alcance del trabajo", "Aprueba con un tap", "Todo queda documentado en el sistema"],
  },
  {
    n: "04", icon: Receipt, title: "La factura “invoice” se genera sola",
    lead: "Al aprobar el presupuesto, Unitap crea la factura “invoice” profesional automáticamente.",
    points: ["Factura “invoice” profesional al instante", "Listo para enviar y para cobrar", "Sin volver a escribir la misma información"],
  },
  {
    n: "05", icon: DollarSign, title: "Recibe depósitos y pagos",
    lead: "Lleva el control total del dinero, sin que se te escape un dólar.",
    points: ["Pago inicial, pagos parciales y balance pendiente", "Cobra por Venmo, PayPal, CashApp, Zelle, efectivo o cheque", "Siempre sabes quién pagó y quién debe"],
  },
  {
    n: "06", icon: CalendarDays, title: "Agenda el trabajo",
    lead: "Agéndalos en tu calendario y mantén tus trabajos bien organizados.",
    points: ["Trabajos de una sola vez o recurrentes", "Semanales, cada dos semanas o una vez al mes", "Programados, en progreso, completados y pendientes de pago"],
  },
  {
    n: "07", icon: Camera, title: "Guarda fotos y evidencia",
    lead: "Sube fotos del antes, durante y después de cada proyecto.",
    points: ["Tu portafolio ligado a cada cliente y trabajo", "Organizado para ti y para tus clientes"],
  },
  {
    n: "08", icon: Star, title: "Pide reseñas automáticamente",
    lead: "Cuando el trabajo termina, Unitap genera el mensaje para pedir la reseña.",
    points: ["Mensaje profesional automático", "Incluye tarjeta NFC: pide reseñas en persona con un solo tap", "Más reseñas, más confianza, más clientes nuevos"],
  },
];

// ── "Lo que antes tomaba horas, ahora toma minutos" ──
const BENEFITS = [
  { icon: Users, t: "Más clientes" },
  { icon: LayoutDashboard, t: "Más organización" },
  { icon: Star, t: "Más profesionalismo" },
  { icon: Clock, t: "Menos tiempo perdido" },
  { icon: Zap, t: "Menos estrés" },
  { icon: TrendingUp, t: "Más crecimiento" },
];

export default function Landing() {
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
              <div className="font-heading font-bold text-base">Unitap</div>
              <div className="text-[10px] text-slate-500">Tu negocio en un tap</div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#como-funciona" className="hover:text-slate-900 tap">Cómo funciona</a>
            <a href="#tarjeta" className="hover:text-slate-900 tap">Tarjeta NFC</a>
            <a href="#espanol" className="hover:text-slate-900 tap">En español</a>
            <a href="#beneficios" className="hover:text-slate-900 tap">Beneficios</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" data-testid="nav-login" className="hidden sm:inline-flex items-center px-4 h-10 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 tap">
              Iniciar sesión
            </Link>
            <Link to="/register" data-testid="nav-register" className="inline-flex items-center gap-1.5 px-4 h-10 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-black tap">
              Crear cuenta <ArrowRight className="w-3.5 h-3.5" />
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
              <Languages className="w-3.5 h-3.5" /> Tú en español · tus clientes en inglés
            </div>
            <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight">
              Cotiza, factura y haz contratos en <span className="bg-gradient-to-br from-blue-900 via-blue-700 to-emerald-500 bg-clip-text text-transparent">inglés perfecto.</span> Escribiendo en español.
            </h1>
            <p className="mt-7 text-lg lg:text-xl text-slate-600 leading-relaxed max-w-2xl">
              Tú describes el trabajo en <strong className="text-slate-900">español</strong> y Unitap redacta presupuestos «quotes», contratos e invoices impecables en <strong className="text-slate-900">inglés — sin que sepas el idioma.</strong> Y para crecer tu negocio: tarjeta NFC para conseguir clientes, reseñas 5★ en Google y links de pago para cobrar al instante.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md">
              <Link
                to="/register"
                data-testid="hero-register"
                className="inline-flex items-center justify-center gap-2 h-14 px-7 rounded-2xl bg-gradient-to-br from-blue-900 to-emerald-600 text-white font-bold text-base shadow-lg shadow-blue-900/20 hover:shadow-xl hover:-translate-y-0.5 transition-all tap"
              >
                Crear cuenta gratis <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                data-testid="hero-login"
                className="inline-flex items-center justify-center h-14 px-7 rounded-2xl border border-slate-200 bg-white text-slate-900 font-bold text-base hover:border-slate-400 tap"
              >
                Ya tengo cuenta
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
              <div className="inline-flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-600" /> Sin tarjeta de crédito</div>
              <div className="inline-flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-600" /> Funciona desde el celular</div>
              <div className="inline-flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-600" /> Cancela cuando quieras</div>
            </div>
          </div>

          <div className="lg:col-span-5 relative">
            <PhoneMockup />
          </div>
        </div>

        {/* Services scroll strip */}
        <div className="mt-20 lg:mt-28">
          <div className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-4">
            Hecho para
          </div>
          <div className="flex flex-wrap justify-center gap-2 px-5">
            {SERVICES.map((s) => (
              <span key={s} className="px-4 py-2 rounded-full bg-slate-100 text-slate-700 text-sm font-semibold">{s}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ====== PAIN CONSOLIDATION BAND ====== */}
      <section className="py-16 lg:py-20 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #fff 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="max-w-4xl mx-auto px-5 lg:px-8 text-center relative">
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
            Olvídate de WhatsApp, notas del celular, <br className="hidden lg:block" />papeles y mil aplicaciones.
          </h2>
          <p className="mt-5 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">
            Toda la información de tu negocio regada en mil lados es dinero y tiempo que pierdes. Con Unitap manejas <strong className="text-white">todo desde un solo lugar.</strong>
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3 text-sm">
            {["Papelitos", "WhatsApp", "Excel", "Notas", "Word", "3 apps más"].map((x) => (
              <span key={x} className="px-4 py-2 rounded-full bg-white/[0.06] border border-white/10 text-white/50 line-through">{x}</span>
            ))}
            <ArrowRight className="w-5 h-5 text-emerald-400 hidden sm:block" />
            <span className="px-5 py-2 rounded-full bg-emerald-500 text-slate-900 font-bold inline-flex items-center gap-2">
              <Hammer className="w-4 h-4" /> Unitap
            </span>
          </div>
        </div>
      </section>

      {/* ====== ASÍ FUNCIONA — 8 pasos ====== */}
      <section id="como-funciona" className="py-20 lg:py-28">
        <div className="max-w-4xl mx-auto px-5 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 mb-3">Así funciona</div>
            <h2 className="font-heading text-4xl lg:text-5xl font-bold tracking-tight">
              Tu negocio completo, <span className="bg-gradient-to-br from-blue-900 to-emerald-500 bg-clip-text text-transparent">paso a paso.</span>
            </h2>
            <p className="mt-5 text-lg text-slate-600 leading-relaxed">
              Desde que el cliente te encuentra hasta que te deja una reseña 5★ — cada paso conectado con el siguiente.
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
                    <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-1">Paso {step.n}</div>
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
                Y el ciclo se repite. <span className="text-emerald-300">Cada reseña te trae el siguiente cliente.</span>
              </h3>
              <p className="mt-4 text-white/75 max-w-2xl mx-auto leading-relaxed">
                Unitap no es un gasto más: es una máquina que hace crecer tu negocio sola — más reseñas, más visibilidad en Google, más clientes, más trabajos.
              </p>
              <Link
                to="/register"
                data-testid="flow-register"
                className="mt-7 inline-flex items-center gap-2 h-14 px-7 rounded-2xl bg-white text-slate-900 font-bold text-base hover:bg-emerald-300 transition-colors tap"
              >
                Crear cuenta gratis <ArrowRight className="w-4 h-4" />
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
              <Star className="w-3.5 h-3.5 text-amber-300" /> Paso 1 — Consigue clientes
            </div>
            <h2 className="font-heading text-4xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
              Tu Tarjeta Inteligente. <span className="text-emerald-300">Tu mejor vendedor.</span>
            </h2>
            <p className="mt-6 text-lg text-white/75 leading-relaxed">
              <strong className="text-white">Recibes una tarjeta física NFC profesional</strong> — es tu mini-sitio profesional con foto, servicios, reseñas y QR. La acercas al celular de cualquier cliente y se abre al instante: te llaman, te mandan WhatsApp o piden presupuesto. Y un AI chat les responde 24/7 en su idioma.
            </p>
            <div className="grid grid-cols-2 gap-4 mt-8">
              {[
                { i: Phone, t: "Llamada con 1 tap" },
                { i: MessageSquare, t: "WhatsApp directo" },
                { i: Star, t: "Reseñas de Google" },
                { i: Bot, t: "AI chat 24/7" },
                { i: MapPin, t: "Captura de clientes" },
                { i: Globe, t: "Inglés + Español" },
              ].map((x) => (
                <div key={x.t} className="flex items-center gap-2.5 text-white/90 text-sm">
                  <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0">
                    <x.i className="w-4 h-4" />
                  </div>
                  <span className="font-medium">{x.t}</span>
                </div>
              ))}
            </div>
            <Link
              to="/register"
              data-testid="card-register"
              className="mt-10 inline-flex items-center gap-2 h-14 px-7 rounded-2xl bg-white text-slate-900 font-bold text-base hover:bg-emerald-300 transition-colors tap"
            >
              Crear mi tarjeta gratis <ArrowRight className="w-4 h-4" />
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
              <Package className="w-3.5 h-3.5 text-emerald-300" /> Recibes una tarjeta física
            </div>
            <h3 className="font-heading text-3xl lg:text-4xl font-bold text-white tracking-tight">
              ¿Qué es una tarjeta NFC? Así de fácil funciona.
            </h3>
            <p className="mt-4 text-white/70 leading-relaxed">
              NFC es la misma tecnología de Apple Pay. Tu cliente <strong className="text-white">no necesita bajar ninguna app</strong> — solo acerca su teléfono a tu tarjeta.
            </p>
          </div>

          {/* Two physical NFC cards showcase */}
          <div className="grid sm:grid-cols-2 gap-5 mb-12 max-w-3xl mx-auto">
            {[
              {
                img: "/nfc-sample.png",
                tag: "Tarjeta Inteligente",
                title: "Smart Business Card NFC",
                desc: "Tu mini-sitio profesional en un tap: servicios, llamada, WhatsApp, AI chat y captura de clientes.",
              },
              {
                img: "/nfc-google-review.png",
                tag: "Reseñas Google",
                title: "Tarjeta de Reseñas NFC",
                desc: "Pide reseñas 5★ en persona con un solo tap. Más reseñas, más confianza, más clientes nuevos.",
              },
            ].map((c) => (
              <div
                key={c.title}
                data-testid={`nfc-card-${c.tag.toLowerCase().replace(/\s+/g, "-")}`}
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
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: Package, n: "1", t: "Te llega a tu casa", d: "Recibes una tarjeta física NFC profesional, lista para usar." },
              { icon: Smartphone, n: "2", t: "La acercas al celular", d: "Solo un toque (tap) en el teléfono del cliente. Sin apps ni configuración — funciona en iPhone y Android." },
              { icon: Sparkles, n: "3", t: "Se abre tu perfil al instante", d: "El cliente ve tus servicios, te llama, te manda WhatsApp, guarda tu contacto o pide un presupuesto." },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl bg-white/[0.05] border border-white/10 p-6 text-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                    <s.icon className="w-5 h-5 text-white" strokeWidth={2} />
                  </div>
                  <span className="font-heading text-3xl font-bold text-white/15">{s.n}</span>
                </div>
                <h4 className="font-heading font-bold text-lg">{s.t}</h4>
                <p className="text-white/70 text-sm mt-1.5 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>

          <div className="mt-7 rounded-2xl bg-white/[0.05] border border-white/10 p-5 flex items-start gap-3 text-white/85">
            <Sparkles className="w-5 h-5 text-emerald-300 flex-shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed">
              <strong className="text-white">Adiós a las tarjetas de papel</strong> que se pierden o se tiran. Una sola tarjeta NFC para siempre — y la actualizas cuando quieras (nuevos servicios, fotos o teléfono) <strong className="text-white">sin reimprimir nada</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* ====== TODO EN ESPAÑOL ====== */}
      <section id="espanol" className="py-20 lg:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 mb-3">Hecho para ti</div>
            <h2 className="font-heading text-4xl lg:text-5xl font-bold tracking-tight">
              Tú trabajas en español. <span className="bg-gradient-to-br from-blue-900 to-emerald-500 bg-clip-text text-transparent">Tus clientes reciben inglés.</span>
            </h2>
            <p className="mt-5 text-lg text-slate-600 leading-relaxed">
              Unitap está diseñado especialmente para dueños de negocios latinos. Tú manejas todo en español; tus clientes reciben documentos profesionales en inglés.
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
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tú escribes (Español)</span>
                </div>
                <p className="text-slate-700 text-sm">"Reparación de drywall en sala, incluye textura y pintura."</p>
              </div>
              <div className="flex items-center justify-center">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-blue-900 to-emerald-700 p-5 text-white shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-4 h-4 text-emerald-200" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">Tu cliente recibe (English)</span>
                </div>
                <p className="text-sm font-medium leading-relaxed">"Living room drywall repair, including texture and paint. Materials and labor included. Professional finish guaranteed."</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====== BENEFICIOS — horas → minutos ====== */}
      <section id="beneficios" className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 mb-3">El resultado</div>
            <h2 className="font-heading text-4xl lg:text-5xl font-bold tracking-tight">
              Lo que antes tomaba horas, <span className="bg-gradient-to-br from-blue-900 to-emerald-500 bg-clip-text text-transparent">ahora toma minutos.</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
            {BENEFITS.map((b) => (
              <div key={b.t} className="rounded-2xl bg-white border border-slate-200 p-6 flex flex-col items-center text-center hover:shadow-lg hover:-translate-y-0.5 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center mb-3">
                  <b.icon className="w-6 h-6 text-white" strokeWidth={2} />
                </div>
                <div className="font-heading font-bold text-lg">{b.t}</div>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
            <StatCard label="Tiempo para crear un presupuesto “quote”" value="< 30s" accent="emerald" />
            <StatCard label="Idiomas soportados" value="EN + ES" accent="blue" />
            <StatCard label="Acceso 100% mobile" value="iOS + Android" accent="purple" />
            <StatCard label="Setup inicial" value="2 minutos" accent="amber" />
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
                Todo tu negocio. Conectado.
              </h2>
              <p className="mt-6 text-lg text-white/80 max-w-2xl mx-auto leading-relaxed">
                Desde el primer contacto hasta la reseña final, Unitap te ayuda a administrar tu negocio como un profesional. Se paga solo con un trabajo.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
                <Link
                  to="/register"
                  data-testid="final-register"
                  className="inline-flex items-center justify-center gap-2 h-14 px-8 rounded-2xl bg-white text-slate-900 font-bold text-base hover:bg-emerald-300 transition-colors tap"
                >
                  Crear cuenta gratis <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center h-14 px-8 rounded-2xl border border-white/30 text-white font-bold text-base hover:bg-white/10 tap"
                >
                  Iniciar sesión
                </Link>
              </div>
              <div className="mt-6 text-xs text-white/60">Sin tarjeta de crédito · Cancela cuando quieras</div>
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
            <span className="font-heading font-bold text-slate-900">Unitap</span>
            <span className="text-slate-400">— Tu negocio en un tap · QR + NFC</span>
          </div>
          <div className="text-xs">© {new Date().getFullYear()} Unitap. Todos los derechos reservados.</div>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// VISUAL COMPONENTS
// ============================================================================
function PhoneMockup() {
  return (
    <div className="relative mx-auto max-w-xs lg:max-w-sm">
      <div className="aspect-[9/19] rounded-[3rem] bg-slate-900 p-3 shadow-2xl shadow-blue-900/30 relative">
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-5 rounded-full bg-slate-900 z-10" />
        <div className="w-full h-full rounded-[2.3rem] bg-slate-50 overflow-hidden relative flex flex-col">
          {/* Top bar */}
          <div className="h-12 flex items-center justify-between px-4 bg-white border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center">
                <Hammer className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-heading font-bold text-sm">Unitap</span>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">Pro</span>
          </div>

          <div className="flex-1 overflow-hidden p-3.5 space-y-2.5">
            {/* Greeting + earnings */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Cobrado este mes</div>
                <div className="font-heading text-2xl font-bold bg-gradient-to-br from-emerald-500 to-emerald-700 bg-clip-text text-transparent leading-none mt-0.5">$8,940</div>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded-full px-2 py-1">
                <TrendingUp className="w-3 h-3" /> +24%
              </div>
            </div>

            {/* THE MAGIC: Spanish -> English */}
            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
              {/* Spanish input */}
              <div className="p-2.5 bg-slate-50/80 border-b border-slate-100">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Tú escribes · Español</span>
                  <span className="text-[10px]">🇲🇽</span>
                </div>
                <p className="text-[11px] text-slate-700 leading-snug">"Cambié 20 tejas y sellé el techo. Cobrar $1,450."</p>
              </div>
              {/* Transform divider */}
              <div className="flex items-center justify-center gap-1.5 py-1.5 bg-gradient-to-r from-blue-900 to-emerald-600">
                <Sparkles className="w-3 h-3 text-white" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-white">AI lo redacta en inglés profesional</span>
              </div>
              {/* English output quote */}
              <div className="p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-blue-700" />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-blue-700">Quote #1042</span>
                  </div>
                  <span className="text-[8px] font-bold uppercase text-emerald-700 bg-emerald-50 rounded-full px-1.5 py-0.5 flex items-center gap-0.5"><Check className="w-2.5 h-2.5" /> Sent</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-600">Replace 20 roof shingles</span>
                    <span className="font-semibold text-slate-800">$1,100</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-600">Roof sealing &amp; cleanup</span>
                    <span className="font-semibold text-slate-800">$350</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-dashed border-slate-200">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Total</span>
                  <span className="font-heading text-base font-bold text-slate-900">$1,450.00</span>
                </div>
              </div>
            </div>

            {/* Payment received */}
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-2.5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-900 leading-tight">Pago recibido · +$1,450</div>
                <div className="text-[9px] text-slate-500">Maria Rodriguez · Stripe · hace 1 min</div>
              </div>
            </div>

            {/* Next job */}
            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-2.5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <CalendarDays className="w-4 h-4 text-blue-700" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-blue-700">Próximo trabajo</span>
                  <span className="text-[9px] font-semibold text-slate-400">Mañana</span>
                </div>
                <div className="text-[11px] font-bold text-slate-900 leading-tight mt-0.5">Fence installation · 8:00 AM</div>
              </div>
            </div>

            {/* New review */}
            <div className="rounded-2xl bg-amber-50 border border-amber-100 p-2.5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center flex-shrink-0">
                <Star className="w-4 h-4 text-white fill-white" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-900 leading-tight">Nueva reseña 5★ en Google</div>
                <div className="text-[9px] text-slate-500">"Great work, highly recommend!"</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Floating chips */}
      <div className="absolute -left-5 lg:-left-16 top-[42%] bg-white rounded-2xl shadow-xl px-3 py-2 flex items-center gap-2 border border-slate-100">
        <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
          <Languages className="w-4 h-4 text-purple-600" />
        </div>
        <div className="text-[11px]">
          <div className="font-bold leading-tight">Español → Inglés</div>
          <div className="text-slate-500">en 2 segundos</div>
        </div>
      </div>
      <div className="absolute -right-4 lg:-right-8 bottom-[14%] bg-white rounded-2xl shadow-xl px-3 py-2 flex items-center gap-2 border border-slate-100">
        <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <Smartphone className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="text-[11px]">
          <div className="font-bold leading-tight">Hecho desde la obra</div>
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

function StatCard({ label, value, accent }) {
  const palette = {
    emerald: "from-emerald-500 to-emerald-700",
    blue: "from-blue-700 to-blue-900",
    purple: "from-purple-600 to-pink-600",
    amber: "from-amber-500 to-orange-600",
  };
  return (
    <div className="rounded-3xl bg-white border border-slate-100 p-6 flex items-center justify-between gap-4 shadow-sm">
      <div className="text-sm font-medium text-slate-500 flex-1">{label}</div>
      <div className={`font-heading text-2xl lg:text-3xl font-bold bg-gradient-to-br ${palette[accent]} bg-clip-text text-transparent whitespace-nowrap`}>
        {value}
      </div>
    </div>
  );
}
