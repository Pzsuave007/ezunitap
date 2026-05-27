/**
 * AdminAccounts — Super-admin-only page for granting complimentary (free)
 * accounts to friends, beta testers, and reviewers.
 *
 * Two tabs:
 *   1. Invitaciones — generate a single-use signup link that auto-grants
 *      comp access on signup.
 *   2. Usuarios — list of all users with a button to grant/revoke comp.
 */
import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Gift, Loader2, Copy, Check, Plus, Trash2, Users, Link as LinkIcon,
  X, Sparkles, AlertCircle, Calendar, UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import AdminTabs from "@/components/AdminTabs";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

function formatDate(ts) {
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

const DURATION_OPTIONS = [
  { value: "", label: "Indefinido (sin expiración)" },
  { value: 30, label: "30 días" },
  { value: 90, label: "90 días" },
  { value: 180, label: "6 meses" },
  { value: 365, label: "1 año" },
];

export default function AdminAccounts() {
  const [tab, setTab] = useState("invites");
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
          Cuentas gratis
        </h1>
        <p className="text-slate-500 mt-2 max-w-2xl">
          Regala acceso completo a amigos, beta-testers o reviewers sin
          cobrarles. Genera un link de invitación o marca un usuario existente
          como cuenta gratis.
        </p>
      </div>

      <div className="inline-flex rounded-xl bg-slate-100 p-1">
        <button
          data-testid="tab-invites"
          onClick={() => setTab("invites")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
            tab === "invites" ? "bg-white shadow-sm" : "text-slate-500"
          }`}
        >
          <LinkIcon className="w-4 h-4 inline mr-1" /> Invitaciones
        </button>
        <button
          data-testid="tab-users"
          onClick={() => setTab("users")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
            tab === "users" ? "bg-white shadow-sm" : "text-slate-500"
          }`}
        >
          <Users className="w-4 h-4 inline mr-1" /> Usuarios
        </button>
      </div>

      {tab === "invites" ? (
        <InvitesTab onForbidden={() => setForbidden(true)} />
      ) : (
        <UsersTab onForbidden={() => setForbidden(true)} />
      )}
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
      const body = {
        note: form.note || "",
      };
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

  const inviteUrl = (token) =>
    `${window.location.origin}/register?invite=${token}`;

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
          title: "Unitap — Acceso gratis",
          text: "Te invito a usar Unitap gratis 👇",
          url,
        });
      } catch {
        // user cancelled
      }
    } else {
      copy(token, null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Create form */}
      <Card className="p-5">
        <h3 className="font-heading font-bold text-base flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-600" /> Nueva invitación
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Crea un link único que regala acceso completo al registrarse.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <div>
            <label className="text-xs font-semibold text-slate-600">
              Email (opcional)
            </label>
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
            <label className="text-xs font-semibold text-slate-600">
              Duración
            </label>
            <select
              data-testid="invite-duration"
              value={form.duration_days}
              onChange={(e) =>
                setForm({ ...form, duration_days: e.target.value })
              }
              className="mt-1 w-full h-10 px-3 rounded-md border border-slate-200 text-sm bg-white"
            >
              {DURATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
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
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Gift className="w-4 h-4 mr-2" />
          )}
          Generar link
        </Button>
      </Card>

      {/* Invites list */}
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
                        {inv.status === "active"
                          ? "Activa"
                          : inv.status === "used"
                          ? "Usada"
                          : "Revocada"}
                      </span>
                      {inv.email && (
                        <span className="text-xs text-slate-600 truncate">
                          → {inv.email}
                        </span>
                      )}
                      {inv.duration_days && (
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {inv.duration_days}d
                        </span>
                      )}
                    </div>
                    {inv.note && (
                      <div className="text-xs text-slate-600 mt-1 italic">
                        "{inv.note}"
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400 mt-1">
                      Creada {formatDate(inv.created_at)}
                      {inv.used_at && ` · Usada ${formatDate(inv.used_at)}`}
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

function UsersTab({ onForbidden }) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [grantingId, setGrantingId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/users");
      setUsers(data.users || []);
    } catch (e) {
      if (e?.response?.status === 403) onForbidden();
      else toast.error("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grant = async (userId) => {
    const days = window.prompt(
      "¿Por cuántos días? (deja vacío para indefinido)",
      ""
    );
    if (days === null) return;
    const note = window.prompt("Nota interna (opcional):", "") || "";
    setGrantingId(userId);
    try {
      const body = { note };
      if (days && !isNaN(Number(days))) body.duration_days = Number(days);
      await api.post(`/admin/users/${userId}/grant-comp`, body);
      toast.success("Acceso gratis otorgado");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error");
    } finally {
      setGrantingId(null);
    }
  };

  const revoke = async (userId) => {
    if (!window.confirm("¿Revocar el acceso gratis de este usuario?")) return;
    setGrantingId(userId);
    try {
      await api.post(`/admin/users/${userId}/revoke-comp`);
      toast.success("Acceso revocado");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error");
    } finally {
      setGrantingId(null);
    }
  };

  const deleteUser = async (u) => {
    const confirmMsg =
      `⚠️ ¿Eliminar PERMANENTEMENTE a ${u.email}?\n\n` +
      `Esto borra su cuenta, clientes, quotes, invoices, contratos, trabajos y agenda.\n\n` +
      `Esta acción NO se puede deshacer.`;
    if (!window.confirm(confirmMsg)) return;
    const typed = window.prompt(
      `Para confirmar, escribe el email exacto:\n${u.email}`,
      ""
    );
    if (typed !== u.email) {
      if (typed !== null) toast.error("Email no coincide. Cancelado.");
      return;
    }
    setGrantingId(u.id);
    try {
      await api.delete(`/admin/users/${u.id}`);
      toast.success(`Cuenta de ${u.email} eliminada`);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al eliminar");
    } finally {
      setGrantingId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.email || "").toLowerCase().includes(q) ||
        (u.business_name || "").toLowerCase().includes(q) ||
        (u.owner_name || "").toLowerCase().includes(q)
    );
  }, [users, search]);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h3 className="font-heading font-bold text-base">
            Usuarios ({users.length})
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              data-testid="users-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar email o negocio..."
              className="max-w-xs h-9"
            />
            <Button
              data-testid="add-user-btn"
              onClick={() => setCreateOpen(true)}
              className="h-9 bg-blue-900 hover:bg-blue-950 text-white"
            >
              <UserPlus className="w-4 h-4 mr-1.5" /> Agregar usuario
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-slate-500 py-6 text-center">
            Sin resultados.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((u) => {
              const isSelf = u.id === currentUser?.id;
              return (
                <div
                  key={u.id}
                  data-testid={`user-row-${u.id}`}
                  className="p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">
                        {u.business_name || u.owner_name || "—"}
                      </span>
                      {isSelf && (
                        <span className="text-[10px] uppercase tracking-wider font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                          Tú
                        </span>
                      )}
                      {u.is_comp && (
                        <span className="text-[10px] uppercase tracking-wider font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" /> Gratis
                        </span>
                      )}
                      {u.subscription_status === "active" && !u.is_comp && (
                        <span className="text-[10px] uppercase tracking-wider font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                          Pagado
                        </span>
                      )}
                      {u.subscription_status === "trialing" && !u.is_comp && (
                        <span className="text-[10px] uppercase tracking-wider font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                          Trial
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {u.email}
                    </div>
                    {u.comp_note && (
                      <div className="text-[10px] text-amber-700 italic mt-0.5">
                        "{u.comp_note}"
                        {u.comp_expires_at && (
                          <> · expira {formatDate(u.comp_expires_at)}</>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex-none flex items-center gap-1">
                    {u.is_comp ? (
                      <Button
                        data-testid={`revoke-user-${u.id}`}
                        onClick={() => revoke(u.id)}
                        disabled={grantingId === u.id}
                        variant="outline"
                        size="sm"
                        className="h-9"
                      >
                        {grantingId === u.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <X className="w-3.5 h-3.5 mr-1" />
                        )}
                        Revocar
                      </Button>
                    ) : (
                      <Button
                        data-testid={`grant-user-${u.id}`}
                        onClick={() => grant(u.id)}
                        disabled={grantingId === u.id}
                        size="sm"
                        className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {grantingId === u.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Gift className="w-3.5 h-3.5 mr-1" />
                        )}
                        Regalar
                      </Button>
                    )}
                    {!isSelf && (
                      <Button
                        data-testid={`delete-user-${u.id}`}
                        onClick={() => deleteUser(u)}
                        disabled={grantingId === u.id}
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Eliminar cuenta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

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

  const set = (k) => (e) =>
    setForm({ ...form, [k]: e?.target ? e.target.value : e });

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
        if (form.comp_duration_days)
          body.comp_duration_days = Number(form.comp_duration_days);
      }
      await api.post("/admin/users", body);
      toast.success(
        form.grant_comp
          ? "Usuario creado con acceso gratis 🎁"
          : "Usuario creado"
      );
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
            <label className="text-xs font-semibold text-slate-600">
              Email *
            </label>
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
            <label className="text-xs font-semibold text-slate-600">
              Nombre del negocio *
            </label>
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
              <label className="text-xs font-semibold text-slate-600">
                Nombre del dueño
              </label>
              <Input
                data-testid="create-user-owner"
                value={form.owner_name}
                onChange={set("owner_name")}
                placeholder="Opcional"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">
                Teléfono
              </label>
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
                  <label className="text-xs font-semibold text-amber-900">
                    Duración
                  </label>
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
                  <label className="text-xs font-semibold text-amber-900">
                    Nota interna
                  </label>
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
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              Crear cuenta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
