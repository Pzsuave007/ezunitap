/**
 * Calendar — Mes / Semana / Día / Lista views for jobs.
 * Mobile-first. Reads from /api/calendar/events which expands recurrences.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, Loader2, Clock, MapPin,
  Phone, MessageCircle, Repeat, Briefcase, ListChecks, Pencil, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import TourButton from "@/components/TourButton";

const VIEWS = [
  { key: "day", label: "Hoy" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "list", label: "Lista" },
];

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS_ES = { mon: "Lu", tue: "Ma", wed: "Mi", thu: "Ju", fri: "Vi", sat: "Sá", sun: "Do" };
const WEEKDAYS_LONG_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS_ES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const STATUS_COLORS = {
  new_lead: { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  estimate_sent: { bg: "#DBEAFE", text: "#1E40AF", dot: "#3B82F6" },
  approved: { bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
  scheduled: { bg: "#E0E7FF", text: "#3730A3", dot: "#6366F1" },
  in_progress: { bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },
  waiting_payment: { bg: "#FFEDD5", text: "#9A3412", dot: "#F97316" },
  completed: { bg: "#F1F5F9", text: "#475569", dot: "#94A3B8" },
};

const STATUS_LABEL = {
  new_lead: "Nuevo Lead", estimate_sent: "Quote enviado", approved: "Aprobado",
  scheduled: "Agendado", in_progress: "En progreso", waiting_payment: "Esperando pago",
  completed: "Completado",
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const addDays = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

const startOfMonth = (iso) => {
  const [y, m] = iso.split("-").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-01`;
};

const endOfMonth = (iso) => {
  const [y, m] = iso.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
};

const startOfWeek = (iso) => {
  // Monday-anchored week
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const w = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - w);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

const fmtMonthYear = (iso) => {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS_ES[m - 1]} ${y}`;
};

const fmtLongDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${WEEKDAYS_LONG_ES[dt.getDay()]} ${d} de ${MONTHS_ES[m - 1]}`;
};

const fmtTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
};

export default function Calendar() {
  const navigate = useNavigate();
  const [view, setView] = useState("day");
  const [anchor, setAnchor] = useState(todayISO());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState(null); // { event, job }
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState(null);

  // Range based on view
  const range = useMemo(() => {
    if (view === "day") return { start: anchor, end: anchor };
    if (view === "week") {
      const s = startOfWeek(anchor);
      return { start: s, end: addDays(s, 6) };
    }
    if (view === "month") {
      // Include leading/trailing days from adjacent months so the grid covers full weeks
      const s = startOfMonth(anchor);
      const e = endOfMonth(anchor);
      return { start: addDays(startOfWeek(s), 0), end: addDays(startOfWeek(addDays(e, 7)), -1) };
    }
    return { start: anchor, end: addDays(anchor, 60) };
  }, [view, anchor]);

  const load = async () => {
    setLoading(true);
    try {
      const [evRes, cRes] = await Promise.all([
        api.get(`/calendar/events?start=${range.start}&end=${range.end}`),
        clients.length === 0 ? api.get("/clients") : Promise.resolve({ data: clients }),
      ]);
      setEvents(evRes.data.events || []);
      if (clients.length === 0) setClients(cRes.data);
    } catch (err) {
      toast.error("Error cargando calendario");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [range.start, range.end]);

  const eventsByDate = useMemo(() => {
    const map = {};
    for (const e of events) {
      (map[e.date] = map[e.date] || []).push(e);
    }
    return map;
  }, [events]);

  const todayCount = (eventsByDate[todayISO()] || []).length;

  const navPrev = () => {
    if (view === "day") setAnchor(addDays(anchor, -1));
    else if (view === "week") setAnchor(addDays(anchor, -7));
    else if (view === "month") {
      const [y, m] = anchor.split("-").map(Number);
      const ny = m === 1 ? y - 1 : y;
      const nm = m === 1 ? 12 : m - 1;
      setAnchor(`${ny}-${String(nm).padStart(2, "0")}-01`);
    }
  };
  const navNext = () => {
    if (view === "day") setAnchor(addDays(anchor, 1));
    else if (view === "week") setAnchor(addDays(anchor, 7));
    else if (view === "month") {
      const [y, m] = anchor.split("-").map(Number);
      const ny = m === 12 ? y + 1 : y;
      const nm = m === 12 ? 1 : m + 1;
      setAnchor(`${ny}-${String(nm).padStart(2, "0")}-01`);
    }
  };

  const headerTitle = () => {
    if (view === "day") return fmtLongDate(anchor);
    if (view === "week") {
      const s = startOfWeek(anchor);
      const e = addDays(s, 6);
      return `${s.slice(8)} – ${e.slice(8)} ${MONTHS_ES[Number(s.split("-")[1]) - 1]}`;
    }
    if (view === "month") return fmtMonthYear(anchor);
    return "Próximos";
  };

  const openEvent = async (ev) => {
    try {
      const { data } = await api.get(`/jobs/${ev.job_id}`);
      setSelected({ event: ev, job: data });
    } catch {
      toast.error("Error cargando trabajo");
    }
  };

  const closeEvent = () => setSelected(null);

  const startNew = (date = null) => {
    setEditingJobId(null);
    if (date) setAnchor(date);
    setEditorOpen(true);
  };

  const startEdit = (jobId) => {
    setEditingJobId(jobId);
    setEditorOpen(true);
    setSelected(null);
  };

  const deleteJob = async (jobId) => {
    if (!window.confirm("¿Eliminar este trabajo? Si es recurrente, se eliminarán todas las visitas.")) return;
    await api.delete(`/jobs/${jobId}`);
    toast.success("Trabajo eliminado");
    closeEvent();
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-emerald-600" /> Calendario
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            {todayCount > 0 ? (
              <span className="font-semibold text-blue-900">{todayCount} trabajo{todayCount !== 1 ? "s" : ""} hoy</span>
            ) : (
              <span>Sin trabajos hoy</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TourButton tourKey="calendar" />
          <Button data-testid="new-event-btn" onClick={() => startNew()} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 h-11 px-4">
            <Plus className="w-4 h-4 mr-1" /> Nuevo
          </Button>
        </div>
      </div>

      {/* View switcher */}
      <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-xl">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            data-testid={`view-${v.key}`}
            onClick={() => { setView(v.key); if (v.key !== "list") setAnchor(todayISO()); }}
            className={`py-2 text-xs font-bold rounded-lg tap transition-colors ${
              view === v.key ? "bg-white text-blue-900 shadow-sm" : "text-slate-500"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Date nav strip */}
      {view !== "list" && (
        <div className="flex items-center justify-between gap-2">
          <button onClick={navPrev} data-testid="cal-prev" className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center tap">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <button
            onClick={() => setAnchor(todayISO())}
            data-testid="cal-today"
            className="flex-1 h-10 rounded-xl bg-white border border-slate-200 font-semibold text-sm text-slate-800 tap"
          >
            {headerTitle()}
            <span className="ml-2 text-[10px] text-slate-400">• Hoy</span>
          </button>
          <button onClick={navNext} data-testid="cal-next" className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center tap">
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-slate-300 mx-auto" /></div>
      ) : view === "day" ? (
        <DayView events={eventsByDate[anchor] || []} onOpen={openEvent} onCreate={() => startNew(anchor)} />
      ) : view === "week" ? (
        <WeekView start={startOfWeek(anchor)} eventsByDate={eventsByDate} onOpen={openEvent} onPickDay={(d) => { setAnchor(d); setView("day"); }} />
      ) : view === "month" ? (
        <MonthView anchor={anchor} rangeStart={range.start} rangeEnd={range.end} eventsByDate={eventsByDate} onPickDay={(d) => { setAnchor(d); setView("day"); }} />
      ) : (
        <ListView events={events} onOpen={openEvent} />
      )}

      {/* Event detail bottom sheet */}
      <Sheet open={!!selected} onOpenChange={(v) => !v && closeEvent()}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto p-0">
          {selected && (
            <EventDetail
              event={selected.event}
              job={selected.job}
              onEdit={() => startEdit(selected.job.id)}
              onDelete={() => deleteJob(selected.job.id)}
              onClose={closeEvent}
            />
          )}
        </SheetContent>
      </Sheet>

      <JobEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        jobId={editingJobId}
        defaultDate={anchor}
        clients={clients}
        onSaved={() => { setEditorOpen(false); load(); }}
      />
    </div>
  );
}

// ============================================================================
// VIEWS
// ============================================================================
function DayView({ events, onOpen, onCreate }) {
  if (events.length === 0) {
    return (
      <Card className="card-elevated p-10 text-center border-0 shadow-none">
        <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-slate-500 mb-4">No tienes trabajos este día.</p>
        <Button onClick={onCreate} data-testid="day-empty-create" className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-1" /> Agendar trabajo
        </Button>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {events.map((e, i) => (
        <EventCard key={`${e.job_id}-${e.date}-${i}`} event={e} onClick={() => onOpen(e)} />
      ))}
    </div>
  );
}

function WeekView({ start, eventsByDate, onOpen, onPickDay }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="space-y-3">
      {days.map((d) => {
        const list = eventsByDate[d] || [];
        const isToday = d === todayISO();
        const [_y, _m, dd] = d.split("-").map(Number);
        const dt = new Date(_y, _m - 1, dd);
        return (
          <div key={d} data-testid={`week-day-${d}`}>
            <button
              onClick={() => onPickDay(d)}
              className={`flex items-baseline gap-2 mb-1.5 tap ${isToday ? "text-blue-900" : "text-slate-700"}`}
            >
              <span className="font-heading font-bold text-base">{dd}</span>
              <span className="text-xs uppercase tracking-wider font-bold">
                {WEEKDAYS_LONG_ES[dt.getDay()].slice(0, 3)}
              </span>
              {isToday && <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-900 text-white px-2 py-0.5 rounded-full">Hoy</span>}
              <span className="text-xs text-slate-400 ml-1">{list.length > 0 ? `${list.length} trabajo${list.length !== 1 ? "s" : ""}` : "—"}</span>
            </button>
            {list.length > 0 && (
              <div className="space-y-1.5 pl-1">
                {list.map((e, i) => <EventCard key={`${e.job_id}-${i}`} event={e} compact onClick={() => onOpen(e)} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MonthView({ anchor, rangeStart, rangeEnd, eventsByDate, onPickDay }) {
  const days = [];
  let d = rangeStart;
  while (d <= rangeEnd) { days.push(d); d = addDays(d, 1); }
  const [anchorY, anchorM] = anchor.split("-").map(Number);
  const today = todayISO();
  return (
    <Card className="card-elevated p-3 border-0 shadow-none">
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_KEYS.map((k) => (
          <div key={k} className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 py-1">
            {DAY_LABELS_ES[k]}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const [y, m, day] = d.split("-").map(Number);
          const inMonth = y === anchorY && m === anchorM;
          const isToday = d === today;
          const list = eventsByDate[d] || [];
          return (
            <button
              key={d}
              data-testid={`month-cell-${d}`}
              onClick={() => onPickDay(d)}
              className={`aspect-square rounded-xl p-1 flex flex-col items-center justify-start gap-0.5 tap transition-all
                ${inMonth ? "bg-white border border-slate-100" : "bg-slate-50/50 border border-transparent"}
                ${isToday ? "ring-2 ring-blue-900 bg-blue-50" : ""}
                ${list.length > 0 ? "hover:border-emerald-300" : ""}
              `}
            >
              <span className={`text-xs font-bold ${isToday ? "text-blue-900" : inMonth ? "text-slate-700" : "text-slate-300"}`}>{day}</span>
              {list.length > 0 && (
                <div className="flex flex-wrap gap-0.5 justify-center mt-auto">
                  {list.slice(0, 3).map((e, i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[e.status]?.dot || "#94A3B8" }} />
                  ))}
                  {list.length > 3 && <span className="text-[8px] text-slate-400 font-bold">+{list.length - 3}</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function ListView({ events, onOpen }) {
  if (events.length === 0) {
    return (
      <Card className="card-elevated p-10 text-center border-0 shadow-none">
        <ListChecks className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-slate-500">Sin trabajos próximos en los próximos 60 días.</p>
      </Card>
    );
  }
  const groups = events.reduce((acc, e) => {
    (acc[e.date] = acc[e.date] || []).push(e);
    return acc;
  }, {});
  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([d, list]) => (
        <div key={d}>
          <div className="text-xs uppercase tracking-[0.16em] font-bold text-slate-500 mb-2">{fmtLongDate(d)}</div>
          <div className="space-y-1.5">
            {list.map((e, i) => <EventCard key={`${e.job_id}-${i}`} event={e} onClick={() => onOpen(e)} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// EVENT CARD + DETAIL
// ============================================================================
function EventCard({ event, onClick, compact }) {
  const c = STATUS_COLORS[event.status] || STATUS_COLORS.scheduled;
  return (
    <button
      data-testid={`event-${event.job_id}-${event.date}`}
      onClick={onClick}
      className="w-full text-left bg-white rounded-xl p-3 border border-slate-100 hover:border-emerald-300 transition-colors tap flex items-stretch gap-3 shadow-sm"
    >
      <span className="w-1 rounded-full self-stretch" style={{ background: c.dot }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-sm text-slate-900 truncate">{event.title}</span>
          {event.recurrence && event.recurrence !== "none" && (
            <Repeat className="w-3 h-3 text-slate-400 flex-shrink-0" />
          )}
          {event.is_project && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">Proyecto</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
          {event.client_name && <span className="truncate">{event.client_name}</span>}
          {event.start_time && !event.all_day && (
            <span className="inline-flex items-center gap-0.5"><Clock className="w-3 h-3" /> {fmtTime(event.start_time)}{event.end_time ? `–${fmtTime(event.end_time)}` : ""}</span>
          )}
          {event.all_day && <span className="text-emerald-700 font-semibold">Todo el día</span>}
        </div>
        {!compact && event.address && (
          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1 truncate">
            <MapPin className="w-3 h-3 flex-shrink-0" /> {event.address}
          </div>
        )}
      </div>
      <span
        className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md self-start whitespace-nowrap"
        style={{ background: c.bg, color: c.text }}
      >
        {STATUS_LABEL[event.status] || event.status}
      </span>
    </button>
  );
}

function EventDetail({ event, job, onEdit, onDelete, onClose }) {
  const phone = (event.client_phone || "").replace(/\D/g, "");
  return (
    <div>
      <SheetHeader className="px-5 pt-5 pb-3 border-b border-slate-100">
        <SheetTitle className="font-heading text-xl text-left">{event.title}</SheetTitle>
        <p className="text-sm text-slate-500 text-left">{fmtLongDate(event.date)}</p>
      </SheetHeader>
      <div className="px-5 py-4 space-y-4">
        {/* Time + status */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md"
            style={{ background: STATUS_COLORS[event.status]?.bg, color: STATUS_COLORS[event.status]?.text }}
          >
            {STATUS_LABEL[event.status]}
          </span>
          {event.start_time && !event.all_day ? (
            <span className="text-sm font-semibold text-slate-700 inline-flex items-center gap-1">
              <Clock className="w-4 h-4 text-slate-400" /> {fmtTime(event.start_time)}{event.end_time ? ` – ${fmtTime(event.end_time)}` : ""}
            </span>
          ) : (
            <span className="text-sm font-semibold text-emerald-700">Todo el día</span>
          )}
          {event.recurrence && event.recurrence !== "none" && (
            <span className="text-xs text-slate-500 inline-flex items-center gap-1">
              <Repeat className="w-3 h-3" /> {event.recurrence === "weekly" ? "Semanal" : event.recurrence === "biweekly" ? "Quincenal" : "Mensual"}
            </span>
          )}
        </div>

        {/* Client */}
        {event.client_name && (
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Cliente</div>
            <div className="font-semibold text-slate-900">{event.client_name}</div>
            {event.address && (
              <div className="text-xs text-slate-500 mt-1 flex items-start gap-1">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {event.address}
              </div>
            )}
            {phone && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                <a href={`tel:${phone}`} className="h-11 rounded-xl bg-blue-900 text-white flex items-center justify-center gap-1.5 font-semibold text-sm tap" data-testid="call-client-btn">
                  <Phone className="w-4 h-4" /> Llamar
                </a>
                <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" className="h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center gap-1.5 font-semibold text-sm tap" data-testid="whatsapp-client-btn">
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </a>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {event.notes && (
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Notas</div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{event.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button variant="outline" onClick={onEdit} data-testid="edit-job-btn" className="h-11 rounded-xl">
            <Pencil className="w-4 h-4 mr-1" /> Editar
          </Button>
          <Button variant="outline" onClick={onDelete} data-testid="delete-job-btn" className="h-11 rounded-xl text-red-600 border-red-200">
            <Trash2 className="w-4 h-4 mr-1" /> Eliminar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// JOB EDITOR (create + edit)
// ============================================================================
const EMPTY_FORM = {
  client_id: "", title: "", status: "scheduled",
  scheduled_date: todayISO(), end_date: "", start_time: "", end_time: "",
  all_day: false, address: "", notes: "",
  recurrence: "none", recurrence_days: [], recurrence_end_date: "",
};

function JobEditor({ open, onOpenChange, jobId, defaultDate, clients, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, scheduled_date: defaultDate || todayISO() });
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState("single"); // single | project | recurring

  useEffect(() => {
    if (!open) return;
    if (jobId) {
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
    } else {
      setForm({ ...EMPTY_FORM, scheduled_date: defaultDate || todayISO() });
      setMode("single");
    }
    // eslint-disable-next-line
  }, [open, jobId]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleDay = (d) => {
    const has = form.recurrence_days.includes(d);
    update("recurrence_days", has ? form.recurrence_days.filter((x) => x !== d) : [...form.recurrence_days, d]);
  };

  const save = async () => {
    if (!form.client_id || !form.title) return toast.error("Falta cliente o título");
    setSaving(true);
    const payload = { ...form };

    // Normalize by mode
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
        return toast.error("Selecciona al menos un día de la semana");
      }
      if (!payload.recurrence_end_date) {
        setSaving(false);
        return toast.error("Pon fecha en que termina la recurrencia");
      }
    }

    try {
      if (jobId) await api.put(`/jobs/${jobId}`, payload);
      else await api.post("/jobs", payload);
      toast.success(jobId ? "Trabajo actualizado" : "Trabajo creado");
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">{jobId ? "Editar trabajo" : "Nuevo trabajo"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Mode picker */}
          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { k: "single", label: "Una vez" },
              { k: "project", label: "Proyecto" },
              { k: "recurring", label: "Recurrente" },
            ].map((m) => (
              <button
                key={m.k}
                data-testid={`mode-${m.k}`}
                onClick={() => {
                  setMode(m.k);
                  if (m.k === "recurring" && (!form.recurrence || form.recurrence === "none")) {
                    update("recurrence", "weekly");
                  }
                }}
                className={`py-2 text-xs font-bold rounded-lg tap ${mode === m.k ? "bg-white text-blue-900 shadow-sm" : "text-slate-500"}`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div>
            <Label>Cliente *</Label>
            <Select value={form.client_id} onValueChange={(v) => update("client_id", v)}>
              <SelectTrigger className="h-12 rounded-xl mt-1.5" data-testid="editor-client"><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div>
            <Label>Título *</Label>
            <Input data-testid="editor-title" value={form.title} onChange={(e) => update("title", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder="Ej. Limpieza, Reemplazo de techo..." />
          </div>

          {mode === "single" && (
            <div>
              <Label>Fecha</Label>
              <Input type="date" data-testid="editor-date" value={form.scheduled_date} onChange={(e) => update("scheduled_date", e.target.value)} className="h-12 rounded-xl mt-1.5" />
            </div>
          )}

          {mode === "project" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Inicia</Label>
                <Input type="date" data-testid="editor-start" value={form.scheduled_date} onChange={(e) => update("scheduled_date", e.target.value)} className="h-12 rounded-xl mt-1.5" />
              </div>
              <div>
                <Label>Termina</Label>
                <Input type="date" data-testid="editor-end" value={form.end_date} onChange={(e) => update("end_date", e.target.value)} className="h-12 rounded-xl mt-1.5" />
              </div>
            </div>
          )}

          {mode === "recurring" && (
            <>
              <div>
                <Label>Frecuencia</Label>
                <Select value={form.recurrence === "none" ? "weekly" : form.recurrence} onValueChange={(v) => update("recurrence", v)}>
                  <SelectTrigger className="h-12 rounded-xl mt-1.5" data-testid="editor-recurrence"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="biweekly">Quincenal (cada 2 semanas)</SelectItem>
                    <SelectItem value="monthly">Mensual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(form.recurrence === "weekly" || form.recurrence === "biweekly") && (
                <div>
                  <Label>Días de la semana</Label>
                  <div className="grid grid-cols-7 gap-1 mt-1.5">
                    {DAY_KEYS.map((d) => {
                      const active = form.recurrence_days.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          data-testid={`day-${d}`}
                          onClick={() => toggleDay(d)}
                          className={`h-11 rounded-xl text-xs font-bold tap transition-all ${active ? "bg-blue-900 text-white" : "bg-slate-100 text-slate-500"}`}
                        >
                          {DAY_LABELS_ES[d]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Inicia</Label>
                  <Input type="date" value={form.scheduled_date} onChange={(e) => update("scheduled_date", e.target.value)} className="h-12 rounded-xl mt-1.5" />
                </div>
                <div>
                  <Label>Termina</Label>
                  <Input type="date" data-testid="editor-rec-end" value={form.recurrence_end_date || ""} onChange={(e) => update("recurrence_end_date", e.target.value)} className="h-12 rounded-xl mt-1.5" />
                </div>
              </div>
            </>
          )}

          {/* Time */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
            <Label className="text-sm">Todo el día</Label>
            <Switch data-testid="editor-allday" checked={form.all_day} onCheckedChange={(v) => update("all_day", v)} />
          </div>
          {!form.all_day && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Hora inicio</Label>
                <Input type="time" data-testid="editor-start-time" value={form.start_time} onChange={(e) => update("start_time", e.target.value)} className="h-12 rounded-xl mt-1.5" />
              </div>
              <div>
                <Label>Hora fin</Label>
                <Input type="time" value={form.end_time} onChange={(e) => update("end_time", e.target.value)} className="h-12 rounded-xl mt-1.5" />
              </div>
            </div>
          )}

          <div>
            <Label>Dirección del trabajo</Label>
            <Input value={form.address} onChange={(e) => update("address", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder="Si lo dejas vacío, usamos la dirección del cliente" />
          </div>

          <div>
            <Label>Estado</Label>
            <Select value={form.status} onValueChange={(v) => update("status", v)}>
              <SelectTrigger className="h-12 rounded-xl mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Notas</Label>
            <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} className="rounded-xl mt-1.5" placeholder="Cualquier nota interna sobre el trabajo..." />
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
          <Button data-testid="editor-save" onClick={save} disabled={saving} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
