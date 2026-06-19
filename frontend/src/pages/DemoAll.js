/**
 * DemoAll — Public, no-login UNIFIED demo with BRANCHING.
 * Flow: lead capture -> "¿Cuál es tu mayor necesidad?" (Presencia / Negocio / Marketing)
 *   -> targeted magic moment -> unified cross-sell of all 3 modules.
 *
 * NOTE: This is a SEPARATE route from /demo (which stays untouched for the
 * existing Meta ad campaign + pixel). Negocio branch uses the SAME real-AI
 * backend endpoints. Presencia & Marketing branches are simulated ($0 cost).
 */
import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, Hammer, Sparkles, ArrowRight, ArrowLeft, Star, FileText,
  Smartphone, Megaphone, MapPin, MessageCircle, Phone, BadgeCheck,
  Contact, PlayCircle, Image as ImageIcon, Copy, Check, PartyPopper, Nfc,
} from "lucide-react";
import { fbTrack, fbTrackCustom } from "@/lib/fbpixel";
import { QuoteStep, AgreementStep, InvoiceStep, GeneratingOverlay } from "./DemoFlow";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TRADES = [
  "Techos / Roofing", "Drywall", "Pintura / Painting", "Concreto / Concrete",
  "Jardinería / Landscaping", "Limpieza / Cleaning", "Plomería / Plumbing", "Otro",
];

const NEG_EXAMPLES = [
  { label: "Techo", text: "Reemplazar techo de 1500 pies cuadrados con shingles nuevos, incluye remover el viejo, papel nuevo y limpieza completa." },
  { label: "Drywall", text: "Instalar y resanar drywall en una recámara de 12x14 pies, incluye lijado y dejarlo listo para pintar." },
  { label: "Pintura", text: "Pintar interior de casa de 3 recámaras y 2 baños, paredes y techos, 2 manos de pintura, dueño compra el color." },
];

const MKT_EXAMPLES = [
  "Terminé este techo nuevo en Houston, quedó increíble",
  "Promoción: 15% de descuento en pintura de interiores este mes",
  "Antes y después de este jardín que transformamos",
];

// trade label "Techos / Roofing" -> English noun for branding/services
const TRADE_META = {
  "Techos / Roofing": { en: "Roofing", services: ["Roof Replacement", "Leak Repair", "Inspections"], img: "https://images.unsplash.com/photo-1590365876016-da05ac533e83?crop=entropy&cs=srgb&fm=jpg&w=900&q=80" },
  "Drywall": { en: "Drywall", services: ["Drywall Install", "Patch & Repair", "Texture"], img: "https://images.unsplash.com/photo-1632829882891-5047ccc421bc?crop=entropy&cs=srgb&fm=jpg&w=900&q=80" },
  "Pintura / Painting": { en: "Painting", services: ["Interior Painting", "Exterior Painting", "Cabinets"], img: "https://images.unsplash.com/photo-1632829882891-5047ccc421bc?crop=entropy&cs=srgb&fm=jpg&w=900&q=80" },
  "Concreto / Concrete": { en: "Concrete", services: ["Driveways", "Patios", "Foundations"], img: "https://images.unsplash.com/photo-1781637202423-33ec5b47e52e?crop=entropy&cs=srgb&fm=jpg&w=900&q=80" },
  "Jardinería / Landscaping": { en: "Landscaping", services: ["Lawn Care", "Sod Install", "Sprinklers"], img: "https://images.pexels.com/photos/8143675/pexels-photo-8143675.jpeg?auto=compress&cs=tinysrgb&w=900" },
  "Limpieza / Cleaning": { en: "Cleaning", services: ["Deep Cleaning", "Move-out", "Commercial"], img: "https://images.pexels.com/photos/4239146/pexels-photo-4239146.jpeg?auto=compress&cs=tinysrgb&w=900" },
  "Plomería / Plumbing": { en: "Plumbing", services: ["Repairs", "Water Heaters", "Remodels"], img: "https://images.pexels.com/photos/8489697/pexels-photo-8489697.jpeg?auto=compress&cs=tinysrgb&w=900" },
  "Otro": { en: "Services", services: ["Free Estimates", "Quality Work", "Licensed"], img: "https://images.unsplash.com/photo-1590365876016-da05ac533e83?crop=entropy&cs=srgb&fm=jpg&w=900&q=80" },
};

