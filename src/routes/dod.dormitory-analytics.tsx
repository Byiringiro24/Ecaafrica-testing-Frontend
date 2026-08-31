import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { DodLayout } from "@/components/layout/DodLayout";
import { dodRouteGuard } from "@/lib/schoolAuth";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { todayIso } from "@/lib/gateKeeperAttendance";

export const Route = createFileRoute("/dod/dormitory-analytics")({
  beforeLoad: ({ location }) => dodRouteGuard(location),
  component: DodDormitoryAnalyticsPage,
});

type ApiStudent = {
  id: string;
  first_name: string;
  last_name: string;
  gender?: string | null;
  current_section?: { id?: string; name?: string; full_name?: string; class_id?: string } | null;
};

type DormitoryRecord = {
  id: string;
  name: string;
  gender?: string | null;
  capacity?: number | null;
};

type DormAssignment = {
  id: string;
  student_id: string;
  dormitory_id: string;
};

type LeaveRecord = {
  student_id: string;
  status: string;
  start_date: string;
  end_date: string;
  returned_at?: string | null;
};

type ApiRecord = { student_id: string; status: string; session_id: string };
type ApiSession = { id: string; session_type?: string | null };
type ClassRecord = { id: string; name: string };

const DORM_COLORS = ["#3b5998", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#64748B", "#0EA5E9", "#EC4899"];
const STATUS_COLORS = { Present: "#22C55E", "On Leave": "#F59E0B", Absent: "#EF4444" };
const UNASSIGNED = "Unassigned";

function DodDormitoryAnalyticsPage() {
  const today = todayIso();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<ApiStudent[]>([]);
  const [dormitories, setDormitories] = useState<DormitoryRecord[]>([]);
  const [assignments, setAssignments] = useState<DormAssignment[]>([]);
  const [classRecords, setClassRecords] = useState<ClassRecord[]>([]);
  const [leaveIds, setLeaveIds] = useState<Set<string>>(new Set());
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [studentList, dormList, assignmentList, classes, leaves, sessions, records] =
        await Promise.all([
          apiRequest<ApiStudent[]>("/students?student_type=boarding&limit=2000", { auth: "school" }),
          apiRequest<DormitoryRecord[]>("/boarding/dormitories?limit=100", { auth: "school" }),
          apiRequest<DormAssignment[]>("/boarding/assignments?is_active=true&limit=2000", {
            auth: "school",
          }),
          apiRequest<ClassRecord[]>("/classes?limit=200", { auth: "school" }),
          apiRequest<LeaveRecord[]>("/boarding/student-leaves?limit=1000", { auth: "school" }),
          apiRequest<ApiSession[]>(`/attendance/sessions?date=${today}&limit=500`, { auth: "school" }),
          apiRequest<ApiRecord[]>(`/attendance/records?date=${today}&limit=5000`, { auth: "school" }),
        ]);

      setStudents(Array.isArray(studentList) ? studentList : []);
      setDormitories(Array.isArray(dormList) ? dormList : []);
      setAssignments(Array.isArray(assignmentList) ? assignmentList : []);
      setClassRecords(Array.isArray(classes) ? classes : []);

      const leaveList = Array.isArray(leaves) ? leaves : [];
      const sessionList = Array.isArray(sessions) ? sessions : [];
      const recordList = Array.isArray(records) ? records : [];

      const boardingSessionIds = new Set(
        sessionList
          .filter(
            (session) =>
              session.session_type === "boarding_morning" ||
              session.session_type === "boarding_evening"
          )
          .map((session) => session.id)
      );

      setLeaveIds(
        new Set(
          leaveList
            .filter(
              (leave) =>
                leave.status === "approved" &&
                !leave.returned_at &&
                leave.start_date <= today &&
                leave.end_date >= today
            )
            .map((leave) => leave.student_id)
        )
      );

      setPresentIds(
        new Set(
          recordList
            .filter(
              (record) =>
                boardingSessionIds.has(record.session_id) &&
                (record.status === "present" ||
                  record.status === "late" ||
                  record.status === "excused")
            )
            .map((record) => record.student_id)
        )
      );
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load dormitory analytics");
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const dormById = useMemo(
    () => new Map(dormitories.map((dormitory) => [dormitory.id, dormitory])),
    [dormitories]
  );

  const dormIdByStudent = useMemo(() => {
    const map = new Map<string, string>();
    assignments.forEach((assignment) => map.set(assignment.student_id, assignment.dormitory_id));
    return map;
  }, [assignments]);

  const occupancyData = useMemo(
    () =>
      dormitories.map((dormitory) => {
        const assigned = assignments.filter((a) => a.dormitory_id === dormitory.id).length;
        const capacity = dormitory.capacity ?? 0;
        return {
          name: dormitory.name,
          assigned,
          capacity,
          fill: capacity > 0 ? Math.round((assigned / capacity) * 100) : 0,
        };
      }),
    [dormitories, assignments]
  );

  const statusData = useMemo(() => {
    let present = 0;
    let onLeave = 0;
    let absent = 0;

    students.forEach((student) => {
      if (leaveIds.has(student.id)) onLeave += 1;
      else if (presentIds.has(student.id)) present += 1;
      else absent += 1;
    });

    return [
      { name: "Present", value: present },
      { name: "On Leave", value: onLeave },
      { name: "Absent", value: absent },
    ];
  }, [students, leaveIds, presentIds]);

  const classDistribution = useMemo(() => {
    const classNameById = new Map(classRecords.map((cls) => [cls.id, cls.name]));
    const rows = new Map<string, Record<string, number | string>>();

    students.forEach((student) => {
      const classId = student.current_section?.class_id;
      const className =
        (classId ? classNameById.get(classId) : null) ??
        student.current_section?.full_name ??
        "Unknown";
      const dormId = dormIdByStudent.get(student.id);
      const dormName = dormId ? dormById.get(dormId)?.name ?? UNASSIGNED : UNASSIGNED;

      const row = rows.get(className) ?? { name: className };
      row[dormName] = ((row[dormName] as number) ?? 0) + 1;
      rows.set(className, row);
    });

    return Array.from(rows.values());
  }, [students, classRecords, dormIdByStudent, dormById]);

  const genderData = useMemo(
    () =>
      dormitories.map((dormitory) => {
        const members = students.filter(
          (student) => dormIdByStudent.get(student.id) === dormitory.id
        );
        return {
          name: dormitory.name,
          male: members.filter((s) => s.gender === "male").length,
          female: members.filter((s) => s.gender === "female").length,
        };
      }),
    [dormitories, students, dormIdByStudent]
  );

  const stackKeys = useMemo(
    () => [...dormitories.map((dormitory) => dormitory.name), UNASSIGNED],
    [dormitories]
  );

  const totals = useMemo(() => {
    const capacity = dormitories.reduce((sum, d) => sum + (d.capacity ?? 0), 0);
    const assigned = assignments.length;
    return {
      boarders: students.length,
      dormitories: dormitories.length,
      assigned,
      unassigned: students.length - assigned,
      capacity,
      utilisation: capacity > 0 ? Math.round((assigned / capacity) * 100) : 0,
    };
  }, [students, dormitories, assignments]);

  if (loading) {
    return (
      <DodLayout
        title="Dormitory Analytics"
        subtitle="Occupancy, status and distribution across boarding houses"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </DodLayout>
    );
  }

  return (
    <DodLayout
      title="Dormitory Analytics"
      subtitle="Occupancy, status and distribution across boarding houses"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total Boarders" value={totals.boarders} tone="primary" />
        <StatCard label="Assigned to a Dorm" value={totals.assigned} tone="success" />
        <StatCard label="Not Yet Assigned" value={totals.unassigned} tone="warning" />
        <StatCard label="Bed Utilisation" value={`${totals.utilisation}%`} tone="primary" />
      </div>

      {dormitories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <p className="font-semibold">No dormitories yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a dormitory on the Dormitory Status page to see occupancy charts here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="font-semibold mb-1">Occupancy vs capacity</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Assigned students against available beds per dormitory.
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={occupancyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="assigned" name="Assigned" fill="#3b5998" radius={[4, 4, 0, 0]} />
                <Bar dataKey="capacity" name="Capacity" fill="#94A3B8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="font-semibold mb-1">Today's boarder status</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Present, on approved leave, or unaccounted for.
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {statusData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={STATUS_COLORS[entry.name as keyof typeof STATUS_COLORS]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="font-semibold mb-1">Class distribution per dormitory</h3>
            <p className="text-sm text-muted-foreground mb-4">
              How each class's boarders are spread across houses.
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={classDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                {stackKeys.map((key, index) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="dorms"
                    fill={key === UNASSIGNED ? "#CBD5E1" : DORM_COLORS[index % DORM_COLORS.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="font-semibold mb-1">Gender split per dormitory</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Any bar showing both colours indicates a mismatched placement.
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={genderData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="male" name="Male" fill="#3b5998" radius={[4, 4, 0, 0]} />
                <Bar dataKey="female" name="Female" fill="#EC4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </DodLayout>
  );
}
