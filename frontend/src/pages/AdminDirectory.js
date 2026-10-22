/**
 * AdminDirectory — super-admin control panel for the public contractor
 * directory ("Pro Finder"). Approve/revoke sponsor badges and edit the
 * directory branding + sponsor WITHOUT touching code.
 */
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import AdminTabs from "@/components/AdminTabs";
import {
  Store, Loader2, BadgeCheck, Search, ExternalLink, Save, Palette,
  Eye, EyeOff, Clock, X,
} from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

export default function AdminDirectory() {
  const [profiles, setProfiles] = useState([]);
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingCfg, setSavingCfg] = useState(false);
  const [q, setQ] = useState("");

  const load = async () => {
    try {
      const [p, c] = await Promise.all([
        api.get("/admin/directory/profiles"),
        api.get("/public/directory/config"),
      ]);
      setProfiles(p.data.profiles || []);
      setCfg(c.data.config || {});
    } catch {
      toast.error("No se pudo cargar el directorio");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const setBadge = async (userId, status) => {
    try {
      await api.post(`/admin/directory/profiles/${userId}/badge`, { status });
      setProfiles((list) => list.map((p) => (p.user_id === userId ? { ...p, badge_status: status } : p)));
      toast.success(status === "approved" ? "Sello aprobado" : status === "none" ? "Sello quitado" : "Marcado pendiente");
    } catch {
      toast.error("No se pudo actualizar el sello");
    }
  };

  const saveCfg = async () => {
    setSavingCfg(true);
    try {
      const { data } = await api.put("/admin/directory/config", cfg);
      setCfg(data.config);
      toast.success("Configuración guardada");
    } catch {
      toast.error("No se pudo guardar");
    } finally {
      setSavingCfg(false);
    }
  };

  const setC = (k, v) => setCfg((c) => ({ ...c, [k]: v }));

  const filtered = profiles.filter((p) =>
    !q || (p.business_name || "").toLowerCase().includes(q.toLowerCase()) ||
    (p.city || "").toLowerCase().includes(q.toLowerCase()));

  const pendingCount = profiles.filter((p) => p.badge_status === "pending").length;

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 py-6"><AdminTabs />
      <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-6" data-testid="admin-directory">
      <AdminTabs />

      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center flex-none">
          <Store className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Directorio Pro Finder</h1>
          <p className="text-slate-500 text-sm">{profiles.length} fichas · {profiles.filter((p) => p.published).length} publicadas{pendingCount ? ` · ${pendingCount} sello(s) por revisar` : ""}</p>
        </div>
      </div>

      {/* Branding / sponsor config */}
      {cfg && (
        <Card className="p-5 border-0 shadow-sm mb-6" data-testid="admin-directory-config">
          <div className="flex items-center gap-2 mb-4 text-slate-700">
            <Palette className="w-4 h-4" />
            <h2 className="font-bold text-sm uppercase tracking-wider">Marca y patrocinador</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre del directorio">
              <Input data-testid="cfg-name" value={cfg.name || ""} onChange={(e) => setC("name", e.target.value)} className="rounded-xl" />
            </Field>
            <Field label="Color principal">
              <div className="flex items-center gap-2">
                <input type="color" value={cfg.primary_color || "#0f5f46"} onChange={(e) => setC("primary_color", e.target.value)} className="w-11 h-10 rounded-lg border border-slate-200 cursor-pointer" data-testid="cfg-primary" />
                <Input value={cfg.primary_color || ""} onChange={(e) => setC("primary_color", e.target.value)} className="rounded-xl" />
              </div>
            </Field>
            <Field label="Eslogan (Español)">
              <Input data-testid="cfg-tagline-es" value={cfg.tagline_es || ""} onChange={(e) => setC("tagline_es", e.target.value)} className="rounded-xl" />
            </Field>
            <Field label="Eslogan (Inglés)">
              <Input value={cfg.tagline_en || ""} onChange={(e) => setC("tagline_en", e.target.value)} className="rounded-xl" />
            </Field>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-bold text-sm text-slate-800">Mostrar patrocinador</p>
                <p className="text-xs text-slate-500">Actívalo cuando tengas permiso del patrocinador (ej. Sherwin-Williams)</p>
              </div>
              <Switch checked={!!cfg.sponsor_enabled} onCheckedChange={(v) => setC("sponsor_enabled", v)} data-testid="cfg-sponsor-enabled" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nombre del patrocinador">
                <Input data-testid="cfg-sponsor-name" value={cfg.sponsor_name || ""} onChange={(e) => setC("sponsor_name", e.target.value)} className="rounded-xl" placeholder="Sherwin-Williams" />
              </Field>
              <Field label="Logo del patrocinador (URL)">
                <Input data-testid="cfg-sponsor-logo" value={cfg.sponsor_logo_url || ""} onChange={(e) => setC("sponsor_logo_url", e.target.value)} className="rounded-xl" placeholder="https://..." />
              </Field>
              <Field label="Texto antes del patrocinador (ES)">
                <Input value={cfg.sponsor_label_es || ""} onChange={(e) => setC("sponsor_label_es", e.target.value)} className="rounded-xl" placeholder="Patrocinado por" />
              </Field>
              <Field label="Texto antes del patrocinador (EN)">
                <Input value={cfg.sponsor_label_en || ""} onChange={(e) => setC("sponsor_label_en", e.target.value)} className="rounded-xl" placeholder="Sponsored by" />
              </Field>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-5">
            <Button onClick={saveCfg} disabled={savingCfg} data-testid="cfg-save" className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700">
              {savingCfg ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Guardar
            </Button>
            <a href="/directorio" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-emerald-700 font-semibold">
              <ExternalLink className="w-4 h-4" /> Ver directorio público
            </a>
          </div>
        </Card>
      )}

      {/* Profiles list */}
      <Card className="p-5 border-0 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por negocio o ciudad…" data-testid="admin-directory-search" className="rounded-xl border-slate-200" />
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-slate-400 py-10 text-sm">No hay fichas todavía.</p>
        ) : (
          <div className="divide-y divide-slate-100" data-testid="admin-directory-list">
            {filtered.map((p) => (
              <div key={p.user_id} className="flex items-center gap-3 py-3" data-testid={`admin-dir-row-${p.slug}`}>
                <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-100 flex-none border border-slate-200">
                  {p.logo_photo_id || p.hero_photo_id
                    ? <img src={`${BACKEND}/api/public/card/photo/${p.logo_photo_id || p.hero_photo_id}`} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-slate-300"><Store className="w-5 h-5" /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800 truncate">{p.business_name || "—"}</p>
                    {p.published
                      ? <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium"><Eye className="w-3 h-3" /> Publicada</span>
                      : <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium"><EyeOff className="w-3 h-3" /> Oculta</span>}
                  </div>
                  <p className="text-xs text-slate-500 truncate">{p.city}{p.state ? `, ${p.state}` : ""} · {(p.categories || []).length} servicio(s)</p>
                </div>

                {/* Badge control */}
                {p.badge_status === "approved" ? (
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-full">
                      <BadgeCheck className="w-3.5 h-3.5" /> Aprobado
                    </span>
                    <button onClick={() => setBadge(p.user_id, "none")} data-testid={`badge-revoke-${p.slug}`} title="Quitar sello"
                      className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"><X className="w-4 h-4" /></button>
                  </div>
                ) : p.badge_status === "pending" ? (
                  <Button size="sm" onClick={() => setBadge(p.user_id, "approved")} data-testid={`badge-approve-${p.slug}`}
                    className="h-9 rounded-xl bg-amber-500 hover:bg-amber-600 text-white">
                    <Clock className="w-3.5 h-3.5 mr-1.5" /> Aprobar sello
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setBadge(p.user_id, "approved")} data-testid={`badge-grant-${p.slug}`}
                    className="h-9 rounded-xl">
                    <BadgeCheck className="w-3.5 h-3.5 mr-1.5" /> Dar sello
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}
