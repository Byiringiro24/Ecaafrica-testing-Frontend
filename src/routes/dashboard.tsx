import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Wifi,
  WifiOff,
  MapPin,
  GraduationCap,
  ClipboardCheck,
  ClipboardX,
  Moon,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Avatar } from "@/components/ui-kit/Avatar";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { localDateInputValue } from "@/lib/dateInput";
import { fetchDeviceLogs, fetchTodayAttendance } from "@/lib/device-logs-api";
import type { DeviceLog } from "@/lib/device-logs-types";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

const PIE_COLORS = [
  "#3b5998","#545f72","#F59E0B","#EF4444","#0EA5E9","#A855F7",
  "#14B8A6","#F97316","#6366F1","#22C55E","#EAB308","#F43F5E",
];

type ApiRecord = {
  id: string;
  session_id: string;
  student_id: string;
  status: "present" | "absent" | "late" | "excused";
  scanned_at?: string | null;
  created_at?: string | null;
};

type ApiSession = {
  id: string;
  section_id: string;
  session_date: string;
  session_type?: "class" | "gate" | "boarding_morning" | "boarding_evening";
  teacher_id?: string | null;
};

type ApiStudent = {
  id: string;
  first_name: string;
  last_name: string;
  student_id_number?: string | null;
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
};

type StudentCountResponse = {
  data: unknown[];
  meta?: { total?: number };
};

type RecentCheckin = {
  id: string;
  name: string;
  className: string;
  time: string;
  status: "Present" | "Absent" | "Late" | "Excused";
};

type AbsenceAlert = {
  id: string;
  name: string;
  className: string;
  daysMissed: number;
};

type DeviceRecord = {
  id: string;
  name: string;
  device_uid: string;
  location?: string | null;
  mode?: string | null;
  type?: string | null;
  is_active?: boolean;
  last_seen_at?: string | null;
};

const deviceStatusLabel = (status?: string | null): RecentCheckin["status"] => {
  switch ((status ?? "").toLowerCase()) {
    case "late":
      return "Late";
    case "absent":
      return "Absent";
    case "excused":
      return "Excused";
    default:
      return "Present";
  }
};

const deviceStudentKey = (log: DeviceLog) => log.studentId || log.studentName;

const fetchAllDeviceLogsForDate = async (date: string) => {
  const firstPage = await fetchDeviceLogs({ page: 1, limit: 200, startDate: date, endDate: date });
  const pages = await Promise.all(
    Array.from({ length: Math.max(0, firstPage.meta.totalPages - 1) }, (_, index) =>
      fetchDeviceLogs({
        page: index + 2,
        limit: 200,
        startDate: date,
        endDate: date,
      })
    )
  );
  return [firstPage.data, ...pages.map((page) => page.data)].flat();
};

const summarizeDeviceAttendance = (logs: DeviceLog[], totalStudents: number) => {
  const latestByStudent = new Map<string, DeviceLog>();
  logs.forEach((log) => {
    const key = deviceStudentKey(log);
    if (!key || !latestByStudent.has(key)) latestByStudent.set(key, log);
  });

  let present = 0;
  let late = 0;
  let explicitAbsent = 0;
  latestByStudent.forEach((log) => {
    const status = (log.status ?? "").toLowerCase();
    if (status === "late") late += 1;
    else if (status === "absent") explicitAbsent += 1;
    else if (status === "present" || status === "excused" || status === "still at school") present += 1;
  });

  return {
    total: totalStudents,
    present,
    late,
    absent: Math.max(explicitAbsent, totalStudents - present - late),
  };
};

const isEveningDeviceLog = (log: DeviceLog) => {
  if (/evening|night/i.test(`${log.sessionName ?? ""} ${log.statusLabel ?? ""}`)) return true;

  const timestamp = new Date(log.timestamp);
  return !Number.isNaN(timestamp.getTime()) && timestamp.getHours() >= 15;
};

const formatTime = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
};

const formatDayLabel = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" });

const formatDateKey = (value: Date) => {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
};

const isSchoolDayDate = (value: string) => {
  const day = new Date(`${value}T12:00:00`).getDay();
  return day >= 1 && day <= 5;
};

const getCurrentSchoolWeekDates = (value: string) => {
  const base = new Date(`${value}T12:00:00`);
  const mondayOffset = base.getDay() === 0 ? -6 : 1 - base.getDay();
  base.setDate(base.getDate() + mondayOffset);

  return Array.from({ length: 5 }, (_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() + index);
    return formatDateKey(date);
  });
};

