import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ChevronLeft, ChevronRight, Send, Users, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { apiRequest } from "@/lib/api";
import { teacherRouteGuard } from "@/lib/schoolAuth";

export const Route = createFileRoute("/teacher/dining-attendance")({
  beforeLoad: ({ location }) => teacherRouteGuard(location),
  component: TeacherDiningAttendance,
});

type Assignment = { id: string; gender_group: "boys" | "girls" };
type Row = {
  student: {
    id: string;
    full_name: string;
    student_id_number?: string | null;
    class_name?: string | null;
  };
  is_on_leave: boolean;
  attendance_status?: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);

function TeacherDiningAttendance() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [group, setGroup] = useState<"boys" | "girls">("boys");
  const [meal, setMeal] = useState("lunch");
  const [date, setDate] = useState(today());
  const [session, setSession] = useState<any>();
  const [roster, setRoster] = useState<Row[]>([]);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    void apiRequest<any>(`/boarding/dining/assignments?date=${date}`, { auth: "school" })
      .then((value) => {
        const rows = Array.isArray(value) ? value : (value?.data ?? []);
        setAssignments(rows);
        if (rows[0]) setGroup(rows[0].gender_group);
      })
      .catch(() => setAssignments([]));
  }, [date]);

  const load = async () => {
    if (!assignments.some((assignment) => assignment.gender_group === group)) return;

    try {
      const found = await apiRequest<any>(
        `/boarding/dining/sessions?meal_type=${meal}&gender_group=${group}&session_date=${date}&limit=1`,
        { auth: "school" },
      );
      const sessions = Array.isArray(found) ? found : (found?.data ?? []);
      const existing = sessions[0];
      const current =
        existing ??
        (await apiRequest<any>("/boarding/dining/sessions", {
          method: "POST",
          auth: "school",
          body: JSON.stringify({ gender_group: group, meal_type: meal, session_date: date }),
        }));

      setSession(current);
      const data = await apiRequest<any>(`/boarding/dining/sessions/${current.id}/roster`, {
        auth: "school",
      });
      const rows: Row[] = Array.isArray(data) ? data : (data?.data ?? []);
      setRoster(rows);
      setPage(0);
      setMarks(
        Object.fromEntries(
          rows.map((row) => [
            row.student.id,
            row.attendance_status ?? (row.is_on_leave ? "on_leave" : "absent"),
          ]),
        ),
      );
    } catch (error: any) {
      toast.error(error?.message ?? "Could not load dining roster");
    }
  };

  const save = async (submit: boolean) => {
    if (!session || session.closed_at) return;
    setSaving(true);
    try {
      await apiRequest(`/boarding/dining/sessions/${session.id}/attendance`, {
        method: "POST",
        auth: "school",
        body: JSON.stringify({
          marks: Object.entries(marks).map(([student_id, status]) => ({ student_id, status })),
        }),
      });
      if (submit) {
        await apiRequest(`/boarding/dining/sessions/${session.id}/close`, {
          method: "POST",
          auth: "school",
        });
        setSession((current: any) =>
          current ? { ...current, closed_at: new Date().toISOString() } : current,
        );
      }
      toast.success(submit ? "Dining attendance submitted" : "Dining attendance saved");
    } catch (error: any) {
      toast.error(error?.message ?? "Could not save attendance");
    } finally {
      setSaving(false);
    }
  };

  const markAll = (status: "present" | "absent") => {
    setMarks(
      Object.fromEntries(
        roster.map((row) => [row.student.id, row.is_on_leave ? "on_leave" : status]),
      ),
    );
  };

  const assigned = assignments.some((assignment) => assignment.gender_group === group);
  const isSubmitted = Boolean(session?.closed_at);
  const present = roster.filter(
    (row) => !row.is_on_leave && marks[row.student.id] === "present",
  ).length;
  const absent = roster.filter(
    (row) => !row.is_on_leave && marks[row.student.id] !== "present",
  ).length;
  const onLeave = roster.filter((row) => row.is_on_leave).length;
  const pages = Math.max(1, Math.ceil(roster.length / pageSize));
  const visible = roster.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <TeacherLayout title="Dining Hall Attendance" subtitle="Mark the meal group assigned to you">
      <div className="space-y-5">
        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-display text-lg font-bold">Manual dining attendance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select Present or Absent for each student.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <select
              value={group}
              onChange={(event) => setGroup(event.target.value as "boys" | "girls")}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              {assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.gender_group}>
                  {assignment.gender_group === "boys" ? "Boys" : "Girls"}
                </option>
              ))}
            </select>
            <select
              value={meal}
              onChange={(event) => setMeal(event.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
            </select>
            <input
              type="date"
              max={today()}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            />
            <button
              type="button"
              onClick={() => void load()}
              disabled={!assigned}
              className="rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Load roster
            </button>
          </div>
        </div>

        {roster.length > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                  Present
                </div>
                <div className="mt-2 text-3xl font-bold text-emerald-800">{present}</div>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
                  <XCircle className="h-5 w-5" />
                  Absent
                </div>
                <div className="mt-2 text-3xl font-bold text-red-800">{absent}</div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                  <Users className="h-5 w-5" />
                  On leave
                </div>
                <div className="mt-2 text-3xl font-bold text-amber-800">{onLeave}</div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Users className="h-5 w-5" />
                  Total students
                </div>
                <div className="mt-2 text-3xl font-bold">{roster.length}</div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold">Student attendance list</span>
                  <button
                    type="button"
                    onClick={() => markAll("present")}
                    disabled={saving}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Mark all present
                  </button>
                  <button
                    type="button"
                    onClick={() => markAll("absent")}
                    disabled={saving}
                    className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Mark all absent
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void save(false)}
                    disabled={saving || isSubmitted}
                    className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    Save draft
                  </button>
                  <button
                    type="button"
                    onClick={() => void save(true)}
                    disabled={saving || isSubmitted}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    Submit
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Class</th>
                      <th className="px-4 py-3">Student ID</th>
                      <th className="px-4 py-3">Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((row) => {
                      const status = marks[row.student.id];
                      return (
                        <tr key={row.student.id} className="border-t">
                          <td className="px-4 py-3 font-medium">{row.student.full_name}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {row.student.class_name ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {row.student.student_id_number ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            {row.is_on_leave ? (
                              <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700">
                                On leave
                              </span>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setMarks((current) => ({
                                      ...current,
                                      [row.student.id]: "present",
                                    }))
                                  }
                                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold ${status === "present" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "text-muted-foreground hover:bg-muted"}`}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Present
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setMarks((current) => ({
                                      ...current,
                                      [row.student.id]: "absent",
                                    }))
                                  }
                                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold ${status !== "present" ? "border-red-500 bg-red-50 text-red-700" : "text-muted-foreground hover:bg-muted"}`}
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  Absent
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {roster.length > pageSize && (
                <div className="flex items-center justify-between border-t p-3">
                  <span className="text-xs text-muted-foreground">
                    Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, roster.length)}{" "}
                    of {roster.length}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(0, current - 1))}
                      disabled={page === 0}
                      className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs disabled:opacity-40"
                    >
                      <ChevronLeft className="h-3 w-3" />
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.min(pages - 1, current + 1))}
                      disabled={page >= pages - 1}
                      className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs disabled:opacity-40"
                    >
                      Next
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </TeacherLayout>
  );
}
