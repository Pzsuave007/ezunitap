/**
 * AdminLeads — Super admin only. List/follow-up Unitap platform leads
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
} from "lucide-react";
import { toast } from "sonner";

const STATUS_STYLES = {
  new: { label: "Nuevo", color: "bg-amber-100 text-amber-800 border-amber-200", icon: Clock },
  contacted: { label: "Contactado", color: "bg-blue-100 text-blue-800 border-blue-200", icon: UserCheck },
  converted: { label: "Convertido", color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: CheckCircle2 },
  dismissed: { label: "Descartado", color: "bg-slate-100 text-slate-600 border-slate-200", icon: Trash2 },
};

export default function AdminLeads() {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  // Fast-path: trust the logged-in user's email (matches the sidebar logic)
  const SUPER_ADMIN_EMAILS = ["pzsuave007@gmail.com", "admin@ezunitap.com"];
  const isSuperAdminByEmail = !!user?.email && SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase());

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Try the backend check first (canonical), fall back to email check
        const { data } = await api.get("/auth/is-super-admin");
        if (!mounted) return;
        setAllowed(!!data.is_super_admin || isSuperAdminByEmail);
        if (data.is_super_admin || isSuperAdminByEmail) await loadLeads();
      } catch {
        if (mounted) {
          setAllowed(isSuperAdminByEmail);
          if (isSuperAdminByEmail) await loadLeads();
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

  if (!user) return <Navigate to="/login" replace />;
  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  );
  if (!allowed) return (
    <div className="max-w-md mx-auto p-6">
      <Card className="p-8 text-center border-red-200 bg-red-50">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-red-900 mb-2">Acceso restringido</h2>
        <p className="text-sm text-red-700">Esta sección es solo para el super administrador de Unitap.</p>
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

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">Leads de Unitap</h1>
          <p className="text-sm text-slate-500 mt-1">Contratistas capturados por el chat del landing page.</p>
        </div>
        <Button data-testid="leads-refresh" variant="outline" onClick={loadLeads} className="rounded-xl gap-2">
          <RefreshCcw className="w-4 h-4" />
          Actualizar
        </Button>
      </div>

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
