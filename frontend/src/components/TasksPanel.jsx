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
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { ListChecks, Plus, Loader2, Trash2, CalendarDays, User, Clock, Briefcase, ChevronRight, Phone, MessageCircle, StickyNote, X } from "lucide-react";
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
  const [appointments, setAppointments] = useState([]);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [clientId, setClientId] = useState("");
  const [adding, setAdding] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [detailItem, setDetailItem] = useState(null);

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
    api.get("/appointments").then((r) => setAppointments(r.data?.appointments || [])).catch(() => {});
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

  // Today's agenda = today's appointments (from the appointments collection) +
  // scheduled jobs due today or overdue. Appointments are read directly so the
  // barber/contractor always sees today's bookings, and we exclude
  // source==="appointment" jobs to avoid showing the same booking twice.
  const today = todayISO();
  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const dayKind = (d) => (d < today ? "overdue" : d === today ? "today" : "tomorrow");

  const apptItems = appointments
    .filter((a) => a.status !== "cancelled" && (a.date === today || a.date === tomorrow))
    .map((a) => ({
      id: `appt-${a.id}`,
      kind: "appointment",
      title: `${t("tasks.appointment")}: ${a.name}`,
      date: a.date,
      start_time: a.start_time,
      end_time: a.end_time,
      all_day: false,
      day: dayKind(a.date),
      clientName: a.name,
      phone: a.phone || "",
      notes: a.notes || "",
    }));

  const jobItems = jobs
    .filter((j) => j.status !== "completed" && j.source !== "appointment" && j.scheduled_date && j.scheduled_date <= tomorrow)
    .map((j) => ({
      id: `job-${j.id}`,
      kind: "job",
      title: j.title,
      date: j.scheduled_date,
      start_time: j.start_time,
      end_time: j.end_time,
      all_day: j.all_day,
      day: dayKind(j.scheduled_date),
      clientName: clientName(j.client_id),
      phone: clients.find((c) => c.id === j.client_id)?.phone || "",
      notes: j.notes || "",
      status: j.status,
    }));

  const agenda = [...apptItems, ...jobItems].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return (a.start_time || "") < (b.start_time || "") ? -1 : 1;
  });

  const dayBadge = (day) => {
    if (day === "overdue") return { cls: "bg-red-50 text-red-700 border-red-200", label: t("tasks.overdue") };
    if (day === "tomorrow") return { cls: "bg-blue-50 text-blue-700 border-blue-200", label: t("tasks.tomorrow") };
    return { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: t("tasks.today") };
  };

  const openAgendaItem = (item) => {
    setDetailItem(item);
  };

  const longDate = (d) => {
    if (!d) return "";
    try {
      return new Date(d + "T00:00:00").toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
    } catch { return d; }
  };

  const timeLabel = (item) => {
    if (item.all_day || !item.start_time) return t("tasks.allDay");
    return item.end_time ? `${item.start_time}–${item.end_time}` : item.start_time;
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
          {agenda.map((item) => {
            const isAppt = item.kind === "appointment";
            const Icon = isAppt ? CalendarDays : Briefcase;
            const badge = dayBadge(item.day);
            return (
              <button
                key={item.id}
                data-testid={`agenda-item-${item.id}`}
                onClick={() => openAgendaItem(item)}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-left transition-colors"
              >
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-none ${isAppt ? "bg-violet-100 text-violet-600" : "bg-blue-100 text-blue-600"}`}>
                  <Icon className="w-4 h-4" strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-800 truncate">{item.title}</span>
                  <span className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.cls}`}>
                      <Clock className="w-3 h-3" /> {badge.label} · {timeLabel(item)}
                    </span>
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-300 flex-none" />
              </button>
            );
          })}
        </div>
      )}

      {/* Pending manual tasks — shown up top, next to the agenda */}
      {pending.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {pending.map((task) => (
            <TaskRow key={task.id} task={task} onToggle={toggle} onRemove={remove} dateMeta={dateMeta} clientName={clientName} />
          ))}
        </div>
      )}

      {/* Quick add */}
      <div className="space-y-2 mb-1">
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

      {/* Empty state — only when there are no manual tasks and no agenda */}
      {pending.length === 0 && agenda.length === 0 && (
        <p data-testid="tasks-empty" className="text-sm text-slate-400 text-center py-3">{t("tasks.empty")}</p>
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

      {/* Detail Drawer — slide up with only the selected item's details */}
      <Drawer open={!!detailItem} onOpenChange={(o) => { if (!o) setDetailItem(null); }}>
        <DrawerContent data-testid="agenda-detail-drawer" className="max-h-[85vh]">
          {detailItem && (() => {
            const isAppt = detailItem.kind === "appointment";
            const badge = dayBadge(detailItem.day);
            const digits = (detailItem.phone || "").replace(/\D/g, "");
            return (
              <div className="px-5 pb-8 pt-2 overflow-y-auto">
                <DrawerHeader className="px-0">
                  <div className="flex items-start gap-3">
                    <span className={`w-11 h-11 rounded-xl flex items-center justify-center flex-none ${isAppt ? "bg-violet-100 text-violet-600" : "bg-blue-100 text-blue-600"}`}>
                      {isAppt ? <CalendarDays className="w-5 h-5" /> : <Briefcase className="w-5 h-5" />}
                    </span>
                    <div className="min-w-0 flex-1 text-left">
                      <DrawerTitle className="text-lg leading-tight">{detailItem.title}</DrawerTitle>
                      <span className={`inline-flex items-center gap-1 mt-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full border ${badge.cls}`}>
                        <Clock className="w-3 h-3" /> {badge.label} · {timeLabel(detailItem)}
                      </span>
                    </div>
                    <DrawerClose className="flex-none text-slate-400 hover:text-slate-700 p-1" aria-label="cerrar"><X className="w-5 h-5" /></DrawerClose>
                  </div>
                </DrawerHeader>

                <div className="space-y-3 mt-1">
                  <DetailRow icon={<CalendarDays className="w-4 h-4" />} label={t("tasks.dueDate")} value={`${longDate(detailItem.date)} · ${timeLabel(detailItem)}`} />
                  {detailItem.clientName && (
                    <DetailRow icon={<User className="w-4 h-4" />} label={t("tasks.client")} value={detailItem.clientName} />
                  )}
                  {detailItem.notes && (
                    <DetailRow icon={<StickyNote className="w-4 h-4" />} label="Notas" value={detailItem.notes} />
                  )}
                </div>

                {/* Quick actions */}
                <div className="grid grid-cols-2 gap-2 mt-5">
                  {digits && (
                    <a href={`tel:${digits}`} data-testid="agenda-detail-call">
                      <Button variant="outline" className="w-full h-11 rounded-xl"><Phone className="w-4 h-4" /> {t("tasks.call")}</Button>
                    </a>
                  )}
                  {digits && (
                    <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" data-testid="agenda-detail-whatsapp">
                      <Button variant="outline" className="w-full h-11 rounded-xl text-emerald-700 border-emerald-200"><MessageCircle className="w-4 h-4" /> WhatsApp</Button>
                    </a>
                  )}
                </div>
                <Button
                  data-testid="agenda-detail-open"
                  onClick={() => { const dest = isAppt ? "/citas" : "/trabajos"; setDetailItem(null); navigate(dest); }}
                  className="w-full h-11 rounded-xl mt-2 bg-slate-900 hover:bg-slate-800"
                >
                  {isAppt ? t("tasks.openInAppointments") : t("tasks.openInJobs")} <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            );
          })()}
        </DrawerContent>
      </Drawer>
    </Card>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <div className="flex gap-3">
      <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-none">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
        <div className="text-sm text-slate-800 whitespace-pre-line break-words">{value}</div>
      </div>
    </div>
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
        className="flex-none text-slate-300 hover:text-red-500 transition-colors p-1"
        aria-label="delete"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
