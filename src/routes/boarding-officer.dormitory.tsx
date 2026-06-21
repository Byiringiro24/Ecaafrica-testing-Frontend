import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { BoardingOfficerLayout } from "@/components/layout/BoardingOfficerLayout";
import { boardingOfficerRouteGuard } from "@/lib/schoolAuth";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { todayIso } from "@/lib/gateKeeperAttendance";

export const Route = createFileRoute("/boarding-officer/dormitory")({
  beforeLoad: ({ location }) => boardingOfficerRouteGuard(location),
  component: BoardingOfficerDormitoryPage,
});

type ApiStudent = {
  id: string;
  first_name: string;
  last_name: string;
  student_id_number?: string | null;
  current_section?: {
    id?: string;
    name?: string;
    full_name?: string;
    class_id?: string;
  } | null;
};

type DormitoryRecord = {
  id: string;
  name: string;
};

type DormAssignment = {
  id: string;
  student_id: string;
  dormitory_id: string;
  dormitory?: { name?: string | null } | null;
};

type LeaveRecord = {
  student_id: string;
  status: string;
  start_date: string;
  end_date: string;
  returned_at?: string | null;
};

type ApiRecord = {
  student_id: string;
  status: string;
  session_id: string;
};

type ApiSession = {
  id: string;
  session_type?: string | null;
};

type StudentRow = {
  id: string;
  name: string;
  className: string;
  dormName: string;
  status: "Present" | "On Leave" | "Absent";
};

const STATUS_STYLES: Record<StudentRow["status"], string> = {
  Present: "bg-success/15 text-success",
  "On Leave": "bg-amber-100 text-amber-700",
  Absent: "bg-destructive/15 text-destructive",
};

function BoardingOfficerDormitoryPage() {
  const today = todayIso();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<ApiStudent[]>([]);
  const [dormitories, setDormitories] = useState<DormitoryRecord[]>([]);
  const [assignments, setAssignments] = useState<DormAssignment[]>([]);
  const [classRecords, setClassRecords] = useState<{ id: string; name: string }[]>([]);
  const [leaveIds, setLeaveIds] = useState<Set<string>>(new Set());
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set());
  const [classFilter, setClassFilter] = useState("All");
  const [dormFilter, setDormFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"All" | StudentRow["status"]>("All");
  const [search, setSearch] = useState("");

  const classLabel = useCallback(
    (student: ApiStudent) =>
      student.current_section?.full_name ?? student.current_section?.name ?? "—",
    []
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [studentList, dormList, assignmentList, classes, leaves, sessions, records] =
          await Promise.all([
            apiRequest<ApiStudent[]>("/students?student_type=boarding&limit=2000", {
              auth: "school",
            }),
            apiRequest<DormitoryRecord[]>("/boarding/dormitories?limit=100", { auth: "school" }),
            apiRequest<DormAssignment[]>("/boarding/assignments?is_active=true&limit=2000", {
              auth: "school",
            }),
            apiRequest<{ id: string; name: string }[]>("/classes?limit=200", { auth: "school" }),
            apiRequest<LeaveRecord[]>("/boarding/student-leaves?limit=1000", { auth: "school" }),
            apiRequest<ApiSession[]>(`/attendance/sessions?date=${today}&limit=500`, {
              auth: "school",
            }),
            apiRequest<ApiRecord[]>(`/attendance/records?date=${today}&limit=5000`, {
              auth: "school",
            }),
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
              (s) =>
                s.session_type === "boarding_morning" || s.session_type === "boarding_evening"
            )
            .map((s) => s.id)
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
                (r) =>
                  boardingSessionIds.has(r.session_id) &&
                  (r.status === "present" || r.status === "late" || r.status === "excused")
              )
              .map((r) => r.student_id)
          )
        );
      } catch (error: any) {
        toast.error(error?.message ?? "Failed to load dormitory status");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [today]);

  const assignmentByStudent = useMemo(() => {
    const map = new Map<string, DormAssignment>();
    assignments.forEach((a) => map.set(a.student_id, a));
    return map;
  }, [assignments]);

  const dormNameById = useMemo(() => {
    return new Map(dormitories.map((d) => [d.id, d.name]));
  }, [dormitories]);

  const displayRows = useMemo<StudentRow[]>(() => {
    return students.map((student) => {
      const assignment = assignmentByStudent.get(student.id);
      const dormName =
        assignment?.dormitory?.name ??
        (assignment ? dormNameById.get(assignment.dormitory_id) : undefined) ??
        "Unassigned";

      let status: StudentRow["status"] = "Absent";
      if (leaveIds.has(student.id)) status = "On Leave";
      else if (presentIds.has(student.id)) status = "Present";

      return {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`.trim(),
        className: classLabel(student),
        dormName,
        status,
      };
    });
  }, [students, assignmentByStudent, dormNameById, classLabel, leaveIds, presentIds]);

  const stats = useMemo(() => {
    const total = displayRows.length;
    const onLeave = displayRows.filter((r) => r.status === "On Leave").length;
    const present = displayRows.filter((r) => r.status === "Present").length;
    const absent = displayRows.filter((r) => r.status === "Absent").length;
    return { total, present, onLeave, absent };
  }, [displayRows]);

  const filtered = useMemo(() => {
    return displayRows.filter((row) => {
      const student = students.find((s) => s.id === row.id);
      const classId = student?.current_section?.class_id;
      const assignment = assignmentByStudent.get(row.id);
      const matchesClass = classFilter === "All" || classId === classFilter;
      const matchesDorm = dormFilter === "All" || assignment?.dormitory_id === dormFilter;
      const matchesStatus = statusFilter === "All" || row.status === statusFilter;
      const target = `${row.name} ${row.className} ${row.dormName}`.toLowerCase();
      const matchesSearch = search === "" || target.includes(search.toLowerCase());
      return matchesClass && matchesDorm && matchesStatus && matchesSearch;
    });
  }, [displayRows, students, classFilter, dormFilter, statusFilter, search, assignmentByStudent]);

  return (
    <BoardingOfficerLayout
      title="Dormitory Status"
      subtitle="Monitor boarding students present, on leave, and absent"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {loading ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : (
          <>
            <StatCard label="Total Boarders" value={stats.total} tone="primary" />
            <StatCard label="Present in Dorm" value={stats.present} tone="success" />
            <StatCard label="On Approved Leave" value={stats.onLeave} tone="warning" />
            <StatCard label="Absent" value={stats.absent} tone="destructive" />
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
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "All" | StudentRow["status"])}
            className="mt-1 h-9 block rounded-md border border-input bg-background px-3 text-sm min-w-32"
          >
            <option value="All">All</option>
            <option value="Present">Present</option>
            <option value="On Leave">On Leave</option>
            <option value="Absent">Absent</option>
          </select>
        </div>
        <div className="relative flex-1 min-w-55">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student…"
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                {["Student", "Class", "Dormitory", "Status"].map((h) => (
                  <th key={h} className="text-left px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Loading dormitory status…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No students match the selected filters.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-border odd:bg-background even:bg-muted/20"
                  >
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3">{row.className}</td>
                    <td className="px-4 py-3">{row.dormName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLES[row.status]}`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </BoardingOfficerLayout>
  );
}
