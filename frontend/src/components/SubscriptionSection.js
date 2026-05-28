/**
 * SubscriptionSection — shows current subscription status and provides
 * actions: subscribe (free trial), manage via Stripe Customer Portal,
 * or cancel.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CreditCard, Sparkles, Clock, Crown, Loader2, ExternalLink, ShieldCheck, Gift,
} from "lucide-react";
import { toast } from "sonner";

function formatDate(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts * 1000).toLocaleDateString("es-ES", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch {
    return "—";
  }
}

function daysLeft(ts) {
  if (!ts) return null;
  const ms = ts * 1000 - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

const PLAN_LABELS = {
  pro_monthly: "Pro Mensual",
  pro_yearly: "Pro Anual",
  founder: "Founder Deal",
};

export default function SubscriptionSection() {
  const navigate = useNavigate();
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/payments/subscription");
      setSub(data);
    } catch {
      setSub(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const { data } = await api.post("/payments/portal", {
        origin_url: window.location.origin,
      });
      window.location.href = data.url;
    } catch (e) {
      toast.error(
        e?.response?.data?.detail ||
          "No se pudo abrir el portal de suscripción"
      );
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="card-elevated p-5 border-0 shadow-none">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      </Card>
    );
  }

  const status = sub?.subscription_status;
  const isComp = !!sub?.is_comp;
  const hasStripeCustomer = !!sub?.stripe_customer_id;
  // Only "real" paid users have a stripe_customer_id. Comp users may have
  // subscription_status="active" but no Stripe link, so the Customer Portal
  // doesn't apply to them.
  const isPaid = (status === "active" || status === "past_due") && hasStripeCustomer;
  const isTrialing = status === "trialing" && hasStripeCustomer;

  // Comp (courtesy) accounts: hand-picked free Pro access.
  if (isComp && !hasStripeCustomer) {
    return (
      <Card
        className="card-elevated p-5 border-0 shadow-none space-y-4"
        data-testid="subscription-section"
      >
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="w-5 h-5 text-blue-900" />
          <h3 className="font-heading font-bold text-base">Suscripción</h3>
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
            <Gift className="w-3 h-3" /> Cortesía
          </span>
        </div>
        <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
          <div className="flex items-start gap-2">
            <Crown className="w-5 h-5 text-amber-600 mt-0.5 flex-none" />
            <div>
              <div className="font-semibold text-sm text-amber-900">
                Acceso PRO de cortesía
              </div>
              <div className="text-xs text-amber-800 mt-1">
                Tienes acceso completo sin costo
                {sub?.comp_note ? ` — "${sub.comp_note}"` : ""}.
                No tienes una suscripción de Stripe asociada, así que el portal
                de gestión no aplica para ti.
              </div>
              {sub?.comp_expires_at && (
                <div className="text-[11px] text-amber-700 mt-2 italic">
                  Acceso hasta: {formatDate(sub.comp_expires_at)}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className="card-elevated p-5 border-0 shadow-none space-y-4"
      data-testid="subscription-section"
    >
      <div className="flex items-center gap-2 mb-1">
        <CreditCard className="w-5 h-5 text-blue-900" />
        <h3 className="font-heading font-bold text-base">Suscripción</h3>
        {isPaid && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
            <Crown className="w-3 h-3" /> {PLAN_LABELS[sub.plan_type] || "Pro"}
          </span>
        )}
        {isTrialing && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
            <Sparkles className="w-3 h-3" /> Trial
          </span>
        )}
      </div>

      {isPaid && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-50">
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                Estado
              </div>
              <div className="text-sm font-semibold mt-1 capitalize">
                {status === "active" ? "Activa" : "Pago pendiente"}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50">
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                Próxima renovación
              </div>
              <div className="text-sm font-semibold mt-1">
                {formatDate(sub.current_period_end)}
              </div>
            </div>
          </div>
          {sub.shipping_address && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <div className="font-semibold mb-1 flex items-center gap-1">
                📦 Dirección de envío de tu tarjeta NFC
              </div>
              <div>
                {sub.shipping_address.line1}
                {sub.shipping_address.line2 ? `, ${sub.shipping_address.line2}` : ""}
                <br />
                {sub.shipping_address.city}, {sub.shipping_address.state}{" "}
                {sub.shipping_address.postal_code}
                <br />
                {sub.shipping_address.country}
              </div>
            </div>
          )}
          <Button
            data-testid="open-portal"
            onClick={openPortal}
            disabled={portalLoading}
            variant="outline"
            className="w-full h-12 rounded-xl"
          >
            {portalLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <ExternalLink className="w-4 h-4 mr-2" />
            )}
            Gestionar suscripción
          </Button>
        </>
      )}

      {isTrialing && (
        <>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-700 mt-0.5 flex-none" />
              <div className="text-sm text-amber-900">
                <div className="font-semibold">
                  {daysLeft(sub.trial_ends_at)} días restantes de tu prueba
                </div>
                <div className="text-amber-800 text-xs mt-1">
                  Termina el {formatDate(sub.trial_ends_at)}. Suscríbete para
                  activar la Tarjeta NFC física y mantener todas las funciones.
                </div>
              </div>
            </div>
          </div>
          <Button
            data-testid="goto-pricing"
            onClick={() => navigate("/precios")}
            className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            <ShieldCheck className="w-4 h-4 mr-2" />
            Ver planes y suscribirse
          </Button>
        </>
      )}

      {!isPaid && !isTrialing && (
        <>
          <div className="p-3 rounded-xl bg-slate-50 text-sm text-slate-600">
            No tienes una suscripción activa.
          </div>
          <Button
            data-testid="goto-pricing-2"
            onClick={() => navigate("/precios")}
            className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            Empezar prueba gratis 14 días
          </Button>
        </>
      )}
    </Card>
  );
}
