import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Loader2, Download, Trash2, ImagePlus, X, Video,
  Music, Play, Pause, Upload,
} from "lucide-react";
import { COLOR_THEMES, resolveColors } from "@/lib/socialThemes";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const MAX_PHOTOS = 5;

export default function ReelStudio() {
  const [photos, setPhotos] = useState([]); // [{file, preview}]
  const [brief, setBrief] = useState("");
  const [language, setLanguage] = useState("en");
  const [colorTheme, setColorTheme] = useState("card");
  const [customAccent, setCustomAccent] = useState("#10b981");
  const [customBrand, setCustomBrand] = useState("#0f5f46");
  const [tracks, setTracks] = useState([]);
  const [music, setMusic] = useState("none"); // "none" | track id | "upload"
  const [musicFile, setMusicFile] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [reel, setReel] = useState(null); // current ready/processing reel
  const [reels, setReels] = useState([]);
  const [playingTrack, setPlayingTrack] = useState(null);

  const fileRef = useRef(null);
  const musicRef = useRef(null);
  const audioRef = useRef(null);
  const pollRef = useRef(null);

  const loadReels = async () => {
    try { const { data } = await api.get("/social/reels"); setReels(data); } catch { /* ignore */ }
  };
  useEffect(() => {
    (async () => {
      try { const { data } = await api.get("/social/music"); setTracks(data); } catch { /* ignore */ }
    })();
    loadReels();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const addPhotos = (fileList) => {
    const files = Array.from(fileList || []);
    setPhotos((prev) => {
      const room = MAX_PHOTOS - prev.length;
      const next = files.slice(0, room).map((f) => ({ file: f, preview: URL.createObjectURL(f) }));
      return [...prev, ...next];
    });
  };
  const removePhoto = (i) => setPhotos((prev) => prev.filter((_, idx) => idx !== i));

  const previewTrack = (id) => {
    if (playingTrack === id) {
      audioRef.current?.pause();
      setPlayingTrack(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.src = `${BACKEND}/api/social/music/${id}`;
      audioRef.current.play().catch(() => {});
      setPlayingTrack(id);
    }
  };

  const pollReel = (id) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/social/reels/${id}`);
        if (data.status === "ready") {
          clearInterval(pollRef.current);
          setReel(data);
          setGenerating(false);
          loadReels();
          toast.success("¡Tu Reel está listo! 🎬");
        } else if (data.status === "error") {
          clearInterval(pollRef.current);
          setGenerating(false);
          toast.error("No se pudo generar el Reel. Intenta de nuevo.");
        }
      } catch { /* keep polling */ }
    }, 4000);
  };

  const generate = async () => {
    if (photos.length < 1) { toast.error("Sube al menos 1 foto"); return; }
    if (!brief.trim()) { toast.error("Escribe qué quieres comunicar"); return; }
    if (music === "upload" && !musicFile) { toast.error("Sube tu archivo de música o elige otra opción"); return; }
    setGenerating(true);
    setReel(null);
    try {
      const { brand, accent } = resolveColors(colorTheme, customBrand, customAccent);
      const fd = new FormData();
      fd.append("brief", brief);
      fd.append("language", language);
      fd.append("music", music);
      fd.append("brand_color", brand);
      fd.append("accent_color", accent);
      photos.forEach((p) => fd.append("files", p.file));
      if (music === "upload" && musicFile) fd.append("music_file", musicFile);
      const { data } = await api.post("/social/reels", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      });
      setReel(data);
      pollReel(data.id);
    } catch (err) {
      setGenerating(false);
      toast.error(err?.response?.data?.detail || "No se pudo iniciar el Reel");
    }
  };

  const download = async (url) => {
    try {
      const res = await fetch(`${BACKEND}${url}`);
      const blob = await res.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u; a.download = "unitap-reel.mp4";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(u);
    } catch { window.open(`${BACKEND}${url}`, "_blank"); }
  };

  const deleteReel = async (id) => {
    if (!window.confirm("¿Eliminar este Reel?")) return;
    await api.delete(`/social/reels/${id}`);
    if (reel?.id === id) setReel(null);
    loadReels();
    toast.success("Reel eliminado");
  };

  const colors = COLOR_THEMES;

  return (
    <div className="space-y-6" data-testid="reel-studio">
      <audio ref={audioRef} onEnded={() => setPlayingTrack(null)} hidden />

      <Card className="p-5 space-y-5 border-0 shadow-sm">
        {/* Photos */}
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">1. Fotos (1 a 5)</Label>
          <p className="text-[11px] text-slate-400 mt-0.5 mb-2">Cada foto tendrá zoom suave y transición. El orden es el de subida.</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
            {photos.map((p, i) => (
              <div key={i} className="relative aspect-[9/16] rounded-xl overflow-hidden border border-slate-200" data-testid={`reel-photo-${i}`}>
                <img src={p.preview} alt={`foto ${i + 1}`} className="w-full h-full object-cover" />
                <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                <button onClick={() => removePhoto(i)} data-testid={`reel-photo-remove-${i}`} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                onClick={() => fileRef.current?.click()}
                data-testid="reel-add-photo"
                className="aspect-[9/16] rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-400 bg-slate-50 flex flex-col items-center justify-center text-slate-400 tap"
              >
                <ImagePlus className="w-6 h-6 mb-1" />
                <span className="text-[11px] font-semibold">Agregar</span>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden multiple
            onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
        </div>

        {/* Brief */}
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">2. ¿Qué quieres comunicar? (español)</Label>
          <Textarea
            data-testid="reel-brief-input"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Ej: Transformamos jardines descuidados en hermosos. Mantenimiento y paisajismo. Llama para una cotización gratis."
            className="mt-2 rounded-xl min-h-[80px]"
          />
        </div>

        {/* Language */}
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">3. Idioma del texto</Label>
          <div className="flex gap-2 mt-2 max-w-xs">
            {[["en", "Inglés"], ["es", "Español"]].map(([id, lbl]) => (
              <button key={id} onClick={() => setLanguage(id)} data-testid={`reel-lang-${id}`}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border tap ${language === id ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"}`}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Music */}
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">4. Música</Label>
          <p className="text-[11px] text-slate-400 mt-0.5 mb-2">Usa una pista libre de derechos, sube la tuya, o sin música.</p>
          <div className="space-y-2">
            <button onClick={() => setMusic("none")} data-testid="reel-music-none"
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm font-semibold tap ${music === "none" ? "border-emerald-500 bg-emerald-50" : "border-slate-200"}`}>
              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${music === "none" ? "border-emerald-500" : "border-slate-300"}`}>{music === "none" && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}</span>
              Sin música <span className="text-slate-400 font-normal">(le pones música en Instagram)</span>
            </button>

            {tracks.map((t) => (
              <div key={t.id} data-testid={`reel-music-${t.id}`}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm font-semibold ${music === t.id ? "border-emerald-500 bg-emerald-50" : "border-slate-200"}`}>
                <button onClick={() => setMusic(t.id)} className="flex items-center gap-3 flex-1 text-left tap">
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${music === t.id ? "border-emerald-500" : "border-slate-300"}`}>{music === t.id && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}</span>
                  <Music className="w-4 h-4 text-emerald-600" />
                  <span>{t.label} <span className="text-slate-400 font-normal">· {t.desc}</span></span>
                </button>
                <button onClick={() => previewTrack(t.id)} data-testid={`reel-music-preview-${t.id}`}
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 tap flex-shrink-0">
                  {playingTrack === t.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
              </div>
            ))}

            <button onClick={() => { setMusic("upload"); musicRef.current?.click(); }} data-testid="reel-music-upload"
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm font-semibold tap ${music === "upload" ? "border-emerald-500 bg-emerald-50" : "border-slate-200"}`}>
              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${music === "upload" ? "border-emerald-500" : "border-slate-300"}`}>{music === "upload" && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}</span>
              <Upload className="w-4 h-4 text-emerald-600" />
              {musicFile ? <span className="truncate">{musicFile.name}</span> : "Subir mi música (MP3, M4A, WAV)"}
            </button>
            <input ref={musicRef} type="file" accept="audio/*" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setMusicFile(f); setMusic("upload"); } e.target.value = ""; }} />
          </div>
        </div>

        {/* Colors */}
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">5. Color del diseño</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {colors.map((c) => (
              <button key={c.id} onClick={() => setColorTheme(c.id)} data-testid={`reel-color-${c.id}`} title={c.label}
                className={`flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full border text-xs font-semibold tap transition-all ${colorTheme === c.id ? "border-slate-800 ring-1 ring-slate-800" : "border-slate-200 hover:border-slate-300"}`}>
                <span className="w-5 h-5 rounded-full border border-black/10 flex-shrink-0" style={{ background: c.swatch }} />
                {c.label}
              </button>
            ))}
            <button onClick={() => setColorTheme("custom")} data-testid="reel-color-custom"
              className={`flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full border text-xs font-semibold tap transition-all ${colorTheme === "custom" ? "border-slate-800 ring-1 ring-slate-800" : "border-slate-200 hover:border-slate-300"}`}>
              <span className="w-5 h-5 rounded-full border border-black/10 flex-shrink-0" style={{ background: customAccent }} />
              Personalizado
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

        <Button onClick={generate} disabled={generating} data-testid="reel-generate-btn"
          className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-base">
          {generating ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Creando tu Reel… (~30s)</> : <><Video className="w-5 h-5 mr-2" /> Generar Reel</>}
        </Button>
      </Card>

      {/* Current reel */}
      {reel && (
        <Card className="p-5 space-y-3 border-0 shadow-sm" data-testid="reel-result">
          <h2 className="font-heading text-lg font-bold">Tu Reel</h2>
          {reel.status === "ready" && reel.video ? (
            <div className="space-y-3">
              <video src={`${BACKEND}${reel.video.url}`} controls playsInline data-testid="reel-video"
                className="w-full max-w-[320px] mx-auto rounded-2xl border border-slate-200 bg-black" />
              <Button onClick={() => download(reel.video.url)} data-testid="reel-download-btn"
                className="w-full max-w-[320px] mx-auto flex rounded-xl bg-emerald-600 hover:bg-emerald-700">
                <Download className="w-4 h-4 mr-2" /> Descargar Reel
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
              <p className="text-sm font-semibold text-slate-600">Generando tu video…</p>
              <p className="text-xs text-slate-400 mt-1">Tarda unos 30 segundos. No cierres esta página.</p>
            </div>
          )}
        </Card>
      )}

      {/* History */}
      {reels.length > 0 && (
        <Card className="p-5 border-0 shadow-sm" data-testid="reel-history">
          <h2 className="font-heading text-lg font-bold mb-3">Mis Reels</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {reels.map((r) => (
              <div key={r.id} className="relative group">
                <div onClick={() => { if (r.status === "ready") { setReel(r); window.scrollTo({ top: 0, behavior: "smooth" }); } }}
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
