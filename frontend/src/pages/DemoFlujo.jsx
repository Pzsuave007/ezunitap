/**
 * DemoFlujo — Public, no-login STORY demo mirroring the Landing "Así funciona"
 * 9-step flow, but VISUAL and detailed: real booking form, real AI quote,
 * service agreement, invoice, job detail, before/after, social + GMB post,
 * and review + AI reply. Steps 3-5 reuse the real demo document components.
 * Ends with a dynamic Founder ($59) / Bundle ($75) CTA.
 */
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, Hammer, Sparkles, ArrowRight, ArrowLeft, Star, IdCard, CalendarCheck,
  FileText, Receipt, CreditCard, Briefcase, Camera, Share2, MessageSquare,
  CheckCircle2, PartyPopper, Crown, Bot, ThumbsUp, Instagram, Facebook, MapPin, Clock,
} from "lucide-react";
import { QuoteStep, AgreementStep, InvoiceStep, tradeLabel } from "./DemoFlow";
import { fbTrack, fbTrackCustom } from "@/lib/fbpixel";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmtMoney = (n) => `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const BEFORE_IMG = "https://images.unsplash.com/photo-1768321914670-80db17b4669b?crop=entropy&cs=srgb&fm=jpg&q=80&w=800";
const AFTER_IMG = "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?crop=entropy&cs=srgb&fm=jpg&q=80&w=800";
// before/after images per trade (index of the raw select value)
const TRADE_IMAGES = {
  "Techos / Roofing": { before: "https://images.unsplash.com/photo-1635424709845-3a85ad5e1f5e?crop=entropy&cs=srgb&fm=jpg&q=80&w=800", after: "https://images.unsplash.com/photo-1635424824849-1b09bdcc55b1?crop=entropy&cs=srgb&fm=jpg&q=80&w=800" },
  "Pintura / Painting": { before: "https://images.unsplash.com/photo-1625585598750-3535fe40efb3?crop=entropy&cs=srgb&fm=jpg&q=80&w=800", after: "https://images.unsplash.com/photo-1615884241431-d07c87e30ab2?crop=entropy&cs=srgb&fm=jpg&q=80&w=800" },
  "Drywall": { before: "https://images.unsplash.com/photo-1718816281207-3b253cff549a?crop=entropy&cs=srgb&fm=jpg&q=80&w=800", after: "https://images.unsplash.com/photo-1733431772808-82d878e59000?crop=entropy&cs=srgb&fm=jpg&q=80&w=800" },
  "Concreto / Concrete": { before: "https://images.unsplash.com/photo-1628744448968-bf7a32f8dd33?crop=entropy&cs=srgb&fm=jpg&q=80&w=800", after: "https://images.unsplash.com/photo-1781637202423-33ec5b47e52e?crop=entropy&cs=srgb&fm=jpg&q=80&w=800" },
  "Jardinería / Landscaping": { before: "https://images.unsplash.com/photo-1594498653385-d5172c532c00?crop=entropy&cs=srgb&fm=jpg&q=80&w=800", after: "https://images.unsplash.com/photo-1624018171446-c4f0b942cf87?crop=entropy&cs=srgb&fm=jpg&q=80&w=800" },
  "Limpieza / Cleaning": { before: "https://images.unsplash.com/photo-1649083048337-4aeb6dda80bb?crop=entropy&cs=srgb&fm=jpg&q=80&w=800", after: "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?crop=entropy&cs=srgb&fm=jpg&q=80&w=800" },
  "Plomería / Plumbing": { before: "https://images.unsplash.com/photo-1714399417136-d328f3ea14c7?crop=entropy&cs=srgb&fm=jpg&q=80&w=800", after: "https://images.unsplash.com/photo-1542855368-ca6ea825bca2?crop=entropy&cs=srgb&fm=jpg&q=80&w=800" },
};
const tradeImages = (trade) => TRADE_IMAGES[trade] || { before: BEFORE_IMG, after: AFTER_IMG };
const TRADES = [
  "Techos / Roofing", "Drywall", "Pintura / Painting", "Concreto / Concrete",
  "Jardinería / Landscaping", "Limpieza / Cleaning", "Plomería / Plumbing", "Otro",
];

export default function DemoFlujo() {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState(0);
  const [lead, setLead] = useState({ name: "", email: "", trade: "", phone: "" });
  const [demoId, setDemoId] = useState(null);
  const [business, setBusiness] = useState(null);
  const [desc, setDesc] = useState("");
  const [quote, setQuote] = useState(null);
  const [agreement, setAgreement] = useState(null);
  const [signed, setSigned] = useState(false);
  const [paid, setPaid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [founder, setFounder] = useState(null);

  useEffect(() => {
    axios.get(`${API}/payments/founder-status`).then((r) => setFounder(r.data)).catch(() => {});
  }, []);

  const tradeName = tradeLabel(lead.trade, i18n.language) || t("demoFlujo.you");
  const client = t("demoFlujo.clientFull");
  const imgs = tradeImages(lead.trade);
  // In this story the VIEWER is the business owner and Maria is the client.
  const ownerBusiness = business
    ? { ...business, business_name: (lead.name || "").trim() || business.business_name, business_email: lead.email || business.business_email }
    : business;
  const clientLead = { name: t("demoFlujo.clientFull"), email: t("demoFlujo.clientEmail"), phone: t("demoFlujo.clientPhone") };
  const go = (n) => { setStep(n); setErr(""); window.scrollTo(0, 0); };

  const start = async () => {
    setErr("");
    if (!lead.name.trim() || !lead.email.includes("@")) { setErr(t("demo.errEmail")); return; }
    if (!lead.trade) { setErr(t("demoFlujo.errTrade")); return; }
    setLoading(true);
    try {
      const r = await axios.post(`${API}/public/demo/start`, { ...lead });
      setDemoId(r.data.demo_id);
      setBusiness(r.data.business);
      fbTrack("Lead", { content_name: "Story Demo Start", content_category: lead.trade });
      fbTrackCustom("DemoFlujoStarted", { trade: lead.trade });
      go(1);
    } catch (e) {
      setErr(e?.response?.data?.detail || t("demo.errStart"));
    } finally { setLoading(false); }
  };

  const genQuote = async () => {
    setErr("");
    if (desc.trim().length < 6) { setErr(t("demoFlow.errDesc")); return; }
    setLoading(true);
    try {
      const r = await axios.post(`${API}/public/demo/quote`, { demo_id: demoId, description_es: desc });
      setQuote(r.data.quote);
      setBusiness(r.data.business);
      fbTrack("ViewContent", { content_name: "Demo AI Quote", value: Number(r.data.quote?.total || 0), currency: "USD" });
    } catch (e) {
      setErr(e?.response?.data?.detail || t("demoFlow.errQuote"));
    } finally { setLoading(false); }
  };

  const genAgreement = async () => {
    setErr("");
    setLoading(true);
    try {
      const r = await axios.post(`${API}/public/demo/agreement`, {
        demo_id: demoId, description_es: desc,
        job_title: quote?.job_title || "", total: quote?.total || 0, deposit: quote?.deposit_amount || 0,
        client_name: clientLead.name, owner_name: ownerBusiness?.business_name || "",
      });
      setAgreement(r.data.agreement);
      go(4);
    } catch (e) {
      setErr(e?.response?.data?.detail || t("demoFlow.errAgreement"));
    } finally { setLoading(false); }
  };

  const total = fmtMoney(quote?.total);
  const deposit = fmtMoney(quote?.deposit_amount || (Number(quote?.total || 0) * 0.5));

  const HEAD = {
    1: { who: "client", icon: IdCard, title: t("demoFlujo.s1Title"), cap: t("demoFlujo.s1Caption") },
    2: { who: "client", icon: CalendarCheck, title: t("demoFlujo.bookTitle"), cap: t("demoFlujo.bookCaption") },
    3: { who: "you", icon: Sparkles, title: t("demoFlujo.quoteTitle"), cap: t("demoFlujo.quoteCaption") },
    4: { who: "client", icon: FileText, title: t("demoFlujo.agreeTitle"), cap: t("demoFlujo.agreeCaption") },
    5: { who: "client", icon: Receipt, title: t("demoFlujo.invoiceTitle"), cap: t("demoFlujo.invoiceCaption") },
    6: { who: "you", icon: Briefcase, title: t("demoFlujo.jobTitle"), cap: t("demoFlujo.jobCaption") },
    7: { who: "you", icon: Camera, title: t("demoFlujo.photoTitle"), cap: t("demoFlujo.photoCaption") },
    8: { who: "you", icon: Share2, title: t("demoFlujo.socialTitle"), cap: t("demoFlujo.socialCaption") },
    9: { who: "client", icon: Star, title: t("demoFlujo.reviewTitle"), cap: t("demoFlujo.reviewCaption") },
  };

  return (
    <div className="min-h-screen bg-slate-50" data-testid="demo-flujo">
      <TopBar />
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
        {step >= 1 && step <= 9 && <ProgressHeader step={step} head={HEAD[step]} t={t} />}
        {err && <div data-testid="flujo-error" className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{err}</div>}

        {step === 0 && <Intro lead={lead} setLead={setLead} onStart={start} loading={loading} i18n={i18n} t={t} />}

        {step === 1 && (
          <SceneShell onNext={() => go(2)} onBack={() => go(0)} t={t}>
            <FoundVia t={t} />
            <div className="mt-4"><MiniCard business={ownerBusiness} label={t("demoFlujo.s1Card", { trade: tradeName })} /></div>
          </SceneShell>
        )}

        {step === 2 && (
          <SceneShell onNext={() => go(3)} onBack={() => go(1)} t={t}>
            <BookingForm client={client} service={tradeName} t={t} />
          </SceneShell>
        )}

        {step === 3 && (
          !quote ? (
            <Card className="p-6 rounded-2xl border-slate-200">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("demoFlujo.s3DescLabel")}</label>
              <Textarea data-testid="flujo-desc" value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} placeholder={t("demoFlujo.s3DescPh")} className="mt-2 rounded-xl text-base" />
              <div className="mt-4 flex items-center gap-2">
                <button onClick={() => go(2)} className="text-sm text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 px-3 py-2"><ArrowLeft className="w-4 h-4" /> {t("demoFlujo.back")}</button>
                <Button data-testid="flujo-gen-quote" onClick={genQuote} disabled={loading} className="ml-auto py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                  {loading ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> {t("demoFlujo.s3GenLoading")}</> : <><Sparkles className="w-5 h-5 mr-2" /> {t("demoFlujo.s3Gen")}</>}
                </Button>
              </div>
            </Card>
          ) : (
            <QuoteStep quote={quote} business={ownerBusiness} lead={clientLead} onAccept={genAgreement} loading={loading} onBack={() => setQuote(null)} />
          )
        )}

        {step === 4 && (
          <AgreementStep agreement={agreement} business={ownerBusiness} lead={clientLead} signed={signed}
            onSign={() => { setSigned(true); go(5); }} />
        )}

        {step === 5 && (
          <>
            <InvoiceStep quote={quote} business={ownerBusiness} lead={clientLead} paid={paid} onPay={() => setPaid(true)} hideFinalCta />
            <div className="mt-4 flex items-center gap-2">
              <button onClick={() => go(4)} className="text-sm text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 px-3 py-2"><ArrowLeft className="w-4 h-4" /> {t("demoFlujo.back")}</button>
              {paid && (
                <Button data-testid="flujo-next" onClick={() => go(6)} className="ml-auto py-3 px-6 rounded-xl bg-slate-900 hover:bg-black text-white font-bold">
                  {t("demoFlujo.next")} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </>
        )}

        {step === 6 && (
          <SceneShell onNext={() => go(7)} onBack={() => go(5)} t={t}>
            <JobDetail client={client} title={quote?.job_title} total={total} deposit={deposit} t={t} />
          </SceneShell>
        )}

        {step === 7 && (
          <SceneShell onNext={() => go(8)} onBack={() => go(6)} t={t}>
            <BeforeAfter imgs={imgs} t={t} />
          </SceneShell>
        )}

        {step === 8 && (
          <SceneShell onNext={() => go(9)} onBack={() => go(7)} t={t}>
            <SocialDesign business={ownerBusiness} imgs={imgs} t={t} />
          </SceneShell>
        )}

        {step === 9 && (
          <SceneShell onNext={() => go(10)} onBack={() => go(8)} nextLabel={t("demoFlujo.finishBtn")} t={t}>
            <ReviewScene client={client} t={t} />
          </SceneShell>
        )}

        {step === 10 && <FinalCTA founder={founder} t={t} />}
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center"><Hammer className="w-4 h-4 text-white" strokeWidth={2.5} /></div>
          <span className="font-heading font-bold">UniTech</span>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Demo</span>
        </Link>
        <Link to="/register" className="text-sm font-semibold text-blue-900 hover:underline">Sign up</Link>
      </div>
    </header>
  );
}

function ProgressHeader({ step, head, t }) {
  const isClient = head.who === "client";
  const Icon = head.icon;
  return (
    <div className="mb-4">
      <div className="flex items-center gap-1">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < step ? "bg-emerald-500" : "bg-slate-200"}`} />
        ))}
      </div>
      <div className="text-[11px] font-bold text-emerald-700 mt-1.5" data-testid="flujo-progress">{t("demoFlujo.progress", { n: step })}</div>
      <div className="mt-4 flex items-start gap-3">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-none text-white ${isClient ? "bg-amber-500" : "bg-gradient-to-br from-blue-900 to-emerald-600"}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isClient ? "text-amber-600" : "text-blue-600"}`}>{isClient ? t("demoFlujo.clientLabel") : t("demoFlujo.youLabel")}</span>
          <h2 className="font-heading text-xl font-bold leading-tight">{head.title}</h2>
          <p className="text-sm text-slate-600 mt-1 leading-relaxed">{head.cap}</p>
        </div>
      </div>
    </div>
  );
}

function SceneShell({ children, onNext, onBack, nextLabel, t }) {
  return (
    <Card className="p-5 sm:p-6 rounded-2xl border-slate-200 animate-in fade-in slide-in-from-bottom-2 duration-300" data-testid="flujo-scene">
      {children}
      <div className="mt-6 flex items-center gap-2">
        {onBack && <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 px-3 py-2"><ArrowLeft className="w-4 h-4" /> {t("demoFlujo.back")}</button>}
        {onNext && (
          <Button data-testid="flujo-next" onClick={onNext} className="ml-auto py-3 px-6 rounded-xl bg-slate-900 hover:bg-black text-white font-bold">
            {nextLabel || t("demoFlujo.next")} <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </Card>
  );
}

function Intro({ lead, setLead, onStart, loading, i18n, t }) {
  const set = (k) => (e) => setLead({ ...lead, [k]: e.target.value });
  return (
    <Card className="p-6 sm:p-8 rounded-2xl border-slate-200" data-testid="flujo-intro">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-4">
        <Sparkles className="w-3.5 h-3.5" /> {t("demoFlujo.badge")}
      </div>
      <h1 className="font-heading text-3xl font-bold tracking-tight">{t("demoFlujo.introTitle")}</h1>
      <p className="text-slate-600 mt-2 leading-relaxed">{t("demoFlujo.introDesc")}</p>
      <div className="mt-6 space-y-3">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("demoFlujo.name")}</label>
          <Input data-testid="flujo-name" value={lead.name} onChange={set("name")} placeholder="Carlos García" className="mt-1 h-12 rounded-xl" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("demoFlujo.email")}</label>
          <Input data-testid="flujo-email" type="email" value={lead.email} onChange={set("email")} placeholder={t("demo.emailPlaceholder")} className="mt-1 h-12 rounded-xl" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("demoFlujo.trade")}</label>
          <select data-testid="flujo-trade" value={lead.trade} onChange={set("trade")} className="mt-1 h-12 w-full rounded-xl border border-slate-200 px-3 text-sm bg-white">
            <option value="">{t("demoFlujo.choose")}</option>
            {TRADES.map((tr) => <option key={tr} value={tr}>{tradeLabel(tr, i18n.language)}</option>)}
          </select>
        </div>
      </div>
      <Button data-testid="flujo-start" onClick={onStart} disabled={loading} className="mt-6 w-full py-3 rounded-xl bg-gradient-to-br from-blue-900 to-emerald-600 text-white font-bold text-base">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{t("demoFlujo.start")} <ArrowRight className="w-4 h-4 ml-2" /></>}
      </Button>
      <p className="text-[11px] text-slate-400 mt-3 text-center">{t("demoFlujo.freeNote")}</p>
    </Card>
  );
}

function FoundVia({ t }) {
  const ch = [
    { icon: Nfc, label: t("demoFlujo.foundNfc"), tone: "bg-blue-50 text-blue-700" },
    { icon: QrCode, label: t("demoFlujo.foundQr"), tone: "bg-slate-100 text-slate-700" },
    { icon: Globe, label: t("demoFlujo.foundWeb"), tone: "bg-emerald-50 text-emerald-700" },
    { icon: Bot, label: t("demoFlujo.foundChat"), tone: "bg-violet-50 text-violet-700" },
  ];
  return (
    <div data-testid="flujo-found">
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t("demoFlujo.foundVia")}</div>
      <div className="grid grid-cols-4 gap-2">
        {ch.map((c) => (
          <div key={c.label} className={`flex flex-col items-center gap-1.5 rounded-xl py-3 ${c.tone}`}>
            <c.icon className="w-5 h-5" />
            <span className="text-[10px] font-semibold text-center leading-tight">{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniCard({ business, label }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-blue-900 to-emerald-700 text-white p-5" data-testid="flujo-card">
      <div className="flex items-center gap-2"><Hammer className="w-5 h-5" /><span className="font-heading font-bold">{business?.business_name || "Demo Contractors"}</span></div>
      <div className="text-xs text-white/80 mt-0.5">{label}</div>
      <div className="mt-3 flex items-center gap-1 text-amber-300">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}<span className="text-white/70 text-xs ml-1">5.0</span></div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="px-3 py-1.5 rounded-lg bg-white/15 text-xs font-semibold flex items-center gap-1"><MessageSquare className="w-3 h-3" /> WhatsApp</span>
        <span className="px-3 py-1.5 rounded-lg bg-white/15 text-xs font-semibold flex items-center gap-1"><CalendarCheck className="w-3 h-3" /> Book now</span>
        <span className="px-3 py-1.5 rounded-lg bg-white/15 text-xs font-semibold flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> Reviews</span>
      </div>
    </div>
  );
}

function BookingForm({ client, service, t }) {
  const times = ["9:00", "10:00", "11:30", "2:00"];
  return (
    <div data-testid="flujo-booking" className="rounded-2xl border border-slate-200 overflow-hidden">
      <div className="bg-slate-900 text-white px-4 py-3 text-sm font-bold flex items-center gap-2"><CalendarCheck className="w-4 h-4" /> Book an appointment</div>
      <div className="p-4 space-y-3">
        <Field label={t("demoFlujo.bookName")} value={client} />
        <Field label={t("demoFlujo.bookService")} value={service} />
        <div>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t("demoFlujo.bookTime")}</div>
          <div className="grid grid-cols-4 gap-2">
            {times.map((tm, i) => (
              <div key={tm} className={`text-center py-2 rounded-lg text-sm font-semibold border ${i === 1 ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-200 text-slate-500"}`}>{tm}</div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 text-emerald-800 text-sm font-semibold px-3 py-2.5 mt-1">
          <CheckCircle2 className="w-4 h-4" /> {t("demoFlujo.bookConfirmed")}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</div>
      <div className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 flex items-center text-sm font-medium text-slate-800">{value}</div>
    </div>
  );
}

