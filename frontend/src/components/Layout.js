import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, FileText, Receipt, Briefcase, MessageSquare, LogOut, Settings, Hammer, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Inicio", icon: LayoutDashboard, end: true },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/quotes", label: "Quotes", icon: FileText },
  { to: "/invoices", label: "Invoices", icon: Receipt },
  { to: "/trabajos", label: "Trabajos", icon: Briefcase },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
              <div className="font-heading font-bold text-lg leading-none">ServicioFlow</div>
              <div className="text-xs text-slate-500 mt-0.5">AI para contratistas</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((n) => (
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
          <NavLink
            to="/mensajes"
            data-testid="nav-mensajes"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium tap ${
                isActive ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-50"
              }`
            }
          >
            <MessageSquare className="w-5 h-5" strokeWidth={2} />
            Mensajes AI
          </NavLink>
          <NavLink
            to="/scope"
            data-testid="nav-scope"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium tap ${
                isActive ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-50"
              }`
            }
          >
            <Sparkles className="w-5 h-5" strokeWidth={2} />
            Scope of Work
          </NavLink>
          <NavLink
            to="/ajustes"
            data-testid="nav-ajustes"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium tap ${
                isActive ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-50"
              }`
            }
          >
            <Settings className="w-5 h-5" strokeWidth={2} />
            Ajustes
          </NavLink>
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
            <span className="font-heading font-bold">ServicioFlow</span>
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
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
      >
        <div className="grid grid-cols-5">
          {NAV.map((n) => (
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
          ))}
        </div>
      </nav>
    </div>
  );
}
