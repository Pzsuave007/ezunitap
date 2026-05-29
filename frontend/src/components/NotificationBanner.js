/**
 * NotificationBanner — shows the top 1-2 active in-app notifications stacked
 * at the top of every authenticated page.
 *
 * Replaces the standalone TrialBanner. Trial logic still lives in TrialBanner
 * (rendered as a fallback below when there are no admin/system notifs).
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  Info, CheckCircle2, AlertTriangle, Megaphone, X, ChevronRight,
} from "lucide-react";

const KIND_STYLES = {
  info:         { bg: "bg-sky-50",     border: "border-sky-200",     text: "text-sky-900",     icon: Info,           iconColor: "text-sky-700",     btn: "bg-white text-sky-700 border-sky-200 hover:bg-sky-100" },
  success:      { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900", icon: CheckCircle2,   iconColor: "text-emerald-700", btn: "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-100" },
  warning:      { bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-900",   icon: AlertTriangle,  iconColor: "text-amber-700",   btn: "bg-white text-amber-700 border-amber-200 hover:bg-amber-100" },
  announcement: { bg: "bg-indigo-50",  border: "border-indigo-200",  text: "text-indigo-900",  icon: Megaphone,      iconColor: "text-indigo-700",  btn: "bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-100" },
};

export default function NotificationBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/notifications");
      setNotifs(data.notifications || []);
    } catch {
      // silent — don't block UI on notif fetch error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
    // poll every 60s so admin messages appear without page refresh
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [user, load]);

  const dismiss = async (id) => {
    setNotifs((xs) => xs.filter((n) => n.id !== id));
    try { await api.post(`/notifications/${id}/dismiss`); }
    catch { /* ignore — refresh will resync */ }
  };

  const handleAction = (n) => {
    if (n.action_url) {
      if (/^https?:\/\//.test(n.action_url)) {
        window.open(n.action_url, "_blank", "noopener");
      } else {
        navigate(n.action_url);
      }
    }
  };

  if (!user || loading) return null;
  if (notifs.length === 0) return null;

  // Show up to 2 newest, the rest in a "ver más" link.
  const visible = notifs.slice(0, 2);
  const extra = notifs.length - visible.length;

  return (
    <div className="space-y-2 mb-4" data-testid="notification-banner">
      {visible.map((n) => {
        const s = KIND_STYLES[n.kind] || KIND_STYLES.info;
        const Icon = s.icon;
        return (
          <div
            key={n.id}
            data-testid={`notif-${n.id}`}
            className={`rounded-2xl border ${s.bg} ${s.border} px-4 py-3 flex items-start gap-3`}
          >
            <Icon className={`w-5 h-5 flex-none mt-0.5 ${s.iconColor}`} />
            <div className="flex-1 text-sm min-w-0">
              <div className={`font-semibold ${s.text}`}>{n.title}</div>
              <div className={`${s.text} opacity-85 mt-0.5 text-[13px] leading-snug`}>
                {n.body}
              </div>
            </div>
            {n.action_url && (
              <button
                data-testid={`notif-action-${n.id}`}
                onClick={() => handleAction(n)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap border ${s.btn} hidden sm:inline-flex items-center gap-1`}
              >
                {n.action_label || "Ver"}
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
            <button
              data-testid={`notif-dismiss-${n.id}`}
              onClick={() => dismiss(n.id)}
              className={`${s.iconColor} opacity-60 hover:opacity-100 leading-none px-1`}
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
      {extra > 0 && (
        <button
          data-testid="notif-see-more"
          onClick={() => navigate("/notificaciones")}
          className="text-xs text-slate-500 hover:text-slate-900 underline pl-2"
        >
          Ver {extra} {extra === 1 ? "mensaje más" : "mensajes más"}
        </button>
      )}
    </div>
  );
}
