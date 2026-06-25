import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Globe, Copy, Check, MessageSquare, FileText, CalendarDays, Code2, Bot } from "lucide-react";
import { toast } from "sonner";

const TYPES = [
  { key: "contact", icon: MessageSquare },
  { key: "quote", icon: FileText },
  { key: "appointment", icon: CalendarDays },
  { key: "chat", icon: Bot },
];

export default function EmbedSettings() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith("es") ? "es" : "en";
  const [slug, setSlug] = useState("");
  const [type, setType] = useState("contact");
  const [copied, setCopied] = useState(false);
  const previewRef = useRef(null);

  const origin = window.location.origin;
  const scriptUrl = `${origin}/embed.js`;

  useEffect(() => {
    api.get("/card/settings").then((r) => setSlug(r.data?.slug || "")).catch(() => {});
  }, []);

  const snippet = slug
    ? type === "chat"
      ? `<!-- UniTech AI chat -->\n<script src="${scriptUrl}" data-unitech-chat data-slug="${slug}" data-lang="${lang}" async></script>`
      : `<!-- UniTech form -->\n<div data-unitech-form data-slug="${slug}" data-type="${type}" data-lang="${lang}"></div>\n<script src="${scriptUrl}" async></script>`
    : "";

  const copy = () => {
    navigator.clipboard?.writeText(snippet);
    setCopied(true);
    toast.success(t("embed.copied"));
    setTimeout(() => setCopied(false), 1800);
  };

  // Live preview: re-render the form widget when type/slug/lang changes.
  // For the chat type we show a static mock (it's a floating bubble, we don't
  // want to attach a persistent floating widget to the app itself).
  useEffect(() => {
    if (!slug || !previewRef.current) return;
    const host = previewRef.current;
    if (type === "chat") { host.innerHTML = ""; return; }
    host.innerHTML = `<div data-unitech-form data-slug="${slug}" data-type="${type}" data-lang="${lang}"></div>`;
    const s = document.createElement("script");
    s.src = `${scriptUrl}?ts=${Date.now()}`;
    s.async = true;
    host.appendChild(s);
  }, [slug, type, lang, scriptUrl]);

  const labels = {
    contact: { es: "Contacto", en: "Contact" },
    quote: { es: "Cotización", en: "Quote" },
    appointment: { es: "Cita", en: "Appointment" },
    chat: { es: "Chat IA", en: "AI Chat" },
  };

  return (
    <div className="space-y-6 pb-12" data-testid="embed-settings">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Globe className="w-6 h-6 text-emerald-600 flex-none" /> {t("embed.title")}
        </h1>
        <p className="text-slate-500">{t("embed.subtitle")}</p>
      </div>

      {/* How it works */}
      <Card className="card-elevated border-0 shadow-none p-4 bg-emerald-50 ring-1 ring-emerald-100">
        <p className="text-sm text-emerald-900 leading-relaxed">{t("embed.how")}</p>
      </Card>

      {/* Type selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="embed-type-selector">
        {TYPES.map((ty) => {
          const Icon = ty.icon;
          const active = type === ty.key;
          return (
            <button
              key={ty.key}
              data-testid={`embed-type-${ty.key}`}
              onClick={() => setType(ty.key)}
              className={`flex-col gap-1.5 h-auto py-3 rounded-2xl border transition-colors flex items-center justify-center text-xs font-semibold ${
                active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Icon className="w-5 h-5" />
              {labels[ty.key][lang]}
            </button>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Snippet */}
        <Card className="card-elevated border-0 shadow-none p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 font-heading font-bold text-slate-900">
              <Code2 className="w-4 h-4 text-slate-500" /> {t("embed.codeTitle")}
            </div>
            <Button data-testid="embed-copy-btn" onClick={copy} size="sm" className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? t("embed.copied") : t("embed.copy")}
            </Button>
          </div>
          <pre
            data-testid="embed-snippet"
            className="text-xs bg-slate-900 text-emerald-200 rounded-xl p-3.5 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed"
          >
            {snippet || "…"}
          </pre>
          <p className="text-xs text-slate-400 mt-3">{t("embed.note")}</p>
        </Card>

        {/* Live preview */}
        <Card className="card-elevated border-0 shadow-none p-4 bg-slate-50">
          <div className="font-heading font-bold text-slate-900 mb-3">{t("embed.previewTitle")}</div>
          {type === "chat" ? (
            <div data-testid="embed-preview" className="flex flex-col items-center justify-center text-center py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center text-3xl shadow-lg">💬</div>
              <p className="text-sm text-slate-500 mt-3 max-w-xs">{t("embed.chatPreview")}</p>
            </div>
          ) : (
            <div ref={previewRef} data-testid="embed-preview" className="flex justify-center" />
          )}
        </Card>
      </div>
    </div>
  );
}
