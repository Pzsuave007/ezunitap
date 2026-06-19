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
  FileSignature, Building2, Receipt, MessageSquare, Plus, ChevronRight,
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

  const token = localStorage.getItem("sf_token");

  const load = async () => {
    try {
      const [c, h] = await Promise.all([api.get(`/clients/${id}`), api.get(`/clients/${id}/history`)]);
      setClient(c.data);
      setForm(c.data);
      setHistory(h.data);
    } catch {
      toast.error("Cliente no encontrado");
      navigate("/clientes");
    }
  };
  useEffect(() => { load(); }, [id]);

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
              onClick={() => navigate(`/quotes/nuevo?client_id=${id}&ai=1`)} />
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
          {hasBusiness && <Seg value="quotes" label="Cotizaciones" count={history.quotes.length} testid="history-tab-cotizaciones" />}
          {hasBusiness && <Seg value="agreements" label="Contratos" count={history.agreements.length} testid="history-tab-contratos" />}
          {hasBusiness && <Seg value="invoices" label="Facturas" count={history.invoices.length} testid="history-tab-facturas" />}
          <Seg value="messages" label="Mensajes" count={history.messages.length} testid="history-tab-mensajes" />
          {hasBusiness && <Seg value="photos" label="Fotos" count={history.photos.length} testid="history-tab-fotos" />}
        </TabsList>

        <TabsContent value="info" className="mt-4">
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

        <TabsContent value="messages" className="mt-4 space-y-2">
          {history.messages.length === 0 ? <EmptyHist label="mensajes" /> : history.messages.map((m) => (
            <Card key={m.id} className="card-elevated p-4 border-0 shadow-none">
              <div className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">{m.message_type.replace(/_/g, " ")}</div>
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
