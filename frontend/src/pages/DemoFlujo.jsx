/**
 * DemoFlujo — Public, no-login STORY demo that mirrors the Landing "Así funciona"
 * 9-step flow. A fictional client (Maria) goes through the whole journey with the
 * viewer's own trade. Step 3 uses the REAL AI quote endpoint; the rest are
 * simulated ($0). Ends with a dynamic Founder ($59) / Bundle ($75) CTA.
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
  FileText, Receipt, CreditCard, CalendarDays, Camera, Share2, MessageSquare,
  CheckCircle2, PartyPopper, Crown, Bot, ThumbsUp,
} from "lucide-react";
import { tradeLabel } from "./DemoFlow";
import { fbTrack, fbTrackCustom } from "@/lib/fbpixel";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmtMoney = (n) => `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const TRADES = [
  "Techos / Roofing", "Drywall", "Pintura / Painting", "Concreto / Concrete",
  "Jardinería / Landscaping", "Limpieza / Cleaning", "Plomería / Plumbing", "Otro",
];

export default function DemoFlujo() {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState(0);
  const [lead, setLead] = useState({ name: "", email: "", trade: "" });
  const [demoId, setDemoId] = useState(null);
  const [business, setBusiness] = useState(null);
  const [desc, setDesc] = useState("");
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [founder, setFounder] = useState(null);

  useEffect(() => {
    axios.get(`${API}/payments/founder-status`).then((r) => setFounder(r.data)).catch(() => {});
  }, []);

  const tradeName = tradeLabel(lead.trade, i18n.language) || t("demoFlujo.you");
  const client = t("demoFlujo.client");
  const go = (n) => { setStep(n); setErr(""); window.scrollTo(0, 0); };

  const start = async () => {
    setErr("");
    if (!lead.name.trim() || !lead.email.includes("@")) { setErr(t("demo.errEmail")); return; }
    if (!lead.trade) { setErr(t("demoFlujo.errTrade")); return; }
    setLoading(true);
    try {
      const r = await axios.post(`${API}/public/demo/start`, { ...lead, phone: "" });
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
      fbTrackCustom("DemoFlujoQuote");
    } catch (e) {
      setErr(e?.response?.data?.detail || t("demoFlow.errQuote"));
    } finally { setLoading(false); }
  };

  const total = fmtMoney(quote?.total);
  const deposit = fmtMoney(quote?.deposit_amount || (Number(quote?.total || 0) * 0.5));

  return (
    <div className="min-h-screen bg-slate-50" data-testid="demo-flujo">
      <TopBar />
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
        {step >= 1 && step <= 9 && (
          <div className="mb-5" data-testid="flujo-progress">
            <div className="flex items-center gap-1">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < step ? "bg-emerald-500" : "bg-slate-200"}`} />
              ))}
            </div>
            <div className="text-[11px] font-bold text-emerald-700 mt-1.5">{t("demoFlujo.progress", { n: step })}</div>
          </div>
        )}

        {err && <div data-testid="flujo-error" className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{err}</div>}

        {step === 0 && <Intro lead={lead} setLead={setLead} onStart={start} loading={loading} i18n={i18n} t={t} />}

        {step === 1 && (
          <Scene who="client" icon={IdCard} title={t("demoFlujo.s1Title")} caption={t("demoFlujo.s1Caption")} onNext={() => go(2)} onBack={() => go(0)} t={t}>
            <MiniCard business={business} label={t("demoFlujo.s1Card", { trade: tradeName })} />
          </Scene>
        )}
        {step === 2 && (
          <Scene who="client" icon={CalendarCheck} title={t("demoFlujo.s2Title")} caption={t("demoFlujo.s2Caption")} onNext={() => go(3)} onBack={() => go(1)} t={t}>
            <Pill icon={CalendarCheck} text={t("demoFlujo.s2Booked")} />
          </Scene>
        )}
        {step === 3 && (
          <Scene who="you" icon={Sparkles} title={t("demoFlujo.s3Title")} caption={t("demoFlujo.s3Caption")} t={t}
            onBack={() => go(2)}
            onNext={quote ? () => go(4) : null}
            nextLabel={quote ? t("demoFlujo.s3Accept") : null}>
            {!quote ? (
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t("demoFlujo.s3DescLabel")}</label>
                <Textarea data-testid="flujo-desc" value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} placeholder={t("demoFlujo.s3DescPh")} className="rounded-xl text-base" />
                <Button data-testid="flujo-gen-quote" onClick={genQuote} disabled={loading} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                  {loading ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> {t("demoFlujo.s3GenLoading")}</> : <><Sparkles className="w-5 h-5 mr-2" /> {t("demoFlujo.s3Gen")}</>}
                </Button>
              </div>
            ) : (
              <div data-testid="flujo-quote-result" className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">{t("demoFlujo.s3QuoteReady", { name: client })}</div>
                <div className="font-heading font-bold text-lg">{quote.job_title}</div>
                <div className="mt-2 flex items-center justify-between text-sm"><span className="text-slate-500">Total</span><span className="font-bold">{total}</span></div>
                {quote.deposit_amount > 0 && <div className="flex items-center justify-between text-sm text-emerald-700"><span>Deposit</span><span>{deposit}</span></div>}
              </div>
            )}
          </Scene>
        )}
        {step === 4 && (
          <Scene who="client" icon={FileText} title={t("demoFlujo.s4Title")} caption={t("demoFlujo.s4Caption")} onNext={() => go(5)} onBack={() => go(3)} t={t}>
            <Pill icon={Receipt} text={t("demoFlujo.s4Invoice", { total })} />
          </Scene>
        )}
        {step === 5 && (
          <Scene who="client" icon={CreditCard} title={t("demoFlujo.s5Title")} caption={t("demoFlujo.s5Caption")} onNext={() => go(6)} onBack={() => go(4)} t={t}>
            <Pill icon={CheckCircle2} text={t("demoFlujo.s5Paid", { deposit })} tone="emerald" />
          </Scene>
        )}
        {step === 6 && (
          <Scene who="you" icon={CalendarDays} title={t("demoFlujo.s6Title")} caption={t("demoFlujo.s6Caption")} onNext={() => go(7)} onBack={() => go(5)} t={t}>
            <Pill icon={CalendarDays} text={t("demoFlujo.s6Sched")} />
          </Scene>
        )}
        {step === 7 && (
          <Scene who="you" icon={Camera} title={t("demoFlujo.s7Title")} caption={t("demoFlujo.s7Caption")} onNext={() => go(8)} onBack={() => go(6)} t={t}>
            <div className="grid grid-cols-2 gap-2">
              <div className="aspect-video rounded-xl bg-slate-200 flex items-center justify-center text-slate-400 text-xs font-bold">BEFORE</div>
              <div className="aspect-video rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 text-xs font-bold">AFTER</div>
            </div>
          </Scene>
        )}
        {step === 8 && (
          <Scene who="you" icon={Share2} title={t("demoFlujo.s8Title")} caption={t("demoFlujo.s8Caption")} onNext={() => go(9)} onBack={() => go(7)} t={t}>
            <Pill icon={Share2} text={t("demoFlujo.s8Posted")} tone="violet" />
          </Scene>
        )}
        {step === 9 && (
          <Scene who="client" icon={Star} title={t("demoFlujo.s9Title")} caption={t("demoFlujo.s9Caption")} onNext={() => go(10)} onBack={() => go(8)} t={t} nextLabel={t("demoFlujo.next")}>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-1 text-amber-500">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}</div>
              <p className="text-sm text-slate-700 mt-1.5 italic">{t("demoFlujo.s9Review")}</p>
              <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><Bot className="w-3.5 h-3.5" /> {t("demoFlujo.s9Reply")}</div>
            </div>
          </Scene>
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

function Scene({ who, icon: Icon, title, caption, children, onNext, onBack, nextLabel, t }) {
  const isClient = who === "client";
  return (
    <Card key={title} className="p-6 sm:p-8 rounded-2xl border-slate-200 animate-in fade-in slide-in-from-bottom-2 duration-300" data-testid="flujo-scene">
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-4 ${isClient ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
        {isClient ? t("demoFlujo.clientLabel") : t("demoFlujo.youLabel")}
      </div>
      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-none text-white ${isClient ? "bg-amber-500" : "bg-gradient-to-br from-blue-900 to-emerald-600"}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <h2 className="font-heading text-xl font-bold leading-tight">{title}</h2>
          <p className="text-sm text-slate-600 mt-1 leading-relaxed">{caption}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
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

function MiniCard({ business, label }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-blue-900 to-emerald-700 text-white p-5">
      <div className="flex items-center gap-2"><Hammer className="w-5 h-5" /><span className="font-heading font-bold">{business?.business_name || "Demo Contractors"}</span></div>
      <div className="text-xs text-white/80 mt-0.5">{label}</div>
      <div className="mt-3 flex items-center gap-1 text-amber-300">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}<span className="text-white/70 text-xs ml-1">5.0</span></div>
      <div className="mt-3 flex gap-2">
        <span className="px-3 py-1.5 rounded-lg bg-white/15 text-xs font-semibold flex items-center gap-1"><MessageSquare className="w-3 h-3" /> WhatsApp</span>
        <span className="px-3 py-1.5 rounded-lg bg-white/15 text-xs font-semibold flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> Reviews</span>
      </div>
    </div>
  );
}

function Pill({ icon: Icon, text, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-800",
    violet: "bg-violet-100 text-violet-800",
  };
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm ${tones[tone]}`}>
      <Icon className="w-4 h-4" /> {text}
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
        <Link data-testid="flujo-final-cta" to={to} className="inline-flex items-center gap-2 h-13 px-7 py-3 rounded-2xl bg-white text-blue-900 font-bold hover:bg-slate-100">
          {available ? <><Crown className="w-4 h-4" /> {t("demoFlujo.founderCta")}</> : <>{t("demoFlujo.regularCta")}</>} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </Card>
  );
}
