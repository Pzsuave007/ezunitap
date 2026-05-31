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
import { Loader2, Save, Star } from "lucide-react";
import { toast } from "sonner";

export default function GoogleReviewsSection() {
  const [url, setUrl] = useState("");
  const [intro, setIntro] = useState("");
  const [filterOn, setFilterOn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
