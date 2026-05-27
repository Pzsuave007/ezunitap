/**
 * TourButton — small floating "¿Cómo funciona?" button + react-joyride overlay.
 * Drop this at the top of any page and pass a tourKey from TOURS.
 *
 * Usage:
 *   <TourButton tourKey="dashboard" />
 */
import { useState } from "react";
import { Joyride, STATUS } from "react-joyride";
import { HelpCircle } from "lucide-react";
import { TOURS } from "@/lib/tours";

const tourLocale = {
  back: "Atrás",
  close: "Cerrar",
  last: "¡Listo!",
  next: "Siguiente",
  open: "Abrir tour",
  skip: "Saltar tour",
};

const tourStyles = {
  options: {
    primaryColor: "#10b981",
    textColor: "#0f172a",
    backgroundColor: "#ffffff",
    arrowColor: "#ffffff",
    overlayColor: "rgba(15, 23, 42, 0.6)",
    zIndex: 10000,
    width: 360,
  },
  buttonNext: {
    backgroundColor: "#10b981",
    fontWeight: 700,
    padding: "10px 18px",
    borderRadius: "12px",
    fontSize: "14px",
  },
  buttonBack: {
    color: "#475569",
    fontWeight: 600,
    marginRight: 12,
    fontSize: "14px",
  },
  buttonSkip: {
    color: "#64748b",
    fontWeight: 600,
    fontSize: "12px",
    padding: "8px 12px",
    display: "inline-block",
  },
  tooltip: {
    borderRadius: "16px",
    padding: "20px",
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
  },
  tooltipContent: {
    fontSize: "14px",
    lineHeight: "1.55",
    padding: "0 0 4px 0",
  },
};

export default function TourButton({ tourKey, label = "¿Cómo funciona?" }) {
  const [run, setRun] = useState(false);
  const steps = TOURS[tourKey] || [];

  const handleCallback = (data) => {
    const { status } = data;
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setRun(false);
    }
  };

  if (steps.length === 0) return null;

  return (
    <>
      <button
        data-testid={`tour-btn-${tourKey}`}
        onClick={() => setRun(true)}
        className="inline-flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors whitespace-nowrap"
        aria-label="Ver tour de esta sección"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        {label}
      </button>
      <Joyride
        steps={steps}
        run={run}
        continuous
        showProgress
        showSkipButton
        scrollToFirstStep
        disableScrolling={false}
        spotlightClicks={false}
        disableBeacon
        callback={handleCallback}
        locale={tourLocale}
        styles={tourStyles}
      />
    </>
  );
}
