import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Globe, ExternalLink, Copy, Loader2, Check, CheckCircle2, Palette, Sparkles, Plus, Trash2, ImagePlus, ListChecks, HelpCircle, MapPin, Search, Briefcase, Wand2, Eye, Images, MessageSquare, ArrowUp, ArrowDown, ArrowRight, Bot, FileText, CalendarClock, Instagram } from "lucide-react";
import { toast } from "sonner";

const TEMPLATES = ["cinematic", "responder", "bento", "craftsman", "trust", "slider", "onepage", "neon", "playful", "luxe"];
const TPL_SWATCH = { cinematic: "#0A0A0F", responder: "#DC2626", bento: "#2563EB", craftsman: "#B45309", trust: "#0F766E", slider: "#111827", onepage: "#FAFAFA", neon: "#0A0A0C", playful: "#FF8A3D", luxe: "#141414" };
const SECTION_KEYS = ["services", "about", "feature", "gallery", "reviews", "how", "why", "band", "faq", "areas"];
const COLORS = ["#007AFF", "#1D4ED8", "#0EA5E9", "#10B981", "#2F5233", "#F97316", "#FF3B30", "#7C3AED", "#0A0A0A"];
const TABS = ["publish", "design", "content", "services", "media", "forms", "sections"];
// Curated color palettes per template — one tap for a pro look.
const PALETTES = {
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
  const [domain, setDomain] = useState(null);
  const [domainInput, setDomainInput] = useState("");
  const [domainBusy, setDomainBusy] = useState(false);
  const [domainMsg, setDomainMsg] = useState("");
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
    api.get("/website/domain").then(({ data }) => { setDomain(data); setDomainInput(data.domain || ""); }).catch(() => {});
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

  const uploadServiceImg = async (i, file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/photos?label=service", fd, { headers: { "Content-Type": "multipart/form-data" } });
      listSet("services", i, "image_id", data.id);
      toast.success(t("website.serviceImgAdded"));
    } catch {
      toast.error(t("website.aiError"));
    }
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

  const saveDomain = async () => {
    setDomainBusy(true); setDomainMsg("");
    try {
      const { data } = await api.post("/website/domain", { domain: domainInput });
      setDomain(data); setDomainInput(data.domain); toast.success(t("website.domainSaved"));
    } catch (e) { toast.error(e?.response?.data?.detail || t("website.saveError")); }
    finally { setDomainBusy(false); }
  };
  const verifyDomain = async () => {
    setDomainBusy(true);
    try {
      const { data } = await api.post("/website/domain/verify");
      setDomain(data); setDomainMsg(data.message || "");
      if (data.verified) toast.success(t("website.domainVerified"));
    } catch (e) { toast.error(e?.response?.data?.detail || t("website.saveError")); }
    finally { setDomainBusy(false); }
  };
  const verifyDomainA = async () => {
    setDomainBusy(true);
    try {
      const { data } = await api.post("/website/domain/verify-a");
      setDomain(data); setDomainMsg(data.message || "");
      if (data.connected) toast.success(t("website.domainConnected"));
      else if (data.a_ok) toast.success(t("website.domainAok"));
    } catch (e) { toast.error(e?.response?.data?.detail || t("website.saveError")); }
    finally { setDomainBusy(false); }
  };
  const removeDomain = async () => {
    await api.delete("/website/domain");
    setDomain({ domain: "", verified: false }); setDomainInput(""); setDomainMsg("");
    toast.success(t("website.domainRemoved"));
  };
  const copyText = (v) => { navigator.clipboard.writeText(v); toast.success(t("website.linkCopied")); };

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
            {TABS.map((tb) => (
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
              <div key={id} className="flex items-center gap-3 p-2 rounded-xl bg-slate-50" data-testid={`website-gallery-item-${idx}`}>
                <span className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center flex-none">{idx + 1}</span>
                <img src={photoSrc(id)} alt="" className="w-12 h-12 rounded-lg object-cover flex-none" />
                <div className="flex-1" />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveGallery(idx, -1)} disabled={idx === 0} data-testid={`website-gallery-up-${idx}`}><ArrowUp className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveGallery(idx, 1)} disabled={idx === galIds().length - 1} data-testid={`website-gallery-down-${idx}`}><ArrowDown className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={() => toggleGallery(id)} data-testid={`website-gallery-remove-${idx}`}><Trash2 className="w-4 h-4" /></Button>
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

      {/* Custom Domain */}
      {tab === "publish" && (
      <Card className="card-elevated border-0 shadow-none p-5">
        <div className="font-semibold mb-1 flex items-center gap-2"><Globe className="w-4 h-4" /> {t("website.domainTitle")}
          {domain?.connected
            ? <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700">{t("website.domainConnectedBadge")}</span>
            : domain?.verified && <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">{t("website.domainVerifiedBadge")}</span>}
        </div>
        <p className="text-sm text-slate-500 mb-3">{t("website.domainDesc")}</p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">https://</span>
          <Input value={domainInput} onChange={(e) => setDomainInput(e.target.value)} placeholder="mybusiness.com" className="h-11 rounded-xl" data-testid="website-domain-input" />
          <Button onClick={saveDomain} disabled={domainBusy || !domainInput} className="rounded-xl h-11 flex-none" data-testid="website-domain-save">{domainBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : t("website.save")}</Button>
        </div>

        {domain?.domain && domain.connected && (
          <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4" data-testid="website-domain-connected">
            <div className="flex items-center gap-2 text-emerald-800 font-bold"><CheckCircle2 className="w-5 h-5" /> {t("website.domainConnectedTitle")}</div>
            <p className="text-sm text-emerald-700 mt-1">{t("website.domainConnectedDesc")}</p>
            <a href={`https://${domain.domain}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:underline" data-testid="website-domain-visit"><Globe className="w-4 h-4" /> {domain.domain}</a>
            {!w.published && (
              <div className="mt-3 rounded-lg bg-amber-100 border border-amber-300 p-2.5 text-xs text-amber-900" data-testid="website-domain-publish-warn">
                {t("website.domainPublishWarn")}
              </div>
            )}
            <div className="mt-3">
              <button onClick={removeDomain} className="text-xs text-slate-400 hover:text-red-500 font-semibold" data-testid="website-domain-remove">{t("website.domainRemove")}</button>
            </div>
          </div>
        )}

        {domain?.domain && !domain.connected && (
          <div className="mt-4 space-y-3">
            {/* Step 1 — verify ownership (TXT) */}
            <div className={`rounded-xl border p-3 text-sm ${domain.verified ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
              <div className="font-bold mb-2 flex items-center gap-1.5" style={{ color: domain.verified ? "#065f46" : "#78350f" }}>
                {domain.verified && <CheckCircle2 className="w-4 h-4" />}{t("website.domainStep1")}
              </div>
              {!domain.verified ? (
                <>
                  <DnsRow label="Type" value="TXT" onCopy={copyText} />
                  <DnsRow label="Host / Name" value={domain.txt_host} onCopy={copyText} />
                  <DnsRow label="Value" value={domain.txt_value} onCopy={copyText} />
                  <Button onClick={verifyDomain} disabled={domainBusy} size="sm" className="rounded-xl h-9 mt-2 bg-amber-600 hover:bg-amber-700" data-testid="website-domain-verify">
                    {domainBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : t("website.domainVerifyBtn")}
                  </Button>
                </>
              ) : (
                <p className="text-xs text-emerald-700">{t("website.domainStep1Done")}</p>
              )}
            </div>

            {/* Step 2 — point the A record */}
            <div className={`rounded-xl border p-3 text-sm ${domain.a_ok ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
              <div className="font-bold mb-2 flex items-center gap-1.5" style={{ color: domain.a_ok ? "#065f46" : "#334155" }}>
                {domain.a_ok && <CheckCircle2 className="w-4 h-4" />}{t("website.domainStep2")}
              </div>
              {!domain.a_ok ? (
                <>
                  <div className="text-xs text-slate-500 mb-2">{domain.is_subdomain ? t("website.domainSubLabel") : t("website.domainRootLabel")}</div>
                  <DnsRow label="Type" value="A" onCopy={copyText} />
                  <DnsRow label="Host / Name" value={domain.a_host || "@"} onCopy={copyText} />
                  <DnsRow label="Points to" value={domain.a_target || t("website.domainAskHost")} onCopy={domain.a_target ? copyText : undefined} />
                  {domain.a_target && !domain.is_subdomain && (
                    <>
                      <div className="text-xs text-slate-500 mt-3 mb-2">{t("website.domainWwwLabel")}</div>
                      <DnsRow label="Type" value="A" onCopy={copyText} />
                      <DnsRow label="Host / Name" value="www" onCopy={copyText} />
                      <DnsRow label="Points to" value={domain.a_target} onCopy={copyText} />
                    </>
                  )}
                  <p className="text-xs text-slate-500 mt-3">{t("website.domainStep2Note")}</p>
                  <p className="text-xs text-slate-500 mt-1">{t("website.domainSslNote")}</p>
                  <Button onClick={verifyDomainA} disabled={domainBusy} size="sm" className="rounded-xl h-9 mt-2 bg-blue-600 hover:bg-blue-700" data-testid="website-domain-verify-a">
                    {domainBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : t("website.domainVerifyABtn")}
                  </Button>
                </>
              ) : (
                <p className="text-xs text-emerald-700">{t("website.domainStep2Done")}</p>
              )}
            </div>

            {domainMsg && <p className="text-xs text-slate-600" data-testid="website-domain-msg">{domainMsg}</p>}
            <button onClick={removeDomain} className="text-xs text-slate-400 hover:text-red-500 font-semibold" data-testid="website-domain-remove">{t("website.domainRemove")}</button>
          </div>
        )}
      </Card>
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
              {s.image_id && <button onClick={() => listSet("services", i, "image_id", "")} className="text-xs text-slate-400 ml-auto" data-testid={`website-service-img-del-${i}`}>{t("website.removePhoto")}</button>}
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
  const { slug, template, accent_color, published, headline, subheadline, about, hero_photo_id, sections, cta_phone, service_area, hours, how_it_works, why_us, faqs, areas, services, seo_title, seo_description, gallery_photo_ids, chat_enabled, chat_launcher, chat_position, before_after, team_photo_id, about_photo_ids, why_photo_id, band_photo_id, instagram_url, ai_brief } = w;
  return { slug, template, accent_color, published, headline, subheadline, about, hero_photo_id, sections, cta_phone, service_area, hours, how_it_works, why_us, faqs, areas, services, seo_title, seo_description, gallery_photo_ids, chat_enabled, chat_launcher, chat_position, before_after, team_photo_id, about_photo_ids, why_photo_id, band_photo_id, instagram_url, ai_brief };
}

function DnsRow({ label, value, onCopy }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs font-semibold text-slate-500 w-24 flex-none">{label}</span>
      <code className="flex-1 text-xs bg-white border border-slate-200 rounded px-2 py-1 truncate">{value}</code>
      {onCopy && <button onClick={() => onCopy(value)} className="text-slate-400 hover:text-slate-700 flex-none"><Copy className="w-3.5 h-3.5" /></button>}
    </div>
  );
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

