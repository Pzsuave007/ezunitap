import { useEffect, useState, useRef } from "react";
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
  MessageSquare, Camera, Sparkles, Plus, Trash2, Loader2,
} from "lucide-react";
import { toast } from "sonner";

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInput = useRef(null);
  const [client, setClient] = useState(null);
  const [history, setHistory] = useState({ quotes: [], invoices: [], messages: [], photos: [], jobs: [] });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [photoLabel, setPhotoLabel] = useState("during");

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

  const uploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/photos?client_id=${id}&label=${photoLabel}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Foto subida");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error subiendo foto");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  if (!client) {
    return <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-5">
      <button onClick={() => navigate("/clientes")} className="flex items-center gap-2 text-sm text-slate-600 tap" data-testid="back-to-clients">
        <ArrowLeft className="w-4 h-4" /> Clientes
      </button>

      <Card className="card-elevated p-5 border-0 shadow-none">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
            {client.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-heading text-2xl font-bold tracking-tight truncate">{client.name}</h1>
            {client.job_type && <div className="text-emerald-700 text-sm font-medium mt-0.5">{client.job_type}</div>}
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              {client.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4" />{client.phone}</div>}
              {client.email && <div className="flex items-center gap-2"><Mail className="w-4 h-4" />{client.email}</div>}
              {client.address && <div className="flex items-center gap-2"><MapPin className="w-4 h-4" />{client.address}</div>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-5">
          <Button
            data-testid="client-create-quote"
            onClick={() => navigate(`/quotes/nuevo?client_id=${id}&ai=1`)}
            className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Sparkles className="w-4 h-4 mr-1" /> Quote AI
          </Button>
          <Button
            data-testid="client-create-invoice"
            onClick={() => navigate(`/invoices/nuevo?client_id=${id}`)}
            variant="outline"
            className="h-12 rounded-xl border-slate-200"
          >
            <Receipt className="w-4 h-4 mr-1" /> Invoice
          </Button>
          <Button
            data-testid="client-send-message"
            onClick={() => navigate(`/mensajes?client_id=${id}`)}
            variant="outline"
            className="h-12 rounded-xl border-slate-200"
          >
            <MessageSquare className="w-4 h-4 mr-1" /> Mensaje
          </Button>
          <Button
            data-testid="client-upload-photo"
            onClick={() => fileInput.current?.click()}
            variant="outline"
            className="h-12 rounded-xl border-slate-200"
            disabled={uploading}
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Camera className="w-4 h-4 mr-1" />}
            Foto
          </Button>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={uploadPhoto} />
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs">
          <span className="text-slate-500">Etiqueta foto:</span>
          {["before", "during", "after"].map((l) => (
            <button
              key={l}
              onClick={() => setPhotoLabel(l)}
              data-testid={`label-${l}`}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${photoLabel === l ? "bg-blue-900 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {l === "before" ? "Antes" : l === "during" ? "Durante" : "Después"}
            </button>
          ))}
        </div>
      </Card>

      <Tabs defaultValue="info" className="w-full">
        <TabsList className="grid grid-cols-5 rounded-xl bg-slate-100 p-1 h-auto">
          <TabsTrigger value="info" className="rounded-lg text-xs" data-testid="tab-info">Info</TabsTrigger>
          <TabsTrigger value="quotes" className="rounded-lg text-xs" data-testid="tab-quotes">Quotes ({history.quotes.length})</TabsTrigger>
          <TabsTrigger value="invoices" className="rounded-lg text-xs" data-testid="tab-invoices">Invoices ({history.invoices.length})</TabsTrigger>
          <TabsTrigger value="messages" className="rounded-lg text-xs" data-testid="tab-messages">Msgs ({history.messages.length})</TabsTrigger>
          <TabsTrigger value="photos" className="rounded-lg text-xs" data-testid="tab-photos">Fotos ({history.photos.length})</TabsTrigger>
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
          {history.photos.length === 0 ? <EmptyHist label="photos" /> : (
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
    </div>
  );
}

const EmptyHist = ({ label }) => (
  <Card className="card-elevated p-6 text-center border-0 shadow-none">
    <p className="text-sm text-slate-500">Aún no hay {label}.</p>
  </Card>
);
