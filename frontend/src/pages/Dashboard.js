import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import {
  Users, FileText, Receipt, Briefcase,
  UserPlus, Sparkles, ArrowRight, Wallet,
  Settings as SettingsIcon, Megaphone, Bell, ChevronRight,
  IdCard, Star, Eye, UserCheck, Image as ImageIcon, Video, Lock, Plus,
  Building2, BarChart3, MapPin, CheckCircle2, MonitorSmartphone, ExternalLink, Pencil, Copy,
} from "lucide-react";
import WelcomeModal from "@/components/WelcomeModal";
import SetupChecklist from "@/components/SetupChecklist";
import TasksPanel from "@/components/TasksPanel";
import StatusBadge from "@/components/StatusBadge";
import OnboardingCelebration from "@/components/OnboardingCelebration";
import TourButton from "@/components/TourButton";
import { toast } from "sonner";
import { PhoneFrame, LiveCardPreview } from "@/components/LiveCardPreview";

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

// ---- Hero KPI: Pagos pendientes (compact, shown at very top) ----
function PendingHero({ navigate, stats }) {
  const { t } = useTranslation();
  return (
    <div data-testid="hero-pending-card" className="relative overflow-hidden rounded-3xl bg-slate-900 p-5 text-white shadow-xl">
      <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-emerald-500/10 blur-2xl" />
      <div className="relative">
        <div className="text-sm font-medium text-slate-400 flex items-center gap-2">
          <Wallet className="w-4 h-4" /> {t("dashboard.pendingPayments")}
        </div>
        <div className="flex items-center justify-between gap-3 mt-2">
          <div className="font-heading text-4xl font-black tracking-tighter leading-none" data-testid="hero-pending-amount">
            {money(stats.pending_amount)}
          </div>
          <button
            data-testid="view-invoices-btn"
            onClick={() => navigate("/invoices")}
            className="flex-none inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-full px-4 py-2 text-sm font-semibold backdrop-blur-md transition-colors"
          >
            {t("dashboard.viewInvoices")} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Compact step button (horizontal Start-a-job) ----
const FlowStepMini = ({ step, icon: Icon, chip, title, onClick, testid }) => (
  <button data-testid={testid} onClick={onClick}
    className="tap relative flex flex-col items-center text-center gap-2 p-3 rounded-2xl border border-slate-200/80 bg-white hover:bg-slate-50 transition-colors shadow-sm">
    <span className="relative">
      <span className={`w-10 h-10 rounded-full flex items-center justify-center ${chip}`}>
        <Icon className="w-5 h-5" strokeWidth={2.4} />
      </span>
      <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">{step}</span>
    </span>
    <span className="text-xs font-semibold text-slate-900 leading-tight">{title}</span>
  </button>
);

// ---- Active jobs list (top of the main tab — the work to be done) ----
function ActiveJobsCard({ navigate, jobs = [], clients = [] }) {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language?.startsWith("es") ? "es-ES" : "en-US";
  const activeJobs = (jobs || []).filter((j) => j.status !== "completed").slice(0, 6);
  const clientName = (id) => (clients.find((c) => c.id === id)?.name) || t("dashboard.jobClientFallback");
  const fmtJobDate = (j) => {
    if (!j.scheduled_date) return null;
    try {
      const d = new Date(j.scheduled_date + "T00:00:00");
      return d.toLocaleDateString(dateLocale, { weekday: "short", day: "numeric", month: "short" });
    } catch { return null; }
  };
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 border-b border-slate-100 flex justify-between items-center bg-slate-50/60">
        <h2 className="font-heading text-base font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-emerald-600" /> {t("dashboard.activeJobsTitle")}
        </h2>
        <button onClick={() => navigate("/trabajos")} className="text-sm text-emerald-700 font-semibold tap" data-testid="jobs-view-all">{t("common.viewAll")}</button>
      </div>
      {activeJobs.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <Briefcase className="w-9 h-9 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm mb-4">{t("dashboard.noActiveJobs")}</p>
          <button data-testid="empty-create-job" onClick={() => navigate("/trabajos/nuevo")}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 h-11 transition-colors">
            <Plus className="w-4 h-4" /> {t("dashboard.newJobBtn")}
          </button>
        </div>
      ) : (
        activeJobs.map((j) => (
          <button key={j.id} onClick={() => navigate("/trabajos")} data-testid={`dashboard-job-${j.id}`}
            className="tap w-full text-left px-5 py-4 border-b border-slate-100 last:border-0 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-900 truncate">{j.title}</div>
              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                <span className="truncate">{clientName(j.client_id)}</span>
                {fmtJobDate(j) && <span className="text-slate-400">· {fmtJobDate(j)}</span>}
              </div>
            </div>
            <StatusBadge kind="job" status={j.status} />
          </button>
        ))
      )}
    </div>
  );
}

