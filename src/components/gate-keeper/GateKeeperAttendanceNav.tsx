import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/gate-keeper/attendance/device-attendance", label: "Device Attendance" },
  { to: "/gate-keeper/attendance/make-attendance", label: "Make Attendance" },
  { to: "/gate-keeper/attendance/history", label: "Attendance History" },
] as const;

export function GateKeeperAttendanceNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex gap-1 border-b border-border mb-5">
      {TABS.map((tab) => {
        const active = pathname === tab.to;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              "px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
