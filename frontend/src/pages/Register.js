import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hammer, Loader2, Gift } from "lucide-react";
import { toast } from "sonner";

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [params] = useSearchParams();
  const inviteToken = params.get("invite") || "";
  const [form, setForm] = useState({
    business_name: "",
    owner_name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const onChange = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setLoading(true);
    try {
      await register({ ...form, invite_token: inviteToken || undefined });
      toast.success(
        inviteToken
          ? "¡Cuenta creada con acceso gratis! 🎁"
          : "¡Cuenta creada! Bienvenido."
      );
      navigate("/");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error al crear cuenta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center">
            <Hammer className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-heading font-bold text-xl">Unitap</span>
        </div>

        {inviteToken && (
          <div
            data-testid="invite-banner"
            className="mb-5 p-3 rounded-2xl bg-gradient-to-br from-amber-50 to-emerald-50 border border-amber-200 flex items-center gap-2"
          >
            <Gift className="w-5 h-5 text-amber-700 flex-none" />
            <div className="text-xs text-amber-900">
              <div className="font-semibold">¡Tienes una invitación!</div>
              <div className="text-amber-800">
                Al registrarte tendrás acceso gratis a todo Unitap.
              </div>
            </div>
          </div>
        )}

        <h2 className="font-heading text-3xl font-bold tracking-tight">Crea tu cuenta</h2>
        <p className="text-slate-500 mt-2 text-sm">Empieza gratis. Sin tarjeta requerida.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <div>
            <Label>Nombre del negocio</Label>
            <Input
              data-testid="reg-business"
              required
              value={form.business_name}
              onChange={onChange("business_name")}
              className="h-12 rounded-xl mt-1.5"
              placeholder="Ej: Juan's Roofing LLC"
            />
          </div>
          <div>
            <Label>Tu nombre</Label>
            <Input
              data-testid="reg-owner"
              value={form.owner_name}
              onChange={onChange("owner_name")}
              className="h-12 rounded-xl mt-1.5"
              placeholder="Juan Pérez"
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              data-testid="reg-email"
              type="email"
              required
              value={form.email}
              onChange={onChange("email")}
              className="h-12 rounded-xl mt-1.5"
              placeholder="tu@email.com"
            />
          </div>
          <div>
            <Label>Teléfono</Label>
            <Input
              data-testid="reg-phone"
              value={form.phone}
              onChange={onChange("phone")}
              className="h-12 rounded-xl mt-1.5"
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <Label>Contraseña</Label>
            <Input
              data-testid="reg-password"
              type="password"
              required
              value={form.password}
              onChange={onChange("password")}
              className="h-12 rounded-xl mt-1.5"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <Button
            type="submit"
            data-testid="reg-submit"
            disabled={loading}
            className="w-full h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base mt-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Crear cuenta"}
          </Button>
          <p className="text-[11px] text-slate-500 text-center mt-1">
            Al crear una cuenta aceptas nuestros{" "}
            <Link to="/terminos" className="underline hover:text-slate-700">Términos</Link>
            {" "}y{" "}
            <Link to="/privacidad" className="underline hover:text-slate-700">Política de Privacidad</Link>.
          </p>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" data-testid="link-login" className="font-semibold text-blue-900 hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
