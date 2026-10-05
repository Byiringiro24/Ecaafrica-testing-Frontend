import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Download,
  RefreshCw,
  Search,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { exportToExcel } from "@/lib/exportExcel";
import { diningAttendanceReviewRouteGuard } from "@/lib/schoolAuth";

export const Route = createFileRoute("/attendance/dining-reports")({
  beforeLoad: ({ location }) => diningAttendanceReviewRouteGuard(location),
  component: DiningReports,
});

type MealType = "breakfast" | "lunch" | "dinner";
type GroupType = "boys" | "girls";
type Session = {
  id: string;
  meal_type: MealType;
  gender_group?: GroupType | null;
  session_date: string;
  opened_at?: string | null;
  closed_at?: string | null;
  marked_by_user?: { id?: string; name: string } | null;
  dormitory?: { id: string; name: string; hostel_name?: string | null } | null;
};
type Row = {
  student: { id: string; full_name: string; student_id_number?: string | null };
  attendance_status?: string | null;
  is_on_leave: boolean;
};
type Report = Session & { roster: Row[] };
type ApiList<T> = T[] | { data?: T[] };

type Status = "present" | "absent" | "on_leave";

const MEALS: Array<{ value: "all" | MealType; label: string }> = [
  { value: "all", label: "All meals" },
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
];

const GROUPS: Array<{ value: "all" | GroupType; label: string }> = [
  { value: "all", label: "All groups" },
  { value: "boys", label: "Boys" },
  { value: "girls", label: "Girls" },
];

const today = () => new Date().toISOString().slice(0, 10);
const labelCase = (value?: string | null) =>
  value ? value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Dining Hall";
const groupLabel = (value?: GroupType | null) =>
  value === "boys" ? "Boys" : value === "girls" ? "Girls" : "Dining Hall";
const rowStatus = (row: Row): Status =>
  row.is_on_leave || row.attendance_status === "on_leave"
    ? "on_leave"
    : row.attendance_status === "present"
      ? "present"
      : "absent";
const reportCounts = (report: Report) =>
  report.roster.reduce(
    (counts, row) => {
      counts[rowStatus(row)] += 1;
      return counts;
    },
    { present: 0, absent: 0, on_leave: 0 } as Record<Status, number>,
  );
const percent = (present: number, absent: number) => {
  const expected = present + absent;
  return expected ? `${Math.round((present / expected) * 100)}%` : "—";
};
const errorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return fallback;
};

