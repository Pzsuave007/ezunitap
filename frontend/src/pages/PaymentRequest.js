/**
 * PaymentRequest — public "payment slip" page at /p/pay/{id}.
 *
 * The contractor sends this focused coupon to a client to collect ONE specific
 * payment (e.g. "Pago 1 de 4"). Shows the amount, what it's for, project +
 * invoice reference, and every available payment option (manual methods +
 * Stripe card). On returning from Stripe it polls and confirms.
 */
import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Hammer, CreditCard, CheckCircle2, Receipt, Phone, Mail } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmtMoney = (n) =>
  `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const METHOD_LABELS = {
  venmo: { label: "Pay with Venmo", color: "bg-sky-500 hover:bg-sky-600", letter: "V" },
  paypal: { label: "Pay with PayPal", color: "bg-blue-700 hover:bg-blue-800", letter: "P" },
  cashapp: { label: "Pay with Cash App", color: "bg-emerald-600 hover:bg-emerald-700", letter: "$" },
  zelle: { label: "Pay with Zelle", color: "bg-violet-600 hover:bg-violet-700", letter: "Z" },
  cash: { label: "Pay in Cash", color: "bg-slate-700 hover:bg-slate-800", letter: "•" },
  check: { label: "Pay by Check", color: "bg-amber-600 hover:bg-amber-700", letter: "✓" },
};

export default function PaymentRequest() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);

  const fetchData = useCallback(() => {
    return axios.get(`${API}/public/payment-requests/${id}`)
      .then((r) => setData(r.data))
      .catch(() => setErr(true));
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Returning from Stripe → poll status (reuses the invoice status endpoint).
  useEffect(() => {
    const sid = new URLSearchParams(window.location.search).get("session_id");
    if (!sid) return;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const { data: st } = await axios.get(`${API}/public/invoices/checkout/status/${sid}`);
        if (st.payment_status === "paid") {
          toast.success("¡Pago recibido! Gracias. 🎉");
          window.history.replaceState({}, "", window.location.pathname);
          fetchData();
          return;
        }
      } catch { /* keep trying */ }
      if (attempts < 6) setTimeout(poll, 2000);
    };
    poll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <div className="min-h-screen flex items-center justify-center text-slate-500">Payment request not found.</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const { request, invoice, business, client, payment_methods, card_payment } = data;
  const isPaid = request.status === "paid";

  return (
    <div className="min-h-screen bg-slate-100 p-4 lg:p-10 flex items-start justify-center">
      <div className="w-full max-w-md">
        <Card className="bg-white border border-slate-200 shadow-lg rounded-3xl overflow-hidden" data-testid="payment-request-card">
          {/* Header */}
          <div className="bg-gradient-to-br from-indigo-700 to-indigo-900 text-white p-6">
            <div className="flex items-center gap-2 mb-3">
              <Hammer className="w-5 h-5" />
              <h1 className="font-heading text-xl font-bold">{business?.business_name || "Payment Request"}</h1>
            </div>
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-white/70">
              <Receipt className="w-3.5 h-3.5" /> Payment Request
            </div>
            <div className="font-heading text-4xl font-bold mt-1" data-testid="pr-amount">{fmtMoney(request.amount)}</div>
            {request.description && (
              <div className="text-sm text-white/85 mt-1">{request.description}</div>
            )}
          </div>

          {/* Details / coupon body */}
          <div className="p-6 space-y-4">
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm space-y-1.5">
              {client?.name && (
                <div className="flex justify-between"><span className="text-slate-500">For</span><span className="font-semibold text-slate-800">{client.name}</span></div>
              )}
              {invoice?.job_title && (
                <div className="flex justify-between"><span className="text-slate-500">Project</span><span className="font-semibold text-slate-800 text-right">{invoice.job_title}</span></div>
              )}
              {invoice?.number && (
                <div className="flex justify-between"><span className="text-slate-500">Invoice</span><span className="font-mono text-slate-700">{invoice.number}</span></div>
              )}
              {invoice?.total != null && (
                <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1.5">
                  <span className="text-slate-500">Invoice total</span><span className="text-slate-700">{fmtMoney(invoice.total)}</span>
                </div>
              )}
            </div>

            {isPaid ? (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center" data-testid="pr-paid">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-1" />
                <div className="font-bold text-emerald-900">This payment was received</div>
                <div className="text-xs text-emerald-700">Thank you!</div>
              </div>
            ) : (
              <>
                {card_payment?.enabled && (
                  <StripeCardPay requestId={request.id} amount={request.amount} />
                )}
                <ManualMethods methods={payment_methods || {}} invoiceId={invoice.id} business={business} amount={request.amount} />
              </>
            )}

            <div className="text-center pt-1">
              {business?.phone && (
                <div className="text-xs text-slate-400 flex items-center justify-center gap-1"><Phone className="w-3 h-3" /> {business.phone}</div>
              )}
              {business?.business_email && (
                <div className="text-xs text-slate-400 flex items-center justify-center gap-1 mt-0.5"><Mail className="w-3 h-3" /> {business.business_email}</div>
              )}
            </div>
          </div>
        </Card>
        <div className="text-center text-xs text-slate-400 mt-4">Powered by Unitap</div>
      </div>
    </div>
  );
}

function StripeCardPay({ requestId, amount }) {
  const [loading, setLoading] = useState(false);
  const pay = async () => {
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/public/payment-requests/${requestId}/checkout`, {
        origin_url: window.location.origin,
      });
      if (data.url) window.location.href = data.url;
      else throw new Error("No URL");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo iniciar el pago.");
      setLoading(false);
    }
  };
  return (
    <Button
      onClick={pay}
      disabled={loading}
      className="w-full h-13 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base"
      data-testid="pr-stripe-pay"
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CreditCard className="w-5 h-5 mr-2" />}
      Pay {fmtMoney(amount)} by card
    </Button>
  );
}

