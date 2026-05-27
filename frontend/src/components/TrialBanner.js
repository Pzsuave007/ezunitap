/**
 * TrialBanner — a small banner that shows the user's trial countdown
 * and prompts to subscribe.
 *
 * Hidden when subscription is `active` (paid post-trial).
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

function daysLeft(ts) {
  if (!ts) return null;
  const ms = ts * 1000 - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export default function TrialBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const v = sessionStorage.getItem("trial_banner_dismissed");
    if (v === "1") setDismissed(true);
  }, []);

  if (!user) return null;
  if (dismissed) return null;
  const status = user.subscription_status;
  // Show only for trialing users WITHOUT a paid subscription. If they're
  // already active/past_due (paid), hide.
  if (status === "active" || status === "past_due") return null;
  if (!status) return null; // no trial set up either

  const left = daysLeft(user.trial_ends_at);
  if (left === null) return null;

  const isExpired = left <= 0;
  const dismiss = () => {
    sessionStorage.setItem("trial_banner_dismissed", "1");
    setDismissed(true);
  };

  return (
    <div
      data-testid="trial-banner"
      className={`mb-4 rounded-2xl border px-4 py-3 flex items-center gap-3 ${
        isExpired
          ? "bg-red-50 border-red-200"
          : "bg-amber-50 border-amber-200"
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
              Suscríbete para seguir usando Unitap sin interrupciones.
            </span>
          </>
        ) : (
          <>
            <span className="font-semibold text-amber-900">
              {left} {left === 1 ? "día restante" : "días restantes"} de tu prueba gratis.
            </span>{" "}
            <span className="text-amber-800">
              Suscríbete para desbloquear la Tarjeta NFC física.
            </span>
          </>
        )}
      </div>
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
