import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Loader2, Download, Trash2, ImagePlus, X, Video,
  Music, Play, Pause, Upload, Captions, Clapperboard, Mic, Sparkles,
  Check, Palette,
} from "lucide-react";
import { COLOR_THEMES, resolveColors } from "@/lib/socialThemes";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const REEL_TEMPLATES = [
  { id: "showcase", label: "Clásico", desc: "Fotos con tu mensaje", min: 1, max: 5 },
  { id: "before_after", label: "Antes / Después", desc: "Compara las dos fotos lado a lado", min: 2, max: 2 },
  { id: "promo", label: "Oferta / Promo", desc: "Con sello de oferta", min: 1, max: 5 },
  { id: "services", label: "Lista de servicios", desc: "Un servicio por foto", min: 1, max: 5 },
  { id: "testimonial", label: "Testimonio", desc: "Reseña de cliente", min: 1, max: 3 },
];
const MOTIONS = [
  { id: "auto", label: "Automático" },
  { id: "zoom_in", label: "Acercar" },
  { id: "zoom_out", label: "Alejar" },
  { id: "pan", label: "Paneo" },
];
const TRANSITIONS = [
  { id: "fade", label: "Suave" },
  { id: "deslizar", label: "Deslizar" },
  { id: "barrido", label: "Barrido" },
  { id: "circulo", label: "Círculo" },
  { id: "disolver", label: "Disolver" },
  { id: "pixel", label: "Pixelado" },
];
const DURATIONS = [10, 15, 20];

