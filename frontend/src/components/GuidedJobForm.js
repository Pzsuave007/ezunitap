import { useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Wand2, Check } from "lucide-react";
import { toast } from "sonner";

// Common trades for the tappable chips. "Otro" lets them type anything.
const TRADES = [
  "Pintura / Painting", "Techos / Roofing", "Plomería / Plumbing", "Electricidad / Electrical",
  "Jardinería / Landscaping", "Limpieza / Cleaning", "Concreto / Concrete", "Drywall",
  "Pisos y Azulejo / Flooring & Tile", "HVAC", "Remodelación / Remodeling", "Handyman",
];

// A single-screen guided questionnaire that turns a few simple answers into a
// quote/invoice via the AI. Calls onResult(data) with the normalized result.
// `initial` pre-fills the answers (used by the demo for a 1-tap experience).
// `request` overrides the default authed API call (used by the public demo).
export default function GuidedJobForm({ lang = "es", defaultTrade = "", initial = {}, request, onResult, ctaLabel }) {
  const { t } = useTranslation();
  const es = lang === "es";
  const [trade, setTrade] = useState(initial.trade || defaultTrade || "");
  const [otherTrade, setOtherTrade] = useState("");
  const [work, setWork] = useState(initial.work || "");
  const [hasPrice, setHasPrice] = useState(initial.hasPrice ?? null); // null | true | false
  const [price, setPrice] = useState(initial.price || "");
  const [materials, setMaterials] = useState(initial.materials || "unsure"); // yes | no | unsure
  const [deposit, setDeposit] = useState(initial.deposit || "none"); // none | half | custom
  const [depositPct, setDepositPct] = useState("");
  const [loading, setLoading] = useState(false);

  const chosenTrade = trade === "__other__" ? otherTrade : trade;

  const generate = async () => {
    if (!work.trim()) return toast.error(es ? "Dime qué hay que hacer" : "Tell us what needs to be done");
    if (hasPrice === null) return toast.error(es ? "Dinos si ya tienes un precio" : "Tell us if you have a price");
    if (hasPrice && !(Number(price) > 0)) return toast.error(es ? "Escribe el precio total" : "Enter the total price");
    setLoading(true);
    try {
      const payload = {
        trade: chosenTrade || "",
        work_es: work.trim(),
        total_price: hasPrice ? Number(price) : null,
        includes_materials: materials,
        deposit_kind: deposit,
        deposit_percent: deposit === "custom" ? Number(depositPct) || 0 : null,
        language: lang,
      };
      const data = request ? await request(payload) : (await api.post("/ai/quote-guided", payload)).data;
      onResult?.(data);
      toast.success(es ? "¡Listo!" : "Done!");
    } catch (err) {
      toast.error(err?.response?.data?.detail || (es ? "No se pudo generar. Intenta de nuevo." : "Could not generate. Try again."));
    } finally {
      setLoading(false);
    }
  };

  const Opt = ({ active, onClick, children, testid }) => (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      className={`px-3.5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all active:scale-[0.97] ${
        active ? "border-emerald-500 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300"
      }`}
    >
      {active && <Check className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />}{children}
    </button>
  );

  return (
    <div className="space-y-5" data-testid="guided-job-form">
      {/* Q1: trade */}
      <div>
        <Label className="font-bold">{es ? "1. ¿Qué tipo de trabajo es?" : "1. What kind of job is it?"}</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {TRADES.map((tr) => (
            <Opt key={tr} testid={`guided-trade-${tr}`} active={trade === tr} onClick={() => setTrade(tr)}>
              {es ? tr.split(" / ")[0] : (tr.split(" / ")[1] || tr)}
            </Opt>
          ))}
          <Opt testid="guided-trade-other" active={trade === "__other__"} onClick={() => setTrade("__other__")}>
            {es ? "Otro" : "Other"}
          </Opt>
        </div>
        {trade === "__other__" && (
          <Input data-testid="guided-trade-other-input" value={otherTrade} onChange={(e) => setOtherTrade(e.target.value)}
            placeholder={es ? "Escribe tu oficio" : "Type your trade"} className="h-11 rounded-xl mt-2" />
        )}
      </div>

      {/* Q2: what needs doing */}
      <div>
        <Label className="font-bold">{es ? "2. ¿Qué hay que hacer?" : "2. What needs to be done?"}</Label>
        <Textarea data-testid="guided-work" value={work} onChange={(e) => setWork(e.target.value)} rows={3}
          placeholder={es ? "Ej: pintar 2 recámaras y el pasillo" : "e.g. paint 2 bedrooms and the hallway"}
          className="rounded-xl mt-2 text-base" />
        <p className="text-xs text-slate-400 mt-1">{es ? "Dilo simple, como se lo dirías a un amigo. La IA lo redacta bonito." : "Say it simply. The AI writes it up professionally."}</p>
      </div>

      {/* Q3: price */}
      <div>
        <Label className="font-bold">{es ? "3. ¿Ya sabes cuánto vas a cobrar?" : "3. Do you know how much you'll charge?"}</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          <Opt testid="guided-price-yes" active={hasPrice === true} onClick={() => setHasPrice(true)}>
            {es ? "Sí, yo pongo el total" : "Yes, I set the total"}
          </Opt>
          <Opt testid="guided-price-no" active={hasPrice === false} onClick={() => { setHasPrice(false); setPrice(""); }}>
            {es ? "No, que la IA sugiera" : "No, let the AI suggest"}
          </Opt>
        </div>
        {hasPrice === true && (
          <div className="relative mt-2 max-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">$</span>
            <Input data-testid="guided-price-input" type="number" inputMode="decimal" value={price}
              onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className="h-11 rounded-xl pl-7" />
          </div>
        )}
      </div>

      {/* Q4: materials */}
      <div>
        <Label className="font-bold">{es ? "4. ¿Incluye materiales?" : "4. Are materials included?"}</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          <Opt testid="guided-mat-yes" active={materials === "yes"} onClick={() => setMaterials("yes")}>{es ? "Sí" : "Yes"}</Opt>
          <Opt testid="guided-mat-no" active={materials === "no"} onClick={() => setMaterials("no")}>{es ? "No" : "No"}</Opt>
          <Opt testid="guided-mat-unsure" active={materials === "unsure"} onClick={() => setMaterials("unsure")}>{es ? "No estoy seguro" : "Not sure"}</Opt>
        </div>
      </div>

      {/* Q5: deposit */}
      <div>
        <Label className="font-bold">{es ? "5. ¿Vas a pedir depósito?" : "5. Will you ask for a deposit?"}</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          <Opt testid="guided-dep-none" active={deposit === "none"} onClick={() => setDeposit("none")}>{es ? "No" : "No"}</Opt>
          <Opt testid="guided-dep-half" active={deposit === "half"} onClick={() => setDeposit("half")}>{es ? "50%" : "50%"}</Opt>
          <Opt testid="guided-dep-custom" active={deposit === "custom"} onClick={() => setDeposit("custom")}>{es ? "Otro %" : "Other %"}</Opt>
        </div>
        {deposit === "custom" && (
          <div className="relative mt-2 max-w-[140px]">
            <Input data-testid="guided-dep-pct" type="number" inputMode="decimal" value={depositPct}
              onChange={(e) => setDepositPct(e.target.value)} placeholder="30" className="h-11 rounded-xl pr-7" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">%</span>
          </div>
        )}
      </div>

      <Button data-testid="guided-generate" onClick={generate} disabled={loading}
        className="w-full h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Wand2 className="w-5 h-5 mr-2" /> {ctaLabel || (es ? "Crear con IA" : "Create with AI")}</>}
      </Button>
    </div>
  );
}
