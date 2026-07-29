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
  Nfc, QrCode, Globe, Info,
} from "lucide-react";
import { QuoteStep, AgreementStep, InvoiceStep, tradeLabel } from "./DemoFlow";
import { WhatsAppButton, WhatsAppFab } from "@/components/WhatsAppButton";
import { fbTrack, fbTrackCustom } from "@/lib/fbpixel";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmtMoney = (n) => `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const BEFORE_IMG = "https://images.unsplash.com/photo-1768321914670-80db17b4669b?crop=entropy&cs=srgb&fm=jpg&q=80&w=800";
const AFTER_IMG = "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?crop=entropy&cs=srgb&fm=jpg&q=80&w=800";
const G = "https://static.prod-images.emergentagent.com/jobs/ba6ddcbb-e263-4cc5-8df9-494d3870944d/images/";
// before/after images per trade (index of the raw select value)
const TRADE_IMAGES = {
  "Techos / Roofing": { before: "https://images.unsplash.com/photo-1635424709845-3a85ad5e1f5e?crop=entropy&cs=srgb&fm=jpg&q=80&w=800", after: "https://images.unsplash.com/photo-1635424824849-1b09bdcc55b1?crop=entropy&cs=srgb&fm=jpg&q=80&w=800" },
  "Pintura / Painting": { before: "https://images.unsplash.com/photo-1625585598750-3535fe40efb3?crop=entropy&cs=srgb&fm=jpg&q=80&w=800", after: "https://images.unsplash.com/photo-1615884241431-d07c87e30ab2?crop=entropy&cs=srgb&fm=jpg&q=80&w=800" },
  "Drywall": { before: "https://images.unsplash.com/photo-1718816281207-3b253cff549a?crop=entropy&cs=srgb&fm=jpg&q=80&w=800", after: "https://images.unsplash.com/photo-1733431772808-82d878e59000?crop=entropy&cs=srgb&fm=jpg&q=80&w=800" },
  "Concreto / Concrete": { before: "https://images.unsplash.com/photo-1628744448968-bf7a32f8dd33?crop=entropy&cs=srgb&fm=jpg&q=80&w=800", after: "https://images.unsplash.com/photo-1781637202423-33ec5b47e52e?crop=entropy&cs=srgb&fm=jpg&q=80&w=800" },
  "Jardinería / Landscaping": { before: "https://images.unsplash.com/photo-1594498653385-d5172c532c00?crop=entropy&cs=srgb&fm=jpg&q=80&w=800", after: "https://images.unsplash.com/photo-1624018171446-c4f0b942cf87?crop=entropy&cs=srgb&fm=jpg&q=80&w=800" },
  "Limpieza / Cleaning": { before: "https://images.unsplash.com/photo-1649083048337-4aeb6dda80bb?crop=entropy&cs=srgb&fm=jpg&q=80&w=800", after: "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?crop=entropy&cs=srgb&fm=jpg&q=80&w=800" },
  "Plomería / Plumbing": { before: "https://images.unsplash.com/photo-1714399417136-d328f3ea14c7?crop=entropy&cs=srgb&fm=jpg&q=80&w=800", after: "https://images.unsplash.com/photo-1542855368-ca6ea825bca2?crop=entropy&cs=srgb&fm=jpg&q=80&w=800" },
  "HVAC / Aire acondicionado": { before: G + "646d6692f7aa2f0aca4aedb830af277011e7a3b01e517fe7dc150bd6cea867d4.jpeg", after: G + "2d9685832369ec679cae62f10b97962916de5a2ea9b1e21fc1dec9182e7e4661.jpeg" },
  "Electricidad / Electrical": { before: G + "2fbf37d71ba17eb4996911e1bfe11322fd5ef85edeadf724f303df658ce837d3.jpeg", after: G + "f1dd38738e9ef7b13dc6233b3e30ea44941ce5ed91dcdf23ba106e2477e0697f.jpeg" },
  "Pisos y Azulejo / Flooring & Tile": { before: G + "72be1488d914de32975f9edba4176950c0573ff4246a1d0293e3f812e8d9ecc7.jpeg", after: G + "8b3d2d6a751dff03b20f1560b31397df2e1df3048b997dbe27fda1050b990540.jpeg" },
  "Cercas / Fencing": { before: G + "53b48a00a5590c061d6659ccbfac15c7b3849e0d4ca5354732da6a6f57f58918.jpeg", after: G + "d812f7b14c33a2f608f3d6ed145e01044f1a55a4449bf6c741188c9bd9ddd2fd.jpeg" },
  "Handyman / Reparaciones": { before: G + "157208b3711e26642e1ac1c17c660cd537717004b1f1a287f9cc2c47e0785fa0.jpeg", after: G + "1ab736b5ba4d429c2fa2ed4c98da5bb06004b08953d2d544b95d368f5bb59ab4.jpeg" },
  "Lavado a presión / Pressure Washing": { before: G + "32d34621c5aa2577bfb1ff3549972993e664c810975bb126b1e2a87832ed0f2a.jpeg", after: G + "bda20209adfb2ca230ce0519433cd1c5d24bc59120bf7b49666a1c2c1c11c9aa.jpeg" },
  "Remodelación / Remodeling": { before: G + "fe6e354101b3142a9de6340bfd2237b0b59f733e40a3edfd1a86a57799ca24af.jpeg", after: G + "2f1392083c97ae1a1bab66cbf240a1362e53d5962231c8499b949210038885c8.jpeg" },
  "Mudanzas / Moving": { before: G + "43a7c2884e31916d9bc72421ac2b1859fd6cd8e0ac8511938b39cefdceaa79a8.jpeg", after: G + "997d98c6ea68045c730352835782817d744556e9a9cb0f5c1c6404ca8881f317.jpeg" },
  "Acarreo de basura / Junk Removal": { before: G + "389d7f22cdf9699b3e6c7e25f280e94ec4372cfb505a8d468a4dbad645e0a5ce.jpeg", after: G + "44a9818d23963e73b8e5e816cf2a1f01a289b68fb76e0e17c4970b7c2369ed98.jpeg" },
  "Árboles y poda / Tree Service": { before: G + "e6bb3d92135f77f3306111f1b2d57e1298540aadbff0d1d770efd73204f285b8.jpeg", after: G + "72d08e63b40d6e6482f2be93ce2447010d996451f7130be92d3e9fe204f7ea44.jpeg" },
  "Albañilería y Stucco / Masonry": { before: G + "07b3a6c04999d66105368f852ebccd99a9a49122220e740c4ff37d2adb1e4a93.jpeg", after: G + "8f30a235ab62a262ce0ca2bd9ee55f78c77162cdb020a6a65142b866a4e987de.jpeg" },
  "Control de plagas / Pest Control": { before: G + "113542a70319a0d1ffb5208782d46fcfc4ac7e97018b1da2d3839f53f5086048.jpeg", after: G + "a388bbf1aeb399a682a059f6e23087f7b161069d693a174b11fc12aaf52ede86.jpeg" },
  "Ventanas y Puertas / Windows & Doors": { before: G + "7c169be1cfd571b40ba802cc08e6f5f4af165ef025c64fa5cac7c9f7a0910cc5.jpeg", after: G + "8df0e6828e0d0f0046e6834abf49aa0d8ad84cc0368fd687e1e2231d3850c3f4.jpeg" },
  "Canaletas / Gutters": { before: G + "5e17f72ed6490056ff13783c6be1c655192eb04d1a92a023259be5b92b12c16f.jpeg", after: G + "5ee569d8f2c3446fe70622ce8f0292e6c7687456e3cb868c9b588879c68e30fc.jpeg" },
  "Detallado de autos / Auto Detailing": { before: G + "d6acb5acd83a56290b74afadd561e991acd7232b5bb3a8295ed2c525033ed7a9.jpeg", after: G + "c4165160ec3cb0e2f19611b60bf7721fbf30c5ac99e492ad17ed53369a54730a.jpeg" },
};
const tradeImages = (trade) => TRADE_IMAGES[trade] || { before: BEFORE_IMG, after: AFTER_IMG };
// Visual entry-channel images for Step 1 (how the client finds you)
const CH_NFC_IMG = "/nfc-sample.webp";
const CH_QR_IMG = "https://images.unsplash.com/photo-1595079835357-a94a13cab10c?crop=entropy&cs=srgb&fm=jpg&q=80&w=900";
const CH_WEB_IMG = "https://images.unsplash.com/photo-1625297673326-14790108da55?crop=entropy&cs=srgb&fm=jpg&q=80&w=900";
const CH_CHAT_IMG = "/chatbot-demo.webp";
const CH_GOOGLE_IMG = "https://static.prod-images.emergentagent.com/jobs/ba6ddcbb-e263-4cc5-8df9-494d3870944d/images/c4889fdcb0d017f1c4db6f463c748f95c722f2b92c6b570cfc3892987b95088b.jpeg";
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

// The client's own request message (also pre-fills the quote description in
// step 3), tailored to the trade the demo user picked at the start.
function clientRequestText(trade, t) {
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

export default function DemoFlujo() {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState(0);
  const [lead, setLead] = useState({ name: "", businessName: "", email: "", trade: "", phone: "" });
  const [demoId, setDemoId] = useState(null);
  const [business, setBusiness] = useState(null);
  const [desc, setDesc] = useState("");
  const [quote, setQuote] = useState(null);
  const [agreement, setAgreement] = useState(null);
  const [signed, setSigned] = useState(false);
  const [paid, setPaid] = useState(false);
  const [paidNotice, setPaidNotice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(null);
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
    ? { ...business, business_name: (lead.businessName || "").trim() || (lead.name || "").trim() || business.business_name, business_email: lead.email || business.business_email }
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
      // Pre-fill the quote description with what the client already requested,
      // so the demo user sees how easy it is to reuse the client's own words.
      setDesc(clientRequestText(lead.trade, t));
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
    setLoading(true); setBusy("busyQuoteTitle");
    try {
      const r = await axios.post(`${API}/public/demo/quote`, { demo_id: demoId, description_es: desc });
      setQuote(r.data.quote);
      setBusiness(r.data.business);
      fbTrack("ViewContent", { content_name: "Demo AI Quote", value: Number(r.data.quote?.total || 0), currency: "USD" });
    } catch (e) {
      setErr(e?.response?.data?.detail || t("demoFlow.errQuote"));
    } finally { setLoading(false); setBusy(null); }
  };

  // Demo agreement is built INSTANTLY from the quote (no AI wait). The real
  // account uses the full AI generator; here we only need it to look pro.
  const buildDemoAgreement = () => {
    const biz = ownerBusiness?.business_name || t("demoFlujo.you");
    const clientName = clientLead.name;
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

  const genAgreement = () => {
    setErr("");
    setAgreement(buildDemoAgreement());
    go(4);
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
            <BookingForm client={client} service={tradeName} request={clientRequestText(lead.trade, t)} t={t} />
          </SceneShell>
        )}

        {step === 3 && (
          !quote ? (
            <Card className="p-6 rounded-2xl border-slate-200">
              <div className="mb-3 flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm sm:text-base text-blue-900" data-testid="flujo-s3-fromclient">
                <Sparkles className="w-4 h-4 flex-none mt-0.5" />
                <span>{t("demoFlujo.s3FromClient")}</span>
              </div>
              <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t("demoFlujo.s3DescLabel")}</label>
              <Textarea data-testid="flujo-desc" value={desc} onChange={(e) => setDesc(e.target.value)} rows={6} placeholder={t("demoFlujo.s3DescPh")} className="mt-2 rounded-xl text-base" />
              <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-100 p-4" data-testid="flujo-desc-tips">
                <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-800">
                  <Sparkles className="w-4 h-4" /> {t("demoFlujo.s3TipsTitle")}
                </div>
                <ul className="mt-2.5 space-y-2">
                  {["s3Tip1", "s3Tip2", "s3Tip3", "s3Tip4", "s3Tip5"].map((k) => (
                    <li key={k} className="flex items-start gap-2 text-sm sm:text-base text-slate-700 leading-snug">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-none mt-0.5" /> {t(`demoFlujo.${k}`)}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <Button data-testid="flujo-gen-quote" onClick={genQuote} disabled={loading} className="w-full h-auto py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base leading-tight">
                  {loading ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> {t("demoFlujo.s3GenLoading")}</> : <><Sparkles className="w-5 h-5 mr-2 flex-none" /> {t("demoFlujo.s3Gen")}</>}
                </Button>
                <button onClick={() => go(2)} className="text-base text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 px-3 py-2 self-center"><ArrowLeft className="w-5 h-5" /> {t("demoFlujo.back")}</button>
              </div>
            </Card>
          ) : (
            <QuoteStep quote={quote} business={ownerBusiness} lead={clientLead} onAccept={genAgreement} loading={loading} onBack={() => setQuote(null)} />
          )
        )}

        {step === 4 && (
          <>
            <div className="mb-3 flex items-start gap-2 rounded-xl bg-violet-50 border border-violet-200 px-4 py-3 text-sm text-violet-900" data-testid="flujo-agreement-optional">
              <Info className="w-4 h-4 flex-none mt-0.5" />
              <span>{t("demoFlujo.agreementOptional")}</span>
            </div>
            <AgreementStep agreement={agreement} business={ownerBusiness} lead={clientLead} signed={signed}
              onSign={() => { setSigned(true); go(5); }} />
            <div className="mt-4 flex items-center gap-2">
              <button onClick={() => go(3)} className="text-base text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 px-3 py-2"><ArrowLeft className="w-5 h-5" /> {t("demoFlujo.back")}</button>
              <button onClick={() => go(5)} data-testid="flujo-skip-agreement" className="ml-auto text-base font-semibold text-slate-700 hover:text-black inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-300 hover:border-slate-400">
                {t("demoFlujo.skipToInvoice")} <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <InvoiceStep quote={quote} business={ownerBusiness} lead={clientLead} paid={paid} onPay={() => { setPaid(true); setPaidNotice(true); }} hideFinalCta />
            <div className="mt-4 flex items-center gap-2">
              <button onClick={() => go(4)} className="text-base text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 px-3 py-2"><ArrowLeft className="w-5 h-5" /> {t("demoFlujo.back")}</button>
              {paid && (
                <Button data-testid="flujo-next" onClick={() => go(6)} className="ml-auto py-3 px-6 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-base">
                  {t("demoFlujo.next")} <ArrowRight className="w-5 h-5 ml-2" />
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
            <SocialDesign business={ownerBusiness} imgs={imgs} trade={tradeName} t={t} />
          </SceneShell>
        )}

        {step === 9 && (
          <SceneShell onNext={() => go(10)} onBack={() => go(8)} nextLabel={t("demoFlujo.finishBtn")} t={t}>
            <ReviewScene client={client} t={t} />
          </SceneShell>
        )}

        {step === 10 && <FinalCTA founder={founder} brand={(lead.businessName || lead.name || "").trim()} t={t} />}
      </div>
      <BusySheet busy={busy} t={t} />
      {step !== 10 && <WhatsAppFab />}
      <NoticeSheet
        open={paidNotice}
        t={t}
        onContinue={() => { setPaidNotice(false); go(6); }}
      />
    </div>
  );
}

function BusySheet({ busy, t }) {
  if (!busy) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" data-testid="flujo-busy">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200" />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="mx-auto w-12 h-1.5 rounded-full bg-slate-200 sm:hidden mb-5" />
        <div className="flex flex-col items-center text-center">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-900 to-emerald-600 opacity-20 animate-ping" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-900 to-emerald-600 flex items-center justify-center">
              <Bot className="w-8 h-8 text-white" />
            </div>
          </div>
          <h3 className="font-heading text-lg font-bold mt-4 flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" /> {t(`demoFlujo.${busy}`)}
          </h3>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed max-w-xs">{t("demoFlujo.busyWait")}</p>
          <div className="mt-5 w-full h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-blue-900 to-emerald-500 animate-[busybar_1.4s_ease-in-out_infinite]" />
          </div>
          <div className="text-xs font-semibold text-emerald-700 mt-3">{t("demoFlujo.busyStay")}</div>
        </div>
      </div>
    </div>
  );
}

function NoticeSheet({ open, t, onContinue }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" data-testid="flujo-demo-notice">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200" />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="mx-auto w-12 h-1.5 rounded-full bg-slate-200 sm:hidden mb-5" />
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9 text-emerald-600" />
          </div>
          <h3 className="font-heading text-xl sm:text-2xl font-bold mt-4">{t("demoFlujo.demoNoticeTitle")}</h3>
          <p className="text-base text-slate-600 mt-2 leading-relaxed max-w-sm">{t("demoFlujo.demoNoticeText")}</p>
          <Button data-testid="flujo-demo-notice-continue" onClick={onContinue} className="mt-6 w-full py-4 h-auto rounded-2xl bg-slate-900 hover:bg-black text-white font-bold text-base sm:text-lg leading-tight">
            {t("demoFlujo.demoNoticeContinue")} <ArrowRight className="w-5 h-5 ml-2 flex-none" />
          </Button>
        </div>
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
          <span className="text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Demo</span>
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
      <div className="text-sm font-bold text-emerald-700 mt-2" data-testid="flujo-progress">{t("demoFlujo.progress", { n: step })}</div>
      <div className="mt-5 flex flex-col items-center text-center">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white ${isClient ? "bg-amber-500" : "bg-gradient-to-br from-blue-900 to-emerald-600"}`}>
          <Icon className="w-8 h-8" />
        </div>
        <span className={`text-sm font-bold uppercase tracking-wider mt-3 ${isClient ? "text-amber-600" : "text-blue-600"}`}>{isClient ? t("demoFlujo.clientLabel") : t("demoFlujo.youLabel")}</span>
        <h2 className="font-heading text-2xl sm:text-3xl font-bold leading-tight mt-1">{head.title}</h2>
        <p className="text-base sm:text-lg text-slate-600 mt-2 leading-relaxed max-w-lg">{head.cap}</p>
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
      <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">{t("demoFlujo.introTitle")}</h1>
      <p className="text-base sm:text-lg text-slate-600 mt-2 leading-relaxed">{t("demoFlujo.introDesc")}</p>
      <div className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t("demoFlujo.name")}</label>
          <Input data-testid="flujo-name" value={lead.name} onChange={set("name")} placeholder="Carlos García" className="mt-1 h-12 rounded-xl text-base" />
        </div>
        <div>
          <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t("demoFlujo.businessName")}</label>
          <Input data-testid="flujo-business-name" value={lead.businessName} onChange={set("businessName")} placeholder={t("demoFlujo.businessNamePh")} className="mt-1 h-12 rounded-xl text-base" />
        </div>
        <div>
          <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t("demoFlujo.email")}</label>
          <Input data-testid="flujo-email" type="email" value={lead.email} onChange={set("email")} placeholder={t("demo.emailPlaceholder")} className="mt-1 h-12 rounded-xl text-base" />
        </div>
        <div>
          <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t("demoFlujo.trade")}</label>
          <select data-testid="flujo-trade" value={lead.trade} onChange={set("trade")} className="mt-1 h-12 w-full rounded-xl border border-slate-200 px-3 text-base bg-white">
            <option value="">{t("demoFlujo.choose")}</option>
            {TRADES.map((tr) => <option key={tr} value={tr}>{tradeLabel(tr, i18n.language)}</option>)}
          </select>
        </div>
      </div>
      <Button data-testid="flujo-start" onClick={onStart} disabled={loading} className="mt-6 w-full py-4 rounded-xl bg-gradient-to-br from-blue-900 to-emerald-600 text-white font-bold text-lg">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{t("demoFlujo.start")} <ArrowRight className="w-5 h-5 ml-2" /></>}
      </Button>
      <p className="text-sm text-slate-400 mt-3 text-center">{t("demoFlujo.freeNote")}</p>
    </Card>
  );
}

