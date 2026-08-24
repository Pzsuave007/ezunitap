import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowRight, ArrowLeft, Upload, Sparkles, CheckCircle2, Plus, Trash2, Camera } from "lucide-react";

// Build a square PNG monogram (initials on brand color) so branding is never empty.
function monogramBlob(name, color) {
  return new Promise((resolve) => {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = color || "#1E3A8A";
    ctx.fillRect(0, 0, size, size);
    const initials = (name || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "UT";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 240px Arial, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(initials, size / 2, size / 2 + 12);
    canvas.toBlob((b) => resolve(b), "image/png");
  });
}

const PAY_METHODS = [
  { id: "cash", en: "Cash", es: "Efectivo" },
  { id: "check", en: "Check", es: "Cheque" },
  { id: "zelle", en: "Zelle", es: "Zelle" },
  { id: "venmo", en: "Venmo", es: "Venmo" },
  { id: "transfer", en: "Bank transfer", es: "Transferencia" },
];

export default function Onboarding() {
  const nav = useNavigate();
  const es = (localStorage.getItem("i18nextLng") || "es").startsWith("es");
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const logoInput = useRef(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [d, setD] = useState({
    business_name: "", business_type: "", tagline: "", phone: "", contact_email: "",
    business_address: "", service_area: "", hours: "Mon–Fri 8am–6pm", years_in_business: "",
    is_licensed: false, is_insured: false,
    brand_color: "#1E3A8A", accent_color: "#10B981",
    person_name: "", role: "Owner", about_me: "",
    services: [], newService: "",
    payment_methods: ["cash"], tax_rate: "", deposit_percent: "50", payment_terms: "Payment due on receipt.",
    google_review_url: "", whatsapp: "", facebook: "", instagram: "",
  });
  const set = (k, v) => setD((p) => ({ ...p, [k]: v }));

  const steps = useMemo(() => ([
    "business", "brand", "about", "services", "payments", "reviews",
  ]), []);
  const total = steps.length;
  const cur = steps[step];

  const onLogo = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  };

  const suggestServices = async () => {
    setAiBusy(true);
    try {
      const { data } = await api.post("/website/ai-suggest-services");
      const names = (data?.services || []).map((s) => (typeof s === "string" ? s : s.name)).filter(Boolean);
      set("services", [...new Set([...d.services, ...names])].slice(0, 12));
      toast.success(es ? "Servicios sugeridos por IA" : "AI suggested services");
    } catch {
      toast.error(es ? "Guarda primero tu oficio (paso 1)" : "Save your trade first (step 1)");
    } finally { setAiBusy(false); }
  };

  const writeAbout = async () => {
    setAiBusy(true);
    try {
      const prompt = `Write a warm 2-sentence professional bio (English) for ${d.person_name || "the owner"}, ${d.role || "owner"} of ${d.business_name || "the business"}, a ${d.business_type || "home services"} company. First person.`;
      const { data } = await api.post("/website/ai-write", { field: "about", prompt });
      if (data?.text) set("about_me", data.text);
    } catch {
      toast.error(es ? "No se pudo generar" : "Could not generate");
    } finally { setAiBusy(false); }
  };

  const canNext = () => {
    if (cur === "business") return d.business_name.trim() && d.business_type.trim() && d.phone.trim();
    if (cur === "brand") return !!logoFile || true; // monogram fallback covers it
    if (cur === "about") return d.person_name.trim();
    if (cur === "services") return d.services.length > 0;
    return true;
  };

  const addService = () => {
    const v = d.newService.trim();
    if (v) set("services", [...new Set([...d.services, v])]) & set("newService", "");
    if (v) setD((p) => ({ ...p, services: [...new Set([...p.services, v])], newService: "" }));
  };

  const next = () => {
    if (!canNext()) return toast.error(es ? "Completa este paso" : "Complete this step");
    if (step < total - 1) { setStep(step + 1); window.scrollTo(0, 0); }
    else finish();
  };

  const finish = async () => {
    setBusy(true);
    try {
      // 1) Logo (uploaded file or monogram fallback)
      const blob = logoFile || await monogramBlob(d.business_name, d.brand_color);
      const fd = new FormData();
      fd.append("file", blob, logoFile ? logoFile.name : "logo.png");
      await api.post("/card/logo", fd, { headers: { "Content-Type": "multipart/form-data" } }).catch(() => {});
      // 2) Card settings (also syncs services + business_type to the website)
      await api.put("/card/settings", {
        person_name: d.person_name || d.business_name,
        business_type: d.business_type,
        tagline: d.tagline,
        contact_phone: d.phone,
        contact_email: d.contact_email,
        service_area: d.service_area,
        hours: d.hours,
        years_in_business: Number(d.years_in_business) || 0,
        is_licensed: d.is_licensed,
        is_insured: d.is_insured,
        brand_color: d.brand_color,
        accent_color: d.accent_color,
        role: d.role,
        about_me: d.about_me,
        services: d.services.map((n) => ({ name: n, description: "", starting_price: "", icon: "" })),
        google_review_url: d.google_review_url,
        whatsapp: d.whatsapp || d.phone,
        facebook: d.facebook,
        instagram: d.instagram,
      });
      // 3) Account-level fields + mark onboarding complete
      await api.post("/onboarding/complete", {
        phone: d.phone,
        business_address: d.business_address,
        payment_prefs: { methods: d.payment_methods },
        invoice_defaults: {
          tax_rate: Number(d.tax_rate) || 0,
          deposit_percent: Number(d.deposit_percent) || 0,
          payment_terms: d.payment_terms,
        },
      });
      toast.success(es ? "¡Todo listo! 🎉" : "All set! 🎉");
      nav("/");
    } catch (e) {
      toast.error(e?.response?.data?.detail || (es ? "Error al guardar. Intenta de nuevo." : "Save error. Try again."));
    } finally { setBusy(false); }
  };

  const Field = ({ label, children }) => (
    <div className="mb-3"><Label className="font-bold">{label}</Label><div className="mt-1.5">{children}</div></div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Progress */}
        <div className="flex items-center gap-1.5 mb-6" data-testid="onb-progress">
          {steps.map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-emerald-500" : "bg-slate-200"}`} />
          ))}
        </div>

        <Card className="p-5 sm:p-7 rounded-2xl" data-testid={`onb-step-${cur}`}>
          {cur === "business" && (<>
            <h1 className="font-heading text-2xl font-bold">{es ? "Cuéntanos de tu negocio" : "Tell us about your business"}</h1>
            <p className="text-sm text-slate-500 mb-4">{es ? "Esto crea tu tarjeta, tu web y tus facturas." : "This builds your card, website and invoices."}</p>
            <Field label={es ? "Nombre del negocio" : "Business name"}><Input data-testid="onb-business-name" value={d.business_name} onChange={(e) => set("business_name", e.target.value)} placeholder="González Painting LLC" className="h-12 rounded-xl" /></Field>
            <Field label={es ? "Tipo de trabajo / oficio" : "Trade / business type"}><Input data-testid="onb-business-type" value={d.business_type} onChange={(e) => set("business_type", e.target.value)} placeholder={es ? "Pintura, Techos, Plomería…" : "Painting, Roofing, Plumbing…"} className="h-12 rounded-xl" /></Field>
            <Field label={es ? "Teléfono" : "Phone"}><Input data-testid="onb-phone" value={d.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(713) 555-0142" className="h-12 rounded-xl" /></Field>
            <Field label={es ? "Email de contacto" : "Contact email"}><Input data-testid="onb-email" value={d.contact_email} onChange={(e) => set("contact_email", e.target.value)} className="h-12 rounded-xl" /></Field>
            <Field label={es ? "Zona de servicio" : "Service area"}><Input value={d.service_area} onChange={(e) => set("service_area", e.target.value)} placeholder="Houston, TX" className="h-12 rounded-xl" /></Field>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={d.is_licensed} onChange={(e) => set("is_licensed", e.target.checked)} /> {es ? "Con licencia" : "Licensed"}</label>
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={d.is_insured} onChange={(e) => set("is_insured", e.target.checked)} /> {es ? "Asegurado" : "Insured"}</label>
            </div>
          </>)}

          {cur === "brand" && (<>
            <h1 className="font-heading text-2xl font-bold">{es ? "Tu marca" : "Your brand"}</h1>
            <p className="text-sm text-slate-500 mb-4">{es ? "Sube tu logo. Si aún no tienes, creamos uno con tus iniciales." : "Upload your logo. No logo yet? We'll make one with your initials."}</p>
            <div className="flex flex-col items-center gap-4">
              <div className="w-32 h-32 rounded-2xl overflow-hidden flex items-center justify-center text-white text-4xl font-bold shadow" style={{ backgroundColor: d.brand_color }}>
                {logoPreview ? <img src={logoPreview} alt="logo" className="w-full h-full object-cover" /> : (d.business_name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "UT")}
              </div>
              <input ref={logoInput} type="file" accept="image/*" hidden onChange={onLogo} />
              <Button data-testid="onb-logo-btn" variant="outline" onClick={() => logoInput.current?.click()} className="rounded-xl"><Upload className="w-4 h-4 mr-2" /> {es ? "Subir logo" : "Upload logo"}</Button>
            </div>
            <Field label={es ? "Color principal" : "Brand color"}><input type="color" value={d.brand_color} onChange={(e) => set("brand_color", e.target.value)} className="h-11 w-full rounded-xl" data-testid="onb-brand-color" /></Field>
          </>)}

          {cur === "about" && (<>
            <h1 className="font-heading text-2xl font-bold">{es ? "Sobre ti" : "About you"}</h1>
            <p className="text-sm text-slate-500 mb-4">{es ? "Esto aparece en tu tarjeta y tu web." : "This shows on your card and website."}</p>
            <Field label={es ? "Tu nombre" : "Your name"}><Input data-testid="onb-person-name" value={d.person_name} onChange={(e) => set("person_name", e.target.value)} placeholder="Carlos González" className="h-12 rounded-xl" /></Field>
            <Field label={es ? "Rol" : "Role"}><Input value={d.role} onChange={(e) => set("role", e.target.value)} placeholder={es ? "Dueño y contratista" : "Owner & Lead Contractor"} className="h-12 rounded-xl" /></Field>
            <Field label={es ? "Bio corta" : "Short bio"}>
              <Textarea data-testid="onb-about" value={d.about_me} onChange={(e) => set("about_me", e.target.value)} rows={3} className="rounded-xl" placeholder={es ? "Ej: 10 años sirviendo a Houston…" : "e.g. 10 years serving Houston…"} />
              <Button data-testid="onb-ai-about" variant="ghost" size="sm" onClick={writeAbout} disabled={aiBusy} className="mt-1 text-emerald-700"><Sparkles className="w-4 h-4 mr-1" /> {es ? "Escribir con IA" : "Write with AI"}</Button>
            </Field>
          </>)}

          {cur === "services" && (<>
            <h1 className="font-heading text-2xl font-bold">{es ? "¿Qué servicios ofreces?" : "What services do you offer?"}</h1>
            <p className="text-sm text-slate-500 mb-4">{es ? "Se usan en tu web, tarjeta y cotizaciones." : "Used across your site, card and quotes."}</p>
            <div className="flex gap-2">
              <Input data-testid="onb-service-input" value={d.newService} onChange={(e) => set("newService", e.target.value)} onKeyDown={(e) => e.key === "Enter" && addService()} placeholder={es ? "Ej: Pintura interior" : "e.g. Interior painting"} className="h-11 rounded-xl" />
              <Button data-testid="onb-service-add" onClick={addService} className="h-11 rounded-xl"><Plus className="w-4 h-4" /></Button>
            </div>
            <Button data-testid="onb-ai-services" variant="ghost" size="sm" onClick={suggestServices} disabled={aiBusy} className="mt-2 text-emerald-700">{aiBusy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />} {es ? "Sugerir con IA" : "Suggest with AI"}</Button>
            <div className="mt-3 space-y-2">
              {d.services.map((s, i) => (
                <div key={i} data-testid={`onb-service-${i}`} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
                  <span className="font-semibold text-sm">{s}</span>
                  <button onClick={() => set("services", d.services.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4 text-slate-400" /></button>
                </div>
              ))}
            </div>
          </>)}

          {cur === "payments" && (<>
            <h1 className="font-heading text-2xl font-bold">{es ? "¿Cómo cobras?" : "How do you get paid?"}</h1>
            <p className="text-sm text-slate-500 mb-4">{es ? "Elige los métodos que aceptas." : "Pick the methods you accept."}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {PAY_METHODS.map((m) => {
                const on = d.payment_methods.includes(m.id);
                return <button key={m.id} data-testid={`onb-pay-${m.id}`} onClick={() => set("payment_methods", on ? d.payment_methods.filter((x) => x !== m.id) : [...d.payment_methods, m.id])} className={`px-3.5 py-2.5 rounded-xl text-sm font-semibold border-2 ${on ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200"}`}>{on && <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />}{es ? m.es : m.en}</button>;
              })}
            </div>
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 mb-4">
              <div className="text-sm font-bold text-blue-900">{es ? "Cobrar con tarjeta (opcional)" : "Card payments (optional)"}</div>
              <p className="text-xs text-blue-800 mt-0.5 mb-2">{es ? "Conecta Stripe cuando quieras para aceptar tarjetas." : "Connect Stripe anytime to accept cards."}</p>
              <Button data-testid="onb-stripe" variant="outline" size="sm" onClick={() => nav("/ajustes")} className="rounded-lg border-blue-300 text-blue-700">{es ? "Conectar tarjetas después" : "Connect cards later"}</Button>
            </div>
            <Field label={es ? "Depósito por defecto (%)" : "Default deposit (%)"}><Input value={d.deposit_percent} onChange={(e) => set("deposit_percent", e.target.value)} type="number" className="h-11 rounded-xl max-w-[140px]" /></Field>
            <Field label={es ? "Impuesto (%)" : "Tax rate (%)"}><Input value={d.tax_rate} onChange={(e) => set("tax_rate", e.target.value)} type="number" className="h-11 rounded-xl max-w-[140px]" /></Field>
          </>)}

          {cur === "reviews" && (<>
            <h1 className="font-heading text-2xl font-bold">{es ? "Reseñas y redes" : "Reviews & social"}</h1>
            <p className="text-sm text-slate-500 mb-4">{es ? "Opcional, pero suma mucha confianza." : "Optional, but builds a lot of trust."}</p>
            <Field label={es ? "Link de Google Reviews" : "Google Reviews link"}><Input data-testid="onb-google" value={d.google_review_url} onChange={(e) => set("google_review_url", e.target.value)} placeholder="https://g.page/..." className="h-12 rounded-xl" /></Field>
            <Field label="WhatsApp"><Input value={d.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+1 713 555 0142" className="h-12 rounded-xl" /></Field>
            <Field label="Facebook"><Input value={d.facebook} onChange={(e) => set("facebook", e.target.value)} className="h-12 rounded-xl" /></Field>
            <Field label="Instagram"><Input value={d.instagram} onChange={(e) => set("instagram", e.target.value)} className="h-12 rounded-xl" /></Field>
          </>)}

          {/* Nav */}
          <div className="flex items-center gap-3 mt-6">
            {step > 0 && <Button variant="ghost" onClick={() => { setStep(step - 1); window.scrollTo(0, 0); }} className="rounded-xl"><ArrowLeft className="w-4 h-4 mr-1" /> {es ? "Atrás" : "Back"}</Button>}
            <Button data-testid="onb-next" onClick={next} disabled={busy} className="flex-1 h-13 py-3 rounded-xl bg-gradient-to-br from-blue-900 to-emerald-600 text-white font-bold">
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : step < total - 1 ? <>{es ? "Continuar" : "Continue"} <ArrowRight className="w-5 h-5 ml-1" /></> : (es ? "Terminar y crear todo 🎉" : "Finish & build everything 🎉")}
            </Button>
          </div>
        </Card>
        <p className="text-center text-xs text-slate-400 mt-4">{es ? `Paso ${step + 1} de ${total}` : `Step ${step + 1} of ${total}`}</p>
      </div>
    </div>
  );
}
