import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Store, Loader2, ImagePlus, X, BadgeCheck, ExternalLink, Crown,
  MapPin, Phone, Mail, Globe, Eye, Rocket, ArrowRight,
} from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

export default function DirectoryProfileEditor() {
  const { i18n } = useTranslation();
  const { hasFeature } = useAuth();
  const es = (i18n.language || "es").startsWith("es");
  const T = (en, esT) => (es ? esT : en);

  const [profile, setProfile] = useState(null);
  const [cats, setCats] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});
  const heroRef = useRef(null);
  const logoRef = useRef(null);
  const galRef = useRef(null);

  const fullAccess = hasFeature("business") || hasFeature("card") || hasFeature("marketing");

  const load = async () => {
    try {
      const [p, c] = await Promise.all([
        api.get("/directory/profile"),
        api.get("/public/directory/config"),
      ]);
      setProfile(p.data);
      setForm({
        business_name: p.data.business_name || "",
        phone: p.data.phone || "",
        email: p.data.email || "",
        city: p.data.city || "",
        state: p.data.state || "",
        zip: p.data.zip || "",
        service_area: p.data.service_area || "",
        about: p.data.about || "",
        website_url: p.data.website_url || "",
        categories: p.data.categories || [],
      });
      setCats(c.data.categories || []);
      setConfig(c.data.config || null);
    } catch {
      toast.error(T("Couldn't load your profile", "No se pudo cargar tu ficha"));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleCat = (slug) => setForm((f) => {
    const has = (f.categories || []).includes(slug);
    if (has) return { ...f, categories: f.categories.filter((s) => s !== slug) };
    if ((f.categories || []).length >= 6) { toast.error(T("Max 6 services", "Máximo 6 servicios")); return f; }
    return { ...f, categories: [...(f.categories || []), slug] };
  });

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/directory/profile", form);
      setProfile(data);
      toast.success(T("Saved", "Guardado"));
    } catch (e) {
      toast.error(e?.response?.data?.detail || T("Couldn't save", "No se pudo guardar"));
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (file, slot) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("slot", slot);
    try {
      await api.post("/directory/profile/photo", fd, { headers: { "Content-Type": "multipart/form-data" } });
      await load();
      toast.success(T("Photo added", "Foto agregada"));
    } catch {
      toast.error(T("Couldn't upload photo", "No se pudo subir la foto"));
    }
  };

  const removeGallery = async (url) => {
    const pid = url.split("/").pop();
    try { await api.delete(`/directory/profile/gallery/${pid}`); await load(); } catch {}
  };

  const togglePublish = async () => {
    try {
      const { data } = await api.post("/directory/profile/publish", { published: !profile.published });
      setProfile(data);
      toast.success(data.published ? T("Published!", "¡Publicada!") : T("Unpublished", "Despublicada"));
    } catch (e) {
      toast.error(e?.response?.data?.detail || T("Couldn't publish", "No se pudo publicar"));
    }
  };

  const requestBadge = async () => {
    try {
      const { data } = await api.post("/directory/profile/badge-request");
      setProfile(data);
      toast.success(T("Badge requested — we'll review it", "Sello solicitado — lo revisaremos"));
    } catch {}
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const dirName = config?.name || "Pro Finder";
  const publicUrl = profile?.slug ? `/directorio/${(form.categories?.[0] || "contratista")}/${(form.city || "ciudad").toLowerCase().replace(/\s+/g, "-")}-${(form.state || "").toLowerCase()}/${profile.slug}` : "/directorio";

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5" data-testid="directory-editor">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center flex-none">
          <Store className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight">{T("My Directory Profile", "Mi Ficha En Directorio")}</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {T(`Free listing on ${dirName} so customers find you.`, `Aparece gratis en ${dirName} para que los clientes te encuentren.`)}
          </p>
        </div>
      </div>

      {/* Upsell banner for free (directory-only) users */}
      {!fullAccess && (
        <Card className="p-4 border-0 bg-gradient-to-br from-amber-50 to-white ring-1 ring-amber-200" data-testid="directory-upsell">
          <div className="flex items-start gap-3">
            <Crown className="w-5 h-5 text-amber-500 flex-none mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-sm text-slate-800">{T("You're on the free Directory plan", "Estás en el plan gratuito del Directorio")}</p>
              <p className="text-xs text-slate-500 mt-0.5">{T("Unlock your website, quotes, invoices, CRM and AI marketing to turn these leads into paying jobs.", "Activa tu página web, cotizaciones, facturas, CRM y marketing con IA para convertir estos leads en trabajos pagados.")}</p>
              <Button data-testid="directory-activate-btn" onClick={() => (window.location.href = "/precios")}
                className="mt-3 h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-white">
                {T("Activate full UniTech", "Activar todo UniTech")} <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Publish + badge */}
      <Card className="p-4 border-0 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-sm text-slate-800">{T("Show my profile publicly", "Mostrar mi ficha al público")}</p>
            <p className="text-xs text-slate-500">{profile.published ? T("Live on the directory", "Visible en el directorio") : T("Hidden — only you can see it", "Oculta — solo tú la ves")}</p>
          </div>
          <Switch checked={!!profile.published} onCheckedChange={togglePublish} data-testid="directory-publish-switch" />
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
          {profile.badge_status === "approved" ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full" data-testid="directory-badge-approved">
              <BadgeCheck className="w-4 h-4" /> {T("Sponsor badge active", "Sello de patrocinador activo")}
            </span>
          ) : profile.badge_status === "pending" ? (
            <span className="text-sm text-amber-600 font-medium" data-testid="directory-badge-pending">{T("Badge under review…", "Sello en revisión…")}</span>
          ) : (
            <Button variant="outline" size="sm" onClick={requestBadge} data-testid="directory-badge-request"
              className="rounded-xl">
              <BadgeCheck className="w-4 h-4 mr-1.5" /> {T("Request sponsor badge", "Solicitar sello de patrocinador")}
            </Button>
          )}
          {profile.published && (
            <a href={publicUrl} target="_blank" rel="noreferrer" data-testid="directory-view-public"
              className="inline-flex items-center gap-1.5 text-sm text-emerald-700 font-semibold ml-auto">
              <Eye className="w-4 h-4" /> {T("View my public profile", "Ver mi ficha pública")} <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </Card>

      {/* Photos */}
      <Card className="p-4 border-0 shadow-sm space-y-4">
        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">{T("Photos", "Fotos")}</Label>
        <div className="flex gap-3">
          <PhotoBox label={T("Logo", "Logo")} url={profile.logo_url} onClick={() => logoRef.current?.click()} testId="directory-logo" round />
          <PhotoBox label={T("Cover photo", "Foto principal")} url={profile.hero_url} onClick={() => heroRef.current?.click()} testId="directory-hero" />
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1.5">{T("Work gallery (up to 12)", "Galería de trabajos (hasta 12)")}</p>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2" data-testid="directory-gallery">
            {(profile.gallery_urls || []).map((u) => (
              <div key={u} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group">
                <img src={`${BACKEND}${u}`} alt="" className="w-full h-full object-cover" />
                <button onClick={() => removeGallery(u)} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button onClick={() => galRef.current?.click()} data-testid="directory-gallery-add"
              className="aspect-square rounded-lg border-2 border-dashed border-slate-300 hover:border-emerald-400 bg-slate-50 flex items-center justify-center text-slate-400">
              <ImagePlus className="w-5 h-5" />
            </button>
          </div>
        </div>
        <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => { uploadPhoto(e.target.files?.[0], "logo"); e.target.value = ""; }} />
        <input ref={heroRef} type="file" accept="image/*" hidden onChange={(e) => { uploadPhoto(e.target.files?.[0], "hero"); e.target.value = ""; }} />
        <input ref={galRef} type="file" accept="image/*" hidden onChange={(e) => { uploadPhoto(e.target.files?.[0], "gallery"); e.target.value = ""; }} />
      </Card>

      {/* Details */}
      <Card className="p-4 border-0 shadow-sm space-y-4">
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">{T("Business name", "Nombre del negocio")}</Label>
          <Input data-testid="directory-name-input" value={form.business_name} onChange={(e) => setField("business_name", e.target.value)} className="mt-1.5 rounded-xl" />
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">{T("Services you offer", "Servicios que ofreces")}</Label>
          <div className="flex flex-wrap gap-2 mt-2" data-testid="directory-categories">
            {cats.map((c) => {
              const on = (form.categories || []).includes(c.slug);
              return (
                <button key={c.slug} onClick={() => toggleCat(c.slug)} data-testid={`directory-cat-${c.slug}`}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${on ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-200 text-slate-600 hover:border-emerald-300"}`}>
                  {es ? c.es : c.en}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{T("City", "Ciudad")}</Label>
            <Input data-testid="directory-city-input" value={form.city} onChange={(e) => setField("city", e.target.value)} className="mt-1.5 rounded-xl" placeholder="Houston" />
          </div>
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">{T("State", "Estado")}</Label>
            <Input data-testid="directory-state-input" value={form.state} onChange={(e) => setField("state", e.target.value)} maxLength={2} className="mt-1.5 rounded-xl uppercase" placeholder="TX" />
          </div>
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">{T("ZIP", "Código postal")}</Label>
            <Input data-testid="directory-zip-input" value={form.zip} onChange={(e) => setField("zip", e.target.value)} className="mt-1.5 rounded-xl" placeholder="77002" />
          </div>
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">{T("Service area", "Zona de servicio")}</Label>
          <Input data-testid="directory-area-input" value={form.service_area} onChange={(e) => setField("service_area", e.target.value)} className="mt-1.5 rounded-xl" placeholder={T("Greater Houston area", "Houston y alrededores")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{T("Phone", "Teléfono")}</Label>
            <Input data-testid="directory-phone-input" value={form.phone} onChange={(e) => setField("phone", e.target.value)} className="mt-1.5 rounded-xl" />
          </div>
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{T("Email", "Correo")}</Label>
            <Input data-testid="directory-email-input" value={form.email} onChange={(e) => setField("email", e.target.value)} className="mt-1.5 rounded-xl" />
          </div>
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1"><Globe className="w-3.5 h-3.5" />{T("Website (optional)", "Sitio web (opcional)")}</Label>
          <Input data-testid="directory-website-input" value={form.website_url} onChange={(e) => setField("website_url", e.target.value)} className="mt-1.5 rounded-xl" placeholder="https://" />
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">{T("About your business", "Sobre tu negocio")}</Label>
          <Textarea data-testid="directory-about-input" value={form.about} onChange={(e) => setField("about", e.target.value)} className="mt-1.5 rounded-xl min-h-[90px]" placeholder={T("What you do, your experience, what makes you different…", "Qué haces, tu experiencia, qué te hace diferente…")} />
        </div>
        <Button onClick={save} disabled={saving} data-testid="directory-save-btn" className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700">
          {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Rocket className="w-5 h-5 mr-2" />}
          {T("Save profile", "Guardar ficha")}
        </Button>
      </Card>
    </div>
  );
}

function PhotoBox({ label, url, onClick, testId, round }) {
  return (
    <button onClick={onClick} data-testid={testId}
      className={`relative ${round ? "w-20 h-20 rounded-full" : "flex-1 h-20 rounded-xl"} overflow-hidden border-2 border-dashed border-slate-300 hover:border-emerald-400 bg-slate-50 flex items-center justify-center`}>
      {url ? <img src={`${BACKEND}${url}`} alt={label} className="w-full h-full object-cover" /> : (
        <span className="flex flex-col items-center text-slate-400 text-[11px] font-semibold"><ImagePlus className="w-5 h-5 mb-0.5" />{label}</span>
      )}
    </button>
  );
}
