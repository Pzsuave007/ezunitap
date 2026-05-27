/**
 * ClientScopeDialog — inline AI Scope of Work generator within the client
 * profile. Pre-fills the description with the client's job_type / notes
 * to save typing. The result can be copied for use in a quote or contract.
 */
import { useEffect, useState } from "react";
import api from "@/lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, Copy, FileText } from "lucide-react";
import { toast } from "sonner";

export default function ClientScopeDialog({ open, onClose, client }) {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (open && client) {
      const prefill = [
        client.job_type,
        client.notes,
      ].filter(Boolean).join(". ");
      setDescription(prefill);
      setResult(null);
    }
    if (!open) {
      setResult(null);
    }
  }, [open, client]);

  const generate = async () => {
    if (!description.trim()) {
      toast.error("Describe el trabajo");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/ai/scope", { description_es: description });
      setResult(data);
      toast.success("Scope generado");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error al generar");
    } finally {
      setLoading(false);
    }
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
    toast.success("Copiado al portapapeles");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            Scope of Work AI
          </DialogTitle>
          <DialogDescription>
            Genera un scope profesional para {client?.name || "este cliente"}.
            Luego lo puedes usar en su quote o contrato.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold">
              Describe el trabajo (español)
            </Label>
            <Textarea
              data-testid="client-scope-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Voy a hacer un techo nuevo de shingles en una casa de 1500 sqft..."
              className="rounded-xl mt-1.5 min-h-[120px]"
            />
          </div>

          <Button
            data-testid="client-scope-generate"
            onClick={generate}
            disabled={loading}
            className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" /> Generar Scope of Work
              </>
            )}
          </Button>

          {result && (
            <div className="space-y-4 mt-2 p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-base font-bold">
                  Scope of Work (English)
                </h3>
                <Button
                  onClick={copyAll}
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  data-testid="client-scope-copy"
                >
                  <Copy className="w-4 h-4 mr-1" /> Copiar
                </Button>
              </div>

              <ScopeSection title="What is included" items={result.what_is_included} />
              <ScopeSection title="What is not included" items={result.what_is_not_included} />
              <ScopeRow label="Timeline" value={result.timeline} />
              <ScopeSection title="Materials" items={result.materials} />
              <ScopeRow label="Payment terms" value={result.payment_terms} />
              <ScopeRow label="Warranty" value={result.warranty_notes} />
              <ScopeRow label="Change order" value={result.change_order_note} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const ScopeSection = ({ title, items }) =>
  items?.length ? (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
        {title}
      </div>
      <ul className="list-disc ml-5 space-y-1 text-sm">
        {items.map((i, idx) => (
          <li key={idx}>{i}</li>
        ))}
      </ul>
    </div>
  ) : null;

const ScopeRow = ({ label, value }) =>
  value ? (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
        {label}
      </div>
      <div className="text-sm">{value}</div>
    </div>
  ) : null;
