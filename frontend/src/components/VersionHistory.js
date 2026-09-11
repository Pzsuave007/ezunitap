import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { History, RotateCcw, Save, Loader2, ListChecks, Images, MessageSquareText } from "lucide-react";

const fmt = (iso) => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
};

export const VersionHistory = () => {
  const { t } = useTranslation();
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restoringId, setRestoringId] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get("/content/versions");
      setVersions(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveNow = async () => {
    setSaving(true);
    try {
      await api.post("/content/versions");
      toast.success(t("website.history.saved"));
      await load();
    } catch { toast.error("Error"); }
    setSaving(false);
  };

  const restore = async (id) => {
    if (!window.confirm(t("website.history.confirm"))) return;
    setRestoringId(id);
    try {
      await api.post(`/content/versions/${id}/restore`);
      toast.success(t("website.history.restored"));
      setTimeout(() => window.location.reload(), 900);
    } catch { toast.error("Error"); setRestoringId(null); }
  };

  const reasonLabel = (r) => t(`website.history.reason.${r}`, { defaultValue: r });

  return (
    <div className="space-y-4" data-testid="version-history-panel">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" /> {t("website.history.title")}
          </h3>
          <p className="text-sm text-slate-500 max-w-xl mt-1">{t("website.history.subtitle")}</p>
        </div>
        <Button onClick={saveNow} disabled={saving} className="rounded-xl" data-testid="version-save-now">
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          {t("website.history.saveNow")}
        </Button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : versions.length === 0 ? (
        <Card className="p-6 text-center text-sm text-slate-500" data-testid="version-history-empty">
          {t("website.history.empty")}
        </Card>
      ) : (
        <div className="space-y-2" data-testid="version-history-list">
          {versions.map((v) => (
            <Card key={v.id} className="p-4 flex items-center justify-between gap-4" data-testid={`version-item-${v.id}`}>
              <div className="min-w-0">
                <div className="font-semibold text-slate-800 text-sm truncate">{reasonLabel(v.reason)}</div>
                <div className="text-xs text-slate-400">{fmt(v.created_at)}</div>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><ListChecks className="w-3.5 h-3.5" />{v.summary?.services ?? 0} {t("website.history.svc")}</span>
                  <span className="inline-flex items-center gap-1"><Images className="w-3.5 h-3.5" />{v.summary?.gallery ?? 0} {t("website.history.gal")}</span>
                  <span className="inline-flex items-center gap-1"><MessageSquareText className="w-3.5 h-3.5" />{v.summary?.captions ?? 0} {t("website.history.caps")}</span>
                </div>
              </div>
              <Button
                variant="outline" size="sm" onClick={() => restore(v.id)}
                disabled={restoringId === v.id} className="rounded-xl flex-none"
                data-testid={`version-restore-${v.id}`}
              >
                {restoringId === v.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-1" />}
                {t("website.history.restore")}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default VersionHistory;
