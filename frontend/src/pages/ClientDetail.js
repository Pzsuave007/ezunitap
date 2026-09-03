import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Drawer, DrawerContent, DrawerTrigger, DrawerClose, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import StatusBadge from "@/components/StatusBadge";
import {
  ArrowLeft, Phone, Mail, MapPin, Camera, Sparkles, Trash2, Loader2,
  FileSignature, Building2, Receipt, MessageSquare, Plus, ChevronRight, StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import ClientScopeDialog from "@/components/ClientScopeDialog";
import ClientFlowNotices from "@/components/ClientFlowNotices";
import RequestReviewButton from "@/components/RequestReviewButton";

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasFeature } = useAuth();
  const hasBusiness = hasFeature("business");
  const [client, setClient] = useState(null);
  const [history, setHistory] = useState({ quotes: [], invoices: [], messages: [], photos: [], jobs: [], agreements: [], scopes: [] });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [projectPhoto, setProjectPhoto] = useState(null);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [activeNote, setActiveNote] = useState(null);

  const token = localStorage.getItem("sf_token");

  const loadNotes = async () => {
    try {
      const r = await api.get(`/clients/${id}/notes`);
      setNotes(r.data || []);
    } catch { /* noop */ }
  };
  useEffect(() => { loadNotes(); }, [id]);

  const addNote = async () => {
    const text = noteText.trim();
    if (!text) return;
    setNoteSaving(true);
    try {
      await api.post(`/clients/${id}/notes`, { text });
      setNoteText("");
      await loadNotes();
    } catch {
      toast.error("Error al guardar la nota");
    } finally {
      setNoteSaving(false);
    }
  };

  const delNote = async (noteId) => {
    try {
      await api.delete(`/clients/${id}/notes/${noteId}`);
      await loadNotes();
    } catch {
      toast.error("Error al borrar");
    }
  };

  const noteAction = (action) => {
    const n = activeNote;
    setActiveNote(null);
    if (!n) return;
    if (action === "quote") {
      navigate(`/quotes/nuevo?client_id=${id}&ai=1`, { state: { prefillDescription: n.text } });
    } else if (action === "invoice") {
      navigate(`/invoices/nuevo?client_id=${id}`);
    } else if (action === "message") {
      navigate(`/mensajes?client_id=${id}`);
    }
  };

  const load = async () => {
    try {
      const [c, h] = await Promise.all([api.get(`/clients/${id}`), api.get(`/clients/${id}/history`)]);
      setClient(c.data);
      setForm(c.data);
      const d = h.data || {};
      setHistory({
        quotes: d.quotes || [],
        invoices: d.invoices || [],
        messages: d.messages || [],
        photos: d.photos || [],
        jobs: d.jobs || [],
        agreements: d.agreements || [],
        scopes: d.scopes || [],
      });
    } catch {
      toast.error("Cliente no encontrado");
      navigate("/clientes");
    }
  };
  useEffect(() => { load(); }, [id]);

  // Lazy-load the photo the client attached to their estimate request (if any).
  useEffect(() => {
    if (client?.project_photo_path) {
      api.get(`/clients/${id}/project-photo`)
        .then((r) => setProjectPhoto(r.data.data_url))
        .catch(() => setProjectPhoto(null));
    } else {
      setProjectPhoto(null);
    }
  }, [client?.project_photo_path, id]);

  const startAiQuote = () => {
    navigate(`/quotes/nuevo?client_id=${id}&ai=1`, {
      state: {
        prefillDescription: client?.project_request || (client?.interests || []).join(", "),
        projectPhotoClientId: client?.project_photo_path ? id : null,
      },
    });
  };

  const preferredContact = (() => {
    const pc = client?.preferred_contact;
    if (!pc) return null;
    const digits = (client.phone || "").replace(/\D/g, "");
    const map = {
      whatsapp: { label: "WhatsApp", href: digits ? `https://wa.me/${digits}` : null },
      text: { label: "Mensaje (SMS)", href: client.phone ? `sms:${client.phone}` : null },
      sms: { label: "Mensaje (SMS)", href: client.phone ? `sms:${client.phone}` : null },
      email: { label: "Email", href: client.email ? `mailto:${client.email}` : null },
      phone: { label: "Llamada", href: client.phone ? `tel:${client.phone}` : null },
    };
    return map[pc] ? { key: pc, ...map[pc] } : null;
  })();

  const leadCard = (() => {
    const interests = Array.isArray(client?.interests) ? client.interests : [];
    const isLead = client?.lead_source === "smart_card" || client?.lead_source === "website" || client?.project_request || interests.length > 0;
    if (!isLead) return null;
    const fromWeb = client?.lead_source === "website";
    return (
    <Card data-testid="client-lead-card" className="card-elevated p-4 border-0 shadow-none bg-amber-50 ring-1 ring-amber-200">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 font-heading font-bold text-sm text-amber-900">
          {fromWeb ? "🌐 Contacto desde tu sitio web" : "📇 Contacto desde tu tarjeta"}
        </div>
        <span
          data-testid="client-lead-badge"
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
            client.lead_type === "connect" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {client.lead_type === "connect" ? "Quiere conectar" : "Pidió cotización"}
        </span>
      </div>

      {fromWeb && client?.source_site && (
        <div className="mb-2.5 text-xs text-amber-800" data-testid="client-source-site">
          Vino de: <span className="font-semibold">{client.source_site}</span>
        </div>
      )}

      {interests.length > 0 && (
        <div className="mb-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Le interesa</div>
          <div className="flex flex-wrap gap-1.5" data-testid="client-lead-interests">
            {interests.map((it, i) => (
              <span key={i} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white text-zinc-700 ring-1 ring-amber-200">{it}</span>
            ))}
          </div>
        </div>
      )}

      {preferredContact && (
        <div className="mb-2.5 flex items-center justify-between gap-2 bg-white rounded-xl px-3 py-2 ring-1 ring-amber-200">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Prefiere contacto por</div>
            <div className="text-sm font-semibold text-zinc-800">{preferredContact.label}</div>
          </div>
          {preferredContact.href && (
            <a
              data-testid="client-lead-contact-btn"
              href={preferredContact.href}
              target={preferredContact.key === "whatsapp" ? "_blank" : undefined}
              rel="noreferrer"
              className="flex-none px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
            >
              Contactar
            </a>
          )}
        </div>
      )}

      {client.project_request && (
        <div className="mb-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Su mensaje</div>
          <p data-testid="client-project-text" className="text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed">
            {client.project_request}
          </p>
        </div>
      )}

      {projectPhoto && (
        <a href={projectPhoto} target="_blank" rel="noreferrer" className="block mb-2.5">
          <img data-testid="client-project-photo" src={projectPhoto} alt="Foto del proyecto"
            className="w-full max-h-56 object-cover rounded-xl border border-amber-200" />
        </a>
      )}

      {hasBusiness && (
        <Button data-testid="project-create-quote-btn" onClick={startAiQuote}
          className="w-full mt-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
          <Sparkles className="w-4 h-4 mr-2" /> Crear cotización con esto
        </Button>
      )}
    </Card>
    );
  })();

  const save = async () => {
    try {
      await api.put(`/clients/${id}`, form);
      setEditing(false);
      toast.success("Guardado");
      load();
    } catch {
      toast.error("Error guardando");
    }
  };

  const del = async () => {
    if (!window.confirm("¿Eliminar este cliente?")) return;
    await api.delete(`/clients/${id}`);
    navigate("/clientes");
  };

  if (!client) {
    return <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  const fmtMoney = (n) => `$${(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const totalInvoiced = history.invoices.reduce((s, i) => s + (i.total || 0), 0);
  const COUNTABLE = ["created", "sent", "partial", "overdue"];
  const pending = history.invoices
    .filter((i) => COUNTABLE.includes(i.status))
    .reduce((s, i) => s + Math.max(0, (i.total || 0) - (i.amount_paid || 0)), 0);

  return (
    <div className="max-w-3xl mx-auto w-full pb-10 space-y-7">
      <button onClick={() => navigate("/clientes")} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-800 transition-colors tap" data-testid="back-to-clients">
        <ArrowLeft className="w-4 h-4" /> Clientes
      </button>

      {/* ===== Identity ===== */}
      <div className="flex flex-col items-center text-center gap-2 -mt-3">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-zinc-950 leading-tight" data-testid="client-name-heading">{client.name}</h1>
        {client.company && (
          <div className="flex items-center gap-1.5 text-sm text-zinc-500">
            <Building2 className="w-3.5 h-3.5 flex-shrink-0" /> {client.company}
          </div>
        )}
        {client.job_type && (
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-600 text-xs font-semibold">
            {client.job_type}
          </span>
        )}
      </div>

      {/* ===== Quick contact ===== */}
      {(client.phone || client.email || client.address) && (
        <div className="flex items-start justify-center gap-6">
          {client.phone && (
            <ContactCircle href={`tel:${client.phone}`} icon={Phone} label="Llamar" testid="contact-call-button" />
          )}
          {client.email && (
            <ContactCircle href={`mailto:${client.email}`} icon={Mail} label="Email" testid="contact-email-button" />
          )}
          {client.address && (
            <ContactCircle href={`https://maps.google.com/?q=${encodeURIComponent(client.address)}`} external icon={MapPin} label="Mapa" testid="contact-map-button" />
          )}
        </div>
      )}

      <ClientFlowNotices client={client} history={history} />

      {/* ===== Create entry point — only for the Negocio plan ===== */}
      {hasBusiness ? (
      <Drawer>
        <DrawerTrigger asChild>
          <Button data-testid="fab-nuevo-button" className="w-full h-auto py-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm transition-colors flex-col gap-0.5">
            <span className="flex items-center text-base font-semibold leading-none">
              <Plus className="w-5 h-5 mr-1.5" /> Crear
            </span>
            <span className="text-[11px] font-medium text-zinc-300 leading-none">Cotización · Invoice · Contrato · Mensaje</span>
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader className="pb-1">
            <DrawerTitle className="font-heading">Crear para {client.name?.split(" ")[0]}</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 pt-1 pb-8 max-w-md mx-auto w-full space-y-2">
            <ActionRow icon={Sparkles} iconCls="bg-emerald-100 text-emerald-700" title="Cotización con AI" desc="Crea un quote en segundos" testid="drawer-action-quote-ai"
              onClick={startAiQuote} />
            <ActionRow icon={Receipt} iconCls="bg-blue-100 text-blue-800" title="Invoice" desc="Cobra por tu trabajo" testid="drawer-action-invoice"
              onClick={() => navigate(`/invoices/nuevo?client_id=${id}`)} />
            <ActionRow icon={FileSignature} iconCls="bg-violet-100 text-violet-700" title="Contrato" desc="Acuerdo para firmar" testid="drawer-action-contract"
              onClick={() => navigate(`/contratos/nuevo?client_id=${id}`)} />
            <ActionRow icon={MessageSquare} iconCls="bg-sky-100 text-sky-700" title="Mensaje" desc="Manda un texto al cliente" testid="drawer-action-message"
              onClick={() => navigate(`/mensajes?client_id=${id}`)} />
            <ActionRow icon={Sparkles} iconCls="bg-amber-100 text-amber-600" title="Scope con AI" desc="Detalle del trabajo a realizar" testid="drawer-action-scope"
              onClick={() => setScopeOpen(true)} />
          </div>
        </DrawerContent>
      </Drawer>
      ) : (
        <div className="space-y-2">
          <button
            data-testid="client-message-btn"
            onClick={() => navigate(`/mensajes?client_id=${id}`)}
            className="tap w-full flex items-center gap-3 p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white transition-colors"
          >
            <span className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center flex-none">
              <MessageSquare className="w-5 h-5" strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block font-semibold text-sm">Mandar mensaje</span>
              <span className="block text-[11px] text-zinc-300">Escríbelo en español y se manda en inglés</span>
            </span>
            <ChevronRight className="w-5 h-5 text-zinc-500 flex-none" />
          </button>
          <button
            data-testid="client-upsell-negocio"
            onClick={() => navigate("/precios")}
            className="tap w-full flex items-center gap-3 p-4 rounded-2xl border border-dashed border-zinc-300 bg-white hover:bg-zinc-50 text-left transition-colors"
          >
            <span className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center flex-none">
              <Receipt className="w-5 h-5" strokeWidth={2.4} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-zinc-900 text-sm">Activa el plan Negocio para cotizar y facturar</span>
              <span className="block text-xs text-zinc-500">Crea cotizaciones, invoices y contratos para este cliente.</span>
            </span>
            <ChevronRight className="w-5 h-5 text-zinc-300 flex-none" />
          </button>
        </div>
      )}

      {/* ===== Stats (flat technical grid) — Negocio only ===== */}
      {hasBusiness && (
      <div className="grid grid-cols-2 border border-zinc-200 rounded-2xl overflow-hidden bg-white">
        <StatCell label="Cotizaciones" value={history.quotes.length} testid="stats-quotes-value" cls="border-r border-b border-zinc-100" />
        <StatCell label="Facturas" value={history.invoices.length} testid="stats-invoices-value" cls="border-b border-zinc-100" />
        <StatCell label="Facturado" value={fmtMoney(totalInvoiced)} testid="stats-invoiced-value" cls="border-r border-zinc-100" />
        <StatCell label="Por cobrar" value={fmtMoney(pending)} testid="stats-pending-value" valueCls="text-amber-600" />
      </div>
      )}

      {/* ===== History (scrollable segmented tabs) ===== */}
      <Tabs defaultValue="info" className="w-full">
        <TabsList className="w-full justify-start gap-1 bg-zinc-100 p-1 rounded-xl overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden h-auto">
          <Seg value="info" label="Info" testid="history-tab-info" />
          <Seg value="notes" label="Notas" count={notes.length} testid="history-tab-notas" />
          {hasBusiness && <Seg value="quotes" label="Cotizaciones" count={history.quotes.length} testid="history-tab-cotizaciones" />}
          {hasBusiness && <Seg value="agreements" label="Contratos" count={history.agreements.length} testid="history-tab-contratos" />}
          {hasBusiness && <Seg value="invoices" label="Facturas" count={history.invoices.length} testid="history-tab-facturas" />}
          {hasBusiness && <Seg value="jobs" label="Trabajos" count={history.jobs.length} testid="history-tab-trabajos" />}
          <Seg value="messages" label="Mensajes" count={history.messages.length} testid="history-tab-mensajes" />
          {hasBusiness && <Seg value="photos" label="Fotos" count={history.photos.length} testid="history-tab-fotos" />}
        </TabsList>

        <TabsContent value="info" className="mt-4 space-y-4">
          {leadCard}
          <Card className="card-elevated p-5 border-0 shadow-none">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading font-bold">Información</h3>
              {!editing ? (
                <div className="flex gap-2">
                  <Button data-testid="edit-client" size="sm" variant="outline" onClick={() => setEditing(true)} className="rounded-xl">Editar</Button>
                  <Button data-testid="delete-client" size="sm" variant="outline" onClick={del} className="rounded-xl text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(false); setForm(client); }} className="rounded-xl">Cancelar</Button>
                  <Button size="sm" data-testid="save-client" onClick={save} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">Guardar</Button>
                </div>
              )}
            </div>
            {editing ? (
              <div className="space-y-3">
                {[
                  ["name", "Nombre"], ["company", "Nombre del negocio (opcional)"],
                  ["phone", "Teléfono"], ["email", "Email"],
                  ["address", "Dirección"], ["job_type", "Tipo de trabajo"],
                ].map(([k, label]) => (
                  <div key={k}>
                    <Label>{label}</Label>
                    <Input value={form[k] || ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="h-12 rounded-xl mt-1.5" />
                  </div>
                ))}
                {form.company?.trim() && (
                  <div className="flex items-start justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3" data-testid="client-company-only-setting">
                    <div className="flex-1">
                      <Label className="cursor-pointer">Dirigir invoice solo al nombre de la compañía</Label>
                      <p className="text-[11px] text-zinc-500 mt-1">Actívalo si este cliente no quiere que salga su nombre personal. El invoice, cotización y contrato irán dirigidos solo al nombre de la compañía.</p>
                    </div>
                    <button
                      type="button"
                      data-testid="client-company-only-toggle"
                      onClick={() => setForm({ ...form, bill_to_company_only: !form.bill_to_company_only })}
                      className={`relative flex-none w-12 h-7 rounded-full transition-colors mt-1 ${form.bill_to_company_only ? "bg-emerald-500" : "bg-zinc-300"}`}
                      aria-pressed={!!form.bill_to_company_only}
                    >
                      <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${form.bill_to_company_only ? "left-6" : "left-1"}`} />
                    </button>
                  </div>
                )}
                <div>
                  <Label>Notas (español)</Label>
                  <Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl mt-1.5" />
                </div>
              </div>
            ) : (
              <div className="text-sm text-zinc-700 whitespace-pre-wrap">
                {client.notes || <span className="text-zinc-400">Sin notas.</span>}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-4 space-y-3">
          <Card className="card-elevated p-4 border-0 shadow-none">
            <Label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Nueva nota</Label>
            <Textarea
              data-testid="note-input"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Ej: Lo llamé, quiere que pase el martes a dar precio del techo."
              rows={3}
              className="rounded-xl mt-1.5"
            />
            <Button
              data-testid="note-add-btn"
              onClick={addNote}
              disabled={noteSaving || !noteText.trim()}
              className="w-full mt-2 h-11 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-semibold"
            >
              {noteSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />} Agregar nota
            </Button>
          </Card>

          {notes.length === 0 ? (
            <Card className="card-elevated p-6 text-center border-0 shadow-none">
              <StickyNote className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">Aún no hay notas.</p>
              <p className="text-xs text-zinc-400 mt-1">Toca una nota para crear una cotización, factura o mensaje desde ella.</p>
            </Card>
          ) : (
            notes.map((n) => (
              <Card
                key={n.id}
                data-testid={`note-card-${n.id}`}
                onClick={() => setActiveNote(n)}
                className="card-elevated p-4 border-0 shadow-none cursor-pointer hover:bg-zinc-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed">{n.text}</p>
                    <div className="text-[11px] text-zinc-400 mt-1.5">{new Date(n.created_at).toLocaleString("es")}</div>
                  </div>
                  <button
                    data-testid={`note-delete-${n.id}`}
                    onClick={(e) => { e.stopPropagation(); delNote(n.id); }}
                    className="flex-none text-zinc-300 hover:text-red-500 transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="quotes" className="mt-4 space-y-2">
          {history.quotes.length === 0 ? <EmptyHist label="cotizaciones" /> : history.quotes.map((q) => (
            <Card key={q.id} onClick={() => navigate(`/quotes/${q.id}`)} className="card-elevated p-4 border-0 shadow-none cursor-pointer">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{q.job_title}</div>
                  <div className="text-xs text-zinc-500">{q.number} · ${q.total?.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                </div>
                <StatusBadge kind="quote" status={q.status} />
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="agreements" className="mt-4 space-y-2">
          {history.agreements.length === 0 ? <EmptyHist label="contratos" /> : history.agreements.map((a) => (
            <Card
              key={a.id}
              data-testid={`agreement-card-${a.id}`}
              onClick={() => navigate(`/contratos/${a.id}`)}
              className="card-elevated p-4 border-0 shadow-none cursor-pointer"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{a.title || a.job_title || "Contrato"}</div>
                  <div className="text-xs text-zinc-500">{new Date(a.created_at).toLocaleDateString("es")}</div>
                </div>
                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full ${
                  a.status === "signed" ? "bg-emerald-100 text-emerald-800" :
                  a.status === "sent" ? "bg-blue-100 text-blue-800" :
                  a.status === "draft" ? "bg-zinc-100 text-zinc-600" :
                  "bg-amber-100 text-amber-800"
                }`}>
                  {a.status === "signed" ? "Firmado" :
                   a.status === "sent" ? "Enviado" :
                   a.status === "draft" ? "Borrador" : a.status}
                </span>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="invoices" className="mt-4 space-y-2">
          {history.invoices.length === 0 ? <EmptyHist label="facturas" /> : history.invoices.map((i) => (
            <Card key={i.id} onClick={() => navigate(`/invoices/${i.id}`)} className="card-elevated p-4 border-0 shadow-none cursor-pointer">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{i.job_title}</div>
                  <div className="text-xs text-zinc-500">{i.number} · ${i.total?.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                </div>
                <StatusBadge kind="invoice" status={i.status} />
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="jobs" className="mt-4 space-y-2">
          {history.jobs.length === 0 ? <EmptyHist label="trabajos" /> : (() => {
            const sortedJobs = [...history.jobs].sort((a, b) => {
              const ac = a.status === "completed" ? 0 : 1;
              const bc = b.status === "completed" ? 0 : 1;
              if (ac !== bc) return ac - bc; // completed (finished) first
              return (b.scheduled_date || b.created_at || "").localeCompare(a.scheduled_date || a.created_at || "");
            });
            return sortedJobs.map((j) => (
              <Card key={j.id} data-testid={`client-job-${j.id}`} className="card-elevated p-4 border-0 shadow-none">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{j.title}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {j.scheduled_date
                        ? new Date(j.scheduled_date + "T00:00:00").toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })
                        : (j.created_at ? new Date(j.created_at).toLocaleDateString("es") : "")}
                    </div>
                  </div>
                  <StatusBadge kind="job" status={j.status} />
                </div>
                {j.notes && (
                  <div className="text-xs text-zinc-600 bg-zinc-50 border border-zinc-100 rounded-lg p-2.5 mt-2 whitespace-pre-line line-clamp-4">
                    {j.notes}
                  </div>
                )}
              </Card>
            ));
          })()}
        </TabsContent>

        <TabsContent value="messages" className="mt-4 space-y-2">
          {history.messages.length === 0 ? <EmptyHist label="mensajes" /> : history.messages.map((m) => (
            <Card key={m.id} className="card-elevated p-4 border-0 shadow-none">
              <div className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">{(m.message_type || "").replace(/_/g, " ")}</div>
              <div className="text-sm whitespace-pre-wrap">{m.message_en}</div>
              <div className="text-xs text-zinc-400 mt-2">{new Date(m.created_at).toLocaleString("es")}</div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="photos" className="mt-4">
          {history.photos.length === 0 ? (
            <Card className="card-elevated p-6 text-center border-0 shadow-none">
              <Camera className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">Aún no hay fotos.</p>
              <p className="text-xs text-zinc-400 mt-1">Las fotos se suben desde cada Trabajo (Antes / Durante / Después).</p>
            </Card>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {history.photos.map((p) => (
                <a
                  key={p.id}
                  href={`${process.env.REACT_APP_BACKEND_URL}/api/photos/${p.id}/file?auth=${token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block aspect-square rounded-xl overflow-hidden bg-zinc-100 relative tap"
                >
                  <img
                    src={`${process.env.REACT_APP_BACKEND_URL}/api/photos/${p.id}/file?auth=${token}`}
                    alt={p.label}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-1 left-1 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-semibold">
                    {p.label}
                  </span>
                </a>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <RequestReviewButton
        client={client}
        jobTitle={client.job_type}
        className="w-full h-12 rounded-xl"
      />

      <Drawer open={!!activeNote} onOpenChange={(o) => !o && setActiveNote(null)}>
        <DrawerContent>
          <DrawerHeader className="pb-1">
            <DrawerTitle className="font-heading">¿Qué quieres hacer con esta nota?</DrawerTitle>
          </DrawerHeader>
          {activeNote && (
            <div className="px-4 pt-1 max-w-md mx-auto w-full">
              <div className="rounded-xl bg-zinc-50 ring-1 ring-zinc-200 p-3 text-sm text-zinc-700 whitespace-pre-wrap max-h-28 overflow-y-auto">
                {activeNote.text}
              </div>
            </div>
          )}
          <div className="p-4 pt-3 pb-8 max-w-md mx-auto w-full space-y-2">
            {hasBusiness && (
              <ActionRow icon={Sparkles} iconCls="bg-emerald-100 text-emerald-700" title="Crear cotización" desc="La IA usa esta nota" testid="note-action-quote"
                onClick={() => noteAction("quote")} />
            )}
            {hasBusiness && (
              <ActionRow icon={Receipt} iconCls="bg-blue-100 text-blue-800" title="Crear invoice" desc="Cobra por este trabajo" testid="note-action-invoice"
                onClick={() => noteAction("invoice")} />
            )}
            <ActionRow icon={MessageSquare} iconCls="bg-sky-100 text-sky-700" title="Mandar mensaje" desc="Texto al cliente" testid="note-action-message"
              onClick={() => noteAction("message")} />
          </div>
        </DrawerContent>
      </Drawer>

      <ClientScopeDialog
        open={scopeOpen}
        onClose={() => setScopeOpen(false)}
        client={client}
      />
    </div>
  );
}

const ContactCircle = ({ href, icon: Icon, label, testid, external }) => (
  <a
    href={href}
    {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
    data-testid={testid}
    className="flex flex-col items-center gap-1.5 tap"
  >
    <span className="w-12 h-12 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-700 hover:border-emerald-400 hover:text-emerald-600 transition-colors shadow-sm">
      <Icon className="w-5 h-5" />
    </span>
    <span className="text-[11px] font-medium text-zinc-500">{label}</span>
  </a>
);

const ActionRow = ({ icon: Icon, iconCls, title, desc, onClick, testid }) => (
  <DrawerClose asChild>
    <button
      onClick={onClick}
      data-testid={testid}
      className="w-full flex items-center gap-3 p-3 rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50 text-left transition-colors"
    >
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center flex-none ${iconCls}`}>
        <Icon className="w-5 h-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-zinc-900 text-sm">{title}</span>
        <span className="block text-xs text-zinc-500 truncate">{desc}</span>
      </span>
      <ChevronRight className="w-5 h-5 text-zinc-300 flex-none" />
    </button>
  </DrawerClose>
);

const StatCell = ({ label, value, testid, cls = "", valueCls = "text-zinc-950" }) => (
  <div className={`p-4 ${cls}`}>
    <div className={`font-heading text-2xl font-bold tracking-tight leading-none ${valueCls}`} data-testid={testid}>{value}</div>
    <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mt-1.5">{label}</div>
  </div>
);

const Seg = ({ value, label, count, testid }) => (
  <TabsTrigger
    value={value}
    data-testid={testid}
    className="flex-none rounded-lg px-3.5 py-2 text-sm font-semibold text-zinc-500 data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-sm whitespace-nowrap transition-colors"
  >
    {label}{count != null && count > 0 && <span className="ml-1.5 text-xs text-zinc-400">{count}</span>}
  </TabsTrigger>
);

const EmptyHist = ({ label }) => (
  <Card className="card-elevated p-6 text-center border-0 shadow-none">
    <p className="text-sm text-zinc-500">Aún no hay {label}.</p>
  </Card>
);
