/**
 * AdminAccounts — consolidated super-admin account management.
 *
 * The "Cuentas" view is a dense table (desktop) / stacked cards (mobile) of
 * every user. Clicking a row opens a unified Drawer (AdminAccountDrawer) that
 * manages EVERYTHING about that account (plan, NFC card limit, shipping,
 * impersonate, delete) without leaving the page.
 *
 * A secondary "Invitaciones" view keeps the single-use comp invite generator.
 */
import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Gift, Loader2, Copy, Check, Plus, Trash2, Users, Link as LinkIcon,
  Sparkles, AlertCircle, Calendar, UserPlus, IdCard, Search, ChevronRight, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import AdminTabs from "@/components/AdminTabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import AdminAccountDrawer, {
  PLAN_LABELS, currentPlan, fmtDate,
} from "@/components/AdminAccountDrawer";

const FILTERS = [
  { v: "all", label: "Todos" },
  { v: "active", label: "Activa" },
  { v: "trialing", label: "Trial" },
  { v: "comp", label: "Cortesía" },
  { v: "locked", label: "Sin plan" },
];

function planBadge(u) {
  if (u.is_comp)
    return { label: "Cortesía", cls: "bg-amber-100 text-amber-800" };
  if (u.manual_plan)
    return { label: `${PLAN_LABELS[u.manual_plan] || u.manual_plan} · manual`, cls: "bg-violet-100 text-violet-800" };
  if (u.subscription_status === "active")
    return { label: "Pagado", cls: "bg-emerald-100 text-emerald-800" };
  if (u.subscription_status === "trialing")
    return { label: "Trial", cls: "bg-blue-100 text-blue-800" };
  if (Array.isArray(u.features) && u.features.length === 0)
    return { label: "Bloqueado", cls: "bg-red-100 text-red-700" };
  return { label: "Sin plan", cls: "bg-slate-100 text-slate-600" };
}

function effStatus(u) {
  if (u.is_comp) return "comp";
  if (u.subscription_status === "active") return "active";
  if (u.subscription_status === "trialing") return "trialing";
  if (Array.isArray(u.features) && u.features.length === 0) return "locked";
  if (!u.subscription_status || u.subscription_status === "canceled") return "locked";
  return u.subscription_status;
}

export default function AdminAccounts() {
  const [view, setView] = useState("accounts"); // accounts | invites
  const [forbidden, setForbidden] = useState(false);

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
    <div className="space-y-6" data-testid="admin-accounts-page">
      <AdminTabs />
      <div>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight">
          Cuentas
        </h1>
        <p className="text-slate-500 mt-2 max-w-2xl">
          Gestiona todo de cada cuenta en un solo lugar: toca una cuenta para
          abrir su panel (plan, tarjetas, envíos, acceso) sin cambiar de página.
        </p>
      </div>

      <div className="inline-flex rounded-xl bg-slate-100 p-1">
        <button
          data-testid="view-accounts"
          onClick={() => setView("accounts")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
            view === "accounts" ? "bg-white shadow-sm" : "text-slate-500"
          }`}
        >
          <Users className="w-4 h-4 inline mr-1" /> Cuentas
        </button>
        <button
          data-testid="view-invites"
          onClick={() => setView("invites")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
            view === "invites" ? "bg-white shadow-sm" : "text-slate-500"
          }`}
        >
          <LinkIcon className="w-4 h-4 inline mr-1" /> Invitaciones
        </button>
      </div>

      {view === "accounts" ? (
        <AccountsView onForbidden={() => setForbidden(true)} />
      ) : (
        <InvitesTab onForbidden={() => setForbidden(true)} />
      )}
    </div>
  );
}

