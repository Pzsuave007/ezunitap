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
import { useMemo, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MessageCircle, Smartphone, Mail, Copy, ExternalLink, Paperclip, Loader2 } from "lucide-react";
import { toast } from "sonner";

const KIND_LABELS = {
  quote: {
    title: "Mandar Quote",
    description: "Envía el quote al cliente para que lo revise y lo acepte.",
    cta: "Quote",
    enShort: "your quote",
    noun: "quote",
    enAction: "Please review and let me know if you have any questions",
  },
  agreement: {
    title: "Mandar Contrato",
    description: "Envía el contrato al cliente para que lo firme.",
    cta: "Service Agreement",
    enShort: "your service agreement",
    noun: "service agreement",
    enAction: "Please review and sign at the link below",
  },
  invoice: {
    title: "Mandar Invoice",
    description: "Envía el invoice al cliente para que vea el monto a pagar.",
    cta: "Invoice",
    enShort: "your invoice",
    noun: "invoice",
    enAction: "You can review, download, or print it from the link below",
  },
  review: {
    title: "Pedir reseña",
    description: "Pídele al cliente que te deje una reseña. Solo le toma 30 segundos.",
    cta: "Review request",
    enShort: "",
    noun: "",
    enAction: "",
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
  getPdfBlob,
}) {
  const meta = KIND_LABELS[kind] || KIND_LABELS.quote;
  const clientName = client?.name || "";
  const phone = cleanPhone(client?.phone);
  const email = client?.email || "";
  const [sharing, setSharing] = useState(false);

  // Client-facing message — ALWAYS in English (the app UI is in Spanish
  // but all customer communication must be in English).
  const message = useMemo(() => {
    const firstName = clientName ? clientName.split(" ")[0] : "";
    const greet = firstName ? `Hi ${firstName},` : "Hi,";
    const biz = businessName ? `\n\n— ${businessName}` : "";
    if (kind === "review") {
      const who = businessName ? ` for choosing ${businessName}` : "";
      return `${greet}\n\nThank you so much${who}! It would mean a lot if you could leave us a quick review — it only takes 30 seconds:\n\n${publicUrl}\n\nThank you!${biz}`;
    }
    const job = jobTitle ? ` for ${jobTitle}` : "";
    return `${greet}\n\nHere is ${meta.enShort}${job}. ${meta.enAction}:\n\n${publicUrl}${biz}`;
  }, [clientName, jobTitle, businessName, kind, meta.enShort, meta.enAction, publicUrl]);

  const messageShort = useMemo(() => {
    const firstName = clientName ? clientName.split(" ")[0] : "";
    const greet = firstName ? `Hi ${firstName},` : "Hi,";
    if (kind === "review") {
      const who = businessName ? ` for choosing ${businessName}` : "";
      return `${greet} thank you${who}! Could you leave us a quick review? It only takes 30 sec: ${publicUrl}`;
    }
    return `${greet} here is ${meta.enShort}: ${publicUrl}`;
  }, [clientName, businessName, kind, meta.enShort, publicUrl]);

  const emailSubject = kind === "review"
    ? `Quick favor — leave ${businessName || "us"} a review?`
    : `${meta.cta}${jobTitle ? ` - ${jobTitle}` : ""}${businessName ? ` from ${businessName}` : ""}`;

  // Message used when the PDF is actually attached (share / attach flow) — it
  // references the attached document and adapts to invoice/quote/agreement.
  const attachMessage = useMemo(() => {
    const firstName = clientName ? clientName.split(" ")[0] : "";
    const greet = firstName ? `Hi ${firstName},` : "Hi,";
    const biz = businessName ? `\n\n— ${businessName}` : "";
    const job = jobTitle ? ` for ${jobTitle}` : "";
    const noun = meta.noun || "document";
    return `${greet}\n\nPlease find your ${noun}${job} attached as a PDF. ${meta.enAction}. You can also view it here:\n\n${publicUrl}${biz}`;
  }, [clientName, jobTitle, businessName, meta.noun, meta.enAction, publicUrl]);

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

  const openEmail = (bodyText) => {
    const subject = encodeURIComponent(emailSubject);
    const body = encodeURIComponent(bodyText || message);
    // Always open the user's mail app. If the client has no saved email, leave
    // the "to" blank so they can type it — never a silent no-op.
    const href = `mailto:${email || ""}?subject=${subject}&body=${body}`;
    const a = document.createElement("a");
    a.href = href;
    a.target = "_self";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (!email) toast.info("Abriendo tu correo — escribe el email del cliente arriba");
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

  // Generate the PDF and share it as a real attachment via the native share
  // sheet (mobile). Falls back to downloading the PDF + opening email on
  // devices/browsers that can't share files (most desktops).
  const shareWithPdf = async () => {
    if (!getPdfBlob || sharing) return;
    setSharing(true);
    // Copy the client's email so the user can paste it into the "To" field —
    // the phone's share sheet cannot pre-fill a recipient when sharing a file.
    let copiedEmail = false;
    if (email) {
      try { await navigator.clipboard.writeText(email); copiedEmail = true; } catch {}
    }
    try {
      const { blob, filename } = await getPdfBlob();
      const file = new File([blob], filename, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        if (copiedEmail) toast.success(`Copiamos ${email} — pégalo en "Para" si eliges Email`, { duration: 6000 });
        await navigator.share({ files: [file], title: emailSubject, text: attachMessage });
      } else {
        // Fallback: download the PDF so they can attach it, then open email.
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        toast.success("PDF descargado — adjúntalo en el correo que se abrió");
        openEmail(attachMessage);
      }
    } catch (err) {
      if (err?.name !== "AbortError") toast.error("No se pudo generar el PDF");
    } finally {
      setSharing(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[92vh] overflow-y-auto" data-testid="send-document-dialog">
        <div className="max-w-md mx-auto w-full">
          <SheetHeader className="text-left">
            <SheetTitle className="font-heading">{meta.title}</SheetTitle>
            <SheetDescription>{meta.description}</SheetDescription>
          </SheetHeader>

          <div className="space-y-2 mt-4">
          {getPdfBlob && (
            <button
              data-testid="send-pdf-attach"
              onClick={shareWithPdf}
              disabled={sharing}
              className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-blue-900 bg-blue-900 hover:bg-blue-800 transition text-left text-white disabled:opacity-60"
            >
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                {sharing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">Enviar con PDF adjunto</div>
                <div className="text-xs text-white/70 truncate">
                  Genera el PDF y lo adjunta (Email, WhatsApp, etc.)
                </div>
              </div>
            </button>
          )}

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
            onClick={() => openEmail()}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-amber-50 hover:border-amber-300 transition text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">Email</div>
              <div className="text-xs text-slate-500 truncate">
                {email || "Abre tu app de correo (escribe el email)"}
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
              Mensaje (en inglés, listo para mandar):
            </div>
            <div className="text-slate-500 whitespace-pre-line">{message}</div>
          </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
