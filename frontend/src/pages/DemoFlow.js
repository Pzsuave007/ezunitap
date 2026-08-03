/**
 * DemoFlow — Public, no-login LIVE DEMO of the full UniTech flow:
 *   capture lead -> describe job (ES) -> AI quote (EN) -> approve ->
 *   sign AI Service Agreement (EN) -> invoice with payment links (simulated).
 * Designed to be shared so prospects "feel" the product before signing up.
 */
import { useState, useEffect, useRef } from "react";
import { useTranslation, Trans } from "react-i18next";
import { Link } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, Hammer, CheckCircle2, Sparkles, ArrowRight, ArrowLeft,
  ShieldCheck, CreditCard, PartyPopper, Send, PenLine, Lock, FileDown, Printer,
  MessageCircle, Smartphone, Wallet,
} from "lucide-react";
import { generateQuotePDF, generateInvoicePDF } from "@/lib/pdf";
import { fbTrack, fbTrackCustom } from "@/lib/fbpixel";
import { trackDemo } from "@/lib/demoAnalytics";
import { WhatsAppFab, WhatsAppButton } from "@/components/WhatsAppButton";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmtMoney = (n) =>
  `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TRADES = [
  "Techos / Roofing", "Drywall", "Pintura / Painting", "Concreto / Concrete",
  "Jardinería / Landscaping", "Limpieza / Cleaning", "Plomería / Plumbing",
  "HVAC / Aire acondicionado", "Electricidad / Electrical", "Pisos y Azulejo / Flooring & Tile",
  "Cercas / Fencing", "Handyman / Reparaciones", "Lavado a presión / Pressure Washing",
  "Remodelación / Remodeling", "Mudanzas / Moving", "Acarreo de basura / Junk Removal",
  "Árboles y poda / Tree Service", "Albañilería y Stucco / Masonry", "Control de plagas / Pest Control",
  "Ventanas y Puertas / Windows & Doors", "Canaletas / Gutters", "Detallado de autos / Auto Detailing",
  "Otro",
];

// Localized display label for a trade (the stored value stays bilingual for lookups).
export const TRADE_LABELS = {
  "Techos / Roofing": { es: "Techos", en: "Roofing" },
  "Drywall": { es: "Drywall", en: "Drywall" },
  "Pintura / Painting": { es: "Pintura", en: "Painting" },
  "Concreto / Concrete": { es: "Concreto", en: "Concrete" },
  "Jardinería / Landscaping": { es: "Jardinería", en: "Landscaping" },
  "Limpieza / Cleaning": { es: "Limpieza", en: "Cleaning" },
  "Plomería / Plumbing": { es: "Plomería", en: "Plumbing" },
  "HVAC / Aire acondicionado": { es: "Aire acondicionado", en: "HVAC" },
  "Electricidad / Electrical": { es: "Electricidad", en: "Electrical" },
  "Pisos y Azulejo / Flooring & Tile": { es: "Pisos y Azulejo", en: "Flooring & Tile" },
  "Cercas / Fencing": { es: "Cercas", en: "Fencing" },
  "Handyman / Reparaciones": { es: "Reparaciones", en: "Handyman" },
  "Lavado a presión / Pressure Washing": { es: "Lavado a presión", en: "Pressure Washing" },
  "Remodelación / Remodeling": { es: "Remodelación", en: "Remodeling" },
  "Mudanzas / Moving": { es: "Mudanzas", en: "Moving" },
  "Acarreo de basura / Junk Removal": { es: "Acarreo de basura", en: "Junk Removal" },
  "Árboles y poda / Tree Service": { es: "Árboles y poda", en: "Tree Service" },
  "Albañilería y Stucco / Masonry": { es: "Albañilería y Stucco", en: "Masonry" },
  "Control de plagas / Pest Control": { es: "Control de plagas", en: "Pest Control" },
  "Ventanas y Puertas / Windows & Doors": { es: "Ventanas y Puertas", en: "Windows & Doors" },
  "Canaletas / Gutters": { es: "Canaletas", en: "Gutters" },
  "Detallado de autos / Auto Detailing": { es: "Detallado de autos", en: "Auto Detailing" },
  "Otro": { es: "Otro", en: "Other" },
};
export const tradeLabel = (val, lng) =>
  (TRADE_LABELS[val]?.[lng?.startsWith("es") ? "es" : "en"]) || val;

// Auto-fills the job description based on the trade the user picked. Reuses the
// same per-trade sample requests as /demo-flujo. The field stays fully editable
// so the user can add or remove detail.
export function jobRequestText(trade, t) {
  const s = (trade || "").toLowerCase();
  let key = "reqGeneric";
  if (s.includes("roof") || s.includes("techo")) key = "reqRoofing";
  else if (s.includes("drywall")) key = "reqDrywall";
  else if (s.includes("paint") || s.includes("pintura")) key = "reqPainting";
  else if (s.includes("concret")) key = "reqConcrete";
  else if (s.includes("landscap") || s.includes("jardin")) key = "reqLandscaping";
  else if (s.includes("clean") || s.includes("limpieza")) key = "reqCleaning";
  else if (s.includes("plumb") || s.includes("plom")) key = "reqPlumbing";
  else if (s.includes("hvac") || s.includes("aire")) key = "reqHvac";
  else if (s.includes("electr")) key = "reqElectrical";
  else if (s.includes("floor") || s.includes("tile") || s.includes("piso") || s.includes("azulejo")) key = "reqFlooring";
  else if (s.includes("fenc") || s.includes("cerca")) key = "reqFencing";
  else if (s.includes("handyman") || s.includes("reparacion")) key = "reqHandyman";
  else if (s.includes("pressure") || s.includes("lavado")) key = "reqPressure";
  else if (s.includes("remodel")) key = "reqRemodeling";
  else if (s.includes("moving") || s.includes("mudanza")) key = "reqMoving";
  else if (s.includes("junk") || s.includes("acarreo") || s.includes("basura")) key = "reqJunk";
  else if (s.includes("tree") || s.includes("arbol") || s.includes("árbol") || s.includes("poda")) key = "reqTree";
  else if (s.includes("mason") || s.includes("stucco") || s.includes("albañil") || s.includes("albanil")) key = "reqMasonry";
  else if (s.includes("pest") || s.includes("plaga")) key = "reqPest";
  else if (s.includes("window") || s.includes("ventana") || s.includes("door") || s.includes("puerta")) key = "reqWindows";
  else if (s.includes("gutter") || s.includes("canaleta")) key = "reqGutters";
  else if (s.includes("detail") || s.includes("detallado")) key = "reqAuto";
  return t(`demoFlujo.${key}`);
}

const EXAMPLE_IDS = ["roof", "drywall", "paint"];

export default function DemoFlow() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [demoId, setDemoId] = useState(null);
  const [lead, setLead] = useState({ name: "", email: "", phone: "", trade: "" });
  // Pre-fill a sample client name so the quote/agreement/invoice look real with
  // zero friction (editable). Same fictitious client as the full demo.
  useEffect(() => {
    setLead((l) => (l.name ? l : { ...l, name: t("demoFlujo.clientFull") }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [desc, setDesc] = useState("");
  const [quote, setQuote] = useState(null);
  const [business, setBusiness] = useState(null);
  const [agreement, setAgreement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [signed, setSigned] = useState(false);
  const [paid, setPaid] = useState(false);

  const apiErr = (e, fallback) => setErr(e?.response?.data?.detail || fallback);

  // First-party funnel tracking (tagged "corto" so it's separate from the full demo).
  const track = (event, data = {}) => trackDemo(event, { ...data, demo: "corto" });
  const stepRef = useRef(step);
  const tradeRef = useRef(lead.trade);
  useEffect(() => { tradeRef.current = lead.trade; }, [lead.trade]);
  useEffect(() => {
    stepRef.current = step;
    track("step_view", { step, trade: lead.trade });
    // Auto-fill the job description from the chosen trade when reaching the
    // Describe step (editable — the user can add or remove detail).
    if (step === 1 && !desc.trim()) setDesc(jobRequestText(lead.trade, t));
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") track("leave", { step: stepRef.current, trade: tradeRef.current });
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Instant Service Agreement (no AI wait) — mirrors /demo-flujo. The real
  // account uses the full AI generator; here it only needs to look pro.
  const buildDemoAgreement = () => {
    const biz = business?.business_name || "Demo Contractors";
    const clientName = lead.name || "Client";
    const totalNum = Number(quote?.total || 0);
    const depNum = Number(quote?.deposit_amount || totalNum * 0.5);
    const balance = Math.max(totalNum - depNum, 0);
    const scope = (quote?.scope_of_work || []).join("; ") || quote?.description || desc;
    return {
      title: `Service Agreement — ${quote?.job_title || ""}`,
      preamble: `This Service Agreement ("Agreement") is entered into between ${biz} ("Contractor") and ${clientName} ("Client") and becomes effective on the date signed by both parties.`,
      services_included: scope,
      services_excluded: "Any work, materials, or permits not expressly listed above are excluded and, if requested, will be quoted separately as a Change Order.",
      schedule: "Work will begin on a mutually agreed date and proceed continuously, weather and site conditions permitting, until completion.",
      pricing: `Total price: ${fmtMoney(totalNum)}, covering all labor and materials described in the Services Included section.`,
      payment_terms: `A deposit of ${fmtMoney(depNum)} is due upon signing to reserve the schedule and cover initial materials. The remaining balance of ${fmtMoney(balance)} is due upon completion of the work.`,
      cancellation_policy: "Either party may cancel with written notice. If the Client cancels after work or material purchase has begun, the Contractor may retain amounts covering costs incurred to date.",
      client_responsibilities: "The Client will provide safe access to the work area, keep it reasonably clear, and ensure utilities are available as needed for the Contractor to perform the work.",
      warranty: "The Contractor warrants workmanship for 12 months from completion. Manufacturer warranties on materials are passed through to the Client.",
      change_orders: "Any change to the scope, materials, or schedule must be agreed in writing (a Change Order) and may adjust the price and timeline accordingly.",
      dispute_resolution: "The parties will first attempt to resolve any dispute in good faith. If unresolved, disputes will be handled under the laws of the Contractor's state of operation.",
    };
  };

  const startDemo = async () => {
    setErr("");
    setLoading(true);
    try {
      const r = await axios.post(`${API}/public/demo/start`, lead);
      setDemoId(r.data.demo_id);
      setBusiness(r.data.business);
      // Meta Pixel: mid-funnel lead — prospect started the live demo.
      fbTrack("Lead", { content_name: "Live Demo Start", content_category: lead.trade || "" });
      fbTrackCustom("DemoStarted", { trade: lead.trade || "" });
      track("demo_start", { step: 1, trade: lead.trade });
      setStep(1);
    } catch (e) {
      apiErr(e, t("demo.errStart"));
    } finally {
      setLoading(false);
    }
  };

  const genQuote = async () => {
    setErr("");
    if (desc.trim().length < 6) {
      setErr(t("demoFlow.errDesc"));
      return;
    }
    setLoading(true);
    try {
      const r = await axios.post(`${API}/public/demo/quote`, { demo_id: demoId, description_es: desc });
      setQuote(r.data.quote);
      setBusiness(r.data.business);
      // Meta Pixel: the "magic moment" — AI produced the English quote.
      fbTrack("ViewContent", { content_name: "Demo AI Quote", value: Number(r.data.quote?.total || 0), currency: "USD" });
      fbTrackCustom("DemoQuoteGenerated");
      track("quote_generated", { step: 2, trade: lead.trade, meta: { total: Number(r.data.quote?.total || 0) } });
      setStep(2);
      window.scrollTo(0, 0);
    } catch (e) {
      apiErr(e, t("demoFlow.errQuote"));
    } finally {
      setLoading(false);
    }
  };

  const genAgreement = () => {
    setErr("");
    setAgreement(buildDemoAgreement());
    setStep(3);
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-slate-50" data-testid="demo-flow">
      <TopBar />
      {loading && step === 2 && <GeneratingOverlay />}
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-20">
        <StepBar step={step} />
        {err && (
          <div data-testid="demo-error" className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
            {err}
          </div>
        )}
        {step === 0 && <LeadStep lead={lead} setLead={setLead} onStart={startDemo} loading={loading} />}
        {step === 1 && <DescribeStep desc={desc} setDesc={setDesc} onGen={genQuote} loading={loading} onBack={() => setStep(0)} />}
        {step === 2 && <QuoteStep quote={quote} business={business} lead={lead} onAccept={genAgreement} loading={loading} onBack={() => setStep(1)} />}
        {step === 3 && <AgreementStep agreement={agreement} business={business} lead={lead} signed={signed} onSign={() => { setSigned(true); setStep(4); window.scrollTo(0, 0); }} />}
        {step === 4 && <InvoiceStep quote={quote} business={business} lead={lead} paid={paid} demoId={demoId} onPay={() => { setPaid(true); track("demo_completed", { step: 4, trade: lead.trade }); }} />}
      </div>
      <WhatsAppFab onClick={() => track("whatsapp_click", { step, trade: lead.trade, meta: { place: "fab" } })} />
    </div>
  );
}

export function GeneratingOverlay({ title, subtitle } = {}) {
  const { t } = useTranslation();
  const finalTitle = title ?? t("demoFlow.overlayTitle");
  const finalSubtitle = subtitle ?? (
    <Trans i18nKey="demoFlow.overlaySubtitle" components={{ 1: <strong /> }} />
  );
  return (
    <div data-testid="demo-generating-overlay" className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-100" />
          <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
          <Sparkles className="w-6 h-6 text-emerald-600 absolute inset-0 m-auto" />
        </div>
        <h3 className="font-heading text-xl font-bold text-slate-900">{finalTitle}</h3>
        <p className="text-sm text-slate-500 mt-2">{finalSubtitle}</p>
      </div>
    </div>
  );
}

function TopBar() {
  const { t } = useTranslation();
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2" data-testid="demo-logo">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center">
            <Hammer className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-heading font-bold">UniTech</span>
          <span className="text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Demo</span>
        </Link>
        <Link to="/register?plan=negocio" data-testid="demo-signup-top" className="text-sm font-semibold text-blue-900 hover:underline">
          {t("demo.signupTop")}
        </Link>
      </div>
    </header>
  );
}

function StepBar({ step }) {
  const { t } = useTranslation();
  const steps = t("demoFlow.steps", { returnObjects: true });
  return (
    <div className="flex items-center gap-1.5 mb-6" data-testid="demo-stepbar">
      {steps.map((label, i) => (
        <div key={label} className="flex-1">
          <div className={`h-1.5 rounded-full transition-colors ${i <= step ? "bg-emerald-500" : "bg-slate-200"}`} />
          <div className={`text-xs mt-1 font-semibold ${i <= step ? "text-emerald-700" : "text-slate-400"}`}>{label}</div>
        </div>
      ))}
    </div>
  );
}

function LeadStep({ lead, setLead, onStart, loading }) {
  const { t, i18n } = useTranslation();
  const set = (k) => (e) => setLead({ ...lead, [k]: e.target.value });
  return (
    <Card className="p-6 sm:p-8 rounded-2xl border-slate-200">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-4">
        <Sparkles className="w-3.5 h-3.5" /> {t("demo.liveBadge")}
      </div>
      <h1 className="font-heading text-3xl font-bold tracking-tight leading-tight">{t("demoFlow.startHeroTitle")}</h1>
      <p className="text-slate-600 mt-2 leading-relaxed">{t("demoFlow.startHeroDesc")}</p>

      <div className="mt-6 space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("demoFlow.startClientLabel")}</label>
          <Input data-testid="demo-name" value={lead.name} onChange={set("name")} placeholder="María González" className="mt-1 h-13 rounded-xl text-base" />
          <p className="text-xs text-slate-400 mt-1.5">{t("demoFlow.startClientHint")}</p>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("demoFlow.startTradeLabel")}</label>
          <select data-testid="demo-trade" value={lead.trade} onChange={set("trade")} className="mt-1 h-13 w-full rounded-xl border border-slate-200 px-3 text-base bg-white">
            <option value="">{t("demoFlow.startTradeChoose")}</option>
            {TRADES.map((tr) => <option key={tr} value={tr}>{tradeLabel(tr, i18n.language)}</option>)}
          </select>
        </div>
      </div>

      <Button data-testid="demo-start-btn" onClick={onStart} disabled={loading} className="mt-5 w-full h-13 py-3 rounded-xl bg-gradient-to-br from-blue-900 to-emerald-600 text-white font-bold text-base">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{t("demoFlow.startHeroBtn")} <ArrowRight className="w-4 h-4 ml-2" /></>}
      </Button>
      <p className="text-xs text-slate-400 mt-3 text-center">{t("demoFlow.startHeroNote")}</p>
    </Card>
  );
}

function DescribeStep({ desc, setDesc, onGen, loading, onBack }) {
  const { t } = useTranslation();
  return (
    <Card className="p-6 sm:p-8 rounded-2xl border-slate-200">
      <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 mb-4"><ArrowLeft className="w-4 h-4" /> {t("demoFlow.back")}</button>
      <h2 className="font-heading text-2xl font-bold">{t("demoFlow.describeTitle")}</h2>
      <p className="text-slate-600 mt-1">{t("demoFlow.describeDesc")}</p>
      <div className="flex flex-wrap gap-2 mt-4">
        {EXAMPLE_IDS.map((id) => (
          <button key={id} data-testid={`demo-example-${id}`} onClick={() => setDesc(t(`demoFlow.examples.${id}.text`))}
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700">
            {t(`demoFlow.examples.${id}.label`)}
          </button>
        ))}
      </div>
      <Textarea data-testid="demo-desc" value={desc} onChange={(e) => setDesc(e.target.value)} rows={5}
        placeholder={t("demoFlow.descPlaceholder")}
        className="mt-3 rounded-xl text-base" />
      <Button data-testid="demo-gen-quote-btn" onClick={onGen} disabled={loading} className="mt-5 w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base">
        {loading ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> {t("demoFlow.genQuoteLoading")}</> : <><Sparkles className="w-5 h-5 mr-2" /> {t("demoFlow.genQuoteBtn")}</>}
      </Button>
    </Card>
  );
}

function DocHeader({ business, badge, number, date, dueDate }) {
  return (
    <div className="bg-gradient-to-br from-blue-900 to-blue-800 text-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Hammer className="w-5 h-5 flex-none" />
            <h1 className="font-heading text-xl sm:text-2xl font-bold truncate">{business?.business_name || "Demo Contractors"}</h1>
          </div>
          <div className="text-xs sm:text-sm text-white/80 space-y-0.5">
            <div>{business?.business_email}</div>
            <div>{business?.phone}</div>
            <div>{business?.business_address}</div>
          </div>
        </div>
        <div className="text-right flex-none">
          <div className="text-2xl sm:text-3xl font-heading font-bold leading-none">{badge}</div>
          {number && <div className="text-xs text-white/85 mt-2 font-semibold">#{number}</div>}
          {date && <div className="text-[11px] text-white/70 mt-0.5">Date: {date}</div>}
          {dueDate && <div className="text-[11px] text-white/70 mt-0.5">Due: {dueDate}</div>}
        </div>
      </div>
    </div>
  );
}

// Responsive line items — clean table on desktop, readable stacked rows on mobile
// (a 4-column table is unreadable on a real phone, which made it look "not real").
function LineItems({ items }) {
  if (!items?.length) return null;
  return (
    <div>
      <table className="w-full text-sm hidden sm:table">
        <thead className="bg-slate-100 text-left">
          <tr>
            <th className="p-2 font-semibold">Description</th>
            <th className="p-2 font-semibold text-right">Qty</th>
            <th className="p-2 font-semibold text-right">Price</th>
            <th className="p-2 font-semibold text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((li, i) => (
            <tr key={i} className="border-t border-slate-100">
              <td className="p-2">{li.description}</td>
              <td className="p-2 text-right whitespace-nowrap">{li.quantity} {li.unit}</td>
              <td className="p-2 text-right whitespace-nowrap">{fmtMoney(li.unit_price)}</td>
              <td className="p-2 text-right whitespace-nowrap font-semibold">{fmtMoney(li.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="sm:hidden border-y border-slate-100 divide-y divide-slate-100">
        {items.map((li, i) => (
          <div key={i} className="py-3">
            <div className="text-sm font-medium text-slate-800 leading-snug">{li.description}</div>
            <div className="flex items-center justify-between mt-1.5 text-sm">
              <span className="text-slate-500">{li.quantity} {li.unit} × {fmtMoney(li.unit_price)}</span>
              <span className="font-bold text-slate-900">{fmtMoney(li.amount)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const docDate = () => new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

export function QuoteStep({ quote, business, lead, onAccept, loading, onBack }) {
  const { t } = useTranslation();
  const [dl, setDl] = useState(false);
  if (!quote) return null;
  const downloadPdf = async () => {
    setDl(true);
    try {
      await generateQuotePDF(quote, business, { name: lead.name, email: lead.email });
    } finally {
      setDl(false);
    }
  };
  return (
    <div>
      <ClientBanner text={t("demoFlow.quoteBanner")} />
      <FormatNote />
      <Card className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <DocHeader business={business} badge="QUOTE" number={quote.number || "Q-1001"} date={docDate()} />
        <div className="p-5 sm:p-6 space-y-5">
          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">Bill To</div>
            <div className="font-semibold">{lead.name}</div>
            {lead.email && <div className="text-sm text-slate-600">{lead.email}</div>}
          </div>
          <div>
            <h2 className="font-heading text-xl font-bold">{quote.job_title}</h2>
            {quote.description && <p className="text-slate-700 mt-2">{quote.description}</p>}
          </div>
          {quote.scope_of_work?.length > 0 && (
            <div>
              <div className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">Scope of Work</div>
              <ul className="list-disc ml-5 space-y-1 text-sm">{quote.scope_of_work.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
          <LineItems items={quote.line_items} />
          <div className="bg-slate-50 rounded-xl p-4 space-y-1 text-sm sm:ml-auto sm:max-w-xs">
            <div className="flex justify-between"><span>Subtotal</span><span>{fmtMoney(quote.subtotal)}</span></div>
            <div className="flex justify-between"><span>Tax</span><span>{fmtMoney(quote.tax_amount)}</span></div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t mt-2"><span>TOTAL</span><span>{fmtMoney(quote.total)}</span></div>
            {quote.deposit_amount > 0 && <div className="flex justify-between text-emerald-700"><span>Deposit</span><span>{fmtMoney(quote.deposit_amount)}</span></div>}
          </div>
          {quote.payment_terms && (
            <div><div className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">Payment Terms</div><div className="text-sm">{quote.payment_terms}</div></div>
          )}
          <div className="rounded-xl border-2 border-blue-200 bg-blue-50/40 p-5 space-y-3 text-center">
            <h3 className="font-heading text-lg font-bold text-slate-900">Ready to move forward?</h3>
            <p className="text-sm text-slate-600">Accept this quote to review and sign your service agreement, then pay your deposit.</p>
            <Button data-testid="demo-accept-quote-btn" onClick={onAccept} disabled={loading} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold">
              {loading ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Preparing your agreement…</> : <><CheckCircle2 className="w-5 h-5 mr-2" /> Accept this Quote</>}
            </Button>
          </div>
        </div>
      </Card>
      <PdfActions onDownload={downloadPdf} downloading={dl} />
      <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 mt-4"><ArrowLeft className="w-4 h-4" /> {t("demoFlow.tryAnother")}</button>
    </div>
  );
}

function Clause({ title, children }) {
  if (!children || (Array.isArray(children) && children.length === 0)) return null;
  return (
    <div>
      <div className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">{title}</div>
      {Array.isArray(children)
        ? <ul className="list-disc ml-5 space-y-1 text-sm text-slate-700">{children.map((c, i) => <li key={i}>{c}</li>)}</ul>
        : <p className="text-sm text-slate-700 whitespace-pre-wrap">{children}</p>}
    </div>
  );
}

export function AgreementStep({ agreement, business, lead, signed, onSign }) {
  const { t } = useTranslation();
  if (!agreement) return null;
  return (
    <div>
      <ClientBanner text={t("demoFlow.agreementBanner")} />
      <Card className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <DocHeader business={business} badge="AGREEMENT" />
        <div className="p-6 space-y-4">
          <h2 className="font-heading text-xl font-bold">{agreement.title}</h2>
          {agreement.preamble && <p className="text-sm text-slate-700">{agreement.preamble}</p>}
          <Clause title="Services Included">{agreement.services_included}</Clause>
          <Clause title="Services Excluded">{agreement.services_excluded}</Clause>
          <Clause title="Schedule">{agreement.schedule}</Clause>
          <Clause title="Pricing">{agreement.pricing}</Clause>
          <Clause title="Payment Terms">{agreement.payment_terms}</Clause>
          <Clause title="Cancellation Policy">{agreement.cancellation_policy}</Clause>
          <Clause title="Client Responsibilities">{agreement.client_responsibilities}</Clause>
          <Clause title="Warranty">{agreement.warranty}</Clause>
          <Clause title="Change Orders">{agreement.change_orders}</Clause>
          <Clause title="Dispute Resolution">{agreement.dispute_resolution}</Clause>

          <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-5 mt-2">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2 inline-flex items-center gap-1"><PenLine className="w-3.5 h-3.5" /> Sign here</div>
            <div className="bg-white border border-slate-200 rounded-lg h-16 flex items-center px-4">
              <span className="font-[cursive] text-2xl text-slate-800">{lead.name}</span>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-white/70 border border-emerald-200 px-3 py-2 text-xs sm:text-sm text-emerald-800" data-testid="demo-sign-hint">
              <ShieldCheck className="w-4 h-4 flex-none mt-0.5" />
              <span>{t("demoFlow.demoSignHint")}</span>
            </div>
            <Button data-testid="demo-sign-btn" onClick={onSign} disabled={signed} className="w-full h-auto py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold mt-3 leading-tight">
              <ShieldCheck className="w-5 h-5 mr-2 flex-none" /> Sign &amp; Continue
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function InvoiceStep({ quote, business, lead, paid, onPay, demoId, hideFinalCta = false }) {
  const { t } = useTranslation();
  const [dl, setDl] = useState(false);
  const total = Number(quote?.total || 0);
  const deposit = Number(quote?.deposit_amount || 0) || Math.round(total * 0.5 * 100) / 100;
  const due = deposit > 0 ? deposit : total;
  const downloadPdf = async () => {
    setDl(true);
    try {
      const invoice = {
        ...quote,
        number: (quote?.number || "Q-1001").replace("Q-", "INV-"),
        deposit_amount: deposit,
        amount_paid: 0,
        status: "sent",
      };
      await generateInvoicePDF(invoice, business, { name: lead.name, email: lead.email });
    } finally {
      setDl(false);
    }
  };
  return (
    <div>
      <ClientBanner text={t("demoFlow.invoiceBanner")} />
      <FormatNote />
      <Card className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <DocHeader business={business} badge="INVOICE" number={(quote?.number || "Q-1001").replace("Q-", "INV-")} date={docDate()} dueDate="On receipt" />
        <div className="p-5 sm:p-6 space-y-5">
          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">Bill To</div>
            <div className="font-semibold">{lead.name}</div>
          </div>
          <div>
            <h2 className="font-heading text-xl font-bold">{quote?.job_title}</h2>
            {quote?.description && <p className="text-slate-700 mt-2">{quote.description}</p>}
          </div>
          {quote?.scope_of_work?.length > 0 && (
            <div>
              <div className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">Scope of Work</div>
              <ul className="list-disc ml-5 space-y-1 text-sm">{quote.scope_of_work.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
          <LineItems items={quote?.line_items} />
          <div className="bg-slate-50 rounded-xl p-4 space-y-1 text-sm sm:ml-auto sm:max-w-xs">
            <div className="flex justify-between"><span>Subtotal</span><span>{fmtMoney(quote?.subtotal)}</span></div>
            <div className="flex justify-between"><span>Tax</span><span>{fmtMoney(quote?.tax_amount)}</span></div>
            <div className="flex justify-between"><span>Total</span><span>{fmtMoney(total)}</span></div>
            <div className="flex justify-between text-emerald-700"><span>Deposit due now</span><span>{fmtMoney(deposit)}</span></div>
            <div className="flex justify-between font-bold pt-2 border-t mt-2"><span>Balance</span><span>{fmtMoney(total - deposit)}</span></div>
          </div>

          {/* Prominent payment-methods banner — the real product supports all of these */}
          <div data-testid="demo-pay-methods-banner" className="flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-blue-700 text-white px-4 py-3">
            <Wallet className="w-5 h-5 flex-none" />
            <span className="text-sm font-semibold leading-tight">{t("demoFlow.payMethodsBanner")}</span>
          </div>

          {paid ? (
            <div data-testid="demo-paid-block" className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-6 text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <div className="font-heading text-xl font-bold text-emerald-800">{t("demoFlow.paidTitle")}</div>
              <p className="text-sm text-emerald-700">{t("demoFlow.paidDesc")}</p>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-blue-200 bg-blue-50/40 p-5 space-y-3">
              <div className="text-sm font-bold uppercase tracking-wider text-slate-500">Pay securely</div>
              <div className="flex items-start gap-2 rounded-lg bg-white border border-blue-200 px-3 py-2 text-xs sm:text-sm text-blue-900" data-testid="demo-pay-hint">
                <ShieldCheck className="w-4 h-4 flex-none mt-0.5" />
                <span>{t("demoFlow.demoPayHint")}</span>
              </div>
              <Button data-testid="demo-pay-btn" onClick={onPay} className="w-full h-auto py-3.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white text-base font-bold leading-tight">
                <CreditCard className="w-5 h-5 mr-2 flex-none" /> Pay {fmtMoney(due)}
              </Button>
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-2">
                  <Lock className="w-3.5 h-3.5" /> {t("demoFlow.acceptsLabel")}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[t("demoFlow.card"), "Venmo", "Zelle", "Cash App", "PayPal"].map((m) => (
                    <span key={m} className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700">{m}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      <PdfActions onDownload={downloadPdf} downloading={dl} />

      {paid && !hideFinalCta && (
        <FinalCTA demoId={demoId} />
      )}
    </div>
  );
}

export function SendToMeCTA({ phone, sample, branch }) {
  const { t } = useTranslation();
  const digits = (phone || "").replace(/\D/g, "");
  const url = `${window.location.origin}/register`;
  const msg = t("demo.sendMsg", { sample, url });
  const enc = encodeURIComponent(msg);
  const wa = digits ? `https://wa.me/${digits}?text=${enc}` : `https://wa.me/?text=${enc}`;
  const sms = `sms:${digits}?&body=${enc}`;
  const track = (channel) => fbTrackCustom("DemoSendToMe", { channel, branch: branch || "" });
  return (
    <div data-testid="demo-send-to-me" className="mt-5 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 text-center">
      <div className="font-heading font-bold text-slate-900 text-sm mb-3">{t("demo.sendTitle")}</div>
      <div className="flex flex-wrap gap-2 justify-center">
        <a data-testid="demo-send-whatsapp" href={wa} target="_blank" rel="noreferrer" onClick={() => track("whatsapp")}
           className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm tap">
          <MessageCircle className="w-4 h-4" /> {t("demo.sendWhatsapp")}
        </a>
        <a data-testid="demo-send-sms" href={sms} onClick={() => track("sms")}
           className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-emerald-300 text-emerald-700 font-bold text-sm tap">
          <Smartphone className="w-4 h-4" /> {t("demo.sendSms")}
        </a>
      </div>
    </div>
  );
}

