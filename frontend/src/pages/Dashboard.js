import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import {
  Users, FileText, Receipt, Briefcase,
  UserPlus, Sparkles, ArrowRight, Wallet,
  Settings as SettingsIcon, Megaphone, Bell, ChevronRight,
  IdCard, Star, Eye, UserCheck, Image as ImageIcon, Video, Lock, Plus,
  Building2, BarChart3, MapPin, CheckCircle2,
} from "lucide-react";
import WelcomeModal from "@/components/WelcomeModal";
import SetupChecklist from "@/components/SetupChecklist";
import OnboardingCelebration from "@/components/OnboardingCelebration";
import TourButton from "@/components/TourButton";
import { toast } from "sonner";

const money = (n) => `$${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

const SectionTitle = ({ children, action }) => (
  <div className="flex items-center justify-between mb-2.5">
    <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{children}</div>
    {action}
  </div>
);

const StatChip = ({ icon: Icon, label, value, chip, testid, onClick }) => (
  <button
    data-testid={testid}
    onClick={onClick}
    className="tap text-left bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-3 shadow-sm hover:border-slate-300 transition-colors"
  >
    <div className={`w-11 h-11 rounded-full flex items-center justify-center ${chip}`}>
      <Icon className="w-5 h-5" strokeWidth={2.4} />
    </div>
    <div>
      <div className="font-heading text-2xl font-bold tracking-tight text-slate-900 leading-none">{value}</div>
      <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-slate-500 mt-1.5 leading-tight">{label}</div>
    </div>
  </button>
);

const FlowAction = ({ step, icon: Icon, chip, title, desc, onClick, testid }) => (
  <button
    data-testid={testid}
    onClick={onClick}
    className="tap w-full flex items-center gap-3.5 p-3 rounded-2xl border border-slate-200/80 bg-white hover:bg-slate-50 text-left transition-colors shadow-sm"
  >
    <span className="relative flex-none">
      <span className={`w-11 h-11 rounded-full flex items-center justify-center ${chip}`}>
        <Icon className="w-5 h-5" strokeWidth={2.4} />
      </span>
      <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">{step}</span>
    </span>
    <span className="min-w-0 flex-1">
      <span className="block font-semibold text-slate-900 text-sm">{title}</span>
      <span className="block text-xs text-slate-500 truncate">{desc}</span>
    </span>
    <ChevronRight className="w-5 h-5 text-slate-300 flex-none" />
  </button>
);

const MiniStat = ({ icon: Icon, label, value, chip }) => (
  <div className="flex-1 min-w-0 bg-slate-50 rounded-2xl p-3 flex items-center gap-3">
    <span className={`w-9 h-9 rounded-full flex items-center justify-center flex-none ${chip}`}>
      <Icon className="w-4 h-4" strokeWidth={2.4} />
    </span>
    <span className="min-w-0">
      <span className="block font-heading text-lg font-bold leading-none text-slate-900">{value}</span>
      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1 truncate">{label}</span>
    </span>
  </div>
);

// ---- Business module block ----
function BusinessBlock({ navigate, stats, recentQuotes, reminders }) {
  return (
    <>
      {/* Hero KPI — Pagos pendientes */}
      <div data-testid="hero-pending-card" className="relative overflow-hidden rounded-3xl bg-slate-900 p-6 text-white shadow-xl">
        <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-emerald-500/10 blur-2xl" />
        <div className="relative">
          <div className="text-sm font-medium text-slate-400 flex items-center gap-2">
            <Wallet className="w-4 h-4" /> Pagos pendientes
          </div>
          <div className="font-heading text-4xl font-black tracking-tighter mt-2" data-testid="hero-pending-amount">
            {money(stats.pending_amount)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Total que te deben tus clientes</div>
          <button
            data-testid="view-invoices-btn"
            onClick={() => navigate("/invoices")}
            className="mt-4 inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-full px-4 py-2 text-sm font-semibold backdrop-blur-md transition-colors"
          >
            Ver invoices <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Guided ordered flow */}
      <div>
        <SectionTitle action={<TourButton tourKey="dashboard" />}>Empieza un trabajo</SectionTitle>
        <div className="space-y-2">
          <FlowAction step={1} testid="quick-new-client" icon={UserPlus} chip="bg-blue-50 text-blue-600 border border-blue-100"
            title="Agregar cliente" desc="Empieza aquí: registra a tu cliente" onClick={() => navigate("/clientes?new=1")} />
          <FlowAction step={2} testid="quick-ai-quote" icon={Sparkles} chip="bg-purple-50 text-purple-600 border border-purple-100"
            title="Crear cotización con AI" desc="Manda un presupuesto en segundos" onClick={() => navigate("/quotes/nuevo?ai=1")} />
          <FlowAction step={3} testid="quick-new-invoice" icon={Receipt} chip="bg-emerald-50 text-emerald-600 border border-emerald-100"
            title="Crear invoice" desc="Cobra por tu trabajo" onClick={() => navigate("/invoices/nuevo")} />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatChip testid="stat-clients" icon={Users} label="Clientes" value={stats.total_clients} chip="bg-blue-50 text-blue-600 border border-blue-100" onClick={() => navigate("/clientes")} />
        <StatChip testid="stat-quotes" icon={FileText} label="Quotes enviados" value={stats.quotes_sent} chip="bg-purple-50 text-purple-600 border border-purple-100" onClick={() => navigate("/quotes")} />
        <StatChip testid="stat-invoices" icon={Receipt} label="Invoices pendientes" value={stats.invoices_pending} chip="bg-amber-50 text-amber-600 border border-amber-100" onClick={() => navigate("/invoices")} />
        <StatChip testid="stat-jobs" icon={Briefcase} label="Trabajos activos" value={stats.active_jobs} chip="bg-emerald-50 text-emerald-600 border border-emerald-100" onClick={() => navigate("/trabajos")} />
      </div>

      {/* Recent quotes */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-100 flex justify-between items-center bg-slate-50/60">
          <h2 className="font-heading text-base font-bold tracking-tight text-slate-900">Quotes recientes</h2>
          <button onClick={() => navigate("/quotes")} className="text-sm text-blue-700 font-semibold tap">Ver todos</button>
        </div>
        {recentQuotes.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <FileText className="w-9 h-9 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm mb-4">Aún no tienes quotes. Crea el primero con AI.</p>
            <button data-testid="empty-create-quote" onClick={() => navigate("/quotes/nuevo?ai=1")}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 h-11 transition-colors">
              <Sparkles className="w-4 h-4" /> Crear con AI
            </button>
          </div>
        ) : (
          recentQuotes.map((q) => (
            <button key={q.id} onClick={() => navigate(`/quotes/${q.id}`)} data-testid={`recent-quote-${q.id}`}
              className="tap w-full text-left px-5 py-4 border-b border-slate-100 last:border-0 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 truncate">{q.job_title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{q.number} · {money(q.total)}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 flex-none" />
            </button>
          ))
        )}
      </div>

      {/* Reminders */}
      {reminders.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/60">
            <Bell className="w-4 h-4 text-slate-500" />
            <h2 className="font-heading text-base font-bold tracking-tight text-slate-900">Recordatorios</h2>
          </div>
          {reminders.map((r) => (
            <div key={r.id} className="px-5 py-4 border-b border-slate-100 last:border-0 flex items-center justify-between gap-3">
              <div className="font-semibold text-sm text-slate-900">{r.title}</div>
              <div className="text-xs text-slate-500 flex-none">{new Date(r.due_date).toLocaleDateString("es")}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ---- Card / Presencia module block ----
function CardBlock({ navigate, cardStats, card, gbp, onConnectGbp }) {
  const views = cardStats?.totals?.profile_visit ?? cardStats?.all_events ?? 0;
  const slug = card?.slug;
  const ready = !!card && !!(
    card.profile_photo_id || card.cover_photo_id || (card.services || []).length ||
    (card.about_me || "").trim() || (card.tagline || "").trim() || (card.business_type || "").trim()
  );
  return (
    <div>
      <SectionTitle>Tu Presencia</SectionTitle>
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 flex items-center gap-3 border-b border-slate-100">
          <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center flex-none">
            <IdCard className="w-5 h-5" strokeWidth={2.4} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-heading font-bold text-slate-900">Tarjeta Digital</div>
            <div className="text-xs text-slate-500">Tu mini-sitio, reseñas y contactos</div>
          </div>
        </div>

        {/* Live mini-site preview (or setup CTA when not ready yet) */}
        {card && (ready && slug ? (
          <div className="p-3">
            <button data-testid="card-live-preview" onClick={() => window.open(`/c/${slug}`, "_blank")}
              className="tap block w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 relative group">
              <div className="relative h-64 overflow-hidden">
                <iframe
                  src={`/c/${slug}?preview=1`}
                  title="Vista en vivo de tu mini-sitio"
                  loading="lazy"
                  className="w-full pointer-events-none"
                  style={{ height: 560, border: 0 }}
                  scrolling="no"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/30 to-transparent" />
              </div>
              <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 bg-white/90 text-slate-900 text-[11px] font-bold px-2 py-1 rounded-full shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> En vivo
              </span>
              <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 bg-slate-900/85 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">
                Abrir mini-sitio <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>
          </div>
        ) : (
          <button data-testid="card-setup-cta" onClick={() => navigate("/tarjeta")}
            className="tap m-3 w-[calc(100%-1.5rem)] rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 p-5 text-center transition-colors hover:bg-blue-50">
            <div className="w-12 h-12 rounded-2xl bg-white border border-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-2">
              <IdCard className="w-6 h-6" strokeWidth={2.2} />
            </div>
            <div className="font-heading font-bold text-slate-900 text-sm">Configura tu mini-sitio</div>
            <div className="text-xs text-slate-500 mt-1">Agrega tu foto, servicios y contacto para verlo en vivo aquí.</div>
            <span className="mt-3 inline-flex items-center gap-1.5 bg-slate-900 text-white text-sm font-semibold px-4 h-10 rounded-xl">
              Empezar <ArrowRight className="w-4 h-4" />
            </span>
          </button>
        ))}

        <div className="p-3 pt-0 flex gap-2.5">
          <MiniStat icon={Eye} label="Vistas" value={views} chip="bg-blue-50 text-blue-600" />
          <MiniStat icon={Star} label="Reseñas" value={cardStats?.reviews ?? 0} chip="bg-amber-50 text-amber-600" />
          <MiniStat icon={UserCheck} label="Leads" value={cardStats?.leads ?? 0} chip="bg-emerald-50 text-emerald-600" />
        </div>
        <button data-testid="card-view-btn" onClick={() => navigate("/tarjeta")}
          className="tap mx-3 mb-2.5 inline-flex w-[calc(100%-1.5rem)] items-center justify-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold h-11 transition-colors">
          {ready ? "Editar mi tarjeta" : "Ver mi tarjeta"} <ArrowRight className="w-4 h-4" />
        </button>

        {/* Connect Google My Business */}
        {gbp?.configured && !gbp?.connected && (
          <button data-testid="card-connect-gbp-btn" onClick={onConnectGbp}
            className="tap mx-3 mb-2.5 inline-flex w-[calc(100%-1.5rem)] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-sm font-semibold h-11 transition-colors">
            <MapPin className="w-4 h-4 text-blue-600" /> Conectar Google My Business
          </button>
        )}
        {gbp?.connected && (
          <div data-testid="card-gbp-connected" className="mx-3 mb-2.5 inline-flex w-[calc(100%-1.5rem)] items-center justify-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-semibold h-11">
            <CheckCircle2 className="w-4 h-4" /> Google My Business conectado
          </div>
        )}

        <div className="px-3 pb-3 grid grid-cols-3 gap-2.5">
          <CardTile testid="card-reviews-tile" icon={Star} chip="bg-amber-50 text-amber-600" label="Reseñas de Google" onClick={() => navigate("/reviews")} />
          <CardTile testid="card-gbp-tile" icon={Building2} chip="bg-emerald-50 text-emerald-600" label="Publicar en Google" onClick={() => navigate("/reviews")} />
          <CardTile testid="card-stats-tile" icon={BarChart3} chip="bg-violet-50 text-violet-600" label="Estadísticas" onClick={() => navigate("/tarjeta")} />
        </div>
      </div>
    </div>
  );
}

const CardTile = ({ icon: Icon, label, chip, onClick, testid }) => (
  <button data-testid={testid} onClick={onClick}
    className="tap flex flex-col items-center text-center gap-2 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
    <span className={`w-9 h-9 rounded-full flex items-center justify-center flex-none ${chip}`}>
      <Icon className="w-4 h-4" strokeWidth={2.4} />
    </span>
    <span className="text-[11px] font-semibold text-slate-700 leading-tight">{label}</span>
  </button>
);

// ---- Marketing module block ----
function MarketingBlock({ navigate, mkt }) {
  return (
    <div>
      <SectionTitle>Estudio de Marketing</SectionTitle>
      <button onClick={() => navigate("/marketing")} data-testid="dashboard-marketing-cta"
        className="tap w-full text-left rounded-2xl p-4 flex items-center gap-4 text-white shadow-md"
        style={{ background: "linear-gradient(120deg, #7C3AED 0%, #DB2777 100%)" }}>
        <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <Megaphone className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-heading font-bold text-base">Crea un post o reel con IA</div>
          <div className="text-sm text-white/85">Contenido profesional para redes en segundos.</div>
        </div>
        <ArrowRight className="w-5 h-5 flex-shrink-0" />
      </button>
      <div className="mt-3 flex gap-2.5">
        <MiniStat icon={ImageIcon} label="Posts" value={mkt?.posts ?? 0} chip="bg-purple-50 text-purple-600" />
        <MiniStat icon={Video} label="Reels" value={mkt?.reels ?? 0} chip="bg-pink-50 text-pink-600" />
      </div>
    </div>
  );
}

// ---- Upsell: modules the user does NOT have yet ----
const UPSELL_META = {
  business: { label: "Negocio", desc: "Quotes, invoices y contratos con IA + CRM", icon: Receipt, chip: "bg-emerald-50 text-emerald-600 border border-emerald-100" },
  card: { label: "Tarjeta Digital", desc: "Tarjeta NFC, mini-sitio y reseñas de Google", icon: IdCard, chip: "bg-blue-50 text-blue-600 border border-blue-100" },
  marketing: { label: "Estudio de Marketing", desc: "Posts y reels con IA para tus redes", icon: Megaphone, chip: "bg-purple-50 text-purple-600 border border-purple-100" },
};

function UpsellBlock({ navigate, missing }) {
  if (missing.length === 0) return null;
  return (
    <div>
      <SectionTitle>Agrega más a tu plan</SectionTitle>
      <div className="space-y-2">
        {missing.map((f) => {
          const m = UPSELL_META[f];
          return (
            <button key={f} data-testid={`upsell-${f}`} onClick={() => navigate("/precios")}
              className="tap w-full flex items-center gap-3.5 p-3 rounded-2xl border border-dashed border-slate-300 bg-white hover:bg-slate-50 text-left transition-colors">
              <span className={`w-11 h-11 rounded-full flex items-center justify-center flex-none ${m.chip}`}>
                <m.icon className="w-5 h-5" strokeWidth={2.4} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-semibold text-slate-900 text-sm">
                  {m.label} <Lock className="w-3 h-3 text-slate-400" />
                </span>
                <span className="block text-xs text-slate-500 truncate">{m.desc}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 flex-none">
                <Plus className="w-3.5 h-3.5" /> Agregar
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, hasFeature } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total_clients: 0, quotes_sent: 0, invoices_pending: 0, active_jobs: 0, pending_amount: 0 });
  const [recentQuotes, setRecentQuotes] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [cardStats, setCardStats] = useState(null);
  const [card, setCard] = useState(null);
  const [mkt, setMkt] = useState({ posts: 0, reels: 0 });
  const [gbp, setGbp] = useState(null);

  const hasBusiness = hasFeature("business");
  const hasCard = hasFeature("card");
  const hasMarketing = hasFeature("marketing");

  useEffect(() => {
    if (hasBusiness) {
      (async () => {
        try {
          const [s, q, r] = await Promise.all([api.get("/dashboard/stats"), api.get("/quotes"), api.get("/reminders")]);
          setStats(s.data); setRecentQuotes(q.data.slice(0, 4)); setReminders(r.data.slice(0, 4));
        } catch (e) { console.error(e); }
      })();
    }
    if (hasCard) {
      (async () => { try { const { data } = await api.get("/card/analytics"); setCardStats(data); } catch (e) { /* no card yet */ } })();
      (async () => { try { const { data } = await api.get("/card/settings"); setCard(data); } catch (e) { /* ignore */ } })();
      (async () => { try { const { data } = await api.get("/google-business/status"); setGbp(data); } catch (e) { setGbp({ configured: false, connected: false }); } })();
    }
    if (hasMarketing) {
      (async () => {
        try {
          const [p, rl] = await Promise.all([api.get("/social/posts"), api.get("/social/reels")]);
          setMkt({ posts: (p.data || []).length, reels: (rl.data || []).length });
        } catch (e) { /* ignore */ }
      })();
    }
  }, [user, hasBusiness, hasCard, hasMarketing]);

  const connectGbp = async () => {
    try {
      const { data } = await api.get("/google-business/connect");
      window.location.href = data.auth_url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo iniciar la conexión con Google.");
    }
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  const missing = ["business", "card", "marketing"].filter((f) => !hasFeature(f));

  return (
    <div className="space-y-6 pb-6">
      <WelcomeModal />
      <OnboardingCelebration />

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-slate-500">{greeting()},</div>
          <h1 className="font-heading text-3xl font-bold tracking-tight truncate text-slate-900">
            {user?.owner_name || user?.business_name || "Hola"} 👋
          </h1>
          <button data-testid="dashboard-business-name" onClick={() => navigate("/ajustes")}
            className="mt-1 text-sm text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 tap">
            {user?.business_name || "Aquí está tu negocio hoy."}
            <span className="text-[10px] opacity-60">✎</span>
          </button>
        </div>
        <button data-testid="dashboard-settings-btn" onClick={() => navigate("/ajustes")}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 tap shadow-sm" aria-label="Ajustes">
          <SettingsIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Module blocks — order: Negocio → Presencia → Marketing */}
      {hasBusiness && <BusinessBlock navigate={navigate} stats={stats} recentQuotes={recentQuotes} reminders={reminders} />}
      {hasCard && <CardBlock navigate={navigate} cardStats={cardStats} card={card} gbp={gbp} onConnectGbp={connectGbp} />}
      {hasMarketing && <MarketingBlock navigate={navigate} mkt={mkt} />}

      {/* Onboarding checklist (auto-hides at 100%) */}
      <SetupChecklist />

      {/* Upsell modules not owned */}
      <UpsellBlock navigate={navigate} missing={missing} />
    </div>
  );
}
