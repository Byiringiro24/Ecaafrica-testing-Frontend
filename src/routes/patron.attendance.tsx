/**
 * Patron/Matron Boarding Attendance
 * - Creates named sessions (Morning Roll Call, Dinner, Lights Out)
 * - Push students to biometric devices in assigned dormitories
 * - View per-session attendance with manual correction
 * - Auto-save: ticking present/absent immediately saves
 */
import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  RefreshCw, AlertTriangle, CheckCircle, Clock, UserX,
  Plus, Upload, X, Save, Activity, Download,
} from "lucide-react";
import { toast } from "sonner";
import { PatronLayout } from "@/components/layout/PatronLayout";
import { patronRouteGuard } from "@/lib/schoolAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { patronApi, boardingAttendanceApi, type PatronAssignment, type BoardingSession } from "@/lib/boardingApi";
import { cn } from "@/lib/utils";
import { exportToExcel } from "@/lib/exportExcel";

export const Route = createFileRoute("/patron/attendance")({
  beforeLoad: ({ location }) => patronRouteGuard(location),
  component: PatronAttendancePage,
});

const STATUS_ICON: Record<string, React.ReactNode> = {
  present:            <CheckCircle className="h-4 w-4 text-emerald-600" />,
  late:               <Clock className="h-4 w-4 text-amber-600" />,
  missing_attendance: <UserX className="h-4 w-4 text-destructive" />,
  on_approved_leave:  <CheckCircle className="h-4 w-4 text-blue-600" />,
  manual_adjusted:    <CheckCircle className="h-4 w-4 text-purple-600" />,
};

const STATUS_COLOR: Record<string, string> = {
  present:            "bg-emerald-100 text-emerald-700",
  late:               "bg-amber-100 text-amber-700",
  missing_attendance: "bg-destructive/15 text-destructive",
  on_approved_leave:  "bg-blue-100 text-blue-700",
  manual_adjusted:    "bg-purple-100 text-purple-700",
};

const LOCATION_TYPES = [
  { value: "dormitory",   label: "Dormitory Roll Call" },
  { value: "dining_hall", label: "Dining Hall / Refectory" },
  { value: "library",     label: "Library" },
  { value: "other",       label: "Other" },
];

const today = new Date().toISOString().slice(0, 10);

type AttendanceRecord = {
  id: string; student_id: string; status: string; scan_time?: string | null;
  is_manual?: boolean; manual_reason?: string | null;
  student?: {
    id: string; first_name: string; last_name: string;
    photo_url?: string | null; student_id_number?: string | null;
  } | null;
};

type Session = BoardingSession & {
  session_name?: string | null;
  location_type?: string;
  records?: AttendanceRecord[];
};

type MyDevice = {
  id: string; name: string; device_uid: string; is_connected: boolean;
  dormitory_id?: string | null;
  dormitory?: { id: string; name: string } | null;
  tablet?: { id: string; name: string } | null;
};

