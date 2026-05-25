import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hammer, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("¡Bienvenido!");
      navigate("/");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-blue-900 via-blue-800 to-emerald-700 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px)",
          backgroundSize: "32px 32px"
        }} />
        <div className="relative max-w-md text-white">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mb-6 border border-white/20">
            <Hammer className="w-8 h-8" strokeWidth={2.5} />
          </div>
          <h1 className="font-heading text-5xl font-bold leading-tight tracking-tight">
            La forma más simple de cotizar y cobrar.
          </h1>
          <p className="mt-6 text-lg text-white/80 leading-relaxed">
            Crea quotes profesionales con AI, manda invoices en inglés y dale seguimiento a tus trabajos. Hecho para contratistas latinos.
          </p>
          <div className="mt-10 space-y-3">
            {["Quotes profesionales con AI en segundos", "Mensajes en inglés para tus clientes", "Trabaja desde tu celular en la obra"].map((f) => (
              <div key={f} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-300 mt-2" />
                <span className="text-white/90">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center">
              <Hammer className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-heading font-bold text-xl">Unitap</span>
          </div>
          <h2 className="font-heading text-3xl font-bold tracking-tight">Bienvenido de vuelta</h2>
          <p className="text-slate-500 mt-2">Inicia sesión para continuar</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                data-testid="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-14 rounded-xl mt-1.5"
                placeholder="tu@email.com"
              />
            </div>
            <div>
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                data-testid="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-14 rounded-xl mt-1.5"
                placeholder="••••••••"
              />
            </div>
            <Button
              type="submit"
              data-testid="login-submit"
              disabled={loading}
              className="w-full h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Iniciar sesión"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            ¿No tienes cuenta?{" "}
            <Link to="/register" data-testid="link-register" className="font-semibold text-blue-900 hover:underline">
              Crea una gratis
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
