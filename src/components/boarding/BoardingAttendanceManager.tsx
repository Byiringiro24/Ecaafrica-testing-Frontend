import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, Search, Users, Wifi } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { deviceLocationApi } from "@/lib/boardingApi";
import { fetchDeviceLogs } from "@/lib/device-logs-api";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";

type Dormitory = { id: string; name: string; gender?: string; capacity?: number };
type Status = "present" | "absent" | "late" | "on_leave" | "not_scheduled";
type RollCall = { id: string; dormitory_id: string; roll_date: string; session_type: "morning" | "evening"; submitted_at?: string | null };
type Student = { id: string; first_name: string; last_name: string; student_id_number?: string | null; gender?: string | null; room?: { room_number?: string | null } | null; record?: { id: string; status: Status; notes?: string | null } | null };
type Roster = { roll_call: RollCall; dormitory: Dormitory; students: Student[] };
type BoardingStudent = { id: string; first_name: string; last_name: string; student_id_number?: string | null; gender?: string | null };
type DormAssignment = { student_id: string; room?: { room_number?: string | null } | null; student?: BoardingStudent | null };
type DeviceAttendance = { id: string; name?: string; device_uid?: string; device_id?: string; location_label?: string | null };

const statusLabel: Record<Status, string> = { present: "Present", absent: "Absent", late: "Late", on_leave: "On leave", not_scheduled: "Not scheduled" };
const today = () => new Date().toISOString().slice(0, 10);
const isStudyDay = (value: string) => {
  const day = new Date(`${value}T00:00:00Z`).getUTCDay();
  return day >= 1 && day <= 5;
};

