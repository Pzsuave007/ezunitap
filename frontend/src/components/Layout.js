import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, Users, FileText, Receipt, Briefcase, LogOut, User as UserIcon, Hammer, Sparkles, IdCard, CalendarDays, CalendarCheck, ShieldCheck, FileSignature, CreditCard, Star, Megaphone, Menu, Lock, Globe, QrCode, MonitorSmartphone } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import TrialBanner from "@/components/TrialBanner";
import NotificationBanner from "@/components/NotificationBanner";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import LanguageToggle from "@/components/LanguageToggle";

// Mobile bottom nav — 5 essentials. "Marketing" is front-and-center for our
// non-tech contractors; "Más" opens a full menu with everything else.
const NAV = [
  { to: "/", labelKey: "nav.home", icon: LayoutDashboard, end: true },
  { to: "/clientes", labelKey: "nav.clients", icon: Users, anyFeature: ["card", "business"] },
  { to: "/tarjeta", labelKey: "nav.card", icon: IdCard, accent: true, feature: "card" },
  { to: "/marketing/inicio", labelKey: "nav.marketing", icon: Megaphone, feature: "marketing" },
  { more: true, labelKey: "nav.more", icon: Menu },
];

// Everything reachable from the mobile "Más" menu (big, clearly-labeled rows).
const MORE_ITEMS = [
  { to: "/calendario", labelKey: "nav.schedule", icon: CalendarDays, feature: "business" },
  { to: "/quotes", labelKey: "nav.quotesLong", icon: FileText, feature: "business" },
  { to: "/contratos", labelKey: "nav.agreements", icon: FileSignature, feature: "business" },
  { to: "/invoices", labelKey: "nav.invoicesLong", icon: Receipt, feature: "business" },
  { to: "/trabajos", labelKey: "nav.jobs", icon: Briefcase, feature: "business" },
  { to: "/citas", labelKey: "nav.appointments", icon: CalendarCheck, feature: "card" },
  { to: "/pagina-web", labelKey: "nav.website", icon: MonitorSmartphone, anyFeature: ["card", "business"] },
  { to: "/sitio-web", labelKey: "nav.embed", icon: Globe, feature: "card" },
  { to: "/qr", labelKey: "nav.qrCodes", icon: QrCode, feature: "card" },
  { to: "/reviews", labelKey: "nav.googleReviews", icon: Star, feature: "card" },
  { to: "/ajustes", labelKey: "nav.myProfile", icon: UserIcon },
  { to: "/precios", labelKey: "nav.mySubscription", icon: CreditCard },
];

// Desktop sidebar — grouped for clarity.
const SIDEBAR = [
  { to: "/", labelKey: "nav.home", icon: LayoutDashboard, end: true },
  { to: "/clientes", labelKey: "nav.clients", icon: Users, anyFeature: ["card", "business"] },
  {
    labelKey: "nav.invoicing", icon: Receipt, feature: "business",
    children: [
      { to: "/quotes", labelKey: "nav.quotes", icon: FileText, feature: "business" },
      { to: "/contratos", labelKey: "nav.agreements", icon: FileSignature, feature: "business" },
      { to: "/invoices", labelKey: "nav.invoices", icon: Receipt, feature: "business" },
    ],
  },
  {
    to: "/trabajos", labelKey: "nav.jobs", icon: Briefcase, feature: "business",
    children: [
      { to: "/calendario", labelKey: "nav.schedule", icon: CalendarDays, feature: "business" },
    ],
  },
  { to: "/reviews", labelKey: "nav.googleReviews", icon: Star, feature: "card" },
  { to: "/citas", labelKey: "nav.appointments", icon: CalendarCheck, feature: "card" },
  { to: "/tarjeta", labelKey: "nav.digitalCard", icon: IdCard, feature: "card" },
  { to: "/pagina-web", labelKey: "nav.website", icon: MonitorSmartphone, anyFeature: ["card", "business"] },
  { to: "/sitio-web", labelKey: "nav.embed", icon: Globe, feature: "card" },
  { to: "/qr", labelKey: "nav.qrCodes", icon: QrCode, feature: "card" },
  { to: "/marketing/inicio", labelKey: "nav.marketing", icon: Megaphone, feature: "marketing" },
];

