/**
 * PlatformChat — Floating AI chat widget for the Unitap landing page.
 * Captures leads automatically when the AI detects LEAD_READY.
 */
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { MessageCircle, X, Send, Loader2, Sparkles } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const newSessionId = () => "sess_" + Math.random().toString(36).slice(2) + Date.now().toString(36);

export default function PlatformChat() {
  const [open, setOpen] = useState(false);
  const [sessionId] = useState(() => {
    const saved = localStorage.getItem("unitap_chat_sid");
    if (saved) return saved;
    const sid = newSessionId();
    localStorage.setItem("unitap_chat_sid", sid);
    return sid;
  });
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "¡Hola! 👋 Soy el asistente de Unitap. ¿En qué puedo ayudarte? Puedo contarte sobre las funciones, precios, o agendar una llamada con el fundador.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/api/public/unitap/chat`, {
        session_id: sessionId,
        message: text,
        language: "es",
      });
      setMessages((m) => [...m, { role: "assistant", content: data.reply || "..." }]);
      if (!open) setUnread((u) => u + 1);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: "Disculpa, tuve un problema. ¿Puedes intentar de nuevo?" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Bubble */}
      {!open && (
        <button
          data-testid="platform-chat-bubble"
          onClick={() => { setOpen(true); setUnread(0); }}
          className="fixed bottom-6 right-6 z-50 group"
          aria-label="Abrir chat con asistente de Unitap"
        >
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-emerald-400 blur-xl opacity-50 animate-pulse" />
            <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shadow-xl shadow-emerald-500/40 flex items-center justify-center hover:scale-105 transition-transform">
              <MessageCircle className="w-7 h-7 text-white" />
            </div>
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center border-2 border-white">
                {unread}
              </span>
            )}
          </div>
          <span className="absolute right-full top-1/2 -translate-y-1/2 mr-3 px-3 py-1.5 rounded-full bg-slate-900 text-white text-sm font-semibold whitespace-nowrap shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            ¿Tienes preguntas? 💬
          </span>
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <div
          data-testid="platform-chat-panel"
          className="fixed bottom-6 right-6 z-50 w-[min(380px,calc(100vw-2rem))] h-[min(560px,calc(100vh-3rem))] rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold leading-none">Asistente Unitap</div>
                <div className="text-[11px] text-white/75 mt-0.5">Responde 24/7</div>
              </div>
            </div>
            <button
              data-testid="platform-chat-close"
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              aria-label="Cerrar chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-slate-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-emerald-600 text-white rounded-br-sm"
                      : "bg-white text-slate-800 rounded-bl-sm shadow-sm border border-slate-100"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white text-slate-500 rounded-2xl rounded-bl-sm shadow-sm border border-slate-100 px-3.5 py-2.5 text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Escribiendo…
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-slate-200 bg-white">
            <div className="flex items-center gap-2">
              <input
                data-testid="platform-chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Escribe tu pregunta…"
                disabled={loading}
                className="flex-1 h-11 px-4 rounded-full bg-slate-100 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                data-testid="platform-chat-send"
                onClick={send}
                disabled={loading || !input.trim()}
                className="w-11 h-11 rounded-full bg-emerald-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors"
                aria-label="Enviar"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-2">
              Powered by Unitap AI · Tu info está segura
            </p>
          </div>
        </div>
      )}
    </>
  );
}
