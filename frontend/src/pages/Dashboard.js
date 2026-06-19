import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import {
  Users, FileText, Receipt, Briefcase,
  UserPlus, Sparkles, ArrowRight, Wallet,
  Settings as SettingsIcon, Megaphone, Bell, ChevronRight,
} from "lucide-react";
import WelcomeModal from "@/components/WelcomeModal";
import SetupChecklist from "@/components/SetupChecklist";
import OnboardingCelebration from "@/components/OnboardingCelebration";
import TourButton from "@/components/TourButton";

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

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total_clients: 0, quotes_sent: 0, invoices_pending: 0, active_jobs: 0, pending_amount: 0,
  });
  const [recentQuotes, setRecentQuotes] = useState([]);
  const [reminders, setReminders] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [s, q, r] = await Promise.all([
          api.get("/dashboard/stats"),
          api.get("/quotes"),
          api.get("/reminders"),
        ]);
        setStats(s.data);
        setRecentQuotes(q.data.slice(0, 4));
        setReminders(r.data.slice(0, 4));
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  const money = (n) => `$${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

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
          <button
            data-testid="dashboard-business-name"
            onClick={() => navigate("/ajustes")}
            className="mt-1 text-sm text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 tap"
          >
            {user?.business_name || "Aquí está tu negocio hoy."}
            <span className="text-[10px] opacity-60">✎</span>
          </button>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <TourButton tourKey="dashboard" />
          <button
            data-testid="dashboard-settings-btn"
            onClick={() => navigate("/ajustes")}
            className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 tap shadow-sm"
            aria-label="Ajustes"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Hero KPI — Pagos pendientes (inverted high-contrast) */}
      <div
        data-testid="hero-pending-card"
        className="relative overflow-hidden rounded-3xl bg-slate-900 p-6 text-white shadow-xl"
      >
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
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-2.5">Empieza un trabajo</div>
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

      {/* Marketing studio promo */}
      <button
        onClick={() => navigate("/marketing")}
        data-testid="dashboard-marketing-cta"
        className="tap w-full text-left rounded-2xl p-4 flex items-center gap-4 text-white shadow-md"
        style={{ background: "linear-gradient(120deg, #7C3AED 0%, #DB2777 100%)" }}
      >
        <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <Megaphone className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-heading font-bold text-base flex items-center gap-2">
            Estudio de Marketing <span className="text-[10px] font-bold uppercase tracking-wider bg-white/25 px-1.5 py-0.5 rounded">Nuevo</span>
          </div>
          <div className="text-sm text-white/85">Crea posts profesionales para redes con IA en segundos.</div>
        </div>
        <ArrowRight className="w-5 h-5 flex-shrink-0" />
      </button>

      {/* Onboarding checklist (auto-hides at 100%) */}
      <SetupChecklist />

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
            <button
              data-testid="empty-create-quote"
              onClick={() => navigate("/quotes/nuevo?ai=1")}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 h-11 transition-colors"
            >
              <Sparkles className="w-4 h-4" /> Crear con AI
            </button>
          </div>
        ) : (
          recentQuotes.map((q) => (
            <button
              key={q.id}
              onClick={() => navigate(`/quotes/${q.id}`)}
              data-testid={`recent-quote-${q.id}`}
              className="tap w-full text-left px-5 py-4 border-b border-slate-100 last:border-0 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
            >
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
    </div>
  );
}
