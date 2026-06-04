import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Megaphone, Sparkles, Loader2, Download, Copy, Trash2,
  ImagePlus, Wand2, X, Check,
} from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const TEMPLATES = [
  { id: "showcase", label: "Minimalista", photos: 1 },
  { id: "bold_bar", label: "Barra Bold", photos: 1 },
  { id: "center_stage", label: "Centro Impacto", photos: 1 },
  { id: "boxed", label: "Tarjeta", photos: 1 },
  { id: "magazine", label: "Editorial", photos: 1 },
  { id: "elegant_dark", label: "Elegante", photos: 1 },
  { id: "top_banner", label: "Banner Arriba", photos: 1 },
  { id: "side_panel", label: "Panel Lateral", photos: 1 },
  { id: "before_after", label: "Antes / Después", photos: 2 },
  { id: "promo", label: "Oferta / Promo", photos: 1 },
].map((t) => ({ ...t, preview: `/social-previews/${t.id}.jpg` }));

const FORMATS = [
  { id: "9x16", label: "Vertical 9:16", hint: "Reels / TikTok / Stories" },
  { id: "1x1", label: "Cuadrado 1:1", hint: "Feed Instagram / Facebook" },
];

// Color themes for the design (panel/band = brand, bar/button = accent).
// id "card" = use the colors from the user's Smart Card (no override).
const COLOR_THEMES = [
  { id: "card", label: "Mi tarjeta", brand: null, accent: null, swatch: "#94a3b8" },
  { id: "green", label: "Verde", brand: "#0f5f46", accent: "#10b981", swatch: "#10b981" },
  { id: "blue", label: "Azul", brand: "#1e3a8a", accent: "#3b82f6", swatch: "#3b82f6" },
  { id: "navy", label: "Marino", brand: "#0f172a", accent: "#38bdf8", swatch: "#0f172a" },
  { id: "black", label: "Negro", brand: "#171717", accent: "#f59e0b", swatch: "#171717" },
  { id: "red", label: "Rojo", brand: "#7f1d1d", accent: "#ef4444", swatch: "#ef4444" },
  { id: "orange", label: "Naranja", brand: "#7c2d12", accent: "#f97316", swatch: "#f97316" },
  { id: "purple", label: "Morado", brand: "#4c1d95", accent: "#a855f7", swatch: "#a855f7" },
  { id: "teal", label: "Turquesa", brand: "#134e4a", accent: "#14b8a6", swatch: "#14b8a6" },
  { id: "gold", label: "Dorado", brand: "#3f3f46", accent: "#eab308", swatch: "#eab308" },
];

