import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { LayoutDashboard, Users, FileText, Receipt, Briefcase, MessageSquare, LogOut, User as UserIcon, Hammer, Sparkles, IdCard, CalendarDays, ShieldCheck, FileSignature, CreditCard, Star, Megaphone } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import TrialBanner from "@/components/TrialBanner";
import NotificationBanner from "@/components/NotificationBanner";
import ImpersonationBanner from "@/components/ImpersonationBanner";

// Mobile bottom nav — 5 essential items only.
const NAV = [
  { to: "/", label: "Inicio", icon: LayoutDashboard, end: true },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/tarjeta", label: "Tarjeta", icon: IdCard, accent: true },
  { to: "/calendario", label: "Agenda", icon: CalendarDays },
  { to: "/ajustes", label: "Perfil", icon: UserIcon },
];

// Desktop sidebar — grouped for clarity.
//   Inicio · Clientes · [Invoicing: Quotes/Contratos/Invoices] ·
//   [Trabajos: Agenda] · Google Reviews · Tarjeta Digital
const SIDEBAR = [
  { to: "/", label: "Inicio", icon: LayoutDashboard, end: true },
  { to: "/clientes", label: "Clientes", icon: Users },
  {
    label: "Invoicing", icon: Receipt,
    children: [
      { to: "/quotes", label: "Quotes", icon: FileText },
      { to: "/contratos", label: "Contratos", icon: FileSignature },
      { to: "/invoices", label: "Invoices", icon: Receipt },
    ],
  },
  {
    to: "/trabajos", label: "Trabajos", icon: Briefcase,
    children: [
      { to: "/calendario", label: "Agenda", icon: CalendarDays },
    ],
  },
  { to: "/reviews", label: "Google Reviews", icon: Star },
  { to: "/tarjeta", label: "Tarjeta Digital", icon: IdCard },
  { to: "/marketing", label: "Marketing", icon: Megaphone },
];

const ACCOUNT = [
  { to: "/ajustes", label: "Perfil", icon: UserIcon },
  { to: "/ajustes#suscripcion", label: "Suscripción", icon: CreditCard },
];

function SidebarLink({ item, nested }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      data-testid={`nav-${item.to.replace("/", "") || "home"}`}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl font-medium tap ${
          nested ? "pl-3 pr-3 py-2.5 text-[13px]" : "px-3 py-3 text-sm"
        } ${isActive ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-50"}`
      }
    >
      <item.icon className={nested ? "w-4 h-4" : "w-5 h-5"} strokeWidth={2} />
      {item.label}
    </NavLink>
  );
}

function SidebarGroup({ group }) {
  return (
    <div>
      {group.to ? (
        <SidebarLink item={group} />
      ) : (
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-slate-500">
          <group.icon className="w-5 h-5" strokeWidth={2} />
          {group.label}
        </div>
      )}
      <div className="ml-[1.45rem] pl-3 border-l border-slate-200 space-y-1 mt-1 mb-1">
        {group.children.map((c) => (
          <SidebarLink key={c.to} item={c} nested />
        ))}
      </div>
    </div>
  );
}

// Days left in a local (non-Stripe) trial, or null if not applicable.
function trialDaysLeft(user) {
  if (!user || user.is_comp) return null;
  if (user.subscription_status !== "trialing") return null;
  if (user.stripe_customer_id) return null;
  const ts = user.trial_ends_at;
  if (!ts) return null;
  return Math.max(0, Math.ceil((ts * 1000 - Date.now()) / 86400000));
}

