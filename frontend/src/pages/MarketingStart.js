import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  Megaphone, Sparkles, Loader2, Camera, ImagePlus, Video, ArrowRight,
  CheckCircle2, Hammer, Tag, Star, Repeat, Users, Snowflake, Lightbulb, Wand2, Briefcase, Check,
} from "lucide-react";

// Icon per post-type so dynamic, trade-specific topic chips still get a fitting glyph.
const CAT_ICON = {
  trabajo_terminado: Hammer, oferta: Tag, resena: Star, antes_despues: Repeat,
  contratando: Users, temporada: Snowflake, tips: Lightbulb,
};
const CAT_LABEL = {
  trabajo_terminado: "Trabajo terminado", oferta: "Oferta", resena: "Reseña",
  antes_despues: "Antes / Después", contratando: "Contratando", temporada: "Temporada", tips: "Consejo",
};

// Common contractor trades shown when the account has no industry set yet.
const INDUSTRIES = [
  "Techos / Roofing", "Plomería", "Electricidad", "Jardinería / Landscaping",
  "Pintura", "Concreto", "Limpieza", "HVAC / Climas", "Remodelación",
  "Construcción", "Pisos", "Cercas / Fencing",
];

export default function MarketingStart() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const firstName = (user?.business_name || "").trim() || "compa";
  const [extra, setExtra] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeCat, setActiveCat] = useState(null);
  const [ideas, setIdeas] = useState([]);
  const [ideasOpen, setIdeasOpen] = useState(false);
  // Industry-tailored topic chips
  const [topics, setTopics] = useState([]);
  const [businessType, setBusinessType] = useState("");
  const [needsIndustry, setNeedsIndustry] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [showIndustry, setShowIndustry] = useState(false);
  const [customIndustry, setCustomIndustry] = useState("");
  const [savingIndustry, setSavingIndustry] = useState(false);

  const loadTopics = async () => {
    setLoadingTopics(true);
    try {
      const { data } = await api.get("/social/idea-topics");
      setBusinessType(data.business_type || "");
      setNeedsIndustry(!!data.needs_industry);
      setTopics(data.topics || []);
      setShowIndustry(!!data.needs_industry);
    } catch (e) {
      setTopics([]);
    } finally {
      setLoadingTopics(false);
    }
  };
  useEffect(() => { loadTopics(); }, []);

  const saveIndustry = async (value) => {
    const bt = (value || "").trim();
    if (!bt) return;
    setSavingIndustry(true);
    try {
      await api.post("/social/industry", { business_type: bt });
      setShowIndustry(false);
      setCustomIndustry("");
      await loadTopics();
      toast.success("Industria guardada — temas personalizados ✨");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo guardar");
    } finally {
      setSavingIndustry(false);
    }
  };

  const getIdeas = async (category, topicLabel = "") => {
    setActiveCat(topicLabel || category || "all");
    setIdeas([]);
    setIdeasOpen(true);
    setLoading(true);
    const ctx = [topicLabel, extra.trim()].filter(Boolean).join(" — ");
    try {
      const { data } = await api.post("/social/post-ideas", {
        category: category || "",
        extra_context: ctx,
        count: 3,
        language: "es",
      });
      setIdeas(data.ideas || []);
      if (!data.ideas?.length) toast.error("No salieron ideas, intenta de nuevo");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudieron generar ideas");
      setIdeasOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const openPost = (idea) => navigate(`/marketing?mode=image&brief=${encodeURIComponent(idea.idea || idea.title)}`);
  const openReel = (idea) => navigate(`/marketing?mode=reel&brief=${encodeURIComponent(idea.idea || idea.title)}`);
  const openAi = (idea) => navigate(`/marketing?mode=ai&imgprompt=${encodeURIComponent(idea.image_prompt || idea.idea || idea.title)}&brief=${encodeURIComponent(idea.idea || idea.title)}`);

  return (
    <div className="space-y-6 pb-10" data-testid="marketing-start">
      {/* Hero / welcome */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white p-6 sm:p-8">
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider bg-white/15 px-3 py-1 rounded-full">
            <Megaphone className="w-3.5 h-3.5" /> Estudio de Marketing
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold mt-3 leading-tight">
            ¡Hola, {firstName}! 👋<br />¿Qué vas a postear hoy?
          </h1>
          <p className="text-emerald-50/90 text-sm mt-2 max-w-md">
            Elige un tema y la IA te da ideas listas, te dice qué foto tomar, o te crea la imagen. Y si no sabes… deja que la IA te sorprenda.
          </p>
        </div>
      </div>

      {/* Optional context */}
      <Card className="p-5 border-0 shadow-sm space-y-4">
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">¿Algo especial hoy? (opcional)</Label>
          <Input
            data-testid="extra-context-input"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="Ej: oferta de invierno 20% off, acabamos un techo en Auburn, busco ayudante…"
            className="mt-2 rounded-xl"
          />
          <p className="text-[11px] text-slate-400 mt-1">Mientras más nos cuentes de tu negocio, mejores ideas. ✨</p>
        </div>

        {/* Industry selector (only when not set yet, or when changing it) */}
        {showIndustry ? (
          <div data-testid="industry-selector">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" /> ¿Cuál es tu industria?
            </Label>
            <p className="text-[11px] text-slate-400 mt-0.5 mb-2">Así los temas e ideas salen específicos para tu oficio.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {INDUSTRIES.map((ind) => (
                <button
                  key={ind}
                  onClick={() => saveIndustry(ind)}
                  disabled={savingIndustry}
                  data-testid={`industry-${ind}`}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 hover:border-emerald-400 text-sm font-semibold text-slate-700 text-left tap transition-colors"
                >
                  {ind}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <Input
                data-testid="custom-industry-input"
                value={customIndustry}
                onChange={(e) => setCustomIndustry(e.target.value)}
                placeholder="Otra… (ej: Albañilería, Detallado de autos)"
                className="rounded-xl"
                onKeyDown={(e) => e.key === "Enter" && saveIndustry(customIndustry)}
              />
              <Button onClick={() => saveIndustry(customIndustry)} disabled={savingIndustry || !customIndustry.trim()} data-testid="save-industry-btn" className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
                {savingIndustry ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Elige un tema</Label>
              {businessType && (
                <button onClick={() => setShowIndustry(true)} data-testid="change-industry-btn" className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 tap">
                  {businessType} · cambiar
                </button>
              )}
            </div>
            {loadingTopics ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-4" data-testid="topics-loading">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando temas para tu negocio…
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-2" data-testid="topics-grid">
                {topics.map((t, i) => {
                  const Icon = CAT_ICON[t.category] || Lightbulb;
                  const active = activeCat === t.label;
                  return (
                    <button
                      key={i}
                      onClick={() => getIdeas(t.category, t.label)}
                      data-testid={`topic-${i}`}
                      title={CAT_LABEL[t.category]}
                      className={`flex items-center gap-2 px-3 py-3 rounded-2xl border text-left text-sm font-semibold tap transition-all ${
                        active ? "border-emerald-500 ring-2 ring-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 hover:border-emerald-300 text-slate-700"
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-none text-emerald-600" />
                      <span className="leading-tight">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <Button
          onClick={() => getIdeas("")}
          disabled={loading}
          data-testid="surprise-btn"
          className="w-full h-12 rounded-xl bg-violet-600 hover:bg-violet-700 text-base"
        >
          {loading && activeCat === "all" ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Sparkles className="w-5 h-5 mr-2" />}
          No sé qué postear — dame ideas ✨
        </Button>

        <button
          onClick={() => navigate("/marketing")}
          data-testid="skip-to-studio"
          className="w-full text-center text-xs font-bold text-slate-400 hover:text-slate-600 tap flex items-center justify-center gap-1.5"
        >
          Ya sé qué postear, ir al estudio <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </Card>

      {/* Ideas — slide-up drawer: shows "preparando…" then the ideas, no scroll needed */}
      <Drawer open={ideasOpen} onOpenChange={setIdeasOpen}>
        <DrawerContent data-testid="ideas-drawer" className="max-h-[88vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-heading flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              {loading ? "Preparando ideas…" : "Ideas para ti"}
              {!loading && activeCat && activeCat !== "all" && (
                <span className="text-xs font-semibold text-slate-400">· {activeCat}</span>
              )}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8 overflow-y-auto max-w-lg mx-auto w-full" data-testid="ideas-drawer-body">
            {loading && (
              <div className="flex flex-col items-center justify-center py-14 text-center" data-testid="ideas-loading">
                <Loader2 className="w-9 h-9 animate-spin text-emerald-600 mb-3" />
                <p className="text-sm font-semibold text-slate-600">Preparando ideas para ti…</p>
                <p className="text-xs text-slate-400 mt-1">Dame unos segundos ✨</p>
              </div>
            )}
            {!loading && ideas.length > 0 && (
              <div className="space-y-3" data-testid="ideas-list">
                {ideas.map((it, i) => (
                  <Card key={i} className="p-4 border border-slate-100 shadow-sm" data-testid={`idea-card-${i}`}>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-none mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 text-sm">{it.title}</div>
                        <p className="text-sm text-slate-600 mt-0.5">{it.idea}</p>
                        {it.photo_tip && (
                          <div className="mt-2 flex items-start gap-1.5 text-[12px] text-blue-700 bg-blue-50 rounded-lg px-2.5 py-1.5">
                            <Camera className="w-3.5 h-3.5 flex-none mt-0.5" />
                            <span><b>Toma esto:</b> {it.photo_tip}</span>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Button onClick={() => openPost(it)} size="sm" data-testid={`idea-use-post-${i}`}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 h-8 text-xs">
                            <ImagePlus className="w-3.5 h-3.5 mr-1.5" /> Usar en Post
                          </Button>
                          <Button onClick={() => openAi(it)} size="sm" variant="outline" data-testid={`idea-use-ai-${i}`}
                            className="rounded-lg h-8 text-xs border-violet-300 text-violet-700 hover:bg-violet-50">
                            <Wand2 className="w-3.5 h-3.5 mr-1.5" /> Crear imagen IA
                          </Button>
                          <Button onClick={() => openReel(it)} size="sm" variant="outline" data-testid={`idea-use-reel-${i}`}
                            className="rounded-lg h-8 text-xs">
                            <Video className="w-3.5 h-3.5 mr-1.5" /> Hacer Reel
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
