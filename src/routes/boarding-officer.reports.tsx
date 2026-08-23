import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import { BoardingOfficerLayout } from "@/components/layout/BoardingOfficerLayout";
import { boardingOfficerRouteGuard } from "@/lib/schoolAuth";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { studentIdNumber } from "@/lib/studentIdentity";
import {
  type ApiRecord,
  type ApiSession,
  type ApiStatus,
  type ClassRecord,
  type SectionRecord,
  STATUS_LABEL,
  todayIso,
} from "@/lib/gateKeeperAttendance";

export const Route = createFileRoute("/boarding-officer/reports")({
  beforeLoad: ({ location }) => boardingOfficerRouteGuard(location),
  component: BoardingOfficerReportsPage,
});

const REPORT_TABS = ["Boarding Students", "Boarding Attendance"] as const;
const PERIOD_OPTIONS = ["Daily", "Weekly", "Monthly", "Custom"] as const;

type ApiStudent = {
  id: string;
  first_name: string;
  last_name: string;
  student_id_number?: string | null;
  gender?: string | null;
  current_section?: { id?: string; name?: string; full_name?: string; class_id?: string } | null;
};

type DormAssignment = {
  student_id: string;
  dormitory_id: string;
  dormitory?: { name?: string | null } | null;
};

type DormitoryRecord = { id: string; name: string };

type StudentReportRow = {
  id: string;
  name: string;
  studentId: string;
  className: string;
  dormName: string;
  gender: string;
};

type AttendanceReportRow = {
  id: string;
  studentName: string;
  className: string;
  date: string;
  status: string;
};

