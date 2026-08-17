import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import StatusBadge from "@/components/StatusBadge";
import { generateInvoicePDF } from "@/lib/pdf";
import { ArrowLeft, FileDown, MoreVertical, Plus, Trash2, Loader2, Check, Sparkles, Send, Receipt, Copy, Briefcase, CalendarClock, ChevronDown, Wallet, Wand2, ListTree, Minus } from "lucide-react";
import { toast } from "sonner";
import SendDocumentDialog from "@/components/SendDocumentDialog";
import { listAgreementClauses } from "@/lib/pdf";
import GuidedJobForm from "@/components/GuidedJobForm";

// Allow only digits + a single decimal point (keeps numeric fields freely editable on iOS Safari).
const numClean = (v) => String(v).replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");

// Collapsible section: shows just a header row (title + summary + chevron) until
// tapped. Keeps the invoice editor uncluttered on mobile.
function CollapsibleSection({ icon: Icon, iconColor, title, summary, defaultOpen = false, testId, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="card-elevated p-0 border-0 shadow-none overflow-hidden" data-testid={testId}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 text-left tap"
        data-testid={testId ? `${testId}-toggle` : undefined}
      >
        {Icon && (
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-none ${iconColor || "bg-slate-100 text-slate-600"}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-heading font-bold text-base leading-tight">{title}</h3>
          {summary && <div className="text-xs text-slate-500 truncate mt-0.5">{summary}</div>}
        </div>
        <ChevronDown className={`w-5 h-5 text-slate-400 flex-none transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-5 pb-5 pt-1 space-y-4">{children}</div>}
    </Card>
  );
}


const blank = () => ({
  client_id: "",
  quote_id: null,
  agreement_id: null,
  job_title: "",
  line_items: [],
  subtotal: 0,
  tax_rate: 0,
  tax_amount: 0,
  total: 0,
  amount_paid: 0,
  deposit_amount: 0,
  deposit_paid: false,
  due_date: "",
  notes: "",
  agreement_terms: null,
  status: "draft",
});

// Auto-growing textarea so long line-item descriptions are fully visible & editable
// (no horizontal scrolling on mobile).
function AutoGrowTextarea({ value, onChange, placeholder, className = "", testid }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      data-testid={testid}
      rows={1}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-snug resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 ${className}`}
    />
  );
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const lang = i18n.language?.startsWith("es") ? "es" : "en";
  const [params] = useSearchParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [invoice, setInvoice] = useState(blank());
  const [client, setClient] = useState(null);
  const [saving, setSaving] = useState(false);
  const [aiDescription, setAiDescription] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [builderMode, setBuilderMode] = useState("guided"); // guided | free
  const [detailedItems, setDetailedItems] = useState([]);
  const [summaryItem, setSummaryItem] = useState(null);
  const [breakdownOn, setBreakdownOn] = useState(false);
  const [priceEstimated, setPriceEstimated] = useState(false);
  const [phase, setPhase] = useState("input"); // input (questions) -> draft (review & edit); only for new invoices
  const goDraft = () => { setPhase("draft"); window.scrollTo(0, 0); };

  const applyGuided = (data, detail = "single") => {
    const sum = data.summary_item || { description: data.summary_line || "", quantity: 1, unit: "ea", unit_price: data.total || 0, amount: data.total || 0 };
    const detailed = (data.line_items || []).map((li) => ({
      description: li.description || "", quantity: Number(li.quantity) || 1, unit: li.unit || "ea",
      unit_price: Number(li.unit_price) || 0, amount: Number(li.amount) || 0,
    }));
    const wantBreakdown = detail === "breakdown" && detailed.length > 0;
    setSummaryItem(sum);
    setDetailedItems(detailed);
    setBreakdownOn(wantBreakdown);
    setPriceEstimated(!!data.price_estimated);
    recompute({
      ...invoice,
      job_title: data.job_title || invoice.job_title,
      line_items: wantBreakdown ? detailed : [sum],
      tax_rate: 0,
      deposit_amount: Number(data.deposit_amount) || 0,
      notes: data.notes || invoice.notes,
    });
    goDraft();
  };

  const toggleBreakdown = () => {
    const next = !breakdownOn;
    setBreakdownOn(next);
    const items = next ? (detailedItems.length ? detailedItems : invoice.line_items) : (summaryItem ? [summaryItem] : invoice.line_items);
    recompute({ ...invoice, line_items: items });
  };
  const [sendOpen, setSendOpen] = useState(false);

  const generateWithAI = async () => {
    if (!aiDescription.trim()) return toast.error(t("invoiceDetail.aiErrWrite"));
    setAiLoading(true);
    try {
      const { data } = await api.post("/ai/quote", { description_es: aiDescription, language: lang });
      const lineItems = (data.line_items || []).map((li) => ({
        description: li.description || "",
        quantity: Number(li.quantity) || 1,
        unit: li.unit || "ea",
        unit_price: Number(li.unit_price) || 0,
        amount: Number(li.amount) || (Number(li.quantity) || 1) * (Number(li.unit_price) || 0),
      }));
      const next = {
        ...invoice,
        job_title: data.job_title || invoice.job_title,
        line_items: lineItems,
        tax_rate: Number(data.tax_rate) || invoice.tax_rate,
        notes: data.notes || invoice.notes,
      };
      recompute(next);
      toast.success(t("invoiceDetail.aiOk"));
      goDraft();
    } catch (err) {
      toast.error(err?.response?.data?.detail || t("invoiceDetail.aiError"));
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    api.get("/clients").then((r) => setClients(r.data));
    if (isNew) {
      const presetClient = params.get("client_id") || "";
      setInvoice({ ...blank(), client_id: presetClient });
    } else {
      api.get(`/invoices/${id}`).then(async ({ data }) => {
        setInvoice(data);
        if (data.client_id) {
          try {
            const c = await api.get(`/clients/${data.client_id}`);
            setClient(c.data);
          } catch { setClient(null); }
        } else {
          setClient(null);
        }
      }).catch(() => { toast.error(t("invoiceDetail.notFound")); navigate("/invoices"); });
    }
  }, [id]);

  const updateItem = (i, k, v) => {
    const items = [...invoice.line_items];
    items[i] = { ...items[i], [k]: v };
    items[i].amount = (Number(items[i].quantity) || 0) * (Number(items[i].unit_price) || 0);
    recompute({ ...invoice, line_items: items });
  };
  const addItem = () => recompute({ ...invoice, line_items: [...invoice.line_items, { description: "", quantity: 1, unit: "ea", unit_price: 0, amount: 0 }] });
  const removeItem = (i) => recompute({ ...invoice, line_items: invoice.line_items.filter((_, idx) => idx !== i) });

  const recompute = (next) => {
    const subtotal = next.line_items.reduce((s, li) => s + (Number(li.amount) || 0), 0);
    const tax_amount = subtotal * (Number(next.tax_rate) || 0) / 100;
    const total = subtotal + tax_amount;
    setInvoice({ ...next, subtotal: round2(subtotal), tax_amount: round2(tax_amount), total: round2(total) });
  };
  const round2 = (n) => Math.round(n * 100) / 100;

  const save = async () => {
    if (!invoice.client_id) return toast.error(t("invoiceDetail.selectClientErr"));
    if (!invoice.job_title.trim()) return toast.error(t("invoiceDetail.missingTitle"));
    setSaving(true);
    try {
      // Normalize numeric fields (they're edited as free text for iOS-friendliness).
      const cleanItems = invoice.line_items.map((li) => {
        const q = Number(li.quantity) || 0;
        const p = Number(li.unit_price) || 0;
        return { ...li, quantity: q, unit_price: p, amount: round2(q * p) };
      });
      const subtotal = cleanItems.reduce((s, li) => s + li.amount, 0);
      const tax_amount = subtotal * (Number(invoice.tax_rate) || 0) / 100;
      const payload = {
        ...invoice,
        line_items: cleanItems,
        tax_rate: Number(invoice.tax_rate) || 0,
        deposit_amount: Number(invoice.deposit_amount) || 0,
        subtotal: round2(subtotal),
        tax_amount: round2(tax_amount),
        total: round2(subtotal + tax_amount),
        due_date: invoice.due_date || null,
      };
      if (isNew) {
        const { data } = await api.post("/invoices", payload);
        toast.success(t("invoiceDetail.created"));
        navigate(`/invoices/${data.id}`);
      } else {
        await api.put(`/invoices/${id}`, payload);
        toast.success(t("invoiceDetail.saved"));
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || t("invoiceDetail.error"));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status) => {
    const { data } = await api.post(`/invoices/${id}/status?status=${status}`);
    setInvoice(data);
    toast.success(t("invoiceDetail.statusUpdated"));
  };

  const deleteInvoice = async () => {
    if (!window.confirm(t("invoiceDetail.deleteConfirm", { number: invoice.number }))) return;
    try {
      await api.delete(`/invoices/${id}`);
      toast.success(t("invoiceDetail.deleted"));
      navigate("/invoices");
    } catch {
      toast.error(t("invoiceDetail.deleteError"));
    }
  };

  const downloadPDF = async () => {
    let c = client;
    if (!c && invoice.client_id) {
      try {
        c = (await api.get(`/clients/${invoice.client_id}`)).data;
      } catch { c = null; }
    }
    // Fetch card settings to get logo_photo_id, then merge into user
    let cardSettings = null;
    try { cardSettings = (await api.get("/card/settings")).data; } catch {}
    generateInvoicePDF(invoice, { ...user, logo_photo_id: cardSettings?.logo_photo_id }, c);
  };

  const getInvoicePdfBlob = async () => {
    let c = client;
    if (!c && invoice.client_id) {
      try { c = (await api.get(`/clients/${invoice.client_id}`)).data; } catch { c = null; }
    }
    let cardSettings = null;
    try { cardSettings = (await api.get("/card/settings")).data; } catch {}
    return generateInvoicePDF(invoice, { ...user, logo_photo_id: cardSettings?.logo_photo_id }, c, { returnBlob: true });
  };

  return (
    <div className="space-y-5">
      <button onClick={() => navigate("/invoices")} className="flex items-center gap-2 text-sm text-slate-600 tap" data-testid="back-invoices">
        <ArrowLeft className="w-4 h-4" /> {t("invoiceDetail.back")}
      </button>

      {/* Choose the client on page 1 (before the questions) */}
      {isNew && phase === "input" && (
        <Card className="card-elevated p-5 border-0 shadow-none mb-4">
          <Label>{t("invoiceDetail.client")}</Label>
          <Select value={invoice.client_id} onValueChange={(v) => setInvoice({ ...invoice, client_id: v })}>
            <SelectTrigger className="h-12 rounded-xl mt-1.5" data-testid="inv-client-select-input"><SelectValue placeholder={t("invoiceDetail.selectPlaceholder")} /></SelectTrigger>
            <SelectContent>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Card>
      )}

      {/* AI Generation (only for new invoices, step 1) */}
      {isNew && phase === "input" && (
        <Card className="card-elevated p-5 border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-white shadow-none">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <Label className="text-base font-bold">{t("invoiceDetail.aiTitle")}</Label>
              <p className="text-[11px] text-slate-500">{t("invoiceDetail.aiSubtitle")}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3" data-testid="inv-mode-switch">
            <button type="button" data-testid="inv-mode-guided" onClick={() => setBuilderMode("guided")}
              className={`h-11 rounded-xl text-sm font-bold border-2 flex items-center justify-center gap-1.5 transition-all ${builderMode === "guided" ? "border-violet-500 bg-violet-50 text-violet-800" : "border-slate-200 text-slate-600 bg-white"}`}>
              <Sparkles className="w-4 h-4" /> {lang === "es" ? "Contéstame preguntas" : "Answer questions"}
            </button>
            <button type="button" data-testid="inv-mode-free" onClick={() => setBuilderMode("free")}
              className={`h-11 rounded-xl text-sm font-bold border-2 flex items-center justify-center gap-1.5 transition-all ${builderMode === "free" ? "border-violet-500 bg-violet-50 text-violet-800" : "border-slate-200 text-slate-600 bg-white"}`}>
              <Wand2 className="w-4 h-4" /> {lang === "es" ? "Describir yo mismo" : "Describe it myself"}
            </button>
          </div>

          {builderMode === "guided" && (
            <div className="rounded-xl bg-white p-3">
              <GuidedJobForm lang={lang} onResult={applyGuided} />
            </div>
          )}

          {builderMode === "free" && (
            <>
              <Textarea
                data-testid="inv-ai-description"
                value={aiDescription}
                onChange={(e) => setAiDescription(e.target.value)}
                className="rounded-xl min-h-[100px] bg-white"
                placeholder={t("invoiceDetail.aiPlaceholder")}
              />
              <Button
                data-testid="inv-ai-generate"
                onClick={generateWithAI}
                disabled={aiLoading || !aiDescription.trim()}
                className="mt-3 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 w-full gap-2"
              >
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {aiLoading ? t("invoiceDetail.generating") : t("invoiceDetail.generateBtn")}
              </Button>
            </>
          )}
        </Card>
      )}

      {(!isNew || phase === "draft") && (
      <>
      <Card className="card-elevated p-5 border-0 shadow-none">
        {isNew && phase === "draft" && (
          <button type="button" onClick={() => setPhase("input")} data-testid="inv-back-to-questions" className="mb-3 text-sm font-semibold text-violet-700 hover:text-violet-800 inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> {lang === "es" ? "Volver a las preguntas" : "Back to questions"}
          </button>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {!isNew && <span className="text-sm font-bold text-slate-500">{invoice.number}</span>}
              {!isNew && <StatusBadge kind="invoice" status={invoice.status} />}
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">
              {isNew ? t("invoiceDetail.newInvoice") : invoice.job_title}
            </h1>
          </div>
          {!isNew && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-xl" data-testid="invoice-menu"><MoreVertical className="w-4 h-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem onClick={() => setStatus("sent")}>{t("invoiceDetail.markSent")}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatus("paid")} data-testid="mark-paid"><Check className="w-3 h-3 mr-1" /> {t("invoiceDetail.markPaid")}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatus("partial")}>{t("invoiceDetail.partialPay")}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatus("overdue")}>{t("invoiceDetail.overdue")}</DropdownMenuItem>
                <DropdownMenuItem
                  data-testid="invoice-delete"
                  onClick={deleteInvoice}
                  className="text-red-600 focus:text-red-700 focus:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> {t("invoiceDetail.deleteInvoice")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {!isNew && invoice.status === "draft" && (
          <div className="mt-5">
            <Button
              data-testid="inv-create"
              onClick={() => setStatus("created")}
              className="w-full h-12 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-semibold"
            >
              <Check className="w-4 h-4 mr-1.5" /> {t("invoiceDetail.createInvoice")}
            </Button>
            <p className="text-[11px] text-slate-400 text-center mt-2">
              {t("invoiceDetail.draftHint")}
            </p>
          </div>
        )}

        {!isNew && invoice.status !== "draft" && (
          <div className="grid grid-cols-2 gap-2 mt-5">
            <Button
              data-testid="inv-send"
              onClick={() => {
                if (invoice.status === "created") setStatus("sent");
                setSendOpen(true);
              }}
              className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Send className="w-4 h-4 mr-1" /> {t("invoiceDetail.sendInvoice")}
            </Button>
            <Button data-testid="inv-download-pdf" onClick={downloadPDF} variant="outline" className="h-12 rounded-xl border-slate-200">
              <FileDown className="w-4 h-4 mr-1" /> {t("invoiceDetail.downloadPdf")}
            </Button>
          </div>
        )}
      </Card>

      <Card className="card-elevated p-5 border-0 shadow-none space-y-3">
        <div>
          <Label>{t("invoiceDetail.client")}</Label>
          <Select value={invoice.client_id} onValueChange={(v) => setInvoice({ ...invoice, client_id: v })}>
            <SelectTrigger className="h-12 rounded-xl mt-1.5" data-testid="inv-client-select"><SelectValue placeholder={t("invoiceDetail.selectPlaceholder")} /></SelectTrigger>
            <SelectContent>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Job Title</Label>
          <Input data-testid="inv-title" value={invoice.job_title} onChange={(e) => setInvoice({ ...invoice, job_title: e.target.value })} className="h-12 rounded-xl mt-1.5" />
        </div>
        <div>
          <Label>Due Date</Label>
          <Input type="date" value={invoice.due_date || ""} onChange={(e) => setInvoice({ ...invoice, due_date: e.target.value })} className="h-12 rounded-xl mt-1.5" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Line Items</Label>
            <div className="flex items-center gap-2">
              {detailedItems.length > 0 && (
                <Button data-testid="inv-toggle-breakdown" size="sm" variant="ghost" onClick={toggleBreakdown} className="rounded-xl text-violet-700 hover:text-violet-800 hover:bg-violet-50">
                  {breakdownOn ? <><Minus className="w-3 h-3 mr-1" /> {lang === "es" ? "Una sola línea" : "Single line"}</> : <><ListTree className="w-3 h-3 mr-1" /> {lang === "es" ? "Mostrar desglose" : "Show breakdown"}</>}
                </Button>
              )}
              <Button data-testid="add-inv-item" size="sm" variant="outline" onClick={addItem} className="rounded-xl"><Plus className="w-3 h-3 mr-1" /> {t("invoiceDetail.addItem")}</Button>
            </div>
          </div>
          {invoice.line_items.length === 0 && (
            <p className="text-xs text-slate-400 mb-2">{t("invoiceDetail.itemsHint")}</p>
          )}
          {invoice.line_items.map((li, i) => (
            <div key={i} className="bg-slate-50 rounded-xl p-3 mb-2 lg:bg-transparent lg:p-0">
              {/* Mobile: friendly labeled layout */}
              <div className="lg:hidden space-y-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 ml-1">{t("invoiceDetail.description")}</span>
                  <AutoGrowTextarea value={li.description} onChange={(e) => updateItem(i, "description", e.target.value)} placeholder={t("invoiceDetail.itemDescPlaceholder")} className="mt-0.5" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 ml-1">{t("invoiceDetail.qty")}</span>
                    <Input type="text" inputMode="decimal" value={li.quantity} onChange={(e) => updateItem(i, "quantity", numClean(e.target.value))} placeholder="1" className="h-11 rounded-xl bg-white mt-0.5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 ml-1">{t("invoiceDetail.unit")}</span>
                    <Input value={li.unit} onChange={(e) => updateItem(i, "unit", e.target.value)} placeholder="ea" className="h-11 rounded-xl bg-white mt-0.5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 ml-1">{t("invoiceDetail.price")}</span>
                    <Input type="text" inputMode="decimal" value={li.unit_price} onChange={(e) => updateItem(i, "unit_price", numClean(e.target.value))} placeholder="0.00" className="h-11 rounded-xl bg-white mt-0.5" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-0.5">
                  <button type="button" onClick={() => removeItem(i)} className="flex items-center gap-1 text-red-500 text-xs font-semibold tap">
                    <Trash2 className="w-3.5 h-3.5" /> {t("invoiceDetail.removeItem")}
                  </button>
                  <div className="text-sm font-bold text-slate-800">{t("invoiceDetail.totalInline")}: ${((Number(li.quantity) || 0) * (Number(li.unit_price) || 0)).toFixed(2)}</div>
                </div>
              </div>
              {/* Desktop: compact grid */}
              <div className="hidden lg:grid grid-cols-12 gap-2 items-start">
                <AutoGrowTextarea value={li.description} onChange={(e) => updateItem(i, "description", e.target.value)} placeholder="Description" className="col-span-5" />
                <Input type="text" inputMode="decimal" value={li.quantity} onChange={(e) => updateItem(i, "quantity", numClean(e.target.value))} placeholder="Qty" className="col-span-2 h-11 rounded-xl bg-white" />
                <Input value={li.unit} onChange={(e) => updateItem(i, "unit", e.target.value)} placeholder="ea" className="col-span-1 h-11 rounded-xl bg-white" />
                <Input type="text" inputMode="decimal" value={li.unit_price} onChange={(e) => updateItem(i, "unit_price", numClean(e.target.value))} placeholder="$" className="col-span-2 h-11 rounded-xl bg-white" />
                <div className="col-span-1 flex items-center justify-start text-sm font-semibold whitespace-nowrap h-11">${((Number(li.quantity) || 0) * (Number(li.unit_price) || 0)).toFixed(2)}</div>
                <button type="button" onClick={() => removeItem(i)} className="col-span-1 flex items-center justify-center text-red-500 h-11"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Tax Rate (%)</Label>
            <Input type="text" inputMode="decimal" value={invoice.tax_rate} onChange={(e) => recompute({ ...invoice, tax_rate: numClean(e.target.value) })} className="h-12 rounded-xl mt-1.5" />
          </div>
          <div>
            <Label>Deposit / Down payment ($)</Label>
            <Input
              data-testid="invoice-deposit"
              type="text"
              inputMode="decimal"
              value={invoice.deposit_amount || ""}
              onChange={(e) => setInvoice({ ...invoice, deposit_amount: numClean(e.target.value) })}
              className="h-12 rounded-xl mt-1.5"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              {t("invoiceDetail.depositHint")}
            </p>
          </div>
        </div>

        <div>
          <Label>Notes</Label>
          <Textarea value={invoice.notes || ""} onChange={(e) => setInvoice({ ...invoice, notes: e.target.value })} className="rounded-xl mt-1.5" />
        </div>

        <div className="bg-slate-50 rounded-xl p-4 space-y-1 text-sm">
          {priceEstimated && (
            <div data-testid="inv-price-estimated" className="mb-2 rounded-lg bg-amber-50 ring-1 ring-amber-200 px-3 py-2 text-xs font-semibold text-amber-800">
              {lang === "es" ? "💡 Precio sugerido por la IA — ajústalo si quieres" : "💡 AI-suggested price — adjust it if you want"}
            </div>
          )}
          <div className="flex justify-between"><span className="text-slate-600">Subtotal</span><span className="font-semibold">${invoice.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Tax</span><span className="font-semibold">${invoice.tax_amount.toFixed(2)}</span></div>
          <div className="flex justify-between text-lg pt-2 border-t border-slate-200 mt-2"><span className="font-heading font-bold">TOTAL</span><span className="font-heading font-bold">${invoice.total.toFixed(2)}</span></div>
          {invoice.deposit_amount > 0 && (
            <div className="flex justify-between text-amber-700 pt-2 border-t border-slate-200 mt-2" data-testid="deposit-row">
              <span className="font-semibold">Deposit due upfront</span>
              <span className="font-bold">${Number(invoice.deposit_amount).toFixed(2)}</span>
            </div>
          )}
          {invoice.deposit_amount > 0 && (
            <div className="flex justify-between text-slate-700">
              <span>Balance after deposit</span>
              <span className="font-semibold">${Math.max(0, invoice.total - Number(invoice.deposit_amount)).toFixed(2)}</span>
            </div>
          )}
          {invoice.amount_paid > 0 && <div className="flex justify-between text-emerald-700"><span>Paid</span><span className="font-semibold">${invoice.amount_paid.toFixed(2)}</span></div>}
        </div>

        {invoice.agreement_terms && (
          <AgreementTermsBlock
            terms={invoice.agreement_terms}
            depositAmount={invoice.deposit_amount}
            agreementId={invoice.agreement_id}
          />
        )}

        <Button data-testid="save-invoice" onClick={save} disabled={saving} className="w-full h-14 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-semibold">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : (isNew ? t("invoiceDetail.saveDraft") : t("invoiceDetail.saveChanges"))}
        </Button>
      </Card>
      </>
      )}

      {!isNew && (
        <PaymentStatusCard
          invoice={invoice}
          invoiceId={id}
          onReload={(data) => setInvoice(data)}
        />
      )}

      {!isNew && <JobFromInvoiceCard invoiceId={id} />}

      {!isNew && (
        <PaymentRequestsCard invoiceId={id} invoice={invoice} />
      )}

      {!isNew && (
        <SendDocumentDialog
          open={sendOpen}
          onClose={() => setSendOpen(false)}
          kind="invoice"
          publicUrl={`${window.location.origin}/p/invoice/${id}`}
          client={client}
          businessName={user?.business_name}
          jobTitle={invoice.job_title}
          getPdfBlob={getInvoicePdfBlob}
        />
      )}
    </div>
  );
}

function PaymentStatusCard({ invoice, invoiceId, onReload }) {
  const { t } = useTranslation();
  const total = Number(invoice.total) || 0;
  const payments = invoice.payments || [];
  const plan = invoice.payment_plan || [];
  const paid = Number(invoice.amount_paid) || 0;
  const remaining = Math.max(0, total - paid);
  const status = invoice.status;
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPlan, setShowPlan] = useState(plan.length > 0);

  const addPayment = async (preset = null) => {
    const amt = preset ? preset.amount : Number(amount);
    if (!amt || isNaN(amt) || amt <= 0) {
      toast.error(t("invoiceDetail.amountValid"));
      return;
    }
    setBusy(true);
    try {
      const body = preset
        ? { amount: amt, method, date, note: preset.label || "", plan_item_id: preset.id }
        : { amount: amt, method, date, note: note.trim() };
      const { data } = await api.post(`/invoices/${invoiceId}/payments`, body);
      onReload(data);
      setAmount(""); setNote(""); setShowForm(false);
      toast.success(data.status === "paid" ? t("invoiceDetail.paidFull") : t("invoiceDetail.paymentAdded"));
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("invoiceDetail.paymentError"));
    } finally {
      setBusy(false);
    }
  };

  const removePayment = async (pid) => {
    if (!window.confirm(t("invoiceDetail.deletePaymentConfirm"))) return;
    try {
      const { data } = await api.delete(`/invoices/${invoiceId}/payments/${pid}`);
      onReload(data);
      toast.success(t("invoiceDetail.paymentDeleted"));
    } catch {
      toast.error(t("invoiceDetail.couldntDelete"));
    }
  };

  const quickStatus = async (next) => {
    try {
      const { data } = await api.post(`/invoices/${invoiceId}/status?status=${next}`);
      onReload(data);
    } catch {
      toast.error(t("invoiceDetail.statusUpdError"));
    }
  };

  const paidPlanIds = new Set(payments.map((p) => p.plan_item_id).filter(Boolean));

  return (
    <CollapsibleSection
      icon={Wallet}
      iconColor="bg-emerald-100 text-emerald-700"
      title={t("invoiceDetail.payments")}
      summary={t("invoiceDetail.balanceSummary", { rem: remaining.toFixed(2), paid: paid.toFixed(2), total: total.toFixed(2) })}
      testId="payment-status-card"
    >
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="space-y-1.5" data-testid="payment-history">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200" data-testid={`payment-row-${p.id}`}>
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-none text-xs font-bold">
                {METHOD_SHORT[p.method] || "$"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800">
                  ${Number(p.amount).toFixed(2)} · {methodLabel(p.method)}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {fmtPayDate(p.date)}{p.note ? ` · ${p.note}` : ""}
                </div>
              </div>
              <button onClick={() => removePayment(p.id)} className="text-slate-400 hover:text-rose-600 p-1 flex-none" data-testid={`payment-del-${p.id}`} aria-label="Borrar abono">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add payment form */}
      {showForm ? (
        <div className="rounded-2xl border border-slate-200 p-3 space-y-2" data-testid="payment-form">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{t("invoiceDetail.amount")}</Label>
              <Input type="number" inputMode="decimal" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={remaining.toFixed(2)} className="h-11 rounded-xl mt-1" data-testid="payment-amount" autoFocus />
            </div>
            <div>
              <Label className="text-xs">{t("invoiceDetail.method")}</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="h-11 rounded-xl mt-1" data-testid="payment-method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHOD_KEYS.map((v) => <SelectItem key={v} value={v}>{methodLabel(v)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{t("invoiceDetail.date")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-xl mt-1" data-testid="payment-date" />
            </div>
            <div>
              <Label className="text-xs">{t("invoiceDetail.noteOptional")}</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("invoiceDetail.notePlaceholder")} className="h-11 rounded-xl mt-1" data-testid="payment-note" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={() => addPayment()} disabled={busy} className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold" data-testid="payment-save">
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />} {t("invoiceDetail.recordPayment")}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)} className="h-11 rounded-xl">{t("common.cancel")}</Button>
          </div>
        </div>
      ) : (
        remaining > 0 && (
          <Button onClick={() => setShowForm(true)} className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold" data-testid="add-payment">
            <Plus className="w-4 h-4 mr-1" /> {t("invoiceDetail.recordPayment")}
          </Button>
        )
      )}

      {/* Fully paid banner */}
      {status === "paid" && remaining <= 0 && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-center gap-2">
          <Check className="w-4 h-4" /> {t("invoiceDetail.paidBanner")}
        </div>
      )}

      {/* Optional fixed installment plan */}
      <div className="pt-1">
        <button onClick={() => setShowPlan(!showPlan)} className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1" data-testid="toggle-plan">
          {showPlan ? "▾" : "▸"} {t("invoiceDetail.planToggle")}
        </button>
        {showPlan && (
          <PaymentPlanEditor
            invoiceId={invoiceId}
            total={total}
            plan={plan}
            paidPlanIds={paidPlanIds}
            onReload={onReload}
            onMarkPaid={(item) => addPayment(item)}
          />
        )}
      </div>

      {/* Quick status overrides */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
        <span className="text-[11px] text-slate-400">{t("invoiceDetail.statusLabelTxt")}</span>
        <button onClick={() => quickStatus("sent")} className={`text-[11px] font-semibold px-2 py-1 rounded-lg ${status === "sent" ? "bg-slate-200 text-slate-800" : "text-slate-500 hover:bg-slate-100"}`} data-testid="status-unpaid">{t("invoiceDetail.unpaid")}</button>
        <button onClick={() => quickStatus("overdue")} className={`text-[11px] font-semibold px-2 py-1 rounded-lg ${status === "overdue" ? "bg-red-100 text-red-700" : "text-slate-500 hover:bg-slate-100"}`} data-testid="status-overdue">{t("invoiceDetail.overdue")}</button>
        <button onClick={() => quickStatus("paid")} className={`text-[11px] font-semibold px-2 py-1 rounded-lg ${status === "paid" ? "bg-emerald-100 text-emerald-700" : "text-slate-500 hover:bg-slate-100"}`} data-testid="status-paid">{t("invoiceDetail.paidAll")}</button>
      </div>
    </CollapsibleSection>
  );
}

