import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Search } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui-kit/Avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import {
  type ApiRecord,
  type ApiSession,
  type ApiStatus,
  type ApiStudent,
  type ClassRecord,
  type SectionRecord,
  MANUAL_STATUS_CLASSES,
  STATUS_LABEL,
  nextManualStatus,
  todayIso,
} from "@/lib/gateKeeperAttendance";

export const Route = createFileRoute("/gate-keeper/attendance/make-attendance")({
  component: MakeAttendancePage,
});

const PAGE_SIZE = 20;

type StudentAttendanceInfo = {
  status: ApiStatus;
  recordId: string;
  sessionId: string;
  submitted: boolean;
};

function MakeAttendancePage() {
  const todayValue = todayIso();
  const [classRecords, setClassRecords] = useState<ClassRecord[]>([]);
  const [sectionRecords, setSectionRecords] = useState<SectionRecord[]>([]);
  const [students, setStudents] = useState<ApiStudent[]>([]);
  const [sessions, setSessions] = useState<ApiSession[]>([]);
  const [records, setRecords] = useState<ApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [markingStudentId, setMarkingStudentId] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState("All");
  const [sectionFilter, setSectionFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const classMap = useMemo(
    () => new Map(classRecords.map((item) => [item.id, item])),
    [classRecords]
  );

  const sectionMap = useMemo(
    () => new Map(sectionRecords.map((item) => [item.id, item])),
    [sectionRecords]
  );

  const classLabelForSection = useCallback(
    (sectionId?: string) => {
      if (!sectionId) return "—";
      const section = sectionMap.get(sectionId);
      if (!section) return "—";
      const cls = classMap.get(section.class_id);
      if (cls) return `${cls.name}${section.name}`;
      return section.full_name || section.name;
    },
    [classMap, sectionMap]
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [classes, sections, studentList, sessionList, recordList] = await Promise.all([
        apiRequest<ClassRecord[]>("/classes?limit=200", { auth: "school" }),
        apiRequest<SectionRecord[]>("/sections?limit=200", { auth: "school" }),
        apiRequest<ApiStudent[]>("/students?limit=2000", { auth: "school" }),
        apiRequest<ApiSession[]>(`/attendance/sessions?date=${todayValue}&limit=500`, {
          auth: "school",
        }),
        apiRequest<ApiRecord[]>(`/attendance/records?date=${todayValue}&limit=5000`, {
          auth: "school",
        }),
      ]);

      setClassRecords(Array.isArray(classes) ? classes : []);
      setSectionRecords(Array.isArray(sections) ? sections : []);
      setStudents(Array.isArray(studentList) ? studentList : []);
      setSessions(Array.isArray(sessionList) ? sessionList : []);
      setRecords(Array.isArray(recordList) ? recordList : []);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const sessionById = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);

  const studentAttendance = useMemo<Record<string, StudentAttendanceInfo>>(() => {
    const map: Record<string, StudentAttendanceInfo> = {};
    records.forEach((record) => {
      const session = sessionById.get(record.session_id);
      map[record.student_id] = {
        status: record.status,
        recordId: record.id,
        sessionId: record.session_id,
        submitted: Boolean(session?.submitted_at),
      };
    });
    return map;
  }, [records, sessionById]);

  const sectionOptions = useMemo(() => {
    if (classFilter === "All") return sectionRecords;
    return sectionRecords.filter((section) => section.class_id === classFilter);
  }, [sectionRecords, classFilter]);

  useEffect(() => {
    if (sectionFilter !== "All" && !sectionOptions.some((s) => s.id === sectionFilter)) {
      setSectionFilter("All");
    }
  }, [sectionFilter, sectionOptions]);

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const sectionId = student.current_section?.id;
      const classId = student.current_section?.class_id;

      if (classFilter !== "All" && classId !== classFilter) return false;
      if (sectionFilter !== "All" && sectionId !== sectionFilter) return false;

      if (!search.trim()) return true;
      const needle = search.toLowerCase();
      const name = `${student.first_name} ${student.last_name}`.toLowerCase();
      return (
        name.includes(needle) ||
        (student.student_id_number ?? "").toLowerCase().includes(needle)
      );
    });
  }, [students, classFilter, sectionFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const pageItems = filteredStudents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [classFilter, sectionFilter, search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const counts = useMemo(() => {
    const result = { marked: 0, present: 0, absent: 0, late: 0, excused: 0, submitted: 0 };
    filteredStudents.forEach((student) => {
      const info = studentAttendance[student.id];
      if (!info) return;
      result.marked += 1;
      if (info.submitted) result.submitted += 1;
      if (info.status === "present") result.present += 1;
      if (info.status === "absent") result.absent += 1;
      if (info.status === "late") result.late += 1;
      if (info.status === "excused") result.excused += 1;
    });
    return result;
  }, [filteredStudents, studentAttendance]);

  const openSessionsWithRecords = useMemo(() => {
    const recordSessionIds = new Set(records.map((r) => r.session_id));
    return sessions.filter((s) => !s.submitted_at && recordSessionIds.has(s.id));
  }, [sessions, records]);

  const ensureSessionForSection = async (sectionId: string) => {
    const existing = sessions.find((s) => s.section_id === sectionId && !s.submitted_at);
    if (existing) return existing.id;

    const session = await apiRequest<ApiSession>("/attendance/sessions", {
      method: "POST",
      auth: "school",
      body: JSON.stringify({
        section_id: sectionId,
        session_date: todayValue,
        session_type: "gate",
        started_at: new Date().toISOString(),
      }),
    });

    setSessions((prev) => [...prev, session]);
    return session.id;
  };

  const markStudent = async (student: ApiStudent) => {
    const sectionId = student.current_section?.id;
    if (!sectionId) {
      toast.error("Student has no class assignment");
      return;
    }

    const existing = studentAttendance[student.id];
    if (existing?.submitted) {
      toast.error("Attendance already submitted for this student");
      return;
    }

    const nextStatus = nextManualStatus(existing?.status);
    setMarkingStudentId(student.id);

    try {
      const sessionId = existing?.sessionId ?? (await ensureSessionForSection(sectionId));
      const updated = await apiRequest<ApiRecord>("/attendance/records", {
        method: "POST",
        auth: "school",
        body: JSON.stringify({
          session_id: sessionId,
          student_id: student.id,
          status: nextStatus,
          scan_method: "manual",
        }),
      });

      setRecords((prev) => {
        const index = prev.findIndex(
          (record) =>
            record.id === updated.id ||
            (record.session_id === updated.session_id && record.student_id === updated.student_id)
        );
        if (index === -1) return [updated, ...prev];
        const next = [...prev];
        next[index] = updated;
        return next;
      });

      toast.success(`Marked ${STATUS_LABEL[nextStatus]}`);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to mark attendance");
    } finally {
      setMarkingStudentId(null);
    }
  };

  const submitAttendance = async () => {
    if (openSessionsWithRecords.length === 0) {
      toast.error("No attendance records to submit");
      return;
    }

    setSubmitting(true);
    try {
      const closed = await Promise.all(
        openSessionsWithRecords.map((session) =>
          apiRequest<ApiSession>(`/attendance/sessions/${session.id}/close`, {
            method: "PATCH",
            auth: "school",
            body: JSON.stringify({}),
          })
        )
      );

      setSessions((prev) => {
        const closedMap = new Map(closed.map((s) => [s.id, s]));
        return prev.map((session) => closedMap.get(session.id) ?? session);
      });

      toast.success("Attendance submitted successfully");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to submit attendance");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-3 items-end mb-5">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Class</label>
          <select
            value={classFilter}
            onChange={(event) => setClassFilter(event.target.value)}
            className="mt-1 h-9 block rounded-md border border-input bg-background px-3 text-sm min-w-36"
          >
            <option value="All">All Classes</option>
            {classRecords.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Section</label>
          <select
            value={sectionFilter}
            onChange={(event) => setSectionFilter(event.target.value)}
            className="mt-1 h-9 block rounded-md border border-input bg-background px-3 text-sm min-w-36"
          >
            <option value="All">All Sections</option>
            {sectionOptions.map((section) => {
              const cls = classMap.get(section.class_id);
              const label = cls ? `${cls.name}${section.name}` : section.full_name || section.name;
              return (
                <option key={section.id} value={section.id}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>
        <div className="relative flex-1 min-w-55">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search student name or ID…"
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={submitAttendance}
          disabled={submitting || openSessionsWithRecords.length === 0}
          className="h-9 px-4 rounded-md bg-success text-success-foreground text-sm font-semibold hover:bg-success/90 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit Attendance"}
        </button>
      </div>

      <div className="grid lg:grid-cols-[1.6fr_0.9fr] gap-5">
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-display font-bold">Student Attendance — {todayValue}</h3>
            <span className="text-xs text-muted-foreground">{filteredStudents.length} students</span>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-4/5" />
              <Skeleton className="h-6 w-3/5" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-5 py-3">#</th>
                      <th className="text-left px-5 py-3">Student</th>
                      <th className="text-left px-5 py-3">Card ID</th>
                      <th className="text-left px-5 py-3">Class</th>
                      <th className="text-left px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((student, index) => {
                      const info = studentAttendance[student.id];
                      const status = info?.status;
                      const label = status ? STATUS_LABEL[status] : "Mark";
                      const isSubmitted = Boolean(info?.submitted);
                      const isMarking = markingStudentId === student.id;

                      return (
                        <tr
                          key={student.id}
                          className="border-t border-border odd:bg-background even:bg-muted/20"
                        >
                          <td className="px-5 py-3 text-muted-foreground">
                            {(page - 1) * PAGE_SIZE + index + 1}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar
                                name={`${student.first_name} ${student.last_name}`}
                                size="sm"
                              />
                              <span className="font-medium">
                                {student.first_name} {student.last_name}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                            {student.student_id_number ?? "—"}
                          </td>
                          <td className="px-5 py-3">
                            {classLabelForSection(student.current_section?.id)}
                          </td>
                          <td className="px-5 py-3">
                            {isSubmitted ? (
                              <span
                                className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                                  status ? MANUAL_STATUS_CLASSES[status] : ""
                                }`}
                              >
                                {label} · Submitted
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={isMarking}
                                onClick={() => void markStudent(student)}
                                className={`text-xs font-semibold px-2.5 py-1 rounded-full border disabled:opacity-50 ${
                                  status
                                    ? MANUAL_STATUS_CLASSES[status]
                                    : "bg-muted text-muted-foreground border-border"
                                }`}
                              >
                                {isMarking ? "Saving…" : label}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {pageItems.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                          No students match your filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {filteredStudents.length > 0 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border text-sm">
                  <span className="text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <div className="space-x-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 rounded-md border border-border disabled:opacity-50 hover:bg-muted"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1.5 rounded-md border border-border disabled:opacity-50 hover:bg-muted"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm h-fit lg:sticky lg:top-24">
          <div className="text-xs uppercase text-muted-foreground">Today&apos;s Summary</div>
          <div className="font-display text-lg font-bold">{todayValue}</div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-success/10 p-2">
              <div className="text-2xl font-bold text-success">{counts.present}</div>
              <div className="text-[10px] uppercase text-success">Present</div>
            </div>
            <div className="rounded-lg bg-destructive/10 p-2">
              <div className="text-2xl font-bold text-destructive">{counts.absent}</div>
              <div className="text-[10px] uppercase text-destructive">Absent</div>
            </div>
            <div className="rounded-lg bg-amber-50 p-2">
              <div className="text-2xl font-bold text-amber-600">{counts.late}</div>
              <div className="text-[10px] uppercase text-amber-700">Late</div>
            </div>
            <div className="rounded-lg bg-blue-50 p-2">
              <div className="text-2xl font-bold text-blue-600">{counts.excused}</div>
              <div className="text-[10px] uppercase text-blue-700">Excused</div>
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground space-y-1">
            <div>
              {counts.marked} of {filteredStudents.length} marked in current view
            </div>
            <div>{counts.submitted} submitted (read-only)</div>
            <div>{openSessionsWithRecords.length} open session(s) pending submission</div>
          </div>
          <button
            type="button"
            onClick={submitAttendance}
            disabled={submitting || openSessionsWithRecords.length === 0}
            className="mt-4 w-full h-10 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50"
          >
            Submit Attendance
          </button>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Tap a student status to cycle Present → Absent → Late → Excused. Submit to finalize —
            submitted records cannot be edited.
          </p>
        </div>
      </div>

      {!loading && students.length === 0 && (
        <div className="mt-5 rounded-xl border border-dashed border-border p-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No students found for this school.</p>
        </div>
      )}
    </>
  );
}
