import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

const EMPTY = { name: "", company: "", phone: "", email: "", address: "", job_type: "", notes: "" };

// Standalone page for creating a client (replaces the old modal that could
// overflow small laptop screens and hide the Save button). No popups.
export default function ClientForm() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error(t("clients.nameRequired"));
    setSaving(true);
    try {
      const { data } = await api.post("/clients", form);
      toast.success(t("clients.added"));
      navigate(data?.id ? `/clientes/${data.id}` : "/clientes");
    } catch (err) {
      toast.error(err?.response?.data?.detail || t("clients.error"));
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5" data-testid="client-form-page">
      <button
        data-testid="client-form-back"
        onClick={() => navigate("/clientes")}
        className="text-sm text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
      >
        <ArrowLeft className="w-4 h-4" /> {t("clients.title")}
      </button>

      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center flex-none">
          <UserPlus className="w-5 h-5 text-emerald-700" />
        </div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">{t("clients.newClient")}</h1>
      </div>

      <Card className="card-elevated border-0 shadow-none p-5 sm:p-6">
        <form onSubmit={save} className="space-y-4">
          <div>
            <Label>{t("clients.name")} *</Label>
            <Input data-testid="cli-name" value={form.name} onChange={set("name")} className="h-12 rounded-xl mt-1.5" required />
          </div>
          <div>
            <Label>{t("clients.company")}</Label>
            <Input data-testid="cli-company" value={form.company} onChange={set("company")} className="h-12 rounded-xl mt-1.5" placeholder={t("clients.companyPlaceholder")} />
            <p className="text-[11px] text-slate-500 mt-1">{t("clients.companyHint")}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>{t("clients.phone")}</Label>
              <Input data-testid="cli-phone" value={form.phone} onChange={set("phone")} className="h-12 rounded-xl mt-1.5" />
            </div>
            <div>
              <Label>{t("clients.email")}</Label>
              <Input data-testid="cli-email" type="email" value={form.email} onChange={set("email")} className="h-12 rounded-xl mt-1.5" />
            </div>
          </div>
          <div>
            <Label>{t("clients.address")}</Label>
            <Input data-testid="cli-address" value={form.address} onChange={set("address")} className="h-12 rounded-xl mt-1.5" />
          </div>
          <div>
            <Label>{t("clients.jobType")}</Label>
            <Input data-testid="cli-jobtype" value={form.job_type} onChange={set("job_type")} className="h-12 rounded-xl mt-1.5" placeholder={t("clients.jobTypePlaceholder")} />
          </div>
          <div>
            <Label>{t("clients.notes")}</Label>
            <Textarea data-testid="cli-notes" value={form.notes} onChange={set("notes")} className="rounded-xl mt-1.5 min-h-[100px]" />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => navigate("/clientes")} className="rounded-xl h-12">
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              data-testid="cli-save"
              disabled={saving}
              className="rounded-xl h-12 px-6 bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("common.save")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
