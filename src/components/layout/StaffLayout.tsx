import { ReactNode, useState, useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, DoorOpen, UserCheck, Home, FileText, AlertTriangle,
  Search as SearchIcon, ClipboardList, User, LogOut, Menu, X, Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STAFF_ME, LEAVE_REQUESTS, ABSENCE_ALERTS_STAFF, STAFF_ROLE_DISABLED,
} from "@/lib/teacherStaffData";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  badgeKey?: "pendingLeaves" | "activeAlerts";
};

const NAV: { section: string; items: NavItem[] }[] = [
  { section: "Main", items: [{ to: "/staff/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    section: "Gate Operations",
    items: [
      { to: "/staff/gate", label: "Gate Control", icon: DoorOpen },
      { to: "/staff/visitors", label: "Visitors", icon: UserCheck },
    ],
  },
  {
    section: "Boarding",
    items: [
      { to: "/staff/boarding", label: "Boarding Roll Call", icon: Home },
      { to: "/staff/leaves", label: "Leave Requests", icon: FileText, badgeKey: "pendingLeaves" },
      { to: "/staff/alerts", label: "Absence Alerts", icon: AlertTriangle, badgeKey: "activeAlerts" },
    ],
  },
  { section: "Students", items: [{ to: "/staff/students", label: "Student Lookup", icon: SearchIcon }] },
  {
    section: "Personal",
    items: [
      { to: "/staff/my-attendance", label: "My Attendance", icon: ClipboardList },
      { to: "/staff/profile", label: "My Profile", icon: User },
    ],
  },
];

export function StaffLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pendingLeaves = LEAVE_REQUESTS.filter((l) => l.status === "Pending").length;
  const activeAlerts = ABSENCE_ALERTS_STAFF.filter((a) => a.status === "Active").length;
  const disabledRoutes = STAFF_ROLE_DISABLED[STAFF_ME.role] ?? [];

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-sidebar-border">
          <Link to="/staff/dashboard" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              S
            </div>
            <div className="font-display font-bold text-sidebar-foreground text-base leading-tight">
              Education Care System
              <div className="text-[10px] font-normal text-sidebar-foreground/70">Staff Panel</div>
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
                  const disabled = disabledRoutes.includes(item.to);
                  const badge =
                    item.badgeKey === "pendingLeaves" && pendingLeaves > 0
                      ? pendingLeaves
                      : item.badgeKey === "activeAlerts" && activeAlerts > 0
                        ? activeAlerts
                        : null;

                  if (disabled) {
                    return (
                      <div
                        key={item.to}
                        title="Not in your role"
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/35 cursor-not-allowed select-none"
                      >
                        <Icon className="h-[18px] w-[18px] opacity-50" />
                        <span className="flex-1">{item.label}</span>
                        <span className="text-[9px] uppercase tracking-wide opacity-60">Role</span>
                      </div>
                    );
                  }

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
                      {badge != null && (
                        <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-4 space-y-2">
          <div className="text-[11px] text-sidebar-foreground/60">
            Logged in as: <span className="text-sidebar-foreground font-semibold">{STAFF_ME.name}</span>
          </div>
          <div className="text-[11px] text-sidebar-foreground/60">
            Role: <span className="text-sidebar-foreground font-semibold">{STAFF_ME.role}</span>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground font-semibold text-sm">
              {STAFF_ME.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-sidebar-foreground truncate">{STAFF_ME.name}</div>
              <div className="text-[11px] text-sidebar-foreground/60">{STAFF_ME.section}</div>
            </div>
            <Link
              to="/login"
              className="rounded-md p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-foreground"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
          <div className="flex items-center gap-4 px-4 md:px-8 py-4">
            <button type="button" onClick={() => setOpen(true)} className="lg:hidden rounded-md p-2 hover:bg-muted">
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-xl md:text-2xl font-bold truncate">{title}</h1>
              {subtitle && <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
            <div className="hidden md:block text-right">
              <div className="font-mono text-base font-bold text-primary">{now.toLocaleTimeString()}</div>
              <div className="text-[11px] text-muted-foreground">
                {now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "short" })}
              </div>
            </div>
            <button
              type="button"
              className="relative grid h-10 w-10 place-items-center rounded-lg border border-border bg-card hover:bg-muted"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {(pendingLeaves > 0 || activeAlerts > 0) && (
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive" />
              )}
            </button>
          </div>
        </header>
        <main className="flex-1 px-4 md:px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