function ClientBanner({ text }) {
  return (
    <div className="mb-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-base font-semibold px-4 py-3 flex items-center gap-2">
      <Send className="w-5 h-5 flex-none" /> {text}
    </div>
  );
}

// Reassures phone users that the on-screen format is just for easy editing —
// the client actually receives a normal, professional PDF quote/invoice.
function FormatNote() {
  const { t } = useTranslation();
  return (
    <div data-testid="demo-format-note" className="sm:hidden mb-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs px-3 py-2.5 flex items-start gap-2">
      <Smartphone className="w-4 h-4 flex-none mt-0.5" />
      <span>{t("demoFlow.formatNote")}</span>
    </div>
  );
}

function PdfActions({ onDownload, downloading }) {
  const { t } = useTranslation();
  return (
    <div data-testid="demo-pdf-actions" className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-3">
      <div className="flex items-center gap-2 flex-wrap justify-center">
        <Button
          data-testid="demo-download-pdf"
          onClick={onDownload}
          disabled={downloading}
          variant="outline"
          size="sm"
          className="rounded-xl"
        >
          {downloading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <FileDown className="w-4 h-4 mr-1" />} {t("demoFlow.downloadPdf")}
        </Button>
        <Button
          data-testid="demo-print"
          onClick={() => window.print()}
          variant="outline"
          size="sm"
          className="rounded-xl"
        >
          <Printer className="w-4 h-4 mr-1" /> {t("demoFlow.print")}
        </Button>
      </div>
      <p className="text-xs text-slate-500 text-center mt-2">
        <Trans i18nKey="demoFlow.pdfNote" components={{ 1: <strong /> }} />
      </p>
    </div>
  );
}

