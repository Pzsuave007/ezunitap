import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Globe, ExternalLink, Copy, Loader2, Check, Palette, Sparkles, Plus, Trash2, ImagePlus, ListChecks, HelpCircle, MapPin, Search } from "lucide-react";
import { toast } from "sonner";

const TEMPLATES = ["clean", "bold", "warm"];
const TPL_SWATCH = { clean: "#007AFF", bold: "#FF3B30", warm: "#2F5233" };
const SECTION_KEYS = ["services", "gallery", "reviews", "how", "why", "faq", "areas", "about", "contact", "booking"];
const COLORS = ["#007AFF", "#1D4ED8", "#0EA5E9", "#10B981", "#2F5233", "#F97316", "#FF3B30", "#7C3AED", "#0A0A0A"];
const photoSrc = (id) => `${process.env.REACT_APP_BACKEND_URL}/api/public/card/photo/${id}`;

export default function WebsiteEditor() {
  const { t } = useTranslation();
  const [w, setW] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const publicUrl = w ? `${window.location.origin}/sitio/${w.slug}` : "";

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

  const generate = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post("/website/ai-generate");
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
      });
      toast.success(t("website.aiDone"));
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("website.aiError"));
    } finally { setGenerating(false); }
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
    <div className="max-w-3xl mx-auto space-y-5" data-testid="website-editor">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center flex-none"><Globe className="w-5 h-5 text-blue-700" /></div>
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">{t("website.title")}</h1>
          <p className="text-slate-500 text-sm">{t("website.subtitle")}</p>
        </div>
      </div>

      {/* AI Generate */}
      <Card className="border-0 shadow-none p-5 bg-gradient-to-br from-violet-600 to-indigo-600 text-white">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-none"><Sparkles className="w-5 h-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-lg">{t("website.aiTitle")}</div>
            <p className="text-sm text-white/85 mt-0.5">{t("website.aiDesc")}</p>
            <Button onClick={generate} disabled={generating} data-testid="website-ai-generate"
              className="mt-4 rounded-xl h-12 bg-white text-indigo-700 hover:bg-white/90 font-bold w-full sm:w-auto">
              {generating ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("website.aiWorking")}</> : <><Sparkles className="w-4 h-4 mr-2" /> {t("website.aiBtn")}</>}
            </Button>
          </div>
        </div>
      </Card>

      {/* Publish + link */}
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
          <a href={publicUrl} target="_blank" rel="noreferrer"><Button variant="outline" className="rounded-xl h-11 flex-none"><ExternalLink className="w-4 h-4" /></Button></a>
        </div>
        <div className="mt-3">
          <Label>{t("website.customLink")}</Label>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-sm text-slate-400">/sitio/</span>
            <Input value={w.slug} onChange={(e) => patch({ slug: e.target.value })} onBlur={saveAndToast} className="h-11 rounded-xl" data-testid="website-slug" />
          </div>
        </div>
      </Card>

      {/* Templates */}
      <Card className="card-elevated border-0 shadow-none p-5">
        <div className="font-semibold mb-3">{t("website.template")}</div>
        <div className="grid sm:grid-cols-3 gap-3">
          {TEMPLATES.map((key) => (
            <button key={key} onClick={() => save({ template: key })} data-testid={`website-tpl-${key}`}
              className={`text-left p-4 rounded-2xl border-2 transition-all ${w.template === key ? "border-blue-600 bg-blue-50/50" : "border-slate-200 hover:border-slate-300"}`}>
              <div className="w-full h-16 rounded-lg mb-2" style={{ background: TPL_SWATCH[key] }} />
              <div className="font-bold text-sm">{t(`website.tpl.${key}Name`)}</div>
              <div className="text-xs text-slate-500">{t(`website.tpl.${key}Desc`)}</div>
            </button>
          ))}
        </div>
      </Card>

      {/* Brand color */}
      <Card className="card-elevated border-0 shadow-none p-5">
        <div className="font-semibold mb-3 flex items-center gap-2"><Palette className="w-4 h-4" /> {t("website.brandColor")}</div>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button key={c} onClick={() => save({ accent_color: c })} data-testid={`website-color-${c}`}
              className={`w-9 h-9 rounded-full border-2 transition-transform ${w.accent_color?.toLowerCase() === c.toLowerCase() ? "ring-2 ring-offset-2 ring-slate-800 scale-110" : "border-white"}`}
              style={{ background: c }} aria-label={c} />
          ))}
        </div>
      </Card>

      {/* Hero photo */}
      <Card className="card-elevated border-0 shadow-none p-5">
        <div className="font-semibold mb-1 flex items-center gap-2"><ImagePlus className="w-4 h-4" /> {t("website.heroPhoto")}</div>
        <p className="text-sm text-slate-500 mb-3">{t("website.heroPhotoDesc")}</p>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadHero} data-testid="website-hero-upload-input" />
        <div className="flex flex-wrap gap-3">
          <button onClick={() => fileRef.current?.click()} disabled={uploading} data-testid="website-hero-upload"
            className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-slate-400 flex-none">
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /><span className="text-xs mt-1">{t("website.upload")}</span></>}
          </button>
          {photos.slice(0, 11).map((p) => (
            <button key={p.id} onClick={() => save({ hero_photo_id: p.id })} data-testid={`website-hero-pick-${p.id}`}
              className={`w-24 h-24 rounded-xl overflow-hidden border-2 flex-none transition-all ${w.hero_photo_id === p.id ? "border-blue-600 ring-2 ring-blue-200" : "border-transparent hover:border-slate-300"}`}>
              <img src={photoSrc(p.id)} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
        {photos.length === 0 && <p className="text-xs text-slate-400 mt-2">{t("website.noPhotos")}</p>}
      </Card>

      {/* Content */}
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

      {/* How It Works */}
      <Card className="card-elevated border-0 shadow-none p-5 space-y-3">
        <div className="font-semibold flex items-center gap-2"><ListChecks className="w-4 h-4" /> {t("website.howTitle")}</div>
        {(w.how_it_works || []).map((s, i) => (
          <div key={i} className="p-3 rounded-xl bg-slate-50 space-y-2" data-testid={`website-how-${i}`}>
            <div className="flex items-center gap-2">
              <Input value={s.title || ""} onChange={(e) => listSet("how_it_works", i, "title", e.target.value)} className="h-11 rounded-lg bg-white" placeholder={t("website.stepTitle")} />
              <Button variant="ghost" size="icon" onClick={() => listDel("how_it_works", i)} className="text-slate-400 flex-none" data-testid={`website-how-del-${i}`}><Trash2 className="w-4 h-4" /></Button>
            </div>
            <Textarea value={s.desc || ""} onChange={(e) => listSet("how_it_works", i, "desc", e.target.value)} className="rounded-lg bg-white min-h-[60px]" placeholder={t("website.stepDesc")} />
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

      {/* Sections */}
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

      <p className="text-center text-xs text-slate-400 pb-4">{t("website.autofillNote")}</p>
    </div>
  );
}

function pick(w) {
  const { slug, template, accent_color, published, headline, subheadline, about, hero_photo_id, sections, cta_phone, service_area, hours, how_it_works, why_us, faqs, areas, seo_title, seo_description } = w;
  return { slug, template, accent_color, published, headline, subheadline, about, hero_photo_id, sections, cta_phone, service_area, hours, how_it_works, why_us, faqs, areas, seo_title, seo_description };
}
