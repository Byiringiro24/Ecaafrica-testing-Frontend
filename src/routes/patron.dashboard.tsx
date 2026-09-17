/**
 * Patron / Matron Dashboard
 * Shows ONLY dormitories assigned to this patron/matron.
 * Per spec: patron can never see unassigned dormitories.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, UserCheck, UserX, CalendarDays, Utensils, AlertTriangle, Clock, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { PatronLayout } from "@/components/layout/PatronLayout";
import { patronRouteGuard } from "@/lib/schoolAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { patronApi, leavesApi, type PatronAssignment, type LeaveRecord } from "@/lib/boardingApi";

export const Route = createFileRoute("/patron/dashboard")({
  beforeLoad: ({ location }) => patronRouteGuard(location),
  component: PatronDashboard,
});

type Assignment = { student_id: string; dormitory_id: string };

export function PatronDashboard() {
  const currentUser = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [dormAssignments, setDormAssignments] = useState<PatronAssignment[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [studentAssignments, setStudentAssignments] = useState<Assignment[]>([]);
  const [dormStats, setDormStats] = useState<{
    id: string; name: string; total: number; onLeave: number; missing: number;
    lateReturn: number; diningMissing: number;
  }[]>([]);

  const today = new Date().toISOString().slice(0, 10);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const displayName = currentUser?.name?.split(" ").slice(0, 2).join(" ") ?? "Patron";

  useEffect(() => {
    if (!currentUser?.id) return;
    const load = async () => {
      setLoading(true);
      try {
        // Get dormitories assigned to this patron
        const myDorms = await patronApi.listPatronAssignments(currentUser.id).catch(() => [] as PatronAssignment[]);
        const dormList = Array.isArray(myDorms) ? myDorms : [];
        setDormAssignments(dormList);

        if (dormList.length === 0) { setLoading(false); return; }

        const dormIds = dormList.map(d => d.dormitory_id);

        // Get student assignments in my dorms
        const allAssignments = await apiRequest<Assignment[]>("/boarding/assignments?is_active=true&limit=5000", { auth: "school" }).catch(() => [] as Assignment[]);
        const myStudentAssignments = (Array.isArray(allAssignments) ? allAssignments : []).filter(a => dormIds.includes(a.dormitory_id));
        setStudentAssignments(myStudentAssignments);

        const myStudentIds = new Set(myStudentAssignments.map(a => a.student_id));

        // Get leaves — filter to my students only
        const allLeaves = await leavesApi.list({ limit: "2000" }).then(r => Array.isArray(r) ? r : (r as any)?.data ?? []).catch(() => [] as LeaveRecord[]);
        const myLeaves = (Array.isArray(allLeaves) ? allLeaves : []).filter(l => myStudentIds.has(l.student_id));
        setLeaves(myLeaves);

        const onLeaveIds = new Set(myLeaves.filter(l =>
          l.leave_state === "outside_school" || (l.status === "approved" && !l.returned_at && l.start_date <= today && l.end_date >= today)
        ).map(l => l.student_id));

        const lateReturnIds = new Set(myLeaves.filter(l => l.late_return_flagged && l.leave_state === "outside_school").map(l => l.student_id));

        // Build per-dorm stats
        const stats = dormList.map(d => {
          const dormStudents = myStudentAssignments.filter(a => a.dormitory_id === d.dormitory_id).map(a => a.student_id);
          const onLeave = dormStudents.filter(id => onLeaveIds.has(id)).length;
          const lateReturn = dormStudents.filter(id => lateReturnIds.has(id)).length;
          const present = dormStudents.length - onLeave; // simplified — real value comes from attendance sessions
          return {
            id: d.dormitory_id,
            name: d.dormitory?.name ?? d.dormitory_id,
            total: dormStudents.length,
            onLeave,
            missing: 0, // will be populated from boarding attendance sessions when available
            lateReturn,
            diningMissing: 0,
          };
        });
        setDormStats(stats);
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [currentUser?.id, today]);

  const totals = dormStats.reduce((acc, d) => ({
    total: acc.total + d.total,
    onLeave: acc.onLeave + d.onLeave,
    missing: acc.missing + d.missing,
    lateReturn: acc.lateReturn + d.lateReturn,
  }), { total: 0, onLeave: 0, missing: 0, lateReturn: 0 });

  const pendingLeaves = leaves.filter(l => l.status === "pending" || l.leave_state === "requested");

  return (
    <PatronLayout title={`${greeting}, ${displayName}`} subtitle={dateLabel}>
      {/* No dorms assigned warning */}
      {!loading && dormAssignments.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-800 text-sm mb-5">
          <strong>No dormitories assigned to you yet.</strong> Contact the Director of Discipline to be assigned to dormitories.
        </div>
      )}

      {/* Overall stats */}
      {dormAssignments.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
            ) : (
              <>
                <StatBox label="My Boarding Students" value={totals.total} icon={<Users className="h-5 w-5" />} color="blue" />
                <StatBox label="On Leave" value={totals.onLeave} icon={<CalendarDays className="h-5 w-5" />} color="amber" />
                <StatBox label="Missing Attendance" value={totals.missing} icon={<UserX className="h-5 w-5" />} color="red" />
                <StatBox label="Late Returns" value={totals.lateReturn} icon={<Clock className="h-5 w-5" />} color="red" />
              </>
            )}
          </div>

          {/* Alerts */}
          {!loading && totals.missing > 0 && (
            <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-destructive text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {totals.missing} student{totals.missing !== 1 ? "s" : ""} have missing boarding attendance today.
              </div>
              <Link to="/patron/attendance" className="text-xs font-bold text-destructive hover:underline inline-flex items-center gap-1">
                View <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          )}

          {!loading && pendingLeaves.length > 0 && (
            <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-800 text-sm font-semibold">
                <CalendarDays className="h-4 w-4 shrink-0" />
                {pendingLeaves.length} leave request{pendingLeaves.length !== 1 ? "s" : ""} pending — awaiting DOD approval.
              </div>
              <Link to="/patron/leaves" className="text-xs font-bold text-amber-700 hover:underline inline-flex items-center gap-1">
                View <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Per-dormitory cards */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-lg">My Dormitories</h3>
                <Link to="/patron/dormitories" className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {loading ? (
                <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-20" />)}</div>
              ) : dormStats.length === 0 ? (
                <p className="text-sm text-muted-foreground">No dormitories assigned.</p>
              ) : (
                <div className="space-y-3">
                  {dormStats.map(d => (
                    <div key={d.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-semibold text-sm">{d.name}</span>
                        <span className="text-xs text-muted-foreground">{d.total} students</span>
                      </div>
                      <div className="flex gap-3 text-xs">
                        <span className="text-emerald-600">{d.total - d.onLeave} Inside</span>
                        <span className="text-amber-600">{d.onLeave} On Leave</span>
                        {d.missing > 0 && <span className="text-destructive font-bold">{d.missing} Missing</span>}
                        {d.lateReturn > 0 && <span className="text-destructive font-bold">{d.lateReturn} Late Return</span>}
                      </div>
                      {/* attendance progress bar */}
                      <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500"
                          style={{ width: d.total > 0 ? `${Math.round(((d.total - d.onLeave) / d.total) * 100)}%` : "0%" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-display font-bold text-lg mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { to: "/patron/attendance",  label: "Boarding Attendance", icon: UserCheck,    primary: true },
                  { to: "/patron/leaves",      label: "Leave Requests",      icon: CalendarDays, primary: false },
                  { to: "/patron/dormitories", label: "My Dormitories",      icon: Users,        primary: false },
                  { to: "/patron/assignments", label: "Assign Students",     icon: UserCheck,    primary: false },
                  { to: "/patron/dining",      label: "Dining Attendance",   icon: Utensils,     primary: false },
                ].map(({ to, label, icon: Icon, primary }) => (
                  <Link key={to} to={to}
                    className={`rounded-lg p-4 flex flex-col items-start gap-2 transition ${primary ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-border bg-card hover:bg-muted/40"}`}>
                    <Icon className="h-5 w-5" />
                    <span className="font-semibold text-sm leading-snug">{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </PatronLayout>
  );
}

function StatBox({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const colorMap: Record<string, string> = {
    blue: "text-blue-600 bg-blue-50 border-blue-200",
    amber: "text-amber-700 bg-amber-50 border-amber-200",
    red: "text-destructive bg-destructive/5 border-destructive/20",
    green: "text-emerald-600 bg-emerald-50 border-emerald-200",
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] ?? ""}`}>
      <div className="flex items-center gap-2 mb-2 opacity-70">{icon}<span className="text-xs font-semibold uppercase tracking-wide">{label}</span></div>
      <div className="font-display text-3xl font-bold">{value}</div>
    </div>
  );
}
