/**
 * ImpersonationBanner — Shown only when the super-admin is currently logged
 * in as another user via /admin/metricas. Lets them return to their own
 * session in one click.
 */
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ShieldAlert, LogOut } from "lucide-react";

export default function ImpersonationBanner() {
  const { isImpersonating, endImpersonation, user } = useAuth();
  const navigate = useNavigate();

  if (!isImpersonating) return null;

  const adminEmail = (typeof window !== "undefined")
    ? localStorage.getItem("sf_admin_email")
    : null;

  const handleEnd = async () => {
    await endImpersonation();
    navigate("/admin/metricas");
  };

  return (
    <div
      data-testid="impersonation-banner"
      className="mb-4 rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 text-white p-4 shadow-lg border border-rose-300"
    >
      <div className="flex items-center gap-3 flex-wrap">
        <ShieldAlert className="w-5 h-5 flex-none" />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm">
            Modo asistencia activo
          </div>
          <div className="text-xs opacity-90 truncate">
            Estás viendo la app como{" "}
            <strong>{user?.business_name || user?.email}</strong>
            {adminEmail ? ` — admin original: ${adminEmail}` : ""}
          </div>
        </div>
        <button
          data-testid="end-impersonation"
          onClick={handleEnd}
          className="inline-flex items-center gap-1.5 bg-white/95 text-rose-700 hover:bg-white text-xs font-bold px-3 py-2 rounded-xl shadow-sm transition"
        >
          <LogOut className="w-3.5 h-3.5" /> Volver a mi cuenta
        </button>
      </div>
    </div>
  );
}
