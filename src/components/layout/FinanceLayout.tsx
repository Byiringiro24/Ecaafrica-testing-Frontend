import { ReactNode, useState, useEffect, useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, ListTree, FileText, Wallet, Users, Receipt,
  Boxes, BarChart3, ShieldCheck, LogOut, Menu, X, Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FINANCE_ME, ACADEMIC_SESSION, CURRENT_TERM } from "@/lib/financeData";
import { useCurrentUser, getInitials, formatRole } from "@/hooks/useCurrentUser";
import { clearSchoolAuth } from "@/lib/schoolAuth";
import logo from "@/assets/logo.png";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Overview",
    items: [{ to: "/finance", label: "Finance Dashboard", icon: LayoutDashboard }],
  },
  {
    section: "Student Finance",
    items: [
      { to: "/finance/fee-structure", label: "Fee Structure", icon: ListTree },
      { to: "/finance/invoices", label: "Invoices", icon: FileText },
      { to: "/finance/payments", label: "Payments", icon: Wallet },
    ],
  },
  {
    section: "Operations",
    items: [
      { to: "/finance/payroll", label: "Payroll", icon: Users },
      { to: "/finance/expenses", label: "Expenses", icon: Receipt },
      { to: "/finance/inventory", label: "Inventory", icon: Boxes },
    ],
  },
  {
    section: "Insights",
    items: [
      { to: "/finance/reports", label: "Financial Reports", icon: BarChart3 },
      { to: "/finance/audit", label: "Audit & Security", icon: ShieldCheck },
    ],
  },
];

function handleLogout() {
  clearSchoolAuth();
  window.location.replace("/login");
}

export function FinanceLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const currentUser = useCurrentUser();

  const displayName = currentUser?.name ?? FINANCE_ME.name;
  const initials = currentUser?.name ? getInitials(currentUser.name) : FINANCE_ME.initials;
  const role = currentUser?.role ? formatRole(currentUser.role) : FINANCE_ME.role;
  const schoolName = currentUser?.school_name ?? null;

  useEffect(() => {
    if (!profileOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!profileRef.current?.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [profileOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:shrink-0 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-sidebar-border">
          <Link to="/finance" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
            <img src={logo} alt="ecareafrica logo" className="h-9 w-9 rounded-lg object-contain" />
            <div className="font-display font-bold text-sidebar-foreground text-base leading-tight">
              ecareafrica
              <div className="text-[10px] font-normal text-sidebar-foreground/70">Finance Department</div>
            </div>
          </Link>
          <button type="button" onClick={() => setOpen(false)} className="lg:hidden p-1.5 text-sidebar-foreground/70">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {NAV.map((sec) => (
            <div key={sec.section}>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-sidebar-foreground/50">
                {sec.section}
              </div>
              <div className="space-y-0.5 mt-1">
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.to;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-foreground",
                      )}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-4 space-y-2">
          <div className="text-[11px] text-sidebar-foreground/60">
            Session: <span className="text-sidebar-foreground font-semibold">{ACADEMIC_SESSION} · {CURRENT_TERM}</span>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground font-semibold text-sm">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-sidebar-foreground truncate">{displayName}</div>
              <div className="text-[11px] text-sidebar-foreground/60 truncate">{role}</div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-foreground"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="shrink-0 border-b border-border bg-background/85 backdrop-blur-md">
          <div className="flex items-center gap-4 px-4 md:px-8 py-4">
            <button type="button" onClick={() => setOpen(true)} className="lg:hidden rounded-md p-2 hover:bg-muted">
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-xl md:text-2xl font-bold truncate">{title}</h1>
              {subtitle && <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
            <button
              type="button"
              className="relative grid h-10 w-10 place-items-center rounded-lg border border-border bg-card hover:bg-muted"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive" />
            </button>

            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((p) => !p)}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted"
              >
                <div className="hidden sm:block text-right leading-tight max-w-[220px]">
                  <div className="text-sm font-semibold truncate">{displayName}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {schoolName ? `${role} · ${schoolName}` : role}
                  </div>
                </div>
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  {initials}
                </div>
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg border border-border bg-card shadow-lg overflow-hidden z-30">
                  <Link
                    to="/settings"
                    onClick={() => setProfileOpen(false)}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-muted"
                  >
                    View Profile
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setProfileOpen(false)}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-muted"
                  >
                    Account Settings
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-muted"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6">{children}</main>
      </div>
    </div>
  );
}

// Shared little UI helpers reused across Finance pages
export function ChartCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="font-display font-bold">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function StatusPill({ label, tone }: { label: string; tone: "success" | "warning" | "destructive" | "muted" | "primary" }) {
  const map = {
    success: "bg-success/15 text-success",
    warning: "bg-amber-100 text-amber-700",
    destructive: "bg-destructive/15 text-destructive",
    muted: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary",
  } as const;
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${map[tone]}`}>{label}</span>;
}
