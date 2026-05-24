/**
 * Perfil — unified profile management.
 * Centralizes all user + business + branding info used across:
 * - Quotes & invoices (logo, business name, phone, address, email)
 * - Smart Business Card (everything above + role, about_me, profile photo)
 */
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  User as UserIcon, Building2, Image as ImageIcon, Camera,
  Loader2, Upload, X as XIcon, LogOut, IdCard, Sparkles,
} from "lucide-react";
import { toast } from "sonner";

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function Profile() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    await refreshUser();
  };

  useEffect(() => {
    if (user) {
      setForm({
        // user fields (PUT /auth/me)
        business_name: user.business_name || "",
        owner_name: user.owner_name || "",
        phone: user.phone || "",
        business_email: user.business_email || user.email || "",
        business_address: user.business_address || "",
        // card fields (PUT /card/settings)
        role: user.role || "",
        about_me: user.about_me || "",
        // photo ids (read-only here; updated via dedicated upload buttons)
        logo_photo_id: user.logo_photo_id || null,
        profile_photo_id: user.profile_photo_id || null,
      });
    }
  }, [user]);

  const update = (k, v) => setForm({ ...form, [k]: v });

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all([
        api.put("/auth/me", {
          business_name: form.business_name,
          owner_name: form.owner_name,
          phone: form.phone,
          business_email: form.business_email,
          business_address: form.business_address,
        }),
        api.put("/card/settings", {
          role: form.role,
          about_me: form.about_me,
        }),
      ]);
      await refreshUser();
      toast.success("Perfil actualizado");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error guardando");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (!form) return <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
          <UserIcon className="w-7 h-7 text-blue-900" /> Perfil
        </h1>
        <p className="text-slate-500 mt-1">Tu información personal y de negocio. Aparece en quotes, invoices y tu Tarjeta.</p>
      </div>

      {/* Photos */}
      <AssetUploader
        title="Foto del dueño"
        helper="Aparece como hero en tu Tarjeta. Vertical funciona mejor. Máx 8MB."
        kind="profile_photo"
        idField="profile_photo_id"
        endpoint="/card/profile-photo"
        rounded="rounded-3xl"
        size="w-24 h-32"
        currentId={user?.profile_photo_id}
        onChange={load}
        icon={Camera}
      />

      <AssetUploader
        title="Logo del negocio"
        helper="Aparece en quotes, invoices y tu Tarjeta. Cuadrado y con fondo transparente queda mejor. Máx 8MB."
        kind="logo"
        idField="logo_photo_id"
        endpoint="/card/logo"
        rounded="rounded-2xl"
        size="w-20 h-20"
        currentId={user?.logo_photo_id}
        onChange={load}
        icon={ImageIcon}
        badge="Aparece en tus PDFs"
      />

      {/* Personal Info */}
      <Card className="card-elevated p-5 border-0 shadow-none space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <UserIcon className="w-5 h-5 text-blue-900" />
          <h3 className="font-heading font-bold text-base">Tu información</h3>
        </div>
        <div>
          <Label>Tu nombre</Label>
          <Input
            data-testid="profile-owner-name"
            value={form.owner_name}
            onChange={(e) => update("owner_name", e.target.value)}
            className="h-12 rounded-xl mt-1.5"
            placeholder="Juan Pérez"
          />
          <p className="text-[11px] text-slate-400 mt-1">Es como te identificas en la app y en la Tarjeta.</p>
        </div>
        <div>
          <Label>Tu rol / título (inglés, opcional)</Label>
          <Input
            data-testid="profile-role"
            value={form.role}
            onChange={(e) => update("role", e.target.value)}
            className="h-12 rounded-xl mt-1.5"
            placeholder="Owner & Lead Contractor"
          />
          <p className="text-[11px] text-slate-400 mt-1">Aparece debajo de tu nombre en la Tarjeta.</p>
        </div>
        <div>
          <Label>Email de la cuenta (no editable aquí)</Label>
          <Input value={user?.email || ""} disabled className="h-12 rounded-xl mt-1.5 bg-slate-50" />
        </div>
      </Card>

      {/* Business Info */}
      <Card className="card-elevated p-5 border-0 shadow-none space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-5 h-5 text-emerald-700" />
          <h3 className="font-heading font-bold text-base">Negocio</h3>
        </div>
        <div>
          <Label>Nombre del negocio</Label>
          <Input
            data-testid="profile-business-name"
            value={form.business_name}
            onChange={(e) => update("business_name", e.target.value)}
            className="h-12 rounded-xl mt-1.5"
            placeholder="Juan's Roofing LLC"
          />
        </div>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <Label>Teléfono</Label>
            <Input
              data-testid="profile-phone"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              className="h-12 rounded-xl mt-1.5"
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <Label>Email de negocio</Label>
            <Input
              data-testid="profile-business-email"
              value={form.business_email}
              onChange={(e) => update("business_email", e.target.value)}
              className="h-12 rounded-xl mt-1.5"
              placeholder="contact@yourbusiness.com"
            />
          </div>
          <div>
            <Label>Dirección de negocio</Label>
            <Input
              data-testid="profile-address"
              value={form.business_address}
              onChange={(e) => update("business_address", e.target.value)}
              className="h-12 rounded-xl mt-1.5"
              placeholder="123 Main St, Houston TX"
            />
          </div>
        </div>
        <div className="p-3 rounded-xl bg-blue-50 text-xs text-blue-900">
          ℹ️ Estos datos aparecen automáticamente en cada <strong>quote</strong> e <strong>invoice</strong> que generes.
        </div>
      </Card>

      {/* About Me */}
      <Card className="card-elevated p-5 border-0 shadow-none space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-violet-600" />
          <h3 className="font-heading font-bold text-base">Sobre ti</h3>
        </div>
        <div>
          <Label>Bio / About Me (inglés)</Label>
          <Textarea
            data-testid="profile-about"
            value={form.about_me}
            onChange={(e) => update("about_me", e.target.value)}
            className="rounded-xl mt-1.5 min-h-[120px]"
            placeholder="With over 10 years of experience, we deliver quality work on every project. Licensed, insured, and committed to your satisfaction."
          />
          <p className="text-[11px] text-slate-400 mt-1">Aparece en la sección "About" de tu Tarjeta pública.</p>
        </div>
      </Card>

      <Button
        data-testid="profile-save"
        onClick={save}
        disabled={saving}
        className="w-full h-14 rounded-2xl bg-blue-900 hover:bg-blue-950 text-white font-semibold text-base"
      >
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Guardar todo"}
      </Button>

      {/* Quick links */}
      <Card className="card-elevated p-5 border-0 shadow-none">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Atajos</div>
        <button
          onClick={() => navigate("/tarjeta")}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 tap"
          data-testid="profile-link-card"
        >
          <span className="flex items-center gap-3">
            <IdCard className="w-5 h-5 text-emerald-600" />
            <span className="font-semibold text-sm">Gestionar Tarjeta Inteligente</span>
          </span>
          <span className="text-slate-400">›</span>
        </button>
      </Card>

      {/* Logout */}
      <Button
        data-testid="profile-logout"
        onClick={handleLogout}
        variant="outline"
        className="w-full h-12 rounded-xl border-red-200 text-red-600 hover:bg-red-50"
      >
        <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
      </Button>
    </div>
  );
}

