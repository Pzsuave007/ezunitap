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
import { ArrowLeft, FileDown, MoreVertical, Plus, Trash2, Loader2, Check, Sparkles, Send, Receipt, Copy, Briefcase, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import SendDocumentDialog from "@/components/SendDocumentDialog";
import { listAgreementClauses } from "@/lib/pdf";

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

  const deleteInvoice = async () => {
    if (!window.confirm(`¿Borrar el invoice ${invoice.number}? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/invoices/${id}`);
      toast.success("Invoice borrado");
      navigate("/invoices");
    } catch {
      toast.error("Error al borrar");
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
                <DropdownMenuItem
                  data-testid="invoice-delete"
                  onClick={deleteInvoice}
                  className="text-red-600 focus:text-red-700 focus:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Borrar invoice
                </DropdownMenuItem>
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
        <div>
          <Label>Due Date</Label>
          <Input type="date" value={invoice.due_date || ""} onChange={(e) => setInvoice({ ...invoice, due_date: e.target.value })} className="h-12 rounded-xl mt-1.5" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Line Items</Label>
            <Button data-testid="add-inv-item" size="sm" variant="outline" onClick={addItem} className="rounded-xl"><Plus className="w-3 h-3 mr-1" /> Agregar</Button>
          </div>
          {invoice.line_items.length === 0 && (
            <p className="text-xs text-slate-400 mb-2">Toca "Agregar" para añadir tu primer concepto (ej. mano de obra, materiales).</p>
          )}
          {invoice.line_items.map((li, i) => (
            <div key={i} className="bg-slate-50 rounded-xl p-3 mb-2 lg:bg-transparent lg:p-0">
              {/* Mobile: friendly labeled layout */}
              <div className="lg:hidden space-y-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 ml-1">Descripción</span>
                  <Input value={li.description} onChange={(e) => updateItem(i, "description", e.target.value)} placeholder="Ej: Cambio de techo" className="h-11 rounded-xl bg-white mt-0.5" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 ml-1">Cant.</span>
                    <Input type="number" inputMode="decimal" step="0.01" value={li.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} placeholder="1" className="h-11 rounded-xl bg-white mt-0.5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 ml-1">Unidad</span>
                    <Input value={li.unit} onChange={(e) => updateItem(i, "unit", e.target.value)} placeholder="ea" className="h-11 rounded-xl bg-white mt-0.5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 ml-1">Precio $</span>
                    <Input type="number" inputMode="decimal" step="0.01" value={li.unit_price} onChange={(e) => updateItem(i, "unit_price", e.target.value)} placeholder="0.00" className="h-11 rounded-xl bg-white mt-0.5" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-0.5">
                  <button type="button" onClick={() => removeItem(i)} className="flex items-center gap-1 text-red-500 text-xs font-semibold tap">
                    <Trash2 className="w-3.5 h-3.5" /> Quitar ítem
                  </button>
                  <div className="text-sm font-bold text-slate-800">Total: ${li.amount.toFixed(2)}</div>
                </div>
              </div>
              {/* Desktop: compact grid */}
              <div className="hidden lg:grid grid-cols-12 gap-2 items-center">
                <Input value={li.description} onChange={(e) => updateItem(i, "description", e.target.value)} placeholder="Description" className="col-span-5 h-11 rounded-xl" />
                <Input type="number" inputMode="decimal" step="0.01" value={li.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} placeholder="Qty" className="col-span-2 h-11 rounded-xl bg-white" />
                <Input value={li.unit} onChange={(e) => updateItem(i, "unit", e.target.value)} placeholder="ea" className="col-span-1 h-11 rounded-xl bg-white" />
                <Input type="number" inputMode="decimal" step="0.01" value={li.unit_price} onChange={(e) => updateItem(i, "unit_price", e.target.value)} placeholder="$" className="col-span-2 h-11 rounded-xl bg-white" />
                <div className="col-span-1 flex items-center justify-start text-sm font-semibold whitespace-nowrap">${li.amount.toFixed(2)}</div>
                <button type="button" onClick={() => removeItem(i)} className="col-span-1 flex items-center justify-center text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
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
          <AgreementTermsBlock
            terms={invoice.agreement_terms}
            depositAmount={invoice.deposit_amount}
            agreementId={invoice.agreement_id}
          />
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

function PaymentStatusCard({ invoice, invoiceId, onReload }) {
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
      toast.error("Escribe un monto válido");
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
      toast.success(data.status === "paid" ? "¡Invoice pagado completo! 🎉" : "Abono registrado");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo registrar el abono");
    } finally {
      setBusy(false);
    }
  };

  const removePayment = async (pid) => {
    if (!window.confirm("¿Borrar este abono?")) return;
    try {
      const { data } = await api.delete(`/invoices/${invoiceId}/payments/${pid}`);
      onReload(data);
      toast.success("Abono eliminado");
    } catch {
      toast.error("No se pudo eliminar");
    }
  };

  const quickStatus = async (next) => {
    try {
      const { data } = await api.post(`/invoices/${invoiceId}/status?status=${next}`);
      onReload(data);
    } catch {
      toast.error("Error al actualizar estado");
    }
  };

  const paidPlanIds = new Set(payments.map((p) => p.plan_item_id).filter(Boolean));

  return (
    <Card className="card-elevated p-5 border-0 shadow-none space-y-4" data-testid="payment-status-card">
      {/* Header + progress */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-heading font-bold text-base">Pagos</h3>
          <p className="text-xs text-slate-500">Registra cada abono. El saldo se actualiza solo.</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Saldo pendiente</div>
          <div className="font-heading font-bold text-2xl text-slate-900" data-testid="payment-remaining">${remaining.toFixed(2)}</div>
          <div className="text-[11px] text-emerald-700">Pagado ${paid.toFixed(2)} de ${total.toFixed(2)}</div>
        </div>
      </div>
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
                  ${Number(p.amount).toFixed(2)} · {METHOD_LABEL[p.method] || p.method}
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
              <Label className="text-xs">Monto ($)</Label>
              <Input type="number" inputMode="decimal" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={remaining.toFixed(2)} className="h-11 rounded-xl mt-1" data-testid="payment-amount" autoFocus />
            </div>
            <div>
              <Label className="text-xs">Método</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="h-11 rounded-xl mt-1" data-testid="payment-method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(METHOD_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-xl mt-1" data-testid="payment-date" />
            </div>
            <div>
              <Label className="text-xs">Nota (opcional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: mensualidad 1" className="h-11 rounded-xl mt-1" data-testid="payment-note" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={() => addPayment()} disabled={busy} className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold" data-testid="payment-save">
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />} Registrar abono
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)} className="h-11 rounded-xl">Cancelar</Button>
          </div>
        </div>
      ) : (
        remaining > 0 && (
          <Button onClick={() => setShowForm(true)} className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold" data-testid="add-payment">
            <Plus className="w-4 h-4 mr-1" /> Registrar abono
          </Button>
        )
      )}

      {/* Fully paid banner */}
      {status === "paid" && remaining <= 0 && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-center gap-2">
          <Check className="w-4 h-4" /> Invoice pagado completo. Se creó un Trabajo automáticamente.
        </div>
      )}

      {/* Optional fixed installment plan */}
      <div className="pt-1">
        <button onClick={() => setShowPlan(!showPlan)} className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1" data-testid="toggle-plan">
          {showPlan ? "▾" : "▸"} Plan de mensualidades (opcional)
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
        <span className="text-[11px] text-slate-400">Estado:</span>
        <button onClick={() => quickStatus("sent")} className={`text-[11px] font-semibold px-2 py-1 rounded-lg ${status === "sent" ? "bg-slate-200 text-slate-800" : "text-slate-500 hover:bg-slate-100"}`} data-testid="status-unpaid">No pagado</button>
        <button onClick={() => quickStatus("overdue")} className={`text-[11px] font-semibold px-2 py-1 rounded-lg ${status === "overdue" ? "bg-red-100 text-red-700" : "text-slate-500 hover:bg-slate-100"}`} data-testid="status-overdue">Atrasado</button>
        <button onClick={() => quickStatus("paid")} className={`text-[11px] font-semibold px-2 py-1 rounded-lg ${status === "paid" ? "bg-emerald-100 text-emerald-700" : "text-slate-500 hover:bg-slate-100"}`} data-testid="status-paid">Pagado todo</button>
      </div>
    </Card>
  );
}

