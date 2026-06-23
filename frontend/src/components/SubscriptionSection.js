/**
 * SubscriptionSection — shows current subscription status and provides
 * actions: subscribe (free trial), manage via Stripe Customer Portal,
 * or cancel.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CreditCard, Sparkles, Clock, Crown, Loader2, ExternalLink, ShieldCheck, Gift,
} from "lucide-react";
import { toast } from "sonner";

function formatDate(ts, lang) {
  if (!ts) return "—";
  try {
    return new Date(ts * 1000).toLocaleDateString(lang === "en" ? "en-US" : "es-ES", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch {
    return "—";
  }
}

function daysLeft(ts) {
  if (!ts) return null;
  const ms = ts * 1000 - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export default function SubscriptionSection() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith("en") ? "en" : "es";
  const planLabel = (key) => t(`subscription.plans.${key}`, { defaultValue: t("subscription.plans.pro") });
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/payments/subscription");
      setSub(data);
    } catch {
      setSub(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const { data } = await api.post("/payments/portal", {
        origin_url: window.location.origin,
      });
      window.location.assign(data.url);
    } catch (e) {
      toast.error(
        e?.response?.data?.detail ||
          t("subscription.portalError")
      );
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="card-elevated p-5 border-0 shadow-none">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      </Card>
    );
  }

  const status = sub?.subscription_status;
  const isComp = !!sub?.is_comp;
  const hasStripeCustomer = !!sub?.stripe_customer_id;
  // Only "real" paid users have a stripe_customer_id. Comp users may have
  // subscription_status="active" but no Stripe link, so the Customer Portal
  // doesn't apply to them.
  const isPaid = (status === "active" || status === "past_due") && hasStripeCustomer;
  const isTrialing = status === "trialing" && hasStripeCustomer;

  // Local free trial: brand-new users get a 14-day trial WITHOUT a card on file
  // (no Stripe customer yet). Their account is fully active — never tell them to
  // "start a free trial", they already started it on signup.
  const trialDays = daysLeft(sub?.trial_ends_at);
  const isLocalTrial =
    status === "trialing" && !hasStripeCustomer && (trialDays === null || trialDays > 0);
  const isLocalTrialExpired =
    status === "trialing" && !hasStripeCustomer && trialDays !== null && trialDays <= 0;

  // Comp (courtesy) accounts: hand-picked free Pro access.
  if (isComp && !hasStripeCustomer) {
    return (
      <Card
        className="card-elevated p-5 border-0 shadow-none space-y-4"
        data-testid="subscription-section"
      >
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="w-5 h-5 text-blue-900" />
          <h3 className="font-heading font-bold text-base">{t("subscription.title")}</h3>
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
            <Gift className="w-3 h-3" /> {t("subscription.courtesy")}
          </span>
        </div>
        <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
          <div className="flex items-start gap-2">
            <Crown className="w-5 h-5 text-amber-600 mt-0.5 flex-none" />
            <div>
              <div className="font-semibold text-sm text-amber-900">
                {t("subscription.compTitle")}
              </div>
              <div className="text-xs text-amber-800 mt-1">
                {t("subscription.compBody")}
                {sub?.comp_note ? ` — "${sub.comp_note}"` : ""}.{" "}
                {t("subscription.compNoStripe")}
              </div>
              {sub?.comp_expires_at && (
                <div className="text-[11px] text-amber-700 mt-2 italic">
                  {t("subscription.accessUntil")} {formatDate(sub.comp_expires_at, lang)}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className="card-elevated p-5 border-0 shadow-none space-y-4"
      data-testid="subscription-section"
    >
      <div className="flex items-center gap-2 mb-1">
        <CreditCard className="w-5 h-5 text-blue-900" />
        <h3 className="font-heading font-bold text-base">{t("subscription.title")}</h3>
        {isPaid && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
            <Crown className="w-3 h-3" /> {planLabel(sub.plan_type)}
          </span>
        )}
        {isTrialing && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
            <Crown className="w-3 h-3" /> {planLabel(sub.plan_type)}
          </span>
        )}
        {isLocalTrial && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
            <Gift className="w-3 h-3" /> {t("subscription.freeTrial")}
          </span>
        )}
      </div>

      {/* Active subscriber UI — applies to both paid (active/past_due) AND
          trialing users, because in our flow every trial requires a card on
          file via Stripe Checkout (so they ARE subscribers). */}
      {(isPaid || isTrialing) && (
        <>
          {isTrialing && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-emerald-700 mt-0.5 flex-none" />
                <div className="text-sm text-emerald-900">
                  <div className="font-semibold">
                    {t("subscription.planActivePro")}
                  </div>
                  <div className="text-emerald-800 text-xs mt-1">
                    {t("subscription.allProUnlocked")}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-50">
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                {t("subscription.statusLabel")}
              </div>
              <div className="text-sm font-semibold mt-1">
                {status === "trialing" ? t("subscription.active") :
                 status === "active" ? t("subscription.active") :
                 t("subscription.paymentPending")}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50">
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                {t("subscription.nextRenewal")}
              </div>
              <div className="text-sm font-semibold mt-1">
                {formatDate(sub.trial_ends_at || sub.current_period_end, lang)}
              </div>
            </div>
          </div>

          {sub.shipping_address && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
              <div className="font-semibold mb-1 flex items-center gap-1">
                {t("subscription.shippingTitle")}
              </div>
              <div>
                {sub.shipping_address.line1}
                {sub.shipping_address.line2 ? `, ${sub.shipping_address.line2}` : ""}
                <br />
                {sub.shipping_address.city}, {sub.shipping_address.state}{" "}
                {sub.shipping_address.postal_code}
                <br />
                {sub.shipping_address.country}
              </div>
              <div className="text-[11px] mt-2 italic opacity-80">
                {t("subscription.shippingNote")}
              </div>
            </div>
          )}

          <Button
            data-testid="open-portal"
            onClick={openPortal}
            disabled={portalLoading}
            variant="outline"
            className="w-full h-12 rounded-xl"
          >
            {portalLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <ExternalLink className="w-4 h-4 mr-2" />
            )}
            {t("subscription.manageSub")}
          </Button>
        </>
      )}

      {/* Local free trial (no card yet) — account is ACTIVE. Never prompt to
          "start a free trial" since it already started at signup. */}
      {isLocalTrial && (
        <>
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-emerald-700 mt-0.5 flex-none" />
              <div className="text-sm text-emerald-900">
                <div className="font-semibold">{t("subscription.accountActive")}</div>
                <div className="text-emerald-800 text-xs mt-1">
                  {t("subscription.youHave")}<strong>{t("subscription.allProFeatures")}</strong>
                  {trialDays !== null ? (
                    <>{t("subscription.trialRemainingMid")}<strong>{trialDays} {trialDays === 1 ? t("subscription.dayUnit") : t("subscription.daysUnit")}</strong>{t("subscription.trialRemainingEnd")}</>
                  ) : null}
                  {t("subscription.useNoLimits")}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-50">
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                {t("subscription.statusLabel")}
              </div>
              <div className="text-sm font-semibold mt-1 text-emerald-700">{t("subscription.active")}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50">
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                {t("subscription.trialEnds")}
              </div>
              <div className="text-sm font-semibold mt-1">
                {formatDate(sub.trial_ends_at, lang)}
              </div>
            </div>
          </div>

          <Button
            data-testid="goto-pricing-trial"
            onClick={() => navigate("/precios")}
            variant="outline"
            className="w-full h-12 rounded-xl"
          >
            {t("subscription.seePlans")}
          </Button>
        </>
      )}

      {/* Trial finished OR no plan at all — only here do we invite to subscribe. */}
      {!isPaid && !isTrialing && !isLocalTrial && (
        <>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
            {isLocalTrialExpired
              ? t("subscription.trialExpiredMsg")
              : t("subscription.noPlanMsg")}
          </div>
          <Button
            data-testid="goto-pricing-2"
            onClick={() => navigate("/precios")}
            className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            {t("subscription.seePlansSubscribe")}
          </Button>
        </>
      )}
    </Card>
  );
}
