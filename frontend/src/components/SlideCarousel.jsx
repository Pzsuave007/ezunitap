import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

// Swipeable multi-slide viewer. `slides` = [{url, kind}]. Full URLs are built
// with REACT_APP_BACKEND_URL when the url is a relative /api path.
export default function SlideCarousel({ slides = [], testId = "slide-carousel", className = "" }) {
  const [idx, setIdx] = useState(0);
  const [touchX, setTouchX] = useState(null);
  if (!slides.length) return null;
  const clamp = (n) => Math.max(0, Math.min(slides.length - 1, n));
  const go = (n) => setIdx(clamp(n));
  const src = (u) => (u?.startsWith("http") ? u : `${BACKEND}${u}`);

  const onTouchStart = (e) => setTouchX(e.touches[0].clientX);
  const onTouchEnd = (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1));
    setTouchX(null);
  };

  return (
    <div className={`relative select-none ${className}`} data-testid={testId}>
      <div
        className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-100"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={src(slides[idx].url)}
          alt={`slide ${idx + 1}`}
          data-testid={`${testId}-img`}
          className="w-full h-full object-cover"
        />
        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(idx - 1)}
              disabled={idx === 0}
              data-testid={`${testId}-prev`}
              aria-label="Anterior"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center disabled:opacity-0 transition tap"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => go(idx + 1)}
              disabled={idx === slides.length - 1}
              data-testid={`${testId}-next`}
              aria-label="Siguiente"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center disabled:opacity-0 transition tap"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/55 text-white text-[11px] font-bold">
              {idx + 1}/{slides.length}
            </div>
          </>
        )}
      </div>
      {slides.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2.5" data-testid={`${testId}-dots`}>
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              data-testid={`${testId}-dot-${i}`}
              aria-label={`Ir a diapositiva ${i + 1}`}
              className={`h-2 rounded-full transition-all tap ${i === idx ? "w-6 bg-emerald-600" : "w-2 bg-slate-300"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
