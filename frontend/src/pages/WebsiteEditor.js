import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Globe, ExternalLink, Copy, Loader2, Check, CheckCircle2, Palette, Sparkles, Plus, Trash2, ImagePlus, ListChecks, HelpCircle, MapPin, Search, Briefcase, Wand2, Eye, Images, MessageSquare, ArrowUp, ArrowDown, ArrowRight, ChevronDown, Bot, FileText, CalendarClock, Instagram, Star, Users } from "lucide-react";
import { toast } from "sonner";
import { VersionHistory } from "@/components/VersionHistory";
import DomainConnect from "@/components/DomainConnect";
import RichEditor from "@/components/RichEditor";

const TEMPLATES = ["agency", "cinematic", "responder", "bento", "craftsman", "trust", "slider", "onepage", "neon", "playful", "luxe"];
const TPL_SWATCH = { agency: "#0a1130", cinematic: "#0A0A0F", responder: "#DC2626", bento: "#2563EB", craftsman: "#B45309", trust: "#0F766E", slider: "#111827", onepage: "#FAFAFA", neon: "#0A0A0C", playful: "#FF8A3D", luxe: "#141414" };
const SECTION_KEYS = ["services", "about", "feature", "gallery", "samples", "logos", "map", "reviews", "how", "why", "band", "faq", "areas"];
const COLORS = ["#007AFF", "#1D4ED8", "#0EA5E9", "#10B981", "#2F5233", "#F97316", "#FF3B30", "#7C3AED", "#0A0A0A"];
const TABS = ["publish", "design", "content", "services", "agency", "problem", "media", "forms", "sections", "history"];
// Curated color palettes per template — one tap for a pro look.
const PALETTES = {
  agency: ["#22D3EE", "#10B981", "#6366F1", "#F5B301"],
  cinematic: ["#F5B301", "#22D3EE", "#EF4444", "#A855F7"],
  responder: ["#DC2626", "#EA580C", "#2563EB", "#111827"],
  bento: ["#2563EB", "#0EA5E9", "#10B981", "#6366F1"],
  craftsman: ["#B45309", "#2F5233", "#9A3412", "#166534"],
  trust: ["#0F766E", "#1D4ED8", "#0891B2", "#047857"],
  slider: ["#111827", "#DC2626", "#2563EB", "#F59E0B"],
  onepage: ["#111111", "#2563EB", "#B45309", "#0F766E"],
  neon: ["#22D3EE", "#A3E635", "#F472B6", "#818CF8"],
  playful: ["#FB7185", "#F59E0B", "#34D399", "#60A5FA"],
  luxe: ["#C9A227", "#B08D57", "#10B981", "#9CA3AF"],
};
const photoSrc = (id) => `${process.env.REACT_APP_BACKEND_URL}/api/public/card/photo/${id}`;

