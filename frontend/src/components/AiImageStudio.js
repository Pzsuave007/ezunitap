import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Sparkles, Loader2, Trash2, Download, ImagePlus, Video, Lightbulb, Wand2, IdCard, Check,
} from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const ASPECTS = [
  { id: "9x16", label: "Vertical 9:16", hint: "Reels / Stories" },
  { id: "1x1", label: "Cuadrado 1:1", hint: "Feed" },
  { id: "4x5", label: "Vertical 4:5", hint: "Feed Instagram" },
];
const STYLES = [
  { id: "realistic", label: "Foto realista" },
  { id: "graphic", label: "Gráfico / Ilustración" },
];

const authedUrl = (photoId) =>
  `${BACKEND}/api/photos/${photoId}/file?auth=${localStorage.getItem("sf_token")}`;

export default function AiImageStudio({ onUseInPost, onUseInReel, onUseIdea, onToggleCard, cardIds = [], cardBusy = null }) {
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState("1x1");
  const [style, setStyle] = useState("realistic");
  const [loading, setLoading] = useState(false);
  const [gallery, setGallery] = useState([]);
  const [usage, setUsage] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [resultOpen, setResultOpen] = useState(false);

  // Post ideas
  const [ideasTopic, setIdeasTopic] = useState("");
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideas, setIdeas] = useState([]);

  const loadGallery = async () => {
    try {
      const [g, u] = await Promise.all([api.get("/social/ai-images"), api.get("/social/ai-usage")]);
      setGallery(g.data || []);
      setUsage(u.data);
    } catch { /* ignore */ }
  };
  useEffect(() => { loadGallery(); }, []);

  const generate = async () => {
    if (prompt.trim().length < 4) { toast.error("Describe la imagen que quieres crear"); return; }
    setLoading(true);
    setSelected(null);
    setResultOpen(true);
    try {
      const { data } = await api.post("/social/ai-image", { prompt, aspect, style }, { timeout: 120000 });
      setGallery((prev) => [data, ...prev]);
      setSelected(data);
      setUsage({ used: data.used, limit: data.limit, unlimited: data.unlimited, remaining: data.remaining });
      toast.success("¡Imagen creada con IA! ✨");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo generar la imagen");
      setResultOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const removeImage = async (id) => {
    if (!window.confirm("¿Eliminar esta imagen?")) return;
    try {
      await api.delete(`/social/ai-images/${id}`);
      setGallery((prev) => prev.filter((g) => g.id !== id));
      if (selected?.id === id) { setSelected(null); setResultOpen(false); }
      toast.success("Imagen eliminada");
    } catch {
      toast.error("No se pudo eliminar");
    }
  };

  const fetchAsFile = async (photoId) => {
    const res = await fetch(authedUrl(photoId));
    const blob = await res.blob();
    return new File([blob], `ai-${photoId}.jpg`, { type: blob.type || "image/jpeg" });
  };

  const applyTo = async (img, target) => {
    setBusyId(`${img.photo_id}|${target}`);
    try {
      const file = await fetchAsFile(img.photo_id);
      const preview = authedUrl(img.photo_id);
      if (target === "post") onUseInPost?.(file, preview);
      else onUseInReel?.(file, preview);
      toast.success(target === "post" ? "Imagen lista en el Post ✨" : "Imagen agregada al Reel ✨");
    } catch {
      toast.error("No se pudo usar la imagen");
    } finally {
      setBusyId(null);
    }
  };

  const download = async (img) => {
    try {
      const res = await fetch(authedUrl(img.photo_id));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `unitech-ai-${img.aspect}.jpg`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(authedUrl(img.photo_id), "_blank");
    }
  };

  const genIdeas = async () => {
    setIdeasLoading(true);
    try {
      const { data } = await api.post("/social/post-ideas", { topic: ideasTopic, count: 8, language: "es" });
      setIdeas(data.ideas || []);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudieron generar ideas");
    } finally {
      setIdeasLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="ai-image-studio">
      {/* Generator */}
      <Card className="p-5 space-y-5 border-0 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-heading text-lg font-bold flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-violet-600" /> Crear imagen con IA
            </h2>
            <p className="text-[12px] text-slate-500 mt-0.5">
              ¿No tienes foto? Describe tu idea y la IA crea una imagen realista para tu post o reel.
            </p>
          </div>
          {usage && (
            <span
              data-testid="ai-usage-badge"
              className="text-xs font-bold px-3 py-1.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200"
            >
              {usage.unlimited ? "Ilimitado ∞" : `${usage.used}/${usage.limit} este mes`}
            </span>
          )}
        </div>

        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Describe tu idea (español)</Label>
          <Textarea
            data-testid="ai-image-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ej: Un techador profesional instalando shingles en un techo, día soleado, casa moderna en un suburbio."
            className="mt-2 rounded-xl min-h-[80px]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Estilo</Label>
            <div className="flex gap-2 mt-2">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  data-testid={`ai-style-${s.id}`}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border tap ${
                    style === s.id ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-600"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Formato</Label>
            <div className="flex gap-2 mt-2">
              {ASPECTS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAspect(a.id)}
                  data-testid={`ai-aspect-${a.id}`}
                  title={a.hint}
                  className={`flex-1 py-2.5 rounded-xl text-[11px] font-semibold border tap ${
                    aspect === a.id ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-600"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Button
          onClick={generate}
          disabled={loading}
          data-testid="ai-generate-image-btn"
          className="w-full h-12 rounded-xl bg-violet-600 hover:bg-violet-700 text-base"
        >
          {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Creando imagen…</> : <><Sparkles className="w-5 h-5 mr-2" /> Crear imagen</>}
        </Button>
      </Card>

      {/* Gallery */}
      {gallery.length > 0 && (
        <Card className="p-5 border-0 shadow-sm" data-testid="ai-gallery">
          <h3 className="font-heading text-base font-bold mb-3">Mis imágenes IA</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {gallery.map((img) => (
              <div key={img.id} className="space-y-1.5" data-testid={`ai-image-${img.id}`}>
                <div className="relative">
                  <img
                    src={authedUrl(img.photo_id)}
                    alt={img.prompt}
                    onClick={() => { setSelected(img); setResultOpen(true); }}
                    data-testid={`ai-image-open-${img.id}`}
                    className="w-full aspect-square object-cover rounded-xl border border-slate-200 cursor-pointer tap"
                  />
                  <button
                    onClick={() => removeImage(img.id)}
                    data-testid={`ai-image-delete-${img.id}`}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-black/60 text-white">
                    {img.aspect}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => applyTo(img, "post")} disabled={busyId === `${img.photo_id}|post`}
                    data-testid={`ai-use-post-${img.id}`} className="rounded-lg h-8 text-[11px] border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                    {busyId === `${img.photo_id}|post` ? <Loader2 className="w-3 h-3 animate-spin" /> : <><ImagePlus className="w-3 h-3 mr-1" /> Post</>}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => applyTo(img, "reel")} disabled={busyId === `${img.photo_id}|reel`}
                    data-testid={`ai-use-reel-${img.id}`} className="rounded-lg h-8 text-[11px] border-blue-300 text-blue-700 hover:bg-blue-50">
                    {busyId === `${img.photo_id}|reel` ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Video className="w-3 h-3 mr-1" /> Reel</>}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => download(img)} data-testid={`ai-download-${img.id}`} className="rounded-lg h-8 text-[11px] text-slate-600">
                    <Download className="w-3 h-3 mr-1" /> Bajar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onToggleCard?.(img.photo_id)} disabled={cardBusy === img.photo_id}
                    data-testid={`ai-oncard-${img.id}`} className={`rounded-lg h-8 text-[11px] ${cardIds.includes(img.photo_id) ? "text-emerald-700" : "text-slate-600"}`}>
                    {cardBusy === img.photo_id ? <Loader2 className="w-3 h-3 animate-spin" /> : (cardIds.includes(img.photo_id) ? <><Check className="w-3 h-3 mr-1" /> Tarjeta</> : <><IdCard className="w-3 h-3 mr-1" /> Tarjeta</>)}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Post ideas */}
      <Card className="p-5 space-y-4 border-0 shadow-sm" data-testid="ai-ideas">
        <div>
          <h2 className="font-heading text-lg font-bold flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" /> Ideas de posts
          </h2>
          <p className="text-[12px] text-slate-500 mt-0.5">¿No sabes qué postear? La IA te da ideas listas para tu negocio.</p>
        </div>
        <div className="flex gap-2">
          <Input
            data-testid="ai-ideas-topic"
            value={ideasTopic}
            onChange={(e) => setIdeasTopic(e.target.value)}
            placeholder="Tema (opcional): ej. invierno, ofertas, antes y después…"
            className="rounded-xl"
          />
          <Button onClick={genIdeas} disabled={ideasLoading} data-testid="ai-ideas-btn" className="rounded-xl bg-amber-500 hover:bg-amber-600 shrink-0">
            {ideasLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-1" /> Dame ideas</>}
          </Button>
        </div>
        {ideas.length > 0 && (
          <div className="space-y-2">
            {ideas.map((it, i) => (
              <div key={i} data-testid={`ai-idea-${i}`} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-slate-800">{it.title}</div>
                  <div className="text-[12px] text-slate-500">{it.idea}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => onUseIdea?.(it.idea || it.title)} data-testid={`ai-idea-use-${i}`}
                  className="rounded-lg h-8 text-[11px] border-emerald-300 text-emerald-700 hover:bg-emerald-50 shrink-0">
                  Usar
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Result — slide-up Drawer */}
      <Drawer open={resultOpen} onOpenChange={setResultOpen}>
        <DrawerContent data-testid="ai-result-drawer" className="max-h-[92vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-heading flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-violet-600" /> {loading ? "Creando imagen…" : "Tu imagen IA"}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8 overflow-y-auto max-w-md mx-auto w-full">
            {(loading || !selected) ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Loader2 className="w-9 h-9 animate-spin text-violet-600 mb-3" />
                <p className="text-sm font-semibold text-slate-600">Creando tu imagen con IA…</p>
                <p className="text-xs text-slate-400 mt-1">Esto puede tardar unos segundos.</p>
              </div>
            ) : (
              <div className="space-y-4" data-testid="ai-result">
                <img src={authedUrl(selected.photo_id)} alt={selected.prompt}
                  className="w-full rounded-2xl border border-slate-200" />
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => applyTo(selected, "post")} disabled={busyId === `${selected.photo_id}|post`}
                    data-testid="ai-result-use-post" className="rounded-xl h-11 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                    {busyId === `${selected.photo_id}|post` ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ImagePlus className="w-4 h-4 mr-1.5" /> Usar en Post</>}
                  </Button>
                  <Button variant="outline" onClick={() => applyTo(selected, "reel")} disabled={busyId === `${selected.photo_id}|reel`}
                    data-testid="ai-result-use-reel" className="rounded-xl h-11 border-blue-300 text-blue-700 hover:bg-blue-50">
                    {busyId === `${selected.photo_id}|reel` ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Video className="w-4 h-4 mr-1.5" /> Usar en Reel</>}
                  </Button>
                  <Button variant="outline" onClick={() => download(selected)}
                    data-testid="ai-result-download" className="rounded-xl h-11 text-slate-700">
                    <Download className="w-4 h-4 mr-1.5" /> Descargar
                  </Button>
                  <Button variant="outline" onClick={() => onToggleCard?.(selected.photo_id)} disabled={cardBusy === selected.photo_id}
                    data-testid="ai-result-oncard" className={`rounded-xl h-11 ${cardIds.includes(selected.photo_id) ? "border-emerald-400 text-emerald-700 bg-emerald-50" : "text-slate-700"}`}>
                    {cardBusy === selected.photo_id ? <Loader2 className="w-4 h-4 animate-spin" /> : (cardIds.includes(selected.photo_id) ? <><Check className="w-4 h-4 mr-1.5" /> En tarjeta</> : <><IdCard className="w-4 h-4 mr-1.5" /> A mi tarjeta</>)}
                  </Button>
                </div>
                <Button variant="ghost" onClick={() => removeImage(selected.id)}
                  data-testid="ai-result-delete" className="w-full rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700">
                  <Trash2 className="w-4 h-4 mr-1.5" /> Eliminar imagen
                </Button>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
