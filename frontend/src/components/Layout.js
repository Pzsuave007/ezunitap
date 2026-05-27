import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { LayoutDashboard, Users, FileText, Receipt, Briefcase, MessageSquare, LogOut, User as UserIcon, Hammer, Sparkles, IdCard, CalendarDays, ShieldCheck, FileSignature, CreditCard } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import TrialBanner from "@/components/TrialBanner";

// Mobile bottom nav — 5 essential items only.
const NAV = [
  { to: "/", label: "Inicio", icon: LayoutDashboard, end: true },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/tarjeta", label: "Tarjeta", icon: IdCard, accent: true },
  { to: "/calendario", label: "Agenda", icon: CalendarDays },
  { to: "/ajustes", label: "Perfil", icon: UserIcon },
];

// Desktop sidebar — follows the business flow:
//   Quote → Contrato → Invoice → Agenda → Trabajo
// Scope of Work and Mensajes AI moved INTO the client profile (per-client).
const FLOW = [
  { to: "/", label: "Inicio", icon: LayoutDashboard, end: true },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/quotes", label: "Quotes", icon: FileText },
  { to: "/contratos", label: "Contratos", icon: FileSignature },
  { to: "/invoices", label: "Invoices", icon: Receipt },
  { to: "/calendario", label: "Agenda", icon: CalendarDays },
  { to: "/trabajos", label: "Trabajos", icon: Briefcase },
];

const ACCOUNT = [
  { to: "/tarjeta", label: "Tarjeta", icon: IdCard },
  { to: "/ajustes", label: "Perfil", icon: UserIcon },
  { to: "/precios", label: "Suscripción", icon: CreditCard },
];

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

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {FLOW.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              data-testid={`nav-${n.to.replace("/", "") || "home"}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium tap ${
                  isActive ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-50"
                }`
              }
            >
              <n.icon className="w-5 h-5" strokeWidth={2} />
              {n.label}
            </NavLink>
          ))}
          <div className="h-px bg-slate-100 my-2" />
          {accountItems.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              data-testid={`nav-${n.to.replace("/", "")}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium tap ${
                  isActive ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-50"
                }`
              }
            >
              <n.icon className="w-5 h-5" strokeWidth={2} />
              {n.label}
            </NavLink>
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
