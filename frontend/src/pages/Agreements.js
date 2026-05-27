import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSignature, Plus, ChevronRight, Trash2, CheckCircle2, Clock, FileX } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["draft", "sent", "signed", "declined"];
const STATUS_LABEL = { draft: "Borrador", sent: "Enviado", signed: "Firmado", declined: "Rechazado" };
const STATUS_STYLES = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-blue-100 text-blue-800",
  signed: "bg-emerald-100 text-emerald-800",
  declined: "bg-rose-100 text-rose-800",
};
const STATUS_ICON = { draft: Clock, sent: Clock, signed: CheckCircle2, declined: FileX };

export default function Agreements() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [clients, setClients] = useState({});
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const [a, c] = await Promise.all([api.get("/agreements"), api.get("/clients")]);
        setList(a.data);
        const m = {};
        c.data.forEach((x) => (m[x.id] = x));
        setClients(m);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const filtered = filter === "all" ? list : list.filter((a) => a.status === filter);

  const remove = async (e, a) => {
    e.stopPropagation();
    if (!window.confirm(`¿Borrar el contrato ${a.number}?`)) return;
    try {
      await api.delete(`/agreements/${a.id}`);
      setList((xs) => xs.filter((x) => x.id !== a.id));
      toast.success("Contrato borrado");
    } catch {
      toast.error("Error al borrar");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Contratos</h1>
          <p className="text-slate-500 mt-1">{list.length} en total · firmas digitales legalmente vinculantes</p>
        </div>
        <Button
          data-testid="new-agreement-btn"
          onClick={() => navigate("/contratos/nuevo")}
          className="rounded-xl bg-emerald-600 hover:bg-emerald-700 h-12 px-5"
        >
          <Plus className="w-4 h-4 mr-1" /> Nuevo con AI
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
        {["all", ...STATUSES].map((s) => (
          <button
            key={s}
            data-testid={`filter-${s}`}
            onClick={() => setFilter(s)}
            className={`px-4 h-9 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors ${
              filter === s
                ? "bg-blue-900 text-white border-blue-900"
                : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
            }`}
          >
            {s === "all" ? "Todos" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="card-elevated p-10 text-center border-0 shadow-none">
          <FileSignature className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm mb-4">
            Aún no tienes contratos. Genera uno con AI en segundos — te protege legalmente contra disputas.
          </p>
          <Button
            data-testid="empty-create-agreement"
            onClick={() => navigate("/contratos/nuevo")}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 h-11"
          >
            <Plus className="w-4 h-4 mr-2" /> Crear con AI
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const Icon = STATUS_ICON[a.status] || Clock;
            return (
              <Card
                key={a.id}
                data-testid={`agreement-row-${a.id}`}
                onClick={() => navigate(`/contratos/${a.id}`)}
                className="card-elevated p-4 border-0 shadow-none cursor-pointer hover:bg-slate-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate">{a.title}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_STYLES[a.status]}`}>
                        <Icon className="inline w-3 h-3 mr-1 -mt-0.5" />{STATUS_LABEL[a.status]}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {a.number} · {clients[a.client_id]?.name || "Cliente"} · ${(a.total || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <button
                    data-testid={`delete-agreement-${a.id}`}
                    onClick={(e) => remove(e, a)}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    aria-label="Borrar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
