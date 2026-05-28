/**
 * AdminShipments — Super-admin-only page for tracking which paying users
 * need their physical NFC Google Reviews card shipped.
 *
 * Workflow:
 *   1. User pays via Stripe Checkout → shipping address auto-collected.
 *   2. Webhook stores `shipping_address` + `card_shipping_status="pending"`.
 *   3. Admin sees them here, prints label, marks "Enviada" w/ tracking #.
 *   4. When confirmed delivered, mark "Entregada".
 */
import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Package, Loader2, AlertCircle, Truck, CheckCircle2, Copy, Check,
  MapPin, Sparkles, Phone, Mail, Filter, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import AdminTabs from "@/components/AdminTabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

const STATUS_META = {
  pending:   { label: "Pendiente",  cls: "bg-amber-100 text-amber-900 border-amber-200", icon: Package },
  shipped:   { label: "Enviada",    cls: "bg-blue-100 text-blue-900 border-blue-200",    icon: Truck },
  delivered: { label: "Entregada",  cls: "bg-emerald-100 text-emerald-900 border-emerald-200", icon: CheckCircle2 },
};

function formatTs(ts) {
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

function formatAddress(a) {
  if (!a) return null;
  const line1 = a.line1 || "";
  const line2 = a.line2 ? `, ${a.line2}` : "";
  const cityState = [a.city, a.state].filter(Boolean).join(", ");
  const tail = [cityState, a.postal_code, a.country].filter(Boolean).join(" · ");
  return { line1: `${line1}${line2}`, tail };
}

export default function AdminShipments() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // shipment row being edited

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/shipments");
      setItems(data.shipments || []);
    } catch (e) {
      if (e?.response?.status === 403) setForbidden(true);
      else toast.error("Error al cargar envíos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((u) => {
      if (statusFilter !== "all" && (u.card_shipping_status || "pending") !== statusFilter)
        return false;
      if (!q) return true;
      return (
        (u.email || "").toLowerCase().includes(q) ||
        (u.business_name || "").toLowerCase().includes(q) ||
        (u.owner_name || "").toLowerCase().includes(q)
      );
    });
  }, [items, statusFilter, search]);

  const counts = useMemo(() => {
    const c = { pending: 0, shipped: 0, delivered: 0 };
    items.forEach((u) => {
      const s = u.card_shipping_status || "pending";
      if (c[s] !== undefined) c[s] += 1;
    });
    return c;
  }, [items]);

  if (forbidden) {
    return (
      <>
        <AdminTabs />
        <Card className="p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h2 className="font-heading text-xl font-bold mt-3">Acceso denegado</h2>
          <p className="text-slate-500 mt-1 text-sm">
            Esta sección es solo para el admin principal.
          </p>
        </Card>
      </>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-shipments-page">
      <AdminTabs />
      <div>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight">
          Envíos de tarjetas NFC
        </h1>
        <p className="text-slate-500 mt-2 max-w-2xl">
          Lista de clientes pagos esperando su tarjeta física Google Reviews.
          La dirección se captura automáticamente en Stripe Checkout.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { key: "pending",   label: "Pendientes",  color: "amber" },
          { key: "shipped",   label: "Enviadas",    color: "blue" },
          { key: "delivered", label: "Entregadas",  color: "emerald" },
        ].map((s) => (
          <button
            key={s.key}
            data-testid={`stat-${s.key}`}
            onClick={() => setStatusFilter(s.key === statusFilter ? "all" : s.key)}
            className={`p-4 rounded-2xl border text-left transition ${
              statusFilter === s.key
                ? `bg-${s.color}-50 border-${s.color}-300`
                : "bg-white border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="text-xs text-slate-500 uppercase tracking-wider font-bold">
              {s.label}
            </div>
            <div className="text-3xl font-heading font-bold mt-1">
              {counts[s.key]}
            </div>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <Card className="p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" /> Filtro:
          </div>
          {["all", "pending", "shipped", "delivered"].map((s) => (
            <button
              key={s}
              data-testid={`filter-${s}`}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === s
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s === "all" ? "Todos" : STATUS_META[s]?.label}
            </button>
          ))}
          <div className="flex-1 min-w-[180px]" />
          <Input
            data-testid="shipments-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar email o negocio..."
            className="max-w-xs h-9"
          />
        </div>
      </Card>

      {/* List */}
      <Card className="p-5">
        <h3 className="font-heading font-bold text-base">
          Envíos ({filtered.length})
        </h3>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-slate-500 py-10 text-center">
            <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            No hay envíos en este filtro.
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {filtered.map((u) => (
              <ShipmentRow key={u.id} item={u} onEdit={() => setEditing(u)} />
            ))}
          </div>
        )}
      </Card>

      <ShipmentDialog
        item={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await load();
        }}
      />
    </div>
  );
}

function ShipmentRow({ item, onEdit }) {
  const status = item.card_shipping_status || "pending";
  const meta = STATUS_META[status] || STATUS_META.pending;
  const Icon = meta.icon;
  const addr = formatAddress(item.shipping_address);
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (!item.shipping_address) return;
    const a = item.shipping_address;
    const lines = [
      a.name,
      a.line1,
      a.line2,
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

  return (
    <div
      data-testid={`shipment-row-${item.id}`}
      className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">
              {item.business_name || item.owner_name || "—"}
            </span>
            <span
              className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${meta.cls}`}
            >
              <Icon className="w-2.5 h-2.5" /> {meta.label}
            </span>
            {item.is_comp && (
              <span className="text-[10px] uppercase tracking-wider font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> Gratis
              </span>
            )}
            {item.plan_type && !item.is_comp && (
              <span className="text-[10px] uppercase tracking-wider font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                {item.plan_type}
              </span>
            )}
          </div>

          <div className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
            {item.email && (
              <a
                href={`mailto:${item.email}`}
                className="inline-flex items-center gap-1 hover:text-slate-700"
              >
                <Mail className="w-3 h-3" /> {item.email}
              </a>
            )}
            {item.phone && (
              <a
                href={`tel:${item.phone}`}
                className="inline-flex items-center gap-1 hover:text-slate-700"
              >
                <Phone className="w-3 h-3" /> {item.phone}
              </a>
            )}
          </div>

          {addr ? (
            <div className="mt-2 p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-700">
              <div className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 flex-none mt-0.5" />
                <div className="flex-1 min-w-0">
                  {item.shipping_address?.name && (
                    <div className="font-semibold">{item.shipping_address.name}</div>
                  )}
                  <div>{addr.line1}</div>
                  <div className="text-slate-500">{addr.tail}</div>
                </div>
                <button
                  data-testid={`copy-address-${item.id}`}
                  onClick={copyAddress}
                  className="flex-none p-1 rounded-md hover:bg-white"
                  title="Copiar dirección"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 text-[11px] text-amber-700 italic">
              Sin dirección — pide al usuario que actualice su perfil de cobro.
            </div>
          )}

          <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400 flex-wrap">
            {item.card_shipped_at && (
              <span>Enviada {formatTs(item.card_shipped_at)}</span>
            )}
            {item.card_delivered_at && (
              <span>Entregada {formatTs(item.card_delivered_at)}</span>
            )}
            {item.card_tracking_number && (
              <span className="font-mono">#{item.card_tracking_number}</span>
            )}
            {item.card_shipping_note && (
              <span className="italic">"{item.card_shipping_note}"</span>
            )}
          </div>
        </div>

        <Button
          data-testid={`edit-shipment-${item.id}`}
          onClick={onEdit}
          variant="outline"
          size="sm"
          className="h-9 flex-none"
        >
          Actualizar
        </Button>
      </div>
    </div>
  );
}

function ShipmentDialog({ item, onClose, onSaved }) {
  const [status, setStatus] = useState("pending");
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setStatus(item.card_shipping_status || "pending");
      setTracking(item.card_tracking_number || "");
      setNote(item.card_shipping_note || "");
    }
  }, [item]);

  const submit = async () => {
    if (!item) return;
    setSaving(true);
    try {
      await api.post(`/admin/shipments/${item.id}`, {
        status,
        tracking_number: tracking,
        note,
      });
      toast.success("Envío actualizado");
      await onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al actualizar");
    } finally {
      setSaving(false);
    }
  };

  const trackingUrl = (n) => {
    if (!n) return null;
    // Generic tracking lookup helper.
    return `https://www.google.com/search?q=${encodeURIComponent(n + " tracking")}`;
  };

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-900" /> Actualizar envío
          </DialogTitle>
          <DialogDescription>
            {item?.business_name || item?.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">
              Estado
            </label>
            <div className="grid grid-cols-3 gap-2">
              {["pending", "shipped", "delivered"].map((s) => {
                const meta = STATUS_META[s];
                const Icon = meta.icon;
                return (
                  <button
                    key={s}
                    data-testid={`set-status-${s}`}
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
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">
              # de tracking
            </label>
            <Input
              data-testid="ship-tracking"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="USPS, FedEx, UPS..."
            />
            {tracking && (
              <a
                href={trackingUrl(tracking)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-blue-700 hover:underline mt-1 inline-flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" /> Buscar tracking
              </a>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">
              Nota interna (opcional)
            </label>
            <Textarea
              data-testid="ship-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: Salió hoy en sobre acolchado"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            data-testid="ship-cancel"
          >
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={saving}
            data-testid="ship-save"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-2" />
            )}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
