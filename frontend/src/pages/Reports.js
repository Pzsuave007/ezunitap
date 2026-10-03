import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Download, TrendingUp, Receipt, Clock, DollarSign } from "lucide-react";
import { toast } from "sonner";

const money = (n) => `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Reports() {
  const { i18n } = useTranslation();
  const es = (i18n.language || "es").startsWith("es");
  const MONTHS = es ? MONTHS_ES : MONTHS_EN;
  const T = (e, s) => (es ? s : e);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/reports/income?start=${start}&end=${end}`);
      setData(data);
    } catch (e) {
      toast.error(T("Could not load the report", "No se pudo cargar el reporte"));
    } finally {
      setLoading(false);
    }
  }, [start, end]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const monthVal = (mk, key) => {
    const row = (data?.months || []).find((m) => m.month === mk);
    return row ? row[key] : 0;
  };

  const exportCsv = () => {
    if (!data) return;
    const rows = [];
    rows.push([T("Income report (cash basis)", "Reporte de ingresos (base efectivo)"), `${start} → ${end}`]);
    rows.push([]);
    rows.push([T("Summary", "Resumen")]);
    rows.push([T("Collected (total)", "Cobrado (total)"), data.collected]);
    rows.push([T("Tax collected", "Impuesto cobrado"), data.tax_collected]);
    rows.push([T("Net income (excl. tax)", "Ingreso neto (sin impuesto)"), data.net_collected]);
    rows.push([T("Invoiced", "Facturado"), data.invoiced]);
    rows.push([T("Outstanding", "Pendiente"), data.outstanding]);
    rows.push([T("Paid invoices", "Invoices pagados"), data.paid_invoices]);
    rows.push([]);
    rows.push([T("Month", "Mes"), T("Collected", "Cobrado"), T("Tax", "Impuesto")]);
    for (let i = 0; i < 12; i++) {
      const mk = `${year}-${String(i + 1).padStart(2, "0")}`;
      rows.push([MONTHS[i], monthVal(mk, "collected"), monthVal(mk, "tax")]);
    }
    rows.push([]);
    rows.push([T("Client", "Cliente"), T("Collected", "Cobrado"), T("Payments", "Pagos")]);
    (data.clients || []).forEach((c) => rows.push([c.client, c.collected, c.count]));
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `income-${year}.csv`;
    a.click();
  };

  const years = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) years.push(y);
  const maxMonth = Math.max(1, ...(data?.months || []).map((m) => m.collected));

  const kpis = [
    { label: T("Collected", "Cobrado"), val: money(data?.collected), icon: DollarSign, accent: "text-emerald-600", bg: "bg-emerald-50" },
    { label: T("Net income", "Ingreso neto"), val: money(data?.net_collected), icon: TrendingUp, accent: "text-blue-600", bg: "bg-blue-50", sub: T("excludes tax", "sin impuesto") },
    { label: T("Tax collected", "Impuesto cobrado"), val: money(data?.tax_collected), icon: Receipt, accent: "text-violet-600", bg: "bg-violet-50" },
    { label: T("Invoiced", "Facturado"), val: money(data?.invoiced), icon: BarChart3, accent: "text-slate-700", bg: "bg-slate-100" },
    { label: T("Outstanding", "Pendiente"), val: money(data?.outstanding), icon: Clock, accent: "text-amber-600", bg: "bg-amber-50" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6" data-testid="reports-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6" /> {T("Income Reports", "Reportes de Ingresos")}</h1>
          <p className="text-sm text-slate-500 mt-1">{T("Cash basis — counts money when you actually collect it. Great for taxes.", "Base efectivo — cuenta el dinero cuando realmente lo cobras. Ideal para taxes.")}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} data-testid="reports-year" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button onClick={exportCsv} disabled={!data} className="h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white gap-2" data-testid="reports-export">
            <Download className="w-4 h-4" /> {T("Export CSV", "Exportar CSV")}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">{T("Loading…", "Cargando…")}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3" data-testid="reports-kpis">
            {kpis.map((k, i) => (
              <Card key={i} className="p-4 border-0 shadow-sm">
                <div className={`w-9 h-9 rounded-lg ${k.bg} ${k.accent} flex items-center justify-center mb-3`}><k.icon className="w-5 h-5" /></div>
                <div className="text-xs text-slate-500 font-medium">{k.label}</div>
                <div className="text-xl font-bold mt-0.5">{k.val}</div>
                {k.sub && <div className="text-[10px] text-slate-400 mt-0.5">{k.sub}</div>}
              </Card>
            ))}
          </div>

          <Card className="p-5 border-0 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">{T("Monthly income", "Ingresos por mes")}</h2>
              <span className="text-xs text-slate-400">{data?.paid_invoices || 0} {T("invoices paid", "invoices pagados")}</span>
            </div>
            <div className="space-y-2">
              {MONTHS.map((mname, i) => {
                const mk = `${year}-${String(i + 1).padStart(2, "0")}`;
                const v = monthVal(mk, "collected");
                return (
                  <div key={i} className="flex items-center gap-3" data-testid={`reports-month-${i + 1}`}>
                    <span className="w-9 text-xs font-semibold text-slate-500">{mname}</span>
                    <div className="flex-1 h-6 bg-slate-100 rounded-md overflow-hidden">
                      <div className="h-full bg-emerald-500/80 rounded-md transition-all" style={{ width: `${(v / maxMonth) * 100}%` }} />
                    </div>
                    <span className="w-24 text-right text-sm font-semibold tabular-nums">{money(v)}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-5 border-0 shadow-sm">
            <h2 className="font-semibold mb-4">{T("Income by client", "Ingresos por cliente")}</h2>
            {(data?.clients || []).length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">{T("No payments collected in this period yet.", "Aún no hay pagos cobrados en este periodo.")}</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {(data.clients || []).map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5" data-testid={`reports-client-${i}`}>
                    <div className="min-w-0"><div className="font-medium truncate">{c.client}</div><div className="text-xs text-slate-400">{c.count} {T("payment(s)", "pago(s)")}</div></div>
                    <div className="font-semibold tabular-nums">{money(c.collected)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <p className="text-xs text-slate-400 text-center">{T("This report is for your records. Confirm figures with your accountant before filing.", "Este reporte es para tu control. Confirma las cifras con tu contador antes de declarar.")}</p>
        </>
      )}
    </div>
  );
}
