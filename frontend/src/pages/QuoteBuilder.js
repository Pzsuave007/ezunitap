import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Camera, Loader2, ArrowLeft, Plus, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";

const blankItem = () => ({ description: "", quantity: 1, unit: "ea", unit_price: 0, amount: 0 });

const fileToBase64 = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

export default function QuoteBuilder() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetClient = params.get("client_id");
  const aiMode = params.get("ai") === "1";

  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState(presetClient || "");
  const [description, setDescription] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [photoAnalysis, setPhotoAnalysis] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [draft, setDraft] = useState({
    job_title: "",
    description: "",
    scope_of_work: [],
    line_items: [],
    materials_estimate: 0,
    labor_estimate: 0,
    subtotal: 0,
    tax_rate: 0,
    tax_amount: 0,
    total: 0,
    deposit_amount: 0,
    payment_terms: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/clients").then((r) => setClients(r.data));
  }, []);

  const generateWithAI = async () => {
    if (!description.trim()) return toast.error("Escribe una descripción");
    setAiLoading(true);
    try {
      const { data } = await api.post("/ai/quote", { description_es: description });
      setDraft({
        job_title: data.job_title || "",
        description: data.description || "",
        scope_of_work: data.scope_of_work || [],
        line_items: (data.line_items || []).map((li) => ({
          description: li.description || "",
          quantity: Number(li.quantity) || 1,
          unit: li.unit || "ea",
          unit_price: Number(li.unit_price) || 0,
          amount: Number(li.amount) || (Number(li.quantity) || 1) * (Number(li.unit_price) || 0),
        })),
        materials_estimate: Number(data.materials_estimate) || 0,
        labor_estimate: Number(data.labor_estimate) || 0,
        subtotal: Number(data.subtotal) || 0,
        tax_rate: Number(data.tax_rate) || 0,
        tax_amount: Number(data.tax_amount) || 0,
        total: Number(data.total) || 0,
        deposit_amount: Number(data.deposit_amount) || 0,
        payment_terms: data.payment_terms || "",
        notes: data.notes || "",
      });
      toast.success("¡Quote generado con AI!");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error de AI");
    } finally {
      setAiLoading(false);
    }
  };

  const analyzePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoLoading(true);
    try {
      const b64 = await fileToBase64(file);
      const { data } = await api.post("/ai/photo-quote", {
        image_base64: b64,
        extra_note_es: description,
      });
      setPhotoAnalysis(data);
      // Pre-fill from photo analysis
      setDraft((d) => ({
        ...d,
        job_title: d.job_title || data.job_type || "",
        scope_of_work: d.scope_of_work.length ? d.scope_of_work : (data.suggested_scope || []),
        notes: [d.notes, data.questions_for_contractor?.length ? `Questions: ${data.questions_for_contractor.join("; ")}` : ""].filter(Boolean).join("\n"),
      }));
      toast.success("Análisis de foto listo");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error analizando foto");
    } finally {
      setPhotoLoading(false);
      e.target.value = "";
    }
  };

  const updateItem = (i, k, v) => {
    const items = [...draft.line_items];
    items[i] = { ...items[i], [k]: k === "description" || k === "unit" ? v : Number(v) || 0 };
    items[i].amount = (Number(items[i].quantity) || 0) * (Number(items[i].unit_price) || 0);
    recompute({ ...draft, line_items: items });
  };
  const addItem = () => recompute({ ...draft, line_items: [...draft.line_items, blankItem()] });
  const removeItem = (i) => recompute({ ...draft, line_items: draft.line_items.filter((_, idx) => idx !== i) });

  const recompute = (next) => {
    const subtotal = next.line_items.reduce((s, li) => s + (Number(li.amount) || 0), 0);
    const tax_amount = subtotal * (Number(next.tax_rate) || 0) / 100;
    const total = subtotal + tax_amount;
    setDraft({ ...next, subtotal: round2(subtotal), tax_amount: round2(tax_amount), total: round2(total) });
  };
  const round2 = (n) => Math.round(n * 100) / 100;

  const save = async () => {
    if (!clientId) return toast.error("Selecciona un cliente");
    if (!draft.job_title.trim()) return toast.error("Falta título del trabajo");
    setSaving(true);
    try {
      const { data } = await api.post("/quotes", { ...draft, client_id: clientId, status: "draft" });
      toast.success("Quote creado");
      navigate(`/quotes/${data.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error guardando");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-slate-600 tap" data-testid="back-btn">
        <ArrowLeft className="w-4 h-4" /> Atrás
      </button>

      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-emerald-600" /> Nuevo Quote
        </h1>
        <p className="text-slate-500 mt-1">Escribe en español, la AI lo convierte a un quote profesional en inglés.</p>
      </div>

      <Card className="card-elevated p-5 border-0 shadow-none space-y-4">
        <div>
          <Label>Cliente *</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger data-testid="quote-client-select" className="h-12 rounded-xl mt-1.5">
              <SelectValue placeholder="Selecciona un cliente" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {aiMode && (
          <>
            <div>
              <Label>Describe el trabajo (en español) *</Label>
              <Textarea
                data-testid="quote-ai-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej: Voy a reparar drywall en una sala, son 3 paredes de 10x8, incluye material, textura y pintura blanca..."
                className="rounded-xl mt-1.5 min-h-[120px]"
              />
              <p className="text-xs text-slate-400 mt-1.5">Tip: También puedes pegar aquí una transcripción de tu nota de voz.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                data-testid="quote-generate-ai"
                onClick={generateWithAI}
                disabled={aiLoading}
                className="h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {aiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Wand2 className="w-5 h-5 mr-2" /> Generar con AI</>}
              </Button>
              <label className="cursor-pointer">
                <Button asChild variant="outline" className="h-14 rounded-xl border-slate-200 w-full" disabled={photoLoading}>
                  <span data-testid="quote-photo-upload">
                    {photoLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Camera className="w-5 h-5 mr-2" /> Foto a Quote</>}
                  </span>
                </Button>
                <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={analyzePhoto} />
              </label>
            </div>

            {photoAnalysis && (
              <Card className="p-4 rounded-xl border border-emerald-200 bg-emerald-50">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2">Análisis de foto</div>
                <div className="text-sm space-y-2 text-slate-800">
                  {photoAnalysis.job_type && <div><strong>Tipo:</strong> {photoAnalysis.job_type}</div>}
                  {photoAnalysis.rough_price_range && <div><strong>Rango estimado:</strong> {photoAnalysis.rough_price_range}</div>}
                  {photoAnalysis.questions_for_contractor?.length > 0 && (
                    <div>
                      <strong>Preguntas a confirmar:</strong>
                      <ul className="list-disc ml-5 mt-1">
                        {photoAnalysis.questions_for_contractor.map((q, i) => <li key={i}>{q}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </>
        )}
      </Card>

      <Card className="card-elevated p-5 border-0 shadow-none space-y-4">
        <h2 className="font-heading text-xl font-bold">Detalles del Quote (en inglés)</h2>

        <div>
          <Label>Job Title</Label>
          <Input data-testid="qb-title" value={draft.job_title} onChange={(e) => setDraft({ ...draft, job_title: e.target.value })} className="h-12 rounded-xl mt-1.5" />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="rounded-xl mt-1.5" />
        </div>
        <div>
          <Label>Scope of Work (uno por línea)</Label>
          <Textarea
            value={(draft.scope_of_work || []).join("\n")}
            onChange={(e) => setDraft({ ...draft, scope_of_work: e.target.value.split("\n").filter(Boolean) })}
            className="rounded-xl mt-1.5 min-h-[100px]"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Line Items</Label>
            <Button data-testid="add-line-item" size="sm" variant="outline" onClick={addItem} className="rounded-xl"><Plus className="w-3 h-3 mr-1" /> Agregar</Button>
          </div>
          {draft.line_items.length === 0 && <div className="text-sm text-slate-400 py-2">Sin ítems. Agrega líneas o usa AI.</div>}
          {draft.line_items.map((li, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 mb-2">
              <Input value={li.description} onChange={(e) => updateItem(i, "description", e.target.value)} placeholder="Description" className="col-span-12 lg:col-span-5 h-11 rounded-xl" />
              <Input type="number" step="0.01" value={li.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} placeholder="Qty" className="col-span-3 lg:col-span-2 h-11 rounded-xl" />
              <Input value={li.unit} onChange={(e) => updateItem(i, "unit", e.target.value)} placeholder="ea" className="col-span-3 lg:col-span-1 h-11 rounded-xl" />
              <Input type="number" step="0.01" value={li.unit_price} onChange={(e) => updateItem(i, "unit_price", e.target.value)} placeholder="$" className="col-span-3 lg:col-span-2 h-11 rounded-xl" />
              <div className="col-span-2 lg:col-span-1 flex items-center text-sm font-semibold">${li.amount.toFixed(2)}</div>
              <button type="button" onClick={() => removeItem(i)} className="col-span-1 flex items-center justify-center text-red-500">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tax Rate (%)</Label>
            <Input type="number" step="0.01" value={draft.tax_rate} onChange={(e) => recompute({ ...draft, tax_rate: Number(e.target.value) || 0 })} className="h-12 rounded-xl mt-1.5" />
          </div>
          <div>
            <Label>Deposit ($)</Label>
            <Input type="number" step="0.01" value={draft.deposit_amount} onChange={(e) => setDraft({ ...draft, deposit_amount: Number(e.target.value) || 0 })} className="h-12 rounded-xl mt-1.5" />
          </div>
        </div>
        <div>
          <Label>Payment Terms</Label>
          <Input value={draft.payment_terms} onChange={(e) => setDraft({ ...draft, payment_terms: e.target.value })} className="h-12 rounded-xl mt-1.5" />
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className="rounded-xl mt-1.5" />
        </div>

        <div className="bg-slate-50 rounded-xl p-4 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-slate-600">Subtotal</span><span className="font-semibold">${draft.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Tax</span><span className="font-semibold">${draft.tax_amount.toFixed(2)}</span></div>
          <div className="flex justify-between text-lg pt-2 border-t border-slate-200 mt-2"><span className="font-heading font-bold">TOTAL</span><span className="font-heading font-bold">${draft.total.toFixed(2)}</span></div>
        </div>

        <Button
          data-testid="save-quote"
          onClick={save}
          disabled={saving}
          className="w-full h-14 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-semibold text-base"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Guardar Quote"}
        </Button>
      </Card>
    </div>
  );
}