function JobDetail({ client, title, total, deposit, t }) {
  const stages = [t("demoFlujo.stgNew"), t("demoFlujo.stgScheduled"), t("demoFlujo.stgProgress"), t("demoFlujo.stgDone")];
  return (
    <div data-testid="flujo-job" className="rounded-2xl border border-slate-200 overflow-hidden">
      <div className="bg-gradient-to-br from-blue-900 to-emerald-700 text-white px-4 py-3">
        <div className="text-[11px] uppercase tracking-wider text-white/70">Job</div>
        <div className="font-heading font-bold">{title || "Living room remodel"}</div>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-1 mb-4">
          {stages.map((s, i) => (
            <div key={s} className="flex-1 text-center">
              <div className={`h-1.5 rounded-full ${i <= 1 ? "bg-emerald-500" : "bg-slate-200"}`} />
              <div className={`text-[10px] mt-1 font-semibold ${i === 1 ? "text-emerald-700" : "text-slate-400"}`}>{s}</div>
            </div>
          ))}
        </div>
        <Row icon={ThumbsUp} label={t("demoFlujo.jobClient")} value={client} />
        <Row icon={MapPin} label={t("demoFlujo.jobAddress")} value={t("demoFlujo.jobAddressVal")} />
        <Row icon={Clock} label={t("demoFlujo.jobSchedule")} value={t("demoFlujo.s6Sched")} />
        <Row icon={Receipt} label={t("demoFlujo.jobTotal")} value={total} />
        <Row icon={CreditCard} label={t("demoFlujo.jobDeposit")} value={`${deposit} ✓`} tone="emerald" />
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="flex items-center gap-2 text-sm text-slate-500"><Icon className="w-4 h-4" /> {label}</span>
      <span className={`text-sm font-bold ${tone === "emerald" ? "text-emerald-700" : "text-slate-800"}`}>{value}</span>
    </div>
  );
}

