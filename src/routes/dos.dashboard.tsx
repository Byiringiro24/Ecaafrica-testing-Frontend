/**
 * Director of Studies Dashboard
 * Academic overview: attendance rates, exam results, class performance,
 * timetable coverage, teacher allocation.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Users, ClipboardCheck, GraduationCap, BookOpen,
  ArrowRight, TrendingUp, AlertTriangle, CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { DosLayout } from "@/components/layout/DosLayout";
import { directorOfStudiesRouteGuard } from "@/lib/schoolAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui-kit/StatCard";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/dos/dashboard")({
  beforeLoad: ({ location }) => directorOfStudiesRouteGuard(location),
  component: DosDashboard,
});

type ClassRecord = { id: string; name: string };
type StudentRecord = { id: string };
type ExamRecord = { id: string; status: string };
type AttSession = { id: string; session_date: string; submitted_at?: string | null };

function DosDashboard() {
  const currentUser = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalClasses: 0,
    totalStudents: 0,
    pendingExams: 0,
    submittedAttendanceToday: 0,
    totalSectionsToday: 0,
  });

  const today = new Date().toISOString().slice(0, 10);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const displayName = currentUser?.name?.split(" ").slice(0, 2).join(" ") ?? "Director";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [classes, students, exams, sessions] = await Promise.all([
          apiRequest<ClassRecord[]>("/classes?limit=200", { auth: "school" }).catch(() => []),
          apiRequest<StudentRecord[]>("/students?status=active&limit=1&page=1", { auth: "school" }).catch(() => []),
          apiRequest<ExamRecord[]>("/exams?limit=200", { auth: "school" }).catch(() => []),
          apiRequest<AttSession[]>(`/attendance/sessions?date=${today}&limit=500`, { auth: "school" }).catch(() => []),
        ]);

        const examList = Array.isArray(exams) ? exams : [];
        const sessionList = Array.isArray(sessions) ? sessions : [];
        const submitted = sessionList.filter(s => s.submitted_at).length;

        setStats({
          totalClasses: (Array.isArray(classes) ? classes : []).length,
          totalStudents: (Array.isArray(students) ? students : []).length,
          pendingExams: examList.filter(e => e.status === "draft" || e.status === "scheduled").length,
          submittedAttendanceToday: submitted,
          totalSectionsToday: sessionList.length,
        });
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [today]);

  const attRate = stats.totalSectionsToday > 0
    ? Math.round((stats.submittedAttendanceToday / stats.totalSectionsToday) * 100)
    : 0;

  return (
    <DosLayout title={`${greeting}, ${displayName}`} subtitle={dateLabel}>
      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <StatCard label="Total Classes"       value={stats.totalClasses}    icon={<BookOpen className="h-5 w-5" />}      tone="primary" />
            <StatCard label="Active Students"     value={stats.totalStudents}   icon={<Users className="h-5 w-5" />}         tone="secondary" />
            <StatCard label="Attendance Submitted" value={`${stats.submittedAttendanceToday}/${stats.totalSectionsToday}`} icon={<ClipboardCheck className="h-5 w-5" />} tone={attRate < 70 ? "destructive" : "success"} trend={`${attRate}% coverage today`} />
            <StatCard label="Pending Exams"       value={stats.pendingExams}    icon={<GraduationCap className="h-5 w-5" />} tone="warning" />
          </>
        )}
      </div>

      {/* Alerts */}
      {!loading && attRate < 70 && stats.totalSectionsToday > 0 && (
        <div className="mb-5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-destructive text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Only {attRate}% of today's class attendance has been submitted — teachers need to complete their registers.
          </div>
          <Link to="/dos/attendance" className="text-xs font-bold text-destructive hover:underline inline-flex items-center gap-1">
            View <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Quick Actions */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-display font-bold text-lg mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { to: "/dos/attendance", label: "Class Attendance",   icon: ClipboardCheck, primary: true },
              { to: "/dos/timetable",  label: "Timetable",          icon: CalendarDays,   primary: false },
              { to: "/dos/exams",      label: "Exams & Results",    icon: GraduationCap,  primary: false },
              { to: "/dos/classes",    label: "Classes & Subjects", icon: BookOpen,       primary: false },
              { to: "/dos/staff",      label: "Teaching Staff",     icon: Users,          primary: false },
              { to: "/dos/reports",    label: "Academic Reports",   icon: TrendingUp,     primary: false },
            ].map(({ to, label, icon: Icon, primary }) => (
              <Link key={to} to={to}
                className={`rounded-lg p-4 flex flex-col items-start gap-2 transition ${primary ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-border bg-card hover:bg-muted/40"}`}>
                <Icon className="h-5 w-5" />
                <span className="font-semibold text-sm leading-snug">{label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Academic Summary */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-display font-bold text-lg mb-4">Today's Academic Summary</h3>
          {loading ? <Skeleton className="h-40" /> : (
            <div className="space-y-3">
              <SummaryRow
                label="Attendance Submission Rate"
                value={`${attRate}%`}
                color={attRate >= 80 ? "emerald" : attRate >= 60 ? "amber" : "red"}
                bar={attRate}
              />
              <SummaryRow
                label="Classes Registered"
                value={String(stats.totalClasses)}
                color="blue"
                bar={100}
              />
              <div className="pt-2 border-t border-border">
                <Link to="/dos/reports" className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1">
                  View full academic report <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </DosLayout>
  );
}

function SummaryRow({ label, value, color, bar }: { label: string; value: string; color: string; bar: number }) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-500", amber: "bg-amber-500", red: "bg-destructive", blue: "bg-primary",
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-1 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-bold">{value}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colors[color] ?? colors.blue}`} style={{ width: `${Math.min(bar, 100)}%` }} />
      </div>
    </div>
  );
}
