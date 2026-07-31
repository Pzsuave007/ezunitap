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
  const [variant, setVariant] = useState("flujo");

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
            Comportamiento real de la gente en <span className="font-semibold text-slate-700">/demo-flujo</span>:
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
            Aún no hay datos. En cuanto la gente entre a <b>/demo-flujo</b> los verás aquí.
          </div>
        ) : (
          <div className="space-y-2.5">
            {funnel.map((f) => {
              const pct = Math.round((f.count / maxCount) * 100);
              const bigDrop = f.drop_from_prev != null && f.drop_from_prev >= 40;
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
                        className={`h-full rounded-full transition-all ${f.step === 10 ? "bg-emerald-500" : "bg-blue-600"}`}
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

      {/* Recent sessions */}
      <Card className="p-5" data-testid="demo-recent-sessions">
        <h3 className="font-heading font-bold text-base mb-3">Sesiones recientes</h3>
        {recent.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-4">Sin sesiones todavía.</div>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="py-2 px-2 font-bold">Oficio</th>
                  <th className="py-2 px-2 font-bold">Último paso</th>
                  <th className="py-2 px-2 font-bold">Estado</th>
                  <th className="py-2 px-2 font-bold">Disp.</th>
                  <th className="py-2 px-2 font-bold">Duración</th>
                  <th className="py-2 px-2 font-bold">Cuándo</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s, i) => (
                  <tr key={`${variant}-${s.session_id}-${i}`} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 px-2 font-semibold text-slate-700 truncate max-w-[140px]">{s.trade}</td>
                    <td className="py-2 px-2 text-slate-600">
                      <span className="font-bold text-slate-800">{s.max_step}</span>
                      <span className="text-slate-400 text-xs"> · {s.max_step_label}</span>
                    </td>
                    <td className="py-2 px-2">
                      {s.completed ? (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Terminó</span>
                      ) : s.whatsapp_clicks > 0 ? (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">WhatsApp</span>
                      ) : (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Se fue</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-slate-500">{s.device}</td>
                    <td className="py-2 px-2 text-slate-500">{fmtDur(s.duration_sec)}</td>
                    <td className="py-2 px-2 text-slate-400 whitespace-nowrap">{fmtWhen(s.last_seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
