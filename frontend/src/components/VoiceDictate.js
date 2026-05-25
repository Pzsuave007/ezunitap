/**
 * VoiceDictate — reusable microphone button that records audio via MediaRecorder,
 * uploads it to /api/voice/transcribe (Whisper), and calls onTranscript(text)
 * with the result. Designed to live next to a Textarea/Input.
 */
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2, X } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

const PREFERRED_MIME = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
];

function pickMime() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const m of PREFERRED_MIME) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

export default function VoiceDictate({
  onTranscript,
  language = "es",
  appendMode = true,
  size = "md",
  label = "Dictar",
  testid = "voice-dictate",
}) {
  const [supported, setSupported] = useState(true);
  const [state, setState] = useState("idle"); // idle | recording | uploading
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const mimeRef = useRef("");

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices || typeof MediaRecorder === "undefined") {
      setSupported(false);
    }
    return () => cleanup();
    // eslint-disable-next-line
  }, []);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
  };

  const start = async () => {
    try {
      const mime = pickMime();
      mimeRef.current = mime || "";
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = handleStop;
      rec.start();
      recorderRef.current = rec;
      setState("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch (err) {
      cleanup();
      setState("idle");
      if (err?.name === "NotAllowedError") {
        toast.error("Permite acceso al micrófono para dictar");
      } else {
        toast.error("No se pudo iniciar el micrófono");
      }
    }
  };

  const stop = () => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const cancel = () => {
    chunksRef.current = []; // discard
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.onstop = null; // skip handleStop
      recorderRef.current.stop();
    }
    cleanup();
    setState("idle");
    setElapsed(0);
  };

  const handleStop = async () => {
    const chunks = chunksRef.current;
    cleanup();
    if (chunks.length === 0) {
      setState("idle");
      return;
    }
    setState("uploading");
    try {
      const mime = mimeRef.current || "audio/webm";
      const blob = new Blob(chunks, { type: mime });
      if (blob.size < 1000) {
        toast.info("Grabación muy corta, intenta de nuevo");
        setState("idle");
        return;
      }
      const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
      const fd = new FormData();
      fd.append("file", blob, `voice.${ext}`);
      if (language) fd.append("language", language);
      const { data } = await api.post("/voice/transcribe", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const text = (data.text || "").trim();
      if (!text) {
        toast.info("No se detectó voz, intenta de nuevo");
      } else {
        onTranscript(text, { append: appendMode });
        toast.success("Texto dictado agregado");
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error transcribiendo");
    } finally {
      setState("idle");
      setElapsed(0);
    }
  };

  if (!supported) return null;

  const sizes = {
    sm: { btn: "h-9 px-3 text-xs gap-1", icon: "w-3.5 h-3.5" },
    md: { btn: "h-10 px-3.5 text-sm gap-1.5", icon: "w-4 h-4" },
    lg: { btn: "h-12 px-4 text-sm gap-2", icon: "w-5 h-5" },
  }[size] || { btn: "h-10 px-3.5 text-sm gap-1.5", icon: "w-4 h-4" };

  if (state === "recording") {
    const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const ss = String(elapsed % 60).padStart(2, "0");
    return (
      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={stop}
          data-testid={`${testid}-stop`}
          className={`inline-flex items-center rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md ${sizes.btn} animate-pulse tap`}
        >
          <span className="relative flex items-center justify-center">
            <span className="absolute w-2 h-2 rounded-full bg-white animate-ping" />
            <span className="w-2 h-2 rounded-full bg-white relative" />
          </span>
          <span className="font-mono tabular-nums">{mm}:{ss}</span>
          <span className="hidden sm:inline">Toca para parar</span>
        </button>
        <button
          type="button"
          onClick={cancel}
          aria-label="Cancelar grabación"
          data-testid={`${testid}-cancel`}
          className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 inline-flex items-center justify-center tap"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (state === "uploading") {
    return (
      <button
        type="button"
        disabled
        data-testid={`${testid}-uploading`}
        className={`inline-flex items-center rounded-xl bg-slate-100 text-slate-600 font-semibold ${sizes.btn}`}
      >
        <Loader2 className={`${sizes.icon} animate-spin`} />
        <span>Transcribiendo…</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      data-testid={testid}
      className={`inline-flex items-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-emerald-400 hover:text-emerald-700 font-semibold shadow-sm ${sizes.btn} tap`}
    >
      <Mic className={sizes.icon} strokeWidth={2.2} />
      <span>{label}</span>
    </button>
  );
}

VoiceDictate.IconOnly = function VoiceDictateIcon(props) {
  return <VoiceDictate {...props} label="" />;
};
// Export for tests
export { MicOff };
