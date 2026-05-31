/**
 * PublicReviewPage — The page a customer lands on after tapping the NFC
 * Google Reviews card. Uses sentiment gating to route happy customers to
 * Google and unhappy ones to a private feedback form.
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Card } from "@/components/ui/card";
import { Loader2, Star } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PublicReviewPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [sentiment, setSentiment] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    axios.get(`${API}/public/reviews/${slug}`)
      .then((r) => setData(r.data))
      .catch((e) => setError(e?.response?.data?.detail || "Page not found"));
  }, [slug]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <Card className="p-8 text-center max-w-sm">
          <p className="text-slate-600">{error}</p>
        </Card>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-white" />
      </div>
    );
  }

  const goToGoogle = async () => {
    // Track happy sentiment silently (best-effort)
    try {
      await axios.post(`${API}/public/reviews/${slug}/feedback`, {
        sentiment: "happy", feedback: "", name: "", contact: "",
      });
    } catch { /* ignore */ }
    window.location.href = data.google_review_url;
  };

  const submitFeedback = async () => {
    if (!feedback.trim()) return;
    setSubmitting(true);
    try {
      await axios.post(`${API}/public/reviews/${slug}/feedback`, {
        sentiment, feedback: feedback.trim(), name: name.trim(), contact: contact.trim(),
      });
      setSubmitted(true);
    } catch {
      // ignore
    } finally { setSubmitting(false); }
  };

  // Step 1 — sentiment selection
  if (!sentiment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <Card className="p-8 text-center bg-white" data-testid="review-sentiment">
            {data.logo_url && (
              <img src={data.logo_url} alt="" className="w-16 h-16 mx-auto mb-3 rounded-2xl object-cover" />
            )}
            <h1 className="font-heading text-2xl font-bold">{data.business_name}</h1>
            <p className="text-sm text-slate-500 mt-2">
              {data.intro_text || "Thanks for choosing us! How was your experience?"}
            </p>

            <div className="grid grid-cols-3 gap-3 mt-8">
              <SentimentButton emoji="😊" label="Great" onClick={() => { setSentiment("happy"); goToGoogle(); }} testid="sent-happy" color="bg-emerald-500 hover:bg-emerald-600" />
              <SentimentButton emoji="😐" label="Okay" onClick={() => setSentiment("neutral")} testid="sent-neutral" color="bg-amber-500 hover:bg-amber-600" />
              <SentimentButton emoji="😞" label="Poor" onClick={() => setSentiment("sad")} testid="sent-sad" color="bg-rose-500 hover:bg-rose-600" />
            </div>

            {!data.filter_enabled && (
              <button
                onClick={() => { setSentiment("happy"); goToGoogle(); }}
                className="mt-6 text-xs text-slate-500 underline"
              >
                Skip and leave a Google review
              </button>
            )}

            <div className="text-[10px] text-slate-400 mt-6">Powered by Unitap</div>
          </Card>
        </div>
      </div>
    );
  }

  // Step 2 — happy → Google (redirect handled by goToGoogle)
  if (sentiment === "happy") {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-white" />
      </div>
    );
  }

  // Step 3 — neutral/sad: feedback form
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <Card className="p-7 bg-white" data-testid="review-feedback-form">
          {submitted ? (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">🙏</div>
              <h2 className="font-heading text-xl font-bold">Thank you for your honesty</h2>
              <p className="text-sm text-slate-600 mt-2">
                {data.owner_name || "The owner"} from {data.business_name} will reach out
                personally to make this right.
              </p>
            </div>
          ) : (
            <>
              <div className="text-center mb-5">
                <div className="text-3xl mb-2">{sentiment === "neutral" ? "😐" : "😞"}</div>
                <h2 className="font-heading text-xl font-bold">We're sorry to hear that</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Help us improve. Your feedback goes directly to {data.owner_name || "the owner"} — not public.
                </p>
              </div>
              <textarea
                data-testid="fb-text"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="What happened? How can we make it right?"
                rows={4}
                className="w-full p-3 rounded-xl border border-slate-200 text-sm"
              />
              <input
                data-testid="fb-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name (optional)"
                className="w-full mt-3 p-3 rounded-xl border border-slate-200 text-sm"
              />
              <input
                data-testid="fb-contact"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Phone or email so we can reach you (optional)"
                className="w-full mt-3 p-3 rounded-xl border border-slate-200 text-sm"
              />
              <button
                data-testid="fb-submit"
                onClick={submitFeedback}
                disabled={!feedback.trim() || submitting}
                className="w-full mt-4 h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Send feedback"}
              </button>
              <button
                onClick={() => setSentiment(null)}
                className="w-full mt-2 text-xs text-slate-500 underline"
              >
                ← Back
              </button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function SentimentButton({ emoji, label, onClick, testid, color }) {
  return (
    <button onClick={onClick} data-testid={testid} className={`${color} text-white p-4 rounded-2xl transition flex flex-col items-center justify-center gap-1`}>
      <div className="text-3xl">{emoji}</div>
      <div className="text-xs font-bold">{label}</div>
    </button>
  );
}