function FinalCTA({ demoId }) {
  const { t } = useTranslation();
  const [founder, setFounder] = useState(null);
  const [cap, setCap] = useState({ name: "", email: "" });
  const [capSaved, setCapSaved] = useState(false);
  const [capBusy, setCapBusy] = useState(false);
  useEffect(() => {
    // Negocio Founder offer: $29/mo for life, first 100. Falls back to $39.99.
    axios.get(`${API}/payments/negocio-founder-status`).then((r) => setFounder(r.data)).catch(() => {});
  }, []);
  const founderOn = founder?.available;
  const to = founderOn ? "/register?plan=negocio_founder" : "/register?plan=negocio";

  const saveContact = async () => {
    const v = (cap.email || "").trim();
    if (!cap.name.trim() && !v) return;
    const isPhone = v && /^[\d\s()+.-]{7,}$/.test(v);
    const payload = { name: cap.name.trim(), email: isPhone ? "" : v, phone: isPhone ? v : "" };
    setCapBusy(true);
    try {
      if (demoId) await axios.post(`${API}/public/demo/${demoId}/contact`, payload);
      trackDemo("contact_captured", { step: 4, demo: "corto" });
      setCapSaved(true);
    } catch { /* non-blocking */ }
    finally { setCapBusy(false); }
  };

  return (
    <Card className="mt-6 p-8 rounded-2xl text-center bg-gradient-to-br from-blue-900 to-emerald-700 text-white border-0">
      <PartyPopper className="w-10 h-10 mx-auto mb-3" />
      <h2 className="font-heading text-2xl font-bold">{t("demoFlow.finalTitle")}</h2>
      <p className="text-white/85 mt-2 max-w-md mx-auto">
        {t("demoFlow.finalDesc")}
      </p>

      {/* Warm, no-pressure invitation FIRST — offer personal help */}
      <div className="mt-6 max-w-md mx-auto">
        <p className="text-sm font-bold text-white mb-1">{t("demoFlow.helpTitle")}</p>
        <p className="text-xs text-white/75 mb-3">{t("demoFlow.helpDesc")}</p>
        {capSaved ? (
          <div data-testid="demo-contact-saved" className="text-sm font-semibold text-emerald-200 flex items-center justify-center gap-2 py-2">
            <CheckCircle2 className="w-4 h-4" /> {t("demoFlow.saveDone")}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <Input data-testid="demo-capture-name" value={cap.name} onChange={(e) => setCap({ ...cap, name: e.target.value })} placeholder={t("demoFlow.saveName")} className="h-11 rounded-xl bg-white text-slate-900 border-0" />
            <Input data-testid="demo-capture-email" type="email" value={cap.email} onChange={(e) => setCap({ ...cap, email: e.target.value })} placeholder={t("demoFlow.saveEmail")} className="h-11 rounded-xl bg-white text-slate-900 border-0" />
            <Button data-testid="demo-capture-btn" onClick={saveContact} disabled={capBusy} className="h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 flex-none px-5">
              {capBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : t("demoFlow.saveBtn")}
            </Button>
          </div>
        )}
        <div className="flex items-center gap-3 my-3">
          <div className="h-px flex-1 bg-white/20" />
          <span className="text-xs text-white/60">{t("demoFlow.orText")}</span>
          <div className="h-px flex-1 bg-white/20" />
        </div>
        <WhatsAppButton
          testid="demo-flow-final-whatsapp"
          onClick={() => trackDemo("whatsapp_click", { step: 4, demo: "corto", meta: { place: "final" } })}
        />
      </div>

      {/* Founder offer + checkout CTA BELOW */}
      <div className="mt-7 pt-6 border-t border-white/20">
        {founderOn && (
          <div data-testid="demo-founder-offer" className="mx-auto max-w-md rounded-2xl bg-amber-400 text-blue-950 px-5 py-4 shadow-lg">
            <div className="font-heading font-extrabold text-lg leading-tight">{t("demoFlow.founderTitle")}</div>
            <div className="text-sm font-semibold mt-1">
              {t("demoFlow.founderRemaining", { n: founder.remaining })}
            </div>
          </div>
        )}
        <Link
          data-testid="demo-final-cta"
          to={to}
          onClick={() => trackDemo("checkout_click", { step: 4, demo: "corto", meta: { founder: !!founderOn } })}
          className="inline-flex items-center gap-2 mt-4 h-13 px-7 py-3 rounded-2xl bg-white text-blue-900 font-bold hover:bg-slate-100"
        >
          {founderOn ? t("demoFlow.founderCta") : t("demoFlow.finalCta")} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </Card>
  );
}