function ManualMethods({ methods, invoiceId, business, amount }) {
  const [done, setDone] = useState(false);
  const enabled = Object.entries(methods).filter(([, v]) => v?.enabled);
  if (enabled.length === 0) return null;

  const openLink = (key, value) => {
    const clean = (value || "").trim().replace(/^[@$]/, "");
    let url = "";
    if (key === "venmo" && clean) url = `https://venmo.com/u/${clean}`;
    else if (key === "paypal" && clean) url = `https://paypal.me/${clean}/${Math.max(0, Number(amount) || 0)}`;
    else if (key === "cashapp" && clean) url = `https://cash.app/$${clean}`;
    if (url) window.open(url, "_blank", "noopener");
  };

  const notifyPaid = async (key) => {
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/public/invoices/${invoiceId}/mark-paid-notice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: key, payer_name: "", note: `Pago de solicitud: ${fmtMoney(amount)}` }),
      });
      setDone(true);
    } catch { /* retry */ }
  };

  return (
    <div className="space-y-2" data-testid="pr-manual-methods">
      <div className="text-xs text-slate-400 text-center">or pay another way</div>
      {enabled.map(([key, entry]) => {
        const meta = METHOD_LABELS[key];
        const v = (entry.value || "").trim();
        const linkable = key === "venmo" || key === "paypal" || key === "cashapp";
        return (
          <button
            key={key}
            data-testid={`pr-pay-${key}`}
            onClick={() => (linkable ? openLink(key, v) : notifyPaid(key))}
            className={`w-full ${meta.color} text-white p-3 rounded-xl flex items-center gap-3 text-left transition`}
          >
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-bold flex-none">{meta.letter}</div>
            <div className="flex-1">
              <div className="font-bold text-sm">{meta.label}</div>
              {v && <div className="text-xs opacity-90">{key === "zelle" ? `Send to: ${v}` : v}</div>}
            </div>
          </button>
        );
      })}
      {done ? (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 text-center">
          ✓ {business?.business_name || "The business"} has been notified. Thanks!
        </div>
      ) : (
        <button
          data-testid="pr-mark-paid"
          onClick={() => notifyPaid("other")}
          className="w-full text-xs text-emerald-700 hover:text-emerald-900 font-semibold underline pt-1"
        >
          I've already paid — let them know
        </button>
      )}
    </div>
  );
}
