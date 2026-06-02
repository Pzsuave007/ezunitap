/**
 * GoogleReviewsPage — Dedicated dashboard page for the GMB Reviews pillar.
 * Combines: config (setup), public link sharing, and the private feedback
 * inbox (from clients who picked 😐/😞 instead of leaving a public review).
 */
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Loader2, Star, MessageSquareWarning, Inbox, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import GoogleReviewsSection from "@/components/GoogleReviewsSection";
import ReviewLinkCard from "@/components/ReviewLinkCard";
import GbpConnectCard from "@/components/GbpConnectCard";

const SENT_META = {
  neutral: { emoji: "😐", label: "Neutral",   cls: "bg-amber-50 text-amber-900 border-amber-200" },
  sad:     { emoji: "😞", label: "Disgusted", cls: "bg-rose-50 text-rose-900 border-rose-200" },
  happy:   { emoji: "😊", label: "Happy",     cls: "bg-emerald-50 text-emerald-900 border-emerald-200" },
};

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
  } catch { return ""; }
}

export default function GoogleReviewsPage() {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data } = await api.get("/review-feedback");
      setFeedback(data.feedback || []);
    } catch {
      toast.error("Error al cargar feedback");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const negative = feedback.filter((f) => f.sentiment !== "happy");
  const happyCount = feedback.filter((f) => f.sentiment === "happy").length;
  const conversionRate = feedback.length > 0
    ? Math.round((happyCount / feedback.length) * 100)
    : 0;

  return (
    <div className="space-y-6" data-testid="reviews-page">
      <div>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight flex items-center gap-3">
          <Star className="w-8 h-8 text-yellow-500 fill-yellow-400" />
          Google Reviews
        </h1>
        <p className="text-slate-500 mt-2 max-w-2xl text-sm">
          Convierte cada tap de tu tarjeta NFC en una reseña 5★ en Google.
          Filtramos clientes insatisfechos automáticamente — sus quejas
          aparecen aquí en privado para que las arregles antes que escriban
          una reseña negativa pública.
        </p>
      </div>

      {/* Public review link — share it everywhere */}
      <ReviewLinkCard />

      {/* Connect Google Business Profile → post + reply to reviews directly */}
      <GbpConnectCard />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={Star} color="emerald"
          label="Clientes felices" value={happyCount}
          sub={`${conversionRate}% del total`}
        />
        <StatCard
          icon={MessageSquareWarning} color="amber"
          label="Feedback negativo" value={negative.length}
          sub={negative.length > 0 ? "necesitan tu atención" : "nada por revisar"}
        />
        <StatCard
          icon={Inbox} color="slate"
          label="Total taps" value={feedback.length}
          sub="todos los sentimientos"
        />
      </div>

      {/* Configuration */}
      <GoogleReviewsSection />

      {/* Private feedback inbox */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquareWarning className="w-5 h-5 text-amber-600" />
          <h3 className="font-heading font-bold text-base">
            Feedback privado de clientes
          </h3>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Cuando un cliente pica 😐 o 😞, NO va a Google. En cambio, su mensaje
          llega aquí para que lo contactes y arregles la situación.
        </p>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : negative.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">🎉</div>
            <div className="text-sm font-semibold text-slate-700">
              ¡Sin quejas hasta ahora!
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Cuando un cliente comparta feedback privado, aparecerá aquí.
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {negative.map((f) => {
              const m = SENT_META[f.sentiment] || SENT_META.neutral;
              return (
                <div
                  key={f.id}
                  data-testid={`fb-${f.id}`}
                  className={`p-3 rounded-xl border ${m.cls}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl flex-none">{m.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-semibold">{f.name || "Cliente anónimo"}</span>
                        <span className="opacity-70">·</span>
                        <span className="opacity-70">{fmtDate(f.created_at)}</span>
                      </div>
                      <div className="text-sm mt-1 leading-snug">
                        "{f.feedback || "(sin mensaje escrito)"}"
                      </div>
                      {f.contact && (
                        <div className="mt-2 flex items-center gap-2 text-xs">
                          {f.contact.includes("@") ? (
                            <a
                              href={`mailto:${f.contact}`}
                              className="inline-flex items-center gap-1 font-semibold hover:underline"
                              data-testid={`fb-contact-${f.id}`}
                            >
                              <Mail className="w-3 h-3" /> {f.contact}
                            </a>
                          ) : (
                            <a
                              href={`tel:${f.contact}`}
                              className="inline-flex items-center gap-1 font-semibold hover:underline"
                            >
                              <Phone className="w-3 h-3" /> {f.contact}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, color, label, value, sub }) {
  const accents = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber:   "bg-amber-50 text-amber-700 border-amber-200",
    slate:   "bg-slate-50 text-slate-700 border-slate-200",
  };
  return (
    <div className={`p-4 rounded-2xl border ${accents[color]}`}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider font-bold opacity-70">
          {label}
        </div>
        <Icon className="w-4 h-4 opacity-60" />
      </div>
      <div className="font-heading text-3xl font-bold mt-2">{value}</div>
      {sub && <div className="text-[11px] mt-1 opacity-70">{sub}</div>}
    </div>
  );
}
