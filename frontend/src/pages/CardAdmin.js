/**
 * Smart Card admin page: customize, QR, analytics, reviews, social posts.
 */
import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import api from "@/lib/api";
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

export default function CardAdmin() {
  const [tab, setTab] = useState("design");
  const [card, setCard] = useState(null);
  const [saving, setSaving] = useState(false);
  const [analytics, setAnalytics] = useState({ totals: {}, all_events: 0, leads: 0, reviews: 0 });
  const [reviews, setReviews] = useState([]);
  const [leads, setLeads] = useState([]);

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
          <ProfilePhotoUploader card={card} onChange={load} />
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

function ProfilePhotoUploader({ card, onChange }) {
  return <AssetUploader card={card} onChange={onChange} kind="profile_photo" />;
}

function AssetUploader({ card, onChange, kind }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const config = kind === "profile_photo"
    ? {
        title: "Foto del dueño",
        endpoint: "/card/profile-photo",
        idField: "profile_photo_id",
        helper: "Foto tuya o del equipo. Vertical funciona mejor. Aparece como hero gigante en tu tarjeta. Máx 8MB.",
        roundedClass: "rounded-3xl",
        size: "w-24 h-32",
        testid: "profile",
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

  const Icon = kind === "profile_photo" ? Camera : ImageIcon;

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
