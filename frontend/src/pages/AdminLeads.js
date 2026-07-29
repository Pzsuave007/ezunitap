/**
 * AdminLeads — Super admin only. List/follow-up UniTech platform leads
 * captured by the public AI chat on the landing page.
 */
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Phone, Mail, MessageSquareText, Trash2, CheckCircle2,
  Clock, UserCheck, Inbox, ShieldAlert, RefreshCcw,
  Star, UserPlus, Search, X, MessageCircle, CheckSquare, Square, Flame,
} from "lucide-react";
import { toast } from "sonner";
import AdminTabs from "@/components/AdminTabs";

const STATUS_STYLES = {
  new: { label: "Nuevo", color: "bg-amber-100 text-amber-800 border-amber-200", icon: Clock },
  contacted: { label: "Contactado", color: "bg-blue-100 text-blue-800 border-blue-200", icon: UserCheck },
  converted: { label: "Convertido", color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: CheckCircle2 },
  dismissed: { label: "Descartado", color: "bg-slate-100 text-slate-600 border-slate-200", icon: Trash2 },
};

const DEMO_STATUS = {
  potential: { label: "⭐ Potencial", color: "bg-amber-100 text-amber-800 border-amber-200" },
  contacted: { label: "Contactado", color: "bg-blue-100 text-blue-800 border-blue-200" },
  customer: { label: "✓ En mi CRM", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  dismissed: { label: "Descartado", color: "bg-slate-100 text-slate-500 border-slate-200" },
};

const waLink = (phone, text) => {
  const digits = (phone || "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text || "")}`;
};

export default function AdminLeads() {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [source, setSource] = useState("demo");
  const [demoLeads, setDemoLeads] = useState([]);
  const [demoFilter, setDemoFilter] = useState("all");
  const [demoSearch, setDemoSearch] = useState("");
  const [selected, setSelected] = useState(new Set());

  // Fast-path: trust the logged-in user's email (matches the sidebar logic)
  const SUPER_ADMIN_EMAILS = ["pzsuave007@gmail.com"];
  const isSuperAdminByEmail = !!user?.email && SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase());

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Try the backend check first (canonical), fall back to email check
        const { data } = await api.get("/auth/is-super-admin");
        if (!mounted) return;
        setAllowed(!!data.is_super_admin || isSuperAdminByEmail);
        if (data.is_super_admin || isSuperAdminByEmail) { await loadLeads(); await loadDemoLeads(); }
      } catch {
        if (mounted) {
          setAllowed(isSuperAdminByEmail);
          if (isSuperAdminByEmail) { await loadLeads(); await loadDemoLeads(); }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  const loadLeads = async () => {
    try {
      const { data } = await api.get("/admin/platform-leads");
      setLeads(data.leads || []);
    } catch (e) {
      toast.error("No se pudieron cargar los leads");
    }
  };

  const loadDemoLeads = async () => {
    try {
      const { data } = await api.get("/admin/demo-leads");
      setDemoLeads(data.leads || []);
    } catch (e) {
      // silent: demo leads are secondary
    }
  };

  const updateLead = async (id, patch) => {
    try {
      const { data } = await api.put(`/admin/platform-leads/${id}`, patch);
      setLeads((ls) => ls.map((l) => (l.id === id ? data.lead : l)));
      toast.success("Lead actualizado");
    } catch {
      toast.error("Error al actualizar");
    }
  };

  const deleteLead = async (id) => {
    if (!window.confirm("¿Borrar este lead permanentemente?")) return;
    try {
      await api.delete(`/admin/platform-leads/${id}`);
      setLeads((ls) => ls.filter((l) => l.id !== id));
      toast.success("Lead borrado");
    } catch {
      toast.error("Error al borrar");
    }
  };

  // ---- Demo lead actions ----
  const updateDemoLead = async (id, patch) => {
    try {
      const { data } = await api.put(`/admin/demo-leads/${id}`, patch);
      setDemoLeads((ls) => ls.map((l) => (l.id === id ? data.lead : l)));
      toast.success("Lead actualizado");
    } catch {
      toast.error("Error al actualizar");
    }
  };

  const deleteDemoLead = async (id) => {
    if (!window.confirm("¿Borrar este lead del demo?")) return;
    try {
      await api.delete(`/admin/demo-leads/${id}`);
      setDemoLeads((ls) => ls.filter((l) => l.id !== id));
      setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
      toast.success("Lead borrado");
    } catch {
      toast.error("Error al borrar");
    }
  };

  const bulkDeleteDemo = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!window.confirm(`¿Borrar ${ids.length} lead(s) seleccionado(s)?`)) return;
    try {
      await api.post("/admin/demo-leads/bulk-delete", { ids });
      setDemoLeads((ls) => ls.filter((l) => !selected.has(l.id)));
      setSelected(new Set());
      toast.success(`${ids.length} lead(s) borrado(s)`);
    } catch {
      toast.error("Error al borrar en lote");
    }
  };

  const demoToClient = async (id) => {
    try {
      const { data } = await api.post(`/admin/demo-leads/${id}/to-client`);
      setDemoLeads((ls) => ls.map((l) => (l.id === id ? data.lead : l)));
      toast.success(data.reused ? "Ya existía en tu CRM — actualizado" : "¡Agregado a tu CRM como cliente!");
    } catch {
      toast.error("No se pudo agregar al CRM");
    }
  };

  const toggleSelect = (id) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  if (!user) return <Navigate to="/login" replace />;
  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  );
  if (!allowed) return (
    <div className="max-w-md mx-auto p-6">
      <AdminTabs />
      <Card className="p-8 text-center border-red-200 bg-red-50">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-red-900 mb-2">Acceso restringido</h2>
        <p className="text-sm text-red-700">Esta sección es solo para el super administrador de UniTech.</p>
      </Card>
    </div>
  );

  const filtered = filter === "all" ? leads : leads.filter((l) => l.status === filter);
  const counts = {
    all: leads.length,
    new: leads.filter((l) => l.status === "new").length,
    contacted: leads.filter((l) => l.status === "contacted").length,
    converted: leads.filter((l) => l.status === "converted").length,
    dismissed: leads.filter((l) => l.status === "dismissed").length,
  };

  // ---- Demo leads: search + filter + summary ----
  const q = demoSearch.trim().toLowerCase();
  const demoSearched = q
    ? demoLeads.filter((l) =>
        [(l.name || ""), (l.email || ""), (l.phone || ""), (l.trade || "")]
          .join(" ").toLowerCase().includes(q))
    : demoLeads;
  const demoFiltered = demoFilter === "all"
    ? demoSearched
    : demoFilter === "hot"
      ? demoSearched.filter((l) => l.completed)
      : demoSearched.filter((l) => (l.status || "new") === demoFilter);
  const demoCounts = {
    all: demoLeads.length,
    hot: demoLeads.filter((l) => l.completed).length,
    potential: demoLeads.filter((l) => l.status === "potential").length,
    customer: demoLeads.filter((l) => l.status === "customer").length,
    dismissed: demoLeads.filter((l) => l.status === "dismissed").length,
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
      <AdminTabs />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">Leads de UniTech</h1>
          <p className="text-sm text-slate-500 mt-1">
            {source === "demo"
              ? "Prospectos que probaron el demo en vivo (los que llegan por tu campaña/anuncios)."
              : "Contratistas capturados por el chat del landing page."}
          </p>
        </div>
        <Button data-testid="leads-refresh" variant="outline" onClick={() => { loadLeads(); loadDemoLeads(); }} className="rounded-xl gap-2">
          <RefreshCcw className="w-4 h-4" />
          Actualizar
        </Button>
      </div>

      {/* Source toggle: demo leads vs landing chat leads */}
      <div className="flex items-center gap-2">
        <button data-testid="leads-source-demo" onClick={() => setSource("demo")}
          className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${source === "demo" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"}`}>
          🎬 Demo en vivo ({demoLeads.length})
        </button>
        <button data-testid="leads-source-chat" onClick={() => setSource("chat")}
          className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${source === "chat" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"}`}>
          💬 Chat del landing ({leads.length})
        </button>
      </div>

      {source === "chat" && (<>
      {/* Filter pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {["all", "new", "contacted", "converted", "dismissed"].map((k) => {
          const labels = { all: "Todos", new: "Nuevos", contacted: "Contactados", converted: "Convertidos", dismissed: "Descartados" };
          const active = filter === k;
          return (
            <button
              key={k}
              data-testid={`leads-filter-${k}`}
              onClick={() => setFilter(k)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border whitespace-nowrap transition-all ${
                active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
              }`}
            >
              {labels[k]} <span className={active ? "text-white/70" : "text-slate-400"}>({counts[k]})</span>
            </button>
          );
        })}
      </div>

      {/* Lead list */}
      {filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No hay leads en este filtro todavía.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onUpdate={updateLead} onDelete={deleteLead} />
          ))}
        </div>
      )}
      </>)}

      {source === "demo" && (
        <div className="space-y-4">
          {/* Hot summary */}
          {demoLeads.length > 0 && (
            <Card className="p-4 border-emerald-200 bg-emerald-50/50 flex items-center gap-3" data-testid="demo-hot-summary">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-none">
                <Flame className="w-5 h-5" />
              </div>
              <div className="text-sm text-emerald-900">
                <b>{demoCounts.hot}</b> {demoCounts.hot === 1 ? "prospecto completó" : "prospectos completaron"} el demo completo — esos son tus <b>más calientes</b>. Contáctalos primero.
              </div>
            </Card>
          )}

          {/* Search + filter pills */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              data-testid="demo-search"
              value={demoSearch}
              onChange={(e) => setDemoSearch(e.target.value)}
              placeholder="Busca por nombre, email, teléfono u oficio (para encontrar tus pruebas)…"
              className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
            {demoSearch && (
              <button onClick={() => setDemoSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { k: "all", label: "Todos" },
              { k: "hot", label: "🔥 Completaron" },
              { k: "potential", label: "⭐ Potenciales" },
              { k: "customer", label: "En mi CRM" },
              { k: "dismissed", label: "Descartados" },
            ].map(({ k, label }) => {
              const active = demoFilter === k;
              return (
                <button
                  key={k}
                  data-testid={`demo-filter-${k}`}
                  onClick={() => setDemoFilter(k)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border whitespace-nowrap transition-all ${
                    active ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {label} <span className={active ? "text-white/70" : "text-slate-400"}>({demoCounts[k] ?? 0})</span>
                </button>
              );
            })}
          </div>

          {/* Bulk delete bar */}
          {selected.size > 0 && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-900 text-white" data-testid="demo-bulk-bar">
              <span className="text-sm font-semibold">{selected.size} seleccionado(s)</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" className="rounded-lg text-white/80 hover:text-white hover:bg-white/10" onClick={() => setSelected(new Set())}>
                  Cancelar
                </Button>
                <Button data-testid="demo-bulk-delete" size="sm" className="rounded-lg bg-red-500 hover:bg-red-600" onClick={bulkDeleteDemo}>
                  <Trash2 className="w-4 h-4 mr-1" /> Borrar seleccionados
                </Button>
              </div>
            </div>
          )}

          {demoFiltered.length === 0 ? (
            <Card className="p-10 text-center">
              <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">
                {demoLeads.length === 0
                  ? "Aún no hay leads del demo. Cuando lances la campaña, aparecerán aquí en tiempo real."
                  : "Ningún lead coincide con este filtro/búsqueda."}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {demoFiltered.map((l) => (
                <DemoLeadCard
                  key={l.id}
                  lead={l}
                  selected={selected.has(l.id)}
                  onToggleSelect={() => toggleSelect(l.id)}
                  onUpdate={updateDemoLead}
                  onDelete={deleteDemoLead}
                  onToClient={demoToClient}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LeadCard({ lead, onUpdate, onDelete }) {
  const [notes, setNotes] = useState(lead.notes || "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const meta = STATUS_STYLES[lead.status] || STATUS_STYLES.new;
  const Icon = meta.icon;
  const created = new Date(lead.created_at).toLocaleDateString("es-MX", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const saveNotes = async () => {
    setSavingNotes(true);
    await onUpdate(lead.id, { notes });
    setSavingNotes(false);
  };

  return (
    <Card data-testid={`lead-${lead.id}`} className="p-4 sm:p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-lg text-slate-900">{lead.name || "(sin nombre)"}</h3>
            <Badge className={`${meta.color} border gap-1`} variant="outline">
              <Icon className="w-3 h-3" />
              {meta.label}
            </Badge>
            {lead.trade && (
              <Badge variant="outline" className="bg-violet-50 border-violet-200 text-violet-700">
                {lead.trade}
              </Badge>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {lead.phone && (
              <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 text-slate-700 hover:text-emerald-700">
                <Phone className="w-4 h-4" /> {lead.phone}
              </a>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 text-slate-700 hover:text-emerald-700">
                <Mail className="w-4 h-4" /> {lead.email}
              </a>
            )}
          </div>

          {lead.interest && (
            <p className="mt-2 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
              <MessageSquareText className="w-3.5 h-3.5 inline mr-1.5 text-slate-400" />
              {lead.interest}
            </p>
          )}

          <p className="text-xs text-slate-400 mt-2">📅 {created} · idioma: {lead.language}</p>
        </div>
      </div>

      {/* Action bar */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {lead.status !== "contacted" && (
            <Button data-testid={`lead-${lead.id}-contacted`} size="sm" variant="outline" className="rounded-lg" onClick={() => onUpdate(lead.id, { status: "contacted" })}>
              Marcar contactado
            </Button>
          )}
          {lead.status !== "converted" && (
            <Button data-testid={`lead-${lead.id}-converted`} size="sm" className="rounded-lg bg-emerald-600 hover:bg-emerald-700" onClick={() => onUpdate(lead.id, { status: "converted" })}>
              ✓ Convertido
            </Button>
          )}
          {lead.status !== "dismissed" && (
            <Button data-testid={`lead-${lead.id}-dismissed`} size="sm" variant="ghost" className="rounded-lg text-slate-500" onClick={() => onUpdate(lead.id, { status: "dismissed" })}>
              Descartar
            </Button>
          )}
          <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => setShowNotes((v) => !v)}>
            {showNotes ? "Ocultar notas" : "Notas"}
          </Button>
        </div>
        <Button data-testid={`lead-${lead.id}-delete`} size="sm" variant="ghost" className="rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => onDelete(lead.id)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {showNotes && (
        <div className="mt-3 space-y-2">
          <Textarea
            data-testid={`lead-${lead.id}-notes`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas internas: llamada del 25 de mayo, prometí mandarle un demo..."
            className="rounded-xl min-h-[80px]"
          />
          <Button size="sm" onClick={saveNotes} disabled={savingNotes} className="rounded-lg gap-2">
            {savingNotes && <Loader2 className="w-3 h-3 animate-spin" />}
            Guardar notas
          </Button>
        </div>
      )}
    </Card>
  );
}

function DemoLeadCard({ lead, selected, onToggleSelect, onUpdate, onDelete, onToClient }) {
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(lead.notes || "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [busy, setBusy] = useState(false);
  const created = new Date(lead.created_at).toLocaleDateString("es-MX", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
  let stage = { label: "Empezó el demo", color: "bg-amber-100 text-amber-800 border-amber-200" };
  if (lead.completed) stage = { label: "✓ Completó el demo", color: "bg-emerald-100 text-emerald-800 border-emerald-200" };
  else if ((lead.agreement_count || 0) > 0) stage = { label: "Firmó contrato", color: "bg-blue-100 text-blue-800 border-blue-200" };
  else if ((lead.quote_count || 0) > 0) stage = { label: "Generó cotización", color: "bg-violet-100 text-violet-800 border-violet-200" };

  const statusMeta = lead.status && DEMO_STATUS[lead.status];
  const isCustomer = lead.status === "customer";

  const doAction = async (fn) => { setBusy(true); await fn(); setBusy(false); };
  const saveNotes = async () => { setSavingNotes(true); await onUpdate(lead.id, { notes }); setSavingNotes(false); };
  const waText = `Hola ${lead.name || ""}! Vi que probaste UniTech. ¿Te ayudo a arrancar tu cuenta?`;

  return (
    <Card data-testid={`demo-lead-${lead.id}`} className={`p-4 sm:p-5 transition-shadow ${selected ? "ring-2 ring-emerald-500" : "hover:shadow-md"}`}>
      <div className="flex items-start gap-3">
        <button
          data-testid={`demo-lead-${lead.id}-select`}
          onClick={onToggleSelect}
          className="mt-1 flex-none text-slate-400 hover:text-emerald-600"
          aria-label="Seleccionar"
        >
          {selected ? <CheckSquare className="w-5 h-5 text-emerald-600" /> : <Square className="w-5 h-5" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-lg text-slate-900">{lead.name || "(sin nombre)"}</h3>
            <Badge className={`${stage.color} border`} variant="outline">{stage.label}</Badge>
            {lead.trade && (
              <Badge variant="outline" className="bg-violet-50 border-violet-200 text-violet-700">{lead.trade}</Badge>
            )}
            {statusMeta && (
              <Badge className={`${statusMeta.color} border`} variant="outline">{statusMeta.label}</Badge>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {lead.phone && (
              <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 text-slate-700 hover:text-emerald-700">
                <Phone className="w-4 h-4" /> {lead.phone}
              </a>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 text-slate-700 hover:text-emerald-700">
                <Mail className="w-4 h-4" /> {lead.email}
              </a>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-2">📅 {created} · cotizaciones: {lead.quote_count || 0} · contratos: {lead.agreement_count || 0}</p>
        </div>
      </div>

      {/* Quick contact */}
      {(lead.phone || lead.email) && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {lead.phone && (
            <a data-testid={`demo-lead-${lead.id}-whatsapp`} href={waLink(lead.phone, waText)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-[#25D366] text-white hover:bg-[#1eb955]">
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
          )}
          {lead.email && (
            <a data-testid={`demo-lead-${lead.id}-email`} href={`mailto:${lead.email}?subject=${encodeURIComponent("UniTech — tu prueba")}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200">
              <Mail className="w-4 h-4" /> Email
            </a>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          <Button
            data-testid={`demo-lead-${lead.id}-to-client`}
            size="sm"
            disabled={busy || isCustomer}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 gap-1 disabled:opacity-60"
            onClick={() => doAction(() => onToClient(lead.id))}
          >
            <UserPlus className="w-4 h-4" /> {isCustomer ? "En tu CRM" : "Agregar a mi CRM"}
          </Button>
          {lead.status !== "potential" && !isCustomer && (
            <Button data-testid={`demo-lead-${lead.id}-potential`} size="sm" variant="outline" className="rounded-lg gap-1"
              onClick={() => onUpdate(lead.id, { status: "potential" })}>
              <Star className="w-4 h-4" /> Potencial
            </Button>
          )}
          {lead.status !== "contacted" && (
            <Button data-testid={`demo-lead-${lead.id}-contacted`} size="sm" variant="outline" className="rounded-lg"
              onClick={() => onUpdate(lead.id, { status: "contacted" })}>
              Contactado
            </Button>
          )}
          {lead.status !== "dismissed" && (
            <Button data-testid={`demo-lead-${lead.id}-dismiss`} size="sm" variant="ghost" className="rounded-lg text-slate-500"
              onClick={() => onUpdate(lead.id, { status: "dismissed" })}>
              Descartar
            </Button>
          )}
          <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => setShowNotes((v) => !v)}>
            {showNotes ? "Ocultar notas" : "Notas"}
          </Button>
        </div>
        <Button data-testid={`demo-lead-${lead.id}-delete`} size="sm" variant="ghost" className="rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50"
          onClick={() => onDelete(lead.id)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {showNotes && (
        <div className="mt-3 space-y-2">
          <Textarea
            data-testid={`demo-lead-${lead.id}-notes`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas internas: le llamé el 3 de julio, quedó de pensarlo…"
            className="rounded-xl min-h-[70px]"
          />
          <Button size="sm" onClick={saveNotes} disabled={savingNotes} className="rounded-lg gap-2">
            {savingNotes && <Loader2 className="w-3 h-3 animate-spin" />} Guardar notas
          </Button>
        </div>
      )}
    </Card>
  );
}
