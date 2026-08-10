/**
 * CalendarJobForm — standalone page to create/edit a calendar job/event.
 * Replaces the old JobEditor modal (no popups). Routes:
 *   /calendario/nuevo?date=YYYY-MM-DD   and   /calendario/:id/editar
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Loader2, CalendarDays } from "lucide-react";
import { toast } from "sonner";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DOW_REF = {
  mon: new Date(2024, 0, 1), tue: new Date(2024, 0, 2), wed: new Date(2024, 0, 3),
  thu: new Date(2024, 0, 4), fri: new Date(2024, 0, 5), sat: new Date(2024, 0, 6), sun: new Date(2024, 0, 7),
};
const STATUS_KEYS = ["new_lead", "estimate_sent", "approved", "scheduled", "in_progress", "waiting_payment", "completed"];
const LOCALE = () => (i18n.language && i18n.language.startsWith("es") ? "es-ES" : "en-US");
const dayShort = (key) => DOW_REF[key].toLocaleDateString(LOCALE(), { weekday: "short" });
const jobStatusLabel = (s) => i18n.t(`jobs.status.${s}`, { defaultValue: s });
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const EMPTY_FORM = {
  client_id: "", title: "", status: "scheduled",
  scheduled_date: todayISO(), end_date: "", start_time: "", end_time: "",
  all_day: false, address: "", notes: "",
  recurrence: "none", recurrence_days: [], recurrence_end_date: "",
};

export default function CalendarJobForm() {
  const navigate = useNavigate();
  const { id: jobId } = useParams();
  const [searchParams] = useSearchParams();
  const defaultDate = searchParams.get("date") || todayISO();
  const { t } = useTranslation();
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({ ...EMPTY_FORM, scheduled_date: defaultDate });
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState("single");

  useEffect(() => {
    api.get("/clients").then(({ data }) => setClients(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!jobId) return;
    api.get(`/jobs/${jobId}`).then(({ data }) => {
      setForm({
        ...EMPTY_FORM,
        ...data,
        recurrence_days: data.recurrence_days || [],
        end_date: data.end_date || "",
        start_time: data.start_time || "",
        end_time: data.end_time || "",
        address: data.address || "",
      });
      if (data.recurrence && data.recurrence !== "none") setMode("recurring");
      else if (data.end_date && data.end_date !== data.scheduled_date) setMode("project");
      else setMode("single");
    });
  }, [jobId]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleDay = (d) => {
    const has = form.recurrence_days.includes(d);
    update("recurrence_days", has ? form.recurrence_days.filter((x) => x !== d) : [...form.recurrence_days, d]);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.client_id || !form.title) return toast.error(t("calendar.missingClientTitle"));
    setSaving(true);
    const payload = { ...form };

    if (mode === "single") {
      payload.recurrence = "none";
      payload.recurrence_days = [];
      payload.recurrence_end_date = null;
      payload.end_date = "";
    } else if (mode === "project") {
      payload.recurrence = "none";
      payload.recurrence_days = [];
      payload.recurrence_end_date = null;
    } else if (mode === "recurring") {
      payload.end_date = "";
      if ((payload.recurrence === "weekly" || payload.recurrence === "biweekly") && payload.recurrence_days.length === 0) {
        setSaving(false);
        return toast.error(t("calendar.selectDay"));
      }
      if (!payload.recurrence_end_date) {
        setSaving(false);
        return toast.error(t("calendar.setRecEnd"));
      }
    }

    try {
      if (jobId) await api.put(`/jobs/${jobId}`, payload);
      else await api.post("/jobs", payload);
      toast.success(jobId ? t("calendar.updated") : t("calendar.created"));
      navigate("/calendario");
    } catch (err) {
      toast.error(err?.response?.data?.detail || t("calendar.error"));
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5" data-testid="calendar-job-form-page">
      <button
        data-testid="calendar-job-back"
        onClick={() => navigate("/calendario")}
        className="text-sm text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
      >
        <ArrowLeft className="w-4 h-4" /> {t("calendar.title")}
      </button>

      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center flex-none">
          <CalendarDays className="w-5 h-5 text-emerald-700" />
        </div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">{jobId ? t("calendar.editJob") : t("calendar.newJob")}</h1>
      </div>

      <Card className="card-elevated border-0 shadow-none p-5 sm:p-6">
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { k: "single", label: t("calendar.once") },
              { k: "project", label: t("calendar.project") },
              { k: "recurring", label: t("calendar.recurring") },
            ].map((m) => (
              <button
                key={m.k}
                type="button"
                data-testid={`mode-${m.k}`}
                onClick={() => {
                  setMode(m.k);
                  if (m.k === "recurring" && (!form.recurrence || form.recurrence === "none")) update("recurrence", "weekly");
                }}
                className={`py-2 text-xs font-bold rounded-lg tap ${mode === m.k ? "bg-white text-blue-900 shadow-sm" : "text-slate-500"}`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div>
            <Label>{t("calendar.client")} *</Label>
            <Select value={form.client_id} onValueChange={(v) => update("client_id", v)}>
              <SelectTrigger className="h-12 rounded-xl mt-1.5" data-testid="editor-client"><SelectValue placeholder={t("calendar.selectClient")} /></SelectTrigger>
              <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            {clients.length === 0 && (
              <button type="button" onClick={() => navigate("/clientes/nuevo")} className="text-xs text-emerald-700 font-semibold mt-1.5 hover:underline">
                + {t("clients.newClient")}
              </button>
            )}
          </div>

          <div>
            <Label>{t("calendar.titleField")} *</Label>
            <Input data-testid="editor-title" value={form.title} onChange={(e) => update("title", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder={t("calendar.titlePlaceholder")} />
          </div>

          {mode === "single" && (
            <div>
              <Label>{t("calendar.date")}</Label>
              <Input type="date" data-testid="editor-date" value={form.scheduled_date} onChange={(e) => update("scheduled_date", e.target.value)} className="h-12 rounded-xl mt-1.5" />
            </div>
          )}

          {mode === "project" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{t("calendar.starts")}</Label>
                <Input type="date" data-testid="editor-start" value={form.scheduled_date} onChange={(e) => update("scheduled_date", e.target.value)} className="h-12 rounded-xl mt-1.5" />
              </div>
              <div>
                <Label>{t("calendar.ends")}</Label>
                <Input type="date" data-testid="editor-end" value={form.end_date} onChange={(e) => update("end_date", e.target.value)} className="h-12 rounded-xl mt-1.5" />
              </div>
            </div>
          )}

          {mode === "recurring" && (
            <>
              <div>
                <Label>{t("calendar.frequency")}</Label>
                <Select value={form.recurrence === "none" ? "weekly" : form.recurrence} onValueChange={(v) => update("recurrence", v)}>
                  <SelectTrigger className="h-12 rounded-xl mt-1.5" data-testid="editor-recurrence"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">{t("calendar.weekly")}</SelectItem>
                    <SelectItem value="biweekly">{t("calendar.biweeklyLong")}</SelectItem>
                    <SelectItem value="monthly">{t("calendar.monthly")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(form.recurrence === "weekly" || form.recurrence === "biweekly") && (
                <div>
                  <Label>{t("calendar.weekdays")}</Label>
                  <div className="grid grid-cols-7 gap-1 mt-1.5">
                    {DAY_KEYS.map((d) => {
                      const active = form.recurrence_days.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          data-testid={`day-${d}`}
                          onClick={() => toggleDay(d)}
                          className={`h-11 rounded-xl text-xs font-bold tap transition-all capitalize ${active ? "bg-blue-900 text-white" : "bg-slate-100 text-slate-500"}`}
                        >
                          {dayShort(d)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>{t("calendar.starts")}</Label>
                  <Input type="date" value={form.scheduled_date} onChange={(e) => update("scheduled_date", e.target.value)} className="h-12 rounded-xl mt-1.5" />
                </div>
                <div>
                  <Label>{t("calendar.ends")}</Label>
                  <Input type="date" data-testid="editor-rec-end" value={form.recurrence_end_date || ""} onChange={(e) => update("recurrence_end_date", e.target.value)} className="h-12 rounded-xl mt-1.5" />
                </div>
              </div>
            </>
          )}

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
            <Label className="text-sm">{t("calendar.allDay")}</Label>
            <Switch data-testid="editor-allday" checked={form.all_day} onCheckedChange={(v) => update("all_day", v)} />
          </div>
          {!form.all_day && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{t("calendar.startTime")}</Label>
                <Input type="time" data-testid="editor-start-time" value={form.start_time} onChange={(e) => update("start_time", e.target.value)} className="h-12 rounded-xl mt-1.5" />
              </div>
              <div>
                <Label>{t("calendar.endTime")}</Label>
                <Input type="time" value={form.end_time} onChange={(e) => update("end_time", e.target.value)} className="h-12 rounded-xl mt-1.5" />
              </div>
            </div>
          )}

          <div>
            <Label>{t("calendar.jobAddress")}</Label>
            <Input value={form.address} onChange={(e) => update("address", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder={t("calendar.addressPlaceholder")} />
          </div>

          <div>
            <Label>{t("calendar.status")}</Label>
            <Select value={form.status} onValueChange={(v) => update("status", v)}>
              <SelectTrigger className="h-12 rounded-xl mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_KEYS.map((k) => <SelectItem key={k} value={k}>{jobStatusLabel(k)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t("calendar.notes")}</Label>
            <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} className="rounded-xl mt-1.5" placeholder={t("calendar.notesPlaceholder")} />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => navigate("/calendario")} className="rounded-xl h-12">
              {t("common.cancel")}
            </Button>
            <Button type="submit" data-testid="editor-save" disabled={saving} className="rounded-xl h-12 px-6 bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("common.save")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
