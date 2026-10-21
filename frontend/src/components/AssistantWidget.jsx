import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { Send, X, ImagePlus, Loader2, Check, Bot } from "lucide-react";

function uuid() {
  return (crypto?.randomUUID && crypto.randomUUID()) || `sid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Minimal **bold** + newline renderer (replies are short, plain text).
function renderText(text) {
  const parts = (text || "").split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );
}

export default function AssistantWidget() {
  const { i18n } = useTranslation();
  const lang = (i18n.language || "es").startsWith("es") ? "es" : "en";
  const T = (en, es) => (lang === "es" ? es : en);

  const [open, setOpen] = useState(false);
  const [sid] = useState(() => {
    let s = localStorage.getItem("unitech_assistant_sid");
    if (!s) { s = uuid(); localStorage.setItem("unitech_assistant_sid", s); }
    return s;
  });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef(null);
  const fileRef = useRef(null);

  const greeting = {
    role: "assistant",
    content: T(
      "Hi! I'm your Unitech assistant. Tell me what you want to do — change your card photo, update your info, add a service, create an event — or ask me to help set up your account.",
      "¡Hola! Soy tu asistente de Unitech. Dime qué quieres hacer — cambiar la foto de tu tarjeta, actualizar tus datos, agregar un servicio, crear un evento — o pídeme que te ayude a configurar tu cuenta."
    ),
  };

  useEffect(() => {
    if (!open || loaded) return;
    (async () => {
      try {
        const { data } = await api.get(`/assistant/history/${sid}`);
        setMessages((data.messages && data.messages.length) ? data.messages : [greeting]);
        setPending(!!data.pending);
      } catch { setMessages([greeting]); }
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy, open]);

  const send = async () => {
    const text = input.trim();
    if ((!text && !file) || busy) return;
    const shownUser = text || (file ? T("📷 Attached image", "📷 Imagen adjunta") : "");
    setMessages((m) => [...m, { role: "user", content: shownUser }]);
    setInput(""); setBusy(true);
    const fd = new FormData();
    fd.append("session_id", sid);
    fd.append("message", text);
    fd.append("lang", lang);
    if (file) fd.append("file", file);
    setFile(null);
    try {
      const { data } = await api.post("/assistant/chat", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      setPending(!!data.needs_confirmation);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: T("Sorry, something went wrong. Try again.", "Perdón, algo salió mal. Intenta de nuevo.") }]);
    }
    setBusy(false);
  };

  const confirm = async () => {
    if (busy) return;
    setBusy(true); setPending(false);
    try {
      const { data } = await api.post("/assistant/execute", { session_id: sid, lang });
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: e?.response?.data?.detail || T("Could not apply the change.", "No pude aplicar el cambio.") }]);
    }
    setBusy(false);
  };

  const cancel = async () => {
    setPending(false);
    try { await api.post("/assistant/cancel", { session_id: sid, lang }); } catch { /* ignore */ }
    setMessages((m) => [...m, { role: "assistant", content: T("Okay, I won't make that change.", "Está bien, no haré ese cambio.") }]);
  };

  return (
    <>
      {!open && (
        <div className="fixed z-40 bottom-20 lg:bottom-6 right-4 lg:right-6 flex items-center gap-2">
          <style>{`
            @keyframes uaBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
            @keyframes uaGlow{0%,100%{opacity:.45;transform:scale(1)}50%{opacity:.9;transform:scale(1.18)}}
            @keyframes uaBlink{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.08)}}
            @keyframes uaPulse{0%,100%{opacity:.4}50%{opacity:1}}
            @keyframes uaWave{0%,60%,100%{opacity:0;transform:translateX(6px)}15%,45%{opacity:1;transform:translateX(0)}}
          `}</style>
          <div className="hidden sm:block px-3 py-1.5 rounded-2xl rounded-br-sm bg-white shadow-lg border border-slate-200 text-xs font-semibold text-slate-700" style={{ animation: "uaWave 6s ease-in-out infinite" }} data-testid="assistant-hint-bubble">
            {T("Need help? Wake me up 👋", "¿Te ayudo? Despiértame 👋")}
          </div>
          <button
            onClick={() => setOpen(true)}
            data-testid="assistant-fab"
            className="relative w-16 h-16 flex items-center justify-center group"
            aria-label="Asistente"
          >
            <span className="absolute inset-0 rounded-full bg-emerald-400/40 blur-md" style={{ animation: "uaGlow 2.8s ease-in-out infinite" }} />
            <span className="relative w-14 h-14 rounded-full shadow-xl bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center group-hover:scale-105 group-active:scale-95 transition" style={{ animation: "uaBob 3s ease-in-out infinite" }}>
              <svg width="34" height="34" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* antenna */}
                <line x1="24" y1="6" x2="24" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <circle cx="24" cy="5" r="2.5" fill="#fde047" style={{ animation: "uaPulse 1.6s ease-in-out infinite" }} />
                {/* head */}
                <rect x="9" y="12" width="30" height="24" rx="8" fill="white" />
                {/* ears */}
                <rect x="6" y="19" width="3" height="9" rx="1.5" fill="white" />
                <rect x="39" y="19" width="3" height="9" rx="1.5" fill="white" />
                {/* eyes (blink) */}
                <g style={{ transformOrigin: "center", animation: "uaBlink 4s ease-in-out infinite" }}>
                  <circle cx="18" cy="23" r="3.2" fill="#0f3a8a" />
                  <circle cx="30" cy="23" r="3.2" fill="#0f3a8a" />
                </g>
                {/* smile */}
                <path d="M18 29.5c2 2.2 10 2.2 12 0" stroke="#0f3a8a" strokeWidth="2" strokeLinecap="round" fill="none" />
              </svg>
            </span>
          </button>
        </div>
      )}

      {open && (
        <div className="fixed z-50 bottom-0 right-0 lg:bottom-6 lg:right-6 w-full lg:w-[400px] h-[85vh] lg:h-[600px] bg-white lg:rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden" data-testid="assistant-panel">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-900 to-emerald-600 text-white flex-none">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center"><Bot className="w-5 h-5" /></div>
              <div>
                <div className="font-bold text-sm leading-none">{T("Unitech Assistant", "Asistente Unitech")}</div>
                <div className="text-[11px] text-white/80 mt-0.5">{T("Here to help you", "Aquí para ayudarte")}</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} data-testid="assistant-close" className="w-8 h-8 rounded-full hover:bg-white/15 flex items-center justify-center"><X className="w-5 h-5" /></button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-slate-50" data-testid="assistant-messages">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${m.role === "user" ? "bg-blue-600 text-white rounded-br-md" : "bg-white border border-slate-200 text-slate-800 rounded-bl-md"}`}>
                  {renderText(m.content)}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start"><div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-3.5 py-2.5"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div></div>
            )}
          </div>

          {/* Confirm bar */}
          {pending && !busy && (
            <div className="flex-none px-3 py-2.5 bg-amber-50 border-t border-amber-200 flex items-center gap-2" data-testid="assistant-confirm-bar">
              <button onClick={confirm} data-testid="assistant-confirm" className="flex-1 h-10 rounded-xl bg-emerald-600 text-white font-bold text-sm inline-flex items-center justify-center gap-1.5 hover:bg-emerald-700"><Check className="w-4 h-4" /> {T("Yes, do it", "Sí, hazlo")}</button>
              <button onClick={cancel} data-testid="assistant-cancel" className="flex-1 h-10 rounded-xl bg-white border border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-50">{T("No", "No")}</button>
            </div>
          )}

          {/* Input */}
          <div className="flex-none p-3 border-t border-slate-200 bg-white">
            {file && (
              <div className="mb-2 flex items-center gap-2 text-xs text-slate-600 bg-slate-100 rounded-lg px-2.5 py-1.5" data-testid="assistant-file-chip">
                <ImagePlus className="w-3.5 h-3.5" /> {file.name}
                <button onClick={() => setFile(null)} className="ml-auto text-slate-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <button onClick={() => fileRef.current?.click()} data-testid="assistant-attach" className="w-10 h-10 flex-none rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center" title={T("Attach image", "Adjuntar imagen")}>
                <ImagePlus className="w-5 h-5" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); e.target.value = ""; }} />
              <textarea
                value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={1} placeholder={T("Type what you need…", "Escribe lo que necesitas…")}
                className="flex-1 resize-none max-h-28 rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="assistant-input" />
              <button onClick={send} disabled={busy || (!input.trim() && !file)} data-testid="assistant-send" className="w-10 h-10 flex-none rounded-xl bg-blue-600 text-white flex items-center justify-center disabled:opacity-40 hover:bg-blue-700">
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
