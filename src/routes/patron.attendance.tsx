/**
 * Patron/Matron Boarding Attendance
 * - Create named sessions (Morning Roll Call, Dinner, Lights Out, etc.)
 * - Push classes/students to biometric devices in assigned dormitories
 * - View per-session attendance with manual correction
 * - Sessions are scoped to this patron's dorms only
 */
import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import {
  RefreshCw, AlertTriangle, CheckCircle, Clock, UserX,
  Plus, Cpu, Upload, X, Save, ChevronDown, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { PatronLayout } from "@/components/layout/PatronLayout";
import { patronRouteGuard } from "@/lib/schoolAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { patronApi, boardingAttendanceApi, type PatronAssignment, type BoardingSession } from "@/lib/boardingApi";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/patron/attendance")({
  beforeLoad: ({ location }) => patronRouteGuard(location),
  component: PatronAttendancePage,
});

// ── Types ────────────────────────────────────────────────────────────────────

type AttendanceRecord = {
  id: string; student_id: string; status: string; scan_time?: string | null;
  is_manual?: boolean; manual_reason?: string | null;
  student?: { id: string; first_name: string; last_name: string; photo_url?: string | null; student_id_number?: string | null } | null;
};

type Session = BoardingSession & {
  session_name?: string | null;
  location_type?: string;
  created_by?: string | null;
  records?: AttendanceRecord[];
};

type MyDevice = {
  id: string; name: string; device_uid: string; location_label?: string | null;
  is_connected: boolean; dormitory_id?: string | null;
  dormitory?: { id: string; name: string } | null;
  tablet?: { id: string; name: string } | null;
};

type ClassRecord = { id: string; name: string };

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Main Component ───────────────────────────────────────────────────────────

