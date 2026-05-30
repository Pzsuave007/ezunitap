/**
 * PublicInvoice — public-facing invoice page accessible at /p/invoice/{id}.
 * Lets the client view, print, and download the PDF without needing an
 * account. Shows deposit + agreement terms if present.
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Hammer, FileDown, Printer, MapPin, Phone, Mail } from "lucide-react";
import { generateInvoicePDF, listAgreementClauses } from "@/lib/pdf";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const fmtMoney = (n) =>
  `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return ""; }
};

export default function PublicInvoice() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    axios.get(`${API}/public/invoices/${id}`)
      .then((r) => setData(r.data))
      .catch(() => setErr(true));
  }, [id]);

  const download = () => {
    if (!data) return;
    generateInvoicePDF(data.invoice, data.business, data.client);
  };

  if (err) return <div className="min-h-screen flex items-center justify-center text-slate-500">Invoice not found.</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const { invoice, business, client, payment_methods } = data;
  const dep = Number(invoice.deposit_amount) || 0;
  const balance = Math.max(0, Number(invoice.total) - dep);
  const terms = invoice.agreement_terms;
  const sections = terms?.sections || {};
  const statusLabel = {
    draft: "Draft", sent: "Sent", paid: "Paid", partial: "Partial", overdue: "Overdue",
  }[invoice.status] || invoice.status;
  const statusColor = {
    paid: "bg-emerald-500", overdue: "bg-red-500", partial: "bg-amber-500",
    sent: "bg-blue-500", draft: "bg-slate-400",
  }[invoice.status] || "bg-slate-400";

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-10 print:p-0 print:bg-white">
      <div className="max-w-3xl mx-auto">
        {/* Action bar (hidden when printing) */}
        <div className="flex items-center justify-end gap-2 mb-4 print:hidden">
          <Button onClick={download} variant="outline" className="rounded-xl" data-testid="public-download-pdf">
            <FileDown className="w-4 h-4 mr-1" /> Download PDF
          </Button>
          <Button onClick={() => window.print()} className="rounded-xl bg-blue-900 hover:bg-blue-950 text-white" data-testid="public-print">
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
        </div>

        <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden print:shadow-none print:border-0">
          <div className="bg-gradient-to-br from-blue-900 to-blue-800 text-white p-6 print:bg-blue-900">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Hammer className="w-5 h-5" />
                  <h1 className="font-heading text-2xl font-bold">{business?.business_name || "Invoice"}</h1>
                </div>
                <div className="text-sm text-white/80 space-y-0.5">
                  {business?.owner_name && <div>{business.owner_name}</div>}
                  {business?.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {business.phone}</div>}
                  {business?.business_email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {business.business_email}</div>}
                  {business?.business_address && <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {business.business_address}</div>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider opacity-80">Invoice</div>
                <div className="font-heading text-2xl font-bold">{invoice.number}</div>
                <div className="text-xs mt-1">{fmtDate(invoice.created_at)}</div>
                <div className={`inline-flex mt-2 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${statusColor}`}>
                  {statusLabel}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Bill to</div>
              <div className="font-semibold">{client?.name}</div>
              <div className="text-sm text-slate-600 space-y-0.5">
                {client?.phone && <div>{client.phone}</div>}
                {client?.email && <div>{client.email}</div>}
                {client?.address && <div>{client.address}</div>}
              </div>
            </div>

            <div>
              <h2 className="font-heading text-lg font-bold">{invoice.job_title}</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 pr-2 text-xs uppercase tracking-wider text-slate-500 font-semibold">Description</th>
                    <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-slate-500 font-semibold">Qty</th>
                    <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-slate-500 font-semibold">Unit</th>
                    <th className="text-right py-2 pl-2 text-xs uppercase tracking-wider text-slate-500 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoice.line_items || []).map((li, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-2 pr-2">{li.description}</td>
                      <td className="py-2 px-2 text-right">{li.quantity}</td>
                      <td className="py-2 px-2 text-right">{fmtMoney(li.unit_price)}</td>
                      <td className="py-2 pl-2 text-right font-semibold">{fmtMoney(li.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ml-auto max-w-xs space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Subtotal</span><span>{fmtMoney(invoice.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Tax</span><span>{fmtMoney(invoice.tax_amount)}</span></div>
              <div className="flex justify-between text-lg pt-2 border-t border-slate-200 mt-2">
                <span className="font-heading font-bold">TOTAL</span>
                <span className="font-heading font-bold">{fmtMoney(invoice.total)}</span>
              </div>
              {dep > 0 && (
                <>
                  <div className="flex justify-between text-amber-700 pt-2 border-t border-slate-200 mt-2">
                    <span className="font-semibold">Deposit due upfront</span>
                    <span className="font-bold">{fmtMoney(dep)}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Balance after deposit</span>
                    <span className="font-semibold">{fmtMoney(balance)}</span>
                  </div>
                </>
              )}
              {invoice.amount_paid > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Paid</span><span className="font-semibold">{fmtMoney(invoice.amount_paid)}</span>
                </div>
              )}
            </div>

            {invoice.notes && (
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Notes</div>
                <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}

            {terms && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 print:border-slate-300 print:bg-white">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center flex-none print:bg-emerald-700">
                    <span className="text-white text-lg">✓</span>
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-emerald-900 text-sm">
                      Per signed Service Agreement
                    </div>
                    <div className="text-xs text-emerald-800 mt-0.5">
                      {terms.signer_name && <>Signed by <strong>{terms.signer_name}</strong></>}
                      {terms.signed_at && <> on <strong>{fmtDate(terms.signed_at)}</strong></>}
                    </div>
                    {dep > 0 && (
                      <div className="text-xs text-emerald-800 mt-1">
                        Deposit required: <strong>{fmtMoney(dep)}</strong> due before work begins.
                      </div>
                    )}
                    {invoice.agreement_id && (
                      <a
                        href={`/p/agreement/${invoice.agreement_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-xs font-semibold text-emerald-700 hover:text-emerald-900 mt-2 underline print:hidden"
                      >
                        View signed agreement →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        <InvoicePayBlock
          invoice={invoice}
          methods={payment_methods || {}}
          business={business}
        />

        <div className="text-center text-xs text-slate-400 mt-4 print:hidden">
          Powered by Unitap
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// InvoicePayBlock — Renders pay-by-app buttons on the public invoice for any
// payment methods the business owner has enabled in Settings.
// ============================================================================
function InvoicePayBlock({ invoice, methods, business }) {
  const [marking, setMarking] = useState(false);
  const [done, setDone] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [chosen, setChosen] = useState("");
  const [payerName, setPayerName] = useState(invoice.client_name || "");
  const [note, setNote] = useState("");

  // Don't render if already paid or no methods enabled
  if (invoice.status === "paid") return null;
  const enabled = Object.entries(methods).filter(([, v]) => v?.enabled);
  if (enabled.length === 0) return null;

  const handlePay = (key, value) => {
    setChosen(key);
    setShowForm(true);
    const v = (value || "").trim();
    const clean = v.replace(/^[@$]/, "");
    let url = "";
    if (key === "venmo" && clean) {
      url = `https://venmo.com/u/${clean}`;
    } else if (key === "paypal" && clean) {
      url = `https://paypal.me/${clean}/${Math.max(0, Number(invoice.total) || 0)}`;
    } else if (key === "cashapp" && clean) {
      url = `https://cash.app/$${clean}`;
    }
    if (url) window.open(url, "_blank", "noopener");
  };

  const submitMarkPaid = async () => {
    if (!chosen) return;
    setMarking(true);
    try {
      await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/public/invoices/${invoice.id}/mark-paid-notice`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method: chosen, payer_name: payerName, note }),
        }
      );
      setDone(true);
    } catch {
      // Silent — user can retry
    } finally {
      setMarking(false);
    }
  };

  const METHOD_LABELS = {
    venmo: { label: "Pay with Venmo", color: "bg-sky-500 hover:bg-sky-600", letter: "V" },
    paypal: { label: "Pay with PayPal", color: "bg-blue-700 hover:bg-blue-800", letter: "P" },
    cashapp: { label: "Pay with Cash App", color: "bg-emerald-600 hover:bg-emerald-700", letter: "$" },
    zelle: { label: "Pay with Zelle", color: "bg-violet-600 hover:bg-violet-700", letter: "Z" },
    cash: { label: "Pay in Cash", color: "bg-slate-700 hover:bg-slate-800", letter: "💵" },
    check: { label: "Pay by Check", color: "bg-amber-600 hover:bg-amber-700", letter: "📝" },
  };

  return (
    <Card className="card-elevated p-5 border-0 shadow-none mt-4 print:hidden" data-testid="invoice-pay-block">
      <h3 className="font-heading font-bold text-base mb-1">
        Pay this invoice
      </h3>
      <p className="text-xs text-slate-500 mb-4">
        Choose your preferred payment method below.
      </p>

      <div className="space-y-2">
        {enabled.map(([key, entry]) => {
          const meta = METHOD_LABELS[key];
          const v = (entry.value || "").trim();
          const showCopyable = key === "zelle" || key === "cash" || key === "check";
          return (
            <div key={key} className="rounded-xl border border-slate-200 overflow-hidden">
              <button
                data-testid={`pay-${key}`}
                onClick={() => handlePay(key, v)}
                disabled={showCopyable}
                className={`w-full ${meta.color} text-white p-3 flex items-center gap-3 text-left transition disabled:opacity-90 disabled:cursor-default`}
              >
                <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center font-bold flex-none">
                  {meta.letter}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm">{meta.label}</div>
                  {v && (
                    <div className="text-xs opacity-90 mt-0.5">
                      {key === "venmo" && `@${v.replace(/^@/, "")}`}
                      {key === "paypal" && `paypal.me/${v}`}
                      {key === "cashapp" && `${v.startsWith("$") ? "" : "$"}${v}`}
                      {key === "zelle" && `Send to: ${v}`}
                      {key === "check" && v}
                    </div>
                  )}
                  {!v && entry.note && (
                    <div className="text-xs opacity-90 mt-0.5">{entry.note}</div>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {done ? (
        <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
          ✅ <strong>Thanks!</strong> {business?.business_name || "The business owner"} has
          been notified. They'll confirm receipt of your payment shortly.
        </div>
      ) : !showForm ? (
        <button
          data-testid="open-mark-paid"
          onClick={() => setShowForm(true)}
          className="w-full mt-4 text-xs text-emerald-700 hover:text-emerald-900 font-semibold underline"
        >
          ✓ I've already paid — let them know
        </button>
      ) : (
        <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="text-sm font-semibold">
            Let {business?.business_name || "the owner"} know you paid:
          </div>
          {!chosen && (
            <select
              data-testid="paid-method"
              value={chosen}
              onChange={(e) => setChosen(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm"
            >
              <option value="">— Method used —</option>
              {enabled.map(([key]) => (
                <option key={key} value={key}>{METHOD_LABELS[key]?.label || key}</option>
              ))}
              <option value="other">Other</option>
            </select>
          )}
          <input
            type="text"
            data-testid="paid-name"
            value={payerName}
            onChange={(e) => setPayerName(e.target.value)}
            placeholder="Your name"
            className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm"
          />
          <textarea
            data-testid="paid-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional: confirmation number, time of payment, etc."
            rows={2}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
          />
          <button
            data-testid="submit-paid"
            onClick={submitMarkPaid}
            disabled={marking || !chosen}
            className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50"
          >
            {marking ? "Sending..." : "Notify business"}
          </button>
        </div>
      )}
    </Card>
  );
}
