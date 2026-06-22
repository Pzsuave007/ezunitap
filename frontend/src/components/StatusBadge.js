import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

const QUOTE_CLS = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  sent: "bg-blue-50 text-blue-800 border-blue-200",
  approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  declined: "bg-red-50 text-red-700 border-red-200",
  converted: "bg-violet-50 text-violet-800 border-violet-200",
};

const INVOICE_CLS = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  created: "bg-cyan-50 text-cyan-800 border-cyan-200",
  sent: "bg-blue-50 text-blue-800 border-blue-200",
  paid: "bg-emerald-50 text-emerald-800 border-emerald-200",
  partial: "bg-amber-50 text-amber-800 border-amber-200",
  overdue: "bg-red-50 text-red-700 border-red-200",
};

const JOB_CLS = {
  new_lead: "bg-slate-100 text-slate-700 border-slate-200",
  estimate_sent: "bg-blue-50 text-blue-800 border-blue-200",
  approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  scheduled: "bg-indigo-50 text-indigo-800 border-indigo-200",
  in_progress: "bg-amber-50 text-amber-800 border-amber-200",
  waiting_payment: "bg-orange-50 text-orange-800 border-orange-200",
  completed: "bg-emerald-100 text-emerald-900 border-emerald-300",
};

const CLS = { quote: QUOTE_CLS, invoice: INVOICE_CLS, job: JOB_CLS };
const NS = { quote: "quotes.status", invoice: "invoices.status", job: "jobs.status" };

export default function StatusBadge({ kind = "quote", status }) {
  const { t } = useTranslation();
  const cls = (CLS[kind] || QUOTE_CLS)[status] || "bg-slate-100 text-slate-700 border-slate-200";
  const label = t(`${NS[kind] || "quotes.status"}.${status}`, { defaultValue: status });
  return (
    <Badge
      className={`rounded-full px-3 py-1 text-xs font-semibold border ${cls}`}
      variant="outline"
      data-testid={`status-${kind}-${status}`}
    >
      {label}
    </Badge>
  );
}

export const QUOTE_STATUSES = Object.keys(QUOTE_CLS);
export const INVOICE_STATUSES = Object.keys(INVOICE_CLS);
export const JOB_STATUSES = Object.keys(JOB_CLS);
