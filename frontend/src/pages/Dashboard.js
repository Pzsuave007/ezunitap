import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users, FileText, Receipt, Briefcase, DollarSign,
  Plus, UserPlus, Sparkles, ArrowRight, TrendingUp,
  Settings as SettingsIcon,
} from "lucide-react";
import WelcomeModal from "@/components/WelcomeModal";
import SetupChecklist from "@/components/SetupChecklist";
import OnboardingCelebration from "@/components/OnboardingCelebration";
import TourButton from "@/components/TourButton";

const StatCard = ({ icon: Icon, label, value, accent, testid }) => (
  <Card data-testid={testid} className="card-elevated p-4 lg:p-5 border-0 shadow-none">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] lg:text-xs font-bold uppercase tracking-[0.14em] lg:tracking-[0.18em] text-slate-500 leading-tight">{label}</div>
        <div className="font-heading text-2xl lg:text-3xl font-bold mt-1.5 lg:mt-2 tracking-tight">{value}</div>
      </div>
      <div className={`w-9 h-9 lg:w-11 lg:h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}>
        <Icon className="w-4 h-4 lg:w-5 lg:h-5" strokeWidth={2.2} />
      </div>
    </div>
  </Card>
);

const QuickButton = ({ icon: Icon, label, onClick, primary, testid }) => (
  <button
    data-testid={testid}
    onClick={onClick}
    className={`tap flex flex-col items-center justify-center gap-1.5 py-4 lg:py-5 px-1 rounded-2xl border min-h-[96px] ${
      primary
        ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm"
        : "bg-white hover:bg-slate-50 text-slate-900 border-slate-200"
    }`}
  >
    <div className={`w-9 h-9 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${primary ? "bg-white/15" : "bg-slate-100"}`}>
      <Icon className="w-4 h-4 lg:w-5 lg:h-5" strokeWidth={2.2} />
    </div>
    <span className="text-[11px] lg:text-sm font-semibold text-center leading-tight">{label}</span>
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

  return (
    <div className="space-y-6">
      <WelcomeModal />
      <OnboardingCelebration />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-slate-500">{greeting()},</div>
          <h1 className="font-heading text-3xl font-bold tracking-tight truncate">
            {user?.owner_name || user?.business_name || "Hola"} 👋
          </h1>
          <button
            data-testid="dashboard-business-name"
            onClick={() => navigate("/ajustes")}
            className="mt-1 text-sm text-slate-500 hover:text-blue-900 inline-flex items-center gap-1 tap"
          >
            {user?.business_name || "Aquí está tu negocio hoy."}
            <span className="text-[10px] opacity-60">✎</span>
          </button>
        </div>
        <button
          data-testid="dashboard-settings-btn"
          onClick={() => navigate("/ajustes")}
          className="flex-shrink-0 w-11 h-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 tap shadow-sm"
          aria-label="Ajustes"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="flex justify-end -mt-3">
        <TourButton tourKey="dashboard" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <QuickButton
          testid="quick-ai-quote"
          icon={Sparkles}
          label="Crear Quote con AI"
          primary
          onClick={() => navigate("/quotes/nuevo?ai=1")}
        />
        <QuickButton
          testid="quick-new-client"
          icon={UserPlus}
          label="Agregar Cliente"
          onClick={() => navigate("/clientes?new=1")}
        />
        <QuickButton
          testid="quick-new-invoice"
          icon={Receipt}
          label="Crear Invoice"
          onClick={() => navigate("/invoices/nuevo")}
        />
      </div>

      {/* Onboarding setup checklist (auto-hides at 100%) */}
      <SetupChecklist />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard testid="stat-clients" icon={Users} label="Clientes" value={stats.total_clients} accent="bg-blue-50 text-blue-900" />
        <StatCard testid="stat-quotes" icon={FileText} label="Quotes Enviados" value={stats.quotes_sent} accent="bg-violet-50 text-violet-800" />
        <StatCard testid="stat-invoices" icon={Receipt} label="Invoices Pendientes" value={stats.invoices_pending} accent="bg-amber-50 text-amber-800" />
        <StatCard testid="stat-jobs" icon={Briefcase} label="Trabajos Activos" value={stats.active_jobs} accent="bg-emerald-50 text-emerald-800" />
      </div>

      <Card className="card-elevated p-5 border-0 shadow-none">
        <div className="flex items-start lg:items-center justify-between gap-3 flex-col lg:flex-row">
          <div className="w-full lg:w-auto">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Pagos pendientes</div>
            <div className="font-heading text-3xl lg:text-4xl font-bold mt-1 tracking-tight">
              ${stats.pending_amount?.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-slate-500 mt-1 flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Total por cobrar</span>
            </div>
          </div>
          <Button
            data-testid="view-invoices-btn"
            onClick={() => navigate("/invoices")}
            className="rounded-xl bg-blue-900 hover:bg-blue-950 text-white h-11 w-full lg:w-auto"
          >
            Ver invoices <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </Card>

      {/* Recent quotes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-xl font-bold tracking-tight">Quotes recientes</h2>
          <button onClick={() => navigate("/quotes")} className="text-sm text-blue-900 font-semibold">
            Ver todos
          </button>
        </div>
        {recentQuotes.length === 0 ? (
          <Card className="card-elevated p-8 text-center border-0 shadow-none">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm mb-4">Aún no tienes quotes. Crea el primero con AI.</p>
            <Button
              data-testid="empty-create-quote"
              onClick={() => navigate("/quotes/nuevo?ai=1")}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 h-11"
            >
              <Sparkles className="w-4 h-4 mr-2" /> Crear con AI
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentQuotes.map((q) => (
              <Card
                key={q.id}
                onClick={() => navigate(`/quotes/${q.id}`)}
                data-testid={`recent-quote-${q.id}`}
                className="card-elevated p-4 border-0 shadow-none cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{q.job_title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{q.number} · ${q.total?.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Reminders */}
      {reminders.length > 0 && (
        <div>
          <h2 className="font-heading text-xl font-bold tracking-tight mb-3">Recordatorios</h2>
          <div className="space-y-2">
            {reminders.map((r) => (
              <Card key={r.id} className="card-elevated p-4 border-0 shadow-none">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm">{r.title}</div>
                    <div className="text-xs text-slate-500">{new Date(r.due_date).toLocaleDateString("es")}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
