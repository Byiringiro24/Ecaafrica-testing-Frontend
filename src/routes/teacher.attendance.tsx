import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Search } from "lucide-react";
import { toast } from "sonner";
import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { Avatar } from "@/components/ui-kit/Avatar";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/teacher/attendance")({ component: TeacherAttendance });

type UiStatus = "Present" | "Absent" | "Late" | "Excused";
type ApiStatus = "present" | "absent" | "late" | "excused";

type ClassRecord = {
  id: string;
  name: string;
  level: number;
  academic_year_id?: string | null;
};

type SectionRecord = {
  id: string;
  name: string;
  full_name: string;
  class_id: string;
};

type ApiStudent = {
  id: string;
  first_name: string;
  last_name: string;
  student_id_number?: string | null;
  student_type?: "boarding" | "day";
  current_section?: { name: string; full_name: string } | null;
};

type ApiSession = {
  id: string;
  section_id: string;
  session_date: string;
  session_type?: string | null;
};

type ApiRecord = {
  id: string;
  session_id: string;
  student_id: string;
  status: ApiStatus;
  scan_method?: string | null;
  scanned_at?: string | null;
  created_at?: string | null;
};

type AttendanceRow = {
  id: string;
  studentId: string;
  studentName: string;
  cardId: string;
  className: string;
  timeIn: string;
  status: UiStatus;
  sessionId: string;
  sectionId: string;
};

const STATUS_LABEL: Record<ApiStatus, UiStatus> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  excused: "Excused"
};

const STATUS_TO_API: Record<UiStatus, ApiStatus> = {
  Present: "present",
  Absent: "absent",
  Late: "late",
  Excused: "excused"
};

const MANUAL_STATUS_CLASSES: Record<ApiStatus, string> = {
  present: "bg-success/15 text-success border-success/30",
  absent: "bg-destructive/15 text-destructive border-destructive/30",
  late: "bg-amber-100 text-amber-700 border-amber-200",
  excused: "bg-blue-100 text-blue-700 border-blue-200"
};

const formatLongDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
};

const formatTime = (value?: string | null, status?: ApiStatus) => {
  if (!value || status === "absent") return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
};

const nextManualStatus = (current?: ApiStatus) => {
  const order: ApiStatus[] = ["present", "absent", "late", "excused"];
  if (!current) return order[0];
  const idx = order.indexOf(current);
  return order[(idx + 1) % order.length];
};

