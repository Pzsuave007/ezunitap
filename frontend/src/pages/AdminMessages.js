/**
 * AdminMessages — Super-admin page to compose in-app notifications.
 * Lets the owner target one user, all users, or a segment (trial expiring,
 * active payers, etc.) and preview how many people will receive the message.
 */
import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Loader2, AlertCircle, MessageSquare, Send, Users, User,
  Info, CheckCircle2, AlertTriangle, Megaphone, Trash2, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import AdminTabs from "@/components/AdminTabs";

const KIND_OPTIONS = [
  { v: "info",         label: "Info",      icon: Info,         cls: "bg-sky-50 text-sky-700 border-sky-200" },
  { v: "success",      label: "Éxito",     icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { v: "warning",      label: "Aviso",     icon: AlertTriangle,cls: "bg-amber-50 text-amber-700 border-amber-200" },
  { v: "announcement", label: "Anuncio",   icon: Megaphone,    cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
];

export default function AdminMessages() {
  const [users, setUsers] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [segments, setSegments] = useState({});
  const [forbidden, setForbidden] = useState(false);

  // Compose form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("info");
  const [segment, setSegment] = useState("all");
  const [userId, setUserId] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [actionLabel, setActionLabel] = useState("");
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = async () => {
    try {
      const [n, u] = await Promise.all([
        api.get("/admin/notifications"),
        api.get("/admin/users"),
      ]);
      setNotifs(n.data.notifications || []);
      setSegments(n.data.segments || {});
      setUsers(u.data.users || []);
    } catch (e) {
      if (e?.response?.status === 403) setForbidden(true);
      else toast.error("Error al cargar");
    }
  };

  useEffect(() => { load(); }, []);

  // Preview segment count when segment changes
  useEffect(() => {
    if (segment === "user") { setPreview(null); return; }
    let alive = true;
    setPreviewLoading(true);
    api.get(`/admin/segments/preview?segment=${segment}`)
      .then(({ data }) => alive && setPreview(data))
      .catch(() => alive && setPreview(null))
      .finally(() => alive && setPreviewLoading(false));
    return () => { alive = false; };
  }, [segment]);

  const canSubmit = useMemo(() => {
    if (!title.trim() || !body.trim()) return false;
    if (segment === "user" && !userId) return false;
    return !sending;
  }, [title, body, segment, userId, sending]);

  const submit = async () => {
    if (!canSubmit) return;
    setSending(true);
    try {
      const { data } = await api.post("/admin/notifications", {
        title: title.trim(),
        body: body.trim(),
        kind,
        segment,
        user_id: segment === "user" ? userId : null,
        action_url: actionUrl.trim() || null,
        action_label: actionLabel.trim() || null,
      });
      toast.success(`✅ Enviado a ${data.created} usuario${data.created === 1 ? "" : "s"}`);
      setTitle(""); setBody(""); setActionUrl(""); setActionLabel("");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al enviar");
    } finally {
      setSending(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("¿Borrar este mensaje? Desaparecerá de todos los usuarios.")) return;
    try {
      await api.delete(`/admin/notifications/${id}`);
      toast.success("Eliminado");
      setNotifs((xs) => xs.filter((n) => n.id !== id));
    } catch {
      toast.error("Error al borrar");
    }
  };

  if (forbidden) {
    return (
      <>
        <AdminTabs />
        <Card className="p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h2 className="font-heading text-xl font-bold mt-3">Acceso denegado</h2>
        </Card>
      </>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-messages-page">
      <AdminTabs />
      <div>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight">
          Mensajes a clientes
        </h1>
        <p className="text-slate-500 mt-2 max-w-2xl">
          Envía anuncios o mensajes personales que aparecen como banner en la
          app de tus clientes. Útil para actualizaciones, recordatorios o
          comunicaciones especiales.
        </p>
      </div>

      {/* Composer */}
      <Card className="p-5 space-y-4">
        <h3 className="font-heading font-bold text-base flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-900" /> Componer mensaje
        </h3>

        {/* Type */}
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1.5">
            Tipo
          </label>
          <div className="grid grid-cols-4 gap-2">
            {KIND_OPTIONS.map(({ v, label, icon: Icon, cls }) => (
              <button
                key={v}
                type="button"
                data-testid={`kind-${v}`}
                onClick={() => setKind(v)}
                className={`p-2 rounded-xl border text-xs font-semibold transition flex items-center justify-center gap-1 ${
                  kind === v
                    ? `${cls} ring-2 ring-offset-1 ring-slate-300`
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Recipients */}
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1.5">
            Destinatarios
          </label>
          <select
            data-testid="segment-select"
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm"
          >
            {Object.entries(segments).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>

          {segment === "user" && (
            <select
              data-testid="user-select"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full h-10 px-3 mt-2 rounded-xl border border-slate-200 bg-white text-sm"
            >
              <option value="">— Selecciona un usuario —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.business_name || u.email} ({u.email})
                </option>
              ))}
            </select>
          )}

          {segment !== "user" && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-slate-50 text-xs text-slate-600 flex items-center gap-2">
              {previewLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Users className="w-3.5 h-3.5 text-slate-500" />
              )}
              {preview ? (
                preview.count === 0 ? (
                  <span className="text-amber-700">
                    Ningún usuario coincide con este segmento.
                  </span>
                ) : (
                  <span>
                    Llegará a <strong>{preview.count}</strong> usuario{preview.count === 1 ? "" : "s"}.
                  </span>
                )
              ) : (
                <span>Calculando...</span>
              )}
            </div>
          )}
        </div>

        {/* Title + body */}
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1.5">
            Título <span className="text-slate-400">(usa emoji al inicio para destacar)</span>
          </label>
          <Input
            data-testid="msg-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="📢 Nueva función: ahora puedes..."
            maxLength={100}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1.5">
            Mensaje
          </label>
          <Textarea
            data-testid="msg-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Hola Pablo, queríamos contarte que..."
            rows={3}
            maxLength={500}
          />
        </div>

        {/* Optional CTA */}
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-600 hover:text-slate-900 font-semibold">
            + Agregar botón de acción (opcional)
          </summary>
          <div className="mt-3 space-y-3 pl-3 border-l-2 border-slate-100">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                Texto del botón
              </label>
              <Input
                data-testid="msg-action-label"
                value={actionLabel}
                onChange={(e) => setActionLabel(e.target.value)}
                placeholder="Ej: Ver tarjeta"
                maxLength={30}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                URL del botón
              </label>
              <Input
                data-testid="msg-action-url"
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                placeholder="/tarjeta  o  https://..."
              />
              <div className="text-[11px] text-slate-400 mt-1">
                Rutas internas como <code>/tarjeta</code> abren en la app.
                URLs completas (https://...) abren en pestaña nueva.
              </div>
            </div>
          </div>
        </details>

        <Button
          data-testid="msg-send"
          onClick={submit}
          disabled={!canSubmit}
          className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          Enviar mensaje
        </Button>
      </Card>

      {/* History */}
      <Card className="p-5">
        <h3 className="font-heading font-bold text-base">
          Historial ({notifs.length})
        </h3>
        {notifs.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-8">
            Aún no has enviado mensajes.
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {notifs.map((n) => {
              const k = KIND_OPTIONS.find((x) => x.v === n.kind) || KIND_OPTIONS[0];
              const KIcon = k.icon;
              return (
                <div
                  key={n.id}
                  data-testid={`history-${n.id}`}
                  className={`p-3 rounded-xl border ${k.cls}`}
                >
                  <div className="flex items-start gap-2">
                    <KIcon className="w-4 h-4 flex-none mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{n.title}</div>
                      <div className="text-xs opacity-85 mt-0.5">{n.body}</div>
                      <div className="text-[10px] mt-1.5 flex items-center gap-2 flex-wrap opacity-80">
                        <span className="font-semibold uppercase tracking-wider">
                          {n.user_id
                            ? `Para: ${n.recipient_business || n.recipient_email || "usuario"}`
                            : `Segmento: ${segments[n.segment] || n.segment}`}
                        </span>
                        <span>·</span>
                        <span>{new Date(n.created_at * 1000).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}</span>
                        {n.dismissed_count > 0 && (
                          <>
                            <span>·</span>
                            <span>{n.dismissed_count} cerrado{n.dismissed_count === 1 ? "" : "s"}</span>
                          </>
                        )}
                        {n.action_url && (
                          <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1">
                              <ExternalLink className="w-2.5 h-2.5" />
                              {n.action_url}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      data-testid={`del-${n.id}`}
                      onClick={() => remove(n.id)}
                      className="p-1 rounded-md opacity-60 hover:opacity-100 hover:bg-white/50 flex-none"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
