/**
 * DemoFlow — Public, no-login LIVE DEMO of the full UniTech flow:
 *   capture lead -> describe job (ES) -> AI quote (EN) -> approve ->
 *   sign AI Service Agreement (EN) -> invoice with payment links (simulated).
 * Designed to be shared so prospects "feel" the product before signing up.
 */
import { useState } from "react";
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
  MessageCircle, Smartphone,
} from "lucide-react";
import { generateQuotePDF, generateInvoicePDF } from "@/lib/pdf";
import { fbTrack, fbTrackCustom } from "@/lib/fbpixel";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmtMoney = (n) =>
  `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TRADES = [
  "Techos / Roofing", "Drywall", "Pintura / Painting", "Concreto / Concrete",
  "Jardinería / Landscaping", "Limpieza / Cleaning", "Plomería / Plumbing", "Otro",
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
  "Otro": { es: "Otro", en: "Other" },
};
export const tradeLabel = (val, lng) =>
  (TRADE_LABELS[val]?.[lng?.startsWith("es") ? "es" : "en"]) || val;

const EXAMPLE_IDS = ["roof", "drywall", "paint"];

export default function DemoFlow() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [demoId, setDemoId] = useState(null);
  const [lead, setLead] = useState({ name: "", email: "", phone: "", trade: "" });
  const [desc, setDesc] = useState("");
  const [quote, setQuote] = useState(null);
  const [business, setBusiness] = useState(null);
  const [agreement, setAgreement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [signed, setSigned] = useState(false);
  const [paid, setPaid] = useState(false);

  const apiErr = (e, fallback) => setErr(e?.response?.data?.detail || fallback);

  const startDemo = async () => {
    setErr("");
    if (!lead.name.trim() || !lead.email.includes("@")) {
      setErr(t("demo.errEmail"));
      return;
    }
    setLoading(true);
    try {
      const r = await axios.post(`${API}/public/demo/start`, lead);
      setDemoId(r.data.demo_id);
      setBusiness(r.data.business);
      // Meta Pixel: mid-funnel lead — prospect started the live demo.
      fbTrack("Lead", { content_name: "Live Demo Start", content_category: lead.trade || "" });
      fbTrackCustom("DemoStarted", { trade: lead.trade || "" });
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
      setStep(2);
      window.scrollTo(0, 0);
    } catch (e) {
      apiErr(e, t("demoFlow.errQuote"));
    } finally {
      setLoading(false);
    }
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
      setStep(3);
      window.scrollTo(0, 0);
    } catch (e) {
      apiErr(e, t("demoFlow.errAgreement"));
    } finally {
      setLoading(false);
    }
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
        {step === 4 && <InvoiceStep quote={quote} business={business} lead={lead} paid={paid} onPay={() => setPaid(true)} />}
      </div>
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
        <Link to="/register" data-testid="demo-signup-top" className="text-sm font-semibold text-blue-900 hover:underline">
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
      <h1 className="font-heading text-3xl font-bold tracking-tight">{t("demoFlow.leadTitle")}</h1>
      <p className="text-slate-600 mt-2 leading-relaxed">
        <Trans i18nKey="demoFlow.leadDesc" components={{ 1: <strong />, 3: <strong /> }} />
      </p>
      <div className="mt-6 space-y-3">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("demo.leadName")}</label>
          <Input data-testid="demo-name" value={lead.name} onChange={set("name")} placeholder="Carlos García" className="mt-1 h-12 rounded-xl" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("demo.leadEmail")}</label>
          <Input data-testid="demo-email" type="email" value={lead.email} onChange={set("email")} placeholder={t("demo.emailPlaceholder")} className="mt-1 h-12 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("demo.leadPhone")}</label>
            <Input data-testid="demo-phone" value={lead.phone} onChange={set("phone")} placeholder="(555) 123-4567" className="mt-1 h-12 rounded-xl" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("demo.leadTrade")}</label>
            <select data-testid="demo-trade" value={lead.trade} onChange={set("trade")} className="mt-1 h-12 w-full rounded-xl border border-slate-200 px-3 text-sm bg-white">
              <option value="">{t("demo.choose")}</option>
              {TRADES.map((tr) => <option key={tr} value={tr}>{tradeLabel(tr, i18n.language)}</option>)}
            </select>
          </div>
        </div>
      </div>
      <Button data-testid="demo-start-btn" onClick={onStart} disabled={loading} className="mt-6 w-full h-13 py-3 rounded-xl bg-gradient-to-br from-blue-900 to-emerald-600 text-white font-bold text-base">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{t("demo.startBtn")} <ArrowRight className="w-4 h-4 ml-2" /></>}
      </Button>
      <p className="text-xs text-slate-400 mt-3 text-center">{t("demo.freeNote")}</p>
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

function DocHeader({ business, badge }) {
  return (
    <div className="bg-gradient-to-br from-blue-900 to-blue-800 text-white p-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Hammer className="w-5 h-5" />
            <h1 className="font-heading text-2xl font-bold">{business?.business_name || "Demo Contractors"}</h1>
          </div>
          <div className="text-sm text-white/80 space-y-0.5">
            <div>{business?.business_email}</div>
            <div>{business?.phone}</div>
            <div>{business?.business_address}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-heading font-bold">{badge}</div>
        </div>
      </div>
    </div>
  );
}

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
      <Card className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <DocHeader business={business} badge="QUOTE" />
        <div className="p-6 space-y-5">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Bill To</div>
            <div className="font-semibold">{lead.name}</div>
            {lead.email && <div className="text-sm text-slate-600">{lead.email}</div>}
          </div>
          <div>
            <h2 className="font-heading text-xl font-bold">{quote.job_title}</h2>
            {quote.description && <p className="text-slate-700 mt-2">{quote.description}</p>}
          </div>
          {quote.scope_of_work?.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Scope of Work</div>
              <ul className="list-disc ml-5 space-y-1 text-sm">{quote.scope_of_work.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
          {quote.line_items?.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-left">
                  <tr><th className="p-2 font-semibold">Description</th><th className="p-2 font-semibold text-right">Qty</th><th className="p-2 font-semibold text-right">Price</th><th className="p-2 font-semibold text-right">Amount</th></tr>
                </thead>
                <tbody>
                  {quote.line_items.map((li, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="p-2">{li.description}</td>
                      <td className="p-2 text-right">{li.quantity} {li.unit}</td>
                      <td className="p-2 text-right">{fmtMoney(li.unit_price)}</td>
                      <td className="p-2 text-right">{fmtMoney(li.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="bg-slate-50 rounded-xl p-4 space-y-1 text-sm ml-auto max-w-xs">
            <div className="flex justify-between"><span>Subtotal</span><span>{fmtMoney(quote.subtotal)}</span></div>
            <div className="flex justify-between"><span>Tax</span><span>{fmtMoney(quote.tax_amount)}</span></div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t mt-2"><span>TOTAL</span><span>{fmtMoney(quote.total)}</span></div>
            {quote.deposit_amount > 0 && <div className="flex justify-between text-emerald-700"><span>Deposit</span><span>{fmtMoney(quote.deposit_amount)}</span></div>}
          </div>
          {quote.payment_terms && (
            <div><div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Payment Terms</div><div className="text-sm">{quote.payment_terms}</div></div>
          )}
          <div className="rounded-xl border-2 border-blue-200 bg-blue-50/40 p-5 space-y-3 text-center">
            <h3 className="font-heading text-lg font-bold text-slate-900">Ready to move forward?</h3>
            <p className="text-xs text-slate-600">Accept this quote to review and sign your service agreement, then pay your deposit.</p>
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
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{title}</div>
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
            <Button data-testid="demo-sign-btn" onClick={onSign} disabled={signed} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold mt-3">
              <ShieldCheck className="w-5 h-5 mr-2" /> Sign Agreement & Continue
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function InvoiceStep({ quote, business, lead, paid, onPay, hideFinalCta = false }) {
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
      <Card className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <DocHeader business={business} badge="INVOICE" />
        <div className="p-6 space-y-5">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Bill To</div>
            <div className="font-semibold">{lead.name}</div>
          </div>
          <div>
            <h2 className="font-heading text-xl font-bold">{quote?.job_title}</h2>
            {quote?.description && <p className="text-slate-700 mt-2">{quote.description}</p>}
          </div>
          {quote?.scope_of_work?.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Scope of Work</div>
              <ul className="list-disc ml-5 space-y-1 text-sm">{quote.scope_of_work.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
          {quote?.line_items?.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-left">
                  <tr><th className="p-2 font-semibold">Description</th><th className="p-2 font-semibold text-right">Qty</th><th className="p-2 font-semibold text-right">Price</th><th className="p-2 font-semibold text-right">Amount</th></tr>
                </thead>
                <tbody>
                  {quote.line_items.map((li, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="p-2">{li.description}</td>
                      <td className="p-2 text-right">{li.quantity} {li.unit}</td>
                      <td className="p-2 text-right">{fmtMoney(li.unit_price)}</td>
                      <td className="p-2 text-right">{fmtMoney(li.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="bg-slate-50 rounded-xl p-4 space-y-1 text-sm ml-auto max-w-xs">
            <div className="flex justify-between"><span>Subtotal</span><span>{fmtMoney(quote?.subtotal)}</span></div>
            <div className="flex justify-between"><span>Tax</span><span>{fmtMoney(quote?.tax_amount)}</span></div>
            <div className="flex justify-between"><span>Total</span><span>{fmtMoney(total)}</span></div>
            <div className="flex justify-between text-emerald-700"><span>Deposit due now</span><span>{fmtMoney(deposit)}</span></div>
            <div className="flex justify-between font-bold pt-2 border-t mt-2"><span>Balance</span><span>{fmtMoney(total - deposit)}</span></div>
          </div>

          {paid ? (
            <div data-testid="demo-paid-block" className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-6 text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <div className="font-heading text-xl font-bold text-emerald-800">{t("demoFlow.paidTitle")}</div>
              <p className="text-sm text-emerald-700">{t("demoFlow.paidDesc")}</p>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-blue-200 bg-blue-50/40 p-5 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Pay securely</div>
              <Button data-testid="demo-pay-btn" onClick={onPay} className="w-full py-3 rounded-xl bg-blue-900 hover:bg-blue-950 text-white text-base font-bold">
                <CreditCard className="w-5 h-5 mr-2" /> Pay {fmtMoney(due)} by card
              </Button>
              <div className="flex items-center justify-center gap-2 flex-wrap text-xs text-slate-500">
                <Lock className="w-3.5 h-3.5" /> {t("demoFlow.orPayWith")}
                {["Venmo", "Zelle", "CashApp", "PayPal"].map((m) => (
                  <span key={m} className="px-2 py-0.5 rounded-full bg-white border border-slate-200">{m}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      <PdfActions onDownload={downloadPdf} downloading={dl} />

      {paid && !hideFinalCta && (
        <>
          <SendToMeCTA phone={lead.phone} sample={t("demo.sampleQuote")} branch="demo-flow" />
          <FinalCTA />
        </>
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
    <div className="mb-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-semibold px-4 py-2.5 flex items-center gap-2">
      <Send className="w-4 h-4 flex-none" /> {text}
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

function FinalCTA() {
  const { t } = useTranslation();
  return (
    <Card className="mt-6 p-8 rounded-2xl text-center bg-gradient-to-br from-blue-900 to-emerald-700 text-white border-0">
      <PartyPopper className="w-10 h-10 mx-auto mb-3" />
      <h2 className="font-heading text-2xl font-bold">{t("demoFlow.finalTitle")}</h2>
      <p className="text-white/85 mt-2 max-w-md mx-auto">
        {t("demoFlow.finalDesc")}
      </p>
      <Link data-testid="demo-final-cta" to="/register" className="inline-flex items-center gap-2 mt-5 h-13 px-7 py-3 rounded-2xl bg-white text-blue-900 font-bold hover:bg-slate-100">
        {t("demoFlow.finalCta")} <ArrowRight className="w-4 h-4" />
      </Link>
    </Card>
  );
}
