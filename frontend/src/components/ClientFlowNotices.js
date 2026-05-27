/**
 * ClientFlowNotices — actionable banners shown at the top of the client
 * profile when something needs the user's attention in the business flow:
 *
 *   1. Quote was just APPROVED by the client → suggest creating a contract
 *   2. Contract was SIGNED by the client → suggest reviewing the auto-invoice
 *   3. Invoice marked PAID with no scheduled job → suggest scheduling the work
 *   4. Quote SENT > 3 days ago with no response → suggest follow-up
 *
 * Each notice can be dismissed (kept in sessionStorage so it stays hidden
 * during the same session but reappears on next login).
 */
import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, FileSignature, Receipt, CalendarDays, Clock, X, ArrowRight } from "lucide-react";

const DISMISS_KEY = "client_flow_notices_dismissed";

function loadDismissed() {
  try {
    return JSON.parse(sessionStorage.getItem(DISMISS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveDismissed(arr) {
  try {
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify(arr));
  } catch { /* noop */ }
}

export default function ClientFlowNotices({ client, history }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(loadDismissed);

  useEffect(() => {
    // Refresh from sessionStorage on mount in case other tabs updated it.
    setDismissed(loadDismissed());
  }, []);

  const notices = useMemo(() => {
    if (!client || !history) return [];
    const out = [];
    const quotes = history.quotes || [];
    const agreements = history.agreements || [];
    const invoices = history.invoices || [];
    const jobs = history.jobs || [];

    // 1. Quote approved → suggest creating a contract (if none links to it).
    const approvedQuotes = quotes.filter((q) => q.status === "approved" || q.status === "accepted");
    for (const q of approvedQuotes) {
      const hasAgreement = agreements.some((a) => a.quote_id === q.id);
      if (!hasAgreement) {
        out.push({
          id: `quote-approved-${q.id}`,
          tone: "emerald",
          icon: CheckCircle2,
          title: `¡${client.name?.split(" ")[0] || "El cliente"} aceptó el quote ${q.number}!`,
          message: "Siguiente paso: genera y mándale el contrato para que lo firme.",
          ctaLabel: "Crear contrato",
          ctaAction: () => navigate(`/contratos/nuevo?client_id=${client.id}&quote_id=${q.id}`),
        });
      }
    }

    // 2. Agreement signed → suggest reviewing/sending the auto-invoice.
    const signedAgreements = agreements.filter((a) => a.status === "signed");
    for (const a of signedAgreements) {
      const linkedInv = invoices.find(
        (i) => i.agreement_id === a.id || (a.quote_id && i.quote_id === a.quote_id)
      );
      if (linkedInv && linkedInv.status === "draft") {
        out.push({
          id: `agreement-signed-${a.id}`,
          tone: "blue",
          icon: FileSignature,
          title: `Contrato firmado por ${a.signer_name || client.name?.split(" ")[0] || "el cliente"}`,
          message: `Se creó el invoice ${linkedInv.number} en borrador. Revísalo y mándaselo.`,
          ctaLabel: "Ver invoice",
          ctaAction: () => navigate(`/invoices/${linkedInv.id}`),
        });
      }
    }

    // 3. Invoice paid → suggest scheduling the work if job has no date.
    const paidInvoices = invoices.filter((i) => i.status === "paid");
    for (const inv of paidInvoices) {
      const job = jobs.find((j) => j.invoice_id === inv.id);
      if (job && !job.scheduled_date) {
        out.push({
          id: `invoice-paid-${inv.id}`,
          tone: "amber",
          icon: Receipt,
          title: `¡Pago recibido del invoice ${inv.number}!`,
          message: "Agenda el trabajo en el calendario para no perderle el rastro.",
          ctaLabel: "Agendar trabajo",
          ctaAction: () => navigate(`/calendario?job_id=${job.id}`),
        });
      }
    }

    // 4. Quote sent > 3 days ago, still 'sent'. (Soft follow-up nudge.)
    const threeDays = 3 * 24 * 3600 * 1000;
    for (const q of quotes) {
      if (q.status !== "sent") continue;
      const created = q.updated_at || q.created_at;
      if (!created) continue;
      const age = Date.now() - new Date(created).getTime();
      if (age > threeDays) {
        out.push({
          id: `quote-followup-${q.id}`,
          tone: "slate",
          icon: Clock,
          title: `Quote ${q.number} sin respuesta hace ${Math.floor(age / (24 * 3600 * 1000))} días`,
          message: "Vuélvelo a mandar — un recordatorio amable suele cerrar la venta.",
          ctaLabel: "Volver a mandar",
          ctaAction: () => navigate(`/quotes/${q.id}`),
        });
      }
    }

    // 5. Pending Job not yet scheduled (no invoice paid yet but agreement signed).
    for (const job of jobs) {
      if (job.scheduled_date) continue;
      // Already covered by case 3 if invoice is paid; skip duplicates.
      const inv = invoices.find((i) => i.id === job.invoice_id);
      if (inv && inv.status === "paid") continue;
      // Optional gentle reminder only if status='approved'
      if (job.status === "approved") {
        out.push({
          id: `job-unscheduled-${job.id}`,
          tone: "slate",
          icon: CalendarDays,
          title: `Trabajo ${job.title || ""} sin agendar`,
          message: "Asígnale fecha en el calendario cuando estés listo.",
          ctaLabel: "Ir al calendario",
          ctaAction: () => navigate(`/calendario?job_id=${job.id}`),
        });
      }
    }

    return out.filter((n) => !dismissed.includes(n.id));
  }, [client, history, dismissed, navigate]);

  if (notices.length === 0) return null;

  const dismiss = (id) => {
    const next = [...dismissed, id];
    setDismissed(next);
    saveDismissed(next);
  };

  return (
    <div className="space-y-2" data-testid="client-flow-notices">
      {notices.map((n) => (
        <Notice key={n.id} notice={n} onDismiss={() => dismiss(n.id)} />
      ))}
    </div>
  );
}

const toneStyles = {
  emerald: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    iconBg: "bg-emerald-600",
    btn: "bg-emerald-600 hover:bg-emerald-700",
    text: "text-emerald-900",
  },
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    iconBg: "bg-blue-600",
    btn: "bg-blue-600 hover:bg-blue-700",
    text: "text-blue-900",
  },
  amber: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    iconBg: "bg-amber-600",
    btn: "bg-amber-600 hover:bg-amber-700",
    text: "text-amber-900",
  },
  slate: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    iconBg: "bg-slate-600",
    btn: "bg-slate-700 hover:bg-slate-800",
    text: "text-slate-900",
  },
};

function Notice({ notice, onDismiss }) {
  const s = toneStyles[notice.tone] || toneStyles.slate;
  const Icon = notice.icon;
  return (
    <div
      data-testid={`notice-${notice.id}`}
      className={`relative ${s.bg} ${s.border} border rounded-2xl p-3 sm:p-4 flex items-start gap-3`}
    >
      <div className={`w-10 h-10 rounded-xl ${s.iconBg} flex items-center justify-center flex-none`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-bold text-sm ${s.text}`}>{notice.title}</div>
        <div className={`text-xs sm:text-sm mt-0.5 ${s.text} opacity-80`}>
          {notice.message}
        </div>
        <button
          data-testid={`notice-cta-${notice.id}`}
          onClick={notice.ctaAction}
          className={`mt-2 inline-flex items-center gap-1 text-xs font-bold ${s.btn} text-white px-3 py-1.5 rounded-lg`}
        >
          {notice.ctaLabel} <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <button
        onClick={onDismiss}
        className="text-slate-400 hover:text-slate-700 p-1 rounded flex-none"
        aria-label="Cerrar aviso"
        data-testid={`notice-dismiss-${notice.id}`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
