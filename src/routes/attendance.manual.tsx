import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Download, Search } from "lucide-react";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import { Avatar } from "@/components/ui-kit/Avatar";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { localDateInputValue } from "@/lib/dateInput";
import { studentSearchText, studentIdNumber } from "@/lib/studentIdentity";
import { formatAttendanceDateTime, formatAttendanceTime } from "@/lib/attendanceTime";

export const Route = createFileRoute("/attendance/manual")({
  component: ManualAttendancePage,
});

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

type PeriodRecord = {
  id: string;
  name: string;
  start_time?: string;
  end_time?: string;
  is_break?: boolean;
};
type TeacherRecord = { id: string; name: string };
type SubjectRecord = { id: string; name: string; code?: string | null };

type ApiStudent = {
  id: string;
  student_school_id?: string | null;
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
  started_at?: string | null;
  teacher_id?: string | null;
  period_id?: string | null;
  subject_id?: string | null;
  subject?: { id: string; name: string; code?: string | null } | null;
  teacher?: { id: string; name: string } | null;
  period?: { id: string; name: string } | null;
  submitted_at?: string | null;
};

type ApiRecord = {
  id: string;
  session_id: string;
  student_id: string;
  status: ApiStatus;
  scan_method?: string | null;
  scanned_at?: string | null;
  created_at?: string | null;
  // New: enriched from session join — available when records are fetched from /attendance/records
  session_date?: string | null;
  teacher_name?: string | null;
  period_name?: string | null;
  subject_name?: string | null;
  section_name?: string | null;
};

type AttendanceRow = {
  id: string;
  studentId: string;
  studentName: string;
  cardId: string;
  className: string;
  sessionDate: string;
  timeIn: string;
  status: UiStatus;
  sessionId: string;
  sectionId: string;
  teacherName: string;
  periodName: string;
  subjectName: string;
  residency?: "Boarding" | "Day";
};
type AttendanceSummary = {
  total: number; present: number; absent: number; late: number; excused: number;
  teachers: number; classes: number; sessions: number;
  details: Array<{ className: string; subjectName: string; teacherName: string; periodName: string; total: number; present: number; late: number; absent: number; startedAt?: string | null; submittedAt?: string | null; sessionDate?: string; sessionId?: string }>;
};

const PAGE_SIZE = 20;
const MANUAL_PAGE_SIZE = 15;

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
  if (!value || status === "absent") return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatAttendanceTime(value);
};

const buildAttendanceChartImage = (counts: Record<UiStatus, number>) => {
  const canvas = document.createElement("canvas");
  canvas.width = 700;
  canvas.height = 380;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const labels: UiStatus[] = ["Present", "Absent", "Late", "Excused"];
  const values = labels.map((label) => counts[label] ?? 0);
  const maxValue = Math.max(1, ...values);

  const padding = 56;
  const chartWidth = canvas.width - padding * 2;
  const chartHeight = canvas.height - padding * 2;
  const barGap = 22;
  const barWidth = (chartWidth - barGap * (labels.length - 1)) / labels.length;
  const colors = ["#16a34a", "#dc2626", "#f59e0b", "#2563eb"];

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#111827";
  ctx.font = "bold 16px Roboto, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Attendance Summary", padding, padding - 20);

  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, canvas.height - padding);
  ctx.lineTo(canvas.width - padding, canvas.height - padding);
  ctx.stroke();

  values.forEach((value, index) => {
    const barHeight = (value / maxValue) * (chartHeight - 10);
    const x = padding + index * (barWidth + barGap);
    const y = canvas.height - padding - barHeight;

    ctx.fillStyle = colors[index];
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = "#111827";
    ctx.font = "12px Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(value), x + barWidth / 2, y - 8);

    ctx.fillStyle = "#6b7280";
    ctx.fillText(labels[index], x + barWidth / 2, canvas.height - padding + 16);
  });

  return canvas.toDataURL("image/png");
};

