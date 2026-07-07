import { useEffect, useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  QrCode, Download, Copy, Pencil, Trash2, Link2, Globe, MessageCircle,
  IdCard, Star, BarChart3, Loader2, Plus, Zap, Lock,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const ORIGIN = () => window.location.origin;

const DEST_TYPES = (t) => [
  { id: "url", labelKey: "qr.destUrl", icon: Globe },
  { id: "card", labelKey: "qr.destCard", icon: IdCard },
  { id: "reviews", labelKey: "qr.destReviews", icon: Star },
  { id: "whatsapp", labelKey: "qr.destWhatsapp", icon: MessageCircle },
];

// Build the value the QR encodes: dynamic -> our stable redirect; static -> dest.
const qrValue = (q) =>
  q.mode === "dynamic" ? `${ORIGIN()}/api/public/q/${q.slug}` : q.dest;

function downloadCanvas(id, name) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name || "qr"}.png`;
  a.click();
}

export default function QrCodes() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);

  // create form
  const [label, setLabel] = useState("");
  const [destType, setDestType] = useState("url");
  const [urlVal, setUrlVal] = useState("");
  const [phone, setPhone] = useState("");
  const [waMsg, setWaMsg] = useState("");
  const [mode, setMode] = useState("dynamic");
  const [fg, setFg] = useState("#0f172a");
  const [bg, setBg] = useState("#ffffff");
  const [logo, setLogo] = useState(false);

  const logoUrl = user?.logo_photo_id ? `${API}/public/card/photo/${user.logo_photo_id}` : null;
  const cardSlug = user?.card_slug;

  const load = async () => {
    try {
      const { data } = await api.get("/qr");
      setItems(data);
    } catch (e) {
      toast.error(t("qr.errLoad"));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const computedDest = useMemo(() => {
    if (destType === "url") return urlVal.trim();
    if (destType === "card") return cardSlug ? `${ORIGIN()}/c/${cardSlug}` : "";
    if (destType === "reviews") return cardSlug ? `${ORIGIN()}/r/${cardSlug}` : "";
    if (destType === "whatsapp") {
      const digits = phone.replace(/[^\d]/g, "");
      if (!digits) return "";
      return `https://wa.me/${digits}${waMsg ? `?text=${encodeURIComponent(waMsg)}` : ""}`;
    }
    return "";
  }, [destType, urlVal, phone, waMsg, cardSlug]);

  const needsCard = (destType === "card" || destType === "reviews") && !cardSlug;

  const resetForm = () => {
    setLabel(""); setUrlVal(""); setPhone(""); setWaMsg("");
    setDestType("url"); setMode("dynamic"); setLogo(false);
    setFg("#0f172a"); setBg("#ffffff");
  };

  const create = async () => {
    if (!computedDest) { toast.error(t("qr.errDest")); return; }
    setSaving(true);
    try {
      await api.post("/qr", {
        label: label || t("qr.defaultLabel"),
        mode, dest: computedDest, dest_type: destType, fg, bg, logo,
      });
      toast.success(t("qr.created"));
      resetForm();
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("qr.errSave"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/qr/${id}`);
      setItems((p) => p.filter((x) => x.id !== id));
      toast.success(t("qr.deleted"));
    } catch { toast.error(t("qr.errSave")); }
  };

  const copyLink = (q) => {
    navigator.clipboard.writeText(qrValue(q));
    toast.success(t("qr.copied"));
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const { data } = await api.put(`/qr/${editing.id}`, {
        label: editing.label,
        dest: editing.mode === "dynamic" ? editing.dest : undefined,
        fg: editing.fg, bg: editing.bg, logo: editing.logo,
      });
      setItems((p) => p.map((x) => (x.id === data.id ? data : x)));
      setEditing(null);
      toast.success(t("qr.updated"));
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("qr.errSave"));
    } finally { setSaving(false); }
  };

  const imgSettings = (q) =>
    q.logo && logoUrl ? { src: logoUrl, height: 96, width: 96, excavate: true, crossOrigin: "anonymous" } : undefined;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-8" data-testid="qr-page">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center flex-none">
          <QrCode className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold">{t("qr.title")}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t("qr.subtitle")}</p>
        </div>
      </div>

      {/* Create form */}
      <Card className="p-5 lg:p-6 border-0 shadow-sm space-y-5" data-testid="qr-create-form">
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-600" />
          <h2 className="font-heading font-bold text-lg">{t("qr.createTitle")}</h2>
        </div>

        <div className="space-y-1.5">
          <Label>{t("qr.label")}</Label>
          <Input data-testid="qr-label-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("qr.labelPh")} className="h-11 rounded-xl" />
        </div>

        <div className="space-y-1.5">
          <Label>{t("qr.destType")}</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {DEST_TYPES(t).map((d) => (
              <button
                key={d.id}
                type="button"
                data-testid={`qr-desttype-${d.id}`}
                onClick={() => setDestType(d.id)}
                className={`flex items-center gap-2 px-3 h-11 rounded-xl border text-sm font-medium transition ${destType === d.id ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
              >
                <d.icon className="w-4 h-4" /> {t(d.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {destType === "url" && (
          <div className="space-y-1.5">
            <Label>{t("qr.url")}</Label>
            <Input data-testid="qr-url-input" value={urlVal} onChange={(e) => setUrlVal(e.target.value)} placeholder="https://mitaller.com/promo" className="h-11 rounded-xl" />
          </div>
        )}
        {destType === "whatsapp" && (
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("qr.phone")}</Label>
              <Input data-testid="qr-phone-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("qr.waMsg")}</Label>
              <Input value={waMsg} onChange={(e) => setWaMsg(e.target.value)} placeholder={t("qr.waMsgPh")} className="h-11 rounded-xl" />
            </div>
          </div>
        )}
        {needsCard && (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{t("qr.needCard")}</p>
        )}

        {/* Mode */}
        <div className="space-y-1.5">
          <Label>{t("qr.mode")}</Label>
          <div className="grid sm:grid-cols-2 gap-2">
            <button type="button" data-testid="qr-mode-dynamic" onClick={() => setMode("dynamic")}
              className={`text-left p-3 rounded-xl border transition ${mode === "dynamic" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-slate-300"}`}>
              <div className="flex items-center gap-2 font-semibold text-sm"><Zap className="w-4 h-4 text-emerald-600" /> {t("qr.dynamic")}</div>
              <p className="text-xs text-slate-500 mt-1">{t("qr.dynamicDesc")}</p>
            </button>
            <button type="button" data-testid="qr-mode-static" onClick={() => setMode("static")}
              className={`text-left p-3 rounded-xl border transition ${mode === "static" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-slate-300"}`}>
              <div className="flex items-center gap-2 font-semibold text-sm"><Lock className="w-4 h-4 text-slate-500" /> {t("qr.static")}</div>
              <p className="text-xs text-slate-500 mt-1">{t("qr.staticDesc")}</p>
            </button>
          </div>
        </div>

        {/* Style */}
        <div className="flex flex-wrap items-end gap-5">
          <div className="space-y-1.5">
            <Label>{t("qr.colorFg")}</Label>
            <input type="color" data-testid="qr-fg" value={fg} onChange={(e) => setFg(e.target.value)} className="h-11 w-16 rounded-lg border border-slate-200 cursor-pointer" />
          </div>
          <div className="space-y-1.5">
            <Label>{t("qr.colorBg")}</Label>
            <input type="color" data-testid="qr-bg" value={bg} onChange={(e) => setBg(e.target.value)} className="h-11 w-16 rounded-lg border border-slate-200 cursor-pointer" />
          </div>
          <label className={`flex items-center gap-2 text-sm h-11 px-3 rounded-xl border cursor-pointer ${logo ? "border-emerald-500 bg-emerald-50" : "border-slate-200"} ${!logoUrl ? "opacity-50 pointer-events-none" : ""}`}>
            <input type="checkbox" data-testid="qr-logo" checked={logo} onChange={(e) => setLogo(e.target.checked)} />
            {t("qr.addLogo")}
          </label>
          {/* live preview */}
          {computedDest && !needsCard && (
            <div className="ml-auto p-2 bg-white border rounded-xl" style={{ borderColor: fg }}>
              <QRCodeCanvas value={mode === "dynamic" ? "https://preview" : computedDest} size={72} fgColor={fg} bgColor={bg} level="H" />
            </div>
          )}
        </div>

        <Button data-testid="qr-create-btn" onClick={create} disabled={saving || !computedDest || needsCard} className="h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white w-full sm:w-auto px-8">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{t("qr.createBtn")}</>}
        </Button>
      </Card>

      {/* List */}
      <div>
        <h2 className="font-heading font-bold text-lg mb-3">{t("qr.yourCodes")}</h2>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : items.length === 0 ? (
          <Card className="p-10 text-center border-dashed border-2 shadow-none" data-testid="qr-empty">
            <QrCode className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm text-slate-500 mt-3">{t("qr.empty")}</p>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="qr-list">
            {items.map((q) => (
              <Card key={q.id} className="p-4 border-0 shadow-sm flex flex-col" data-testid={`qr-item-${q.id}`}>
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm truncate pr-2">{q.label}</div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${q.mode === "dynamic" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {q.mode === "dynamic" ? t("qr.dynamic") : t("qr.static")}
                  </span>
                </div>
                <div className="mx-auto my-4 p-3 bg-white border rounded-2xl" style={{ borderColor: q.fg }}>
                  <QRCodeCanvas id={`qrc-${q.id}`} value={qrValue(q)} size={512}
                    fgColor={q.fg} bgColor={q.bg} level="H" includeMargin
                    imageSettings={imgSettings(q)} style={{ width: 150, height: 150 }} />
                </div>
                <div className="text-xs text-slate-500 truncate" title={q.dest}>{q.dest}</div>
                {q.mode === "dynamic" && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1.5" data-testid={`qr-scans-${q.id}`}>
                    <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-semibold">{q.scan_count}</span> {t("qr.scans")}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <Button size="sm" variant="outline" className="rounded-lg" data-testid={`qr-download-${q.id}`}
                    onClick={() => downloadCanvas(`qrc-${q.id}`, q.label)}>
                    <Download className="w-4 h-4 mr-1" /> {t("qr.download")}
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-lg" data-testid={`qr-copy-${q.id}`}
                    onClick={() => copyLink(q)}>
                    <Copy className="w-4 h-4 mr-1" /> {t("qr.copy")}
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-lg" data-testid={`qr-edit-${q.id}`}
                    onClick={() => setEditing({ ...q })}>
                    <Pencil className="w-4 h-4 mr-1" /> {t("qr.edit")}
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50" data-testid={`qr-delete-${q.id}`}
                    onClick={() => remove(q.id)}>
                    <Trash2 className="w-4 h-4 mr-1" /> {t("qr.delete")}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent data-testid="qr-edit-dialog">
          <DialogHeader><DialogTitle>{t("qr.editTitle")}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t("qr.label")}</Label>
                <Input data-testid="qr-edit-label" value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} className="h-11 rounded-xl" />
              </div>
              {editing.mode === "dynamic" ? (
                <div className="space-y-1.5">
                  <Label>{t("qr.newDest")}</Label>
                  <Input data-testid="qr-edit-dest" value={editing.dest} onChange={(e) => setEditing({ ...editing, dest: e.target.value })} className="h-11 rounded-xl" />
                  <p className="text-xs text-emerald-700">{t("qr.editHint")}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">{t("qr.staticNoEdit")}</p>
              )}
              <div className="flex items-end gap-4">
                <div className="space-y-1.5"><Label>{t("qr.colorFg")}</Label>
                  <input type="color" value={editing.fg} onChange={(e) => setEditing({ ...editing, fg: e.target.value })} className="h-11 w-16 rounded-lg border cursor-pointer" /></div>
                <div className="space-y-1.5"><Label>{t("qr.colorBg")}</Label>
                  <input type="color" value={editing.bg} onChange={(e) => setEditing({ ...editing, bg: e.target.value })} className="h-11 w-16 rounded-lg border cursor-pointer" /></div>
                <label className={`flex items-center gap-2 text-sm h-11 px-3 rounded-xl border cursor-pointer ${editing.logo ? "border-emerald-500 bg-emerald-50" : "border-slate-200"} ${!logoUrl ? "opacity-50 pointer-events-none" : ""}`}>
                  <input type="checkbox" checked={!!editing.logo} onChange={(e) => setEditing({ ...editing, logo: e.target.checked })} /> {t("qr.addLogo")}
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} className="rounded-xl">{t("qr.cancel")}</Button>
            <Button data-testid="qr-edit-save" onClick={saveEdit} disabled={saving} className="rounded-xl bg-slate-900 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("qr.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
