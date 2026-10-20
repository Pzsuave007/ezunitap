import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Calendar, MapPin, Clock, Loader2, X, ChevronLeft, ChevronRight, CheckCircle2, Ticket, Video, CalendarPlus } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const photoUrl = (id, w) => (id ? `${API}/public/card/photo/${id}${w ? `?w=${w}` : ""}` : null);

function isLight(hex) {
  if (!hex) return false;
  const c = hex.replace("#", ""); if (c.length < 6) return false;
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150;
}

const T = (lang, en, es) => (lang === "es" ? es : en);

function fmtDate(iso, lang, opts) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(lang === "es" ? "es-MX" : "en-US", opts || { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  } catch { return iso; }
}

function pad(n) { return String(n).padStart(2, "0"); }
function toCalStamp(d) { return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`; }

function googleCalUrl(ev, occ) {
  const start = new Date(occ || ev.start);
  const end = new Date(start.getTime() + (ev.duration_min || 90) * 60000);
  let loc = ev.location_name || "";
  if (ev.location_address) loc = (loc + " " + ev.location_address).trim();
  if (!loc && ev.online_url) loc = ev.online_url;
  const p = new URLSearchParams({
    action: "TEMPLATE", text: ev.title || "Event",
    dates: `${toCalStamp(start)}/${toCalStamp(end)}`,
    details: ev.description || "", location: loc,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

function icsUrl(ev, occ) {
  return `${API}/public/events/${ev.id}/calendar.ics?occ=${encodeURIComponent(occ || ev.start)}`;
}

function AddToCalendar({ ev, occ, accent, lang }) {
  return (
    <div className="flex flex-wrap gap-2" data-testid="event-add-calendar">
      <a href={googleCalUrl(ev, occ)} target="_blank" rel="noreferrer"
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold border transition hover:opacity-80"
        style={{ borderColor: accent, color: accent }} data-testid="event-add-google">
        <CalendarPlus className="w-4 h-4" /> Google Calendar
      </a>
      <a href={icsUrl(ev, occ)}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold border border-slate-300 text-slate-600 transition hover:bg-slate-50"
        data-testid="event-add-ics">
        <CalendarPlus className="w-4 h-4" /> {T(lang, "Apple / .ics", "Apple / .ics")}
      </a>
    </div>
  );
}

function RegisterModal({ ev, occ, onClose, accent, accentText, lang }) {
  const occurrences = ev.occurrences && ev.occurrences.length ? ev.occurrences : [ev.start];
  const [chosen, setChosen] = useState(occ || occurrences[0]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", tickets: 1 });
  const paid = (ev.price || 0) > 0;
  const methods = (ev.pay && ev.pay.methods) || [];
  const cardOk = !!(ev.pay && ev.pay.card);
  const payOptions = [
    ...(cardOk ? [{ key: "card", label: T(lang, "Credit / debit card", "Tarjeta de crédito / débito") }] : []),
    ...methods.map((m) => ({ key: m.key, label: m.label, value: m.value, note: m.note })),
  ];
  const [method, setMethod] = useState(payOptions[0]?.key || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null); // "confirmed" | "pending_manual"

  const chosenMethod = payOptions.find((p) => p.key === method);

  const submit = async () => {
    setErr("");
    if (!form.name.trim() || !form.email.includes("@")) { setErr(T(lang, "Enter your name and a valid email.", "Escribe tu nombre y un email válido.")); return; }
    if (paid && !method) { setErr(T(lang, "Choose a payment method.", "Elige una forma de pago.")); return; }
    setBusy(true);
    try {
      const origin = window.location.origin + window.location.pathname;
      const { data } = await axios.post(`${API}/public/events/${ev.id}/register`, {
        name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(),
        tickets: Number(form.tickets) || 1, occurrence: chosen,
        method: paid ? method : "", origin_url: origin,
      });
      if (data.status === "redirect" && data.checkout_url) { window.location.href = data.checkout_url; return; }
      setDone(data.status === "confirmed" ? "confirmed" : "pending_manual");
    } catch (e) {
      setErr(e?.response?.data?.detail || T(lang, "Something went wrong. Try again.", "Algo salió mal. Intenta de nuevo."));
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={onClose} data-testid="event-register-modal">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {ev.image_id && <img src={photoUrl(ev.image_id, 1200)} alt="" className="w-full h-44 object-cover sm:rounded-t-3xl" />}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-xl font-bold text-slate-900 leading-tight" data-testid="event-modal-title">{ev.title}</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 flex-none" data-testid="event-modal-close"><X className="w-5 h-5" /></button>
          </div>

          {done ? (
            <div className="text-center py-4 space-y-4" data-testid="event-register-success">
              <CheckCircle2 className="w-14 h-14 mx-auto" style={{ color: accent }} />
              <div>
                <p className="text-lg font-bold text-slate-900">{done === "confirmed" ? T(lang, "You're registered!", "¡Estás registrado!") : T(lang, "Registration received", "Registro recibido")}</p>
                <p className="text-sm text-slate-500 mt-1">
                  {done === "confirmed"
                    ? T(lang, "We sent a confirmation to your email. Add it to your calendar so your phone reminds you.", "Enviamos una confirmación a tu correo. Agrégalo a tu calendario para que tu teléfono te recuerde.")
                    : T(lang, "We saved your spot. Complete your payment with the host, then you're all set.", "Guardamos tu lugar. Completa tu pago con el organizador y listo.")}
                </p>
              </div>
              {done === "pending_manual" && chosenMethod && (chosenMethod.value || chosenMethod.note) && (
                <div className="text-left bg-slate-50 rounded-xl p-3 text-sm" data-testid="event-manual-pay-info">
                  <div className="font-semibold text-slate-700">{chosenMethod.label}</div>
                  {chosenMethod.value && <div className="text-slate-600">{chosenMethod.value}</div>}
                  {chosenMethod.note && <div className="text-slate-500 text-xs mt-0.5">{chosenMethod.note}</div>}
                </div>
              )}
              <div className="flex justify-center"><AddToCalendar ev={ev} occ={chosen} accent={accent} lang={lang} /></div>
              <button onClick={onClose} className="w-full py-3 rounded-full font-bold" style={{ background: accent, color: accentText }} data-testid="event-success-done">{T(lang, "Done", "Listo")}</button>
            </div>
          ) : (
            <>
              <div className="space-y-1.5 text-sm text-slate-600">
                {occurrences.length > 1 ? (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-1"><Calendar className="w-3.5 h-3.5" /> {T(lang, "Pick a date", "Elige una fecha")}</label>
                    <select value={chosen} onChange={(e) => setChosen(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5" data-testid="event-occurrence-select">
                      {occurrences.map((o) => <option key={o} value={o}>{fmtDate(o, lang, { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="flex items-center gap-2"><Clock className="w-4 h-4" style={{ color: accent }} /> {fmtDate(chosen, lang, { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })}</div>
                )}
                {(ev.location_name || ev.location_address) && <div className="flex items-center gap-2"><MapPin className="w-4 h-4" style={{ color: accent }} /> {ev.location_name}{ev.location_address ? ` · ${ev.location_address}` : ""}</div>}
                {ev.online_url && <div className="flex items-center gap-2"><Video className="w-4 h-4" style={{ color: accent }} /> {T(lang, "Online event", "Evento en línea")}</div>}
              </div>

              {ev.description && <p className="text-sm text-slate-600 leading-relaxed">{ev.description}</p>}

              <div className="grid grid-cols-1 gap-3 pt-1">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={T(lang, "Full name", "Nombre completo")} className="w-full border border-slate-200 rounded-xl px-3 py-2.5" data-testid="event-field-name" />
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" placeholder="Email" className="w-full border border-slate-200 rounded-xl px-3 py-2.5" data-testid="event-field-email" />
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder={T(lang, "Phone (optional)", "Teléfono (opcional)")} className="w-full border border-slate-200 rounded-xl px-3 py-2.5" data-testid="event-field-phone" />
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-600">{T(lang, "Tickets", "Boletos")}</label>
                  <input value={form.tickets} onChange={(e) => setForm({ ...form, tickets: e.target.value })} type="number" min="1" max="20" className="w-20 border border-slate-200 rounded-xl px-3 py-2.5" data-testid="event-field-tickets" />
                  {paid && <span className="ml-auto font-bold text-slate-900" data-testid="event-total">${(ev.price * (Number(form.tickets) || 1)).toFixed(2)}</span>}
                </div>
              </div>

              {paid && payOptions.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500">{T(lang, "Payment method", "Forma de pago")}</label>
                  <div className="space-y-1.5">
                    {payOptions.map((p) => (
                      <label key={p.key} className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer ${method === p.key ? "border-slate-900 bg-slate-50" : "border-slate-200"}`} data-testid={`event-pay-${p.key}`}>
                        <input type="radio" checked={method === p.key} onChange={() => setMethod(p.key)} className="accent-slate-900" />
                        <span className="text-sm font-medium text-slate-700">{p.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {paid && payOptions.length === 0 && <p className="text-sm text-amber-600">{T(lang, "Online payment isn't set up yet — contact the host to pay.", "El pago en línea aún no está configurado — contacta al organizador para pagar.")}</p>}

              {err && <p className="text-sm text-red-600" data-testid="event-register-error">{err}</p>}
              <button onClick={submit} disabled={busy} className="w-full py-3.5 rounded-full font-bold flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: accent, color: accentText }} data-testid="event-register-submit">
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Ticket className="w-5 h-5" />}
                {paid ? (method === "card" ? T(lang, "Pay & register", "Pagar y registrarme") : T(lang, "Register", "Registrarme")) : T(lang, "Register — free", "Registrarme — gratis")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CalendarModal({ events, onClose, onPick, accent, accentText, lang }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const byDay = useMemo(() => {
    const map = {};
    events.forEach((ev) => (ev.occurrences || [ev.start]).forEach((o) => {
      const d = new Date(o); const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      (map[key] = map[key] || []).push({ ev, occ: o });
    }));
    return map;
  }, [events]);
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  const monthLabel = cursor.toLocaleString(lang === "es" ? "es-MX" : "en-US", { month: "long", year: "numeric" });
  const dow = lang === "es" ? ["D", "L", "M", "M", "J", "V", "S"] : ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={onClose} data-testid="event-calendar-modal">
      <div className="bg-white w-full max-w-md rounded-3xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="p-2 rounded-full hover:bg-slate-100" data-testid="cal-prev"><ChevronLeft className="w-5 h-5" /></button>
          <div className="font-bold capitalize text-slate-900" data-testid="cal-month">{monthLabel}</div>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="p-2 rounded-full hover:bg-slate-100" data-testid="cal-next"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400 mb-1">{dow.map((d, i) => <div key={i}>{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const key = `${year}-${month}-${d}`;
            const list = byDay[key];
            const has = list && list.length;
            return (
              <button key={i} disabled={!has} onClick={() => has && onPick(list[0].ev, list[0].occ)}
                className={`aspect-square rounded-lg text-sm flex flex-col items-center justify-center relative ${has ? "font-bold cursor-pointer hover:opacity-80" : "text-slate-400"}`}
                style={has ? { background: accent, color: accentText } : {}} data-testid={has ? `cal-day-${d}` : undefined}>
                {d}{has && list.length > 1 && <span className="text-[9px] leading-none">{list.length}</span>}
              </button>
            );
          })}
        </div>
        <button onClick={onClose} className="w-full mt-4 py-2.5 rounded-full border border-slate-200 font-semibold text-slate-600" data-testid="cal-close">{T(lang, "Close", "Cerrar")}</button>
      </div>
    </div>
  );
}

