import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Globe, ExternalLink, Copy, Loader2, Check, Palette } from "lucide-react";
import { toast } from "sonner";

const TEMPLATES = ["clean", "bold", "warm"];
const TPL_SWATCH = { clean: "#007AFF", bold: "#FF3B30", warm: "#2F5233" };
const SECTION_KEYS = ["services", "gallery", "reviews", "about", "contact", "booking"];
const COLORS = ["#007AFF", "#1D4ED8", "#0EA5E9", "#10B981", "#2F5233", "#F97316", "#FF3B30", "#7C3AED", "#0A0A0A"];

export default function WebsiteEditor() {
  const { t } = useTranslation();
  const [w, setW] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const publicUrl = w ? `${window.location.origin}/sitio/${w.slug}` : "";

  useEffect(() => { api.get("/website").then(({ data }) => setW(data)).catch(() => toast.error(t("website.loadError"))); }, [t]);

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

  if (!w) return <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-5" data-testid="website-editor">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center flex-none"><Globe className="w-5 h-5 text-blue-700" /></div>
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">{t("website.title")}</h1>
          <p className="text-slate-500 text-sm">{t("website.subtitle")}</p>
        </div>
      </div>

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
        <Button onClick={saveAndToast} disabled={saving} className="rounded-xl h-12 bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto" data-testid="website-save-content">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("website.saveContent")}
        </Button>
      </Card>

      {/* Sections */}
      <Card className="card-elevated border-0 shadow-none p-5">
        <div className="font-semibold mb-1">{t("website.sections")}</div>
        <p className="text-sm text-slate-500 mb-3">{t("website.sectionsDesc")}</p>
        <div className="space-y-1">
          {SECTION_KEYS.map((key) => (
            <div key={key} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
              <span className="text-sm">{t(`website.sec.${key}`)}</span>
              <Switch checked={!!w.sections?.[key]} data-testid={`website-section-${key}`}
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
  const { slug, template, accent_color, published, headline, subheadline, about, hero_photo_id, sections, cta_phone, service_area, hours } = w;
  return { slug, template, accent_color, published, headline, subheadline, about, hero_photo_id, sections, cta_phone, service_area, hours };
}