const ACCOUNT = [
  { to: "/ajustes", labelKey: "nav.profile", icon: UserIcon },
  { to: "/ajustes#suscripcion", labelKey: "nav.subscription", icon: CreditCard },
];

// True when a nav item points to a module the user has NOT unlocked.
const navLocked = (item, hasFeature) => {
  if (item.anyFeature) return !item.anyFeature.some((f) => hasFeature(f));
  if (item.feature) return !hasFeature(item.feature);
  return false;
};

function SidebarLink({ item, nested, locked }) {
  const { t } = useTranslation();
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
      <span className="flex-1">{t(item.labelKey)}</span>
      {locked && <Lock className="w-3.5 h-3.5 text-slate-300 flex-none" />}
    </NavLink>
  );
}

function SidebarGroup({ group, hasFeature }) {
  const { t } = useTranslation();
  return (
    <div>
      {group.to ? (
        <SidebarLink item={group} locked={navLocked(group, hasFeature)} />
      ) : (
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-slate-500">
          <group.icon className="w-5 h-5" strokeWidth={2} />
          <span className="flex-1">{t(group.labelKey)}</span>
          {navLocked(group, hasFeature) && <Lock className="w-3.5 h-3.5 text-slate-300 flex-none" />}
        </div>
      )}
      <div className="ml-[1.45rem] pl-3 border-l border-slate-200 space-y-1 mt-1 mb-1">
        {group.children.map((c) => (
          <SidebarLink key={c.to} item={c} nested locked={navLocked(c, hasFeature)} />
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
  const { t } = useTranslation();
  const days = trialDaysLeft(user);
  if (days === null) return null;
  const urgent = days <= 3;
  const label = days === 0 ? t("nav.lastDay") : t("nav.dayOne", { count: days });
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
      <span className="flex-1">{t("nav.trialFree")} · {label}</span>
      <span className="text-[10px] opacity-70">{t("nav.viewPlans")}</span>
    </Link>
  );
}

export default function Layout() {
  const { t } = useTranslation();
  const { user, logout, hasFeature } = useAuth();
  const navigate = useNavigate();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

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
      { to: "/admin/cuentas", labelKey: "nav.admin", icon: ShieldCheck },
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
              <div className="font-heading font-bold text-lg leading-none">UniTech</div>
              <div className="text-xs text-slate-500 mt-0.5">{t("common.brandTagline")}</div>
            </div>
          </div>
        </div>

        <TrialPill user={user} />

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {SIDEBAR.map((n) =>
            n.children ? (
              <SidebarGroup key={n.labelKey} group={n} hasFeature={hasFeature} />
            ) : (
              <SidebarLink key={n.to} item={n} locked={navLocked(n, hasFeature)} />
            )
          )}
          <div className="h-px bg-slate-100 my-2" />
          <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("nav.account")}</div>
          {accountItems.map((n) => (
            <SidebarLink key={n.to} item={n} />
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="mb-3 flex justify-center"><LanguageToggle /></div>
          <div className="text-xs text-slate-500 mb-1">{t("nav.loggedInAs")}</div>
          <div className="text-sm font-semibold text-slate-900 truncate">{user?.business_name}</div>
          <div className="text-xs text-slate-500 truncate mb-3">{user?.email}</div>
          <Button
            data-testid="logout-button"
            onClick={handleLogout}
            variant="outline"
            className="w-full rounded-xl border-slate-200"
          >
            <LogOut className="w-4 h-4 mr-2" /> {t("nav.logout")}
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
            <span className="font-heading font-bold">UniTech</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <button
              data-testid="mobile-logout"
              onClick={handleLogout}
              className="p-2 rounded-xl text-slate-500 tap"
              aria-label={t("nav.logout")}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
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
            if (n.more) {
              return (
                <button
                  key="more"
                  onClick={() => setMoreOpen(true)}
                  data-testid="bottomnav-more"
                  className="flex flex-col items-center justify-center gap-1 py-2.5 tap text-slate-400"
                >
                  <n.icon className="w-5 h-5" strokeWidth={2} />
                  <span className="text-[10px] font-semibold">{t(n.labelKey)}</span>
                </button>
              );
            }
            if (n.accent) {
              const locked = navLocked(n, hasFeature);
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
                        className={`relative w-11 h-11 -mt-5 rounded-2xl flex items-center justify-center shadow-lg text-white ring-4 ring-white ${isActive ? "scale-105" : ""}`}
                        style={{ background: "linear-gradient(135deg, #1E3A8A 0%, #10B981 100%)" }}
                      >
                        <n.icon className="w-5 h-5" strokeWidth={2.2} />
                        {locked && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                            <Lock className="w-2.5 h-2.5 text-slate-400" />
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold ${isActive ? "text-blue-900" : "text-slate-500"}`}>{t(n.labelKey)}</span>
                    </>
                  )}
                </NavLink>
              );
            }
            const locked = navLocked(n, hasFeature);
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
                <span className="relative">
                  <n.icon className="w-5 h-5" strokeWidth={2} />
                  {locked && (
                    <span className="absolute -top-1.5 -right-2 w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center">
                      <Lock className="w-2.5 h-2.5 text-slate-400" />
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-semibold">{t(n.labelKey)}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Mobile "Más" menu — full access for non-tech users (big tap targets) */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="lg:hidden rounded-t-3xl max-h-[85vh] overflow-y-auto p-0" data-testid="more-menu">
          <SheetHeader className="px-5 pt-5 pb-3 text-left">
            <SheetTitle className="font-heading text-lg">{t("nav.menu")}</SheetTitle>
            <div className="text-xs text-slate-500 truncate">{user?.business_name}</div>
          </SheetHeader>
          <div className="px-3 pb-3 grid grid-cols-1 gap-1">
            {MORE_ITEMS.map((n) => {
              const locked = navLocked(n, hasFeature);
              return (
                <button
                  key={n.to}
                  onClick={() => { setMoreOpen(false); navigate(n.to); }}
                  data-testid={`more-${n.to.replace(/[/#]/g, "-")}`}
                  className="flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[15px] font-semibold text-slate-800 bg-slate-50 active:bg-slate-100 tap"
                >
                  <span className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                    <n.icon className="w-5 h-5 text-blue-900" strokeWidth={2} />
                  </span>
                  <span className="flex-1 text-left">{t(n.labelKey)}</span>
                  {locked && <Lock className="w-4 h-4 text-slate-300 flex-none" />}
                </button>
              );
            })}
            {showAdminLink && (
              <button
                onClick={() => { setMoreOpen(false); navigate("/admin/cuentas"); }}
                data-testid="more-admin"
                className="flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[15px] font-semibold text-slate-800 bg-slate-50 active:bg-slate-100 tap"
              >
                <span className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-blue-900" strokeWidth={2} />
                </span>
                {t("nav.admin")}
              </button>
            )}
            <div className="flex justify-center py-2"><LanguageToggle /></div>
            <button
              onClick={() => { setMoreOpen(false); handleLogout(); }}
              data-testid="more-logout"
              className="flex items-center gap-4 px-4 py-3.5 mt-1 rounded-2xl text-[15px] font-semibold text-red-600 bg-red-50 active:bg-red-100 tap"
            >
              <span className="w-10 h-10 rounded-xl bg-white border border-red-200 flex items-center justify-center shrink-0">
                <LogOut className="w-5 h-5 text-red-600" strokeWidth={2} />
              </span>
              {t("nav.logout")}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
