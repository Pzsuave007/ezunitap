/**
 * Smart Card admin page: customize, QR, analytics, reviews, social posts.
 */
import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  IdCard, QrCode, Copy, ExternalLink, Eye, Plus, Trash2, Loader2,
  Star, Sparkles, BarChart3, Download, Share2, ShieldCheck, BadgeCheck,
  Image as ImageIcon, Upload, X as XIcon, Camera,
  Phone, MessageSquare, Send, Mail, Globe, Save,
  Sprout, Hammer, PaintBucket, Wind, Wrench, Home,
} from "lucide-react";
import { toast } from "sonner";

const SERVICE_TEMPLATES = [
  { name: "Roofing", icon: "🏠", description: "Repairs, replacements, inspections." },
  { name: "Drywall", icon: "🧱", description: "Repair, install, texture, paint." },
  { name: "Painting", icon: "🎨", description: "Interior & exterior painting." },
  { name: "Concrete", icon: "🪨", description: "Driveways, patios, foundations." },
  { name: "Cleaning", icon: "🧼", description: "Residential and commercial." },
  { name: "Landscaping", icon: "🌿", description: "Lawn, design, maintenance." },
];

// Curated brand + accent palettes (premium, hand-tuned, no muddy AI defaults).
const BRAND_PRESETS = [
  { name: "Midnight", brand: "#1E3A8A", accent: "#10B981" },
  { name: "Obsidian", brand: "#0F172A", accent: "#F59E0B" },
  { name: "Ember", brand: "#7C2D12", accent: "#F97316" },
  { name: "Forest", brand: "#064E3B", accent: "#84CC16" },
  { name: "Royal", brand: "#4C1D95", accent: "#F472B6" },
  { name: "Steel", brand: "#334155", accent: "#22D3EE" },
  { name: "Crimson", brand: "#7F1D1D", accent: "#FBBF24" },
  { name: "Slate", brand: "#1F2937", accent: "#34D399" },
];

const ACCENT_PRESETS = [
  "#10B981", "#34D399", "#22D3EE", "#0EA5E9", "#3B82F6", "#6366F1",
  "#A855F7", "#F472B6", "#F43F5E", "#F97316", "#F59E0B", "#FBBF24",
  "#84CC16", "#FFFFFF",
];