export function EventsSection({ ctx, bg }) {
  const events = (ctx?.data?.events || []).filter((e) => e && e.title);
  const accent = ctx?.accent || "#2563EB";
  const accentText = ctx?.accentText || (isLight(accent) ? "#0A0A0A" : "#FFFFFF");
  const lang = ctx?.lang || "en";
  const light = isLight(bg);
  const ink = light ? "#0f172a" : "#ffffff";
  const muted = light ? "#64748b" : "rgba(255,255,255,.72)";
  const cardBg = light ? "#ffffff" : "rgba(255,255,255,.05)";
  const cardBorder = light ? "rgba(0,0,0,.08)" : "rgba(255,255,255,.12)";

  const [reg, setReg] = useState(null); // {ev, occ}
  const [showCal, setShowCal] = useState(false);
  const [paidResult, setPaidResult] = useState(null); // {event_id, occurrence}

  // Handle Stripe return: ?event_paid=<id>&session_id=...
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const sid = qs.get("session_id");
    const regId = qs.get("event_paid");
    if (!sid || !regId) return;
    let tries = 0;
    const clean = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("session_id"); url.searchParams.delete("event_paid");
      window.history.replaceState({}, "", url.toString());
    };
    const poll = async () => {
      tries++;
      try {
        const { data } = await axios.get(`${API}/public/events/checkout/status/${sid}`);
        if (data.payment_status === "paid") { setPaidResult({ event_id: data.event_id, occurrence: data.occurrence }); clean(); return; }
      } catch { /* ignore */ }
      if (tries < 6) setTimeout(poll, 1500); else clean();
    };
    poll();
  }, []);

  if (!events.length) return null;

  const paidEvent = paidResult ? events.find((e) => e.id === paidResult.event_id) : null;

  return (
    <section className="ws-sec py-16 sm:py-24" style={{ background: bg }} data-testid="events-section">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-9">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: accent }}>{T(lang, "Events", "Eventos")}</div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ color: ink }}>{T(lang, "Upcoming events", "Próximos eventos")}</h2>
          </div>
          <button onClick={() => setShowCal(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold border transition hover:opacity-80" style={{ borderColor: accent, color: accent }} data-testid="events-view-calendar">
            <Calendar className="w-4 h-4" /> {T(lang, "View calendar", "Ver calendario")}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((ev) => (
            <div key={ev.id} className="rounded-2xl overflow-hidden border flex flex-col transition hover:-translate-y-1 hover:shadow-xl" style={{ background: cardBg, borderColor: cardBorder }} data-testid={`event-card-${ev.id}`}>
              {ev.image_id
                ? <img src={photoUrl(ev.image_id, 800)} alt={ev.title} className="w-full h-44 object-cover" />
                : <div className="w-full h-44 flex items-center justify-center" style={{ background: accent + "22" }}><Calendar className="w-10 h-10" style={{ color: accent }} /></div>}
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: accent, color: accentText }}>
                    <Clock className="w-3 h-3" /> {fmtDate(ev.start, lang, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  </span>
                  {ev.recurrence && ev.recurrence.freq && ev.recurrence.freq !== "none" && (
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ color: muted, border: `1px solid ${cardBorder}` }}>{T(lang, "Recurring", "Recurrente")}</span>
                  )}
                </div>
                <h3 className="text-lg font-bold leading-snug mb-1" style={{ color: ink }}>{ev.title}</h3>
                {(ev.location_name || ev.location_address) && <div className="flex items-center gap-1.5 text-sm mb-2" style={{ color: muted }}><MapPin className="w-3.5 h-3.5" /> {ev.location_name || ev.location_address}</div>}
                {ev.description && <p className="text-sm line-clamp-2 mb-3" style={{ color: muted }}>{ev.description}</p>}
                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                  <span className="font-bold" style={{ color: ink }}>{(ev.price || 0) > 0 ? `$${ev.price.toFixed(2)}` : T(lang, "Free", "Gratis")}</span>
                  <button onClick={() => setReg({ ev, occ: ev.start })} className="px-4 py-2 rounded-full font-bold text-sm" style={{ background: accent, color: accentText }} data-testid={`event-register-btn-${ev.id}`}>
                    {T(lang, "Register", "Registrarme")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {reg && <RegisterModal ev={reg.ev} occ={reg.occ} onClose={() => setReg(null)} accent={accent} accentText={accentText} lang={lang} />}
      {showCal && <CalendarModal events={events} onClose={() => setShowCal(false)} onPick={(ev, occ) => { setShowCal(false); setReg({ ev, occ }); }} accent={accent} accentText={accentText} lang={lang} />}
      {paidResult && paidEvent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={() => setPaidResult(null)} data-testid="event-paid-modal">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 text-center space-y-4" onClick={(e) => e.stopPropagation()}>
            <CheckCircle2 className="w-14 h-14 mx-auto" style={{ color: accent }} />
            <p className="text-lg font-bold text-slate-900">{T(lang, "Payment confirmed!", "¡Pago confirmado!")}</p>
            <p className="text-sm text-slate-500">{T(lang, "Check your email for the confirmation. Add the event to your calendar so your phone reminds you.", "Revisa tu correo para la confirmación. Agrega el evento a tu calendario para que tu teléfono te recuerde.")}</p>
            <div className="flex justify-center"><AddToCalendar ev={paidEvent} occ={paidResult.occurrence || paidEvent.start} accent={accent} lang={lang} /></div>
            <button onClick={() => setPaidResult(null)} className="w-full py-3 rounded-full font-bold" style={{ background: accent, color: accentText }} data-testid="event-paid-done">{T(lang, "Done", "Listo")}</button>
          </div>
        </div>
      )}
    </section>
  );
}

export default EventsSection;
