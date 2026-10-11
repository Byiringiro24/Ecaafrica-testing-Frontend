import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { isSchoolAdminRole } from "@/lib/schoolAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const TABS = [
  { to: "/attendance/manual",             label: "Class Attendance"         },
  { to: "/attendance/boarding-manual",    label: "Boarding Attendance"      },
  { to: "/attendance/dining-hall",        label: "Dining Hall"              },
  { to: "/attendance/dining-assignments", label: "Assign Dining Teachers",  schoolAdminOnly: true },
  { to: "/attendance/dining-reports",     label: "Dining Reports"           },
  { to: "/attendance/device-attendance",  label: "Device Attendance"        },
  { to: "/attendance/messages",           label: "SMS Settings"             },
  { to: "/attendance/bulk-sms",           label: "Bulk SMS"                 },
] as const;

export function AttendanceNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const currentUser = useCurrentUser();
  const isAdmin = isSchoolAdminRole() || currentUser?.role === "dos" || currentUser?.role === "dod";
  const tabs = TABS.filter(tab => !tab.schoolAdminOnly || isAdmin);

  return (
    <div className="flex flex-wrap gap-1 border-b border-border mb-5 overflow-x-auto">
      {tabs.map((tab) => {
        const active = pathname === tab.to;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              "whitespace-nowrap px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
