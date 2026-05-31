/**
 * GoogleReviewsSection — Settings card to configure the Google Reviews link
 * and the sentiment-gating behavior.
 */
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Star, ExternalLink, Copy, Check, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import SendDocumentDialog from "@/components/SendDocumentDialog";

export default function GoogleReviewsSection() {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [intro, setIntro] = useState("");
  const [filterOn, setFilterOn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    api.get("/google-reviews/settings").then(({ data }) => {
      setUrl(data.google_review_url || "");
      setIntro(data.review_intro_text || "");
      setFilterOn(data.review_filter_enabled !== false);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/google-reviews/settings", {
        google_review_url: url,
        review_intro_text: intro,
        review_filter_enabled: filterOn,
      });
      toast.success("Google Reviews configurado");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const publicUrl = user?.card_slug
    ? `${window.location.origin}/r/${user.card_slug}`
    : "";

  const copyLink = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success("Link copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return null;

  return (
    <Card className="card-elevated p-5 border-0 shadow-none space-y-4" data-testid="google-reviews-section">
      <div className="flex items-center gap-2 mb-1">
        <Star className="w-5 h-5 text-yellow-500" />
        <h3 className="font-heading font-bold text-base">Google Reviews</h3>
      </div>
      <p className="text-xs text-slate-500 -mt-2">
        Activa una página pública estilo NFC para conseguir reseñas en Google
        Business Profile. Filtramos automáticamente clientes insatisfechos para que
        te den feedback privado antes de dejar reseñas negativas.
      </p>

      <div>
        <label className="text-xs font-semibold text-slate-600 block mb-1.5">
          Tu link de Google Reviews
        </label>
        <Input
          data-testid="gmb-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://g.page/r/...../review"
          className="h-10"
        />
        <p className="text-[11px] text-slate-500 mt-1">
          Para obtenerlo: Google Business Profile → <strong>Get more reviews</strong> → copiar el link.
        </p>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 block mb-1.5">
          Mensaje de bienvenida (opcional)
        </label>
        <Textarea
          data-testid="gmb-intro"
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          placeholder="Thanks for choosing us! Your honest review helps us grow."
          rows={2}
        />
      </div>

      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
        <div className="flex-1 pr-3">
          <div className="text-sm font-semibold">Filtro inteligente de sentimiento</div>
          <div className="text-[11px] text-slate-500">
            Pregunta primero "¿Cómo fue tu experiencia?" — solo clientes 😊 felices van a Google.
            Los demás te dan feedback privado para que arregles antes.
          </div>
        </div>
        <Switch checked={filterOn} onCheckedChange={setFilterOn} data-testid="gmb-filter" />
      </div>

      {publicUrl && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
          <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 mb-1">
            Tu link público de reseñas
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs text-emerald-900 truncate flex-1">{publicUrl}</code>
            <button onClick={copyLink} className="p-1.5 rounded-lg hover:bg-white" data-testid="copy-gmb-link" title="Copiar">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5 text-emerald-700" />}
            </button>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-white" title="Ver">
              <ExternalLink className="w-3.5 h-3.5 text-emerald-700" />
            </a>
          </div>

          <Button
            data-testid="gmb-share"
            onClick={() => setShareOpen(true)}
            className="w-full h-11 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white font-semibold mt-3"
          >
            <Share2 className="w-4 h-4 mr-2" /> Compartir link (WhatsApp, Texto, Email)
          </Button>

          {!url ? (
            <p className="text-[11px] text-amber-700 mt-2">
              ⚠️ Configura tu link de Google arriba para que los clientes felices lleguen directo a Google.
            </p>
          ) : (
            <p className="text-[10px] text-emerald-700 mt-2">
              Programa este link en tu tarjeta NFC de Google Reviews y compártelo con tus clientes.
            </p>
          )}
        </div>
      )}

      <SendDocumentDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        kind="review"
        publicUrl={publicUrl}
        client={null}
        businessName={user?.business_name}
      />

      <Button
        data-testid="gmb-save"
        onClick={save}
        disabled={saving}
        className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
        Guardar configuración
      </Button>
    </Card>
  );
}