function AccountsView({ onForbidden }) {
  const [users, setUsers] = useState([]);
  const [shipMap, setShipMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [backfilling, setBackfilling] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const backfillLeads = async () => {
    setBackfilling(true);
    try {
      const { data } = await api.post("/admin/backfill-card-leads");
      toast.success(`Listo: ${data.updated} contacto(s) viejo(s) actualizado(s)`);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al actualizar contactos");
    } finally {
      setBackfilling(false);
    }
  };

  const cleanupLeadJobs = async () => {
    setCleaning(true);
    try {
      const { data } = await api.post("/admin/cleanup-lead-jobs");
      toast.success(`Listo: ${data.deleted} trabajo(s) de lead viejo(s) eliminado(s)`);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al limpiar trabajos");
    } finally {
      setCleaning(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [u, s] = await Promise.all([
        api.get("/admin/users"),
        api.get("/admin/shipments").catch(() => ({ data: { shipments: [] } })),
      ]);
      const list = u.data.users || [];
      setUsers(list);
      const map = {};
      (s.data.shipments || []).forEach((sh) => {
        map[sh.id] = sh;
      });
      setShipMap(map);
      // keep the open drawer in sync after an action
      setSelected((prev) => (prev ? list.find((x) => x.id === prev.id) || null : null));
    } catch (e) {
      if (e?.response?.status === 403) onForbidden();
      else toast.error("Error al cargar cuentas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (filter !== "all" && effStatus(u) !== filter) return false;
      if (!q) return true;
      return (
        (u.email || "").toLowerCase().includes(q) ||
        (u.business_name || "").toLowerCase().includes(q) ||
        (u.owner_name || "").toLowerCase().includes(q)
      );
    });
  }, [users, search, filter]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            data-testid="accounts-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo..."
            className="pl-9 h-10"
          />
        </div>
        <Button
          data-testid="create-account-btn"
          onClick={() => setCreateOpen(true)}
          className="h-10 bg-blue-900 hover:bg-blue-950 text-white"
        >
          <UserPlus className="w-4 h-4 mr-1.5" /> Crear cuenta
        </Button>
        <Button
          data-testid="backfill-card-leads-btn"
          onClick={backfillLeads}
          disabled={backfilling}
          variant="outline"
          className="h-10 border-slate-200"
          title="Convierte tus contactos viejos de la tarjeta al nuevo formato (intereses, método de contacto, badge)."
        >
          {backfilling ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
          Actualizar contactos viejos
        </Button>
        <Button
          data-testid="cleanup-lead-jobs-btn"
          onClick={cleanupLeadJobs}
          disabled={cleaning}
          variant="outline"
          className="h-10 border-slate-200"
          title="Borra los Trabajos que se crearon solos a partir de leads de la tarjeta (estado 'nuevo lead', sin cotización/factura/fecha)."
        >
          {cleaning ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
          Limpiar trabajos de leads
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5" data-testid="accounts-filter-status">
        {FILTERS.map((f) => (
          <button
            key={f.v}
            data-testid={`filter-${f.v}`}
            onClick={() => setFilter(f.v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === f.v
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-500">
          Sin resultados.
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="p-0 hidden md:block overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200 bg-slate-50">
                  <th className="py-2.5 px-4 font-semibold">Cuenta</th>
                  <th className="py-2.5 px-3 font-semibold">Plan</th>
                  <th className="py-2.5 px-3 font-semibold">Tarjetas</th>
                  <th className="py-2.5 px-3 font-semibold">Registro</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Gestionar</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const b = planBadge(u);
                  return (
                    <tr
                      key={u.id}
                      data-testid="accounts-table-row"
                      onClick={() => setSelected(u)}
                      className="border-b border-slate-100 hover:bg-amber-50/40 cursor-pointer transition"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold truncate max-w-[260px]">
                          {u.business_name || u.owner_name || "—"}
                        </div>
                        <div className="text-xs text-slate-500 truncate">{u.email}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${b.cls}`}>
                          {b.label}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <IdCard className="w-3.5 h-3.5 text-slate-400" /> {u.card_limit || 1}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-500 whitespace-nowrap">
                        {fmtDate(u.created_at)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                          Abrir <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map((u) => {
              const b = planBadge(u);
              return (
                <button
                  key={u.id}
                  data-testid="accounts-table-row"
                  onClick={() => setSelected(u)}
                  className="w-full text-left p-3 rounded-xl border border-slate-200 bg-white hover:border-amber-300 transition flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">
                        {u.business_name || u.owner_name || "—"}
                      </span>
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${b.cls}`}>
                        {b.label}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 truncate">{u.email}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 inline-flex items-center gap-1">
                      <IdCard className="w-3 h-3" /> {u.card_limit || 1} tarjeta(s) · {fmtDate(u.created_at)}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-none" />
                </button>
              );
            })}
          </div>
        </>
      )}

      <AdminAccountDrawer
        user={selected}
        shipment={selected ? shipMap[selected.id] : null}
        onClose={() => setSelected(null)}
        onChanged={load}
      />

      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async () => {
          setCreateOpen(false);
          await load();
        }}
      />
    </div>
  );
}

function InvitesTab({ onForbidden }) {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ email: "", duration_days: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/comp-invites");
      setInvites(data.invites || []);
    } catch (e) {
      if (e?.response?.status === 403) onForbidden();
      else toast.error("Error al cargar invitaciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    setSubmitting(true);
    try {
      const body = { note: form.note || "" };
      if (form.email) body.email = form.email;
      if (form.duration_days) body.duration_days = Number(form.duration_days);
      await api.post("/admin/comp-invites", body);
      toast.success("Invitación creada");
      setForm({ email: "", duration_days: "", note: "" });
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al crear invitación");
    } finally {
      setSubmitting(false);
    }
  };

  const revoke = async (id) => {
    if (!window.confirm("¿Revocar esta invitación?")) return;
    try {
      await api.delete(`/admin/comp-invites/${id}`);
      toast.success("Invitación revocada");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al revocar");
    }
  };

  const inviteUrl = (token) => `${window.location.origin}/register?invite=${token}`;

  const copy = async (token, id) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      setCopiedId(id);
      toast.success("Link copiado al portapapeles");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const share = async (token) => {
    const url = inviteUrl(token);
    if (navigator.share) {
      try {
        await navigator.share({
          title: "UniTech — Acceso gratis",
          text: "Te invito a usar UniTech gratis 👇",
          url,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      copy(token, null);
    }
  };

  const DURATION_OPTIONS = [
    { value: "", label: "Indefinido (sin expiración)" },
    { value: 30, label: "30 días" },
    { value: 90, label: "90 días" },
    { value: 180, label: "6 meses" },
    { value: 365, label: "1 año" },
  ];

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h3 className="font-heading font-bold text-base flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-600" /> Nueva invitación
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Crea un link único que regala acceso completo al registrarse.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <div>
            <label className="text-xs font-semibold text-slate-600">Email (opcional)</label>
            <Input
              data-testid="invite-email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="amigo@ejemplo.com (deja vacío para abierto)"
              className="mt-1"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Si lo llenas, solo ese email puede usar el link.
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Duración</label>
            <select
              data-testid="invite-duration"
              value={form.duration_days}
              onChange={(e) => setForm({ ...form, duration_days: e.target.value })}
              className="mt-1 w-full h-10 px-3 rounded-md border border-slate-200 text-sm bg-white"
            >
              {DURATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label className="text-xs font-semibold text-slate-600">
            Nota interna (solo tú la ves)
          </label>
          <Textarea
            data-testid="invite-note"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Ej: Mi primo Carlos, plomero — me dará feedback"
            rows={2}
            className="mt-1"
          />
        </div>

        <Button
          data-testid="invite-create"
          onClick={submit}
          disabled={submitting}
          className="mt-4 w-full sm:w-auto h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Gift className="w-4 h-4 mr-2" />}
          Generar link
        </Button>
      </Card>

      <Card className="p-5">
        <h3 className="font-heading font-bold text-base">
          Invitaciones creadas ({invites.length})
        </h3>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : invites.length === 0 ? (
          <div className="text-sm text-slate-500 py-6 text-center">
            Aún no has creado ninguna invitación.
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {invites.map((inv) => (
              <div
                key={inv.id}
                data-testid={`invite-row-${inv.id}`}
                className={`p-3 rounded-xl border ${
                  inv.status === "active"
                    ? "border-emerald-200 bg-emerald-50"
                    : inv.status === "used"
                    ? "border-slate-200 bg-slate-50"
                    : "border-red-200 bg-red-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                          inv.status === "active"
                            ? "bg-emerald-200 text-emerald-900"
                            : inv.status === "used"
                            ? "bg-slate-200 text-slate-700"
                            : "bg-red-200 text-red-900"
                        }`}
                      >
                        {inv.status === "active" ? "Activa" : inv.status === "used" ? "Usada" : "Revocada"}
                      </span>
                      {inv.email && (
                        <span className="text-xs text-slate-600 truncate">→ {inv.email}</span>
                      )}
                      {inv.duration_days && (
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {inv.duration_days}d
                        </span>
                      )}
                    </div>
                    {inv.note && (
                      <div className="text-xs text-slate-600 mt-1 italic">"{inv.note}"</div>
                    )}
                    <div className="text-[10px] text-slate-400 mt-1">
                      Creada {fmtDate(inv.created_at)}
                      {inv.used_at && ` · Usada ${fmtDate(inv.used_at)}`}
                    </div>
                  </div>

                  {inv.status === "active" && (
                    <div className="flex items-center gap-1 flex-none">
                      <Button
                        data-testid={`copy-${inv.id}`}
                        onClick={() => copy(inv.token, inv.id)}
                        variant="outline"
                        size="sm"
                        className="h-8 px-2"
                      >
                        {copiedId === inv.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </Button>
                      <Button
                        data-testid={`share-${inv.id}`}
                        onClick={() => share(inv.token)}
                        size="sm"
                        className="h-8 px-3 bg-blue-900 hover:bg-blue-950 text-white"
                      >
                        Compartir
                      </Button>
                      <Button
                        data-testid={`revoke-${inv.id}`}
                        onClick={() => revoke(inv.id)}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {inv.status === "active" && (
                  <div className="mt-2 px-2 py-1.5 bg-white rounded-md text-[10px] text-slate-500 font-mono break-all border border-slate-100">
                    {inviteUrl(inv.token)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function CreateUserDialog({ open, onClose, onCreated }) {
  const empty = {
    email: "",
    password: "",
    business_name: "",
    owner_name: "",
    phone: "",
    grant_comp: false,
    comp_duration_days: "",
    comp_note: "",
  };
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setForm(empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k) => (e) => setForm({ ...form, [k]: e?.target ? e.target.value : e });

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!form.email || !form.password || !form.business_name) {
      toast.error("Email, contraseña y nombre del negocio son obligatorios");
      return;
    }
    if (form.password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        email: form.email.trim().toLowerCase(),
        password: form.password,
        business_name: form.business_name.trim(),
        owner_name: form.owner_name.trim() || "",
        phone: form.phone.trim() || "",
        grant_comp: !!form.grant_comp,
      };
      if (form.grant_comp) {
        body.comp_note = form.comp_note || "";
        if (form.comp_duration_days) body.comp_duration_days = Number(form.comp_duration_days);
      }
      await api.post("/admin/users", body);
      toast.success(form.grant_comp ? "Usuario creado con acceso gratis 🎁" : "Usuario creado");
      await onCreated();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error al crear usuario");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-900" />
            Agregar usuario
          </DialogTitle>
          <DialogDescription>
            Crea una cuenta manualmente. Marca la opción de "regalar acceso" si
            quieres que entre sin pagar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600">Email *</label>
            <Input
              data-testid="create-user-email"
              type="email"
              value={form.email}
              onChange={set("email")}
              placeholder="amigo@ejemplo.com"
              required
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">
              Contraseña * (mínimo 6 caracteres)
            </label>
            <Input
              data-testid="create-user-password"
              type="text"
              value={form.password}
              onChange={set("password")}
              placeholder="Compártela con el usuario"
              required
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">Nombre del negocio *</label>
            <Input
              data-testid="create-user-business"
              value={form.business_name}
              onChange={set("business_name")}
              placeholder="Ej: Plomería Ramirez"
              required
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-slate-600">Nombre del dueño</label>
              <Input
                data-testid="create-user-owner"
                value={form.owner_name}
                onChange={set("owner_name")}
                placeholder="Opcional"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Teléfono</label>
              <Input
                data-testid="create-user-phone"
                value={form.phone}
                onChange={set("phone")}
                placeholder="Opcional"
                className="mt-1"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                data-testid="create-user-grant-comp"
                checked={form.grant_comp}
                onCheckedChange={(v) => setForm({ ...form, grant_comp: !!v })}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-semibold text-amber-900 flex items-center gap-1">
                  <Gift className="w-3.5 h-3.5" /> Regalar acceso gratis
                </div>
                <div className="text-[11px] text-amber-800">
                  Activa la cuenta como gratis sin necesidad de pago.
                </div>
              </div>
            </label>

            {form.grant_comp && (
              <div className="space-y-2 pl-6">
                <div>
                  <label className="text-xs font-semibold text-amber-900">Duración</label>
                  <select
                    data-testid="create-user-comp-duration"
                    value={form.comp_duration_days}
                    onChange={set("comp_duration_days")}
                    className="mt-1 w-full h-9 px-2 rounded-md border border-amber-200 text-sm bg-white"
                  >
                    <option value="">Indefinido</option>
                    <option value={30}>30 días</option>
                    <option value={90}>90 días</option>
                    <option value={180}>6 meses</option>
                    <option value={365}>1 año</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-amber-900">Nota interna</label>
                  <Input
                    data-testid="create-user-comp-note"
                    value={form.comp_note}
                    onChange={set("comp_note")}
                    placeholder="Ej: Beta tester"
                    className="mt-1 bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              data-testid="create-user-cancel"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              data-testid="create-user-submit"
              className="bg-blue-900 hover:bg-blue-950 text-white"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Crear cuenta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
