/**
 * TrialBanner — small banner shown to users currently in a trial.
 *
 * Hidden in these cases:
 *   - Not logged in
 *   - Paid (active / past_due)
 *   - Comp (complimentary) accounts
 *   - Trialing users who ALREADY entered a card via Stripe Checkout
 *     (i.e. `stripe_customer_id` is set) — they're already subscribed.
 *   - On /precios or /pago/exito routes
 *   - User dismissed it in this session
 *
 * For trial users WITH a card on file, we show a friendly reminder of how
 * many days until the first charge — no "subscribe" CTA, just info + a
 * "Manage" link to the Settings page.
 */
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Clock, Sparkles, Package } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

function daysLeft(ts) {
  if (!ts) return null;
  const ms = ts * 1000 - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

const HIDE_ON_PATHS = ["/precios", "/pago/exito"];

export default function TrialBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const v = sessionStorage.getItem("trial_banner_dismissed");
    if (v === "1") setDismissed(true);
  }, []);

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

  // ✅ Paying trial (card on file via Stripe Checkout) → friendly reminder,
  //    no "subscribe again" prompt — they're already subscribed.
  const isPayingTrial = status === "trialing" && !!user.stripe_customer_id;

  const dismiss = () => {
    sessionStorage.setItem("trial_banner_dismissed", "1");
    setDismissed(true);
  };

  if (isPayingTrial) {
    return (
      <div
        data-testid="trial-banner"
        className="mb-4 rounded-2xl border bg-emerald-50 border-emerald-200 px-4 py-3 flex items-center gap-3"
      >
        <Package className="w-5 h-5 text-emerald-700 flex-none" />
        <div className="flex-1 text-sm">
          <span className="font-semibold text-emerald-900">
            ¡Bienvenido a UniTap Pro!
          </span>{" "}
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
