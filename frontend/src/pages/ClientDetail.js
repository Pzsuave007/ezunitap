import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import StatusBadge from "@/components/StatusBadge";
import {
  ArrowLeft, Phone, Mail, MapPin, FileText, Receipt,
  MessageSquare, Camera, Sparkles, Trash2, Loader2,
  FileSignature, DollarSign, Clock,
} from "lucide-react";
import { toast } from "sonner";
import ClientScopeDialog from "@/components/ClientScopeDialog";
import ClientFlowNotices from "@/components/ClientFlowNotices";
import RequestReviewButton from "@/components/RequestReviewButton";

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
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

  const initials = client.name?.charAt(0)?.toUpperCase();
  const fmtMoney = (n) => `$${(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const totalInvoiced = history.invoices.reduce((s, i) => s + (i.total || 0), 0);
  const pending = history.invoices
    .filter((i) => i.status !== "paid")
    .reduce((s, i) => s + (i.total || 0), 0);

  return (
    <div className="space-y-5">
      <button onClick={() => navigate("/clientes")} className="flex items-center gap-2 text-sm text-slate-600 tap" data-testid="back-to-clients">
        <ArrowLeft className="w-4 h-4" /> Clientes
      </button>

      {/* ===== Header ===== */}
      <Card className="border-0 shadow-sm rounded-3xl p-5">
        <div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 shadow-md">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 leading-tight truncate">{client.name}</h1>
              {client.job_type && (
                <span className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                  {client.job_type}
                </span>
              )}
            </div>
            <RequestReviewButton
              client={client}
              jobTitle={client.job_type}
              className="h-10 rounded-xl text-sm flex-shrink-0"
            />
          </div>

          {/* Contact chips — tap to call / email / map */}
          <div className="flex flex-wrap gap-2 mt-4">
            {client.phone && (
              <a href={`tel:${client.phone}`} data-testid="client-phone-link" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 hover:border-emerald-400 hover:text-emerald-700 transition-colors">
                <Phone className="w-4 h-4 flex-shrink-0" /> {client.phone}
              </a>
            )}
            {client.email && (
              <a href={`mailto:${client.email}`} data-testid="client-email-link" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 hover:border-emerald-400 hover:text-emerald-700 transition-colors max-w-full">
                <Mail className="w-4 h-4 flex-shrink-0" /> <span className="truncate">{client.email}</span>
              </a>
            )}
            {client.address && (
              <a href={`https://maps.google.com/?q=${encodeURIComponent(client.address)}`} target="_blank" rel="noreferrer" data-testid="client-address-link" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 hover:border-emerald-400 hover:text-emerald-700 transition-colors">
                <MapPin className="w-4 h-4 flex-shrink-0" /> {client.address}
              </a>
            )}
          </div>

          <ClientFlowNotices client={client} history={history} />

          {/* Primary actions — money-makers stand out */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-4">
            <Button
              data-testid="client-create-quote"
              onClick={() => navigate(`/quotes/nuevo?client_id=${id}&ai=1`)}
              className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm shadow-emerald-600/20"
            >
              <Sparkles className="w-4 h-4 mr-1.5 flex-shrink-0" /> Quote AI
            </Button>
            <Button
              data-testid="client-create-invoice"
              onClick={() => navigate(`/invoices/nuevo?client_id=${id}`)}
              className="h-12 rounded-xl bg-blue-900 hover:bg-blue-950 text-white text-sm font-semibold shadow-sm shadow-blue-900/20"
            >
              <Receipt className="w-4 h-4 mr-1.5 flex-shrink-0" /> Invoice
            </Button>
            <Button
              data-testid="client-create-contract"
              onClick={() => navigate(`/contratos/nuevo?client_id=${id}`)}
              variant="outline"
              className="h-12 rounded-xl border-slate-200 text-sm font-medium text-slate-700 hover:border-violet-300 hover:bg-violet-50"
            >
              <FileSignature className="w-4 h-4 mr-1.5 flex-shrink-0 text-violet-600" /> Contrato
            </Button>
            <Button
              data-testid="client-send-message"
              onClick={() => navigate(`/mensajes?client_id=${id}`)}
              variant="outline"
              className="h-12 rounded-xl border-slate-200 text-sm font-medium text-slate-700 hover:border-sky-300 hover:bg-sky-50"
            >
              <MessageSquare className="w-4 h-4 mr-1.5 flex-shrink-0 text-sky-600" /> Mensaje
            </Button>
            <Button
              data-testid="client-generate-scope"
              onClick={() => setScopeOpen(true)}
              variant="outline"
              className="h-12 rounded-xl border-slate-200 text-sm font-medium text-slate-700 hover:border-amber-300 hover:bg-amber-50"
            >
              <Sparkles className="w-4 h-4 mr-1.5 flex-shrink-0 text-amber-500" /> Scope
            </Button>
          </div>
        </div>
      </Card>

      {/* ===== Stats strip ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={FileText} label="Cotizaciones" value={history.quotes.length} tone="blue" />
        <StatCard icon={Receipt} label="Facturas" value={history.invoices.length} tone="violet" />
        <StatCard icon={DollarSign} label="Facturado" value={fmtMoney(totalInvoiced)} tone="emerald" />
        <StatCard icon={Clock} label="Por cobrar" value={fmtMoney(pending)} tone="amber" />
      </div>

      {/* ===== Tabs (visual cards) ===== */}
      <Tabs defaultValue="info" className="w-full">
        <TabsList className="w-full grid grid-cols-3 lg:grid-cols-6 gap-2 bg-transparent p-0 h-auto">
          <TabTrig value="info" testid="tab-info" icon={FileText} label="Info" tone="slate" />
          <TabTrig value="quotes" testid="tab-quotes" icon={Sparkles} label="Quotes" count={history.quotes.length} tone="emerald" />
          <TabTrig value="agreements" testid="tab-agreements" icon={FileSignature} label="Contratos" count={history.agreements.length} tone="violet" />
          <TabTrig value="invoices" testid="tab-invoices" icon={Receipt} label="Invoices" count={history.invoices.length} tone="blue" />
          <TabTrig value="messages" testid="tab-messages" icon={MessageSquare} label="Mensajes" count={history.messages.length} tone="sky" />
          <TabTrig value="photos" testid="tab-photos" icon={Camera} label="Fotos" count={history.photos.length} tone="amber" />
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
                  ["name", "Nombre"], ["phone", "Teléfono"], ["email", "Email"],
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
              <div className="text-sm text-slate-700 whitespace-pre-wrap">
                {client.notes || <span className="text-slate-400">Sin notas.</span>}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="quotes" className="mt-4 space-y-2">
          {history.quotes.length === 0 ? <EmptyHist label="quotes" /> : history.quotes.map((q) => (
            <Card key={q.id} onClick={() => navigate(`/quotes/${q.id}`)} className="card-elevated p-4 border-0 shadow-none cursor-pointer">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{q.job_title}</div>
                  <div className="text-xs text-slate-500">{q.number} · ${q.total?.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
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
                  <div className="text-xs text-slate-500">{new Date(a.created_at).toLocaleDateString("es")}</div>
                </div>
                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full ${
                  a.status === "signed" ? "bg-emerald-100 text-emerald-800" :
                  a.status === "sent" ? "bg-blue-100 text-blue-800" :
                  a.status === "draft" ? "bg-slate-100 text-slate-600" :
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
          {history.invoices.length === 0 ? <EmptyHist label="invoices" /> : history.invoices.map((i) => (
            <Card key={i.id} onClick={() => navigate(`/invoices/${i.id}`)} className="card-elevated p-4 border-0 shadow-none cursor-pointer">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold truncate">{i.job_title}</div>
                  <div className="text-xs text-slate-500">{i.number} · ${i.total?.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                </div>
                <StatusBadge kind="invoice" status={i.status} />
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="messages" className="mt-4 space-y-2">
          {history.messages.length === 0 ? <EmptyHist label="messages" /> : history.messages.map((m) => (
            <Card key={m.id} className="card-elevated p-4 border-0 shadow-none">
              <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">{m.message_type.replace(/_/g, " ")}</div>
              <div className="text-sm whitespace-pre-wrap">{m.message_en}</div>
              <div className="text-xs text-slate-400 mt-2">{new Date(m.created_at).toLocaleString("es")}</div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="photos" className="mt-4">
          {history.photos.length === 0 ? (
            <Card className="card-elevated p-6 text-center border-0 shadow-none">
              <Camera className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Aún no hay fotos.</p>
              <p className="text-xs text-slate-400 mt-1">Las fotos se suben desde cada Trabajo (Antes / Durante / Después).</p>
            </Card>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {history.photos.map((p) => (
                <a
                  key={p.id}
                  href={`${process.env.REACT_APP_BACKEND_URL}/api/photos/${p.id}/file?auth=${token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block aspect-square rounded-xl overflow-hidden bg-slate-100 relative tap"
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
      <ClientScopeDialog
        open={scopeOpen}
        onClose={() => setScopeOpen(false)}
        client={client}
      />
    </div>
  );
}

const EmptyHist = ({ label }) => (
  <Card className="card-elevated p-6 text-center border-0 shadow-none">
    <p className="text-sm text-slate-500">Aún no hay {label}.</p>
  </Card>
);

const STAT_TONES = {
  blue: "bg-blue-50 text-blue-700",
  violet: "bg-violet-50 text-violet-700",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
};

const StatCard = ({ icon: Icon, label, value, tone = "blue" }) => (
  <Card className="border-0 shadow-sm rounded-2xl p-3.5 flex items-center gap-3">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${STAT_TONES[tone]}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div className="min-w-0">
      <div className="font-heading text-lg font-bold text-slate-900 leading-none truncate">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-1">{label}</div>
    </div>
  </Card>
);

const TAB_TONES = {
  slate: { active: "data-[state=active]:border-slate-400 data-[state=active]:bg-slate-50", icon: "bg-slate-100 text-slate-600" },
  emerald: { active: "data-[state=active]:border-emerald-500 data-[state=active]:bg-emerald-50", icon: "bg-emerald-100 text-emerald-700" },
  violet: { active: "data-[state=active]:border-violet-500 data-[state=active]:bg-violet-50", icon: "bg-violet-100 text-violet-700" },
  blue: { active: "data-[state=active]:border-blue-500 data-[state=active]:bg-blue-50", icon: "bg-blue-100 text-blue-700" },
  sky: { active: "data-[state=active]:border-sky-500 data-[state=active]:bg-sky-50", icon: "bg-sky-100 text-sky-700" },
  amber: { active: "data-[state=active]:border-amber-500 data-[state=active]:bg-amber-50", icon: "bg-amber-100 text-amber-700" },
};

const TabTrig = ({ value, testid, icon: Icon, label, count, tone = "slate" }) => {
  const t = TAB_TONES[tone];
  return (
    <TabsTrigger
      value={value}
      data-testid={testid}
      className={`relative flex flex-col items-center justify-center gap-1.5 h-auto rounded-2xl border-2 border-slate-100 bg-white px-2 py-3 transition-all hover:border-slate-200 data-[state=active]:shadow-sm ${t.active}`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${t.icon}`}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-xs font-bold text-slate-700">{label}</span>
      {count != null && (
        <span className="absolute top-1.5 right-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 min-w-[18px] text-center leading-none flex items-center justify-center h-[18px]">
          {count}
        </span>
      )}
    </TabsTrigger>
  );
};
