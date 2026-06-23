import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";

// Compact EN | ES switch. Persists choice via i18next localStorage detector.
// Used in the app shell, landing and auth pages so users can switch anytime.
export default function LanguageToggle({ className = "", variant = "default" }) {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith("es") ? "es" : "en";

  const setLang = (lng) => {
    if (lng !== current) i18n.changeLanguage(lng);
    // Any explicit choice silences the "switch to Spanish" suggestion banner.
    localStorage.setItem("unitech_lang_dismiss", "1");
  };

  const dark = variant === "dark";
  const base = dark
    ? "border-white/25 text-white/80"
    : "border-slate-200 text-slate-500";
  const activeCls = dark
    ? "bg-white/20 text-white"
    : "bg-slate-900 text-white";

  return (
    <div
      data-testid="language-toggle"
      className={`inline-flex items-center gap-1 rounded-full border ${base} p-0.5 ${className}`}
    >
      <Globe className={`w-3.5 h-3.5 ml-1.5 ${dark ? "text-white/60" : "text-slate-400"}`} />
      {["en", "es"].map((lng) => (
        <button
          key={lng}
          type="button"
          data-testid={`lang-${lng}`}
          onClick={() => setLang(lng)}
          className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tap transition-colors ${
            current === lng ? activeCls : "bg-transparent"
          }`}
        >
          {lng}
        </button>
      ))}
    </div>
  );
}
