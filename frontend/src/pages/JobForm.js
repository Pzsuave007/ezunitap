import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { JOB_STATUSES } from "@/components/StatusBadge";
import { ArrowLeft, Loader2, Briefcase } from "lucide-react";
import { toast } from "sonner";

// Standalone page for creating a job (replaces the old modal). No popups.
export default function JobForm() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const labelFor = (s) => t(`jobs.status.${s}`, { defaultValue: s });
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({ client_id: "", title: "", status: "new_lead", scheduled_date: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/clients").then(({ data }) => setClients(data)).catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault();
    if (!form.client_id || !form.title) return toast.error(t("jobs.missingClientTitle"));
    setSaving(true);
    try {
      await api.post("/jobs", form);
      toast.success(t("jobs.created"));
      navigate("/trabajos");
    } catch {
      toast.error(t("jobs.error"));
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5" data-testid="job-form-page">
      <button
        data-testid="job-form-back"
        onClick={() => navigate("/trabajos")}
        className="text-sm text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
      >
        <ArrowLeft className="w-4 h-4" /> {t("jobs.title")}
      </button>

      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center flex-none">
          <Briefcase className="w-5 h-5 text-emerald-700" />
        </div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">{t("jobs.newJob")}</h1>
      </div>

      <Card className="card-elevated border-0 shadow-none p-5 sm:p-6">
        <form onSubmit={save} className="space-y-4">
          <div>
            <Label>{t("jobs.client")} *</Label>
            <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
              <SelectTrigger className="h-12 rounded-xl mt-1.5" data-testid="job-client-select"><SelectValue placeholder={t("jobs.select")} /></SelectTrigger>
              <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            {clients.length === 0 && (
              <button type="button" onClick={() => navigate("/clientes/nuevo")} className="text-xs text-emerald-700 font-semibold mt-1.5 hover:underline">
                + {t("clients.newClient")}
              </button>
            )}
          </div>
          <div>
            <Label>{t("jobs.titleField")} *</Label>
            <Input data-testid="job-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-12 rounded-xl mt-1.5" required />
          </div>
          <div>
            <Label>{t("jobs.statusField")}</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger className="h-12 rounded-xl mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>{JOB_STATUSES.map((s) => <SelectItem key={s} value={s}>{labelFor(s)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("jobs.scheduledDate")}</Label>
            <Input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} className="h-12 rounded-xl mt-1.5" />
          </div>
          <div>
            <Label>{t("jobs.notes")}</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl mt-1.5 min-h-[100px]" />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => navigate("/trabajos")} className="rounded-xl h-12">
              {t("common.cancel")}
            </Button>
            <Button type="submit" data-testid="save-job" disabled={saving} className="rounded-xl h-12 px-6 bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("common.save")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
