import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
  ImagePlus, Wand2, X, Check, Image as ImageIcon, Video, IdCard,
  SlidersHorizontal, Languages, Palette, Star, MapPin, ChevronLeft, ChevronRight, ChevronDown,
} from "lucide-react";
import { COLOR_THEMES, resolveColors } from "@/lib/socialThemes";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import ReelStudio from "@/components/ReelStudio";
import AiImageStudio from "@/components/AiImageStudio";
import { AiTranslateButton } from "@/components/AiTranslateButton";

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
  { id: "review_5star", label: "Reseña 5★", photos: 1 },
  { id: "framed_pro", label: "Marco Pro", photos: 1 },
  { id: "split_diagonal", label: "Diagonal", photos: 1 },
  { id: "now_hiring", label: "Contratando", photos: 1 },
  { id: "quote_offer", label: "Cotización Gratis", photos: 1 },
  { id: "seasonal", label: "Temporada", photos: 1 },
  { id: "trust_badge", label: "Garantía", photos: 1 },
  { id: "coupon", label: "Cupón", photos: 1 },
  { id: "duo_grid", label: "Galería Dúo", photos: 2 },
  { id: "clean_band", label: "Cinta Limpia", photos: 1 },
].map((t) => ({ ...t, preview: `/social-previews/${t.id}.jpg` }));

