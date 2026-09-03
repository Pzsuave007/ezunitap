import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { CalendarCheck, Clock, Phone, MessageSquare, User, StickyNote, Loader2 } from "lucide-react";

const fmt12 = (hhmm) => {
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ap}`;
};
const isUpcoming = (iso) => iso >= new Date().toISOString().slice(0, 10);

export default function Appointments() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const MON = t("appointments.months", { returnObjects: true });
  const dayLabel = (iso) => {
    const d = new Date(iso + "T12:00:00");
    return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
  };
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);

  const load = async () => {
    try {
      const r = await api.get("/appointments");
      setItems(r.data.appointments || []);
    } catch { /* noop */ }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const open = async (appt) => {
    setActive(appt);
    if (!appt.viewed) {
      try {
        await api.post(`/appointments/${appt.id}/viewed`);
        setItems((arr) => arr.map((a) => (a.id === appt.id ? { ...a, viewed: true } : a)));
      } catch { /* noop */ }
    }
  };

  const upcoming = items.filter((a) => isUpcoming(a.date));
  const past = items.filter((a) => !isUpcoming(a.date)).reverse();

  const Row = (a) => (
    <Card key={a.id} data-testid={`appt-card-${a.id}`} onClick={() => open(a)}
      className="card-elevated p-4 border-0 shadow-none cursor-pointer hover:bg-zinc-50 transition-colors flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex flex-col items-center justify-center flex-none leading-none">
        <span className="text-[15px] font-bold">{new Date(a.date + "T12:00:00").getDate()}</span>
        <span className="text-[9px] uppercase font-semibold">{MON[new Date(a.date + "T12:00:00").getMonth()]}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-heading font-bold text-sm text-zinc-900 truncate flex items-center gap-2">
          {a.name}
          {!a.viewed && <span data-testid="appt-new-dot" className="w-2 h-2 rounded-full bg-red-500 flex-none" />}
        </div>
        <div className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
          <Clock className="w-3 h-3" /> {fmt12(a.start_time)} – {fmt12(a.end_time)}
        </div>
      </div>
    </Card>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4" data-testid="appointments-page">
      <div className="flex items-center gap-2">
        <CalendarCheck className="w-6 h-6 text-emerald-600" />
        <h1 className="font-heading text-2xl font-bold tracking-tight">{t("appointments.title")}</h1>
      </div>

      {loading ? (
        <div className="py-16 text-center text-zinc-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : items.length === 0 ? (
        <Card className="card-elevated p-8 text-center border-0 shadow-none">
          <CalendarCheck className="w-9 h-9 text-zinc-300 mx-auto mb-2" />
          <p className="text-sm text-zinc-500">{t("appointments.none")}</p>
          <p className="text-xs text-zinc-400 mt-1">{t("appointments.noneHint")}</p>
          <Button data-testid="appt-go-card" onClick={() => navigate("/tarjeta")} variant="outline" className="mt-4 rounded-xl">{t("appointments.goCard")}</Button>
        </Card>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t("appointments.upcoming")}</div>
              {upcoming.map(Row)}
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t("appointments.past")}</div>
              {past.map(Row)}
            </div>
          )}
        </>
      )}

      <Drawer open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DrawerContent>
          <DrawerHeader className="pb-1">
            <DrawerTitle className="font-heading">{t("appointments.detail")}</DrawerTitle>
          </DrawerHeader>
          {active && (
            <div className="px-4 pb-8 pt-1 max-w-md mx-auto w-full space-y-3">
              <div className="rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 p-4">
                <div className="text-lg font-heading font-bold text-emerald-900">{dayLabel(active.date)}</div>
                <div className="text-sm text-emerald-800 font-semibold flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-4 h-4" /> {fmt12(active.start_time)} – {fmt12(active.end_time)}
                </div>
              </div>
              <div className="rounded-xl ring-1 ring-zinc-200 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm"><User className="w-4 h-4 text-zinc-400" /> <span className="font-semibold">{active.name}</span></div>
                {active.phone && <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-zinc-400" /> {active.phone}</div>}
                {active.notes && <div className="flex items-start gap-2 text-sm"><StickyNote className="w-4 h-4 text-zinc-400 mt-0.5" /> <span className="text-zinc-700 whitespace-pre-wrap">{active.notes}</span></div>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a data-testid="appt-call" href={active.phone ? `tel:${active.phone}` : undefined}
                  className={`h-12 rounded-xl flex items-center justify-center gap-2 font-bold text-white ${active.phone ? "bg-emerald-600 hover:bg-emerald-700" : "bg-zinc-300 pointer-events-none"}`}>
                  <Phone className="w-4 h-4" /> {t("appointments.call")}
                </a>
                <a data-testid="appt-message" href={active.phone ? `sms:${active.phone}` : undefined}
                  className={`h-12 rounded-xl flex items-center justify-center gap-2 font-bold ${active.phone ? "bg-sky-100 text-sky-700 hover:bg-sky-200" : "bg-zinc-100 text-zinc-400 pointer-events-none"}`}>
                  <MessageSquare className="w-4 h-4" /> {t("appointments.message")}
                </a>
              </div>
              {active.client_id && (
                <Button data-testid="appt-view-client" variant="outline" onClick={() => navigate(`/clientes/${active.client_id}`)}
                  className="w-full rounded-xl">{t("appointments.viewClient")}</Button>
              )}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
