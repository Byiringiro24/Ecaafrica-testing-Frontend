import { ReactNode, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, BookOpen, ClipboardCheck, GraduationCap, TrendingUp,
  MessageSquare, Bell, Calendar, User, LogOut, Menu, X, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TEACHER_ME } from "@/lib/teacherStaffData";
import logo from "@/assets/logo.png";

const NAV = [
  { section: "Main", items: [
    { to: "/teacher/dashboard", label: "Dashboard", icon: LayoutDashboard },
  ]},
  { section: "My Classes", items: [
    { to: "/teacher/classes", label: "My Classes", icon: BookOpen },
    { to: "/teacher/attendance", label: "Attendance", icon: ClipboardCheck },
  ]},
  { section: "Academic", items: [
    { to: "/teacher/exams", label: "Exams & Results", icon: GraduationCap },
    { to: "/teacher/progress", label: "Student Progress", icon: TrendingUp },
  ]},
  { section: "Communication", items: [
    { to: "/teacher/messages", label: "Parent Messages", icon: MessageSquare },
    { to: "/teacher/notifications", label: "Notifications", icon: Bell },
  ]},
  { section: "Personal", items: [
    { to: "/teacher/schedule", label: "My Schedule", icon: Calendar },
    { to: "/teacher/profile", label: "My Profile", icon: User },
  ]},
];

export function TeacherLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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
          {NAV.map((sec) => (
            <div key={sec.section}>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-sidebar-foreground/50">{sec.section}</div>
              <div className="space-y-0.5 mt-1">
                {sec.items.map((item) => {
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
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="text-[11px] text-sidebar-foreground/60 mb-2">
            Class Teacher: <span className="text-sidebar-foreground font-semibold">{TEACHER_ME.classTeacher}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground font-semibold text-sm">{TEACHER_ME.initials}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-sidebar-foreground truncate">{TEACHER_ME.name}</div>
              <div className="text-[11px] text-sidebar-foreground/60">Teacher</div>
            </div>
            <Link to="/login" className="rounded-md p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-foreground" aria-label="Logout">
              <LogOut className="h-4 w-4" />
            </Link>
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
            <div className="hidden md:flex relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" placeholder="Search students, classes..." />
            </div>
            <button className="relative grid h-10 w-10 place-items-center rounded-lg border border-border bg-card hover:bg-muted">
              <Bell className="h-4 w-4" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive" />
            </button>
          </div>
        </header>
        <main className="flex-1 px-4 md:px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