function BeforeAfter({ imgs, t }) {
  return (
    <div data-testid="flujo-photos">
      <div className="grid grid-cols-2 gap-3">
        <figure className="relative rounded-xl overflow-hidden">
          <img src={imgs.before} alt="before" className="w-full h-40 object-cover" />
          <figcaption className="absolute top-2 left-2 text-[10px] font-bold bg-slate-900/80 text-white px-2 py-0.5 rounded">{t("demoFlujo.before")}</figcaption>
        </figure>
        <figure className="relative rounded-xl overflow-hidden">
          <img src={imgs.after} alt="after" className="w-full h-40 object-cover" />
          <figcaption className="absolute top-2 left-2 text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded">{t("demoFlujo.after")}</figcaption>
        </figure>
      </div>
      <div className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="w-4 h-4" /> {t("demoFlujo.photoSaved")}</div>
    </div>
  );
}

function SocialDesign({ business, imgs, t }) {
  return (
    <div data-testid="flujo-social">
      {/* Branded template mock (resembles the in-app "Before/After" design) */}
      <div className="mx-auto max-w-[280px] rounded-2xl overflow-hidden shadow-xl bg-slate-900">
        <div className="text-center py-2 bg-gradient-to-r from-blue-900 to-emerald-600">
          <span className="text-white font-heading font-extrabold tracking-wide text-sm">{t("demoFlujo.socialTag")}</span>
        </div>
        <div className="relative grid grid-cols-2">
          <img src={imgs.before} alt="before" className="w-full h-36 object-cover" />
          <img src={imgs.after} alt="after" className="w-full h-36 object-cover" />
          <span className="absolute top-2 left-2 text-[9px] font-bold bg-black/70 text-white px-1.5 py-0.5 rounded">{t("demoFlujo.before")}</span>
          <span className="absolute top-2 right-2 text-[9px] font-bold bg-emerald-600 text-white px-1.5 py-0.5 rounded">{t("demoFlujo.after")}</span>
          <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-1 bg-white" />
        </div>
        <div className="flex items-center gap-2 px-3 py-2.5 bg-white">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center flex-none"><Hammer className="w-4 h-4 text-white" /></div>
          <div className="min-w-0">
            <div className="text-xs font-extrabold truncate">{business?.business_name || "Demo Contractors"}</div>
            <div className="text-[10px] text-slate-500 flex items-center gap-1"><MessageSquare className="w-3 h-3" /> WhatsApp · {t("demoFlujo.clientPhone")}</div>
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-600 mt-3 leading-snug bg-slate-100 rounded-xl px-3 py-2">{t("demoFlujo.socialCaptionText")}</p>
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-violet-800 bg-violet-50 rounded-xl px-3 py-2"><Share2 className="w-4 h-4" /> {t("demoFlujo.postedSocial")}</div>
        <div className="flex items-center gap-2 text-sm font-semibold text-blue-800 bg-blue-50 rounded-xl px-3 py-2"><MapPin className="w-4 h-4" /> {t("demoFlujo.uploadedGmb")}</div>
      </div>
    </div>
  );
}

