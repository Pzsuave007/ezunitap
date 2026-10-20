import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trash2, Loader2, Sparkles, Users, Download, Send, Mail, Eye } from "lucide-react";

export default function NewsletterPanel({ isEs }) {
  const t = (en, es) => (isEs ? es : en);
  const [subs, setSubs] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get("/newsletter/subscribers"); setSubs(data.subscribers || []); setCount(data.count || 0); }
    catch { /* ignore */ }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const del = async (id) => {
    if (!window.confirm(t("Remove this subscriber?", "¿Eliminar este suscriptor?"))) return;
    try { await api.delete(`/newsletter/subscribers/${id}`); setSubs((s) => s.filter((x) => x.id !== id)); setCount((c) => Math.max(0, c - 1)); }
    catch { toast.error(t("Could not remove", "No se pudo eliminar")); }
  };

  const downloadCsv = async () => {
    try {
      const { data } = await api.get("/newsletter/subscribers.csv", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement("a");
      a.href = url; a.download = "subscribers.csv"; document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch { toast.error(t("Export failed", "Error al exportar")); }
  };

  const aiDraft = async () => {
    if (!topic.trim()) { toast.error(t("Describe the newsletter first", "Describe el boletín primero")); return; }
    setAiBusy(true);
    try {
      const { data } = await api.post("/newsletter/ai-draft", { topic: topic.trim(), lang: isEs ? "es" : "en" });
      setSubject(data.subject || "");
      setHtml(data.html || "");
      setShowPreview(true);
      toast.success(t("Draft ready — review and send", "Borrador listo — revisa y envía"));
    } catch { toast.error(t("AI could not draft this", "La IA no pudo generar el boletín")); }
    setAiBusy(false);
  };

  const send = async () => {
    if (!subject.trim() || !html.trim()) { toast.error(t("Add a subject and content", "Agrega asunto y contenido")); return; }
    if (count === 0) { toast.error(t("No subscribers yet", "Aún no tienes suscriptores")); return; }
    if (!window.confirm(t(`Send to ${count} subscribers?`, `¿Enviar a ${count} suscriptores?`))) return;
    setSending(true);
    try {
      const { data } = await api.post("/newsletter/send", { subject: subject.trim(), html });
      toast.success(t(`Sending to ${data.queued} subscribers`, `Enviando a ${data.queued} suscriptores`));
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("Send failed", "Error al enviar"));
    }
    setSending(false);
  };

  return (
    <div className="mt-4 ml-7 space-y-5" data-testid="newsletter-panel">
      {/* Subscribers */}
      <div className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Users className="w-4 h-4 text-slate-600" />
            {t("Subscribers", "Suscriptores")} <span className="text-slate-400">({count})</span>
          </div>
          <Button variant="outline" size="sm" className="rounded-lg h-9" onClick={downloadCsv} disabled={count === 0} data-testid="newsletter-export-csv">
            <Download className="w-4 h-4 mr-1.5" /> CSV
          </Button>
        </div>
        {loading ? (
          <div className="py-6 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
        ) : count === 0 ? (
          <p className="text-sm text-slate-400 py-3">{t("No subscribers yet. Enable the block below so visitors can sign up.", "Aún no hay suscriptores. Activa el bloque para que los visitantes se suscriban.")}</p>
        ) : (
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
            {subs.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm" data-testid={`newsletter-sub-${s.id}`}>
                <div className="min-w-0">
                  <div className="font-medium truncate">{s.name || "—"}</div>
                  <div className="text-slate-500 truncate">{s.email}</div>
                </div>
                <button onClick={() => del(s.id)} className="text-slate-300 hover:text-red-500 flex-none" data-testid={`newsletter-sub-del-${s.id}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Composer */}
      <div className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 font-semibold text-sm mb-1"><Mail className="w-4 h-4 text-slate-600" /> {t("Compose a newsletter", "Redactar un boletín")}</div>
        <p className="text-xs text-slate-500 mb-3">{t("Describe what you want to announce and let AI design a beautiful email.", "Describe lo que quieres anunciar y deja que la IA diseñe un correo atractivo.")}</p>
        <Label className="text-xs">{t("What's this newsletter about?", "¿De qué trata el boletín?")}</Label>
        <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={2}
          className="w-full rounded-xl mt-1.5 border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={t("e.g. New beginner salsa class starting next Monday, 20% off this week", "Ej: Nueva clase de salsa para principiantes el próximo lunes, 20% de descuento esta semana")}
          data-testid="newsletter-ai-topic" />
        <Button className="rounded-xl h-10 mt-2" onClick={aiDraft} disabled={aiBusy} data-testid="newsletter-ai-generate">
          {aiBusy ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("Designing…", "Diseñando…")}</> : <><Sparkles className="w-4 h-4 mr-2" /> {t("Generate with AI", "Generar con IA")}</>}
        </Button>

        {(subject || html) && (
          <div className="mt-4 space-y-3">
            <div>
              <Label className="text-xs">{t("Subject", "Asunto")}</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="h-11 rounded-xl mt-1.5" data-testid="newsletter-subject" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t("Email content (HTML)", "Contenido del correo (HTML)")}</Label>
                <button onClick={() => setShowPreview((v) => !v)} className="text-xs font-semibold text-blue-600 inline-flex items-center gap-1" data-testid="newsletter-toggle-preview">
                  <Eye className="w-3.5 h-3.5" /> {showPreview ? t("Hide preview", "Ocultar vista") : t("Show preview", "Ver vista previa")}
                </button>
              </div>
              <textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={6}
                className="w-full rounded-xl mt-1.5 border border-slate-200 px-3 py-2 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="newsletter-html" />
            </div>
            {showPreview && html && (
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50" data-testid="newsletter-preview">
                <iframe title="preview" srcDoc={html} className="w-full h-80 bg-white" />
              </div>
            )}
            <Button className="rounded-xl h-11 w-full" onClick={send} disabled={sending || count === 0} data-testid="newsletter-send">
              {sending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("Sending…", "Enviando…")}</> : <><Send className="w-4 h-4 mr-2" /> {t(`Send to ${count} subscribers`, `Enviar a ${count} suscriptores`)}</>}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
