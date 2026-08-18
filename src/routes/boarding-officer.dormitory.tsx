import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Plus, Search, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { BoardingOfficerLayout } from "@/components/layout/BoardingOfficerLayout";
import { boardingOfficerRouteGuard } from "@/lib/schoolAuth";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { todayIso } from "@/lib/gateKeeperAttendance";

const MAX_CAPACITY = 32767;

export const Route = createFileRoute("/boarding-officer/dormitory")({
  beforeLoad: ({ location }) => boardingOfficerRouteGuard(location),
  component: BoardingOfficerDormitoryPage,
});

type ApiStudent = {
  id: string;
  first_name: string;
  last_name: string;
  student_id_number?: string | null;
  gender?: string | null;
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
  gender?: string | null;
  capacity?: number | null;
  description?: string | null;
};

type DormRoomRecord = {
  id: string;
  dormitory_id: string;
  room_number: string;
  capacity?: number | null;
};

type DormAssignment = {
  id: string;
  student_id: string;
  dormitory_id: string;
  room_id?: string | null;
  bed_number?: string | null;
  dormitory?: { name?: string | null } | null;
  room?: { room_number?: string | null } | null;
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

type AcademicYearRecord = {
  id: string;
  name: string;
  is_current?: boolean;
  isCurrent?: boolean;
};

type StudentRow = {
  id: string;
  name: string;
  className: string;
  dormName: string;
  roomLabel: string;
  assignmentId: string | null;
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
  const [savingDormitory, setSavingDormitory] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [students, setStudents] = useState<ApiStudent[]>([]);
  const [dormitories, setDormitories] = useState<DormitoryRecord[]>([]);
  const [rooms, setRooms] = useState<DormRoomRecord[]>([]);
  const [assignments, setAssignments] = useState<DormAssignment[]>([]);
  const [classRecords, setClassRecords] = useState<{ id: string; name: string }[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearRecord[]>([]);
  const [leaveIds, setLeaveIds] = useState<Set<string>>(new Set());
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set());
  const [classFilter, setClassFilter] = useState("All");
  const [dormFilter, setDormFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"All" | StudentRow["status"]>("All");
  const [search, setSearch] = useState("");
  const [dormitoryForm, setDormitoryForm] = useState({
    name: "",
    gender: "male",
    capacity: "",
    description: "",
  });
  const [assignmentForm, setAssignmentForm] = useState({
    classId: "",
    studentId: "",
    dormitoryId: "",
    roomId: "",
    bedNumber: "",
    academicYearId: "",
    assignedAt: today,
  });
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [transferTarget, setTransferTarget] = useState<StudentRow | null>(null);

  const classLabel = useCallback(
    (student: ApiStudent) =>
      student.current_section?.full_name ?? student.current_section?.name ?? "—",
    []
  );

  const currentAcademicYear = useMemo(
    () => academicYears.find((year) => year.is_current || year.isCurrent) ?? academicYears[0],
    [academicYears]
  );

  const boardingStudents = useMemo(
    () => students.filter((student) => student.current_section?.class_id || student.current_section?.name),
    [students]
  );

  const boardingClassOptions = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>();

    boardingStudents.forEach((student) => {
      const classId = student.current_section?.class_id;
      if (!classId || seen.has(classId)) return;
      seen.set(classId, {
        id: classId,
        name: classLabel(student),
      });
    });

    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [boardingStudents, classLabel]);

  const selectedAssignmentClassStudents = useMemo(
    () => boardingStudents.filter((student) => student.current_section?.class_id === assignmentForm.classId),
    [boardingStudents, assignmentForm.classId]
  );

  const activeAssignmentStudent = useMemo(
    () => students.find((student) => student.id === assignmentForm.studentId) ?? null,
    [students, assignmentForm.studentId]
  );

  const assignmentByStudent = useMemo(() => {
    const map = new Map<string, DormAssignment>();
    assignments.forEach((assignment) => map.set(assignment.student_id, assignment));
    return map;
  }, [assignments]);

  const dormNameById = useMemo(
    () => new Map(dormitories.map((dormitory) => [dormitory.id, dormitory.name])),
    [dormitories]
  );

  const dormitoryOccupancy = useMemo(() => {
    const map = new Map<string, number>();
    assignments.forEach((assignment) => {
      map.set(assignment.dormitory_id, (map.get(assignment.dormitory_id) ?? 0) + 1);
    });
    return map;
  }, [assignments]);

  const roomOccupancy = useMemo(() => {
    const map = new Map<string, number>();
    assignments.forEach((assignment) => {
      if (!assignment.room_id) return;
      map.set(assignment.room_id, (map.get(assignment.room_id) ?? 0) + 1);
    });
    return map;
  }, [assignments]);

  // A student can only go into a dormitory matching their gender; "other" and
  // missing genders are unconstrained, matching the backend rule.
  const compatibleDormitories = useMemo(() => {
    const gender = activeAssignmentStudent?.gender;
    if (gender !== "male" && gender !== "female") return dormitories;
    return dormitories.filter((dormitory) => !dormitory.gender || dormitory.gender === gender);
  }, [dormitories, activeAssignmentStudent]);

  const availableRooms = useMemo(
    () => rooms.filter((room) => room.dormitory_id === assignmentForm.dormitoryId),
    [rooms, assignmentForm.dormitoryId]
  );

  const dormitoryStats = useMemo(
    () =>
      dormitories.map((dormitory) => ({
        ...dormitory,
        activeAssignments: dormitoryOccupancy.get(dormitory.id) ?? 0,
      })),
    [dormitories, dormitoryOccupancy]
  );

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
        roomLabel: assignment?.room?.room_number
          ? `${assignment.room.room_number}${assignment.bed_number ? ` / Bed ${assignment.bed_number}` : ""}`
          : "—",
        assignmentId: assignment?.id ?? null,
        status,
      };
    });
  }, [students, assignmentByStudent, dormNameById, classLabel, leaveIds, presentIds]);

  const stats = useMemo(() => {
    const total = displayRows.length;
    const onLeave = displayRows.filter((row) => row.status === "On Leave").length;
    const present = displayRows.filter((row) => row.status === "Present").length;
    const absent = displayRows.filter((row) => row.status === "Absent").length;
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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [studentList, dormList, roomList, assignmentList, classes, years, leaves, sessions, records] =
        await Promise.all([
          apiRequest<ApiStudent[]>("/students?student_type=boarding&limit=2000", {
            auth: "school",
          }),
          apiRequest<DormitoryRecord[]>("/boarding/dormitories?limit=100", { auth: "school" }),
          apiRequest<DormRoomRecord[]>("/boarding/rooms?limit=1000", { auth: "school" }),
          apiRequest<DormAssignment[]>("/boarding/assignments?is_active=true&limit=2000", {
            auth: "school",
          }),
          apiRequest<{ id: string; name: string }[]>("/classes?limit=200", { auth: "school" }),
          apiRequest<AcademicYearRecord[]>("/academic-years?limit=100", { auth: "school" }),
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
      setRooms(Array.isArray(roomList) ? roomList : []);
      setAssignments(Array.isArray(assignmentList) ? assignmentList : []);
      setClassRecords(Array.isArray(classes) ? classes : []);
      setAcademicYears(Array.isArray(years) ? years : []);

      const leaveList = Array.isArray(leaves) ? leaves : [];
      const sessionList = Array.isArray(sessions) ? sessions : [];
      const recordList = Array.isArray(records) ? records : [];

      const boardingSessionIds = new Set(
        sessionList
          .filter((session) => session.session_type === "boarding_morning" || session.session_type === "boarding_evening")
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
                (record.status === "present" || record.status === "late" || record.status === "excused")
            )
            .map((record) => record.student_id)
        )
      );
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load dormitory status");
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (boardingClassOptions.length === 0) return;

    setAssignmentForm((prev) => {
      if (prev.classId && boardingClassOptions.some((cls) => cls.id === prev.classId)) {
        return prev;
      }

      return { ...prev, classId: boardingClassOptions[0].id };
    });
  }, [boardingClassOptions]);

  useEffect(() => {
    if (!assignmentForm.classId) return;
    const available = boardingStudents.filter(
      (student) => student.current_section?.class_id === assignmentForm.classId
    );

    setAssignmentForm((prev) => {
      if (available.some((student) => student.id === prev.studentId)) {
        return prev;
      }

      return { ...prev, studentId: available[0]?.id ?? "" };
    });
  }, [assignmentForm.classId, boardingStudents]);

  useEffect(() => {
    if (compatibleDormitories.length === 0) return;

    setAssignmentForm((prev) => {
      if (prev.dormitoryId && compatibleDormitories.some((d) => d.id === prev.dormitoryId)) {
        return prev;
      }

      return { ...prev, dormitoryId: compatibleDormitories[0].id, roomId: "", bedNumber: "" };
    });
  }, [compatibleDormitories]);

  useEffect(() => {
    setAssignmentForm((prev) => {
      if (!prev.roomId || availableRooms.some((room) => room.id === prev.roomId)) {
        return prev;
      }

      return { ...prev, roomId: "", bedNumber: "" };
    });
  }, [availableRooms]);

  useEffect(() => {
    if (academicYears.length === 0) return;

    const selectedYear = currentAcademicYear;
    if (!selectedYear) return;

    setAssignmentForm((prev) => {
      if (prev.academicYearId === selectedYear.id) {
        return prev;
      }

      return { ...prev, academicYearId: selectedYear.id };
    });
  }, [academicYears, currentAcademicYear]);

  const createDormitory = async () => {
    if (!dormitoryForm.name.trim()) {
      toast.error("Dormitory name is required");
      return;
    }

    const capacity = Number(dormitoryForm.capacity);
    if (dormitoryForm.capacity && (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_CAPACITY)) {
      toast.error(`Capacity must be a whole number between 1 and ${MAX_CAPACITY}`);
      return;
    }

    setSavingDormitory(true);
    try {
      await apiRequest("/boarding/dormitories", {
        method: "POST",
        auth: "school",
        body: JSON.stringify({
          name: dormitoryForm.name.trim(),
          gender: dormitoryForm.gender || undefined,
          capacity: dormitoryForm.capacity ? capacity : undefined,
          description: dormitoryForm.description.trim() || undefined,
        }),
      });
      toast.success("Dormitory created");
      setDormitoryForm({ name: "", gender: "male", capacity: "", description: "" });
      await loadData();
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to create dormitory");
    } finally {
      setSavingDormitory(false);
    }
  };

  const assignStudentToDormitory = async () => {
    if (!assignmentForm.studentId) {
      toast.error("Select a student first");
      return;
    }

    if (!assignmentForm.dormitoryId) {
      toast.error("Select a dormitory first");
      return;
    }

    if (!assignmentForm.academicYearId) {
      toast.error("Select an academic year first");
      return;
    }

    setSavingAssignment(true);
    try {
      await apiRequest("/boarding/assignments", {
        method: "POST",
        auth: "school",
        body: JSON.stringify({
          student_id: assignmentForm.studentId,
          dormitory_id: assignmentForm.dormitoryId,
          room_id: assignmentForm.roomId || undefined,
          bed_number: assignmentForm.bedNumber.trim() || undefined,
          academic_year_id: assignmentForm.academicYearId,
          assigned_at: assignmentForm.assignedAt,
        }),
      });
      toast.success("Student assigned to dormitory");
      setAssignmentForm((prev) => ({ ...prev, roomId: "", bedNumber: "" }));
      await loadData();
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to assign student");
    } finally {
      setSavingAssignment(false);
    }
  };

  const transferStudent = async (row: StudentRow, dormitoryId: string) => {
    if (!row.assignmentId) return;

    setRowBusyId(row.id);
    try {
      await apiRequest(`/boarding/assignments/${row.assignmentId}`, {
        method: "PATCH",
        auth: "school",
        body: JSON.stringify({ dormitory_id: dormitoryId, room_id: null, bed_number: null }),
      });
      toast.success(`${row.name} transferred`);
      setTransferTarget(null);
      await loadData();
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to transfer student");
    } finally {
      setRowBusyId(null);
    }
  };

  const unassignStudent = async (row: StudentRow) => {
    if (!row.assignmentId) return;
    if (!window.confirm(`Remove ${row.name} from ${row.dormName}?`)) return;

    setRowBusyId(row.id);
    try {
      // Set left_at rather than deleting so the placement history is retained.
      await apiRequest(`/boarding/assignments/${row.assignmentId}`, {
        method: "PATCH",
        auth: "school",
        body: JSON.stringify({ left_at: today }),
      });
      toast.success(`${row.name} unassigned`);
      await loadData();
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to unassign student");
    } finally {
      setRowBusyId(null);
    }
  };

  return (
    <BoardingOfficerLayout
      title="Dormitory Management"
      subtitle="Create dormitories and assign boarding students by class"
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

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1.4fr] mb-5">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3 mb-4">
            <div className="rounded-lg bg-primary/10 text-primary p-2">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base">Create dormitory</h3>
              <p className="text-sm text-muted-foreground">
                Add a boarding house before assigning students to it.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground">Dormitory name</label>
              <input
                value={dormitoryForm.name}
                onChange={(e) => setDormitoryForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Alpha House"
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Gender</label>
              <select
                value={dormitoryForm.gender}
                onChange={(e) => setDormitoryForm((prev) => ({ ...prev, gender: e.target.value }))}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Capacity</label>
              <input
                type="number"
                min={1}
                max={MAX_CAPACITY}
                step={1}
                value={dormitoryForm.capacity}
                onChange={(e) => setDormitoryForm((prev) => ({ ...prev, capacity: e.target.value }))}
                placeholder="120"
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground">Description</label>
              <textarea
                value={dormitoryForm.description}
                onChange={(e) =>
                  setDormitoryForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Short note about the dormitory"
                rows={3}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <button
            onClick={createDormitory}
            disabled={savingDormitory}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {savingDormitory ? "Creating…" : "Create dormitory"}
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3 mb-4">
            <div className="rounded-lg bg-success/10 text-success p-2">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base">Assign boarding student</h3>
              <p className="text-sm text-muted-foreground">
                Students are filtered to boarding learners and grouped by class.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Class</label>
              <select
                value={assignmentForm.classId}
                onChange={(e) => setAssignmentForm((prev) => ({ ...prev, classId: e.target.value }))}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select class</option>
                {boardingClassOptions.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Student</label>
              <select
                value={assignmentForm.studentId}
                onChange={(e) =>
                  setAssignmentForm((prev) => ({ ...prev, studentId: e.target.value }))
                }
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={!assignmentForm.classId}
              >
                <option value="">Select student</option>
                {selectedAssignmentClassStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {`${student.first_name} ${student.last_name}`.trim()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Dormitory</label>
              <select
                value={assignmentForm.dormitoryId}
                onChange={(e) =>
                  setAssignmentForm((prev) => ({
                    ...prev,
                    dormitoryId: e.target.value,
                    roomId: "",
                    bedNumber: "",
                  }))
                }
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select dormitory</option>
                {compatibleDormitories.map((dormitory) => {
                  const used = dormitoryOccupancy.get(dormitory.id) ?? 0;
                  const full =
                    typeof dormitory.capacity === "number" && used >= dormitory.capacity;
                  return (
                    <option key={dormitory.id} value={dormitory.id} disabled={full}>
                      {dormitory.name}
                      {typeof dormitory.capacity === "number"
                        ? ` (${used}/${dormitory.capacity})${full ? " — full" : ""}`
                        : ""}
                    </option>
                  );
                })}
              </select>
              {activeAssignmentStudent && compatibleDormitories.length === 0 ? (
                <p className="mt-1 text-xs text-destructive">
                  No {activeAssignmentStudent.gender ?? ""} dormitory available.
                </p>
              ) : null}
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Room (optional)</label>
              <select
                value={assignmentForm.roomId}
                onChange={(e) =>
                  setAssignmentForm((prev) => ({ ...prev, roomId: e.target.value }))
                }
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={!assignmentForm.dormitoryId || availableRooms.length === 0}
              >
                <option value="">
                  {availableRooms.length === 0 ? "No rooms in this dormitory" : "No specific room"}
                </option>
                {availableRooms.map((room) => {
                  const used = roomOccupancy.get(room.id) ?? 0;
                  const capacity = room.capacity ?? 0;
                  const full = capacity > 0 && used >= capacity;
                  return (
                    <option key={room.id} value={room.id} disabled={full}>
                      {room.room_number} ({used}/{capacity} beds){full ? " — full" : ""}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Bed number (optional)</label>
              <input
                value={assignmentForm.bedNumber}
                onChange={(e) =>
                  setAssignmentForm((prev) => ({ ...prev, bedNumber: e.target.value }))
                }
                placeholder="e.g. B4"
                maxLength={10}
                disabled={!assignmentForm.roomId}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Academic year</label>
              <select
                value={assignmentForm.academicYearId}
                onChange={(e) =>
                  setAssignmentForm((prev) => ({ ...prev, academicYearId: e.target.value }))
                }
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select year</option>
                {academicYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                    {year.is_current || year.isCurrent ? " (Current)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Assigned date</label>
              <input
                type="date"
                value={assignmentForm.assignedAt}
                onChange={(e) =>
                  setAssignmentForm((prev) => ({ ...prev, assignedAt: e.target.value }))
                }
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            {activeAssignmentStudent
              ? `${activeAssignmentStudent.first_name} ${activeAssignmentStudent.last_name}`.trim()
              : "Choose a class first to see boarding students from that class."}
            {activeAssignmentStudent?.current_section?.full_name
              ? ` • ${activeAssignmentStudent.current_section.full_name}`
              : ""}
          </div>

          <button
            onClick={assignStudentToDormitory}
            disabled={savingAssignment || !assignmentForm.classId}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-success px-4 py-2 text-sm font-semibold text-success-foreground disabled:opacity-60"
          >
            <Users className="h-4 w-4" />
            {savingAssignment ? "Assigning…" : "Assign to dormitory"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Dormitory overview</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <>
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
            </>
          ) : dormitoryStats.length === 0 ? (
            <div className="text-sm text-muted-foreground">No dormitories created yet.</div>
          ) : (
            dormitoryStats.map((dormitory) => (
              <div key={dormitory.id} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{dormitory.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {dormitory.gender ?? "unspecified"}
                      {typeof dormitory.capacity === "number" ? ` • Capacity ${dormitory.capacity}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {dormitory.activeAssignments} assigned
                  </span>
                </div>
                {dormitory.description ? (
                  <p className="mt-2 text-sm text-muted-foreground">{dormitory.description}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
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
            {dormitories.map((dormitory) => (
              <option key={dormitory.id} value={dormitory.id}>
                {dormitory.name}
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
                {["Student", "Class", "Dormitory", "Room / Bed", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Loading dormitory status…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
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
                    <td className="px-4 py-3 text-muted-foreground">{row.roomLabel}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLES[row.status]}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.assignmentId ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setTransferTarget(row)}
                            disabled={rowBusyId === row.id}
                            className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold hover:bg-muted disabled:opacity-60"
                          >
                            Transfer
                          </button>
                          <button
                            onClick={() => unassignStudent(row)}
                            disabled={rowBusyId === row.id}
                            className="rounded-md border border-destructive/40 px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-60"
                          >
                            {rowBusyId === row.id ? "Working…" : "Unassign"}
                          </button>
                        </div>
                      ) : (
                        <span className="block text-right text-xs text-muted-foreground">
                          Unassigned
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {transferTarget ? (
        <TransferDialog
          row={transferTarget}
          dormitories={dormitories}
          students={students}
          occupancy={dormitoryOccupancy}
          busy={rowBusyId === transferTarget.id}
          onCancel={() => setTransferTarget(null)}
          onConfirm={(dormitoryId) => transferStudent(transferTarget, dormitoryId)}
        />
      ) : null}
    </BoardingOfficerLayout>
  );
}

function TransferDialog({
  row,
  dormitories,
  students,
  occupancy,
  busy,
  onCancel,
  onConfirm,
}: {
  row: StudentRow;
  dormitories: DormitoryRecord[];
  students: ApiStudent[];
  occupancy: Map<string, number>;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (dormitoryId: string) => void;
}) {
  const gender = students.find((student) => student.id === row.id)?.gender;
  const options = useMemo(() => {
    const compatible =
      gender === "male" || gender === "female"
        ? dormitories.filter((d) => !d.gender || d.gender === gender)
        : dormitories;
    return compatible.filter((d) => d.name !== row.dormName);
  }, [dormitories, gender, row.dormName]);

  const [dormitoryId, setDormitoryId] = useState(options[0]?.id ?? "");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl">
        <h3 className="font-semibold text-base">Transfer {row.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Currently in {row.dormName}. Room and bed will be cleared.
        </p>

        <label className="mt-4 block text-xs font-semibold text-muted-foreground">
          New dormitory
        </label>
        <select
          value={dormitoryId}
          onChange={(e) => setDormitoryId(e.target.value)}
          className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {options.length === 0 ? <option value="">No other dormitory available</option> : null}
          {options.map((dormitory) => {
            const used = occupancy.get(dormitory.id) ?? 0;
            const full = typeof dormitory.capacity === "number" && used >= dormitory.capacity;
            return (
              <option key={dormitory.id} value={dormitory.id} disabled={full}>
                {dormitory.name}
                {typeof dormitory.capacity === "number"
                  ? ` (${used}/${dormitory.capacity})${full ? " — full" : ""}`
                  : ""}
              </option>
            );
          })}
        </select>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(dormitoryId)}
            disabled={busy || !dormitoryId}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Transferring…" : "Transfer"}
          </button>
        </div>
      </div>
    </div>
  );
}