const METHOD_LABEL = {
  cash: "Efectivo",
  check: "Cheque",
  zelle: "Zelle",
  transfer: "Transferencia",
  card: "Tarjeta",
  other: "Otro",
};
const METHOD_SHORT = { cash: "💵", check: "🧾", zelle: "Z", transfer: "↔", card: "💳", other: "$" };

function fmtPayDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  } catch { return ""; }
}

function PaymentPlanEditor({ invoiceId, total, plan, paidPlanIds, onReload, onMarkPaid }) {
  const [items, setItems] = useState(plan.length > 0 ? plan : []);
  const [saving, setSaving] = useState(false);

  const addRow = () => setItems([...items, { id: `tmp-${Date.now()}`, label: `Pago ${items.length + 1}`, amount: 0, due_date: "" }]);
  const updateRow = (i, key, val) => setItems(items.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)));
  const removeRow = (i) => setItems(items.filter((_, idx) => idx !== i));

  const splitEvenly = (n) => {
    const per = Math.round((total / n) * 100) / 100;
    const rows = Array.from({ length: n }, (_, i) => ({
      id: `tmp-${Date.now()}-${i}`,
      label: `Pago ${i + 1}`,
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
      toast.success("Plan guardado");
    } catch {
      toast.error("No se pudo guardar el plan");
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
              Dividir en {n}
            </Button>
          ))}
        </div>
      )}
      {items.map((it, i) => {
        const isPaid = it.id && paidPlanIds.has(it.id);
        return (
          <div key={it.id || i} className="flex flex-wrap items-center gap-2" data-testid={`plan-row-${i}`}>
            <Input value={it.label} onChange={(e) => updateRow(i, "label", e.target.value)} placeholder={`Pago ${i + 1}`} className="h-10 rounded-lg text-sm flex-1 min-w-[120px]" />
            <Input type="number" step="0.01" value={it.amount} onChange={(e) => updateRow(i, "amount", e.target.value)} placeholder="$" className="h-10 rounded-lg text-sm w-20" />
            <Input type="date" value={it.due_date || ""} onChange={(e) => updateRow(i, "due_date", e.target.value)} className="h-10 rounded-lg text-sm flex-1 min-w-[130px]" />
            {isPaid ? (
              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-0.5 w-20 justify-center"><Check className="w-3.5 h-3.5" />Pagado</span>
            ) : it.id && !String(it.id).startsWith("tmp-") ? (
              <Button size="sm" onClick={() => onMarkPaid(it)} className="h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] px-2 w-20" data-testid={`plan-pay-${i}`}>Marcar pagado</Button>
            ) : (
              <button onClick={() => removeRow(i)} className="text-slate-400 hover:text-rose-600 p-1 w-20 flex justify-center"><Trash2 className="w-4 h-4" /></button>
            )}
          </div>
        );
      })}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={addRow} className="rounded-lg text-xs" data-testid="plan-add-row"><Plus className="w-3.5 h-3.5 mr-1" />Cuota</Button>
        {items.length > 0 && (
          <Button size="sm" onClick={savePlan} disabled={saving} className="rounded-lg text-xs bg-slate-800 hover:bg-slate-900 text-white" data-testid="plan-save">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Guardar plan"}
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
      toast.error("Escribe un monto válido");
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
      toast.success("Solicitud creada. ¡Compártela con tu cliente!");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo crear la solicitud");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (rid) => {
    if (!window.confirm("¿Borrar esta solicitud de pago?")) return;
    try {
      await api.delete(`/payment-requests/${rid}`);
      toast.success("Solicitud eliminada");
      load();
    } catch {
      toast.error("No se pudo eliminar");
    }
  };

  const linkFor = (rid) => `${window.location.origin}/p/pay/${rid}`;
  const copyLink = (rid) => {
    navigator.clipboard?.writeText(linkFor(rid));
    toast.success("Link copiado");
  };
  const shareWhatsApp = (req) => {
    const msg = `Hola! Aquí está tu solicitud de pago${req.description ? ` (${req.description})` : ""} por $${Number(req.amount).toFixed(2)}: ${linkFor(req.id)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  };

  return (
    <Card className="card-elevated p-5 border-0 shadow-none space-y-4" data-testid="payment-requests-card">
      <div className="flex items-center gap-2">
        <Receipt className="w-5 h-5 text-indigo-600" />
        <div>
          <h3 className="font-heading font-bold text-base">Pedir un pago</h3>
          <p className="text-xs text-slate-500">Manda un "papelito" de cobro con todas las formas de pago.</p>
        </div>
      </div>

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
              Pedir {it.label}: ${Number(it.amount).toFixed(2)}
            </button>
          ))}
        </div>
      )}

      {/* Create form */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Monto ($)</Label>
          <Input type="number" step="0.01" value={amount} onChange={(e) => { setAmount(e.target.value); setPlanItemId(null); }} placeholder="0.00" className="h-11 rounded-xl mt-1" data-testid="pr-amount-input" />
        </div>
        <div>
          <Label className="text-xs">Descripción</Label>
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ej: Pago 1 de 4" className="h-11 rounded-xl mt-1" data-testid="pr-desc-input" />
        </div>
      </div>
      <Button onClick={create} disabled={busy} className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold" data-testid="pr-create-btn">
        {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />} Crear solicitud de pago
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
                  {r.status === "paid" ? "Pagado" : "Pendiente"}
                </span>
              </div>
              {r.status !== "paid" && (
                <div className="flex items-center gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={() => copyLink(r.id)} className="h-8 rounded-lg text-xs flex-1" data-testid={`pr-copy-${r.id}`}>
                    <Copy className="w-3.5 h-3.5 mr-1" /> Copiar link
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
    </Card>
  );
}


// ============================================================================
// JobFromInvoiceCard — "Crear Trabajo" from an invoice (when the quote step was
// skipped). Idempotent: shows the linked job if one already exists.
// ============================================================================
function JobFromInvoiceCard({ invoiceId }) {
  const navigate = useNavigate();
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
      toast.success(data.created ? "Trabajo creado — ya lo puedes agendar" : "Ya existía un trabajo para este invoice");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo crear el trabajo");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;

  return (
    <Card className="card-elevated p-5 border-0 shadow-none space-y-3" data-testid="job-from-invoice-card">
      <div className="flex items-center gap-2">
        <Briefcase className="w-5 h-5 text-emerald-600" />
        <div>
          <h3 className="font-heading font-bold text-base">Trabajo</h3>
          <p className="text-xs text-slate-500">
            {job ? "Ya hay un trabajo ligado a este invoice." : "Crea un trabajo para poder agendarlo en tu calendario."}
          </p>
        </div>
      </div>

      {job ? (
        <Button
          onClick={() => navigate("/trabajos")}
          className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          data-testid="goto-job-btn"
        >
          <CalendarClock className="w-4 h-4 mr-1.5" /> Ir a agendar el trabajo
        </Button>
      ) : (
        <Button
          onClick={createJob}
          disabled={busy}
          className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          data-testid="create-job-btn"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />} Crear Trabajo
        </Button>
      )}
    </Card>
  );
}
