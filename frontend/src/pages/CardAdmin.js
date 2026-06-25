/**
 * Smart Card admin page: customize, QR, analytics, reviews, social posts.
 */
import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  IdCard, QrCode, Copy, ExternalLink, Eye, Plus, Trash2, Loader2,
  Star, Sparkles, BarChart3, Download, Share2, ShieldCheck, BadgeCheck,
  Image as ImageIcon, Upload, X as XIcon, Camera,
  Phone, MessageSquare, Send, Mail, Globe, Save, Brain,
  Sprout, Hammer, PaintBucket, Wind, Wrench, Home, ChevronDown, Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import TourButton from "@/components/TourButton";
import SmartCardPaywall from "@/components/SmartCardPaywall";
import { AiTranslateButton } from "@/components/AiTranslateButton";
import { PhoneFrame, LiveCardPreview } from "@/components/LiveCardPreview";
import { useTranslation } from "react-i18next";

const SERVICE_TEMPLATES = [
  { name: "Roofing", icon: "🏠", description: "Repairs, replacements, inspections." },
  { name: "Drywall", icon: "🧱", description: "Repair, install, texture, paint." },
  { name: "Painting", icon: "🎨", description: "Interior & exterior painting." },
  { name: "Concrete", icon: "🪨", description: "Driveways, patios, foundations." },
  { name: "Cleaning", icon: "🧼", description: "Residential and commercial." },
  { name: "Landscaping", icon: "🌿", description: "Lawn, design, maintenance." },
];

// Curated brand + accent palettes (premium, hand-tuned, no muddy AI defaults).
const BRAND_PRESETS = [
  { name: "Midnight", brand: "#1E3A8A", accent: "#10B981" },
  { name: "Obsidian", brand: "#0F172A", accent: "#F59E0B" },
  { name: "Ember", brand: "#7C2D12", accent: "#F97316" },
  { name: "Forest", brand: "#064E3B", accent: "#84CC16" },
  { name: "Royal", brand: "#4C1D95", accent: "#F472B6" },
  { name: "Steel", brand: "#334155", accent: "#22D3EE" },
  { name: "Crimson", brand: "#7F1D1D", accent: "#FBBF24" },
  { name: "Slate", brand: "#1F2937", accent: "#34D399" },
];

const ACCENT_PRESETS = [
  "#10B981", "#34D399", "#22D3EE", "#0EA5E9", "#3B82F6", "#6366F1",
  "#A855F7", "#F472B6", "#F43F5E", "#F97316", "#F59E0B", "#FBBF24",
  "#84CC16", "#FFFFFF",
];

