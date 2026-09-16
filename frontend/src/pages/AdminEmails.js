/**
 * AdminEmails — verify the Resend email-notification system.
 *
 * Account owners get non-blocking email alerts on new leads, payments and
 * reviews. This panel lets the super-admin send a test email to confirm the
 * RESEND_API_KEY is wired up correctly on the backend.
 */
import { useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Send, Loader2, CheckCircle2, XCircle, Bell, DollarSign, Star } from "lucide-react";
import { toast } from "sonner";
import AdminTabs from "@/components/AdminTabs";

export default function AdminEmails() {
  const [email, setEmail] = useState("");
  const [lang, setLang] = useState("es");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const sendTest = async () => {
    setSending(true);
    setResult(null);
    try {
      const { data } = await api.post("/admin/notify/test", { email: email.trim() || null, lang });
      setResult(data);
      if (data.ok) toast.success("¡Correo de prueba enviado!");
      else if (data.configured === false) toast.error("Resend no está configurado todavía");
      else toast.error("No se pudo enviar el correo");
    } catch (e) {
      const detail = e?.response?.data?.detail || "Error al enviar el correo de prueba";
      setResult({ ok: false, error: detail });
      toast.error(detail);
    } finally {
      setSending(false);
    }
  };

  const events = [
    { icon: Bell, color: "text-blue-600 bg-blue-50", title: "Nuevo lead", desc: "Cuando alguien llena un formulario en tu sitio web, página de problema o tarjeta digital." },
    { icon: DollarSign, color: "text-emerald-600 bg-emerald-50", title: "Pago recibido", desc: "Cuando un cliente paga una factura (en efectivo, transferencia o con tarjeta vía Stripe)." },
    { icon: Star, color: "text-amber-600 bg-amber-50", title: "Nueva reseña / feedback", desc: "Cuando un cliente deja una reseña o feedback privado desde tu tarjeta digital." },
  ];

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6" data-testid="admin-emails-page">
      <AdminTabs />

      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-slate-900 text-white grid place-items-center">
          <Mail className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notificaciones por Email</h1>
          <p className="text-sm text-slate-500">Avisos automáticos a los dueños de cuenta (vía Resend)</p>
        </div>
      </div>

      <Card className="p-5 mb-5">
        <h2 className="text-base font-semibold text-slate-800 mb-3">¿Cuándo se envía un email?</h2>
        <div className="space-y-3">
          {events.map((ev) => (
            <div key={ev.title} className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${ev.color}`}>
                <ev.icon className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold text-sm text-slate-800">{ev.title}</div>
                <div className="text-sm text-slate-500">{ev.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-4">
          Cada dueño recibe los avisos de SU cuenta, en su idioma. Los envíos son no bloqueantes:
          si Resend falla, la operación principal nunca se ve afectada.
        </p>
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-semibold text-slate-800 mb-1">Enviar correo de prueba</h2>
        <p className="text-sm text-slate-500 mb-4">
          Verifica que la <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">RESEND_API_KEY</code> esté
          funcionando. Déjalo vacío para usar el correo configurado (NOTIFY_EMAIL).
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            type="email"
            placeholder="correo@ejemplo.com (opcional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="notify-test-email-input"
            className="flex-1"
          />
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            data-testid="notify-test-lang-select"
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
          <Button onClick={sendTest} disabled={sending} data-testid="notify-test-send-btn">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span className="ml-2">Enviar prueba</span>
          </Button>
        </div>

        {result && (
          <div
            data-testid="notify-test-result"
            className={`mt-4 flex items-start gap-2 rounded-lg p-3 text-sm ${
              result.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
            }`}
          >
            {result.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <XCircle className="w-4 h-4 mt-0.5" />}
            <div>
              {result.ok
                ? `Correo enviado a ${result.to} (${result.backend || "resend"}).`
                : result.configured === false
                ? result.detail || "Resend no está configurado. Agrega RESEND_API_KEY en el backend."
                : result.detail || result.error || "No se pudo enviar el correo."}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
