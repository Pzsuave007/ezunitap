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
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
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

  const goToGoogle = async (stars) => {
    // Track happy sentiment silently (best-effort)
    try {
      await axios.post(`${API}/public/reviews/${slug}/feedback`, {
        sentiment: "happy", rating: stars, feedback: "", name: "", contact: "",
      });
    } catch { /* ignore */ }
    window.location.href = data.google_review_url;
  };

  // Star gate: 4-5 stars → Google. 3 or fewer → private feedback form.
  const handleRate = (stars) => {
    setRating(stars);
    if (stars >= 4) {
      setSentiment("happy");
      goToGoogle(stars);
    } else {
      setSentiment(stars <= 2 ? "sad" : "neutral");
    }
  };

  const submitFeedback = async () => {
    if (!feedback.trim()) return;
    setSubmitting(true);
    try {
      await axios.post(`${API}/public/reviews/${slug}/feedback`, {
        sentiment, rating, feedback: feedback.trim(), name: name.trim(), contact: contact.trim(),
      });
      setSubmitted(true);
    } catch {
      // ignore
    } finally { setSubmitting(false); }
  };

  // Step 1 — star rating selection
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
              {data.intro_text || "Thanks for choosing us! How would you rate your experience?"}
            </p>

            <div className="flex items-center justify-center gap-1.5 mt-8" data-testid="star-rating">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  data-testid={`star-${s}`}
                  onClick={() => handleRate(s)}
                  onMouseEnter={() => setHover(s)}
                  onMouseLeave={() => setHover(0)}
                  className="p-1 transition-transform hover:scale-110 active:scale-95"
                  aria-label={`${s} star${s > 1 ? "s" : ""}`}
                >
                  <Star
                    className={`w-11 h-11 transition-colors ${
                      (hover || rating) >= s
                        ? "text-yellow-400 fill-yellow-400"
                        : "text-slate-300"
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-4">Tap a star to rate</p>

            <div className="text-[10px] text-slate-400 mt-6">Powered by UniTech</div>
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

  // Step 3 — 3 stars or fewer: private feedback form
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <Card className="p-7 bg-white" data-testid="review-feedback-form">
          {submitted ? (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">🙏</div>
              <h2 className="font-heading text-xl font-bold">Thank you for your feedback</h2>
              <p className="text-sm text-slate-600 mt-2">
                The team at {data.business_name} will reach out personally to make this right.
              </p>
            </div>
          ) : (
            <>
              <div className="text-center mb-5">
                <div className="flex items-center justify-center gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-6 h-6 ${rating >= s ? "text-yellow-400 fill-yellow-400" : "text-slate-200"}`}
                    />
                  ))}
                </div>
                <h2 className="font-heading text-xl font-bold">How can we do better?</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Tell us what happened and we'll make it right.
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
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Send"}
              </button>
              <button
                onClick={() => { setSentiment(null); setRating(0); }}
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

