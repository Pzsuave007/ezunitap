/**
 * SmartCardPaywall — overlay shown on the Smart Card admin page when the
 * user does NOT yet have a paid (post-trial) subscription.
 *
 * Per user requirements:
 *   "Trial desbloquea TODO; Smart Card siempre requiere pago"
 *
 * So this overlay shows up for everyone in `trialing` or unsubscribed state
 * until they complete payment via Stripe (subscription_status = active).
 */
import { Lock, Sparkles, Crown, ArrowRight, Truck, IdCard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function SmartCardPaywall({ user }) {
  const navigate = useNavigate();
  const status = user?.subscription_status;
  const isTrialing = status === "trialing";

  return (
    <div
      data-testid="smartcard-paywall"
      className="relative overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-8 sm:p-12"
    >
      <div className="absolute -right-12 -top-12 w-48 h-48 bg-amber-200/40 rounded-full blur-3xl" />
      <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-emerald-200/40 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold uppercase tracking-wide">
          <Lock className="w-3.5 h-3.5" />
          Función Pro
        </div>

        <h1 className="font-heading text-3xl sm:text-4xl font-bold mt-4">
          Activa tu Tarjeta Inteligente
        </h1>
        <p className="text-slate-600 mt-3 sm:text-lg">
          {isTrialing ? (
            <>
              Tu prueba gratis te da acceso a todo Unitap — <strong>excepto la
              Tarjeta NFC física</strong>. Suscríbete para activarla y recibirla por correo.
            </>
          ) : (
            <>
              Suscríbete para crear tu tarjeta digital, generar reseñas con NFC,
              y recibir tu tarjeta física por correo.
            </>
          )}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-white border border-slate-100">
            <IdCard className="w-5 h-5 text-emerald-600 mt-0.5 flex-none" />
            <div>
              <div className="text-sm font-semibold">Tarjeta digital</div>
              <div className="text-xs text-slate-500">Comparte tu negocio con un tap</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-white border border-slate-100">
            <Truck className="w-5 h-5 text-blue-700 mt-0.5 flex-none" />
            <div>
              <div className="text-sm font-semibold">Tarjeta NFC física</div>
              <div className="text-xs text-slate-500">Te la mandamos por correo</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-white border border-slate-100">
            <Sparkles className="w-5 h-5 text-purple-600 mt-0.5 flex-none" />
            <div>
              <div className="text-sm font-semibold">Reseñas Google</div>
              <div className="text-xs text-slate-500">Sistema para generar reseñas con NFC</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-white border border-slate-100">
            <Crown className="w-5 h-5 text-amber-600 mt-0.5 flex-none" />
            <div>
              <div className="text-sm font-semibold">14 días gratis</div>
              <div className="text-xs text-slate-500">No se cobra hasta el día 15</div>
            </div>
          </div>
        </div>

        <Button
          data-testid="paywall-cta"
          onClick={() => navigate("/precios")}
          className="mt-6 h-12 px-6 rounded-xl bg-gradient-to-br from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold"
        >
          Ver planes <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
