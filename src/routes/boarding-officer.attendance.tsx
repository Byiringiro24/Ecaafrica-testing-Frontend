import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Search } from "lucide-react";
import { toast } from "sonner";
import { BoardingOfficerLayout } from "@/components/layout/BoardingOfficerLayout";
import { boardingOfficerRouteGuard } from "@/lib/schoolAuth";
import { Avatar } from "@/components/ui-kit/Avatar";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import {
  type ApiRecord,
  type ApiSession,
  type ApiStatus,
  type ApiStudent,
  type ClassRecord,
  type SectionRecord,
  type UiStatus,
  MANUAL_STATUS_CLASSES,
  STATUS_LABEL,
  formatLongDate,
  formatTime,
  nextManualStatus,
  todayIso,
} from "@/lib/gateKeeperAttendance";

export const Route = createFileRoute("/boarding-officer/attendance")({
  beforeLoad: ({ location }) => boardingOfficerRouteGuard(location),
  component: BoardingOfficerAttendancePage,
});

const PAGE_SIZE = 20;
const BOARDING_SESSION_TYPE = "boarding_morning";

type StudentAttendanceInfo = {
  status: ApiStatus;
  recordId: string;
  sessionId: string;
  submitted: boolean;
};

type HistoryRow = {
  id: string;
  studentName: string;
  cardId: string;
  className: string;
  timeIn: string;
  status: UiStatus;
  submitted: boolean;
};

