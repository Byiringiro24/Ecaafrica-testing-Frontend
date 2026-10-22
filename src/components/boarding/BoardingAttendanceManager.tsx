import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, Download, RefreshCw, Search, Users, Wifi } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { deviceLocationApi } from "@/lib/boardingApi";
import { fetchDeviceLogs } from "@/lib/device-logs-api";
import type { DeviceLog } from "@/lib/device-logs-types";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { exportToExcel } from "@/lib/exportExcel";

type Dormitory    = { id: string; name: string; gender?: string; capacity?: number };
type Status       = "present" | "absent" | "late" | "on_leave" | "not_scheduled";
type RollCall     = { id: string; dormitory_id: string; roll_date: string; session_type: "morning" | "evening"; submitted_at?: string | null };
type Student      = {
  id: string; first_name: string; last_name: string;
  student_id_number?: string | null; gender?: string | null;
  room?: { room_number?: string | null } | null;
  record?: { id: string; status: Status; notes?: string | null } | null;
  current_section?: { name?: string | null; full_name?: string | null; class?: { name?: string | null } | null } | null;
};
type Roster         = { roll_call: RollCall; dormitory: Dormitory; students: Student[] };
type BoardingStudent = {
  id: string; first_name: string; last_name: string;
  student_id_number?: string | null; gender?: string | null;
  current_section?: { name?: string | null; full_name?: string | null; class?: { name?: string | null } | null } | null;
};
type DormAssignment  = { student_id: string; room?: { room_number?: string | null } | null; student?: BoardingStudent | null };
type DeviceInfo      = { id: string; name?: string; device_uid?: string; device_id?: string; location_label?: string | null };
type DeviceSession   = { id: string; name: string; is_active: boolean };
type ScanResult      = { status: "present" | "late"; time: string; method: string };

const statusLabel: Record<Status, string> = {
  present: "Present", absent: "Absent", late: "Late",
  on_leave: "On leave", not_scheduled: "Not scheduled",
};

const today = () => new Date().toISOString().slice(0, 10);

const isStudyDay = (value: string) => {
  const day = new Date(`${value}T00:00:00Z`).getUTCDay();
  return day >= 1 && day <= 5;
};

/**
 * Fuzzy match: does the log's session label correspond to the selected roll-call session?
 * - No session label → always matches (untagged scan accepted everywhere)
 * - Exact match or substring match in either direction → accepted
 */
const sessionMatches = (logSession: string | null | undefined, selected: string): boolean => {
  const raw = (logSession ?? "").trim();
  if (!raw) return true;
  const a = raw.toLowerCase();
  const b = selected.toLowerCase();
  return a === b || a.includes(b) || b.includes(a);
};

