import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, FileSignature, CheckCircle2, Trash2, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABEL = { draft: "Borrador", sent: "Enviado", signed: "Firmado", declined: "Rechazado" };
const STATUS_STYLES = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-blue-100 text-blue-800",
  signed: "bg-emerald-100 text-emerald-800",
  declined: "bg-rose-100 text-rose-800",
};

export default function AgreementDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [a, setA] = useState(null);
  const [client, setClient] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get(`/agreements/${id}`);
      setA(data);
      if (data.client_id) {
        try {
          const c = await api.get(`/clients/${data.client_id}`);
          setClient(c.data);
        } catch { /* ignore */ }
      }
    } catch {
      toast.error("Contrato no encontrado");
      navigate("/contratos");
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (!a) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  const sections = a.sections || {};
  const publicLink = `${window.location.origin}/p/agreement/${a.id}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicLink);
      toast.success("Link copiado");
    } catch { toast.error("No se pudo copiar"); }
  };

  const markSent = async () => {
    setBusy(true);
    try {
      await api.put(`/agreements/${a.id}`, { ...a, status: "sent" });
      await load();
      toast.success("Marcado como enviado");
    } catch { toast.error("Error"); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm(`¿Borrar el contrato ${a.number}?`)) return;
    try {
      await api.delete(`/agreements/${a.id}`);
      toast.success("Contrato borrado");
      navigate("/contratos");
    } catch { toast.error("Error al borrar"); }
  };

  return (
    <div className="space-y-5">
      <button
        data-testid="back-btn"
        onClick={() => navigate("/contratos")}
        className="flex items-center gap-1 text-sm text-slate-600 hover:text-blue-900"
      >
        <ArrowLeft className="w-4 h-4" /> Contratos
      </button>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-heading text-3xl font-bold tracking-tight">{a.title}</h1>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${STATUS_STYLES[a.status]}`}>
              {STATUS_LABEL[a.status]}
            </span>
          </div>
          <p className="text-slate-500 mt-1 text-sm">
            {a.number} · {client?.name || "Cliente"} · ${(a.total || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <button
          data-testid="delete-agreement-btn"
          onClick={remove}
          className="p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"
          aria-label="Borrar"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Public link / share */}
      <Card className="card-elevated p-4 border-0 shadow-none">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Link para el cliente</div>
        <div className="flex items-center gap-2 flex-wrap">
          <code data-testid="public-link" className="flex-1 min-w-0 truncate text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono">
            {publicLink}
          </code>
          <Button
            data-testid="copy-link-btn"
            onClick={copyLink}
            variant="outline"
            className="rounded-xl h-10"
          >
            <Copy className="w-4 h-4 mr-1" /> Copiar
          </Button>
          {a.status === "draft" && (
            <Button
              data-testid="mark-sent-btn"
              onClick={markSent}
              disabled={busy}
              className="rounded-xl h-10 bg-blue-900 hover:bg-blue-950 text-white"
            >
              <Send className="w-4 h-4 mr-1" /> Marcar enviado
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Mándale este link al cliente por WhatsApp/SMS. Lo abre en su celular y firma con el dedo
          o con un clic. Se queda registrado con fecha y hora.
        </p>
      </Card>

      {/* Signature status */}
      {a.status === "signed" && (
        <Card data-testid="signed-block" className="card-elevated p-4 border-0 shadow-none border-l-4 border-emerald-500 bg-emerald-50/40">
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-bold">Firmado</span>
            <span className="text-xs text-emerald-700">
              · {new Date(a.signed_at).toLocaleString("es-MX")} · método: {a.signed_method === "drawn" ? "firma con dedo" : "botón Acepto"}
            </span>
          </div>
          {a.signer_name && <div className="text-xs text-emerald-700 mt-1">Firmado por: {a.signer_name}</div>}
          {a.signature_image && (
            <img
              data-testid="signature-image"
              src={a.signature_image}
              alt="Firma del cliente"
              className="mt-3 max-w-xs border border-emerald-200 rounded-lg bg-white"
            />
          )}
        </Card>
      )}

      {/* Agreement content preview (English) */}
      <Card className="card-elevated p-5 border-0 shadow-none space-y-4">
        <div className="flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-emerald-700" />
          <h2 className="font-heading text-xl font-bold">Contenido del contrato (inglés)</h2>
        </div>

        {sections.preamble && <p className="text-sm text-slate-700">{sections.preamble}</p>}
        <Section title="Services Included" items={sections.services_included} />
        <Section title="Services Excluded" items={sections.services_excluded} />
        <Field title="Schedule" text={sections.schedule} />
        <Field title="Pricing" text={sections.pricing} />
        <Field title="Payment Terms" text={sections.payment_terms} />
        <Field title="Cancellation Policy" text={sections.cancellation_policy} />
        <Section title="Client Responsibilities" items={sections.client_responsibilities} />
        <Field title="Warranty" text={sections.warranty} />
        <Field title="Liability & Indemnity" text={sections.liability_and_indemnity} />
        <Field title="Insurance" text={sections.insurance_statement} />
        <Field title="Change Orders" text={sections.change_orders} />
        <Field title="Dispute Resolution" text={sections.dispute_resolution} />
        <Section title="Industry-Specific Clauses" items={sections.industry_specific_clauses} />
      </Card>
    </div>
  );
}

const Section = ({ title, items }) => {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{title}</div>
      <ul className="list-disc ml-5 space-y-1 text-sm text-slate-800">
        {items.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </div>
  );
};

const Field = ({ title, text }) => {
  if (!text) return null;
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{title}</div>
      <p className="text-sm text-slate-800 whitespace-pre-wrap">{text}</p>
    </div>
  );
};
