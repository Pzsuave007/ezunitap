import { useEffect, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, CheckCircle2, Loader2, ExternalLink, AlertCircle } from "lucide-react";
import { toast } from "sonner";

/**
 * Lets the business owner connect their OWN Stripe account (Stripe Connect
 * Express) so invoice payments go straight into their account with THEIR
 * business name. Subscriptions and other payment options stay untouched.
 */
export default function StripeConnectSection() {
  const location = useLocation();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const { data } = await api.get("/connect/status");
      setStatus(data);
    } catch {
      setStatus({ available: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // After returning from Stripe onboarding (?connect=done), refresh status.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("connect")) {
      loadStatus();
      if (params.get("connect") === "done") toast.success("Volviste de Stripe. Verificando tu cuenta…");
    }
  }, [location.search, loadStatus]);

  const startOnboarding = async () => {
    setConnecting(true);
    try {
      const { data } = await api.post("/connect/onboard", { origin_url: window.location.origin });
      window.location.assign(data.url);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo conectar Stripe");
      setConnecting(false);
    }
  };

  const openDashboard = async () => {
    try {
      const { data } = await api.post("/connect/login-link");
      window.open(data.url, "_blank");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo abrir el panel de Stripe");
    }
  };

  if (loading) {
    return (
      <Card className="card-elevated p-5 border-0 shadow-none flex items-center gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" /> Cargando cobros con tarjeta…
      </Card>
    );
  }

  if (!status?.available) {
    return null; // Connect not configured on the server yet
  }

  const charges = status.charges_enabled;
  const pending = status.connected && !charges;

  return (
    <Card className="card-elevated p-5 border-0 shadow-none space-y-4" data-testid="stripe-connect-section">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0">
          <CreditCard className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-heading font-bold text-lg tracking-tight">Cobra invoices con tu propia cuenta de Stripe</h3>
          <p className="text-sm text-slate-500 mt-0.5 leading-snug">
            Conecta tu Stripe y los pagos de tus invoices caen <strong className="text-slate-700">directo a tu cuenta</strong>, con el nombre de tu negocio en el recibo.
          </p>
        </div>
      </div>

      {charges && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4" data-testid="connect-status-active">
          <div className="flex items-center gap-2 text-emerald-800 font-semibold">
            <CheckCircle2 className="w-5 h-5" /> Stripe conectado y listo para cobrar
          </div>
          {status.business_name && (
            <p className="text-sm text-emerald-700 mt-1">Cuenta: <strong>{status.business_name}</strong></p>
          )}
          <div className="flex gap-2 mt-3">
            <Button onClick={openDashboard} variant="outline" size="sm" data-testid="connect-dashboard-btn"
              className="rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-100">
              <ExternalLink className="w-4 h-4 mr-1.5" /> Ver mi panel de Stripe
            </Button>
          </div>
        </div>
      )}

      {pending && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4" data-testid="connect-status-pending">
          <div className="flex items-center gap-2 text-amber-800 font-semibold">
            <AlertCircle className="w-5 h-5" /> Falta completar tu verificación en Stripe
          </div>
          <p className="text-sm text-amber-700 mt-1">Termina los datos que pide Stripe para empezar a recibir pagos.</p>
          <Button onClick={startOnboarding} disabled={connecting} size="sm" data-testid="connect-continue-btn"
            className="mt-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white">
            {connecting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null} Continuar verificación
          </Button>
        </div>
      )}

      {!status.connected && (
        <Button onClick={startOnboarding} disabled={connecting} data-testid="connect-start-btn"
          className="w-full h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 hover:opacity-95 text-white font-bold">
          {connecting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Abriendo Stripe…</> : <><CreditCard className="w-5 h-5 mr-2" /> Conectar mi Stripe</>}
        </Button>
      )}

      <p className="text-xs text-slate-400">
        Esto es opcional y se suma a tus otras formas de pago. No cobramos comisión por usar tu Stripe.
      </p>
    </Card>
  );
}