function TeacherAttendance() {
  const todayValue = new Date().toISOString().slice(0, 10);
  const [tab, setTab] = useState<"live" | "manual">("live");
  const [classRecords, setClassRecords] = useState<ClassRecord[]>([]);
  const [sectionRecords, setSectionRecords] = useState<SectionRecord[]>([]);
  const [studentsById, setStudentsById] = useState<Record<string, ApiStudent>>({});
  const [sessions, setSessions] = useState<ApiSession[]>([]);
  const [records, setRecords] = useState<ApiRecord[]>([]);
  const [dateFilter, setDateFilter] = useState(todayValue);
  const [sectionFilter, setSectionFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const [manualSectionId, setManualSectionId] = useState("");
  const [manualDate, setManualDate] = useState(todayValue);
  const [manualStudents, setManualStudents] = useState<ApiStudent[]>([]);
  const [manualMarks, setManualMarks] = useState<Record<string, ApiStatus>>({});
  const [manualLoaded, setManualLoaded] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const [manualSessionId, setManualSessionId] = useState<string | null>(null);

  const classMap = useMemo(() => new Map(classRecords.map((item) => [item.id, item])), [classRecords]);
  const sectionMap = useMemo(() => new Map(sectionRecords.map((item) => [item.id, item])), [sectionRecords]);

  const classOptions = useMemo(() => {
    return sectionRecords.map((section) => {
      const cls = classMap.get(section.class_id);
      const label = cls ? `${cls.name}${section.name}` : section.full_name || section.name;
      return { id: section.id, label };
    });
  }, [sectionRecords, classMap]);

  const classLabelForSection = (sectionId?: string) => {
    if (!sectionId) return "--";
    const section = sectionMap.get(sectionId);
    if (!section) return "--";
    const cls = classMap.get(section.class_id);
    if (cls) return `${cls.name}${section.name}`;
    return section.full_name || section.name;
  };

  const mergeStudents = (items: ApiStudent[]) => {
    if (!items.length) return;
    setStudentsById((prev) => {
      const next = { ...prev };
      items.forEach((student) => {
        next[student.id] = student;
      });
      return next;
    });
  };

  const loadClassData = async () => {
    setLoading(true);
    try {
      const [classes, sections] = await Promise.all([
        apiRequest<ClassRecord[]>("/classes?limit=200", { auth: "school" }),
        apiRequest<SectionRecord[]>("/sections?limit=200", { auth: "school" })
      ]);
      setClassRecords(classes);
      setSectionRecords(sections);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load classes");
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentsForSection = async (sectionId: string) => {
    if (!sectionId) return;
    try {
      const students = await apiRequest<ApiStudent[]>(
        `/students?section_id=${sectionId}&limit=1000`,
        { auth: "school" }
      );
      mergeStudents(students);
    } catch {
      // Ignore failures here; manual load will retry and show toast
    }
  };

  const loadAttendanceData = async (targetDate: string, targetSectionId: string) => {
    if (!targetSectionId) return;
    setRecordsLoading(true);
    try {
      const sessionList = await apiRequest<ApiSession[]>(
        `/attendance/sessions?date=${targetDate}&section_id=${targetSectionId}&limit=200`,
        { auth: "school" }
      );
      setSessions(sessionList);

      if (sessionList.length === 0) {
        setRecords([]);
      } else {
        const recordBatches = await Promise.all(
          sessionList.map((session) =>
            apiRequest<ApiRecord[]>(`/attendance/records?session_id=${session.id}&limit=2000`, {
              auth: "school"
            }).catch(() => [])
          )
        );
        setRecords(recordBatches.flat());
      }

      await fetchStudentsForSection(targetSectionId);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load attendance records");
    } finally {
      setRecordsLoading(false);
    }
  };

  const loadManualStudents = async () => {
    if (!manualSectionId) {
      toast.error("Select a class first");
      return;
    }

    setManualLoading(true);
    setManualLoaded(false);
    try {
      const [students, existingSessions] = await Promise.all([
        apiRequest<ApiStudent[]>(`/students?section_id=${manualSectionId}&limit=500`, {
          auth: "school"
        }),
        apiRequest<ApiSession[]>(
          `/attendance/sessions?section_id=${manualSectionId}&date=${manualDate}&limit=1`,
          { auth: "school" }
        )
      ]);

      mergeStudents(students);
      setManualStudents(students);

      const existingSession = existingSessions[0] ?? null;
      setManualSessionId(existingSession?.id ?? null);

      if (existingSession) {
        const existingRecords = await apiRequest<ApiRecord[]>(
          `/attendance/records?session_id=${existingSession.id}&limit=2000`,
          { auth: "school" }
        );
        const nextMarks: Record<string, ApiStatus> = {};
        existingRecords.forEach((record) => {
          nextMarks[record.student_id] = record.status;
        });
        setManualMarks(nextMarks);
      } else {
        setManualMarks({});
      }

      setManualLoaded(true);
      toast.success(`Loaded ${students.length} students`);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load students");
    } finally {
      setManualLoading(false);
    }
  };

  const manualAllMarked =
    manualStudents.length > 0 && manualStudents.every((student) => manualMarks[student.id]);

  const submitManualAttendance = async () => {
    if (!manualSectionId) {
      toast.error("Select a class first");
      return;
    }

    if (!manualAllMarked) {
      toast.error("Mark all students before saving");
      return;
    }

    setManualSaving(true);
    try {
      let sessionId = manualSessionId;
      if (!sessionId) {
        const session = await apiRequest<ApiSession>("/attendance/sessions", {
          method: "POST",
          auth: "school",
          body: JSON.stringify({
            section_id: manualSectionId,
            session_date: manualDate,
            session_type: "class",
            started_at: new Date().toISOString()
          })
        });
        sessionId = session.id;
        setManualSessionId(sessionId);
      }

      const payload = manualStudents.map((student) => ({
        student_id: student.id,
        status: manualMarks[student.id]
      }));

      await apiRequest("/attendance/records/bulk", {
        method: "POST",
        auth: "school",
        body: JSON.stringify({
          session_id: sessionId,
          scan_method: "manual",
          records: payload
        })
      });

      toast.success("Attendance saved");
      setDateFilter(manualDate);
      setSectionFilter(manualSectionId);
      await loadAttendanceData(manualDate, manualSectionId);
      setTab("live");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to save attendance");
    } finally {
      setManualSaving(false);
    }
  };

  useEffect(() => {
    loadClassData();
  }, []);

  useEffect(() => {
    if (!sectionFilter && classOptions.length) {
      setSectionFilter(classOptions[0].id);
    }
    if (!manualSectionId && classOptions.length) {
      setManualSectionId(classOptions[0].id);
    }
  }, [classOptions, sectionFilter, manualSectionId]);

  useEffect(() => {
    if (sectionFilter) {
      loadAttendanceData(dateFilter, sectionFilter);
    }
  }, [dateFilter, sectionFilter]);

  useEffect(() => {
    setManualSessionId(null);
    setManualLoaded(false);
  }, [manualSectionId, manualDate]);

  const todayLabel = useMemo(() => formatLongDate(dateFilter), [dateFilter]);

  const sessionMap = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);

  const rows = useMemo<AttendanceRow[]>(() => {
    return records.map((record) => {
      const session = sessionMap.get(record.session_id);
      const sectionId = session?.section_id ?? "";
      const student = studentsById[record.student_id];
      const studentName = student
        ? `${student.first_name} ${student.last_name}`.trim()
        : "Unknown student";
      const cardId = student?.student_id_number ?? "--";
      const status = STATUS_LABEL[record.status];
      const timeIn = formatTime(record.scanned_at ?? record.created_at, record.status);
      const className = classLabelForSection(sectionId);

      return {
        id: record.id,
        studentId: record.student_id,
        studentName,
        cardId,
        className,
        timeIn,
        status,
        sessionId: record.session_id,
        sectionId
      };
    });
  }, [records, sessionMap, studentsById, classMap, sectionMap]);

  const counts = useMemo(() => {
    return records.reduce(
      (acc, record) => {
        acc.total += 1;
        if (record.status === "present") acc.present += 1;
        if (record.status === "absent") acc.absent += 1;
        if (record.status === "late") acc.late += 1;
        if (record.status === "excused") acc.excused += 1;
        return acc;
      },
      { total: 0, present: 0, absent: 0, late: 0, excused: 0 }
    );
  }, [records]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const target = search.toLowerCase();
    return rows.filter((row) =>
      `${row.studentName} ${row.cardId}`.toLowerCase().includes(target)
    );
  }, [rows, search]);

  const manualFiltered = useMemo(() => {
    if (!manualSearch) return manualStudents;
    const target = manualSearch.toLowerCase();
    return manualStudents.filter((student) => {
      const name = `${student.first_name} ${student.last_name}`.toLowerCase();
      return (
        name.includes(target) ||
        (student.student_id_number ?? "").toLowerCase().includes(target)
      );
    });
  }, [manualStudents, manualSearch]);

  const manualCounts = useMemo(() => {
    const result = { total: manualStudents.length, present: 0, absent: 0, late: 0, excused: 0 };
    manualStudents.forEach((student) => {
      const status = manualMarks[student.id];
      if (!status) return;
      if (status === "present") result.present += 1;
      if (status === "absent") result.absent += 1;
      if (status === "late") result.late += 1;
      if (status === "excused") result.excused += 1;
    });
    return result;
  }, [manualStudents, manualMarks]);

  return (
    <TeacherLayout title="Attendance" subtitle="Live attendance and manual entry">
      <div className="flex gap-1 border-b border-border mb-5">
        {(["live", "manual"] as const).map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 ${
              tab === item
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            {item === "live" ? "Live Attendance" : "Manual Attendance"}
          </button>
        ))}
      </div>

      {tab === "live" && (
        <>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-3 items-center">
            <input
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            />
            <select
              value={sectionFilter}
              onChange={(event) => setSectionFilter(event.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
              disabled={loading}
            >
              {classOptions.length === 0 && (
                <option value="">No classes yet</option>
              )}
              {classOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <div className="relative flex-1 min-w-52">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name..."
                className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
              />
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex flex-wrap gap-2 items-center justify-between">
              <h3 className="font-display font-bold">Attendance - {todayLabel}</h3>
              <div className="text-xs text-muted-foreground space-x-3">
                <span>Total: <b className="text-foreground">{counts.total}</b></span>
                <span>Present: <b className="text-success">{counts.present}</b></span>
                <span>Absent: <b className="text-destructive">{counts.absent}</b></span>
                <span>Late: <b className="text-amber-600">{counts.late}</b></span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-5 py-3">#</th>
                    <th className="text-left px-5 py-3">Student</th>
                    <th className="text-left px-5 py-3">Card ID</th>
                    <th className="text-left px-5 py-3">Class</th>
                    <th className="text-left px-5 py-3">Time In</th>
                    <th className="text-left px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recordsLoading && (
                    <tr>
                      <td colSpan={6} className="px-5 py-6">
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  )}
                  {!recordsLoading && filtered.map((row, i) => (
                    <tr key={row.id} className="border-t border-border odd:bg-background even:bg-muted/20">
                      <td className="px-5 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={row.studentName} size="sm" />
                          <span className="font-medium">{row.studentName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{row.cardId}</td>
                      <td className="px-5 py-3">{row.className}</td>
                      <td className="px-5 py-3">{row.timeIn}</td>
                      <td className="px-5 py-3"><StatusBadge status={row.status} /></td>
                    </tr>
                  ))}
                  {!recordsLoading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                        No records available for this selection.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "manual" && (
        <>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Class</label>
              <select
                value={manualSectionId}
                onChange={(event) => {
                  setManualSectionId(event.target.value);
                  setManualLoaded(false);
                }}
                className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                disabled={loading}
              >
                {classOptions.length === 0 && (
                  <option value="">No classes yet</option>
                )}
                {classOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Date</label>
              <input
                type="date"
                value={manualDate}
                onChange={(event) => setManualDate(event.target.value)}
                className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <button
              onClick={loadManualStudents}
              disabled={manualLoading || loading}
              className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
            >
              Load Students
            </button>
            <button
              onClick={() => {
                const next: Record<string, ApiStatus> = {};
                manualStudents.forEach((student) => {
                  next[student.id] = "present";
                });
                setManualMarks(next);
              }}
              disabled={!manualLoaded}
              className="h-9 px-4 rounded-md border border-border text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              Mark All Present
            </button>
            <div className="relative flex-1 min-w-52">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={manualSearch}
                onChange={(event) => setManualSearch(event.target.value)}
                placeholder="Search student..."
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
              />
            </div>
            <button
              onClick={submitManualAttendance}
              disabled={!manualLoaded || manualSaving}
              className="h-9 px-4 rounded-md bg-success text-success-foreground text-sm font-semibold hover:bg-success/90 disabled:opacity-50"
            >
              Save Attendance
            </button>
          </div>

          {manualLoading && (
            <div className="mt-5 rounded-xl border border-border bg-card p-6 shadow-sm">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="mt-3 h-6 w-4/5" />
              <Skeleton className="mt-3 h-6 w-3/5" />
            </div>
          )}

          {manualLoaded && !manualLoading && (
            <div className="mt-5 grid lg:grid-cols-[1.6fr_0.9fr] gap-5">
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <h3 className="font-display font-bold">Manual Attendance List</h3>
                  <span className="text-xs text-muted-foreground">{manualFiltered.length} students</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="text-left px-5 py-3">#</th>
                        <th className="text-left px-5 py-3">Student</th>
                        <th className="text-left px-5 py-3">Card ID</th>
                        <th className="text-left px-5 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {manualFiltered.map((student, i) => {
                        const status = manualMarks[student.id];
                        const label = status ? STATUS_LABEL[status] : "Mark";
                        return (
                          <tr key={student.id} className="border-t border-border odd:bg-background even:bg-muted/20">
                            <td className="px-5 py-3 text-muted-foreground">{i + 1}</td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2.5">
                                <Avatar name={`${student.first_name} ${student.last_name}`} size="sm" />
                                <span className="font-medium">{student.first_name} {student.last_name}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                              {student.student_id_number ?? "--"}
                            </td>
                            <td className="px-5 py-3">
                              <button
                                onClick={() =>
                                  setManualMarks((prev) => ({
                                    ...prev,
                                    [student.id]: nextManualStatus(prev[student.id])
                                  }))
                                }
                                className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                                  status ? MANUAL_STATUS_CLASSES[status] : "bg-muted text-muted-foreground border-border"
                                }`}
                              >
                                {label}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {manualFiltered.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">
                            No students match your search.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5 shadow-sm h-fit">
                <div className="text-xs uppercase text-muted-foreground">Session</div>
                <div className="font-display text-lg font-bold">{classLabelForSection(manualSectionId)}</div>
                <div className="text-xs text-muted-foreground">{manualDate}</div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-success/10 p-2">
                    <div className="text-2xl font-bold text-success">{manualCounts.present}</div>
                    <div className="text-[10px] uppercase text-success">Present</div>
                  </div>
                  <div className="rounded-lg bg-destructive/10 p-2">
                    <div className="text-2xl font-bold text-destructive">{manualCounts.absent}</div>
                    <div className="text-[10px] uppercase text-destructive">Absent</div>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-2">
                    <div className="text-2xl font-bold text-amber-600">{manualCounts.late}</div>
                    <div className="text-[10px] uppercase text-amber-700">Late</div>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-2">
                    <div className="text-2xl font-bold text-blue-600">{manualCounts.excused}</div>
                    <div className="text-[10px] uppercase text-blue-700">Excused</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  {Object.keys(manualMarks).length} of {manualStudents.length} marked
                </div>
                <button
                  onClick={submitManualAttendance}
                  disabled={!manualAllMarked || manualSaving}
                  className="mt-4 w-full h-10 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50"
                >
                  Submit Attendance
                </button>
              </div>
            </div>
          )}

          {!manualLoaded && !manualLoading && (
            <div className="mt-5 rounded-xl border border-dashed border-border p-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Select a class and date, then click Load Students to begin.</p>
            </div>
          )}
        </>
      )}
    </TeacherLayout>
  );
}