function DiningReports() {
  const [date, setDate] = useState(today());
  const [meal, setMeal] = useState<"all" | MealType>("all");
  const [group, setGroup] = useState<"all" | GroupType>("all");
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ session_date: date, limit: "100" });
      if (meal !== "all") params.set("meal_type", meal);
      if (group !== "all") params.set("gender_group", group);

      const response = await apiRequest<ApiList<Session>>(
        `/boarding/dining/sessions?${params.toString()}`,
        {
          auth: "school",
        },
      );
      const sessions: Session[] = Array.isArray(response) ? response : (response.data ?? []);
      const submitted = sessions.filter((session) => session.closed_at);
      const reportRows = await Promise.all(
        submitted.map(async (session) => {
          const rosterResponse = await apiRequest<ApiList<Row>>(
            `/boarding/dining/sessions/${session.id}/roster`,
            { auth: "school" },
          );
          return {
            ...session,
            roster: Array.isArray(rosterResponse) ? rosterResponse : (rosterResponse.data ?? []),
          };
        }),
      );
      setReports(reportRows);
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Could not load dining reports"));
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [date, group, meal]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return reports;
    return reports.filter((report) => {
      const text = [
        report.meal_type,
        report.gender_group,
        report.marked_by_user?.name,
        report.dormitory?.name,
        ...report.roster.map(
          (row) => `${row.student.full_name} ${row.student.student_id_number ?? ""}`,
        ),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(query);
    });
  }, [reports, search]);

  const summary = useMemo(
    () =>
      filtered.reduce(
        (total, report) => {
          const counts = reportCounts(report);
          total.reports += 1;
          total.students += report.roster.length;
          total.present += counts.present;
          total.absent += counts.absent;
          total.on_leave += counts.on_leave;
          return total;
        },
        { reports: 0, students: 0, present: 0, absent: 0, on_leave: 0 },
      ),
    [filtered],
  );

  const summaryRows = useMemo(
    () =>
      filtered.map((report) => {
        const counts = reportCounts(report);
        return {
          meal: labelCase(report.meal_type),
          group: groupLabel(report.gender_group),
          dormitory: report.dormitory?.name ?? "All dormitories",
          teacher: report.marked_by_user?.name ?? "Teacher not recorded",
          students: report.roster.length,
          present: counts.present,
          absent: counts.absent,
          onLeave: counts.on_leave,
          attendanceRate: percent(counts.present, counts.absent),
          submitted: report.closed_at ? new Date(report.closed_at).toLocaleString() : "—",
        };
      }),
    [filtered],
  );

  const detailRows = useMemo(
    () =>
      filtered.flatMap((report) =>
        report.roster.map((row) => ({
          meal: labelCase(report.meal_type),
          group: groupLabel(report.gender_group),
          dormitory: report.dormitory?.name ?? "All dormitories",
          teacher: report.marked_by_user?.name ?? "Teacher not recorded",
          student: row.student.full_name,
          studentId: row.student.student_id_number ?? "—",
          status: labelCase(rowStatus(row)),
          submitted: report.closed_at ? new Date(report.closed_at).toLocaleString() : "—",
        })),
      ),
    [filtered],
  );

  const exportReport = async (kind: "summary" | "detail") => {
    if (!filtered.length) {
      toast.info("There are no submitted reports to export");
      return;
    }
    try {
      if (kind === "summary") {
        await exportToExcel(
          `dining-hall-summary-${date}.xlsx`,
          "Dining Summary",
          [
            { header: "Meal", key: "meal", width: 14 },
            { header: "Group", key: "group", width: 14 },
            { header: "Dormitory", key: "dormitory", width: 22 },
            { header: "Submitted By", key: "teacher", width: 24 },
            { header: "Students", key: "students", width: 12 },
            { header: "Present", key: "present", width: 12 },
            { header: "Absent", key: "absent", width: 12 },
            { header: "On Leave", key: "onLeave", width: 12 },
            { header: "Attendance Rate", key: "attendanceRate", width: 18 },
            { header: "Submitted", key: "submitted", width: 24 },
          ],
          summaryRows,
          `Dining Hall Summary — ${date}`,
        );
      } else {
        await exportToExcel(
          `dining-hall-detail-${date}.xlsx`,
          "Dining Attendance",
          [
            { header: "Meal", key: "meal", width: 14 },
            { header: "Group", key: "group", width: 14 },
            { header: "Dormitory", key: "dormitory", width: 22 },
            { header: "Submitted By", key: "teacher", width: 24 },
            { header: "Student", key: "student", width: 28 },
            { header: "Student ID", key: "studentId", width: 18 },
            { header: "Status", key: "status", width: 14 },
            { header: "Submitted", key: "submitted", width: 24 },
          ],
          detailRows,
          `Dining Hall Attendance — ${date}`,
        );
      }
      toast.success(`Dining ${kind} exported`);
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Export failed"));
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <ClipboardList className="mt-1 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h2 className="font-display text-lg font-bold">Submitted Dining Hall Reports</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Review meal attendance submitted by dining duty teachers and export a summary for
                the selected date.
              </p>
            </div>
          </div>
          <Link
            to="/attendance/dining-hall"
            className="inline-flex shrink-0 items-center rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold hover:bg-muted"
          >
            Back to Dining Hall
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Date</label>
            <input
              type="date"
              max={today()}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-1 block h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Meal</label>
            <select
              value={meal}
              onChange={(event) => setMeal(event.target.value as "all" | MealType)}
              className="mt-1 block h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {MEALS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Group</label>
            <select
              value={group}
              onChange={(event) => setGroup(event.target.value as "all" | GroupType)}
              className="mt-1 block h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {GROUPS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="relative min-w-64 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <label className="sr-only" htmlFor="dining-report-search">
              Search submitted reports
            </label>
            <input
              id="dining-report-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search student, meal, group or teacher"
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
            />
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => void exportReport("summary")}
            disabled={loading || !filtered.length}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export summary
          </button>
          <button
            onClick={() => void exportReport("detail")}
            disabled={loading || !filtered.length}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export detail
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryCard
          label="Reports"
          value={summary.reports}
          icon={<ClipboardList className="h-5 w-5" />}
        />
        <SummaryCard
          label="Students"
          value={summary.students}
          icon={<Users className="h-5 w-5" />}
        />
        <SummaryCard
          label="Present"
          value={summary.present}
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
        />
        <SummaryCard
          label="Absent"
          value={summary.absent}
          icon={<XCircle className="h-5 w-5 text-red-600" />}
        />
        <SummaryCard
          label="On leave"
          value={summary.on_leave}
          icon={<BarChart3 className="h-5 w-5 text-amber-600" />}
        />
      </div>

      <div className="rounded-xl border border-border bg-card px-5 py-3 text-sm text-muted-foreground">
        Overall attendance rate:{" "}
        <span className="font-bold text-foreground">
          {percent(summary.present, summary.absent)}
        </span>
        <span className="mx-2">·</span>
        Showing {filtered.length} submitted report{filtered.length === 1 ? "" : "s"} for {date}
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading submitted reports…
        </div>
      ) : !filtered.length ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No submitted Dining Hall reports match the selected filters.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((report) => {
            const counts = reportCounts(report);
            return (
              <section
                key={report.id}
                className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
                  <div>
                    <h3 className="font-display font-bold">
                      {labelCase(report.meal_type)} · {groupLabel(report.gender_group)}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Teacher:{" "}
                      <span className="font-semibold text-foreground">
                        {report.marked_by_user?.name ?? "Teacher not recorded"}
                      </span>
                      {report.dormitory?.name ? ` · ${report.dormitory.name}` : ""}
                      {report.closed_at ? ` · ${new Date(report.closed_at).toLocaleString()}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">
                      Present {counts.present}
                    </span>
                    <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-700">
                      Absent {counts.absent}
                    </span>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">
                      Leave {counts.on_leave}
                    </span>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                      Rate {percent(counts.present, counts.absent)}
                    </span>
                  </div>
                </div>
                <div className="max-h-96 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2">Student</th>
                        <th className="px-4 py-2">Student ID</th>
                        <th className="px-4 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.roster.map((row) => {
                        const status = rowStatus(row);
                        return (
                          <tr
                            key={row.student.id}
                            className="border-t border-border hover:bg-muted/20"
                          >
                            <td className="px-4 py-2 font-medium">{row.student.full_name}</td>
                            <td className="px-4 py-2 text-xs text-muted-foreground">
                              {row.student.student_id_number ?? "—"}
                            </td>
                            <td className="px-4 py-2">
                              <span
                                className={`rounded-full px-2 py-1 text-xs font-semibold ${status === "present" ? "bg-emerald-100 text-emerald-700" : status === "on_leave" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}
                              >
                                {labelCase(status)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 text-sm font-semibold text-muted-foreground">
        {label}
        {icon}
      </div>
      <div className="mt-2 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}
