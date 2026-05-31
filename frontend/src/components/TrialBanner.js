/**
 * TrialBanner — prominent banner for the END of a free trial.
 *
 * Day-to-day, the trial countdown lives as a subtle pill in the sidebar
 * (see Layout). This banner only appears when it matters:
 *   - The last 4 days of the trial, or
 *   - After the trial has expired.
 *
 * Hidden for: not logged in, paid (active/past_due), comp accounts,
 * /precios + /pago/exito routes, and when dismissed this session.
 *
 * For trial users WITH a card on file (Stripe Checkout), we show a friendly
 * NFC-shipping welcome instead.
 *
 * Engaged trial users (clients + invoices) near the end get a one-time
 * "Extender 7 días gratis" button instead of just "Ver planes".
 */
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Clock, Sparkles, Package, Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

function daysLeft(ts) {
  if (!ts) return null;
  const ms = ts * 1000 - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

const HIDE_ON_PATHS = ["/precios", "/pago/exito"];

export default function TrialBanner() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const [trialApi, setTrialApi] = useState(null);
  const [extending, setExtending] = useState(false);

  useEffect(() => {
    const v = sessionStorage.getItem("trial_banner_dismissed");
    if (v === "1") setDismissed(true);
  }, []);

  const isLocalTrial =
    user &&
    !user.is_comp &&
    user.subscription_status === "trialing" &&
    !user.stripe_customer_id;

  useEffect(() => {
    if (!isLocalTrial) return;
    api.get("/trial/status").then(({ data }) => setTrialApi(data)).catch(() => {});
  }, [isLocalTrial]);

  if (!user) return null;
  if (dismissed) return null;
  if (HIDE_ON_PATHS.includes(location.pathname)) return null;
  if (user.is_comp) return null;
  if (user.subscription_status === "active" || user.subscription_status === "past_due") return null;

  const status = user.subscription_status;
  if (!status) return null;

  const left = daysLeft(user.trial_ends_at);
  if (left === null) return null;

  const isExpired = left <= 0;
  const isPayingTrial = status === "trialing" && !!user.stripe_customer_id;

  const dismiss = () => {
    sessionStorage.setItem("trial_banner_dismissed", "1");
    setDismissed(true);
  };

  // Paying trial (NFC shipping) — keep friendly welcome.
  if (isPayingTrial) {
    return (
      <div
        data-testid="trial-banner"
        className="mb-4 rounded-2xl border bg-emerald-50 border-emerald-200 px-4 py-3 flex items-center gap-3"
      >
        <Package className="w-5 h-5 text-emerald-700 flex-none" />
        <div className="flex-1 text-sm">
          <span className="font-semibold text-emerald-900">¡Bienvenido a UniTap Pro!</span>{" "}
          <span className="text-emerald-800">
            Tu tarjeta NFC física ya está en proceso de programación y envío.
          </span>
        </div>
        <button
          data-testid="trial-banner-dismiss"
          onClick={dismiss}
          className="text-emerald-700/60 hover:text-emerald-900 text-lg leading-none px-1"
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>
    );
  }

  // Only show the prominent banner near the end (<= 4 days) or once expired.
  // Day-to-day the subtle sidebar pill carries the countdown.
  if (!isExpired && left > 4) return null;

  const canExtend = !!trialApi?.extend_eligible;

  const handleExtend = async () => {
    setExtending(true);
    try {
      await api.post("/trial/extend");
      await refreshUser();
      toast.success("¡Te regalamos 7 días más! 🎁");
      setTrialApi(null);
    } catch {
      toast.error("No se pudo extender la prueba");
    } finally {
      setExtending(false);
    }
  };

  return (
    <div
      data-testid="trial-banner"
      className={`mb-4 rounded-2xl border px-4 py-3 flex items-center gap-3 ${
        isExpired ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
      }`}
    >
      <div className="flex-none">
        {isExpired ? (
          <Clock className="w-5 h-5 text-red-600" />
        ) : (
          <Sparkles className="w-5 h-5 text-amber-700" />
        )}
      </div>
      <div className="flex-1 text-sm">
        {isExpired ? (
          <>
            <span className="font-semibold text-red-900">Tu prueba terminó.</span>{" "}
            <span className="text-red-800">
              {canExtend
                ? "Como has estado usando Unitap, puedes extenderla 7 días gratis."
                : "Suscríbete para seguir usando Unitap sin interrupciones."}
            </span>
          </>
        ) : (
          <>
            <span className="font-semibold text-amber-900">
              {left} {left === 1 ? "día restante" : "días restantes"} de tu prueba gratis.
            </span>{" "}
            <span className="text-amber-800">
              {canExtend
                ? "¡Vas muy bien! Extiéndela 7 días gratis."
                : "Suscríbete para desbloquear la Tarjeta NFC física."}
            </span>
          </>
        )}
      </div>

      {canExtend ? (
        <button
          data-testid="trial-extend-cta"
          onClick={handleExtend}
          disabled={extending}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1.5 disabled:opacity-60"
        >
          {extending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5" />}
          Extender 7 días
        </button>
      ) : (
        <button
          data-testid="trial-banner-cta"
          onClick={() => navigate("/precios")}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap ${
            isExpired
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-amber-600 hover:bg-amber-700 text-white"
          }`}
        >
          Ver planes
        </button>
      )}

      {!isExpired && (
        <button
          data-testid="trial-banner-dismiss"
          onClick={dismiss}
          className="text-slate-400 hover:text-slate-700 text-lg leading-none px-1"
          aria-label="Cerrar"
        >
          ×
        </button>
      )}
    </div>
  );
}
