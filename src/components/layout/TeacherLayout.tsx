import { ReactNode, useEffect, useState } from "react";
import { SuspendedBanner } from "@/components/layout/SuspendedBanner";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, BookOpen, ClipboardCheck, GraduationCap,
  Calendar, User, LogOut, Menu, X, MessageSquare, Users, Bell,
} from "lucide-react";
import { clearSchoolAuth } from "@/lib/schoolAuth";
import { cn } from "@/lib/utils";
import { useCurrentUser, getInitials, formatRole } from "@/hooks/useCurrentUser";
import logo from "@/assets/logo.png";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { apiRequest } from "@/lib/api";

const BASE_NAV = [
  { to: "/teacher/dashboard",          label: "Dashboard",       icon: LayoutDashboard },
  { to: "/teacher/classes",            label: "My Classes",      icon: BookOpen },
  { to: "/teacher/attendance",         label: "Attendance",      icon: ClipboardCheck },
  { to: "/teacher/combined-attendance",label: "Combined Class",  icon: Users },
  { to: "/teacher/exams",              label: "Record Marks",    icon: BookOpen },
  { to: "/teacher/schedule",           label: "My Timetable",    icon: Calendar },
  { to: "/teacher/profile",            label: "My Profile",      icon: User },
  { to: "/exams/grade-update-requests",label: "Grade Requests",  icon: MessageSquare },
];

const COMM_NAV = [
  { to: "/notifications", label: "Notifications & News", icon: Bell },
  { to: "/teacher/messages", label: "Messages", icon: MessageSquare },
];

export function TeacherLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const currentUser = useCurrentUser();

  // Use real user data — no hardcoded fallbacks
  const displayName = currentUser?.name ?? "Teacher";
  const displayRole = currentUser?.role ? formatRole(currentUser.role) : "Teacher";
  const initials = currentUser?.name ? getInitials(currentUser.name) : "??";

  const [hasDiningDuty, setHasDiningDuty] = useState(false);
  useEffect(() => {
    void apiRequest<any>(
      `/boarding/dining/assignments?date=${new Date().toISOString().slice(0, 10)}`,
      { auth: "school" }
    ).then(v => setHasDiningDuty((Array.isArray(v) ? v : v?.data ?? []).length > 0))
     .catch(() => setHasDiningDuty(false));
  }, []);

  const mainItems = hasDiningDuty
    ? [...BASE_NAV, { to: "/teacher/dining-attendance", label: "Dining Attendance", icon: ClipboardCheck }]
    : BASE_NAV;

  return (
    <div className="flex min-h-screen bg-background">
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between px-5 py-5 border-b border-sidebar-border">
          <Link to="/teacher/dashboard" className="flex items-center gap-2.5">
            <img src={logo} alt="ecareafrica logo" className="h-9 w-9 rounded-lg object-contain" />
            <div className="font-display font-bold text-sidebar-foreground text-base leading-tight">
              ecareafrica
              <div className="text-[10px] font-normal text-sidebar-foreground/70">Teacher Panel</div>
            </div>
          </Link>
          <button onClick={() => setOpen(false)} className="lg:hidden p-1.5 text-sidebar-foreground/70"><X className="h-5 w-5" /></button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {/* Main section */}
          <div>
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-sidebar-foreground/50">Main</div>
            <div className="space-y-0.5 mt-1">
              {mainItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.to;
                return (
                  <Link key={item.to} to={item.to} onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active ? "bg-primary text-primary-foreground shadow-sm"
                             : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-foreground"
                    )}>
                    <Icon className="h-[18px] w-[18px]" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
          {/* Communication */}
          <div>
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-sidebar-foreground/50">Communication</div>
            <div className="space-y-0.5 mt-1">
              {COMM_NAV.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.to;
                return (
                  <Link key={item.to} to={item.to} onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active ? "bg-primary text-primary-foreground shadow-sm"
                             : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-foreground"
                    )}>
                    <Icon className="h-[18px] w-[18px]" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="text-[11px] text-sidebar-foreground/60 mb-2">
            Role: <span className="text-sidebar-foreground font-semibold">{displayRole}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground font-semibold text-sm">{initials}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-sidebar-foreground truncate">{displayName}</div>
              <div className="text-[11px] text-sidebar-foreground/60">{displayRole}</div>
            </div>
            <button
              onClick={() => { clearSchoolAuth(); window.location.replace("/login"); }}
              className="rounded-md p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-foreground"
              aria-label="Logout">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2">
            <RoleSwitcher compact />
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
          <div className="flex items-center gap-4 px-4 md:px-8 py-4">
            <button onClick={() => setOpen(true)} className="lg:hidden rounded-md p-2 hover:bg-muted"><Menu className="h-5 w-5" /></button>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-xl md:text-2xl font-bold truncate">{title}</h1>
              {subtitle && <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
            <div className="hidden md:block"><RoleSwitcher compact /></div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen(p => !p)}
                className="hidden sm:flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted">
                <div className="text-right leading-tight">
                  <div className="text-sm font-semibold">{displayName}</div>
                  <div className="text-[11px] text-muted-foreground">{displayRole}</div>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground text-sm font-bold">{initials}</div>
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
                  <Link to="/teacher/profile" onClick={() => setProfileOpen(false)}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-muted">View Profile</Link>
                  <Link to="/teacher/settings" onClick={() => setProfileOpen(false)}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-muted">Account Settings</Link>
                  <button onClick={() => { clearSchoolAuth(); setProfileOpen(false); window.location.replace("/login"); }}
                    className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-muted">Sign Out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 md:px-8 py-6"><SuspendedBanner />{children}</main>
      </div>
    </div>
  );
}

