import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, ScanLine, Users, BookOpen, BarChart3,
  Heart, MessageSquare, Settings, LogOut, X,
  Home, DoorOpen, FileText, Wallet, Briefcase, ChevronDown, UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { schoolConfig } from "@/lib/mockData";
import logo from "@/assets/logo.png";
import { useCurrentUser, getInitials, formatRole } from "@/hooks/useCurrentUser";
import { isSchoolAdminRole } from "@/lib/schoolAuth";

interface NavItem { to: string; label: string; icon: any; module: string; }
interface Section { id: string; label: string; items: NavItem[]; }

const SECTIONS: Section[] = [
  { id: "core", label: "Core", items: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
    { to: "/attendance", label: "Attendance", icon: ScanLine, module: "attendance" },
    { to: "/students", label: "Students", icon: Users, module: "students" },
    { to: "/classes", label: "Classes", icon: BookOpen, module: "classes" },
    { to: "/visitors", label: "Visitors", icon: UserCheck, module: "visitors" },
  ]},
  { id: "boarding", label: "Boarding", items: [
    { to: "/boarding", label: "Boarding", icon: Home, module: "boarding" },
    { to: "/gate", label: "Gate", icon: DoorOpen, module: "gate" },
    { to: "/leaves", label: "Leaves", icon: FileText, module: "leaves" },
  ]},
  { id: "finance", label: "Finance", items: [
    { to: "/fees", label: "Fees", icon: Wallet, module: "fees" },
  ]},
  { id: "hr", label: "HR", items: [
    { to: "/staff", label: "Staff", icon: Briefcase, module: "staff" },
  ]},
  { id: "comm", label: "Communication", items: [
    { to: "/parents", label: "Parents", icon: Heart, module: "parents" },
    { to: "/notifications", label: "Notifications", icon: MessageSquare, module: "notifications" },
  ]},
  { id: "analytics", label: "Analytics", items: [
    { to: "/reports", label: "Reports", icon: BarChart3, module: "reports" },
  ]},
  { id: "system", label: "System", items: [
    { to: "/settings", label: "Settings", icon: Settings, module: "settings" },
  ]},
];

interface Props { open: boolean; onClose: () => void; }

export function AppSidebar({ open, onClose }: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const currentUser = useCurrentUser();
  const isSchoolAdmin = isSchoolAdminRole(currentUser?.role);

  const toggle = (id: string) => setCollapsed(p => ({ ...p, [id]: !p[id] }));

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-sidebar-border">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <img src={logo} alt="ecareafrica logo" className="h-9 w-9 rounded-lg object-contain" />
            <div className="font-display font-bold text-sidebar-foreground text-base leading-tight">
              ecareafrica
              <div className="text-[10px] font-normal text-sidebar-foreground/70 truncate max-w-[140px]">
                {schoolConfig.schoolName}
              </div>
            </div>
          </Link>
          <button onClick={onClose} className="lg:hidden rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
          {SECTIONS.map((sec) => {
            const items = sec.items.filter(it => {
              if (!schoolConfig.enabledModules.includes(it.module)) return false;
              if (!schoolConfig.hasBoarding && (it.module === "boarding" || it.module === "leaves")) return false;
              if (!schoolConfig.hasGateManagement && it.module === "gate") return false;
              if (isSchoolAdmin && (it.module === "fees" || it.module === "reports" || it.module === "staff")) return false;
              return true;
            });
            if (items.length === 0) return null;
            const isCollapsed = collapsed[sec.id];
            return (
              <div key={sec.id}>
                <button
                  onClick={() => toggle(sec.id)}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-sidebar-foreground/50 hover:text-foreground/80"
                >
                  {sec.label}
                  <ChevronDown className={cn("h-3 w-3 transition-transform", isCollapsed && "-rotate-90")} />
                </button>
                {!isCollapsed && (
                  <div className="space-y-0.5 mt-1">
                    {items.map((item) => {
                      const Icon = item.icon;
                      const active = pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={onClose}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            active
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-foreground"
                          )}
                        >
                          <Icon className="h-[18px] w-[18px] shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

         
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            {currentUser?.avatar_url ? (
              <img
                src={currentUser.avatar_url}
                alt={currentUser.name}
                className="h-10 w-10 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground font-semibold text-sm shrink-0">
                {currentUser ? getInitials(currentUser.name) : "…"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-sidebar-foreground truncate">
                {currentUser?.name ?? "Loading…"}
              </div>
              <div className="text-[11px] text-sidebar-foreground/60">
                {currentUser?.role ? formatRole(currentUser.role) : ""}
              </div>
            </div>
            <button className="rounded-md p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-foreground" aria-label="Logout">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