function FoundVia({ t }) {
  const ch = [
    { icon: MapPin, img: CH_GOOGLE_IMG, label: t("demoFlujo.foundGoogle"), sub: t("demoFlujo.foundGoogleSub"), tone: "from-red-500 to-amber-500", fit: "object-cover" },
    { icon: Nfc, img: CH_NFC_IMG, label: t("demoFlujo.foundNfc"), sub: t("demoFlujo.foundNfcSub"), tone: "from-blue-600 to-blue-500", fit: "object-contain bg-slate-100" },
    { icon: QrCode, img: CH_QR_IMG, label: t("demoFlujo.foundQr"), sub: t("demoFlujo.foundQrSub"), tone: "from-slate-700 to-slate-600", fit: "object-cover" },
    { icon: Globe, img: CH_WEB_IMG, label: t("demoFlujo.foundWeb"), sub: t("demoFlujo.foundWebSub"), tone: "from-emerald-600 to-emerald-500", fit: "object-cover" },
    { icon: Bot, img: CH_CHAT_IMG, label: t("demoFlujo.foundChat"), sub: t("demoFlujo.foundChatSub"), tone: "from-violet-600 to-violet-500", fit: "object-contain bg-slate-100" },
  ];
  return (
    <div data-testid="flujo-found">
      <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">{t("demoFlujo.foundVia")}</div>
      <div className="space-y-3">
        {ch.map((c, i) => (
          <div
            key={c.label}
            data-testid={`flujo-channel-${i}`}
            className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-2"
            style={{ animationDelay: `${i * 90}ms`, animationFillMode: "both", animationDuration: "400ms" }}
          >
            <img src={c.img} alt={c.label} className={`w-full h-48 sm:h-56 ${c.fit}`} loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />
            <div className={`absolute top-3 left-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r ${c.tone} text-white text-sm font-bold uppercase tracking-wider shadow`}>
              <c.icon className="w-4 h-4" /> {c.label}
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="text-white text-base sm:text-lg font-semibold leading-snug drop-shadow">{c.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniCard({ business, label }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-blue-900 to-emerald-700 text-white p-5" data-testid="flujo-card">
      <div className="flex items-center gap-2"><Hammer className="w-6 h-6" /><span className="font-heading font-bold text-lg">{business?.business_name || "Demo Contractors"}</span></div>
      <div className="text-sm text-white/80 mt-0.5">{label}</div>
      <div className="mt-3 flex items-center gap-1 text-amber-300">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}<span className="text-white/70 text-sm ml-1">5.0</span></div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="px-3 py-1.5 rounded-lg bg-white/15 text-sm font-semibold flex items-center gap-1"><MessageSquare className="w-4 h-4" /> WhatsApp</span>
        <span className="px-3 py-1.5 rounded-lg bg-white/15 text-sm font-semibold flex items-center gap-1"><CalendarCheck className="w-4 h-4" /> Book now</span>
        <span className="px-3 py-1.5 rounded-lg bg-white/15 text-sm font-semibold flex items-center gap-1"><ThumbsUp className="w-4 h-4" /> Reviews</span>
      </div>
    </div>
  );
}

function BookingForm({ client, service, request, t }) {
  const times = ["9:00", "10:00", "11:30", "2:00"];
  return (
    <div data-testid="flujo-booking" className="rounded-2xl border border-slate-200 overflow-hidden">
      <div className="bg-slate-900 text-white px-4 py-3 text-base font-bold flex items-center gap-2"><CalendarCheck className="w-5 h-5" /> Book an appointment</div>
      <div className="p-4 space-y-4">
        <Field label={t("demoFlujo.bookName")} value={client} />
        <Field label={t("demoFlujo.bookService")} value={service} />
        <div data-testid="flujo-booking-request">
          <div className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t("demoFlujo.bookRequestLabel")}</div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-base text-slate-700 leading-snug italic">“{request}”</div>
          <div className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5">
            <Sparkles className="w-4 h-4" /> {t("demoFlujo.bookRequestedQuote")}
          </div>
        </div>
        <div>
          <div className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t("demoFlujo.bookTime")}</div>
          <div className="grid grid-cols-4 gap-2">
            {times.map((tm, i) => (
              <div key={tm} className={`text-center py-2.5 rounded-lg text-base font-semibold border ${i === 1 ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-200 text-slate-500"}`}>{tm}</div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 text-emerald-800 text-base font-semibold px-3 py-2.5 mt-1">
          <CheckCircle2 className="w-5 h-5" /> {t("demoFlujo.bookConfirmed")}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">{label}</div>
      <div className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-3 flex items-center text-base font-medium text-slate-800">{value}</div>
    </div>
  );
}

function JobDetail({ client, title, total, deposit, t }) {
  const stages = [t("demoFlujo.stgNew"), t("demoFlujo.stgScheduled"), t("demoFlujo.stgProgress"), t("demoFlujo.stgDone")];
  return (
    <div data-testid="flujo-job" className="rounded-2xl border border-slate-200 overflow-hidden">
      <div className="bg-gradient-to-br from-blue-900 to-emerald-700 text-white px-4 py-3">
        <div className="text-sm uppercase tracking-wider text-white/70">Job</div>
        <div className="font-heading font-bold text-lg">{title || "Living room remodel"}</div>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-1 mb-4">
          {stages.map((s, i) => (
            <div key={s} className="flex-1 text-center">
              <div className={`h-1.5 rounded-full ${i <= 1 ? "bg-emerald-500" : "bg-slate-200"}`} />
              <div className={`text-sm mt-1 font-semibold ${i === 1 ? "text-emerald-700" : "text-slate-400"}`}>{s}</div>
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
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <Icon className="w-5 h-5 text-slate-400 flex-none mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="text-sm text-slate-500">{label}</div>
        <div className={`text-base font-bold leading-snug ${tone === "emerald" ? "text-emerald-700" : "text-slate-800"}`}>{value}</div>
      </div>
    </div>
  );
}

function BeforeAfter({ imgs, t }) {
  return (
    <div data-testid="flujo-photos">
      <div className="grid grid-cols-2 gap-3">
        <figure className="relative rounded-xl overflow-hidden">
          <img src={imgs.before} alt="before" className="w-full h-44 sm:h-52 object-cover" />
          <figcaption className="absolute top-2 left-2 text-sm font-bold bg-slate-900/80 text-white px-2.5 py-1 rounded">{t("demoFlujo.before")}</figcaption>
        </figure>
        <figure className="relative rounded-xl overflow-hidden">
          <img src={imgs.after} alt="after" className="w-full h-44 sm:h-52 object-cover" />
          <figcaption className="absolute top-2 left-2 text-sm font-bold bg-emerald-600 text-white px-2.5 py-1 rounded">{t("demoFlujo.after")}</figcaption>
        </figure>
      </div>
      <div className="mt-3 inline-flex items-center gap-2 text-base font-semibold text-emerald-700"><CheckCircle2 className="w-5 h-5" /> {t("demoFlujo.photoSaved")}</div>
    </div>
  );
}

function SocialDesign({ business, imgs, trade, t }) {
  const templates = [
    "showcase", "promo", "review_5star", "elegant_dark",
    "magazine", "seasonal", "quote_offer", "trust_badge",
  ];
  return (
    <div data-testid="flujo-social">
      {/* The generated post — real system template */}
      <div className="mx-auto max-w-[300px] rounded-2xl overflow-hidden shadow-xl bg-white border border-slate-200">
        <div className="relative">
          <img src={imgs.after} alt="Post generado" className="w-full aspect-square object-cover" />
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-3 pt-8 pb-2.5">
            <div className="text-white text-sm sm:text-base font-extrabold leading-tight drop-shadow">{t("demoFlujo.socialPostTitle", { trade })}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2.5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center flex-none"><Hammer className="w-5 h-5 text-white" /></div>
          <div className="min-w-0">
            <div className="text-sm font-extrabold truncate">{business?.business_name || "Demo Contractors"}</div>
            <div className="text-sm text-slate-500 flex items-center gap-1"><MessageSquare className="w-4 h-4" /> WhatsApp · {t("demoFlujo.clientPhone")}</div>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-slate-400 flex-none">
            <Instagram className="w-5 h-5" /><Facebook className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* AI caption */}
      <p className="text-sm sm:text-base text-slate-700 mt-3 leading-relaxed bg-slate-100 rounded-xl px-3.5 py-3">{t("demoFlujo.socialCaptionText", { trade })}</p>

      {/* Posted confirmations */}
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2 text-base font-semibold text-violet-800 bg-violet-50 rounded-xl px-3.5 py-2.5"><Share2 className="w-5 h-5" /> {t("demoFlujo.postedSocial")}</div>
        <div className="flex items-center gap-2 text-base font-semibold text-blue-800 bg-blue-50 rounded-xl px-3.5 py-2.5"><MapPin className="w-5 h-5" /> {t("demoFlujo.uploadedGmb")}</div>
      </div>

      {/* Gallery of other real templates */}
      <div className="mt-5" data-testid="flujo-templates">
        <div className="flex items-center gap-1.5 text-base font-bold text-slate-900">
          <Sparkles className="w-5 h-5 text-emerald-600" /> {t("demoFlujo.socialMoreTitle")}
        </div>
        <p className="text-sm text-slate-500 mt-0.5">{t("demoFlujo.socialMoreSub")}</p>
        <div className="mt-3 -mx-1 flex gap-3 overflow-x-auto pb-2 px-1 snap-x">
          {templates.map((tpl) => (
            <div key={tpl} className="flex-none w-36 rounded-xl overflow-hidden border border-slate-200 shadow-sm snap-start">
              <img src={`/social-previews/${tpl}.jpg`} alt={tpl} loading="lazy" className="w-full aspect-square object-cover" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReviewScene({ client, t }) {
  return (
    <div data-testid="flujo-review" className="space-y-3">
      <div className="rounded-xl bg-slate-100 px-4 py-3 text-base text-slate-700">{t("demoFlujo.reviewAsk")}</div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-base">{client[0]}</div>
          <div>
            <div className="text-base font-bold">{client}</div>
            <div className="flex items-center gap-0.5 text-amber-500">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}</div>
          </div>
        </div>
        <p className="text-base text-slate-700 mt-2 italic">{t("demoFlujo.reviewText")}</p>
      </div>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-700 uppercase tracking-wider"><Bot className="w-4 h-4" /> {t("demoFlujo.reviewReplyLabel")}</div>
        <p className="text-base text-slate-700 mt-1.5">{t("demoFlujo.reviewReply")}</p>
      </div>
    </div>
  );
}

function FinalCTA({ founder, brand, t }) {
  const available = founder?.available;
  const price = founder?.display_price || "$59";
  const to = available ? "/register?plan=bundle_founder&billing=month" : "/register?plan=bundle";
  const recap = [
    t("demoFlujo.recap1"), t("demoFlujo.recap2"), t("demoFlujo.recap3"),
    t("demoFlujo.recap4"), t("demoFlujo.recap5"),
  ];
  const helps = [
    { icon: Clock, title: t("demoFlujo.help1Title"), sub: t("demoFlujo.help1Sub"), tone: "text-blue-700 bg-blue-50" },
    { icon: CreditCard, title: t("demoFlujo.help2Title"), sub: t("demoFlujo.help2Sub"), tone: "text-emerald-700 bg-emerald-50" },
    { icon: Star, title: t("demoFlujo.help3Title"), sub: t("demoFlujo.help3Sub"), tone: "text-amber-700 bg-amber-50" },
  ];
  return (
    <div data-testid="flujo-final" className="animate-in fade-in slide-in-from-bottom-3 duration-500">
      {/* Celebration header */}
      <div className="text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-900 to-emerald-600 flex items-center justify-center shadow-lg">
          <PartyPopper className="w-8 h-8 text-white" />
        </div>
        <h2 className="font-heading text-2xl sm:text-3xl font-bold mt-4 leading-tight">{t("demoFlujo.finalTitle")}</h2>
        <p className="text-base sm:text-lg text-slate-600 mt-2 max-w-md mx-auto leading-relaxed">{t("demoFlujo.finalDesc")}</p>
      </div>

      {/* Recap of what they experienced */}
      <Card className="mt-6 p-5 rounded-2xl border-slate-200">
        <div className="text-sm font-bold text-emerald-700 uppercase tracking-wider mb-3">{t("demoFlujo.finalRecapTitle")}</div>
        <ul className="space-y-3">
          {recap.map((r, i) => (
            <li key={i} className="flex items-start gap-2.5 text-base text-slate-700">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-none mt-0.5" />
              <span className="leading-snug">{r}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* How it helps the business */}
      <div className="mt-4">
        <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 text-center">{t("demoFlujo.finalHelpTitle")}</div>
        <div className="space-y-2.5">
          {helps.map((h, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
              <div className={`w-12 h-12 flex-none rounded-xl flex items-center justify-center ${h.tone}`}><h.icon className="w-6 h-6" /></div>
              <div>
                <div className="text-lg font-bold text-slate-900 leading-tight">{h.title}</div>
                <div className="text-sm text-slate-500 leading-tight">{h.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* The offer */}
      <Card className="mt-6 p-6 rounded-2xl border-0 bg-gradient-to-br from-blue-900 to-emerald-700 text-white text-center shadow-xl">
        {available && founder && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400 text-amber-950 text-sm font-extrabold uppercase tracking-wider">
            <Crown className="w-4 h-4" /> {t("demoFlujo.founderSpots", { n: founder.remaining, limit: founder.limit })}
          </div>
        )}
        <div className="text-base font-bold uppercase tracking-wider text-white/80 mt-3">{brand ? t("demoFlujo.offerBrandTitle", { brand }) : t("demoFlujo.offerTitle")}</div>
        <div className="mt-1 flex items-end justify-center gap-1">
          <span className="font-heading text-5xl sm:text-6xl font-extrabold">{available ? price : "$75"}</span>
          <span className="text-white/80 font-semibold mb-2 text-lg">/{t("demoFlujo.perMonth", "mo")}</span>
        </div>
        <div className="text-sm text-amber-200 font-semibold mt-1">
          {available ? t("demoFlujo.offerPriceNote") : ""}
        </div>
        <p className="text-base text-white/90 mt-3 max-w-sm mx-auto leading-relaxed">{t("demoFlujo.offerIncludes")}</p>
        <Link data-testid="flujo-final-cta" to={to} className="mt-5 inline-flex w-full items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white text-blue-900 font-extrabold text-base sm:text-lg hover:bg-slate-100 transition-colors leading-tight">
          {available
            ? <><Crown className="w-5 h-5 flex-none" /> {brand ? t("demoFlujo.founderCtaBrand", { brand }) : t("demoFlujo.founderCta")}</>
            : <>{brand ? t("demoFlujo.regularCtaBrand", { brand }) : t("demoFlujo.regularCta")}</>} <ArrowRight className="w-5 h-5 flex-none" />
        </Link>
        <div className="text-sm text-white/70 mt-3">{t("demoFlujo.offerRegularNote")}</div>
      </Card>

      {/* Not ready? Talk to a human on WhatsApp — rescues undecided prospects */}
      <div className="mt-5 text-center">
        <p className="text-sm text-slate-500 mb-2">{t("whatsapp.demoPrompt")}</p>
        <WhatsAppButton testid="flujo-final-whatsapp" />
      </div>
    </div>
  );
}
