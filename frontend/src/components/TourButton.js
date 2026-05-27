/**
 * TourButton — Custom built-from-scratch guided tour.
 * No external library. The tooltip is fixed at the bottom of the viewport
 * (always visible regardless of target position) and a spotlight ring
 * highlights the current target. Bulletproof on any page length.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { HelpCircle, ChevronLeft, ChevronRight, X } from "lucide-react";
import { TOURS } from "@/lib/tours";

function getTargetRect(selector) {
  if (!selector || selector === "body") return null;
  try {
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      top: r.top + window.scrollY,
      left: r.left + window.scrollX,
      width: r.width,
      height: r.height,
    };
  } catch {
    return null;
  }
}

function Spotlight({ rect }) {
  if (!rect) {
    return <div className="fixed inset-0 bg-slate-900/65 z-[9998] pointer-events-none" />;
  }
  // Clip-path with a rectangular hole at the target's viewport coordinates
  const top = rect.top - window.scrollY - 8;
  const left = rect.left - window.scrollX - 8;
  const w = rect.width + 16;
  const h = rect.height + 16;
  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[9998] pointer-events-none transition-all duration-300"
        style={{
          background: `rgba(15, 23, 42, 0.65)`,
          clipPath: `polygon(
            0% 0%, 0% 100%, ${left}px 100%,
            ${left}px ${top}px,
            ${left + w}px ${top}px,
            ${left + w}px ${top + h}px,
            ${left}px ${top + h}px,
            ${left}px 100%,
            100% 100%, 100% 0%
          )`,
        }}
      />
      {/* Ring around the target */}
      <div
        className="fixed pointer-events-none z-[9999] rounded-xl ring-4 ring-emerald-400/80 ring-offset-2 ring-offset-emerald-50/40 transition-all duration-300"
        style={{ top: `${top}px`, left: `${left}px`, width: `${w}px`, height: `${h}px` }}
      />
    </>
  );
}

export default function TourButton({ tourKey, label = "¿Cómo funciona?" }) {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const rafRef = useRef(null);
  const steps = TOURS[tourKey] || [];
  const current = steps[stepIndex];

  // Continuously recompute target rect (handles layout shifts, scroll, resize)
  useEffect(() => {
    if (!run || !current) return undefined;
    const loop = () => {
      const r = getTargetRect(current.target);
      setRect((prev) => {
        if (!prev && !r) return prev;
        if (prev && r && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height) return prev;
        return r;
      });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [run, current]);

  // Scroll the target into view whenever the step changes
  useEffect(() => {
    if (!run || !current) return;
    if (!current.target || current.target === "body") return;
    try {
      const el = document.querySelector(current.target);
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      }
    } catch {
      /* ignore */
    }
  }, [run, stepIndex, current]);

  // Block body scroll while tour is running? No — we WANT user to see scroll.

  const start = useCallback(() => {
    setStepIndex(0);
    setRect(null);
    setRun(true);
  }, []);

  const close = useCallback(() => {
    setRun(false);
    setStepIndex(0);
    setRect(null);
  }, []);

  const next = useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      close();
    } else {
      setStepIndex((i) => i + 1);
    }
  }, [stepIndex, steps.length, close]);

  const back = useCallback(() => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  }, [stepIndex]);

  if (steps.length === 0) return null;

  const total = steps.length;
  const isLast = stepIndex === total - 1;
  const isFirst = stepIndex === 0;

  return (
    <>
      <button
        data-testid={`tour-btn-${tourKey}`}
        onClick={start}
        className="inline-flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors whitespace-nowrap"
        aria-label="Ver tour de esta sección"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        {label}
      </button>

      {run && current && (
        <>
          <Spotlight rect={rect} />

          {/* Tooltip — fixed at bottom of viewport, ALWAYS visible */}
          <div
            data-testid="custom-tour-tooltip"
            className="fixed left-1/2 -translate-x-1/2 z-[10000] w-[min(420px,calc(100vw-24px))] animate-in slide-in-from-bottom-5 duration-300"
            style={{ bottom: "16px" }}
          >
            <div className="rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
              {/* Progress bar */}
              <div className="h-1 bg-slate-100">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${((stepIndex + 1) / total) * 100}%` }}
                />
              </div>

              <div className="p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                    Paso {stepIndex + 1} de {total}
                  </span>
                  <button
                    data-testid="custom-tour-close"
                    onClick={close}
                    aria-label="Cerrar tour"
                    className="text-slate-400 hover:text-slate-700 p-1 -mr-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Content */}
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {current.content}
                </p>

                {/* Actions */}
                <div className="flex items-center justify-between mt-5 gap-2">
                  <button
                    data-testid="custom-tour-back"
                    onClick={back}
                    disabled={isFirst}
                    className="inline-flex items-center gap-1 h-10 px-3 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" /> Atrás
                  </button>
                  <button
                    data-testid="custom-tour-skip"
                    onClick={close}
                    className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                  >
                    Saltar tour
                  </button>
                  <button
                    data-testid="custom-tour-next"
                    onClick={next}
                    className="inline-flex items-center gap-1 h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm"
                  >
                    {isLast ? "¡Listo!" : "Siguiente"}
                    {!isLast && <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
