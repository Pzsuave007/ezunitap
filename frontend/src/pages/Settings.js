import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({
    business_name: user?.business_name || "",
    owner_name: user?.owner_name || "",
    phone: user?.phone || "",
    business_address: user?.business_address || "",
    business_email: user?.business_email || "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/auth/me", form);
      await refreshUser();
      toast.success("Datos actualizados");
    } catch {
      toast.error("Error");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-7 h-7" /> Ajustes
        </h1>
        <p className="text-slate-500 mt-1">Estos datos aparecen en tus quotes e invoices.</p>
      </div>

      <Card className="card-elevated p-5 border-0 shadow-none space-y-3">
        <div>
          <Label>Nombre del negocio</Label>
          <Input data-testid="settings-business" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} className="h-12 rounded-xl mt-1.5" />
        </div>
        <div>
          <Label>Tu nombre</Label>
          <Input data-testid="settings-owner" value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} className="h-12 rounded-xl mt-1.5" />
        </div>
        <div>
          <Label>Teléfono</Label>
          <Input data-testid="settings-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-12 rounded-xl mt-1.5" />
        </div>
        <div>
          <Label>Email de negocio</Label>
          <Input data-testid="settings-email" value={form.business_email} onChange={(e) => setForm({ ...form, business_email: e.target.value })} className="h-12 rounded-xl mt-1.5" />
        </div>
        <div>
          <Label>Dirección de negocio</Label>
          <Input data-testid="settings-address" value={form.business_address} onChange={(e) => setForm({ ...form, business_address: e.target.value })} className="h-12 rounded-xl mt-1.5" />
        </div>
        <Button data-testid="settings-save" onClick={save} disabled={saving} className="w-full h-14 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-semibold">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Guardar"}
        </Button>
      </Card>
    </div>
  );
}