// ============= Asset uploader =============
function AssetUploader({ title, helper, endpoint, currentId, rounded, size, onChange, icon: Icon, badge, kind }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const url = currentId ? `${API_URL}/api/public/card/photo/${currentId}` : null;

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(endpoint, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`${title} subido`);
      onChange();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const remove = async () => {
    if (!window.confirm(`¿Quitar ${title.toLowerCase()}?`)) return;
    await api.delete(endpoint);
    toast.success("Removido");
    onChange();
  };

  return (
    <Card className="card-elevated p-5 border-0 shadow-none">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Icon className="w-5 h-5 text-emerald-600" />
        <h3 className="font-heading font-bold text-base">{title}</h3>
        {badge && (
          <span className="ml-auto inline-block text-[10px] uppercase tracking-wider font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
            {badge}
          </span>
        )}
      </div>
      <div className="flex items-start gap-4">
        <div className="relative flex-shrink-0">
          {url ? (
            <img
              src={url}
              alt={kind}
              data-testid={`${kind}-preview`}
              className={`${size} ${rounded} object-cover border border-slate-200 shadow-sm`}
            />
          ) : (
            <div className={`${size} ${rounded} bg-slate-100 flex items-center justify-center text-slate-400`}>
              <Icon className="w-8 h-8" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 mb-3">{helper}</p>
          <div className="flex gap-2 flex-wrap">
            <Button
              data-testid={`${kind}-upload-btn`}
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
              {url ? "Cambiar" : "Subir"}
            </Button>
            {url && (
              <Button
                data-testid={`${kind}-remove-btn`}
                size="sm"
                variant="outline"
                onClick={remove}
                className="rounded-xl text-red-600"
              >
                <XIcon className="w-3.5 h-3.5 mr-1" /> Quitar
              </Button>
            )}
          </div>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleFile} />
        </div>
      </div>
    </Card>
  );
}
