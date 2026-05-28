import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge, { INVOICE_STATUSES } from "@/components/StatusBadge";
import { ChevronRight, Plus, Receipt, Trash2 } from "lucide-react";
import TourButton from "@/components/TourButton";
import { toast } from "sonner";

export default function Invoices() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState({});
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    (async () => {
      const [i, c] = await Promise.all([api.get("/invoices"), api.get("/clients")]);
      setInvoices(i.data);
      const m = {};
      c.data.forEach((x) => (m[x.id] = x));
      setClients(m);
    })();
  }, []);

  const list = filter === "all" ? invoices : invoices.filter((q) => q.status === filter);
  const labelFor = (s) => ({ draft: "Borrador", sent: "Enviado", paid: "Pagado", partial: "Parcial", overdue: "Atrasado" }[s] || s);

  const deleteInvoice = async (e, inv) => {
    e.stopPropagation();
    if (!window.confirm(`¿Borrar el invoice ${inv.number}? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/invoices/${inv.id}`);
      setInvoices((xs) => xs.filter((x) => x.id !== inv.id));
      toast.success("Invoice borrado");
    } catch {
      toast.error("Error al borrar");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-slate-500 mt-1">{invoices.length} en total</p>
        </div>
        <div className="flex items-center gap-2">
          <TourButton tourKey="invoices" />
          <Button
            data-testid="new-invoice-btn"
            onClick={() => navigate("/invoices/nuevo")}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 h-12 px-5"
          >
            <Plus className="w-4 h-4 mr-1" /> Nuevo
          </Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
        {["all", ...INVOICE_STATUSES].map((s) => (
          <button
            key={s}
            data-testid={`inv-filter-${s}`}
            onClick={() => setFilter(s)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold ${
              filter === s ? "bg-blue-900 text-white" : "bg-white border border-slate-200 text-slate-700"
            }`}
          >
            {s === "all" ? "Todos" : labelFor(s)}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <Card className="card-elevated p-10 text-center border-0 shadow-none">
          <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 mb-4">Sin invoices. Convierte un quote o crea uno nuevo.</p>
          <Button onClick={() => navigate("/invoices/nuevo")} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">Crear invoice</Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {list.map((q) => (
            <Card
              key={q.id}
              data-testid={`invoice-card-${q.id}`}
              onClick={() => navigate(`/invoices/${q.id}`)}
              className="card-elevated p-4 border-0 shadow-none cursor-pointer tap"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-500">{q.number}</span>
                    <StatusBadge kind="invoice" status={q.status} />
                  </div>
                  <div className="font-semibold truncate">{q.job_title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {clients[q.client_id]?.name || "Cliente"} · ${q.total?.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    data-testid={`invoice-delete-${q.id}`}
                    onClick={(e) => deleteInvoice(e, q)}
                    aria-label="Borrar invoice"
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
