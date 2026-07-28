/**
 * Pricing — pick-your-modules selector.
 * The customer toggles the modules they want (Presencia, Negocio, Marketing).
 * Price updates live: 1 module = its price, any 2 = matching combo (30% OFF),
 * all 3 = the Bundle ($59.99/mo). 14-day free trial is handled in-app.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Check, Crown, Loader2, ArrowLeft, IdCard, FileText, Megaphone, Truck, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { WhatsAppButton } from "@/components/WhatsAppButton";

const SINGLES = ["presencia", "negocio", "marketing"];

// Map a selected pair (alphabetically sorted, comma-joined) → combo base.
const COMBO_MAP = {
  "negocio,presencia": "presencia_negocio",
  "marketing,presencia": "presencia_marketing",
  "marketing,negocio": "negocio_marketing",
};

const MODULE_UI = {
  presencia: { icon: <IdCard className="w-6 h-6" />, color: "sky", bulletsKey: "bPresencia", valueKey: "vPresencia" },
  negocio: { icon: <FileText className="w-6 h-6" />, color: "emerald", bulletsKey: "bNegocio", valueKey: "vNegocio" },
  marketing: { icon: <Megaphone className="w-6 h-6" />, color: "violet", bulletsKey: "bMarketing", valueKey: "vMarketing" },
};

const COLOR = {
  sky: { border: "border-sky-300", ring: "ring-sky-500 border-sky-500 bg-sky-50/60", chip: "text-sky-700 bg-sky-100", dot: "bg-sky-500" },
  emerald: { border: "border-emerald-300", ring: "ring-emerald-500 border-emerald-500 bg-emerald-50/60", chip: "text-emerald-700 bg-emerald-100", dot: "bg-emerald-500" },
  violet: { border: "border-violet-300", ring: "ring-violet-500 border-violet-500 bg-violet-50/60", chip: "text-violet-700 bg-violet-100", dot: "bg-violet-500" },
};

const money = (cents) => `$${(cents / 100).toFixed(2)}`;

export default function Pricing() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [byBase, setByBase] = useState({});
  const [billing, setBilling] = useState(params.get("billing") === "year" ? "year" : "month");
  const [sel, setSel] = useState({ presencia: false, negocio: false, marketing: false });
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const startedRef = useRef(false);

  const founderMode = (params.get("plan") || "") === "bundle_founder";
  const [founder, setFounder] = useState(null);
  useEffect(() => {
    if (!founderMode) return;
    setBilling("month"); // Founder price is monthly-only.
    api.get("/payments/founder-status").then((r) => setFounder(r.data)).catch(() => {});
  }, [founderMode]);

  useEffect(() => {
    if (params.get("cancelled")) toast.info(t("pricing.cancelled"));
    (async () => {
      try {
        const { data } = await api.get("/payments/plans");
        const map = {};
        (data.plans || []).forEach((p) => { map[p.base] = p; });
        setByBase(map);
      } catch {
        toast.error(t("pricing.errLoadPlans"));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-select modules from a deep-link (?plan=presencia / presencia_negocio / bundle).
  useEffect(() => {
    if (loading) return;
    const hp = params.get("plan") || "";
    if (!hp) return;
    const next = { presencia: false, negocio: false, marketing: false };
    if (hp === "bundle" || hp === "bundle_founder") { next.presencia = next.negocio = next.marketing = true; }
    else { hp.split("_").forEach((m) => { if (m in next) next[m] = true; }); }
    setSel(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const selectedSingles = SINGLES.filter((m) => sel[m]);
  const count = selectedSingles.length;

  let derivedBase = null;
  if (count === 1) derivedBase = selectedSingles[0];
  else if (count === 2) derivedBase = COMBO_MAP[[...selectedSingles].sort().join(",")];
  else if (count === 3) derivedBase = "bundle";

  const derivedPlan = derivedBase ? byBase[derivedBase] : null;
  const opt = derivedPlan ? (billing === "year" ? derivedPlan.yearly : derivedPlan.monthly) : null;

  // Founder deal is the full Bundle, monthly-only, capped lifetime.
  const founderActive = founderMode && derivedBase === "bundle" && billing === "month" && !!founder?.available;
  const founderSoldOut = founderMode && founder && !founder.available;
  const founderDisplayPrice = founder?.display_price || "$59";

  // Regular price = sum of selected singles (for the savings badge on 2+).
  const regularCents = selectedSingles.reduce((sum, m) => {
    const p = byBase[m];
    if (!p) return sum;
    return sum + (billing === "year" ? p.yearly.amount_cents : p.monthly.amount_cents);
  }, 0);
  const actualCents = opt ? opt.amount_cents : 0;
  const savePct = count >= 2 && regularCents > actualCents
    ? Math.round((1 - actualCents / regularCents) * 100) : 0;

  const toggle = (m) => setSel((s) => ({ ...s, [m]: !s[m] }));

  const subscribe = async () => {
    if (!derivedPlan || !opt) return;
    if (founderSoldOut) { toast.error(t("pricing.founderSoldOut")); return; }
    const effectivePlanId = founderActive ? "bundle_founder" : opt.plan_id;
    if (!user) {
      const planParam = founderActive ? "bundle_founder" : derivedBase;
      navigate(`/register?plan=${planParam}&billing=${billing}`);
      return;
    }
    setCheckoutLoading(true);
    try {
      const { data } = await api.post("/payments/checkout", {
        plan_id: effectivePlanId, origin_url: window.location.origin, num_cards: 1,
      });
      window.location.assign(data.url);
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("pricing.errCheckout"));
      setCheckoutLoading(false);
    }
  };

  // Auto-start checkout when arriving with &start=1 (resume after register).
  useEffect(() => {
    if (loading || startedRef.current) return;
    if (params.get("start") !== "1") return;
    if (!derivedPlan || !opt) return;
    startedRef.current = true;
    subscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, derivedBase, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const isBundle = derivedBase === "bundle";

  return (
    <div className="space-y-8 pb-28 lg:pb-8" data-testid="pricing-page">
      <div>
        <button onClick={() => navigate(-1)} data-testid="pricing-back"
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-4">
          <ArrowLeft className="w-4 h-4" /> {t("pricing.back")}
        </button>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight">{t("pricing.title")}</h1>
        <p className="text-slate-500 mt-2 max-w-2xl">
          {t("pricing.subtitle")}
        </p>
      </div>

      {/* Founder offer banner */}
      {founderMode && (
        <div
          data-testid="founder-banner"
          className={`rounded-3xl border-2 p-5 sm:p-6 ${founderSoldOut ? "border-slate-300 bg-slate-50" : "border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50"}`}
        >
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            <span className="text-xs font-bold uppercase tracking-wide text-amber-700">{t("pricing.founderBadge")}</span>
          </div>
          {founderSoldOut ? (
            <p className="mt-2 text-sm font-semibold text-slate-700" data-testid="founder-soldout">{t("pricing.founderSoldOut")}</p>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-heading text-3xl font-bold tabular-nums text-slate-900">{founderDisplayPrice}<span className="text-base font-normal text-slate-500">{t("pricing.perMonth")}</span></span>
                <span className="text-sm text-slate-400 line-through">{byBase.bundle ? byBase.bundle.monthly.display_price : ""}</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">{t("pricing.founderLifetime")}</span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{t("pricing.founderDesc", { limit: founder?.limit || 30 })}</p>
              {founder && (
                <div className="mt-3 inline-flex items-center gap-2" data-testid="founder-spots">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-white border border-amber-300 text-amber-800">
                    {t("pricing.founderSpots", { n: founder.remaining, limit: founder.limit })}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Monthly / Yearly toggle */}
      {!founderMode && (
      <div className="flex items-center justify-center">
        <div className="inline-flex bg-slate-100 rounded-full p-1" data-testid="interval-toggle">
          <button onClick={() => setBilling("month")} data-testid="interval-monthly"
            className={`px-5 py-2 rounded-full text-sm font-semibold transition ${billing === "month" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>
            Mensual
          </button>
          <button onClick={() => setBilling("year")} data-testid="interval-yearly"
            className={`px-5 py-2 rounded-full text-sm font-semibold transition flex items-center gap-2 ${billing === "year" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>
            Anual
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white">2 meses gratis</span>
          </button>
        </div>
      </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Module selector cards (span 2 cols on desktop) */}
        <div className="lg:col-span-2 grid sm:grid-cols-3 gap-4">
          {SINGLES.map((m) => {
            const p = byBase[m];
            const ui = MODULE_UI[m];
            const c = COLOR[ui.color];
            const o = p ? (billing === "year" ? p.yearly : p.monthly) : null;
            const active = sel[m];
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggle(m)}
                data-testid={`module-toggle-${m}`}
                aria-pressed={active}
                className={`relative text-left p-5 rounded-3xl border-2 bg-white transition focus:outline-none ${active ? `ring-2 ${c.ring}` : `${c.border} hover:shadow-md`}`}
              >
                <div className={`absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center border-2 ${active ? `${c.dot} border-transparent text-white` : "border-slate-300 text-transparent"}`}>
                  <Check className="w-4 h-4" />
                </div>
                <div className={`inline-flex items-center justify-center w-11 h-11 rounded-2xl ${c.chip}`}>{ui.icon}</div>
                <div className="mt-3 font-heading text-lg font-bold">{p?.label || m}</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="font-heading text-2xl font-bold tabular-nums">{o?.display_price}</span>
                  <span className="text-slate-400 text-xs">{billing === "year" ? t("pricing.perYear") : t("pricing.perMonth")}</span>
                </div>
                <div className={`mt-2 rounded-xl px-2.5 py-2 ${c.chip}`} data-testid={`module-value-${m}`}>
                  <div className="text-[9px] font-bold uppercase tracking-wider">{t("pricing.valuePrefix")}</div>
                  <div className="mt-0.5 text-[11px] leading-snug">{t(`pricing.${ui.valueKey}`)}</div>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {(t(`pricing.${ui.bulletsKey}`, { returnObjects: true }) || []).map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-slate-600">
                      <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-none" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        {/* Live summary / CTA */}
        <Card className={`p-6 rounded-3xl border-2 lg:sticky lg:top-6 h-fit ${isBundle ? "border-amber-400 ring-2 ring-amber-100" : "border-slate-200"}`} data-testid="pricing-summary">
          <div className="flex items-center gap-2">
            {isBundle ? <Crown className="w-5 h-5 text-amber-500" /> : <Sparkles className="w-5 h-5 text-emerald-600" />}
            <h2 className="font-heading text-lg font-bold">
              {count === 0 ? t("pricing.yourPlan") : (derivedPlan?.label || t("pricing.yourPlan"))}
            </h2>
            {isBundle && !founderActive && (
              <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white" data-testid="bundle-popular-badge">{t("pricing.popular")}</span>
            )}
          </div>

          {count === 0 ? (
            <p className="text-sm text-slate-500 mt-3">{t("pricing.selectModules")}</p>
          ) : (
            <>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-heading text-4xl font-bold tabular-nums" data-testid="summary-price">{founderActive ? founderDisplayPrice : opt?.display_price}</span>
                <span className="text-slate-500 text-sm">{billing === "year" ? t("pricing.perYear") : t("pricing.perMonth")}</span>
              </div>
              {founderActive && (
                <div className="mt-1 flex items-center gap-2" data-testid="summary-founder">
                  <span className="text-sm text-slate-400 line-through">{opt?.display_price}</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">{t("pricing.founderLifetime")}</span>
                </div>
              )}
              {billing === "year" && opt?.per_month && (
                <div className="text-xs text-emerald-700 font-semibold mt-1">{t("pricing.approxMonth", { price: opt.per_month })}</div>
              )}
              {!founderActive && savePct > 0 && (
                <div className="mt-2 flex items-center gap-2" data-testid="summary-savings">
                  <span className="text-sm text-slate-400 line-through">{money(regularCents)}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white">{t("pricing.save", { pct: savePct })}</span>
                </div>
              )}

              <div className="mt-4 border-t border-slate-100 pt-4 space-y-2">
                {selectedSingles.map((m) => (
                  <div key={m} className="flex items-center gap-2 text-sm text-slate-700" data-testid={`summary-item-${m}`}>
                    <span className={`w-2 h-2 rounded-full ${COLOR[MODULE_UI[m].color].dot}`} />
                    {byBase[m]?.label || m}
                  </div>
                ))}
              </div>

              {derivedPlan?.ships_card && (
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                  <Truck className="w-3.5 h-3.5" /> <span>{t("pricing.cardIncluded")}</span>
                </div>
              )}

              {isBundle && !founderActive && (
                <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-3" data-testid="bundle-value-stack">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-amber-700">{t("pricing.bundleValueTitle")}</div>
                  <div className="mt-1 text-xs text-slate-600">{t("pricing.bundleValueList")}</div>
                  <div className="mt-2 text-xs font-semibold text-emerald-700">{t("pricing.bundleSaveVs")}</div>
                </div>
              )}
            </>
          )}

          <Button
            data-testid="pricing-subscribe-btn"
            onClick={subscribe}
            disabled={count === 0 || checkoutLoading || founderSoldOut}
            className={`hidden lg:flex w-full mt-6 h-12 rounded-xl font-semibold text-white ${isBundle ? "bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
          >
            {checkoutLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : founderSoldOut ? t("pricing.founderSoldOut") : founderActive ? t("pricing.founderCta") : isBundle ? t("pricing.takeAll") : count === 0 ? t("pricing.chooseModule") : t("pricing.subscribe")}
          </Button>
        </Card>
      </div>

      <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white p-5 text-center" data-testid="pricing-value-footer">
        <p className="text-sm sm:text-base font-semibold">{t("pricing.valueFooter")}</p>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm text-slate-600">
        <div className="font-semibold text-slate-900 mb-1">{t("pricing.howTitle")}</div>
        <ol className="list-decimal list-inside space-y-1">
          <li>{t("pricing.how1")}</li>
          <li>{t("pricing.how2")}</li>
          <li>{t("pricing.how3")}</li>
          <li>{t("pricing.how4")}</li>
          <li>{t("pricing.how5")}</li>
        </ol>
      </div>

      {/* Not ready? Talk to a human on WhatsApp */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 text-center" data-testid="pricing-whatsapp-block">
        <p className="text-sm font-semibold text-slate-800">{t("whatsapp.pricingPrompt")}</p>
        <div className="mt-3 max-w-xs mx-auto">
          <WhatsAppButton testid="pricing-whatsapp" />
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-white/95 backdrop-blur border-t border-slate-200 p-4 flex items-center justify-between gap-3" data-testid="pricing-mobile-cta">
        <div>
          {count === 0 ? (
            <span className="text-sm text-slate-500">{t("pricing.chooseModules")}</span>
          ) : (
            <>
              <div className="font-heading text-xl font-bold leading-none">{founderActive ? founderDisplayPrice : opt?.display_price}<span className="text-xs text-slate-400 font-normal">{billing === "year" ? t("pricing.perYear") : t("pricing.perMonth")}</span></div>
              {founderActive ? <div className="text-[11px] text-amber-700 font-semibold">{t("pricing.founderLifetime")}</div> : savePct > 0 && <div className="text-[11px] text-emerald-700 font-semibold">{t("pricing.saveShort", { pct: savePct })}</div>}
            </>
          )}
        </div>
        <Button
          onClick={subscribe}
          disabled={count === 0 || checkoutLoading || founderSoldOut}
          data-testid="pricing-subscribe-btn-mobile"
          className={`h-11 px-6 rounded-xl font-semibold text-white ${isBundle ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-600 hover:bg-emerald-700"}`}
        >
          {checkoutLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : founderActive ? t("pricing.founderCta") : t("pricing.subscribe")}
        </Button>
      </div>
    </div>
  );
}
