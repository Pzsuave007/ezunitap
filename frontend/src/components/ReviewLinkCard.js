/**
 * ReviewLinkCard — standalone "Tu link de reseñas" card (Tarjeta-style).
 * Shows the public review link with Copiar / Compartir / Ver actions.
 * Self-contained: reads the user's card_slug from auth and checks whether the
 * Google Reviews URL is configured to show a setup nudge.
 */
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Copy, Check, Share2, Eye } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import SendDocumentDialog from "@/components/SendDocumentDialog";

export default function ReviewLinkCard() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    api.get("/google-reviews/settings")
      .then(({ data }) => setConfigured(!!(data.google_review_url || "").trim()))
      .catch(() => {});
  }, []);

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

  if (!publicUrl) return null;

  return (
    <div className="card-elevated p-4 rounded-2xl bg-white" data-testid="review-link-card">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center flex-shrink-0">
          <Share2 className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Tu link de reseñas</div>
          <div className="font-semibold text-sm truncate" data-testid="reviews-public-url">{publicUrl}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button onClick={copyLink} data-testid="copy-gmb-link" variant="outline" className="h-11 rounded-xl">
          {copied ? <Check className="w-4 h-4 mr-1 text-emerald-600" /> : <Copy className="w-4 h-4 mr-1" />} Copiar
        </Button>
        <Button onClick={() => setShareOpen(true)} data-testid="gmb-share" variant="outline" className="h-11 rounded-xl">
          <Share2 className="w-4 h-4 mr-1" /> Compartir
        </Button>
        <a href={publicUrl} target="_blank" rel="noopener noreferrer" data-testid="gmb-view">
          <Button variant="outline" className="h-11 rounded-xl w-full">
            <Eye className="w-4 h-4 mr-1" /> Ver
          </Button>
        </a>
      </div>
      {!configured && (
        <p className="text-[11px] text-amber-700 mt-3">
          ⚠️ Configura tu link de Google abajo para que los clientes felices lleguen directo a Google.
        </p>
      )}

      <SendDocumentDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        kind="review"
        publicUrl={publicUrl}
        client={null}
        businessName={user?.business_name}
      />
    </div>
  );
}