export function PatronAttendancePage() {
  const user = useCurrentUser();
  const autoSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [myDorms,      setMyDorms]      = useState<PatronAssignment[]>([]);
  const [myDevices,    setMyDevices]    = useState<MyDevice[]>([]);
  const [classes,      setClasses]      = useState<any[]>([]);
  const [selectedDorm, setSelectedDorm] = useState<string | null>(null);

  const [sessions,         setSessions]         = useState<Session[]>([]);
  const [selectedSession,  setSelectedSession]  = useState<Session | null>(null);
  const [sessionRecords,   setSessionRecords]   = useState<AttendanceRecord[]>([]);
  const [sessionsLoading,  setSessionsLoading]  = useState(false);
  const [recordsLoading,   setRecordsLoading]   = useState(false);

  // Local attendance state (optimistic — auto-saves on change)
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({});
  const [savingIds,   setSavingIds]   = useState<Set<string>>(new Set());

  const [showNewSession,  setShowNewSession]  = useState(false);
  const [sessionForm,     setSessionForm]     = useState({ session_name: "", location_type: "dormitory", session_date: today });
  const [creatingSession, setCreatingSession] = useState(false);

  const [showPush,    setShowPush]    = useState(false);
  const [pushDevice,  setPushDevice]  = useState("");
  const [pushClassId, setPushClassId] = useState("");
  const [pushing,     setPushing]     = useState(false);

  const [correcting,  setCorrecting]  = useState<AttendanceRecord | null>(null);
  const [correctForm, setCorrectForm] = useState({ status: "present", reason: "" });
  const [savingCorr,  setSavingCorr]  = useState(false);

  // Load initial data
  useEffect(() => {
    if (!user?.id) return;
    const run = async () => {
      try {
        const [dorms, devices, classRes] = await Promise.all([
          patronApi.listPatronAssignments(user.id).catch(() => []),
          apiRequest<any>("/boarding/patrons/me/devices", { auth: "school" }).catch(() => ({ data: [] })),
          apiRequest<any>("/classes?limit=200", { auth: "school" }).catch(() => ({ data: [] })),
        ]);
        const dormList = Array.isArray(dorms) ? dorms : (dorms as any)?.data ?? [];
        setMyDorms(dormList);
        setMyDevices((devices as any)?.data ?? devices ?? []);
        setClasses((classRes as any)?.data ?? classRes ?? []);
        if (dormList[0] && !selectedDorm) setSelectedDorm(dormList[0].dormitory_id);
      } catch { /* ignore */ }
    };
    void run();
  }, [user?.id]);

  // Load sessions when dorm changes
  useEffect(() => {
    if (selectedDorm) void loadSessions(selectedDorm);
  }, [selectedDorm]);

  const loadSessions = async (dormId: string) => {
    setSessionsLoading(true);
    try {
      const res = await apiRequest<any>(
        `/boarding/attendance/sessions?dormitory_id=${dormId}&limit=20`,
        { auth: "school" }
      );
      const list: Session[] = (res as any)?.data ?? res ?? [];
      setSessions(list);
      const todaySess = list.find(s => s.session_date?.startsWith(today));
      if (todaySess) { setSelectedSession(todaySess); await loadSessionRecords(todaySess.id); }
      else { setSelectedSession(null); setSessionRecords([]); setLocalStatus({}); }
    } catch { /* ignore */ }
    finally { setSessionsLoading(false); }
  };

  const loadSessionRecords = async (sessionId: string) => {
    setRecordsLoading(true);
    try {
      const res = await boardingAttendanceApi.getSessionSummary(sessionId);
      const recs: AttendanceRecord[] = (res as any)?.records ?? [];
      setSessionRecords(recs);
      // Init local status from server state
      const init: Record<string, string> = {};
      recs.forEach(r => { init[r.student_id] = r.status; });
      setLocalStatus(init);
    } catch { /* ignore */ }
    finally { setRecordsLoading(false); }
  };

  // Auto-save: debounce individual student status changes 800ms
  const handleToggleStatus = (record: AttendanceRecord, newStatus: string) => {
    if (!selectedSession) return;
    const studentId = record.student_id;

    // Update UI immediately (optimistic)
    setLocalStatus(prev => ({ ...prev, [studentId]: newStatus }));

    // Debounce save
    clearTimeout(autoSaveTimers.current[studentId]);
    autoSaveTimers.current[studentId] = setTimeout(async () => {
      setSavingIds(prev => new Set(prev).add(studentId));
      try {
        await boardingAttendanceApi.correctAttendance(
          selectedSession.id, studentId, newStatus,
          newStatus === "missing_attendance" ? "Marked absent via manual attendance" : "Marked present via manual attendance"
        );
        // Update session summary counts silently
      } catch {
        toast.error("Auto-save failed for one record");
        // Revert on failure
        setLocalStatus(prev => ({ ...prev, [studentId]: record.status }));
      } finally {
        setSavingIds(prev => { const n = new Set(prev); n.delete(studentId); return n; });
      }
    }, 800);
  };

  const markAll = async (status: string) => {
    if (!selectedSession || sessionRecords.length === 0) return;
    // Update all at once optimistically
    const init: Record<string, string> = {};
    sessionRecords.forEach(r => { init[r.student_id] = status; });
    setLocalStatus(init);
    // Batch save
    const reason = status === "present" ? "All marked present" : "All marked absent";
    await Promise.all(
      sessionRecords.map(r =>
        boardingAttendanceApi.correctAttendance(selectedSession.id, r.student_id, status, reason).catch(() => null)
      )
    );
    toast.success(`All students marked as ${status}`);
  };

  const handleCreateSession = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedDorm) { toast.error("Select a dormitory first"); return; }
    setCreatingSession(true);
    try {
      const res = await boardingAttendanceApi.openSession(
        selectedDorm, sessionForm.session_date, undefined,
        { session_name: sessionForm.session_name || null, location_type: sessionForm.location_type }
      );
      toast.success(`Session opened`);
      setShowNewSession(false);
      setSessionForm({ session_name: "", location_type: "dormitory", session_date: today });
      await loadSessions(selectedDorm);
      setSelectedSession(res as any);
      await loadSessionRecords((res as any).id);
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setCreatingSession(false); }
  };

  const handlePush = async (e: FormEvent) => {
    e.preventDefault();
    if (!pushDevice) { toast.error("Select a device"); return; }
    setPushing(true);
    try {
      // Use /devices/:id/push-students — this applies the correct numeric userId
      // transformation and supports mode:all / mode:class properly
      const body: any = pushClassId
        ? { mode: "class", class_id: pushClassId }
        : { mode: "all" };
      const result = await apiRequest<any>(`/devices/${pushDevice}/push-students`, {
        method: "POST", auth: "school", body: JSON.stringify(body),
      });
      const pushed = result?.pushed_count ?? result?.data?.pushed_count ?? 0;
      const failed = result?.failed_count ?? result?.data?.failed_count ?? 0;
      if (failed > 0) {
        toast.warning(`Pushed ${pushed} students. ${failed} failed — device may be offline.`);
      } else {
        toast.success(`${pushed} student${pushed !== 1 ? "s" : ""} pushed to device`);
      }
      setShowPush(false);
    } catch (e: any) { toast.error(e?.message ?? "Push failed"); }
    finally { setPushing(false); }
  };

  const handleCorrect = async () => {
    if (!selectedSession || !correcting || !correctForm.reason.trim()) {
      toast.error("Reason is required"); return;
    }
    setSavingCorr(true);
    try {
      await boardingAttendanceApi.correctAttendance(
        selectedSession.id, correcting.student_id, correctForm.status, correctForm.reason
      );
      setLocalStatus(prev => ({ ...prev, [correcting.student_id]: correctForm.status }));
      toast.success("Attendance corrected");
      setCorrecting(null);
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setSavingCorr(false); }
  };

  const presentCount = Object.values(localStatus).filter(v => v === "present").length;
  const absentCount  = sessionRecords.length - presentCount;
  const dormName = (id: string) => myDorms.find(d => d.dormitory_id === id)?.dormitory?.name ?? id;

  const handleExport = async () => {
    if (sessionRecords.length === 0) { toast.info("No records to export"); return; }
    const sessName = selectedSession?.session_name ?? selectedSession?.id ?? "session";
    try {
      await exportToExcel(
        `boarding-attendance-${sessName}.xlsx`, "Attendance",
        [
          { header: "#", key: "no", width: 6 },
          { header: "Student Name", key: "name", width: 26 },
          { header: "Student ID", key: "sid", width: 16 },
          { header: "Status", key: "status", width: 14 },
          { header: "Method", key: "method", width: 14 },
          { header: "Time", key: "time", width: 18 },
        ],
        sessionRecords.map((r, i) => ({
          no: i + 1,
          name: r.student ? `${r.student.first_name} ${r.student.last_name}` : r.student_id,
          sid: r.student?.student_id_number ?? "—",
          status: localStatus[r.student_id] ?? r.status,
          method: r.is_manual ? "Manual" : "Biometric",
          time: r.scan_time ? new Date(r.scan_time).toLocaleTimeString() : "—",
        })),
        `Boarding Attendance — ${sessName}`
      );
      toast.success("Exported");
    } catch (e: any) { toast.error(e?.message ?? "Export failed"); }
  };

  return (
    <PatronLayout title="Boarding Attendance" subtitle="Sessions, device push, and attendance">

      {/* Top toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {myDorms.length > 0 && (
          <select value={selectedDorm ?? ""}
            onChange={e => setSelectedDorm(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold">
            {myDorms.map(d => (
              <option key={d.dormitory_id} value={d.dormitory_id}>
                {d.dormitory?.name ?? d.dormitory_id}
              </option>
            ))}
          </select>
        )}
        <button onClick={() => setShowNewSession(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New Session
        </button>
        {sessionRecords.length > 0 && (
          <button onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted">
            <Download className="h-4 w-4" /> Export
          </button>
        )}
        {myDevices.length > 0 && (
          <button onClick={() => setShowPush(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted">
            <Upload className="h-4 w-4" /> Push Students to Device
          </button>
        )}
        {selectedSession && (
          <button onClick={() => void loadSessionRecords(selectedSession.id)}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm hover:bg-muted">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">

        {/* Sessions sidebar */}
        <aside className="space-y-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sessions</p>
            {sessionsLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          {sessions.length === 0 && !sessionsLoading ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              No sessions yet. Click "New Session" to start.
            </div>
          ) : sessions.map(s => (
            <button key={s.id}
              onClick={() => { setSelectedSession(s); void loadSessionRecords(s.id); }}
              className={cn(
                "w-full text-left rounded-xl border p-3 transition",
                selectedSession?.id === s.id ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted/30"
              )}>
              <p className="font-semibold text-sm leading-tight">{(s as any).session_name ?? (s as any).location_type ?? "Session"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.session_date} · {(s as any).location_type?.replace(/_/g," ")}</p>
              <div className="mt-1.5 grid grid-cols-3 gap-1 text-[10px]">
                <span className="text-emerald-600 font-bold">{s.total_present} P</span>
                <span className="text-destructive font-bold">{s.total_missing} A</span>
                <span className={cn("font-bold", s.reconciled_at ? "text-muted-foreground" : "text-amber-600")}>
                  {s.reconciled_at ? "Closed" : "Open"}
                </span>
              </div>
            </button>
          ))}
        </aside>

        {/* Main attendance area */}
        <div className="space-y-4">
          {!selectedSession ? (
            <div className="rounded-xl border border-dashed border-border p-16 text-center">
              <Activity className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Select or create a session to take attendance.</p>
            </div>
          ) : (
            <>
              {/* Session header */}
              <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="font-semibold text-lg">{(selectedSession as any).session_name ?? (selectedSession as any).location_type ?? "Session"}</h2>
                  <p className="text-xs text-muted-foreground">{selectedSession.session_date} · {selectedDorm ? dormName(selectedDorm) : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-full px-3 py-1 text-xs font-bold",
                    selectedSession.reconciled_at ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                    {selectedSession.reconciled_at ? "Closed" : "Open"}
                  </span>
                </div>
              </div>

              {/* Stats + Quick actions */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex gap-3">
                  <div className="rounded-xl border border-border bg-card px-4 py-2 text-center min-w-16">
                    <p className="text-xl font-bold text-emerald-600">{presentCount}</p>
                    <p className="text-xs text-muted-foreground">Present</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card px-4 py-2 text-center min-w-16">
                    <p className="text-xl font-bold text-destructive">{absentCount}</p>
                    <p className="text-xs text-muted-foreground">Absent</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card px-4 py-2 text-center min-w-16">
                    <p className="text-xl font-bold">{sessionRecords.length}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>
                {!selectedSession.reconciled_at && sessionRecords.length > 0 && (
                  <div className="flex gap-2 ml-auto">
                    <button onClick={() => void markAll("present")}
                      className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                      All Present
                    </button>
                    <button onClick={() => void markAll("missing_attendance")}
                      className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">
                      All Absent
                    </button>
                  </div>
                )}
              </div>

              {/* Student grid — tap to toggle present/absent */}
              {recordsLoading ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {[1,2,3,4,5,6].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
                </div>
              ) : sessionRecords.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
                  No attendance records yet. Students will appear as they scan biometric devices.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {sessionRecords.map(r => {
                    const status = localStatus[r.student_id] ?? r.status;
                    const isPresent = status === "present" || status === "on_approved_leave";
                    const isAbsent  = status === "missing_attendance";
                    const isSaving  = savingIds.has(r.student_id);

                    return (
                      <button key={r.id}
                        onClick={() => !selectedSession.reconciled_at && handleToggleStatus(r, isPresent ? "missing_attendance" : "present")}
                        disabled={!!selectedSession.reconciled_at}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border p-3 text-left transition relative",
                          isPresent ? "border-emerald-300 bg-emerald-50" : isAbsent ? "border-red-300 bg-red-50" : "border-border bg-background",
                          !selectedSession.reconciled_at && "active:scale-95 cursor-pointer"
                        )}>
                        {/* Photo or initials */}
                        {r.student?.photo_url ? (
                          <img src={r.student.photo_url} alt="" className="h-10 w-10 rounded-full object-cover border-2 border-white shrink-0 shadow-sm" />
                        ) : (
                          <div className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0",
                            isPresent ? "bg-emerald-200 text-emerald-800" : isAbsent ? "bg-red-200 text-red-800" : "bg-muted text-muted-foreground"
                          )}>
                            {((r.student?.first_name?.[0] ?? "") + (r.student?.last_name?.[0] ?? "")).toUpperCase() || "?"}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">
                            {r.student ? `${r.student.first_name} ${r.student.last_name}` : "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground">{r.student?.student_id_number ?? "—"}</p>
                        </div>
                        {/* Status badge */}
                        <div className="shrink-0">
                          {isSaving ? (
                            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : isPresent ? (
                            <CheckCircle className="h-5 w-5 text-emerald-600" />
                          ) : isAbsent ? (
                            <UserX className="h-5 w-5 text-red-600" />
                          ) : (
                            <Clock className="h-5 w-5 text-amber-500" />
                          )}
                        </div>
                        {/* Right-click for manual correction */}
                        {!selectedSession.reconciled_at && (
                          <button
                            onClick={e => { e.stopPropagation(); setCorrecting(r); setCorrectForm({ status: r.status, reason: "" }); }}
                            className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 hover:opacity-100 p-1 rounded text-muted-foreground hover:text-primary text-[10px]"
                            title="Manual correction">
                            <Save className="h-3 w-3" />
                          </button>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* New Session modal */}
      {showNewSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="font-display font-bold text-lg">Open Attendance Session</h2>
              <button onClick={() => setShowNewSession(false)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleCreateSession} className="p-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Session Name</label>
                <input value={sessionForm.session_name}
                  onChange={e => setSessionForm(f => ({...f, session_name: e.target.value}))}
                  placeholder="e.g. Morning Roll Call, Dinner, Lights Out"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Location Type</label>
                  <select value={sessionForm.location_type}
                    onChange={e => setSessionForm(f => ({...f, location_type: e.target.value}))}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                    {LOCATION_TYPES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Date</label>
                  <input type="date" value={sessionForm.session_date}
                    onChange={e => setSessionForm(f => ({...f, session_date: e.target.value}))}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={creatingSession}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                  <Plus className="h-4 w-4" /> {creatingSession ? "Opening..." : "Open Session"}
                </button>
                <button type="button" onClick={() => setShowNewSession(false)}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Push Students modal */}
      {showPush && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="font-display font-bold text-lg">Push Students to Device</h2>
              <button onClick={() => setShowPush(false)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handlePush} className="p-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Device</label>
                <select value={pushDevice} onChange={e => setPushDevice(e.target.value)} required
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                  <option value="">-- select device --</option>
                  {myDevices.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name}{d.dormitory?.name ? ` · ${d.dormitory.name}` : ""}{d.is_connected ? " ✓" : " [offline]"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Who to push</label>
                <select value={pushClassId} onChange={e => setPushClassId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                  <option value="">All active students (recommended for hostel device)</option>
                  {classes.map((c: any) => <option key={c.id} value={c.id}>Class: {c.name}</option>)}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  "All active students" pushes every student assigned to the device's dormitory.
                  Choose a class to push only that class.
                </p>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={pushing || !pushDevice}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                  <Upload className="h-4 w-4" /> {pushing ? "Pushing..." : "Push to Device"}
                </button>
                <button type="button" onClick={() => setShowPush(false)}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual correction modal */}
      {correcting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
            <h2 className="font-display font-bold text-lg mb-4">Manual Correction</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold mb-1">New Status</label>
                <select value={correctForm.status} onChange={e => setCorrectForm(p => ({...p, status: e.target.value}))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="on_approved_leave">On Approved Leave</option>
                  <option value="missing_attendance">Missing Attendance</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Reason (required)</label>
                <textarea value={correctForm.reason} onChange={e => setCorrectForm(p => ({...p, reason: e.target.value}))}
                  rows={3} placeholder="Biometric failure, approved exception..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={handleCorrect} disabled={savingCorr || !correctForm.reason.trim()}
                  className="flex-1 rounded-lg bg-primary text-primary-foreground py-2.5 font-semibold text-sm hover:bg-primary/90 disabled:opacity-50">
                  {savingCorr ? "Saving..." : "Save Correction"}
                </button>
                <button onClick={() => setCorrecting(null)}
                  className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PatronLayout>
  );
}
