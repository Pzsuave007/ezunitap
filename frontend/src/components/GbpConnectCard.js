/**
 * GbpConnectCard — connect a contractor's own Google Business Profile and,
 * once connected, publish posts (write in Spanish → AI English) and read /
 * reply to Google reviews directly from UniTech.
 *
 * Handles 4 states:
 *   - loading
 *   - not configured (Google API approval still pending) → informational
 *   - configured but not connected → "Conectar con Google"
 *   - connected → post composer + reviews list
 */
import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AiTranslateButton } from "@/components/AiTranslateButton";
import {
  Loader2, CheckCircle2, Send, Star, Clock, Link2, Unlink, MapPin, MessageSquare, RefreshCw, Check,
  Eye, Phone, Navigation, Globe, TrendingUp, CalendarCheck,
} from "lucide-react";
import { toast } from "sonner";

export default function GbpConnectCard({ businessType = "" }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    try {
      const { data } = await api.get("/google-business/status");
      setStatus(data);
    } catch {
      setStatus({ configured: false, connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    // Show a toast after returning from the Google OAuth redirect.
    const params = new URLSearchParams(window.location.search);
    const gmb = params.get("gmb");
    if (gmb === "connected") {
      toast.success("¡Google Business Profile conectado! 🎉");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (gmb === "error") {
      toast.error("No se pudo conectar con Google. Inténtalo de nuevo.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [loadStatus]);

  const connect = async () => {
    try {
      const { data } = await api.get("/google-business/connect");
      window.location.href = data.auth_url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo iniciar la conexión.");
    }
  };

  const disconnect = async () => {
    try {
      await api.post("/google-business/disconnect");
      toast.success("Cuenta de Google desconectada.");
      loadStatus();
    } catch {
      toast.error("No se pudo desconectar.");
    }
  };

  if (loading) {
    return (
      <Card className="p-5 flex justify-center" data-testid="gbp-card-loading">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </Card>
    );
  }

  return (
    <Card className="p-5 space-y-4" data-testid="gbp-connect-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-none">
            <Star className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-base leading-tight">
              Publicar en Google Business
            </h3>
            <p className="text-xs text-slate-500">
              Conecta tu perfil y publica directo desde UniTech.
            </p>
          </div>
        </div>
        {status?.connected && (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1">
            <CheckCircle2 className="w-3 h-3" /> Conectado
          </Badge>
        )}
      </div>

      {/* STATE: pending approval (not configured) */}
      {!status?.configured && (
        <div
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
          data-testid="gbp-pending"
        >
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
            <Clock className="w-4 h-4" /> Pendiente de aprobación de Google
          </div>
          <p className="text-xs text-amber-800/90 mt-1 leading-snug">
            Ya enviamos la solicitud de acceso a la API de Google Business Profile.
            En cuanto Google la apruebe (7–10 días hábiles), aquí podrás conectar
            tu perfil y publicar posts + responder reseñas sin salir de UniTech.
          </p>
        </div>
      )}

      {/* STATE: configured but not connected */}
      {status?.configured && !status?.connected && (
        <Button
          onClick={connect}
          className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
          data-testid="gbp-connect-btn"
        >
          <Link2 className="w-4 h-4 mr-2" /> Conectar con Google
        </Button>
      )}

      {/* STATE: connected */}
      {status?.connected && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 truncate">
                <MapPin className="w-3.5 h-3.5 text-slate-400 flex-none" />
                {status.location_title || "Ubicación de Google"}
              </div>
              {status.google_email && (
                <div className="text-[11px] text-slate-400 truncate">{status.google_email}</div>
              )}
            </div>
            <button
              onClick={disconnect}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 flex-none"
              data-testid="gbp-disconnect-btn"
            >
              <Unlink className="w-3.5 h-3.5" /> Desconectar
            </button>
          </div>

          <LocationSwitcher
            currentLocationId={status.location_id}
            onChanged={loadStatus}
          />

          <InsightsPanel />

          <PostComposer businessType={businessType} />
          <ReviewsList businessType={businessType} />
        </div>
      )}
    </Card>
  );
}

function LocationSwitcher({ currentLocationId, onChanged }) {
  const [open, setOpen] = useState(false);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState("");

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && locations.length === 0) {
      setLoading(true);
      try {
        const { data } = await api.get("/google-business/locations");
        setLocations(data.locations || []);
      } catch (e) {
        toast.error(e?.response?.data?.detail || "No se pudieron cargar tus negocios.");
      } finally {
        setLoading(false);
      }
    }
  };

  const pick = async (loc) => {
    setSaving(loc.location_id);
    try {
      await api.post("/google-business/select-location", {
        account_id: loc.account_id,
        location_id: loc.location_id,
        title: loc.title,
      });
      toast.success(`Negocio cambiado a "${loc.title || "ubicación"}" ✅`);
      setOpen(false);
      onChanged?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo cambiar el negocio.");
    } finally {
      setSaving("");
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 p-3" data-testid="gbp-location-switcher">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between text-xs font-bold text-slate-700 hover:text-slate-900"
        data-testid="gbp-change-location-btn"
      >
        <span className="flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5 text-blue-600" /> ¿No es el negocio correcto? Cámbialo
        </span>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-1.5" data-testid="gbp-location-list">
          {loading ? (
            <div className="flex justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
          ) : locations.length === 0 ? (
            <div className="text-center py-3 text-xs text-slate-400">
              No encontramos otros negocios en tu cuenta de Google.
            </div>
          ) : (
            locations.map((loc) => {
              const active = loc.location_id === currentLocationId;
              return (
                <button
                  key={loc.location_id}
                  onClick={() => pick(loc)}
                  disabled={!!saving}
                  className={`w-full flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                    active
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-slate-200 hover:border-blue-300 hover:bg-blue-50"
                  }`}
                  data-testid={`gbp-location-option-${loc.location_id}`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-none" />
                    <span className="text-xs font-semibold text-slate-700 truncate">
                      {loc.title || "Negocio sin nombre"}
                    </span>
                  </span>
                  {saving === loc.location_id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 flex-none" />
                  ) : active ? (
                    <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 flex-none">
                      <Check className="w-3 h-3" /> Activo
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function InsightsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  useEffect(() => {
    api.get("/google-business/insights")
      .then(({ data }) => setData(data))
      .catch(() => setErr(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-4" data-testid="gbp-insights-loading">
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
      </div>
    );
  }
  if (err || !data) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 p-3 text-center text-[11px] text-slate-400" data-testid="gbp-insights-unavailable">
        Las métricas de Google aún no están disponibles para este negocio.
      </div>
    );
  }

  const t = data.totals || {};
  const cards = [
    { key: "views", label: "Vistas", value: t.views, icon: Eye, color: "text-blue-600" },
    { key: "calls", label: "Llamadas", value: t.calls, icon: Phone, color: "text-emerald-600" },
    { key: "directions", label: "Cómo llegar", value: t.directions, icon: Navigation, color: "text-violet-600" },
    { key: "website", label: "Clics al sitio", value: t.website, icon: Globe, color: "text-orange-600" },
  ];
  if (t.messages > 0) cards.push({ key: "messages", label: "Mensajes", value: t.messages, icon: MessageSquare, color: "text-pink-600" });
  if (t.bookings > 0) cards.push({ key: "bookings", label: "Reservas", value: t.bookings, icon: CalendarCheck, color: "text-teal-600" });

  return (
    <div className="rounded-2xl border border-slate-200 p-3" data-testid="gbp-insights">
      <div className="flex items-center gap-1.5 mb-2.5">
        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
        <span className="text-xs font-bold text-slate-700">Rendimiento (últimos 30 días)</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.key} className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5" data-testid={`gbp-metric-${c.key}`}>
              <Icon className={`w-4 h-4 ${c.color} mb-1`} />
              <div className="text-lg font-extrabold text-slate-800 leading-none">{Number(c.value || 0).toLocaleString()}</div>
              <div className="text-[10px] font-semibold text-slate-400 mt-0.5">{c.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function PostComposer({ businessType }) {
  const [summary, setSummary] = useState("");
  const [cta, setCta] = useState("");
  const [posting, setPosting] = useState(false);

  const publish = async () => {
    if (!summary.trim()) {
      toast.error("Escribe el texto del post primero.");
      return;
    }
    setPosting(true);
    try {
      await api.post("/google-business/posts", { summary: summary.trim(), cta_url: cta.trim() });
      toast.success("¡Post publicado en Google! 🎉");
      setSummary("");
      setCta("");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo publicar el post.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 p-3 space-y-2" data-testid="gbp-post-composer">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-slate-800">Nuevo post (update)</div>
        <AiTranslateButton
          fieldType="gmb_post"
          businessType={businessType}
          onResult={(en) => setSummary(en)}
          testId="gbp-post-ai"
          placeholder="Ej: Ofrecemos limpieza de canaletas con 15% de descuento este mes..."
        />
      </div>
      <Textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="Write your update in English (or use the AI button above)..."
        className="rounded-xl min-h-[90px] text-sm"
        data-testid="gbp-post-text"
      />
      <Input
        value={cta}
        onChange={(e) => setCta(e.target.value)}
        placeholder="Link opcional (ej: https://ezunitech.com/tu-tarjeta)"
        className="rounded-xl text-sm"
        data-testid="gbp-post-cta"
      />
      <Button
        onClick={publish}
        disabled={posting}
        className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
        data-testid="gbp-post-publish"
      >
        {posting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
        Publicar en Google
      </Button>
    </div>
  );
}

function ReviewsList({ businessType }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/google-business/reviews");
      setReviews(data.reviews || []);
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-4 text-xs text-slate-400" data-testid="gbp-no-reviews">
        Aún no hay reseñas de Google para mostrar.
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="gbp-reviews-list">
      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
        <MessageSquare className="w-3.5 h-3.5 text-slate-500" /> Reseñas de Google
      </div>
      {reviews.map((r) => (
        <ReviewItem key={r.reviewId} review={r} onReplied={load} businessType={businessType} />
      ))}
    </div>
  );
}

const STAR_MAP = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

function ReviewItem({ review, onReplied, businessType }) {
  const [reply, setReply] = useState(review?.reviewReply?.comment || "");
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const stars = STAR_MAP[review.starRating] || 0;

  const draftWithAI = async () => {
    setDrafting(true);
    try {
      const { data } = await api.post("/google-business/reviews/ai-draft", {
        comment: review.comment || "",
        star_rating: stars || 5,
        reviewer_name: review.reviewer?.displayName || "",
        business_type: businessType || "",
      });
      setReply(data.reply || "");
      toast.success("Respuesta generada con AI ✨ — revísala y publícala.");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo generar la respuesta.");
    } finally {
      setDrafting(false);
    }
  };

  const send = async () => {
    if (!reply.trim()) {
      toast.error("Escribe una respuesta.");
      return;
    }
    setSending(true);
    try {
      await api.put(`/google-business/reviews/${review.reviewId}/reply`, { comment: reply.trim() });
      toast.success("Respuesta publicada en Google.");
      onReplied?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo responder.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 p-3" data-testid={`gbp-review-${review.reviewId}`}>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-xs text-slate-800">
          {review.reviewer?.displayName || "Cliente"}
        </span>
        <span className="flex">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              className={`w-3 h-3 ${i <= stars ? "text-yellow-500 fill-yellow-400" : "text-slate-300"}`}
            />
          ))}
        </span>
      </div>
      {review.comment && (
        <p className="text-xs text-slate-600 mt-1 leading-snug">"{review.comment}"</p>
      )}
      <button
        onClick={draftWithAI}
        disabled={drafting}
        className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-violet-700 hover:text-violet-800 disabled:opacity-60"
        data-testid={`gbp-ai-draft-${review.reviewId}`}
      >
        {drafting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
        Responder con AI
      </button>
      <div className="mt-2 flex items-center gap-2">
        <Input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Responde al cliente..."
          className="rounded-lg text-xs h-9"
          data-testid={`gbp-reply-input-${review.reviewId}`}
        />
        <Button
          onClick={send}
          disabled={sending}
          className="h-9 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs px-3 flex-none"
          data-testid={`gbp-reply-btn-${review.reviewId}`}
        >
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Responder"}
        </Button>
      </div>
    </div>
  );
}
