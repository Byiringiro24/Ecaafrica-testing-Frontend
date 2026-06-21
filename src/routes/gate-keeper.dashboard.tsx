import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ClipboardList,
  Users,
  ShieldCheck,
  Wifi,
  ArrowRight,
  LogIn,
  LogOut,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { GateKeeperLayout } from "@/components/layout/GateKeeperLayout";
import { gateKeeperRouteGuard } from "@/lib/schoolAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/gate-keeper/dashboard")({
  beforeLoad: ({ location }) => gateKeeperRouteGuard(location),
  component: GateKeeperDashboard,
});

type GateLogRecord = {
  id: string;
  student_id?: string | null;
  event_type: "entry" | "exit";
  scan_method?: string | null;
  scanned_at?: string | null;
  is_flagged?: boolean;
};

type LeaveRecord = {
  id: string;
  status: string;
  start_date: string;
  end_date: string;
  returned_at?: string | null;
};

type VisitRecord = {
  id: string;
  checked_out_at?: string | null;
};

type DeviceRecord = {
  id: string;
  is_active?: boolean;
};

function GateKeeperDashboard() {
  const currentUser = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todayEntries: 0,
    todayExits: 0,
    flagged: 0,
    activeVisitors: 0,
    approvedLeaveOut: 0,
    activeDevices: 0,
    offlineDevices: 0,
  });

  const today = new Date().toISOString().slice(0, 10);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const displayName = currentUser?.name?.split(" ").slice(0, 2).join(" ") ?? "Gate Keeper";

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        const [gateLogs, leaves, visits, devices] = await Promise.all([
          apiRequest<GateLogRecord[]>("/gate/logs?limit=1000&sort=scanned_at&order=desc", {
            auth: "school",
          }).catch(() => [] as GateLogRecord[]),
          apiRequest<LeaveRecord[]>("/boarding/student-leaves?limit=1000", { auth: "school" }).catch(
            () => [] as LeaveRecord[]
          ),
          apiRequest<VisitRecord[]>("/visitor-visits?limit=1000", { auth: "school" }).catch(
            () => [] as VisitRecord[]
          ),
          apiRequest<DeviceRecord[]>("/devices?limit=500", { auth: "school" }).catch(
            () => [] as DeviceRecord[]
          ),
        ]);

        const logs = Array.isArray(gateLogs) ? gateLogs : [];
        const todayLogs = logs.filter((log) => (log.scanned_at ?? "").slice(0, 10) === today);
        const leaveList = Array.isArray(leaves) ? leaves : [];
        const visitList = Array.isArray(visits) ? visits : [];
        const deviceList = Array.isArray(devices) ? devices : [];

        const approvedOut = leaveList.filter(
          (leave) =>
            leave.status === "approved" &&
            !leave.returned_at &&
            leave.start_date <= today &&
            leave.end_date >= today
        ).length;

        setStats({
          todayEntries: todayLogs.filter((log) => log.event_type === "entry").length,
          todayExits: todayLogs.filter((log) => log.event_type === "exit").length,
          flagged: todayLogs.filter((log) => log.is_flagged).length,
          activeVisitors: visitList.filter((visit) => !visit.checked_out_at).length,
          approvedLeaveOut: approvedOut,
          activeDevices: deviceList.filter((device) => device.is_active !== false).length,
          offlineDevices: deviceList.filter((device) => device.is_active === false).length,
        });
      } catch (error: any) {
        toast.error(error?.message ?? "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    void loadStats();
  }, [today]);

  return (
    <GateKeeperLayout title={`${greeting}, ${displayName}`} subtitle={dateLabel}>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : (
          <>
            <StatCard
              label="Entries Today"
              value={stats.todayEntries}
              icon={<LogIn className="h-5 w-5" />}
              trend="Student gate check-ins"
              tone="success"
            />
            <StatCard
              label="Exits Today"
              value={stats.todayExits}
              icon={<LogOut className="h-5 w-5" />}
              trend="Student gate check-outs"
              tone="primary"
            />
            <StatCard
              label="Visitors On Campus"
              value={stats.activeVisitors}
              icon={<Users className="h-5 w-5" />}
              trend="Active visitor sessions"
              tone="secondary"
            />
            <StatCard
              label="Approved Leave (Out)"
              value={stats.approvedLeaveOut}
              icon={<ShieldCheck className="h-5 w-5" />}
              trend="Boarding students currently out"
              tone="warning"
            />
          </>
        )}
      </div>

      {!loading && stats.flagged > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {stats.flagged} flagged gate event{stats.flagged === 1 ? "" : "s"} recorded today.
        </div>
      )}

      <div className="grid gap-5 mt-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-display font-bold text-lg mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              to="/gate-keeper/attendance/device-attendance"
              className="rounded-lg bg-primary text-primary-foreground p-4 hover:bg-primary/90 transition flex flex-col items-start gap-2"
            >
              <ClipboardList className="h-5 w-5" />
              <span className="font-semibold text-sm">Gate Attendance</span>
            </Link>
            <Link
              to="/gate-keeper/visitors"
              className="rounded-lg border border-border bg-card p-4 hover:bg-muted/40 transition flex flex-col items-start gap-2"
            >
              <Users className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Manage Visitors</span>
            </Link>
            <Link
              to="/gate-keeper/boarding-leave"
              className="rounded-lg border border-border bg-card p-4 hover:bg-muted/40 transition flex flex-col items-start gap-2"
            >
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Verify Boarding Leave</span>
            </Link>
            <Link
              to="/gate-keeper/device-status"
              className="rounded-lg border border-border bg-card p-4 hover:bg-muted/40 transition flex flex-col items-start gap-2"
            >
              <Wifi className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Check Device Status</span>
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg">Device Summary</h3>
            <Link
              to="/gate-keeper/device-status"
              className="text-xs text-primary font-semibold inline-flex items-center gap-1 hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {loading ? (
            <Skeleton className="h-24" />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Active</div>
                <div className="font-display text-2xl font-bold text-success mt-1">
                  {stats.activeDevices}
                </div>
              </div>
              <div className="rounded-lg border border-border p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Offline</div>
                <div className="font-display text-2xl font-bold text-destructive mt-1">
                  {stats.offlineDevices}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </GateKeeperLayout>
  );
}
