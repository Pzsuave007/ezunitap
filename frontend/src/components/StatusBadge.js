import { Badge } from "@/components/ui/badge";

const QUOTE_STYLES = {
  draft: { label: "Borrador", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  sent: { label: "Enviado", cls: "bg-blue-50 text-blue-800 border-blue-200" },
  approved: { label: "Aprobado", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  declined: { label: "Rechazado", cls: "bg-red-50 text-red-700 border-red-200" },
  converted: { label: "Convertido", cls: "bg-violet-50 text-violet-800 border-violet-200" },
};

const INVOICE_STYLES = {
  draft: { label: "Borrador", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  sent: { label: "Enviado", cls: "bg-blue-50 text-blue-800 border-blue-200" },
  paid: { label: "Pagado", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  partial: { label: "Pago parcial", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  overdue: { label: "Atrasado", cls: "bg-red-50 text-red-700 border-red-200" },
};

const JOB_STYLES = {
  new_lead: { label: "Nuevo Lead", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  estimate_sent: { label: "Quote enviado", cls: "bg-blue-50 text-blue-800 border-blue-200" },
  approved: { label: "Aprobado", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  scheduled: { label: "Agendado", cls: "bg-indigo-50 text-indigo-800 border-indigo-200" },
  in_progress: { label: "En progreso", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  waiting_payment: { label: "Esperando pago", cls: "bg-orange-50 text-orange-800 border-orange-200" },
  completed: { label: "Completado", cls: "bg-emerald-100 text-emerald-900 border-emerald-300" },
};

const MAPS = { quote: QUOTE_STYLES, invoice: INVOICE_STYLES, job: JOB_STYLES };

export default function StatusBadge({ kind = "quote", status }) {
  const map = MAPS[kind] || QUOTE_STYLES;
  const info = map[status] || { label: status, cls: "bg-slate-100 text-slate-700 border-slate-200" };
  return (
    <Badge
      className={`rounded-full px-3 py-1 text-xs font-semibold border ${info.cls}`}
      variant="outline"
      data-testid={`status-${kind}-${status}`}
    >
      {info.label}
    </Badge>
  );
}

export const QUOTE_STATUSES = Object.keys(QUOTE_STYLES);
export const INVOICE_STATUSES = Object.keys(INVOICE_STYLES);
export const JOB_STATUSES = Object.keys(JOB_STYLES);
