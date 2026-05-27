import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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
import { ArrowLeft, FileDown, MoreVertical, Plus, Trash2, Loader2, Check, Sparkles, Send } from "lucide-react";
import { toast } from "sonner";
import SendDocumentDialog from "@/components/SendDocumentDialog";

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

export default function InvoiceDetail() {
  const { id } = useParams();
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
  const [sendOpen, setSendOpen] = useState(false);

  const generateWithAI = async () => {
    if (!aiDescription.trim()) return toast.error("Escribe una descripción primero");
    setAiLoading(true);
    try {
      const { data } = await api.post("/ai/quote", { description_es: aiDescription });
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
      toast.success("¡Invoice generado con AI en inglés!");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error de AI");
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
        const c = await api.get(`/clients/${data.client_id}`);
        setClient(c.data);
      }).catch(() => { toast.error("No encontrado"); navigate("/invoices"); });
    }
  }, [id]);

  const updateItem = (i, k, v) => {
    const items = [...invoice.line_items];
    items[i] = { ...items[i], [k]: k === "description" || k === "unit" ? v : Number(v) || 0 };
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
    if (!invoice.client_id) return toast.error("Selecciona un cliente");
    if (!invoice.job_title.trim()) return toast.error("Falta título");
    setSaving(true);
    try {
      const payload = { ...invoice, due_date: invoice.due_date || null };
      if (isNew) {
        const { data } = await api.post("/invoices", payload);
        toast.success("Invoice creado");
        navigate(`/invoices/${data.id}`);
      } else {
        await api.put(`/invoices/${id}`, payload);
        toast.success("Guardado");
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status) => {
    const { data } = await api.post(`/invoices/${id}/status?status=${status}`);
    setInvoice(data);
    toast.success("Estado actualizado");
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

  return (
    <div className="space-y-5">
      <button onClick={() => navigate("/invoices")} className="flex items-center gap-2 text-sm text-slate-600 tap" data-testid="back-invoices">
        <ArrowLeft className="w-4 h-4" /> Invoices
      </button>

      {/* AI Generation (only for new invoices) */}
      {isNew && (
        <Card className="card-elevated p-5 border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-white shadow-none">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <Label className="text-base font-bold">Generar Invoice con AI</Label>
              <p className="text-[11px] text-slate-500">Describe el trabajo en español — la IA lo traduce a inglés profesional para tu cliente.</p>
            </div>
          </div>
          <Textarea
            data-testid="inv-ai-description"
            value={aiDescription}
            onChange={(e) => setAiDescription(e.target.value)}
            className="rounded-xl min-h-[100px] bg-white"
            placeholder="Ej: Reparé el techo de Carlos, cambié 8 tejas, sellé alrededor de la chimenea. 3 horas de trabajo. Material costó $120."
          />
          <Button
            data-testid="inv-ai-generate"
            onClick={generateWithAI}
            disabled={aiLoading || !aiDescription.trim()}
            className="mt-3 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 w-full gap-2"
          >
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {aiLoading ? "Generando..." : "Generar con AI (en inglés)"}
          </Button>
        </Card>
      )}

      <Card className="card-elevated p-5 border-0 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {!isNew && <span className="text-sm font-bold text-slate-500">{invoice.number}</span>}
              {!isNew && <StatusBadge kind="invoice" status={invoice.status} />}
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">
              {isNew ? "Nuevo Invoice" : invoice.job_title}
            </h1>
          </div>
          {!isNew && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-xl" data-testid="invoice-menu"><MoreVertical className="w-4 h-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem onClick={() => setStatus("sent")}>Marcar Enviado</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatus("paid")} data-testid="mark-paid"><Check className="w-3 h-3 mr-1" /> Marcar Pagado</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatus("partial")}>Pago parcial</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatus("overdue")}>Atrasado</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {!isNew && (
          <div className="grid grid-cols-2 gap-2 mt-5">
            <Button
              data-testid="inv-send"
              onClick={() => {
                if (invoice.status === "draft") setStatus("sent");
                setSendOpen(true);
              }}
              className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Send className="w-4 h-4 mr-1" /> Mandar Invoice
            </Button>
            <Button data-testid="inv-download-pdf" onClick={downloadPDF} variant="outline" className="h-12 rounded-xl border-slate-200">
              <FileDown className="w-4 h-4 mr-1" /> Descargar PDF
            </Button>
          </div>
        )}
      </Card>

      <Card className="card-elevated p-5 border-0 shadow-none space-y-3">
        <div>
          <Label>Cliente</Label>
          <Select value={invoice.client_id} onValueChange={(v) => setInvoice({ ...invoice, client_id: v })}>
            <SelectTrigger className="h-12 rounded-xl mt-1.5" data-testid="inv-client-select"><SelectValue placeholder="Selecciona" /></SelectTrigger>
            <SelectContent>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Job Title</Label>
          <Input data-testid="inv-title" value={invoice.job_title} onChange={(e) => setInvoice({ ...invoice, job_title: e.target.value })} className="h-12 rounded-xl mt-1.5" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Due Date</Label>
            <Input type="date" value={invoice.due_date || ""} onChange={(e) => setInvoice({ ...invoice, due_date: e.target.value })} className="h-12 rounded-xl mt-1.5" />
          </div>
          <div>
            <Label>Amount Paid ($)</Label>
            <Input type="number" step="0.01" value={invoice.amount_paid} onChange={(e) => setInvoice({ ...invoice, amount_paid: Number(e.target.value) || 0 })} className="h-12 rounded-xl mt-1.5" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Line Items</Label>
            <Button data-testid="add-inv-item" size="sm" variant="outline" onClick={addItem} className="rounded-xl"><Plus className="w-3 h-3 mr-1" /> Agregar</Button>
          </div>
          {invoice.line_items.map((li, i) => (
            <div key={i} className="bg-slate-50 rounded-xl p-3 mb-2 space-y-2 lg:space-y-0 lg:bg-transparent lg:p-0">
              <Input value={li.description} onChange={(e) => updateItem(i, "description", e.target.value)} placeholder="Description" className="h-11 rounded-xl bg-white lg:hidden" />
              <div className="grid grid-cols-12 gap-2 items-center">
                <Input value={li.description} onChange={(e) => updateItem(i, "description", e.target.value)} placeholder="Description" className="hidden lg:block lg:col-span-5 h-11 rounded-xl" />
                <Input type="number" inputMode="decimal" step="0.01" value={li.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} placeholder="Qty" className="col-span-3 lg:col-span-2 h-11 rounded-xl bg-white" />
                <Input value={li.unit} onChange={(e) => updateItem(i, "unit", e.target.value)} placeholder="ea" className="col-span-3 lg:col-span-1 h-11 rounded-xl bg-white" />
                <Input type="number" inputMode="decimal" step="0.01" value={li.unit_price} onChange={(e) => updateItem(i, "unit_price", e.target.value)} placeholder="$" className="col-span-4 lg:col-span-2 h-11 rounded-xl bg-white" />
                <div className="col-span-2 lg:col-span-1 flex items-center justify-end lg:justify-start text-sm font-semibold whitespace-nowrap">${li.amount.toFixed(2)}</div>
                <button type="button" onClick={() => removeItem(i)} className="hidden lg:flex col-span-1 items-center justify-center text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
              <button type="button" onClick={() => removeItem(i)} className="lg:hidden flex items-center gap-1 text-red-500 text-xs font-semibold">
                <Trash2 className="w-3.5 h-3.5" /> Quitar ítem
              </button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Tax Rate (%)</Label>
            <Input type="number" step="0.01" value={invoice.tax_rate} onChange={(e) => recompute({ ...invoice, tax_rate: Number(e.target.value) || 0 })} className="h-12 rounded-xl mt-1.5" />
          </div>
          <div>
            <Label>Deposit / Down payment ($)</Label>
            <Input
              data-testid="invoice-deposit"
              type="number"
              step="0.01"
              value={invoice.deposit_amount || 0}
              onChange={(e) => setInvoice({ ...invoice, deposit_amount: Number(e.target.value) || 0 })}
              className="h-12 rounded-xl mt-1.5"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Cantidad solicitada antes de empezar el trabajo.
            </p>
          </div>
        </div>

        <div>
          <Label>Notes</Label>
          <Textarea value={invoice.notes || ""} onChange={(e) => setInvoice({ ...invoice, notes: e.target.value })} className="rounded-xl mt-1.5" />
        </div>

        <div className="bg-slate-50 rounded-xl p-4 space-y-1 text-sm">
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
          <AgreementTermsBlock terms={invoice.agreement_terms} depositAmount={invoice.deposit_amount} />
        )}

        <Button data-testid="save-invoice" onClick={save} disabled={saving} className="w-full h-14 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-semibold">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : (isNew ? "Crear invoice" : "Guardar cambios")}
        </Button>
      </Card>

      {!isNew && (
        <SendDocumentDialog
          open={sendOpen}
          onClose={() => setSendOpen(false)}
          kind="invoice"
          publicUrl={`${window.location.origin}/p/invoice/${id}`}
          client={client}
          businessName={user?.business_name}
          jobTitle={invoice.job_title}
        />
      )}
    </div>
  );
}

