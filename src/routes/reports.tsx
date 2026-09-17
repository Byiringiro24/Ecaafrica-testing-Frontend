import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { SMSComposeModal } from "@/components/modals/SMSComposeModal";
import { apiRequest } from "@/lib/api";
import { studentIdNumber } from "@/lib/studentIdentity";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

const TABS = ["overview","class","student","time"] as const;
type Tab = typeof TABS[number];

type ApiStatus = "present" | "absent" | "late" | "excused";

type ApiRecord = {
  id: string;
  session_id: string;
  student_id: string;
  status: ApiStatus;
  scanned_at?: string | null;
  created_at?: string | null;
};

type ApiSession = {
  id: string;
  section_id: string;
  session_date: string;
};

type ApiStudent = {
  id: string;
  student_school_id?: string | null;
  first_name: string;
  last_name: string;
  student_id_number?: string | null;
  current_section?: { name: string; full_name: string } | null;
};

type ClassRecord = {
  id: string;
  name: string;
  level: number;
};

type SectionRecord = {
  id: string;
  name: string;
  full_name: string;
  class_id: string;
  class_teacher_id?: string | null;
};

type TeacherRecord = {
  id: string;
  name?: string | null;
};

type StudentCountResponse = {
  data: unknown[];
  meta?: { total?: number };
};

type ClassOption = {
  id: string;
  label: string;
  classId: string;
  sectionId: string;
  teacherId?: string | null;
};

type ClassSummary = {
  id: string;
  name: string;
  teacher: string;
  studentCount: number;
  present: number;
  absent: number;
  late: number;
  rate: number;
};

type StudentSummary = {
  id: string;
  name: string;
  className: string;
  present: number;
  absent: number;
  late: number;
  rate: number;
};

type HeatmapCell = { week: number; rate: number };
type HeatmapRow = { day: string; cells: HeatmapCell[] };

const isPresentStatus = (status: ApiStatus) => status !== "absent";

const formatDayLabel = (value: string) =>
  new Date(value).toLocaleDateString("en-US", { weekday: "short" });

const listDates = (start: string, end: string) => {
  const result: string[] = [];
  const cursor = new Date(start);
  const last = new Date(end);
  while (cursor <= last) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
};

const classLabelForSection = (
  sectionId: string,
  sectionMap: Map<string, SectionRecord>,
  classMap: Map<string, ClassRecord>
) => {
  const section = sectionMap.get(sectionId);
  if (!section) return "—";
  const cls = classMap.get(section.class_id);
  if (cls) return `${cls.name}${section.name}`;
  return section.full_name || section.name;
};

const getWeekBuckets = (dates: string[]) => {
  const weeks = new Map<string, string[]>();
  dates.forEach((date, idx) => {
    const key = `Week ${Math.floor(idx / 7) + 1}`;
    const current = weeks.get(key) ?? [];
    current.push(date);
    weeks.set(key, current);
  });
  return Array.from(weeks.entries());
};

const timeBuckets = [
  { label: "06:00-08:00", start: 6, end: 8 },
  { label: "08:00-10:00", start: 8, end: 10 },
  { label: "10:00-12:00", start: 10, end: 12 },
  { label: "12:00-14:00", start: 12, end: 14 },
  { label: "14:00-16:00", start: 14, end: 16 },
  { label: "16:00-18:00", start: 16, end: 18 },
  { label: "After 18:00", start: 18, end: 24 }
];

function ReportsPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [start, setStart] = useState(new Date(new Date().setDate(1)).toISOString().slice(0,10));
  const [end, setEnd] = useState(new Date().toISOString().slice(0,10));
  const [classFilter, setClassFilter] = useState<string[]>([]);
  const [composeFor, setComposeFor] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [classRecords, setClassRecords] = useState<ClassRecord[]>([]);
  const [sectionRecords, setSectionRecords] = useState<SectionRecord[]>([]);
  const [teacherRecords, setTeacherRecords] = useState<TeacherRecord[]>([]);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [studentsById, setStudentsById] = useState<Record<string, ApiStudent>>({});
  const [summary, setSummary] = useState({
    totalStudents: 0,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    totalRecords: 0
  });
  const [dailyTrend, setDailyTrend] = useState<
    Array<{ date: string; Present: number; Late: number; Absent: number }>
  >([]);
  const [weeklyCompare, setWeeklyCompare] = useState<
    Array<{ week: string; Present: number; Late: number; Absent: number }>
  >([]);
  const [checkinDistribution, setCheckinDistribution] = useState<
    Array<{ slot: string; count: number }>
  >([]);
  const [heatmap, setHeatmap] = useState<HeatmapRow[]>([]);
  const [classSummary, setClassSummary] = useState<ClassSummary[]>([]);
  const [studentSummary, setStudentSummary] = useState<StudentSummary[]>([]);

  const classMap = useMemo(() => new Map(classRecords.map((item) => [item.id, item])), [classRecords]);
  const sectionMap = useMemo(() => new Map(sectionRecords.map((item) => [item.id, item])), [sectionRecords]);
  const teacherMap = useMemo(() => new Map(teacherRecords.map((item) => [item.id, item])), [teacherRecords]);

  useEffect(() => {
    let active = true;

    const loadMeta = async () => {
      setLoading(true);
      try {
        const [classes, sections, teachers] = await Promise.all([
          apiRequest<ClassRecord[]>("/classes?limit=200", { auth: "school" }).catch(() => []),
          apiRequest<SectionRecord[]>("/sections?limit=200", { auth: "school" }).catch(() => []),
          apiRequest<TeacherRecord[]>("/users?role=teacher&limit=200", { auth: "school" }).catch(() => [])
        ]);

        if (!active) return;

        setClassRecords(classes);
        setSectionRecords(sections);
        setTeacherRecords(teachers);

        const options = sections.map((section) => {
          const cls = classes.find((item) => item.id === section.class_id);
          const label = cls ? `${cls.name}${section.name}` : section.full_name || section.name;
          return {
            id: section.id,
            label,
            classId: section.class_id,
            sectionId: section.id,
            teacherId: section.class_teacher_id ?? null
          };
        });
        setClassOptions(options);

        const counts = await Promise.all(
          sections.map(async (section) => {
            try {
              const response = await apiRequest<StudentCountResponse>(
                `/students?section_id=${section.id}&limit=1`,
                { auth: "school", returnMeta: true }
              );
              return [section.id, response.meta?.total ?? 0] as const;
            } catch {
              return [section.id, 0] as const;
            }
          })
        );

        if (!active) return;

        const nextCounts: Record<string, number> = {};
        counts.forEach(([id, count]) => {
          nextCounts[id] = count;
        });
        setStudentCounts(nextCounts);
      } catch (error: any) {
        if (active) toast.error(error?.message ?? "Failed to load report metadata");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadMeta();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!classOptions.length) return;
    if (classFilter.length === 0) {
      setClassFilter(classOptions.map((option) => option.id));
    }
  }, [classOptions, classFilter.length]);

  useEffect(() => {
    if (!sectionRecords.length) return;

    let active = true;
    const loadStudents = async () => {
      const selectedSectionIds = classFilter.length
        ? classFilter
        : sectionRecords.map((section) => section.id);

      try {
        const batches = await Promise.all(
          selectedSectionIds.map((sectionId) =>
            apiRequest<ApiStudent[]>(`/students?section_id=${sectionId}&limit=1000`, {
              auth: "school"
            }).catch(() => [])
          )
        );

        if (!active) return;
        const nextStudents = batches.flat().reduce<Record<string, ApiStudent>>((acc, student) => {
          acc[student.id] = student;
          return acc;
        }, {});
        setStudentsById(nextStudents);
      } catch {
        if (active) setStudentsById({});
      }
    };

    loadStudents();
    return () => {
      active = false;
    };
  }, [classFilter, sectionRecords]);

  useEffect(() => {
    if (!sectionRecords.length) return;

    let active = true;
    const loadAttendance = async () => {
      setLoading(true);
      try {
        const dates = listDates(start, end);
        const selectedSectionIds = new Set(
          classFilter.length ? classFilter : sectionRecords.map((section) => section.id)
        );

        const [sessionsByDate, recordsByDate] = await Promise.all([
          Promise.all(
            dates.map((date) =>
              apiRequest<ApiSession[]>(`/attendance/sessions?date=${date}&limit=500`, {
                auth: "school"
              }).catch(() => [])
            )
          ),
          Promise.all(
            dates.map((date) =>
              apiRequest<ApiRecord[]>(`/attendance/records?date=${date}&limit=5000`, {
                auth: "school"
              }).catch(() => [])
            )
          )
        ]);

        if (!active) return;

        const sessionMap = new Map<string, string>();
        sessionsByDate.flat().forEach((session) => {
          sessionMap.set(session.id, session.section_id);
        });

        const recordsWithSection = recordsByDate.flat().map((record) => {
          const sectionId = sessionMap.get(record.session_id);
          return sectionId ? { ...record, sectionId } : null;
        }).filter(Boolean) as Array<ApiRecord & { sectionId: string }>;

        const filteredRecords = recordsWithSection.filter((record) =>
          selectedSectionIds.has(record.sectionId)
        );

        const totals = filteredRecords.reduce(
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

        const totalStudents = Array.from(selectedSectionIds).reduce(
          (sum, id) => sum + (studentCounts[id] ?? 0),
          0
        );

        setSummary({
          totalStudents,
          present: totals.present,
          absent: totals.absent,
          late: totals.late,
          excused: totals.excused,
          totalRecords: totals.total
        });

        setDailyTrend(
          dates.map((date, idx) => {
            const sessionIds = new Set(
              sessionsByDate[idx]
                .filter((session) => selectedSectionIds.has(session.section_id))
                .map((session) => session.id)
            );
            const dayRecords = recordsByDate[idx].filter((record) => sessionIds.has(record.session_id));
            const daySummary = dayRecords.reduce(
              (acc, record) => {
                if (record.status === "present") acc.Present += 1;
                if (record.status === "late") acc.Late += 1;
                if (record.status === "absent") acc.Absent += 1;
                return acc;
              },
              { Present: 0, Late: 0, Absent: 0 }
            );
            return { date, ...daySummary };
          })
        );

        const weekly = getWeekBuckets(dates).map(([week, weekDates]) => {
          const weekRecords = recordsWithSection.filter((record) =>
            selectedSectionIds.has(record.sectionId) && weekDates.includes(record.session_id ? "" : "")
          );
          const summary = weekDates.reduce(
            (acc, date) => {
              const dateIndex = dates.indexOf(date);
              if (dateIndex === -1) return acc;
              const sessionIds = new Set(
                sessionsByDate[dateIndex]
                  .filter((session) => selectedSectionIds.has(session.section_id))
                  .map((session) => session.id)
              );
              const dateRecords = recordsByDate[dateIndex].filter((record) => sessionIds.has(record.session_id));
              dateRecords.forEach((record) => {
                if (record.status === "present") acc.Present += 1;
                if (record.status === "late") acc.Late += 1;
                if (record.status === "absent") acc.Absent += 1;
              });
              return acc;
            },
            { Present: 0, Late: 0, Absent: 0 }
          );
          return { week, ...summary };
        });

        setWeeklyCompare(weekly);

        const distribution = timeBuckets.map((bucket) => ({ slot: bucket.label, count: 0 }));
        filteredRecords.forEach((record) => {
          const stamp = record.scanned_at ?? record.created_at;
          if (!stamp) return;
          const hour = new Date(stamp).getHours();
          const idx = timeBuckets.findIndex((bucket) => hour >= bucket.start && hour < bucket.end);
          const target = idx === -1 ? distribution.length - 1 : idx;
          distribution[target].count += 1;
        });
        setCheckinDistribution(distribution);

        const attendanceBySection: Record<string, { present: number; absent: number; late: number }> = {};
        filteredRecords.forEach((record) => {
          const current = attendanceBySection[record.sectionId] ?? { present: 0, absent: 0, late: 0 };
          if (record.status === "present") current.present += 1;
          if (record.status === "absent") current.absent += 1;
          if (record.status === "late") current.late += 1;
          attendanceBySection[record.sectionId] = current;
        });

        setClassSummary(
          classOptions
            .filter((option) => selectedSectionIds.has(option.sectionId))
            .map((option) => {
              const stats = attendanceBySection[option.sectionId] ?? { present: 0, absent: 0, late: 0 };
              const total = stats.present + stats.absent + stats.late;
              const rate = total ? Math.round((stats.present / total) * 100) : 0;
              const teacherName = option.teacherId ? teacherMap.get(option.teacherId)?.name ?? "Unassigned" : "Unassigned";
              return {
                id: option.sectionId,
                name: option.label,
                teacher: teacherName,
                studentCount: studentCounts[option.sectionId] ?? 0,
                present: stats.present,
                absent: stats.absent,
                late: stats.late,
                rate
              };
            })
        );

        const studentStats = new Map<string, { present: number; absent: number; late: number; sectionId: string }>();
        filteredRecords.forEach((record) => {
          const current = studentStats.get(record.student_id) ?? { present: 0, absent: 0, late: 0, sectionId: record.sectionId };
          if (record.status === "present") current.present += 1;
          if (record.status === "absent") current.absent += 1;
          if (record.status === "late") current.late += 1;
          studentStats.set(record.student_id, current);
        });

        setStudentSummary(
          Array.from(studentStats.entries()).map(([studentId, stats]) => {
            const student = studentsById[studentId];
            const studentName = student
              ? `${student.first_name} ${student.last_name}`.trim()
              : "Unknown student";
            const className = classLabelForSection(stats.sectionId, sectionMap, classMap);
            const total = stats.present + stats.absent + stats.late;
            const rate = total ? Math.round((stats.present / total) * 100) : 0;
            return {
              id: studentId,
              name: studentName,
              className,
              present: stats.present,
              absent: stats.absent,
              late: stats.late,
              rate
            };
          })
        );

        const endDate = new Date(end);
        const startHeatmap = new Date(endDate);
        startHeatmap.setDate(endDate.getDate() - 27);
        const heatmapDates = listDates(startHeatmap.toISOString().slice(0, 10), end);
        const summaryByDate = new Map<string, { present: number; total: number }>();
        heatmapDates.forEach((date, idx) => {
          const dateIndex = dates.indexOf(date);
          if (dateIndex === -1) {
            summaryByDate.set(date, { present: 0, total: 0 });
            return;
          }
          const sessionIds = new Set(
            sessionsByDate[dateIndex]
              .filter((session) => selectedSectionIds.has(session.section_id))
              .map((session) => session.id)
          );
          const dateRecords = recordsByDate[dateIndex].filter((record) => sessionIds.has(record.session_id));
          const total = dateRecords.length;
          const present = dateRecords.filter((record) => isPresentStatus(record.status)).length;
          summaryByDate.set(date, { present, total });
        });

        const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const rows: HeatmapRow[] = dayOrder.map((day, dayIndex) => {
          const cells: HeatmapCell[] = [];
          for (let week = 0; week < 4; week += 1) {
            const cellDate = new Date(startHeatmap);
            cellDate.setDate(startHeatmap.getDate() + week * 7 + dayIndex);
            const key = cellDate.toISOString().slice(0, 10);
            const summary = summaryByDate.get(key) ?? { present: 0, total: 0 };
            const rate = summary.total ? Math.round((summary.present / summary.total) * 100) : 0;
            cells.push({ week: week + 1, rate });
          }
          return { day, cells };
        });

        setHeatmap(rows);
      } catch (error: any) {
        if (active) toast.error(error?.message ?? "Failed to load attendance reports");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadAttendance();
    return () => {
      active = false;
    };
  }, [start, end, classFilter, sectionRecords, classOptions, studentCounts, studentsById, classMap, sectionMap, teacherMap]);

  return (
    <AppLayout title="Reports & Analytics" subtitle="Detailed insights for the selected period">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-3 items-center sticky top-[64px] z-10 backdrop-blur">
        <input type="date" value={start} onChange={e => setStart(e.target.value)} className={inp} />
        <span className="text-muted-foreground text-sm">to</span>
        <input type="date" value={end} onChange={e => setEnd(e.target.value)} className={inp} />
        <ClassMultiSelect value={classFilter} onChange={setClassFilter} />
        <button onClick={() => toast.success("Report regenerated")} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Generate Report</button>
        <button onClick={() => toast.success("PDF export started")} className="h-10 inline-flex items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted">
          <Download className="h-4 w-4" /> Export PDF
        </button>
      </div>

      <div className="mt-5 flex gap-1 border-b border-border">
        {([
          ["overview","Overview"],["class","By Class"],["student","By Student"],["time","By Time"],
        ] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 ${tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "overview" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <KPI label="Total Students" value={STUDENTS.length} />
              <KPI label="Avg Attendance" value="86%" tone="success" />
              <KPI label="Present Days" value="2,418" />
              <KPI label="Absent Days" value="312" tone="destructive" />
              <KPI label="SMS Sent" value={SMS_LOGS.length} tone="primary" />
            </div>
            <Panel title="Daily Attendance Rate (last 30 days)">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={DAILY_TREND}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="Present" stroke="#545f72" fill="#545f7244" />
                  <Area type="monotone" dataKey="Late" stroke="#F59E0B" fill="#F59E0B44" />
                  <Area type="monotone" dataKey="Absent" stroke="#EF4444" fill="#EF444444" />
                </AreaChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Weekly Comparison">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={WEEKLY_COMPARE}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Present" fill="#545f72" />
                  <Bar dataKey="Late" fill="#F59E0B" />
                  <Bar dataKey="Absent" fill="#EF4444" />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
          </>
        )}

        {tab === "class" && <ByClass />}
        {tab === "student" && <ByStudent onNotify={(id) => setComposeFor(id)} />}
        {tab === "time" && <ByTime />}
      </div>

      <SMSComposeModal open={!!composeFor} studentId={composeFor || undefined} onClose={() => setComposeFor(null)} />
    </AppLayout>
  );
}

function ByClass() {
  const [sortKey, setSortKey] = useState<"name" | "rate">("name");
  const [asc, setAsc] = useState(true);
  const data = CLASS_LIST.map(c => {
    const recs = TODAY_ATTENDANCE.filter(a => a.class === c.name);
    const present = recs.filter(r => r.status === "Present").length;
    const absent = recs.filter(r => r.status === "Absent").length;
    const late = recs.filter(r => r.status === "Late").length;
    const rate = recs.length ? Math.round((present / recs.length) * 100) : 0;
    return { ...c, present, absent, late, rate };
  });
  const sorted = [...data].sort((a, b) => {
    const av = sortKey === "name" ? a.name : a.rate;
    const bv = sortKey === "name" ? b.name : b.rate;
    if (av < bv) return asc ? -1 : 1;
    if (av > bv) return asc ? 1 : -1;
    return 0;
  });
  return (
    <>
      <Panel title="Attendance by Class">
        <ResponsiveContainer width="100%" height={420}>
          <BarChart data={data} layout="vertical" margin={{ left: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="present" name="Present" fill="#545f72" />
            <Bar dataKey="absent" name="Absent" fill="#EF4444" />
            <Bar dataKey="late" name="Late" fill="#F59E0B" />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
      <div className="mt-6 rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                {["Class","Teacher","Total","Present","Absent","Late","Rate %","Trend"].map((h, i) => (
                  <th key={h} onClick={() => { if (i === 0 || i === 6) { const k = i === 0 ? "name" : "rate"; setAsc(sortKey === k ? !asc : true); setSortKey(k as any); } }}
                    className={`text-left px-4 py-3 ${(i === 0 || i === 6) ? "cursor-pointer hover:text-foreground" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => (
                <tr key={r.id} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/30">
                  <td className="px-4 py-3 font-semibold">{r.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.teacher}</td>
                  <td className="px-4 py-3">{r.studentCount}</td>
                  <td className="px-4 py-3 text-success font-semibold">{r.present}</td>
                  <td className="px-4 py-3 text-destructive font-semibold">{r.absent}</td>
                  <td className="px-4 py-3 text-amber-600 font-semibold">{r.late}</td>
                  <td className="px-4 py-3"><RateBadge rate={r.rate} /></td>
                  <td className="px-4 py-3 text-xs">{r.rate >= 80 ? "↑ +2.1%" : "↓ -1.4%"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function ByStudent({ onNotify }: { onNotify: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [risk, setRisk] = useState<"all" | "good" | "atrisk" | "critical">("all");
  const filtered = useMemo(() => STUDENTS
    .filter(s => `${s.name} ${studentIdNumber(s)}`.toLowerCase().includes(q.toLowerCase()))
    .filter(s => {
      if (risk === "all") return true;
      if (risk === "good") return s.attendanceRate > 85;
      if (risk === "atrisk") return s.attendanceRate >= 70 && s.attendanceRate <= 85;
      return s.attendanceRate < 70;
    })
    .sort((a, b) => b.attendanceRate - a.attendanceRate), [q, risk]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4 flex flex-wrap gap-2 items-center border-b border-border">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search student by name or Student ID Number…"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" />
        </div>
        {([
          ["all","All"],["good","🟢 Good"],["atrisk","🟡 At Risk"],["critical","🔴 Critical"],
        ] as const).map(([k, l]) => (
          <button key={k} onClick={() => setRisk(k)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold ${risk === k ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>{["#","Student","Class","Present","Absent","Late","Rate %","Risk","Action"].map(h =>
              <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.slice(0, 25).map((s, i) => (
              <tr key={s.id} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/30">
                <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-3 font-medium">{s.name}<div className="text-xs font-normal text-muted-foreground">Student ID Number: {studentIdNumber(s)}</div></td>
                <td className="px-4 py-3">{s.class}</td>
                <td className="px-4 py-3">{Math.round(s.attendanceRate * 0.6)}</td>
                <td className="px-4 py-3">{Math.round((100 - s.attendanceRate) * 0.5)}</td>
                <td className="px-4 py-3">{Math.round((100 - s.attendanceRate) * 0.2)}</td>
                <td className="px-4 py-3"><RateBadge rate={s.attendanceRate} /></td>
                <td className="px-4 py-3"><RiskBadge rate={s.attendanceRate} /></td>
                <td className="px-4 py-3">
                  <button onClick={() => onNotify(s.id)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    <Send className="h-3 w-3" /> Notify Parent
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ByTime() {
  return (
    <>
      <Panel title="Check-in Time Distribution">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={CHECKIN_DISTRIBUTION}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="slot" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#3b5998" />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
      <Panel title="Day-of-week Heatmap">
        <div className="grid gap-2" style={{ gridTemplateColumns: "60px repeat(4, 1fr)" }}>
          <div />
          {[1,2,3,4].map(w => <div key={w} className="text-xs font-semibold text-center text-muted-foreground">Week {w}</div>)}
          {HEATMAP.map(row => (
            <>
              <div key={row.day} className="text-xs font-semibold text-muted-foreground self-center">{row.day}</div>
              {row.cells.map(c => {
                const bg =
                  c.rate > 90 ? "bg-indigo-700" :
                  c.rate > 80 ? "bg-indigo-400" :
                  c.rate > 70 ? "bg-amber-400" :
                  "bg-red-500";
                return (
                  <div key={`${row.day}-${c.week}`}
                    title={`${row.day} Week ${c.week} — ${c.rate}% Present`}
                    className={`h-12 rounded-md ${bg} text-white grid place-items-center text-xs font-bold cursor-help`}>
                    {c.rate}%
                  </div>
                );
              })}
            </>
          ))}
        </div>
        <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
          ⚠️ Mondays have the highest absence rate at 18% — consider parent reminders on Sunday evenings.
        </div>
      </Panel>
    </>
  );
}

function ClassMultiSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="h-10 rounded-lg border border-border px-3 text-sm hover:bg-muted">
        Classes ({value.length})
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-56 rounded-lg border border-border bg-card shadow-lg max-h-64 overflow-y-auto p-2">
          <button onClick={() => onChange(CLASSES)} className="block w-full text-left px-2 py-1 text-xs text-primary hover:underline">Select all</button>
          <button onClick={() => onChange([])} className="block w-full text-left px-2 py-1 text-xs text-destructive hover:underline">Clear</button>
          {CLASSES.map(c => (
            <label key={c} className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted rounded">
              <input type="checkbox" checked={value.includes(c)} onChange={e =>
                onChange(e.target.checked ? [...value, c] : value.filter(x => x !== c))} />
              {c}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, tone = "primary" as const }: { label: string; value: string | number; tone?: "primary" | "success" | "destructive" }) {
  const colors = { primary: "text-primary", success: "text-success", destructive: "text-destructive" };
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="text-xs uppercase font-semibold text-muted-foreground">{label}</div>
      <div className={`font-display text-2xl font-bold mt-2 ${colors[tone]}`}>{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="font-display font-bold mb-3">{title}</h3>
      {children}
    </div>
  );
}

function RateBadge({ rate }: { rate: number }) {
  const cls = rate > 85 ? "bg-success/15 text-success" : rate >= 70 ? "bg-amber-100 text-amber-700" : "bg-destructive/15 text-destructive";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${cls}`}>{rate}%</span>;
}
function RiskBadge({ rate }: { rate: number }) {
  if (rate > 85) return <span className="inline-flex rounded-full bg-success/15 text-success px-2 py-0.5 text-xs font-bold">🟢 Good</span>;
  if (rate >= 70) return <span className="inline-flex rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-bold">🟡 At Risk</span>;
  return <span className="inline-flex rounded-full bg-destructive/15 text-destructive px-2 py-0.5 text-xs font-bold">🔴 Critical</span>;
}

const inp = "h-10 rounded-lg border border-border bg-background px-3 text-sm";
