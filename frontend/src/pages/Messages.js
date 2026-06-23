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
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
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
  const { t } = useTranslation();
  const lang = i18n.language?.startsWith("es") ? "es" : "en";
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState(params.get("client_id") || "");
  const [type] = useState("custom");
  const [userInput, setUserInput] = useState("");
  const [output, setOutput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
    setOutput("");
    setDrawerOpen(true);
    setGenerating(true);
    try {
      const { data } = await api.post("/messages/generate", {
        client_id: clientId || null,
        message_type: type,
        user_input_es: userInput,
        language: lang,
      });
      setOutput(data.message_en);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t("messages.errorGenerating"));
      setDrawerOpen(false);
    } finally { setGenerating(false); }
  };

  // Reopen a saved message in the drawer to send it again.
  const openHistory = (m) => {
    setClientId(m.client_id || "");
    setUserInput(m.user_input_es || "");
    setOutput(m.message_en || "");
    setGenerating(false);
    setDrawerOpen(true);
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
      toast.success(t("messages.saved"));
      loadHistory();
    } catch {
      toast.error(t("messages.error"));
    } finally { setSaving(false); }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(output);
    toast.success(t("messages.copied"));
  };

  const sendWhatsApp = () => {
    if (!output.trim()) return;
    saveSilently();
    const text = encodeURIComponent(output);
    window.open(phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`, "_blank", "noopener");
  };

  const sendSMS = () => {
    if (!output.trim()) return;
    if (!phone) { toast.error(t("messages.noPhone")); return; }
    saveSilently();
    window.location.href = `sms:+${phone}?&body=${encodeURIComponent(output)}`;
  };

  const sendEmail = () => {
    if (!output.trim()) return;
    if (!email) { toast.error(t("messages.noEmail")); return; }
    saveSilently();
    const subject = encodeURIComponent(`Message from ${user?.business_name || "us"}`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${encodeURIComponent(output)}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="w-7 h-7 text-blue-900" /> {t("messages.title")}
          </h1>
          <p className="text-slate-500 mt-1">{t("messages.subtitle")}</p>
        </div>
        <TourButton tourKey="messages" />
      </div>

      <Card className="card-elevated p-5 border-0 shadow-none space-y-4">
        <div>
          <Label>{t("messages.clientOptional")}</Label>
          <Select value={clientId || "none"} onValueChange={(v) => setClientId(v === "none" ? "" : v)}>
            <SelectTrigger data-testid="msg-client-select" className="h-12 rounded-xl mt-1.5"><SelectValue placeholder={t("messages.noClientSpecific")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("messages.noClient")}</SelectItem>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t("messages.whatToSay")}</Label>
          <Textarea
            data-testid="msg-input"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder={t("messages.inputPlaceholder")}
            className="rounded-xl mt-1.5 min-h-[80px]"
          />
        </div>
        <Button
          data-testid="msg-generate"
          onClick={generate}
          disabled={generating}
          className="w-full h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
        >
          {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-5 h-5 mr-2" /> {t("messages.generate")}</>}
        </Button>
      </Card>

      {/* Slide-up drawer: shows "Preparando tu mensaje…" then the message + send options with room to read */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent data-testid="message-drawer" className="max-h-[92vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-heading flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-700" />
              {generating ? t("messages.preparing") : t("messages.yourMessage")}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8 overflow-y-auto max-w-lg mx-auto w-full">
            {generating ? (
              <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="message-loading">
                <Loader2 className="w-9 h-9 animate-spin text-blue-700 mb-3" />
                <p className="text-sm font-semibold text-slate-600">Preparando tu mensaje…</p>
                <p className="text-xs text-slate-400 mt-1">Un momento ✨</p>
              </div>
            ) : (
              <>
                <Textarea
                  data-testid="message-output"
                  value={output}
                  onChange={(e) => setOutput(e.target.value)}
                  className="rounded-xl bg-white min-h-[200px] text-base leading-relaxed"
                />

                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-5 mb-2">{t("messages.sendToClient")}</div>
                <div className="grid grid-cols-3 gap-3">
                  <button onClick={sendWhatsApp} data-testid="msg-send-whatsapp"
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 transition tap">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center"><MessageCircle className="w-6 h-6 text-white" /></div>
                    <span className="text-sm font-semibold">WhatsApp</span>
                  </button>
                  <button onClick={sendSMS} disabled={!phone} data-testid="msg-send-sms"
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-slate-200 hover:bg-blue-50 hover:border-blue-300 transition tap disabled:opacity-40">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center"><Smartphone className="w-6 h-6 text-white" /></div>
                    <span className="text-sm font-semibold">{t("messages.text")}</span>
                  </button>
                  <button onClick={sendEmail} disabled={!email} data-testid="msg-send-email"
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-slate-200 hover:bg-amber-50 hover:border-amber-300 transition tap disabled:opacity-40">
                    <div className="w-12 h-12 rounded-2xl bg-amber-600 flex items-center justify-center"><Mail className="w-6 h-6 text-white" /></div>
                    <span className="text-sm font-semibold">Email</span>
                  </button>
                </div>
                {!selectedClient && (
                  <p className="text-[11px] text-slate-400 mt-2">{t("messages.tipClient")}</p>
                )}

                <div className="grid grid-cols-2 gap-2 mt-4">
                  <Button onClick={copy} variant="outline" className="rounded-xl h-12" data-testid="msg-copy">
                    <Copy className="w-4 h-4 mr-1" /> {t("messages.copy")}
                  </Button>
                  <Button onClick={save} disabled={saving} variant="outline" className="rounded-xl h-12" data-testid="msg-save">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1" /> {t("common.save")}</>}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {history.length > 0 && (
        <div>
          <h2 className="font-heading text-xl font-bold mb-3">{t("messages.history")}</h2>
          <div className="space-y-2">
            {history.map((m) => (
              <button
                key={m.id}
                onClick={() => openHistory(m)}
                data-testid={`history-msg-${m.id}`}
                className="w-full text-left card-elevated p-4 border-0 rounded-xl bg-white hover:bg-slate-50 transition tap"
              >
                <div className="text-sm whitespace-pre-wrap line-clamp-3">{m.message_en}</div>
                <div className="text-xs text-emerald-600 font-semibold mt-2 flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5" /> {t("messages.tapResend")}
                </div>
                <div className="text-xs text-slate-400 mt-1">{new Date(m.created_at).toLocaleString(lang === "es" ? "es" : "en-US")}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