export default function ReelStudio({ injectPhoto } = {}) {
  const [template, setTemplate] = useState("showcase");
  const [photos, setPhotos] = useState([]);
  const [serviceTexts, setServiceTexts] = useState([]);
  const [authorName, setAuthorName] = useState("");
  const [brief, setBrief] = useState("");
  const [copyDraft, setCopyDraft] = useState(null);
  const [copyLoading, setCopyLoading] = useState(false);
  const [language, setLanguage] = useState("en");
  const [colorTheme, setColorTheme] = useState("card");
  const [customAccent, setCustomAccent] = useState("#10b981");
  const [customBrand, setCustomBrand] = useState("#0f5f46");
  const [tracks, setTracks] = useState([]);
  const [music, setMusic] = useState("none");
  const [musicFile, setMusicFile] = useState(null);
  const [duration, setDuration] = useState(10);
  const [motion, setMotion] = useState("auto");
  const [transition, setTransition] = useState("fade");
  const [subtitles, setSubtitles] = useState(false);
  const [outro, setOutro] = useState(true);
  const [voiceover, setVoiceover] = useState(false);
  const [voiceMode, setVoiceMode] = useState("short");
  const [voiceSayPhone, setVoiceSayPhone] = useState(false);
  const [voices, setVoices] = useState([]);
  const [speeds, setSpeeds] = useState([]);
  const [voice, setVoice] = useState("");
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [previewingVoice, setPreviewingVoice] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reel, setReel] = useState(null);
  const [reels, setReels] = useState([]);
  const [resultOpen, setResultOpen] = useState(false);
  const [playingTrack, setPlayingTrack] = useState(null);

  const fileRef = useRef(null);
  const musicRef = useRef(null);
  const audioRef = useRef(null);
  const pollRef = useRef(null);

  const tpl = REEL_TEMPLATES.find((t) => t.id === template);
  const maxPhotos = tpl.max;
  const isBeforeAfter = template === "before_after";
  const isServices = template === "services";
  const isTestimonial = template === "testimonial";

  const setServiceText = (i, v) =>
    setServiceTexts((prev) => { const next = [...prev]; next[i] = v.slice(0, 120); return next; });

  const selectTemplate = (id) => {
    setTemplate(id);
    if (id === "before_after") setTransition("deslizar");
  };

  const loadReels = async () => {
    try { const { data } = await api.get("/social/reels"); setReels(data); } catch { /* ignore */ }
  };
  useEffect(() => {
    (async () => {
      try { const { data } = await api.get("/social/music"); setTracks(data); } catch { /* ignore */ }
    })();
    (async () => {
      try {
        const { data } = await api.get("/social/voices");
        setVoices(data.voices || []);
        setSpeeds(data.speeds || []);
      } catch { /* ignore */ }
    })();
    loadReels();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // When switching template, trim photos to its max + reset transition for slider
  useEffect(() => {
    setPhotos((prev) => prev.slice(0, maxPhotos));
  }, [template, maxPhotos]);

  const addPhotos = (fileList) => {
    const files = Array.from(fileList || []);
    setPhotos((prev) => {
      const room = maxPhotos - prev.length;
      const next = files.slice(0, room).map((f) => ({ file: f, preview: URL.createObjectURL(f) }));
      return [...prev, ...next];
    });
  };
  const removePhoto = (i) => setPhotos((prev) => prev.filter((_, idx) => idx !== i));

  // Inject an AI-generated image (handed from the "Crear con IA" tab) into the reel.
  useEffect(() => {
    if (injectPhoto?.file) {
      setPhotos((prev) =>
        prev.length < maxPhotos ? [...prev, { file: injectPhoto.file, preview: injectPhoto.preview }] : prev
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injectPhoto]);

  const previewTrack = (id) => {
    if (playingTrack === id) { audioRef.current?.pause(); setPlayingTrack(null); return; }
    if (audioRef.current) {
      audioRef.current.src = `${BACKEND}/api/social/music/${id}`;
      audioRef.current.play().catch(() => {});
      setPlayingTrack(id);
    }
  };

  const previewVoice = async () => {
    if (previewingVoice) return;
    setPreviewingVoice(true);
    try {
      const res = await api.post(
        "/social/voice-preview",
        { voice: voice || (language === "es" ? "nova" : "onyx"), language, speed: voiceSpeed },
        { responseType: "blob", timeout: 30000 }
      );
      const url = URL.createObjectURL(res.data);
      if (audioRef.current) {
        audioRef.current.pause();
        setPlayingTrack(null);
        audioRef.current.src = url;
        audioRef.current.onended = () => URL.revokeObjectURL(url);
        await audioRef.current.play().catch(() => {});
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo generar la muestra de voz");
    } finally {
      setPreviewingVoice(false);
    }
  };

  const pollReel = (id) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/social/reels/${id}`);
        if (data.status === "ready") {
          clearInterval(pollRef.current); setReel(data); setGenerating(false); loadReels();
          toast.success("¡Tu Reel está listo! 🎬");
        } else if (data.status === "error") {
          clearInterval(pollRef.current); setGenerating(false); setResultOpen(false);
          toast.error("No se pudo generar el Reel. Intenta de nuevo.");
        }
      } catch { /* keep polling */ }
    }, 4000);
  };

  const genCopy = async () => {
    if (!brief.trim()) { toast.error("Escribe qué quieres comunicar"); return; }
    setCopyLoading(true);
    try {
      const fd = new FormData();
      fd.append("brief", brief);
      fd.append("language", language);
      fd.append("template", template);
      const { data } = await api.post("/social/copy", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setCopyDraft({
        headline: data.headline || "",
        subheadline: data.subheadline || "",
        cta: data.cta || "",
        caption: data.caption || "",
      });
      toast.success("Texto listo — revísalo y edítalo antes de crear el video ✍️");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo generar el texto");
    } finally {
      setCopyLoading(false);
    }
  };

  const setDraft = (k, v) => setCopyDraft((d) => ({ ...d, [k]: v }));

  const generate = async () => {
    if (photos.length < tpl.min) { toast.error(`Este diseño necesita ${tpl.min} foto${tpl.min > 1 ? "s" : ""}`); return; }
    if (!copyDraft) { toast.error("Primero genera y revisa el texto con IA"); return; }
    if (music === "upload" && !musicFile) { toast.error("Sube tu archivo de música o elige otra opción"); return; }
    setGenerating(true);
    setReel(null);
    setResultOpen(true);
    try {
      const { brand, accent } = resolveColors(colorTheme, customBrand, customAccent);
      const fd = new FormData();
      fd.append("brief", brief);
      fd.append("language", language);
      fd.append("music", music);
      fd.append("brand_color", brand);
      fd.append("accent_color", accent);
      fd.append("template", template);
      fd.append("cta_override", copyDraft.cta || "");
      fd.append("headline", copyDraft.headline || "");
      fd.append("subheadline", copyDraft.subheadline || "");
      fd.append("caption", copyDraft.caption || "");
      fd.append("motion", motion);
      fd.append("transition", transition);
      fd.append("subtitles", subtitles ? "true" : "false");
      fd.append("outro", outro ? "true" : "false");
      fd.append("voiceover", voiceover ? "true" : "false");
      fd.append("voice_mode", voiceMode);
      fd.append("voice_say_phone", voiceSayPhone ? "true" : "false");
      fd.append("voice", voice || "");
      fd.append("voice_speed", String(voiceSpeed));
      fd.append("duration", String(duration));
      fd.append("author", isTestimonial ? authorName : "");
      if (isServices) fd.append("service_texts", JSON.stringify(photos.map((_, i) => serviceTexts[i] || "")));
      photos.forEach((p) => fd.append("files", p.file));
      if (music === "upload" && musicFile) fd.append("music_file", musicFile);
      const { data } = await api.post("/social/reels", fd, {
        headers: { "Content-Type": "multipart/form-data" }, timeout: 120000,
      });
      setReel(data);
      pollReel(data.id);
    } catch (err) {
      setGenerating(false);
      setResultOpen(false);
      toast.error(err?.response?.data?.detail || "No se pudo iniciar el Reel");
    }
  };

  const download = async (url) => {
    try {
      const res = await fetch(`${BACKEND}${url}`);
      const blob = await res.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u; a.download = "unitech-reel.mp4";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(u);
    } catch { window.open(`${BACKEND}${url}`, "_blank"); }
  };

  const deleteReel = async (id) => {
    if (!window.confirm("¿Eliminar este Reel?")) return;
    await api.delete(`/social/reels/${id}`);
    if (reel?.id === id) { setReel(null); setResultOpen(false); }
    loadReels();
    toast.success("Reel eliminado");
  };

  return (
    <div className="space-y-6" data-testid="reel-studio">
      <audio ref={audioRef} onEnded={() => setPlayingTrack(null)} hidden />

      <Card className="p-5 space-y-5 border-0 shadow-sm">
        {/* Template */}
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">1. Plantilla del Reel</Label>
          <p className="text-[11px] text-slate-400 mt-0.5 mb-2">Desliza → y toca una.</p>
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-2.5 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide" data-testid="reel-template-carousel">
            {REEL_TEMPLATES.map((t) => (
              <button key={t.id} onClick={() => selectTemplate(t.id)} data-testid={`reel-template-${t.id}`}
                className={`flex-none w-[150px] snap-start text-left p-3 rounded-xl border tap transition-all ${template === t.id ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500" : "border-slate-200 hover:border-slate-300"}`}>
                <div className="font-semibold text-sm">{t.label}</div>
                <div className="text-[11px] text-slate-500">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Photos */}
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            2. Fotos {isBeforeAfter ? "(Antes y Después)" : `(${tpl.min} a ${tpl.max})`}
          </Label>
          <p className="text-[11px] text-slate-400 mt-0.5 mb-2">Cada foto tendrá movimiento y transición. El orden es el de subida.</p>
          {isBeforeAfter && (
            <div data-testid="reel-ba-hint" className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-2">
              💡 Usa fotos <strong>horizontales (de paisaje)</strong> del mismo lugar/ángulo. Se muestran completas, una arriba (Antes) y otra abajo (Después), para que se note bien la diferencia.
            </div>
          )}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
            {photos.map((p, i) => (
              <div key={i} className="relative aspect-[9/16] rounded-xl overflow-hidden border border-slate-200" data-testid={`reel-photo-${i}`}>
                <img src={p.preview} alt={`foto ${i + 1}`} className="w-full h-full object-cover" />
                <span className="absolute top-1 left-1 px-1.5 h-5 rounded-full bg-black/60 text-white text-[10px] font-bold flex items-center justify-center">
                  {isBeforeAfter ? (i === 0 ? "Antes" : "Después") : i + 1}
                </span>
                <button onClick={() => removePhoto(i)} data-testid={`reel-photo-remove-${i}`} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {photos.length < maxPhotos && (
              <button onClick={() => fileRef.current?.click()} data-testid="reel-add-photo"
                className="aspect-[9/16] rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-400 bg-slate-50 flex flex-col items-center justify-center text-slate-400 tap">
                <ImagePlus className="w-6 h-6 mb-1" />
                <span className="text-[11px] font-semibold">Agregar</span>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden multiple
            onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />

          {isServices && photos.length > 0 && (
            <div className="mt-3 space-y-2" data-testid="reel-service-texts">
              <p className="text-[11px] text-slate-500 font-semibold">
                Texto de cada foto <span className="font-normal text-slate-400">(la voz lo lee y la IA corrige la ortografía; cada foto dura lo que tarda en leerse)</span>
              </p>
              {photos.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <img src={p.preview} alt={`foto ${i + 1}`} className="w-9 h-12 rounded-md object-cover border border-slate-200 flex-shrink-0" />
                  <input
                    data-testid={`reel-service-text-${i}`}
                    value={serviceTexts[i] || ""}
                    onChange={(e) => setServiceText(i, e.target.value)}
                    placeholder={`Servicio de la foto ${i + 1} (ej: Instalación de techo)`}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Brief + AI copy */}
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {isTestimonial ? "3. Reseña real de tu cliente (pégala tal cual)" : "3. ¿Qué quieres comunicar? (español)"}
          </Label>
          <Textarea data-testid="reel-brief-input" value={brief} onChange={(e) => setBrief(e.target.value)}
            placeholder={isTestimonial
              ? "Pega aquí la reseña de tu cliente, tal como la escribió. La IA solo corrige la ortografía (no cambia las palabras) y la traduce literal si eliges inglés."
              : "Ej: Transformamos jardines descuidados en hermosos. Mantenimiento y paisajismo. Llama para una cotización gratis."}
            className="mt-2 rounded-xl min-h-[80px]" />
          {isTestimonial && (
            <input data-testid="reel-author-input" value={authorName}
              onChange={(e) => setAuthorName(e.target.value.slice(0, 80))}
              placeholder="Nombre del cliente (ej: María G.)"
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
          )}
          <Button onClick={genCopy} disabled={copyLoading} variant="outline" data-testid="reel-gen-copy-btn"
            className="w-full mt-2 rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-50">
            {copyLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {isTestimonial ? "Corrigiendo…" : "Escribiendo…"}</>
              : <><Sparkles className="w-4 h-4 mr-2" /> {copyDraft ? (isTestimonial ? "Volver a corregir" : "Regenerar texto con IA") : (isTestimonial ? "Corregir reseña con IA" : "Generar texto con IA")}</>}
          </Button>

          {copyDraft && (
            <div className="mt-3 space-y-3 p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100" data-testid="reel-copy-editor">
              <p className="text-[11px] font-semibold text-emerald-700">
                {isTestimonial ? "✍️ Revisa la reseña corregida (ortografía) — son las palabras de tu cliente" : "✍️ Revisa y edita el texto antes de crear el video"}
              </p>
              {!isTestimonial && (
                <>
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-500">Titular</Label>
                    <input data-testid="reel-copy-headline" value={copyDraft.headline} onChange={(e) => setDraft("headline", e.target.value.slice(0, 120))} maxLength={120}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold focus:outline-none focus:border-emerald-400" />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-500">Subtítulo</Label>
                    <input data-testid="reel-copy-subheadline" value={copyDraft.subheadline} onChange={(e) => setDraft("subheadline", e.target.value.slice(0, 200))} maxLength={200}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
                  </div>
                </>
              )}
              <div>
                <Label className="text-[11px] font-semibold text-slate-500">Botón / CTA</Label>
                <input data-testid="reel-copy-cta" value={copyDraft.cta} onChange={(e) => setDraft("cta", e.target.value.slice(0, 40))} maxLength={40}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-slate-500">
                  {isTestimonial ? "Reseña del cliente" : "Descripción"}
                  {!isTestimonial && <span className="font-normal text-slate-400"> (lo que lee la voz completa y los subtítulos)</span>}
                </Label>
                <Textarea data-testid="reel-copy-caption" value={copyDraft.caption} onChange={(e) => setDraft("caption", e.target.value.slice(0, 1500))}
                  className="mt-1 rounded-lg min-h-[70px] text-sm" />
              </div>
            </div>
          )}
        </div>

        {/* Ajustes — compactos en chips horizontales deslizables (sin popup) */}
        {/* Language + Duration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Idioma del texto</Label>
            <div className="flex gap-2 mt-2">
              {[["en", "Inglés"], ["es", "Español"]].map(([id, lbl]) => (
                <button key={id} onClick={() => setLanguage(id)} data-testid={`reel-lang-${id}`}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border tap ${language === id ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"}`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Duración</Label>
            <div className="flex gap-2 mt-2">
              {DURATIONS.map((d) => (
                <button key={d} onClick={() => setDuration(d)} data-testid={`reel-duration-${d}`}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border tap ${duration === d ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"}`}>
                  {d}s
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Motion + Transition */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Movimiento</Label>
            <div className="flex overflow-x-auto gap-2 mt-2 pb-1 scrollbar-hide">
              {MOTIONS.map((m) => (
                <button key={m.id} onClick={() => setMotion(m.id)} data-testid={`reel-motion-${m.id}`}
                  className={`flex-none px-4 py-2.5 rounded-full text-xs font-semibold border tap ${motion === m.id ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Transición {isBeforeAfter && <span className="text-slate-400 normal-case font-normal">(prueba "Deslizar")</span>}
            </Label>
            <div className="flex overflow-x-auto gap-2 mt-2 pb-1 scrollbar-hide">
              {TRANSITIONS.map((t) => (
                <button key={t.id} onClick={() => setTransition(t.id)} data-testid={`reel-transition-${t.id}`}
                  className={`flex-none px-4 py-2.5 rounded-full text-xs font-semibold border tap ${transition === t.id ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Extras toggles (pills compactos) */}
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Extras</Label>
          <div className="flex overflow-x-auto gap-2 mt-2 pb-1 scrollbar-hide">
            <button onClick={() => setSubtitles(!subtitles)} data-testid="reel-subtitles-switch"
              className={`flex-none inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-xs font-semibold border tap ${subtitles ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"}`}>
              <Captions className="w-4 h-4" /> Subtítulos {subtitles && <Check className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setOutro(!outro)} data-testid="reel-outro-switch"
              className={`flex-none inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-xs font-semibold border tap ${outro ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"}`}>
              <Clapperboard className="w-4 h-4" /> Tarjeta final {outro && <Check className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setVoiceover(!voiceover)} data-testid="reel-voiceover-switch"
              className={`flex-none inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-xs font-semibold border tap ${voiceover ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"}`}>
              <Mic className="w-4 h-4" /> Voz en off IA {voiceover && <Check className="w-3.5 h-3.5" />}
            </button>
          </div>
          {voiceover && (
            <div className="mt-2 p-3 rounded-xl bg-emerald-50/60 border border-emerald-100" data-testid="reel-voice-mode">
              <span className="text-xs font-semibold text-slate-600">¿Qué debe leer la voz?</span>
              <div className="flex gap-2 mt-2">
                <button onClick={() => setVoiceMode("short")} data-testid="reel-voice-short"
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border tap ${voiceMode === "short" ? "border-emerald-500 bg-white text-emerald-700" : "border-slate-200 text-slate-600"}`}>
                  Voz corta <span className="text-slate-400 font-normal">(titular + CTA)</span>
                </button>
                <button onClick={() => setVoiceMode("full")} data-testid="reel-voice-full"
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border tap ${voiceMode === "full" ? "border-emerald-500 bg-white text-emerald-700" : "border-slate-200 text-slate-600"}`}>
                  Voz completa <span className="text-slate-400 font-normal">(lee todo el post)</span>
                </button>
              </div>
              {voiceMode === "full" && (
                <p className="text-[11px] text-emerald-700/80 mt-2">El video se alargará automáticamente para que la voz nunca se corte (máx. 60s).</p>
              )}
              <div className="mt-3 pt-3 border-t border-emerald-100">
                <span className="text-xs font-semibold text-slate-600">Voz</span>
                <div className="flex gap-2 mt-2">
                  <select
                    data-testid="reel-voice-select"
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    className="flex-1 h-10 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
                  >
                    <option value="">Recomendada (voz en español)</option>
                    {voices.map((v) => (
                      <option key={v.id} value={v.id}>{v.label} — {v.desc}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={previewVoice}
                    disabled={previewingVoice}
                    data-testid="reel-voice-preview-btn"
                    className="px-3 h-10 rounded-lg border border-emerald-300 bg-white text-emerald-700 text-xs font-bold inline-flex items-center gap-1 tap disabled:opacity-60"
                  >
                    {previewingVoice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Escuchar
                  </button>
                </div>
                <span className="text-xs font-semibold text-slate-600 block mt-3">Velocidad</span>
                <div className="flex gap-1.5 mt-2">
                  {speeds.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setVoiceSpeed(s.value)}
                      data-testid={`reel-voice-speed-${s.id}`}
                      className={`flex-1 py-2 rounded-lg text-[11px] font-semibold border tap ${Math.abs(voiceSpeed - s.value) < 0.01 ? "border-emerald-500 bg-white text-emerald-700" : "border-slate-200 text-slate-600"}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-2">💡 Cada voz tiene su propio tono. Usa "Escuchar" para probar la voz y velocidad antes de generar.</p>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-emerald-100">
                <span className="text-xs font-semibold text-slate-600">Decir mi teléfono en la voz</span>
                <Switch checked={voiceSayPhone} onCheckedChange={setVoiceSayPhone} data-testid="reel-voice-phone-switch" />
              </div>
            </div>
          )}
        </div>

        {/* Music (chips horizontales) */}
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Música</Label>
          <p className="text-[11px] text-slate-400 mt-0.5 mb-2">Desliza → toca para elegir, ▶ para escuchar.</p>
          <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide items-center">
            <button onClick={() => setMusic("none")} data-testid="reel-music-none"
              className={`flex-none inline-flex items-center px-3.5 py-2.5 rounded-full text-xs font-semibold border tap ${music === "none" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"}`}>
              Sin música
            </button>
            {tracks.map((t) => (
              <div key={t.id} data-testid={`reel-music-${t.id}`}
                className={`flex-none inline-flex items-center gap-1 pl-3.5 pr-1.5 py-1.5 rounded-full text-xs font-semibold border ${music === t.id ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"}`}>
                <button onClick={() => setMusic(t.id)} className="inline-flex items-center gap-1.5 tap whitespace-nowrap">
                  <Music className="w-3.5 h-3.5" /> {t.label}
                </button>
                <button onClick={() => previewTrack(t.id)} data-testid={`reel-music-preview-${t.id}`}
                  className="w-7 h-7 rounded-full bg-white/70 flex items-center justify-center tap shrink-0">
                  {playingTrack === t.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
            <button onClick={() => { setMusic("upload"); musicRef.current?.click(); }} data-testid="reel-music-upload"
              className={`flex-none inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-xs font-semibold border tap whitespace-nowrap ${music === "upload" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"}`}>
              <Upload className="w-3.5 h-3.5" /> {musicFile ? "Mi música ✓" : "Subir música"}
            </button>
            <input ref={musicRef} type="file" accept="audio/*" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setMusicFile(f); setMusic("upload"); } e.target.value = ""; }} />
          </div>
        </div>

        {/* Colors (swatches horizontales) */}
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Color del diseño</Label>
          <div className="flex overflow-x-auto gap-3 pb-1 mt-2 items-center scrollbar-hide">
            {COLOR_THEMES.map((c) => (
              <button key={c.id} onClick={() => setColorTheme(c.id)} data-testid={`reel-color-${c.id}`} title={c.label}
                className={`flex-none w-11 h-11 rounded-full border-2 tap transition-transform hover:scale-105 ${colorTheme === c.id ? "ring-2 ring-emerald-600 ring-offset-2 border-white" : "border-slate-200"}`}
                style={{ background: c.swatch }} />
            ))}
            <button onClick={() => setColorTheme("custom")} data-testid="reel-color-custom" title="Personalizado"
              className={`flex-none w-11 h-11 rounded-full border-2 flex items-center justify-center tap ${colorTheme === "custom" ? "ring-2 ring-emerald-600 ring-offset-2 border-white" : "border-dashed border-slate-300 bg-slate-50 text-slate-500"}`}
              style={colorTheme === "custom" ? { background: customAccent } : {}}>
              {colorTheme === "custom" ? null : <Palette className="w-4 h-4" />}
            </button>
          </div>
          {colorTheme === "custom" && (
            <div className="flex gap-4 mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                Barra / botón
                <input type="color" value={customAccent} onChange={(e) => setCustomAccent(e.target.value)} className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer" />
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                Fondo
                <input type="color" value={customBrand} onChange={(e) => setCustomBrand(e.target.value)} className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer" />
              </label>
            </div>
          )}
        </div>

        <Button onClick={generate} disabled={generating || !copyDraft} data-testid="reel-generate-btn"
          className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-base">
          {generating ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Creando tu Reel… (~30-60s)</> : <><Video className="w-5 h-5 mr-2" /> Generar Reel</>}
        </Button>
        {!copyDraft && <p className="text-[11px] text-center text-slate-400 -mt-2">Primero genera el texto con IA (arriba) para poder crear el video.</p>}
      </Card>

      {/* Current reel — slide-up Drawer */}
      <Drawer open={resultOpen} onOpenChange={setResultOpen}>
        <DrawerContent data-testid="reel-result-drawer" className="max-h-[92vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-heading flex items-center gap-2">
              <Video className="w-5 h-5 text-emerald-600" /> Tu Reel
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8 overflow-y-auto max-w-md mx-auto w-full" data-testid="reel-result">
            {reel && reel.status === "ready" && reel.video ? (
              <div className="space-y-3">
                <video src={`${BACKEND}${reel.video.url}`} controls playsInline data-testid="reel-video"
                  className="w-full max-w-[320px] mx-auto rounded-2xl border border-slate-200 bg-black" />
                <Button onClick={() => download(reel.video.url)} data-testid="reel-download-btn"
                  className="w-full max-w-[320px] mx-auto flex rounded-xl bg-emerald-600 hover:bg-emerald-700">
                  <Download className="w-4 h-4 mr-2" /> Descargar Reel
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
                <p className="text-sm font-semibold text-slate-600">Generando tu video…</p>
                <p className="text-xs text-slate-400 mt-1">Puede tardar de 30 a 60 segundos. No cierres esta página.</p>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* History */}
      {reels.length > 0 && (
        <Card className="p-5 border-0 shadow-sm" data-testid="reel-history">
          <h2 className="font-heading text-lg font-bold mb-3">Mis Reels</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {reels.map((r) => (
              <div key={r.id} className="relative group">
                <div onClick={() => { if (r.status === "ready") { setReel(r); setResultOpen(true); } }}
                  data-testid={`reel-history-${r.id}`}
                  className="aspect-[9/16] rounded-xl border border-slate-200 bg-slate-900 overflow-hidden cursor-pointer tap flex items-center justify-center">
                  {r.status === "ready" && r.video ? (
                    <video src={`${BACKEND}${r.video.url}#t=2`} preload="metadata" className="w-full h-full object-cover" />
                  ) : r.status === "error" ? (
                    <span className="text-[10px] text-red-300 font-semibold px-1 text-center">Error</span>
                  ) : (
                    <Loader2 className="w-5 h-5 animate-spin text-white/70" />
                  )}
                  {r.status === "ready" && (
                    <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="w-9 h-9 rounded-full bg-black/50 flex items-center justify-center"><Play className="w-4 h-4 text-white" /></span>
                    </span>
                  )}
                </div>
                <button onClick={() => deleteReel(r.id)} data-testid={`reel-history-delete-${r.id}`}
                  className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
