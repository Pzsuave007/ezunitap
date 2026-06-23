/**
 * PaymentMethodsSection — Settings card where the owner configures the
 * payment links/usernames shown to clients on the public invoice page.
 *
 * 6 methods: Venmo, PayPal, Cash App, Zelle, Cash (text), Check (text).
 * The "value" field meaning depends on method:
 *   venmo   → @username   (we build venmo://paycharge?... and https://venmo.com/u/USER)
 *   paypal  → username    (https://paypal.me/USERNAME)
 *   cashapp → $cashtag    (https://cash.app/$CASHTAG)
 *   zelle   → email or phone (text shown to client, no deep link)
 *   cash    → optional note (e.g. "Acepto efectivo en mano")
 *   check   → payable-to text ("Pagable a: Uni2 Marketing Agency LLC")
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Wallet } from "lucide-react";
import { toast } from "sonner";

const METHODS = [
  { key: "venmo", label: "Venmo", color: "bg-sky-500" },
  { key: "paypal", label: "PayPal", color: "bg-blue-700" },
  { key: "cashapp", label: "Cash App", color: "bg-emerald-600" },
  { key: "zelle", label: "Zelle", color: "bg-violet-600" },
  { key: "cash", labelKey: "payments.cashLabel", color: "bg-slate-700", noteOnly: true },
  { key: "check", labelKey: "payments.checkLabel", color: "bg-amber-600", valueField: true },
];

const empty = () => Object.fromEntries(
  METHODS.map((m) => [m.key, { enabled: false, value: "", note: "" }])
);

export default function PaymentMethodsSection() {
  const { t } = useTranslation();
  const [methods, setMethods] = useState(empty());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/payment-methods")
      .then(({ data }) => {
        const filled = { ...empty(), ...(data.payment_methods || {}) };
        setMethods(filled);
      })
      .catch(() => toast.error(t("payments.loadError")))
      .finally(() => setLoading(false));
  }, [t]);

  const update = (k, patch) =>
    setMethods((m) => ({ ...m, [k]: { ...m[k], ...patch } }));

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/payment-methods", { payment_methods: methods });
      toast.success(t("payments.saved"));
    } catch {
      toast.error(t("payments.saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="card-elevated p-5 border-0 shadow-none flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </Card>
    );
  }

  return (
    <Card
      className="card-elevated p-5 border-0 shadow-none space-y-4"
      data-testid="payment-methods-section"
    >
      <div className="flex items-center gap-2 mb-1">
        <Wallet className="w-5 h-5 text-blue-900" />
        <h3 className="font-heading font-bold text-base">{t("payments.title")}</h3>
      </div>
      <p className="text-xs text-slate-500 -mt-2">
        {t("payments.subtitle")}
      </p>

      <div className="space-y-3">
        {METHODS.map((m) => {
          const entry = methods[m.key] || { enabled: false, value: "", note: "" };
          const label = m.labelKey ? t(m.labelKey) : m.label;
          const helper = t(`payments.${m.key}Helper`);
          const placeholder = m.key === "cash" ? "" : t(`payments.${m.key}Ph`);
          return (
            <div
              key={m.key}
              data-testid={`pm-${m.key}`}
              className={`rounded-xl border p-3 transition ${
                entry.enabled ? "bg-white border-slate-300" : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg ${m.color} text-white text-xs font-bold flex items-center justify-center flex-none`}>
                  {label.slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{helper}</div>
                </div>
                <Switch
                  data-testid={`pm-toggle-${m.key}`}
                  checked={entry.enabled}
                  onCheckedChange={(v) => update(m.key, { enabled: v })}
                />
              </div>
              {entry.enabled && !m.noteOnly && (
                <div className="mt-3">
                  <Input
                    data-testid={`pm-input-${m.key}`}
                    value={entry.value}
                    onChange={(e) => update(m.key, { value: e.target.value })}
                    placeholder={placeholder}
                    className="h-9 text-sm"
                  />
                </div>
              )}
              {entry.enabled && m.noteOnly && (
                <div className="mt-3">
                  <Input
                    data-testid={`pm-note-${m.key}`}
                    value={entry.note}
                    onChange={(e) => update(m.key, { note: e.target.value })}
                    placeholder={t("payments.noteOptional")}
                    className="h-9 text-sm"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button
        data-testid="pm-save"
        onClick={save}
        disabled={saving}
        className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
        {t("payments.save")}
      </Button>
    </Card>
  );
}
