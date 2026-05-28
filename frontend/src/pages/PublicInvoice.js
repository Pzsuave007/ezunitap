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

  const { invoice, business, client } = data;
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

        <div className="text-center text-xs text-slate-400 mt-4 print:hidden">
          Powered by Unitap
        </div>
      </div>
    </div>
  );
}