export function BoardingAttendanceManager({ canEdit: _canEdit = false }: { canEdit?: boolean }) {
  const [date,            setDate]            = useState(today());
  const [selectedSession, setSelectedSession] = useState<string>("morning");
  const [dormitoryId,     setDormitoryId]     = useState("");
  const [dormitories,     setDormitories]     = useState<Dormitory[]>([]);
  const [dormSessions,    setDormSessions]    = useState<DeviceSession[]>([]);
  const [roster,          setRoster]          = useState<Roster | null>(null);
  const [statuses,        setStatuses]        = useState<Record<string, Status>>({});
  const [scanResults,     setScanResults]     = useState<Record<string, ScanResult>>({});
  const [deviceCount,     setDeviceCount]     = useState(0);

  // Filters
  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState<"all" | Status>("all");
  const [genderFilter,  setGenderFilter]  = useState<"all" | "boys" | "girls">("all");
  const [classFilter,   setClassFilter]   = useState<string>("all");
  const [methodFilter,  setMethodFilter]  = useState<string>("all");

  // Pagination
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading,  setLoading]  = useState(true);

  // ── Load dormitories ──────────────────────────────────────────────────────
  const loadDormitories = async () => {
    const data = await apiRequest<Dormitory[]>("/boarding/dormitories?limit=500", { auth: "school" });
    const list = Array.isArray(data) ? data : [];
    setDormitories(list);
    if (!dormitoryId && list[0]) setDormitoryId(list[0].id);
  };

  // ── Load device sessions for dormitory ────────────────────────────────────
  const loadDormSessions = async (dormId: string) => {
    if (!dormId) return;
    try {
      const response = await deviceLocationApi.list({ dormitory_id: dormId, location_scope: "dormitory" });
      const devices = Array.isArray(response) ? response as DeviceInfo[] : [];
      if (!devices.length) { setDormSessions([]); return; }
      const deviceId = devices[0].id ?? devices[0].device_id;
      if (!deviceId) { setDormSessions([]); return; }
      const payload = await apiRequest<any>(`/devices/${deviceId}/sessions`, { auth: "school" });
      const list: DeviceSession[] = (
        Array.isArray(payload?.sessions) ? payload.sessions
        : Array.isArray(payload?.data)   ? payload.data
        : Array.isArray(payload)         ? payload : []
      ).map((s: any) => ({ id: String(s.id), name: String(s.name), is_active: Boolean(s.is_active) }));
      setDormSessions(list);
      // Auto-select the currently active session
      const active = list.find(s => s.is_active);
      if (active) setSelectedSession(active.name);
    } catch {
      setDormSessions([]);
    }
  };

  // ── Fetch device logs and derive per-student statuses ─────────────────────
  const loadDeviceAttendance = async (nextRoster: Roster) => {
    const response = await deviceLocationApi.list({ dormitory_id: dormitoryId, location_scope: "dormitory" });
    const devices = Array.isArray(response) ? response as DeviceInfo[] : [];
    setDeviceCount(devices.length);

    if (!isStudyDay(date)) {
      const s: Record<string, Status> = {};
      nextRoster.students.forEach(st => { s[st.id] = "not_scheduled"; });
      setStatuses(s);
      setScanResults({});
      return;
    }

    // Fetch all pages from all connected devices
    const allLogs: DeviceLog[] = (await Promise.all(devices.map(async device => {
      const deviceId = device.id ?? device.device_id ?? device.device_uid;
      if (!deviceId) return [];
      try {
        const first = await fetchDeviceLogs({ page: 1, limit: 200, startDate: date, endDate: date, deviceId });
        if (first.meta.totalPages <= 1) return first.data;
        const rest = await Promise.all(
          Array.from({ length: first.meta.totalPages - 1 }, (_, i) =>
            fetchDeviceLogs({ page: i + 2, limit: 200, startDate: date, endDate: date, deviceId })
              .then(p => p.data).catch(() => [])
          )
        );
        return [first.data, ...rest].flat();
      } catch { return []; }
    }))).flat();

    // Build lookup by student.id and student_id_number
    const keyMap = new Map<string, string>();
    nextRoster.students.forEach(s => {
      keyMap.set(s.id, s.id);
      if (s.student_id_number) keyMap.set(s.student_id_number, s.id);
    });

    // Match logs to students for the selected session
    const scanned = new Map<string, ScanResult>();
    allLogs.forEach(log => {
      const studentId = keyMap.get(String(log.studentId));
      if (!studentId) return;
      if (!sessionMatches(log.sessionName ?? (log as any).attendance_period, selectedSession)) return;
      const logStatus: "present" | "late" = String(log.status).toLowerCase() === "late" ? "late" : "present";
      const existing = scanned.get(studentId);
      if (!existing || (logStatus === "late" && existing.status !== "late")) {
        scanned.set(studentId, {
          status: logStatus,
          time:   log.timestamp
            ? new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
            : "—",
          method: (log.method ?? (log as any).methodRaw ?? "—"),
        });
      }
    });

    const nextStatuses: Record<string, Status>     = {};
    const nextScanResults: Record<string, ScanResult> = {};
    nextRoster.students.forEach(student => {
      if (student.record?.status === "on_leave") {
        nextStatuses[student.id] = "on_leave";
      } else {
        const result = scanned.get(student.id);
        nextStatuses[student.id] = result?.status ?? "absent";
        if (result) nextScanResults[student.id] = result;
      }
    });
    setStatuses(nextStatuses);
    setScanResults(nextScanResults);
  };

  // ── Load roster (students in dormitory for this date/session) ─────────────
  const loadRoster = async () => {
    if (!dormitoryId) return;
    setLoading(true);
    try {
      const sessionTypeLegacy: "morning" | "evening" =
        selectedSession.toLowerCase().includes("evening") ? "evening" : "morning";

      const query = new URLSearchParams({
        dormitory_id: dormitoryId, roll_date: date,
        session_type: sessionTypeLegacy, limit: "1",
      });
      const rollCalls = await apiRequest<RollCall[]>(`/boarding/roll-calls?${query}`, { auth: "school" });
      const rollCall  = Array.isArray(rollCalls) ? rollCalls[0] : undefined;
      let nextRoster: Roster;

      if (rollCall) {
        nextRoster = await apiRequest<Roster>(`/boarding/roll-calls/${rollCall.id}/roster`, { auth: "school" });
      } else {
        const [studentsRes, assignmentsRes] = await Promise.all([
          apiRequest<BoardingStudent[]>(
            "/students?student_type=boarding&status=active&limit=5000&include=current_section",
            { auth: "school" }
          ),
          apiRequest<DormAssignment[]>(
            `/boarding/assignments?dormitory_id=${dormitoryId}&is_active=true&limit=5000`,
            { auth: "school" }
          ),
        ]);
        const students    = Array.isArray(studentsRes)    ? studentsRes    : [];
        const assignments = Array.isArray(assignmentsRes) ? assignmentsRes : [];
        const assignMap   = new Map(assignments.map(a => [String(a.student_id), a]));
        const dormitory   = dormitories.find(d => d.id === dormitoryId);
        if (!dormitory) return;
        const assignedStudents = students
          .filter(s => assignMap.has(String(s.id)))
          .map(s  => ({ ...s, room: assignMap.get(String(s.id))?.room ?? null }));
        nextRoster = {
          roll_call: { id: "", dormitory_id: dormitoryId, roll_date: date, session_type: sessionTypeLegacy },
          dormitory,
          students: assignedStudents,
        };
      }
      setRoster(nextRoster);
      await loadDeviceAttendance(nextRoster);
      setPage(1);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load boarding attendance");
      setRoster(null);
    } finally {
      setLoading(false);
    }
  };

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    void loadDormitories().catch((e: any) => toast.error(e?.message ?? "Failed to load dormitories"));
  }, []);

  useEffect(() => {
    if (dormitoryId) void loadDormSessions(dormitoryId);
  }, [dormitoryId]);

  useEffect(() => {
    if (dormitoryId && dormitories.length) void loadRoster();
  }, [dormitoryId, date, selectedSession, dormitories]);

  useEffect(() => { if (page > Math.max(1, Math.ceil(filteredStudents.length / pageSize))) setPage(1); });

  // ── Derived data ──────────────────────────────────────────────────────────
  const classOptions = useMemo(() => {
    const names = new Set<string>();
    (roster?.students ?? []).forEach(s => {
      const cls = s.current_section?.class?.name ?? s.current_section?.name ?? "";
      if (cls) names.add(cls);
    });
    return Array.from(names).sort();
  }, [roster]);

  const methodOptions = useMemo(() => {
    const methods = new Set<string>();
    Object.values(scanResults).forEach(r => { if (r.method && r.method !== "—") methods.add(r.method); });
    return Array.from(methods).sort();
  }, [scanResults]);

  const filteredStudents = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (roster?.students ?? []).filter(student => {
      if (needle && !`${student.first_name} ${student.last_name} ${student.student_id_number ?? ""}`.toLowerCase().includes(needle)) return false;
      const status = statuses[student.id] ?? "absent";
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (genderFilter !== "all") {
        const g = String(student.gender ?? "").toLowerCase();
        if (genderFilter === "boys"  && !(g === "male"   || g === "m")) return false;
        if (genderFilter === "girls" && !(g === "female" || g === "f")) return false;
      }
      if (classFilter !== "all") {
        const cls = student.current_section?.class?.name ?? student.current_section?.name ?? "";
        if (cls !== classFilter) return false;
      }
      if (methodFilter !== "all") {
        const scan = scanResults[student.id];
        if (!scan || scan.method !== methodFilter) return false;
      }
      return true;
    });
  }, [roster, search, statuses, statusFilter, genderFilter, classFilter, methodFilter, scanResults]);

  const totalPages   = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const pageStudents = filteredStudents.slice((page - 1) * pageSize, page * pageSize);

  const counts = useMemo(() =>
    Object.values(statuses).reduce(
      (r, s) => ({ ...r, [s]: (r[s] ?? 0) + 1 }),
      { present: 0, absent: 0, late: 0, on_leave: 0, not_scheduled: 0 } as Record<Status, number>
    ), [statuses]);

  const genderCounts = useMemo(() =>
    (roster?.students ?? []).reduce((r, s) => {
      const g = String(s.gender ?? "").toLowerCase();
      if (g === "male"   || g === "m") r.boys  += 1;
      if (g === "female" || g === "f") r.girls += 1;
      return r;
    }, { boys: 0, girls: 0 }), [roster]);

  const rollCallOptions = dormSessions.length > 0
    ? dormSessions.map(s => s.name)
    : ["morning", "evening"];

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (filteredStudents.length === 0) { toast.info("No records to export"); return; }
    try {
      const dormName = roster?.dormitory.name ?? "dormitory";
      await exportToExcel(
        `boarding-${dormName}-${date}-${selectedSession}.xlsx`,
        "Boarding Attendance",
        [
          { header: "#",          key: "no",     width: 5  },
          { header: "Student",    key: "name",   width: 28 },
          { header: "Student ID", key: "sid",    width: 18 },
          { header: "Class",      key: "cls",    width: 16 },
          { header: "Gender",     key: "gender", width: 10 },
          { header: "Room",       key: "room",   width: 10 },
          { header: "Status",     key: "status", width: 14 },
          { header: "Scan Time",  key: "time",   width: 12 },
          { header: "Method",     key: "method", width: 16 },
        ],
        filteredStudents.map((s, i) => {
          const scan = scanResults[s.id];
          return {
            no:     i + 1,
            name:   `${s.first_name} ${s.last_name}`.trim(),
            sid:    s.student_id_number ?? "—",
            cls:    s.current_section?.class?.name ?? s.current_section?.name ?? "—",
            gender: String(s.gender ?? "—"),
            room:   s.room?.room_number ?? "—",
            status: statusLabel[statuses[s.id] ?? "absent"],
            time:   scan?.time   ?? "—",
            method: scan?.method ?? "—",
          };
        }),
        `Boarding Attendance — ${dormName} — ${date} — ${selectedSession}`
      );
      toast.success("Exported successfully");
    } catch (e: any) { toast.error(e?.message ?? "Export failed"); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Filter bar */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">

          {/* Date */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Date</label>
            <input type="date" max={today()} value={date}
              onChange={e => { setDate(e.target.value); setPage(1); }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
          </div>

          {/* Dormitory */}
          <div className="min-w-44 flex-1">
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Dormitory</label>
            <select value={dormitoryId} onChange={e => { setDormitoryId(e.target.value); setPage(1); }}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Select dormitory</option>
              {dormitories.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {/* Roll call */}
          <div className="min-w-44 flex-1">
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Roll call</label>
            <select value={selectedSession} onChange={e => { setSelectedSession(e.target.value); setPage(1); }}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              {rollCallOptions.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Status</label>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="all">All Statuses</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
              <option value="on_leave">On Leave</option>
            </select>
          </div>

          {/* Gender */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Gender</label>
            <select value={genderFilter} onChange={e => { setGenderFilter(e.target.value as any); setPage(1); }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="all">Boys & Girls</option>
              <option value="boys">Boys only</option>
              <option value="girls">Girls only</option>
            </select>
          </div>

          {/* Class */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Class</label>
            <select value={classFilter} onChange={e => { setClassFilter(e.target.value); setPage(1); }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="all">All Classes</option>
              {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Scan method */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Scan Method</label>
            <select value={methodFilter} onChange={e => { setMethodFilter(e.target.value); setPage(1); }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="all">All Methods</option>
              <option value="fingerprint">Fingerprint</option>
              <option value="face">Face</option>
              <option value="nfc">NFC / RFID</option>
              <option value="qr">QR Code</option>
              {methodOptions
                .filter(m => !["fingerprint", "face", "nfc", "qr"].includes(m))
                .map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Search */}
          <div className="relative min-w-52 flex-1">
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Search</label>
            <Search className="pointer-events-none absolute left-3 bottom-2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Name or student ID…"
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm" />
          </div>

          {/* Reload */}
          <button onClick={() => void loadRoster()} disabled={loading}
            className="h-9 inline-flex items-center gap-1.5 rounded-md border border-border px-3 text-sm font-semibold hover:bg-muted disabled:opacity-50 self-end">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Weekend notice */}
      {!isStudyDay(date) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Weekend: boarding attendance is not scheduled on Saturdays and Sundays.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total"   value={roster?.students.length ?? 0} icon={<Users className="h-5 w-5" />}         tone="primary"     compact />
        <StatCard label="Present" value={counts.present}               icon={<CheckCircle2 className="h-5 w-5" />}   tone="success"     compact />
        <StatCard label="Absent"  value={counts.absent}                icon={<ClipboardCheck className="h-5 w-5" />} tone="destructive" compact />
        <StatCard label="Late"    value={counts.late}                  icon={<ClipboardCheck className="h-5 w-5" />} tone="warning"     compact />
        <StatCard label="Boys"    value={genderCounts.boys}            icon={<Users className="h-5 w-5" />}          tone="primary"     compact />
        <StatCard label="Girls"   value={genderCounts.girls}           icon={<Users className="h-5 w-5" />}          tone="primary"     compact />
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>On leave: <b className="text-foreground">{counts.on_leave}</b></span>
        <span>Session: <b className="text-foreground">{selectedSession}</b></span>
        <span className="inline-flex items-center gap-1.5">
          <Wifi className="h-3.5 w-3.5 text-success" />
          {deviceCount} device{deviceCount === 1 ? "" : "s"} connected
        </span>
        <span className="text-[11px]">
          Only students with a matching device scan are Present or Late; unscanned students are Absent.
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
          <div>
            <h3 className="font-display font-bold">{roster?.dormitory.name ?? "Dormitory roster"}</h3>
            <p className="text-xs text-muted-foreground">Device attendance · {date} · {selectedSession}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{filteredStudents.length} students</span>
            {!loading && filteredStudents.length > 0 && (
              <button onClick={handleExport}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                <Download className="h-3.5 w-3.5" /> Export
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: pageSize }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    {["#", "Student", "Student ID", "Class", "Room", "Status", "Scan Time", "Scan Method"].map(h => (
                      <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                        No students match the selected filters.
                      </td>
                    </tr>
                  ) : pageStudents.map((student, i) => {
                    const status = statuses[student.id] ?? "absent";
                    const scan   = scanResults[student.id];
                    const cls    = student.current_section?.class?.name ?? student.current_section?.name ?? "—";
                    return (
                      <tr key={student.id} className="border-t border-border hover:bg-muted/20">
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {(page - 1) * pageSize + i + 1}
                        </td>
                        <td className="px-4 py-3 font-medium whitespace-nowrap">
                          {student.first_name} {student.last_name}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{student.student_id_number ?? "—"}</td>
                        <td className="px-4 py-3 text-xs">{cls}</td>
                        <td className="px-4 py-3 text-xs">{student.room?.room_number ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            status === "present"        ? "bg-success/15 text-success"
                            : status === "late"         ? "bg-amber-100 text-amber-700"
                            : status === "absent"       ? "bg-destructive/15 text-destructive"
                            : status === "on_leave"     ? "bg-blue-100 text-blue-700"
                            : "bg-muted text-muted-foreground"
                          }`}>{statusLabel[status]}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{scan?.time   ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{scan?.method ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
              <span className="text-muted-foreground text-xs">
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredStudents.length)} of {filteredStudents.length}
              </span>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Show</label>
                <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm">
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="h-8 rounded-md border border-border px-3 disabled:opacity-40 text-sm">Previous</button>
                <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="h-8 rounded-md border border-border px-3 disabled:opacity-40 text-sm">Next</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