function PatronAttendancePage() {
  const { user } = useCurrentUser();

  // Dorms & devices
  const [myDorms,    setMyDorms]    = useState<PatronAssignment[]>([]);
  const [myDevices,  setMyDevices]  = useState<MyDevice[]>([]);
  const [classes,    setClasses]    = useState<ClassRecord[]>([]);
  const [selectedDorm, setSelectedDorm] = useState<string | null>(null);

  // Sessions
  const [sessions,        setSessions]        = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionRecords,  setSessionRecords]  = useState<AttendanceRecord[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [recordsLoading,  setRecordsLoading]  = useState(false);

  // Create session modal
  const [showNewSession, setShowNewSession] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    session_name: "", location_type: "dormitory", session_date: today,
  });
  const [creatingSession, setCreatingSession] = useState(false);

  // Push students modal
  const [showPush,    setShowPush]    = useState(false);
  const [pushDevice,  setPushDevice]  = useState("");
  const [pushClassId, setPushClassId] = useState("");
  const [pushing,     setPushing]     = useState(false);

  // Manual correction
  const [correcting,   setCorrecting]   = useState<AttendanceRecord | null>(null);
  const [correctForm,  setCorrectForm]  = useState({ status: "present", reason: "" });
  const [saving,       setSaving]       = useState(false);

  // ── Load initial data ─────────────────────────────────────────────────────

  const loadDormsAndDevices = async () => {
    if (!user?.id) return;
    try {
      const [dorms, devices, classRes] = await Promise.all([
        patronApi.listPatronAssignments(user.id).catch(() => [] as PatronAssignment[]),
        apiRequest<any>("/boarding/patrons/me/devices", { auth: "school" }).catch(() => ({ data: [] })),
        apiRequest<any>("/classes?limit=200", { auth: "school" }).catch(() => ({ data: [] })),
      ]);
      const dormList = Array.isArray(dorms) ? dorms : (dorms as any)?.data ?? [];
      setMyDorms(dormList);
      setMyDevices((devices as any)?.data ?? devices ?? []);
      setClasses((classRes as any)?.data ?? classRes ?? []);
      if (dormList[0] && !selectedDorm) {
        setSelectedDorm(dormList[0].dormitory_id);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load dorms");
    }
  };

  useEffect(() => { void loadDormsAndDevices(); }, [user?.id]);

  // ── Load sessions when dorm changes ──────────────────────────────────────

  const loadSessions = async (dormId: string) => {
    setSessionsLoading(true);
    try {
      const res = await apiRequest<any>(
        `/boarding/attendance/sessions?dormitory_id=${dormId}&limit=20`,
        { auth: "school" }
      );
      const list: Session[] = (res as any)?.data ?? res ?? [];
      setSessions(list);
      // Auto-select today's most recent session if exists
      const todaySession = list.find(s => s.session_date?.startsWith(today));
      if (todaySession) {
        setSelectedSession(todaySession);
        await loadSessionRecords(todaySession.id);
      } else {
        setSelectedSession(null);
        setSessionRecords([]);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load sessions");
    } finally { setSessionsLoading(false); }
  };

  useEffect(() => {
    if (selectedDorm) void loadSessions(selectedDorm);
  }, [selectedDorm]);

  const loadSessionRecords = async (sessionId: string) => {
    setRecordsLoading(true);
    try {
      const res = await boardingAttendanceApi.getSessionSummary(sessionId);
      setSessionRecords((res as any)?.records ?? []);
      setSelectedSession(prev => prev?.id === sessionId ? { ...prev, ...(res as any) } : prev);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load attendance");
    } finally { setRecordsLoading(false); }
  };

  // ── Create session ────────────────────────────────────────────────────────

  const handleCreateSession = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedDorm) { toast.error("Select a dormitory first"); return; }
    setCreatingSession(true);
    try {
      const body = {
        dormitory_id:  selectedDorm,
        session_date:  sessionForm.session_date,
        session_name:  sessionForm.session_name || null,
        location_type: sessionForm.location_type,
      };
      const res = await boardingAttendanceApi.openSession(selectedDorm, sessionForm.session_date, undefined, body);
      toast.success(`Session "${sessionForm.session_name || sessionForm.location_type}" opened`);
      setShowNewSession(false);
      setSessionForm({ session_name: "", location_type: "dormitory", session_date: today });
      await loadSessions(selectedDorm);
      setSelectedSession(res as any);
      await loadSessionRecords((res as any).id);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to open session");
    } finally { setCreatingSession(false); }
  };

  // ── Push students to device ───────────────────────────────────────────────

  const handlePush = async (e: FormEvent) => {
    e.preventDefault();
    if (!pushDevice) { toast.error("Select a device"); return; }
    const device = myDevices.find(d => d.id === pushDevice);
    if (!device?.tablet?.id) { toast.error("Device is not linked to a tablet"); return; }
    setPushing(true);
    try {
      const body: any = { mode: pushClassId ? "class" : "all" };
      if (pushClassId) body.class_id = pushClassId;
      await apiRequest(`/tablets/${device.tablet.id}/device/push-students`, {
        method: "POST", auth: "school", body: JSON.stringify(body),
      });
      toast.success(`Students pushed to ${device.name}`);
      setShowPush(false);
      setPushDevice("");
      setPushClassId("");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to push students");
    } finally { setPushing(false); }
  };

  // ── Reconcile ─────────────────────────────────────────────────────────────

  const handleReconcile = async () => {
    if (!selectedSession) return;
    try {
      await boardingAttendanceApi.reconcile(selectedSession.id);
      toast.success("Session reconciled");
      await loadSessionRecords(selectedSession.id);
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  // ── Manual correction ─────────────────────────────────────────────────────

  const handleCorrect = async () => {
    if (!selectedSession || !correcting || !correctForm.reason.trim()) {
      toast.error("Reason is required"); return;
    }
    setSaving(true);
    try {
      await boardingAttendanceApi.correctAttendance(
        selectedSession.id, correcting.student_id, correctForm.status, correctForm.reason
      );
      toast.success("Attendance corrected");
      setCorrecting(null);
      await loadSessionRecords(selectedSession.id);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally { setSaving(false); }
  };

  // ── Derived stats ─────────────────────────────────────────────────────────

  const missingCount = sessionRecords.filter(r => r.status === "missing_attendance").length;
  const dormName = (id: string) => myDorms.find(d => d.dormitory_id === id)?.dormitory?.name ?? id;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PatronLayout title="Boarding Attendance" subtitle="Sessions, device push, and attendance management">

      {/* ── Top toolbar ── */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {/* Dorm selector */}
        {myDorms.length > 0 && (
          <select value={selectedDorm ?? ""} onChange={e => setSelectedDorm(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold">
            {myDorms.map(d => (
              <option key={d.dormitory_id} value={d.dormitory_id}>{d.dormitory?.name ?? d.dormitory_id}</option>
            ))}
          </select>
        )}
        <button onClick={() => setShowNewSession(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New Session
        </button>
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

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">

        {/* ── Sessions sidebar ── */}
        <aside className="space-y-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sessions</p>
            {sessionsLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          {sessions.length === 0 && !sessionsLoading ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              No sessions yet. Click "New Session" to open one.
            </div>
          ) : (
            sessions.map(s => (
              <button key={s.id} onClick={() => { setSelectedSession(s); void loadSessionRecords(s.id); }}
                className={cn(
                  "w-full text-left rounded-xl border p-3 transition",
                  selectedSession?.id === s.id
                    ? "border-primary/40 bg-primary/5"
                    : "border-border hover:bg-muted/30"
                )}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm leading-tight">
                      {s.session_name ?? (s.location_type ?? "Session")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {s.session_date} · {s.location_type?.replace(/_/g, " ")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold",
                      s.reconciled_at ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {s.reconciled_at ? "Closed" : "Open"}
                    </span>
                  </div>
                </div>
                {s.reconciled_at == null && (
                  <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
                    <span className="text-emerald-600 font-bold">{s.total_present} present</span>
                    <span className="text-amber-600 font-bold">{s.total_late} late</span>
                    <span className="text-destructive font-bold">{s.total_missing} missing</span>
                  </div>
                )}
              </button>
            ))
          )}
        </aside>

        {/* ── Main attendance area ── */}
        <div className="space-y-4">
          {!selectedSession ? (
            <div className="rounded-xl border border-dashed border-border p-16 text-center">
              <Cpu className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Select a session on the left, or create a new one.</p>
            </div>
          ) : (
            <>
              {/* Session header */}
              <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="font-semibold text-lg">
                    {selectedSession.session_name ?? (selectedSession.location_type?.replace(/_/g, " ") ?? "Session")}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedSession.session_date} · {selectedDorm ? dormName(selectedDorm) : ""} · {selectedSession.location_type?.replace(/_/g, " ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!selectedSession.reconciled_at && (
                    <button onClick={handleReconcile}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">
                      <CheckCircle className="h-3.5 w-3.5" /> Reconcile
                    </button>
                  )}
                  <span className={cn(
                    "rounded-full px-3 py-1 text-xs font-bold",
                    selectedSession.reconciled_at ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  )}>
                    {selectedSession.reconciled_at ? "Closed" : "Open"}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatMini label="Expected" value={selectedSession.total_expected} />
                <StatMini label="Present"  value={selectedSession.total_present}  color="emerald" />
                <StatMini label="Late"     value={selectedSession.total_late}     color="amber" />
                <StatMini label="On Leave" value={selectedSession.total_on_leave} color="blue" />
                <StatMini label="Missing"  value={selectedSession.total_missing}  color="red" />
              </div>

              {/* Missing alert */}
              {missingCount > 0 && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {missingCount} student{missingCount !== 1 ? "s" : ""} missing — DOD will be notified on reconcile.
                </div>
              )}

              {/* Attendance records */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        {["Photo", "Student", "ID", "Status", "Scan Time", "Type", "Action"].map(h => (
                          <th key={h} className="text-left px-4 py-3 font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {recordsLoading ? (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                          <RefreshCw className="inline h-4 w-4 animate-spin mr-2" />Loading...
                        </td></tr>
                      ) : sessionRecords.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                          No records yet. Students will appear as they scan biometric devices.
                        </td></tr>
                      ) : sessionRecords.map(r => (
                        <tr key={r.id} className={cn("hover:bg-muted/20", r.status === "missing_attendance" && "bg-red-50")}>
                          <td className="px-4 py-3">
                            {r.student?.photo_url ? (
                              <img src={r.student.photo_url} alt="" className="h-8 w-8 rounded-full object-cover border border-border" />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                                {(r.student?.first_name?.[0] ?? "") + (r.student?.last_name?.[0] ?? "")}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {r.student ? `${r.student.first_name} ${r.student.last_name}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                            {r.student?.student_id_number ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {STATUS_ICON[r.status]}
                              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", STATUS_COLOR[r.status] ?? "bg-muted text-muted-foreground")}>
                                {r.status.replace(/_/g, " ")}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {r.scan_time ? new Date(r.scan_time).toLocaleTimeString() : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("text-xs font-semibold", r.is_manual ? "text-purple-600" : "text-muted-foreground")}>
                              {r.is_manual ? "Manual" : "Biometric"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => { setCorrecting(r); setCorrectForm({ status: r.status, reason: "" }); }}
                              className="text-xs font-semibold text-primary hover:underline">
                              Correct
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── New Session modal ── */}
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
                <p className="mt-1 text-xs text-muted-foreground">Give it a descriptive name so you can tell sessions apart</p>
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
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Dormitory: <strong>{selectedDorm ? dormName(selectedDorm) : "none"}</strong>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={creatingSession}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  <Plus className="h-4 w-4" />
                  {creatingSession ? "Opening..." : "Open Session"}
                </button>
                <button type="button" onClick={() => setShowNewSession(false)}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Push Students modal ── */}
      {showPush && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="font-display font-bold text-lg">Push Students to Device</h2>
                <p className="text-sm text-muted-foreground">Upload student list so biometric device recognises them</p>
              </div>
              <button onClick={() => setShowPush(false)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handlePush} className="p-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Device *</label>
                <select value={pushDevice} onChange={e => setPushDevice(e.target.value)} required
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                  <option value="">-- select device --</option>
                  {myDevices.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.dormitory?.name ? `(${d.dormitory.name})` : ""} {d.is_connected ? "" : "[offline]"}
                    </option>
                  ))}
                </select>
                {pushDevice && !myDevices.find(d => d.id === pushDevice)?.tablet?.id && (
                  <p className="mt-1 text-xs text-amber-600">This device is not linked to a tablet — contact admin</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Class (optional)</label>
                <select value={pushClassId} onChange={e => setPushClassId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                  <option value="">All boarding students in assigned dorms</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                Students will be enrolled on the biometric device. This is required before they can scan for attendance.
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={pushing || !pushDevice}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  <Upload className="h-4 w-4" />
                  {pushing ? "Pushing..." : "Push to Device"}
                </button>
                <button type="button" onClick={() => setShowPush(false)}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Manual correction modal ── */}
      {correcting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
            <h2 className="font-display font-bold text-lg mb-1">Manual Attendance Correction</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Biometric failure or operational exception only. Every change is audited.
            </p>
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
                <label className="block text-sm font-semibold mb-1">Reason *</label>
                <textarea value={correctForm.reason} onChange={e => setCorrectForm(p => ({...p, reason: e.target.value}))}
                  rows={3} placeholder="Biometric failure, approved exception..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={handleCorrect} disabled={saving || !correctForm.reason.trim()}
                  className="flex-1 rounded-lg bg-primary text-primary-foreground py-2.5 font-semibold text-sm hover:bg-primary/90 disabled:opacity-50">
                  {saving ? "Saving..." : "Save Correction"}
                </button>
                <button onClick={() => setCorrecting(null)}
                  className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PatronLayout>
  );
}

function StatMini({ label, value, color }: { label: string; value: number; color?: string }) {
  const colors: Record<string, string> = {
    emerald: "text-emerald-600", amber: "text-amber-600",
    blue: "text-blue-600",      red: "text-destructive",
  };
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <div className={cn("text-xl font-bold font-display", color ? colors[color] : "")}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
