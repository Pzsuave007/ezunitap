import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, X, Share, Plus } from "lucide-react";

const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

export default function InstallPWA() {
  const { t } = useTranslation();
  const [deferred, setDeferred] = useState(null);
  const [visible, setVisible] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem("pwa_install_dismissed") === "1") return;

    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS Safari never fires beforeinstallprompt — show the manual hint button.
    if (isIos()) setVisible(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    setVisible(false);
    setShowIosHelp(false);
    localStorage.setItem("pwa_install_dismissed", "1");
  };

  const install = async () => {
    if (isIos()) {
      setShowIosHelp(true);
      return;
    }
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") dismiss();
    setDeferred(null);
  };

  if (!visible) return null;

  return (
    <>
      <button
        type="button"
        onClick={install}
        data-testid="pwa-install-btn"
        className="fixed bottom-4 left-4 z-40 inline-flex items-center gap-2 pl-3 pr-4 h-11 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-xl hover:bg-slate-800 transition-colors"
      >
        <Download className="w-4 h-4" />
        {t("pwa.install")}
        <span
          role="button"
          onClick={(e) => { e.stopPropagation(); dismiss(); }}
          data-testid="pwa-install-dismiss"
          className="ml-1 -mr-1 p-1 rounded-full hover:bg-white/15"
        >
          <X className="w-3.5 h-3.5" />
        </span>
      </button>

      {showIosHelp && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={dismiss} data-testid="pwa-ios-help">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading font-bold text-lg">{t("pwa.iosTitle")}</h3>
              <button onClick={dismiss} className="p-1 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <ol className="space-y-3 text-sm text-slate-700">
              <li className="flex items-center gap-3">
                <span className="flex-none w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold">1</span>
                <span className="flex items-center gap-1.5">{t("pwa.iosStep1")} <Share className="w-4 h-4 text-blue-600" /></span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex-none w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold">2</span>
                <span className="flex items-center gap-1.5">{t("pwa.iosStep2")} <Plus className="w-4 h-4 text-slate-700" /></span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex-none w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold">3</span>
                <span>{t("pwa.iosStep3")}</span>
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
