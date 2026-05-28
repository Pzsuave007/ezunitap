/**
 * AdminMetrics — Super-admin business dashboard.
 *
 * Shows at-a-glance health of the SaaS:
 *   • Total users + breakdown by subscription state
 *   • MRR / ARR estimates
 *   • Growth (last 7d / 30d signups)
 *   • Trials expiring soon (action list)
 *   • Recent signups
 *   • All users table with search + status filter
 */
import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Loader2, AlertCircle, Users, Sparkles, CreditCard, DollarSign,
  TrendingUp, Clock, AlertTriangle, Search, Mail, Phone, X,
  RefreshCw, BadgeCheck, BadgeX, Gift, Package,
} from "lucide-react";
import { toast } from "sonner";
import AdminTabs from "@/components/AdminTabs";

const STATUS_META = {
  trialing:        { label: "Trial",        cls: "bg-blue-100 text-blue-800 border-blue-200" },
  active:          { label: "Activa",       cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  past_due:        { label: "Pago atrasado", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  canceled:        { label: "Cancelada",    cls: "bg-slate-100 text-slate-700 border-slate-200" },
  comp:            { label: "Cortesía",     cls: "bg-amber-50 text-amber-900 border-amber-200" },
  none:            { label: "Sin sub",      cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

function fmtDate(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(typeof ts === "number" ? ts * 1000 : ts);
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  } catch { return "—"; }
}

function fmtUsd(n) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n || 0);
}

export default function AdminMetrics() {
  const [metrics, setMetrics] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = async () => {
    setRefreshing(true);
    try {
      const [m, u] = await Promise.all([
        api.get("/admin/metrics"),
        api.get("/admin/users"),
      ]);
      setMetrics(m.data);
      setUsers(u.data.users || []);
    } catch (e) {
      if (e?.response?.status === 403) setForbidden(true);
      else toast.error("Error al cargar métricas");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      // Compute effective status
      const eff = u.is_comp ? "comp" : (u.subscription_status || "none");
      if (statusFilter !== "all" && eff !== statusFilter) return false;
      if (!q) return true;
      return (
        (u.email || "").toLowerCase().includes(q) ||
        (u.business_name || "").toLowerCase().includes(q) ||
        (u.owner_name || "").toLowerCase().includes(q)
      );
    });
  }, [users, statusFilter, search]);

  if (forbidden) {
    return (
      <>
        <AdminTabs />
        <Card className="p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h2 className="font-heading text-xl font-bold mt-3">Acceso denegado</h2>
          <p className="text-slate-500 mt-1 text-sm">
            Esta sección es solo para el admin principal.
          </p>
        </Card>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <AdminTabs />
        <div className="flex justify-center py-12">
          <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
        </div>
      </>
    );
  }

  const c = metrics?.counts || {};
  const breakdown = metrics?.plan_breakdown || {};
  const expiring = metrics?.trial_expiring_soon || [];
  const recent = metrics?.recent_signups || [];

  return (
    <div className="space-y-8" data-testid="admin-metrics-page">
      <AdminTabs />

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight">
            Métricas del negocio
          </h1>
          <p className="text-slate-500 mt-2 max-w-2xl">
            Resumen ejecutivo: usuarios, ingresos, conversiones y acciones
            pendientes.
          </p>
        </div>
        <button
          onClick={load}
          disabled={refreshing}
          data-testid="metrics-refresh"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {/* Top KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          icon={DollarSign}
          label="MRR estimado"
          value={fmtUsd(metrics?.mrr_usd || 0)}
          sub={`ARR ${fmtUsd(metrics?.arr_usd || 0)}`}
          accent="emerald"
          tid="kpi-mrr"
        />
        <Kpi
          icon={BadgeCheck}
          label="Usuarios pagando"
          value={metrics?.paying_users || 0}
          sub={`${c.active || 0} activos · ${c.past_due || 0} atrasados`}
          accent="blue"
          tid="kpi-paying"
        />
        <Kpi
          icon={Sparkles}
          label="En trial"
          value={c.trialing || 0}
          sub={`${expiring.length} expiran < 3 días`}
          accent="amber"
          tid="kpi-trialing"
        />
        <Kpi
          icon={Users}
          label="Total usuarios"
          value={c.total || 0}
          sub={`+${c.new_last_7d || 0} esta semana`}
          accent="slate"
          tid="kpi-total"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MiniStat label="Cortesía"      value={c.comp || 0}            icon={Gift} />
        <MiniStat label="Sin sub"       value={c.no_subscription || 0} icon={BadgeX} />
        <MiniStat label="Canceladas"    value={c.canceled || 0}        icon={X} />
        <MiniStat label="Nuevos 30d"    value={c.new_last_30d || 0}    icon={TrendingUp} />
        <MiniStat label="Envíos NFC"    value={metrics?.pending_shipments || 0} icon={Package} sub="pendientes" />
      </div>

      {/* Plan breakdown */}
      {Object.keys(breakdown).length > 0 && (
        <Card className="p-5">
          <h3 className="font-heading font-bold text-base mb-3 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-blue-900" /> Ingresos por plan
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {Object.entries(breakdown).map(([plan, count]) => (
              <div key={plan} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs uppercase tracking-wider font-bold text-slate-500">
                  {plan === "pro_monthly" ? "Pro Mensual" :
                   plan === "pro_yearly"  ? "Pro Anual" :
                   plan === "founder"     ? "Founder Deal" : plan}
                </div>
                <div className="font-heading text-2xl font-bold mt-1">{count}</div>
                <div className="text-[11px] text-slate-500">suscritos</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Trials expiring soon (action list) */}
      {expiring.length > 0 && (
        <Card className="p-5 border-amber-200 bg-amber-50/40">
          <h3 className="font-heading font-bold text-base flex items-center gap-2 text-amber-900">
            <AlertTriangle className="w-4 h-4" /> Trials por vencer (próximos 3 días)
          </h3>
          <p className="text-xs text-amber-800/80 mt-1 mb-3">
            Estos clientes podrían convertir si los contactas. Mándales un mensaje recordándoles los beneficios.
          </p>
          <div className="space-y-2">
            {expiring.map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg bg-white border border-amber-200">
                <Clock className="w-4 h-4 text-amber-700 flex-none" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{u.business_name || u.email}</div>
                  <div className="text-xs text-slate-500 truncate">{u.email}</div>
                </div>
                <div className="text-right text-xs">
                  <div className="font-bold text-amber-900">{u.days_left} días</div>
                  <div className="text-slate-500">vence {fmtDate(u.trial_ends_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent signups */}
      <Card className="p-5">
        <h3 className="font-heading font-bold text-base mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-700" /> Últimos registros
        </h3>
        {recent.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-4">Sin registros recientes.</div>
        ) : (
          <div className="space-y-1.5">
            {recent.map((u) => {
              const meta = STATUS_META[u.subscription_status] || STATUS_META.none;
              return (
                <div key={u.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-50">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {u.business_name || u.email}
                    </div>
                    <div className="text-xs text-slate-500 truncate">{u.email}</div>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${meta.cls}`}>
                    {meta.label}
                  </span>
                  <div className="text-[11px] text-slate-400 whitespace-nowrap">
                    {fmtDate(u.created_at)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* All users list with filters */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <h3 className="font-heading font-bold text-base">
            Todos los usuarios ({filteredUsers.length})
          </h3>
          <div className="flex-1 min-w-[160px]" />
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              data-testid="users-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar email o negocio..."
              className="pl-8 h-9 w-56"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {[
            { v: "all",       label: "Todos" },
            { v: "trialing",  label: "Trial" },
            { v: "active",    label: "Activa" },
            { v: "past_due",  label: "Pago atrasado" },
            { v: "canceled",  label: "Cancelada" },
            { v: "comp",      label: "Cortesía" },
            { v: "none",      label: "Sin sub" },
          ].map((f) => (
            <button
              key={f.v}
              onClick={() => setStatusFilter(f.v)}
              data-testid={`filter-${f.v}`}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                statusFilter === f.v
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                <th className="py-2 font-semibold">Cuenta</th>
                <th className="py-2 font-semibold">Estado</th>
                <th className="py-2 font-semibold">Plan</th>
                <th className="py-2 font-semibold">Vence</th>
                <th className="py-2 font-semibold">Registro</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const eff = u.is_comp ? "comp" : (u.subscription_status || "none");
                const meta = STATUS_META[eff] || STATUS_META.none;
                const renewTs = u.trial_ends_at || u.current_period_end || u.comp_expires_at;
                return (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`user-row-${u.id}`}>
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold truncate max-w-[200px]">
                        {u.business_name || u.owner_name || "—"}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        {u.email && (
                          <a href={`mailto:${u.email}`} className="inline-flex items-center gap-1 hover:text-slate-700">
                            <Mail className="w-3 h-3" /> {u.email}
                          </a>
                        )}
                        {u.phone && (
                          <a href={`tel:${u.phone}`} className="inline-flex items-center gap-1 hover:text-slate-700">
                            <Phone className="w-3 h-3" /> {u.phone}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${meta.cls}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-xs">
                      {u.is_comp ? (
                        <span className="text-amber-700 font-semibold">Cortesía</span>
                      ) : (
                        u.plan_type === "pro_monthly" ? "Pro Mensual" :
                        u.plan_type === "pro_yearly"  ? "Pro Anual" :
                        u.plan_type === "founder"     ? "Founder" :
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-slate-600 whitespace-nowrap">
                      {renewTs ? fmtDate(renewTs) : "—"}
                    </td>
                    <td className="py-2.5 text-xs text-slate-500 whitespace-nowrap">
                      {fmtDate(u.created_at)}
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-slate-400">
                    Sin resultados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, accent = "slate", tid }) {
  const accents = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    blue:    "bg-blue-50 text-blue-700 border-blue-200",
    amber:   "bg-amber-50 text-amber-700 border-amber-200",
    slate:   "bg-slate-50 text-slate-700 border-slate-200",
  };
  return (
    <div data-testid={tid} className={`p-4 rounded-2xl border ${accents[accent]}`}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider font-bold opacity-70">
          {label}
        </div>
        <Icon className="w-4 h-4 opacity-60" />
      </div>
      <div className="font-heading text-3xl font-bold mt-2">{value}</div>
      {sub && <div className="text-[11px] mt-1 opacity-70">{sub}</div>}
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, sub }) {
  return (
    <div className="p-3 rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-500">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className="font-heading text-xl font-bold mt-1">{value}</div>
      {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}