// Subtle, always-visible trial indicator in the sidebar (turns amber near the end).
function TrialPill({ user }) {
  const days = trialDaysLeft(user);
  if (days === null) return null;
  const urgent = days <= 3;
  const label = days === 0 ? "último día" : `${days} ${days === 1 ? "día" : "días"}`;
  return (
    <Link
      to="/precios"
      data-testid="sidebar-trial-pill"
      className={`mx-3 mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold tap transition-colors ${
        urgent
          ? "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
          : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
      }`}
    >
      <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="flex-1">Prueba gratis · {label}</span>
      <span className="text-[10px] opacity-70">Ver planes</span>
    </Link>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Fast path: check email locally (works immediately even before API responds)
  const SUPER_ADMIN_EMAILS = ["pzsuave007@gmail.com"];
  const isSuperAdminByEmail = !!user?.email && SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase());

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get("/auth/is-super-admin");
        if (mounted) setIsSuperAdmin(!!data.is_super_admin);
      } catch {
        if (mounted) setIsSuperAdmin(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const showAdminLink = isSuperAdmin || isSuperAdminByEmail;

  const accountItems = [
    ...ACCOUNT,
    ...(showAdminLink ? [
      { to: "/admin/cuentas", label: "Admin", icon: ShieldCheck },
    ] : []),
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar for desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 fixed inset-y-0 left-0 z-40">
        <div className="px-6 py-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center">
              <Hammer className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-heading font-bold text-lg leading-none">Unitap</div>
              <div className="text-xs text-slate-500 mt-0.5">Tu negocio en un tap</div>
            </div>
          </div>
        </div>

        <TrialPill user={user} />

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {SIDEBAR.map((n) =>
            n.children ? (
              <SidebarGroup key={n.label} group={n} />
            ) : (
              <SidebarLink key={n.to} item={n} />
            )
          )}
          <div className="h-px bg-slate-100 my-2" />
          <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Cuenta</div>
          {accountItems.map((n) => (
            <SidebarLink key={n.to} item={n} />
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="text-xs text-slate-500 mb-1">Sesión iniciada como</div>
          <div className="text-sm font-semibold text-slate-900 truncate">{user?.business_name}</div>
          <div className="text-xs text-slate-500 truncate mb-3">{user?.email}</div>
          <Button
            data-testid="logout-button"
            onClick={handleLogout}
            variant="outline"
            className="w-full rounded-xl border-slate-200"
          >
            <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Mobile top header */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-900 to-emerald-500 flex items-center justify-center">
              <Hammer className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-heading font-bold">Unitap</span>
          </div>
          <button
            data-testid="mobile-logout"
            onClick={handleLogout}
            className="p-2 rounded-xl text-slate-500 tap"
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 lg:ml-64 pt-14 lg:pt-0 pb-safe lg:pb-0 min-h-screen overflow-x-hidden">
        <div className="max-w-5xl mx-auto px-4 lg:px-8 py-4 lg:py-8">
          <ImpersonationBanner />
          <NotificationBanner />
          <TrialBanner />
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
      >
        <div className="grid grid-cols-5">
          {NAV.map((n) => {
            if (n.accent) {
              return (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  data-testid={`bottomnav-${n.to.replace("/", "") || "home"}`}
                  className="flex flex-col items-center justify-center gap-1 py-2 tap"
                >
                  {({ isActive }) => (
                    <>
                      <div
                        className={`w-11 h-11 -mt-5 rounded-2xl flex items-center justify-center shadow-lg text-white ring-4 ring-white ${isActive ? "scale-105" : ""}`}
                        style={{ background: "linear-gradient(135deg, #1E3A8A 0%, #10B981 100%)" }}
                      >
                        <n.icon className="w-5 h-5" strokeWidth={2.2} />
                      </div>
                      <span className={`text-[10px] font-bold ${isActive ? "text-blue-900" : "text-slate-500"}`}>{n.label}</span>
                    </>
                  )}
                </NavLink>
              );
            }
            return (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                data-testid={`bottomnav-${n.to.replace("/", "") || "home"}`}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-1 py-2.5 tap ${
                    isActive ? "text-blue-900" : "text-slate-400"
                  }`
                }
              >
                <n.icon className="w-5 h-5" strokeWidth={2} />
                <span className="text-[10px] font-semibold">{n.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
