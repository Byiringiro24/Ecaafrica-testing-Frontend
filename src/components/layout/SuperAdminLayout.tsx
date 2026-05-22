import { ReactNode, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Globe, School as SchoolIcon, UsersRound, Package, DollarSign, TrendingUp,
  BarChart3, Megaphone, Headphones, Settings, Flag, ClipboardList,
  LogOut, X, Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";
import { SUPER_ADMIN_USER } from "@/lib/superAdminMockData";

type NavItem = { to: string; label: string; icon: typeof Globe; exact?: boolean };
type NavSection = { label: string; items: NavItem[] };

const NAV: NavSection[] = [
  {
    label: "Overview",
    items: [
      { to: "/super-admin", label: "Platform Overview", icon: Globe, exact: true },
      { to: "/super-admin/schools", label: "Schools", icon: SchoolIcon },
      { to: "/super-admin/users", label: "Platform Users", icon: UsersRound },
    ],
  },
  {
    label: "Subscriptions & Billing",
    items: [
      { to: "/super-admin/subscriptions", label: "Subscriptions", icon: Package },
      { to: "/super-admin/billing", label: "Billing & Invoices", icon: DollarSign },
      { to: "/super-admin/revenue", label: "Revenue Analytics", icon: TrendingUp },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/super-admin/analytics", label: "Platform Analytics", icon: BarChart3 },
      { to: "/super-admin/announcements", label: "Announcements", icon: Megaphone },
      { to: "/super-admin/support", label: "Support Tickets", icon: Headphones },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/super-admin/system", label: "System Settings", icon: Settings },
      { to: "/super-admin/features", label: "Feature Flags", icon: Flag },
      { to: "/super-admin/audit", label: "Audit Logs", icon: ClipboardList },
    ],
  },
];

interface Props {
  title: string;
  subtitle?: string;
  headerExtra?: ReactNode;
  breadcrumbs?: ReactNode;
  children: ReactNode;
}

export function SuperAdminLayout({ title, subtitle, headerExtra, breadcrumbs, children }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: s => s.location.pathname });

  return (
    <div className="flex min-h-screen bg-background super-admin-shell">
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden />
      )}
      <aside
        className={cn(
          "super-admin-sidebar fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <Link to="/super-admin" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
            <img src={logo} alt="SchoolOS" className="h-9 w-9 rounded-lg object-contain" />
            <div className="font-display font-semibold text-base leading-tight text-white">
              SchoolOS
              <span className="mt-1 inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-amber-500 text-amber-950">
                Super Admin
              </span>
            </div>
          </Link>
          <button type="button" onClick={() => setOpen(false)} className="lg:hidden p-1.5 hover:bg-white/10 rounded text-white/80">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {NAV.map(section => (
            <div key={section.label}>
              <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-200/60">
                {section.label}
              </div>
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const Icon = item.icon;
                  const active = item.exact
                    ? pathname === "/super-admin" || pathname === "/super-admin/"
                    : pathname.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      activeOptions={item.exact ? { exact: true } : undefined}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-amber-500/90 text-amber-950 shadow-sm"
                          : "text-white/75 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <Icon className="h-[17px] w-[17px] shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-xs text-white/50 hover:text-white mb-3 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" /> Exit to School Admin
          </Link>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-amber-500 text-amber-950 font-bold text-sm">
              {SUPER_ADMIN_USER.name.split(" ").map(p => p[0]).join("").slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{SUPER_ADMIN_USER.name}</div>
              <div className="text-[11px] text-amber-200/70">{SUPER_ADMIN_USER.role}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md">
          <div className="flex items-center gap-4 px-4 md:px-8 py-4">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="lg:hidden p-2 hover:bg-muted rounded-md"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-xl md:text-2xl font-semibold truncate">{title}</h1>
              </div>
              {subtitle && <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
            {headerExtra}
          </div>
        </header>
        <main className="flex-1 px-4 md:px-8 py-6">
          {breadcrumbs}
          {children}
        </main>
      </div>
    </div>
  );
}
