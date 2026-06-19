/**
 * AdminAccountDrawer — unified Sheet to manage EVERYTHING about one account
 * (plan/access, NFC card limit, shipping activity, impersonate, delete) without
 * leaving the Accounts table. Slides from the right on desktop, bottom on mobile.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, ShieldCheck, IdCard, Package, LogIn, Trash2, Sparkles,
  Truck, CheckCircle2, MapPin, Copy, Check, Mail, Phone, Save, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

export const PLAN_OPTIONS = [
  { value: "trial", label: "Prueba (14 días)" },
  { value: "presencia", label: "Presencia (tarjeta)" },
  { value: "negocio", label: "Negocio (CRM/IA)" },
  { value: "marketing", label: "Marketing" },
  { value: "presencia_negocio", label: "Presencia + Negocio" },
  { value: "presencia_marketing", label: "Presencia + Marketing" },
  { value: "negocio_marketing", label: "Negocio + Marketing" },
  { value: "bundle", label: "Bundle — Todo" },
  { value: "comp", label: "Cortesía (gratis)" },
  { value: "locked", label: "Bloqueado" },
];

export const PLAN_LABELS = PLAN_OPTIONS.reduce(
  (m, o) => ({ ...m, [o.value]: o.label }),
  {}
);

export function currentPlan(u) {
  if (!u) return "locked";
  if (u.is_comp) return "comp";
  if (u.manual_plan) return u.manual_plan;
  if (u.subscription_status === "trialing") return "trial";
  if (["active", "past_due"].includes(u.subscription_status) && u.plan_type) {
    const base = String(u.plan_type).replace(/_(monthly|yearly|manual)$/, "");
    if (
      ["presencia", "negocio", "marketing", "presencia_negocio", "presencia_marketing", "negocio_marketing", "bundle"].includes(base)
    )
      return base;
  }
  return "locked";
}

export function fmtDate(ts) {
  if (!ts) return "—";
  try {
    return new Date(typeof ts === "number" ? ts * 1000 : ts).toLocaleDateString(
      "es-ES",
      { year: "numeric", month: "short", day: "numeric" }
    );
  } catch {
    return "—";
  }
}

const SHIP_META = {
  pending: { label: "Pendiente", cls: "bg-amber-100 text-amber-900 border-amber-200", icon: Package },
  shipped: { label: "Enviada", cls: "bg-blue-100 text-blue-900 border-blue-200", icon: Truck },
  delivered: { label: "Entregada", cls: "bg-emerald-100 text-emerald-900 border-emerald-200", icon: CheckCircle2 },
};

const DURATION_OPTIONS = [
  { value: "", label: "Indefinido (sin expiración)" },
  { value: 30, label: "30 días" },
  { value: 90, label: "90 días" },
  { value: 180, label: "6 meses" },
  { value: 365, label: "1 año" },
];

export default function AdminAccountDrawer({ user, shipment, onClose, onChanged }) {
  const open = !!user;
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[520px] p-0 flex flex-col gap-0 overflow-hidden"
        data-testid="user-detail-drawer"
      >
        {user && (
          <DrawerBody
            user={user}
            shipment={shipment}
            onClose={onClose}
            onChanged={onChanged}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({ user, shipment, onClose, onChanged }) {
  const navigate = useNavigate();
  const { impersonate, user: currentAdmin } = useAuth();
  const isSelf = user.id === currentAdmin?.id;

  const initial = useMemo(() => currentPlan(user), [user]);
  const status = user.is_comp
    ? { label: "Cortesía", cls: "bg-amber-100 text-amber-800" }
    : user.subscription_status === "active"
    ? { label: "Activa", cls: "bg-emerald-100 text-emerald-800" }
    : user.subscription_status === "trialing"
    ? { label: "Trial", cls: "bg-blue-100 text-blue-800" }
    : Array.isArray(user.features) && user.features.length === 0
    ? { label: "Bloqueado", cls: "bg-red-100 text-red-700" }
    : { label: "Sin plan", cls: "bg-slate-100 text-slate-600" };

  const handleImpersonate = async () => {
    if (
      !window.confirm(
        `Vas a entrar a la cuenta de ${user.business_name || user.email}.\n\nVerás la app como ese usuario. Podrás volver con "Volver a mi cuenta".`
      )
    )
      return;
    try {
      await impersonate(user.id);
      toast.success(`Entrando como ${user.email}`);
      navigate("/");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al entrar");
    }
  };

  return (
    <>
      <SheetHeader className="px-5 pt-5 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-slate-900 text-white flex items-center justify-center font-heading font-bold text-lg flex-none">
            {(user.business_name || user.owner_name || user.email || "?")
              .charAt(0)
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <SheetTitle className="font-heading text-lg truncate text-left">
              {user.business_name || user.owner_name || "—"}
            </SheetTitle>
            <div className="text-xs text-slate-500 truncate">{user.email}</div>
          </div>
          <span
            className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${status.cls}`}
          >
            {status.label}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
          {user.phone && (
            <a href={`tel:${user.phone}`} className="inline-flex items-center gap-1 hover:text-slate-700">
              <Phone className="w-3 h-3" /> {user.phone}
            </a>
          )}
          {user.email && (
            <a href={`mailto:${user.email}`} className="inline-flex items-center gap-1 hover:text-slate-700">
              <Mail className="w-3 h-3" /> Email
            </a>
          )}
        </div>
      </SheetHeader>

      <Tabs defaultValue="plan" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-5 mt-3 grid grid-cols-4 bg-slate-100">
          <TabsTrigger value="plan" data-testid="user-drawer-tab-plan" className="text-xs">
            Plan
          </TabsTrigger>
          <TabsTrigger value="nfc" data-testid="user-drawer-tab-nfc" className="text-xs">
            Tarjetas
          </TabsTrigger>
          <TabsTrigger value="activity" data-testid="user-drawer-tab-activity" className="text-xs">
            Actividad
          </TabsTrigger>
          <TabsTrigger value="actions" data-testid="user-drawer-tab-actions" className="text-xs">
            Acciones
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <TabsContent value="plan" className="mt-0">
            <PlanTab user={user} initial={initial} onChanged={onChanged} />
          </TabsContent>
          <TabsContent value="nfc" className="mt-0">
            <NfcTab user={user} onChanged={onChanged} />
          </TabsContent>
          <TabsContent value="activity" className="mt-0">
            <ActivityTab user={user} shipment={shipment} onChanged={onChanged} />
          </TabsContent>
          <TabsContent value="actions" className="mt-0">
            <ActionsTab
              user={user}
              isSelf={isSelf}
              onImpersonate={handleImpersonate}
              onClose={onClose}
              onChanged={onChanged}
            />
          </TabsContent>
        </div>
      </Tabs>
    </>
  );
}

function PlanTab({ user, initial, onChanged }) {
  const [plan, setPlan] = useState(initial);
  const [note, setNote] = useState(user.comp_note || "");
  const [duration, setDuration] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      if (plan === "comp") {
        const body = { note: note || "" };
        if (duration) body.duration_days = Number(duration);
        await api.post(`/admin/users/${user.id}/grant-comp`, body);
      } else {
        if (
          plan === "locked" &&
          !window.confirm(
            `¿Bloquear el acceso de ${user.email}?\nNo podrá crear ni editar nada (solo ver sus datos).`
          )
        ) {
          setSaving(false);
          return;
        }
        await api.post(`/admin/users/${user.id}/set-plan`, { plan });
      }
      toast.success(`Plan actualizado: ${PLAN_LABELS[plan] || plan}`);
      await onChanged();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al actualizar plan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-semibold text-slate-600 block mb-1.5">
          Plan asignado
        </label>
        <Select value={plan} onValueChange={setPlan}>
          <SelectTrigger data-testid="plan-select-dropdown" className="h-11">
            <SelectValue placeholder="Selecciona un plan" />
          </SelectTrigger>
          <SelectContent>
            {PLAN_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} data-testid={`plan-option-${o.value}`}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-slate-400 mt-1.5">
          Asignación manual sin Stripe. "Bloqueado" deja al usuario solo lectura.
        </p>
      </div>

      {plan === "comp" && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-3" data-testid="comp-access-panel">
          <div className="text-sm font-semibold text-amber-900 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> Acceso de cortesía
          </div>
          <div>
            <label className="text-xs font-semibold text-amber-900 block mb-1">
              Expiración
            </label>
            <select
              data-testid="comp-duration"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-amber-200 text-sm bg-white"
            >
              {DURATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-amber-900 block mb-1">
              Nota interna (solo tú la ves)
            </label>
            <Textarea
              data-testid="comp-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: Beta tester, mi primo Carlos…"
              rows={2}
              className="bg-white"
            />
          </div>
        </div>
      )}

      {user.comp_note && plan !== "comp" && (
        <div className="text-[11px] text-amber-700 italic">
          Nota cortesía actual: "{user.comp_note}"
          {user.comp_expires_at && <> · expira {fmtDate(user.comp_expires_at)}</>}
        </div>
      )}

      <Button
        data-testid="plan-save-btn"
        onClick={save}
        disabled={saving}
        className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-semibold"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
        Guardar cambios
      </Button>
    </div>
  );
}

function NfcTab({ user, onChanged }) {
  const [limit, setLimit] = useState(String(user.card_limit || 1));
  const [charge, setCharge] = useState(false);
  const [saving, setSaving] = useState(false);

  const current = user.card_limit || 1;
  const hasStripe =
    !user.is_comp &&
    ["active", "trialing", "past_due"].includes(user.subscription_status);

  const save = async () => {
    const total = parseInt(limit, 10);
    if (isNaN(total) || total < 1) {
      toast.error("Número inválido");
      return;
    }
    setSaving(true);
    try {
      if (charge && total > current && hasStripe) {
        await api.post(`/admin/users/${user.id}/card-seats`, { card_limit: total });
        toast.success("Tarjetas actualizadas en Stripe (cobro próximo ciclo)");
      } else {
        await api.post(`/admin/users/${user.id}/card-limit`, { card_limit: total });
        toast.success("Límite de tarjetas actualizado (gratis)");
      }
      await onChanged();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 text-sm">
        <IdCard className="w-4 h-4 text-slate-500" />
        Tarjetas digitales actuales: <span className="font-bold">{current}</span>
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600 block mb-1.5">
          Límite de tarjetas NFC (total)
        </label>
        <Input
          data-testid="card-limit-input"
          type="number"
          min={1}
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          className="h-11"
        />
      </div>

      {hasStripe && (
        <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 cursor-pointer">
          <input
            type="checkbox"
            data-testid="card-charge-toggle"
            checked={charge}
            onChange={(e) => setCharge(e.target.checked)}
            className="mt-1 w-4 h-4 accent-amber-600"
          />
          <div>
            <div className="text-sm font-semibold text-slate-800">
              Cobrar en próximo ciclo Stripe
            </div>
            <div className="text-[11px] text-slate-500">
              +$15/mes por tarjeta extra. Si lo dejas apagado, las tarjetas son gratis (cortesía).
            </div>
          </div>
        </label>
      )}

      <Button
        data-testid="card-limit-save-btn"
        onClick={save}
        disabled={saving}
        className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-semibold"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
        Guardar límite
      </Button>
    </div>
  );
}

function ActivityTab({ user, shipment, onChanged }) {
  if (!shipment) {
    return (
      <div className="text-center py-8 text-sm text-slate-500">
        <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
        Sin envío de tarjeta NFC registrado para esta cuenta.
        <div className="mt-3 text-xs text-slate-400">
          Registrado: {fmtDate(user.created_at)}
          {user.trial_ends_at && <> · Trial vence {fmtDate(user.trial_ends_at)}</>}
        </div>
      </div>
    );
  }
  return <ShipmentEditor shipment={shipment} onChanged={onChanged} />;
}

function ShipmentEditor({ shipment, onChanged }) {
  const [status, setStatus] = useState(shipment.card_shipping_status || "pending");
  const [tracking, setTracking] = useState(shipment.card_tracking_number || "");
  const [note, setNote] = useState(shipment.card_shipping_note || "");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const a = shipment.shipping_address;

  const copyAddress = async () => {
    if (!a) return;
    const lines = [
      a.name, a.line1, a.line2,
      [a.city, a.state, a.postal_code].filter(Boolean).join(", "),
      a.country,
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      toast.success("Dirección copiada");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.post(`/admin/shipments/${shipment.id}`, {
        status,
        tracking_number: tracking,
        note,
      });
      toast.success("Envío actualizado");
      await onChanged();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al actualizar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {a ? (
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700">
          <div className="flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400 flex-none mt-0.5" />
            <div className="flex-1 min-w-0">
              {a.name && <div className="font-semibold">{a.name}</div>}
              <div>{[a.line1, a.line2].filter(Boolean).join(", ")}</div>
              <div className="text-slate-500">
                {[[a.city, a.state].filter(Boolean).join(", "), a.postal_code, a.country].filter(Boolean).join(" · ")}
              </div>
            </div>
            <button
              data-testid="copy-address-btn"
              onClick={copyAddress}
              className="flex-none p-1 rounded-md hover:bg-white"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-amber-700 italic">
          Sin dirección — pide al usuario que actualice su perfil de cobro.
        </div>
      )}

      <div>
        <label className="text-xs font-semibold text-slate-600 block mb-1.5">Estado del envío</label>
        <div className="grid grid-cols-3 gap-2">
          {["pending", "shipped", "delivered"].map((s) => {
            const meta = SHIP_META[s];
            const Icon = meta.icon;
            return (
              <button
                key={s}
                data-testid={`ship-status-${s}`}
                onClick={() => setStatus(s)}
                type="button"
                className={`p-2 rounded-xl border text-xs font-semibold transition flex items-center justify-center gap-1 ${
                  status === s
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 block mb-1.5"># de tracking</label>
        <Input
          data-testid="ship-tracking-input"
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          placeholder="USPS, FedEx, UPS…"
          className="h-11"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 block mb-1.5">Nota interna</label>
        <Textarea
          data-testid="ship-note-input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ej: Salió hoy en sobre acolchado"
          rows={2}
        />
      </div>

      <Button
        data-testid="ship-save-btn"
        onClick={save}
        disabled={saving}
        className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
        Guardar envío
      </Button>
    </div>
  );
}

function ActionsTab({ user, isSelf, onImpersonate, onClose, onChanged }) {
  const [deleting, setDeleting] = useState(false);

  const deleteUser = async () => {
    if (
      !window.confirm(
        `⚠️ ¿Eliminar PERMANENTEMENTE a ${user.email}?\n\nEsto borra su cuenta, clientes, quotes, invoices, contratos, trabajos y agenda.\n\nEsta acción NO se puede deshacer.`
      )
    )
      return;
    if (user.subscription_status === "active" && !user.is_comp) {
      if (
        !window.confirm(
          `⚠️ ${user.email} tiene una suscripción ACTIVA en Stripe.\nBorrar la cuenta NO cancela el cobro de Stripe — eso se hace por separado.\n\n¿Continuar igual?`
        )
      )
        return;
    }
    const typed = window.prompt(`Para confirmar, escribe el email exacto:\n${user.email}`, "");
    if (typed !== user.email) {
      if (typed !== null) toast.error("Email no coincide. Cancelado.");
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/admin/users/${user.id}`);
      toast.success(`Cuenta de ${user.email} eliminada`);
      onClose();
      await onChanged();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        data-testid="action-impersonate-btn"
        onClick={onImpersonate}
        disabled={isSelf}
        className="w-full flex items-center gap-3 p-4 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 transition text-left disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <LogIn className="w-5 h-5 text-amber-700 flex-none" />
        <div>
          <div className="font-semibold text-amber-900">Entrar como usuario</div>
          <div className="text-[11px] text-amber-800">
            Verás la app como este usuario. Podrás volver cuando quieras.
          </div>
        </div>
      </button>

      <div className="pt-2 border-t border-slate-200">
        <div className="flex items-center gap-1.5 text-xs font-bold text-red-600 uppercase tracking-wider mb-2">
          <AlertTriangle className="w-3.5 h-3.5" /> Zona peligrosa
        </div>
        <button
          data-testid="action-delete-account-btn"
          onClick={deleteUser}
          disabled={deleting || isSelf}
          className="w-full flex items-center gap-3 p-4 rounded-xl border border-red-300 bg-red-50 hover:bg-red-100 transition text-left disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {deleting ? (
            <Loader2 className="w-5 h-5 text-red-600 animate-spin flex-none" />
          ) : (
            <Trash2 className="w-5 h-5 text-red-600 flex-none" />
          )}
          <div>
            <div className="font-semibold text-red-700">Eliminar cuenta permanentemente</div>
            <div className="text-[11px] text-red-600/80">
              Borra todo. No se puede deshacer. {isSelf && "(No puedes borrar tu propia cuenta)"}
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
