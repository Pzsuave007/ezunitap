/**
 * Pricing — subscription plans page.
 * Lists 3 plans (Pro Mensual, Pro Anual, Founder Deal) and redirects the
 * user to Stripe Checkout with a 14-day trial (card required, auto-charge
 * after trial).
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Check, Crown, Sparkles, Loader2, Shield, CreditCard, Truck, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

const planAccents = {
  pro_monthly: {
    badge: null,
    border: "border-slate-200",
    button: "bg-slate-900 hover:bg-slate-800 text-white",
    icon: <CreditCard className="w-5 h-5" />,
  },
  pro_yearly: {
    badge: "Más popular",
    border: "border-emerald-500 ring-2 ring-emerald-100",
    button: "bg-emerald-600 hover:bg-emerald-700 text-white",
    icon: <Sparkles className="w-5 h-5" />,
  },
  founder: {
    badge: "Founder Deal",
    border: "border-amber-500 ring-2 ring-amber-100",
    button: "bg-gradient-to-br from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white",
    icon: <Crown className="w-5 h-5" />,
  },
};

export default function Pricing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(null);

  useEffect(() => {
    if (params.get("cancelled")) {
      toast.info("Pago cancelado. Puedes intentar de nuevo cuando quieras.");
    }
    (async () => {
      try {
        const { data } = await api.get("/payments/plans");
        setPlans(data.plans || []);
      } catch {
        toast.error("Error al cargar los planes");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubscribe = async (planId) => {
    if (!user) {
      navigate("/register");
      return;
    }
    setCheckoutLoading(planId);
    try {
      const { data } = await api.post("/payments/checkout", {
        plan_id: planId,
        origin_url: window.location.origin,
      });
      window.location.href = data.url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al iniciar el pago");
      setCheckoutLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="pricing-page">
      <div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-4"
          data-testid="pricing-back"
        >
          <ArrowLeft className="w-4 h-4" /> Atrás
        </button>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight">
          Elige tu plan
        </h1>
        <p className="text-slate-500 mt-2 max-w-2xl">
          Empieza con <strong>14 días gratis</strong>. Tu tarjeta se guarda al
          inicio y solo se cobra automáticamente al día 15 si no cancelas. La
          tarjeta NFC física se envía una vez que se activa la suscripción.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const accent = planAccents[plan.id] || planAccents.pro_monthly;
          const isLoading = checkoutLoading === plan.id;
          return (
            <Card
              key={plan.id}
              data-testid={`pricing-card-${plan.id}`}
              className={`relative p-6 rounded-3xl ${accent.border} transition`}
            >
              {accent.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full ${
                      plan.id === "founder"
                        ? "bg-amber-500 text-white"
                        : "bg-emerald-500 text-white"
                    }`}
                  >
                    {accent.badge}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 text-slate-500">
                {accent.icon}
                <span className="text-xs font-semibold uppercase tracking-wide">
                  {plan.name}
                </span>
              </div>

              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-heading text-5xl font-bold">
                  {plan.display_price}
                </span>
                <span className="text-slate-500 text-sm">
                  {plan.display_period}
                </span>
              </div>
              <p className="text-sm text-slate-600 mt-2">{plan.description}</p>

              <ul className="mt-5 space-y-2">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-none" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Shield className="w-3.5 h-3.5" />
                  <span>14 días gratis · Cancela cuando quieras</span>
                </div>
                {plan.ships_card && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Truck className="w-3.5 h-3.5" />
                    <span>Tarjeta NFC física incluida</span>
                  </div>
                )}
              </div>

              <Button
                data-testid={`subscribe-${plan.id}`}
                onClick={() => handleSubscribe(plan.id)}
                disabled={isLoading}
                className={`w-full mt-6 h-12 rounded-xl font-semibold ${accent.button}`}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  `Empezar gratis 14 días`
                )}
              </Button>
            </Card>
          );
        })}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm text-slate-600">
        <div className="font-semibold text-slate-900 mb-1">¿Cómo funciona?</div>
        <ol className="list-decimal list-inside space-y-1">
          <li>Eliges un plan y agregas tu tarjeta de pago en Stripe (seguro).</li>
          <li>Tienes 14 días para probar todas las funciones, sin cargo.</li>
          <li>Si no cancelas antes del día 15, se activa tu suscripción y se carga el plan.</li>
          <li>Te enviamos tu tarjeta NFC física a la dirección que ingreses.</li>
          <li>Puedes cancelar en cualquier momento desde Perfil → Suscripción.</li>
        </ol>
      </div>
    </div>
  );
}
