import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hammer, Loader2, Gift } from "lucide-react";
import { toast } from "sonner";
import { fbTrack, fbTrackCustom } from "@/lib/fbpixel";
import api from "@/lib/api";
import LanguageToggle from "@/components/LanguageToggle";

export default function Register() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { register } = useAuth();
  const [params] = useSearchParams();
  const inviteToken = params.get("invite") || "";
  const selectedPlan = params.get("plan") || "";
  const planLabel = selectedPlan ? t(`auth.register.plans.${selectedPlan}`, { defaultValue: "" }) : "";
  const [form, setForm] = useState({
    business_name: "",
    owner_name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const onChange = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) {
      toast.error(t("auth.register.errorShortPassword"));
      return;
    }
    setLoading(true);
    try {
      await register({ ...form, invite_token: inviteToken || undefined });
      // Meta Pixel: account created (free 14-day trial, no card).
      fbTrack("CompleteRegistration", { content_name: selectedPlan || "trial", status: true });
      fbTrackCustom("StartTrial", { plan: selectedPlan || "" });
      toast.success(inviteToken ? t("auth.register.createdInvite") : t("auth.register.createdTrial"));
      const planParam = params.get("plan");
      if (planParam && !inviteToken) {
        // Go STRAIGHT to Stripe checkout from here (robust) instead of relying
        // on the Pricing page's auto-start effect, which raced and sometimes
        // dropped the user on the Dashboard without collecting a card.
        const billingParam = params.get("billing") === "year" ? "year" : "month";
        const planId =
          planParam.endsWith("_founder")
            ? planParam
            : `${planParam}_${billingParam === "year" ? "yearly" : "monthly"}`;
        try {
          const { data } = await api.post("/payments/checkout", {
            plan_id: planId,
            origin_url: window.location.origin,
            num_cards: 1,
          });
          window.location.assign(data.url);
          return;
        } catch (err) {
          // Founder sold out / transient error → let them finish on /precios.
          navigate(`/precios?plan=${planParam}&billing=${billingParam}`);
        }
      } else {
        navigate("/");
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || t("auth.register.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
        <div className="flex items-center justify-between gap-2 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center">
              <Hammer className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-heading font-bold text-xl">UniTech</span>
          </div>
          <LanguageToggle />
        </div>

        {inviteToken && (
          <div
            data-testid="invite-banner"
            className="mb-5 p-3 rounded-2xl bg-gradient-to-br from-amber-50 to-emerald-50 border border-amber-200 flex items-center gap-2"
          >
            <Gift className="w-5 h-5 text-amber-700 flex-none" />
            <div className="text-xs text-amber-900">
              <div className="font-semibold">{t("auth.register.inviteTitle")}</div>
              <div className="text-amber-800">{t("auth.register.inviteDesc")}</div>
            </div>
          </div>
        )}

        <h2 className="font-heading text-3xl font-bold tracking-tight">{t("auth.register.createAccount")}</h2>
        {selectedPlan && planLabel && (
          <div data-testid="plan-banner" className="mt-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
            <span className="font-semibold">{t("auth.register.planChosen", { plan: planLabel })}</span> {t("auth.register.planContinue")}
          </div>
        )}
        {!inviteToken && (
          <div
            data-testid="trial-badge"
            className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold"
          >
            <Gift className="w-3.5 h-3.5" /> {t("auth.register.trialBadge")}
          </div>
        )}
        <p className="text-slate-500 mt-2 text-sm">{t("auth.register.trialSubtitle")}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <div>
            <Label>{t("auth.register.businessName")}</Label>
            <Input
              data-testid="reg-business"
              required
              value={form.business_name}
              onChange={onChange("business_name")}
              className="h-12 rounded-xl mt-1.5"
              placeholder="Ej: Juan's Roofing LLC"
            />
          </div>
          <div>
            <Label>{t("auth.register.yourName")}</Label>
            <Input
              data-testid="reg-owner"
              value={form.owner_name}
              onChange={onChange("owner_name")}
              className="h-12 rounded-xl mt-1.5"
              placeholder="Juan Pérez"
            />
          </div>
          <div>
            <Label>{t("auth.register.email")}</Label>
            <Input
              data-testid="reg-email"
              type="email"
              required
              value={form.email}
              onChange={onChange("email")}
              className="h-12 rounded-xl mt-1.5"
              placeholder="tu@email.com"
            />
          </div>
          <div>
            <Label>{t("auth.register.phone")}</Label>
            <Input
              data-testid="reg-phone"
              value={form.phone}
              onChange={onChange("phone")}
              className="h-12 rounded-xl mt-1.5"
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <Label>{t("auth.register.password")}</Label>
            <Input
              data-testid="reg-password"
              type="password"
              required
              value={form.password}
              onChange={onChange("password")}
              className="h-12 rounded-xl mt-1.5"
              placeholder={t("auth.register.passwordPlaceholder")}
            />
          </div>
          <Button
            type="submit"
            data-testid="reg-submit"
            disabled={loading}
            className="w-full h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base mt-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t("auth.register.submit")}
          </Button>
          <p className="text-[11px] text-slate-500 text-center mt-1">
            {t("auth.register.terms")}{" "}
            <Link to="/terminos" className="underline hover:text-slate-700">{t("auth.register.termsLink")}</Link>
            {" "}{t("auth.register.and")}{" "}
            <Link to="/privacidad" className="underline hover:text-slate-700">{t("auth.register.privacyLink")}</Link>.
          </p>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          {t("auth.register.haveAccount")}{" "}
          <Link to="/login" data-testid="link-login" className="font-semibold text-blue-900 hover:underline">
            {t("auth.register.signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