const classLabelForSection = (
  sectionId: string | undefined,
  sectionMap: Map<string, SectionRecord>,
  classMap: Map<string, ClassRecord>
) => {
  if (!sectionId) return "—";
  const section = sectionMap.get(sectionId);
  if (!section) return "—";
  const cls = classMap.get(section.class_id);
  if (cls) return `${cls.name}${section.name}`;
  return section.full_name || section.name;
};

const fetchStudentsForSections = async (sectionIds: string[]) => {
  if (!sectionIds.length) return {} as Record<string, ApiStudent>;
  const batches = await Promise.all(
    sectionIds.map((sectionId) =>
      apiRequest<ApiStudent[]>(`/students?section_id=${sectionId}&limit=1000`, {
        auth: "school"
      }).catch(() => [])
    )
  );
  const all = batches.flat();
  return all.reduce<Record<string, ApiStudent>>((acc, student) => {
    acc[student.id] = student;
    return acc;
  }, {});
};

function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ total: 0, present: 0, eveningPresent: 0, absent: 0, late: 0 });
  const [classAttendance, setClassAttendance] = useState({ teachers: 0, present: 0, absent: 0 });
  const [weekAttendance, setWeekAttendance] = useState<
    Array<{ day: string; Present: number; Absent: number; Late: number }>
  >([]);
  const [classPie, setClassPie] = useState<Array<{ name: string; value: number }>>([]);
  const [recentCheckins, setRecentCheckins] = useState<RecentCheckin[]>([]);
  const [absenceAlerts, setAbsenceAlerts] = useState<AbsenceAlert[]>([]);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const pct = (n: number) => (counts.total ? ((n / counts.total) * 100).toFixed(0) : "0");

  const activeDevices = devices.filter((device) => device.is_active !== false);
  const offlineDevices = devices.filter((device) => device.is_active === false);

  const deviceLocationRows = Array.from(
    devices.reduce((acc, device) => {
      const key = (device.location?.trim() || device.mode?.trim() || "Unknown location").toLowerCase();
      const current = acc.get(key) ?? { label: device.location?.trim() || device.mode?.trim() || "Unknown location", active: 0, offline: 0 };
      if (device.is_active === false) current.offline += 1;
      else current.active += 1;
      acc.set(key, current);
      return acc;
    }, new Map<string, { label: string; active: number; offline: number }>()
  ).values()).sort((a, b) => a.label.localeCompare(b.label));

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const today = localDateInputValue();
        const [studentMeta, todayDeviceLogs, classes, sections, sessions, records, deviceList] = await Promise.all([
          apiRequest<StudentCountResponse>("/students?limit=1", {
            auth: "school",
            returnMeta: true
          }).catch(() => ({ data: [], meta: { total: 0 } })),
          fetchTodayAttendance().catch(() => ({ data: [] as DeviceLog[] })),
          apiRequest<ClassRecord[]>("/classes?limit=200", { auth: "school" }).catch(() => []),
          apiRequest<SectionRecord[]>("/sections?limit=200", { auth: "school" }).catch(() => []),
          apiRequest<ApiSession[]>(`/attendance/sessions?date=${today}&limit=500`, {
            auth: "school"
          }).catch(() => []),
          apiRequest<ApiRecord[]>(`/attendance/records?date=${today}&limit=5000`, {
            auth: "school"
          }).catch(() => []),
          apiRequest<DeviceRecord[]>("/devices?limit=500&sort=created_at&order=desc", {
            auth: "school"
          }).catch(() => [])
        ]);

        if (!active) return;

        setDevices(Array.isArray(deviceList) ? deviceList : []);

        const isSchoolDay = isSchoolDayDate(today);
        const todayDeviceLogData = isSchoolDay ? todayDeviceLogs.data : [];

        const classMap = new Map(classes.map((item) => [item.id, item]));
        const sectionMap = new Map(sections.map((item) => [item.id, item]));
        // Class attendance is separate from gate/boarding sessions. Keep these
        // cards based only on sessions teachers use to mark class attendance.
        const classSessions = sessions.filter((session) => !session.session_type || session.session_type === "class");
        const classSessionIds = new Set(classSessions.map((session) => session.id));
        const classRecords = isSchoolDay
          ? records.filter((record) => classSessionIds.has(record.session_id))
          : [];
        const schoolDaySessions = isSchoolDay ? classSessions : [];
        const teacherIds = new Set(
          schoolDaySessions.map((session) => session.teacher_id).filter((teacherId): teacherId is string => Boolean(teacherId))
        );
        setClassAttendance({
          teachers: teacherIds.size,
          present: classRecords.filter((record) => record.status === "present").length,
          absent: classRecords.filter((record) => record.status === "absent").length,
        });

        const sessionMap = new Map(classSessions.map((item) => [item.id, item.section_id]));

        const totalStudents = studentMeta.meta?.total || records.length;
        const eveningDeviceLogs = todayDeviceLogData.filter(isEveningDeviceLog);
        const eveningSummary = summarizeDeviceAttendance(eveningDeviceLogs, totalStudents);
        setCounts(
          isSchoolDay
            ? { ...summarizeDeviceAttendance(todayDeviceLogData, totalStudents), eveningPresent: eveningSummary.present }
            : { total: totalStudents, present: 0, eveningPresent: 0, absent: 0, late: 0 }
        );

        const weekDates = getCurrentSchoolWeekDates(today);
        const weekDeviceLogs = await Promise.all(
          weekDates.map((date) =>
            date > today
              ? Promise.resolve([] as DeviceLog[])
              : date === today
                ? Promise.resolve(todayDeviceLogData)
                : fetchAllDeviceLogsForDate(date).catch(() => [])
          )
        );

        if (!active) return;

        setWeekAttendance(
          weekDates.map((date, idx) => {
            if (date > today) {
              return { day: formatDayLabel(date), Present: 0, Absent: 0, Late: 0 };
            }
            const daySummary = summarizeDeviceAttendance(weekDeviceLogs[idx], totalStudents);
            return {
              day: formatDayLabel(date),
              Present: daySummary.present,
              Absent: daySummary.absent,
              Late: daySummary.late
            };
          })
        );

        // Device logs include the class/section captured at scan time. Count each
        // student once so repeated scans do not inflate the class breakdown.
        const studentsByClass = new Map<string, Set<string>>();
        todayDeviceLogData.forEach((log) => {
          if ((log.status ?? "").toLowerCase() === "absent") return;
          const className = log.className || log.section || "Unknown class";
          const students = studentsByClass.get(className) ?? new Set<string>();
          students.add(deviceStudentKey(log));
          studentsByClass.set(className, students);
        });

        setClassPie(
          Array.from(studentsByClass.entries()).map(([name, students]) => ({ name, value: students.size }))
        );

        setRecentCheckins(
          todayDeviceLogData.slice(0, 6).map((log) => {
            return {
              id: log.id,
              name: log.studentName || "Unknown student",
              className: log.className || log.section || "Unknown class",
              time: formatTime(log.timestamp),
              status: deviceStatusLabel(log.status)
            };
          })
        );

        const deviceAbsenceAlerts = Array.from(
          todayDeviceLogData
            .filter((log) => (log.status ?? "").toLowerCase() === "absent")
            .reduce((alerts, log) => {
              alerts.set(deviceStudentKey(log), {
                id: deviceStudentKey(log),
                name: log.studentName || "Unknown student",
                className: log.className || log.section || "Unknown class",
                daysMissed: 1
              });
              return alerts;
            }, new Map<string, AbsenceAlert>())
            .values()
        );

        if (deviceAbsenceAlerts.length) {
          setAbsenceAlerts(deviceAbsenceAlerts.slice(0, 5));
        } else {
          const sectionIds = Array.from(new Set(schoolDaySessions.map((item) => item.section_id)));
          const studentsById = await fetchStudentsForSections(sectionIds);
          setAbsenceAlerts(
              classRecords
              .filter((record) => record.status === "absent")
              .slice(0, 5)
              .map((record) => {
                const student = studentsById[record.student_id];
                const sectionId = sessionMap.get(record.session_id);
                return {
                  id: record.student_id,
                  name: student ? `${student.first_name} ${student.last_name}`.trim() : "Unknown student",
                  className: classLabelForSection(sectionId, sectionMap, classMap),
                  daysMissed: 1
                };
              })
          );
        }
      } catch (error: any) {
        if (active) {
          toast.error(error?.message ?? "Failed to load dashboard data");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <AppLayout
      title="Dashboard Overview"
      subtitle="Real-time attendance insights for your school"
    >
      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Students" value={counts.total} icon={<Users className="h-5 w-5" />} trend="" tone="primary" />
            <StatCard label="Present Today" value={counts.present} icon={<CheckCircle2 className="h-5 w-5" />} trend={`${pct(counts.present)}% of total`} tone="success" />
            <StatCard label="Absent Today" value={counts.absent} icon={<XCircle className="h-5 w-5" />} trend={`${pct(counts.absent)}% of total`} tone="destructive" />
            <StatCard label="Late Arrivals" value={counts.late} icon={<Clock className="h-5 w-5" />} trend={`${pct(counts.late)}% of total`} tone="warning" />
            <StatCard label="Total Present Students" value={counts.present} icon={<CheckCircle2 className="h-5 w-5" />} trend="Entry device attendance" tone="success" />
            <StatCard label="Total Present Students" value={counts.eveningPresent} icon={<Moon className="h-5 w-5" />} trend="Exit device attendance" tone="primary" />
            <StatCard label="Teachers Taking Attendance" value={classAttendance.teachers} icon={<GraduationCap className="h-5 w-5" />} trend="Class attendance today" tone="primary" />
            <StatCard label="Class Present Attendance" value={classAttendance.present} icon={<ClipboardCheck className="h-5 w-5" />} trend="Student records marked present" tone="success" />
            <StatCard label="Class Absent Attendance" value={classAttendance.absent} icon={<ClipboardX className="h-5 w-5" />} trend="Student records marked absent" tone="destructive" />
          </div>

          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mt-6">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-lg">This Week's Attendance</h3>
                <span className="text-xs text-muted-foreground">Mon – Fri</span>
              </div>
              <div className="h-72">
                <ResponsiveContainer>
                  <BarChart data={weekAttendance} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Present" fill="#545f72" radius={[6,6,0,0]} />
                    <Bar dataKey="Absent" fill="#EF4444" radius={[6,6,0,0]} />
                    <Bar dataKey="Late" fill="#F59E0B" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="font-display font-bold text-lg mb-4">Attendance by Class Today</h3>
              <div className="h-72">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={classPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                      {classPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="mt-6 hidden">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display font-bold text-lg">Device Status</h3>
                <p className="text-xs text-muted-foreground mt-1">Active and offline devices by location</p>
              </div>
              <span className="text-xs text-muted-foreground">{devices.length} devices</span>
            </div>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              <StatCard
                label="Active Devices"
                value={activeDevices.length}
                icon={<Wifi className="h-5 w-5" />}
                trend="Online and reachable"
                tone="success"
              />
              <StatCard
                label="Offline Devices"
                value={offlineDevices.length}
                icon={<WifiOff className="h-5 w-5" />}
                trend="Not currently connected"
                tone="destructive"
              />
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-muted-foreground truncate text-xs uppercase tracking-wider">Device Locations</p>
                    <p className="font-display font-bold truncate text-3xl mt-2">{deviceLocationRows.length}</p>
                    <p className="text-xs text-muted-foreground mt-1.5 truncate">Gate, dormitory, classroom and more</p>
                  </div>
                  <div className="grid shrink-0 place-items-center rounded-lg h-11 w-11 bg-primary/10 text-primary">
                    <MapPin className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {deviceLocationRows.slice(0, 4).map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-xs">
                      <span className="font-semibold truncate">{row.label}</span>
                      <span className="text-muted-foreground shrink-0">A {row.active} / O {row.offline}</span>
                    </div>
                  ))}
                  {deviceLocationRows.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                      No devices registered yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mt-6">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="font-display font-bold text-lg mb-4">Recent Check-ins</h3>
              <div className="space-y-2">
                {recentCheckins.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/60 transition-colors">
                    <Avatar name={c.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.className} • {c.time}</p>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-lg">Absence Alerts</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-destructive font-semibold">
                  {absenceAlerts.length} students
                </span>
              </div>
              <div className="space-y-2">
                  {absenceAlerts.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                    <Avatar name={a.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.className} • {a.daysMissed} {a.daysMissed === 1 ? "day" : "days"} missed</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-8 w-16" />
            <Skeleton className="mt-3 h-5 w-28 rounded-full" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mt-6">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-72 w-full" />
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <Skeleton className="h-5 w-48 mb-4" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mt-6">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <Skeleton className="h-5 w-40 mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 min-w-0">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="mt-2 h-3 w-20" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 min-w-0">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="mt-2 h-3 w-28" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
