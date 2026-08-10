/**
 * Calendar — Month / Week / Day / List views for jobs.
 * Mobile-first. Reads from /api/calendar/events which expands recurrences.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, Loader2, Clock, MapPin,
  Phone, MessageCircle, Repeat, Briefcase, ListChecks, Pencil, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import TourButton from "@/components/TourButton";

const VIEWS = [
  { key: "day", labelKey: "calendar.vToday" },
  { key: "week", labelKey: "calendar.vWeek" },
  { key: "month", labelKey: "calendar.vMonth" },
  { key: "list", labelKey: "calendar.vList" },
];

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
// Jan 1 2024 is a Monday — reference dates for localized weekday short names.
const DOW_REF = {
  mon: new Date(2024, 0, 1), tue: new Date(2024, 0, 2), wed: new Date(2024, 0, 3),
  thu: new Date(2024, 0, 4), fri: new Date(2024, 0, 5), sat: new Date(2024, 0, 6), sun: new Date(2024, 0, 7),
};

const STATUS_COLORS = {
  new_lead: { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  estimate_sent: { bg: "#DBEAFE", text: "#1E40AF", dot: "#3B82F6" },
  approved: { bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
  scheduled: { bg: "#E0E7FF", text: "#3730A3", dot: "#6366F1" },
  in_progress: { bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },
  waiting_payment: { bg: "#FFEDD5", text: "#9A3412", dot: "#F97316" },
  completed: { bg: "#F1F5F9", text: "#475569", dot: "#94A3B8" },
};
const STATUS_KEYS = Object.keys(STATUS_COLORS);

const LOCALE = () => (i18n.language && i18n.language.startsWith("es") ? "es-ES" : "en-US");
const mkDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
const dayShort = (key) => DOW_REF[key].toLocaleDateString(LOCALE(), { weekday: "short" });
const jobStatusLabel = (s) => i18n.t(`jobs.status.${s}`, { defaultValue: s });

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
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const w = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - w);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

const fmtMonthYear = (iso) => mkDate(startOfMonth(iso)).toLocaleDateString(LOCALE(), { month: "long", year: "numeric" });
const fmtLongDate = (iso) => mkDate(iso).toLocaleDateString(LOCALE(), { weekday: "long", day: "numeric", month: "long" });
const monthShort = (iso) => mkDate(iso).toLocaleDateString(LOCALE(), { month: "short" });

const fmtTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
};

export default function Calendar() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [view, setView] = useState("day");
  const [anchor, setAnchor] = useState(todayISO());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState(null);

  const range = useMemo(() => {
    if (view === "day") return { start: anchor, end: anchor };
    if (view === "week") {
      const s = startOfWeek(anchor);
      return { start: s, end: addDays(s, 6) };
    }
    if (view === "month") {
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
      toast.error(t("calendar.errorLoad"));
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
      return `${s.slice(8)} – ${e.slice(8)} ${monthShort(s)}`;
    }
    if (view === "month") return fmtMonthYear(anchor);
    return t("calendar.upcoming");
  };

  const openEvent = async (ev) => {
    try {
      const { data } = await api.get(`/jobs/${ev.job_id}`);
      setSelected({ event: ev, job: data });
    } catch {
      toast.error(t("calendar.errorLoadJob"));
    }
  };

  const closeEvent = () => setSelected(null);

  const startNew = (date = null) => {
    navigate(`/calendario/nuevo${date ? `?date=${date}` : `?date=${anchor}`}`);
  };

  const startEdit = (jobId) => {
    setSelected(null);
    navigate(`/calendario/${jobId}/editar`);
  };

  const deleteJob = async (jobId) => {
    if (!window.confirm(t("calendar.deleteConfirm"))) return;
    await api.delete(`/jobs/${jobId}`);
    toast.success(t("calendar.deleted"));
    closeEvent();
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-emerald-600" /> {t("calendar.title")}
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            {todayCount > 0 ? (
              <span className="font-semibold text-blue-900">{t("calendar.jobsToday", { count: todayCount })}</span>
            ) : (
              <span>{t("calendar.noJobsToday")}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TourButton tourKey="calendar" />
          <Button data-testid="new-event-btn" onClick={() => startNew()} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 h-11 px-4">
            <Plus className="w-4 h-4 mr-1" /> {t("calendar.new")}
          </Button>
        </div>
      </div>

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
            {t(v.labelKey)}
          </button>
        ))}
      </div>

      {view !== "list" && (
        <div className="flex items-center justify-between gap-2">
          <button onClick={navPrev} data-testid="cal-prev" className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center tap">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <button
            onClick={() => setAnchor(todayISO())}
            data-testid="cal-today"
            className="flex-1 h-10 rounded-xl bg-white border border-slate-200 font-semibold text-sm text-slate-800 tap capitalize"
          >
            {headerTitle()}
            <span className="ml-2 text-[10px] text-slate-400">• {t("calendar.today")}</span>
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
    </div>
  );
}

function DayView({ events, onOpen, onCreate }) {
  const { t } = useTranslation();
  if (events.length === 0) {
    return (
      <Card className="card-elevated p-10 text-center border-0 shadow-none">
        <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-slate-500 mb-4">{t("calendar.noJobsThisDay")}</p>
        <Button onClick={onCreate} data-testid="day-empty-create" className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-1" /> {t("calendar.scheduleJob")}
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
  const { t } = useTranslation();
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="space-y-3">
      {days.map((d) => {
        const list = eventsByDate[d] || [];
        const isToday = d === todayISO();
        const dt = mkDate(d);
        const dd = dt.getDate();
        return (
          <div key={d} data-testid={`week-day-${d}`}>
            <button
              onClick={() => onPickDay(d)}
              className={`flex items-baseline gap-2 mb-1.5 tap ${isToday ? "text-blue-900" : "text-slate-700"}`}
            >
              <span className="font-heading font-bold text-base">{dd}</span>
              <span className="text-xs uppercase tracking-wider font-bold capitalize">
                {dt.toLocaleDateString(LOCALE(), { weekday: "short" })}
              </span>
              {isToday && <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-900 text-white px-2 py-0.5 rounded-full">{t("calendar.today")}</span>}
              <span className="text-xs text-slate-400 ml-1">{list.length > 0 ? t("calendar.jobsCount", { count: list.length }) : "—"}</span>
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

function MonthView({ anchor, rangeStart, rangeEnd, eventsByDate, onPickDay, onOpen }) {
  const { t } = useTranslation();
  const days = [];
  let d = rangeStart;
  while (d <= rangeEnd) { days.push(d); d = addDays(d, 1); }
  const [anchorY, anchorM] = anchor.split("-").map(Number);
  const today = todayISO();
  const MAX_CHIPS = 3;
  return (
    <Card className="card-elevated p-2 sm:p-3 border-0 shadow-none overflow-hidden">
      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {DAY_KEYS.map((k) => (
          <div key={k} className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 py-1 capitalize">
            {dayShort(k)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const [y, m, day] = d.split("-").map(Number);
          const inMonth = y === anchorY && m === anchorM;
          const isToday = d === today;
          const list = eventsByDate[d] || [];
          const isWeekend = (() => { const dt = new Date(y, m - 1, day); return dt.getDay() === 0 || dt.getDay() === 6; })();
          return (
            <div
              key={d}
              data-testid={`month-cell-${d}`}
              onClick={() => onPickDay(d)}
              className={`min-h-[72px] sm:min-h-[112px] rounded-xl p-1 sm:p-1.5 flex flex-col gap-1 cursor-pointer tap transition-all overflow-hidden
                ${inMonth ? "bg-white border border-slate-100" : "bg-slate-50/60 border border-transparent"}
                ${isToday ? "ring-2 ring-blue-900 bg-blue-50/60" : "hover:border-emerald-300 hover:shadow-sm"}
              `}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center justify-center text-[11px] sm:text-xs font-bold rounded-full w-5 h-5 sm:w-6 sm:h-6
                    ${isToday ? "bg-blue-900 text-white" : inMonth ? (isWeekend ? "text-slate-400" : "text-slate-700") : "text-slate-300"}`}
                >
                  {day}
                </span>
                {list.length > 0 && (
                  <span className="text-[9px] font-bold text-slate-300 sm:hidden">{list.length}</span>
                )}
              </div>

              <div className="flex-1 w-full space-y-0.5 overflow-hidden">
                {list.slice(0, MAX_CHIPS).map((e, i) => {
                  const c = STATUS_COLORS[e.status] || STATUS_COLORS.scheduled;
                  return (
                    <button
                      key={`${e.job_id}-${i}`}
                      onClick={(ev) => { ev.stopPropagation(); onOpen?.(e); }}
                      title={e.title}
                      className="block w-full truncate rounded-md px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold leading-tight text-left tap"
                      style={{ background: c.bg, color: c.text }}
                      data-testid={`month-chip-${e.job_id}-${d}`}
                    >
                      <span className="hidden sm:inline">{e.start_time && !e.all_day ? `${fmtTime(e.start_time).replace(":00", "")} ` : ""}</span>
                      {e.title}
                    </button>
                  );
                })}
                {list.length > MAX_CHIPS && (
                  <div className="text-[9px] sm:text-[10px] font-bold text-slate-400 px-1">+{list.length - MAX_CHIPS} {t("calendar.more")}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ListView({ events, onOpen }) {
  const { t } = useTranslation();
  if (events.length === 0) {
    return (
      <Card className="card-elevated p-10 text-center border-0 shadow-none">
        <ListChecks className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-slate-500">{t("calendar.noUpcoming")}</p>
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
          <div className="text-xs uppercase tracking-[0.16em] font-bold text-slate-500 mb-2 capitalize">{fmtLongDate(d)}</div>
          <div className="space-y-1.5">
            {list.map((e, i) => <EventCard key={`${e.job_id}-${i}`} event={e} onClick={() => onOpen(e)} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function EventCard({ event, onClick, compact }) {
  const { t } = useTranslation();
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
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">{t("calendar.project")}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
          {event.client_name && <span className="truncate">{event.client_name}</span>}
          {event.start_time && !event.all_day && (
            <span className="inline-flex items-center gap-0.5"><Clock className="w-3 h-3" /> {fmtTime(event.start_time)}{event.end_time ? `–${fmtTime(event.end_time)}` : ""}</span>
          )}
          {event.all_day && <span className="text-emerald-700 font-semibold">{t("calendar.allDay")}</span>}
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
        {jobStatusLabel(event.status)}
      </span>
    </button>
  );
}

function EventDetail({ event, job, onEdit, onDelete, onClose }) {
  const { t } = useTranslation();
  const phone = (event.client_phone || "").replace(/\D/g, "");
  const recLabel = event.recurrence === "weekly" ? t("calendar.weekly") : event.recurrence === "biweekly" ? t("calendar.biweekly") : t("calendar.monthly");
  return (
    <div>
      <SheetHeader className="px-5 pt-5 pb-3 border-b border-slate-100">
        <SheetTitle className="font-heading text-xl text-left">{event.title}</SheetTitle>
        <p className="text-sm text-slate-500 text-left capitalize">{fmtLongDate(event.date)}</p>
      </SheetHeader>
      <div className="px-5 py-4 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md"
            style={{ background: STATUS_COLORS[event.status]?.bg, color: STATUS_COLORS[event.status]?.text }}
          >
            {jobStatusLabel(event.status)}
          </span>
          {event.start_time && !event.all_day ? (
            <span className="text-sm font-semibold text-slate-700 inline-flex items-center gap-1">
              <Clock className="w-4 h-4 text-slate-400" /> {fmtTime(event.start_time)}{event.end_time ? ` – ${fmtTime(event.end_time)}` : ""}
            </span>
          ) : (
            <span className="text-sm font-semibold text-emerald-700">{t("calendar.allDay")}</span>
          )}
          {event.recurrence && event.recurrence !== "none" && (
            <span className="text-xs text-slate-500 inline-flex items-center gap-1">
              <Repeat className="w-3 h-3" /> {recLabel}
            </span>
          )}
        </div>

        {event.client_name && (
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">{t("calendar.client")}</div>
            <div className="font-semibold text-slate-900">{event.client_name}</div>
            {event.address && (
              <div className="text-xs text-slate-500 mt-1 flex items-start gap-1">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {event.address}
              </div>
            )}
            {phone && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                <a href={`tel:${phone}`} className="h-11 rounded-xl bg-blue-900 text-white flex items-center justify-center gap-1.5 font-semibold text-sm tap" data-testid="call-client-btn">
                  <Phone className="w-4 h-4" /> {t("calendar.call")}
                </a>
                <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" className="h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center gap-1.5 font-semibold text-sm tap" data-testid="whatsapp-client-btn">
                  <MessageCircle className="w-4 h-4" /> {t("calendar.whatsapp")}
                </a>
              </div>
            )}
          </div>
        )}

        {event.notes && (
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">{t("calendar.notes")}</div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{event.notes}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button variant="outline" onClick={onEdit} data-testid="edit-job-btn" className="h-11 rounded-xl">
            <Pencil className="w-4 h-4 mr-1" /> {t("calendar.edit")}
          </Button>
          <Button variant="outline" onClick={onDelete} data-testid="delete-job-btn" className="h-11 rounded-xl text-red-600 border-red-200">
            <Trash2 className="w-4 h-4 mr-1" /> {t("calendar.delete")}
          </Button>
        </div>
      </div>
    </div>
  );
}
