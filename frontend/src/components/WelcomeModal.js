/**
 * WelcomeModal — First-time visitor greeting with a CTA to start setup.
 * Shows once per user (until they mark welcome_seen=true).
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { X, Sparkles, Rocket, Compass } from "lucide-react";

export default function WelcomeModal() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [firstName, setFirstName] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get("/onboarding/status");
        if (!mounted) return;
        if (!data.welcome_seen) {
          setFirstName(data.first_name || data.business_name?.split(" ")[0] || "");
          // tiny delay so the dashboard renders first
          setTimeout(() => mounted && setShow(true), 350);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => { mounted = false; };
  }, []);

  const markSeen = async () => {
    setShow(false);
    try { await api.put("/onboarding/state", { welcome_seen: true }); } catch {}
  };

  const startSetup = async () => {
    await markSeen();
    // Scroll to checklist on dashboard
    setTimeout(() => {
      const el = document.querySelector('[data-testid="setup-checklist"]');
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const exploreAlone = async () => {
    await markSeen();
  };

  if (!show) return null;

  return (
    <div
      data-testid="welcome-modal"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
        {/* Decorative top gradient */}
        <div className="h-32 bg-gradient-to-br from-emerald-500 via-teal-600 to-blue-700 relative overflow-hidden">
          <div className="absolute inset-0 opacity-25" style={{
            backgroundImage: "radial-gradient(circle at 2px 2px, #fff 1px, transparent 0)",
            backgroundSize: "20px 20px"
          }} />
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-20 h-20 rounded-2xl bg-white shadow-xl flex items-center justify-center rotate-3">
            <Rocket className="w-10 h-10 text-emerald-600" />
          </div>
          <button
            data-testid="welcome-close"
            onClick={markSeen}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur text-white flex items-center justify-center transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 sm:px-8 pt-12 pb-7">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="text-xs uppercase tracking-wider font-bold text-slate-500">Bienvenido a Unitap</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>

          <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-center text-slate-900 leading-tight">
            ¡Hola{firstName ? ` ${firstName}` : ""}! 👋
          </h2>
          <p className="text-center text-slate-600 mt-3 leading-relaxed">
            Vamos a dejar tu negocio listo en <strong className="text-slate-900">3 minutos</strong>. Te ayudo paso a paso para que mañana ya estés mandando tu primer quote profesional en inglés. 🚀
          </p>

          <div className="mt-6 grid grid-cols-3 gap-2 text-center">
            {[
              { n: "01", l: "Tu info" },
              { n: "02", l: "Tu tarjeta" },
              { n: "03", l: "Tu primer quote" },
            ].map((s) => (
              <div key={s.n} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-600">{s.n}</div>
                <div className="text-xs font-semibold text-slate-700 mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>

          <div className="mt-7 space-y-2">
            <Button
              data-testid="welcome-start"
              onClick={startSetup}
              className="w-full h-13 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-base font-bold gap-2 shadow-lg shadow-emerald-500/20"
            >
              <Rocket className="w-4 h-4" />
              Setup en 3 minutos
            </Button>
            <button
              data-testid="welcome-explore"
              onClick={exploreAlone}
              className="w-full h-11 rounded-xl text-slate-500 hover:text-slate-700 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Compass className="w-4 h-4" />
              Explorar por mi cuenta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
