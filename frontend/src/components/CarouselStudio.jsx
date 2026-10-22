import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { toast } from "sonner";
import {
  Images, Sparkles, Loader2, Download, Languages, Palette,
  ImagePlus, X, ArrowLeftRight, GalleryHorizontal, ArrowLeft, ArrowRight,
} from "lucide-react";
import { COLOR_THEMES, resolveColors } from "@/lib/socialThemes";
import SlideCarousel from "@/components/SlideCarousel";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const MAX_PHOTOS = 10;

export default function CarouselStudio({ onCreated }) {
  const { i18n } = useTranslation();
  const es = (i18n.language || "es").startsWith("es");
  const T = (en, esT) => (es ? esT : en);

  const [kind, setKind] = useState("gallery"); // gallery | before_after
  const [photos, setPhotos] = useState([]); // [{file, preview}]
  const [brief, setBrief] = useState("");
  const [language, setLanguage] = useState(es ? "es" : "en");
  const [colorTheme, setColorTheme] = useState("card");
  const [customAccent, setCustomAccent] = useState("#10b981");
  const [customBrand, setCustomBrand] = useState("#0f5f46");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const addRef = useRef(null);

  const minPhotos = 2;
  const maxPhotos = kind === "before_after" ? 2 : MAX_PHOTOS;

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []).map((f) => ({ file: f, preview: URL.createObjectURL(f) }));
    setPhotos((prev) => [...prev, ...incoming].slice(0, maxPhotos));
  };
  const removeAt = (i) => setPhotos((prev) => prev.filter((_, idx) => idx !== i));
  const move = (i, dir) => setPhotos((prev) => {
    const n = [...prev];
    const j = i + dir;
    if (j < 0 || j >= n.length) return prev;
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });
  const setKindSafe = (k) => {
    setKind(k);
    if (k === "before_after") setPhotos((prev) => prev.slice(0, 2));
  };

  const generate = async () => {
    const chosen = photos.slice(0, maxPhotos);
    if (chosen.length < minPhotos) { toast.error(T(`Add at least 2 photos`, `Agrega al menos 2 fotos`)); return; }
    if (kind === "before_after" && chosen.length !== 2) { toast.error(T("Before/after needs exactly 2 photos", "Antes/después necesita exactamente 2 fotos")); return; }
    if (!brief.trim()) { toast.error(T("Write what it's about", "Escribe de qué se trata")); return; }
    setLoading(true);
    setResult(null);
    setResultOpen(true);
    try {
      const { brand: brandColor, accent: accentColor } = resolveColors(colorTheme, customBrand, customAccent);
      const fd = new FormData();
      fd.append("kind", kind);
      fd.append("brief", brief);
      fd.append("language", language);
      fd.append("brand_color", brandColor);
      fd.append("accent_color", accentColor);
      chosen.forEach((p) => fd.append("files", p.file));
      const { data } = await api.post("/social/carousel", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      });
      setResult(data);
      toast.success(T("Carousel created!", "¡Carrusel creado!"));
      onCreated?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || T("Couldn't create the carousel", "No se pudo crear el carrusel"));
      setResultOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const downloadOne = async (url, name) => {
    try {
      const res = await fetch(`${BACKEND}${url}`);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(href);
    } catch {
      window.open(`${BACKEND}${url}`, "_blank");
    }
  };

  const downloadAll = async () => {
    if (!result?.slides?.length) return;
    setDownloadingAll(true);
    try {
      for (let i = 0; i < result.slides.length; i++) {
        // eslint-disable-next-line no-await-in-loop
        await downloadOne(result.slides[i].url, `carrusel-${String(i + 1).padStart(2, "0")}.jpg`);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 350));
      }
      toast.success(T("All slides downloaded", "Todas las diapositivas descargadas"));
    } finally {
      setDownloadingAll(false);
    }
  };

  const KindButton = ({ id, icon: Icon, label, hint }) => (
    <button
      type="button"
      onClick={() => setKindSafe(id)}
      data-testid={`carousel-kind-${id}`}
      className={`flex-1 flex flex-col items-start gap-1 p-3.5 rounded-2xl border text-left tap transition-all ${
        kind === id ? "border-emerald-500 ring-2 ring-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-emerald-300"
      }`}
    >
      <Icon className={`w-5 h-5 ${kind === id ? "text-emerald-600" : "text-slate-500"}`} />
      <span className="font-bold text-sm text-slate-800">{label}</span>
      <span className="text-[11px] text-slate-500 leading-tight">{hint}</span>
    </button>
  );

  return (
    <div data-testid="carousel-studio">
      <Card className="p-5 space-y-5 border-0 shadow-sm">
        {/* Kind */}
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">{T("1. Type of carousel", "1. Tipo de carrusel")}</Label>
          <div className="flex gap-3 mt-2">
            <KindButton id="gallery" icon={GalleryHorizontal} label={T("Gallery", "Galería")} hint={T("Several swipeable photos", "Varias fotos deslizables")} />
            <KindButton id="before_after" icon={ArrowLeftRight} label={T("Before / After", "Antes / Después")} hint={T("Exactly 2 photos", "Exactamente 2 fotos")} />
          </div>
        </div>

        {/* Photos */}
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {kind === "before_after" ? T("2. Your 2 photos (1st = before)", "2. Tus 2 fotos (la 1ª = antes)") : T("2. Your photos (in order)", "2. Tus fotos (en orden)")}
          </Label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 mt-2" data-testid="carousel-photos">
            {photos.map((p, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group">
                <img src={p.preview} alt={`foto ${i + 1}`} className="w-full h-full object-cover" />
                <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-bold">
                  {kind === "before_after" ? (i === 0 ? T("Before", "Antes") : T("After", "Después")) : i + 1}
                </span>
                <button onClick={() => removeAt(i)} data-testid={`carousel-photo-remove-${i}`}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center">
                  <X className="w-3.5 h-3.5" />
                </button>
                {kind === "gallery" && (
                  <div className="absolute bottom-1 inset-x-1 flex justify-between opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => move(i, -1)} disabled={i === 0} data-testid={`carousel-photo-left-${i}`}
                      className="w-6 h-6 rounded-full bg-white/90 text-slate-700 flex items-center justify-center disabled:opacity-30">
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => move(i, 1)} disabled={i === photos.length - 1} data-testid={`carousel-photo-right-${i}`}
                      className="w-6 h-6 rounded-full bg-white/90 text-slate-700 flex items-center justify-center disabled:opacity-30">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {photos.length < maxPhotos && (
              <button onClick={() => addRef.current?.click()} data-testid="carousel-add-photo"
                className="aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-400 bg-slate-50 flex flex-col items-center justify-center text-slate-400 tap">
                <ImagePlus className="w-6 h-6 mb-1" />
                <span className="text-[11px] font-semibold">{T("Add", "Agregar")}</span>
              </button>
            )}
          </div>
          <input ref={addRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <p className="text-[11px] text-slate-400 mt-2">
            {kind === "before_after"
              ? T("The 1st photo is labeled Before, the 2nd After.", "La 1ª foto se etiqueta Antes y la 2ª Después.")
              : T("Cover + one slide per photo + a contact slide are built automatically.", "Se arma portada + una tarjeta por foto + una tarjeta de contacto automáticamente.")}
          </p>
        </div>

        {/* Brief */}
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">{T("3. What's it about?", "3. ¿De qué se trata?")}</Label>
          <Textarea data-testid="carousel-brief-input" value={brief} onChange={(e) => setBrief(e.target.value)}
            placeholder={T("E.g. Bathroom remodel we just finished", "Ej. Remodelación de baño que acabamos de terminar")}
            className="mt-2 rounded-xl min-h-[80px]" />
        </div>

        {/* Language */}
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Languages className="w-3.5 h-3.5" /> {T("Post language", "Idioma del post")}
          </Label>
          <div className="flex gap-2 mt-2" data-testid="carousel-lang-toggle">
            {[["es", T("Spanish", "Español")], ["en", T("English", "Inglés")]].map(([id, lbl]) => (
              <button key={id} onClick={() => setLanguage(id)} data-testid={`carousel-lang-${id}`}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border tap transition-colors ${
                  language === id ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"
                }`}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Colors */}
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5" /> {T("Color", "Color")}
          </Label>
          <div className="flex overflow-x-auto gap-3 pb-1 mt-2 items-center scrollbar-hide">
            {COLOR_THEMES.map((c) => (
              <button key={c.id} onClick={() => setColorTheme(c.id)} data-testid={`carousel-color-${c.id}`} title={c.label}
                className={`flex-none w-11 h-11 rounded-full border-2 tap transition-transform hover:scale-105 ${
                  colorTheme === c.id ? "ring-2 ring-emerald-600 ring-offset-2 border-white" : "border-slate-200"
                }`} style={{ background: c.swatch }} />
            ))}
            <label title={T("Custom", "Personalizado")}
              className={`flex-none w-11 h-11 rounded-full border-2 flex items-center justify-center cursor-pointer tap ${
                colorTheme === "custom" ? "ring-2 ring-emerald-600 ring-offset-2 border-white" : "border-dashed border-slate-300 bg-slate-50 text-slate-500"
              }`} style={colorTheme === "custom" ? { background: customAccent } : {}}>
              {colorTheme !== "custom" && <Palette className="w-4 h-4" />}
              <input type="color" value={customAccent} data-testid="carousel-custom-accent"
                onChange={(e) => { setCustomAccent(e.target.value); setColorTheme("custom"); }} className="sr-only" />
            </label>
          </div>
        </div>

        <Button onClick={generate} disabled={loading} data-testid="carousel-generate-btn"
          className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-base">
          {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> {T("Creating...", "Creando...")}</>
            : <><Images className="w-5 h-5 mr-2" /> {T("Create carousel", "Crear carrusel")}</>}
        </Button>
      </Card>

      {/* Result */}
      <Drawer open={resultOpen} onOpenChange={setResultOpen}>
        <DrawerContent data-testid="carousel-result-drawer" className="max-h-[92vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-heading flex items-center gap-2">
              <Images className="w-5 h-5 text-emerald-600" /> {T("Your carousel", "Tu carrusel")}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8 overflow-y-auto max-w-md mx-auto w-full" data-testid="carousel-result">
            {(loading || !result) ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Loader2 className="w-9 h-9 animate-spin text-emerald-600 mb-3" />
                <p className="text-sm font-semibold text-slate-600">{T("Building your carousel...", "Armando tu carrusel...")}</p>
                <p className="text-xs text-slate-400 mt-1">{T("Writing copy and designing each slide", "Escribiendo el texto y diseñando cada tarjeta")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <SlideCarousel slides={result.slides || []} testId="carousel-preview" />
                <Button onClick={downloadAll} disabled={downloadingAll} data-testid="carousel-download-all"
                  className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700">
                  {downloadingAll ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Download className="w-5 h-5 mr-2" />}
                  {T("Download all slides", "Descargar todas las diapositivas")}
                </Button>
                <p className="text-[11px] text-slate-400 text-center">
                  {T("Each slide downloads as a separate image, ready to upload as an Instagram/Facebook carousel.", "Cada diapositiva se descarga como imagen separada, lista para subir como carrusel en Instagram/Facebook.")}
                </p>
                {result.copy?.caption && (
                  <div className="pt-2 border-t border-slate-100">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">{T("Caption", "Descripción")}</Label>
                    <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{result.copy.caption}</p>
                    <p className="text-sm text-blue-600 mt-2">{(result.copy.hashtags || []).join(" ")}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
