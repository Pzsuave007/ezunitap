import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Sparkles, Copy, Loader2, Save, MessageCircle, Smartphone, Mail } from "lucide-react";
import { toast } from "sonner";
import TourButton from "@/components/TourButton";

function cleanPhone(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return digits;
  return digits;
}

export default function Messages() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState(params.get("client_id") || "");
  const [type] = useState("custom");
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

  const selectedClient = clients.find((c) => c.id === clientId) || null;
  const phone = cleanPhone(selectedClient?.phone);
  const email = selectedClient?.email || "";

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

  // Save quietly to history so every sent message is logged.
  const saveSilently = async () => {
    if (!output.trim()) return;
    try {
      await api.post("/messages", {
        client_id: clientId || null,
        message_type: type,
        user_input_es: userInput,
        message_en: output,
      });
      loadHistory();
    } catch { /* non-blocking */ }
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

  const sendWhatsApp = () => {
    if (!output.trim()) return;
    saveSilently();
    const text = encodeURIComponent(output);
    window.open(phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`, "_blank", "noopener");
  };

  const sendSMS = () => {
    if (!output.trim()) return;
    if (!phone) { toast.error("Este cliente no tiene teléfono guardado"); return; }
    saveSilently();
    window.location.href = `sms:+${phone}?&body=${encodeURIComponent(output)}`;
  };

  const sendEmail = () => {
    if (!output.trim()) return;
    if (!email) { toast.error("Este cliente no tiene email guardado"); return; }
    saveSilently();
    const subject = encodeURIComponent(`Message from ${user?.business_name || "us"}`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${encodeURIComponent(output)}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="w-7 h-7 text-blue-900" /> Mensajes AI
          </h1>
          <p className="text-slate-500 mt-1">Escribe en español, AI lo manda en inglés profesional.</p>
        </div>
        <TourButton tourKey="messages" />
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

            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-4 mb-2">Mandar al cliente</div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={sendWhatsApp}
                data-testid="msg-send-whatsapp"
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 transition tap"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center"><MessageCircle className="w-5 h-5 text-white" /></div>
                <span className="text-xs font-semibold">WhatsApp</span>
              </button>
              <button
                onClick={sendSMS}
                disabled={!phone}
                data-testid="msg-send-sms"
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-slate-200 hover:bg-blue-50 hover:border-blue-300 transition tap disabled:opacity-40"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center"><Smartphone className="w-5 h-5 text-white" /></div>
                <span className="text-xs font-semibold">Texto (SMS)</span>
              </button>
              <button
                onClick={sendEmail}
                disabled={!email}
                data-testid="msg-send-email"
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-slate-200 hover:bg-amber-50 hover:border-amber-300 transition tap disabled:opacity-40"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-600 flex items-center justify-center"><Mail className="w-5 h-5 text-white" /></div>
                <span className="text-xs font-semibold">Email</span>
              </button>
            </div>
            {!selectedClient && (
              <p className="text-[11px] text-slate-400 mt-2">Tip: elige un cliente arriba para mandar directo a su teléfono o email.</p>
            )}

            <div className="grid grid-cols-2 gap-2 mt-3">
              <Button onClick={copy} variant="outline" className="rounded-xl h-11" data-testid="msg-copy">
                <Copy className="w-4 h-4 mr-1" /> Copiar
              </Button>
              <Button onClick={save} disabled={saving} variant="outline" className="rounded-xl h-11" data-testid="msg-save">
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
