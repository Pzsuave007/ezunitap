/**
 * AdminDemoAnalytics — First-party funnel dashboard for /demo-flujo.
 *
 * Shows how prospects move through the demo WITHOUT depending on Meta:
 *   • Top KPIs: sessions, completion rate, WhatsApp & checkout intent
 *   • Step-by-step funnel with drop-off between steps (where people get stuck)
 *   • Breakdown by trade (which oficios convert best)
 *   • Device split + recent sessions with the last step each one reached
 */
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import {
  Loader2, AlertCircle, RefreshCw, Activity, Flag, MessageCircle,
  CreditCard, Smartphone, Monitor, TrendingDown, Users,
} from "lucide-react";
import { toast } from "sonner";
import AdminTabs from "@/components/AdminTabs";

function fmtWhen(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("es-ES", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
}
function fmtDur(sec) {
  if (!sec) return "0s";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  return `${m}m ${sec % 60}s`;
}

export default function AdminDemoAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [variant, setVariant] = useState("corto");

  const load = async (v = variant) => {
    setRefreshing(true);
    try {
      const r = await api.get(`/admin/demo-analytics?demo=${v}`);
      setData(r.data);
    } catch (e) {
      if (e?.response?.status === 403) setForbidden(true);
      else toast.error("Error al cargar analíticas del demo");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(variant); }, [variant]); // eslint-disable-line react-hooks/exhaustive-deps

  if (forbidden) {
    return (
      <>
        <AdminTabs />
        <Card className="p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h2 className="font-heading text-xl font-bold mt-3">Acceso denegado</h2>
          <p className="text-slate-500 mt-1 text-sm">Esta sección es solo para el admin principal.</p>
        </Card>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <AdminTabs />
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
      </>
    );
  }

  const t = data?.totals || {};
  const funnel = data?.funnel || [];
  const byTrade = data?.by_trade || [];
  const devices = data?.devices || {};
  const recent = data?.recent_sessions || [];
  const vcounts = data?.variant_counts || {};
  const maxCount = Math.max(1, ...funnel.map((f) => f.count));

  return (
    <div className="space-y-8" data-testid="admin-demo-analytics-page">
      <AdminTabs />

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="w-7 h-7 text-emerald-600" /> Analíticas del Demo
          </h1>
          <p className="text-slate-500 mt-2 max-w-2xl">
            Comportamiento real de la gente en <span className="font-semibold text-slate-700">/demo</span>:
            en qué paso se atoran, si lo terminan y si piden ayuda. Datos tuyos, no de Meta.
          </p>
        </div>
        <button
          onClick={() => load(variant)}
          disabled={refreshing}
          data-testid="demo-analytics-refresh"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> Actualizar
        </button>
      </div>

      {/* Variant toggle: full demo vs short (invoice) demo — for A/B */}
      <div className="inline-flex rounded-xl bg-slate-100 p-1" data-testid="demo-variant-toggle">
        {[
          { k: "flujo", label: "Demo completo" },
          { k: "corto", label: "Demo corto (facturas)" },
        ].map((v) => (
          <button
            key={v.k}
            data-testid={`demo-variant-${v.k}`}
            onClick={() => setVariant(v.k)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
              variant === v.k ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {v.label} <span className={variant === v.k ? "text-slate-400" : "text-slate-400"}>({vcounts[v.k] ?? 0})</span>
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={Users} label="Sesiones" value={t.sessions || 0} sub={`${t.started || 0} empezaron`} accent="blue" tid="kpi-sessions" />
        <Kpi icon={Flag} label="Terminaron el demo" value={t.completed || 0} sub={`${t.completion_rate || 0}% de los que empezaron`} accent="emerald" tid="kpi-completed" />
        <Kpi icon={MessageCircle} label="Clics a WhatsApp" value={t.whatsapp_clicks || 0} sub="pidieron ayuda" accent="amber" tid="kpi-whatsapp" />
        <Kpi icon={CreditCard} label="Clics a 'Empezar'" value={t.checkout_clicks || 0} sub="intención de registro" accent="slate" tid="kpi-checkout" />
      </div>

      {/* Funnel */}
      <Card className="p-5" data-testid="demo-funnel">
        <h3 className="font-heading font-bold text-base mb-1 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-blue-900" /> Embudo del demo (paso por paso)
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Cuánta gente llega a cada paso. El <span className="font-semibold text-red-600">% en rojo</span> es la caída respecto al paso anterior — ahí es donde pierdes gente.
        </p>
        {t.sessions === 0 ? (
          <div className="text-sm text-slate-500 text-center py-6">
            Aún no hay datos. En cuanto la gente entre a <b>/demo</b> los verás aquí.
          </div>
        ) : (
          <div className="space-y-2.5">
            {funnel.map((f, idx) => {
              const pct = Math.round((f.count / maxCount) * 100);
              const bigDrop = f.drop_from_prev != null && f.drop_from_prev >= 40;
              const isLast = idx === funnel.length - 1;
              return (
                <div key={f.step} className="flex items-center gap-3" data-testid={`funnel-step-${f.step}`}>
                  <div className="w-7 text-right text-xs font-bold text-slate-400 flex-none">{f.step}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-slate-700 truncate">{f.label}</span>
                      <span className="text-sm font-bold text-slate-900 flex-none ml-2">{f.count}</span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isLast ? "bg-emerald-500" : "bg-blue-600"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-16 text-right flex-none">
                    {f.drop_from_prev != null && (
                      <span className={`text-xs font-bold ${bigDrop ? "text-red-600" : "text-slate-400"}`}>
                        {f.drop_from_prev > 0 ? `−${f.drop_from_prev}%` : "0%"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* By trade + devices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2" data-testid="demo-by-trade">
          <h3 className="font-heading font-bold text-base mb-3">Por oficio (trade)</h3>
          {byTrade.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-4">Sin datos todavía.</div>
          ) : (
            <div className="space-y-1.5">
              {byTrade.slice(0, 12).map((tr) => {
                const rate = tr.sessions ? Math.round((tr.completed / tr.sessions) * 100) : 0;
                return (
                  <div key={tr.trade} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-slate-50">
                    <div className="flex-1 min-w-0 text-sm font-semibold text-slate-700 truncate">{tr.trade}</div>
                    <div className="text-xs text-slate-500 flex-none">{tr.sessions} ses.</div>
                    <div className="w-24 flex-none">
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${rate}%` }} />
                      </div>
                    </div>
                    <div className="w-12 text-right text-xs font-bold text-emerald-700 flex-none">{rate}%</div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5" data-testid="demo-devices">
          <h3 className="font-heading font-bold text-base mb-3">Dispositivo</h3>
          <div className="space-y-3">
            <DeviceRow icon={Smartphone} label="Móvil" value={devices.mobile || 0} total={t.sessions || 0} />
            <DeviceRow icon={Monitor} label="Escritorio" value={devices.desktop || 0} total={t.sessions || 0} />
            {(devices.other || 0) > 0 && (
              <DeviceRow icon={Monitor} label="Otro" value={devices.other || 0} total={t.sessions || 0} />
            )}
          </div>
        </Card>
      </div>

      {/* How sessions ended — compact graph (replaces the long list) */}
      <Card className="p-5" data-testid="demo-outcomes">
        <h3 className="font-heading font-bold text-base mb-4">Cómo terminaron las sesiones</h3>
        {t.sessions ? (() => {
          const finished = t.completed || 0;
          const help = t.whatsapp_clicks || 0;
          const left = Math.max(0, (t.sessions || 0) - finished - help);
          const total = t.sessions || 1;
          const segs = [
            { label: "Terminaron el demo", value: finished, color: "bg-emerald-500", text: "text-emerald-700" },
            { label: "Pidieron ayuda (WhatsApp)", value: help, color: "bg-amber-500", text: "text-amber-700" },
            { label: "Se fueron antes", value: left, color: "bg-slate-300", text: "text-slate-500" },
          ];
          return (
            <>
              <div className="flex h-5 w-full rounded-full overflow-hidden bg-slate-100">
                {segs.map((s) => s.value > 0 && (
                  <div key={s.label} className={`${s.color} h-full`} style={{ width: `${(s.value / total) * 100}%` }} title={`${s.label}: ${s.value}`} />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                {segs.map((s) => (
                  <div key={s.label} data-testid={`outcome-${s.label}`} className="text-center">
                    <div className={`font-heading text-2xl font-bold ${s.text}`}>{s.value}</div>
                    <div className="text-xs text-slate-500 mt-0.5 leading-tight">{s.label}</div>
                    <div className="text-[11px] text-slate-400">{Math.round((s.value / total) * 100)}%</div>
                  </div>
                ))}
              </div>
            </>
          );
        })() : (
          <div className="text-sm text-slate-500 text-center py-4">Sin sesiones todavía.</div>
        )}
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, accent = "slate", tid }) {
  const accents = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
  };
  return (
    <div data-testid={tid} className={`p-4 rounded-2xl border ${accents[accent]}`}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider font-bold opacity-70">{label}</div>
        <Icon className="w-4 h-4 opacity-60" />
      </div>
      <div className="font-heading text-3xl font-bold mt-2">{value}</div>
      {sub && <div className="text-[11px] mt-1 opacity-70">{sub}</div>}
    </div>
  );
}

function DeviceRow({ icon: Icon, label, value, total }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-slate-400 flex-none" />
      <div className="flex-1">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-700">{label}</span>
          <span className="text-slate-500">{value} · {pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden mt-1">
          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
