import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Sparkles, Copy, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

const TYPES = [
  { value: "follow_up_quote", label: "Follow up de Quote" },
  { value: "payment_reminder", label: "Recordatorio de pago" },
  { value: "ask_for_deposit", label: "Pedir depósito" },
  { value: "confirm_appointment", label: "Confirmar cita" },
  { value: "reschedule_appointment", label: "Reagendar cita" },
  { value: "ask_for_review", label: "Pedir review de Google" },
  { value: "explain_delay", label: "Explicar retraso" },
  { value: "thank_you", label: "Mensaje de agradecimiento" },
  { value: "custom", label: "Mensaje personalizado" },
];

export default function Messages() {
  const [params] = useSearchParams();
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState(params.get("client_id") || "");
  const [type, setType] = useState("follow_up_quote");
  const [userInput, setUserInput] = useState("");
  const [output, setOutput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);

  const loadHistory = async () => {
    const { data } = await api.get("/messages");
    setHistory(data.slice(0, 10));
  };
  useEffect(() => {
    api.get("/clients").then((r) => setClients(r.data));
    loadHistory();
  }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post("/messages/generate", {
        client_id: clientId || null,
        message_type: type,
        user_input_es: userInput,
      });
      setOutput(data.message_en);
      toast.success("Mensaje generado");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error generando");
    } finally { setGenerating(false); }
  };

  const save = async () => {
    if (!output.trim()) return;
    setSaving(true);
    try {
      await api.post("/messages", {
        client_id: clientId || null,
        message_type: type,
        user_input_es: userInput,
        message_en: output,
      });
      toast.success("Mensaje guardado");
      loadHistory();
    } catch {
      toast.error("Error");
    } finally { setSaving(false); }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(output);
    toast.success("Copiado al portapapeles");
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
          <MessageSquare className="w-7 h-7 text-blue-900" /> Mensajes AI
        </h1>
        <p className="text-slate-500 mt-1">Escribe en español, AI lo manda en inglés profesional.</p>
      </div>

      <Card className="card-elevated p-5 border-0 shadow-none space-y-4">
        <div>
          <Label>Cliente (opcional)</Label>
          <Select value={clientId || "none"} onValueChange={(v) => setClientId(v === "none" ? "" : v)}>
            <SelectTrigger data-testid="msg-client-select" className="h-12 rounded-xl mt-1.5"><SelectValue placeholder="Sin cliente específico" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin cliente</SelectItem>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Tipo de mensaje</Label>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                data-testid={`msg-type-${t.value}`}
                onClick={() => setType(t.value)}
                className={`px-3 py-3 rounded-xl text-xs font-semibold text-left tap ${
                  type === t.value ? "bg-blue-900 text-white" : "bg-white border border-slate-200 text-slate-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>¿Qué quieres decir? (español)</Label>
          <Textarea
            data-testid="msg-input"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Ej: Recuérdale que tiene un pago de $500 desde hace 2 semanas..."
            className="rounded-xl mt-1.5 min-h-[80px]"
          />
        </div>
        <Button
          data-testid="msg-generate"
          onClick={generate}
          disabled={generating}
          className="w-full h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
        >
          {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-5 h-5 mr-2" /> Generar en inglés</>}
        </Button>

        {output && (
          <Card className="p-4 rounded-xl border border-blue-200 bg-blue-50/40">
            <div className="text-xs font-bold uppercase tracking-wider text-blue-900 mb-2">Mensaje en inglés</div>
            <Textarea value={output} onChange={(e) => setOutput(e.target.value)} className="rounded-xl bg-white min-h-[140px]" />
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Button onClick={copy} variant="outline" className="rounded-xl h-11" data-testid="msg-copy">
                <Copy className="w-4 h-4 mr-1" /> Copiar
              </Button>
              <Button onClick={save} disabled={saving} className="rounded-xl h-11 bg-blue-900 hover:bg-blue-950" data-testid="msg-save">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1" /> Guardar</>}
              </Button>
            </div>
          </Card>
        )}
      </Card>

      {history.length > 0 && (
        <div>
          <h2 className="font-heading text-xl font-bold mb-3">Historial</h2>
          <div className="space-y-2">
            {history.map((m) => (
              <Card key={m.id} className="card-elevated p-4 border-0 shadow-none">
                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">{m.message_type.replace(/_/g, " ")}</div>
                <div className="text-sm whitespace-pre-wrap">{m.message_en}</div>
                <div className="text-xs text-slate-400 mt-2">{new Date(m.created_at).toLocaleString("es")}</div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