const METHOD_KEYS = ["cash", "check", "zelle", "transfer", "card", "other"];
const methodLabel = (m) => i18n.t(`invoiceDetail.m${m.charAt(0).toUpperCase()}${m.slice(1)}`, { defaultValue: m });
const METHOD_SHORT = { cash: "💵", check: "🧾", zelle: "Z", transfer: "↔", card: "💳", other: "$" };

function fmtPayDate(iso) {
  try {
    const loc = i18n.language && i18n.language.startsWith("es") ? "es-ES" : "en-US";
    return new Date(iso).toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric" });
  } catch { return ""; }
}

function PaymentPlanEditor({ invoiceId, total, plan, paidPlanIds, onReload, onMarkPaid }) {
  const { t } = useTranslation();
  const [items, setItems] = useState(plan.length > 0 ? plan : []);
  const [saving, setSaving] = useState(false);

  const addRow = () => setItems([...items, { id: `tmp-${Date.now()}`, label: t("invoiceDetail.paymentLabel", { n: items.length + 1 }), amount: 0, due_date: "" }]);
  const updateRow = (i, key, val) => setItems(items.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)));
  const removeRow = (i) => setItems(items.filter((_, idx) => idx !== i));

  const splitEvenly = (n) => {
    const per = Math.round((total / n) * 100) / 100;
    const rows = Array.from({ length: n }, (_, i) => ({
      id: `tmp-${Date.now()}-${i}`,
      label: t("invoiceDetail.paymentLabel", { n: i + 1 }),
      amount: i === n - 1 ? Math.round((total - per * (n - 1)) * 100) / 100 : per,
      due_date: "",
    }));
    setItems(rows);
  };

  const savePlan = async () => {
    setSaving(true);
    try {
      const installments = items.map((it) => ({ label: it.label, amount: Number(it.amount) || 0, due_date: it.due_date || null }));
      const { data } = await api.put(`/invoices/${invoiceId}/payment-plan`, { installments });
      onReload(data);
      toast.success(t("invoiceDetail.planSaved"));
    } catch {
      toast.error(t("invoiceDetail.planError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 space-y-2" data-testid="payment-plan-editor">
      {items.length === 0 && (
        <div className="flex gap-2">
          {[2, 3, 4].map((n) => (
            <Button key={n} variant="outline" size="sm" onClick={() => splitEvenly(n)} className="rounded-lg text-xs" data-testid={`split-${n}`}>
              {t("invoiceDetail.splitInto", { n })}
            </Button>
          ))}
        </div>
      )}
      {items.map((it, i) => {
        const isPaid = it.id && paidPlanIds.has(it.id);
        return (
          <div key={it.id || i} className="flex flex-wrap items-center gap-2" data-testid={`plan-row-${i}`}>
            <Input value={it.label} onChange={(e) => updateRow(i, "label", e.target.value)} placeholder={t("invoiceDetail.paymentLabel", { n: i + 1 })} className="h-10 rounded-lg text-sm flex-1 min-w-[120px]" />
            <Input type="text" inputMode="decimal" value={it.amount} onChange={(e) => updateRow(i, "amount", numClean(e.target.value))} placeholder="$" className="h-10 rounded-lg text-sm w-20" />
            <Input type="date" value={it.due_date || ""} onChange={(e) => updateRow(i, "due_date", e.target.value)} className="h-10 rounded-lg text-sm flex-1 min-w-[130px]" />
            {isPaid ? (
              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-0.5 w-20 justify-center"><Check className="w-3.5 h-3.5" />{t("invoiceDetail.paid")}</span>
            ) : it.id && !String(it.id).startsWith("tmp-") ? (
              <Button size="sm" onClick={() => onMarkPaid(it)} className="h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] px-2 w-20" data-testid={`plan-pay-${i}`}>{t("invoiceDetail.markPaidShort")}</Button>
            ) : (
              <button onClick={() => removeRow(i)} className="text-slate-400 hover:text-rose-600 p-1 w-20 flex justify-center"><Trash2 className="w-4 h-4" /></button>
            )}
          </div>
        );
      })}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={addRow} className="rounded-lg text-xs" data-testid="plan-add-row"><Plus className="w-3.5 h-3.5 mr-1" />{t("invoiceDetail.installment")}</Button>
        {items.length > 0 && (
          <Button size="sm" onClick={savePlan} disabled={saving} className="rounded-lg text-xs bg-slate-800 hover:bg-slate-900 text-white" data-testid="plan-save">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t("invoiceDetail.savePlan")}
          </Button>
        )}
      </div>
    </div>
  );
}

function AgreementTermsBlock({ terms, depositAmount, agreementId }) {
  if (!terms) return null;
  const signedDate = terms.signed_at
    ? new Date(terms.signed_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : null;
  const publicUrl = agreementId ? `${window.location.origin}/p/agreement/${agreementId}` : null;
  return (
    <div
      data-testid="agreement-terms-block"
      className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center flex-none">
          <Check className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-emerald-900 text-sm">
            Per signed Service Agreement
          </div>
          <div className="text-xs text-emerald-800 mt-0.5">
            {terms.signer_name && <>Signed by <strong>{terms.signer_name}</strong></>}
            {signedDate && <> on <strong>{signedDate}</strong></>}
          </div>
          {depositAmount > 0 && (
            <div className="text-xs text-emerald-800 mt-1">
              Deposit required: <strong>${Number(depositAmount).toFixed(2)}</strong> due before work begins.
            </div>
          )}
          {publicUrl && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs font-semibold text-emerald-700 hover:text-emerald-900 mt-2 underline"
              data-testid="view-agreement-link"
            >
              View signed agreement →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// PaymentRequestsCard — create & manage "payment slips" for an invoice.
// Each request = a focused amount the client can pay via a shareable link.
// ============================================================================
function PaymentRequestsCard({ invoiceId, invoice }) {
  const { t } = useTranslation();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [planItemId, setPlanItemId] = useState(null);
  const [busy, setBusy] = useState(false);

  const plan = invoice.payment_plan || [];

  const load = async () => {
    try {
      const { data } = await api.get(`/invoices/${invoiceId}/payment-requests`);
      setRequests(data.requests || []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [invoiceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickInstallment = (item) => {
    setAmount(String(item.amount));
    setDesc(item.label || "");
    setPlanItemId(item.id);
  };

  const create = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error(t("invoiceDetail.amountValid"));
      return;
    }
    setBusy(true);
    try {
      await api.post(`/invoices/${invoiceId}/payment-requests`, {
        amount: amt,
        description: desc.trim(),
        plan_item_id: planItemId,
      });
      setAmount(""); setDesc(""); setPlanItemId(null);
      toast.success(t("invoiceDetail.requestCreated"));
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("invoiceDetail.couldntCreate"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (rid) => {
    if (!window.confirm(t("invoiceDetail.deleteRequestConfirm"))) return;
    try {
      await api.delete(`/payment-requests/${rid}`);
      toast.success(t("invoiceDetail.requestDeleted"));
      load();
    } catch {
      toast.error(t("invoiceDetail.couldntDelete"));
    }
  };

  const linkFor = (rid) => `${window.location.origin}/p/pay/${rid}`;
  const copyLink = (rid) => {
    navigator.clipboard?.writeText(linkFor(rid));
    toast.success(t("invoiceDetail.linkCopied"));
  };
  const shareWhatsApp = (req) => {
    const msg = t("invoiceDetail.waMsg", {
      desc: req.description ? ` (${req.description})` : "",
      amount: Number(req.amount).toFixed(2),
      link: linkFor(req.id),
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  };

  return (
    <CollapsibleSection
      icon={Receipt}
      iconColor="bg-indigo-100 text-indigo-600"
      title={t("invoiceDetail.askPayment")}
      summary={requests.length > 0 ? t("invoiceDetail.requestsSummary", { count: requests.length }) : t("invoiceDetail.requestsEmpty")}
      testId="payment-requests-card"
    >
      {/* Quick-pick from installment plan */}
      {plan.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {plan.map((it) => (
            <button
              key={it.id}
              onClick={() => pickInstallment(it)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              data-testid={`pr-pick-${it.id}`}
            >
              {t("invoiceDetail.requestPick", { label: it.label, amount: Number(it.amount).toFixed(2) })}
            </button>
          ))}
        </div>
      )}

      {/* Create form */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">{t("invoiceDetail.amount")}</Label>
          <Input type="number" step="0.01" value={amount} onChange={(e) => { setAmount(e.target.value); setPlanItemId(null); }} placeholder="0.00" className="h-11 rounded-xl mt-1" data-testid="pr-amount-input" />
        </div>
        <div>
          <Label className="text-xs">{t("invoiceDetail.descLabel")}</Label>
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t("invoiceDetail.descPlaceholder")} className="h-11 rounded-xl mt-1" data-testid="pr-desc-input" />
        </div>
      </div>
      <Button onClick={create} disabled={busy} className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold" data-testid="pr-create-btn">
        {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />} {t("invoiceDetail.createRequest")}
      </Button>

      {/* Existing requests */}
      {loading ? (
        <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
      ) : requests.length > 0 && (
        <div className="space-y-2 pt-1" data-testid="pr-list">
          {requests.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-200 p-3" data-testid={`pr-item-${r.id}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-slate-800">${Number(r.amount).toFixed(2)}{r.description ? ` · ${r.description}` : ""}</div>
                </div>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full flex-none ${r.status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {r.status === "paid" ? t("invoiceDetail.paid") : t("invoiceDetail.pending")}
                </span>
              </div>
              {r.status !== "paid" && (
                <div className="flex items-center gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={() => copyLink(r.id)} className="h-8 rounded-lg text-xs flex-1" data-testid={`pr-copy-${r.id}`}>
                    <Copy className="w-3.5 h-3.5 mr-1" /> {t("invoiceDetail.copyLink")}
                  </Button>
                  <Button size="sm" onClick={() => shareWhatsApp(r)} className="h-8 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex-1" data-testid={`pr-wa-${r.id}`}>
                    WhatsApp
                  </Button>
                  <button onClick={() => remove(r.id)} className="text-slate-400 hover:text-rose-600 p-1 flex-none" data-testid={`pr-del-${r.id}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}


// ============================================================================
// JobFromInvoiceCard — "Crear Trabajo" from an invoice (when the quote step was
// skipped). Idempotent: shows the linked job if one already exists.
// ============================================================================
function JobFromInvoiceCard({ invoiceId }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api.get(`/invoices/${invoiceId}/job`)
      .then(({ data }) => { if (active) setJob(data.job); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [invoiceId]);

  const createJob = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/invoices/${invoiceId}/create-job`);
      setJob(data.job);
      toast.success(data.created ? t("invoiceDetail.jobCreated") : t("invoiceDetail.jobExisted"));
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo crear el trabajo");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;

  return (
    <CollapsibleSection
      icon={Briefcase}
      iconColor="bg-emerald-100 text-emerald-600"
      title={t("invoiceDetail.jobTitle")}
      summary={job ? t("invoiceDetail.jobLinked") : t("invoiceDetail.jobCreate")}
      testId="job-from-invoice-card"
    >
      {job ? (
        <Button
          onClick={() => navigate("/trabajos")}
          className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          data-testid="goto-job-btn"
        >
          <CalendarClock className="w-4 h-4 mr-1.5" /> {t("invoiceDetail.gotoSchedule")}
        </Button>
      ) : (
        <Button
          onClick={createJob}
          disabled={busy}
          className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          data-testid="create-job-btn"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />} {t("invoiceDetail.createJob")}
        </Button>
      )}
    </CollapsibleSection>
  );
}