export default function WebsiteEditor() {
  const { t } = useTranslation();
  const [w, setW] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [stocking, setStocking] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [galUploading, setGalUploading] = useState(false);
  const [baTarget, setBaTarget] = useState(null);
  const [galPicking, setGalPicking] = useState(false);
  const [tab, setTab] = useState("publish");
  const fileRef = useRef(null);
  const galFileRef = useRef(null);
  const baFileRef = useRef(null);
  const publicUrl = w ? `${window.location.origin}/sitio/${w.slug}` : "";
  // While the site is a draft it 404s publicly, so the owner's own "view" links
  // must open in preview mode — otherwise they see "not available" (no template).
  const viewUrl = w && !w.published ? `${publicUrl}?preview=1` : publicUrl;

  useEffect(() => {
    api.get("/website").then(({ data }) => setW(data)).catch(() => toast.error(t("website.loadError")));
    api.get("/photos").then(({ data }) => setPhotos(Array.isArray(data) ? data.filter((p) => p.content_type !== "video/mp4") : [])).catch(() => {});
  }, [t]);

  const patch = (fields) => setW((prev) => ({ ...prev, ...fields }));
  const save = async (override = {}) => {
    setSaving(true);
    try {
      const { data } = await api.put("/website", { ...pick(w), ...override });
      setW(data);
      return data;
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("website.saveError"));
      throw e;
    } finally { setSaving(false); }
  };
  const saveAndToast = async () => { await save(); toast.success(t("website.saved")); };
  const togglePublish = async () => {
    const next = !w.published;
    await save({ published: next });
    toast.success(next ? t("website.publishedToast") : t("website.unpublishedToast"));
  };
  const copy = () => { navigator.clipboard.writeText(publicUrl); setCopied(true); toast.success(t("website.linkCopied")); setTimeout(() => setCopied(false), 2000); };

  const slotState = () => ({
    hero_photo_id: w.hero_photo_id || "",
    why_photo_id: w.why_photo_id || "",
    band_photo_id: w.band_photo_id || "",
    team_photo_id: w.team_photo_id || "",
    about_photo_ids: Array.isArray(w.about_photo_ids) ? w.about_photo_ids : [],
    services: Array.isArray(w.services) ? w.services : [],
  });

  const generate = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post("/website/ai-generate", slotState());
      const ph = data.photos || {};
      patch({
        headline: data.headline || w.headline,
        subheadline: data.subheadline || w.subheadline,
        about: data.about || w.about,
        how_it_works: Array.isArray(data.how_it_works) ? data.how_it_works : w.how_it_works,
        why_us: Array.isArray(data.why_us) ? data.why_us : w.why_us,
        faqs: Array.isArray(data.faqs) ? data.faqs : w.faqs,
        areas: Array.isArray(data.areas) ? data.areas : w.areas,
        seo_title: data.seo_title || w.seo_title,
        seo_description: data.seo_description || w.seo_description,
        // Auto-placed stock photos (from backend) take priority; else AI-suggested services if the site had none.
        services: (Array.isArray(ph.services) && ph.services.length)
          ? ph.services
          : ((Array.isArray(data.services) && data.services.length && (!w.services || w.services.length === 0)) ? data.services : w.services),
        ...(ph.hero_photo_id ? { hero_photo_id: ph.hero_photo_id } : {}),
        ...(ph.why_photo_id ? { why_photo_id: ph.why_photo_id } : {}),
        ...(ph.band_photo_id ? { band_photo_id: ph.band_photo_id } : {}),
        ...(Array.isArray(ph.about_photo_ids) ? { about_photo_ids: ph.about_photo_ids } : {}),
        ...(ph.team_photo_id ? { team_photo_id: ph.team_photo_id } : {}),
      });
      // Refresh the gallery so the new stock photos show up in the pickers.
      api.get("/photos").then(({ data: pl }) => setPhotos(Array.isArray(pl) ? pl.filter((p) => p.content_type !== "video/mp4") : [])).catch(() => {});
      toast.success(t("website.aiDone"));
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("website.aiError"));
    } finally { setGenerating(false); }
  };

  const stockPhotos = async () => {
    setStocking(true);
    try {
      const { data } = await api.post("/website/stock-photos", slotState());
      if (data.website) setW(data.website);
      api.get("/photos").then(({ data: pl }) => setPhotos(Array.isArray(pl) ? pl.filter((p) => p.content_type !== "video/mp4") : [])).catch(() => {});
      if (data.reason === "no_key") toast.error(t("website.stockNoKey"));
      else if (data.filled) toast.success(t("website.stockDone"));
      else toast.info(t("website.stockNone"));
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("website.stockError"));
    } finally { setStocking(false); }
  };

  const translateEs = async () => {
    setTranslating(true);
    try {
      const { data } = await api.post("/website/translate-es");
      setW((prev) => ({ ...prev, content_es: data.content_es, lang_toggle: true }));
      toast.success(t("website.transDone"));
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("website.aiError"));
    } finally { setTranslating(false); }
  };

  const [translatingEn, setTranslatingEn] = useState(false);
  const [localizing, setLocalizing] = useState(false);
  const localizeImages = async () => {
    setLocalizing(true);
    try {
      const { data } = await api.post("/website/localize-images");
      if (data.failed_count > 0) toast.warning(`Guardadas ${data.migrated}. No se pudieron descargar ${data.failed_count} (la fuente ya no existe).`);
      else toast.success(`Listo: ${data.migrated} imágenes guardadas localmente.`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("website.aiError"));
    } finally { setLocalizing(false); }
  };
  const [importingMedia, setImportingMedia] = useState(false);
  const importMedia = async () => {
    setImportingMedia(true);
    try {
      const { data } = await api.post("/website/import-media");
      const r = await api.get("/website");
      setW((prev) => ({ ...prev, ...r.data }));
      toast.success(t("website.mediaCopied", { count: data.copied }));
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("website.aiError"));
    } finally { setImportingMedia(false); }
  };
  const setSecColor = (key, val) => patch({ section_colors: { ...(w?.section_colors || {}), [key]: val } });
  const translateEn = async () => {
    if (!window.confirm(t("website.transEnConfirm"))) return;
    setTranslatingEn(true);
    try {
      const { data } = await api.post("/website/translate-en");
      if (data.website) setW((prev) => ({ ...prev, ...data.website }));
      toast.success(t("website.transEnDone"));
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("website.aiError"));
    } finally { setTranslatingEn(false); }
  };

  const uploadServiceImg = async (i, file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/photos?label=service", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const arr = [...(w.services || [])];
      arr[i] = { ...arr[i], image_id: data.id };
      setW((prev) => ({ ...prev, services: arr }));
      await api.put("/website", { services: arr });  // persist immediately so it survives reloads/deploys
      toast.success(t("website.serviceImgAdded"));
    } catch {
      toast.error(t("website.aiError"));
    }
  };

  const svcPatch = (i, obj) => {
    const arr = [...(w.services || [])];
    arr[i] = { ...arr[i], ...obj };
    patch({ services: arr });
  };
  const addServicePhotos = async (i, files) => {
    const list = Array.from(files || []).slice(0, 8);
    if (!list.length) return;
    try {
      const uploaded = [];
      for (const f of list) {
        const fd = new FormData();
        fd.append("file", f);
        const { data } = await api.post("/photos?label=service", fd, { headers: { "Content-Type": "multipart/form-data" } });
        uploaded.push({ id: data.id, kind: "general" });
      }
      const cur = (w.services[i] && w.services[i].photos) || [];
      const arr = [...(w.services || [])];
      arr[i] = { ...arr[i], photos: [...cur, ...uploaded] };
      setW((prev) => ({ ...prev, services: arr }));
      await api.put("/website", { services: arr });  // persist immediately so it survives reloads/deploys
      toast.success(t("website.serviceImgAdded"));
    } catch {
      toast.error(t("website.aiError"));
    }
  };
  const setServicePhotoKind = async (i, pi, kind) => {
    const photos = [...((w.services[i] && w.services[i].photos) || [])];
    photos[pi] = { ...photos[pi], kind };
    const arr = [...(w.services || [])];
    arr[i] = { ...arr[i], photos };
    setW((prev) => ({ ...prev, services: arr }));
    await api.put("/website", { services: arr });
  };
  const delServicePhoto = async (i, pi) => {
    const photos = ((w.services[i] && w.services[i].photos) || []).filter((_, j) => j !== pi);
    const arr = [...(w.services || [])];
    arr[i] = { ...arr[i], photos };
    setW((prev) => ({ ...prev, services: arr }));
    await api.put("/website", { services: arr });
  };

  // ---- AI content helpers (services suggestions + per-field "write for me") ----
  const [aiField, setAiField] = useState(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [svcSuggesting, setSvcSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  const aiWrite = async (kind, name, fieldKey, applyFn) => {
    if (!name || !name.trim()) { toast.error(t("website.aiNeedName")); return; }
    setAiField(fieldKey);
    try {
      const { data } = await api.post("/website/ai-write", { kind, name });
      if (data.text) applyFn(data.text);
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("website.aiError"));
    } finally { setAiField(null); }
  };

  const suggestServices = async () => {
    setSvcSuggesting(true); setSuggestOpen(true);
    try {
      const { data } = await api.post("/website/ai-suggest-services", {});
      setSuggestions((data.services || []).map((s) => ({ ...s, checked: true })));
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("website.aiError"));
      setSuggestOpen(false);
    } finally { setSvcSuggesting(false); }
  };

  const addSelectedServices = () => {
    const picked = suggestions.filter((s) => s.checked).map((s) => ({ name: s.name, description: s.description || "", starting_price: "" }));
    if (!picked.length) { setSuggestOpen(false); return; }
    patch({ services: [...(w.services || []), ...picked] });
    setSuggestOpen(false); setSuggestions([]);
    toast.success(t("website.servicesAdded"));
  };

  const AiBtn = ({ fieldKey, onClick, label }) => (
    <button type="button" onClick={onClick} disabled={aiField === fieldKey}
      className="flex-none inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
      data-testid={`ai-write-${fieldKey}`}>
      {aiField === fieldKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
      {label || t("website.aiWrite")}
    </button>
  );


  const uploadField = async (field, file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const { data } = await api.post("/photos?label=website", fd, { headers: { "Content-Type": "multipart/form-data" } });
    setPhotos((prev) => [data, ...prev]);
    await save({ [field]: data.id });
    toast.success(t("website.photoAdded"));
  };

  const uploadPhoto = async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    const { data } = await api.post("/photos?label=website", fd, { headers: { "Content-Type": "multipart/form-data" } });
    setPhotos((prev) => [data, ...prev]);
    return data.id;
  };

  const uploadHero = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/photos?label=during", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setPhotos((prev) => [data, ...prev]);
      await save({ hero_photo_id: data.id });
      toast.success(t("website.heroSet"));
    } catch (err) {
      toast.error(t("website.saveError"));
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const suggestDesign = async () => {
    setSuggesting(true);
    try {
      const { data } = await api.post("/website/ai-suggest-design");
      setSuggestion(data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("website.aiError"));
    } finally { setSuggesting(false); }
  };
  const applySuggestion = async () => {
    if (!suggestion) return;
    await save({ template: suggestion.template, accent_color: suggestion.accent_color });
    toast.success(t("website.designApplied"));
    setSuggestion(null);
  };

  const galIds = () => w.gallery_photo_ids || [];
  const inGallery = (id) => galIds().includes(id);
  const toggleGallery = (id) => {
    const ids = galIds();
    patch({ gallery_photo_ids: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] });
  };
  const moveGallery = (idx, dir) => {
    const ids = [...galIds()];
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    patch({ gallery_photo_ids: ids });
  };
  const uploadGalleryPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGalUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/photos?label=website", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setPhotos((prev) => [data, ...prev]);
      patch({ gallery_photo_ids: [...galIds(), data.id] });
      toast.success(t("website.photoAdded"));
    } catch { toast.error(t("website.saveError")); }
    finally { setGalUploading(false); if (galFileRef.current) galFileRef.current.value = ""; }
  };

  const [caps, setCaps] = useState({});
  const [capBusy, setCapBusy] = useState({});
  const photoCaption = (id) => (caps[id] !== undefined ? caps[id] : ((photos.find((p) => p.id === id) || {}).caption || ""));
  const setCap = (id, v) => setCaps((c) => ({ ...c, [id]: v }));
  const saveCaption = async (id) => {
    try {
      const cap = photoCaption(id);
      await api.post(`/photos/${id}/caption`, { caption: cap });
      setPhotos((ps) => ps.map((p) => (p.id === id ? { ...p, caption: cap } : p)));
    } catch { toast.error(t("website.saveError")); }
  };
  const aiCaption = async (id) => {
    const text = photoCaption(id);
    if (!text.trim()) { toast.error(t("website.workCaptionEmpty")); return; }
    setCapBusy((b) => ({ ...b, [id]: true }));
    try {
      const { data } = await api.post(`/photos/caption-ai`, { text });
      setCap(id, data.caption);
      await api.post(`/photos/${id}/caption`, { caption: data.caption });
      setPhotos((ps) => ps.map((p) => (p.id === id ? { ...p, caption: data.caption } : p)));
      toast.success(t("website.workCaptionRefined"));
    } catch { toast.error(t("website.aiError")); }
    finally { setCapBusy((b) => ({ ...b, [id]: false })); }
  };

  const baPairs = () => w.before_after || [];
  const baAdd = () => patch({ before_after: [...baPairs(), { before: "", after: "" }] });
  const baDel = (idx) => patch({ before_after: baPairs().filter((_, i) => i !== idx) });
  const pickBa = (idx, slot) => { setBaTarget({ idx, slot }); baFileRef.current?.click(); };
  const uploadBa = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !baTarget) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/photos?label=website", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setPhotos((prev) => [data, ...prev]);
      const pairs = [...baPairs()];
      pairs[baTarget.idx] = { ...pairs[baTarget.idx], [baTarget.slot]: data.id };
      patch({ before_after: pairs });
    } catch { toast.error(t("website.saveError")); }
    finally { setBaTarget(null); if (baFileRef.current) baFileRef.current.value = ""; }
  };

  if (!w) return <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>;

  // Array helpers
  const listSet = (key, idx, field, val) => {
    const arr = [...(w[key] || [])];
    arr[idx] = { ...arr[idx], [field]: val };
    patch({ [key]: arr });
  };
  const listAdd = (key, item) => patch({ [key]: [...(w[key] || []), item] });
  const listDel = (key, idx) => patch({ [key]: (w[key] || []).filter((_, i) => i !== idx) });
  const areasSet = (idx, val) => { const arr = [...(w.areas || [])]; arr[idx] = val; patch({ areas: arr }); };

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-24" data-testid="website-editor">
      {/* Sticky header: save + section tabs */}
      <div className="sticky top-0 z-30 -mx-1 px-1 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${w.published ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {w.published ? t("website.published") : t("website.draft")}
            </span>
            <a href={viewUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-600 truncate hidden sm:inline">{t("website.viewSite")}</a>
          </div>
          <Button onClick={saveAndToast} disabled={saving} data-testid="website-save-top" className="rounded-xl h-10 bg-emerald-600 hover:bg-emerald-700 font-bold px-5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("website.save")}
          </Button>
        </div>
        <div className="pb-2 overflow-x-auto no-scrollbar">
          <div className="flex gap-1.5 min-w-max">
            {TABS.filter((tb) => tb !== "agency" || w.template === "agency").map((tb) => (
              <button key={tb} onClick={() => setTab(tb)} data-testid={`website-tab-${tb}`}
                className={`px-4 h-9 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${tab === tb ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {t(`website.tab.${tb}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center flex-none"><Globe className="w-5 h-5 text-blue-700" /></div>
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">{t("website.title")}</h1>
          <p className="text-slate-500 text-sm">{t("website.subtitle")}</p>
        </div>
      </div>

      {/* AI Generate */}
      {tab === "content" && (
      <Card className="border-0 shadow-none p-5 bg-gradient-to-br from-violet-600 to-indigo-600 text-white">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-none"><Sparkles className="w-5 h-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-lg">{t("website.aiTitle")}</div>
            <p className="text-sm text-white/85 mt-0.5">{t("website.aiDesc")}</p>
            <div className="mb-3">
              <div className="text-xs font-semibold text-white/90 mb-1.5">{t("website.briefLabel")}</div>
              <textarea value={w.ai_brief || ""} onChange={(e) => patch({ ai_brief: e.target.value })} onBlur={() => save(pick(w))} placeholder={t("website.briefPh")} data-testid="website-ai-brief"
                className="w-full min-h-[110px] p-4 rounded-xl bg-white/15 border border-white/30 text-white placeholder-white/50 outline-none focus:bg-white/20 text-sm" />
            </div>
            <div className="mt-4 mb-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-white/90 mb-1.5"><Instagram className="w-4 h-4" /> {t("website.igLabel")}</div>
              <input value={w.instagram_url || ""} onChange={(e) => patch({ instagram_url: e.target.value })} onBlur={() => save(pick(w))} placeholder="https://instagram.com/negocio" data-testid="website-instagram-url"
                className="w-full h-11 px-4 rounded-xl bg-white/15 border border-white/30 text-white placeholder-white/50 outline-none focus:bg-white/20 text-sm" />
              <p className="text-[11px] text-white/70 mt-1">{t("website.igHint")}</p>
            </div>
            <Button onClick={generate} disabled={generating} data-testid="website-ai-generate"
              className="mt-1 rounded-xl h-12 bg-white text-indigo-700 hover:bg-white/90 font-bold w-full sm:w-auto">
              {generating ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("website.aiWorking")}</> : <><Sparkles className="w-4 h-4 mr-2" /> {t("website.aiBtn")}</>}
            </Button>
            <div className="mt-3">
              <Button onClick={stockPhotos} disabled={stocking} variant="outline" data-testid="website-stock-photos"
                className="rounded-xl h-10 bg-white/10 border-white/40 text-white hover:bg-white/20 font-bold text-sm w-full sm:w-auto">
                {stocking ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("website.stockWorking")}</> : <><ImagePlus className="w-4 h-4 mr-2" /> {t("website.stockBtn")}</>}
              </Button>
              <p className="text-[11px] text-white/70 mt-1">{t("website.stockHint")}</p>
            </div>
            <div className="mt-3 pt-3 border-t border-white/20">
              <p className="text-xs text-white/80 mb-2">{t("website.transDesc")}</p>
              <Button onClick={translateEs} disabled={translating} variant="outline" data-testid="website-translate-es"
                className="rounded-xl h-10 bg-white/10 border-white/40 text-white hover:bg-white/20 font-bold text-sm w-full sm:w-auto">
                {translating ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("website.transWorking")}</> : <>🌐 {t("website.transBtn")}{w?.content_es ? " ✓" : ""}</>}
              </Button>
              <Button onClick={translateEn} disabled={translatingEn} variant="outline" data-testid="website-translate-en"
                className="rounded-xl h-10 bg-white/10 border-white/40 text-white hover:bg-white/20 font-bold text-sm w-full sm:w-auto sm:ml-2 mt-2 sm:mt-0">
                {translatingEn ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("website.transWorking")}</> : <>🇺🇸 {t("website.transEnBtn")}</>}
              </Button>
              <Button onClick={localizeImages} disabled={localizing} variant="outline" data-testid="website-localize-images"
                className="rounded-xl h-10 bg-white/10 border-white/40 text-white hover:bg-white/20 font-bold text-sm w-full sm:w-auto sm:ml-2 mt-2 sm:mt-0">
                {localizing ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Guardando imágenes…</> : <>💾 Guardar imágenes localmente</>}
              </Button>
            </div>
          </div>
        </div>
      </Card>
      )}

      {/* Publish + link */}
      {tab === "publish" && (
      <Card className="card-elevated border-0 shadow-none p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold flex items-center gap-2">{t("website.status")}
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${w.published ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {w.published ? t("website.published") : t("website.draft")}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{w.published ? t("website.publishedDesc") : t("website.draftDesc")}</p>
          </div>
          <Switch checked={w.published} onCheckedChange={togglePublish} data-testid="website-publish" />
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className="flex-1 min-w-0 flex items-center gap-2 h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-600 truncate">
            <Globe className="w-4 h-4 flex-none text-slate-400" /><span className="truncate" data-testid="website-url">{publicUrl}</span>
          </div>
          <Button variant="outline" onClick={copy} className="rounded-xl h-11 flex-none" data-testid="website-copy">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</Button>
          <a href={viewUrl} target="_blank" rel="noreferrer"><Button variant="outline" className="rounded-xl h-11 flex-none"><ExternalLink className="w-4 h-4" /></Button></a>
        </div>
        <div className="mt-3">
          <Label>{t("website.customLink")}</Label>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-sm text-slate-400">/sitio/</span>
            <Input value={w.slug} onChange={(e) => patch({ slug: e.target.value })} onBlur={saveAndToast} className="h-11 rounded-xl" data-testid="website-slug" />
          </div>
        </div>
      </Card>
      )}

      {/* Templates */}
      {tab === "design" && (<>
      {w.template === "agency" && (
      <Card className="card-elevated border-0 shadow-none p-5" data-testid="agency-colors-card">
        <div className="font-semibold mb-1">{t("website.secColors")}</div>
        <p className="text-sm text-slate-500 mb-3">{t("website.secColorsDesc")}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[["hero","#0a1130"],["services","#ffffff"],["samples","#f8fafc"],["logos","#ffffff"],["map","#f8fafc"],["process","#0a1130"],["reviews","#f8fafc"],["cta",(w.accent_color||"#22D3EE")],["faq","#f8fafc"],["contact","#ffffff"],["footer","#0a1130"]].map(([key,def]) => (
            <div key={key} className="flex items-center gap-2">
              <input type="color" value={(w.section_colors && w.section_colors[key]) || def} onChange={(e) => setSecColor(key, e.target.value)} className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer flex-none p-0.5" data-testid={`seccolor-${key}`} />
              <span className="text-sm capitalize">{t(`website.sec.${key === "process" ? "how" : key}`) || key}</span>
            </div>
          ))}
        </div>
      </Card>
      )}
      <Card className="card-elevated border-0 shadow-none p-5" data-testid="import-media-card">
        <div className="font-semibold mb-1">{t("website.copyImages")}</div>
        <p className="text-sm text-slate-500 mb-3">{t("website.copyImagesDesc")}</p>
        <Button onClick={importMedia} disabled={importingMedia} variant="outline" className="rounded-xl h-10 font-bold" data-testid="import-media-btn">
          {importingMedia ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("website.copyingImages")}</> : <><Images className="w-4 h-4 mr-2" /> {t("website.copyImages")}</>}
        </Button>
      </Card>
      <Card className="card-elevated border-0 shadow-none p-5">
        <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
          <div className="font-semibold">{t("website.template")}</div>
          <div className="flex items-center gap-2">
            <a href={viewUrl} target="_blank" rel="noreferrer"><Button variant="outline" size="sm" className="rounded-xl h-9" data-testid="website-view-site"><Eye className="w-4 h-4 mr-1.5" /> {t("website.viewSite")}</Button></a>
            <a href={`${publicUrl}?preview=1`} target="_blank" rel="noreferrer"><Button variant="outline" size="sm" className="rounded-xl h-9" data-testid="website-preview">{t("website.preview")}</Button></a>
            <Button onClick={saveAndToast} disabled={saving} size="sm" className="rounded-xl h-9 bg-emerald-600 hover:bg-emerald-700 font-bold" data-testid="website-save-templates">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("website.save")}</Button>
          </div>
        </div>
        {/* AI design suggestion */}
        <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 p-3">
          {!suggestion ? (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm text-violet-900">{t("website.suggestDesc")}</div>
              <Button onClick={suggestDesign} disabled={suggesting} size="sm" data-testid="website-suggest-design" className="rounded-xl h-9 bg-violet-600 hover:bg-violet-700">
                {suggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Wand2 className="w-4 h-4 mr-1.5" /> {t("website.suggestBtn")}</>}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 flex-wrap" data-testid="website-suggestion">
              <div className="flex items-center gap-2 text-sm text-violet-900">
                <span className="w-5 h-5 rounded-full flex-none" style={{ background: suggestion.accent_color }} />
                <span><b>{t(`website.tpl.${suggestion.template}Name`)}</b>{suggestion.reason ? ` — ${suggestion.reason}` : ""}</span>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setSuggestion(null)} variant="ghost" size="sm" className="rounded-xl h-9">{t("website.dismiss")}</Button>
                <Button onClick={applySuggestion} size="sm" data-testid="website-apply-suggestion" className="rounded-xl h-9 bg-violet-600 hover:bg-violet-700">{t("website.applyDesign")}</Button>
              </div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {TEMPLATES.map((key) => (
            <button key={key} onClick={() => save({ template: key })} data-testid={`website-tpl-${key}`}
              className={`text-left rounded-2xl border-2 overflow-hidden transition-all ${w.template === key ? "border-blue-600 ring-2 ring-blue-100" : "border-slate-200 hover:border-slate-300"}`}>
              <TemplateThumb kind={key} accent={w.accent_color || "#2563EB"} />
              <div className="p-3">
                <div className="font-bold text-sm flex items-center gap-1.5">{t(`website.tpl.${key}Name`)}{w.template === key && <Check className="w-3.5 h-3.5 text-blue-600" />}</div>
                <div className="text-xs text-slate-500">{t(`website.tpl.${key}Desc`)}</div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Brand color */}
      <Card className="card-elevated border-0 shadow-none p-5">
        <div className="font-semibold mb-3 flex items-center gap-2"><Palette className="w-4 h-4" /> {t("website.brandColor")}</div>
        {PALETTES[w.template] && (
          <div className="mb-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t("website.paletteRecommended")}</div>
            <div className="flex flex-wrap gap-2">
              {PALETTES[w.template].map((c) => (
                <button key={c} onClick={() => save({ accent_color: c })} data-testid={`website-palette-${c}`}
                  className={`h-10 px-4 rounded-xl flex items-center gap-2 border-2 transition-transform hover:-translate-y-0.5 ${w.accent_color?.toLowerCase() === c.toLowerCase() ? "ring-2 ring-offset-2 ring-slate-800" : "border-transparent"}`}
                  style={{ background: c }}>
                  {w.accent_color?.toLowerCase() === c.toLowerCase() && <Check className="w-4 h-4 text-white" />}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t("website.paletteAll")}</div>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button key={c} onClick={() => save({ accent_color: c })} data-testid={`website-color-${c}`}
              className={`w-9 h-9 rounded-full border-2 transition-transform ${w.accent_color?.toLowerCase() === c.toLowerCase() ? "ring-2 ring-offset-2 ring-slate-800 scale-110" : "border-white"}`}
              style={{ background: c }} aria-label={c} />
          ))}
        </div>
      </Card>
      </>)}

      {/* Hero photo */}
      {tab === "media" && (<>
      <PhotoField label={t("website.heroPhoto")} desc={t("website.heroPhotoDesc")} value={w.hero_photo_id} photos={photos} onPick={(id) => save({ hero_photo_id: id })} onUpload={(f) => uploadField("hero_photo_id", f)} onRemove={() => save({ hero_photo_id: "" })} testid="hero" t={t} />

      <PhotoMultiField label={t("website.teamPhotoTitle")} desc={t("website.teamPhotoDesc")} values={(w.about_photo_ids && w.about_photo_ids.length) ? w.about_photo_ids : (w.team_photo_id ? [w.team_photo_id] : [])} photos={photos} onChange={(ids) => save({ about_photo_ids: ids, team_photo_id: ids[0] || "" })} onUpload={uploadPhoto} testid="about" t={t} max={4} />
      <PhotoField label={t("website.whyPhotoTitle")} desc={t("website.whyPhotoDesc")} value={w.why_photo_id} photos={photos} onPick={(id) => save({ why_photo_id: id })} onUpload={(f) => uploadField("why_photo_id", f)} onRemove={() => save({ why_photo_id: "" })} testid="why-photo" t={t} />
      <PhotoField label={t("website.bandPhotoTitle")} desc={t("website.bandPhotoDesc")} value={w.band_photo_id} photos={photos} onPick={(id) => save({ band_photo_id: id })} onUpload={(f) => uploadField("band_photo_id", f)} onRemove={() => save({ band_photo_id: "" })} testid="band" t={t} />

      {/* Gallery editor (Recent Work) */}
      <Card className="card-elevated border-0 shadow-none p-5">
        <div className="font-semibold mb-1 flex items-center gap-2"><Images className="w-4 h-4" /> {t("website.galleryTitle")}</div>
        <p className="text-sm text-slate-500 mb-3">{t("website.galleryDesc")}</p>
        <input ref={galFileRef} type="file" accept="image/*" className="hidden" onChange={uploadGalleryPhoto} data-testid="website-gallery-upload-input" />
        {/* Selected & ordered */}
        {galIds().length > 0 && (
          <div className="space-y-2 mb-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t("website.galleryShown")}</div>
            {galIds().map((id, idx) => (
              <div key={id} className="p-2 rounded-xl bg-slate-50 space-y-2" data-testid={`website-gallery-item-${idx}`}>
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center flex-none">{idx + 1}</span>
                  <img src={photoSrc(id)} alt="" className="w-12 h-12 rounded-lg object-cover flex-none" />
                  <div className="flex-1" />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveGallery(idx, -1)} disabled={idx === 0} data-testid={`website-gallery-up-${idx}`}><ArrowUp className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveGallery(idx, 1)} disabled={idx === galIds().length - 1} data-testid={`website-gallery-down-${idx}`}><ArrowDown className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={() => toggleGallery(id)} data-testid={`website-gallery-remove-${idx}`}><Trash2 className="w-4 h-4" /></Button>
                </div>
                <div className="flex items-start gap-2">
                  <textarea value={photoCaption(id)} onChange={(e) => setCap(id, e.target.value)} onBlur={() => saveCaption(id)} rows={2}
                    placeholder={t("website.workCaptionPh")} className="flex-1 text-sm rounded-lg border border-slate-200 bg-white px-3 py-2 resize-none focus:outline-none focus:border-slate-400" data-testid={`website-gallery-caption-${idx}`} />
                  <Button variant="outline" size="sm" onClick={() => aiCaption(id)} disabled={capBusy[id]} className="rounded-lg flex-none h-9 mt-0.5" data-testid={`website-gallery-caption-ai-${idx}`}>
                    {capBusy[id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-1" /> {t("website.workCaptionAi")}</>}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Picker: choose from folder or upload — hidden until requested */}
        <Button variant="outline" onClick={() => setGalPicking((v) => !v)} className="rounded-xl" data-testid="website-gallery-add-toggle">
          <Plus className="w-4 h-4 mr-1" /> {galPicking ? t("website.done") : t("website.galleryAddBtn")}
        </Button>
        {galPicking && (
          <div className="mt-3 p-3 rounded-xl bg-slate-50">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t("website.galleryAdd")}</div>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => galFileRef.current?.click()} disabled={galUploading} data-testid="website-gallery-upload"
                className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-slate-400 flex-none">
                {galUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /><span className="text-[10px] mt-0.5">{t("website.upload")}</span></>}
              </button>
              {photos.map((p) => (
                <button key={p.id} onClick={() => toggleGallery(p.id)} data-testid={`website-gallery-pick-${p.id}`}
                  className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 flex-none transition-all ${inGallery(p.id) ? "border-blue-600 ring-2 ring-blue-200" : "border-transparent hover:border-slate-300"}`}>
                  <img src={photoSrc(p.id)} alt="" className="w-full h-full object-cover" />
                  {inGallery(p.id) && <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center"><Check className="w-3 h-3" /></span>}
                </button>
              ))}
            </div>
            {photos.length === 0 && <p className="text-xs text-slate-400 mt-2">{t("website.noPhotos")}</p>}
          </div>
        )}
        <p className="text-xs text-slate-400 mt-3">{t("website.galleryHint")}</p>
      </Card>

      {/* Before / After pairs (for the "Before/After" template) */}
      <Card className="card-elevated border-0 shadow-none p-5">
        <div className="font-semibold mb-1 flex items-center gap-2"><Images className="w-4 h-4" /> {t("website.baTitle")}</div>
        <p className="text-sm text-slate-500 mb-3">{t("website.baDesc")}</p>
        <input ref={baFileRef} type="file" accept="image/*" className="hidden" onChange={uploadBa} data-testid="website-ba-upload-input" />
        <div className="space-y-3">
          {baPairs().map((p, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50" data-testid={`website-ba-pair-${i}`}>
              <BaSlot label={t("website.baBefore")} id={p.before} onClick={() => pickBa(i, "before")} testid={`website-ba-before-${i}`} />
              <ArrowRight className="w-5 h-5 text-slate-400 flex-none" />
              <BaSlot label={t("website.baAfter")} id={p.after} onClick={() => pickBa(i, "after")} testid={`website-ba-after-${i}`} />
              <div className="flex-1" />
              <Button variant="ghost" size="icon" onClick={() => baDel(i)} className="text-slate-400 flex-none" data-testid={`website-ba-del-${i}`}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </div>
        <Button variant="outline" onClick={baAdd} className="rounded-xl mt-3" data-testid="website-ba-add"><Plus className="w-4 h-4 mr-1" /> {t("website.baAdd")}</Button>
      </Card>
      </>)}

      {tab === "problem" && <ProblemPagesPanel slug={w.slug} />}

      {tab === "agency" && <AgencyPanel w={w} save={save} patch={patch} photos={photos} onUpload={uploadPhoto} t={t} />}

      {tab === "history" && <VersionHistory />}

      {/* Forms, Booking & AI Chat — decide what visitors can do on your site */}
      {tab === "forms" && (
      <Card className="card-elevated border-0 shadow-none p-5">
        <div className="font-semibold mb-1">{t("website.formsTitle")}</div>
        <p className="text-sm text-slate-500 mb-4">{t("website.formsDesc")}</p>

        {/* Contact / quote form */}
        <div className="flex items-center justify-between gap-4 py-3 border-t border-slate-100">
          <div className="flex items-start gap-2">
            <FileText className="w-5 h-5 text-slate-700 flex-none mt-0.5" />
            <div>
              <div className="font-semibold text-sm">{t("website.formContact")}</div>
              <p className="text-sm text-slate-500 mt-0.5">{t("website.formContactDesc")}</p>
            </div>
          </div>
          <Switch checked={w.sections?.contact !== false} data-testid="website-form-contact"
            onCheckedChange={(v) => save({ sections: { ...w.sections, contact: v } })} />
        </div>

        {/* Appointment booking */}
        <div className="py-3 border-t border-slate-100">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-2">
              <CalendarClock className="w-5 h-5 text-slate-700 flex-none mt-0.5" />
              <div>
                <div className="font-semibold text-sm">{t("website.formBooking")}</div>
                <p className="text-sm text-slate-500 mt-0.5">{t("website.formBookingDesc")}</p>
              </div>
            </div>
            <Switch checked={w.sections?.booking !== false} data-testid="website-form-booking"
              onCheckedChange={(v) => save({ sections: { ...w.sections, booking: v } })} />
          </div>
          {w.sections?.booking !== false && (
            <a href="/tarjeta" className="mt-2 ml-7 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5" data-testid="website-booking-hint">
              <HelpCircle className="w-3.5 h-3.5" /> {t("website.formBookingHint")}
            </a>
          )}
        </div>

        {/* AI chat bot */}
        <div className="py-3 border-t border-slate-100">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-2">
              <Bot className="w-5 h-5 text-slate-700 flex-none mt-0.5" />
              <div>
                <div className="font-semibold text-sm">{t("website.chatTitle")}</div>
                <p className="text-sm text-slate-500 mt-0.5">{t("website.chatDesc")}</p>
              </div>
            </div>
            <Switch checked={!!w.chat_enabled} onCheckedChange={(v) => save({ chat_enabled: v })} data-testid="website-chat-toggle" />
          </div>
          {w.chat_enabled && (
            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              <div>
                <Label>{t("website.chatLauncher")}</Label>
                <Input value={w.chat_launcher || ""} onChange={(e) => patch({ chat_launcher: e.target.value })} onBlur={saveAndToast} className="h-11 rounded-xl mt-1.5" placeholder={t("website.chatLauncherPh")} data-testid="website-chat-launcher" />
              </div>
              <div>
                <Label>{t("website.chatPosition")}</Label>
                <div className="flex gap-2 mt-1.5">
                  {["right", "left"].map((p) => (
                    <button key={p} onClick={() => save({ chat_position: p })} data-testid={`website-chat-pos-${p}`}
                      className={`flex-1 h-11 rounded-xl border-2 text-sm font-semibold ${(w.chat_position || "right") === p ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500"}`}>
                      {t(`website.pos_${p}`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <a href="/sitio-web" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600" data-testid="website-embed-link"><MessageSquare className="w-4 h-4" /> {t("website.embedLink")}</a>
      </Card>
      )}

      {/* Custom Domains — two slots: primary (EN) + secondary (ES), one site */}
      {tab === "publish" && (
      <div className="space-y-4" data-testid="website-domains">
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
          {t("website.domainsBilingualNote")}
        </div>
        <DomainConnect slot={1} published={!!w.published} badge={t("website.domainBadgeEn")} />
        <DomainConnect slot={2} published={!!w.published} badge={t("website.domainBadgeEs")} />
      </div>
      )}

      {/* Content */}
      {tab === "content" && (
      <Card className="card-elevated border-0 shadow-none p-5 space-y-4">
        <div className="font-semibold">{t("website.heroContent")}</div>
        <div>
          <Label>{t("website.headline")}</Label>
          <Input value={w.headline || ""} onChange={(e) => patch({ headline: e.target.value })} className="h-12 rounded-xl mt-1.5" data-testid="website-headline" placeholder={t("website.headlinePh")} />
        </div>
        <div>
          <Label>{t("website.subheadline")}</Label>
          <Input value={w.subheadline || ""} onChange={(e) => patch({ subheadline: e.target.value })} className="h-12 rounded-xl mt-1.5" data-testid="website-subheadline" />
        </div>
        <div>
          <Label>{t("website.aboutUs")}</Label>
          <Textarea value={w.about || ""} onChange={(e) => patch({ about: e.target.value })} className="rounded-xl mt-1.5 min-h-[90px]" data-testid="website-about" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>{t("website.serviceArea")}</Label><Input value={w.service_area || ""} onChange={(e) => patch({ service_area: e.target.value })} className="h-12 rounded-xl mt-1.5" placeholder={t("website.serviceAreaPh")} /></div>
          <div><Label>{t("website.hours")}</Label><Input value={w.hours || ""} onChange={(e) => patch({ hours: e.target.value })} className="h-12 rounded-xl mt-1.5" placeholder={t("website.hoursPh")} /></div>
        </div>
        <div><Label>{t("website.callPhone")}</Label><Input value={w.cta_phone || ""} onChange={(e) => patch({ cta_phone: e.target.value })} className="h-12 rounded-xl mt-1.5" /></div>
      </Card>
      )}

      {/* Services */}
      {tab === "services" && (
      <Card className="card-elevated border-0 shadow-none p-5 space-y-3">
        <div className="font-semibold flex items-center gap-2"><Briefcase className="w-4 h-4" /> {t("website.servicesTitle")}</div>
        <p className="text-sm text-slate-500 -mt-1">{t("website.servicesDesc")}</p>

        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-sm text-slate-600">{t("website.suggestServicesHint")}</div>
            <Button onClick={suggestServices} disabled={svcSuggesting} size="sm" className="rounded-lg bg-indigo-600 hover:bg-indigo-700" data-testid="website-suggest-services">
              {svcSuggesting ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> {t("website.suggesting")}</> : <><Sparkles className="w-4 h-4 mr-1.5" /> {t("website.suggestServices")}</>}
            </Button>
          </div>
          {suggestOpen && suggestions.length > 0 && (
            <div className="mt-3 space-y-1.5" data-testid="website-suggestions-panel">
              {suggestions.map((s, i) => (
                <label key={i} className="flex items-start gap-2.5 p-2 rounded-lg bg-white cursor-pointer hover:bg-slate-50" data-testid={`website-suggestion-${i}`}>
                  <input type="checkbox" checked={s.checked} onChange={(e) => setSuggestions((prev) => prev.map((x, j) => j === i ? { ...x, checked: e.target.checked } : x))} className="mt-1 h-4 w-4 accent-indigo-600" data-testid={`website-suggestion-check-${i}`} />
                  <span className="min-w-0"><span className="font-semibold text-sm block">{s.name}</span>{s.description && <span className="text-xs text-slate-500">{s.description}</span>}</span>
                </label>
              ))}
              <div className="flex gap-2 pt-1">
                <Button onClick={addSelectedServices} size="sm" className="rounded-lg bg-emerald-600 hover:bg-emerald-700" data-testid="website-add-selected-services"><Plus className="w-4 h-4 mr-1" /> {t("website.addSelected")}</Button>
                <Button onClick={() => { setSuggestOpen(false); setSuggestions([]); }} size="sm" variant="ghost" className="rounded-lg" data-testid="website-suggestions-cancel">{t("common.cancel") || "Cancel"}</Button>
              </div>
            </div>
          )}
        </div>

        {(w.services || []).map((s, i) => (
          <div key={i} className="p-3 rounded-xl bg-slate-50 space-y-2" data-testid={`website-service-${i}`}>
            <div className="flex items-center gap-2">
              <Input value={s.name || ""} onChange={(e) => listSet("services", i, "name", e.target.value)} className="h-11 rounded-lg bg-white font-semibold" placeholder={t("website.serviceName")} />
              <Button variant="ghost" size="icon" onClick={() => listDel("services", i)} className="text-slate-400 flex-none" data-testid={`website-service-del-${i}`}><Trash2 className="w-4 h-4" /></Button>
            </div>
            <Textarea value={s.description || ""} onChange={(e) => listSet("services", i, "description", e.target.value)} className="rounded-lg bg-white min-h-[56px]" placeholder={t("website.serviceDesc")} />
            <div className="flex justify-end -mt-1">
              <AiBtn fieldKey={`service-${i}`} onClick={() => aiWrite("service_desc", s.name, `service-${i}`, (txt) => listSet("services", i, "description", txt))} />
            </div>
            <Input value={s.starting_price || ""} onChange={(e) => listSet("services", i, "starting_price", e.target.value)} className="h-11 rounded-lg bg-white" placeholder={t("website.servicePrice")} />
            <div className="flex items-center gap-2">
              {s.image_id && <img src={`${process.env.REACT_APP_BACKEND_URL}/api/public/card/photo/${s.image_id}`} alt="" className="w-12 h-12 rounded-lg object-cover flex-none" />}
              <label className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 cursor-pointer" data-testid={`website-service-img-${i}`}>
                <ImagePlus className="w-4 h-4" /> {s.image_id ? t("website.changePhoto") : t("website.addPhoto")}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadServiceImg(i, e.target.files?.[0])} />
              </label>
              {s.image_id && <button onClick={async () => { const arr=[...(w.services||[])]; arr[i]={...arr[i], image_id:""}; setW((prev)=>({...prev, services:arr})); await api.put("/website", { services: arr }); }} className="text-xs text-slate-400 ml-auto" data-testid={`website-service-img-del-${i}`}>{t("website.removePhoto")}</button>}
            </div>
            {/* Work photos for THIS service (used on its Conversion Page proof section) */}
            <div className="pt-2 border-t border-slate-200/70">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500">{t("website.workPhotos")}</span>
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 cursor-pointer" data-testid={`website-service-photos-add-${i}`}>
                  <ImagePlus className="w-3.5 h-3.5" /> {t("website.addWorkPhotos")}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addServicePhotos(i, e.target.files)} />
                </label>
              </div>
              {(s.photos || []).length > 0 && (
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid={`website-service-photos-${i}`}>
                  {s.photos.map((ph, pi) => (
                    <div key={ph.id || pi} className="rounded-lg bg-white border border-slate-200 p-1.5 space-y-1">
                      <img src={`${process.env.REACT_APP_BACKEND_URL}/api/public/card/photo/${ph.id}?w=300`} alt="" className="w-full h-20 rounded object-cover" />
                      <div className="flex items-center gap-1">
                        <select value={ph.kind || "general"} onChange={(e) => setServicePhotoKind(i, pi, e.target.value)} className="text-[11px] rounded border border-slate-200 bg-white px-1 py-0.5 flex-1" data-testid={`website-service-photo-kind-${i}-${pi}`}>
                          <option value="general">{t("website.photoKind.general")}</option>
                          <option value="before">{t("website.photoKind.before")}</option>
                          <option value="after">{t("website.photoKind.after")}</option>
                          <option value="completed">{t("website.photoKind.completed")}</option>
                        </select>
                        <button onClick={() => delServicePhoto(i, pi)} className="text-slate-400 hover:text-red-500" data-testid={`website-service-photo-del-${i}-${pi}`}><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <Button variant="outline" onClick={() => listAdd("services", { name: "", description: "", starting_price: "" })} className="rounded-xl" data-testid="website-service-add"><Plus className="w-4 h-4 mr-1" /> {t("website.addService")}</Button>
      </Card>
      )}

      {/* How It Works */}
      {tab === "content" && (<>
      <Card className="card-elevated border-0 shadow-none p-5 space-y-3">
        <div className="font-semibold flex items-center gap-2"><ListChecks className="w-4 h-4" /> {t("website.howTitle")}</div>
        {(w.how_it_works || []).map((s, i) => (
          <div key={i} className="p-3 rounded-xl bg-slate-50 space-y-2" data-testid={`website-how-${i}`}>
            <div className="flex items-center gap-2">
              <Input value={s.title || ""} onChange={(e) => listSet("how_it_works", i, "title", e.target.value)} className="h-11 rounded-lg bg-white" placeholder={t("website.stepTitle")} />
              <Button variant="ghost" size="icon" onClick={() => listDel("how_it_works", i)} className="text-slate-400 flex-none" data-testid={`website-how-del-${i}`}><Trash2 className="w-4 h-4" /></Button>
            </div>
            <Textarea value={s.desc || ""} onChange={(e) => listSet("how_it_works", i, "desc", e.target.value)} className="rounded-lg bg-white min-h-[60px]" placeholder={t("website.stepDesc")} />
            <div className="flex justify-end -mt-1">
              <AiBtn fieldKey={`how-${i}`} onClick={() => aiWrite("how_desc", s.title, `how-${i}`, (txt) => listSet("how_it_works", i, "desc", txt))} />
            </div>
          </div>
        ))}
        <Button variant="outline" onClick={() => listAdd("how_it_works", { title: "", desc: "" })} className="rounded-xl" data-testid="website-how-add"><Plus className="w-4 h-4 mr-1" /> {t("website.addStep")}</Button>
      </Card>

      {/* Why Us */}
      <Card className="card-elevated border-0 shadow-none p-5 space-y-3">
        <div className="font-semibold flex items-center gap-2"><Check className="w-4 h-4" /> {t("website.whyTitle")}</div>
        {(w.why_us || []).map((s, i) => (
          <div key={i} className="p-3 rounded-xl bg-slate-50 space-y-2" data-testid={`website-why-${i}`}>
            <div className="flex items-center gap-2">
              <Input value={s.title || ""} onChange={(e) => listSet("why_us", i, "title", e.target.value)} className="h-11 rounded-lg bg-white" placeholder={t("website.whyItemTitle")} />
              <Button variant="ghost" size="icon" onClick={() => listDel("why_us", i)} className="text-slate-400 flex-none" data-testid={`website-why-del-${i}`}><Trash2 className="w-4 h-4" /></Button>
            </div>
            <Input value={s.desc || ""} onChange={(e) => listSet("why_us", i, "desc", e.target.value)} className="h-11 rounded-lg bg-white" placeholder={t("website.whyItemDesc")} />
            <div className="flex justify-end">
              <AiBtn fieldKey={`why-${i}`} onClick={() => aiWrite("why_desc", s.title, `why-${i}`, (txt) => listSet("why_us", i, "desc", txt))} />
            </div>
          </div>
        ))}
        <Button variant="outline" onClick={() => listAdd("why_us", { title: "", desc: "" })} className="rounded-xl" data-testid="website-why-add"><Plus className="w-4 h-4 mr-1" /> {t("website.addReason")}</Button>
      </Card>

      {/* FAQ */}
      <Card className="card-elevated border-0 shadow-none p-5 space-y-3">
        <div className="font-semibold flex items-center gap-2"><HelpCircle className="w-4 h-4" /> {t("website.faqTitle")}</div>
        {(w.faqs || []).map((f, i) => (
          <div key={i} className="p-3 rounded-xl bg-slate-50 space-y-2" data-testid={`website-faq-${i}`}>
            <div className="flex items-center gap-2">
              <Input value={f.q || ""} onChange={(e) => listSet("faqs", i, "q", e.target.value)} className="h-11 rounded-lg bg-white" placeholder={t("website.faqQ")} />
              <Button variant="ghost" size="icon" onClick={() => listDel("faqs", i)} className="text-slate-400 flex-none" data-testid={`website-faq-del-${i}`}><Trash2 className="w-4 h-4" /></Button>
            </div>
            <Textarea value={f.a || ""} onChange={(e) => listSet("faqs", i, "a", e.target.value)} className="rounded-lg bg-white min-h-[60px]" placeholder={t("website.faqA")} />
            <div className="flex justify-end -mt-1">
              <AiBtn fieldKey={`faq-${i}`} onClick={() => aiWrite("faq_answer", f.q, `faq-${i}`, (txt) => listSet("faqs", i, "a", txt))} />
            </div>
          </div>
        ))}
        <Button variant="outline" onClick={() => listAdd("faqs", { q: "", a: "" })} className="rounded-xl" data-testid="website-faq-add"><Plus className="w-4 h-4 mr-1" /> {t("website.addFaq")}</Button>
      </Card>

      {/* Areas We Serve */}
      <Card className="card-elevated border-0 shadow-none p-5 space-y-3">
        <div className="font-semibold flex items-center gap-2"><MapPin className="w-4 h-4" /> {t("website.areasTitle")}</div>
        <p className="text-sm text-slate-500">{t("website.areasDesc")}</p>
        <div className="space-y-2">
          {(w.areas || []).map((a, i) => (
            <div key={i} className="flex items-center gap-2" data-testid={`website-area-${i}`}>
              <Input value={a} onChange={(e) => areasSet(i, e.target.value)} className="h-11 rounded-lg" placeholder={t("website.areaPh")} />
              <Button variant="ghost" size="icon" onClick={() => listDel("areas", i)} className="text-slate-400 flex-none" data-testid={`website-area-del-${i}`}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </div>
        <Button variant="outline" onClick={() => patch({ areas: [...(w.areas || []), ""] })} className="rounded-xl" data-testid="website-area-add"><Plus className="w-4 h-4 mr-1" /> {t("website.addArea")}</Button>
      </Card>

      {/* SEO */}
      <Card className="card-elevated border-0 shadow-none p-5 space-y-4">
        <div className="font-semibold flex items-center gap-2"><Search className="w-4 h-4" /> {t("website.seoTitle")}</div>
        <p className="text-sm text-slate-500 -mt-2">{t("website.seoDesc")}</p>
        <div>
          <Label>{t("website.seoPageTitle")}</Label>
          <Input value={w.seo_title || ""} onChange={(e) => patch({ seo_title: e.target.value })} className="h-12 rounded-xl mt-1.5" data-testid="website-seo-title" placeholder={t("website.seoPageTitlePh")} />
        </div>
        <div>
          <Label>{t("website.seoMetaDesc")}</Label>
          <Textarea value={w.seo_description || ""} onChange={(e) => patch({ seo_description: e.target.value })} className="rounded-xl mt-1.5 min-h-[70px]" data-testid="website-seo-desc" placeholder={t("website.seoMetaDescPh")} />
        </div>
      </Card>

      {/* Save all content */}
      <Button onClick={saveAndToast} disabled={saving} className="rounded-xl h-13 py-3 bg-emerald-600 hover:bg-emerald-700 w-full text-base font-bold" data-testid="website-save-content">
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : t("website.saveContent")}
      </Button>
      </>)}

      {/* Sections */}
      {tab === "sections" && (
      <Card className="card-elevated border-0 shadow-none p-5">
        <div className="font-semibold mb-1">{t("website.sections")}</div>
        <p className="text-sm text-slate-500 mb-3">{t("website.sectionsDesc")}</p>
        <div className="space-y-1">
          {SECTION_KEYS.map((key) => (
            <div key={key} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
              <span className="text-sm">{t(`website.sec.${key}`)}</span>
              <Switch checked={w.sections?.[key] !== false} data-testid={`website-section-${key}`}
                onCheckedChange={(v) => save({ sections: { ...w.sections, [key]: v } })} />
            </div>
          ))}
        </div>
      </Card>
      )}

      <p className="text-center text-xs text-slate-400 pb-4">{t("website.autofillNote")}</p>
    </div>
  );
}

function PhotoMultiField({ label, desc, values, photos, onChange, onUpload, testid, t, max = 4 }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const arr = values || [];
  const toggle = (id) => { if (arr.includes(id)) onChange(arr.filter((x) => x !== id)); else if (arr.length < max) onChange([...arr, id]); };
  const up = async (f) => {
    if (!f) return;
    setBusy(true);
    try { const id = await onUpload(f); if (id && !arr.includes(id) && arr.length < max) onChange([...arr, id]); }
    catch { toast.error(t("website.saveError")); }
    finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  };
  return (
    <Card className="card-elevated border-0 shadow-none p-5">
      <div className="font-semibold mb-1 flex items-center gap-2"><ImagePlus className="w-4 h-4" /> {label}</div>
      <p className="text-sm text-slate-500 mb-3">{desc}</p>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => up(e.target.files?.[0])} data-testid={`website-${testid}-upload-input`} />
      <div className="flex flex-wrap gap-3 items-center">
        {arr.map((id) => (
          <div key={id} className="relative w-20 h-20 rounded-xl overflow-hidden flex-none border border-slate-200" data-testid={`website-${testid}-item-${id}`}>
            <img src={photoSrc(id)} alt="" className="w-full h-full object-cover" />
            <button onClick={() => onChange(arr.filter((x) => x !== id))} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center" data-testid={`website-${testid}-remove-${id}`}><Trash2 className="w-3 h-3" /></button>
          </div>
        ))}
        {arr.length < max && (
          <Button variant="outline" onClick={() => setChoosing((v) => !v)} className="rounded-xl h-20 px-4" data-testid={`website-${testid}-choose`}>
            <Plus className="w-4 h-4 mr-1" /> {t("website.choosePhoto")}
          </Button>
        )}
      </div>
      <p className="text-xs text-slate-400 mt-2">{arr.length}/{max}</p>
      {choosing && (
        <div className="mt-3 p-3 rounded-xl bg-slate-50" data-testid={`website-${testid}-chooser`}>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => ref.current?.click()} disabled={busy} data-testid={`website-${testid}-upload`}
              className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-slate-400 flex-none">
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /><span className="text-[10px] mt-0.5">{t("website.upload")}</span></>}
            </button>
            {photos.map((p) => (
              <button key={p.id} onClick={() => toggle(p.id)} data-testid={`website-${testid}-pick-${p.id}`}
                className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 flex-none transition-all ${arr.includes(p.id) ? "border-blue-600 ring-2 ring-blue-200" : "border-transparent hover:border-slate-300"}`}>
                <img src={photoSrc(p.id)} alt="" className="w-full h-full object-cover" />
                {arr.includes(p.id) && <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center"><Check className="w-3 h-3" /></span>}
              </button>
            ))}
          </div>
          {photos.length === 0 && <p className="text-xs text-slate-400 mt-2">{t("website.noPhotos")}</p>}
        </div>
      )}
    </Card>
  );
}

function PhotoField({ label, desc, value, photos, onPick, onUpload, onRemove, testid, t }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const up = async (f) => {
    if (!f) return;
    setBusy(true);
    try { await onUpload(f); setChoosing(false); } catch { toast.error(t("website.saveError")); }
    finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  };
  return (
    <Card className="card-elevated border-0 shadow-none p-5">
      <div className="font-semibold mb-1 flex items-center gap-2"><ImagePlus className="w-4 h-4" /> {label}</div>
      <p className="text-sm text-slate-500 mb-3">{desc}</p>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => up(e.target.files?.[0])} data-testid={`website-${testid}-upload-input`} />

      <div className="flex items-center gap-3">
        {value
          ? <img src={photoSrc(value)} alt="" className="w-24 h-24 rounded-xl object-cover flex-none border border-slate-200" data-testid={`website-${testid}-current`} />
          : <div className="w-24 h-24 rounded-xl bg-slate-100 flex items-center justify-center text-slate-300 flex-none"><ImagePlus className="w-7 h-7" /></div>}
        <div className="flex flex-col items-start gap-2">
          <Button variant="outline" onClick={() => setChoosing((v) => !v)} className="rounded-xl h-10" data-testid={`website-${testid}-choose`}>
            {value ? t("website.changePhoto") : t("website.choosePhoto")}
          </Button>
          {value && <button onClick={onRemove} className="text-xs text-slate-400" data-testid={`website-${testid}-remove`}>{t("website.removePhoto")}</button>}
        </div>
      </div>

      {choosing && (
        <div className="mt-4 p-3 rounded-xl bg-slate-50" data-testid={`website-${testid}-chooser`}>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => ref.current?.click()} disabled={busy} data-testid={`website-${testid}-upload`}
              className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-slate-400 flex-none">
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /><span className="text-[10px] mt-0.5">{t("website.upload")}</span></>}
            </button>
            {photos.map((p) => (
              <button key={p.id} onClick={() => { onPick(p.id); setChoosing(false); }} data-testid={`website-${testid}-pick-${p.id}`}
                className={`w-20 h-20 rounded-xl overflow-hidden border-2 flex-none transition-all ${value === p.id ? "border-blue-600 ring-2 ring-blue-200" : "border-transparent hover:border-slate-300"}`}>
                <img src={photoSrc(p.id)} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
          {photos.length === 0 && <p className="text-xs text-slate-400 mt-2">{t("website.noPhotos")}</p>}
        </div>
      )}
    </Card>
  );
}

function pick(w) {
  const { slug, template, accent_color, published, headline, subheadline, about, hero_photo_id, sections, cta_phone, service_area, hours, how_it_works, why_us, faqs, areas, services, seo_title, seo_description, gallery_photo_ids, chat_enabled, chat_launcher, chat_position, before_after, team_photo_id, about_photo_ids, why_photo_id, band_photo_id, instagram_url, ai_brief, samples, client_logos, client_pins, map_embed, case_studies, about_title, about_story, milestones, about_values, team, solutions_intro, section_colors, case_colors, about_sections } = w;
  return { slug, template, accent_color, published, headline, subheadline, about, hero_photo_id, sections, cta_phone, service_area, hours, how_it_works, why_us, faqs, areas, services, seo_title, seo_description, gallery_photo_ids, chat_enabled, chat_launcher, chat_position, before_after, team_photo_id, about_photo_ids, why_photo_id, band_photo_id, instagram_url, ai_brief, samples, client_logos, client_pins, map_embed, case_studies, about_title, about_story, milestones, about_values, team, solutions_intro, section_colors, case_colors, about_sections };
}

function BaSlot({ label, id, onClick, testid }) {
  return (
    <button onClick={onClick} data-testid={testid} className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-dashed border-slate-300 flex items-center justify-center flex-none bg-white hover:border-slate-400">
      {id ? <img src={photoSrc(id)} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] text-slate-400 text-center px-1 flex flex-col items-center gap-0.5"><Plus className="w-4 h-4" />{label}</span>}
      {id && <span className="absolute bottom-0 inset-x-0 text-[9px] font-bold text-center text-white bg-black/50">{label}</span>}
    </button>
  );
}

// Mini layout preview thumbnails — a stylized mock of each template's skeleton.
function TemplateThumb({ kind, accent }) {
  const A = accent || "#2563EB";
  const bar = (bg, w = "60%") => <div style={{ background: bg, width: w }} className="h-1.5 rounded-full" />;
  const wrap = (bg, children) => <div className="h-24 w-full p-2 overflow-hidden" style={{ background: bg }}>{children}</div>;
  switch (kind) {
    case "agency":
      return wrap("#0a1130", <div className="h-full flex flex-col justify-center gap-1.5"><div className="h-2 rounded" style={{ background: A, width: "60%", boxShadow: `0 0 8px ${A}` }} />{bar("#334155", "80%")}<div className="grid grid-cols-4 gap-1 mt-1">{[0, 1, 2, 3].map((i) => <div key={i} className="h-4 rounded" style={{ background: "rgba(255,255,255,.06)", border: `1px solid ${A}33` }} />)}</div></div>);
    case "cinematic":
      return wrap("#0A0A0F", <div className="h-full flex flex-col justify-end gap-1.5">{bar(A, "45%")}{bar("#3f3f46", "70%")}<div className="grid grid-cols-3 gap-1 mt-1">{[0, 1, 2].map((i) => <div key={i} className="h-6 rounded" style={{ background: "#1f1f23" }} />)}</div></div>);
    case "responder":
      return wrap("#fff", <><div className="h-2 -mx-2 -mt-2 mb-2" style={{ background: A }} /><div className="grid grid-cols-2 gap-1.5 h-full"><div className="flex flex-col gap-1 justify-center">{bar("#111", "80%")}{bar(A, "50%")}</div><div className="rounded" style={{ background: "#e5e5e5" }} /></div></>);
    case "bento":
      return wrap("#fff", <div className="flex gap-1.5 h-full"><div className="w-1/4 rounded" style={{ background: "#f1f5f9" }} /><div className="flex-1 grid grid-cols-3 grid-rows-2 gap-1"><div className="row-span-2 col-span-1 rounded" style={{ background: "#e2e8f0" }} /><div className="rounded" style={{ background: A }} /><div className="rounded" style={{ background: "#e2e8f0" }} /><div className="rounded" style={{ background: "#e2e8f0" }} /><div className="rounded" style={{ background: "#e2e8f0" }} /></div></div>);
    case "craftsman":
      return wrap("#F7F5F1", <div className="h-full flex flex-col items-center justify-center gap-1.5"><div className="h-10 w-[85%] rounded-[10px]" style={{ background: "#e7e2d8" }} />{bar("#2c2a28", "40%")}</div>);
    case "trust":
      return wrap("#F1F5F9", <div className="relative h-full"><div className="h-12 rounded" style={{ background: "#cbd5e1" }} /><div className="absolute left-2 right-2 top-8 h-10 rounded-md bg-white shadow flex flex-col justify-center gap-1 px-2">{bar("#cbd5e1", "70%")}{bar(A, "40%")}</div></div>);
    case "slider":
      return wrap("#fff", <div className="grid grid-cols-2 h-full gap-0"><div className="flex flex-col justify-center gap-1 pr-1" style={{ background: "#111827" }}>{bar(A, "70%")}{bar("#4b5563", "50%")}</div><div className="relative" style={{ background: "#d4d4d4" }}><div className="absolute inset-y-0 left-1/2 w-0.5 bg-white" /></div></div>);
    case "onepage":
      return wrap("#FAFAFA", <div className="h-full flex flex-col justify-center gap-2"><div className="h-2 rounded" style={{ background: "#111", width: "75%" }} /><div className="h-px w-full bg-slate-200" /><div className="flex justify-between"><div className="h-1 w-1/3 rounded bg-slate-300" /><div className="h-1.5 w-1.5 rounded-full" style={{ background: A }} /></div></div>);
    case "neon":
      return wrap("#0A0A0C", <div className="h-full flex flex-col justify-center gap-1.5"><div className="h-2 rounded" style={{ background: A, width: "55%", boxShadow: `0 0 8px ${A}` }} /><div className="grid grid-cols-3 gap-1 mt-1">{[0, 1, 2].map((i) => <div key={i} className="h-7 rounded border" style={{ borderColor: `${A}66`, background: "rgba(255,255,255,.04)" }} />)}</div></div>);
    case "playful":
      return wrap("#FFF8F0", <div className="h-full flex items-center gap-2"><div className="flex-1 flex flex-col gap-1">{bar(A, "70%")}{bar("#f5c99b", "45%")}</div><div className="w-12 h-12 rounded-full" style={{ background: `${A}55` }} /></div>);
    case "luxe":
      return wrap("#141414", <div className="h-full border flex flex-col items-center justify-center gap-1.5" style={{ borderColor: `${A}55` }}><div className="h-1 w-6 rounded-full" style={{ background: A }} />{bar("#f5f5f0", "55%")}{bar("#a8a29a", "35%")}</div>);
    default:
      return wrap(TPL_SWATCH[kind] || "#e5e7eb", null);
  }
}

// Starter content imported from the agency's live site (uni2mkt.com). Gives the
// Agency template a fully-populated, on-brand starting point the owner can edit.
const CDN = "https://uni2mkt.com/wp-content/uploads/2025";
const _case = (slug, client, category, cover, summary, services, results, body) => ({ slug, client, category, cover, summary, services, results, body, photos: [cover] });
const UNI2_DEFAULTS = {
  headline: "Impulsando Negocios Latinos",
  subheadline: "En Uni2 Marketing Group ayudamos a emprendedores latinos a destacar y crecer en el mercado estadounidense con estrategias digitales que combinan creatividad, automatización e inteligencia artificial. No solo diseñamos sitios web: creamos sistemas digitales que generan clientes reales.",
  cta_phone: "(888) 689-4979",
  services: [
    { name: "Diseño Web y Gráfico", description: "Eleva tu marca con diseños web y gráficos impactantes que cautivan y convierten a tu audiencia." },
    { name: "Optimización de Google My Business", description: "Mejora tu presencia local y atrae más clientes con nuestra optimización de Google My Business." },
    { name: "Gestión de Reputación Online", description: "Protege la imagen de tu marca y genera confianza con gestión profesional de reseñas." },
    { name: "Gestión de Redes Sociales", description: "Conecta con tu audiencia mediante contenido personalizado y campañas estratégicas." },
    { name: "Optimización SEO", description: "Aumenta tu visibilidad y genera más tráfico con SEO adaptado a tu mercado." },
    { name: "Creación de Contenido", description: "Contenido atractivo que conecta con tu audiencia y refuerza la voz de tu marca." },
    { name: "Email y SMS Marketing", description: "Mantén a tu audiencia comprometida con campañas de correo y mensajes personalizados." },
    { name: "Generación de Prospectos (Leads)", description: "Consigue más clientes potenciales con estrategias enfocadas en visibilidad y conversión." },
    { name: "Menú Digital (Digital Signage)", description: "Contenido visual llamativo para pantallas digitales que captura la atención." },
  ],
  solutions_intro: "Marketing personalizado y accesible para impulsar tu crecimiento. Estrategias que se ajustan a tu presupuesto y a tu público objetivo, con un profundo entendimiento del mercado latino e hispano.",
  how_it_works: [
    { title: "Descubrimiento y Estrategia", desc: "Analizamos tu negocio, tu audiencia y tus metas para definir una estrategia personalizada." },
    { title: "Diseño y Configuración", desc: "Creamos tu Website Inteligente y optimizamos tu presencia en Google." },
    { title: "Integración y Automatización", desc: "Activamos chatbots, formularios y automatizaciones para convertir cada contacto." },
    { title: "Lanzamiento y Optimización", desc: "Lanzamos tu sistema y medimos resultados para maximizar el rendimiento." },
    { title: "Crecimiento y Seguimiento", desc: "Reportes claros, soporte continuo y nuevas ideas para seguir escalando." },
  ],
  samples: [
    { img: `${CDN}/02/QdobaPDX.webp`, title: "Qdoba Mexican Eats", subtitle: "Franquicia · Oregon", caseSlug: "qdoba" },
    { img: `${CDN}/02/CasaLola-18-1.jpg`, title: "Casa Lola Kitchen", subtitle: "Restaurante", caseSlug: "casa-lola" },
    { img: `${CDN}/02/IMG_6268-scaled.jpg`, title: "Press Café", subtitle: "Cafetería", caseSlug: "press-cafe" },
    { img: `${CDN}/02/Fujiyama-sushi-portland-82ndlocation.jpg`, title: "Fujiyama Sushi", subtitle: "Restaurante japonés", caseSlug: "fujiyama-sushi" },
    { img: `${CDN}/02/firstcallroofing.png`, title: "First Call Roofing", subtitle: "Techado", caseSlug: "first-call-roofing" },
    { img: `${CDN}/02/Red-Tomato.png`, title: "Red Tomato Catering", subtitle: "Catering", caseSlug: "red-tomato" },
  ],
  client_logos: [
    `${CDN}/02/GA-Client-Showcase-fristcall.png`,
    `${CDN}/02/GA-Client-Showcase-BAJALTO.png`,
    `${CDN}/02/GA-Client-Showcase-CASALOLA.png`,
    `${CDN}/02/GA-Client-Showcase-GRILL68.png`,
    `${CDN}/02/GA-Client-Showcase-MARZ.png`,
  ],
  client_pins: [
    { label: "Spokane, WA", lat: 47.6588, lng: -117.426 },
    { label: "Oregon City, OR", lat: 45.3573, lng: -122.6068 },
    { label: "Boise, ID", lat: 43.615, lng: -116.2023 },
    { label: "Dallas, TX", lat: 32.7767, lng: -96.797 },
    { label: "Miami, FL", lat: 25.7617, lng: -80.1918 },
    { label: "Loreto, MX", lat: 26.0115, lng: -111.343 },
    { label: "Ciudad de México", lat: 19.4326, lng: -99.1332 },
  ],
  map_embed: "https://www.google.com/maps/d/embed?mid=152Uf65tJu-fxUF7h5ZXHVerKrxspBb0&ehbc=2E312F",
  case_studies: [
    _case("qdoba", "Qdoba Mexican Eats", "Franquicia", `${CDN}/02/QdobaPDX.webp`, "Lanzamiento digital de una franquicia Qdoba en Oregon con presencia local optimizada y captación de clientes.", ["Diseño Web", "Google My Business", "SEO Local"], [{ value: "+45%", label: "Visibilidad local" }, { value: "5★", label: "Reputación" }, { value: "24/7", label: "Presencia digital" }], "### El reto\nUna nueva ubicación de franquicia necesitaba destacar en un mercado competitivo y atraer clientes locales desde el día uno.\n\n### La solución\nDiseñamos su presencia digital, optimizamos su perfil de Google My Business y activamos estrategias de SEO local para aparecer en las búsquedas de la zona.\n\n### El resultado\nMayor visibilidad en Google Maps, más reseñas positivas y un flujo constante de nuevos clientes."),
    _case("casa-lola", "Casa Lola Kitchen", "Restaurante", `${CDN}/02/CasaLola-18-1.jpg`, "Cocina mexicana auténtica que necesitaba conectar con su comunidad y aumentar reservas.", ["Diseño Web", "Redes Sociales", "Contenido"], [{ value: "+60%", label: "Alcance social" }, { value: "+30%", label: "Reservas" }, { value: "100%", label: "Bilingüe" }], "### El reto\nCasa Lola quería llevar el sabor de su cocina a más familias y destacar su identidad mexicana.\n\n### La solución\nCreamos contenido visual atractivo, gestionamos sus redes sociales y diseñamos un sitio bilingüe que refleja su esencia.\n\n### El resultado\nMayor alcance en redes, más reservas y una comunidad fiel alrededor de la marca."),
    _case("press-cafe", "Press Café", "Cafetería", `${CDN}/02/IMG_6268-scaled.jpg`, "Una cafetería local que buscaba fortalecer su marca y presencia en internet.", ["Diseño Web", "Fotografía", "Google My Business"], [{ value: "+50%", label: "Tráfico web" }, { value: "5★", label: "Reseñas" }, { value: "Local", label: "Posicionamiento" }], "### El reto\nDestacar entre las cafeterías de la zona y transmitir la experiencia acogedora de Press Café.\n\n### La solución\nProducción fotográfica profesional, un sitio web moderno y optimización de su ficha de Google.\n\n### El resultado\nMás visitas, mejores reseñas y una marca que enamora a primera vista."),
    _case("fujiyama-sushi", "Fujiyama Sushi", "Restaurante japonés", `${CDN}/02/Fujiyama-sushi-portland-82ndlocation.jpg`, "Restaurante de sushi en Portland que amplió su alcance a nuevas ubicaciones.", ["Diseño Web", "SEO", "Menú Digital"], [{ value: "2", label: "Ubicaciones" }, { value: "+40%", label: "Pedidos online" }, { value: "5★", label: "Reputación" }], "### El reto\nUnificar la marca en múltiples ubicaciones y facilitar los pedidos en línea.\n\n### La solución\nSitio web con menú digital, SEO por ubicación y una experiencia de pedido sencilla.\n\n### El resultado\nCrecimiento en pedidos online y una marca sólida en cada sucursal."),
    _case("first-call-roofing", "First Call Roofing", "Construcción / Techado", `${CDN}/02/firstcallroofing.png`, "Empresa de techado que necesitaba generar prospectos calificados de forma constante.", ["Generación de Leads", "Google My Business", "Diseño Web"], [{ value: "+70%", label: "Leads" }, { value: "#1", label: "Google local" }, { value: "24/7", label: "Captación" }], "### El reto\nGenerar un flujo constante de clientes potenciales en un mercado muy competitivo.\n\n### La solución\nUn sitio orientado a conversión, campañas de generación de leads y optimización de Google My Business.\n\n### El resultado\nMás solicitudes de presupuesto y una agenda llena de proyectos."),
    _case("red-tomato", "Red Tomato Catering", "Catering", `${CDN}/02/Red-Tomato.png`, "Servicio de catering que buscaba profesionalizar su imagen y captar eventos.", ["Diseño Web", "Branding", "Redes Sociales"], [{ value: "+35%", label: "Cotizaciones" }, { value: "Nueva", label: "Imagen de marca" }, { value: "5★", label: "Reputación" }], "### El reto\nTransmitir profesionalismo y captar más eventos corporativos y sociales.\n\n### La solución\nRediseño de marca, sitio web elegante y presencia activa en redes sociales.\n\n### El resultado\nMás cotizaciones y una imagen que inspira confianza."),
  ],
  about_title: "De orígenes humildes a empoderar emprendedores latinos por más de 25 años",
  about_story: "### Dónde comenzó todo\nNací en Tlaxcala, México, donde mis padres me enseñaron que todo en la vida se gana con trabajo duro. Desde pequeño los ayudaba en su negocio de maquila y confección, y a los 14 años ya había iniciado mi primer negocio: un taller de serigrafía. Ahí nació mi pasión por la publicidad y el diseño.\n\n### Un evento que cambió mi vida\nTodo cambió cuando mi familia se vio obligada a emigrar a Estados Unidos por motivos de salud de mi madre. Llegamos a un país donde no hablaba el idioma y tuvimos que empezar desde cero. Pero me negué a rendirme: aprendí inglés, terminé la preparatoria y empecé a trabajar.\n\n### El espíritu emprendedor nunca muere\nVolví a la escuela para estudiar Marketing, Diseño Gráfico y Diseño Web. Lancé Mirada Latina, una revista y directorio para conectar negocios latinos con la comunidad, y después MX Media, mi primera agencia de publicidad integral.\n\n### Conectando comunidades y mercados\nMe di cuenta de un nuevo reto: muchos negocios latinos no saben cómo llegar al mercado americano, y muchos negocios americanos quieren conectar con los latinos pero no saben cómo. Así transformé MX Media en Growth Ally Agency: un aliado para el crecimiento.\n\n### Nuestra misión\nUsamos nuestro profundo conocimiento cultural y técnicas de marketing innovadoras para crear estrategias personalizadas que resalten tu marca y generen conexiones genuinas con tu audiencia. Transformemos juntos tus sueños en éxito real.",
  milestones: [
    { value: "25+", label: "Años de experiencia" },
    { value: "150+", label: "Negocios impulsados" },
    { value: "2 países", label: "EE.UU. y México" },
    { value: "Bilingüe", label: "Español e inglés" },
  ],
  about_values: [
    { title: "Porque somos latinos", desc: "Conocemos las luchas, los desafíos y los sueños de nuestra comunidad." },
    { title: "Porque lo hemos vivido", desc: "Empezamos desde cero, enfrentamos obstáculos y salimos adelante." },
    { title: "Porque creemos en ti", desc: "Cada emprendedor latino tiene el potencial de triunfar, y estamos aquí para ayudarte." },
  ],
  team: [
    { name: "Paul Zacapantzi", role: "Founder & CEO", photo: `${CDN}/02/Paul1.jpeg` },
    { name: "Lucero Zacapantzi", role: "Marketing Strategist", photo: `${CDN}/02/Team-Pic-Lucy.png` },
    { name: "Edson Saavedra", role: "Creative Director", photo: `${CDN}/02/Team-Pic-Edson.png` },
    { name: "Ayesh", role: "Coding & Developer", photo: `${CDN}/02/Team-Pic-Ayesh.png` },
    { name: "Jose Gonzalez", role: "Photo & Video", photo: `${CDN}/02/Team-Pic-Jose.png` },
    { name: "Henry Cualio", role: "Sales Manager", photo: `${CDN}/02/Team-Pic-Henry.png` },
    { name: "Ada Diaz", role: "Customer Service", photo: `${CDN}/02/ada.png` },
  ],
};

function AgencyPanel({ w, save, patch, photos, onUpload, t }) {
  const isEs = (t("website.tab.agency") === "Agencia");
  const L = isEs ? {
    intro: "Gestiona las secciones exclusivas del template Agencia: casos de clientes, franja de logos y mapa. Recuerda pulsar Guardar arriba.",
    importBtn: "Importar contenido de mi sitio (uni2mkt.com)",
    importDone: "Contenido importado. Revisa y pulsa Guardar.",
    samples: "Casos de clientes (Samples)", samplesDesc: "Tarjetas con foto que enlazan al caso del cliente.",
    logos: "Franja de logos", logosDesc: "Logos de clientes que se muestran en un carrusel.",
    pins: "Pines del mapa", pinsDesc: "Ubicaciones de clientes. Usa latitud/longitud (busca 'ciudad lat long' en Google).",
    mapEmbed: "Mapa de Google (My Maps) — recomendado", mapEmbedHint: "Pega el enlace o el iframe de tu Google My Maps. Si lo llenas, se usa en vez de los pines.", mapEmbedPh: "https://www.google.com/maps/d/embed?mid=...",
    add: "Agregar", remove: "Quitar", img: "URL de imagen", title: "Título", subtitle: "Subtítulo", link: "Enlace (opcional)",
    logoUrl: "URL del logo", label: "Etiqueta (ciudad)", lat: "Latitud", lng: "Longitud", upload: "Subir",
    cases: "Casos de éxito (Case Studies)", casesDesc: "Cada caso tiene su página de detalle. Los Samples del Home enlazan aquí por su 'slug'.",
    about: "Página Nosotros (About)", aboutDesc: "Historia, logros, valores y equipo.",
    solutions: "Página Soluciones", solutionsDesc: "Intro de la página de servicios (los servicios se editan en la pestaña Servicios).",
    client: "Cliente", category: "Categoría", summary: "Resumen", body: "Contenido adicional (usa ### para subtítulos, - para viñetas)", cslug: "Slug (url)", servicesUsed: "Servicios (separa con comas)", results: "Métricas de resultado (Valor | Etiqueta por línea, ej: 30% | Más ventas)",
    cLocation: "Ubicación", cIndustry: "Industria", cIdealClients: "Clientes ideales", cWebsite: "Sitio web / redes", clientInfo: "Información del cliente",
    challenge: "El Reto: ¿qué desafíos enfrentaban y cómo afectaba a su negocio? (usa ### y viñetas -)",
    solServices: "Servicios proporcionados (una viñeta - por línea)", solStrategies: "Estrategias implementadas (una viñeta - por línea)",
    tailored: "Soluciones a la Medida (3 tarjetas)", cardTitle: "Título de la tarjeta", cardDesc: "Descripción",
    resBefore: "Antes 🔴 (situación previa)", resAfter: "Después 🟢 (el resultado)", sectionsHint: "Estas secciones arman la página de detalle del caso, igual que tu sitio actual.",
    aboutTitle: "Título", story: "Historia (usa ### para subtítulos)", milestones: "Logros en números", values: "Valores / Por qué nosotros", team: "Equipo", value: "Valor", name: "Nombre", role: "Puesto", desc: "Descripción", photo: "Foto (URL)", solPh: "Introducción de la página de servicios", gallery: "Galería (fotos del trabajo)",
    tImport: "Importar", tSamples: "Samples", tLogos: "Logos", tMap: "Mapa", tCases: "Casos", tSol: "Soluciones", tAbout: "Nosotros",
    aiWrite: "Escribir con IA", aiWorking: "Escribiendo…", aiDone: "¡Contenido generado con IA! Revisa y Guarda.", aiErr: "La IA no pudo generar el contenido. Intenta de nuevo.",
  } : {
    intro: "Manage the Agency template's exclusive sections: client showcase, logo strip and map. Remember to hit Save at the top.",
    importBtn: "Import content from my site (uni2mkt.com)",
    importDone: "Content imported. Review and hit Save.",
    samples: "Client showcase (Samples)", samplesDesc: "Photo cards that link to the client's case.",
    logos: "Client logo strip", logosDesc: "Client logos shown in a marquee.",
    pins: "Map pins", pinsDesc: "Client locations. Use latitude/longitude (search 'city lat long' on Google).",
    mapEmbed: "Google map (My Maps) — recommended", mapEmbedHint: "Paste your Google My Maps link or iframe. If set, it's used instead of the pins.", mapEmbedPh: "https://www.google.com/maps/d/embed?mid=...",
    add: "Add", remove: "Remove", img: "Image URL", title: "Title", subtitle: "Subtitle", link: "Link (optional)",
    logoUrl: "Logo URL", label: "Label (city)", lat: "Latitude", lng: "Longitude", upload: "Upload",
    cases: "Case studies", casesDesc: "Each case gets its own detail page. Home 'Samples' link here by 'slug'.",
    about: "About page", aboutDesc: "Story, milestones, values and team.",
    solutions: "Solutions page", solutionsDesc: "Intro for the services page (edit services in the Services tab).",
    client: "Client", category: "Category", summary: "Summary", body: "Extra content (use ### for headings, - for bullets)", cslug: "Slug (url)", servicesUsed: "Services (comma separated)", results: "Result metrics (Value | Label per line, e.g. 30% | More sales)",
    cLocation: "Location", cIndustry: "Industry", cIdealClients: "Ideal clients", cWebsite: "Website / social", clientInfo: "Client information",
    challenge: "The Challenge: what problems did they face and how did it hurt their business? (use ### and - bullets)",
    solServices: "Services provided (one - bullet per line)", solStrategies: "Strategies implemented (one - bullet per line)",
    tailored: "Tailored solutions (3 cards)", cardTitle: "Card title", cardDesc: "Description",
    resBefore: "Before 🔴 (previous situation)", resAfter: "After 🟢 (the outcome)", sectionsHint: "These sections build the case detail page, just like your current site.",
    aboutTitle: "Title", story: "Story (use ### for headings)", milestones: "Milestones (numbers)", values: "Values / Why us", team: "Team", value: "Value", name: "Name", role: "Role", desc: "Description", photo: "Photo (URL)", solPh: "Services page intro", gallery: "Gallery (work photos)",
    tImport: "Import", tSamples: "Samples", tLogos: "Logos", tMap: "Map", tCases: "Cases", tSol: "Solutions", tAbout: "About",
    aiWrite: "Write with AI", aiWorking: "Writing…", aiDone: "Content generated with AI! Review and Save.", aiErr: "AI could not generate the content. Try again.",
  };
  const samples = Array.isArray(w.samples) ? w.samples : [];
  const logos = Array.isArray(w.client_logos) ? w.client_logos : [];
  const pins = Array.isArray(w.client_pins) ? w.client_pins : [];
  const upRef = useRef(null);
  const [upIdx, setUpIdx] = useState(null);

  const setSamples = (arr) => patch({ samples: arr });
  const setLogos = (arr) => patch({ client_logos: arr });
  const setPins = (arr) => patch({ client_pins: arr });
  const cases = Array.isArray(w.case_studies) ? w.case_studies : [];
  const miles = Array.isArray(w.milestones) ? w.milestones : [];
  const values = Array.isArray(w.about_values) ? w.about_values : [];
  const team = Array.isArray(w.team) ? w.team : [];
  const setCases = (arr) => patch({ case_studies: arr });
  const setMiles = (arr) => patch({ milestones: arr });
  const setValues = (arr) => patch({ about_values: arr });
  const setTeam = (arr) => patch({ team: arr });
  const updCase = (i, k, v) => { const n = [...cases]; n[i] = { ...n[i], [k]: v }; setCases(n); };
  const uploadCaseCover = async (i, file) => {
    if (!file) return;
    try { const id = await onUpload(file); const n = [...cases]; n[i] = { ...n[i], cover: id }; setCases(n); await save({ case_studies: n }); }
    catch { toast.error(t("website.saveError")); }
  };
  const uploadCasePhotos = async (i, files) => {
    const list = Array.from(files || []).slice(0, 12);
    if (!list.length) return;
    try {
      const ids = [];
      for (const f of list) { const id = await onUpload(f); if (id) ids.push(id); }
      const n = [...cases]; n[i] = { ...n[i], photos: [...(n[i].photos || []), ...ids] }; setCases(n); await save({ case_studies: n });
    } catch { toast.error(t("website.saveError")); }
  };
  const removeCasePhoto = async (i, pi) => { const n = [...cases]; n[i] = { ...n[i], photos: (n[i].photos || []).filter((_, x) => x !== pi) }; setCases(n); await save({ case_studies: n }); };
  const removeCaseCover = async (i) => { const n = [...cases]; n[i] = { ...n[i], cover: "" }; setCases(n); await save({ case_studies: n }); };
  const updSolCard = (i, ci, k, v) => { const cards = [...(cases[i].solution_cards || [])]; while (cards.length < 3) cards.push({ title: "", desc: "" }); cards[ci] = { ...cards[ci], [k]: v }; updCase(i, "solution_cards", cards); };
  const setCaseColor = (key, val) => patch({ case_colors: { ...(w?.case_colors || {}), [key]: val } });
  const aboutSecs = Array.isArray(w.about_sections) ? w.about_sections : [];
  const setAboutSecs = (n) => patch({ about_sections: n });
  const updAboutSec = (i, k, v) => { const n = [...aboutSecs]; n[i] = { ...n[i], [k]: v }; setAboutSecs(n); };
  const uploadAboutSecImg = async (i, files) => {
    const list = Array.from(files || []).slice(0, 2);
    if (!list.length) return;
    try { const ids = []; for (const f of list) { const id = await onUpload(f); if (id) ids.push(id); } const n = [...aboutSecs]; n[i] = { ...n[i], images: [...(n[i].images || []), ...ids].slice(0, 2) }; setAboutSecs(n); await save({ about_sections: n }); }
    catch { toast.error(t("website.saveError")); }
  };
  const removeAboutSecImg = async (i, pi) => { const n = [...aboutSecs]; n[i] = { ...n[i], images: (n[i].images || []).filter((_, x) => x !== pi) }; setAboutSecs(n); await save({ about_sections: n }); };
  const [openCase, setOpenCase] = useState(0);
  const moveCase = (i, dir) => { const j = i + dir; if (j < 0 || j >= cases.length) return; const n = [...cases]; [n[i], n[j]] = [n[j], n[i]]; setCases(n); setOpenCase(j); };
  const resToText = (r) => (Array.isArray(r) ? r.map((x) => `${x.value || ""} | ${x.label || ""}`).join("\n") : "");
  const textToRes = (t) => t.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [value, ...rest] = l.split("|"); return { value: (value || "").trim(), label: rest.join("|").trim() }; });
  const doImport = async () => { await save({ ...UNI2_DEFAULTS }); toast.success(L.importDone); };
  const uploadFor = async (file) => {
    if (!file || upIdx == null) return;
    try { const id = await onUpload(file); const next = [...samples]; next[upIdx] = { ...next[upIdx], img: id }; setSamples(next); }
    catch { toast.error(t("website.saveError")); }
    finally { setUpIdx(null); if (upRef.current) upRef.current.value = ""; }
  };
  const uploadLogo = async (i, file) => {
    if (!file) return;
    try { const id = await onUpload(file); const n = [...logos]; n[i] = id; setLogos(n); await save({ client_logos: n }); }
    catch { toast.error(t("website.saveError")); }
  };
  const uploadTeamPhoto = async (i, file) => {
    if (!file) return;
    try { const id = await onUpload(file); const n = [...team]; n[i] = { ...n[i], photo: id }; setTeam(n); await save({ team: n }); }
    catch { toast.error(t("website.saveError")); }
  };
  const [sub, setSub] = useState("import");
  const [aiBusy, setAiBusy] = useState(null);
  const aiCase = async (i) => {
    setAiBusy(`case-${i}`);
    try {
      const c = cases[i] || {};
      const { data } = await api.post("/website/ai-agency", { kind: "case", client: c.client, category: c.category, notes: c.summary || c.body || "", lang: isEs ? "es" : "en" });
      const g = data.data || {};
      const n = [...cases]; n[i] = { ...c, summary: g.summary || c.summary, body: g.body || c.body, services: (g.services && g.services.length ? g.services : c.services), results: (g.results && g.results.length ? g.results : c.results) }; setCases(n);
      toast.success(L.aiDone);
    } catch (e) { toast.error(e?.response?.data?.detail || L.aiErr); }
    finally { setAiBusy(null); }
  };
  const aiAbout = async () => {
    setAiBusy("about");
    try {
      const { data } = await api.post("/website/ai-agency", { kind: "about", notes: w.about_story || w.about_title || "", lang: isEs ? "es" : "en" });
      const g = data.data || {};
      patch({ about_title: g.about_title || w.about_title, about_story: g.about_story || w.about_story, milestones: (g.milestones && g.milestones.length ? g.milestones : miles), about_values: (g.about_values && g.about_values.length ? g.about_values : values) });
      toast.success(L.aiDone);
    } catch (e) { toast.error(e?.response?.data?.detail || L.aiErr); }
    finally { setAiBusy(null); }
  };
  const SUBTABS = [["import", L.tImport], ["samples", L.tSamples], ["logos", L.tLogos], ["map", L.tMap], ["cases", L.tCases], ["solutions", L.tSol], ["about", L.tAbout]];

  return (
    <div className="space-y-4" data-testid="agency-panel">
      <input ref={upRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadFor(e.target.files?.[0])} />
      <div className="flex flex-wrap gap-2 sticky top-0 z-10 bg-white/90 backdrop-blur py-2 -mx-1 px-1 border-b border-slate-200">
        {SUBTABS.map(([k, label]) => (
          <button key={k} onClick={() => setSub(k)} data-testid={`agency-subtab-${k}`}
            className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors ${sub === k ? "text-white" : "text-slate-600 bg-slate-100 hover:bg-slate-200"}`}
            style={sub === k ? { background: "#0a1130" } : {}}>{label}</button>
        ))}
      </div>
      {sub === "import" && (
      <Card className="card-elevated border-0 shadow-none p-5">
        <p className="text-sm text-slate-500 mb-3">{L.intro}</p>
        <Button onClick={doImport} variant="outline" className="rounded-xl h-10 font-bold" data-testid="agency-import-btn">
          <Wand2 className="w-4 h-4 mr-2" /> {L.importBtn}
        </Button>
      </Card>
      )}

      {/* SAMPLES */}
      {sub === "samples" && (
      <Card className="card-elevated border-0 shadow-none p-5">
        <div className="font-semibold mb-1 flex items-center gap-2"><Images className="w-4 h-4" /> {L.samples}</div>
        <p className="text-sm text-slate-500 mb-3">{L.samplesDesc}</p>
        <div className="space-y-3">
          {samples.map((s, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-3 space-y-2" data-testid={`agency-sample-${i}`}>
              <div className="flex items-center gap-2">
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-100 flex-none border border-slate-200">
                  {s.img && <img src={/^https?:\/\//.test(s.img) ? s.img : photoSrc(s.img)} alt="" className="w-full h-full object-cover" />}
                </div>
                <Input value={s.img || ""} onChange={(e) => { const n = [...samples]; n[i] = { ...s, img: e.target.value }; setSamples(n); }} placeholder={L.img} className="h-9 rounded-lg" data-testid={`agency-sample-img-${i}`} />
                <Button variant="outline" size="sm" className="rounded-lg h-9 flex-none" onClick={() => { setUpIdx(i); upRef.current?.click(); }} data-testid={`agency-sample-upload-${i}`}><ImagePlus className="w-4 h-4" /></Button>
                <Button variant="ghost" size="sm" className="rounded-lg h-9 flex-none text-red-500" onClick={() => setSamples(samples.filter((_, x) => x !== i))} data-testid={`agency-sample-remove-${i}`}><Trash2 className="w-4 h-4" /></Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input value={s.title || ""} onChange={(e) => { const n = [...samples]; n[i] = { ...s, title: e.target.value }; setSamples(n); }} placeholder={L.title} className="h-9 rounded-lg" data-testid={`agency-sample-title-${i}`} />
                <Input value={s.subtitle || ""} onChange={(e) => { const n = [...samples]; n[i] = { ...s, subtitle: e.target.value }; setSamples(n); }} placeholder={L.subtitle} className="h-9 rounded-lg" />
              </div>
              <Input value={s.link || ""} onChange={(e) => { const n = [...samples]; n[i] = { ...s, link: e.target.value }; setSamples(n); }} placeholder={L.link} className="h-9 rounded-lg" data-testid={`agency-sample-link-${i}`} />
            </div>
          ))}
        </div>
        <Button variant="outline" className="rounded-xl h-9 mt-3" onClick={() => setSamples([...samples, { img: "", title: "", subtitle: "", link: "" }])} data-testid="agency-sample-add"><Plus className="w-4 h-4 mr-1" /> {L.add}</Button>
      </Card>
      )}

      {/* LOGOS */}
      {sub === "logos" && (
      <Card className="card-elevated border-0 shadow-none p-5">
        <div className="font-semibold mb-1 flex items-center gap-2"><Briefcase className="w-4 h-4" /> {L.logos}</div>
        <p className="text-sm text-slate-500 mb-3">{L.logosDesc}</p>
        <div className="space-y-2">
          {logos.map((l, i) => (
            <div key={i} className="flex items-center gap-2" data-testid={`agency-logo-${i}`}>
              <div className="w-12 h-10 rounded-lg overflow-hidden bg-white flex-none border border-slate-200 flex items-center justify-center">
                {l && <img src={/^https?:\/\//.test(l) ? l : photoSrc(l)} alt="" className="max-w-full max-h-full object-contain" />}
              </div>
              <Input value={l || ""} onChange={(e) => { const n = [...logos]; n[i] = e.target.value; setLogos(n); }} placeholder={L.logoUrl} className="h-9 rounded-lg" data-testid={`agency-logo-url-${i}`} />
              <label className="rounded-lg h-9 px-2.5 flex-none border border-slate-200 flex items-center cursor-pointer hover:bg-slate-50" title={L.upload} data-testid={`agency-logo-upload-${i}`}>
                <ImagePlus className="w-4 h-4" />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(i, f); e.target.value = ""; }} />
              </label>
              <Button variant="ghost" size="sm" className="rounded-lg h-9 flex-none text-red-500" onClick={() => setLogos(logos.filter((_, x) => x !== i))} data-testid={`agency-logo-remove-${i}`}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </div>
        <Button variant="outline" className="rounded-xl h-9 mt-3" onClick={() => setLogos([...logos, ""])} data-testid="agency-logo-add"><Plus className="w-4 h-4 mr-1" /> {L.add}</Button>
      </Card>
      )}

      {/* PINS */}
      {sub === "map" && (
      <Card className="card-elevated border-0 shadow-none p-5">
        <div className="font-semibold mb-1 flex items-center gap-2"><MapPin className="w-4 h-4" /> {L.pins}</div>
        <p className="text-sm text-slate-500 mb-3">{L.pinsDesc}</p>
        <div className="mb-4 rounded-xl bg-slate-50 border border-slate-200 p-3">
          <div className="text-sm font-semibold mb-1">{L.mapEmbed}</div>
          <p className="text-xs text-slate-500 mb-2">{L.mapEmbedHint}</p>
          <Input value={w.map_embed || ""} onChange={(e) => patch({ map_embed: e.target.value })} placeholder={L.mapEmbedPh} className="h-9 rounded-lg" data-testid="agency-map-embed" />
        </div>
        <div className="space-y-2">
          {pins.map((p, i) => (
            <div key={i} className="flex items-center gap-2" data-testid={`agency-pin-${i}`}>
              <Input value={p.label || ""} onChange={(e) => { const n = [...pins]; n[i] = { ...p, label: e.target.value }; setPins(n); }} placeholder={L.label} className="h-9 rounded-lg flex-1" data-testid={`agency-pin-label-${i}`} />
              <Input value={p.lat ?? ""} onChange={(e) => { const n = [...pins]; n[i] = { ...p, lat: e.target.value }; setPins(n); }} placeholder={L.lat} className="h-9 rounded-lg w-24" data-testid={`agency-pin-lat-${i}`} />
              <Input value={p.lng ?? ""} onChange={(e) => { const n = [...pins]; n[i] = { ...p, lng: e.target.value }; setPins(n); }} placeholder={L.lng} className="h-9 rounded-lg w-24" data-testid={`agency-pin-lng-${i}`} />
              <Button variant="ghost" size="sm" className="rounded-lg h-9 flex-none text-red-500" onClick={() => setPins(pins.filter((_, x) => x !== i))} data-testid={`agency-pin-remove-${i}`}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </div>
        <Button variant="outline" className="rounded-xl h-9 mt-3" onClick={() => setPins([...pins, { label: "", lat: "", lng: "" }])} data-testid="agency-pin-add"><Plus className="w-4 h-4 mr-1" /> {L.add}</Button>
      </Card>
      )}

      {/* CASE STUDIES */}
      {sub === "cases" && (
      <>
      <Card className="card-elevated border-0 shadow-none p-5" data-testid="case-colors-card">
        <div className="font-semibold mb-1 flex items-center gap-2"><Palette className="w-4 h-4" /> {isEs ? "Colores por sección (Casos)" : "Section colors (Cases)"}</div>
        <p className="text-sm text-slate-500 mb-3">{isEs ? "Asigna el color de fondo de cada sección de la página de detalle del caso." : "Set the background color of each case detail section."}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[["hero", "#0a1130", isEs ? "Portada" : "Hero"], ["info", "#f8fafc", isEs ? "Info del cliente" : "Client info"], ["challenge", "#ffffff", isEs ? "El reto" : "Challenge"], ["solution", "#f8fafc", isEs ? "La solución" : "Solution"], ["tailored", "#ffffff", isEs ? "Soluciones a la medida" : "Tailored"], ["results", "#0a1130", isEs ? "Resultados" : "Results"], ["portfolio", "#ffffff", isEs ? "Portafolio" : "Portfolio"]].map(([key, def, label]) => (
            <div key={key} className="flex items-center gap-2">
              <input type="color" value={(w.case_colors && w.case_colors[key]) || def} onChange={(e) => setCaseColor(key, e.target.value)} className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer flex-none p-0.5" data-testid={`casecolor-${key}`} />
              <span className="text-sm">{label}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card className="card-elevated border-0 shadow-none p-5">
        <div className="font-semibold mb-1 flex items-center gap-2"><Star className="w-4 h-4" /> {L.cases}</div>
        <p className="text-sm text-slate-500 mb-3">{L.casesDesc}</p>
        <div className="space-y-3">
          {cases.map((c, i) => (
            <div key={i} className="rounded-xl border border-slate-200 overflow-hidden" data-testid={`agency-case-${i}`}>
              <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50 transition" onClick={() => setOpenCase(openCase === i ? -1 : i)} data-testid={`agency-case-toggle-${i}`}>
                <div className="w-11 h-11 rounded-lg overflow-hidden bg-slate-100 flex-none border border-slate-200">
                  {c.cover && <img src={/^https?:\/\//.test(c.cover) ? c.cover : photoSrc(c.cover)} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{c.client || (isEs ? "Caso sin título" : "Untitled case")}</div>
                  {c.category && <div className="text-xs text-slate-400 truncate">{c.category}</div>}
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); moveCase(i, -1); }} disabled={i === 0} className="w-7 h-7 rounded-md text-slate-400 hover:bg-slate-200 disabled:opacity-30 flex items-center justify-center flex-none" title={isEs ? "Subir" : "Move up"} data-testid={`agency-case-up-${i}`}><ArrowUp className="w-4 h-4" /></button>
                <button type="button" onClick={(e) => { e.stopPropagation(); moveCase(i, 1); }} disabled={i === cases.length - 1} className="w-7 h-7 rounded-md text-slate-400 hover:bg-slate-200 disabled:opacity-30 flex items-center justify-center flex-none" title={isEs ? "Bajar" : "Move down"} data-testid={`agency-case-down-${i}`}><ArrowDown className="w-4 h-4" /></button>
                <button type="button" onClick={(e) => { e.stopPropagation(); setCases(cases.filter((_, x) => x !== i)); }} className="w-7 h-7 rounded-md text-red-500 hover:bg-red-50 flex items-center justify-center flex-none" title={isEs ? "Eliminar" : "Delete"} data-testid={`agency-case-remove-${i}`}><Trash2 className="w-4 h-4" /></button>
                <ChevronDown className={`w-5 h-5 text-slate-400 flex-none transition-transform ${openCase === i ? "rotate-180" : ""}`} />
              </div>
              {openCase === i && (
              <div className="p-3 pt-0 space-y-2 border-t border-slate-100">
              <div className="flex items-center gap-2 pt-2">
                <label className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 cursor-pointer flex-1" data-testid={`agency-case-cover-${i}`}>
                  <ImagePlus className="w-4 h-4" /> {c.cover ? t("website.changePhoto") : t("website.uploadPhoto")}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadCaseCover(i, e.target.files?.[0])} />
                </label>
                {c.cover && <button onClick={() => removeCaseCover(i)} className="text-xs text-slate-400 hover:text-red-500 flex-none" data-testid={`agency-case-cover-del-${i}`}>{t("website.removePhoto")}</button>}
                <Button variant="outline" size="sm" className="rounded-lg h-9 flex-none" disabled={aiBusy === `case-${i}`} onClick={() => aiCase(i)} data-testid={`agency-case-ai-${i}`} title={L.aiWrite}>{aiBusy === `case-${i}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}</Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input value={c.client || ""} onChange={(e) => updCase(i, "client", e.target.value)} placeholder={L.client} className="h-9 rounded-lg" data-testid={`agency-case-client-${i}`} />
                <Input value={c.category || ""} onChange={(e) => updCase(i, "category", e.target.value)} placeholder={L.category} className="h-9 rounded-lg" />
                <Input value={c.slug || ""} onChange={(e) => updCase(i, "slug", e.target.value)} placeholder={L.cslug} className="h-9 rounded-lg" data-testid={`agency-case-slug-${i}`} />
              </div>
              <RichEditor value={c.summary || ""} onChange={(v) => updCase(i, "summary", v)} placeholder={L.summary} minHeight={56} testid={`agency-case-summary-${i}`} />
              {/* Client info */}
              <div className="pt-1 border-t border-slate-200/70">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-2 mb-1.5">{L.clientInfo}</div>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={c.location || ""} onChange={(e) => updCase(i, "location", e.target.value)} placeholder={L.cLocation} className="h-9 rounded-lg" data-testid={`agency-case-location-${i}`} />
                  <Input value={c.industry || ""} onChange={(e) => updCase(i, "industry", e.target.value)} placeholder={L.cIndustry} className="h-9 rounded-lg" />
                  <Input value={c.ideal_clients || ""} onChange={(e) => updCase(i, "ideal_clients", e.target.value)} placeholder={L.cIdealClients} className="h-9 rounded-lg" />
                  <Input value={c.website_url || ""} onChange={(e) => updCase(i, "website_url", e.target.value)} placeholder={L.cWebsite} className="h-9 rounded-lg" />
                </div>
              </div>
              {/* El Reto */}
              <RichEditor value={c.challenge || ""} onChange={(v) => updCase(i, "challenge", v)} placeholder={L.challenge} minHeight={90} testid={`agency-case-challenge-${i}`} />
              {/* La Solución */}
              <Input value={Array.isArray(c.services) ? c.services.join(", ") : ""} onChange={(e) => updCase(i, "services", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder={L.servicesUsed} className="h-9 rounded-lg" />
              <div className="grid sm:grid-cols-2 gap-2">
                <RichEditor value={c.solution_services || ""} onChange={(v) => updCase(i, "solution_services", v)} placeholder={L.solServices} minHeight={80} testid={`agency-case-solservices-${i}`} />
                <RichEditor value={c.solution_strategies || ""} onChange={(v) => updCase(i, "solution_strategies", v)} placeholder={L.solStrategies} minHeight={80} />
              </div>
              {/* Soluciones a la medida (3 cards) */}
              <div className="pt-1 border-t border-slate-200/70">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-2 mb-1.5">{L.tailored}</div>
                <div className="grid sm:grid-cols-3 gap-2">
                  {[0, 1, 2].map((ci) => (
                    <div key={ci} className="space-y-1.5" data-testid={`agency-case-${i}-solcard-${ci}`}>
                      <Input value={(c.solution_cards && c.solution_cards[ci]?.title) || ""} onChange={(e) => updSolCard(i, ci, "title", e.target.value)} placeholder={`${L.cardTitle} ${ci + 1}`} className="h-9 rounded-lg" />
                      <RichEditor value={(c.solution_cards && c.solution_cards[ci]?.desc) || ""} onChange={(v) => updSolCard(i, ci, "desc", v)} placeholder={L.cardDesc} minHeight={56} />
                    </div>
                  ))}
                </div>
              </div>
              {/* Resultados */}
              <div className="grid sm:grid-cols-2 gap-2">
                <RichEditor value={c.result_before || ""} onChange={(v) => updCase(i, "result_before", v)} placeholder={L.resBefore} minHeight={64} testid={`agency-case-before-${i}`} />
                <RichEditor value={c.result_after || ""} onChange={(v) => updCase(i, "result_after", v)} placeholder={L.resAfter} minHeight={64} />
              </div>
              <Textarea value={resToText(c.results)} onChange={(e) => updCase(i, "results", textToRes(e.target.value))} placeholder={L.results} className="rounded-lg min-h-[50px] font-mono text-xs" />
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">{L.gallery}</div>
                {(Array.isArray(c.photos) ? c.photos : []).length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {c.photos.map((ph, pi) => (
                      <div key={pi} className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-square bg-slate-100" data-testid={`agency-case-${i}-photo-${pi}`}>
                        {ph && <img src={/^https?:\/\//.test(ph) ? ph : photoSrc(ph)} alt="" className="w-full h-full object-cover" />}
                        <button onClick={() => removeCasePhoto(i, pi)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition" data-testid={`agency-case-${i}-photo-del-${pi}`}><Trash2 className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 cursor-pointer mt-2" data-testid={`agency-case-${i}-photo-add`}>
                  <ImagePlus className="w-3.5 h-3.5" /> {t("website.addWorkPhotos")}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadCasePhotos(i, e.target.files)} />
                </label>
              </div>
              </div>
              )}
            </div>
          ))}
        </div>
        <Button variant="outline" className="rounded-xl h-9 mt-3" onClick={() => setCases([...cases, { slug: `caso-${cases.length + 1}`, client: "", category: "", cover: "", summary: "", location: "", industry: "", ideal_clients: "", website_url: "", challenge: "", services: [], solution_services: "", solution_strategies: "", solution_cards: [{ title: isEs ? "Diseño Gráfico Personalizado" : "Custom Graphic Design", desc: "" }, { title: isEs ? "Consultoría Estratégica" : "Strategic Consulting", desc: "" }, { title: isEs ? "Producción y Entrega Puntual" : "On-Time Production & Delivery", desc: "" }], result_before: "", result_after: "", results: [], body: "", photos: [] }])} data-testid="agency-case-add"><Plus className="w-4 h-4 mr-1" /> {L.add}</Button>
      </Card>
      </>
      )}
      {sub === "solutions" && (
      <Card className="card-elevated border-0 shadow-none p-5">
        <div className="font-semibold mb-1 flex items-center gap-2"><Briefcase className="w-4 h-4" /> {L.solutions}</div>
        <p className="text-sm text-slate-500 mb-3">{L.solutionsDesc}</p>
        <Textarea value={w.solutions_intro || ""} onChange={(e) => patch({ solutions_intro: e.target.value })} placeholder={L.solPh} className="rounded-lg min-h-[70px]" data-testid="agency-solutions-intro" />
      </Card>
      )}

      {/* ABOUT */}
      {sub === "about" && (
      <Card className="card-elevated border-0 shadow-none p-5">
        <div className="font-semibold mb-1 flex items-center gap-2"><Users className="w-4 h-4" /> {L.about}</div>
        <p className="text-sm text-slate-500 mb-3">{L.aboutDesc}</p>
        <Button variant="outline" className="rounded-xl h-9 mb-3" disabled={aiBusy === "about"} onClick={aiAbout} data-testid="agency-about-ai">{aiBusy === "about" ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {L.aiWorking}</> : <><Sparkles className="w-4 h-4 mr-2" /> {L.aiWrite}</>}</Button>
        <Input value={w.about_title || ""} onChange={(e) => patch({ about_title: e.target.value })} placeholder={L.aboutTitle} className="h-9 rounded-lg mb-2" data-testid="agency-about-title" />
        <RichEditor value={w.about_story || ""} onChange={(v) => patch({ about_story: v })} placeholder={L.story} minHeight={140} testid="agency-about-story" />

        <div className="text-sm font-semibold mt-4 mb-1">{isEs ? "Secciones de historia (con imágenes)" : "Story sections (with images)"}</div>
        <p className="text-xs text-slate-500 mb-2">{isEs ? "Cada sección muestra su texto con 1-2 imágenes al lado (se alternan izquierda/derecha)." : "Each section shows its text with 1-2 images alongside (alternating left/right)."}</p>
        <div className="space-y-3">
          {aboutSecs.map((s, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-3 space-y-2" data-testid={`about-sec-${i}`}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 flex-none">#{i + 1}</span>
                <Input value={s.title || ""} onChange={(e) => updAboutSec(i, "title", e.target.value)} placeholder={isEs ? "Título de la sección" : "Section title"} className="h-9 rounded-lg flex-1" />
                <button type="button" onClick={() => setAboutSecs(aboutSecs.filter((_, x) => x !== i))} className="w-8 h-8 rounded-md text-red-500 hover:bg-red-50 flex items-center justify-center flex-none" data-testid={`about-sec-remove-${i}`}><Trash2 className="w-4 h-4" /></button>
              </div>
              <RichEditor value={s.body || ""} onChange={(v) => updAboutSec(i, "body", v)} placeholder={isEs ? "Escribe el texto de esta sección…" : "Write this section's text…"} minHeight={90} testid={`about-sec-body-${i}`} />
              <div className="flex items-center gap-2 flex-wrap">
                {(Array.isArray(s.images) ? s.images : []).map((ph, pi) => (
                  <div key={pi} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex-none" data-testid={`about-sec-${i}-img-${pi}`}>
                    {ph && <img src={/^https?:\/\//.test(ph) ? ph : photoSrc(ph)} alt="" className="w-full h-full object-cover" />}
                    <button onClick={() => removeAboutSecImg(i, pi)} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
                {(s.images || []).length < 2 && (
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 cursor-pointer" data-testid={`about-sec-${i}-img-add`}>
                    <ImagePlus className="w-3.5 h-3.5" /> {isEs ? "Agregar imagen" : "Add image"}
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadAboutSecImg(i, e.target.files)} />
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
        <Button variant="outline" className="rounded-xl h-8 mt-2" onClick={() => setAboutSecs([...aboutSecs, { title: "", body: "", images: [] }])} data-testid="about-sec-add"><Plus className="w-4 h-4 mr-1" /> {isEs ? "Agregar sección" : "Add section"}</Button>

        <div className="text-sm font-semibold mt-4 mb-2">{L.milestones}</div>
        <div className="space-y-2">
          {miles.map((m, i) => (
            <div key={i} className="flex items-center gap-2" data-testid={`agency-milestone-${i}`}>
              <Input value={m.value || ""} onChange={(e) => { const n = [...miles]; n[i] = { ...m, value: e.target.value }; setMiles(n); }} placeholder={L.value} className="h-9 rounded-lg w-28" />
              <Input value={m.label || ""} onChange={(e) => { const n = [...miles]; n[i] = { ...m, label: e.target.value }; setMiles(n); }} placeholder={L.label} className="h-9 rounded-lg flex-1" />
              <Button variant="ghost" size="sm" className="rounded-lg h-9 flex-none text-red-500" onClick={() => setMiles(miles.filter((_, x) => x !== i))}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </div>
        <Button variant="outline" className="rounded-xl h-8 mt-2" onClick={() => setMiles([...miles, { value: "", label: "" }])} data-testid="agency-milestone-add"><Plus className="w-4 h-4 mr-1" /> {L.add}</Button>

        <div className="text-sm font-semibold mt-4 mb-2">{L.values}</div>
        <div className="space-y-2">
          {values.map((v, i) => (
            <div key={i} className="flex items-start gap-2" data-testid={`agency-value-${i}`}>
              <div className="flex-1 space-y-1">
                <Input value={v.title || ""} onChange={(e) => { const n = [...values]; n[i] = { ...v, title: e.target.value }; setValues(n); }} placeholder={L.title} className="h-9 rounded-lg" />
                <Input value={v.desc || ""} onChange={(e) => { const n = [...values]; n[i] = { ...v, desc: e.target.value }; setValues(n); }} placeholder={L.desc} className="h-9 rounded-lg" />
              </div>
              <Button variant="ghost" size="sm" className="rounded-lg h-9 flex-none text-red-500" onClick={() => setValues(values.filter((_, x) => x !== i))}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </div>
        <Button variant="outline" className="rounded-xl h-8 mt-2" onClick={() => setValues([...values, { title: "", desc: "" }])} data-testid="agency-value-add"><Plus className="w-4 h-4 mr-1" /> {L.add}</Button>

        <div className="text-sm font-semibold mt-4 mb-2">{L.team}</div>
        <div className="space-y-2">
          {team.map((m, i) => (
            <div key={i} className="flex items-center gap-2" data-testid={`agency-team-${i}`}>
              <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 flex-none border border-slate-200">
                {m.photo && <img src={/^https?:\/\//.test(m.photo) ? m.photo : photoSrc(m.photo)} alt="" className="w-full h-full object-cover" />}
              </div>
              <Input value={m.name || ""} onChange={(e) => { const n = [...team]; n[i] = { ...m, name: e.target.value }; setTeam(n); }} placeholder={L.name} className="h-9 rounded-lg w-32" />
              <Input value={m.role || ""} onChange={(e) => { const n = [...team]; n[i] = { ...m, role: e.target.value }; setTeam(n); }} placeholder={L.role} className="h-9 rounded-lg w-32" />
              <Input value={m.photo || ""} onChange={(e) => { const n = [...team]; n[i] = { ...m, photo: e.target.value }; setTeam(n); }} placeholder={L.photo} className="h-9 rounded-lg flex-1" />
              <label className="rounded-lg h-9 px-2.5 flex-none border border-slate-200 flex items-center cursor-pointer hover:bg-slate-50" title={L.upload} data-testid={`agency-team-upload-${i}`}>
                <ImagePlus className="w-4 h-4" />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTeamPhoto(i, f); e.target.value = ""; }} />
              </label>
              <Button variant="ghost" size="sm" className="rounded-lg h-9 flex-none text-red-500" onClick={() => setTeam(team.filter((_, x) => x !== i))}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </div>
        <Button variant="outline" className="rounded-xl h-8 mt-2" onClick={() => setTeam([...team, { name: "", role: "", photo: "" }])} data-testid="agency-team-add"><Plus className="w-4 h-4 mr-1" /> {L.add}</Button>
      </Card>
      )}
    </div>
  );
}




function ProblemPagesPanel({ slug }) {
  const { t } = useTranslation();
  const [items, setItems] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null); // page id
  const [draft, setDraft] = useState({});
  const origin = window.location.origin;

  const load = async () => {
    try { const { data } = await api.get("/website/problem-pages"); setItems(data.items || []); setPhotos(data.photos || []); }
    catch { setItems([]); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const generate = async (force) => {
    setBusy(true);
    try { const { data } = await api.post("/website/problem-pages/generate", { force: !!force }); toast.success(`${data.count} ${t("website.pp.pagesReady")}`); await load(); }
    catch { toast.error(t("website.pp.genErr")); }
    finally { setBusy(false); }
  };
  const regenerate = async (id) => {
    setBusy(true);
    try { await api.post(`/website/problem-pages/${id}/regenerate`, {}); toast.success(t("website.pp.regenOk")); await load(); }
    catch { toast.error(t("website.pp.regenErr")); } finally { setBusy(false); }
  };
  const publish = async (id, val) => {
    try { await api.put(`/website/problem-pages/${id}`, { published: val }); await load(); }
    catch { toast.error(t("website.pp.saveErr")); }
  };
  const openEdit = (pp) => { setEditing(pp.id); setDraft({ ...pp.content, seo_title: pp.seo?.title || "", seo_meta: pp.seo?.meta_description || "", hero_photo_id: pp.hero_photo_id || "", problem_hint: pp.problem_hint || "" }); };
  const regenWithProblem = async (id) => {
    setBusy(true);
    try { await api.post(`/website/problem-pages/${id}/regenerate`, { problem_hint: draft.problem_hint || "" }); toast.success(t("website.pp.regenOk")); setEditing(null); await load(); }
    catch { toast.error(t("website.pp.regenErr")); } finally { setBusy(false); }
  };
  const [adding, setAdding] = useState(null);
  const [addHint, setAddHint] = useState("");
  const addPage = async (service) => {
    setBusy(true);
    try { await api.post("/website/problem-pages/add", { service_name: service, problem_hint: addHint || "" }); toast.success(t("website.pp.regenOk")); setAdding(null); setAddHint(""); await load(); }
    catch { toast.error(t("website.pp.genErr")); } finally { setBusy(false); }
  };
  const del = async (id) => { try { await api.delete(`/website/problem-pages/${id}`); await load(); } catch { toast.error(t("website.pp.saveErr")); } };
  const saveEdit = async (id) => {
    setBusy(true);
    try {
      await api.put(`/website/problem-pages/${id}`, {
        content: { problem_headline: draft.problem_headline, agitation: draft.agitation, solution: draft.solution, cta_label: draft.cta_label },
        seo: { title: draft.seo_title, meta_description: draft.seo_meta },
        hero_photo_id: draft.hero_photo_id || "",
      });
      toast.success(t("website.pp.saved")); setEditing(null); await load();
    } catch { toast.error(t("website.pp.saveErr")); } finally { setBusy(false); }
  };

  if (items === null) return <Card className="card-elevated border-0 shadow-none p-5"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></Card>;

  const anyPage = items.some((i) => (i.pages || []).length);
  return (
    <div className="space-y-4" data-testid="website-problem-panel">
      <Card className="border-0 shadow-none p-5 bg-gradient-to-br from-orange-500 to-rose-500 text-white">
        <div className="font-heading text-xl font-bold">{t("website.pp.title")}</div>
        <p className="text-sm text-white/85 mt-1">{t("website.pp.desc")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => generate(false)} disabled={busy} data-testid="pp-generate" className="rounded-xl bg-white text-rose-600 hover:bg-white/90 font-bold">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (anyPage ? t("website.pp.generateMissing") : t("website.pp.generate"))}
          </Button>
          {anyPage && <Button onClick={() => generate(true)} disabled={busy} variant="outline" className="rounded-xl bg-white/10 border-white/40 text-white hover:bg-white/20 font-bold">{t("website.pp.regenAll")}</Button>}
        </div>
      </Card>

      {items.length === 0 && <Card className="card-elevated border-0 shadow-none p-5 text-sm text-slate-500">{t("website.pp.empty")}</Card>}

      {items.map((it) => (
        <Card key={it.service_name} className="card-elevated border-0 shadow-none p-4" data-testid={`pp-item-${it.service_name}`}>
          <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
            <div className="font-bold">{it.service_name}</div>
            <button onClick={() => { setAdding(adding === it.service_name ? null : it.service_name); setAddHint(""); }} className="px-3 h-8 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 inline-flex items-center gap-1" data-testid={`pp-add-${it.service_name}`}><Plus className="w-3.5 h-3.5" /> {t("website.pp.addPage")}</button>
          </div>

          {adding === it.service_name && (
            <div className="mb-3 p-3 rounded-xl bg-blue-50 border border-blue-100 space-y-2" data-testid="pp-add-form">
              <Label className="text-xs font-bold text-blue-800">{t("website.pp.focusLabel")}</Label>
              <Textarea rows={2} value={addHint} onChange={(e) => setAddHint(e.target.value)} placeholder={t("website.pp.focusPh")} className="bg-white" data-testid="pp-add-hint" />
              <div className="text-[11px] text-slate-500">{t("website.pp.focusHint")}</div>
              <div className="flex gap-2">
                <Button onClick={() => addPage(it.service_name)} disabled={busy} className="rounded-xl bg-blue-600 hover:bg-blue-700 font-bold" data-testid="pp-create-page">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t("website.pp.createPage")}</Button>
                <Button onClick={() => setAdding(null)} variant="outline" className="rounded-xl">{t("website.pp.cancel")}</Button>
              </div>
            </div>
          )}

          {it.pages.length === 0 && <div className="text-xs text-slate-400">{t("website.pp.noPage")}</div>}

          {it.pages.map((pp) => (
            <div key={pp.id} className="pt-3 mt-3 border-t border-slate-100 first:border-t-0 first:pt-0 first:mt-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    {pp.published
                      ? <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700">✓ {t("website.pp.published")}</span>
                      : <span className="px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">⚠ {t("website.pp.review")}</span>}
                    <span className="font-semibold text-slate-600 truncate">{pp.content?.problem_headline || pp.page_slug}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">/p/{pp.page_slug}</div>
                </div>
                <div className="flex items-center gap-2">
                  <a href={`${origin}/sitio/${slug}/p/${pp.page_slug}?preview=1`} target="_blank" rel="noreferrer" className="px-3 h-9 rounded-lg text-sm font-semibold bg-slate-100 hover:bg-slate-200 inline-flex items-center gap-1.5" data-testid={`pp-view-${pp.page_slug}`}><Eye className="w-4 h-4" /> {t("website.pp.view")}</a>
                  <button onClick={() => openEdit(pp)} className="px-3 h-9 rounded-lg text-sm font-semibold bg-slate-100 hover:bg-slate-200" data-testid={`pp-edit-${pp.page_slug}`}>{t("website.pp.edit")}</button>
                  <button onClick={() => regenerate(pp.id)} disabled={busy} className="px-3 h-9 rounded-lg text-sm font-semibold bg-slate-100 hover:bg-slate-200">{t("website.pp.regen")}</button>
                  <button onClick={() => del(pp.id)} className="px-2.5 h-9 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100" data-testid={`pp-delete-${pp.page_slug}`}><Trash2 className="w-4 h-4" /></button>
                  <div className="flex items-center gap-1.5"><span className="text-xs text-slate-500">{t("website.pp.publish")}</span><Switch checked={pp.published} onCheckedChange={(v) => publish(pp.id, v)} data-testid={`pp-publish-${pp.page_slug}`} /></div>
                </div>
              </div>

              {editing === pp.id && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5" data-testid="pp-edit-form">
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <Label className="text-xs font-bold text-amber-800">{t("website.pp.focusLabel")}</Label>
                    <Textarea rows={2} value={draft.problem_hint || ""} onChange={(e) => setDraft({ ...draft, problem_hint: e.target.value })} placeholder={t("website.pp.focusPh")} className="mt-1 bg-white" data-testid="pp-problem-hint" />
                    <div className="text-[11px] text-slate-500 mt-1">{t("website.pp.focusHint")}</div>
                    <Button onClick={() => regenWithProblem(pp.id)} disabled={busy} className="mt-2 rounded-xl bg-amber-600 hover:bg-amber-700 font-bold" data-testid="pp-regen-problem">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t("website.pp.regenProblem")}</Button>
                  </div>
                  <div><Label className="text-xs">{t("website.pp.headline")}</Label><Input value={draft.problem_headline || ""} onChange={(e) => setDraft({ ...draft, problem_headline: e.target.value })} /></div>
                  <div><Label className="text-xs">{t("website.pp.agitation")}</Label><Textarea rows={2} value={draft.agitation || ""} onChange={(e) => setDraft({ ...draft, agitation: e.target.value })} /></div>
                  <div><Label className="text-xs">{t("website.pp.solution")}</Label><Textarea rows={2} value={draft.solution || ""} onChange={(e) => setDraft({ ...draft, solution: e.target.value })} /></div>
                  <div><Label className="text-xs">{t("website.pp.cta")}</Label><Input value={draft.cta_label || ""} onChange={(e) => setDraft({ ...draft, cta_label: e.target.value })} /></div>
                  <div>
                    <Label className="text-xs">{t("website.pp.hero")}</Label>
                    <div className="flex gap-2 flex-wrap mt-1.5">
                      {photos.map((ph) => (
                        <button key={ph.id} type="button" onClick={() => setDraft({ ...draft, hero_photo_id: ph.id })}
                          className={`w-16 h-16 rounded-lg overflow-hidden border-2 ${draft.hero_photo_id === ph.id ? "border-blue-600" : "border-transparent"}`} data-testid={`pp-hero-pick-${ph.id}`}>
                          <img src={photoSrc(ph.id)} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                      <button type="button" onClick={() => setDraft({ ...draft, hero_photo_id: "" })}
                        className={`w-16 h-16 rounded-lg border-2 text-[10px] font-semibold text-slate-500 flex items-center justify-center text-center px-1 ${!draft.hero_photo_id ? "border-blue-600 bg-blue-50" : "border-slate-200"}`} data-testid="pp-hero-auto">
                        {t("website.pp.heroAuto")}
                      </button>
                    </div>
                  </div>
                  <div><Label className="text-xs">{t("website.pp.seoTitle")}</Label><Input value={draft.seo_title || ""} onChange={(e) => setDraft({ ...draft, seo_title: e.target.value })} /></div>
                  <div><Label className="text-xs">{t("website.pp.seoMeta")}</Label><Textarea rows={2} value={draft.seo_meta || ""} onChange={(e) => setDraft({ ...draft, seo_meta: e.target.value })} /></div>
                  <div className="flex gap-2 pt-1">
                    <Button onClick={() => saveEdit(pp.id)} disabled={busy} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t("website.pp.save")}</Button>
                    <Button onClick={() => setEditing(null)} variant="outline" className="rounded-xl">{t("website.pp.cancel")}</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}

