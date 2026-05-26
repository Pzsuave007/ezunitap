/**
 * SetupChecklist — Persistent onboarding card on Dashboard.
 * Polls /onboarding/status, auto-detects completed items, hides at 100%.
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Check, ArrowRight, Sparkles, X } from "lucide-react";

export default function SetupChecklist() {
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [hiding, setHiding] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/onboarding/status");
      setData(res.data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    // Re-check when window regains focus (user returns from another tab)
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  // Also refresh on SPA navigation back to dashboard (e.g. after completing a task)
  useEffect(() => {
    load();
  }, [location.key, load]);

  const dismiss = async () => {
    setHiding(true);
    try { await api.put("/onboarding/state", { dismissed: true }); } catch {}
  };

  // Don't show if: not loaded yet, completed (auto-hide), or manually dismissed
  if (!data || data.completed || data.dismissed || hiding) return null;

  return (
    <Card
      data-testid="setup-checklist"
      className="relative overflow-hidden border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 shadow-md"
    >
      <button
        data-testid="checklist-dismiss"
        onClick={dismiss}
        className="absolute top-3 right-3 w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-white flex items-center justify-center transition-colors z-10"
        aria-label="Esconder guía"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 shadow-lg shadow-emerald-500/30 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading text-lg sm:text-xl font-bold tracking-tight text-slate-900">
              Configura tu negocio
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {data.done_count} de {data.total} completados · te queda poquito
            </p>
          </div>
          <div className="hidden sm:block text-right">
            <div className="text-2xl font-heading font-bold text-emerald-700">{data.progress}%</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-2 rounded-full bg-emerald-100 overflow-hidden">
          <div
            data-testid="checklist-progress"
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-700 ease-out"
            style={{ width: `${data.progress}%` }}
          />
        </div>

        {/* Items */}
        <ul className="mt-5 space-y-2">
          {data.items.map((it) => (
            <li
              key={it.id}
              data-testid={`checklist-item-${it.id}`}
              className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all ${
                it.done
                  ? "bg-emerald-50/50 border-emerald-200"
                  : "bg-white border-slate-200 hover:border-emerald-400 hover:shadow-sm cursor-pointer"
              }`}
              onClick={() => !it.done && navigate(it.path)}
            >
              <div
                className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                  it.done
                    ? "bg-emerald-600 text-white"
                    : "border-2 border-slate-300 text-slate-300 group-hover:border-emerald-500 group-hover:text-emerald-600"
                }`}
              >
                {it.done ? <Check className="w-4 h-4" /> : <span className="text-xs">○</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold ${it.done ? "text-slate-500 line-through" : "text-slate-900"}`}>
                  {it.label}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">{it.minutes} min</div>
              </div>
              {!it.done && (
                <button
                  data-testid={`checklist-go-${it.id}`}
                  onClick={(e) => { e.stopPropagation(); navigate(it.path); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                >
                  Ir <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
