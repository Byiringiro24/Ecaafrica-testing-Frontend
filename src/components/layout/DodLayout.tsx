import { ReactNode, useState } from "react";
import { SuspendedBanner } from "@/components/layout/SuspendedBanner";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardCheck,
  Utensils,
  AlertTriangle,
  Settings,
  BarChart3,
  Users,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  BedDouble,
  Cpu,
} from "lucide-react";
import { clearSchoolAuth } from "@/lib/schoolAuth";
import { cn } from "@/lib/utils";
import { useCurrentUser, getInitials, formatRole } from "@/hooks/useCurrentUser";
import logo from "@/assets/logo.png";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { RoleSwitcher } from "@/components/RoleSwitcher";

const NAV = [
  {
    section: "Operations",
    items: [
      { to: "/dod/dashboard",           label: "Dashboard",              icon: LayoutDashboard },
      { to: "/dod/leaves",              label: "Leave Management",       icon: CalendarDays    },
      { to: "/dod/gate-exits",          label: "Gate Exits",             icon: ShieldCheck     },
      { to: "/dod/dormitories",         label: "Dormitories & Rooms",    icon: BedDouble       },
      { to: "/dod/patrons",             label: "Patrons & Matrons",      icon: Users           },
    ],
  },
  {
    section: "Attendance",
    items: [
      { to: "/dod/attendance",          label: "Attendance Config",       icon: ClipboardCheck  },
      { to: "/boarding/attendance",     label: "Dormitory Attendance",    icon: ClipboardCheck  },
    ],
  },
  {
    section: "Devices",
    items: [
      { to: "/dod/devices",             label: "Device Locations",        icon: Cpu             },
      { to: "/boarding/device-sessions",label: "Device Sessions",         icon: ClipboardCheck  },
    ],
  },
  {
    section: "Dining",
    items: [
      { to: "/dod/dining",              label: "Dining Management",       icon: Utensils        },
      { to: "/attendance/dining-reports",label:"Dining Reports",          icon: BarChart3       },
    ],
  },
  {
    section: "Admin",
    items: [
      { to: "/dod/alerts",              label: "Alerts & Exceptions",     icon: AlertTriangle   },
      { to: "/dod/reports",             label: "Boarding Reports",        icon: BarChart3       },
    ],
  },
];

export function DodLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const currentUser = useCurrentUser();
  const displayName = currentUser?.name ?? "Director of Discipline";
  const displayRole = currentUser?.role ? formatRole(currentUser.role) : "Director of Discipline";
  const initials = currentUser?.name ? getInitials(currentUser.name) : "DD";

  return (
    <div className="flex min-h-screen bg-background">
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-sidebar-border">
          <Link to="/dod/dashboard" className="flex items-center gap-2.5">
            <img src={logo} alt="ecareafrica" className="h-9 w-9 rounded-lg object-contain" />
            <div className="font-display font-bold text-sidebar-foreground text-base leading-tight">
              ecareafrica
              <div className="text-[10px] font-normal text-sidebar-foreground/70">DOD Panel</div>
            </div>
          </Link>
          <button onClick={() => setOpen(false)} className="lg:hidden p-1.5 text-sidebar-foreground/70">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {NAV.map((sec) => (
            <div key={sec.section}>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-sidebar-foreground/50">
                {sec.section}
              </div>
              <div className="space-y-0.5 mt-1">
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.to ||
                    (item.to !== "/dod/dashboard" && pathname.startsWith(item.to));
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-foreground"
                      )}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      <span className="leading-snug">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="text-[11px] text-sidebar-foreground/60 mb-2">
            Role: <span className="text-sidebar-foreground font-semibold">{displayRole}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground font-semibold text-sm">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-sidebar-foreground truncate">{displayName}</div>
              <div className="text-[11px] text-sidebar-foreground/60">{displayRole}</div>
            </div>
            <button
              onClick={() => { clearSchoolAuth(); window.location.replace("/login"); }}
              className="rounded-md p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-foreground"
              aria-label="Logout"
            >
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
            <button onClick={() => setOpen(true)} className="lg:hidden rounded-md p-2 hover:bg-muted">
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-xl md:text-2xl font-bold truncate">{title}</h1>
              {subtitle && <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
            <div className="hidden md:block"><RoleSwitcher compact /></div>
            <div className="hidden sm:flex items-center gap-3 rounded-lg px-2 py-1.5">
              <div className="text-right leading-tight">
                <div className="text-sm font-semibold">{displayName}</div>
                <div className="text-[11px] text-muted-foreground">{displayRole}</div>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                {initials}
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 md:px-8 py-6"><SuspendedBanner />{children}</main>
      </div>
    </div>
  );
}

