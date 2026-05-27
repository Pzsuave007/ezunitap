/**
 * SendDocumentDialog — share-via-app dialog for Quotes, Agreements, Invoices.
 *
 * Opens WhatsApp / SMS / Email apps with a pre-filled message and the public
 * link, or copies the link to clipboard. Triggers the user's installed apps
 * via standard URL schemes (sms:, mailto:, wa.me).
 *
 * Props:
 *   - open, onClose
 *   - kind: "quote" | "agreement" | "invoice"
 *   - publicUrl: string (the public link to share)
 *   - client: { name, phone, email } (for prefilling)
 *   - businessName: string
 *   - jobTitle: string
 */
import { useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageCircle, Smartphone, Mail, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const KIND_LABELS = {
  quote: {
    title: "Mandar Quote",
    description: "Envía el quote al cliente para que lo revise y lo acepte.",
    short: "tu quote",
    cta: "Quote",
  },
  agreement: {
    title: "Mandar Contrato",
    description: "Envía el contrato al cliente para que lo firme.",
    short: "tu contrato",
    cta: "Contrato",
  },
  invoice: {
    title: "Mandar Invoice",
    description: "Envía el invoice al cliente para que vea el monto a pagar.",
    short: "tu invoice",
    cta: "Invoice",
  },
};

function cleanPhone(phone) {
  if (!phone) return "";
  // Strip everything except digits. If looks like a US 10-digit number, prepend +1.
  const digits = String(phone).replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return digits;
  return digits;
}

export default function SendDocumentDialog({
  open,
  onClose,
  kind = "quote",
  publicUrl,
  client,
  businessName,
  jobTitle,
}) {
  const meta = KIND_LABELS[kind] || KIND_LABELS.quote;
  const clientName = client?.name || "";
  const phone = cleanPhone(client?.phone);
  const email = client?.email || "";

  const message = useMemo(() => {
    const greet = clientName ? `Hola ${clientName.split(" ")[0]},` : "¡Hola!";
    const job = jobTitle ? ` para ${jobTitle}` : "";
    const biz = businessName ? `\n\n— ${businessName}` : "";
    return `${greet}\n\nTe mando ${meta.short}${job}. Por favor revísalo y avísame si tienes alguna pregunta:\n\n${publicUrl}${biz}`;
  }, [clientName, jobTitle, businessName, meta.short, publicUrl]);

  const messageShort = useMemo(() => {
    const greet = clientName ? `Hola ${clientName.split(" ")[0]},` : "¡Hola!";
    return `${greet} aquí está ${meta.short}: ${publicUrl}`;
  }, [clientName, meta.short, publicUrl]);

  const emailSubject = `${meta.cta}${jobTitle ? ` - ${jobTitle}` : ""}${businessName ? ` (${businessName})` : ""}`;

  const openWhatsApp = () => {
    const text = encodeURIComponent(message);
    const url = phone
      ? `https://wa.me/${phone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, "_blank", "noopener");
  };

  const openSMS = () => {
    if (!phone) {
      toast.error("Este cliente no tiene teléfono guardado");
      return;
    }
    const text = encodeURIComponent(messageShort);
    // iOS uses `&` separator, Android uses `?`. The `?body=` works on both modern.
    window.location.href = `sms:+${phone}?&body=${text}`;
  };

  const openEmail = () => {
    if (!email) {
      toast.error("Este cliente no tiene email guardado");
      return;
    }
    const subject = encodeURIComponent(emailSubject);
    const body = encodeURIComponent(message);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Link copiado al portapapeles");
    } catch {
      window.prompt("Copia este link:", publicUrl);
    }
  };

  const openPublic = () => window.open(publicUrl, "_blank", "noopener");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md" data-testid="send-document-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading">{meta.title}</DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <button
            data-testid="send-whatsapp"
            onClick={openWhatsApp}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 transition text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">WhatsApp</div>
              <div className="text-xs text-slate-500 truncate">
                {phone ? `Enviar a +${phone}` : "Abre WhatsApp Web/App"}
              </div>
            </div>
          </button>

          <button
            data-testid="send-sms"
            onClick={openSMS}
            disabled={!phone}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-blue-50 hover:border-blue-300 transition text-left disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:border-slate-200"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">Texto (SMS)</div>
              <div className="text-xs text-slate-500 truncate">
                {phone ? `Enviar a +${phone}` : "Sin teléfono guardado"}
              </div>
            </div>
          </button>

          <button
            data-testid="send-email"
            onClick={openEmail}
            disabled={!email}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-amber-50 hover:border-amber-300 transition text-left disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:border-slate-200"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">Email</div>
              <div className="text-xs text-slate-500 truncate">
                {email || "Sin email guardado"}
              </div>
            </div>
          </button>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button
              data-testid="send-copy-link"
              onClick={copyLink}
              variant="outline"
              className="h-11 rounded-xl"
            >
              <Copy className="w-4 h-4 mr-1.5" /> Copiar link
            </Button>
            <Button
              data-testid="send-open-public"
              onClick={openPublic}
              variant="outline"
              className="h-11 rounded-xl"
            >
              <ExternalLink className="w-4 h-4 mr-1.5" /> Ver
            </Button>
          </div>

          <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
            <div className="font-semibold text-slate-600 mb-1">
              Mensaje pre-llenado:
            </div>
            <div className="text-slate-500 whitespace-pre-line">{message}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
