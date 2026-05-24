import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge, { QUOTE_STATUSES } from "@/components/StatusBadge";
import { Sparkles, ChevronRight, FileText } from "lucide-react";

export default function Quotes() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState([]);
  const [clients, setClients] = useState({});
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    (async () => {
      const [q, c] = await Promise.all([api.get("/quotes"), api.get("/clients")]);
      setQuotes(q.data);
      const m = {};
      c.data.forEach((x) => (m[x.id] = x));
      setClients(m);
    })();
  }, []);

  const list = filter === "all" ? quotes : quotes.filter((q) => q.status === filter);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Quotes</h1>
          <p className="text-slate-500 mt-1">{quotes.length} en total</p>
        </div>
        <Button
          data-testid="new-quote-btn"
          onClick={() => navigate("/quotes/nuevo?ai=1")}
          className="rounded-xl bg-emerald-600 hover:bg-emerald-700 h-12 px-5"
        >
          <Sparkles className="w-4 h-4 mr-1" /> Nuevo con AI
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
        {["all", ...QUOTE_STATUSES].map((s) => (
          <button
            key={s}
            data-testid={`filter-${s}`}
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
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 mb-4">No hay quotes. Crea uno con AI en segundos.</p>
          <Button onClick={() => navigate("/quotes/nuevo?ai=1")} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
            <Sparkles className="w-4 h-4 mr-1" /> Crear quote
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {list.map((q) => (
            <Card
              key={q.id}
              data-testid={`quote-card-${q.id}`}
              onClick={() => navigate(`/quotes/${q.id}`)}
              className="card-elevated p-4 border-0 shadow-none cursor-pointer tap"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-500">{q.number}</span>
                    <StatusBadge kind="quote" status={q.status} />
                  </div>
                  <div className="font-semibold truncate">{q.job_title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {clients[q.client_id]?.name || "Cliente"} · ${q.total?.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const labelFor = (s) => ({
  draft: "Borrador", sent: "Enviado", approved: "Aprobado",
  declined: "Rechazado", converted: "Convertido",
}[s] || s);
