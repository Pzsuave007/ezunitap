/**
 * OnboardingCelebration — Fires confetti + congrats modal once when the user
 * completes ALL 5 setup checklist items. Persists `celebrated:true` so it never
 * triggers again on the same account.
 */
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import confetti from "canvas-confetti";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PartyPopper, Trophy, ArrowRight } from "lucide-react";

const launchConfetti = () => {
  const duration = 2500;
  const end = Date.now() + duration;
  const colors = ["#10b981", "#0d9488", "#f59e0b", "#1e3a8a", "#ffffff"];

  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.85 },
      colors,
      scalar: 0.9,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.85 },
      colors,
      scalar: 0.9,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();

  // Big center burst
  setTimeout(() => {
    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.6 },
      colors,
      startVelocity: 45,
    });
  }, 250);
};

export default function OnboardingCelebration() {
  const navigate = useNavigate();
  const location = useLocation();
  const [show, setShow] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get("/onboarding/status");
        if (!mounted || firedRef.current) return;
        // Trigger only when completed AND never celebrated yet
        if (data.completed && !data.celebrated) {
          firedRef.current = true;
          // Persist immediately so a reload/route change won't re-fire
          try { await api.put("/onboarding/state", { celebrated: true }); } catch {}
          setShow(true);
          // Small delay so the modal can animate in before confetti
          setTimeout(launchConfetti, 250);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => { mounted = false; };
  }, [location.key]);

  if (!show) return null;

  const close = () => setShow(false);

  const goCreateQuote = () => {
    setShow(false);
    navigate("/quotes/nuevo?ai=1");
  };

  return (
    <div
      data-testid="onboarding-celebration"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-300"
    >
      <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden animate-in zoom-in-90 slide-in-from-bottom-6 duration-500">
        {/* Decorative top */}
        <div className="h-36 bg-gradient-to-br from-amber-400 via-emerald-500 to-teal-700 relative overflow-hidden">
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: "radial-gradient(circle at 2px 2px, #fff 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-3xl bg-white shadow-2xl flex items-center justify-center -rotate-6">
              <Trophy className="w-12 h-12 text-amber-500" strokeWidth={2.2} />
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-8 pt-8 pb-7">
          <div className="flex items-center justify-center gap-2 mb-2">
            <PartyPopper className="w-4 h-4 text-amber-500" />
            <span className="text-xs uppercase tracking-wider font-bold text-emerald-700">¡Setup Completo!</span>
            <PartyPopper className="w-4 h-4 text-amber-500" />
          </div>

          <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-center text-slate-900 leading-tight">
            ¡Tu negocio está listo! 🎉
          </h2>
          <p className="text-center text-slate-600 mt-3 leading-relaxed">
            Diste el paso más difícil. Ahora a lo bueno: mandar tu primer quote profesional en inglés y empezar a cobrar.
          </p>

          <div className="mt-7 space-y-2">
            <Button
              data-testid="celebration-create-quote"
              onClick={goCreateQuote}
              className="w-full h-13 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-base font-bold gap-2 shadow-lg shadow-emerald-500/20"
            >
              Crear mi primer quote con AI <ArrowRight className="w-4 h-4" />
            </Button>
            <button
              data-testid="celebration-close"
              onClick={close}
              className="w-full h-11 rounded-xl text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors"
            >
              Seguir explorando
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
