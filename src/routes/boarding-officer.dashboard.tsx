import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ClipboardCheck,
  CalendarDays,
  Home,
  BarChart3,
  ArrowRight,
  Users,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { BoardingOfficerLayout } from "@/components/layout/BoardingOfficerLayout";
import { boardingOfficerRouteGuard } from "@/lib/schoolAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/boarding-officer/dashboard")({
  beforeLoad: ({ location }) => boardingOfficerRouteGuard(location),
  component: BoardingOfficerDashboard,
});

type LeaveRecord = {
  id: string;
  student_id: string;
  status: string;
  start_date: string;
  end_date: string;
  returned_at?: string | null;
};

type ApiRecord = {
  id: string;
  student_id: string;
  status: string;
  session_id: string;
};

type ApiSession = {
  id: string;
  session_type?: string | null;
  session_date: string;
};

function BoardingOfficerDashboard() {
  const currentUser = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBoarders: 0,
    presentToday: 0,
    onLeave: 0,
    absentToday: 0,
    pendingLeaves: 0,
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
  const displayName = currentUser?.name?.split(" ").slice(0, 2).join(" ") ?? "Boarding Officer";

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        const [students, leaves, sessions, records] = await Promise.all([
          apiRequest<{ id: string }[]>("/students?student_type=boarding&limit=2000", {
            auth: "school",
          }).catch(() => []),
          apiRequest<LeaveRecord[]>("/boarding/student-leaves?limit=1000", { auth: "school" }).catch(
            () => []
          ),
          apiRequest<ApiSession[]>(`/attendance/sessions?date=${today}&limit=500`, {
            auth: "school",
          }).catch(() => []),
          apiRequest<ApiRecord[]>(`/attendance/records?date=${today}&limit=5000`, {
            auth: "school",
          }).catch(() => []),
        ]);

        const boarderList = Array.isArray(students) ? students : [];
        const leaveList = Array.isArray(leaves) ? leaves : [];
        const sessionList = Array.isArray(sessions) ? sessions : [];
        const recordList = Array.isArray(records) ? records : [];

        const boardingSessionIds = new Set(
          sessionList
            .filter(
              (s) =>
                s.session_type === "boarding_morning" || s.session_type === "boarding_evening"
            )
            .map((s) => s.id)
        );

        const presentIds = new Set(
          recordList
            .filter(
              (r) =>
                boardingSessionIds.has(r.session_id) &&
                (r.status === "present" || r.status === "late" || r.status === "excused")
            )
            .map((r) => r.student_id)
        );

        const onLeaveIds = new Set(
          leaveList
            .filter(
              (leave) =>
                leave.status === "approved" &&
                !leave.returned_at &&
                leave.start_date <= today &&
                leave.end_date >= today
            )
            .map((leave) => leave.student_id)
        );

        const totalBoarders = boarderList.length;
        const onLeave = onLeaveIds.size;
        const presentToday = [...presentIds].filter((id) => !onLeaveIds.has(id)).length;
        const absentToday = Math.max(0, totalBoarders - presentToday - onLeave);
        const pendingLeaves = leaveList.filter((leave) => leave.status === "pending").length;

        setStats({ totalBoarders, presentToday, onLeave, absentToday, pendingLeaves });
      } catch (error: any) {
        toast.error(error?.message ?? "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    void loadStats();
  }, [today]);

  return (
    <BoardingOfficerLayout title={`${greeting}, ${displayName}`} subtitle={dateLabel}>
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
              label="Total Boarders"
              value={stats.totalBoarders}
              icon={<Users className="h-5 w-5" />}
              trend="Students in boarding"
              tone="primary"
            />
            <StatCard
              label="Present in Dorm"
              value={stats.presentToday}
              icon={<UserCheck className="h-5 w-5" />}
              trend="Marked present today"
              tone="success"
            />
            <StatCard
              label="On Approved Leave"
              value={stats.onLeave}
              icon={<CalendarDays className="h-5 w-5" />}
              trend="Currently away"
              tone="warning"
            />
            <StatCard
              label="Absent from Dorm"
              value={stats.absentToday}
              icon={<UserX className="h-5 w-5" />}
              trend="Not present & not on leave"
              tone="destructive"
            />
          </>
        )}
      </div>

      {!loading && stats.pendingLeaves > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {stats.pendingLeaves} leave request{stats.pendingLeaves === 1 ? "" : "s"} awaiting approval.
        </div>
      )}

      <div className="grid gap-5 mt-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-display font-bold text-lg mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              to="/boarding-officer/attendance"
              className="rounded-lg bg-primary text-primary-foreground p-4 hover:bg-primary/90 transition flex flex-col items-start gap-2"
            >
              <ClipboardCheck className="h-5 w-5" />
              <span className="font-semibold text-sm">Record Attendance</span>
            </Link>
            <Link
              to="/boarding-officer/leaves"
              className="rounded-lg border border-border bg-card p-4 hover:bg-muted/40 transition flex flex-col items-start gap-2"
            >
              <CalendarDays className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Manage Leave Requests</span>
            </Link>
            <Link
              to="/boarding-officer/dormitory"
              className="rounded-lg border border-border bg-card p-4 hover:bg-muted/40 transition flex flex-col items-start gap-2"
            >
              <Home className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Dormitory Status</span>
            </Link>
            <Link
              to="/boarding-officer/reports"
              className="rounded-lg border border-border bg-card p-4 hover:bg-muted/40 transition flex flex-col items-start gap-2"
            >
              <BarChart3 className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Boarding Reports</span>
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg">Today&apos;s Summary</h3>
            <Link
              to="/boarding-officer/dormitory"
              className="text-xs text-primary font-semibold inline-flex items-center gap-1 hover:underline"
            >
              View details <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {loading ? (
            <Skeleton className="h-24" />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Present</div>
                <div className="font-display text-2xl font-bold text-success mt-1">
                  {stats.presentToday}
                </div>
              </div>
              <div className="rounded-lg border border-border p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Absent</div>
                <div className="font-display text-2xl font-bold text-destructive mt-1">
                  {stats.absentToday}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </BoardingOfficerLayout>
  );
}
