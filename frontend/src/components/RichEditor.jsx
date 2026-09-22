import React, { useEffect, useRef, useCallback } from "react";
import { Bold, Italic, Underline, List, ListOrdered, Link2, Palette, Eraser } from "lucide-react";

const FONTS = [
  { label: "Fuente", css: "" },
  { label: "Sans (DM Sans)", css: "'DM Sans', sans-serif" },
  { label: "Moderna (Outfit)", css: "'Outfit', sans-serif" },
  { label: "Elegante (Playfair)", css: "'Playfair Display', serif" },
  { label: "Clásica (Georgia)", css: "Georgia, serif" },
  { label: "Mono", css: "'Courier New', monospace" },
];
const SIZES = [
  { label: "Tamaño", v: "" },
  { label: "Pequeño", v: "2" },
  { label: "Normal", v: "3" },
  { label: "Grande", v: "5" },
  { label: "Muy grande", v: "6" },
];

const _isHtml = (t) => /<\/?(p|div|span|b|strong|i|em|u|a|ul|ol|li|br|h[1-6]|font)\b/i.test(t || "");
const _esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const _isBullet = (l) => /^\s*([-*•✅✔️➤])\s+/.test(l);
// Convert the legacy markdown-ish syntax (### headings, - bullets, blank lines)
// into HTML so existing content shows formatted inside the WYSIWYG editor.
const mdToHtml = (text) => {
  if (_isHtml(text)) return text || "";
  const block = (t) => {
    const lines = t.split(/\n/).filter((l) => l.trim());
    if (lines.length && lines.every(_isBullet)) return "<ul>" + lines.map((l) => `<li>${_esc(l.replace(/^\s*([-*•✅✔️➤])\s+/, ""))}</li>`).join("") + "</ul>";
    return "<p>" + _esc(t).replace(/\n/g, "<br>") + "</p>";
  };
  return (text || "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean).map((t) => {
    if (t.startsWith("### ") || t.startsWith("## ")) {
      const nl = t.indexOf("\n");
      const head = nl === -1 ? t : t.slice(0, nl);
      const rest = nl === -1 ? "" : t.slice(nl + 1).trim();
      const tag = head.startsWith("### ") ? "h3" : "h2";
      return `<${tag}>${_esc(head.replace(/^#{2,3}\s+/, ""))}</${tag}>` + (rest ? block(rest) : "");
    }
    return block(t);
  }).join("");
};

// A dependency-free WYSIWYG editor (contentEditable + execCommand) that outputs HTML.
export default function RichEditor({ value, onChange, placeholder = "", minHeight = 120, testid }) {
  const ref = useRef(null);
  const focused = useRef(false);
  const lastHtml = useRef(null);

  // Sync external value → editor only when not editing (keeps caret stable).
  useEffect(() => {
    if (!ref.current || focused.current) return;
    const incoming = mdToHtml(value);
    if (incoming !== lastHtml.current && ref.current.innerHTML !== incoming) {
      ref.current.innerHTML = incoming || "";
      lastHtml.current = incoming;
    }
  }, [value]);

  const emit = useCallback(() => { if (ref.current) { lastHtml.current = ref.current.innerHTML; onChange(ref.current.innerHTML); } }, [onChange]);

  const exec = (command, val = null) => {
    ref.current?.focus();
    try { document.execCommand("styleWithCSS", false, true); } catch (e) {}
    document.execCommand(command, false, val);
    emit();
  };

  const addLink = () => {
    const url = window.prompt("URL del enlace (https://...)", "https://");
    if (url) exec("createLink", url);
  };

  const Btn = ({ onClick, title, children, active }) => (
    <button type="button" title={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick}
      className="h-8 min-w-8 px-2 rounded-md text-slate-600 hover:bg-slate-200 flex items-center justify-center text-sm font-semibold transition">
      {children}
    </button>
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden" data-testid={testid}>
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-200 bg-slate-50">
        <Btn title="Negrita" onClick={() => exec("bold")}><Bold className="w-4 h-4" /></Btn>
        <Btn title="Cursiva" onClick={() => exec("italic")}><Italic className="w-4 h-4" /></Btn>
        <Btn title="Subrayado" onClick={() => exec("underline")}><Underline className="w-4 h-4" /></Btn>
        <span className="w-px h-5 bg-slate-200 mx-1" />
        <Btn title="Viñetas" onClick={() => exec("insertUnorderedList")}><List className="w-4 h-4" /></Btn>
        <Btn title="Lista numerada" onClick={() => exec("insertOrderedList")}><ListOrdered className="w-4 h-4" /></Btn>
        <Btn title="Enlace" onClick={addLink}><Link2 className="w-4 h-4" /></Btn>
        <span className="w-px h-5 bg-slate-200 mx-1" />
        <select title="Fuente" onMouseDown={(e) => e.stopPropagation()} onChange={(e) => { if (e.target.value) exec("fontName", e.target.value); e.target.selectedIndex = 0; }}
          className="h-8 rounded-md border border-slate-200 bg-white text-xs px-1 text-slate-600 max-w-[120px]">
          {FONTS.map((f, i) => <option key={i} value={f.css}>{f.label}</option>)}
        </select>
        <select title="Tamaño" onChange={(e) => { if (e.target.value) exec("fontSize", e.target.value); e.target.selectedIndex = 0; }}
          className="h-8 rounded-md border border-slate-200 bg-white text-xs px-1 text-slate-600">
          {SIZES.map((s, i) => <option key={i} value={s.v}>{s.label}</option>)}
        </select>
        <label title="Color de texto" className="h-8 px-1.5 rounded-md hover:bg-slate-200 flex items-center cursor-pointer text-slate-600">
          <Palette className="w-4 h-4" />
          <input type="color" className="w-0 h-0 opacity-0 absolute" onChange={(e) => exec("foreColor", e.target.value)} />
        </label>
        <Btn title="Quitar formato" onClick={() => exec("removeFormat")}><Eraser className="w-4 h-4" /></Btn>
      </div>
      <div
        ref={ref}
        className="rte-editor rte-content px-3 py-2.5 text-sm text-slate-700"
        style={{ minHeight }}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        data-testid={testid ? `${testid}-area` : undefined}
        onInput={emit}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; emit(); }}
      />
    </div>
  );
}