export function BoardingAttendanceManager({ canEdit: _canEdit = false }: { canEdit?: boolean }) {
  const [date, setDate] = useState(today());
  const [sessionType, setSessionType] = useState<"morning" | "evening">("morning");
  const [dormitoryId, setDormitoryId] = useState("");
  const [dormitories, setDormitories] = useState<Dormitory[]>([]);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [deviceCount, setDeviceCount] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);

  const loadDormitories = async () => {
    const data = await apiRequest<Dormitory[]>("/boarding/dormitories?limit=500", { auth: "school" });
    const list = Array.isArray(data) ? data : [];
    setDormitories(list);
    if (!dormitoryId && list[0]) setDormitoryId(list[0].id);
  };

  const loadDeviceAttendance = async (nextRoster: Roster) => {
    const response = await deviceLocationApi.list({ dormitory_id: dormitoryId, location_scope: "dormitory" });
    const devices = Array.isArray(response) ? response as DeviceAttendance[] : [];
    setDeviceCount(devices.length);
    if (!isStudyDay(date)) {
      const weekendStatuses: Record<string, Status> = {};
      nextRoster.students.forEach((student) => { weekendStatuses[student.id] = "not_scheduled"; });
      setStatuses(weekendStatuses);
      return;
    }
    const logs = (await Promise.all(devices.map(async (device) => {
      // attendance_logs.device_id stores the numeric device primary key.
      const deviceId = device.id ?? device.device_id ?? device.device_uid;
      if (!deviceId) return [];
      try {
        const firstPage = await fetchDeviceLogs({ page: 1, limit: 200, startDate: date, endDate: date, deviceId });
        if (firstPage.meta.totalPages <= 1) return firstPage.data;
        const remaining = await Promise.all(Array.from({ length: firstPage.meta.totalPages - 1 }, (_, index) => fetchDeviceLogs({ page: index + 2, limit: 200, startDate: date, endDate: date, deviceId }).then((page) => page.data).catch(() => [])));
        return [firstPage.data, ...remaining].flat();
      } catch { return []; }
    }))).flat();

    const studentKeys = new Map<string, string>();
    nextRoster.students.forEach((student) => {
      studentKeys.set(student.id, student.id);
      if (student.student_id_number) studentKeys.set(student.student_id_number, student.id);
    });
    const scanned = new Map<string, "present" | "late">();
    logs.forEach((log) => {
      const studentId = studentKeys.get(String(log.studentId));
      if (!studentId) return;
      const period = `${log.sessionName ?? ""} ${log.statusLabel ?? ""}`.toLowerCase();
      if (period.trim() && !period.includes(sessionType)) return;
      const status = String(log.status).toLowerCase() === "late" ? "late" : "present";
      if (status === "late" || !scanned.has(studentId)) scanned.set(studentId, status);
    });

    const nextStatuses: Record<string, Status> = {};
    nextRoster.students.forEach((student) => {
      nextStatuses[student.id] = student.record?.status === "on_leave" ? "on_leave" : scanned.get(student.id) ?? "absent";
    });
    setStatuses(nextStatuses);
  };

  const loadRoster = async () => {
    if (!dormitoryId) return;
    setLoading(true);
    try {
      const query = new URLSearchParams({ dormitory_id: dormitoryId, roll_date: date, session_type: sessionType, limit: "1" });
      const rollCalls = await apiRequest<RollCall[]>(`/boarding/roll-calls?${query}`, { auth: "school" });
      const rollCall = Array.isArray(rollCalls) ? rollCalls[0] : undefined;
      let nextRoster: Roster;
      if (rollCall) {
        nextRoster = await apiRequest<Roster>(`/boarding/roll-calls/${rollCall.id}/roster`, { auth: "school" });
      } else {
        const [studentsResponse, assignmentsResponse] = await Promise.all([
          apiRequest<BoardingStudent[]>("/students?student_type=boarding&status=active&limit=5000", { auth: "school" }),
          apiRequest<DormAssignment[]>(`/boarding/assignments?dormitory_id=${dormitoryId}&is_active=true&limit=5000`, { auth: "school" }),
        ]);
        const students = Array.isArray(studentsResponse) ? studentsResponse : [];
        const assignments = Array.isArray(assignmentsResponse) ? assignmentsResponse : [];
        const assignmentsByStudent = new Map(assignments.map((assignment) => [String(assignment.student_id), assignment]));
        const assignedStudents = students.filter((student) => assignmentsByStudent.has(String(student.id))).map((student) => ({ ...student, room: assignmentsByStudent.get(String(student.id))?.room ?? null }));
        const dormitory = dormitories.find((item) => item.id === dormitoryId);
        if (!dormitory) return;
        nextRoster = { roll_call: { id: "", dormitory_id: dormitoryId, roll_date: date, session_type: sessionType }, dormitory, students: assignedStudents };
      }
      setRoster(nextRoster);
      await loadDeviceAttendance(nextRoster);
      setPage(1);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load boarding device attendance");
      setRoster(null);
    } finally { setLoading(false); }
  };

  useEffect(() => { void loadDormitories().catch((error: any) => toast.error(error?.message ?? "Failed to load dormitories")); }, []);
  useEffect(() => { if (dormitoryId && dormitories.length) void loadRoster(); }, [dormitoryId, date, sessionType, dormitories]);

  const filteredStudents = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (roster?.students ?? []).filter((student) => !needle || `${student.first_name} ${student.last_name} ${student.student_id_number ?? ""}`.toLowerCase().includes(needle));
  }, [roster, search]);
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const pageStudents = filteredStudents.slice((page - 1) * pageSize, page * pageSize);
  const counts = useMemo(() => Object.values(statuses).reduce((result, status) => ({ ...result, [status]: (result[status] ?? 0) + 1 }), { present: 0, absent: 0, late: 0, on_leave: 0, not_scheduled: 0 } as Record<Status, number>), [statuses]);
  const genderCounts = useMemo(() => (roster?.students ?? []).reduce((result, student) => {
    const gender = String(student.gender ?? "").toLowerCase();
    if (gender === "male" || gender === "m") result.boys += 1;
    if (gender === "female" || gender === "f") result.girls += 1;
    return result;
  }, { boys: 0, girls: 0 }), [roster]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  return <div className="space-y-5">
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap items-end gap-3">
      <div><label className="text-xs font-semibold text-muted-foreground">Date</label><input type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block h-9 rounded-md border border-input bg-background px-3 text-sm" /></div>
      <div><label className="text-xs font-semibold text-muted-foreground">Dormitory</label><select value={dormitoryId} onChange={(e) => setDormitoryId(e.target.value)} className="mt-1 block h-9 min-w-44 rounded-md border border-input bg-background px-3 text-sm"><option value="">Select dormitory</option>{dormitories.map((dorm) => <option key={dorm.id} value={dorm.id}>{dorm.name}</option>)}</select></div>
      <div><label className="text-xs font-semibold text-muted-foreground">Roll call</label><select value={sessionType} onChange={(e) => setSessionType(e.target.value as "morning" | "evening")} className="mt-1 block h-9 rounded-md border border-input bg-background px-3 text-sm"><option value="morning">Morning</option><option value="evening">Evening</option></select></div>
      <div className="relative min-w-56 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search dormitory student…" className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm" /></div>
      <div className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-xs text-muted-foreground"><Wifi className="h-4 w-4 text-success" />{deviceCount} device{deviceCount === 1 ? "" : "s"} connected</div>
    </div>
    {!isStudyDay(date) && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Weekend: boarding attendance is not scheduled. Attendance is recorded on study days, Monday to Friday.</div>}
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"><StatCard label="Total" value={roster?.students.length ?? 0} icon={<Users className="h-5 w-5" />} tone="primary" compact /><StatCard label="Present" value={counts.present} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" compact /><StatCard label="Absent" value={counts.absent} icon={<ClipboardCheck className="h-5 w-5" />} tone="destructive" compact /><StatCard label="Late" value={counts.late} icon={<ClipboardCheck className="h-5 w-5" />} tone="warning" compact /><StatCard label="Boys" value={genderCounts.boys} icon={<Users className="h-5 w-5" />} tone="primary" compact /><StatCard label="Girls" value={genderCounts.girls} icon={<Users className="h-5 w-5" />} tone="primary" compact /></div>
    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground"><span>On leave: <b className="text-foreground">{counts.on_leave}</b></span><span>Session: <b className="capitalize text-foreground">{sessionType}</b></span><span>Only students with a matching device scan are Present or Late; unscanned students are Absent.</span></div>
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4"><div><h3 className="font-display font-bold">{roster?.dormitory.name ?? "Dormitory roster"}</h3><p className="text-xs text-muted-foreground">Device attendance · {date} · {sessionType} roll call</p></div><span className="text-xs text-muted-foreground">{filteredStudents.length} students</span></div>
      {loading ? <div className="space-y-3 p-6">{Array.from({ length: pageSize }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}</div> : <><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Student ID</th><th className="px-4 py-3">Room</th><th className="px-4 py-3">Device status</th></tr></thead><tbody>{pageStudents.length === 0 ? <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No active students are assigned to this dormitory.</td></tr> : pageStudents.map((student) => <tr key={student.id} className="border-t border-border"><td className="px-4 py-3 font-medium">{student.first_name} {student.last_name}</td><td className="px-4 py-3 font-mono text-xs">{student.student_id_number ?? "—"}</td><td className="px-4 py-3">{student.room?.room_number ?? "—"}</td><td className={`px-4 py-3 font-medium ${statuses[student.id] === "present" ? "text-success" : statuses[student.id] === "late" ? "text-amber-600" : statuses[student.id] === "absent" ? "text-destructive" : statuses[student.id] === "not_scheduled" ? "text-muted-foreground" : "text-blue-600"}`}>{statusLabel[statuses[student.id] ?? "absent"]}</td></tr>)}</tbody></table></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm"><div className="text-muted-foreground">Page {page} of {totalPages}</div><div className="flex items-center gap-2"><label className="text-xs text-muted-foreground">Show</label><select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="h-8 rounded-md border border-input bg-background px-2 text-sm"><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select><span className="text-xs text-muted-foreground">students</span><button disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="h-8 rounded-md border border-border px-3 disabled:opacity-40">Previous</button><button disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} className="h-8 rounded-md border border-border px-3 disabled:opacity-40">Next</button></div></div></>}
    </div>
  </div>;
}