export default function CardAdmin() {
  const [tab, setTab] = useState("design");
  const [card, setCard] = useState(null);
  const [saving, setSaving] = useState(false);
  const [analytics, setAnalytics] = useState({ totals: {}, all_events: 0, leads: 0, reviews: 0 });
  const [reviews, setReviews] = useState([]);
  const [leads, setLeads] = useState([]);
  const { user } = useAuth();

  const baseUrl = window.location.origin;
  const publicUrl = card ? `${baseUrl}/c/${card.slug}` : "";

  const load = async () => {
    const [c, a, r, l] = await Promise.all([
      api.get("/card/settings"),
      api.get("/card/analytics"),
      api.get("/card/reviews"),
      api.get("/card/leads"),
    ]);
    setCard(c.data);
    setAnalytics(a.data);
    setReviews(r.data);
    setLeads(l.data);
  };
  useEffect(() => { load(); }, []);

  const update = (k, v) => setCard({ ...card, [k]: v });

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/card/settings", card);
      setCard(data);
      toast.success("Tarjeta actualizada");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error");
    } finally { setSaving(false); }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(publicUrl);
    toast.success("Link copiado");
  };

  const shareCard = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "My business card", url: publicUrl }); } catch {}
    } else {
      copyLink();
    }
  };

  if (!card) return <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
          <IdCard className="w-7 h-7 text-emerald-600" /> Tarjeta Inteligente
        </h1>
        <p className="text-slate-500 mt-1">Tu mini-sitio profesional que captura leads automáticamente.</p>
      </div>

      {/* Quick share strip */}
      <Card className="card-elevated p-4 border-0 shadow-none">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center flex-shrink-0">
            <Share2 className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Tu link</div>
            <div className="font-semibold text-sm truncate" data-testid="card-public-url">{publicUrl}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button onClick={copyLink} data-testid="card-copy-link" variant="outline" className="h-11 rounded-xl"><Copy className="w-4 h-4 mr-1" /> Copiar</Button>
          <Button onClick={shareCard} data-testid="card-share" variant="outline" className="h-11 rounded-xl"><Share2 className="w-4 h-4 mr-1" /> Compartir</Button>
          <a href={publicUrl} target="_blank" rel="noreferrer" data-testid="card-preview">
            <Button variant="outline" className="h-11 rounded-xl w-full"><Eye className="w-4 h-4 mr-1" /> Ver</Button>
          </a>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 rounded-xl bg-slate-100 p-1 h-auto gap-0.5">
          <TabsTrigger value="design" className="rounded-lg text-[11px] lg:text-xs px-1 py-2" data-testid="card-tab-design">Diseño</TabsTrigger>
          <TabsTrigger value="qr" className="rounded-lg text-[11px] lg:text-xs px-1 py-2" data-testid="card-tab-qr">QR</TabsTrigger>
          <TabsTrigger value="reviews" className="rounded-lg text-[11px] lg:text-xs px-1 py-2" data-testid="card-tab-reviews">Reseñas</TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-lg text-[11px] lg:text-xs px-1 py-2" data-testid="card-tab-analytics">Métricas</TabsTrigger>
        </TabsList>

        <TabsContent value="design" className="mt-4 space-y-3">
          <IndustryTemplatePicker card={card} onApply={async (tpl) => {
            const payload = {
              brand_color: tpl.brand,
              accent_color: tpl.accent,
              hero_layout: tpl.hero_layout || "logo_circle",
            };
            if (tpl.business_type && !card.business_type) payload.business_type = tpl.business_type;
            try {
              const { data } = await api.put("/card/settings", payload);
              setCard(data);
              toast.success(`Plantilla "${tpl.label}" aplicada`, {
                description: tpl.hint,
                duration: 4500,
              });
            } catch (err) {
              toast.error(err?.response?.data?.detail || "Error aplicando plantilla");
            }
          }} />
          <HeroLayoutPicker card={card} user={user} onChange={(v) => update("hero_layout", v)} />
          <CoverPhotoUploader card={card} onChange={load} />
          <ProfilePhotoUploader card={card} onChange={load} heroLayout={card.hero_layout} />
          <LogoUploader card={card} onChange={load} />
          <Card className="card-elevated p-5 border-0 shadow-none space-y-3">
            <h3 className="font-heading font-bold text-base">Lo básico</h3>
            <div>
              <Label>Link personalizado</Label>
              <div className="flex items-center mt-1.5">
                <span className="text-sm text-slate-500 mr-1">{baseUrl}/c/</span>
                <Input data-testid="card-slug" value={card.slug} onChange={(e) => update("slug", e.target.value)} className="h-12 rounded-xl flex-1" />
              </div>
            </div>
            <div>
              <Label>Tagline (frase corta en inglés)</Label>
              <Input data-testid="card-tagline" value={card.tagline} onChange={(e) => update("tagline", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder="Trusted Roofing Experts in Houston" />
            </div>
            <div>
              <Label>Tu rol / título (inglés)</Label>
              <Input data-testid="card-role" value={card.role || ""} onChange={(e) => update("role", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder="Owner & Lead Contractor" />
            </div>
            <div>
              <Label>Sobre ti / About Me (inglés)</Label>
              <Textarea data-testid="card-about" value={card.about_me || ""} onChange={(e) => update("about_me", e.target.value)} className="rounded-xl mt-1.5 min-h-[100px]" placeholder="With over 10 years of experience, we deliver quality work on every project..." />
              <p className="text-[11px] text-slate-400 mt-1">Una breve descripción que aparece en tu tarjeta para que los clientes te conozcan.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo de negocio</Label>
                <Input data-testid="card-businesstype" value={card.business_type} onChange={(e) => update("business_type", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder="Roofing" />
              </div>
              <div>
                <Label>Años en negocio</Label>
                <Input type="number" data-testid="card-years" value={card.years_in_business} onChange={(e) => update("years_in_business", Number(e.target.value) || 0)} className="h-12 rounded-xl mt-1.5" />
              </div>
            </div>
            <div>
              <Label>Área de servicio</Label>
              <Input data-testid="card-area" value={card.service_area} onChange={(e) => update("service_area", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder="Houston, TX and surrounding areas" />
            </div>
            <div>
              <Label>Horario</Label>
              <Input data-testid="card-hours" value={card.hours} onChange={(e) => update("hours", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder="Mon-Fri 8am-6pm" />
            </div>
            <div>
              <Label>Color de marca</Label>
              <div className="flex items-center gap-3 mt-1.5">
                <input type="color" data-testid="card-color" value={card.brand_color} onChange={(e) => update("brand_color", e.target.value)} className="w-14 h-12 rounded-xl border border-slate-200 cursor-pointer" />
                <Input value={card.brand_color} onChange={(e) => update("brand_color", e.target.value)} className="h-12 rounded-xl flex-1 font-mono" />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {BRAND_PRESETS.map((p) => {
                  const active = (card.brand_color || "").toLowerCase() === p.brand.toLowerCase();
                  return (
                    <button
                      key={p.name}
                      type="button"
                      data-testid={`brand-preset-${p.name.toLowerCase()}`}
                      onClick={() => { update("brand_color", p.brand); update("accent_color", p.accent); }}
                      className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border tap text-[11px] font-semibold transition-all ${active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"}`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full border border-white/50 shadow-sm" style={{ background: p.brand }} />
                      <span className="w-3.5 h-3.5 rounded-full border border-white/50 shadow-sm -ml-2" style={{ background: p.accent }} />
                      {p.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">Las paletas curadas combinan color de marca + acento que se ven premium.</p>
            </div>

            <div>
              <Label>Color de acento</Label>
              <div className="flex items-center gap-3 mt-1.5">
                <input type="color" data-testid="card-accent-color" value={card.accent_color || "#10B981"} onChange={(e) => update("accent_color", e.target.value)} className="w-14 h-12 rounded-xl border border-slate-200 cursor-pointer" />
                <Input value={card.accent_color || "#10B981"} onChange={(e) => update("accent_color", e.target.value)} className="h-12 rounded-xl flex-1 font-mono" />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ACCENT_PRESETS.map((c) => {
                  const active = (card.accent_color || "").toLowerCase() === c.toLowerCase();
                  return (
                    <button
                      key={c}
                      type="button"
                      data-testid={`accent-preset-${c.replace("#", "")}`}
                      onClick={() => update("accent_color", c)}
                      style={{ background: c }}
                      className={`w-8 h-8 rounded-full border-2 tap transition-transform ${active ? "border-slate-900 scale-110 ring-2 ring-offset-2 ring-slate-900" : "border-white shadow-sm hover:scale-105"}`}
                      aria-label={`Accent ${c}`}
                    />
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">Se usa para botones, badges y los detalles brillantes de tu tarjeta.</p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Oscuridad del hero</Label>
                <span className="text-[11px] font-mono text-slate-500 tabular-nums">{card.hero_overlay ?? 60}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                data-testid="card-hero-overlay"
                value={card.hero_overlay ?? 60}
                onChange={(e) => update("hero_overlay", Number(e.target.value))}
                className="w-full mt-2 accent-slate-900"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>Foto clara</span>
                <span>Texto legible</span>
                <span>Muy oscuro</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">Controla cuánto se oscurece tu foto de hero para que el texto blanco se lea bien.</p>
            </div>
          </Card>

          <Card className="card-elevated p-5 border-0 shadow-none space-y-3">
            <h3 className="font-heading font-bold text-base">Insignias y enlaces</h3>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
              <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-600" /> <span className="font-medium text-sm">Licencia</span></div>
              <Switch data-testid="card-licensed" checked={card.is_licensed} onCheckedChange={(v) => update("is_licensed", v)} />
            </div>
            {card.is_licensed && (
              <Input value={card.license_number} onChange={(e) => update("license_number", e.target.value)} placeholder="License #" className="h-11 rounded-xl" />
            )}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
              <div className="flex items-center gap-2"><BadgeCheck className="w-5 h-5 text-blue-700" /> <span className="font-medium text-sm">Asegurado</span></div>
              <Switch data-testid="card-insured" checked={card.is_insured} onCheckedChange={(v) => update("is_insured", v)} />
            </div>
            <div>
              <Label>WhatsApp (con código de país)</Label>
              <Input data-testid="card-whatsapp" value={card.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder="+15551234567" />
            </div>
            <div>
              <Label>Website</Label>
              <Input value={card.website} onChange={(e) => update("website", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Facebook</Label>
                <Input value={card.facebook} onChange={(e) => update("facebook", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder="URL" />
              </div>
              <div>
                <Label>Instagram</Label>
                <Input value={card.instagram} onChange={(e) => update("instagram", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder="URL" />
              </div>
            </div>
            <div>
              <Label>Link para reseñas de Google</Label>
              <Input value={card.google_review_url} onChange={(e) => update("google_review_url", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder="https://g.page/r/..." />
            </div>
          </Card>

          <Card className="card-elevated p-5 border-0 shadow-none space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-base">Servicios</h3>
              <Button size="sm" data-testid="card-add-service" onClick={() => update("services", [...(card.services || []), { name: "", description: "", starting_price: "", icon: "" }])} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-3 h-3 mr-1" /> Agregar
              </Button>
            </div>
            {(card.services || []).length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">Plantillas rápidas (toca para agregar):</p>
                <div className="flex flex-wrap gap-2">
                  {SERVICE_TEMPLATES.map((s) => (
                    <button
                      key={s.name}
                      onClick={() => update("services", [...(card.services || []), s])}
                      className="px-3 py-2 rounded-full bg-slate-100 text-xs font-semibold tap"
                    >
                      {s.icon} {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {(card.services || []).map((s, i) => (
              <div key={i} className="rounded-xl bg-slate-50 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold tracking-[0.18em] text-slate-400 w-6">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Input value={s.name} onChange={(e) => {
                    const arr = [...card.services]; arr[i] = { ...arr[i], name: e.target.value }; update("services", arr);
                  }} placeholder="Service name (e.g., Roofing)" className="flex-1 h-11 rounded-xl bg-white" />
                </div>
                <Input value={s.description} onChange={(e) => {
                  const arr = [...card.services]; arr[i] = { ...arr[i], description: e.target.value }; update("services", arr);
                }} placeholder="Short description (English)" className="h-11 rounded-xl bg-white" />
                <div className="flex gap-2">
                  <Input value={s.starting_price} onChange={(e) => {
                    const arr = [...card.services]; arr[i] = { ...arr[i], starting_price: e.target.value }; update("services", arr);
                  }} placeholder="Starting at $... (optional)" className="h-11 rounded-xl bg-white flex-1" />
                  <Input value={s.icon} onChange={(e) => {
                    const arr = [...card.services]; arr[i] = { ...arr[i], icon: e.target.value }; update("services", arr);
                  }} placeholder="🔨 opt" className="w-20 h-11 rounded-xl bg-white text-center" maxLength={2} />
                  <button type="button" onClick={() => update("services", card.services.filter((_, idx) => idx !== i))} className="w-11 h-11 rounded-xl bg-white border border-red-200 text-red-600 flex items-center justify-center flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 px-1">Si no pones emoji, mostramos un número elegante (01, 02…)</p>
              </div>
            ))}
          </Card>

          <Button data-testid="card-save" onClick={save} disabled={saving} className="w-full h-14 rounded-2xl bg-blue-900 hover:bg-blue-950 text-white font-semibold text-base">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Guardar cambios"}
          </Button>
        </TabsContent>

        <TabsContent value="qr" className="mt-4">
          <Card className="card-elevated p-6 border-0 shadow-none text-center">
            <h3 className="font-heading font-bold text-lg mb-1">Tu código QR</h3>
            <p className="text-sm text-slate-500 mb-4">Imprímelo en tarjetas, vehículos, uniformes.</p>
            <div className="inline-block p-5 bg-white border-2 rounded-3xl" style={{ borderColor: card.brand_color }}>
              <QRCodeCanvas
                id="card-qr-canvas"
                value={`${publicUrl}?src=qr`}
                size={220}
                fgColor={card.brand_color}
                bgColor="#ffffff"
                level="H"
                includeMargin={false}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <Button
                data-testid="qr-download"
                onClick={() => {
                  const canvas = document.getElementById("card-qr-canvas");
                  const url = canvas.toDataURL("image/png");
                  const a = document.createElement("a");
                  a.href = url; a.download = `qr-${card.slug}.png`; a.click();
                }}
                variant="outline"
                className="h-12 rounded-xl"
              >
                <Download className="w-4 h-4 mr-1" /> Descargar PNG
              </Button>
              <Button onClick={() => window.open(publicUrl + "?src=qr", "_blank")} variant="outline" className="h-12 rounded-xl">
                <ExternalLink className="w-4 h-4 mr-1" /> Probar
              </Button>
            </div>
            <div className="mt-6 p-4 bg-slate-50 rounded-xl text-left">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Próximamente</div>
              <p className="text-sm text-slate-700">Tarjeta NFC física con tu QR — toca con el celular del cliente para abrir tu perfil al instante.</p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="reviews" className="mt-4 space-y-3">
          <NewReviewForm onCreated={load} />
          {reviews.length === 0 ? (
            <Card className="card-elevated p-8 text-center border-0 shadow-none">
              <Star className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Sin reseñas todavía. Pídele a tus mejores clientes que te dejen una.</p>
            </Card>
          ) : (
            reviews.map((r) => (
              <Card key={r.id} className="card-elevated p-4 border-0 shadow-none">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold text-sm">{r.customer_name}</div>
                  <button onClick={async () => {
                    if (!window.confirm("¿Eliminar reseña?")) return;
                    await api.delete(`/card/reviews/${r.id}`);
                    load();
                  }} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="flex gap-0.5 mb-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`w-3.5 h-3.5 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                  ))}
                </div>
                <p className="text-sm text-slate-700">{r.text}</p>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="analytics" className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="Visitas" value={(analytics.totals?.profile_visit || 0)} />
            <StatTile label="Clicks llamada" value={(analytics.totals?.call_click || 0)} />
            <StatTile label="Clicks WhatsApp" value={(analytics.totals?.whatsapp_click || 0)} />
            <StatTile label="Contactos guardados" value={(analytics.totals?.contact_save || 0)} />
            <StatTile label="Cotizaciones" value={analytics.leads} accent="emerald" />
            <StatTile label="Reseñas" value={analytics.reviews} accent="emerald" />
          </div>

          <Card className="card-elevated p-5 border-0 shadow-none">
            <h3 className="font-heading font-bold text-base mb-3 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-900" /> Leads recientes
            </h3>
            {leads.length === 0 ? (
              <p className="text-sm text-slate-500">Aún sin leads. Comparte tu link para empezar.</p>
            ) : (
              <div className="space-y-2">
                {leads.slice(0, 8).map((l) => (
                  <div key={l.id} className="p-3 rounded-xl bg-slate-50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{l.name}</div>
                        <div className="text-xs text-slate-500">{l.phone || l.email}</div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        {l.source || "form"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">{l.description}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatTile({ label, value, accent }) {
  const cls = accent === "emerald" ? "from-emerald-500 to-emerald-700" : "from-blue-800 to-blue-950";
  return (
    <Card className="card-elevated p-4 border-0 shadow-none">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className={`font-heading text-2xl font-bold mt-1 bg-gradient-to-br ${cls} bg-clip-text text-transparent`}>
        {value}
      </div>
    </Card>
  );
}

function LogoUploader({ card, onChange }) {
  return <AssetUploader card={card} onChange={onChange} kind="logo" />;
}

function ProfilePhotoUploader({ card, onChange, heroLayout }) {
  return <AssetUploader card={card} onChange={onChange} kind="profile_photo" heroLayout={heroLayout} />;
}

function CoverPhotoUploader({ card, onChange }) {
  return <AssetUploader card={card} onChange={onChange} kind="cover" />;
}

// Industry templates — one-tap pre-fill of brand colors, layout and suggested next step.
const INDUSTRY_TEMPLATES = [
  { key: "landscaping", label: "Jardinería", Icon: Sprout,
    brand: "#15803D", accent: "#FACC15", brandDeep: "#052E16",
    business_type: "Landscaping",
    hint: "Sube una foto de un jardín tuyo terminado como foto de fondo.",
  },
  { key: "construction", label: "Construcción", Icon: Hammer,
    brand: "#B91C1C", accent: "#F59E0B", brandDeep: "#3F0A0A",
    business_type: "Construction",
    hint: "Sube una foto de una obra o casa que hayas construido.",
  },
  { key: "roofing", label: "Roofing", Icon: Home,
    brand: "#475569", accent: "#F97316", brandDeep: "#0F172A",
    business_type: "Roofing",
    hint: "Una foto de un techo nuevo se ve perfecta como fondo.",
  },
  { key: "cleaning", label: "Limpieza", Icon: Sparkles,
    brand: "#0E7490", accent: "#FBBF24", brandDeep: "#083344",
    business_type: "Cleaning",
    hint: "Sube una foto de una casa o cocina impecable después de limpiar.",
  },
  { key: "painting", label: "Pintura", Icon: PaintBucket,
    brand: "#2563EB", accent: "#F472B6", brandDeep: "#0C1B4A",
    business_type: "Painting",
    hint: "Una foto de una pared o casa recién pintada se ve genial de fondo.",
  },
  { key: "hvac", label: "HVAC / AC", Icon: Wind,
    brand: "#EA580C", accent: "#10B981", brandDeep: "#431407",
    business_type: "HVAC",
    hint: "Una foto de una unidad de AC nueva o instalada queda perfecto.",
  },
  { key: "plumbing", label: "Plomería", Icon: Wrench,
    brand: "#1D4ED8", accent: "#FBBF24", brandDeep: "#172554",
    business_type: "Plumbing",
    hint: "Una foto del trabajo terminado (baño, lavabo, tubería) funciona bien.",
  },
];

function IndustryTemplatePicker({ card, onApply }) {
  return (
    <Card className="card-elevated p-5 border-0 shadow-none">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-heading font-bold text-base">Plantillas por oficio</h3>
        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Onboarding rápido</span>
      </div>
      <p className="text-xs text-slate-500 mb-3">Toca una plantilla y te aplicamos los colores y estilo. Luego solo subes fotos.</p>
      <div className="-mx-1 px-1 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 pb-1" style={{ minWidth: "max-content" }}>
          {INDUSTRY_TEMPLATES.map((t) => {
            const active =
              (card.brand_color || "").toLowerCase() === t.brand.toLowerCase() &&
              (card.accent_color || "").toLowerCase() === t.accent.toLowerCase();
            return (
              <button
                key={t.key}
                type="button"
                data-testid={`template-${t.key}`}
                onClick={() => onApply(t)}
                className={`flex-shrink-0 w-24 rounded-2xl p-2 border-2 transition-all tap ${
                  active ? "border-slate-900 bg-slate-50 shadow-sm" : "border-slate-100 bg-white hover:border-slate-300"
                }`}
              >
                <div
                  className="aspect-[3/4] rounded-xl flex items-center justify-center relative overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${t.brand} 0%, ${t.brandDeep} 100%)` }}
                >
                  <div className="absolute inset-0 opacity-30" style={{
                    background: `radial-gradient(ellipse at top right, ${t.accent} 0%, transparent 60%)`,
                  }} />
                  <div className="w-10 h-10 rounded-full bg-white/95 flex items-center justify-center shadow-lg relative z-10">
                    <t.Icon className="w-5 h-5" style={{ color: t.brand }} strokeWidth={2.5} />
                  </div>
                  {active && (
                    <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white flex items-center justify-center shadow">
                      <BadgeCheck className="w-3 h-3 text-slate-900" />
                    </div>
                  )}
                </div>
                <div className="text-[11px] font-bold text-slate-800 mt-1.5 text-center leading-tight">{t.label}</div>
                <div className="flex items-center justify-center gap-0.5 mt-1">
                  <span className="w-2 h-2 rounded-full border border-white/50 shadow-sm" style={{ background: t.brand }} />
                  <span className="w-2 h-2 rounded-full border border-white/50 shadow-sm" style={{ background: t.accent }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function HeroLayoutPicker({ card, user, onChange }) {
  const options = [
    {
      key: "photo",
      label: "Foto Grande",
      desc: "Tu foto llena la portada. Look premium.",
    },
    {
      key: "logo_circle",
      label: "Foto/Logo + Avatar",
      desc: "Foto de tu trabajo o logo de fondo + foto chica en círculo.",
    },
  ];
  const current = card.hero_layout || "photo";
  return (
    <Card className="card-elevated p-5 border-0 shadow-none">
      <h3 className="font-heading font-bold text-base mb-1">Estilo de tu tarjeta</h3>
      <p className="text-xs text-slate-500 mb-3">Preview en vivo con tu data. Cambia entre estilos hasta encontrar el que más te late.</p>
      <div className="grid grid-cols-2 gap-2.5">
        {options.map((o) => {
          const active = current === o.key;
          return (
            <button
              key={o.key}
              type="button"
              data-testid={`hero-layout-${o.key}`}
              onClick={() => onChange(o.key)}
              className={`text-left rounded-2xl p-2 border-2 transition-all tap ${
                active ? "border-blue-900 bg-blue-50/60 shadow-md" : "border-slate-100 bg-white hover:border-slate-300"
              }`}
            >
              <PhoneFrame>
                <LiveCardPreview card={card} user={user} variant={o.key} />
              </PhoneFrame>
              <div className="flex items-center gap-1.5 mt-2">
                {active && <span className="w-1.5 h-1.5 rounded-full bg-blue-900" />}
                <div className={`font-bold text-[13px] ${active ? "text-blue-900" : "text-slate-800"}`}>{o.label}</div>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{o.desc}</div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function PhoneFrame({ children }) {
  // Outer phone frame; inner content is rendered at 320×600 by ScaledCanvas.
  const FULL_W = 320;
  const FULL_H = 600;
  return (
    <div className="relative mx-auto w-full" style={{ aspectRatio: `${FULL_W} / ${FULL_H + 16}` }}>
      <div className="absolute inset-0 rounded-[20px] bg-slate-950 p-[3px] shadow-xl shadow-slate-900/30">
        <div className="absolute top-[3px] left-1/2 -translate-x-1/2 w-10 h-2 rounded-b-xl bg-slate-950 z-20" />
        <div className="w-full h-full rounded-[17px] overflow-hidden relative bg-slate-900">
          <ScaledCanvas fullW={FULL_W} fullH={FULL_H}>{children}</ScaledCanvas>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders children at fixed FULL_W x FULL_H and scales them down via CSS transform
 * to fit the parent container. Uses ResizeObserver so the scale is precise.
 */
function ScaledCanvas({ fullW, fullH, children }) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = e.contentRect.width;
        if (w > 0) setScale(w / fullW);
      }
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [fullW]);
  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden">
      <div
        style={{
          width: fullW,
          height: fullH,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function LiveCardPreview({ card, user, variant }) {
  const brand = card.brand_color || "#1E3A8A";
  const accent = card.accent_color || "#10B981";
  const brandDeep = adjustColor(brand, -45);
  const photoId = card.profile_photo_id;
  const logoId = card.logo_photo_id;
  const coverId = card.cover_photo_id;
  const profileUrl = photoId ? `${process.env.REACT_APP_BACKEND_URL}/api/public/card/photo/${photoId}` : null;
  const logoUrl = logoId ? `${process.env.REACT_APP_BACKEND_URL}/api/public/card/photo/${logoId}` : null;
  const coverUrl = coverId ? `${process.env.REACT_APP_BACKEND_URL}/api/public/card/photo/${coverId}` : null;
  const businessName = user?.business_name || "Mi Negocio";
  const ownerName = user?.owner_name || "";
  const role = card.role || ownerName;
  const initials = (ownerName || businessName).split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  // Real-size building blocks (rendered at 320×600 then scaled down by ScaledCanvas)
  const TopBar = () => (
    <div className="absolute top-4 inset-x-4 flex items-center justify-between z-20">
      {logoUrl ? (
        <div className="w-12 h-12 rounded-2xl bg-white shadow-md p-1.5">
          <img src={logoUrl} alt="" className="w-full h-full object-contain" />
        </div>
      ) : (
        <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25" />
      )}
      <div className="px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-white inline-flex items-center gap-1.5">
        <Globe className="w-3 h-3" />
        <span className="text-[11px] font-bold">ES</span>
      </div>
    </div>
  );

  const ActionButtons = () => (
    <div className="grid grid-cols-4 gap-1.5 px-3 py-3 rounded-2xl backdrop-blur-md" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
      {[
        { Icon: Phone, label: "Call" },
        { Icon: MessageSquare, label: "Text" },
        { Icon: Send, label: "WhatsApp" },
        { Icon: Mail, label: "Email" },
      ].map(({ Icon, label }) => (
        <div key={label} className="flex flex-col items-center gap-1">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: brand, boxShadow: `0 4px 12px ${brand}66` }}
          >
            <Icon className="w-5 h-5 text-white" strokeWidth={2.2} />
          </div>
          <div className="text-[10px] text-white/85 font-semibold">{label}</div>
        </div>
      ))}
    </div>
  );

  const SaveBar = () => (
    <div className="mt-2 rounded-2xl px-3 py-2.5 flex items-center gap-2 backdrop-blur-md" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
      <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center">
        <QrCode className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center">
        <Share2 className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="flex-1 flex items-center justify-center gap-1.5 text-white text-xs font-bold">
        <Save className="w-3.5 h-3.5" />
        Save Contact
      </div>
      <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: accent }}>
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>
    </div>
  );

  if (variant === "photo") {
    return (
      <div
        className="w-full h-full relative overflow-hidden flex flex-col"
        style={{ background: `linear-gradient(180deg, ${brand} 0%, ${brandDeep} 100%)` }}
      >
        <div className="absolute inset-0">
          {profileUrl ? (
            <img src={profileUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="font-heading font-bold text-white/85 text-7xl tracking-tight">{initials || "?"}</div>
            </div>
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 30%, rgba(5,8,16,0.6) 65%, rgba(5,8,16,0.96) 100%)" }} />
        </div>
        <TopBar />
        <div className="mt-auto relative z-10 px-3 pb-3 text-white">
          <h2 className="font-heading font-bold text-[26px] leading-[1.05] drop-shadow-lg">{businessName}</h2>
          {role && <div className="text-base text-white/85 mt-1 drop-shadow">{role}</div>}
          <div className="mt-3">
            <ActionButtons />
          </div>
          <SaveBar />
        </div>
      </div>
    );
  }

  // logo_circle
  return (
    <div
      className="w-full h-full relative overflow-hidden flex flex-col"
      style={{ background: `radial-gradient(ellipse at top, ${brand} 0%, ${brandDeep} 80%)` }}
    >
      <div className="absolute inset-0">
        {coverUrl ? (
          <>
            <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(5,8,16,0.3) 0%, transparent 20%, transparent 60%, rgba(5,8,16,0.85) 90%, rgba(5,8,16,0.98) 100%)" }} />
          </>
        ) : logoUrl ? (
          <div className="absolute inset-0 flex items-start justify-center pt-20">
            <img src={logoUrl} alt="" className="max-w-[60%] max-h-[35%] object-contain opacity-90" />
          </div>
        ) : null}
      </div>
      <TopBar />
      {/* Avatar circle centered */}
      <div className="absolute left-1/2 top-[36%] -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="w-[110px] h-[110px] rounded-full p-[3px]" style={{ background: `linear-gradient(135deg, ${brand}, ${accent})` }}>
          <div className="w-full h-full rounded-full bg-white p-[3px]">
            {profileUrl ? (
              <img src={profileUrl} alt="" className="w-full h-full object-cover rounded-full" />
            ) : (
              <div className="w-full h-full rounded-full flex items-center justify-center font-heading font-bold text-white text-2xl" style={{ background: brandDeep }}>
                {initials || "?"}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mt-auto relative z-10 px-3 pb-3 text-white text-center">
        <h2 className="font-heading font-bold text-[24px] leading-[1.05] drop-shadow-lg">{businessName}</h2>
        {role && <div className="text-base text-white/85 mt-1 drop-shadow">{role}</div>}
        <div className="mt-3 text-left">
          <ActionButtons />
        </div>
        <SaveBar />
      </div>
    </div>
  );
}

// adjustColor helper — keep in sync with SmartCard's helper.
function adjustColor(hex, amt) {
  if (!hex) return "#000000";
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = Math.max(0, Math.min(255, parseInt(h.slice(0, 2), 16) + amt));
  const g = Math.max(0, Math.min(255, parseInt(h.slice(2, 4), 16) + amt));
  const b = Math.max(0, Math.min(255, parseInt(h.slice(4, 6), 16) + amt));
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function AssetUploader({ card, onChange, kind, heroLayout }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const config = kind === "profile_photo"
    ? {
        title: heroLayout === "logo_circle" ? "Tu foto (avatar)" : "Foto del dueño",
        endpoint: "/card/profile-photo",
        idField: "profile_photo_id",
        helper: heroLayout === "logo_circle"
          ? "Tu foto aparece pequeña en un círculo bonito en medio de tu tarjeta. Cuadrada se ve mejor. Máx 8MB."
          : "Foto tuya o del equipo. Vertical funciona mejor. Aparece como hero gigante en tu tarjeta. Máx 8MB.",
        roundedClass: heroLayout === "logo_circle" ? "rounded-full" : "rounded-3xl",
        size: heroLayout === "logo_circle" ? "w-20 h-20" : "w-24 h-32",
        testid: "profile",
      }
    : kind === "cover"
    ? {
        title: "Foto de fondo / portada",
        endpoint: "/card/cover-photo",
        idField: "cover_photo_id",
        helper: "Una foto de tu trabajo (techo terminado, jardín bonito, cocina pintada...) que se use como fondo de tu tarjeta. Si no subes ninguna, mostramos tu logo grande sobre un fondo con tus colores.",
        roundedClass: "rounded-2xl",
        size: "w-28 h-20",
        testid: "cover",
      }
    : {
        title: "Logo del negocio",
        endpoint: "/card/logo",
        idField: "logo_photo_id",
        helper: "PNG, JPEG o WEBP. Cuadrado se ve mejor. Máx 8MB.",
        roundedClass: "rounded-2xl",
        size: "w-20 h-20",
        testid: "logo",
      };

  const url = card[config.idField]
    ? `${process.env.REACT_APP_BACKEND_URL}/api/public/card/photo/${card[config.idField]}`
    : null;

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(config.endpoint, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`${config.title} subido`);
      onChange();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error subiendo imagen");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const remove = async () => {
    if (!window.confirm(`¿Quitar ${config.title.toLowerCase()}?`)) return;
    await api.delete(config.endpoint);
    toast.success("Removido");
    onChange();
  };

  const Icon = kind === "profile_photo" ? Camera : kind === "cover" ? ImageIcon : ImageIcon;

  return (
    <Card className="card-elevated p-5 border-0 shadow-none">
      <h3 className="font-heading font-bold text-base mb-3 flex items-center gap-2">
        <Icon className="w-5 h-5 text-emerald-600" /> {config.title}
      </h3>
      <div className="flex items-center gap-4">
        <div className="relative">
          {url ? (
            <img
              src={url}
              alt={kind}
              data-testid={`${config.testid}-preview`}
              className={`${config.size} ${config.roundedClass} object-cover border border-slate-200 shadow-sm`}
            />
          ) : (
            <div className={`${config.size} ${config.roundedClass} bg-slate-100 flex items-center justify-center text-slate-400`}>
              <Icon className="w-8 h-8" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 mb-2">{config.helper}</p>
          <div className="flex gap-2">
            <Button
              data-testid={`${config.testid}-upload-btn`}
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
              {url ? "Cambiar" : "Subir"}
            </Button>
            {url && (
              <Button
                data-testid={`${config.testid}-remove-btn`}
                size="sm"
                variant="outline"
                onClick={remove}
                className="rounded-xl text-red-600"
              >
                <XIcon className="w-3.5 h-3.5 mr-1" /> Quitar
              </Button>
            )}
          </div>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleFile} />
        </div>
      </div>
    </Card>
  );
}

function NewReviewForm({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customer_name: "", rating: 5, text: "", job_title: "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.customer_name.trim() || !form.text.trim()) return toast.error("Faltan campos");
    setSaving(true);
    try {
      await api.post("/card/reviews", form);
      toast.success("Reseña agregada");
      setForm({ customer_name: "", rating: 5, text: "", job_title: "" });
      setOpen(false);
      onCreated();
    } catch {
      toast.error("Error");
    } finally { setSaving(false); }
  };

  if (!open) {
    return (
      <Button data-testid="add-review-btn" onClick={() => setOpen(true)} className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700">
        <Plus className="w-4 h-4 mr-1" /> Agregar reseña manual
      </Button>
    );
  }

  return (
    <Card className="card-elevated p-4 border-0 shadow-none space-y-3">
      <Input data-testid="review-name" placeholder="Nombre del cliente" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} className="h-12 rounded-xl" />
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setForm({ ...form, rating: n })} data-testid={`review-star-${n}`} className="tap">
            <Star className={`w-7 h-7 ${n <= form.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
          </button>
        ))}
      </div>
      <Textarea data-testid="review-text" placeholder="Reseña (en inglés se ve mejor)" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} className="rounded-xl" />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => setOpen(false)} className="h-11 rounded-xl">Cancelar</Button>
        <Button data-testid="review-save" onClick={save} disabled={saving} className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
        </Button>
      </div>
    </Card>
  );
}
