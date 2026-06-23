import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

const DISMISS_KEY = "unitech_lang_dismiss";

// Slim top banner that invites English-browser visitors (common among
// US Hispanics) to switch the WHOLE site to Spanish in one tap.
// Shows only when the active language resolved to English and the visitor
// has not yet made/seen a language choice. Dismissed forever once acted on.
export default function LanguageSuggestBanner() {
  const { i18n } = useTranslation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    const isEnglish = !(i18n.language || "").startsWith("es");
    setShow(isEnglish && !dismissed);
  }, [i18n.language]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  const switchToSpanish = () => {
    i18n.changeLanguage("es");
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      data-testid="lang-suggest-banner"
      className="relative z-[60] w-full bg-slate-900 text-white"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-center gap-3 px-4 py-2 text-sm">
        <span className="font-medium">
          ¿Hablas español? Mira UniTech en tu idioma.
        </span>
        <button
          type="button"
          data-testid="lang-suggest-switch-es"
          onClick={switchToSpanish}
          className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-emerald-400"
        >
          Ver en español
        </button>
        <button
          type="button"
          aria-label="Cerrar"
          data-testid="lang-suggest-close"
          onClick={dismiss}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 transition-colors hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