const nextManualStatus = (current?: ApiStatus) => {
  const order: ApiStatus[] = ["present", "absent", "late", "excused"];
  if (!current) return order[0];
  const idx = order.indexOf(current);
  return order[(idx + 1) % order.length];
};

function ManualAttendancePage() {
  const todayValue = localDateInputValue();
  const [tab, setTab] = useState<"records" | "manual" | "summary">("records");
  const [classRecords, setClassRecords] = useState<ClassRecord[]>([]);
  const [sectionRecords, setSectionRecords] = useState<SectionRecord[]>([]);
  const [periodRecords, setPeriodRecords] = useState<PeriodRecord[]>([]);
  const [teacherRecords, setTeacherRecords] = useState<TeacherRecord[]>([]);
  const [subjectRecords, setSubjectRecords] = useState<SubjectRecord[]>([]);
  const [studentsById, setStudentsById] = useState<Record<string, ApiStudent>>({});
  const [sessions, setSessions] = useState<ApiSession[]>([]);
  const [records, setRecords] = useState<ApiRecord[]>([]);
  const [dateFilter, setDateFilter] = useState(todayValue);
  const [classFilter, setClassFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"All" | UiStatus>("All");
  const [residencyFilter, setResidencyFilter] = useState<"All" | "Boarding" | "Day">("All");
  const [teacherFilter, setTeacherFilter] = useState("All");
  const [periodFilter, setPeriodFilter] = useState("All");
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [summaryPeriod, setSummaryPeriod] = useState<"daily" | "weekly" | "monthly" | "termly">("daily");
  const [summaryReport, setSummaryReport] = useState<AttendanceSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [manualSectionId, setManualSectionId] = useState("");
  const [manualSubjectId, setManualSubjectId] = useState("");
  const [manualTeacherId, setManualTeacherId] = useState("");
  const [manualPeriodId, setManualPeriodId] = useState("");
  const [manualDate, setManualDate] = useState(todayValue);
  const [manualStudents, setManualStudents] = useState<ApiStudent[]>([]);
  const [manualMarks, setManualMarks] = useState<Record<string, ApiStatus>>({});
  const [manualLoaded, setManualLoaded] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const [manualSessionId, setManualSessionId] = useState<string | null>(null);
  const [manualPage, setManualPage] = useState(1);

  const clampManualDate = (value: string) => {
    if (value && value > todayValue) {
      toast.error("Future dates are not allowed");
      return todayValue;
    }
    return value;
  };

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
    if (!sectionId) return "—";
    const section = sectionMap.get(sectionId);
    if (!section) return "—";
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
      const [classes, sections, periods, teachers, subjects] = await Promise.all([
        apiRequest<ClassRecord[]>("/classes?limit=200", { auth: "school" }),
        apiRequest<SectionRecord[]>("/sections?limit=200", { auth: "school" }),
        apiRequest<PeriodRecord[]>("/timetable-periods?limit=500", { auth: "school" }),
        apiRequest<TeacherRecord[]>("/users?role=teacher&limit=500", { auth: "school" }),
        apiRequest<SubjectRecord[]>("/subjects?limit=500", { auth: "school" })
      ]);
      setClassRecords(classes);
      setSectionRecords(sections);
      setPeriodRecords(periods);
      setTeacherRecords(teachers);
      setSubjectRecords(subjects);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load classes");
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentsForSections = async (sectionIds: string[]) => {
    if (!sectionIds.length) return;

    const batches = await Promise.all(
      sectionIds.map((sectionId) =>
        apiRequest<ApiStudent[]>(`/students?section_id=${sectionId}&limit=1000`, {
          auth: "school"
        }).catch(() => [])
      )
    );

    mergeStudents(batches.flat());
  };

  const loadAttendanceData = async (targetDate: string) => {
    setRecordsLoading(true);
    try {
      const [sessionList, recordList] = await Promise.all([
        apiRequest<ApiSession[]>(`/attendance/sessions?date=${targetDate}&limit=500`, {
          auth: "school"
        }),
        apiRequest<ApiRecord[]>(`/attendance/records?date=${targetDate}&limit=5000`, {
          auth: "school"
        })
      ]);

      setSessions(sessionList);
      setRecords(recordList);

      const sectionIds = Array.from(
        new Set(sessionList.map((session) => session.section_id))
      );
      await fetchStudentsForSections(sectionIds);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load attendance records");
    } finally {
      setRecordsLoading(false);
    }
  };

  const loadSummaryReport = async () => {
    const end = new Date(`${dateFilter}T00:00:00`);
    const days = summaryPeriod === "daily" ? 0 : summaryPeriod === "weekly" ? 6 : summaryPeriod === "monthly" ? 29 : 89;
    const start = new Date(end);
    start.setDate(start.getDate() - days);
    setSummaryLoading(true);
    try {
      const report = await apiRequest<AttendanceSummary>(
        `/attendance/records/summary?start_date=${start.toISOString().slice(0, 10)}&end_date=${new Date(end.getTime() + 86400000).toISOString().slice(0, 10)}`,
        { auth: "school" }
      );
      setSummaryReport(report);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load attendance summary");
    } finally {
      setSummaryLoading(false);
    }
  };

  const updateStatus = async (row: AttendanceRow, status: UiStatus) => {
    try {
      const updated = await apiRequest<ApiRecord>("/attendance/records", {
        method: "POST",
        auth: "school",
        body: JSON.stringify({
          session_id: row.sessionId,
          student_id: row.studentId,
          status: STATUS_TO_API[status],
          scan_method: "manual"
        })
      });

      setRecords((prev) => {
        const index = prev.findIndex(
          (record) =>
            record.id === updated.id ||
            (record.session_id === updated.session_id && record.student_id === updated.student_id)
        );

        if (index === -1) {
          return [updated, ...prev];
        }

        const next = [...prev];
        next[index] = updated;
        return next;
      });
      toast.info(`Marked ${status}`);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to update attendance");
    }
  };

  const loadManualStudents = async () => {
    if (!manualSectionId) {
      toast.error("Select a class first");
      return;
    }
    if (!manualSubjectId || !manualTeacherId) {
      toast.error("Select the subject and teacher for this attendance session");
      return;
    }

    setManualLoading(true);
    setManualLoaded(false);
    try {
      // Load students and look for an existing session in parallel.
      // The session lookup is purely for pre-filling existing marks —
      // it is NOT used by Submit (Submit calls /records/submit which
      // does its own find-or-create safely at the DB level).
      const sessionQuery = new URLSearchParams({
        section_id: manualSectionId,
        date:       manualDate,
        subject_id: manualSubjectId,
        teacher_id: manualTeacherId,
        limit:      "10"
      });
      if (manualPeriodId) sessionQuery.set("period_id", manualPeriodId);

      const [students, existingSessions] = await Promise.all([
        apiRequest<ApiStudent[]>(`/students?section_id=${manualSectionId}&limit=500`, { auth: "school" }),
        apiRequest<ApiSession[]>(`/attendance/sessions?${sessionQuery.toString()}`, { auth: "school" }).catch(() => [] as ApiSession[])
      ]);

      mergeStudents(students);
      setManualStudents(students);

      // Use first matching session (period_id narrows it to one).
      // If somehow multiple still match, pick the most recent.
      const existingSession = existingSessions.length > 0
        ? existingSessions.reduce((best, s) =>
            !best || s.id > best.id ? s : best
          )
        : null;

      setManualSessionId(existingSession?.id ?? null);

      if (existingSession) {
        // Pre-fill marks from previous submission so teacher can review/correct
        const existingRecords = await apiRequest<ApiRecord[]>(
          `/attendance/records?session_id=${existingSession.id}&limit=2000`,
          { auth: "school" }
        ).catch(() => [] as ApiRecord[]);

        const nextMarks: Record<string, ApiStatus> = {};
        existingRecords.forEach((r) => { nextMarks[r.student_id] = r.status; });
        setManualMarks(nextMarks);
        toast.success(`Loaded ${students.length} students — previous marks restored`);
      } else {
        setManualMarks({});
        toast.success(`Loaded ${students.length} students`);
      }

      setManualLoaded(true);
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
      // Single POST — backend finds or creates the session then upserts all
      // records in one atomic call.  No two-step round-trip, no race window,
      // no duplicate-session errors.  Multiple teachers submitting at the
      // same time are handled entirely by the DB (unique index + upserts).
      const result = await apiRequest<{ session: ApiSession; records: ApiRecord[] }>(
        "/attendance/records/submit",
        {
          method: "POST",
          auth: "school",
          body: JSON.stringify({
            section_id: manualSectionId,
            date:       manualDate,
            teacher_id: manualTeacherId,
            subject_id: manualSubjectId || undefined,
            period_id:  manualPeriodId  || undefined,
            records: manualStudents.map((student) => ({
              student_id: student.id,
              status:     manualMarks[student.id]
            }))
          })
        }
      );

      // Cache the session id so a second Save without re-loading still works
      setManualSessionId(result.session?.id ?? null);
      toast.success("Attendance saved");
      setDateFilter(manualDate);
      await loadAttendanceData(manualDate);
      setTab("records");
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
    loadAttendanceData(dateFilter);
  }, [dateFilter]);

  useEffect(() => {
    if (!manualSectionId && classOptions.length) {
      setManualSectionId(classOptions[0].id);
    }
  }, [classOptions, manualSectionId]);

  useEffect(() => {
    if (!manualPeriodId && periodRecords.length) {
      // Default to Period 1 (first non-break period, or first period overall)
      const first = periodRecords.find((p) => !p.is_break) ?? periodRecords[0];
      setManualPeriodId(first?.id ?? "");
    }
  }, [manualPeriodId, periodRecords]);

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
      const cardId = studentIdNumber(student);
      const status = STATUS_LABEL[record.status];
      const timeIn = formatTime(record.scanned_at ?? record.created_at, record.status);
      const className =
        sectionId
          ? classLabelForSection(sectionId)
          : student?.current_section?.full_name ?? "—";
      const sessionDate = session?.session_date?.slice(0, 10) ?? "Unknown date";
      const teacherName = session?.teacher?.name ?? "Unknown teacher";
      const periodName = session?.period?.name ?? "No period";
      const subjectName = session?.subject?.name ?? "No subject";
      const residency =
        student?.student_type === "boarding"
          ? "Boarding"
          : student?.student_type === "day"
          ? "Day"
          : undefined;

      return {
        id: record.id,
        studentId: record.student_id,
        studentName,
        cardId,
        className,
        sessionDate,
        timeIn,
        status,
        sessionId: record.session_id,
        sectionId,
        teacherName,
        periodName,
        subjectName,
        residency
      };
    });
  }, [records, sessionMap, studentsById, classMap, sectionMap]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const matchesClass    = classFilter    === "All" || row.sectionId    === classFilter;
      const matchesStatus   = statusFilter   === "All" || row.status       === statusFilter;
      const matchesResidency= residencyFilter=== "All" || row.residency    === residencyFilter;
      const matchesTeacher  = teacherFilter  === "All" || sessionMap.get(row.sessionId)?.teacher_id === teacherFilter;
      const matchesPeriod   = periodFilter   === "All" || sessionMap.get(row.sessionId)?.period_id  === periodFilter;
      const matchesSubject  = subjectFilter  === "All" || sessionMap.get(row.sessionId)?.subject_id === subjectFilter;
      const target = `${row.studentName} ${row.cardId}`.toLowerCase();
      const matchesSearch   = search === "" || target.includes(search.toLowerCase());
      return matchesClass && matchesStatus && matchesResidency && matchesTeacher && matchesPeriod && matchesSubject && matchesSearch;
    });
  }, [rows, classFilter, statusFilter, residencyFilter, teacherFilter, periodFilter, subjectFilter, search, sessionMap]);

  const counts = useMemo(() => {
    // Counts reflect the filtered view so the header numbers match what you see
    return filtered.reduce(
      (acc, row) => {
        acc.total += 1;
        const s = row.status.toLowerCase();
        if (s === "present") acc.present += 1;
        if (s === "absent")  acc.absent  += 1;
        if (s === "late")    acc.late    += 1;
        if (s === "excused") acc.excused += 1;
        return acc;
      },
      { total: 0, present: 0, absent: 0, late: 0, excused: 0 }
    );
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const manualFiltered = useMemo(() => {
    if (!manualSearch) return manualStudents;
    const target = manualSearch.toLowerCase();
    return manualStudents.filter((student) => {
      const name = `${student.first_name} ${student.last_name}`.toLowerCase();
      return (
        name.includes(target) ||
        studentSearchText(student).includes(target)
      );
    });
  }, [manualStudents, manualSearch]);

  const manualTotalPages = Math.max(1, Math.ceil(manualFiltered.length / MANUAL_PAGE_SIZE));
  const manualPageItems = manualFiltered.slice(
    (manualPage - 1) * MANUAL_PAGE_SIZE,
    manualPage * MANUAL_PAGE_SIZE
  );

  useEffect(() => {
    setManualPage(1);
  }, [manualSearch, manualSectionId, manualPeriodId, manualDate, manualStudents]);

  useEffect(() => {
    if (manualPage > manualTotalPages) setManualPage(manualTotalPages);
  }, [manualPage, manualTotalPages]);

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

  const exportAttendance = async () => {
    if (filtered.length === 0) {
      toast.info("No attendance records to export");
      return;
    }

    const exportCounts = filtered.reduce<Record<UiStatus, number>>(
      (acc, row) => {
        acc[row.status] += 1;
        return acc;
      },
      { Present: 0, Absent: 0, Late: 0, Excused: 0 }
    );

    const chartImage = buildAttendanceChartImage(exportCounts);
    if (!chartImage) {
      toast.error("Failed to render chart");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Attendance");

      const header = [
        "#",
        "Student",
        "Card ID",
        "Session ID",
        "Class",
        "Session Date",
        "Teacher",
        "Period",
        "Time In",
        "Status",
        "Residency"
      ];

      sheet.addRow(header);
      sheet.getRow(1).font = { bold: true };

      filtered.forEach((row, index) => {
        sheet.addRow([
          index + 1,
          row.studentName,
          row.cardId,
          row.sessionId,
          row.className,
          row.sessionDate,
          row.teacherName,
          row.periodName,
          row.timeIn,
          row.status,
          row.residency ?? ""
        ]);
      });

      sheet.columns = [
        { width: 6 },
        { width: 28 },
        { width: 14 },
        { width: 20 },
        { width: 18 },
        { width: 14 },
        { width: 24 },
        { width: 14 },
        { width: 12 },
        { width: 12 },
        { width: 12 }
      ];

      sheet.getCell("Q2").value = "Status";
      sheet.getCell("R2").value = "Count";
      sheet.getCell("Q2").font = { bold: true };
      sheet.getCell("R2").font = { bold: true };

      const summaryRows: Array<[UiStatus, number]> = [
        ["Present", exportCounts.Present],
        ["Absent", exportCounts.Absent],
        ["Late", exportCounts.Late],
        ["Excused", exportCounts.Excused]
      ];

      summaryRows.forEach((row, idx) => {
        sheet.getCell(`Q${idx + 3}`).value = row[0];
        sheet.getCell(`R${idx + 3}`).value = row[1];
      });

      const imageId = workbook.addImage({
        base64: chartImage.split(",")[1],
        extension: "png"
      });

      sheet.addImage(imageId, {
        tl: { col: 16, row: 6 },
        ext: { width: 640, height: 340 }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `attendance-${dateFilter}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Attendance exported");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to export attendance");
    }
  };

  return (
    <>
      <div className="flex gap-1 border-b border-border mb-5">
        {(["records", "manual", "summary"] as const).map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
              tab === item
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            {item === "records" ? "Today's Records" : item === "manual" ? "Make Attendance" : "Summary Report"}
          </button>
        ))}
      </div>

      {tab === "records" && (
        <>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-3 items-center mb-5">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            />
            <select
              value={classFilter}
              onChange={(e) => { setClassFilter(e.target.value); setPage(1); }}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="All">All Classes</option>
              {classOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1); }}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="All">All Statuses</option>
              <option>Present</option><option>Absent</option><option>Late</option><option>Excused</option>
            </select>
            <select
              value={residencyFilter}
              onChange={(e) => { setResidencyFilter(e.target.value as typeof residencyFilter); setPage(1); }}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="All">All Students</option>
              <option value="Day">Day School</option>
              <option value="Boarding">Boarding</option>
            </select>
            <select
              value={teacherFilter}
              onChange={(e) => { setTeacherFilter(e.target.value); setPage(1); }}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="All">All Teachers</option>
              {teacherRecords.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
            </select>
            <select
              value={periodFilter}
              onChange={(e) => { setPeriodFilter(e.target.value); setPage(1); }}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="All">All Periods</option>
              {periodRecords.filter(p => !p.is_break).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select
              value={subjectFilter}
              onChange={(e) => { setSubjectFilter(e.target.value); setPage(1); }}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="All">All Subjects</option>
              {subjectRecords.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="relative flex-1 min-w-50">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by name…"
                className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
              />
            </div>
            <button
              onClick={exportAttendance}
              className="h-10 inline-flex items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Download className="h-4 w-4" /> Export Excel
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex flex-wrap gap-2 items-center justify-between">
              <h3 className="font-display font-bold">Manual Attendance — {todayLabel}</h3>
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
                    <th className="text-left px-5 py-3">Session Date</th>
                    <th className="text-left px-5 py-3">Teacher</th>
                    <th className="text-left px-5 py-3">Period</th>
                    <th className="text-left px-5 py-3">Subject</th>
                    <th className="text-left px-5 py-3">Time In</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-left px-5 py-3">Residency</th>
                  </tr>
                </thead>
                <tbody>
                  {recordsLoading && (
                    <tr><td colSpan={11} className="px-5 py-6"><Skeleton className="h-6 w-full" /></td></tr>
                  )}
                  {!recordsLoading && pageItems.map((row, i) => (
                    <tr key={row.id} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/40 transition-colors">
                      <td className="px-5 py-3 text-muted-foreground">{(page - 1) * PAGE_SIZE + i + 1}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={row.studentName} size="sm" />
                          <span className="font-medium">{row.studentName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{row.cardId}</td>
                      <td className="px-5 py-3">{row.className}</td>
                      <td className="px-5 py-3 text-xs">{row.sessionDate}</td>
                      <td className="px-5 py-3">{row.teacherName}</td>
                      <td className="px-5 py-3">{row.periodName}</td>
                      <td className="px-5 py-3">{row.subjectName}</td>
                      <td className="px-5 py-3">{row.timeIn}</td>
                      <td className="px-5 py-3"><StatusBadge status={row.status} /></td>
                      <td className="px-5 py-3 text-xs">{row.residency ?? "Unknown"}</td>
                    </tr>
                  ))}
                  {!recordsLoading && pageItems.length === 0 && (
                    <tr><td colSpan={11} className="px-5 py-10 text-center text-muted-foreground">No records match your filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t border-border text-sm">
              <span className="text-muted-foreground">Page {page} of {totalPages}</span>
              <div className="space-x-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-md border border-border disabled:opacity-50 hover:bg-muted">Previous</button>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 rounded-md border border-border disabled:opacity-50 hover:bg-muted">Next</button>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "summary" && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold">Summary period</span>
            <select value={summaryPeriod} onChange={(e) => setSummaryPeriod(e.target.value as typeof summaryPeriod)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
              <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="termly">Termly</option>
            </select>
            <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
            <button onClick={loadSummaryReport} disabled={summaryLoading} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{summaryLoading ? "Loading…" : "Generate Summary"}</button>
          </div>
          {summaryReport && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {[['Teachers', summaryReport.teachers], ['Classes', summaryReport.classes], ['Sessions', summaryReport.sessions], ['Present', summaryReport.present], ['Late', summaryReport.late], ['Absent', summaryReport.absent]].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl border border-border bg-card p-4"><div className="text-2xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>
                ))}
              </div>
              <div className="rounded-xl border border-border bg-card overflow-x-auto">
                <table className="w-full text-sm"><thead className="bg-muted/40 text-xs uppercase"><tr>{['Session ID', 'Class', 'Session Date', 'Subject', 'Teacher', 'Period', 'Started', 'Submission', 'Total', 'Present', 'Late', 'Absent'].map((heading) => <th key={heading} className="text-left px-4 py-3">{heading}</th>)}</tr></thead>
                  <tbody>{summaryReport.details.map((row, index) => <tr key={`${row.sessionId ?? row.className}-${row.subjectName}-${row.periodName}-${index}`} className="border-t border-border"><td className="px-4 py-3 text-xs font-mono">{row.sessionId ?? "—"}</td><td className="px-4 py-3 font-medium">{row.className}</td><td className="px-4 py-3 text-xs">{row.sessionDate?.slice(0, 10) ?? "—"}</td><td className="px-4 py-3">{row.subjectName}</td><td className="px-4 py-3">{row.teacherName}</td><td className="px-4 py-3">{row.periodName}</td><td className="px-4 py-3 text-xs">{formatAttendanceDateTime(row.startedAt)}</td><td className="px-4 py-3 text-xs">{formatAttendanceDateTime(row.submittedAt)}</td><td className="px-4 py-3">{row.total}</td><td className="px-4 py-3">{row.present}</td><td className="px-4 py-3">{row.late}</td><td className="px-4 py-3">{row.absent}</td></tr>)}</tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "manual" && (
        <>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-3 items-end mb-5">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Class</label>
              <select
                value={manualSectionId}
                onChange={(e) => { setManualSectionId(e.target.value); setManualLoaded(false); setManualSessionId(null); }}
                className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm block"
              >
                {classOptions.length === 0 && <option value="">No classes yet</option>}
                {classOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Subject</label>
              <select
                value={manualSubjectId}
                onChange={(e) => { setManualSubjectId(e.target.value); setManualLoaded(false); setManualSessionId(null); }}
                className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm block"
                disabled={loading}
              >
                <option value="">Select subject</option>
                {subjectRecords.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Teacher</label>
              <select
                value={manualTeacherId}
                onChange={(e) => { setManualTeacherId(e.target.value); setManualLoaded(false); setManualSessionId(null); }}
                className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm block"
                disabled={loading}
              >
                <option value="">Select teacher</option>
                {teacherRecords.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Date</label>
              <input
                type="date"
                value={manualDate}
                max={todayValue}
                onChange={(e) => setManualDate(clampManualDate(e.target.value))}
                className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm block"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Period</label>
              <select
                value={manualPeriodId}
                onChange={(e) => { setManualPeriodId(e.target.value); setManualLoaded(false); setManualSessionId(null); }}
                className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm block"
              >
                <option value="">No period</option>
                {periodRecords.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name}{period.is_break ? " (break)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <button onClick={loadManualStudents} disabled={manualLoading || loading} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">Load Students</button>
            <button
              onClick={() => {
                const next: Record<string, ApiStatus> = {};
                manualStudents.forEach((s) => { next[s.id] = "present"; });
                setManualMarks(next);
              }}
              disabled={!manualLoaded}
              className="h-9 px-4 rounded-md border border-border text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              Mark All Present
            </button>
            <div className="relative flex-1 min-w-55">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={manualSearch} onChange={(e) => setManualSearch(e.target.value)} placeholder="Search student…" className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm" />
            </div>
            <button onClick={submitManualAttendance} disabled={!manualLoaded || manualSaving} className="h-9 px-4 rounded-md bg-success text-success-foreground text-sm font-semibold hover:bg-success/90 disabled:opacity-50">Save Attendance</button>
          </div>

          {manualLoading && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <Skeleton className="h-6 w-full" /><Skeleton className="mt-3 h-6 w-4/5" /><Skeleton className="mt-3 h-6 w-3/5" />
            </div>
          )}

          {manualLoaded && !manualLoading && (
            <div className="grid lg:grid-cols-[1.6fr_0.9fr] gap-5">
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
                      {manualPageItems.map((student, i) => {
                        const status = manualMarks[student.id];
                        const label = status ? STATUS_LABEL[status] : "Mark";
                        return (
                          <tr key={student.id} className="border-t border-border odd:bg-background even:bg-muted/20">
                            <td className="px-5 py-3 text-muted-foreground">{(manualPage - 1) * MANUAL_PAGE_SIZE + i + 1}</td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2.5">
                                <Avatar name={`${student.first_name} ${student.last_name}`} size="sm" />
                                <span className="font-medium">{student.first_name} {student.last_name}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{studentIdNumber(student)}</td>
                            <td className="px-5 py-3">
                              <button
                                onClick={() => setManualMarks((prev) => ({ ...prev, [student.id]: nextManualStatus(prev[student.id]) }))}
                                className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${status ? MANUAL_STATUS_CLASSES[status] : "bg-muted text-muted-foreground border-border"}`}
                              >
                                {label}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {manualFiltered.length === 0 && (
                        <tr><td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">No students match your search.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {manualFiltered.length > 0 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-border text-sm">
                    <span className="text-muted-foreground">Page {manualPage} of {manualTotalPages}</span>
                    <div className="space-x-2">
                      <button onClick={() => setManualPage((p) => Math.max(1, p - 1))} disabled={manualPage === 1} className="px-3 py-1.5 rounded-md border border-border disabled:opacity-50 hover:bg-muted">Previous</button>
                      <button onClick={() => setManualPage((p) => Math.min(manualTotalPages, p + 1))} disabled={manualPage === manualTotalPages} className="px-3 py-1.5 rounded-md border border-border disabled:opacity-50 hover:bg-muted">Next</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-card p-5 shadow-sm h-fit lg:sticky lg:top-24">
                <div className="text-xs uppercase text-muted-foreground">Session</div>
                <div className="font-display text-lg font-bold">{classLabelForSection(manualSectionId)}</div>
                <div className="text-xs text-muted-foreground">{manualDate}</div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-success/10 p-2"><div className="text-2xl font-bold text-success">{manualCounts.present}</div><div className="text-[10px] uppercase text-success">Present</div></div>
                  <div className="rounded-lg bg-destructive/10 p-2"><div className="text-2xl font-bold text-destructive">{manualCounts.absent}</div><div className="text-[10px] uppercase text-destructive">Absent</div></div>
                  <div className="rounded-lg bg-amber-50 p-2"><div className="text-2xl font-bold text-amber-600">{manualCounts.late}</div><div className="text-[10px] uppercase text-amber-700">Late</div></div>
                  <div className="rounded-lg bg-blue-50 p-2"><div className="text-2xl font-bold text-blue-600">{manualCounts.excused}</div><div className="text-[10px] uppercase text-blue-700">Excused</div></div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">{Object.keys(manualMarks).length} of {manualStudents.length} marked</div>
                <button onClick={submitManualAttendance} disabled={!manualAllMarked || manualSaving} className="mt-4 w-full h-10 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50">Submit Attendance</button>
              </div>
            </div>
          )}

          {!manualLoaded && !manualLoading && (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Select a class and date, then click Load Students to begin.</p>
            </div>
          )}
        </>
      )}
    </>
  );
}
