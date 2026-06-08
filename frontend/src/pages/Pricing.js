/**
 * Pricing — modular subscription plans.
 * 3 individual modules (Presencia, Negocio, Marketing) + the all-in-one Bundle.
 * 14-day free trial is handled in-app (no card). Subscribing here charges
 * immediately via Stripe Checkout.
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Check, Crown, Loader2, ArrowLeft, IdCard, FileText, Megaphone, Truck,
} from "lucide-react";
import { toast } from "sonner";

// Human-readable bullets + visual accent per module.
const MODULE_UI = {
  presencia: {
    icon: <IdCard className="w-5 h-5" />,
    color: "sky",
    bullets: [
      "Tarjeta digital con QR + NFC",
      "Mini-sitio web profesional",
      "Reseñas de Google ⭐",
      "Captura de leads automática",
    ],
  },
  negocio: {
    icon: <FileText className="w-5 h-5" />,
    color: "emerald",
    bullets: [
      "Presupuestos con IA (español → inglés)",
      "Facturas y contratos profesionales",
      "CRM de clientes",
      "Calendario de trabajos",
    ],
  },
  marketing: {
    icon: <Megaphone className="w-5 h-5" />,
    color: "violet",
    bullets: [
      "Posts para redes con IA",
      "Videos / Reels con IA",
      "Plantillas y colores de tu marca",
      "Voz en off y subtítulos",
    ],
  },
  bundle: {
    icon: <Crown className="w-5 h-5" />,
    color: "amber",
    bullets: [
      "TODO Presencia + Negocio + Marketing",
      "Las herramientas completas",
      "El mejor precio (ahorras ~40%)",
      "Tarjeta NFC física incluida",
    ],
  },
};

const COLOR = {
  sky: { ring: "border-sky-200", badge: "bg-sky-500", btn: "bg-sky-600 hover:bg-sky-700", chip: "text-sky-600 bg-sky-50" },
  emerald: { ring: "border-emerald-200", badge: "bg-emerald-500", btn: "bg-emerald-600 hover:bg-emerald-700", chip: "text-emerald-600 bg-emerald-50" },
  violet: { ring: "border-violet-200", badge: "bg-violet-500", btn: "bg-violet-600 hover:bg-violet-700", chip: "text-violet-600 bg-violet-50" },
  amber: { ring: "border-amber-500 ring-2 ring-amber-100", badge: "bg-amber-500", btn: "bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700", chip: "text-amber-600 bg-amber-50" },
};

export default function Pricing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [plans, setPlans] = useState([]);
  const [billing, setBilling] = useState("month"); // "month" | "year"
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
        num_cards: 1,
      });
      window.location.assign(data.url);
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
          Elige lo que necesitas
        </h1>
        <p className="text-slate-500 mt-2 max-w-2xl">
          Paga solo por las herramientas que uses, o llévate <strong>todo</strong> con
          el Bundle y ahorra. Empieza con <strong>14 días gratis</strong> (sin tarjeta).
        </p>
      </div>

      {/* Monthly / Yearly toggle */}
      <div className="flex items-center justify-center">
        <div className="inline-flex bg-slate-100 rounded-full p-1" data-testid="interval-toggle">
          <button
            onClick={() => setBilling("month")}
            data-testid="interval-monthly"
            className={`px-5 py-2 rounded-full text-sm font-semibold transition ${
              billing === "month" ? "bg-white shadow text-slate-900" : "text-slate-500"
            }`}
          >
            Mensual
          </button>
          <button
            onClick={() => setBilling("year")}
            data-testid="interval-yearly"
            className={`px-5 py-2 rounded-full text-sm font-semibold transition flex items-center gap-2 ${
              billing === "year" ? "bg-white shadow text-slate-900" : "text-slate-500"
            }`}
          >
            Anual
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white">
              2 meses gratis
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const ui = MODULE_UI[plan.base] || MODULE_UI.presencia;
          const c = COLOR[ui.color];
          const opt = billing === "year" ? plan.yearly : plan.monthly;
          const planId = opt.plan_id;
          const isLoading = checkoutLoading === planId;
          const isBundle = plan.is_bundle;
          return (
            <Card
              key={plan.base}
              data-testid={`pricing-card-${plan.base}`}
              className={`relative p-6 rounded-3xl flex flex-col ${c.ring} ${isBundle ? "shadow-xl" : ""} transition`}
            >
              {isBundle && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full text-white ${c.badge}`}>
                    Más popular
                  </span>
                </div>
              )}

              <div className={`inline-flex items-center gap-2 w-fit px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide ${c.chip}`}>
                {ui.icon}
                {plan.label}
              </div>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-heading text-4xl font-bold tabular-nums">
                  {opt.display_price}
                </span>
                <span className="text-slate-500 text-sm">
                  {billing === "year" ? "/año" : "/mes"}
                </span>
              </div>
              {billing === "year" && opt.per_month && (
                <div className="text-xs text-emerald-700 font-semibold mt-1">
                  ≈ {opt.per_month}/mes
                </div>
              )}
              <p className="text-sm text-slate-600 mt-2 min-h-[40px]">{plan.tagline}</p>

              <ul className="mt-4 space-y-2 flex-1">
                {ui.bullets.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-none" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {plan.ships_card && (
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                  <Truck className="w-3.5 h-3.5" />
                  <span>Tarjeta NFC física incluida</span>
                </div>
              )}

              <Button
                data-testid={`subscribe-${plan.base}`}
                onClick={() => handleSubscribe(planId)}
                disabled={isLoading}
                className={`w-full mt-5 h-12 rounded-xl font-semibold text-white ${c.btn}`}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isBundle ? (
                  "Llevar todo"
                ) : (
                  "Suscribirme"
                )}
              </Button>
            </Card>
          );
        })}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm text-slate-600">
        <div className="font-semibold text-slate-900 mb-1">¿Cómo funciona?</div>
        <ol className="list-decimal list-inside space-y-1">
          <li>Pruebas <strong>14 días gratis</strong>, sin tarjeta.</li>
          <li>Al terminar, eliges el módulo que necesites o el Bundle completo.</li>
          <li>Agregas tu tarjeta de pago en Stripe (seguro) y se activa al instante.</li>
          <li>Si tu plan incluye tarjeta NFC, te la enviamos a tu dirección.</li>
          <li>Cancela o cambia de plan cuando quieras desde Perfil → Suscripción.</li>
        </ol>
      </div>
    </div>
  );
}