// Collapsible "Ver opciones avanzadas" wrapper used inside each step.
function Advanced({ children, label, testid }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const lbl = label || t("cardAdmin.showAdvanced");
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="pt-1">
      <CollapsibleTrigger asChild>
        <button data-testid={testid || "btn-opciones-avanzadas"} className="tap w-full flex items-center justify-between rounded-xl bg-slate-50 hover:bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors">
          {open ? t("cardAdmin.hideAdvanced") : lbl}
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

// Numbered step header shown inside each accordion trigger.
function StepBadge({ n }) {
  return (
    <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center flex-none">{n}</span>
  );
}

export default function CardAdmin() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("design");
  const [card, setCard] = useState(null);
  const [saving, setSaving] = useState(false);
  const [analytics, setAnalytics] = useState({ totals: {}, all_events: 0, leads: 0, reviews: 0 });
  const [reviews, setReviews] = useState([]);
  const [leads, setLeads] = useState([]);
  // Multi-card state
  const [cards, setCards] = useState([]);
  const [activeCardId, setActiveCardId] = useState(null);
  const [cardMeta, setCardMeta] = useState({ limit: 1, count: 0, can_add: false });
  const [creating, setCreating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const { user } = useAuth();

  const baseUrl = window.location.origin;
  const publicUrl = card ? `${baseUrl}/c/${card.slug}` : "";

  const loadCards = async () => {
    const { data } = await api.get("/card/list");
    setCards(data.cards || []);
    setCardMeta({ limit: data.limit, count: data.count, can_add: data.can_add });
    return data.cards || [];
  };

  const load = async (cardId = activeCardId) => {
    const list = await loadCards();
    // Pick the active card: keep current if still exists, else primary.
    let id = cardId;
    if (!id || !list.find((c) => c.id === id)) {
      id = (list.find((c) => c.is_primary) || list[0] || {}).id;
    }
    setActiveCardId(id);
    const q = id ? `?card_id=${id}` : "";
    const [c, a, r, l] = await Promise.all([
      api.get(`/card/settings${q}`),
      api.get(`/card/analytics${q}`),
      api.get("/card/reviews"),
      api.get("/card/leads"),
    ]);
    setCard(c.data);
    setAnalytics(a.data);
    setReviews(r.data);
    setLeads(l.data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const switchCard = async (id) => {
    setActiveCardId(id);
    setCard(null);
    await load(id);
  };

  const createCard = async () => {
    setCreating(true);
    try {
      const { data } = await api.post("/card", { label: t("cardAdmin.newCardLabel"), person_name: "" });
      toast.success(t("cardAdmin.cardCreated"));
      await load(data.id);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t("cardAdmin.cardCreateError"));
    } finally { setCreating(false); }
  };

  const deleteCard = async () => {
    if (!card || card.is_primary) return;
    if (!window.confirm(t("cardAdmin.deleteCardConfirm", { name: card.label || card.slug }))) return;
    try {
      await api.delete(`/card/${card.id}`);
      toast.success(t("cardAdmin.cardDeleted"));
      await load(null);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t("cardAdmin.deleteError"));
    }
  };

  const update = (k, v) => setCard({ ...card, [k]: v });

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put(`/card/settings?card_id=${card.id}`, card);
      setCard(data);
      await loadCards();
      toast.success(t("cardAdmin.cardUpdated"));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t("cardAdmin.error"));
    } finally { setSaving(false); }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(publicUrl);
    toast.success(t("cardAdmin.linkCopied"));
  };

  const shareCard = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: t("cardAdmin.myCard"), url: publicUrl }); } catch {}
    } else {
      copyLink();
    }
  };

  if (!card) return <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  // Paywall: Smart Card is gated until the user has a PAID subscription
  // (post-trial). Per user requirement: trial unlocks everything except the
  // Smart Card / physical NFC card.
  if (!user?.smart_card_unlocked) {
    return (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
              <IdCard className="w-7 h-7 text-emerald-600" /> {t("cardAdmin.title")}
            </h1>
            <p className="text-slate-500 mt-1">{t("cardAdmin.subtitle")}</p>
          </div>
        </div>
        <SmartCardPaywall user={user} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 whitespace-nowrap">
          <IdCard className="w-6 h-6 text-emerald-600 flex-none" /> {t("cardAdmin.title")}
        </h1>
        <p className="text-slate-500">{t("cardAdmin.subtitle")}</p>
        <div>
          <TourButton tourKey="card" />
        </div>
      </div>

      {/* Multi-card selector */}
      <Card className="card-elevated p-3 border-0 shadow-none" data-testid="card-selector">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {t("cardAdmin.yourCards", { count: cardMeta.count, limit: cardMeta.limit })}
          </div>
          <Button
            onClick={createCard}
            disabled={creating || !cardMeta.can_add}
            data-testid="card-new-btn"
            size="sm"
            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 h-9"
            title={cardMeta.can_add ? t("cardAdmin.createNewTooltip") : t("cardAdmin.limitReachedTooltip")}
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" /> {t("cardAdmin.newCard")}</>}
          </Button>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {cards.map((c) => (
            <button
              key={c.id}
              onClick={() => switchCard(c.id)}
              data-testid={`card-chip-${c.id}`}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border tap transition-all ${
                c.id === activeCardId ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500" : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <IdCard className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-800 whitespace-nowrap">{c.label}</span>
              {c.is_primary && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{t("cardAdmin.primary")}</span>}
            </button>
          ))}
        </div>
        {!cardMeta.can_add && (
          <p className="text-[11px] text-slate-400 mt-2">
            {t("cardAdmin.limitNote", { limit: cardMeta.limit, s: cardMeta.limit !== 1 ? "s" : "" })}
          </p>
        )}
      </Card>

      {/* Quick share strip */}
      <Card className="card-elevated p-4 border-0 shadow-none">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center flex-shrink-0">
            <Share2 className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{t("cardAdmin.yourLink")}</div>
            <div className="font-semibold text-sm truncate" data-testid="card-public-url">{publicUrl}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button onClick={copyLink} data-testid="card-copy-link" variant="outline" className="h-11 rounded-xl"><Copy className="w-4 h-4 mr-1" /> {t("cardAdmin.copy")}</Button>
          <Button onClick={shareCard} data-testid="card-share" variant="outline" className="h-11 rounded-xl"><Share2 className="w-4 h-4 mr-1" /> {t("cardAdmin.share")}</Button>
          <a href={publicUrl} target="_blank" rel="noreferrer" data-testid="card-preview">
            <Button variant="outline" className="h-11 rounded-xl w-full"><Eye className="w-4 h-4 mr-1" /> {t("cardAdmin.view")}</Button>
          </a>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 rounded-xl bg-slate-100 p-1 h-auto gap-0.5">
          <TabsTrigger value="design" className="rounded-lg text-[11px] lg:text-xs px-1 py-2" data-testid="card-tab-design">{t("cardAdmin.tabDesign")}</TabsTrigger>
          <TabsTrigger value="qr" className="rounded-lg text-[11px] lg:text-xs px-1 py-2" data-testid="card-tab-qr">{t("cardAdmin.tabQr")}</TabsTrigger>
          <TabsTrigger value="reviews" className="rounded-lg text-[11px] lg:text-xs px-1 py-2" data-testid="card-tab-reviews">{t("cardAdmin.tabReviews")}</TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-lg text-[11px] lg:text-xs px-1 py-2" data-testid="card-tab-analytics">{t("cardAdmin.tabAnalytics")}</TabsTrigger>
        </TabsList>

        <TabsContent value="design" className="mt-4">
          {/* Sticky "see preview" button — always reachable while editing */}
          <div className="sticky top-2 z-30 mb-3">
            <Button data-testid="btn-vista-previa" onClick={() => setPreviewOpen(true)}
              className="w-full h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold gap-2 shadow-lg">
              <Smartphone className="w-5 h-5" /> {t("cardAdmin.seeProgress")}
            </Button>
          </div>

          {/* Per-card note + delete */}
          <div className="flex items-start justify-between gap-2 mb-3 px-1">
            <p className="text-xs text-slate-500 leading-relaxed">
              {card.is_primary
                ? t("cardAdmin.primaryNote")
                : t("cardAdmin.secondaryNote")}
            </p>
            {!card.is_primary && (
              <Button onClick={deleteCard} data-testid="card-delete-btn" variant="outline" size="sm" className="h-9 rounded-lg text-red-600 border-red-200 flex-none">
                <Trash2 className="w-4 h-4 mr-1" /> {t("cardAdmin.delete")}
              </Button>
            )}
          </div>

          <Accordion type="single" collapsible defaultValue="step1" className="space-y-3">
            {/* ===== Paso 1: Fotos y color ===== */}
            <AccordionItem value="step1" data-testid="step-fotos" className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <StepBadge n={1} />
                  <div>
                    <div className="font-heading font-bold text-base text-slate-900">{t("cardAdmin.step1Title")}</div>
                    <div className="text-xs text-slate-500 font-normal">{t("cardAdmin.step1Sub")}</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-5 pt-1 space-y-4">
                <HeroLayoutPicker card={card} user={user} onChange={(v) => update("hero_layout", v)} />
                <LogoUploader card={card} onChange={load} />
                <ProfilePhotoUploader card={card} onChange={load} heroLayout={card.hero_layout} />
                <CoverPhotoUploader card={card} onChange={load} />
                <div>
                  <Label>{t("cardAdmin.businessColor")}</Label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {BRAND_PRESETS.map((p) => {
                      const active = (card.brand_color || "").toLowerCase() === p.brand.toLowerCase();
                      return (
                        <button
                          key={p.name}
                          type="button"
                          data-testid={`brand-preset-${p.name.toLowerCase()}`}
                          onClick={() => { update("brand_color", p.brand); update("accent_color", p.accent); }}
                          className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border tap text-[11px] font-semibold transition-all ${active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"}`}
                        >
                          <span className="w-3.5 h-3.5 rounded-full border border-white/50 shadow-sm" style={{ background: p.brand }} />
                          <span className="w-3.5 h-3.5 rounded-full border border-white/50 shadow-sm -ml-2" style={{ background: p.accent }} />
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">{t("cardAdmin.businessColorHint")}</p>
                </div>

                <Advanced testid="adv-step1">
                  <IndustryTemplatePicker card={card} onApply={async (tpl) => {
                    const payload = {
                      brand_color: tpl.brand,
                      accent_color: tpl.accent,
                      hero_layout: tpl.hero_layout || "logo_circle",
                    };
                    if (tpl.business_type && !card.business_type) payload.business_type = tpl.business_type;
                    try {
                      const { data } = await api.put(`/card/settings?card_id=${card.id}`, payload);
                      setCard(data);
                      toast.success(t("cardAdmin.templateApplied", { label: tpl.label }), { description: tpl.hint, duration: 4500 });
                    } catch (err) {
                      toast.error(err?.response?.data?.detail || t("cardAdmin.templateError"));
                    }
                  }} />
                  <div>
                    <Label>{t("cardAdmin.exactBrandColor")}</Label>
                    <div className="flex items-center gap-3 mt-1.5">
                      <input type="color" data-testid="card-color" value={card.brand_color} onChange={(e) => update("brand_color", e.target.value)} className="w-14 h-12 rounded-xl border border-slate-200 cursor-pointer" />
                      <Input value={card.brand_color} onChange={(e) => update("brand_color", e.target.value)} className="h-12 rounded-xl flex-1 font-mono" />
                    </div>
                  </div>
                  <div>
                    <Label>{t("cardAdmin.accentColor")}</Label>
                    <div className="flex items-center gap-3 mt-1.5">
                      <input type="color" data-testid="card-accent-color" value={card.accent_color || "#10B981"} onChange={(e) => update("accent_color", e.target.value)} className="w-14 h-12 rounded-xl border border-slate-200 cursor-pointer" />
                      <Input value={card.accent_color || "#10B981"} onChange={(e) => update("accent_color", e.target.value)} className="h-12 rounded-xl flex-1 font-mono" />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {ACCENT_PRESETS.map((c) => {
                        const active = (card.accent_color || "").toLowerCase() === c.toLowerCase();
                        return (
                          <button key={c} type="button" data-testid={`accent-preset-${c.replace("#", "")}`} onClick={() => update("accent_color", c)} style={{ background: c }}
                            className={`w-8 h-8 rounded-full border-2 tap transition-transform ${active ? "border-slate-900 scale-110 ring-2 ring-offset-2 ring-slate-900" : "border-white shadow-sm hover:scale-105"}`} aria-label={`Accent ${c}`} />
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label>{t("cardAdmin.bgDarkness")}</Label>
                      <span className="text-[11px] font-mono text-slate-500 tabular-nums">{card.hero_overlay ?? 60}%</span>
                    </div>
                    <input type="range" min="0" max="100" step="5" data-testid="card-hero-overlay" value={card.hero_overlay ?? 60} onChange={(e) => update("hero_overlay", Number(e.target.value))} className="w-full mt-2 accent-slate-900" />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>{t("cardAdmin.bgPhotoClear")}</span><span>{t("cardAdmin.bgTextReadable")}</span><span>{t("cardAdmin.bgVeryDark")}</span>
                    </div>
                  </div>
                </Advanced>
              </AccordionContent>
            </AccordionItem>

            {/* ===== Paso 2: Tu información ===== */}
            <AccordionItem value="step2" data-testid="step-info" className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <StepBadge n={2} />
                  <div>
                    <div className="font-heading font-bold text-base text-slate-900">{t("cardAdmin.step2Title")}</div>
                    <div className="text-xs text-slate-500 font-normal">{t("cardAdmin.step2Sub")}</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-5 pt-1 space-y-4">
                <div>
                  <Label>{t("cardAdmin.displayName")}</Label>
                  <Input data-testid="card-person-name" value={card.person_name || ""} onChange={(e) => update("person_name", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder="Ej: Juan Pérez" />
                </div>
                <div>
                  <Label>{t("cardAdmin.yourPhone")}</Label>
                  <Input data-testid="card-contact-phone" value={card.contact_phone || ""} onChange={(e) => update("contact_phone", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder="+1 305 555 1234" />
                </div>
                <div>
                  <Label>{t("cardAdmin.whatYouDo")}</Label>
                  <Input data-testid="card-businesstype" value={card.business_type} onChange={(e) => update("business_type", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder={t("cardAdmin.whatYouDoPh")} />
                </div>

                <Advanced testid="adv-step2">
                  <div>
                    <Label>{t("cardAdmin.internalName")}</Label>
                    <Input data-testid="card-label" value={card.label || ""} onChange={(e) => update("label", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder={t("cardAdmin.internalNamePh")} />
                    <p className="text-[11px] text-slate-400 mt-1">{t("cardAdmin.internalNameHint")}</p>
                  </div>
                  <div>
                    <Label>{t("cardAdmin.yourEmail")}</Label>
                    <Input data-testid="card-contact-email" value={card.contact_email || ""} onChange={(e) => update("contact_email", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder="juan@empresa.com" />
                    <p className="text-[11px] text-slate-400 mt-1">{t("cardAdmin.yourEmailHint")}</p>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label>{t("cardAdmin.tagline")}</Label>
                      <AiTranslateButton fieldType="tagline" businessType={card.business_type} onResult={(en) => update("tagline", en)} testId="ai-tagline" placeholder={t("cardAdmin.taglineAiPh")} />
                    </div>
                    <Input data-testid="card-tagline" value={card.tagline} onChange={(e) => update("tagline", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder="Trusted Roofing Experts in Houston" />
                    <p className="text-[11px] text-slate-400 mt-1">{t("cardAdmin.taglineHint")}</p>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label>{t("cardAdmin.roleTitle")}</Label>
                      <AiTranslateButton fieldType="role" businessType={card.business_type} onResult={(en) => update("role", en)} testId="ai-role" placeholder={t("cardAdmin.roleAiPh")} />
                    </div>
                    <Input data-testid="card-role" value={card.role || ""} onChange={(e) => update("role", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder="Owner & Lead Contractor" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label>{t("cardAdmin.aboutBusiness")}</Label>
                      <AiTranslateButton fieldType="about" businessType={card.business_type} onResult={(en) => update("about_me", en)} testId="ai-about" placeholder={t("cardAdmin.aboutAiPh")} />
                    </div>
                    <Textarea data-testid="card-about" value={card.about_me || ""} onChange={(e) => update("about_me", e.target.value)} className="rounded-xl mt-1.5 min-h-[100px]" placeholder="With over 10 years of experience, we deliver quality work on every project..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>{t("cardAdmin.yearsInBusiness")}</Label>
                      <Input type="number" data-testid="card-years" value={card.years_in_business} onChange={(e) => update("years_in_business", Number(e.target.value) || 0)} className="h-12 rounded-xl mt-1.5" />
                    </div>
                    <div>
                      <Label>{t("cardAdmin.hours")}</Label>
                      <Input data-testid="card-hours" value={card.hours} onChange={(e) => update("hours", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder={t("cardAdmin.hoursPh")} />
                    </div>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label>{t("cardAdmin.serviceArea")}</Label>
                      <AiTranslateButton fieldType="service_area" businessType={card.business_type} onResult={(en) => update("service_area", en)} testId="ai-area" placeholder={t("cardAdmin.serviceAreaAiPh")} />
                    </div>
                    <Input data-testid="card-area" value={card.service_area} onChange={(e) => update("service_area", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder="Houston, TX and surrounding areas" />
                  </div>
                </Advanced>
              </AccordionContent>
            </AccordionItem>

            {/* ===== Paso 3: Servicios ===== */}
            <AccordionItem value="step3" data-testid="step-servicios" className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <StepBadge n={3} />
                  <div>
                    <div className="font-heading font-bold text-base text-slate-900">{t("cardAdmin.step3Title")}</div>
                    <div className="text-xs text-slate-500 font-normal">{t("cardAdmin.step3Sub")}</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-5 pt-1 space-y-3">
                <div className="flex justify-end">
                  <Button size="sm" data-testid="card-add-service" onClick={() => update("services", [...(card.services || []), { name: "", description: "", starting_price: "", icon: "" }])} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="w-3 h-3 mr-1" /> {t("cardAdmin.addService")}
                  </Button>
                </div>
                {(card.services || []).length === 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">{t("cardAdmin.tapToAdd")}</p>
                    <div className="flex flex-wrap gap-2">
                      {SERVICE_TEMPLATES.map((s) => (
                        <button key={s.name} onClick={() => update("services", [...(card.services || []), s])} className="px-3 py-2 rounded-full bg-slate-100 text-xs font-semibold tap">
                          {s.icon} {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {(card.services || []).map((s, i) => (
                  <div key={i} className="rounded-xl bg-slate-50 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold tracking-[0.18em] text-slate-400 w-6">{String(i + 1).padStart(2, "0")}</span>
                      <Input value={s.name} onChange={(e) => { const arr = [...card.services]; arr[i] = { ...arr[i], name: e.target.value }; update("services", arr); }} placeholder={t("cardAdmin.serviceNamePh")} className="flex-1 h-11 rounded-xl bg-white" />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
                      <span className="text-[11px] font-semibold text-slate-500">{t("cardAdmin.description")}</span>
                      <AiTranslateButton fieldType="service" businessType={card.business_type} onResult={(en) => { const arr = [...card.services]; arr[i] = { ...arr[i], description: en }; update("services", arr); }} testId={`ai-service-${i}`} placeholder={t("cardAdmin.serviceAiPh")} />
                    </div>
                    <Input value={s.description} onChange={(e) => { const arr = [...card.services]; arr[i] = { ...arr[i], description: e.target.value }; update("services", arr); }} placeholder={t("cardAdmin.shortDescPh")} className="h-11 rounded-xl bg-white" />
                    <div className="flex gap-2">
                      <Input value={s.starting_price} onChange={(e) => { const arr = [...card.services]; arr[i] = { ...arr[i], starting_price: e.target.value }; update("services", arr); }} placeholder={t("cardAdmin.fromPricePh")} className="h-11 rounded-xl bg-white flex-1" />
                      <Input value={s.icon} onChange={(e) => { const arr = [...card.services]; arr[i] = { ...arr[i], icon: e.target.value }; update("services", arr); }} placeholder="🔨 opt" className="w-20 h-11 rounded-xl bg-white text-center" maxLength={2} />
                      <button type="button" onClick={() => update("services", card.services.filter((_, idx) => idx !== i))} className="w-11 h-11 rounded-xl bg-white border border-red-200 text-red-600 flex items-center justify-center flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>

            {/* ===== Paso 4: Contacto y redes ===== */}
            <AccordionItem value="step4" data-testid="step-contacto" className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <StepBadge n={4} />
                  <div>
                    <div className="font-heading font-bold text-base text-slate-900">{t("cardAdmin.step4Title")}</div>
                    <div className="text-xs text-slate-500 font-normal">{t("cardAdmin.step4Sub")}</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-5 pt-1 space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                  <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-600" /> <span className="font-medium text-sm">{t("cardAdmin.iHaveLicense")}</span></div>
                  <Switch data-testid="card-licensed" checked={card.is_licensed} onCheckedChange={(v) => update("is_licensed", v)} />
                </div>
                {card.is_licensed && (
                  <Input value={card.license_number} onChange={(e) => update("license_number", e.target.value)} placeholder={t("cardAdmin.licenseNumberPh")} className="h-11 rounded-xl" />
                )}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                  <div className="flex items-center gap-2"><BadgeCheck className="w-5 h-5 text-blue-700" /> <span className="font-medium text-sm">{t("cardAdmin.iHaveInsurance")}</span></div>
                  <Switch data-testid="card-insured" checked={card.is_insured} onCheckedChange={(v) => update("is_insured", v)} />
                </div>
                <div>
                  <Label>{t("cardAdmin.whatsapp")}</Label>
                  <Input data-testid="card-whatsapp" value={card.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder="+15551234567" />
                </div>
                <div>
                  <Label>{t("cardAdmin.googleReviewLink")}</Label>
                  <Input value={card.google_review_url} onChange={(e) => update("google_review_url", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder="https://g.page/r/..." />
                </div>
                <Advanced testid="adv-step4">
                  <div>
                    <Label>{t("cardAdmin.website")}</Label>
                    <Input value={card.website} onChange={(e) => update("website", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder="https://..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>{t("cardAdmin.facebook")}</Label>
                      <Input value={card.facebook} onChange={(e) => update("facebook", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder={t("cardAdmin.urlPh")} />
                    </div>
                    <div>
                      <Label>{t("cardAdmin.instagram")}</Label>
                      <Input value={card.instagram} onChange={(e) => update("instagram", e.target.value)} className="h-12 rounded-xl mt-1.5" placeholder={t("cardAdmin.urlPh")} />
                    </div>
                  </div>
                </Advanced>
              </AccordionContent>
            </AccordionItem>

            {/* ===== Botones de la tarjeta y Citas ===== */}
            <AccordionItem value="step-appt" data-testid="step-appt" className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-none font-bold">📅</div>
                  <div>
                    <div className="font-heading font-bold text-sm">Botones y Citas</div>
                    <div className="text-xs text-slate-500">Activa/desactiva botones y agenda online</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-5 pt-1 space-y-3">
                {[
                  { k: "lets_connect_enabled", label: "Let's connect", desc: "Botón de contacto rápido", def: true },
                  { k: "request_estimate_enabled", label: "Request a free estimate", desc: "Formulario de cotización", def: true },
                  { k: "appt_enabled", label: "Schedule Appointment", desc: "Reserva de citas online", def: false },
                ].map((row) => (
                  <div key={row.k} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">{row.label}</div>
                      <div className="text-xs text-slate-500">{row.desc}</div>
                    </div>
                    <Switch data-testid={`toggle-${row.k}`} checked={card[row.k] ?? row.def} onCheckedChange={(v) => update(row.k, v)} />
                  </div>
                ))}

                {(card.appt_enabled ?? false) && (
                  <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-3 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Tu disponibilidad</div>
                    <div>
                      <div className="text-xs font-semibold text-slate-600 mb-1.5">Días disponibles</div>
                      <div className="flex flex-wrap gap-1.5" data-testid="appt-days">
                        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d, i) => {
                          const days = card.appt_days || [];
                          const on = days.includes(i);
                          return (
                            <button key={i} type="button" data-testid={`appt-day-${i}`}
                              onClick={() => update("appt_days", on ? days.filter((x) => x !== i) : [...days, i].sort())}
                              className={`px-3 py-1.5 rounded-full text-xs font-bold ${on ? "bg-emerald-600 text-white" : "bg-white text-slate-600 border border-slate-200"}`}>
                              {d}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-xs font-semibold text-slate-600 mb-1">Desde</div>
                        <Input type="time" data-testid="appt-start" value={card.appt_start || "09:00"} onChange={(e) => update("appt_start", e.target.value)} className="h-11 rounded-xl" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-600 mb-1">Hasta</div>
                        <Input type="time" data-testid="appt-end" value={card.appt_end || "17:00"} onChange={(e) => update("appt_end", e.target.value)} className="h-11 rounded-xl" />
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-600 mb-1">Duración de cita</div>
                      <div className="flex gap-1.5" data-testid="appt-duration">
                        {[30, 60, 90, 120].map((m) => (
                          <button key={m} type="button" data-testid={`appt-dur-${m}`} onClick={() => update("appt_duration", m)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold ${(card.appt_duration || 60) === m ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200"}`}>
                            {m} min
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400">Las citas se agendan a partir de mañana. Cada reserva aparece en tu Agenda y crea el cliente.</p>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* ===== Paso 5: Asistente IA (avanzado) ===== */}
            <AccordionItem value="step5" data-testid="step-ia" className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <StepBadge n={5} />
                  <div>
                    <div className="font-heading font-bold text-base text-slate-900">{t("cardAdmin.step5Title")}</div>
                    <div className="text-xs text-slate-500 font-normal">{t("cardAdmin.step5Sub")}</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-5 pt-1 space-y-4">
                <div className="rounded-2xl border-2 border-violet-200 bg-violet-50/50 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
                      <Brain className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <Label className="text-base font-bold">{t("cardAdmin.aiKnowledge")}</Label>
                      <p className="text-[11px] text-slate-500">{t("cardAdmin.aiKnowledgeNote")}</p>
                    </div>
                  </div>
                  <Textarea
                    data-testid="card-ai-context"
                    value={card.ai_context || ""}
                    onChange={(e) => update("ai_context", e.target.value)}
                    className="rounded-xl min-h-[180px] bg-white"
                    placeholder={t("cardAdmin.aiContextPh")}
                  />
                  <p className="text-[11px] text-slate-500">{t("cardAdmin.aiContextTip")}</p>
                </div>
                <div>
                  <Label>{t("cardAdmin.customLink")}</Label>
                  <div className="flex items-center mt-1.5">
                    <span className="text-sm text-slate-500 mr-1 flex-none max-w-[45%] truncate">{baseUrl}/c/</span>
                    <Input data-testid="card-slug" value={card.slug} onChange={(e) => update("slug", e.target.value)} className="h-12 rounded-xl flex-1 min-w-0" />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Button data-testid="card-save" onClick={save} disabled={saving} className="w-full h-14 rounded-2xl bg-blue-900 hover:bg-blue-950 text-white font-semibold text-base mt-4">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : t("cardAdmin.saveChanges")}
          </Button>

          {/* ===== Live preview sheet ===== */}
          <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
            <SheetContent side="bottom" className="rounded-t-3xl max-h-[92vh] overflow-y-auto" data-testid="sheet-phone-preview">
              <SheetHeader className="text-left">
                <SheetTitle className="font-heading">{t("cardAdmin.cardLooksLike")}</SheetTitle>
              </SheetHeader>
              <div className="mt-3 pb-8 flex flex-col items-center">
                <div className="w-[230px]">
                  <PhoneFrame>
                    <LiveCardPreview card={card} user={user} variant={card.hero_layout || "photo"} />
                  </PhoneFrame>
                </div>
                <Button onClick={() => window.open(publicUrl, "_blank")} className="mt-5 rounded-full bg-slate-900 hover:bg-slate-800 text-white px-5 h-10 gap-1.5">
                  {t("cardAdmin.openMiniSite")} <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </TabsContent>

        <TabsContent value="qr" className="mt-4">
          <Card className="card-elevated p-6 border-0 shadow-none text-center">
            <h3 className="font-heading font-bold text-lg mb-1">{t("cardAdmin.qrTitle")}</h3>
            <p className="text-sm text-slate-500 mb-4">{t("cardAdmin.qrSubtitle")}</p>
            <div className="inline-block p-5 bg-white border-2 rounded-3xl" style={{ borderColor: card.brand_color }}>
              <QRCodeCanvas
                id="card-qr-canvas"
                value={`${publicUrl}?src=qr`}
                size={220}
                fgColor={card.brand_color}
                bgColor="#ffffff"
                level="H"
                includeMargin={false}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <Button
                data-testid="qr-download"
                onClick={() => {
                  const canvas = document.getElementById("card-qr-canvas");
                  const url = canvas.toDataURL("image/png");
                  const a = document.createElement("a");
                  a.href = url; a.download = `qr-${card.slug}.png`; a.click();
                }}
                variant="outline"
                className="h-12 rounded-xl"
              >
                <Download className="w-4 h-4 mr-1" /> {t("cardAdmin.downloadPng")}
              </Button>
              <Button onClick={() => window.open(publicUrl + "?src=qr", "_blank")} variant="outline" className="h-12 rounded-xl">
                <ExternalLink className="w-4 h-4 mr-1" /> {t("cardAdmin.test")}
              </Button>
            </div>
            <div className="mt-6 p-4 bg-slate-50 rounded-xl text-left">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{t("cardAdmin.comingSoon")}</div>
              <p className="text-sm text-slate-700">{t("cardAdmin.comingSoonDesc")}</p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="reviews" className="mt-4 space-y-3">
          <NewReviewForm onCreated={load} />
          {reviews.length === 0 ? (
            <Card className="card-elevated p-8 text-center border-0 shadow-none">
              <Star className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">{t("cardAdmin.noReviews")}</p>
            </Card>
          ) : (
            reviews.map((r) => (
              <Card key={r.id} className="card-elevated p-4 border-0 shadow-none">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold text-sm">{r.customer_name}</div>
                  <button onClick={async () => {
                    if (!window.confirm(t("cardAdmin.deleteReviewConfirm"))) return;
                    await api.delete(`/card/reviews/${r.id}`);
                    load();
                  }} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="flex gap-0.5 mb-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`w-3.5 h-3.5 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                  ))}
                </div>
                <p className="text-sm text-slate-700">{r.text}</p>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="analytics" className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <StatTile label={t("cardAdmin.statVisits")} value={(analytics.totals?.profile_visit || 0)} />
            <StatTile label={t("cardAdmin.statCallClicks")} value={(analytics.totals?.call_click || 0)} />
            <StatTile label={t("cardAdmin.statWhatsappClicks")} value={(analytics.totals?.whatsapp_click || 0)} />
            <StatTile label={t("cardAdmin.statContactsSaved")} value={(analytics.totals?.contact_save || 0)} />
            <StatTile label={t("cardAdmin.statQuotes")} value={analytics.leads} accent="emerald" />
            <StatTile label={t("cardAdmin.statReviews")} value={analytics.reviews} accent="emerald" />
          </div>

          <Card className="card-elevated p-5 border-0 shadow-none">
            <h3 className="font-heading font-bold text-base mb-3 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-900" /> {t("cardAdmin.recentLeads")}
            </h3>
            {leads.length === 0 ? (
              <p className="text-sm text-slate-500">{t("cardAdmin.noLeads")}</p>
            ) : (
              <div className="space-y-2">
                {leads.slice(0, 8).map((l) => (
                  <div key={l.id} className="p-3 rounded-xl bg-slate-50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{l.name}</div>
                        <div className="text-xs text-slate-500">{l.phone || l.email}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {l.card_label && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700" data-testid={`lead-source-${l.id}`}>
                            {l.card_label}
                          </span>
                        )}
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          {l.source || "form"}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">{l.description}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatTile({ label, value, accent }) {
  const cls = accent === "emerald" ? "from-emerald-500 to-emerald-700" : "from-blue-800 to-blue-950";
  return (
    <Card className="card-elevated p-4 border-0 shadow-none">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className={`font-heading text-2xl font-bold mt-1 bg-gradient-to-br ${cls} bg-clip-text text-transparent`}>
        {value}
      </div>
    </Card>
  );
}

function LogoUploader({ card, onChange }) {
  return <AssetUploader card={card} onChange={onChange} kind="logo" />;
}

function ProfilePhotoUploader({ card, onChange, heroLayout }) {
  return <AssetUploader card={card} onChange={onChange} kind="profile_photo" heroLayout={heroLayout} />;
}

function CoverPhotoUploader({ card, onChange }) {
  return <AssetUploader card={card} onChange={onChange} kind="cover" />;
}

// Industry templates — one-tap pre-fill of brand colors, layout and suggested next step.
const INDUSTRY_TEMPLATES = [
  { key: "landscaping", label: "Jardinería", Icon: Sprout,
    brand: "#15803D", accent: "#FACC15", brandDeep: "#052E16",
    business_type: "Landscaping",
    hint: "Sube una foto de un jardín tuyo terminado como foto de fondo.",
  },
  { key: "construction", label: "Construcción", Icon: Hammer,
    brand: "#B91C1C", accent: "#F59E0B", brandDeep: "#3F0A0A",
    business_type: "Construction",
    hint: "Sube una foto de una obra o casa que hayas construido.",
  },
  { key: "roofing", label: "Roofing", Icon: Home,
    brand: "#475569", accent: "#F97316", brandDeep: "#0F172A",
    business_type: "Roofing",
    hint: "Una foto de un techo nuevo se ve perfecta como fondo.",
  },
  { key: "cleaning", label: "Limpieza", Icon: Sparkles,
    brand: "#0E7490", accent: "#FBBF24", brandDeep: "#083344",
    business_type: "Cleaning",
    hint: "Sube una foto de una casa o cocina impecable después de limpiar.",
  },
  { key: "painting", label: "Pintura", Icon: PaintBucket,
    brand: "#2563EB", accent: "#F472B6", brandDeep: "#0C1B4A",
    business_type: "Painting",
    hint: "Una foto de una pared o casa recién pintada se ve genial de fondo.",
  },
  { key: "hvac", label: "HVAC / AC", Icon: Wind,
    brand: "#EA580C", accent: "#10B981", brandDeep: "#431407",
    business_type: "HVAC",
    hint: "Una foto de una unidad de AC nueva o instalada queda perfecto.",
  },
  { key: "plumbing", label: "Plomería", Icon: Wrench,
    brand: "#1D4ED8", accent: "#FBBF24", brandDeep: "#172554",
    business_type: "Plumbing",
    hint: "Una foto del trabajo terminado (baño, lavabo, tubería) funciona bien.",
  },
];

function IndustryTemplatePicker({ card, onApply }) {
  const { t } = useTranslation();
  return (
    <Card className="card-elevated p-5 border-0 shadow-none">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-heading font-bold text-base">{t("cardAdmin.industryTemplates")}</h3>
        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{t("cardAdmin.quickOnboarding")}</span>
      </div>
      <p className="text-xs text-slate-500 mb-3">{t("cardAdmin.industryTemplatesHint")}</p>
      <div className="-mx-1 px-1 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 pb-1" style={{ minWidth: "max-content" }}>
          {INDUSTRY_TEMPLATES.map((tpl) => {
            const tplKey = tpl.key.charAt(0).toUpperCase() + tpl.key.slice(1);
            const label = t(`cardAdmin.tpl${tplKey}`);
            const hint = t(`cardAdmin.tpl${tplKey}Hint`);
            const active =
              (card.brand_color || "").toLowerCase() === tpl.brand.toLowerCase() &&
              (card.accent_color || "").toLowerCase() === tpl.accent.toLowerCase();
            return (
              <button
                key={tpl.key}
                type="button"
                data-testid={`template-${tpl.key}`}
                onClick={() => onApply({ ...tpl, label, hint })}
                className={`flex-shrink-0 w-24 rounded-2xl p-2 border-2 transition-all tap ${
                  active ? "border-slate-900 bg-slate-50 shadow-sm" : "border-slate-100 bg-white hover:border-slate-300"
                }`}
              >
                <div
                  className="aspect-[3/4] rounded-xl flex items-center justify-center relative overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${tpl.brand} 0%, ${tpl.brandDeep} 100%)` }}
                >
                  <div className="absolute inset-0 opacity-30" style={{
                    background: `radial-gradient(ellipse at top right, ${tpl.accent} 0%, transparent 60%)`,
                  }} />
                  <div className="w-10 h-10 rounded-full bg-white/95 flex items-center justify-center shadow-lg relative z-10">
                    <tpl.Icon className="w-5 h-5" style={{ color: tpl.brand }} strokeWidth={2.5} />
                  </div>
                  {active && (
                    <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white flex items-center justify-center shadow">
                      <BadgeCheck className="w-3 h-3 text-slate-900" />
                    </div>
                  )}
                </div>
                <div className="text-[11px] font-bold text-slate-800 mt-1.5 text-center leading-tight">{label}</div>
                <div className="flex items-center justify-center gap-0.5 mt-1">
                  <span className="w-2 h-2 rounded-full border border-white/50 shadow-sm" style={{ background: tpl.brand }} />
                  <span className="w-2 h-2 rounded-full border border-white/50 shadow-sm" style={{ background: tpl.accent }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function HeroLayoutPicker({ card, user, onChange }) {
  const { t } = useTranslation();
  const options = [
    {
      key: "photo",
      label: t("cardAdmin.heroPhotoBig"),
      desc: t("cardAdmin.heroPhotoBigDesc"),
    },
    {
      key: "logo_circle",
      label: t("cardAdmin.heroLogoCircle"),
      desc: t("cardAdmin.heroLogoCircleDesc"),
    },
  ];
  const current = card.hero_layout || "photo";
  return (
    <Card className="card-elevated p-5 border-0 shadow-none">
      <h3 className="font-heading font-bold text-base mb-1">{t("cardAdmin.cardStyle")}</h3>
      <p className="text-xs text-slate-500 mb-3">{t("cardAdmin.cardStyleHint")}</p>
      <div className="grid grid-cols-2 gap-2.5">
        {options.map((o) => {
          const active = current === o.key;
          return (
            <button
              key={o.key}
              type="button"
              data-testid={`hero-layout-${o.key}`}
              onClick={() => onChange(o.key)}
              className={`text-left rounded-2xl p-2 border-2 transition-all tap ${
                active ? "border-blue-900 bg-blue-50/60 shadow-md" : "border-slate-100 bg-white hover:border-slate-300"
              }`}
            >
              <PhoneFrame>
                <LiveCardPreview card={card} user={user} variant={o.key} />
              </PhoneFrame>
              <div className="flex items-center gap-1.5 mt-2">
                {active && <span className="w-1.5 h-1.5 rounded-full bg-blue-900" />}
                <div className={`font-bold text-[13px] ${active ? "text-blue-900" : "text-slate-800"}`}>{o.label}</div>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{o.desc}</div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function AssetUploader({ card, onChange, kind, heroLayout }) {
  const inputRef = useRef(null);
  const enhanceRef = useRef(null);
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState(null); // { original, enhanced }
  const supportsAI = kind === "profile_photo" || kind === "cover";

  const config = kind === "profile_photo"
    ? {
        title: heroLayout === "logo_circle" ? t("cardAdmin.avatarTitle") : t("cardAdmin.ownerPhotoTitle"),
        endpoint: "/card/profile-photo",
        idField: "profile_photo_id",
        helper: heroLayout === "logo_circle"
          ? t("cardAdmin.avatarHelper")
          : t("cardAdmin.ownerPhotoHelper"),
        roundedClass: heroLayout === "logo_circle" ? "rounded-full" : "rounded-3xl",
        size: heroLayout === "logo_circle" ? "w-20 h-20" : "w-24 h-32",
        testid: "profile",
      }
    : kind === "cover"
    ? {
        title: t("cardAdmin.coverTitle"),
        endpoint: "/card/cover-photo",
        idField: "cover_photo_id",
        helper: t("cardAdmin.coverHelper"),
        roundedClass: "rounded-2xl",
        size: "w-28 h-20",
        testid: "cover",
      }
    : {
        title: t("cardAdmin.logoTitle"),
        endpoint: "/card/logo",
        idField: "logo_photo_id",
        helper: t("cardAdmin.logoHelper"),
        roundedClass: "rounded-2xl",
        size: "w-20 h-20",
        testid: "logo",
      };

  const url = card[config.idField]
    ? `${process.env.REACT_APP_BACKEND_URL}/api/public/card/photo/${card[config.idField]}`
    : null;

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`${config.endpoint}?card_id=${card.id}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`${config.title} ${t("cardAdmin.uploaded")}`);
      onChange();
    } catch (err) {
      toast.error(err?.response?.data?.detail || t("cardAdmin.imageUploadError"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const remove = async () => {
    if (!window.confirm(t("cardAdmin.removeConfirm", { title: config.title.toLowerCase() }))) return;
    await api.delete(`${config.endpoint}?card_id=${card.id}`);
    toast.success(t("cardAdmin.removed"));
    onChange();
  };

  const BACKEND = process.env.REACT_APP_BACKEND_URL;

  const handleEnhanceFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnhancing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post(
        `/card/photo-enhance?kind=${kind}&card_id=${card.id}`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 }
      );
      setPreview({
        original: { ...data.original, full: `${BACKEND}${data.original.url}` },
        enhanced: { ...data.enhanced, full: `${BACKEND}${data.enhanced.url}` },
      });
    } catch (err) {
      toast.error(err?.response?.data?.detail || t("cardAdmin.enhanceImgError"));
    } finally {
      setEnhancing(false);
      e.target.value = "";
    }
  };

  const choosePhoto = async (which) => {
    if (!preview) return;
    const chosen = which === "enhanced" ? preview.enhanced : preview.original;
    const discard = which === "enhanced" ? preview.original : preview.enhanced;
    setApplying(true);
    try {
      await api.post(`/card/photo-choose?card_id=${card.id}`, {
        kind,
        photo_id: chosen.photo_id,
        discard_photo_id: discard.photo_id,
      });
      toast.success(which === "enhanced" ? t("cardAdmin.photoEnhancedApplied") : t("cardAdmin.photoOriginalApplied"));
      setPreview(null);
      onChange();
    } catch (err) {
      toast.error(err?.response?.data?.detail || t("cardAdmin.applyError"));
    } finally {
      setApplying(false);
    }
  };

  const Icon = kind === "profile_photo" ? Camera : kind === "cover" ? ImageIcon : ImageIcon;

  return (
    <Card className="card-elevated p-5 border-0 shadow-none">
      <h3 className="font-heading font-bold text-base mb-3 flex items-center gap-2">
        <Icon className="w-5 h-5 text-emerald-600" /> {config.title}
      </h3>
      <div className="flex items-center gap-4">
        <div className="relative">
          {url ? (
            <img
              src={url}
              alt={kind}
              data-testid={`${config.testid}-preview`}
              className={`${config.size} ${config.roundedClass} object-cover border border-slate-200 shadow-sm`}
            />
          ) : (
            <div className={`${config.size} ${config.roundedClass} bg-slate-100 flex items-center justify-center text-slate-400`}>
              <Icon className="w-8 h-8" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 mb-2">{config.helper}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              data-testid={`${config.testid}-upload-btn`}
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
              {url ? t("cardAdmin.change") : t("cardAdmin.upload")}
            </Button>
            {url && (
              <Button
                data-testid={`${config.testid}-remove-btn`}
                size="sm"
                variant="outline"
                onClick={remove}
                className="rounded-xl text-red-600"
              >
                <XIcon className="w-3.5 h-3.5 mr-1" /> {t("cardAdmin.remove")}
              </Button>
            )}
          </div>
          {supportsAI && (
            <Button
              data-testid={`${config.testid}-ai-enhance-btn`}
              size="sm"
              variant="outline"
              onClick={() => enhanceRef.current?.click()}
              disabled={enhancing}
              className="rounded-xl mt-2 border-violet-300 text-violet-700 hover:bg-violet-50"
            >
              {enhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
              {enhancing ? t("cardAdmin.enhancing") : t("cardAdmin.enhanceWithAi")}
            </Button>
          )}
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleFile} />
          {supportsAI && (
            <input ref={enhanceRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleEnhanceFile} />
          )}
        </div>
      </div>

      {/* Before / After AI enhancement dialog */}
      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="rounded-2xl max-w-lg" data-testid={`${config.testid}-ai-dialog`}>
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-600" /> {t("cardAdmin.beforeAfter")}
            </DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">{t("cardAdmin.original")}</div>
                <img src={preview.original.full} alt="original" className="w-full aspect-square object-cover rounded-xl border border-slate-200" />
              </div>
              <div className="text-center">
                <div className="text-xs font-bold uppercase tracking-wider text-violet-600 mb-1.5">{t("cardAdmin.enhanced")}</div>
                <img src={preview.enhanced.full} alt="enhanced" className="w-full aspect-square object-cover rounded-xl border-2 border-violet-400" />
              </div>
            </div>
          )}
          <p className="text-[11px] text-slate-400 text-center">{t("cardAdmin.enhanceNote")}</p>
          <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              data-testid={`${config.testid}-use-original`}
              onClick={() => choosePhoto("original")}
              disabled={applying}
              className="rounded-xl h-11"
            >
              {t("cardAdmin.useOriginal")}
            </Button>
            <Button
              data-testid={`${config.testid}-use-enhanced`}
              onClick={() => choosePhoto("enhanced")}
              disabled={applying}
              className="rounded-xl h-11 bg-violet-600 hover:bg-violet-700"
            >
              {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : t("cardAdmin.useEnhanced")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function NewReviewForm({ onCreated }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customer_name: "", rating: 5, text: "", job_title: "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.customer_name.trim() || !form.text.trim()) return toast.error(t("cardAdmin.missingFields"));
    setSaving(true);
    try {
      await api.post("/card/reviews", form);
      toast.success(t("cardAdmin.reviewAdded"));
      setForm({ customer_name: "", rating: 5, text: "", job_title: "" });
      setOpen(false);
      onCreated();
    } catch {
      toast.error(t("cardAdmin.error"));
    } finally { setSaving(false); }
  };

  if (!open) {
    return (
      <Button data-testid="add-review-btn" onClick={() => setOpen(true)} className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700">
        <Plus className="w-4 h-4 mr-1" /> {t("cardAdmin.addManualReview")}
      </Button>
    );
  }

  return (
    <Card className="card-elevated p-4 border-0 shadow-none space-y-3">
      <Input data-testid="review-name" placeholder={t("cardAdmin.customerNamePh")} value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} className="h-12 rounded-xl" />
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setForm({ ...form, rating: n })} data-testid={`review-star-${n}`} className="tap">
            <Star className={`w-7 h-7 ${n <= form.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
          </button>
        ))}
      </div>
      <Textarea data-testid="review-text" placeholder={t("cardAdmin.reviewTextPh")} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} className="rounded-xl" />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => setOpen(false)} className="h-11 rounded-xl">{t("cardAdmin.cancel")}</Button>
        <Button data-testid="review-save" onClick={save} disabled={saving} className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("cardAdmin.save")}
        </Button>
      </div>
    </Card>
  );
}
