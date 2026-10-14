/**
 * Device Management — School Admin
 *
 * Left panel: device list with live online/offline status.
 * Right panel (per selected device):
 *   • Status card — Check Status, Sync Time, Pull Logs, Get Users
 *   • Device metrics (users / fingerprints / faces / cards / logs / serial)
 *   • Assignment — assign device to gate / dormitory / dining hall / classroom
 *   • Sessions — view / create / delete attendance sessions, activate / deactivate
 *   • Push Students — all / by class / by section / by gender
 *   • Remove Students — remove from biometric device (selected / class / all)
 *   • Enrolled users — list with per-user delete
 *   • Danger zone — clear logs, clear all users, reboot device
 *   • Attendance scans — paginated date-filtered log table
 *
 * Backend endpoints used:
 *   GET    /devices?limit=200
 *   GET    /devices/:id/status
 *   POST   /devices/:id/push-students
 *   POST   /devices/:id/remove-students
 *   GET    /devices/:id/sessions
 *   POST   /devices/:id/sessions
 *   DELETE /devices/:id/sessions/:sid
 *   PATCH  /devices/:id/sessions/:sid/activate
 *   PATCH  /devices/:id/sessions/:sid/deactivate
 *   PATCH  /devices/:id/assign-location
 *   GET    /tablets/:id/device/users        (live from FK623)
 *   DELETE /tablets/:id/device/users/:uid
 *   POST   /tablets/:id/device/pull-logs
 *   POST   /tablets/:id/device/sync-time
 *   POST   /tablets/:id/device/clear-logs
 *   POST   /tablets/:id/device/clear-all
 *   POST   /tablets/:id/device/poweroff
 *   GET    /attendance/records/device-logs  (school attendance logs)
 *   GET    /classes + /sections             (for push filters)
 *   GET    /boarding/dormitories            (for dormitory assignment)
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  RefreshCw, Wifi, WifiOff, Upload, Download,
  Clock, Users, Activity, Fingerprint, Smile,
  CreditCard, HardDrive, Trash2, Plus, Settings,
  MapPin, Zap, ZapOff, AlertTriangle, ChevronDown,
  ChevronUp, Check, X, Shield,
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { deviceApi, type Device } from "@/lib/deviceApi";
import { tabletApi } from "@/lib/tabletApi";
import { fetchDeviceLogs } from "@/lib/device-logs-api";
import { Avatar } from "@/components/ui-kit/Avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { localDateInputValue } from "@/lib/dateInput";

// ── Types ─────────────────────────────────────────────────────────────────────
type ClassRecord    = { id: string; name: string };
type SectionRecord  = { id: string; name: string; full_name: string; class_id: string };
type Dormitory      = { id: string; name: string; block_name?: string | null };
type DeviceUser     = { userId?: string; id?: string; name?: string; privilege?: number; enabled?: boolean; biometricMethods?: string[] };
type DeviceSession  = { id: string; name: string; is_active: boolean; activated_at?: string | null; windows: { label: string; start_time: string; end_time: string }[] };
type AttendanceLog  = { id: string; studentName: string; studentId: string; timestamp: string; method: string; status: string; direction: string; className?: string | null; sessionName?: string | null };

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (ts?: string | null) => {
  if (!ts) return "—";
  const d = new Date(ts);
  return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
};
const fmtFull = (ts?: string | null) => {
  if (!ts) return "—";
  const d = new Date(ts);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString([], { dateStyle: "short", timeStyle: "short" });
};
const isLiveOnline = (d?: Device | null): boolean => {
  if (!d) return false;
  if (d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() < 90_000) return true;
  return Boolean(d.is_connected || d.is_online || d.status === "online");
};
const scopeBadge = (s?: string) => {
  if (s === "gate")        return "bg-emerald-100 text-emerald-700";
  if (s === "dormitory")   return "bg-blue-100 text-blue-700";
  if (s === "dining_hall") return "bg-amber-100 text-amber-700";
  if (s === "classroom")   return "bg-violet-100 text-violet-700";
  return "bg-muted text-muted-foreground";
};
const statusBadge = (s: string) => {
  const lower = s.toLowerCase();
  if (lower === "present" || lower === "on time") return "bg-success/15 text-success";
  if (lower === "late")   return "bg-amber-100 text-amber-700";
  if (lower === "absent") return "bg-destructive/15 text-destructive";
  return "bg-muted text-muted-foreground";
};

const LOGS_PER_PAGE  = 20;
const STATUS_POLL_MS = 15_000;

const SCOPES = [
  { value: "gate",        label: "Gate (entry / exit)" },
  { value: "dormitory",   label: "Dormitory / Hostel" },
  { value: "dining_hall", label: "Dining Hall" },
  { value: "classroom",   label: "Classroom" },
  { value: "library",     label: "Library" },
  { value: "other",       label: "Other" },
];

// ── Collapsible section wrapper ───────────────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = false, badge }: {
  title: string; icon: typeof Upload; children: React.ReactNode;
  defaultOpen?: boolean; badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
        <span className="flex items-center gap-2 font-semibold text-sm">
          <Icon className="h-4 w-4 text-primary" />
          {title}
          {badge}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="border-t border-border px-5 py-4">{children}</div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DeviceManagement() {
  const [devices,       setDevices]       = useState<Device[]>([]);
  const [selectedId,    setSelectedId]    = useState("");
  const [devLoading,    setDevLoading]    = useState(true);
  const [status,        setStatus]        = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const statusInFlight = useRef(false);

  // push
  const [pushMode,      setPushMode]      = useState<"all" | "class" | "section">("all");
  const [pushClassId,   setPushClassId]   = useState("");
  const [pushSectionId, setPushSectionId] = useState("");
  const [pushing,       setPushing]       = useState(false);
  const [classes,       setClasses]       = useState<ClassRecord[]>([]);
  const [sections,      setSections]      = useState<SectionRecord[]>([]);

  // remove students
  const [removeMode,    setRemoveMode]    = useState<"all" | "class">("all");
  const [rmClassId,     setRmClassId]     = useState("");
  const [removing,      setRemoving]      = useState(false);

  // users
  const [deviceUsers,   setDeviceUsers]   = useState<DeviceUser[]>([]);
  const [usersLoading,  setUsersLoading]  = useState(false);

  // sessions
  const [sessions,      setSessions]      = useState<DeviceSession[]>([]);
  const [sessLoading,   setSessLoading]   = useState(false);
  const [newSessName,   setNewSessName]   = useState("");
  const [newSessStart,  setNewSessStart]  = useState("07:00");
  const [newSessEnd,    setNewSessEnd]    = useState("08:30");
  const [savingSess,    setSavingSess]    = useState(false);

  // assignment
  const [dormitories,   setDormitories]  = useState<Dormitory[]>([]);
  const [assignScope,   setAssignScope]  = useState("gate");
  const [assignLabel,   setAssignLabel]  = useState("");
  const [assignDormId,  setAssignDormId] = useState("");
  const [assigning,     setAssigning]    = useState(false);

  // logs
  const [logs,          setLogs]         = useState<AttendanceLog[]>([]);
  const [logsLoading,   setLogsLoading]  = useState(false);
  const [logsDate,      setLogsDate]     = useState(localDateInputValue);
  const [logsPage,      setLogsPage]     = useState(1);
  const [logsMeta,      setLogsMeta]     = useState({ total: 0, totalPages: 1 });

  // ── Load devices ─────────────────────────────────────────────────────────
  const loadDevices = useCallback(async () => {
    setDevLoading(true);
    try {
      const res = await deviceApi.getAll({ limit: 200 });
      const list = res.data ?? [];
      setDevices(list);
      if (!selectedId && list[0]) setSelectedId(list[0].id);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load devices");
    } finally {
      setDevLoading(false);
    }
  }, [selectedId]);

  // ── Load device status ───────────────────────────────────────────────────
  const loadStatus = useCallback(async (silent = false) => {
    if (!selectedId || statusInFlight.current) return;
    statusInFlight.current = true;
    if (!silent) setStatusLoading(true);
    try {
      const res = await deviceApi.getStatus(selectedId);
      setStatus(res);
      setDevices(prev => prev.map(d =>
        d.id === selectedId ? { ...d, is_online: res?.is_online ?? false, is_connected: res?.is_connected ?? false } : d
      ));
    } catch {
      setStatus({ is_online: false, is_connected: false, status: "offline" });
    } finally {
      statusInFlight.current = false;
      if (!silent) setStatusLoading(false);
    }
  }, [selectedId]);

  // ── Load sessions ────────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    if (!selectedId) return;
    setSessLoading(true);
    try {
      const res = await apiRequest<any>(`/devices/${selectedId}/sessions`, { auth: "school" });
      const list = Array.isArray(res?.sessions) ? res.sessions
        : Array.isArray(res?.data) ? res.data
        : Array.isArray(res) ? res : [];
      setSessions(list.map((s: any) => ({
        id: String(s.id), name: s.name, is_active: Boolean(s.is_active),
        activated_at: s.activated_at ?? null,
        windows: Array.isArray(s.windows) ? s.windows : [],
      })));
    } catch { setSessions([]); }
    finally { setSessLoading(false); }
  }, [selectedId]);

  // ── Load attendance logs ─────────────────────────────────────────────────
  const loadLogs = useCallback(async () => {
    if (!selectedId) return;
    setLogsLoading(true);
    try {
      const res = await fetchDeviceLogs({ deviceId: selectedId, startDate: logsDate, endDate: logsDate, page: logsPage, limit: LOGS_PER_PAGE });
      setLogs(res.data as any[]);
      setLogsMeta({ total: res.meta.total, totalPages: res.meta.totalPages });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load logs");
    } finally {
      setLogsLoading(false);
    }
  }, [selectedId, logsDate, logsPage]);

  // ── Load dormitories for assignment ──────────────────────────────────────
  const loadDormitories = async () => {
    try {
      const res = await apiRequest<any>("/boarding/dormitories?limit=200", { auth: "school" });
      setDormitories(Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);
    } catch { setDormitories([]); }
  };

  // ── Seed assignment form from device data ─────────────────────────────────
  useEffect(() => {
    const dev = devices.find(d => d.id === selectedId);
    if (!dev) return;
    setAssignScope((dev as any).location_scope ?? "gate");
    setAssignLabel((dev as any).location_label ?? "");
    setAssignDormId((dev as any).dormitory_id ?? "");
  }, [selectedId, devices]);

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => { void loadDevices(); }, []);

  useEffect(() => {
    Promise.all([
      apiRequest<any[]>("/classes?limit=200", { auth: "school" }),
      apiRequest<any[]>("/sections?limit=500", { auth: "school" }),
    ]).then(([cl, se]) => {
      setClasses(Array.isArray(cl) ? cl : cl?.data ?? []);
      setSections(Array.isArray(se) ? se : se?.data ?? []);
    }).catch(() => {});
    void loadDormitories();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    void loadStatus();
    void loadSessions();
    const iv = setInterval(() => void loadStatus(true), STATUS_POLL_MS);
    return () => clearInterval(iv);
  }, [selectedId]);

  useEffect(() => { void loadLogs(); }, [loadLogs]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const selected  = devices.find(d => d.id === selectedId);
  const isOnline  = isLiveOnline(selected);
  const tabletId  = selected?.tablet_id ?? null;

  const handlePullLogs = async () => {
    if (!tabletId) { toast.error("Device is not linked to a tablet"); return; }
    try {
      const res = await tabletApi.pullLogs({ tabletId, readMark: 0 });
      toast.success(`Pulled ${res.data?.savedCount ?? 0} log(s), ${res.data?.duplicateCount ?? 0} duplicate(s)`);
      void loadLogs();
    } catch (e: any) { toast.error(e?.message ?? "Failed to pull logs"); }
  };

  const handleSyncTime = async () => {
    if (!tabletId) { toast.error("Device is not linked to a tablet"); return; }
    try {
      await tabletApi.syncTime(tabletId);
      toast.success("Device time synced to server time");
    } catch (e: any) { toast.error(e?.message ?? "Failed to sync time"); }
  };

  const handleGetUsers = async () => {
    if (!tabletId) { toast.error("Device is not linked to a tablet"); return; }
    setUsersLoading(true);
    try {
      const res = await tabletApi.getUsers(tabletId);
      setDeviceUsers(res.data?.users ?? []);
      toast.success(`${res.data?.count ?? 0} enrolled user(s) on device`);
    } catch (e: any) { toast.error(e?.message ?? "Failed to get users"); }
    finally { setUsersLoading(false); }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!tabletId) return;
    if (!window.confirm(`Remove user ${userId} from the device?`)) return;
    try {
      await tabletApi.removeUser(tabletId, userId);
      toast.success("User removed from device");
      setDeviceUsers(prev => prev.filter(u => (u.userId ?? u.id) !== userId));
    } catch (e: any) { toast.error(e?.message ?? "Failed to remove user"); }
  };

  const handlePushStudents = async () => {
    if (!selectedId) return;
    setPushing(true);
    try {
      const payload: any = { mode: pushMode };
      if (pushMode === "class"   && pushClassId)   payload.class_id   = pushClassId;
      if (pushMode === "section" && pushSectionId) payload.section_id = pushSectionId;
      const res = await deviceApi.pushStudents(selectedId, payload);
      const failed = (res as any).failed_count ?? 0;
      if (failed > 0) {
        toast.warning(`Pushed ${res.pushed_count} student(s). ${failed} failed.`);
      } else {
        toast.success(`Pushed ${res.pushed_count} student(s) to device`);
      }
      void loadStatus();
    } catch (e: any) { toast.error(e?.message ?? "Failed to push students"); }
    finally { setPushing(false); }
  };

  const handleRemoveStudents = async () => {
    if (!selectedId) return;
    const label = removeMode === "all" ? "ALL students" : `students from class`;
    if (!window.confirm(`Remove ${label} from the biometric device? Their fingerprints will be deleted.`)) return;
    setRemoving(true);
    try {
      const payload: any = { mode: removeMode };
      if (removeMode === "class" && rmClassId) payload.class_id = rmClassId;
      const res = await apiRequest<any>(`/devices/${selectedId}/remove-students`, {
        method: "POST", auth: "school", body: JSON.stringify(payload),
      });
      toast.success(`Removed ${(res as any).removed_count ?? 0} student(s) from device`);
      void loadStatus();
    } catch (e: any) { toast.error(e?.message ?? "Failed to remove students"); }
    finally { setRemoving(false); }
  };

  const handleClearLogs = async () => {
    if (!tabletId) { toast.error("Device is not linked to a tablet"); return; }
    if (!window.confirm("Clear ALL attendance logs from the physical device? This cannot be undone.")) return;
    try {
      await tabletApi.clearLogs(tabletId);
      toast.success("Device logs cleared");
    } catch (e: any) { toast.error(e?.message ?? "Failed to clear logs"); }
  };

  const handleClearAllUsers = async () => {
    if (!tabletId) { toast.error("Device is not linked to a tablet"); return; }
    if (!window.confirm("Delete ALL enrolled users from the physical device? All fingerprints will be lost.")) return;
    if (!window.confirm("Are you absolutely sure? This will remove every enrolled student from the FK623 device.")) return;
    try {
      await tabletApi.clearUsers(tabletId);
      toast.success("All users deleted from device");
      setDeviceUsers([]);
      void loadStatus();
    } catch (e: any) { toast.error(e?.message ?? "Failed to clear users"); }
  };

  const handleReboot = async () => {
    if (!tabletId) { toast.error("Device is not linked to a tablet"); return; }
    if (!window.confirm("Reboot the physical FK623 device?")) return;
    try {
      await tabletApi.resetDevice(tabletId);
      toast.success("Reboot command sent to device");
    } catch (e: any) { toast.error(e?.message ?? "Failed to reboot device"); }
  };

  const handleAssignLocation = async () => {
    if (!selectedId) return;
    setAssigning(true);
    try {
      await apiRequest(`/devices/${selectedId}/assign-location`, {
        method: "PATCH", auth: "school",
        body: JSON.stringify({
          location_scope: assignScope,
          location_label: assignLabel || null,
          dormitory_id:   assignDormId || null,
          auto_push:      false,
        }),
      });
      toast.success("Location saved");
      void loadDevices();
    } catch (e: any) { toast.error(e?.message ?? "Failed to save location"); }
    finally { setAssigning(false); }
  };

  const handleCreateSession = async () => {
    if (!selectedId || !newSessName.trim()) { toast.error("Enter a session name"); return; }
    setSavingSess(true);
    try {
      await apiRequest(`/devices/${selectedId}/sessions`, {
        method: "POST", auth: "school",
        body: JSON.stringify({
          name:    newSessName.trim(),
          windows: [{ label: "Present", start_time: newSessStart, end_time: newSessEnd }],
        }),
      });
      toast.success("Session created");
      setNewSessName("");
      void loadSessions();
    } catch (e: any) { toast.error(e?.message ?? "Failed to create session"); }
    finally { setSavingSess(false); }
  };

  const handleDeleteSession = async (sid: string) => {
    if (!window.confirm("Delete this session?")) return;
    try {
      await apiRequest(`/devices/${selectedId}/sessions/${sid}`, { method: "DELETE", auth: "school" });
      toast.success("Session deleted");
      void loadSessions();
    } catch (e: any) { toast.error(e?.message ?? "Failed to delete session"); }
  };

  const handleToggleSession = async (sid: string, isActive: boolean) => {
    try {
      await apiRequest(`/devices/${selectedId}/sessions/${sid}/${isActive ? "deactivate" : "activate"}`, {
        method: "PATCH", auth: "school",
      });
      toast.success(isActive ? "Session deactivated" : "Session activated");
      void loadSessions();
    } catch (e: any) { toast.error(e?.message ?? "Failed to toggle session"); }
  };

  const filteredSections = useMemo(() =>
    sections.filter(s => !pushClassId || s.class_id === pushClassId),
  [sections, pushClassId]);

  const rmSections = useMemo(() =>
    sections.filter(s => !rmClassId || s.class_id === rmClassId),
  [sections, rmClassId]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Device Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage biometric devices, push students, pull logs and view attendance
          </p>
        </div>
        <button onClick={() => void loadDevices()} disabled={devLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${devLoading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {devLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : devices.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
          No biometric devices registered for this school.
          Contact the platform administrator to register devices.
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[280px_1fr]">

          {/* ── LEFT: device list ──────────────────────────────────────── */}
          <div className="space-y-2">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Select Device
            </p>
            {devices.map(device => {
              const online = isLiveOnline(device);
              const active = device.id === selectedId;
              const scope  = (device as any).location_scope;
              const lbl    = (device as any).location_label;
              const syncErr = device.last_sync_error ?? (device as any).last_status_message;
              return (
                <button key={device.id} onClick={() => setSelectedId(device.id)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    active ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/40"
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${online ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
                    <span className="font-semibold text-sm truncate flex-1">{device.name}</span>
                    {online
                      ? <Wifi className="h-3.5 w-3.5 text-success shrink-0" />
                      : <WifiOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    }
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {scope && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${scopeBadge(scope)}`}>
                        {scope.replace("_", " ")}
                      </span>
                    )}
                    {lbl && <span className="text-[10px] text-muted-foreground">{lbl}</span>}
                    {!scope && <span className="text-[10px] text-amber-600">Unassigned</span>}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground font-mono truncate">{device.device_uid}</div>
                  {syncErr && (
                    <div className="mt-1 text-[10px] text-destructive truncate">{syncErr}</div>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── RIGHT: selected device panel ───────────────────────────── */}
          {selected && (
            <div className="space-y-4">

              {/* ── Status card ── */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    {statusLoading
                      ? <span className="h-3.5 w-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      : <span className={`h-3.5 w-3.5 rounded-full ${isOnline ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
                    }
                    <div>
                      <h2 className="font-bold text-lg">{selected.name}</h2>
                      <p className="text-xs text-muted-foreground">
                        {isOnline ? "Bridge online" : "Bridge offline"} ·{" "}
                        {status?.device_status?.connected ? "FK623 connected" : "FK623 not detected"} ·{" "}
                        {(selected as any).location_label ?? selected.location ?? "No location assigned"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => void loadStatus()} disabled={statusLoading}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50">
                      <Activity className="h-3.5 w-3.5" /> Check Status
                    </button>
                    <button onClick={handleSyncTime} disabled={!isOnline}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50">
                      <Clock className="h-3.5 w-3.5" /> Sync Time
                    </button>
                    <button onClick={handlePullLogs} disabled={!isOnline}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50">
                      <Download className="h-3.5 w-3.5" /> Pull Logs
                    </button>
                    <button onClick={handleGetUsers} disabled={!isOnline}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50">
                      <Users className="h-3.5 w-3.5" /> Get Users
                    </button>
                  </div>
                </div>

                {/* FK623 live metrics */}
                {status?.device_status && (
                  <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {[
                      { icon: Users,       label: "Users",        val: status.device_status.users        ?? 0 },
                      { icon: Fingerprint, label: "Fingerprints", val: status.device_status.fingerprints ?? 0 },
                      { icon: Smile,       label: "Faces",        val: status.device_status.faces        ?? 0 },
                      { icon: CreditCard,  label: "Cards",        val: status.device_status.cards        ?? 0 },
                      { icon: HardDrive,   label: "Logs",         val: status.device_status.logs         ?? 0 },
                      { icon: Shield,      label: "Serial",       val: status.device_status.serialNumber ?? "—" },
                    ].map(({ icon: Icon, label, val }) => (
                      <div key={label} className="rounded-lg border border-border bg-muted/20 p-2.5 text-center">
                        <Icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                        <div className="text-sm font-bold">{val}</div>
                        <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {selected.last_sync_at && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Last sync: {fmtFull(selected.last_sync_at)} · {selected.last_sync_status ?? "—"}
                  </p>
                )}
                {selected.last_sync_error && (
                  <p className="mt-1 text-xs text-destructive">{selected.last_sync_error}</p>
                )}
              </div>

              {/* ── Device Assignment ── */}
              <Section title="Device Assignment" icon={MapPin}
                badge={
                  (selected as any).location_scope
                    ? <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${scopeBadge((selected as any).location_scope)}`}>
                        {((selected as any).location_scope ?? "").replace("_", " ")}
                      </span>
                    : <span className="ml-2 text-[10px] text-amber-600">Not assigned</span>
                }
                defaultOpen={!(selected as any).location_scope}
              >
                <p className="mb-3 text-xs text-muted-foreground">
                  Assign this device to a location. Dormitory assignment automatically links biometric scans to boarding attendance.
                </p>
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold">Location Type</label>
                      <select value={assignScope} onChange={e => setAssignScope(e.target.value)}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                        {SCOPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold">
                        Location Name
                        <span className="ml-1 font-normal text-muted-foreground">(e.g. "Main Gate", "Boys Hostel")</span>
                      </label>
                      <input value={assignLabel} onChange={e => setAssignLabel(e.target.value)}
                        placeholder={assignScope === "gate" ? "Main Gate" : assignScope === "dormitory" ? "Boys Hostel" : "Enter name"}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
                    </div>
                  </div>
                  {assignScope === "dormitory" && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold">Link to Dormitory</label>
                      <select value={assignDormId} onChange={e => setAssignDormId(e.target.value)}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                        <option value="">— select dormitory —</option>
                        {dormitories.map(d => (
                          <option key={d.id} value={d.id}>{d.name}{d.block_name ? ` (${d.block_name})` : ""}</option>
                        ))}
                      </select>
                      {dormitories.length === 0 && (
                        <p className="mt-1 text-xs text-amber-600">No dormitories found. Create them in Boarding → Dormitories first.</p>
                      )}
                    </div>
                  )}
                  <button onClick={handleAssignLocation} disabled={assigning}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    {assigning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Save Location
                  </button>
                </div>
              </Section>

              {/* ── Sessions ── */}
              <Section title="Attendance Sessions" icon={Settings}
                badge={
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {sessions.length}
                  </span>
                }
                defaultOpen={false}
              >
                <p className="mb-3 text-xs text-muted-foreground">
                  Sessions define time windows for attendance. The system auto-activates the matching session each day.
                </p>
                {/* Existing sessions */}
                {sessLoading ? (
                  <div className="space-y-2 mb-4"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
                ) : sessions.length === 0 ? (
                  <p className="mb-4 text-xs text-muted-foreground">No sessions yet. Create one below.</p>
                ) : (
                  <div className="mb-4 space-y-2">
                    {sessions.map(s => (
                      <div key={s.id} className={`flex items-center gap-3 rounded-lg border p-3 ${s.is_active ? "border-success bg-success/5" : "border-border"}`}>
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${s.is_active ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{s.name}</span>
                            {s.is_active && <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success uppercase">Active</span>}
                          </div>
                          {s.windows.length > 0 && (
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {s.windows.map(w => `${w.label}: ${w.start_time}–${w.end_time}`).join(" · ")}
                            </div>
                          )}
                          {s.is_active && s.activated_at && (
                            <div className="text-[10px] text-success mt-0.5">
                              Activated {fmtFull(s.activated_at)}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={() => handleToggleSession(s.id, s.is_active)}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold ${
                              s.is_active ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-border hover:bg-muted"
                            }`}>
                            {s.is_active ? <ZapOff className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                            {s.is_active ? "Deactivate" : "Activate"}
                          </button>
                          <button onClick={() => handleDeleteSession(s.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[10px] font-semibold text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Create new session */}
                <div className="rounded-lg border border-dashed border-border p-3 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground">New session</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">Name</label>
                      <input value={newSessName} onChange={e => setNewSessName(e.target.value)}
                        placeholder="e.g. Morning" className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">Start time</label>
                      <input type="time" value={newSessStart} onChange={e => setNewSessStart(e.target.value)}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">End time</label>
                      <input type="time" value={newSessEnd} onChange={e => setNewSessEnd(e.target.value)}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm" />
                    </div>
                  </div>
                  <button onClick={handleCreateSession} disabled={savingSess || !newSessName.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50">
                    <Plus className="h-3.5 w-3.5" /> Add Session
                  </button>
                </div>
              </Section>

              {/* ── Push Students ── */}
              <Section title="Push Students to Device" icon={Upload} defaultOpen={false}>
                <p className="mb-3 text-xs text-muted-foreground">
                  Sends student records to the FK623 biometric device so students can scan.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">Mode</label>
                    <select value={pushMode} onChange={e => { setPushMode(e.target.value as any); setPushClassId(""); setPushSectionId(""); }}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="all">All active students</option>
                      <option value="class">By class</option>
                      <option value="section">By section</option>
                    </select>
                  </div>
                  {(pushMode === "class" || pushMode === "section") && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground">Class</label>
                      <select value={pushClassId} onChange={e => { setPushClassId(e.target.value); setPushSectionId(""); }}
                        className="h-9 min-w-36 rounded-md border border-input bg-background px-3 text-sm">
                        <option value="">All classes</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}
                  {pushMode === "section" && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground">Section</label>
                      <select value={pushSectionId} onChange={e => setPushSectionId(e.target.value)}
                        className="h-9 min-w-40 rounded-md border border-input bg-background px-3 text-sm">
                        <option value="">Select section</option>
                        {filteredSections.map(s => <option key={s.id} value={s.id}>{s.full_name || s.name}</option>)}
                      </select>
                    </div>
                  )}
                  <button onClick={handlePushStudents}
                    disabled={pushing || (pushMode === "section" && !pushSectionId)}
                    className="h-9 inline-flex items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    {pushing
                      ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Pushing…</>
                      : <><Upload className="h-3.5 w-3.5" /> Push Students</>
                    }
                  </button>
                </div>
                {!isOnline && (
                  <p className="mt-2 text-xs text-amber-600">
                    ⚠ Device appears offline. The system will retry for up to 5 minutes.
                  </p>
                )}
              </Section>

              {/* ── Remove Students ── */}
              <Section title="Remove Students from Device" icon={X} defaultOpen={false}>
                <p className="mb-3 text-xs text-muted-foreground">
                  Removes student records and fingerprints from the FK623 device. Does NOT delete students from the school system.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">Remove</label>
                    <select value={removeMode} onChange={e => { setRemoveMode(e.target.value as any); setRmClassId(""); }}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="all">All students</option>
                      <option value="class">By class</option>
                    </select>
                  </div>
                  {removeMode === "class" && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground">Class</label>
                      <select value={rmClassId} onChange={e => setRmClassId(e.target.value)}
                        className="h-9 min-w-36 rounded-md border border-input bg-background px-3 text-sm">
                        <option value="">Select class</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}
                  <button onClick={handleRemoveStudents}
                    disabled={removing || (removeMode === "class" && !rmClassId)}
                    className="h-9 inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50">
                    {removing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    {removing ? "Removing…" : "Remove Students"}
                  </button>
                </div>
              </Section>

              {/* ── Enrolled Users ── */}
              <Section title="Enrolled Users on Device" icon={Users}
                badge={
                  deviceUsers.length > 0
                    ? <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{deviceUsers.length}</span>
                    : null
                }
                defaultOpen={false}
              >
                <div className="flex gap-2 mb-3">
                  <button onClick={handleGetUsers} disabled={usersLoading || !isOnline}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50">
                    <RefreshCw className={`h-3.5 w-3.5 ${usersLoading ? "animate-spin" : ""}`} />
                    {usersLoading ? "Loading…" : "Fetch from device"}
                  </button>
                </div>
                {usersLoading ? (
                  <div className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
                ) : deviceUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Click "Fetch from device" to load enrolled users.</p>
                ) : (
                  <div className="max-h-80 overflow-y-auto divide-y divide-border rounded-lg border border-border">
                    {deviceUsers.map(u => {
                      const uid = u.userId ?? u.id ?? "?";
                      return (
                        <div key={uid} className="flex items-center gap-3 px-4 py-2.5">
                          <Avatar name={u.name || uid} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{u.name || "—"}</div>
                            <div className="text-xs text-muted-foreground font-mono">ID: {uid}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {(u.biometricMethods ?? []).map((m: string) => (
                              <span key={m} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize">{m}</span>
                            ))}
                            <button onClick={() => handleDeleteUser(uid)}
                              className="rounded-lg border border-destructive/30 p-1.5 text-destructive hover:bg-destructive/10">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>

              {/* ── Danger Zone ── */}
              <Section title="Danger Zone" icon={AlertTriangle} defaultOpen={false}>
                <p className="mb-4 text-xs text-muted-foreground">
                  These actions directly affect the physical FK623 device and <b>cannot be undone</b>.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                    <p className="text-xs font-semibold text-amber-800">Clear Device Logs</p>
                    <p className="text-[10px] text-amber-700">Deletes all attendance log records stored on the FK623 device. DB records are kept.</p>
                    <button onClick={handleClearLogs} disabled={!isOnline}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-200 disabled:opacity-50">
                      <HardDrive className="h-3.5 w-3.5" /> Clear Logs
                    </button>
                  </div>
                  <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 space-y-2">
                    <p className="text-xs font-semibold text-orange-800">Delete All Users</p>
                    <p className="text-[10px] text-orange-700">Removes every enrolled user and their biometric data from the FK623 device.</p>
                    <button onClick={handleClearAllUsers} disabled={!isOnline}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-orange-300 bg-orange-100 px-3 py-1.5 text-xs font-semibold text-orange-800 hover:bg-orange-200 disabled:opacity-50">
                      <Users className="h-3.5 w-3.5" /> Delete All Users
                    </button>
                  </div>
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                    <p className="text-xs font-semibold text-destructive">Reboot Device</p>
                    <p className="text-[10px] text-destructive/80">Sends a power-off / reboot command to the FK623 device. It will restart automatically.</p>
                    <button onClick={handleReboot} disabled={!isOnline}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50">
                      <RefreshCw className="h-3.5 w-3.5" /> Reboot Device
                    </button>
                  </div>
                </div>
              </Section>

              {/* ── Attendance Scans ── */}
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border">
                  <h3 className="font-semibold flex items-center gap-2 text-sm">
                    <Activity className="h-4 w-4" /> Attendance Scans — {selected.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <input type="date" value={logsDate}
                      onChange={e => { setLogsDate(e.target.value); setLogsPage(1); }}
                      className="h-8 rounded-md border border-input bg-background px-2 text-sm" />
                    <button onClick={() => void loadLogs()} disabled={logsLoading}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50">
                      <RefreshCw className={`h-3.5 w-3.5 ${logsLoading ? "animate-spin" : ""}`} /> Reload
                    </button>
                  </div>
                </div>

                {logsLoading ? (
                  <div className="p-4 space-y-2">
                    {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : logs.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                    No attendance scans found for this device on {logsDate}.
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                          <tr>
                            {["#","Student","Class","Session","Time","Method","Direction","Status"].map(h => (
                              <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {logs.map((log, i) => (
                            <tr key={log.id} className="border-t border-border hover:bg-muted/20">
                              <td className="px-4 py-2.5 text-muted-foreground text-xs">{(logsPage - 1) * LOGS_PER_PAGE + i + 1}</td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <Avatar name={log.studentName} size="sm" />
                                  <div>
                                    <div className="font-medium text-sm whitespace-nowrap">{log.studentName}</div>
                                    <div className="text-xs text-muted-foreground font-mono">{log.studentId}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-xs">{(log as any).className ?? "—"}</td>
                              <td className="px-4 py-2.5 text-xs">
                                {log.sessionName
                                  ? <span className="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-[10px] font-semibold">{log.sessionName}</span>
                                  : "—"
                                }
                              </td>
                              <td className="px-4 py-2.5 text-xs whitespace-nowrap">{fmt(log.timestamp)}</td>
                              <td className="px-4 py-2.5 text-xs capitalize text-muted-foreground">{log.method}</td>
                              <td className="px-4 py-2.5">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  log.direction === "In" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                }`}>{log.direction}</span>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${statusBadge(log.status)}`}>
                                  {log.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {logsMeta.totalPages > 1 && (
                      <div className="flex items-center justify-between px-5 py-3 border-t border-border text-sm">
                        <span className="text-xs text-muted-foreground">
                          {(logsPage - 1) * LOGS_PER_PAGE + 1}–{Math.min(logsPage * LOGS_PER_PAGE, logsMeta.total)} of {logsMeta.total}
                        </span>
                        <div className="flex gap-2">
                          <button onClick={() => setLogsPage(p => p - 1)} disabled={logsPage <= 1}
                            className="rounded-md border border-border px-3 py-1 text-xs disabled:opacity-50 hover:bg-muted">Previous</button>
                          <span className="px-2 py-1 text-xs text-muted-foreground">{logsPage} / {logsMeta.totalPages}</span>
                          <button onClick={() => setLogsPage(p => p + 1)} disabled={logsPage >= logsMeta.totalPages}
                            className="rounded-md border border-border px-3 py-1 text-xs disabled:opacity-50 hover:bg-muted">Next</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}
