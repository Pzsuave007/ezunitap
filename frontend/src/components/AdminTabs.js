/**
 * AdminTabs — shared tab navigation rendered at the top of all /admin/*
 * pages so the user has ONE "Admin" link in the sidebar but can switch
 * between sub-sections (Cuentas gratis, Leads, etc.) without clutter.
 */
import { NavLink } from "react-router-dom";
import { Gift, Inbox, ShieldCheck } from "lucide-react";

const TABS = [
  { to: "/admin/cuentas", label: "Cuentas gratis", icon: Gift },
  { to: "/admin/leads", label: "Leads", icon: Inbox },
];

export default function AdminTabs() {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 text-amber-700 text-xs font-bold uppercase tracking-wider mb-2">
        <ShieldCheck className="w-4 h-4" />
        Panel Admin
      </div>
      <div
        className="inline-flex rounded-xl bg-slate-100 p-1 overflow-x-auto max-w-full"
        data-testid="admin-tabs"
      >
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            data-testid={`admin-tab-${t.to.split("/").pop()}`}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition whitespace-nowrap ${
                isActive ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
              }`
            }
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