function PhotoSlot({ index, label, photo, onPick, onClear, onEnhance, enhancing }) {
  const ref = useRef(null);
  return (
    <div className="flex-1 min-w-0">
      <Label className="text-xs text-slate-500">{label}</Label>
      <div
        onClick={() => !photo && ref.current?.click()}
        data-testid={`photo-slot-${index}`}
        className={`mt-1.5 relative aspect-square rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden cursor-pointer tap ${
          photo ? "border-transparent" : "border-slate-300 hover:border-emerald-400 bg-slate-50"
        }`}
      >
        {photo ? (
          <>
            <img src={photo.preview} alt={label} className="w-full h-full object-cover" />
            <button
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              data-testid={`photo-clear-${index}`}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
            {photo.enhanced && (
              <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-600 text-white flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> IA
              </span>
            )}
          </>
        ) : (
          <div className="text-center text-slate-400">
            <ImagePlus className="w-7 h-7 mx-auto mb-1" />
            <span className="text-xs font-semibold">Subir foto</span>
          </div>
        )}
      </div>
      {photo && !photo.enhanced && (
        <Button
          onClick={() => onEnhance(index)}
          disabled={enhancing}
          data-testid={`enhance-photo-${index}`}
          size="sm"
          variant="outline"
          className="w-full mt-2 rounded-lg border-violet-300 text-violet-700 hover:bg-violet-50 h-9"
        >
          {enhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
          {enhancing ? "Mejorando..." : "Mejorar con IA"}
        </Button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick({ file: f, preview: URL.createObjectURL(f) });
          e.target.value = "";
        }}
      />
    </div>
  );
}

export default function SocialStudio() {
  const [template, setTemplate] = useState("before_after");
  const [photos, setPhotos] = useState([null, null]);
  const [brief, setBrief] = useState("");
  const [language, setLanguage] = useState("en");
  const [formats, setFormats] = useState(["9x16", "1x1"]);
  const [colorTheme, setColorTheme] = useState("card");
  const [customAccent, setCustomAccent] = useState("#10b981");
  const [customBrand, setCustomBrand] = useState("#0f5f46");
  const [loading, setLoading] = useState(false);
  const [post, setPost] = useState(null);
  const [history, setHistory] = useState([]);
  const [rerendering, setRerendering] = useState(false);
  const [enhanceIdx, setEnhanceIdx] = useState(null); // slot being enhanced (loading)
  const [enhancePreview, setEnhancePreview] = useState(null); // { index, originalPreview, enhancedUrl }
  const [applyingEnhance, setApplyingEnhance] = useState(false);

  const tpl = TEMPLATES.find((t) => t.id === template);
  const needed = tpl.photos;

  const loadHistory = async () => {
    try {
      const { data } = await api.get("/social/posts");
      setHistory(data);
    } catch { /* ignore */ }
  };
  useEffect(() => { loadHistory(); }, []);

  const toggleFormat = (id) => {
    setFormats((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  };

  const setPhotoAt = (i, p) => setPhotos((prev) => { const n = [...prev]; n[i] = p; return n; });

  const enhancePhoto = async (i) => {
    const photo = photos[i];
    if (!photo?.file) return;
    setEnhanceIdx(i);
    try {
      const fd = new FormData();
      fd.append("file", photo.file);
      const { data } = await api.post("/social/enhance", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      });
      setEnhancePreview({ index: i, originalPreview: photo.preview, enhancedUrl: `${BACKEND}${data.enhanced.url}` });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo mejorar la foto");
    } finally {
      setEnhanceIdx(null);
    }
  };

  const applyEnhanced = async () => {
    if (!enhancePreview) return;
    setApplyingEnhance(true);
    try {
      const res = await fetch(enhancePreview.enhancedUrl);
      const blob = await res.blob();
      const file = new File([blob], `enhanced-${enhancePreview.index}.jpg`, { type: blob.type || "image/jpeg" });
      setPhotoAt(enhancePreview.index, { file, preview: enhancePreview.enhancedUrl, enhanced: true });
      toast.success("¡Foto mejorada aplicada!");
      setEnhancePreview(null);
    } catch {
      toast.error("Error al aplicar la foto");
    } finally {
      setApplyingEnhance(false);
    }
  };

  const resolveColors = () => {
    if (colorTheme === "custom") return { brand: customBrand, accent: customAccent };
    const t = COLOR_THEMES.find((c) => c.id === colorTheme);
    if (!t || t.id === "card") return { brand: "", accent: "" };
    return { brand: t.brand, accent: t.accent };
  };

  const generate = async () => {
    const chosen = photos.slice(0, needed).filter(Boolean);
    if (chosen.length < needed) { toast.error(`Sube ${needed} foto${needed > 1 ? "s" : ""}`); return; }
    if (!brief.trim()) { toast.error("Escribe qué quieres comunicar"); return; }
    if (formats.length === 0) { toast.error("Elige al menos un formato"); return; }
    setLoading(true);
    setPost(null);
    try {
      const { brand: brandColor, accent: accentColor } = resolveColors();
      const fd = new FormData();
      fd.append("template", template);
      fd.append("brief", brief);
      fd.append("language", language);
      fd.append("formats", formats.join(","));
      fd.append("brand_color", brandColor);
      fd.append("accent_color", accentColor);
      chosen.forEach((p) => fd.append("files", p.file));
      const { data } = await api.post("/social/posts", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      });
      setPost(data);
      toast.success("¡Post generado!");
      loadHistory();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo generar el post");
    } finally {
      setLoading(false);
    }
  };

  const updateCopy = (k, v) => setPost((p) => ({ ...p, copy: { ...p.copy, [k]: v } }));

  const rerender = async () => {
    if (!post) return;
    setRerendering(true);
    try {
      const { data } = await api.post(`/social/posts/${post.id}/rerender`, {
        headline: post.copy.headline,
        subheadline: post.copy.subheadline,
        cta: post.copy.cta,
        caption: post.copy.caption,
        hashtags: post.copy.hashtags,
      });
      setPost(data);
      toast.success("Diseño actualizado");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error al actualizar");
    } finally {
      setRerendering(false);
    }
  };

  const download = async (img) => {
    try {
      const res = await fetch(`${BACKEND}${img.url}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `unitap-post-${img.format}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(`${BACKEND}${img.url}`, "_blank");
    }
  };

  const copyCaption = () => {
    const text = `${post.copy.caption || ""}\n\n${(post.copy.hashtags || []).join(" ")}`.trim();
    navigator.clipboard.writeText(text);
    toast.success("Caption copiado");
  };

  const deletePost = async (id) => {
    if (!window.confirm("¿Eliminar este post?")) return;
    await api.delete(`/social/posts/${id}`);
    if (post?.id === id) setPost(null);
    loadHistory();
    toast.success("Post eliminado");
  };

  return (
    <div className="space-y-6" data-testid="social-studio">
      <div>
        <h1 className="font-heading text-2xl lg:text-3xl font-bold flex items-center gap-2">
          <Megaphone className="w-7 h-7 text-emerald-600" /> Estudio de Marketing
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Escribe en español lo que quieres → la IA crea el post profesional en inglés con tu marca. 📲
        </p>
      </div>

      {/* Builder */}
      <Card className="p-5 space-y-5 border-0 shadow-sm">
        {/* Template */}
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">1. Elige un diseño</Label>
          <p className="text-[11px] text-slate-400 mt-0.5 mb-2">Así se verá tu post (tu foto y marca reemplazan el ejemplo).</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTemplate(t.id)}
                data-testid={`template-${t.id}`}
                className={`group relative text-left rounded-2xl border overflow-hidden tap transition-all ${
                  template === t.id
                    ? "border-emerald-500 ring-2 ring-emerald-500 shadow-md"
                    : "border-slate-200 hover:border-emerald-300 hover:shadow-sm"
                }`}
              >
                <div className="relative aspect-square bg-slate-100">
                  <img
                    src={t.preview}
                    alt={t.label}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                  {template === t.id && (
                    <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow">
                      <Check className="w-4 h-4" />
                    </span>
                  )}
                  {t.photos > 1 && (
                    <span className="absolute top-1.5 left-1.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-black/60 text-white">
                      2 fotos
                    </span>
                  )}
                </div>
                <div className="px-2 py-1.5 bg-white">
                  <div className="font-semibold text-xs text-slate-700 truncate">{t.label}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Photos */}
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            2. {needed > 1 ? "Fotos" : "Foto"}
          </Label>
          <div className="flex gap-3 mt-2">
            {Array.from({ length: needed }).map((_, i) => (
              <PhotoSlot
                key={i}
                index={i}
                label={needed > 1 ? (i === 0 ? "Antes" : "Después") : "Foto"}
                photo={photos[i]}
                onPick={(p) => setPhotoAt(i, p)}
                onClear={() => setPhotoAt(i, null)}
                onEnhance={enhancePhoto}
                enhancing={enhanceIdx === i}
              />
            ))}
          </div>
          <p className="text-[11px] text-violet-600 mt-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Tip: ¿foto oscura o borrosa? Dale "Mejorar con IA" antes de generar.
          </p>
        </div>

        {/* Brief */}
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">3. ¿Qué quieres comunicar? (español)</Label>
          <Textarea
            data-testid="brief-input"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Ej: Transformamos este jardín descuidado en uno hermoso. Ofrecemos mantenimiento y paisajismo. Llama para una cotización gratis."
            className="mt-2 rounded-xl min-h-[90px]"
          />
        </div>

        {/* Language + formats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">4. Idioma del post</Label>
            <div className="flex gap-2 mt-2">
              {[["en", "Inglés"], ["es", "Español"]].map(([id, lbl]) => (
                <button
                  key={id}
                  onClick={() => setLanguage(id)}
                  data-testid={`lang-${id}`}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border tap ${
                    language === id ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">5. Formato</Label>
            <div className="flex gap-2 mt-2">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => toggleFormat(f.id)}
                  data-testid={`format-${f.id}`}
                  title={f.hint}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border tap ${
                    formats.includes(f.id) ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Colors */}
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">6. Color del diseño</Label>
          <p className="text-[11px] text-slate-400 mt-0.5 mb-2">Cambia el color de la barra y el fondo para que combine con tu negocio.</p>
          <div className="flex flex-wrap gap-2">
            {COLOR_THEMES.map((c) => (
              <button
                key={c.id}
                onClick={() => setColorTheme(c.id)}
                data-testid={`color-${c.id}`}
                title={c.label}
                className={`flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full border text-xs font-semibold tap transition-all ${
                  colorTheme === c.id ? "border-slate-800 ring-1 ring-slate-800" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span className="w-5 h-5 rounded-full border border-black/10 flex-shrink-0" style={{ background: c.swatch }} />
                {c.label}
              </button>
            ))}
            <button
              onClick={() => setColorTheme("custom")}
              data-testid="color-custom"
              className={`flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full border text-xs font-semibold tap transition-all ${
                colorTheme === "custom" ? "border-slate-800 ring-1 ring-slate-800" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <span className="w-5 h-5 rounded-full border border-black/10 flex-shrink-0" style={{ background: customAccent }} />
              Personalizado
            </button>
          </div>
          {colorTheme === "custom" && (
            <div className="flex gap-4 mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200" data-testid="custom-colors">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                Barra / botón
                <input type="color" value={customAccent} onChange={(e) => setCustomAccent(e.target.value)} data-testid="custom-accent-input" className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer" />
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                Fondo
                <input type="color" value={customBrand} onChange={(e) => setCustomBrand(e.target.value)} data-testid="custom-brand-input" className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer" />
              </label>
            </div>
          )}
        </div>

        <Button
          onClick={generate}
          disabled={loading}
          data-testid="generate-btn"
          className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-base"
        >
          {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generando con IA…</> : <><Sparkles className="w-5 h-5 mr-2" /> Generar Post</>}
        </Button>
      </Card>

      {/* Result */}
      {post && (
        <Card className="p-5 space-y-4 border-0 shadow-sm" data-testid="post-result">
          <h2 className="font-heading text-lg font-bold">Tu post</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {post.images.map((img) => (
              <div key={img.format} className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{img.format === "9x16" ? "Vertical 9:16" : "Cuadrado 1:1"}</div>
                <img
                  src={`${BACKEND}${img.url}`}
                  alt={img.format}
                  data-testid={`result-img-${img.format}`}
                  className="w-full rounded-2xl border border-slate-200"
                />
                <Button onClick={() => download(img)} variant="outline" data-testid={`download-${img.format}`} className="w-full rounded-xl">
                  <Download className="w-4 h-4 mr-2" /> Descargar
                </Button>
              </div>
            ))}
          </div>

          {/* Editable copy */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Edita el texto y vuelve a generar el diseño</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Titular</Label>
                <Input data-testid="edit-headline" value={post.copy.headline || ""} onChange={(e) => updateCopy("headline", e.target.value)} className="rounded-xl mt-1" />
              </div>
              <div>
                <Label className="text-xs">Subtítulo</Label>
                <Input data-testid="edit-subheadline" value={post.copy.subheadline || ""} onChange={(e) => updateCopy("subheadline", e.target.value)} className="rounded-xl mt-1" />
              </div>
              <div>
                <Label className="text-xs">Botón (CTA)</Label>
                <Input data-testid="edit-cta" value={post.copy.cta || ""} onChange={(e) => updateCopy("cta", e.target.value)} className="rounded-xl mt-1" />
              </div>
            </div>
            <Button onClick={rerender} disabled={rerendering} data-testid="rerender-btn" variant="outline" className="rounded-xl">
              {rerendering ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
              Volver a generar diseño
            </Button>
          </div>

          {/* Caption */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Caption para la publicación</Label>
              <Button onClick={copyCaption} size="sm" variant="ghost" data-testid="copy-caption-btn" className="text-emerald-700">
                <Copy className="w-4 h-4 mr-1" /> Copiar
              </Button>
            </div>
            <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{post.copy.caption}</p>
            <p className="text-sm text-blue-600 mt-2">{(post.copy.hashtags || []).join(" ")}</p>
          </div>
        </Card>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card className="p-5 border-0 shadow-sm" data-testid="post-history">
          <h2 className="font-heading text-lg font-bold mb-3">Mis posts</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {history.map((h) => {
              const thumb = h.images?.[0];
              return (
                <div key={h.id} className="relative group">
                  {thumb && (
                    <img
                      src={`${BACKEND}${thumb.url}`}
                      alt={h.template}
                      onClick={() => { setPost(h); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      data-testid={`history-${h.id}`}
                      className="w-full aspect-square object-cover rounded-xl border border-slate-200 cursor-pointer tap"
                    />
                  )}
                  <button
                    onClick={() => deletePost(h.id)}
                    data-testid={`history-delete-${h.id}`}
                    className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* AI photo enhancement before/after dialog */}
      <Dialog open={!!enhancePreview} onOpenChange={(v) => !v && setEnhancePreview(null)}>
        <DialogContent className="rounded-2xl max-w-lg" data-testid="enhance-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-600" /> Foto Antes y Después
            </DialogTitle>
          </DialogHeader>
          {enhancePreview && (
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Original</div>
                <img src={enhancePreview.originalPreview} alt="original" className="w-full aspect-square object-cover rounded-xl border border-slate-200" />
              </div>
              <div className="text-center">
                <div className="text-xs font-bold uppercase tracking-wider text-violet-600 mb-1.5">Mejorada ✨</div>
                <img src={enhancePreview.enhancedUrl} alt="mejorada" className="w-full aspect-square object-cover rounded-xl border-2 border-violet-400" />
              </div>
            </div>
          )}
          <p className="text-[11px] text-slate-400 text-center">La IA mejora luz, color y nitidez. Tú decides cuál usar para el post.</p>
          <DialogFooter className="grid grid-cols-2 gap-2">
            <Button variant="outline" data-testid="enhance-use-original" onClick={() => setEnhancePreview(null)} disabled={applyingEnhance} className="rounded-xl h-11">
              Usar original
            </Button>
            <Button data-testid="enhance-use-enhanced" onClick={applyEnhanced} disabled={applyingEnhance} className="rounded-xl h-11 bg-violet-600 hover:bg-violet-700">
              {applyingEnhance ? <Loader2 className="w-4 h-4 animate-spin" /> : "Usar mejorada ✨"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