function BoardingOfficerReportsPage() {
  const todayValue = todayIso();
  const [tab, setTab] = useState<(typeof REPORT_TABS)[number]>("Boarding Students");
  const [loading, setLoading] = useState(true);

  const [students, setStudents] = useState<ApiStudent[]>([]);
  const [assignments, setAssignments] = useState<DormAssignment[]>([]);
  const [dormitories, setDormitories] = useState<DormitoryRecord[]>([]);
  const [classRecords, setClassRecords] = useState<ClassRecord[]>([]);
  const [sectionRecords, setSectionRecords] = useState<SectionRecord[]>([]);

  const [classFilter, setClassFilter] = useState("All");
  const [dormFilter, setDormFilter] = useState("All");
  const [studentSearch, setStudentSearch] = useState("");

  const [period, setPeriod] = useState<(typeof PERIOD_OPTIONS)[number]>("Daily");
  const [startDate, setStartDate] = useState(todayValue);
  const [endDate, setEndDate] = useState(todayValue);
  const [attendanceClassFilter, setAttendanceClassFilter] = useState("All");
  const [attendanceStudentFilter, setAttendanceStudentFilter] = useState("All");
  const [attendanceRecords, setAttendanceRecords] = useState<ApiRecord[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<ApiSession[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

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

  const assignmentByStudent = useMemo(() => {
    const map = new Map<string, DormAssignment>();
    assignments.forEach((a) => map.set(a.student_id, a));
    return map;
  }, [assignments]);

  const dormNameById = useMemo(
    () => new Map(dormitories.map((d) => [d.id, d.name])),
    [dormitories]
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [studentList, assignmentList, dormList, classes, sections] = await Promise.all([
          apiRequest<ApiStudent[]>("/students?student_type=boarding&limit=2000", { auth: "school" }),
          apiRequest<DormAssignment[]>("/boarding/assignments?is_active=true&limit=2000", {
            auth: "school",
          }),
          apiRequest<DormitoryRecord[]>("/boarding/dormitories?limit=100", { auth: "school" }),
          apiRequest<ClassRecord[]>("/classes?limit=200", { auth: "school" }),
          apiRequest<SectionRecord[]>("/sections?limit=200", { auth: "school" }),
        ]);
        setStudents(Array.isArray(studentList) ? studentList : []);
        setAssignments(Array.isArray(assignmentList) ? assignmentList : []);
        setDormitories(Array.isArray(dormList) ? dormList : []);
        setClassRecords(Array.isArray(classes) ? classes : []);
        setSectionRecords(Array.isArray(sections) ? sections : []);
      } catch (error: any) {
        toast.error(error?.message ?? "Failed to load report data");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const resolveDateRange = useCallback(() => {
    const today = new Date(todayValue);
    if (period === "Daily") {
      return { start: todayValue, end: todayValue };
    }
    if (period === "Weekly") {
      const start = new Date(today);
      start.setDate(today.getDate() - 6);
      return { start: start.toISOString().slice(0, 10), end: todayValue };
    }
    if (period === "Monthly") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: start.toISOString().slice(0, 10), end: todayValue };
    }
    const safeEnd = endDate > todayValue ? todayValue : endDate;
    const safeStart = startDate > safeEnd ? safeEnd : startDate;
    return { start: safeStart, end: safeEnd };
  }, [period, startDate, endDate, todayValue]);

  const loadAttendanceReport = useCallback(async () => {
    const { start, end } = resolveDateRange();
    setAttendanceLoading(true);
    try {
      const dates: string[] = [];
      const cursor = new Date(start);
      const endDateObj = new Date(end);
      while (cursor <= endDateObj) {
        dates.push(cursor.toISOString().slice(0, 10));
        cursor.setDate(cursor.getDate() + 1);
      }

      const batches = await Promise.all(
        dates.map(async (date) => {
          const [sessions, records] = await Promise.all([
            apiRequest<ApiSession[]>(`/attendance/sessions?date=${date}&limit=500`, {
              auth: "school",
            }),
            apiRequest<ApiRecord[]>(`/attendance/records?date=${date}&limit=5000`, {
              auth: "school",
            }),
          ]);
          return {
            sessions: (Array.isArray(sessions) ? sessions : []).filter(
              (s) =>
                s.session_type === "boarding_morning" || s.session_type === "boarding_evening"
            ),
            records: Array.isArray(records) ? records : [],
          };
        })
      );

      setAttendanceSessions(batches.flatMap((b) => b.sessions));
      setAttendanceRecords(batches.flatMap((b) => b.records));
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load attendance report");
    } finally {
      setAttendanceLoading(false);
    }
  }, [resolveDateRange]);

  useEffect(() => {
    if (tab === "Boarding Attendance") {
      void loadAttendanceReport();
    }
  }, [tab, period, startDate, endDate, loadAttendanceReport]);

  const studentReportRows = useMemo<StudentReportRow[]>(() => {
    return students.map((student) => {
      const assignment = assignmentByStudent.get(student.id);
      const dormName =
        assignment?.dormitory?.name ??
        (assignment ? dormNameById.get(assignment.dormitory_id) : undefined) ??
        "Unassigned";
      return {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`.trim(),
        studentId: studentIdNumber(student),
        className: classLabelForSection(student.current_section?.id),
        dormName,
        gender: student.gender ?? "—",
      };
    });
  }, [students, assignmentByStudent, dormNameById, classLabelForSection]);

  const filteredStudentRows = useMemo(() => {
    return studentReportRows.filter((row) => {
      const student = students.find((s) => s.id === row.id);
      const classId = student?.current_section?.class_id;
      const assignment = assignmentByStudent.get(row.id);
      const matchesClass = classFilter === "All" || classId === classFilter;
      const matchesDorm = dormFilter === "All" || assignment?.dormitory_id === dormFilter;
      const target = `${row.name} ${row.studentId} ${row.className}`.toLowerCase();
      const matchesSearch = studentSearch === "" || target.includes(studentSearch.toLowerCase());
      return matchesClass && matchesDorm && matchesSearch;
    });
  }, [
    studentReportRows,
    students,
    classFilter,
    dormFilter,
    studentSearch,
    assignmentByStudent,
  ]);

  const studentsById = useMemo(() => {
    const map = new Map<string, ApiStudent>();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  const sessionById = useMemo(
    () => new Map(attendanceSessions.map((s) => [s.id, s])),
    [attendanceSessions]
  );

  const attendanceReportRows = useMemo<AttendanceReportRow[]>(() => {
    const boardingStudentIds = new Set(students.map((s) => s.id));
    return attendanceRecords
      .filter((record) => {
        const session = sessionById.get(record.session_id);
        if (!session) return false;
        if (
          session.session_type !== "boarding_morning" &&
          session.session_type !== "boarding_evening"
        ) {
          return false;
        }
        return boardingStudentIds.has(record.student_id);
      })
      .map((record) => {
        const session = sessionById.get(record.session_id)!;
        const student = studentsById.get(record.student_id);
        const studentName = student
          ? `${student.first_name} ${student.last_name}`.trim()
          : "Unknown";
        return {
          id: record.id,
          studentName,
          className: classLabelForSection(session.section_id),
          date: session.session_date?.slice(0, 10) ?? "—",
          status: STATUS_LABEL[record.status as ApiStatus],
        };
      });
  }, [attendanceRecords, sessionById, students, studentsById, classLabelForSection]);

  const filteredAttendanceRows = useMemo(() => {
    return attendanceReportRows.filter((row) => {
      const student = students.find(
        (s) => `${s.first_name} ${s.last_name}`.trim() === row.studentName
      );
      const classId = student?.current_section?.class_id;
      const matchesClass = attendanceClassFilter === "All" || classId === attendanceClassFilter;
      const matchesStudent =
        attendanceStudentFilter === "All" || student?.id === attendanceStudentFilter;
      return matchesClass && matchesStudent;
    });
  }, [attendanceReportRows, students, attendanceClassFilter, attendanceStudentFilter]);

  const attendanceSummary = useMemo(() => {
    return filteredAttendanceRows.reduce(
      (acc, row) => {
        acc.total += 1;
        if (row.status === "Present") acc.present += 1;
        if (row.status === "Absent") acc.absent += 1;
        if (row.status === "Late") acc.late += 1;
        if (row.status === "Excused") acc.excused += 1;
        return acc;
      },
      { total: 0, present: 0, absent: 0, late: 0, excused: 0 }
    );
  }, [filteredAttendanceRows]);

  const exportStudentReport = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Boarding Students");
      sheet.columns = [
        { header: "Name", key: "name", width: 28 },
        { header: "Student ID", key: "studentId", width: 16 },
        { header: "Class", key: "className", width: 14 },
        { header: "Dormitory", key: "dormName", width: 18 },
        { header: "Gender", key: "gender", width: 10 },
      ];
      filteredStudentRows.forEach((row) => sheet.addRow(row));
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `boarding-students-${todayValue}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Student report exported");
    } catch {
      toast.error("Failed to export report");
    }
  };

  const exportAttendanceReport = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Boarding Attendance");
      sheet.columns = [
        { header: "Date", key: "date", width: 14 },
        { header: "Student", key: "studentName", width: 28 },
        { header: "Class", key: "className", width: 14 },
        { header: "Status", key: "status", width: 12 },
      ];
      filteredAttendanceRows.forEach((row) => sheet.addRow(row));
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const { start, end } = resolveDateRange();
      link.download = `boarding-attendance-${start}-to-${end}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Attendance report exported");
    } catch {
      toast.error("Failed to export report");
    }
  };

  const clampDate = (value: string) => {
    if (value > todayValue) {
      toast.error("Future dates are not allowed");
      return todayValue;
    }
    return value;
  };

  return (
    <BoardingOfficerLayout title="Boarding Reports" subtitle="Student and attendance reporting">
      <div className="flex gap-1 border-b border-border mb-5 items-end">
        {REPORT_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Boarding Students" ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
            {loading ? (
              <>
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </>
            ) : (
              <>
                <StatCard label="Total Boarding Students" value={studentReportRows.length} />
                <StatCard
                  label="Filtered Results"
                  value={filteredStudentRows.length}
                  tone="primary"
                />
                <StatCard label="Dormitories" value={dormitories.length} tone="secondary" />
              </>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-3 items-end mb-5">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Class</label>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
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
              <label className="text-xs font-semibold text-muted-foreground">Dormitory</label>
              <select
                value={dormFilter}
                onChange={(e) => setDormFilter(e.target.value)}
                className="mt-1 h-9 block rounded-md border border-input bg-background px-3 text-sm min-w-36"
              >
                <option value="All">All Dormitories</option>
                {dormitories.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative flex-1 min-w-55">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search students…"
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => void exportStudentReport()}
              disabled={loading || filteredStudentRows.length === 0}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Export Excel
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    {["Name", "Student ID", "Class", "Dormitory", "Gender"].map((h) => (
                      <th key={h} className="text-left px-4 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        Loading student report…
                      </td>
                    </tr>
                  ) : filteredStudentRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No boarding students match the filters.
                      </td>
                    </tr>
                  ) : (
                    filteredStudentRows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-t border-border odd:bg-background even:bg-muted/20"
                      >
                        <td className="px-4 py-3 font-medium">{row.name}</td>
                        <td className="px-4 py-3 font-mono text-xs">{row.studentId}</td>
                        <td className="px-4 py-3">{row.className}</td>
                        <td className="px-4 py-3">{row.dormName}</td>
                        <td className="px-4 py-3">{row.gender}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            {attendanceLoading ? (
              <>
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </>
            ) : (
              <>
                <StatCard label="Total Records" value={attendanceSummary.total} />
                <StatCard label="Present" value={attendanceSummary.present} tone="success" />
                <StatCard label="Absent" value={attendanceSummary.absent} tone="destructive" />
                <StatCard label="Late" value={attendanceSummary.late} tone="warning" />
                <StatCard label="Excused" value={attendanceSummary.excused} tone="secondary" />
              </>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-3 items-end mb-5">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Period</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as (typeof PERIOD_OPTIONS)[number])}
                className="mt-1 h-9 block rounded-md border border-input bg-background px-3 text-sm min-w-32"
              >
                {PERIOD_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            {period === "Custom" && (
              <>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">From</label>
                  <input
                    type="date"
                    max={todayValue}
                    value={startDate}
                    onChange={(e) => setStartDate(clampDate(e.target.value))}
                    className="mt-1 h-9 block rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">To</label>
                  <input
                    type="date"
                    max={todayValue}
                    value={endDate}
                    onChange={(e) => setEndDate(clampDate(e.target.value))}
                    className="mt-1 h-9 block rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
              </>
            )}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Class</label>
              <select
                value={attendanceClassFilter}
                onChange={(e) => setAttendanceClassFilter(e.target.value)}
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
              <label className="text-xs font-semibold text-muted-foreground">Student</label>
              <select
                value={attendanceStudentFilter}
                onChange={(e) => setAttendanceStudentFilter(e.target.value)}
                className="mt-1 h-9 block rounded-md border border-input bg-background px-3 text-sm min-w-40"
              >
                <option value="All">All Students</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {`${s.first_name} ${s.last_name}`.trim()}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => void exportAttendanceReport()}
              disabled={attendanceLoading || filteredAttendanceRows.length === 0}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Export Excel
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    {["Date", "Student", "Class", "Status"].map((h) => (
                      <th key={h} className="text-left px-4 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendanceLoading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                        Loading attendance report…
                      </td>
                    </tr>
                  ) : filteredAttendanceRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                        No boarding attendance records for the selected period.
                      </td>
                    </tr>
                  ) : (
                    filteredAttendanceRows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-t border-border odd:bg-background even:bg-muted/20"
                      >
                        <td className="px-4 py-3">{row.date}</td>
                        <td className="px-4 py-3 font-medium">{row.studentName}</td>
                        <td className="px-4 py-3">{row.className}</td>
                        <td className="px-4 py-3">{row.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </BoardingOfficerLayout>
  );
}
