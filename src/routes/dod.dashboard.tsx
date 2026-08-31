import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Users, UserCheck, UserX, CalendarDays, Clock, Utensils,
  AlertTriangle, ShieldCheck, Settings, BarChart3, ArrowRight,
  Home, ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";
import { DodLayout } from "@/components/layout/DodLayout";
import { directorOfDisciplineRouteGuard } from "@/lib/schoolAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { leavesApi, type LeaveRecord } from "@/lib/boardingApi";

export const Route = createFileRoute("/dod/dashboard")({
  beforeLoad: ({ location }) => directorOfDisciplineRouteGuard(location),
  component: DodDashboard,
});

type Student = { id: string; student_type?: string | null };
type Dormitory = { id: string; name: string; block_name?: string | null };
type DormAssignment = { student_id: string; dormitory_id: string };

function DodDashboard() {
  const currentUser = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBoarders: 0,
    insideSchool: 0,
    onLeave: 0,
    returned: 0,
    missingAttendance: 0,
    lateReturns: 0,
    pendingLeaves: 0,
    diningExceptions: 0,
  });
  const [missingStudents, setMissingStudents] = useState<LeaveRecord[]>([]);
  const [dormSummary, setDormSummary] = useState<{ id: string; name: string; total: number; present: number; missing: number; onLeave: number }[]>([]);

  const today = new Date().toISOString().slice(0, 10);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const displayName = currentUser?.name?.split(" ").slice(0, 2).join(" ") ?? "Director";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [students, leaves, dormitories, assignments] = await Promise.all([
          apiRequest<Student[]>("/students?student_type=boarding&limit=2000", { auth: "school" }).catch(() => [] as Student[]),
          leavesApi.list({ limit: "2000" }).then(r => Array.isArray(r) ? r : (r as any)?.data ?? []).catch(() => [] as LeaveRecord[]),
          apiRequest<Dormitory[]>("/boarding/dormitories?limit=100", { auth: "school" }).catch(() => [] as Dormitory[]),
          apiRequest<DormAssignment[]>("/boarding/assignments?is_active=true&limit=5000", { auth: "school" }).catch(() => [] as DormAssignment[]),
        ]);

        const boarders = (Array.isArray(students) ? students : []).filter(s => s.student_type === "boarding");
        const leaveList = Array.isArray(leaves) ? leaves : [];
        const dormList = Array.isArray(dormitories) ? dormitories : [];
        const assignList = Array.isArray(assignments) ? assignments : [];

        const onLeaveToday = leaveList.filter(l =>
          l.leave_state === "outside_school" ||
          (l.status === "approved" && !l.returned_at && l.start_date <= today && l.end_date >= today)
        );
        const returnedToday = leaveList.filter(l => l.returned_at?.startsWith(today));
        const lateReturns = leaveList.filter(l => l.late_return_flagged && !l.returned_at);
        const pendingLeaves = leaveList.filter(l => l.status === "pending" || l.leave_state === "requested" || l.leave_state === "pending_dod_approval");

        // dormitory-level summary
        const onLeaveIds = new Set(onLeaveToday.map(l => l.student_id));
        const dormMap = new Map(dormList.map(d => [d.id, { id: d.id, name: d.name, total: 0, present: 0, missing: 0, onLeave: 0 }]));
        for (const a of assignList) {
          const dorm = dormMap.get(a.dormitory_id);
          if (!dorm) continue;
          dorm.total++;
          if (onLeaveIds.has(a.student_id)) dorm.onLeave++;
          else dorm.missing++; // simplification until reconciliation data is available
        }

        setStats({
          totalBoarders: boarders.length,
          insideSchool: boarders.length - onLeaveToday.length,
          onLeave: onLeaveToday.length,
          returned: returnedToday.length,
          missingAttendance: 0, // populated from attendance sessions when available
          lateReturns: lateReturns.length,
          pendingLeaves: pendingLeaves.length,
          diningExceptions: 0,
        });
        setDormSummary(Array.from(dormMap.values()).filter(d => d.total > 0));
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [today]);

  return (
    <DodLayout title={`${greeting}, ${displayName}`} subtitle={dateLabel}>
      {/* ── Today's Overview ── */}
      <div className="grid gap-4 grid-cols-2 xl:grid-cols-4 mb-6">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <StatCard label="Total Boarders"       value={stats.totalBoarders}      icon={<Users className="h-5 w-5" />}         tone="primary" />
            <StatCard label="Students Inside"      value={stats.insideSchool}       icon={<UserCheck className="h-5 w-5" />}     tone="success" />
            <StatCard label="On Leave"             value={stats.onLeave}            icon={<CalendarDays className="h-5 w-5" />}  tone="warning" />
            <StatCard label="Returned Today"       value={stats.returned}           icon={<UserCheck className="h-5 w-5" />}     tone="secondary" />
            <StatCard label="Pending Leave Requests" value={stats.pendingLeaves}    icon={<Clock className="h-5 w-5" />}         tone="warning" trend="Awaiting your approval" />
            <StatCard label="Late Returns"         value={stats.lateReturns}        icon={<AlertTriangle className="h-5 w-5" />} tone="destructive" />
            <StatCard label="Dining Exceptions"    value={stats.diningExceptions}   icon={<Utensils className="h-5 w-5" />}     tone="secondary" />
            <StatCard label="Missing Attendance"   value={stats.missingAttendance}  icon={<UserX className="h-5 w-5" />}         tone="destructive" />
          </>
        )}
      </div>

      {/* ── Red alert for pending approvals ── */}
      {!loading && stats.pendingLeaves > 0 && (
        <div className="mb-5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-destructive text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {stats.pendingLeaves} leave request{stats.pendingLeaves !== 1 ? "s" : ""} awaiting your approval.
          </div>
          <Link to="/dod/leaves" className="text-xs font-bold text-destructive hover:underline inline-flex items-center gap-1">
            Review now <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {!loading && stats.lateReturns > 0 && (
        <div className="mb-5 rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-800 text-sm font-semibold">
            <Clock className="h-4 w-4 shrink-0" />
            {stats.lateReturns} student{stats.lateReturns !== 1 ? "s" : ""} have not returned from leave yet — overdue.
          </div>
          <Link to="/dod/leaves" className="text-xs font-bold text-amber-700 hover:underline inline-flex items-center gap-1">
            View <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── Quick Actions ── */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-display font-bold text-lg mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { to: "/dod/leaves",      label: "Approve Leave",          icon: CalendarDays,  primary: true },
              { to: "/dod/gate-exits",  label: "Gate Exits",             icon: ShieldCheck,   primary: false },
              { to: "/dod/attendance",  label: "Boarding Attendance",    icon: ClipboardCheck,primary: false },
              { to: "/dod/dormitories", label: "Manage Dormitories",     icon: Home,          primary: false },
              { to: "/dod/patrons",     label: "Patrons & Matrons",      icon: Users,         primary: false },
              { to: "/dod/dining",      label: "Dining Schedules",       icon: Utensils,      primary: false },
              { to: "/dod/reports",     label: "Boarding Reports",       icon: BarChart3,     primary: false },
              { to: "/dod/config",      label: "Configuration",          icon: Settings,      primary: false },
            ].map(({ to, label, icon: Icon, primary }) => (
              <Link
                key={to}
                to={to}
                className={`rounded-lg p-4 flex flex-col items-start gap-2 transition ${
                  primary
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border border-border bg-card hover:bg-muted/40"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-semibold text-sm leading-snug">{label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Dormitory Summary ── */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg">Dormitory Overview</h3>
            <Link to="/dod/dormitories" className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1">
              Manage <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : dormSummary.length === 0 ? (
            <p className="text-sm text-muted-foreground">No dormitories configured yet.</p>
          ) : (
            <div className="space-y-3">
              {dormSummary.map(d => (
                <div key={d.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">{d.name}</span>
                    <span className="text-xs text-muted-foreground">{d.total} students</span>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span className="text-emerald-600 font-semibold">{d.present} Present</span>
                    <span className="text-amber-600 font-semibold">{d.onLeave} On Leave</span>
                    <span className="text-destructive font-semibold">{d.missing} Missing</span>
                  </div>
                  {/* simple progress bar */}
                  <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: d.total > 0 ? `${Math.round((d.present / d.total) * 100)}%` : "0%" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DodLayout>
  );
}
