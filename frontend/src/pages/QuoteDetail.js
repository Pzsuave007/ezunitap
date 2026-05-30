import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import StatusBadge from "@/components/StatusBadge";
import { generateQuotePDF } from "@/lib/pdf";
import { ArrowLeft, Download, Send, FileDown, MoreVertical, Loader2, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import SendDocumentDialog from "@/components/SendDocumentDialog";

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quote, setQuote] = useState(null);
  const [client, setClient] = useState(null);
  const [card, setCard] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);

  const load = async () => {
    try {
      const [q, cardRes] = await Promise.all([
        api.get(`/quotes/${id}`),
        api.get("/card/settings").catch(() => ({ data: null })),
      ]);
      setQuote(q.data);
      setCard(cardRes.data);
      // Client fetch is best-effort: if client was deleted, we still show the quote
      if (q.data.client_id) {
        try {
          const c = await api.get(`/clients/${q.data.client_id}`);
          setClient(c.data);
        } catch {
          setClient(null);
        }
      }
    } catch {
      toast.error("Quote no encontrado");
      navigate("/quotes");
    }
  };
  useEffect(() => { load(); }, [id]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/quotes/${id}`, { ...quote, client_id: quote.client_id });
      toast.success("Guardado");
    } catch {
      toast.error("Error");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status) => {
    const { data } = await api.post(`/quotes/${id}/status?status=${status}`);
    setQuote(data);
    toast.success("Estado actualizado");
  };

  const convert = async () => {
    if (!window.confirm("¿Convertir este quote en invoice?")) return;
    const { data } = await api.post(`/quotes/${id}/convert`);
    toast.success("Convertido a invoice");
    navigate(`/invoices/${data.id}`);
  };

  const downloadPDF = () => generateQuotePDF(quote, { ...user, logo_photo_id: card?.logo_photo_id }, client);

  const deleteQuote = async () => {
    if (!window.confirm(`¿Borrar el quote ${quote.number}? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/quotes/${id}`);
      toast.success("Quote borrado");
      navigate("/quotes");
    } catch {
      toast.error("Error al borrar");
    }
  };

  const openSend = () => {
    // Auto-mark as 'sent' the first time the user opens the share dialog so
    // the flow status reflects reality.
    if (quote && quote.status === "draft") {
      setStatus("sent");
    }
    setSendOpen(true);
  };

  if (!quote) return <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-5">
      <button onClick={() => navigate("/quotes")} className="flex items-center gap-2 text-sm text-slate-600 tap" data-testid="back-quotes">
        <ArrowLeft className="w-4 h-4" /> Quotes
      </button>

      <Card className="card-elevated p-5 border-0 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-bold text-slate-500">{quote.number}</span>
              <StatusBadge kind="quote" status={quote.status} />
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">{quote.job_title}</h1>
            <div className="text-sm text-slate-500 mt-1">Para: {client?.name}</div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-xl" data-testid="quote-menu"><MoreVertical className="w-4 h-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem onClick={() => setStatus("draft")}>Marcar Borrador</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatus("sent")} data-testid="mark-sent">Marcar Enviado</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatus("approved")} data-testid="mark-approved">Marcar Aprobado</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatus("declined")}>Marcar Rechazado</DropdownMenuItem>
              <DropdownMenuItem
                data-testid="quote-delete"
                onClick={deleteQuote}
                className="text-red-600 focus:text-red-700 focus:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Borrar quote
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-5">
          <Button data-testid="download-pdf" onClick={downloadPDF} variant="outline" className="h-12 rounded-xl border-slate-200">
            <FileDown className="w-4 h-4 mr-1" /> PDF
          </Button>
          <Button data-testid="share-link" onClick={openSend} className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
            <Send className="w-4 h-4 mr-1" /> Mandar Quote
          </Button>
          <Button
            data-testid="convert-invoice"
            onClick={convert}
            disabled={quote.status === "converted"}
            className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Receipt className="w-4 h-4 mr-1" /> A Invoice
          </Button>
        </div>
      </Card>

      <Card className="card-elevated p-5 border-0 shadow-none space-y-3">
        <div>
          <Label>Description</Label>
          <Textarea value={quote.description || ""} onChange={(e) => setQuote({ ...quote, description: e.target.value })} className="rounded-xl mt-1.5" />
        </div>
        <div>
          <Label>Scope of Work</Label>
          <Textarea
            value={(quote.scope_of_work || []).join("\n")}
            onChange={(e) => setQuote({ ...quote, scope_of_work: e.target.value.split("\n").filter(Boolean) })}
            className="rounded-xl mt-1.5 min-h-[100px]"
          />
        </div>
        <div>
          <Label>Payment Terms</Label>
          <Input value={quote.payment_terms || ""} onChange={(e) => setQuote({ ...quote, payment_terms: e.target.value })} className="h-12 rounded-xl mt-1.5" />
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea value={quote.notes || ""} onChange={(e) => setQuote({ ...quote, notes: e.target.value })} className="rounded-xl mt-1.5" />
        </div>

        {/* Embedded mini-agreement — when present + require_signature=true, the
            public quote page asks the client to sign and auto-creates the
            invoice on accept. Saves a step vs. sending a separate Agreement. */}
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <Label className="text-emerald-900 font-bold text-base">
                Términos cortos del trabajo
              </Label>
              <p className="text-xs text-emerald-700/80 mt-0.5">
                Acuerdo simple embebido — al activar firma, el cliente acepta
                el quote y firma todo en un paso (sin acuerdo separado).
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                data-testid="require-sig"
                checked={!!quote.require_signature}
                onChange={(e) => setQuote({ ...quote, require_signature: e.target.checked })}
                className="w-4 h-4 accent-emerald-600"
              />
              <span className="font-semibold text-emerald-900">Pedir firma</span>
            </label>
          </div>

          {[
            { k: "what_is_included",     label: "Qué incluye",          ph: "Materiales, mano de obra, limpieza..." },
            { k: "what_is_not_included", label: "Qué NO incluye",       ph: "Permisos, demolición, etc." },
            { k: "payment_terms",        label: "Forma de pago",        ph: "50% al inicio, 50% al terminar" },
            { k: "warranty",             label: "Garantía",             ph: "1 año en mano de obra" },
            { k: "change_order_note",    label: "Cambios al proyecto",  ph: "Cualquier cambio se cotizará por separado" },
          ].map(({ k, label, ph }) => (
            <div key={k}>
              <Label className="text-xs text-slate-600">{label}</Label>
              <Textarea
                data-testid={`terms-${k}`}
                value={(quote.terms || {})[k] || ""}
                onChange={(e) => setQuote({
                  ...quote,
                  terms: { ...(quote.terms || {}), [k]: e.target.value },
                })}
                placeholder={ph}
                rows={2}
                className="rounded-lg mt-1 text-sm bg-white"
              />
            </div>
          ))}
        </div>

        <div className="bg-slate-50 rounded-xl p-4 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-slate-600">Subtotal</span><span className="font-semibold">${quote.subtotal?.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Tax</span><span className="font-semibold">${quote.tax_amount?.toFixed(2)}</span></div>
          <div className="flex justify-between text-lg pt-2 border-t border-slate-200 mt-2"><span className="font-heading font-bold">TOTAL</span><span className="font-heading font-bold">${quote.total?.toFixed(2)}</span></div>
          {quote.deposit_amount > 0 && <div className="flex justify-between text-emerald-700"><span>Deposit</span><span className="font-semibold">${quote.deposit_amount.toFixed(2)}</span></div>}
        </div>

        <Button onClick={save} disabled={saving} data-testid="save-quote-edit" className="w-full h-14 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-semibold">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Guardar cambios"}
        </Button>
      </Card>

      <SendDocumentDialog
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        kind="quote"
        publicUrl={`${window.location.origin}/p/quote/${quote.id}`}
        client={client}
        businessName={user?.business_name}
        jobTitle={quote.job_title}
      />
    </div>
  );
}
