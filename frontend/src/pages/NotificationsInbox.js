/**
 * NotificationsInbox — public-facing page where users see all their messages
 * from the team (current + dismissed).
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import {
  Loader2, Info, CheckCircle2, AlertTriangle, Megaphone, ChevronRight,
  Inbox, X,
} from "lucide-react";
import { toast } from "sonner";

const KIND_STYLES = {
  info:         { icon: Info,          color: "text-sky-700",     ring: "ring-sky-200" },
  success:      { icon: CheckCircle2,  color: "text-emerald-700", ring: "ring-emerald-200" },
  warning:      { icon: AlertTriangle, color: "text-amber-700",   ring: "ring-amber-200" },
  announcement: { icon: Megaphone,     color: "text-indigo-700",  ring: "ring-indigo-200" },
};

export default function NotificationsInbox() {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data } = await api.get("/notifications");
      setNotifs(data.notifications || []);
    } catch {
      toast.error("Error al cargar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const dismiss = async (id) => {
    setNotifs((xs) => xs.filter((n) => n.id !== id));
    try { await api.post(`/notifications/${id}/dismiss`); }
    catch { /* ignore */ }
  };

  const handleAction = (n) => {
    if (!n.action_url) return;
    if (/^https?:\/\//.test(n.action_url)) {
      window.open(n.action_url, "_blank", "noopener");
    } else {
      navigate(n.action_url);
    }
  };

  return (
    <div className="space-y-6" data-testid="inbox-page">
      <div>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight flex items-center gap-3">
          <Inbox className="w-8 h-8 text-blue-900" />
          Mensajes
        </h1>
        <p className="text-slate-500 mt-2">
          Anuncios y mensajes del equipo de Unitap.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : notifs.length === 0 ? (
        <Card className="p-12 text-center">
          <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-heading font-bold text-lg">Sin mensajes nuevos</h3>
          <p className="text-sm text-slate-500 mt-1">
            Cuando el equipo de Unitap te envíe un anuncio, aparecerá aquí.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifs.map((n) => {
            const s = KIND_STYLES[n.kind] || KIND_STYLES.info;
            const Icon = s.icon;
            return (
              <Card
                key={n.id}
                data-testid={`inbox-${n.id}`}
                className={`p-4 ring-1 ${s.ring}`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 flex-none mt-0.5 ${s.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-heading font-bold text-base">{n.title}</div>
                    <div className="text-sm text-slate-600 mt-1 leading-relaxed">{n.body}</div>
                    <div className="text-[11px] text-slate-400 mt-2">
                      {new Date(n.created_at * 1000).toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" })}
                    </div>
                    {n.action_url && (
                      <button
                        onClick={() => handleAction(n)}
                        data-testid={`inbox-action-${n.id}`}
                        className={`mt-3 inline-flex items-center gap-1 text-sm font-semibold ${s.color} hover:underline`}
                      >
                        {n.action_label || "Ver"}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    data-testid={`inbox-dismiss-${n.id}`}
                    onClick={() => dismiss(n.id)}
                    className="text-slate-300 hover:text-slate-700 flex-none"
                    aria-label="Cerrar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
