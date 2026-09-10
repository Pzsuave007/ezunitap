import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { Loader2, Sparkles, AlertCircle } from "lucide-react";

/**
 * DemoStart — public entry point for the event QR / "Probar demo" button.
 * Provisions a fresh isolated sandbox account, logs the visitor in, and drops
 * them on the dashboard. Everything self-destructs after 60 minutes.
 */
export default function DemoStart() {
  const [error, setError] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const { data } = await api.post("/demo/start");
        localStorage.setItem("sf_token", data.token);
        // Full reload so AuthContext picks up the new session cleanly.
        window.location.replace("/");
      } catch (e) {
        console.error(e);
        setError(true);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white px-6" data-testid="demo-start-page">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-6">
          <Sparkles className="w-8 h-8" />
        </div>
        {!error ? (
          <>
            <h1 className="font-heading text-2xl font-bold">Preparando tu demo…</h1>
            <p className="text-slate-400 mt-2 text-sm">Creamos una cuenta de prueba con ejemplos listos para que explores todo UniTech.</p>
            <Loader2 className="w-6 h-6 animate-spin mx-auto mt-6 text-emerald-400" />
          </>
        ) : (
          <>
            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <h1 className="font-heading text-xl font-bold">No se pudo abrir el demo</h1>
            <p className="text-slate-400 mt-2 text-sm">Revisa tu conexión e inténtalo otra vez.</p>
            <button
              data-testid="demo-retry-btn"
              onClick={() => window.location.reload()}
              className="mt-5 px-5 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-semibold transition-colors"
            >
              Reintentar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
