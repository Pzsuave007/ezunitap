import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, FileSignature, CheckCircle2, Eraser, PenLine, FileDown, Printer } from "lucide-react";
import SignaturePad from "@/components/SignaturePad";
import { generateAgreementPDF } from "@/lib/pdf";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PublicAgreement() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const [mode, setMode] = useState(null); // null | "drawn" | "button"
  const [signerName, setSignerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);
  const padRef = useRef(null);

  useEffect(() => {
    axios.get(`${API}/public/agreements/${id}`)
      .then((r) => {
        setData(r.data);
        if (r.data.agreement.status === "signed") setSigned(true);
      })
      .catch(() => setErr(true));
  }, [id]);

  const submit = async () => {
    if (!signerName.trim()) { alert("Please enter your full name."); return; }
    setSubmitting(true);
    try {
      const body = { method: mode, signer_name: signerName.trim() };
      if (mode === "drawn") {
        const sig = padRef.current?.getDataURL();
        if (!sig) { alert("Please draw your signature."); setSubmitting(false); return; }
        body.signature_image = sig;
      }
      await axios.post(`${API}/public/agreements/${id}/sign`, body);
      setSigned(true);
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed to sign. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (err) return <div className="min-h-screen flex items-center justify-center text-slate-500">Agreement not found.</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const { agreement, business, client } = data;
  const sections = agreement.sections || {};

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-10 print:p-0 print:bg-white">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-end gap-2 mb-4 print:hidden">
          <Button
            onClick={() => generateAgreementPDF(agreement, business, client)}
            variant="outline"
            className="rounded-xl"
            data-testid="public-agreement-download-pdf"
          >
            <FileDown className="w-4 h-4 mr-1" /> Download PDF
          </Button>
          <Button
            onClick={() => window.print()}
            className="rounded-xl bg-blue-900 hover:bg-blue-950 text-white"
            data-testid="public-agreement-print"
          >
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
        </div>
        <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden print:shadow-none print:border-0">
          {/* Header */}
          <div className="bg-gradient-to-br from-blue-900 to-blue-800 text-white p-6">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FileSignature className="w-5 h-5" />
                  <h1 className="font-heading text-2xl font-bold">{business?.business_name || "Service Agreement"}</h1>
                </div>
                <div className="text-sm text-white/80 space-y-0.5">
                  {business?.business_email && <div>{business.business_email}</div>}
                  {business?.phone && <div>{business.phone}</div>}
                  {business?.business_address && <div>{business.business_address}</div>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-heading font-bold">AGREEMENT</div>
                <div className="text-sm text-white/80 mt-1">#{agreement.number}</div>
                <div className="text-sm text-white/80">{new Date(agreement.created_at).toLocaleDateString("en-US")}</div>
              </div>
            </div>
          </div>

          {/* Parties */}
          <div className="p-6 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Service Provider</div>
                <div className="font-semibold">{business?.business_name}</div>
                {business?.business_address && <div className="text-sm text-slate-600">{business.business_address}</div>}
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Client</div>
                <div className="font-semibold">{client?.name}</div>
                {client?.address && <div className="text-sm text-slate-600">{client.address}</div>}
              </div>
            </div>

            <h2 className="font-heading text-xl font-bold">{agreement.title}</h2>
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

            {/* Signature block */}
            {signed ? (
              <div data-testid="public-signed-block" className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-5 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                <div className="font-heading text-xl font-bold text-emerald-800">Agreement Signed</div>
                <p className="text-sm text-emerald-700 mt-1">
                  Thank you! A signed copy has been recorded. {business?.business_name} will follow up shortly.
                </p>
              </div>
            ) : (
              <div data-testid="public-sign-block" className="rounded-xl border-2 border-blue-200 bg-blue-50/40 p-5 space-y-4">
                <div className="text-center">
                  <h3 className="font-heading text-lg font-bold text-slate-900">Sign this Agreement</h3>
                  <p className="text-xs text-slate-600 mt-1">By signing, you agree to the terms above.</p>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Your Full Name *</label>
                  <input
                    data-testid="signer-name-input"
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="John Smith"
                    className="mt-1 w-full h-11 rounded-xl border border-slate-300 px-3 bg-white"
                  />
                </div>

                {/* Mode selector */}
                {!mode && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      data-testid="choose-drawn"
                      onClick={() => setMode("drawn")}
                      className="h-12 rounded-xl bg-blue-900 hover:bg-blue-950 text-white"
                    >
                      <PenLine className="w-4 h-4 mr-2" /> Sign with finger
                    </Button>
                    <Button
                      data-testid="choose-button"
                      onClick={() => setMode("button")}
                      variant="outline"
                      className="h-12 rounded-xl border-slate-300"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" /> I Accept
                    </Button>
                  </div>
                )}

                {mode === "drawn" && (
                  <div className="space-y-2">
                    <SignaturePad ref={padRef} height={180} />
                    <div className="flex justify-between items-center">
                      <button
                        data-testid="clear-signature"
                        onClick={() => padRef.current?.clear()}
                        className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                      >
                        <Eraser className="w-3 h-3" /> Clear
                      </button>
                      <button
                        data-testid="switch-to-button"
                        onClick={() => setMode("button")}
                        className="text-xs text-blue-700 hover:underline"
                      >
                        Use "I Accept" instead
                      </button>
                    </div>
                    <Button
                      data-testid="submit-drawn"
                      onClick={submit}
                      disabled={submitting}
                      className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold"
                    >
                      {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign & Submit"}
                    </Button>
                  </div>
                )}

                {mode === "button" && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-600 text-center">
                      Clicking <strong>I Accept &amp; Submit</strong> below is your electronic signature and is
                      legally binding under the U.S. ESIGN Act.
                    </p>
                    <button
                      data-testid="switch-to-drawn"
                      onClick={() => setMode("drawn")}
                      className="text-xs text-blue-700 hover:underline w-full text-center"
                    >
                      Prefer to sign with your finger?
                    </button>
                    <Button
                      data-testid="submit-button"
                      onClick={submit}
                      disabled={submitting}
                      className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold"
                    >
                      {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "I Accept & Submit"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
        <div className="text-center text-xs text-slate-400 mt-4">Powered by Unitap AI</div>
      </div>
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
