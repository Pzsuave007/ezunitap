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
import { ArrowLeft, Download, Share2, FileDown, MoreVertical, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quote, setQuote] = useState(null);
  const [client, setClient] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const q = await api.get(`/quotes/${id}`);
      setQuote(q.data);
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

  const downloadPDF = () => generateQuotePDF(quote, user, client);

  const shareLink = async () => {
    const url = `${window.location.origin}/p/quote/${quote.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado al portapapeles");
    } catch {
      window.prompt("Link público:", url);
    }
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
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-5">
          <Button data-testid="download-pdf" onClick={downloadPDF} variant="outline" className="h-12 rounded-xl border-slate-200">
            <FileDown className="w-4 h-4 mr-1" /> PDF
          </Button>
          <Button data-testid="share-link" onClick={shareLink} variant="outline" className="h-12 rounded-xl border-slate-200">
            <Share2 className="w-4 h-4 mr-1" /> Compartir
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
    </div>
  );
}
