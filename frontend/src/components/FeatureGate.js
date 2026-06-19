/**
 * FeatureGate — wraps a route/page and only renders it if the logged-in user
 * has the required feature unlocked (driven by backend `user.features`).
 * Otherwise shows an UpgradeWall (also covers the "trial ended / locked" case).
 */
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Lock, Crown, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURE_INFO = {
  card: {
    label: "Presencia",
    desc: "tu tarjeta digital NFC, mini-sitio web y reseñas de Google",
  },
  business: {
    label: "Negocio",
    desc: "presupuestos, facturas y contratos con IA, CRM y calendario",
  },
  marketing: {
    label: "Marketing",
    desc: "el estudio de posts y videos con IA",
  },
};

export function UpgradeWall({ feature, locked }) {
  const navigate = useNavigate();
  const info = FEATURE_INFO[feature] || FEATURE_INFO.business;
  return (
    <div className="max-w-lg mx-auto py-12 sm:py-16 text-center px-4" data-testid="upgrade-wall">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-5">
        <Lock className="w-7 h-7" />
      </div>
      <h2 className="font-heading text-2xl font-bold tracking-tight">
        {locked ? "Tu prueba gratis terminó" : `Desbloquea ${info.label}`}
      </h2>
      <p className="text-slate-500 mt-2 leading-relaxed">
        {locked
          ? "Elige un plan para seguir usando UniTech y todas tus herramientas."
          : `Para usar ${info.desc}, activa el plan ${info.label} o el Bundle completo.`}
      </p>
      <Button
        data-testid="upgrade-wall-cta"
        onClick={() => navigate("/precios")}
        className="mt-6 h-12 px-6 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold"
      >
        <Crown className="w-5 h-5 mr-2" /> Ver planes <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}

export function FeatureGate({ feature, children }) {
  const { loading, hasFeature, features } = useAuth();
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }
  const required = Array.isArray(feature) ? feature : [feature];
  if (required.some((f) => hasFeature(f))) return children;
  return <UpgradeWall feature={required[0]} locked={(features || []).length === 0} />;
}
