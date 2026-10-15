import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  RefreshCw, Wifi, WifiOff, Upload, Download, Clock,
  Users, Activity, Fingerprint, Smile, CreditCard,
  HardDrive, Trash2, Plus, MapPin, Zap, ZapOff,
  AlertTriangle, ChevronDown, ChevronUp, Check, X,
  Shield, Search,
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { deviceApi, type Device } from "@/lib/deviceApi";
import { tabletApi } from "@/lib/tabletApi";
import { fetchDeviceLogs } from "@/lib/device-logs-api";
import type { DeviceLog } from "@/lib/device-logs-types";
import { Avatar } from "@/components/ui-kit/Avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { localDateInputValue } from "@/lib/dateInput";

// ─── Types ────────────────────────────────────────────────────────────────────
type ClassRecord   = { id: string; name: string };
type SectionRecord = { id: string; name: string; full_name: string; class_id: string };
type Dormitory     = { id: string; name: string; block_name?: string | null };
type DeviceUser    = {
  userId?: string; id?: string; name?: string;
  privilege?: number; enabled?: boolean; biometricMethods?: string[];
};
type DeviceSession = {
  id: string; name: string; is_active: boolean; activated_at?: string | null;
  windows: { id?: string; label: string; start_time: string; end_time: string; grace_minutes?: number }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtTime = (ts?: string | null) => {
  if (!ts) return "—";
  const d = new Date(ts);
  return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
};
const fmtFull = (ts?: string | null) => {
  if (!ts) return "—";
  const d = new Date(ts);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};
const isLiveOnline = (d?: Device | null): boolean => {
  if (!d) return false;
  if (d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() < 90_000) return true;
  return Boolean(d.is_connected || d.is_online || d.status === "online");
};
const scopeColor = (s?: string) => {
  if (s === "gate")        return "bg-emerald-100 text-emerald-700";
  if (s === "dormitory")   return "bg-blue-100 text-blue-700";
  if (s === "dining_hall") return "bg-amber-100 text-amber-700";
  if (s === "classroom")   return "bg-violet-100 text-violet-700";
  return "bg-muted text-muted-foreground";
};
const statusBadge = (s: string) => {
  const l = s.toLowerCase();
  if (l === "present") return "bg-success/15 text-success";
  if (l === "late")    return "bg-amber-100 text-amber-700";
  if (l === "absent")  return "bg-destructive/15 text-destructive";
  return "bg-muted text-muted-foreground";
};

const LOGS_PER_PAGE  = 25;
const STATUS_POLL_MS = 20_000;

const SCOPES = [
  { value: "gate",        label: "Gate (entry / exit)" },
  { value: "dormitory",   label: "Dormitory / Hostel" },
  { value: "dining_hall", label: "Dining Hall" },
  { value: "classroom",   label: "Classroom" },
  { value: "library",     label: "Library" },
  { value: "other",       label: "Other" },
];

// ─── Collapsible section ──────────────────────────────────────────────────────
function Section({
  title, icon: Icon, children, defaultOpen = false, badge, danger = false,
}: {
  title: string;
  icon: typeof Upload;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  danger?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-xl border bg-card shadow-sm overflow-hidden ${danger ? "border-destructive/30" : "border-border"}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex w-full items-center justify-between px-5 py-3.5 transition-colors hover:bg-muted/30 ${danger ? "bg-destructive/5" : ""}`}
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          <Icon className={`h-4 w-4 shrink-0 ${danger ? "text-destructive" : "text-primary"}`} />
          {title}
          {badge}
        </span>
        {open
          ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        }
      </button>
      {open && <div className="border-t border-border px-5 py-4">{children}</div>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DeviceManagement() {
  const [devices,       setDevices]       = useState<Device[]>([]);
  const [selectedId,    setSelectedId]    = useState("");
  const [devLoading,    setDevLoading]    = useState(true);
  const [status,        setStatus]        = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const statusFlight                      = useRef(false);

  const [classes,     setClasses]     = useState<ClassRecord[]>([]);
  const [sections,    setSections]    = useState<SectionRecord[]>([]);
  const [dormitories, setDormitories] = useState<Dormitory[]>([]);

  // push
  const [pushMode,      setPushMode]      = useState<"all" | "class" | "section">("all");
  const [pushClassId,   setPushClassId]   = useState("");
  const [pushSectionId, setPushSectionId] = useState("");
  const [pushing,       setPushing]       = useState(false);

  // remove
  const [removeMode, setRemoveMode] = useState<"all" | "class">("all");
  const [rmClassId,  setRmClassId]  = useState("");
  const [removing,   setRemoving]   = useState(false);

  // users
  const [deviceUsers,  setDeviceUsers]  = useState<DeviceUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch,   setUserSearch]   = useState("");

  // sessions
  const [sessions,  setSessions]  = useState<DeviceSession[]>([]);
  const [sessLoad,  setSessLoad]  = useState(false);
  const [newName,   setNewName]   = useState("");
  const [newStart,  setNewStart]  = useState("07:00");
  const [newEnd,    setNewEnd]    = useState("08:30");
  const [saveSess,  setSaveSess]  = useState(false);

  // assignment
  const [aScope,    setAScope]    = useState("gate");
  const [aLabel,    setALabel]    = useState("");
  const [aDorm,     setADorm]     = useState("");
  const [assigning, setAssigning] = useState(false);

  // logs + filters
  const [logs,       setLogs]       = useState<DeviceLog[]>([]);
  const [logsLoad,   setLogsLoad]   = useState(false);
  const [logsDate,   setLogsDate]   = useState(localDateInputValue);
  const [logsPage,   setLogsPage]   = useState(1);
  const [logsMeta,   setLogsMeta]   = useState({ total: 0, totalPages: 1 });
  const [search,     setSearch]     = useState("");   // name / student ID / device user ID
  const [filterMethod,    setFilterMethod]    = useState("");
  const [filterStatus,    setFilterStatus]    = useState("");
  const [filterSession,   setFilterSession]   = useState("");
  const [filterDirection, setFilterDirection] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(search); setLogsPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  // ── Loaders ────────────────────────────────────────────────────────────────
  const loadDevices = useCallback(async () => {
    setDevLoading(true);
    try {
      const res = await deviceApi.getAll({ limit: 200 });
      const list = res.data ?? [];
      setDevices(list);
      if (!selectedId && list[0]) setSelectedId(list[0].id);
    } catch (e: any) { toast.error(e?.message ?? "Failed to load devices"); }
    finally { setDevLoading(false); }
  }, [selectedId]);

  const loadStatus = useCallback(async (silent = false) => {
    if (!selectedId || statusFlight.current) return;
    statusFlight.current = true;
    if (!silent) setStatusLoading(true);
    try {
      const res = await deviceApi.getStatus(selectedId);
      setStatus(res);
      setDevices(prev => prev.map(d =>
        d.id === selectedId
          ? { ...d, is_online: res?.is_online ?? false, is_connected: res?.is_connected ?? false }
          : d
      ));
    } catch { setStatus({ is_online: false, is_connected: false }); }
    finally { statusFlight.current = false; if (!silent) setStatusLoading(false); }
  }, [selectedId]);

  const loadSessions = useCallback(async () => {
    if (!selectedId) return;
    setSessLoad(true);
    try {
      const res = await apiRequest<any>(`/devices/${selectedId}/sessions`, { auth: "school" });
      const raw = Array.isArray(res?.sessions) ? res.sessions
        : Array.isArray(res?.data) ? res.data
        : Array.isArray(res) ? res : [];
      setSessions(raw.map((s: any) => ({
        id: String(s.id), name: s.name, is_active: Boolean(s.is_active),
        activated_at: s.activated_at ?? null,
        windows: Array.isArray(s.windows) ? s.windows : [],
      })));
    } catch { setSessions([]); }
    finally { setSessLoad(false); }
  }, [selectedId]);

  const loadLogs = useCallback(async () => {
    if (!selectedId) return;
    setLogsLoad(true);
    try {
      const res = await fetchDeviceLogs({
        deviceId:  selectedId,
        startDate: logsDate,
        endDate:   logsDate,
        page:      logsPage,
        limit:     LOGS_PER_PAGE,
        search:    debouncedQ      || undefined,
        method:    filterMethod    || undefined,
        status:    filterStatus    || undefined,
      });
      // Client-side filters for direction and session (not all backends support them as query params)
      let data = res.data as any[];
      if (filterDirection) data = data.filter(l => (l.direction  ?? "").toLowerCase() === filterDirection.toLowerCase());
      if (filterSession)   data = data.filter(l => (l.sessionName ?? (l as any).attendance_period ?? "").toLowerCase().includes(filterSession.toLowerCase()));
      setLogs(data);
      setLogsMeta({ total: res.meta.total, totalPages: res.meta.totalPages });
    } catch (e: any) { toast.error(e?.message ?? "Failed to load logs"); }
    finally { setLogsLoad(false); }
  }, [selectedId, logsDate, logsPage, debouncedQ, filterMethod, filterStatus, filterDirection, filterSession]);

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => { void loadDevices(); }, []);

  useEffect(() => {
    Promise.all([
      apiRequest<any>("/classes?limit=200",             { auth: "school" }),
      apiRequest<any>("/sections?limit=500",            { auth: "school" }),
      apiRequest<any>("/boarding/dormitories?limit=200",{ auth: "school" }),
    ]).then(([cl, se, do_]) => {
      setClasses(Array.isArray(cl)   ? cl   : cl?.data   ?? []);
      setSections(Array.isArray(se)  ? se   : se?.data   ?? []);
      setDormitories(Array.isArray(do_) ? do_ : do_?.data ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    void loadStatus();
    void loadSessions();
    const iv = setInterval(() => void loadStatus(true), STATUS_POLL_MS);
    return () => clearInterval(iv);
  }, [selectedId]);

  useEffect(() => { void loadLogs(); }, [loadLogs]);

  // Seed assignment form when device changes
  useEffect(() => {
    const dev = devices.find(d => d.id === selectedId);
    if (!dev) return;
    setAScope((dev as any).location_scope ?? "gate");
    setALabel((dev as any).location_label ?? "");
    setADorm((dev as any).dormitory_id ?? "");
  }, [selectedId, devices]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const selected = devices.find(d => d.id === selectedId);
  const isOnline = isLiveOnline(selected);
  const tabletId = selected?.tablet_id ?? null;
  const fkStatus = status?.device_status ?? status?.data ?? null;

  const filteredSections = useMemo(() =>
    sections.filter(s => !pushClassId || s.class_id === pushClassId),
  [sections, pushClassId]);

  const sessionNames = useMemo(() =>
    [...new Set([
      ...sessions.map(s => s.name),
      ...logs.map(l => (l as any).sessionName).filter(Boolean),
    ])].sort(),
  [sessions, logs]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return deviceUsers;
    return deviceUsers.filter(u =>
      (u.name ?? "").toLowerCase().includes(q) ||
      (u.userId ?? u.id ?? "").toLowerCase().includes(q)
    );
  }, [deviceUsers, userSearch]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handlePullLogs = async () => {
    if (!tabletId) { toast.error("Device is not linked to a tablet"); return; }
    try {
      const res = await tabletApi.pullLogs({ tabletId, readMark: 0 });
      toast.success(`Pulled ${res.data?.savedCount ?? 0} log(s) — ${res.data?.duplicateCount ?? 0} duplicate(s)`);
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
    if (!window.confirm(`Remove user ${userId} from the physical device?`)) return;
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
      failed > 0
        ? toast.warning(`Pushed ${res.pushed_count} student(s) — ${failed} failed`)
        : toast.success(`Pushed ${res.pushed_count} student(s) to device`);
      void loadStatus();
    } catch (e: any) { toast.error(e?.message ?? "Failed to push students"); }
    finally { setPushing(false); }
  };

  const handleRemoveStudents = async () => {
    if (!selectedId) return;
    const label = removeMode === "all" ? "ALL students" : "students from selected class";
    if (!window.confirm(`Remove ${label} from the FK623 device? Their fingerprints will be deleted.`)) return;
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
    if (!window.confirm("Clear ALL attendance logs from the FK623 device? This cannot be undone.")) return;
    try {
      await tabletApi.clearLogs(tabletId);
      toast.success("Device logs cleared");
    } catch (e: any) { toast.error(e?.message ?? "Failed to clear logs"); }
  };

  const handleClearAllUsers = async () => {
    if (!tabletId) { toast.error("Device is not linked to a tablet"); return; }
    if (!window.confirm("Delete ALL enrolled users from the FK623 device? All fingerprints will be lost.")) return;
    if (!window.confirm("Confirm again — this removes every enrolled student from the device.")) return;
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
      toast.success("Reboot command sent");
    } catch (e: any) { toast.error(e?.message ?? "Failed to reboot device"); }
  };

  const handleAssignLocation = async () => {
    if (!selectedId) return;
    setAssigning(true);
    try {
      await apiRequest(`/devices/${selectedId}/assign-location`, {
        method: "PATCH", auth: "school",
        body: JSON.stringify({
          location_scope: aScope,
          location_label: aLabel || null,
          dormitory_id:   aDorm  || null,
          auto_push:      false,
        }),
      });
      toast.success("Location saved");
      void loadDevices();
    } catch (e: any) { toast.error(e?.message ?? "Failed to save location"); }
    finally { setAssigning(false); }
  };

  const handleCreateSession = async () => {
    if (!selectedId || !newName.trim()) { toast.error("Enter a session name"); return; }
    setSaveSess(true);
    try {
      await apiRequest(`/devices/${selectedId}/sessions`, {
        method: "POST", auth: "school",
        body: JSON.stringify({
          name:    newName.trim(),
          windows: [{ label: "Present", start_time: newStart, end_time: newEnd }],
        }),
      });
      toast.success("Session created");
      setNewName("");
      void loadSessions();
    } catch (e: any) { toast.error(e?.message ?? "Failed to create session"); }
    finally { setSaveSess(false); }
  };

  const handleDeleteSession = async (sid: string) => {
    if (!window.confirm("Delete this attendance session?")) return;
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

  // ── Render ─────────────────────────────────────────────────────────────────
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
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" />
        </div>
      ) : devices.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No biometric devices registered for this school.</p>
          <p className="mt-1 text-sm">Contact the platform administrator to register devices.</p>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[272px_1fr]">

          {/* ═══ LEFT: device list ═══ */}
          <div className="space-y-2">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Select Device
            </p>
            {devices.map(device => {
              const online   = isLiveOnline(device);
              const isActive = device.id === selectedId;
              const scope    = (device as any).location_scope;
              const lbl      = (device as any).location_label;
              const err      = device.last_sync_error ?? (device as any).last_status_message;
              return (
                <button key={device.id} onClick={() => setSelectedId(device.id)}
                  className={`w-full rounded-xl border p-3.5 text-left transition-all ${
                    isActive ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:bg-muted/30"
                  }`}>
                  <div className="flex items-center gap-2.5">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${online ? "bg-success animate-pulse" : "bg-muted-foreground/40"}`} />
                    <span className="font-semibold text-sm flex-1 truncate">{device.name}</span>
                    {online
                      ? <Wifi className="h-3.5 w-3.5 text-success shrink-0" />
                      : <WifiOff className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                    }
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                    {scope
                      ? <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${scopeColor(scope)}`}>
                          {scope.replace("_", " ")}
                        </span>
                      : <span className="text-[10px] text-amber-600 font-medium">⚠ Unassigned</span>
                    }
                    {lbl && <span className="text-[10px] text-muted-foreground">{lbl}</span>}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground/50 font-mono truncate">{device.device_uid}</div>
                  {err && (
                    <div className="mt-1.5 rounded bg-destructive/10 px-2 py-1 text-[10px] text-destructive leading-snug">{err}</div>
                  )}
                </button>
              );
            })}
          </div>

          {/* ═══ RIGHT: selected device panel ═══ */}
          {selected && (
            <div className="space-y-4">

              {/* Status / actions card */}
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                {/* Top bar */}
                <div className={`px-5 py-4 ${isOnline ? "bg-success/5 border-b border-success/20" : "bg-muted/20 border-b border-border"}`}>
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      {statusLoading
                        ? <span className="h-3.5 w-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        : <span className={`h-3.5 w-3.5 rounded-full ${isOnline ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
                      }
                      <div>
                        <h2 className="font-bold text-lg leading-tight">{selected.name}</h2>
                        <p className="text-xs text-muted-foreground">
                          {isOnline ? "Bridge online" : "Bridge offline"} ·{" "}
                          {fkStatus?.connected ? "FK623 connected" : "FK623 status unknown"} ·{" "}
                          {(selected as any).location_label ?? selected.location ?? "No location assigned"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => void loadStatus()} disabled={statusLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50">
                        <Activity className="h-3.5 w-3.5" /> Check Status
                      </button>
                      <button onClick={handleSyncTime} disabled={!isOnline}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50">
                        <Clock className="h-3.5 w-3.5" /> Sync Time
                      </button>
                      <button onClick={handlePullLogs} disabled={!isOnline}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50">
                        <Download className="h-3.5 w-3.5" /> Pull Logs
                      </button>
                      <button onClick={handleGetUsers} disabled={!isOnline}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50">
                        <Users className="h-3.5 w-3.5" /> Get Users
                      </button>
                    </div>
                  </div>
                </div>

                {/* FK623 metrics — grid of 6 tiles */}
                <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-border">
                  {[
                    { icon: Users,       label: "Users",        val: fkStatus?.users        ?? selected.device_users_count ?? 0 },
                    { icon: Fingerprint, label: "Fingerprints", val: fkStatus?.fingerprints ?? 0 },
                    { icon: Smile,       label: "Faces",        val: fkStatus?.faces        ?? 0 },
                    { icon: CreditCard,  label: "Cards",        val: fkStatus?.cards        ?? 0 },
                    { icon: HardDrive,   label: "Logs",         val: fkStatus?.logs         ?? selected.device_logs_count ?? 0 },
                    { icon: Shield,      label: "Serial",       val: fkStatus?.serialNumber ?? "—" },
                  ].map(({ icon: Icon, label, val }) => (
                    <div key={label} className="flex flex-col items-center gap-1 py-3 bg-card">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-base font-bold leading-none">{val}</span>
                      <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>

                {(selected.last_sync_at || selected.last_sync_error) && (
                  <div className="px-5 py-2 bg-muted/20 border-t border-border text-xs text-muted-foreground flex flex-wrap gap-x-4">
                    {selected.last_sync_at && (
                      <span>Last sync: <b className="text-foreground">{fmtFull(selected.last_sync_at)}</b> · {selected.last_sync_status ?? "—"}</span>
                    )}
                    {selected.last_sync_error && (
                      <span className="text-destructive">{selected.last_sync_error}</span>
                    )}
                  </div>
                )}
              </div>

              {/* ── Device Assignment ── */}
              <Section title="Device Assignment" icon={MapPin}
                badge={
                  (selected as any).location_scope
                    ? <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${scopeColor((selected as any).location_scope)}`}>
                        {((selected as any).location_scope ?? "").replace("_", " ")}
                      </span>
                    : <span className="ml-2 text-[10px] text-amber-600 font-medium">not assigned</span>
                }
                defaultOpen={!(selected as any).location_scope}
              >
                <p className="text-xs text-muted-foreground mb-3">
                  Assign this device to a physical location. Setting "Dormitory" automatically links biometric scans to boarding attendance.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold">Location Type</label>
                    <select value={aScope} onChange={e => setAScope(e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                      {SCOPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold">
                      Location Name
                      <span className="ml-1 font-normal text-muted-foreground">(e.g. "Main Gate", "Boys Hostel")</span>
                    </label>
                    <input value={aLabel} onChange={e => setALabel(e.target.value)}
                      placeholder={aScope === "gate" ? "Main Gate" : aScope === "dormitory" ? "Boys Hostel" : "Enter name"}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
                  </div>
                </div>
                {aScope === "dormitory" && (
                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-semibold">Link to Dormitory</label>
                    <select value={aDorm} onChange={e => setADorm(e.target.value)}
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
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {assigning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Save Location
                </button>
              </Section>

              {/* ── Attendance Sessions ── */}
              <Section title="Attendance Sessions" icon={Zap}
                badge={
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {sessions.length}
                  </span>
                }
              >
                <p className="text-xs text-muted-foreground mb-3">
                  Sessions define time windows. The system auto-activates the matching session when the current time falls within a window.
                </p>
                {sessLoad ? (
                  <div className="space-y-2 mb-4"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
                ) : sessions.length === 0 ? (
                  <p className="mb-4 text-xs text-muted-foreground italic">No sessions yet — create one below.</p>
                ) : (
                  <div className="mb-4 space-y-2">
                    {sessions.map(s => (
                      <div key={s.id} className={`flex items-center gap-3 rounded-lg border p-3 ${s.is_active ? "border-success bg-success/5" : "border-border"}`}>
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${s.is_active ? "bg-success animate-pulse" : "bg-muted-foreground/40"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{s.name}</span>
                            {s.is_active && (
                              <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success uppercase">Active</span>
                            )}
                          </div>
                          {s.windows.length > 0 && (
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {s.windows.map(w => `${w.label}: ${w.start_time}–${w.end_time}${w.grace_minutes ? ` (+${w.grace_minutes}m)` : ""}`).join(" · ")}
                            </div>
                          )}
                          {s.is_active && s.activated_at && (
                            <div className="text-[10px] text-success mt-0.5">Since {fmtFull(s.activated_at)}</div>
                          )}
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={() => handleToggleSession(s.id, s.is_active)}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold ${
                              s.is_active
                                ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                : "border-border hover:bg-muted"
                            }`}>
                            {s.is_active ? <ZapOff className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                            {s.is_active ? "Deactivate" : "Activate"}
                          </button>
                          <button onClick={() => handleDeleteSession(s.id)}
                            className="inline-flex items-center rounded-lg border border-border px-2 py-1.5 text-[10px] text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* New session form */}
                <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">New session</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">Name</label>
                      <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Morning"
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">Start time</label>
                      <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">End time</label>
                      <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm" />
                    </div>
                  </div>
                  <button onClick={handleCreateSession} disabled={saveSess || !newName.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50">
                    <Plus className="h-3.5 w-3.5" /> Add Session
                  </button>
                </div>
              </Section>

              {/* ── Push Students ── */}
              <Section title="Push Students to Device" icon={Upload}>
                <p className="text-xs text-muted-foreground mb-3">
                  Sends student records to the FK623 biometric device so students can scan in.
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
                  <button onClick={handlePushStudents} disabled={pushing || (pushMode === "section" && !pushSectionId)}
                    className="h-9 inline-flex items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    {pushing
                      ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Pushing…</>
                      : <><Upload className="h-3.5 w-3.5" /> Push Students</>
                    }
                  </button>
                </div>
                {!isOnline && (
                  <p className="mt-2 text-xs text-amber-600">
                    ⚠ Device appears offline. The system will retry automatically for up to 5 minutes.
                  </p>
                )}
              </Section>

              {/* ── Remove Students ── */}
              <Section title="Remove Students from Device" icon={X}>
                <p className="text-xs text-muted-foreground mb-3">
                  Removes student records and fingerprints from the FK623 device only. Does <b>not</b> delete them from the school system.
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
                  <button onClick={handleRemoveStudents} disabled={removing || (removeMode === "class" && !rmClassId)}
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
              >
                <div className="flex gap-2 mb-3 flex-wrap">
                  <button onClick={handleGetUsers} disabled={usersLoading || !isOnline}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50">
                    <RefreshCw className={`h-3.5 w-3.5 ${usersLoading ? "animate-spin" : ""}`} />
                    {usersLoading ? "Loading…" : "Fetch from device"}
                  </button>
                  {deviceUsers.length > 0 && (
                    <div className="relative flex-1 min-w-48">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
                        placeholder="Search by name or device user ID…"
                        className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs" />
                    </div>
                  )}
                </div>
                {usersLoading ? (
                  <div className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
                ) : deviceUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Click "Fetch from device" to load enrolled users.</p>
                ) : (
                  <>
                    {filteredUsers.length === 0 && userSearch && (
                      <p className="text-xs text-muted-foreground mb-2">No users match "{userSearch}"</p>
                    )}
                    <div className="max-h-72 overflow-y-auto divide-y divide-border rounded-lg border border-border">
                      {filteredUsers.map(u => {
                        const uid = u.userId ?? u.id ?? "?";
                        return (
                          <div key={uid} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20">
                            <Avatar name={u.name || uid} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{u.name || "—"}</div>
                              <div className="text-xs text-muted-foreground font-mono">Device ID: {uid}</div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {(u.biometricMethods ?? []).map((m: string) => (
                                <span key={m} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize">{m}</span>
                              ))}
                              <button onClick={() => handleDeleteUser(uid)}
                                className="rounded-lg border border-destructive/30 p-1.5 text-destructive hover:bg-destructive/10 transition-colors">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Showing {filteredUsers.length} of {deviceUsers.length} users
                    </p>
                  </>
                )}
              </Section>

              {/* ── Danger Zone ── */}
              <Section title="Danger Zone" icon={AlertTriangle} danger>
                <p className="text-xs text-muted-foreground mb-4">
                  These actions affect the physical FK623 device directly and <strong>cannot be undone</strong>.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                    <p className="text-xs font-semibold text-amber-800">Clear Device Logs</p>
                    <p className="text-[10px] text-amber-700">Deletes attendance log records stored on the FK623. Database records are kept.</p>
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
                    <p className="text-[10px] text-destructive/80">Sends a reboot command to the FK623. It will restart automatically.</p>
                    <button onClick={handleReboot} disabled={!isOnline}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50">
                      <RefreshCw className="h-3.5 w-3.5" /> Reboot Device
                    </button>
                  </div>
                </div>
              </Section>

              {/* ── Attendance Scans ── */}
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                {/* Header */}
                <div className="border-b border-border px-5 py-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <h3 className="font-semibold flex items-center gap-2 text-sm">
                      <Activity className="h-4 w-4 text-primary" />
                      Attendance Scans — {selected.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <input type="date" value={logsDate}
                        onChange={e => { setLogsDate(e.target.value); setLogsPage(1); }}
                        className="h-8 rounded-md border border-input bg-background px-2 text-sm" />
                      <button onClick={() => void loadLogs()} disabled={logsLoad}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50">
                        <RefreshCw className={`h-3.5 w-3.5 ${logsLoad ? "animate-spin" : ""}`} /> Reload
                      </button>
                    </div>
                  </div>

                  {/* Filter bar */}
                  <div className="mt-3 flex flex-wrap gap-2 items-end">
                    {/* Search: name / student ID / device user ID */}
                    <div className="relative flex-1 min-w-52">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search name · student ID · device user ID…"
                        className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs"
                      />
                    </div>
                    {/* Session */}
                    <select value={filterSession} onChange={e => { setFilterSession(e.target.value); setLogsPage(1); }}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                      <option value="">All Sessions</option>
                      {sessionNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    {/* Direction */}
                    <select value={filterDirection} onChange={e => { setFilterDirection(e.target.value); setLogsPage(1); }}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                      <option value="">All Directions</option>
                      <option value="In">Entry (In)</option>
                      <option value="Out">Exit (Out)</option>
                    </select>
                    {/* Method */}
                    <select value={filterMethod} onChange={e => { setFilterMethod(e.target.value); setLogsPage(1); }}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                      <option value="">All Methods</option>
                      <option value="fingerprint">Fingerprint</option>
                      <option value="face">Face</option>
                      <option value="nfc">NFC / RFID</option>
                      <option value="qr">QR Code</option>
                      <option value="manual">Manual</option>
                    </select>
                    {/* Status */}
                    <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setLogsPage(1); }}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                      <option value="">All Statuses</option>
                      <option value="present">Present</option>
                      <option value="late">Late</option>
                      <option value="absent">Absent</option>
                    </select>
                    {/* Clear filters */}
                    {(search || filterSession || filterDirection || filterMethod || filterStatus) && (
                      <button
                        onClick={() => { setSearch(""); setFilterSession(""); setFilterDirection(""); setFilterMethod(""); setFilterStatus(""); setLogsPage(1); }}
                        className="h-8 inline-flex items-center gap-1 rounded-md border border-border px-2.5 text-xs text-muted-foreground hover:bg-muted">
                        <X className="h-3 w-3" /> Clear
                      </button>
                    )}
                  </div>

                  {/* Stats row */}
                  {!logsLoad && logs.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{logsMeta.total} total scans</span>
                      <span className="text-success font-medium">{logs.filter(l => l.status?.toLowerCase() === "present").length} present</span>
                      <span className="text-amber-600 font-medium">{logs.filter(l => l.status?.toLowerCase() === "late").length} late</span>
                      <span className="text-destructive font-medium">{logs.filter(l => l.status?.toLowerCase() === "absent").length} absent</span>
                      <span>{logs.filter(l => l.direction === "In").length} entries · {logs.filter(l => l.direction === "Out").length} exits</span>
                    </div>
                  )}
                </div>

                {/* Table */}
                {logsLoad ? (
                  <div className="p-4 space-y-2">
                    {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : logs.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    No attendance scans found for this device on {logsDate}.
                    {(search || filterSession || filterDirection || filterMethod || filterStatus) && (
                      <p className="mt-1 text-xs">Try clearing the filters.</p>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                          <tr>
                            {["#","Student","Student ID","Class","Session","Time","Method","Direction","Status"].map(h => (
                              <th key={h} className="px-4 py-3 text-left whitespace-nowrap font-semibold">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {logs.map((log, i) => {
                            const l = log as any;
                            const sessionLabel = l.sessionName ?? l.attendance_period ?? null;
                            return (
                              <tr key={log.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                                <td className="px-4 py-2.5 text-muted-foreground text-xs w-10">
                                  {(logsPage - 1) * LOGS_PER_PAGE + i + 1}
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <Avatar name={log.studentName} size="sm" />
                                    <span className="font-medium text-sm whitespace-nowrap">{log.studentName}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">{log.studentId}</td>
                                <td className="px-4 py-2.5 text-xs">{l.className ?? l.class_name ?? "—"}</td>
                                <td className="px-4 py-2.5 text-xs">
                                  {sessionLabel
                                    ? <span className="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-[10px] font-semibold">{sessionLabel}</span>
                                    : <span className="text-muted-foreground">—</span>
                                  }
                                </td>
                                <td className="px-4 py-2.5 text-xs font-medium whitespace-nowrap">{fmtTime(log.timestamp)}</td>
                                <td className="px-4 py-2.5 text-xs capitalize text-muted-foreground">{log.method ?? "—"}</td>
                                <td className="px-4 py-2.5">
                                  {log.direction
                                    ? <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                        log.direction === "In" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                      }`}>
                                        {log.direction === "In" ? "Entry" : "Exit"}
                                      </span>
                                    : <span className="text-muted-foreground text-xs">—</span>
                                  }
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${statusBadge(log.status ?? "")}`}>
                                    {log.status ?? "—"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {logsMeta.totalPages > 1 && (
                      <div className="flex items-center justify-between px-5 py-3 border-t border-border text-sm">
                        <span className="text-xs text-muted-foreground">
                          {(logsPage - 1) * LOGS_PER_PAGE + 1}–{Math.min(logsPage * LOGS_PER_PAGE, logsMeta.total)} of {logsMeta.total}
                        </span>
                        <div className="flex gap-2 items-center">
                          <button onClick={() => setLogsPage(p => p - 1)} disabled={logsPage <= 1}
                            className="rounded-md border border-border px-3 py-1 text-xs disabled:opacity-50 hover:bg-muted">Previous</button>
                          <span className="text-xs text-muted-foreground px-1">{logsPage} / {logsMeta.totalPages}</span>
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