function BoardingOfficerAttendancePage() {
  const todayValue = todayIso();
  const [tab, setTab] = useState<"record" | "history">("record");

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

  const [historyDate, setHistoryDate] = useState(todayValue);
  const [historyClassFilter, setHistoryClassFilter] = useState("All");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"All" | UiStatus>("All");
  const [historySearch, setHistorySearch] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySessions, setHistorySessions] = useState<ApiSession[]>([]);
  const [historyRecords, setHistoryRecords] = useState<ApiRecord[]>([]);
  const [studentsById, setStudentsById] = useState<Record<string, ApiStudent>>({});

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

  const isBoardingSession = (session?: ApiSession | null) =>
    session?.session_type === "boarding_morning" || session?.session_type === "boarding_evening";

  const loadBaseData = async () => {
    setLoading(true);
    try {
      const [classes, sections, studentList, sessionList, recordList] = await Promise.all([
        apiRequest<ClassRecord[]>("/classes?limit=200", { auth: "school" }),
        apiRequest<SectionRecord[]>("/sections?limit=200", { auth: "school" }),
        apiRequest<ApiStudent[]>("/students?student_type=boarding&limit=2000", { auth: "school" }),
        apiRequest<ApiSession[]>(`/attendance/sessions?date=${todayValue}&limit=500`, {
          auth: "school",
        }),
        apiRequest<ApiRecord[]>(`/attendance/records?date=${todayValue}&limit=5000`, {
          auth: "school",
        }),
      ]);

      setClassRecords(Array.isArray(classes) ? classes : []);
      setSectionRecords(Array.isArray(sections) ? sections : []);
      const boarders = Array.isArray(studentList) ? studentList : [];
      setStudents(boarders);
      const byId: Record<string, ApiStudent> = {};
      boarders.forEach((s) => {
        byId[s.id] = s;
      });
      setStudentsById(byId);
      setSessions(Array.isArray(sessionList) ? sessionList : []);
      setRecords(Array.isArray(recordList) ? recordList : []);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load boarding students");
    } finally {
      setLoading(false);
    }
  };

  const loadHistoryData = async (targetDate: string) => {
    if (targetDate > todayValue) {
      toast.error("Future dates are not allowed");
      return;
    }
    setHistoryLoading(true);
    try {
      const [sessionList, recordList] = await Promise.all([
        apiRequest<ApiSession[]>(`/attendance/sessions?date=${targetDate}&limit=500`, {
          auth: "school",
        }),
        apiRequest<ApiRecord[]>(`/attendance/records?date=${targetDate}&limit=5000`, {
          auth: "school",
        }),
      ]);
      setHistorySessions(Array.isArray(sessionList) ? sessionList : []);
      setHistoryRecords(Array.isArray(recordList) ? recordList : []);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load attendance history");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void loadBaseData();
  }, []);

  useEffect(() => {
    if (tab === "history") {
      void loadHistoryData(historyDate);
    }
  }, [tab, historyDate]);

  const boardingSessions = useMemo(
    () => sessions.filter(isBoardingSession),
    [sessions]
  );
  const sessionById = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);

  const studentAttendance = useMemo<Record<string, StudentAttendanceInfo>>(() => {
    const map: Record<string, StudentAttendanceInfo> = {};
    records.forEach((record) => {
      const session = sessionById.get(record.session_id);
      if (!isBoardingSession(session)) return;
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
    const result = { marked: 0, present: 0, absent: 0, late: 0, excused: 0 };
    filteredStudents.forEach((student) => {
      const info = studentAttendance[student.id];
      if (!info) return;
      result.marked += 1;
      if (info.status === "present") result.present += 1;
      if (info.status === "absent") result.absent += 1;
      if (info.status === "late") result.late += 1;
      if (info.status === "excused") result.excused += 1;
    });
    return result;
  }, [filteredStudents, studentAttendance]);

  const openSessionsWithRecords = useMemo(() => {
    const recordSessionIds = new Set(
      records.filter((r) => {
        const session = sessionById.get(r.session_id);
        return isBoardingSession(session);
      }).map((r) => r.session_id)
    );
    return boardingSessions.filter((s) => !s.submitted_at && recordSessionIds.has(s.id));
  }, [boardingSessions, records, sessionById]);

  const ensureSessionForSection = async (sectionId: string) => {
    const existing = boardingSessions.find(
      (s) => s.section_id === sectionId && !s.submitted_at
    );
    if (existing) return existing.id;

    const session = await apiRequest<ApiSession>("/attendance/sessions", {
      method: "POST",
      auth: "school",
      body: JSON.stringify({
        section_id: sectionId,
        session_date: todayValue,
        session_type: BOARDING_SESSION_TYPE,
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

      toast.success("Boarding attendance submitted successfully");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to submit attendance");
    } finally {
      setSubmitting(false);
    }
  };

  const historySessionMap = useMemo(
    () => new Map(historySessions.map((s) => [s.id, s])),
    [historySessions]
  );

  const historyRows = useMemo<HistoryRow[]>(() => {
    return historyRecords
      .filter((record) => {
        const session = historySessionMap.get(record.session_id);
        return isBoardingSession(session);
      })
      .map((record) => {
        const session = historySessionMap.get(record.session_id);
        const student = studentsById[record.student_id];
        const studentName = student
          ? `${student.first_name} ${student.last_name}`.trim()
          : "Unknown student";
        const sectionId = session?.section_id ?? student?.current_section?.id;
        return {
          id: record.id,
          studentName,
          cardId: student?.student_id_number ?? "—",
          className: classLabelForSection(sectionId),
          timeIn: formatTime(record.scanned_at ?? record.created_at, record.status),
          status: STATUS_LABEL[record.status],
          submitted: Boolean(session?.submitted_at),
        };
      });
  }, [historyRecords, historySessionMap, studentsById, classLabelForSection]);

  const filteredHistory = useMemo(() => {
    return historyRows.filter((row) => {
      const section = sectionRecords.find((s) => {
        const cls = classMap.get(s.class_id);
        const label = cls ? `${cls.name}${s.name}` : s.full_name || s.name;
        return label === row.className;
      });
      const matchesClass =
        historyClassFilter === "All" || section?.class_id === historyClassFilter;
      const matchesStatus = historyStatusFilter === "All" || row.status === historyStatusFilter;
      const target = `${row.studentName} ${row.cardId}`.toLowerCase();
      const matchesSearch =
        historySearch === "" || target.includes(historySearch.toLowerCase());
      return matchesClass && matchesStatus && matchesSearch;
    });
  }, [
    historyRows,
    historyClassFilter,
    historyStatusFilter,
    historySearch,
    sectionRecords,
    classMap,
  ]);

  const historyTotalPages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE));
  const historyPageItems = filteredHistory.slice(
    (historyPage - 1) * PAGE_SIZE,
    historyPage * PAGE_SIZE
  );

  useEffect(() => {
    setHistoryPage(1);
  }, [historyDate, historyClassFilter, historyStatusFilter, historySearch]);

  const clampHistoryDate = (value: string) => {
    if (value > todayValue) {
      toast.error("Future dates are not allowed");
      return todayValue;
    }
    return value;
  };

  return (
    <BoardingOfficerLayout
      title="Boarding Attendance"
      subtitle="Record and review attendance for boarding students only"
    >
      <div className="flex gap-1 border-b border-border mb-5">
        {(["record", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px capitalize ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "record" ? "Record Attendance" : "Attendance History"}
          </button>
        ))}
      </div>

      {tab === "record" ? (
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
                <h3 className="font-display font-bold">Boarding Students — {todayValue}</h3>
                <span className="text-xs text-muted-foreground">{filteredStudents.length} students</span>
              </div>

              {loading ? (
                <div className="p-6 space-y-3">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-4/5" />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                        <tr>
                          {["Student", "Class", "ID", "Status", "Action"].map((h) => (
                            <th key={h} className="text-left px-4 py-3">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pageItems.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                              No boarding students found.
                            </td>
                          </tr>
                        ) : (
                          pageItems.map((student) => {
                            const name = `${student.first_name} ${student.last_name}`.trim();
                            const info = studentAttendance[student.id];
                            const isMarking = markingStudentId === student.id;
                            return (
                              <tr
                                key={student.id}
                                className="border-t border-border odd:bg-background even:bg-muted/20"
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <Avatar name={name} size="sm" />
                                    <span className="font-medium">{name}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  {classLabelForSection(student.current_section?.id)}
                                </td>
                                <td className="px-4 py-3 font-mono text-xs">
                                  {student.student_id_number ?? "—"}
                                </td>
                                <td className="px-4 py-3">
                                  {info ? (
                                    <StatusBadge status={STATUS_LABEL[info.status]} />
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Not marked</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <button
                                    type="button"
                                    disabled={isMarking || info?.submitted}
                                    onClick={() => void markStudent(student)}
                                    className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold disabled:opacity-50 ${
                                      info
                                        ? MANUAL_STATUS_CLASSES[info.status]
                                        : "border-border hover:bg-muted"
                                    }`}
                                  >
                                    {isMarking ? "…" : info ? STATUS_LABEL[info.status] : "Mark"}
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  {totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-border flex justify-between text-xs">
                      <span>
                        Page {page} of {totalPages}
                      </span>
                      <div className="space-x-2">
                        <button
                          disabled={page <= 1}
                          onClick={() => setPage((p) => p - 1)}
                          className="px-2 py-1 rounded border disabled:opacity-50"
                        >
                          Prev
                        </button>
                        <button
                          disabled={page >= totalPages}
                          onClick={() => setPage((p) => p + 1)}
                          className="px-2 py-1 rounded border disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm h-fit">
              <h3 className="font-display font-bold mb-4">Today&apos;s Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Marked</span>
                  <span className="font-semibold">{counts.marked}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Present</span>
                  <span className="font-semibold text-success">{counts.present}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Absent</span>
                  <span className="font-semibold text-destructive">{counts.absent}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Late</span>
                  <span className="font-semibold text-amber-600">{counts.late}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Excused</span>
                  <span className="font-semibold text-blue-600">{counts.excused}</span>
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary inline mr-1" />
                Tap status buttons to cycle through Present → Absent → Late → Excused. Duplicate
                records for the same student on the same day are prevented automatically.
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-3 items-end mb-5">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Date</label>
              <input
                type="date"
                max={todayValue}
                value={historyDate}
                onChange={(e) => setHistoryDate(clampHistoryDate(e.target.value))}
                className="mt-1 h-9 block rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Class</label>
              <select
                value={historyClassFilter}
                onChange={(e) => setHistoryClassFilter(e.target.value)}
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
              <label className="text-xs font-semibold text-muted-foreground">Status</label>
              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value as "All" | UiStatus)}
                className="mt-1 h-9 block rounded-md border border-input bg-background px-3 text-sm min-w-32"
              >
                <option value="All">All</option>
                {(["Present", "Absent", "Late", "Excused"] as UiStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative flex-1 min-w-55">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search student…"
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-display font-bold">{formatLongDate(historyDate)}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {filteredHistory.length} boarding attendance record
                {filteredHistory.length === 1 ? "" : "s"}
              </p>
            </div>
            {historyLoading ? (
              <div className="p-6">
                <Skeleton className="h-6 w-full" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      {["Student", "Class", "ID", "Time", "Status", "Submitted"].map((h) => (
                        <th key={h} className="text-left px-4 py-3">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historyPageItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                          No boarding attendance records for this date.
                        </td>
                      </tr>
                    ) : (
                      historyPageItems.map((row) => (
                        <tr key={row.id} className="border-t border-border odd:bg-background even:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{row.studentName}</td>
                          <td className="px-4 py-3">{row.className}</td>
                          <td className="px-4 py-3 font-mono text-xs">{row.cardId}</td>
                          <td className="px-4 py-3">{row.timeIn}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={row.status} />
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {row.submitted ? "Yes" : "Draft"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {historyTotalPages > 1 && (
              <div className="px-4 py-3 border-t border-border flex justify-between text-xs">
                <span>
                  Page {historyPage} of {historyTotalPages}
                </span>
                <div className="space-x-2">
                  <button
                    disabled={historyPage <= 1}
                    onClick={() => setHistoryPage((p) => p - 1)}
                    className="px-2 py-1 rounded border disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    disabled={historyPage >= historyTotalPages}
                    onClick={() => setHistoryPage((p) => p + 1)}
                    className="px-2 py-1 rounded border disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </BoardingOfficerLayout>
  );
}
