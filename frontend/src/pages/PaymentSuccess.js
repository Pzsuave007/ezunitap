/**
 * PaymentSuccess — landing page after Stripe Checkout.
 * Polls /payments/status/{session_id} until subscription is confirmed,
 * then refreshes the user context and redirects to dashboard.
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, AlertCircle, Truck } from "lucide-react";

const POLL_MAX = 10;
const POLL_INTERVAL = 2000;

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const { refreshUser } = useAuth();
  const [state, setState] = useState("polling"); // polling | success | expired | error
  const [details, setDetails] = useState(null);

  useEffect(() => {
    if (!sessionId) {
      setState("error");
      return;
    }
    let attempts = 0;
    let mounted = true;

    const poll = async () => {
      attempts += 1;
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (!mounted) return;
        setDetails(data);
        if (data.status === "complete") {
          setState("success");
          await refreshUser();
          return;
        }
        if (data.status === "expired") {
          setState("expired");
          return;
        }
        if (attempts >= POLL_MAX) {
          setState("error");
          return;
        }
        setTimeout(poll, POLL_INTERVAL);
      } catch {
        if (!mounted) return;
        if (attempts >= POLL_MAX) {
          setState("error");
          return;
        }
        setTimeout(poll, POLL_INTERVAL);
      }
    };
    poll();
    return () => {
      mounted = false;
    };
  }, [sessionId, refreshUser]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-emerald-50 to-blue-50">
      <Card className="w-full max-w-lg p-8 rounded-3xl" data-testid="payment-success-card">
        {state === "polling" && (
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto" />
            <h2 className="font-heading text-2xl font-bold mt-4">
              Confirmando tu pago...
            </h2>
            <p className="text-slate-500 mt-2 text-sm">
              Esto toma solo unos segundos.
            </p>
          </div>
        )}

        {state === "success" && (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="font-heading text-3xl font-bold mt-4">
              ¡Bienvenido a Pro!
            </h2>
            <p className="text-slate-600 mt-2">
              Tu suscripción se inició con <strong>14 días de prueba gratis</strong>.
              No se te cobrará nada hasta el día 15.
            </p>
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-left">
              <div className="flex items-start gap-2">
                <Truck className="w-5 h-5 text-amber-700 flex-none mt-0.5" />
                <div className="text-sm text-amber-900">
                  <div className="font-semibold">Tarjeta NFC en camino</div>
                  <div className="text-amber-800 mt-1">
                    Te enviaremos tu tarjeta física a la dirección que
                    proporcionaste tras la activación de la suscripción.
                  </div>
                </div>
              </div>
            </div>
            <Button
              data-testid="success-go-dashboard"
              onClick={() => navigate("/")}
              className="w-full mt-6 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              Ir al panel
            </Button>
          </div>
        )}

        {state === "expired" && (
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-amber-600 mx-auto" />
            <h2 className="font-heading text-2xl font-bold mt-4">
              Sesión de pago expirada
            </h2>
            <p className="text-slate-500 mt-2">
              No te preocupes, puedes intentarlo de nuevo.
            </p>
            <Button
              onClick={() => navigate("/precios")}
              className="mt-6 h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold w-full"
              data-testid="success-retry"
            >
              Ver planes
            </Button>
          </div>
        )}

        {state === "error" && (
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto" />
            <h2 className="font-heading text-2xl font-bold mt-4">
              No pudimos confirmar el pago
            </h2>
            <p className="text-slate-500 mt-2 text-sm">
              Verifica tu correo o regresa a planes para intentar de nuevo.
              {details ? ` (Estado: ${details.status})` : ""}
            </p>
            <Button
              onClick={() => navigate("/precios")}
              className="mt-6 h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold w-full"
              data-testid="success-error-retry"
            >
              Volver a planes
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