const FORMATS = [
  { id: "9x16", label: "Vertical 9:16", hint: "Reels / TikTok / Stories" },
  { id: "1x1", label: "Cuadrado 1:1", hint: "Feed Instagram / Facebook" },
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
            {!photo.enhanced && (
              <button
                onClick={(e) => { e.stopPropagation(); onEnhance(index); }}
                disabled={enhancing}
                data-testid={`enhance-photo-${index}`}
                className="absolute bottom-2 right-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md shadow border border-violet-200 text-violet-700 text-[11px] font-bold tap"
              >
                {enhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {enhancing ? "Mejorando…" : "Mejorar con IA"}
              </button>
            )}
          </>
        ) : (
          <div className="text-center text-slate-400">
            <ImagePlus className="w-7 h-7 mx-auto mb-1" />
            <span className="text-xs font-semibold">Subir foto</span>
          </div>
        )}
      </div>
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
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(() => {
    const m = searchParams.get("mode");
    return ["image", "reel", "ai"].includes(m) ? m : "image";
  });
  const [template, setTemplate] = useState("before_after");
  const tplScrollRef = useRef(null);
  const scrollTpl = (dir) => {
    const el = tplScrollRef.current;
    if (el) el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.8), behavior: "smooth" });
  };
  const [photos, setPhotos] = useState([null, null]);
  const [brief, setBrief] = useState(() => searchParams.get("brief") || "");
  const [aiInitialPrompt] = useState(() => searchParams.get("imgprompt") || "");
  const [language, setLanguage] = useState("en");
  const [formats, setFormats] = useState(["9x16", "1x1"]);
  const [colorTheme, setColorTheme] = useState("card");
  const [customAccent, setCustomAccent] = useState("#10b981");
  const [customBrand, setCustomBrand] = useState("#0f5f46");
  const [loading, setLoading] = useState(false);
  const [post, setPost] = useState(null);
  const [history, setHistory] = useState([]);
  const [rerendering, setRerendering] = useState(false);
  // Optional customization (collapsed by default so it never wastes space)
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [legibility, setLegibility] = useState("auto");
  const [textPosition, setTextPosition] = useState("auto");
  const [editAccent, setEditAccent] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [labelBefore, setLabelBefore] = useState("");
  const [labelAfter, setLabelAfter] = useState("");
  const [promoLabel, setPromoLabel] = useState("");
  const [enhanceIdx, setEnhanceIdx] = useState(null); // slot being enhanced (loading)
  const [enhancePreview, setEnhancePreview] = useState(null); // { index, originalPreview, enhancedUrl }
  const [applyingEnhance, setApplyingEnhance] = useState(false);
  const [cardIds, setCardIds] = useState([]); // photo_ids currently on the Smart Card
  const [cardBusy, setCardBusy] = useState(null);
  const [reelInject, setReelInject] = useState(null); // AI image pushed into the reel builder
  const [advOpen, setAdvOpen] = useState(false); // "Más opciones" drawer (idioma + colores personalizados)
  const [resultOpen, setResultOpen] = useState(false); // slide-up result drawer

  // Publish a generated post image to Google Business Profile
  const [gmbConnected, setGmbConnected] = useState(false);
  const [gmbConfigured, setGmbConfigured] = useState(false);
  const [gmbImg, setGmbImg] = useState(null);
  const [gmbCaption, setGmbCaption] = useState("");
  const [gmbCta, setGmbCta] = useState("");
  const [gmbPosting, setGmbPosting] = useState(false);

  useEffect(() => {
    api.get("/google-business/status")
      .then(({ data }) => { setGmbConnected(!!data?.connected); setGmbConfigured(!!data?.configured); })
      .catch(() => { setGmbConnected(false); setGmbConfigured(false); });
  }, []);

  useEffect(() => {
    const g = searchParams.get("gmb");
    if (g === "connected") {
      toast.success("¡Google My Business conectado! 🎉 Ya puedes publicar tus posts.");
      api.get("/google-business/status").then(({ data }) => { setGmbConnected(!!data?.connected); setGmbConfigured(!!data?.configured); }).catch(() => {});
    } else if (g === "error") {
      toast.error("No se pudo conectar con Google. Intenta de nuevo.");
    }
  }, [searchParams]);

  const connectGmb = async () => {
    try {
      const { data } = await api.get("/google-business/connect", { params: { return_to: "/marketing" } });
      window.location.href = data.auth_url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || "La conexión con Google aún no está disponible.");
    }
  };

  const openGmb = (img, prefill = "") => {
    setGmbImg(img);
    setGmbCaption(prefill || "");
    setGmbCta("");
  };

  const publishGmb = async () => {
    if (!gmbCaption.trim()) { toast.error("Escribe el texto del post (en inglés)."); return; }
    setGmbPosting(true);
    try {
      await api.post("/google-business/posts", {
        summary: gmbCaption.trim(),
        photo_id: gmbImg.photo_id,
        cta_url: gmbCta.trim(),
      });
      toast.success("¡Publicado en tu Google Business! 🎉");
      setGmbImg(null);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo publicar en Google.");
    } finally {
      setGmbPosting(false);
    }
  };

  // Use an AI-generated image in the Post builder (single-photo template).
  const useAiImageInPost = (file, preview) => {
    setTemplate("showcase");
    setPhotos([{ file, preview, enhanced: true }, null]);
    setMode("image");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  // Use an AI-generated image in the Reel builder.
  const useAiImageInReel = (file, preview) => {
    setReelInject({ file, preview, _k: Date.now() });
    setMode("reel");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  // Prefill the post brief from a generated idea.
  const useIdeaInPost = (idea) => {
    setBrief(idea);
    setMode("image");
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.success("Idea lista en tu post — sube una foto o crea una con IA ✨");
  };

  const tpl = TEMPLATES.find((t) => t.id === template);
  const needed = tpl.photos;

  const loadHistory = async () => {
    try {
      const { data } = await api.get("/social/posts");
      setHistory(data);
    } catch { /* ignore */ }
  };
  const loadCardIds = async () => {
    try {
      const { data } = await api.get("/photos/on-card-ids");
      setCardIds(data.ids || []);
    } catch { /* ignore */ }
  };
  useEffect(() => { loadHistory(); loadCardIds(); }, []);

  // Sync customization controls whenever a different post is opened (kept collapsed).
  useEffect(() => {
    if (!post) return;
    setCustomizeOpen(false);
    setLegibility(post.style?.legibility || "auto");
    setTextPosition(post.style?.text_position || "auto");
    setEditAccent(post.accent_color || "");
    setEditBrand(post.brand_color || "");
    setLabelBefore(post.label_before || "");
    setLabelAfter(post.label_after || "");
    setPromoLabel(post.promo_label || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.id]);

  const toggleOnCard = async (photoId) => {
    if (!photoId) return;
    const isOn = cardIds.includes(photoId);
    setCardBusy(photoId);
    try {
      await api.post(`/photos/${photoId}/on-card`, { value: !isOn });
      setCardIds((prev) => (isOn ? prev.filter((x) => x !== photoId) : [...prev, photoId]));
      toast.success(isOn ? "Quitada de tu tarjeta" : "¡Agregada a tu tarjeta digital!");
    } catch {
      toast.error("No se pudo actualizar la tarjeta");
    } finally {
      setCardBusy(null);
    }
  };

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

  const resolveColorsLocal = () => resolveColors(colorTheme, customBrand, customAccent);

  const generate = async () => {
    const chosen = photos.slice(0, needed).filter(Boolean);
    if (chosen.length < needed) { toast.error(`Sube ${needed} foto${needed > 1 ? "s" : ""}`); return; }
    if (!brief.trim()) { toast.error("Escribe qué quieres comunicar"); return; }
    if (formats.length === 0) { toast.error("Elige al menos un formato"); return; }
    setLoading(true);
    setPost(null);
    setResultOpen(true);
    try {
      const { brand: brandColor, accent: accentColor } = resolveColorsLocal();
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
      setResultOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const updateCopy = (k, v) => setPost((p) => ({ ...p, copy: { ...p.copy, [k]: v } }));

  const rerender = async () => {
    if (!post) return;
    setRerendering(true);
    try {
      const body = {
        headline: post.copy.headline,
        subheadline: post.copy.subheadline,
        cta: post.copy.cta,
        caption: post.copy.caption,
        hashtags: post.copy.hashtags,
      };
      const style = {};
      if (legibility !== "auto") style.legibility = legibility;
      if (["showcase", "center_stage"].includes(post.template) && textPosition !== "auto") style.text_position = textPosition;
      if (Object.keys(style).length) body.style = style;
      if (editBrand) body.brand_color = editBrand;
      if (editAccent) body.accent_color = editAccent;
      if (post.template === "before_after") {
        if (labelBefore) body.label_before = labelBefore;
        if (labelAfter) body.label_after = labelAfter;
      }
      if (["promo", "seasonal"].includes(post.template) && promoLabel) body.promo_label = promoLabel;
      const { data } = await api.post(`/social/posts/${post.id}/rerender`, body);
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
      a.download = `unitech-post-${img.format}.jpg`;
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

      {/* Mode tabs */}
      <div className="flex gap-2 p-1 rounded-2xl bg-slate-100 w-full sm:w-auto sm:inline-flex" data-testid="studio-mode-tabs">
        <button
          onClick={() => setMode("image")}
          data-testid="mode-image"
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold tap transition-all ${
            mode === "image" ? "bg-white shadow-sm text-emerald-700" : "text-slate-500"
          }`}
        >
          <ImageIcon className="w-4 h-4" /> Imagen
        </button>
        <button
          onClick={() => setMode("reel")}
          data-testid="mode-reel"
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold tap transition-all ${
            mode === "reel" ? "bg-white shadow-sm text-emerald-700" : "text-slate-500"
          }`}
        >
          <Video className="w-4 h-4" /> Video (Reel)
        </button>
        <button
          onClick={() => setMode("ai")}
          data-testid="mode-ai"
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold tap transition-all ${
            mode === "ai" ? "bg-white shadow-sm text-violet-700" : "text-slate-500"
          }`}
        >
          <Wand2 className="w-4 h-4" /> Crear con IA
        </button>
      </div>

      {/* Connect Google banner (so any plan, incl. Marketing-only, can enable publishing) */}
      {gmbConfigured && !gmbConnected && (
        <button onClick={connectGmb} data-testid="mkt-connect-gmb-banner"
          className="tap w-full flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-left transition-colors hover:bg-blue-50">
          <span className="w-10 h-10 rounded-full bg-white border border-blue-100 flex items-center justify-center flex-none">
            <MapPin className="w-5 h-5 text-blue-600" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-slate-900">Conecta Google My Business</span>
            <span className="block text-xs text-slate-500">Conéctalo una vez para publicar tus posts directo en Google.</span>
          </span>
          <span className="text-xs font-bold text-blue-700 flex-none">Conectar</span>
        </button>
      )}
      {gmbConnected && (
        <div data-testid="mkt-gmb-connected" className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
          <Check className="w-4 h-4" /> Google My Business conectado — ya puedes publicar tus posts.
        </div>
      )}


      {mode === "reel" && <ReelStudio injectPhoto={reelInject} />}

      {mode === "ai" && (
        <AiImageStudio
          onUseInPost={useAiImageInPost}
          onUseInReel={useAiImageInReel}
          onUseIdea={useIdeaInPost}
          onToggleCard={toggleOnCard}
          cardIds={cardIds}
          cardBusy={cardBusy}
          initialPrompt={aiInitialPrompt}
        />
      )}

      {mode === "image" && (
      <>
      {/* Builder */}
      <Card className="p-5 space-y-5 border-0 shadow-sm">
        {/* Template */}
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">1. Elige un diseño</Label>
          <p className="text-[11px] text-slate-400 mt-0.5 mb-2">Desliza → y toca uno. Tu foto y marca reemplazan el ejemplo.</p>
          <div className="relative">
            <button
              type="button"
              data-testid="template-prev-btn"
              onClick={() => scrollTpl(-1)}
              aria-label="Anterior"
              className="hidden sm:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border border-slate-200 shadow-md items-center justify-center text-slate-700 hover:bg-slate-50 hover:border-emerald-300 transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              data-testid="template-next-btn"
              onClick={() => scrollTpl(1)}
              aria-label="Siguiente"
              className="hidden sm:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border border-slate-200 shadow-md items-center justify-center text-slate-700 hover:bg-slate-50 hover:border-emerald-300 transition"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div ref={tplScrollRef} className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide" data-testid="template-carousel">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTemplate(t.id)}
                data-testid={`template-${t.id}`}
                className={`group relative flex-none w-[132px] snap-start text-left rounded-2xl border overflow-hidden tap transition-all ${
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
        </div>

        {/* Photos */}
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            2. {needed > 1 ? "Fotos" : "Foto"}
          </Label>
          <div className={`flex gap-3 mt-2 ${needed === 1 ? "max-w-[220px]" : ""}`}>
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

        {/* 4. Formato (chips horizontales) */}
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">4. Formato</Label>
          <div className="flex overflow-x-auto gap-2 pb-1 mt-2 scrollbar-hide">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                onClick={() => toggleFormat(f.id)}
                data-testid={`format-${f.id}`}
                title={f.hint}
                className={`flex-none px-5 py-2.5 rounded-full text-xs font-semibold border tap transition-colors ${
                  formats.includes(f.id) ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* 5. Color (swatches horizontales) + Más opciones */}
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">5. Color del diseño</Label>
            <button
              onClick={() => setAdvOpen(true)}
              data-testid="more-options-btn"
              className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-700 tap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" /> Más opciones
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 mb-2">Desliza → para ver los colores. Cambia barra y fondo.</p>
          <div className="flex overflow-x-auto gap-3 pb-1 items-center scrollbar-hide">
            {COLOR_THEMES.map((c) => (
              <button
                key={c.id}
                onClick={() => setColorTheme(c.id)}
                data-testid={`color-${c.id}`}
                title={c.label}
                className={`flex-none w-11 h-11 rounded-full border-2 tap transition-transform hover:scale-105 ${
                  colorTheme === c.id ? "ring-2 ring-emerald-600 ring-offset-2 border-white" : "border-slate-200"
                }`}
                style={{ background: c.swatch }}
              />
            ))}
            <button
              onClick={() => { setColorTheme("custom"); setAdvOpen(true); }}
              data-testid="color-custom"
              title="Personalizado"
              className={`flex-none w-11 h-11 rounded-full border-2 flex items-center justify-center tap ${
                colorTheme === "custom" ? "ring-2 ring-emerald-600 ring-offset-2 border-white" : "border-dashed border-slate-300 bg-slate-50 text-slate-500"
              }`}
              style={colorTheme === "custom" ? { background: customAccent } : {}}
            >
              {colorTheme === "custom" ? null : <Palette className="w-4 h-4" />}
            </button>
          </div>
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

      {/* "Más opciones" — Idioma + colores personalizados (drawer para no llenar la pantalla) */}
      <Drawer open={advOpen} onOpenChange={setAdvOpen}>
        <DrawerContent data-testid="advanced-settings-drawer">
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-heading flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-emerald-600" /> Más opciones
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8 space-y-6 max-w-lg mx-auto w-full">
            {/* Idioma */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Languages className="w-3.5 h-3.5" /> Idioma del post
              </Label>
              <div className="flex gap-2 mt-2">
                {[["en", "Inglés"], ["es", "Español"]].map(([id, lbl]) => (
                  <button
                    key={id}
                    onClick={() => setLanguage(id)}
                    data-testid={`lang-${id}`}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold border tap ${
                      language === id ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* Colores personalizados */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" /> Colores personalizados
              </Label>
              <p className="text-[11px] text-slate-400 mt-0.5 mb-2">Elige colores exactos para que combine con tu negocio.</p>
              <div className="flex gap-4 p-3 rounded-xl bg-slate-50 border border-slate-200" data-testid="custom-colors">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  Barra / botón
                  <input type="color" value={customAccent} onChange={(e) => { setCustomAccent(e.target.value); setColorTheme("custom"); }} data-testid="custom-accent-input" className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer" />
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  Fondo
                  <input type="color" value={customBrand} onChange={(e) => { setCustomBrand(e.target.value); setColorTheme("custom"); }} data-testid="custom-brand-input" className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer" />
                </label>
              </div>
            </div>

            <DrawerClose asChild>
              <Button data-testid="adv-done-btn" className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700">
                <Check className="w-5 h-5 mr-2" /> Listo
              </Button>
            </DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Result — slide-up Drawer */}
      <Drawer open={resultOpen} onOpenChange={setResultOpen}>
        <DrawerContent data-testid="post-result-drawer" className="max-h-[92vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-heading flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-600" /> Tu post
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8 overflow-y-auto max-w-lg mx-auto w-full" data-testid="post-result">
          {(loading || !post) ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="w-9 h-9 animate-spin text-emerald-600 mb-3" />
              <p className="text-sm font-semibold text-slate-600">Creando tu post con IA…</p>
              <p className="text-xs text-slate-400 mt-1">Un momento, la IA está diseñando tu publicación.</p>
            </div>
          ) : (
          <div className="space-y-4">
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
                {cardIds.includes(img.photo_id) ? (
                  <Button onClick={() => toggleOnCard(img.photo_id)} disabled={cardBusy === img.photo_id} data-testid={`oncard-${img.format}`}
                    className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
                    {cardBusy === img.photo_id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />} En tu tarjeta
                  </Button>
                ) : (
                  <Button onClick={() => toggleOnCard(img.photo_id)} disabled={cardBusy === img.photo_id} variant="outline" data-testid={`oncard-${img.format}`}
                    className="w-full rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                    {cardBusy === img.photo_id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <IdCard className="w-4 h-4 mr-2" />} Agregar a mi tarjeta
                  </Button>
                )}
                {gmbConnected && (
                  <Button onClick={() => openGmb(img, post?.copy?.caption || "")} data-testid={`gmb-post-${img.format}`}
                    className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white">
                    <Star className="w-4 h-4 mr-2 fill-white" /> Publicar en Google
                  </Button>
                )}
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

            {/* Optional advanced customization — collapsed by default (no wasted space) */}
            <Collapsible open={customizeOpen} onOpenChange={setCustomizeOpen} className="rounded-2xl border border-slate-200 overflow-hidden">
              <CollapsibleTrigger asChild>
                <button data-testid="customize-toggle" className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/70 hover:bg-slate-100 transition-colors tap">
                  <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" /> Personaliza el diseño
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${customizeOpen ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-4 space-y-4 border-t border-slate-200" data-testid="customize-panel">
                  <p className="text-[10px] text-slate-400 -mt-1">Opcional — los diseños ya salen con sombra automática. Aquí solo si quieres afinar.</p>

                  {/* Sombra / legibilidad */}
                  <div>
                    <Label className="text-[11px] font-bold text-slate-600">Sombra del texto</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1.5" data-testid="legibility-group">
                      {[["auto", "Auto"], ["none", "Sin sombra"], ["soft", "Suave"], ["medium", "Media"], ["strong", "Fuerte"]].map(([id, lbl]) => (
                        <button key={id} onClick={() => setLegibility(id)} data-testid={`legibility-${id}`}
                          className={`px-3 py-2 rounded-lg text-[11px] font-semibold border tap transition-colors ${legibility === id ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Posición del texto (solo diseños sobre foto completa) */}
                  {["showcase", "center_stage"].includes(post.template) && (
                    <div>
                      <Label className="text-[11px] font-bold text-slate-600">Posición del texto</Label>
                      <div className="grid grid-cols-4 gap-1.5 mt-1.5" data-testid="position-group">
                        {[["auto", "Auto"], ["top", "Arriba"], ["center", "Centro"], ["bottom", "Abajo"]].map(([id, lbl]) => (
                          <button key={id} onClick={() => setTextPosition(id)} data-testid={`position-${id}`}
                            className={`py-2 rounded-lg text-[11px] font-semibold border tap transition-colors ${textPosition === id ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}>
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Colores */}
                  <div>
                    <Label className="text-[11px] font-bold text-slate-600">Colores</Label>
                    <div className="flex gap-3 mt-1.5">
                      <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                        Barra / botón
                        <input type="color" value={editAccent || "#10b981"} onChange={(e) => setEditAccent(e.target.value)} data-testid="edit-accent-input" className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer" />
                      </label>
                      <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                        Fondo
                        <input type="color" value={editBrand || "#0f5f46"} onChange={(e) => setEditBrand(e.target.value)} data-testid="edit-brand-input" className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer" />
                      </label>
                    </div>
                  </div>

                  {/* Etiquetas — Antes/Después */}
                  {post.template === "before_after" && (
                    <div className="grid grid-cols-2 gap-3" data-testid="ba-labels">
                      <div>
                        <Label className="text-[11px] font-bold text-slate-600">Etiqueta 1</Label>
                        <Input data-testid="edit-label-before" value={labelBefore} onChange={(e) => setLabelBefore(e.target.value)} placeholder="ANTES" className="rounded-xl mt-1 h-9 text-sm" />
                      </div>
                      <div>
                        <Label className="text-[11px] font-bold text-slate-600">Etiqueta 2</Label>
                        <Input data-testid="edit-label-after" value={labelAfter} onChange={(e) => setLabelAfter(e.target.value)} placeholder="DESPUÉS" className="rounded-xl mt-1 h-9 text-sm" />
                      </div>
                    </div>
                  )}

                  {/* Etiqueta de oferta — promo / temporada */}
                  {["promo", "seasonal"].includes(post.template) && (
                    <div data-testid="promo-label-wrap">
                      <Label className="text-[11px] font-bold text-slate-600">Etiqueta de oferta</Label>
                      <Input data-testid="edit-promo-label" value={promoLabel} onChange={(e) => setPromoLabel(e.target.value)} placeholder="OFERTA ESPECIAL" className="rounded-xl mt-1 h-9 text-sm" />
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

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
          </div>
          )}
          </div>
        </DrawerContent>
      </Drawer>

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
                      onClick={() => { setPost(h); setResultOpen(true); }}
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

      {/* Publish generated post to Google Business */}
      <Dialog open={!!gmbImg} onOpenChange={(o) => !o && setGmbImg(null)}>
        <DialogContent className="rounded-2xl max-w-md" data-testid="gmb-post-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Star className="w-5 h-5 text-blue-600 fill-blue-600" /> Publicar en Google Business
            </DialogTitle>
          </DialogHeader>
          {gmbImg && (
            <div className="space-y-3">
              <img src={`${BACKEND}${gmbImg.url}`} alt="" className="w-full max-h-52 object-contain rounded-xl border border-slate-200 bg-slate-50" />
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-700">Texto del post (inglés)</Label>
                <AiTranslateButton
                  fieldType="gmb_post"
                  onResult={(en) => setGmbCaption(en)}
                  testId="gmb-post-caption-ai"
                  placeholder="Ej: Acabamos un techo nuevo en Auburn — ¡agenda tu estimado gratis!"
                />
              </div>
              <Textarea
                value={gmbCaption}
                onChange={(e) => setGmbCaption(e.target.value)}
                placeholder="Write your update in English (or use the AI button above)..."
                className="rounded-xl min-h-[90px] text-sm"
                data-testid="gmb-post-caption-input"
              />
              <Input
                value={gmbCta}
                onChange={(e) => setGmbCta(e.target.value)}
                placeholder="Link opcional (ej: https://ezunitech.com/tu-tarjeta)"
                className="rounded-xl text-sm"
                data-testid="gmb-post-cta-input"
              />
              <Button onClick={publishGmb} disabled={gmbPosting}
                className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold" data-testid="gmb-post-publish-btn">
                {gmbPosting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Star className="w-4 h-4 mr-2 fill-white" />}
                Publicar ahora
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </>
      )}
    </div>
  );
}
