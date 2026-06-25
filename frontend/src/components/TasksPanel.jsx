/**
 * TasksPanel — lightweight personal to-do list.
 *
 * Quick-add a task (title), optionally with a due date and a linked client,
 * check it off, or delete it. Pending tasks are sorted with overdue/today
 * first; completed tasks collapse into a "show completed" section.
 *
 * Used on the Dashboard (top) and the Jobs page (top). Self-contained: it
 * loads /tasks and /clients on its own.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListChecks, Plus, Loader2, Trash2, CalendarDays, User, Clock, Briefcase, ChevronRight } from "lucide-react";
import { toast } from "sonner";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TasksPanel({ className = "" }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = i18n.language?.startsWith("es") ? "es-ES" : "en-US";
  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [clientId, setClientId] = useState("");
  const [adding, setAdding] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/tasks");
      setTasks(data || []);
    } catch { /* noop */ }
  };

  useEffect(() => {
    load();
    api.get("/clients").then((r) => setClients(r.data || [])).catch(() => {});
    api.get("/jobs").then((r) => setJobs(r.data || [])).catch(() => {});
  }, []);

  const add = async () => {
    const tt = title.trim();
    if (!tt) return;
    setAdding(true);
    try {
      await api.post("/tasks", {
        title: tt,
        due_date: dueDate || null,
        client_id: clientId || null,
      });
      setTitle("");
      setDueDate("");
      setClientId("");
      await load();
    } catch {
      toast.error(t("tasks.errorSaving"));
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (task) => {
    // Optimistic update.
    setTasks((prev) => prev.map((x) => (x.id === task.id ? { ...x, done: !x.done } : x)));
    try {
      await api.put(`/tasks/${task.id}`, {
        title: task.title,
        due_date: task.due_date || null,
        client_id: task.client_id || null,
        done: !task.done,
      });
      load();
    } catch {
      toast.error(t("tasks.errorSaving"));
      load();
    }
  };

  const remove = async (task) => {
    setTasks((prev) => prev.filter((x) => x.id !== task.id));
    try {
      await api.delete(`/tasks/${task.id}`);
    } catch {
      toast.error(t("tasks.errorDeleting"));
      load();
    }
  };

  const clientName = (id) => clients.find((c) => c.id === id)?.name || "";

  const pending = tasks.filter((x) => !x.done);
  const done = tasks.filter((x) => x.done);

  // Today's agenda = scheduled jobs/appointments due today or overdue (not done).
  const today = todayISO();
  const agenda = jobs
    .filter((j) => {
      if (j.status === "completed") return false;
      const start = j.scheduled_date;
      if (!start) return false;
      return start <= today; // today, ongoing, or overdue
    })
    .sort((a, b) => {
      const da = a.scheduled_date || "";
      const db = b.scheduled_date || "";
      if (da !== db) return da < db ? -1 : 1;
      return (a.start_time || "") < (b.start_time || "") ? -1 : 1;
    });

  const openAgendaItem = (j) => {
    navigate(j.source === "appointment" ? "/citas" : "/trabajos");
  };

  const timeLabel = (j) => {
    if (j.all_day || !j.start_time) return t("tasks.allDay");
    return j.end_time ? `${j.start_time}–${j.end_time}` : j.start_time;
  };

  const dateMeta = (d) => {
    if (!d) return null;
    const today = todayISO();
    if (d < today) return { kind: "overdue", cls: "bg-red-50 text-red-700 border-red-200", label: t("tasks.overdue") };
    if (d === today) return { kind: "today", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: t("tasks.today") };
    let nice;
    try {
      nice = new Date(d + "T00:00:00").toLocaleDateString(locale, { day: "numeric", month: "short" });
    } catch { nice = d; }
    return { kind: "future", cls: "bg-slate-50 text-slate-600 border-slate-200", label: nice };
  };

  return (
    <Card data-testid="tasks-panel" className={`card-elevated border-0 shadow-none p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center flex-none">
          <ListChecks className="w-4.5 h-4.5" strokeWidth={2.4} />
        </span>
        <h2 className="font-heading font-bold text-slate-900">{t("tasks.title")}</h2>
        {pending.length > 0 && (
          <span data-testid="tasks-pending-count" className="ml-auto text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
            {t("tasks.pendingCount", { count: pending.length })}
          </span>
        )}
      </div>

      {/* Today's agenda — scheduled jobs & card appointments */}
      {agenda.length > 0 && (
        <div className="mb-3 space-y-1.5" data-testid="tasks-agenda">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">{t("tasks.todayAgenda")}</div>
          {agenda.map((j) => {
            const overdue = (j.scheduled_date || "") < today;
            const isAppt = j.source === "appointment";
            const Icon = isAppt ? CalendarDays : Briefcase;
            return (
              <button
                key={j.id}
                data-testid={`agenda-item-${j.id}`}
                onClick={() => openAgendaItem(j)}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-left transition-colors"
              >
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-none ${isAppt ? "bg-violet-100 text-violet-600" : "bg-blue-100 text-blue-600"}`}>
                  <Icon className="w-4 h-4" strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-800 truncate">{j.title}</span>
                  <span className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${overdue ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                      <Clock className="w-3 h-3" /> {overdue ? t("tasks.overdue") : t("tasks.today")} · {timeLabel(j)}
                    </span>
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-300 flex-none" />
              </button>
            );
          })}
        </div>
      )}

      {/* Quick add */}
      <div className="space-y-2 mb-3">
        <div className="flex gap-2">
          <Input
            data-testid="task-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            placeholder={t("tasks.addPlaceholder")}
            className="h-11 rounded-xl"
          />
          <button
            data-testid="task-add-btn"
            onClick={add}
            disabled={adding || !title.trim()}
            aria-label={t("tasks.add")}
            className="flex-none w-11 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center transition-colors disabled:opacity-40"
          >
            {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
          </button>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <CalendarDays className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              data-testid="task-date-input"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-10 rounded-xl pl-9 text-sm text-slate-600"
            />
          </div>
          {clients.length > 0 && (
            <Select value={clientId || "none"} onValueChange={(v) => setClientId(v === "none" ? "" : v)}>
              <SelectTrigger data-testid="task-client-select" className="h-10 rounded-xl text-sm flex-1">
                <SelectValue placeholder={t("tasks.clientOptional")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("tasks.noClient")}</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Pending list */}
      {pending.length === 0 ? (
        <p data-testid="tasks-empty" className="text-sm text-slate-400 text-center py-4">{t("tasks.empty")}</p>
      ) : (
        <div className="space-y-1.5">
          {pending.map((task) => (
            <TaskRow key={task.id} task={task} onToggle={toggle} onRemove={remove} dateMeta={dateMeta} clientName={clientName} />
          ))}
        </div>
      )}

      {/* Completed (collapsible) */}
      {done.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <button
            data-testid="tasks-toggle-completed"
            onClick={() => setShowDone((s) => !s)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
          >
            {showDone ? t("tasks.hideCompleted") : t("tasks.showCompleted", { count: done.length })}
          </button>
          {showDone && (
            <div className="space-y-1.5 mt-2">
              {done.map((task) => (
                <TaskRow key={task.id} task={task} onToggle={toggle} onRemove={remove} dateMeta={dateMeta} clientName={clientName} />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function TaskRow({ task, onToggle, onRemove, dateMeta, clientName }) {
  const meta = dateMeta(task.due_date);
  const cName = clientName(task.client_id);
  return (
    <div
      data-testid={`task-row-${task.id}`}
      className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
    >
      <button
        data-testid={`task-check-${task.id}`}
        onClick={() => onToggle(task)}
        aria-label="toggle"
        className={`mt-0.5 w-5 h-5 rounded-md border-2 flex-none flex items-center justify-center transition-colors ${
          task.done ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-300 hover:border-emerald-500"
        }`}
      >
        {task.done && (
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M16.7 5.3a1 1 0 010 1.4l-7 7a1 1 0 01-1.4 0l-3-3a1 1 0 111.4-1.4l2.3 2.3 6.3-6.3a1 1 0 011.4 0z"/></svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className={`text-sm leading-snug ${task.done ? "line-through text-slate-400" : "text-slate-800"}`}>{task.title}</div>
        {(meta || cName) && (
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {meta && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.cls}`}>
                <CalendarDays className="w-3 h-3" /> {meta.label}
              </span>
            )}
            {cName && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                <User className="w-3 h-3" /> {cName}
              </span>
            )}
          </div>
        )}
      </div>
      <button
        data-testid={`task-delete-${task.id}`}
        onClick={() => onRemove(task)}
        className="flex-none text-slate-300 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100"
        aria-label="delete"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
