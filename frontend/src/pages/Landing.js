/**
 * Public landing page for ServicioFlow.
 * Spanish for the contractor (visitor); shows AI/CRM/Calendar/Smart Card features.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Hammer, Sparkles, CalendarDays, IdCard, FileText, Receipt, Users,
  MessageSquare, Camera, Globe, Smartphone, Zap, ArrowRight, Check, Star,
  Phone, MapPin, Languages, Bot, Send, Mail, Save, QrCode, Share2, Sprout,
} from "lucide-react";

const FEATURES = [
  {
    icon: Sparkles,
    title: "Quotes con AI",
    desc: "Describe el trabajo en español o sube una foto y la AI escribe un quote profesional en inglés. Listo en segundos.",
    accent: "from-emerald-500 to-emerald-700",
    pill: "GPT-5.2",
  },
  {
    icon: CalendarDays,
    title: "Agenda inteligente",
    desc: "Calendario con vista de día, semana, mes y lista. Soporta trabajos recurrentes (cleaning semanal, landscaping) y proyectos multi-día (roofing de 3 semanas).",
    accent: "from-blue-700 to-blue-900",
    pill: "Nuevo",
  },
  {
    icon: IdCard,
    title: "Tarjeta Inteligente",
    desc: "Mini-sitio premium con QR. Tus clientes te ven, te llaman, te dejan reseña y piden quote desde el celular. Con AI chat 24/7.",
    accent: "from-purple-700 to-pink-600",
    pill: "Premium",
  },
  {
    icon: Receipt,
    title: "Invoices y PDFs",
    desc: "Convierte el quote en invoice con un click. Descarga PDF, mándalo por WhatsApp o email. El cliente lo imprime si quiere.",
    accent: "from-orange-500 to-red-600",
  },
  {
    icon: Users,
    title: "CRM de clientes",
    desc: "Toda tu cartera en un solo lugar — historial de quotes, invoices, mensajes, fotos del trabajo y notas. Búscalo en segundos.",
    accent: "from-cyan-600 to-blue-700",
  },
  {
    icon: MessageSquare,
    title: "Mensajes AI",
    desc: "Follow-ups, recordatorios de pago, gracias por su negocio — la AI escribe en inglés profesional. Copia, pega, manda.",
    accent: "from-amber-500 to-orange-600",
  },
  {
    icon: Camera,
    title: "Fotos del trabajo",
    desc: "Sube fotos del antes y después desde la obra. Quedan ligadas al cliente y al trabajo. Tu portafolio digital.",
    accent: "from-slate-600 to-slate-900",
  },
  {
    icon: Bot,
    title: "AI Scope of Work",
    desc: "Genera scope detallado y profesional para cualquier trabajo. Incluye materiales, labor y timeline en inglés.",
    accent: "from-indigo-600 to-purple-700",
  },
];

const STEPS = [
  { n: "01", title: "Agrega tu cliente", desc: "Nombre, teléfono, dirección. 30 segundos." },
  { n: "02", title: "Crea el quote con AI", desc: "Descríbelo en español o sube fotos. La AI escribe el quote en inglés." },
  { n: "03", title: "Manda y cobra", desc: "Comparte por WhatsApp, email o PDF. Convierte a invoice cuando aprueben." },
];

const SERVICES = [
  "Roofing", "Drywall", "Painting", "Concrete", "Cleaning",
  "Landscaping", "Catering", "Plumbing", "Electrical", "HVAC",
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">
      {/* Top nav */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 tap" data-testid="landing-logo">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center">
              <Hammer className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="leading-none">
              <div className="font-heading font-bold text-base">ServicioFlow</div>
              <div className="text-[10px] text-slate-500">AI para contratistas</div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-slate-900 tap">Features</a>
            <a href="#how" className="hover:text-slate-900 tap">Cómo funciona</a>
            <a href="#card" className="hover:text-slate-900 tap">Tarjeta</a>
            <a href="#para-quien" className="hover:text-slate-900 tap">Para quién</a>
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
        {/* background mesh */}
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
              <Languages className="w-3.5 h-3.5" /> Tú en español. Tu cliente en inglés.
            </div>
            <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight">
              Cotiza, agenda y cobra <span className="bg-gradient-to-br from-blue-900 via-blue-700 to-emerald-500 bg-clip-text text-transparent">sin escribir inglés.</span>
            </h1>
            <p className="mt-7 text-lg lg:text-xl text-slate-600 leading-relaxed max-w-2xl">
              ServicioFlow es la app todo-en-uno para contratistas latinos. Crea quotes profesionales con AI, organiza tu agenda diaria, comparte tu Tarjeta Inteligente y trabaja desde el celular en la obra.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md">
              <Link
                to="/register"
                data-testid="hero-register"
                className="inline-flex items-center justify-center gap-2 h-14 px-7 rounded-2xl bg-gradient-to-br from-blue-900 to-emerald-600 text-white font-bold text-base shadow-lg shadow-blue-900/20 hover:shadow-xl hover:-translate-y-0.5 transition-all tap"
              >
                Empieza gratis <ArrowRight className="w-4 h-4" />
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

          {/* Phone mockup */}
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

      {/* ====== FEATURES ====== */}
      <section id="features" className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <div className="max-w-2xl mb-14">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 mb-3">Todo lo que necesitas</div>
            <h2 className="font-heading text-4xl lg:text-5xl font-bold tracking-tight">
              Una app, ocho herramientas que tu negocio necesita todos los días.
            </h2>
            <p className="mt-5 text-lg text-slate-600 leading-relaxed">
              Reemplaza WhatsApp, Excel, Google Calendar, Word y tres apps más. Todo conectado, todo en español para ti.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                data-testid={`feature-${i}`}
                className="group relative bg-white rounded-3xl p-6 border border-slate-100 hover:border-slate-300 hover:-translate-y-1 transition-all duration-300 shadow-sm hover:shadow-md"
              >
                {f.pill && (
                  <span className="absolute top-4 right-4 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-slate-900 text-white">
                    {f.pill}
                  </span>
                )}
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${f.accent} flex items-center justify-center mb-5 shadow-sm`}>
                  <f.icon className="w-6 h-6 text-white" strokeWidth={2.2} />
                </div>
                <h3 className="font-heading font-bold text-lg leading-tight mb-2">{f.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== HOW IT WORKS ====== */}
      <section id="how" className="py-20 lg:py-28">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 mb-3">Cómo funciona</div>
            <h2 className="font-heading text-4xl lg:text-5xl font-bold tracking-tight">
              3 pasos. De la llamada al cobro.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5 lg:gap-8 relative">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative">
                <div className="text-7xl lg:text-8xl font-heading font-bold leading-none bg-gradient-to-br from-blue-900 to-emerald-500 bg-clip-text text-transparent">
                  {s.n}
                </div>
                <h3 className="font-heading font-bold text-2xl tracking-tight mt-3">{s.title}</h3>
                <p className="text-slate-600 mt-2 leading-relaxed">{s.desc}</p>
                {i < STEPS.length - 1 && (
                  <ArrowRight className="hidden md:block absolute -right-4 top-12 text-slate-300 w-7 h-7" strokeWidth={1.5} />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== SMART CARD HIGHLIGHT ====== */}
      <section
        id="card"
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
              <Star className="w-3.5 h-3.5 text-amber-300" /> El feature más premium
            </div>
            <h2 className="font-heading text-4xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
              Tu Tarjeta Inteligente. <span className="text-emerald-300">Tu mejor vendedor.</span>
            </h2>
            <p className="mt-6 text-lg text-white/75 leading-relaxed">
              Un mini-sitio profesional con tu foto, servicios, reseñas y QR. Compártelo por WhatsApp o pégalo en tu camioneta. Tus prospectos te llaman, te mandan WhatsApp y piden quote — directo desde su celular. Y un AI chat les responde 24/7 en su idioma.
            </p>
            <div className="grid grid-cols-2 gap-4 mt-8">
              {[
                { i: Phone, t: "Llamada con 1 tap" },
                { i: MessageSquare, t: "WhatsApp directo" },
                { i: Star, t: "Reseñas de Google" },
                { i: Bot, t: "AI chat 24/7" },
                { i: MapPin, t: "Lead capture form" },
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
      </section>

      {/* ====== PARA QUIÉN ====== */}
      <section id="para-quien" className="py-20 lg:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 mb-3">Para quién</div>
            <h2 className="font-heading text-4xl lg:text-5xl font-bold tracking-tight">
              Hecho específicamente para dueños de negocios latinos.
            </h2>
            <p className="mt-5 text-lg text-slate-600 leading-relaxed">
              Sabemos que tus clientes son americanos y tú piensas en español. Sabemos que cobras en cash o cheque. Sabemos que tu oficina es tu camioneta. ServicioFlow está diseñado para esa realidad.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                "100% del software en español. 100% de los documentos al cliente en inglés.",
                "Mobile-first. La app se siente nativa en tu celular.",
                "Sin merchant account, sin Stripe, sin trámites. Mandas PDF y cobras como siempre.",
                "Tu data se guarda segura. Tú la controlas.",
              ].map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" strokeWidth={3} />
                  <span className="text-slate-700">{p}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <StatCard label="Tiempo para crear un quote con AI" value="< 30s" accent="emerald" />
            <StatCard label="Idiomas soportados" value="EN + ES" accent="blue" />
            <StatCard label="Acceso 100% mobile" value="iOS + Android" accent="purple" />
            <StatCard label="Setup inicial" value="2 minutos" accent="amber" />
          </div>
        </div>
      </section>

      {/* ====== FINAL CTA ====== */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-4xl mx-auto px-5 lg:px-8 text-center">
          <Zap className="w-12 h-12 text-emerald-600 mx-auto mb-5" strokeWidth={2} />
          <h2 className="font-heading text-4xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
            Tu próximo trabajo merece quote profesional.
          </h2>
          <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Crea tu cuenta gratis y manda tu primer quote en inglés hoy mismo. Sin riesgo, sin tarjeta de crédito.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
            <Link
              to="/register"
              data-testid="final-register"
              className="inline-flex items-center justify-center gap-2 h-14 px-8 rounded-2xl bg-gradient-to-br from-blue-900 to-emerald-600 text-white font-bold text-base shadow-lg shadow-blue-900/20 hover:shadow-xl hover:-translate-y-0.5 transition-all tap"
            >
              Crear cuenta gratis <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center h-14 px-8 rounded-2xl border border-slate-200 text-slate-900 font-bold text-base hover:bg-white tap"
            >
              Iniciar sesión
            </Link>
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
            <span className="font-heading font-bold text-slate-900">ServicioFlow</span>
            <span className="text-slate-400">— AI para contratistas latinos</span>
          </div>
          <div className="text-xs">© {new Date().getFullYear()} ServicioFlow. Todos los derechos reservados.</div>
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
        <div className="w-full h-full rounded-[2.3rem] bg-slate-50 overflow-hidden relative">
          {/* Top bar */}
          <div className="h-14 flex items-center justify-between px-4 bg-white border-b border-slate-200">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center">
              <Hammer className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-heading font-bold text-sm">ServicioFlow</span>
            <div className="w-8" />
          </div>
          <div className="p-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Hoy</div>
            <h3 className="font-heading text-2xl font-bold leading-tight">Buenos días,<br/>Carlos 👋</h3>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <MiniStat label="Quotes" value="8" accent="emerald" />
              <MiniStat label="Trabajos hoy" value="3" accent="blue" />
            </div>
            <div className="mt-3 rounded-2xl bg-white p-3 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Crear quote con AI</span>
              </div>
              <p className="text-xs text-slate-500">Describe el trabajo o sube foto</p>
              <div className="mt-2 h-9 rounded-xl bg-gradient-to-r from-blue-900 to-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                Empezar
              </div>
            </div>
            <div className="rounded-2xl bg-white p-3 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="w-3.5 h-3.5 text-blue-700" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Próximo</span>
              </div>
              <div className="font-semibold text-sm">Roofing inspection</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Hoy 9:00 AM • Maria Rodriguez</div>
            </div>
          </div>
        </div>
      </div>
      {/* Floating chips */}
      <div className="absolute -left-4 lg:-left-10 top-1/3 bg-white rounded-2xl shadow-xl px-3 py-2 flex items-center gap-2 border border-slate-100">
        <Bot className="w-4 h-4 text-purple-600" />
        <div className="text-[11px]">
          <div className="font-bold leading-tight">AI generó quote</div>
          <div className="text-slate-500">2 segundos</div>
        </div>
      </div>
      <div className="absolute -right-4 lg:-right-8 bottom-1/4 bg-white rounded-2xl shadow-xl px-3 py-2 flex items-center gap-2 border border-slate-100">
        <Smartphone className="w-4 h-4 text-emerald-600" />
        <div className="text-[11px]">
          <div className="font-bold leading-tight">Hecho desde la obra</div>
          <div className="text-slate-500">📍 Houston, TX</div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, accent }) {
  const cls = accent === "emerald" ? "from-emerald-500 to-emerald-700" : "from-blue-800 to-blue-950";
  return (
    <div className="rounded-2xl bg-white p-2.5 border border-slate-100 shadow-sm">
      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`font-heading text-xl font-bold bg-gradient-to-br ${cls} bg-clip-text text-transparent`}>{value}</div>
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
