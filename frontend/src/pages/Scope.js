import { useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import TourButton from "@/components/TourButton";

export default function Scope() {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const generate = async () => {
    if (!description.trim()) return toast.error("Escribe una descripción");
    setLoading(true);
    try {
      const { data } = await api.post("/ai/scope", { description_es: description });
      setResult(data);
      toast.success("Scope of Work generado");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error");
    } finally { setLoading(false); }
  };

  const copyAll = async () => {
    if (!result) return;
    const text = `SCOPE OF WORK

WHAT IS INCLUDED:
${(result.what_is_included || []).map((s) => `• ${s}`).join("\n")}

WHAT IS NOT INCLUDED:
${(result.what_is_not_included || []).map((s) => `• ${s}`).join("\n")}

TIMELINE: ${result.timeline || ""}

MATERIALS:
${(result.materials || []).map((s) => `• ${s}`).join("\n")}

PAYMENT TERMS: ${result.payment_terms || ""}

WARRANTY: ${result.warranty_notes || ""}

CHANGE ORDER: ${result.change_order_note || ""}`;
    await navigator.clipboard.writeText(text);
    toast.success("Copiado");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-emerald-600" /> Scope of Work AI
          </h1>
          <p className="text-slate-500 mt-1">Genera un scope profesional en inglés desde tu descripción en español.</p>
        </div>
        <TourButton tourKey="scope" />
      </div>

      <Card className="card-elevated p-5 border-0 shadow-none space-y-4">
        <div>
          <Label>Describe el trabajo (español)</Label>
          <Textarea
            data-testid="scope-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: Voy a hacer un techo nuevo de shingles en una casa de 1500 sqft, incluye remover el viejo, papel, drip edge..."
            className="rounded-xl mt-1.5 min-h-[140px]"
          />
        </div>
        <Button data-testid="scope-generate" onClick={generate} disabled={loading} className="w-full h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Generar Scope of Work"}
        </Button>
      </Card>

      {result && (
        <Card className="card-elevated p-5 border-0 shadow-none space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl font-bold">Scope of Work (English)</h2>
            <Button onClick={copyAll} variant="outline" size="sm" className="rounded-xl" data-testid="scope-copy">
              <Copy className="w-4 h-4 mr-1" /> Copiar todo
            </Button>
          </div>
          <ScopeSection title="What is included" items={result.what_is_included} />
          <ScopeSection title="What is not included" items={result.what_is_not_included} />
          <ScopeRow label="Timeline" value={result.timeline} />
          <ScopeSection title="Materials" items={result.materials} />
          <ScopeRow label="Payment terms" value={result.payment_terms} />
          <ScopeRow label="Warranty" value={result.warranty_notes} />
          <ScopeRow label="Change order" value={result.change_order_note} />
        </Card>
      )}
    </div>
  );
}

const ScopeSection = ({ title, items }) => items?.length ? (
  <div>
    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{title}</div>
    <ul className="list-disc ml-5 space-y-1 text-sm">
      {items.map((i, idx) => <li key={idx}>{i}</li>)}
    </ul>
  </div>
) : null;

const ScopeRow = ({ label, value }) => value ? (
  <div>
    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</div>
    <div className="text-sm">{value}</div>
  </div>
) : null;
