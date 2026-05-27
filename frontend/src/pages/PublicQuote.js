import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Hammer, CheckCircle2 } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const fmtMoney = (n) =>
  `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PublicQuote() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    axios.get(`${API}/public/quotes/${id}`)
      .then((r) => {
        setData(r.data);
        if (r.data?.quote?.status === "approved" || r.data?.quote?.status === "converted") {
          setAccepted(true);
        }
      })
      .catch(() => setErr(true));
  }, [id]);

  const accept = async () => {
    if (!window.confirm("By clicking Accept, you approve this quote and authorize the contractor to begin work. Continue?")) return;
    setAccepting(true);
    try {
      await axios.post(`${API}/public/quotes/${id}/accept`);
      setAccepted(true);
    } catch (e) {
      alert(e?.response?.data?.detail || "Could not accept this quote. Please try again.");
    } finally {
      setAccepting(false);
    }
  };

  if (err) return <div className="min-h-screen flex items-center justify-center text-slate-500">Quote not found.</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const { quote, business, client } = data;

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-10">
      <div className="max-w-3xl mx-auto">
        <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="bg-gradient-to-br from-blue-900 to-blue-800 text-white p-6">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Hammer className="w-5 h-5" />
                  <h1 className="font-heading text-2xl font-bold">{business?.business_name || "Quote"}</h1>
                </div>
                <div className="text-sm text-white/80 space-y-0.5">
                  {business?.business_email && <div>{business.business_email}</div>}
                  {business?.phone && <div>{business.phone}</div>}
                  {business?.business_address && <div>{business.business_address}</div>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-heading font-bold">QUOTE</div>
                <div className="text-sm text-white/80 mt-1">#{quote.number}</div>
                <div className="text-sm text-white/80">{new Date(quote.created_at).toLocaleDateString("en-US")}</div>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Bill To</div>
              <div className="font-semibold">{client?.name}</div>
              {client?.address && <div className="text-sm text-slate-600">{client.address}</div>}
              {client?.email && <div className="text-sm text-slate-600">{client.email}</div>}
              {client?.phone && <div className="text-sm text-slate-600">{client.phone}</div>}
            </div>

            <div>
              <h2 className="font-heading text-xl font-bold">{quote.job_title}</h2>
              {quote.description && <p className="text-slate-700 mt-2">{quote.description}</p>}
            </div>

            {quote.scope_of_work?.length > 0 && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Scope of Work</div>
                <ul className="list-disc ml-5 space-y-1 text-sm">
                  {quote.scope_of_work.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}

            {quote.line_items?.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-left">
                    <tr>
                      <th className="p-2 font-semibold">Description</th>
                      <th className="p-2 font-semibold text-right">Qty</th>
                      <th className="p-2 font-semibold text-right">Unit</th>
                      <th className="p-2 font-semibold text-right">Price</th>
                      <th className="p-2 font-semibold text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.line_items.map((li, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="p-2">{li.description}</td>
                        <td className="p-2 text-right">{li.quantity}</td>
                        <td className="p-2 text-right">{li.unit}</td>
                        <td className="p-2 text-right">{fmtMoney(li.unit_price)}</td>
                        <td className="p-2 text-right">{fmtMoney(li.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="bg-slate-50 rounded-xl p-4 space-y-1 text-sm ml-auto max-w-xs">
              <div className="flex justify-between"><span>Subtotal</span><span>{fmtMoney(quote.subtotal)}</span></div>
              <div className="flex justify-between"><span>Tax</span><span>{fmtMoney(quote.tax_amount)}</span></div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t mt-2"><span>TOTAL</span><span>{fmtMoney(quote.total)}</span></div>
              {quote.deposit_amount > 0 && <div className="flex justify-between text-emerald-700"><span>Deposit</span><span>{fmtMoney(quote.deposit_amount)}</span></div>}
            </div>

            {quote.payment_terms && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Payment Terms</div>
                <div className="text-sm">{quote.payment_terms}</div>
              </div>
            )}
            {quote.notes && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Notes</div>
                <div className="text-sm whitespace-pre-wrap">{quote.notes}</div>
              </div>
            )}

            {/* Accept block */}
            {accepted ? (
              <div data-testid="quote-accepted-block" className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-5 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                <div className="font-heading text-xl font-bold text-emerald-800">Quote Accepted</div>
                <p className="text-sm text-emerald-700 mt-1">
                  Thank you! {business?.business_name || "The contractor"} will follow up with a service agreement
                  to sign and confirm the project details.
                </p>
              </div>
            ) : (
              <div data-testid="quote-accept-block" className="rounded-xl border-2 border-blue-200 bg-blue-50/40 p-5 space-y-3">
                <div className="text-center">
                  <h3 className="font-heading text-lg font-bold text-slate-900">Ready to move forward?</h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Accepting this quote lets {business?.business_name || "the contractor"} prepare the service agreement.
                  </p>
                </div>
                <Button
                  data-testid="accept-quote-btn"
                  onClick={accept}
                  disabled={accepting}
                  className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold"
                >
                  {accepting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5 mr-2" /> Accept this Quote</>}
                </Button>
              </div>
            )}
          </div>
        </Card>
        <div className="text-center text-xs text-slate-400 mt-4">Powered by Unitap AI</div>
      </div>
    </div>
  );
}