// ---- Start a job — horizontal 3-up quick actions ----
function StartJobFlow({ navigate }) {
  const { t } = useTranslation();
  return (
    <div>
      <SectionTitle action={<TourButton tourKey="dashboard" />}>{t("dashboard.startJob")}</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        <FlowStepMini step={1} testid="quick-new-client" icon={UserPlus} chip="bg-blue-50 text-blue-600 border border-blue-100"
          title={t("dashboard.step1Title")} onClick={() => navigate("/clientes/nuevo")} />
        <FlowStepMini step={2} testid="quick-ai-quote" icon={Sparkles} chip="bg-purple-50 text-purple-600 border border-purple-100"
          title={t("dashboard.step2Title")} onClick={() => navigate("/quotes/nuevo?ai=1")} />
        <FlowStepMini step={3} testid="quick-new-invoice" icon={Receipt} chip="bg-emerald-50 text-emerald-600 border border-emerald-100"
          title={t("dashboard.step3Title")} onClick={() => navigate("/invoices/nuevo")} />
      </div>
    </div>
  );
}

// ---- Website tab: live preview + quick actions ----
function WebsiteBlock({ navigate, website, setWebsite }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const slug = website?.slug;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = slug ? `${origin}/sitio/${slug}` : "";
  const previewUrl = slug ? `${publicUrl}${website?.published ? "" : "?preview=1"}` : "";

  const togglePublish = async () => {
    if (!website) return;
    setBusy(true);
    try {
      const next = !website.published;
      const { data } = await api.put("/website", { ...website, published: next });
      setWebsite(data);
      toast.success(next ? t("dashboard.webPublished") : t("dashboard.webDraft"));
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error");
    } finally { setBusy(false); }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(publicUrl); toast.success(t("dashboard.webLinkCopied")); } catch { /* ignore */ }
  };

  if (!slug) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center shadow-sm">
        <MonitorSmartphone className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 text-sm mb-4">{t("dashboard.webNotPublishedHint")}</p>
        <button data-testid="website-edit-empty" onClick={() => navigate("/pagina-web")}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-5 h-11 transition-colors">
          <Pencil className="w-4 h-4" /> {t("dashboard.webEdit")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/60">
          <h2 className="font-heading text-base font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <MonitorSmartphone className="w-4 h-4 text-blue-700" /> {t("dashboard.webPreviewTitle")}
          </h2>
          <span data-testid="website-status" className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
            website.published ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}>
            {website.published ? t("dashboard.webPublished") : t("dashboard.webDraft")}
          </span>
        </div>

        {/* Live preview (non-interactive) */}
        <button
          type="button"
          data-testid="website-preview"
          onClick={() => window.open(previewUrl, "_blank")}
          className="relative block w-full overflow-hidden bg-white group"
          style={{ height: 460 }}
          title={t("dashboard.webOpenNew")}
        >
          <iframe
            src={previewUrl}
            title="Website preview"
            scrolling="no"
            loading="lazy"
            style={{ width: "166.66%", height: "766px", border: 0, transform: "scale(0.6)", transformOrigin: "top left", pointerEvents: "none" }}
          />
          <span className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/5 transition-colors flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-2 bg-white/95 text-slate-900 text-sm font-semibold px-4 h-10 rounded-full shadow-lg">
              <ExternalLink className="w-4 h-4" /> {t("dashboard.webOpenNew")}
            </span>
          </span>
        </button>
      </div>

      {/* Public link */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">{t("dashboard.webYourLink")}</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 text-sm text-slate-700 truncate bg-slate-50 border border-slate-200 rounded-xl px-3 h-11 flex items-center">{publicUrl.replace(/^https?:\/\//, "")}</div>
          <button data-testid="website-copy" onClick={copyLink} className="flex-none h-11 w-11 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors" title={t("dashboard.webLinkCopied")}>
            <Copy className="w-4 h-4" />
          </button>
        </div>
        {!website.published && <p className="text-[11px] text-amber-600 mt-2">{t("dashboard.webNotPublishedHint")}</p>}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-3 gap-2">
        <button data-testid="website-edit" onClick={() => navigate("/pagina-web")}
          className="h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors">
          <Pencil className="w-4 h-4" /> {t("dashboard.webEdit")}
        </button>
        <button data-testid="website-open" onClick={() => window.open(previewUrl, "_blank")}
          className="h-12 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors">
          <ExternalLink className="w-4 h-4" /> {t("dashboard.webOpen")}
        </button>
        <button data-testid="website-publish" onClick={togglePublish} disabled={busy}
          className={`h-12 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60 ${
            website.published ? "border border-slate-200 bg-white hover:bg-slate-50 text-slate-800" : "bg-emerald-600 hover:bg-emerald-700 text-white"
          }`}>
          <CheckCircle2 className="w-4 h-4" /> {website.published ? t("dashboard.webUnpublish") : t("dashboard.webPublish")}
        </button>
      </div>
    </div>
  );
}

// ---- Business module block ----
function BusinessBlock({ navigate, stats, reminders }) {
  const { t, i18n } = useTranslation();
  return (
    <>
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatChip testid="stat-clients" icon={Users} label={t("dashboard.statClients")} value={stats.total_clients} chip="bg-blue-50 text-blue-600 border border-blue-100" onClick={() => navigate("/clientes")} />
        <StatChip testid="stat-quotes" icon={FileText} label={t("dashboard.statQuotes")} value={stats.quotes_sent} chip="bg-purple-50 text-purple-600 border border-purple-100" onClick={() => navigate("/quotes")} />
        <StatChip testid="stat-invoices" icon={Receipt} label={t("dashboard.statInvoices")} value={stats.invoices_pending} chip="bg-amber-50 text-amber-600 border border-amber-100" onClick={() => navigate("/invoices")} />
        <StatChip testid="stat-jobs" icon={Briefcase} label={t("dashboard.statJobs")} value={stats.active_jobs} chip="bg-emerald-50 text-emerald-600 border border-emerald-100" onClick={() => navigate("/trabajos")} />
      </div>


      {/* Reminders */}
      {reminders.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/60">
            <Bell className="w-4 h-4 text-slate-500" />
            <h2 className="font-heading text-base font-bold tracking-tight text-slate-900">{t("dashboard.reminders")}</h2>
          </div>
          {reminders.map((r) => (
            <div key={r.id} className="px-5 py-4 border-b border-slate-100 last:border-0 flex items-center justify-between gap-3">
              <div className="font-semibold text-sm text-slate-900">{r.title}</div>
              <div className="text-xs text-slate-500 flex-none">{new Date(r.due_date).toLocaleDateString(i18n.language)}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ---- Card / Presencia module block ----
function CardBlock({ navigate, user, cardStats, card, gbp, onConnectGbp }) {
  const { t } = useTranslation();
  const views = cardStats?.totals?.profile_visit ?? cardStats?.all_events ?? 0;
  const slug = card?.slug;
  const ready = !!card && !!(
    card.profile_photo_id || card.cover_photo_id || (card.services || []).length ||
    (card.about_me || "").trim() || (card.tagline || "").trim() || (card.business_type || "").trim()
  );
  return (
    <div>
      <SectionTitle>{t("dashboard.yourPresence")}</SectionTitle>
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 flex items-center gap-3 border-b border-slate-100">
          <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center flex-none">
            <IdCard className="w-5 h-5" strokeWidth={2.4} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-heading font-bold text-slate-900">{t("dashboard.digitalCard")}</div>
            <div className="text-xs text-slate-500">{t("dashboard.digitalCardDesc")}</div>
          </div>
        </div>

        {card && (ready ? (
          <div className="px-3 py-4 flex flex-col items-center bg-gradient-to-b from-slate-50 to-white">
            <button data-testid="card-live-preview" onClick={() => slug && window.open(`/c/${slug}`, "_blank")}
              className="tap relative w-[210px] group">
              <PhoneFrame>
                <LiveCardPreview card={card} user={user} variant={card.hero_layout || "photo"} />
              </PhoneFrame>
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 z-30 inline-flex items-center gap-1.5 bg-white shadow-md ring-1 ring-slate-200 text-slate-900 text-[11px] font-bold px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> {t("dashboard.live")}
              </span>
            </button>
            <button onClick={() => slug && window.open(`/c/${slug}`, "_blank")}
              className="tap mt-4 inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-5 h-10 rounded-full transition-colors">
              {t("dashboard.openMiniSite")} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button data-testid="card-setup-cta" onClick={() => navigate("/tarjeta")}
            className="tap m-3 w-[calc(100%-1.5rem)] rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 p-5 text-center transition-colors hover:bg-blue-50">
            <div className="w-12 h-12 rounded-2xl bg-white border border-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-2">
              <IdCard className="w-6 h-6" strokeWidth={2.2} />
            </div>
            <div className="font-heading font-bold text-slate-900 text-sm">{t("dashboard.setupMiniSite")}</div>
            <div className="text-xs text-slate-500 mt-1">{t("dashboard.setupMiniSiteDesc")}</div>
            <span className="mt-3 inline-flex items-center gap-1.5 bg-slate-900 text-white text-sm font-semibold px-4 h-10 rounded-xl">
              {t("dashboard.start")} <ArrowRight className="w-4 h-4" />
            </span>
          </button>
        ))}

        <div className="p-3 pt-0 flex gap-2.5">
          <MiniStat icon={Eye} label={t("dashboard.views")} value={views} chip="bg-blue-50 text-blue-600" />
          <MiniStat icon={Star} label={t("dashboard.reviews")} value={cardStats?.reviews ?? 0} chip="bg-amber-50 text-amber-600" />
          <MiniStat icon={UserCheck} label={t("dashboard.leads")} value={cardStats?.leads ?? 0} chip="bg-emerald-50 text-emerald-600" />
        </div>
        <button data-testid="card-view-btn" onClick={() => navigate("/tarjeta")}
          className="tap mx-3 mb-2.5 inline-flex w-[calc(100%-1.5rem)] items-center justify-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold h-11 transition-colors">
          {ready ? t("dashboard.editMyCard") : t("dashboard.viewMyCard")} <ArrowRight className="w-4 h-4" />
        </button>

        {/* Connect Google My Business */}
        {gbp?.configured && !gbp?.connected && (
          <button data-testid="card-connect-gbp-btn" onClick={onConnectGbp}
            className="tap mx-3 mb-2.5 inline-flex w-[calc(100%-1.5rem)] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-sm font-semibold h-11 transition-colors">
            <MapPin className="w-4 h-4 text-blue-600" /> {t("dashboard.connectGbp")}
          </button>
        )}
        {gbp?.connected && (
          <div data-testid="card-gbp-connected" className="mx-3 mb-2.5 inline-flex w-[calc(100%-1.5rem)] items-center justify-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-semibold h-11">
            <CheckCircle2 className="w-4 h-4" /> {t("dashboard.gbpConnected")}
          </div>
        )}

        <div className="px-3 pb-3 grid grid-cols-3 gap-2.5">
          <CardTile testid="card-reviews-tile" icon={Star} chip="bg-amber-50 text-amber-600" label={t("dashboard.reviewsTile")} onClick={() => navigate("/reviews")} />
          <CardTile testid="card-gbp-tile" icon={Building2} chip="bg-emerald-50 text-emerald-600" label={t("dashboard.publishGoogle")} onClick={() => navigate("/reviews")} />
          <CardTile testid="card-stats-tile" icon={BarChart3} chip="bg-violet-50 text-violet-600" label={t("dashboard.statsTile")} onClick={() => navigate("/tarjeta")} />
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
function MarketingBlock({ navigate, mkt, posts }) {
  const { t } = useTranslation();
  const BACKEND = process.env.REACT_APP_BACKEND_URL;
  const recent = (posts || []).filter((p) => p.images?.[0]?.url).slice(0, 8);
  return (
    <div>
      <SectionTitle>{t("dashboard.marketingStudio")}</SectionTitle>
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 flex items-center gap-3 border-b border-slate-100">
          <div className="w-11 h-11 rounded-full bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center flex-none">
            <Megaphone className="w-5 h-5" strokeWidth={2.4} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-heading font-bold text-slate-900">{t("nav.marketing")}</div>
            <div className="text-xs text-slate-500">{t("dashboard.marketingDesc")}</div>
          </div>
        </div>

        {recent.length > 0 ? (
          <div className="px-3 pt-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t("dashboard.recentDesigns")}</span>
              <button onClick={() => navigate("/marketing")} className="text-xs text-purple-700 font-semibold tap">{t("common.viewAll")}</button>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide snap-x">
              {recent.map((p) => (
                <button key={p.id} data-testid={`mkt-recent-${p.id}`} onClick={() => navigate("/marketing")}
                  className="tap flex-none snap-start w-24 aspect-[4/5] rounded-xl overflow-hidden border border-slate-200 bg-slate-100 relative group">
                  <img src={`${BACKEND}${p.images[0].url}`} alt={p.template || "post"} className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-3 pt-4">
            <button onClick={() => navigate("/marketing")} data-testid="mkt-empty-cta"
              className="tap w-full text-left rounded-2xl p-4 flex items-center gap-4 text-white shadow-md"
              style={{ background: "linear-gradient(120deg, #7C3AED 0%, #DB2777 100%)" }}>
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-heading font-bold text-base">{t("dashboard.createFirstDesign")}</div>
                <div className="text-sm text-white/85">{t("dashboard.createFirstDesignDesc")}</div>
              </div>
              <ArrowRight className="w-5 h-5 flex-shrink-0" />
            </button>
          </div>
        )}

        <div className="px-3 pt-3 grid grid-cols-2 gap-2.5">
          <MktTile testid="mkt-post-tile" icon={ImageIcon} chip="bg-purple-50 text-purple-600" label={t("dashboard.createPost")} onClick={() => navigate("/marketing?mode=image")} />
          <MktTile testid="mkt-reel-tile" icon={Video} chip="bg-pink-50 text-pink-600" label={t("dashboard.createReel")} onClick={() => navigate("/marketing?mode=reel")} />
          <MktTile testid="mkt-ai-tile" icon={Sparkles} chip="bg-violet-50 text-violet-600" label={t("dashboard.aiImage")} onClick={() => navigate("/marketing?mode=ai")} />
          <MktTile testid="mkt-gbp-tile" icon={Building2} chip="bg-emerald-50 text-emerald-600" label={t("dashboard.publishGoogle")} onClick={() => navigate("/marketing?mode=image")} />
        </div>

        <div className="p-3 flex gap-2.5">
          <MiniStat icon={ImageIcon} label={t("dashboard.posts")} value={mkt?.posts ?? 0} chip="bg-purple-50 text-purple-600" />
          <MiniStat icon={Video} label={t("dashboard.reels")} value={mkt?.reels ?? 0} chip="bg-pink-50 text-pink-600" />
        </div>
      </div>
    </div>
  );
}

const MktTile = ({ icon: Icon, label, chip, onClick, testid }) => (
  <button data-testid={testid} onClick={onClick}
    className="tap flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
    <span className={`w-9 h-9 rounded-full flex items-center justify-center flex-none ${chip}`}>
      <Icon className="w-4 h-4" strokeWidth={2.4} />
    </span>
    <span className="text-sm font-semibold text-slate-800 text-left leading-tight">{label}</span>
  </button>
);

// ---- Upsell: modules the user does NOT have yet ----
const UPSELL_META = {
  business: { labelKey: "dashboard.upsellBusiness", descKey: "dashboard.upsellBusinessDesc", icon: Receipt, chip: "bg-emerald-50 text-emerald-600 border border-emerald-100" },
  card: { labelKey: "dashboard.upsellCard", descKey: "dashboard.upsellCardDesc", icon: IdCard, chip: "bg-blue-50 text-blue-600 border border-blue-100" },
  marketing: { labelKey: "dashboard.upsellMarketing", descKey: "dashboard.upsellMarketingDesc", icon: Megaphone, chip: "bg-purple-50 text-purple-600 border border-purple-100" },
};

function UpsellBlock({ navigate, missing }) {
  const { t } = useTranslation();
  if (missing.length === 0) return null;
  return (
    <div>
      <SectionTitle>{t("dashboard.addToPlan")}</SectionTitle>
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
                  {t(m.labelKey)} <Lock className="w-3 h-3 text-slate-400" />
                </span>
                <span className="block text-xs text-slate-500 truncate">{t(m.descKey)}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 flex-none">
                <Plus className="w-3.5 h-3.5" /> {t("dashboard.addModule")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, hasFeature } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total_clients: 0, quotes_sent: 0, invoices_pending: 0, active_jobs: 0, pending_amount: 0 });
  const [recentQuotes, setRecentQuotes] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [jobClients, setJobClients] = useState([]);
  const [cardStats, setCardStats] = useState(null);
  const [card, setCard] = useState(null);
  const [mkt, setMkt] = useState({ posts: 0, reels: 0 });
  const [posts, setPosts] = useState([]);
  const [gbp, setGbp] = useState(null);
  const [website, setWebsite] = useState(null);

  const hasBusiness = hasFeature("business");
  const hasCard = hasFeature("card");
  const hasMarketing = hasFeature("marketing");
  const hasWebsite = hasBusiness || hasCard;

  useEffect(() => {
    // Mandatory onboarding: send new accounts to the guided wizard first.
    (async () => {
      try {
        const { data } = await api.get("/onboarding/status");
        if (!data?.completed) navigate("/onboarding", { replace: true });
      } catch (e) { /* ignore */ }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hasBusiness) {
      (async () => {
        try {
          const [s, q, r, j, c] = await Promise.all([
            api.get("/dashboard/stats"), api.get("/quotes"), api.get("/reminders"),
            api.get("/jobs"), api.get("/clients"),
          ]);
          setStats(s.data); setRecentQuotes(q.data.slice(0, 4)); setReminders(r.data.slice(0, 4));
          setJobs(j.data || []); setJobClients(c.data || []);
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
          setPosts(p.data || []);
          setMkt({ posts: (p.data || []).length, reels: (rl.data || []).length });
        } catch (e) { /* ignore */ }
      })();
    }
    if (hasWebsite) {
      (async () => { try { const { data } = await api.get("/website"); setWebsite(data); } catch (e) { /* ignore */ } })();
    }
  }, [user, hasBusiness, hasCard, hasMarketing]);

  const connectGbp = async () => {
    try {
      const { data } = await api.get("/google-business/connect");
      window.location.href = data.auth_url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("dashboard.gbpConnectError"));
    }
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t("dashboard.greetingMorning");
    if (h < 19) return t("dashboard.greetingAfternoon");
    return t("dashboard.greetingEvening");
  };

  const missing = ["business", "card", "marketing"].filter((f) => !hasFeature(f));

  // Tabs: only show for the modules the user owns. "main" = Invoicing & Jobs.
  const tabs = [
    hasBusiness && { k: "main", label: t("dashboard.tabMain"), icon: Receipt },
    hasWebsite && { k: "website", label: t("dashboard.tabWebsite"), icon: MonitorSmartphone },
    hasCard && { k: "card", label: t("dashboard.tabCard"), icon: IdCard },
    hasMarketing && { k: "marketing", label: t("dashboard.tabMarketing"), icon: Megaphone },
  ].filter(Boolean);
  const [activeTab, setActiveTab] = useState(null);
  const currentTab = activeTab && tabs.some((tb) => tb.k === activeTab)
    ? activeTab
    : (tabs[0]?.k || null);

  return (
    <div className="space-y-6 pb-6">
      <WelcomeModal />
      <OnboardingCelebration />

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-slate-500">{greeting()},</div>
          <h1 className="font-heading text-3xl font-bold tracking-tight truncate text-slate-900">
            {user?.owner_name || user?.business_name || t("dashboard.hello")} 👋
          </h1>
          <button data-testid="dashboard-business-name" onClick={() => navigate("/ajustes")}
            className="mt-1 text-sm text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 tap">
            {user?.business_name || t("dashboard.businessFallback")}
            <span className="text-[10px] opacity-60">✎</span>
          </button>
        </div>
        <button data-testid="dashboard-settings-btn" onClick={() => navigate("/ajustes")}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 tap shadow-sm" aria-label={t("dashboard.settings")}>
          <SettingsIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Section tabs — navigate between Invoicing/Jobs, Card and Marketing */}
      {tabs.length > 1 && (
        <div className="flex gap-1.5 p-1 bg-slate-100 rounded-2xl overflow-x-auto scrollbar-hide" data-testid="dashboard-tabs">
          {tabs.map((tb) => (
            <button
              key={tb.k}
              data-testid={`dashboard-tab-${tb.k}`}
              onClick={() => setActiveTab(tb.k)}
              className={`flex-1 min-w-[7rem] h-11 rounded-xl text-sm font-semibold transition-all tap flex items-center justify-center gap-1.5 ${
                currentTab === tb.k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <tb.icon className="w-4 h-4" strokeWidth={2.4} /> {tb.label}
            </button>
          ))}
        </div>
      )}

      {/* MAIN tab: Invoicing & Jobs */}
      {currentTab === "main" && hasBusiness && (
        <>
          <PendingHero navigate={navigate} stats={stats} />
          <StartJobFlow navigate={navigate} />
          <ActiveJobsCard navigate={navigate} jobs={jobs} clients={jobClients} />
          <TasksPanel />
          <BusinessBlock navigate={navigate} stats={stats} reminders={reminders} />
        </>
      )}

      {/* CARD tab: Digital Smart Card */}
      {currentTab === "card" && hasCard && (
        <CardBlock navigate={navigate} user={user} cardStats={cardStats} card={card} gbp={gbp} onConnectGbp={connectGbp} />
      )}

      {/* WEBSITE tab: live preview + quick actions */}
      {currentTab === "website" && hasWebsite && (
        <WebsiteBlock navigate={navigate} website={website} setWebsite={setWebsite} />
      )}

      {/* MARKETING tab: Marketing Studio */}
      {currentTab === "marketing" && hasMarketing && (
        <MarketingBlock navigate={navigate} mkt={mkt} posts={posts} />
      )}

      {/* No paid modules at all — still show tasks so the page isn't empty */}
      {tabs.length === 0 && <TasksPanel />}

      {/* Onboarding checklist (auto-hides at 100%) */}
      <SetupChecklist />

      {/* Upsell modules not owned */}
      <UpsellBlock navigate={navigate} missing={missing} />
    </div>
  );
}