function AgreementTermsBlock({ terms, depositAmount }) {
  if (!terms) return null;
  const sec = terms.sections || {};
  const sections = [
    { key: "what_is_included", label: "What is included", items: sec.what_is_included },
    { key: "what_is_not_included", label: "What is not included", items: sec.what_is_not_included },
    { key: "materials", label: "Materials", items: sec.materials },
  ];
  const rows = [
    { label: "Payment terms", value: sec.payment_terms },
    { label: "Timeline", value: sec.timeline },
    { label: "Warranty", value: sec.warranty_notes },
    { label: "Change order policy", value: sec.change_order_note },
  ];
  return (
    <div
      data-testid="agreement-terms-block"
      className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
          Signed agreement terms
        </span>
        {terms.signer_name && (
          <span className="text-xs text-emerald-900">
            Signed by {terms.signer_name}
            {terms.signed_at ? ` on ${new Date(terms.signed_at).toLocaleDateString("en-US")}` : ""}
          </span>
        )}
      </div>
      {depositAmount > 0 && (
        <div className="text-sm bg-white rounded-lg p-3 border border-emerald-100">
          <span className="font-bold">Deposit required: </span>
          <span className="font-mono">${Number(depositAmount).toFixed(2)}</span>
          <span className="text-slate-500"> — due before work begins, per signed agreement.</span>
        </div>
      )}
      {sections.map((s) =>
        s.items?.length ? (
          <div key={s.key}>
            <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-900 mb-1">
              {s.label}
            </div>
            <ul className="list-disc ml-5 space-y-0.5 text-xs text-slate-700">
              {s.items.map((it, i) => <li key={i}>{it}</li>)}
            </ul>
          </div>
        ) : null
      )}
      {rows.map((r) =>
        r.value ? (
          <div key={r.label}>
            <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-900 mb-0.5">
              {r.label}
            </div>
            <div className="text-xs text-slate-700">{r.value}</div>
          </div>
        ) : null
      )}
    </div>
  );
}