function ReviewScene({ client, t }) {
  return (
    <div data-testid="flujo-review" className="space-y-3">
      <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">{t("demoFlujo.reviewAsk")}</div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm">{client[0]}</div>
          <div>
            <div className="text-sm font-bold">{client}</div>
            <div className="flex items-center gap-0.5 text-amber-500">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}</div>
          </div>
        </div>
        <p className="text-sm text-slate-700 mt-2 italic">{t("demoFlujo.reviewText")}</p>
      </div>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wider"><Bot className="w-3.5 h-3.5" /> {t("demoFlujo.reviewReplyLabel")}</div>
        <p className="text-sm text-slate-700 mt-1.5">{t("demoFlujo.reviewReply")}</p>
      </div>
    </div>
  );
}

function FinalCTA({ founder, t }) {
  const available = founder?.available;
  const to = available ? "/register?plan=bundle_founder&billing=month" : "/register?plan=bundle";
  return (
    <Card className="p-8 rounded-2xl text-center bg-gradient-to-br from-blue-900 to-emerald-700 text-white border-0" data-testid="flujo-final">
      <PartyPopper className="w-10 h-10 mx-auto mb-3" />
      <h2 className="font-heading text-2xl font-bold">{t("demoFlujo.finalTitle")}</h2>
      <p className="text-white/85 mt-2 max-w-md mx-auto">{t("demoFlujo.finalDesc")}</p>
      {available && founder && (
        <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-xs font-bold">
          <Crown className="w-3.5 h-3.5" /> {t("demoFlujo.founderSpots", { n: founder.remaining, limit: founder.limit })}
        </div>
      )}
      <div className="mt-5">
        <Link data-testid="flujo-final-cta" to={to} className="inline-flex items-center gap-2 px-7 py-3 rounded-2xl bg-white text-blue-900 font-bold hover:bg-slate-100">
          {available ? <><Crown className="w-4 h-4" /> {t("demoFlujo.founderCta")}</> : <>{t("demoFlujo.regularCta")}</>} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </Card>
  );
}
