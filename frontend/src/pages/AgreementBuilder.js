import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, ArrowLeft, FileSignature } from "lucide-react";
import { toast } from "sonner";

export default function AgreementBuilder() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState("");
  const [description, setDescription] = useState("");
  const [total, setTotal] = useState("");
  const [deposit, setDeposit] = useState("");
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/clients");
        setClients(r.data);
      } catch (e) { console.error(e); }
    })();
  }, []);

  const generate = async () => {
    if (!clientId) { toast.error("Selecciona un cliente"); return; }
    if (!description.trim()) { toast.error("Describe el servicio"); return; }
    setLoading(true);
    try {
      const { data } = await api.post("/ai/agreement", {
        client_id: clientId,
        description_es: description,
        total: parseFloat(total) || 0,
        deposit: parseFloat(deposit) || 0,
      });
      setSections(data);
      toast.success("Contrato generado");
    } catch (e) {
      console.error(e);
      toast.error("La AI no pudo generar el contrato. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!sections) return;
    setSaving(true);
    try {
      const { data } = await api.post("/agreements", {
        client_id: clientId,
        title: sections.title || "Service Agreement",
        description_es: description,
        sections,
        total: parseFloat(total) || 0,
        deposit: parseFloat(deposit) || 0,
        status: "draft",
      });
      toast.success("Contrato guardado");
      navigate(`/contratos/${data.id}`);
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
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

      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Nuevo Contrato con AI</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Describe el servicio en español. La AI te arma el contrato profesional en inglés con cláusulas
          que te protegen legalmente.
        </p>
      </div>

      <Card className="card-elevated p-5 border-0 shadow-none space-y-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Cliente *</label>
          <select
            data-testid="agreement-client-select"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="mt-1 w-full h-11 rounded-xl border border-slate-200 px-3 bg-white"
          >
            <option value="">— Selecciona un cliente —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Descripción del servicio (español) *
          </label>
          <textarea
            data-testid="agreement-description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: Corte de zacate semanal, edging del jardín delantero y trasero, recoger hojas. Servicio recurrente cada lunes."
            className="mt-1 w-full rounded-xl border border-slate-200 p-3 bg-white text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Total ($)</label>
            <input
              data-testid="agreement-total"
              type="number" step="0.01"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              placeholder="0.00"
              className="mt-1 w-full h-11 rounded-xl border border-slate-200 px-3 bg-white"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Depósito ($)</label>
            <input
              data-testid="agreement-deposit"
              type="number" step="0.01"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              placeholder="0.00"
              className="mt-1 w-full h-11 rounded-xl border border-slate-200 px-3 bg-white"
            />
          </div>
        </div>

        <Button
          data-testid="agreement-generate-btn"
          onClick={generate}
          disabled={loading}
          className="w-full h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-base font-bold gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          {loading ? "Generando…" : "Generar contrato con AI"}
        </Button>
      </Card>

      {sections && (
        <Card data-testid="agreement-preview" className="card-elevated p-5 border-0 shadow-none space-y-4">
          <div className="flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-emerald-700" />
            <h2 className="font-heading text-xl font-bold">Vista previa (inglés)</h2>
          </div>

          <h3 className="font-bold text-lg">{sections.title}</h3>
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

          <Button
            data-testid="agreement-save-btn"
            onClick={save}
            disabled={saving}
            className="w-full h-12 rounded-xl bg-blue-900 hover:bg-blue-950 text-white text-base font-bold gap-2"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            Guardar contrato
          </Button>
        </Card>
      )}
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