function tradeMeta(trade) {
  return TRADE_META[trade] || TRADE_META["Otro"];
}

function brandName(lead) {
  const meta = tradeMeta(lead.trade);
  const parts = (lead.name || "").trim().split(/\s+/);
  const last = parts.length > 1 ? parts[parts.length - 1] : parts[0] || "Pro";
  return `${last} ${meta.en}`;
}

export default function DemoAll() {
  const [params] = useSearchParams();
  const [phase, setPhase] = useState("lead"); // lead | branch | presencia | negocio | marketing
  const [demoId, setDemoId] = useState(null);
  const [business, setBusiness] = useState(null);
  const [lead, setLead] = useState({ name: "", email: "", phone: "", trade: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const preNeed = params.get("need");

  const startDemo = async () => {
    setErr("");
    if (!lead.name.trim() || !lead.email.includes("@")) {
      setErr("Pon tu nombre y un email válido para empezar.");
      return;
    }
    setLoading(true);
    try {
      const r = await axios.post(`${API}/public/demo/start`, lead);
      setDemoId(r.data.demo_id);
      setBusiness(r.data.business);
      fbTrack("Lead", { content_name: "Demo-All Start", content_category: lead.trade || "" });
      fbTrackCustom("DemoStarted", { trade: lead.trade || "", demo: "all" });
      // deep-link to a specific branch if provided
      if (["presencia", "negocio", "marketing"].includes(preNeed)) {
        chooseBranch(preNeed);
      } else {
        setPhase("branch");
      }
      window.scrollTo(0, 0);
    } catch (e) {
      setErr(e?.response?.data?.detail || "No se pudo iniciar el demo. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const chooseBranch = (b) => {
    fbTrackCustom("DemoBranch", { branch: b });
    setPhase(b);
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-slate-50" data-testid="demo-all">
      <TopBar />
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-24">
        {err && (
          <div data-testid="demo-all-error" className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
            {err}
          </div>
        )}

        {phase === "lead" && <LeadStep lead={lead} setLead={setLead} onStart={startDemo} loading={loading} />}
        {phase === "branch" && <BranchSelector onChoose={chooseBranch} />}
        {phase === "negocio" && (
          <NegocioBranch demoId={demoId} business={business} lead={lead} onBack={() => setPhase("branch")} />
        )}
        {phase === "presencia" && (
          <PresenciaBranch lead={lead} onBack={() => setPhase("branch")} />
        )}
        {phase === "marketing" && (
          <MarketingBranch lead={lead} onBack={() => setPhase("branch")} />
        )}
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2" data-testid="demo-all-logo">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center">
            <Hammer className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-heading font-bold">UniTech</span>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Demo</span>
        </Link>
        <Link to="/register" data-testid="demo-all-signup-top" className="text-sm font-semibold text-blue-900 hover:underline">
          Crear mi cuenta
        </Link>
      </div>
    </header>
  );
}

function LeadStep({ lead, setLead, onStart, loading }) {
  const set = (k) => (e) => setLead({ ...lead, [k]: e.target.value });
  return (
    <Card className="p-6 sm:p-8 rounded-2xl border-slate-200">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-4">
        <Sparkles className="w-3.5 h-3.5" /> Demo en vivo · 2 minutos
      </div>
      <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight">
        Mira lo que UniTech puede hacer por tu negocio
      </h1>
      <p className="text-slate-600 mt-2 leading-relaxed">
        Tu tarjeta digital con reseñas, tu cotización en inglés con IA, y tu contenido para redes — todo en español, hecho desde tu celular. Vívelo en vivo.
      </p>
      <div className="mt-6 space-y-3">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tu nombre</label>
          <Input data-testid="demo-all-name" value={lead.name} onChange={set("name")} placeholder="Carlos García" className="mt-1 h-12 rounded-xl" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label>
          <Input data-testid="demo-all-email" type="email" value={lead.email} onChange={set("email")} placeholder="tu@email.com" className="mt-1 h-12 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Teléfono</label>
            <Input data-testid="demo-all-phone" value={lead.phone} onChange={set("phone")} placeholder="(555) 123-4567" className="mt-1 h-12 rounded-xl" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tu oficio</label>
            <select data-testid="demo-all-trade" value={lead.trade} onChange={set("trade")} className="mt-1 h-12 w-full rounded-xl border border-slate-200 px-3 text-sm bg-white">
              <option value="">Elige…</option>
              {TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>
      <Button data-testid="demo-all-start-btn" onClick={onStart} disabled={loading} className="mt-6 w-full py-3 rounded-xl bg-gradient-to-br from-blue-900 to-emerald-600 text-white font-bold text-base">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Empezar el demo <ArrowRight className="w-4 h-4 ml-2" /></>}
      </Button>
      <p className="text-[11px] text-slate-400 mt-3 text-center">Gratis y sin compromiso. Usamos tu email solo para mostrarte cómo funciona.</p>
    </Card>
  );
}

const BRANCHES = [
  {
    id: "presencia",
    icon: Star,
    title: "Presencia digital",
    desc: "Tarjeta NFC + mini-sitio con reseñas 5★",
    color: "from-amber-500 to-orange-500",
    tagline: "Quiero verme profesional y conseguir más reseñas",
  },
  {
    id: "negocio",
    icon: FileText,
    title: "Cotizar y cobrar",
    desc: "Cotización IA en inglés, contrato y factura",
    color: "from-blue-700 to-blue-900",
    tagline: "Quiero cotizar rápido y cobrar como profesional",
  },
  {
    id: "marketing",
    icon: Megaphone,
    title: "Marketing con IA",
    desc: "Posts y reels con tu marca, en segundos",
    color: "from-violet-600 to-fuchsia-600",
    tagline: "Quiero contenido para redes sin batallar",
  },
];

function BranchSelector({ onChoose }) {
  return (
    <div data-testid="demo-branch-selector">
      <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-center">
        ¿Cuál es tu mayor necesidad ahorita?
      </h2>
      <p className="text-slate-600 mt-2 text-center max-w-md mx-auto">
        Elige una y te enseño la magia. Al final ves todo lo que UniTech hace por ti.
      </p>
      <div className="mt-6 space-y-3">
        {BRANCHES.map((b) => (
          <button
            key={b.id}
            data-testid={`select-${b.id}-branch`}
            onClick={() => onChoose(b.id)}
            className="w-full text-left p-4 rounded-2xl border-2 border-slate-200 bg-white hover:border-emerald-400 hover:shadow-md transition-all flex items-center gap-4 active:scale-[0.99]"
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${b.color} flex items-center justify-center flex-none`}>
              <b.icon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-heading font-bold text-base text-slate-900">{b.title}</div>
              <div className="text-xs text-slate-500">{b.desc}</div>
              <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">“{b.tagline}”</div>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-300 flex-none" />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============================ NEGOCIO (real AI) ============================ */
function NegocioBranch({ demoId, business, lead, onBack }) {
  const [sub, setSub] = useState("describe"); // describe | quote | agreement | invoice
  const [desc, setDesc] = useState("");
  const [quote, setQuote] = useState(null);
  const [biz, setBiz] = useState(business);
  const [agreement, setAgreement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [signed, setSigned] = useState(false);
  const [paid, setPaid] = useState(false);
  const [err, setErr] = useState("");

  const genQuote = async () => {
    setErr("");
    if (desc.trim().length < 6) { setErr("Describe el trabajo con un poco más de detalle."); return; }
    setLoading(true);
    try {
      const r = await axios.post(`${API}/public/demo/quote`, { demo_id: demoId, description_es: desc });
      setQuote(r.data.quote);
      setBiz(r.data.business);
      fbTrack("ViewContent", { content_name: "Demo AI Quote", value: Number(r.data.quote?.total || 0), currency: "USD" });
      fbTrackCustom("DemoQuoteGenerated");
      setSub("quote");
      window.scrollTo(0, 0);
    } catch (e) {
      setErr(e?.response?.data?.detail || "La IA no pudo generar la cotización. Intenta de nuevo.");
    } finally { setLoading(false); }
  };

  const genAgreement = async () => {
    setErr("");
    setLoading(true);
    try {
      const r = await axios.post(`${API}/public/demo/agreement`, {
        demo_id: demoId,
        description_es: desc,
        job_title: quote?.job_title || "",
        total: quote?.total || 0,
        deposit: quote?.deposit_amount || 0,
      });
      setAgreement(r.data.agreement);
      setSub("agreement");
      window.scrollTo(0, 0);
    } catch (e) {
      setErr(e?.response?.data?.detail || "La IA no pudo generar el contrato. Intenta de nuevo.");
    } finally { setLoading(false); }
  };

  return (
    <div>
      {loading && sub === "describe" && <GeneratingOverlay />}
      {loading && sub === "quote" && <GeneratingOverlay />}
      <BackBar onBack={onBack} label="Cotizar y cobrar" />
      {err && <div className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{err}</div>}

      {sub === "describe" && (
        <Card className="p-6 sm:p-8 rounded-2xl border-slate-200">
          <h2 className="font-heading text-2xl font-bold">Describe el trabajo… en español</h2>
          <p className="text-slate-600 mt-1">Como se lo dirías a un amigo. La IA hace el resto.</p>
          <div className="flex flex-wrap gap-2 mt-4">
            {NEG_EXAMPLES.map((ex) => (
              <button key={ex.label} data-testid={`demo-all-example-${ex.label}`} onClick={() => setDesc(ex.text)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700">
                {ex.label}
              </button>
            ))}
          </div>
          <Textarea data-testid="demo-all-desc" value={desc} onChange={(e) => setDesc(e.target.value)} rows={5}
            placeholder="Ej: Reemplazar techo de 1500 pies cuadrados con shingles nuevos…"
            className="mt-3 rounded-xl text-base" />
          <Button data-testid="demo-all-gen-quote-btn" onClick={genQuote} disabled={loading} className="mt-5 w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base">
            {loading ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> La IA está cotizando…</> : <><Sparkles className="w-5 h-5 mr-2" /> Generar cotización con IA</>}
          </Button>
        </Card>
      )}

      {sub === "quote" && (
        <QuoteStep quote={quote} business={biz} lead={lead} onAccept={genAgreement} loading={loading} onBack={() => setSub("describe")} />
      )}
      {sub === "agreement" && (
        <AgreementStep agreement={agreement} business={biz} lead={lead} signed={signed} onSign={() => { setSigned(true); setSub("invoice"); window.scrollTo(0, 0); }} />
      )}
      {sub === "invoice" && (
        <>
          <InvoiceStep quote={quote} business={biz} lead={lead} paid={paid} onPay={() => setPaid(true)} hideFinalCta />
          {paid && <ModuleUpsell highlight="negocio" />}
        </>
      )}
    </div>
  );
}

/* ============================ PRESENCIA (simulado) ============================ */
function PresenciaBranch({ lead, onBack }) {
  const [opened, setOpened] = useState(false);
  const meta = tradeMeta(lead.trade);
  const name = brandName(lead);

  const open = () => {
    setOpened(true);
    fbTrackCustom("DemoPresenciaViewed", { trade: lead.trade || "" });
  };

  return (
    <div data-testid="demo-presencia-branch">
      <BackBar onBack={onBack} label="Presencia digital" />
      <div className="text-center mb-4">
        <h2 className="font-heading text-2xl font-bold">Tu tarjeta NFC + mini-sitio</h2>
        <p className="text-slate-600 mt-1 text-sm max-w-md mx-auto">
          Tus clientes acercan el teléfono a tu tarjeta y al instante ven tu mini-sitio profesional. Sin apps.
        </p>
      </div>

      {!opened ? (
        <div className="flex flex-col items-center py-6">
          <button
            data-testid="demo-nfc-tap"
            onClick={open}
            className="relative w-44 h-28 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-xl flex flex-col items-center justify-center active:scale-95 transition-transform"
          >
            <span className="absolute inset-0 rounded-2xl ring-4 ring-emerald-400/40 animate-ping" />
            <Nfc className="w-8 h-8 mb-1" />
            <span className="font-heading font-bold text-sm">{name}</span>
            <span className="text-[10px] text-white/70">Tarjeta NFC</span>
          </button>
          <p className="mt-4 text-sm font-semibold text-emerald-700">📲 Toca la tarjeta para abrir tu mini-sitio</p>
        </div>
      ) : (
        <PhoneMockup>
          <MiniSite name={name} meta={meta} lead={lead} />
        </PhoneMockup>
      )}

      {opened && (
        <>
          <FeatureRow items={[
            { icon: Star, text: "Reseñas 5★ de Google, pidiéndolas con un tap" },
            { icon: MessageCircle, text: "Botón de WhatsApp para que te contacten al instante" },
            { icon: Contact, text: "“Guardar contacto” deja tu info en su teléfono" },
          ]} />
          <ModuleUpsell highlight="presencia" />
        </>
      )}
    </div>
  );
}

function PhoneMockup({ children }) {
  return (
    <div className="flex justify-center" data-testid="demo-interactive-mockup">
      <div className="w-[300px] rounded-[2.2rem] border-[10px] border-slate-900 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="h-5 bg-slate-900 flex items-center justify-center">
          <div className="w-16 h-1.5 rounded-full bg-slate-700" />
        </div>
        <div className="bg-white max-h-[560px] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function MiniSite({ name, meta, lead }) {
  const initial = (lead.name || "U").charAt(0).toUpperCase();
  return (
    <div className="animate-in fade-in duration-500">
      <div className="h-28 bg-gradient-to-br from-blue-900 to-emerald-600 relative">
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white border-4 border-white shadow flex items-center justify-center">
          <div className="w-full h-full rounded-full bg-gradient-to-br from-emerald-500 to-blue-700 text-white flex items-center justify-center font-heading font-bold text-xl">
            {initial}
          </div>
        </div>
      </div>
      <div className="pt-10 px-4 pb-5 text-center">
        <h3 className="font-heading font-bold text-lg">{name}</h3>
        <p className="text-xs text-slate-500">{meta.en} · {lead.name || "Owner"}</p>
        <div className="flex items-center justify-center gap-1 mt-1.5 text-amber-500">
          {[1,2,3,4,5].map((i) => <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}
          <span className="text-xs text-slate-600 font-semibold ml-1">5.0 · 127 reseñas</span>
        </div>
        <div className="flex items-center justify-center gap-1 mt-1 text-[11px] text-slate-500">
          <MapPin className="w-3 h-3" /> Houston, TX & alrededores
        </div>

        <div className="flex items-center justify-center gap-2 mt-2 text-[10px]">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold"><BadgeCheck className="w-3 h-3" /> Licensed</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold"><BadgeCheck className="w-3 h-3" /> Insured</span>
        </div>

        <button className="mt-4 w-full py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2">
          <MessageCircle className="w-4 h-4" /> WhatsApp
        </button>
        <button className="mt-2 w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-sm flex items-center justify-center gap-2">
          <Phone className="w-4 h-4" /> Llamar
        </button>
        <button className="mt-2 w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center gap-2">
          <Contact className="w-4 h-4" /> Guardar contacto
        </button>

        <div className="mt-4 text-left">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Servicios</div>
          <div className="space-y-1.5">
            {meta.services.map((s) => (
              <div key={s} className="px-3 py-2 rounded-lg bg-slate-50 text-sm font-medium text-slate-700">{s}</div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-left">
          <div className="flex items-center gap-1 text-amber-600 mb-1">
            {[1,2,3,4,5].map((i) => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}
          </div>
          <p className="text-xs text-slate-600 italic">“Best {meta.en.toLowerCase()} crew in town. On time and clean work!” — María R.</p>
          <button className="mt-2 w-full py-2 rounded-lg bg-amber-400 text-amber-950 font-bold text-xs">Déjanos una reseña ★</button>
        </div>
      </div>
    </div>
  );
}

/* ============================ MARKETING (simulado) ============================ */
function MarketingBranch({ lead, onBack }) {
  const [brief, setBrief] = useState("");
  const [stage, setStage] = useState("input"); // input | generating | result
  const [copied, setCopied] = useState(false);
  const meta = tradeMeta(lead.trade);
  const name = brandName(lead);
  const postImg = meta.img;
  const headline = `${meta.en} Done Right`;

  const caption = `🔥 ${meta.en} done right by ${name}! Quality work, fair prices, and 100% satisfaction guaranteed. Serving Houston & surrounding areas. 📲 Message us for a FREE estimate today!\n\n#${meta.en.replace(/\s/g, "")} #Houston #LocalBusiness`;

  const generate = () => {
    if (brief.trim().length < 4) return;
    setStage("generating");
    fbTrackCustom("DemoMarketingGenerate", { trade: lead.trade || "" });
    setTimeout(() => {
      setStage("result");
      window.scrollTo(0, 0);
    }, 2200);
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(caption); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* noop */ }
  };

  return (
    <div data-testid="demo-marketing-branch">
      <BackBar onBack={onBack} label="Marketing con IA" />

      {stage === "input" && (
        <Card className="p-6 sm:p-8 rounded-2xl border-slate-200">
          <h2 className="font-heading text-2xl font-bold">Escribe la idea… en español</h2>
          <p className="text-slate-600 mt-1">La IA crea el post con tu marca, en inglés, listo para subir.</p>
          <div className="flex flex-wrap gap-2 mt-4">
            {MKT_EXAMPLES.map((ex, i) => (
              <button key={i} data-testid={`demo-mkt-example-${i}`} onClick={() => setBrief(ex)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700">
                {ex.length > 30 ? ex.slice(0, 30) + "…" : ex}
              </button>
            ))}
          </div>
          <Textarea data-testid="demo-mkt-brief" value={brief} onChange={(e) => setBrief(e.target.value)} rows={4}
            placeholder="Ej: Terminé este techo nuevo, quedó increíble"
            className="mt-3 rounded-xl text-base" />
          <Button data-testid="demo-mkt-generate-btn" onClick={generate} disabled={brief.trim().length < 4}
            className="mt-5 w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-base">
            <Sparkles className="w-5 h-5 mr-2" /> Crear post con IA
          </Button>
        </Card>
      )}

      {stage === "generating" && (
        <div data-testid="demo-mkt-generating" className="py-12 text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-violet-100" />
            <div className="absolute inset-0 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" />
            <Sparkles className="w-6 h-6 text-violet-600 absolute inset-0 m-auto" />
          </div>
          <h3 className="font-heading text-xl font-bold">La IA está creando tu post…</h3>
          <p className="text-sm text-slate-500 mt-2">Diseño con tu marca + caption en inglés. Unos segundos.</p>
        </div>
      )}

      {stage === "result" && (
        <div data-testid="demo-mkt-result">
          <div className="mb-3 rounded-xl bg-violet-50 border border-violet-200 text-violet-800 text-sm font-semibold px-4 py-2.5 flex items-center gap-2">
            <Sparkles className="w-4 h-4 flex-none" /> ¡Listo! Tu post para Instagram/Facebook, con tu marca 👇
          </div>
          <PhoneMockup>
            <div className="bg-white">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white flex items-center justify-center text-xs font-bold">
                  {(lead.name || "U").charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-semibold">{name.toLowerCase().replace(/\s/g, "_")}</span>
              </div>
              <div className="relative">
                <img src={postImg} alt="post" className="w-full aspect-square object-cover" data-testid="demo-mkt-post-img" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3">
                  <div className="text-white font-heading font-extrabold text-lg leading-tight drop-shadow">{headline}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-white/90 text-[11px] font-semibold">{name} · Houston, TX</span>
                    <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">FREE ESTIMATE</span>
                  </div>
                </div>
                <div className="absolute top-2 left-2 bg-white/90 text-blue-900 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Hecho con IA
                </div>
              </div>
              <div className="px-3 py-2">
                <div className="flex items-center gap-3 text-slate-700 mb-1">
                  <span className="text-lg">♥</span><span className="text-lg">💬</span><span className="text-lg">➤</span>
                </div>
                <p className="text-xs text-slate-700 whitespace-pre-wrap leading-snug">{caption}</p>
              </div>
            </div>
          </PhoneMockup>

          <div className="mt-4 flex gap-2 justify-center">
            <Button data-testid="demo-mkt-copy" onClick={copy} variant="outline" size="sm" className="rounded-xl">
              {copied ? <Check className="w-4 h-4 mr-1 text-emerald-600" /> : <Copy className="w-4 h-4 mr-1" />} Copiar caption
            </Button>
            <span className="inline-flex items-center gap-1 px-3 h-9 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold">
              <PlayCircle className="w-4 h-4" /> +Reel en video
            </span>
            <span className="inline-flex items-center gap-1 px-3 h-9 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold">
              <ImageIcon className="w-4 h-4" /> +Imagen IA
            </span>
          </div>

          <FeatureRow items={[
            { icon: ImageIcon, text: "Posts con tu logo, colores, teléfono y CTA" },
            { icon: PlayCircle, text: "Reels en video con voz en off en español nativo" },
            { icon: Sparkles, text: "¿No tienes foto? La IA te crea la imagen" },
          ]} />
          <ModuleUpsell highlight="marketing" />
        </div>
      )}
    </div>
  );
}

/* ============================ Shared ============================ */
function BackBar({ onBack, label }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <button data-testid="demo-all-back" onClick={onBack} className="text-sm text-slate-500 hover:text-slate-800 inline-flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Cambiar
      </button>
      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
    </div>
  );
}

function FeatureRow({ items }) {
  return (
    <div className="mt-5 grid gap-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-none">
            <it.icon className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-sm text-slate-700">{it.text}</span>
        </div>
      ))}
    </div>
  );
}

const UPSELL_MODULES = {
  presencia: { icon: Star, title: "Presencia digital", desc: "Tarjeta NFC + mini-sitio + reseñas 5★" },
  negocio: { icon: FileText, title: "Cotizar y cobrar", desc: "Cotización IA, contrato y factura" },
  marketing: { icon: Megaphone, title: "Marketing con IA", desc: "Posts, reels e imágenes con tu marca" },
};

function ModuleUpsell({ highlight }) {
  return (
    <Card className="mt-6 p-6 sm:p-8 rounded-2xl text-center bg-gradient-to-br from-blue-900 to-emerald-700 text-white border-0" data-testid="demo-module-upsell">
      <PartyPopper className="w-9 h-9 mx-auto mb-2" />
      <h2 className="font-heading text-2xl font-bold">Y eso es solo una parte</h2>
      <p className="text-white/85 mt-1 max-w-md mx-auto text-sm">
        UniTech junta TODO lo que tu negocio necesita. Arma tu plan con los módulos que quieras:
      </p>
      <div className="mt-5 grid gap-2 text-left">
        {Object.entries(UPSELL_MODULES).map(([id, m]) => (
          <div key={id} className={`flex items-center gap-3 p-3 rounded-xl ${id === highlight ? "bg-white/20 ring-2 ring-white/50" : "bg-white/10"}`}>
            <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center flex-none">
              <m.icon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-heading font-bold text-sm flex items-center gap-2">
                {m.title}
                {id === highlight && <span className="text-[9px] uppercase tracking-wider bg-white text-blue-900 px-1.5 py-0.5 rounded-full">Lo que viste</span>}
              </div>
              <div className="text-[11px] text-white/80">{m.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <Link data-testid="demo-all-final-cta" to="/register" className="inline-flex items-center gap-2 mt-6 px-7 py-3 rounded-2xl bg-white text-blue-900 font-bold hover:bg-slate-100">
        Crear mi cuenta gratis <ArrowRight className="w-4 h-4" />
      </Link>
      <p className="text-[11px] text-white/70 mt-3">14 días gratis · sin tarjeta · cancela cuando quieras</p>
    </Card>
  );
}
