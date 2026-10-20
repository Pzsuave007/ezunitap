import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Sparkles, Users, Download, Calendar, Pencil, ImagePlus, X, Repeat } from "lucide-react";

const photoSrc = (id) => `${process.env.REACT_APP_BACKEND_URL}/api/public/card/photo/${id}`;

const EMPTY = {
  title: "", description: "", image_id: "", start: "", end: "", timezone: "",
  location_name: "", location_address: "", online_url: "", capacity: 0, price: 0,
  recurrence: { freq: "none", interval: 1, until: "" }, published: true,
};

export default function EventsPanel({ isEs }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // event object or EMPTY
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [regFor, setRegFor] = useState(null); // event
  const [regs, setRegs] = useState([]);

  const t = (en, es) => (isEs ? es : en);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get("/events"); setEvents(data.events || []); }
    catch { /* ignore */ }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const startNew = () => setEditing({ ...EMPTY, recurrence: { freq: "none", interval: 1, until: "" } });
  const startEdit = (ev) => setEditing({ ...EMPTY, ...ev, recurrence: { freq: "none", interval: 1, until: "", ...(ev.recurrence || {}) } });

  const upd = (patch) => setEditing((e) => ({ ...e, ...patch }));
  const updRec = (patch) => setEditing((e) => ({ ...e, recurrence: { ...e.recurrence, ...patch } }));

  const uploadImg = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/photos?label=website", fd, { headers: { "Content-Type": "multipart/form-data" } });
      upd({ image_id: data.id });
    } catch { toast.error(t("Upload failed", "No se pudo subir la imagen")); }
    setUploading(false);
  };

  const aiDescribe = async () => {
    if (!editing.title.trim()) { toast.error(t("Add a title first", "Escribe un título primero")); return; }
    setAiBusy(true);
    try {
      const { data } = await api.post("/events/ai-generate", { title: editing.title, notes: editing.description });
      upd({ description: data.description });
    } catch { toast.error(t("Could not generate", "No se pudo generar")); }
    setAiBusy(false);
  };

  const save = async () => {
    if (!editing.title.trim()) { toast.error(t("Title is required", "El título es obligatorio")); return; }
    if (!editing.start) { toast.error(t("Start date/time is required", "La fecha/hora de inicio es obligatoria")); return; }
    setSaving(true);
    try {
      const body = {
        title: editing.title, description: editing.description, image_id: editing.image_id,
        start: editing.start, end: editing.end, timezone: editing.timezone,
        location_name: editing.location_name, location_address: editing.location_address,
        online_url: editing.online_url, capacity: Number(editing.capacity) || 0,
        price: Number(editing.price) || 0,
        recurrence: editing.recurrence.freq === "none" ? {} : editing.recurrence,
        published: editing.published,
      };
      if (editing.id) await api.put(`/events/${editing.id}`, body);
      else await api.post("/events", body);
      toast.success(t("Event saved", "Evento guardado"));
      setEditing(null); load();
    } catch (e) { toast.error(e?.response?.data?.detail || t("Save failed", "No se pudo guardar")); }
    setSaving(false);
  };

  const del = async (ev) => {
    if (!window.confirm(t("Delete this event and all registrations?", "¿Eliminar este evento y todos sus registros?"))) return;
    try { await api.delete(`/events/${ev.id}`); toast.success(t("Deleted", "Eliminado")); load(); }
    catch { toast.error(t("Delete failed", "No se pudo eliminar")); }
  };

  const openRegs = async (ev) => {
    setRegFor(ev); setRegs([]);
    try { const { data } = await api.get(`/events/${ev.id}/registrations`); setRegs(data.registrations || []); }
    catch { /* ignore */ }
  };

  const downloadCsv = async (ev) => {
    try {
      const { data } = await api.get(`/events/${ev.id}/registrations.csv`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement("a"); a.href = url; a.download = `${ev.slug || "evento"}-registros.csv`; a.click();
      window.URL.revokeObjectURL(url);
    } catch { toast.error(t("Export failed", "No se pudo exportar")); }
  };

  const fmt = (iso) => { try { return new Date(iso).toLocaleString(isEs ? "es-MX" : "en-US", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return iso; } };

  return (
    <div className="space-y-4" data-testid="events-panel">
      <p className="text-sm text-slate-500">{t("Create classes, workshops and social events. People register from your site and get a confirmation email with an 'add to calendar' button so their phone reminds them.", "Crea clases, talleres y eventos sociales. La gente se registra desde tu sitio y recibe un correo de confirmación con un botón para agregarlo a su calendario y que su teléfono les recuerde.")}</p>

      {!editing && (
        <>
          <Button onClick={startNew} className="rounded-xl bg-blue-600 hover:bg-blue-700" data-testid="event-new-btn"><Plus className="w-4 h-4 mr-1.5" /> {t("New event", "Nuevo evento")}</Button>
          {loading ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-slate-400"><Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />{t("No events yet.", "Aún no hay eventos.")}</div>
          ) : (
            <div className="space-y-2">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white" data-testid={`event-row-${ev.id}`}>
                  {ev.image_id ? <img src={photoSrc(ev.image_id)} alt="" className="w-12 h-12 rounded-lg object-cover flex-none" /> : <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center flex-none"><Calendar className="w-5 h-5 text-blue-500" /></div>}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate flex items-center gap-1.5">{ev.title}{!ev.published && <span className="text-[10px] font-bold uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{t("Draft", "Borrador")}</span>}{ev.recurrence?.freq && ev.recurrence.freq !== "none" && <Repeat className="w-3 h-3 text-slate-400" />}</div>
                    <div className="text-xs text-slate-500 truncate">{fmt(ev.start)} · {(ev.price || 0) > 0 ? `$${ev.price}` : t("Free", "Gratis")}</div>
                  </div>
                  <button onClick={() => openRegs(ev)} className="flex items-center gap-1 text-xs font-semibold text-slate-600 px-2 py-1.5 rounded-lg hover:bg-slate-100" data-testid={`event-regs-${ev.id}`}><Users className="w-3.5 h-3.5" /> {ev.registration_count || 0}</button>
                  <button onClick={() => startEdit(ev)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" data-testid={`event-edit-${ev.id}`}><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => del(ev)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50" data-testid={`event-delete-${ev.id}`}><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {editing && (
        <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/30 p-4" data-testid="event-form">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{editing.id ? t("Edit event", "Editar evento") : t("New event", "Nuevo evento")}</div>
            <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
          </div>

          <div><Label>{t("Title", "Título")}</Label><Input value={editing.title} onChange={(e) => upd({ title: e.target.value })} className="h-11 rounded-xl mt-1.5" data-testid="event-input-title" placeholder={t("Beginner Salsa Class", "Clase de salsa para principiantes")} /></div>

          <div>
            <Label>{t("Description", "Descripción")}</Label>
            <Textarea value={editing.description} onChange={(e) => upd({ description: e.target.value })} className="rounded-xl mt-1.5 min-h-[80px]" data-testid="event-input-desc" />
            <div className="flex justify-end mt-1"><Button type="button" onClick={aiDescribe} disabled={aiBusy} size="sm" variant="ghost" className="text-blue-600 h-8" data-testid="event-ai-desc">{aiBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />} {t("Write with AI", "Escribir con IA")}</Button></div>
          </div>

          <div>
            <Label>{t("Photo", "Foto")}</Label>
            <div className="mt-1.5 flex items-center gap-3">
              {editing.image_id ? (
                <div className="relative"><img src={photoSrc(editing.image_id)} alt="" className="w-24 h-20 rounded-lg object-cover" /><button onClick={() => upd({ image_id: "" })} className="absolute -top-2 -right-2 bg-white rounded-full border p-0.5 shadow"><X className="w-3.5 h-3.5" /></button></div>
              ) : null}
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50" data-testid="event-upload-photo">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />} {t("Upload", "Subir")}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadImg(e.target.files?.[0])} />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>{t("Starts", "Inicia")}</Label><Input type="datetime-local" value={editing.start} onChange={(e) => upd({ start: e.target.value })} className="h-11 rounded-xl mt-1.5" data-testid="event-input-start" /></div>
            <div><Label>{t("Ends (optional)", "Termina (opcional)")}</Label><Input type="datetime-local" value={editing.end} onChange={(e) => upd({ end: e.target.value })} className="h-11 rounded-xl mt-1.5" data-testid="event-input-end" /></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>{t("Location name", "Nombre del lugar")}</Label><Input value={editing.location_name} onChange={(e) => upd({ location_name: e.target.value })} className="h-11 rounded-xl mt-1.5" data-testid="event-input-locname" placeholder={t("Downtown Studio", "Estudio Centro")} /></div>
            <div><Label>{t("Address", "Dirección")}</Label><Input value={editing.location_address} onChange={(e) => upd({ location_address: e.target.value })} className="h-11 rounded-xl mt-1.5" data-testid="event-input-address" /></div>
          </div>

          <div><Label>{t("Online link (optional)", "Enlace en línea (opcional)")}</Label><Input value={editing.online_url} onChange={(e) => upd({ online_url: e.target.value })} className="h-11 rounded-xl mt-1.5" data-testid="event-input-online" placeholder="https://zoom.us/..." /></div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>{t("Price (USD, 0 = free)", "Precio (USD, 0 = gratis)")}</Label><Input type="number" min="0" step="0.01" value={editing.price} onChange={(e) => upd({ price: e.target.value })} className="h-11 rounded-xl mt-1.5" data-testid="event-input-price" /></div>
            <div><Label>{t("Capacity (0 = unlimited)", "Cupo (0 = ilimitado)")}</Label><Input type="number" min="0" value={editing.capacity} onChange={(e) => upd({ capacity: e.target.value })} className="h-11 rounded-xl mt-1.5" data-testid="event-input-capacity" /></div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Repeat className="w-4 h-4" /> {t("Recurrence", "Recurrencia")}</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">{t("Repeats", "Se repite")}</Label>
                <select value={editing.recurrence.freq} onChange={(e) => updRec({ freq: e.target.value })} className="w-full h-11 rounded-xl border border-slate-200 px-3 mt-1.5" data-testid="event-input-freq">
                  <option value="none">{t("Does not repeat", "No se repite")}</option>
                  <option value="daily">{t("Daily", "Diario")}</option>
                  <option value="weekly">{t("Weekly", "Semanal")}</option>
                  <option value="monthly">{t("Monthly", "Mensual")}</option>
                </select>
              </div>
              {editing.recurrence.freq !== "none" && (
                <>
                  <div><Label className="text-xs">{t("Every", "Cada")}</Label><Input type="number" min="1" value={editing.recurrence.interval} onChange={(e) => updRec({ interval: Number(e.target.value) || 1 })} className="h-11 rounded-xl mt-1.5" data-testid="event-input-interval" /></div>
                  <div><Label className="text-xs">{t("Until (optional)", "Hasta (opcional)")}</Label><Input type="date" value={editing.recurrence.until} onChange={(e) => updRec({ until: e.target.value })} className="h-11 rounded-xl mt-1.5" data-testid="event-input-until" /></div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
            <span className="text-sm font-medium text-slate-700">{t("Published (visible on site)", "Publicado (visible en el sitio)")}</span>
            <Switch checked={editing.published} onCheckedChange={(v) => upd({ published: v })} data-testid="event-input-published" />
          </div>

          <div className="flex gap-2">
            <Button onClick={save} disabled={saving} className="rounded-xl bg-emerald-600 hover:bg-emerald-700" data-testid="event-save-btn">{saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null} {t("Save event", "Guardar evento")}</Button>
            <Button onClick={() => setEditing(null)} variant="ghost" className="rounded-xl" data-testid="event-cancel-btn">{t("Cancel", "Cancelar")}</Button>
          </div>
        </div>
      )}

      {regFor && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4" onClick={() => setRegFor(null)} data-testid="event-regs-modal">
          <div className="bg-white w-full max-w-lg rounded-2xl p-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold">{t("Registrations", "Registros")} · {regFor.title}</div>
              <button onClick={() => setRegFor(null)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <Button onClick={() => downloadCsv(regFor)} size="sm" variant="outline" className="rounded-lg mb-3" data-testid="event-export-csv"><Download className="w-4 h-4 mr-1.5" /> {t("Export CSV", "Exportar CSV")}</Button>
            {regs.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">{t("No registrations yet.", "Aún no hay registros.")}</p>
            ) : (
              <div className="space-y-1.5">
                {regs.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 text-sm" data-testid={`reg-row-${r.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{r.name}</div>
                      <div className="text-xs text-slate-500 truncate">{r.email}{r.phone ? ` · ${r.phone}` : ""}</div>
                    </div>
                    <div className="text-xs text-slate-500">{r.tickets}×</div>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${r.status === "paid" ? "bg-emerald-50 text-emerald-600" : r.status === "free" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"}`}>
                      {r.status === "paid" ? t("Paid", "Pagado") : r.status === "free" ? t("Free", "Gratis") : t("Pending", "Pendiente")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
