import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe, Copy, Check, MessageSquare, FileText, CalendarDays, Code2, Bot } from "lucide-react";
import { toast } from "sonner";

const TYPES = [
  { key: "contact", icon: MessageSquare },
  { key: "quote", icon: FileText },
  { key: "appointment", icon: CalendarDays },
  { key: "chat", icon: Bot },
];

const DEFAULT_ACCENT = "#059669";
const ACCENT_PRESETS = ["#059669", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#0891b2", "#dc2626", "#0f172a"];

const TX = {
  design: { es: "Diseño", en: "Design" },
  accent: { es: "Color principal", en: "Accent color" },
  theme: { es: "Tema", en: "Theme" },
  light: { es: "Claro", en: "Light" },
  dark: { es: "Oscuro", en: "Dark" },
  corners: { es: "Bordes", en: "Corners" },
  rounded: { es: "Redondos", en: "Rounded" },
  sharp: { es: "Rectos", en: "Sharp" },
  pill: { es: "Pastilla", en: "Pill" },
  title: { es: "Título personalizado", en: "Custom title" },
  titlePh: { es: "Deja vacío para el título por defecto", en: "Leave empty for default title" },
  font: { es: "Tipografía", en: "Font" },
  fontSystem: { es: "UniTech", en: "UniTech" },
  fontInherit: { es: "La del sitio", en: "Site font" },
  branding: { es: 'Mostrar "por UniTech"', en: 'Show "by UniTech"' },
  chatBtn: { es: "Botón del chat", en: "Chat button" },
  position: { es: "Posición", en: "Position" },
  right: { es: "Derecha", en: "Right" },
  left: { es: "Izquierda", en: "Left" },
  launcher: { es: "Texto del botón (opcional)", en: "Button text (optional)" },
  launcherPh: { es: 'Ej: "¿Necesitas ayuda?"', en: 'e.g. "Need help?"' },
  on: { es: "Sí", en: "Yes" },
  off: { es: "No", en: "No" },
};

export default function EmbedSettings() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith("es") ? "es" : "en";
  const tx = (k) => TX[k][lang];

  const [slug, setSlug] = useState("");
  const [type, setType] = useState("contact");
  const [copied, setCopied] = useState(false);

  // Customization
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [theme, setTheme] = useState("light");
  const [radius, setRadius] = useState("rounded");
  const [title, setTitle] = useState("");
  const [font, setFont] = useState("system");
  const [branding, setBranding] = useState(true);
  const [position, setPosition] = useState("right");
  const [launcher, setLauncher] = useState("");

  const previewRef = useRef(null);
  const origin = window.location.origin;
  const scriptUrl = `${origin}/embed.js`;

  useEffect(() => {
    api.get("/card/settings").then((r) => setSlug(r.data?.slug || "")).catch(() => {});
  }, []);

  const buildAttrs = () => {
    const a = [`data-slug="${slug}"`];
    if (type !== "chat") a.push(`data-type="${type}"`);
    a.push(`data-lang="${lang}"`);
    if (accent && accent.toLowerCase() !== DEFAULT_ACCENT) a.push(`data-accent="${accent}"`);
    if (theme === "dark") a.push(`data-theme="dark"`);
    if (radius !== "rounded") a.push(`data-radius="${radius}"`);
    if (title.trim()) a.push(`data-title="${title.trim().replace(/"/g, "&quot;")}"`);
    if (font === "inherit") a.push(`data-font="inherit"`);
    if (!branding) a.push(`data-branding="off"`);
    if (type === "chat") {
      if (position === "left") a.push(`data-position="left"`);
      if (launcher.trim()) a.push(`data-launcher="${launcher.trim().replace(/"/g, "&quot;")}"`);
    }
    return a.join(" ");
  };

  const snippet = slug
    ? type === "chat"
      ? `<!-- UniTech AI chat -->\n<script src="${scriptUrl}" data-unitech-chat ${buildAttrs()} async></script>`
      : `<!-- UniTech form -->\n<div data-unitech-form ${buildAttrs()}></div>\n<script src="${scriptUrl}" async></script>`
    : "";

  const copy = () => {
    navigator.clipboard?.writeText(snippet);
    setCopied(true);
    toast.success(t("embed.copied"));
    setTimeout(() => setCopied(false), 1800);
  };

  // Live preview for forms — inject the real widget with all data-* attributes.
  useEffect(() => {
    if (!slug || !previewRef.current) return;
    const host = previewRef.current;
    if (type === "chat") { host.innerHTML = ""; return; }
    host.innerHTML = `<div data-unitech-form ${buildAttrs()}></div>`;
    const s = document.createElement("script");
    s.src = `${scriptUrl}?ts=${Date.now()}`;
    s.async = true;
    host.appendChild(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, type, lang, accent, theme, radius, title, font, branding]);

  const labels = {
    contact: { es: "Contacto", en: "Contact" },
    quote: { es: "Cotización", en: "Quote" },
    appointment: { es: "Cita", en: "Appointment" },
    chat: { es: "Chat IA", en: "AI Chat" },
  };

  // theme-derived colors for the chat mock preview
  const dark = theme === "dark";
  const pal = dark
    ? { card: "#1c1c1f", text: "#fafafa", sub: "#a1a1aa", border: "#3f3f46", msgs: "#161618", bot: "#27272a" }
    : { card: "#ffffff", text: "#18181b", sub: "#52525b", border: "#e4e4e7", msgs: "#fafafa", bot: "#ffffff" };
  const rad = radius === "sharp" ? { card: 6, field: 6 } : radius === "pill" ? { card: 18, field: 22 } : { card: 16, field: 12 };

  const Seg = ({ options, value, onChange, testid }) => (
    <div className="inline-flex rounded-xl bg-slate-100 p-1 gap-1" data-testid={testid}>
      {options.map((o) => (
        <button
          key={o.v}
          data-testid={`${testid}-${o.v}`}
          onClick={() => onChange(o.v)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            value === o.v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6 pb-12" data-testid="embed-settings">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Globe className="w-6 h-6 text-emerald-600 flex-none" /> {t("embed.title")}
        </h1>
        <p className="text-slate-500">{t("embed.subtitle")}</p>
      </div>

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

      {/* Customization controls */}
      <Card className="card-elevated border-0 shadow-none p-4" data-testid="embed-design-panel">
        <div className="font-heading font-bold text-slate-900 mb-4">{tx("design")}</div>
        <div className="grid sm:grid-cols-2 gap-5">
          {/* Accent */}
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-2">{tx("accent")}</label>
            <div className="flex items-center gap-2 flex-wrap">
              {ACCENT_PRESETS.map((c) => (
                <button
                  key={c}
                  data-testid={`embed-accent-${c.replace("#", "")}`}
                  onClick={() => setAccent(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${accent.toLowerCase() === c ? "border-slate-900" : "border-white"}`}
                  style={{ background: c, boxShadow: "0 0 0 1px #e2e8f0" }}
                  aria-label={c}
                />
              ))}
              <input
                type="color"
                data-testid="embed-accent-picker"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="w-8 h-8 rounded-md border border-slate-200 cursor-pointer bg-white p-0.5"
              />
            </div>
          </div>

          {/* Theme */}
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-2">{tx("theme")}</label>
            <Seg testid="embed-theme" value={theme} onChange={setTheme} options={[{ v: "light", label: tx("light") }, { v: "dark", label: tx("dark") }]} />
          </div>

          {/* Corners */}
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-2">{tx("corners")}</label>
            <Seg testid="embed-radius" value={radius} onChange={setRadius} options={[{ v: "rounded", label: tx("rounded") }, { v: "sharp", label: tx("sharp") }, { v: "pill", label: tx("pill") }]} />
          </div>

          {/* Font */}
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-2">{tx("font")}</label>
            <Seg testid="embed-font" value={font} onChange={setFont} options={[{ v: "system", label: tx("fontSystem") }, { v: "inherit", label: tx("fontInherit") }]} />
          </div>

          {/* Custom title */}
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-500 block mb-2">{tx("title")}</label>
            <Input data-testid="embed-title-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tx("titlePh")} className="rounded-xl" maxLength={60} />
          </div>

          {/* Branding */}
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-2">{tx("branding")}</label>
            <Seg testid="embed-branding" value={branding ? "on" : "off"} onChange={(v) => setBranding(v === "on")} options={[{ v: "on", label: tx("on") }, { v: "off", label: tx("off") }]} />
          </div>

          {/* Chat-only options */}
          {type === "chat" && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-2">{tx("position")}</label>
                <Seg testid="embed-position" value={position} onChange={setPosition} options={[{ v: "right", label: tx("right") }, { v: "left", label: tx("left") }]} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-500 block mb-2">{tx("launcher")}</label>
                <Input data-testid="embed-launcher-input" value={launcher} onChange={(e) => setLauncher(e.target.value)} placeholder={tx("launcherPh")} className="rounded-xl" maxLength={30} />
              </div>
            </>
          )}
        </div>
      </Card>

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
            <div key="preview-chat" data-testid="embed-preview" className="flex flex-col items-center gap-4 py-2">
              {/* Chat panel mock reflecting the chosen options */}
              <div
                className="w-full max-w-[320px] overflow-hidden border"
                style={{ background: pal.card, borderColor: pal.border, borderRadius: rad.card, boxShadow: "0 10px 30px rgba(0,0,0,0.12)", fontFamily: font === "inherit" ? "inherit" : undefined }}
              >
                <div className="px-4 py-3 text-white font-bold text-sm" style={{ background: accent }}>
                  {title.trim() || (lang === "es" ? "Asistente" : "Assistant")}
                </div>
                <div className="p-3 space-y-2" style={{ background: pal.msgs }}>
                  <div className="text-sm px-3 py-2 inline-block max-w-[85%]" style={{ background: pal.bot, color: pal.text, border: `1px solid ${pal.border}`, borderRadius: 14 }}>
                    {lang === "es" ? "¡Hola! 👋 ¿En qué puedo ayudarte?" : "Hi! 👋 How can I help you?"}
                  </div>
                  <div className="flex justify-end">
                    <div className="text-sm px-3 py-2 text-white max-w-[85%]" style={{ background: accent, borderRadius: 14 }}>
                      {lang === "es" ? "Necesito una cotización" : "I need a quote"}
                    </div>
                  </div>
                </div>
                <div className="p-2.5 flex gap-2 border-t" style={{ borderColor: pal.border, background: pal.card }}>
                  <div className="flex-1 h-9 border" style={{ borderColor: pal.border, borderRadius: rad.field, background: dark ? "#27272a" : "#fff" }} />
                  <div className="w-9 h-9 text-white flex items-center justify-center" style={{ background: accent, borderRadius: rad.field }}>➤</div>
                </div>
              </div>
              {/* Launcher mock */}
              <div className={`w-full flex ${position === "left" ? "justify-start" : "justify-end"}`}>
                {launcher.trim() ? (
                  <div className="h-12 px-4 rounded-full text-white flex items-center gap-2 text-sm font-semibold shadow-lg" style={{ background: accent }}>
                    💬 {launcher.trim()}
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-full text-white flex items-center justify-center text-2xl shadow-lg" style={{ background: accent }}>💬</div>
                )}
              </div>
            </div>
          ) : (
            <div key="preview-form" ref={previewRef} data-testid="embed-preview" className="flex justify-center" />
          )}
        </Card>
      </div>
    </div>
  );
}
