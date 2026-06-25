import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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

export default function MarketingStart() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const firstName = (user?.business_name || "").trim() || t("marketingStart.businessFallback");
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
      toast.success(t("marketingStart.industrySaved"));
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("marketingStart.industrySaveError"));
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
        language: i18n.language?.startsWith("en") ? "en" : "es",
      });
      setIdeas(data.ideas || []);
      if (!data.ideas?.length) toast.error(t("marketingStart.noIdeas"));
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("marketingStart.ideasError"));
      setIdeasOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const openPost = (idea) => navigate(`/marketing?mode=image&brief=${encodeURIComponent(idea.idea || idea.title)}`);
  const openReel = (idea) => navigate(`/marketing?mode=reel&brief=${encodeURIComponent(idea.idea || idea.title)}`);
  const openAi = (idea) => navigate(`/marketing?mode=ai&imgprompt=${encodeURIComponent(idea.image_prompt || idea.idea || idea.title)}&brief=${encodeURIComponent(idea.idea || idea.title)}`);

  return (
    <div className="space-y-4 pb-10" data-testid="marketing-start">
      {/* Hero / welcome — compact banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white p-4">
        <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-none">
            <Megaphone className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h1 className="font-heading text-lg sm:text-xl font-bold leading-tight">
              {t("marketingStart.heroTitle", { name: firstName })} {t("marketingStart.heroTitle2")}
            </h1>
            <p className="text-emerald-50/90 text-xs mt-0.5 line-clamp-2">
              {t("marketingStart.heroSubtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* Optional context */}
      <Card className="p-5 border-0 shadow-sm space-y-4">
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">{t("marketingStart.specialToday")}</Label>
          <Input
            data-testid="extra-context-input"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder={t("marketingStart.specialPlaceholder")}
            className="mt-2 rounded-xl"
          />
          <p className="text-[11px] text-slate-400 mt-1">{t("marketingStart.specialHint")}</p>
        </div>

        {/* Industry selector (only when not set yet, or when changing it) */}
        {showIndustry ? (
          <div data-testid="industry-selector">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" /> {t("marketingStart.industryQuestion")}
            </Label>
            <p className="text-[11px] text-slate-400 mt-0.5 mb-2">{t("marketingStart.industryHint")}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {t("marketingStart.industries", { returnObjects: true }).map((ind) => (
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
                placeholder={t("marketingStart.industryOther")}
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
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">{t("marketingStart.chooseTheme")}</Label>
              {businessType && (
                <button onClick={() => setShowIndustry(true)} data-testid="change-industry-btn" className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 tap">
                  {businessType} · {t("marketingStart.change")}
                </button>
              )}
            </div>
            {loadingTopics ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-4" data-testid="topics-loading">
                <Loader2 className="w-4 h-4 animate-spin" /> {t("marketingStart.loadingThemes")}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-2" data-testid="topics-grid">
                {topics.map((tp, i) => {
                  const Icon = CAT_ICON[tp.category] || Lightbulb;
                  const active = activeCat === tp.label;
                  return (
                    <button
                      key={i}
                      onClick={() => getIdeas(tp.category, tp.label)}
                      data-testid={`topic-${i}`}
                      title={t(`marketingStart.catLabels.${tp.category}`)}
                      className={`flex items-center gap-2 px-3 py-3 rounded-2xl border text-left text-sm font-semibold tap transition-all ${
                        active ? "border-emerald-500 ring-2 ring-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 hover:border-emerald-300 text-slate-700"
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-none text-emerald-600" />
                      <span className="leading-tight">{tp.label}</span>
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
          {t("marketingStart.surprise")}
        </Button>

        <button
          onClick={() => navigate("/marketing")}
          data-testid="skip-to-studio"
          className="w-full text-center text-xs font-bold text-slate-400 hover:text-slate-600 tap flex items-center justify-center gap-1.5"
        >
          {t("marketingStart.skipToStudio")} <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </Card>

      {/* Ideas — slide-up drawer: shows "preparando…" then the ideas, no scroll needed */}
      <Drawer open={ideasOpen} onOpenChange={setIdeasOpen}>
        <DrawerContent data-testid="ideas-drawer" className="max-h-[88vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-heading flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              {loading ? t("marketingStart.preparingIdeasShort") : t("marketingStart.ideasForYou")}
              {!loading && activeCat && activeCat !== "all" && (
                <span className="text-xs font-semibold text-slate-400">· {activeCat}</span>
              )}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8 overflow-y-auto max-w-lg mx-auto w-full" data-testid="ideas-drawer-body">
            {loading && (
              <div className="flex flex-col items-center justify-center py-14 text-center" data-testid="ideas-loading">
                <Loader2 className="w-9 h-9 animate-spin text-emerald-600 mb-3" />
                <p className="text-sm font-semibold text-slate-600">{t("marketingStart.preparingIdeasBody")}</p>
                <p className="text-xs text-slate-400 mt-1">{t("marketingStart.giveSeconds")}</p>
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
                            <span><b>{t("marketingStart.takeThis")}</b> {it.photo_tip}</span>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Button onClick={() => openPost(it)} size="sm" data-testid={`idea-use-post-${i}`}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 h-8 text-xs">
                            <ImagePlus className="w-3.5 h-3.5 mr-1.5" /> {t("marketingStart.useInPost")}
                          </Button>
                          <Button onClick={() => openAi(it)} size="sm" variant="outline" data-testid={`idea-use-ai-${i}`}
                            className="rounded-lg h-8 text-xs border-violet-300 text-violet-700 hover:bg-violet-50">
                            <Wand2 className="w-3.5 h-3.5 mr-1.5" /> {t("marketingStart.createAiImage")}
                          </Button>
                          <Button onClick={() => openReel(it)} size="sm" variant="outline" data-testid={`idea-use-reel-${i}`}
                            className="rounded-lg h-8 text-xs">
                            <Video className="w-3.5 h-3.5 mr-1.5" /> {t("marketingStart.makeReel")}
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
