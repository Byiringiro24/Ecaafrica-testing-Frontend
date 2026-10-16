/**
 * Device Management — School Admin
 *
 * Layout:
 *   Left sidebar: scrollable device list (any number of devices)
 *   Right panel: horizontal tab navigation
 *     Tab 1 — Overview:     Status, FK623 metrics, device assignment, attendance sessions
 *     Tab 2 — Push/Remove:  Push students (all/boarding/day/class/section) + remove students
 *     Tab 3 — Users:        Enrolled users on device — search, filter, delete individual
 *     Tab 4 — Scans:        Attendance logs — all filters (class/section/gender/type/dormitory/session/method/status/search)
 *     Tab 5 — Reports:      Summary stats + Excel export
 *
 * All dropdowns (classes, sections, dormitories, sessions) come from the school's
 * real data — nothing is hardcoded.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  RefreshCw, Wifi, WifiOff, Upload, Download, Clock, Users, Activity,
  Fingerprint, Smile, CreditCard, HardDrive, Trash2, Plus, MapPin,
  Zap, ZapOff, AlertTriangle, ChevronDown, ChevronUp, Check, X,
  Shield, Search, Key, RotateCcw, ChevronRight, Filter, FileSpreadsheet,
  BarChart3, Settings2,
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
import { AppLayout } from "@/components/layout/AppLayout";
import { exportToExcel } from "@/lib/exportExcel";

// ─── Types ───────────────────────────────────────────────────────────────────
type Tab          = "overview" | "push" | "users" | "scans" | "reports";
type ClassRecord  = { id: string; name: string };
type SectionRecord= { id: string; name: string; full_name: string; class_id: string };
type Dormitory    = { id: string; name: string; block_name?: string | null };
type DeviceUser   = { userId?: string; id?: string; name?: string; privilege?: number; enabled?: boolean; biometricMethods?: string[] };
type DeviceSession= { id: string; name: string; is_active: boolean; activated_at?: string | null; windows: { id?: string; label: string; start_time: string; end_time: string; grace_minutes?: number }[] };

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtTime = (ts?: string | null) => { if (!ts) return "—"; const d = new Date(ts); return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }); };
const fmtFull = (ts?: string | null) => { if (!ts) return "—"; const d = new Date(ts); return isNaN(d.getTime()) ? "—" : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); };
const isLiveOnline = (d?: Device | null) => { if (!d) return false; if (d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() < 90_000) return true; return Boolean(d.is_connected || d.is_online || d.status === "online"); };
const scopeColor  = (s?: string) => { if (s === "gate") return "bg-emerald-100 text-emerald-700"; if (s === "dormitory") return "bg-blue-100 text-blue-700"; if (s === "dining_hall") return "bg-amber-100 text-amber-700"; if (s === "classroom") return "bg-violet-100 text-violet-700"; return "bg-muted text-muted-foreground"; };
const statusPill  = (s: string) => { const l = (s ?? "").toLowerCase(); if (l === "present") return "bg-success/15 text-success"; if (l === "late") return "bg-amber-100 text-amber-700"; if (l === "absent") return "bg-destructive/15 text-destructive"; return "bg-muted text-muted-foreground"; };

const LOGS_PER_PAGE  = 25;
const STATUS_POLL_MS = 15_000;
const SCOPES = [
  { value: "gate",        label: "Gate (entry / exit)"  },
  { value: "dormitory",   label: "Dormitory / Hostel"   },
  { value: "dining_hall", label: "Dining Hall"           },
  { value: "classroom",   label: "Classroom"             },
  { value: "library",     label: "Library"               },
  { value: "other",       label: "Other"                 },
];

const TABS: { id: Tab; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Overview",        icon: Activity      },
  { id: "push",     label: "Push / Remove",   icon: Upload        },
  { id: "users",    label: "Enrolled Users",  icon: Users         },
  { id: "scans",    label: "Attendance Scans",icon: BarChart3     },
  { id: "reports",  label: "Reports & Export",icon: FileSpreadsheet},
];

// ─── Collapsible section ─────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = true, badge, danger = false }: {
  title: string; icon: typeof Upload; children: React.ReactNode;
  defaultOpen?: boolean; badge?: React.ReactNode; danger?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-xl border overflow-hidden ${danger ? "border-destructive/30" : "border-border"} bg-card`}>
      <button onClick={() => setOpen(o => !o)} className={`flex w-full items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors text-left ${danger ? "bg-destructive/5" : ""}`}>
        <span className="flex items-center gap-2 font-semibold text-sm">
          <Icon className={`h-4 w-4 shrink-0 ${danger ? "text-destructive" : "text-primary"}`} />
          {title}{badge}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {open && <div className="border-t border-border px-5 py-4">{children}</div>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DeviceManagement() {
  const [activeTab,  setActiveTab]  = useState<Tab>("overview");
  const [devices,    setDevices]    = useState<Device[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [devLoading, setDevLoading] = useState(true);
  const [status,        setStatus]        = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const statusFlight = useRef(false);

  // Reference data — school-specific, loaded from API
  const [classes,     setClasses]     = useState<ClassRecord[]>([]);
  const [sections,    setSections]    = useState<SectionRecord[]>([]);
  const [dormitories, setDormitories] = useState<Dormitory[]>([]);

  // Push
  const [pushMode,      setPushMode]      = useState<"all"|"class"|"section"|"boarding"|"day">("all");
  const [pushClassId,   setPushClassId]   = useState("");
  const [pushSectionId, setPushSectionId] = useState("");
  const [pushing,       setPushing]       = useState(false);

  // Remove
  const [removeMode, setRemoveMode] = useState<"all"|"class">("all");
  const [rmClassId,  setRmClassId]  = useState("");
  const [removing,   setRemoving]   = useState(false);

  // Device users
  const [deviceUsers,   setDeviceUsers]   = useState<DeviceUser[]>([]);
  const [usersLoading,  setUsersLoading]  = useState(false);
  const [userSearch,    setUserSearch]    = useState("");
  const [userMethodFil, setUserMethodFil] = useState("");

  // Sessions
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [sessLoad, setSessLoad] = useState(false);
  const [newName,  setNewName]  = useState("");
  const [newStart, setNewStart] = useState("07:00");
  const [newEnd,   setNewEnd]   = useState("08:30");
  const [saveSess, setSaveSess] = useState(false);

  // Assignment
  const [aScope,    setAScope]    = useState("gate");
  const [aLabel,    setALabel]    = useState("");
  const [aDorm,     setADorm]     = useState("");
  const [assigning, setAssigning] = useState(false);

  // Logs + filters
  const [logs,           setLogs]           = useState<DeviceLog[]>([]);
  const [logsLoad,       setLogsLoad]       = useState(false);
  const [logsDate,       setLogsDate]       = useState(localDateInputValue);
  const [logsPage,       setLogsPage]       = useState(1);
  const [logsMeta,       setLogsMeta]       = useState({ total: 0, totalPages: 1 });
  const [fSearch,        setFSearch]        = useState("");
  const [fStatus,        setFStatus]        = useState("");
  const [fMethod,        setFMethod]        = useState("");
  const [fClass,         setFClass]         = useState("");
  const [fSection,       setFSection]       = useState("");
  const [fDirection,     setFDirection]     = useState("");
  const [fSession,       setFSession]       = useState("");
  const [fGender,        setFGender]        = useState("");
  const [fStudentType,   setFStudentType]   = useState("");
  const [fDormitory,     setFDormitory]     = useState("");
  const [debouncedQ,     setDebouncedQ]     = useState("");
  const [clientStudentIds, setClientStudentIds] = useState<Set<string> | null>(null);
  const [clientFiltLoading, setClientFiltLoading] = useState(false);

  // Reports
  const [reportDate,    setReportDate]    = useState(localDateInputValue);
  const [exporting,     setExporting]     = useState(false);

  useEffect(() => { const t = setTimeout(() => { setDebouncedQ(fSearch); setLogsPage(1); }, 350); return () => clearTimeout(t); }, [fSearch]);

  // ── Loaders ──────────────────────────────────────────────────────────────
  const loadDevices = useCallback(async () => {
    setDevLoading(true);
    try {
      const res = await deviceApi.getAll({ limit: 200 });
      const list = res.data ?? [];
      setDevices(list);
      setSelectedId(cur => cur || list[0]?.id || "");
    } catch (e: any) { toast.error(e?.message ?? "Failed to load devices"); }
    finally { setDevLoading(false); }
  }, []);

  const loadStatus = useCallback(async (silent = false) => {
    if (!selectedId || statusFlight.current) return;
    statusFlight.current = true;
    if (!silent) setStatusLoading(true);
    try {
      const res = await deviceApi.getStatus(selectedId);
      setStatus(res);
      setDevices(p => p.map(d => d.id === selectedId ? { ...d, is_online: res?.is_online ?? false, is_connected: res?.is_connected ?? false } : d));
    } catch { setStatus({ is_online: false, is_connected: false }); }
    finally { statusFlight.current = false; if (!silent) setStatusLoading(false); }
  }, [selectedId]);

  const loadSessions = useCallback(async () => {
    if (!selectedId) return;
    setSessLoad(true);
    try {
      const res = await apiRequest<any>(`/devices/${selectedId}/sessions`, { auth: "school" });
      const raw = Array.isArray(res?.sessions) ? res.sessions : Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setSessions(raw.map((s: any) => ({ id: String(s.id), name: s.name, is_active: Boolean(s.is_active), activated_at: s.activated_at ?? null, windows: Array.isArray(s.windows) ? s.windows : [] })));
    } catch { setSessions([]); }
    finally { setSessLoad(false); }
  }, [selectedId]);

  const resolveClientStudentIds = useCallback(async (): Promise<Set<string> | null> => {
    if (!fGender && !fStudentType && !fDormitory) return null;
    setClientFiltLoading(true);
    try {
      const params = new URLSearchParams({ limit: "5000", status: "active" });
      if (fGender)      params.set("gender", fGender);
      if (fStudentType) params.set("student_type", fStudentType);
      const res = await apiRequest<any>(`/students?${params}`, { auth: "school" });
      let list: any[] = Array.isArray(res) ? res : res?.data ?? [];
      if (fDormitory) list = list.filter((s: any) => {
        const dorms: any[] = s.student_dorm_assignments ?? [];
        return dorms.some((d: any) => String(d.dormitory_id ?? d.id) === fDormitory);
      });
      return new Set(list.map((s: any) => String(s.student_id_number ?? s.id)));
    } catch { return null; }
    finally { setClientFiltLoading(false); }
  }, [fGender, fStudentType, fDormitory]);

  const loadLogs = useCallback(async () => {
    if (!selectedId) return;
    setLogsLoad(true);
    try {
      const studentIdSet = await resolveClientStudentIds();
      setClientStudentIds(studentIdSet);
      const res = await fetchDeviceLogs({
        deviceId: selectedId, startDate: logsDate, endDate: logsDate,
        page: logsPage, limit: LOGS_PER_PAGE,
        search: debouncedQ || undefined,
        status: fStatus    || undefined,
        method: fMethod    || undefined,
        className: fClass  || undefined,
        section: fSection  || undefined,
        direction: fDirection || undefined,
      });
      let data = res.data as any[];
      if (fSession) data = data.filter(l => (l.sessionName ?? (l as any).attendance_period ?? "").toLowerCase().includes(fSession.toLowerCase()));
      if (studentIdSet) data = data.filter(l => studentIdSet.has(String(l.studentId)));
      setLogs(data);
      setLogsMeta({ total: studentIdSet ? data.length : res.meta.total, totalPages: studentIdSet ? Math.max(1, Math.ceil(data.length / LOGS_PER_PAGE)) : res.meta.totalPages });
    } catch (e: any) { toast.error(e?.message ?? "Failed to load logs"); }
    finally { setLogsLoad(false); }
  }, [selectedId, logsDate, logsPage, debouncedQ, fStatus, fMethod, fClass, fSection, fDirection, fSession, resolveClientStudentIds]);

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => { void loadDevices(); }, []);
  useEffect(() => {
    Promise.all([
      apiRequest<any>("/classes?limit=200",              { auth: "school" }),
      apiRequest<any>("/sections?limit=500",             { auth: "school" }),
      apiRequest<any>("/boarding/dormitories?limit=200", { auth: "school" }),
    ]).then(([cl, se, do_]) => {
      setClasses(Array.isArray(cl) ? cl : cl?.data ?? []);
      setSections(Array.isArray(se) ? se : se?.data ?? []);
      setDormitories(Array.isArray(do_) ? do_ : do_?.data ?? []);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!selectedId) return;
    void loadStatus();
    void loadSessions();
    setDeviceUsers([]); setLogs([]);
    const iv = setInterval(() => void loadStatus(true), STATUS_POLL_MS);
    return () => clearInterval(iv);
  }, [selectedId]);
  useEffect(() => { if (activeTab === "scans") void loadLogs(); }, [loadLogs, activeTab]);
  useEffect(() => {
    const d = devices.find(x => x.id === selectedId);
    if (!d) return;
    setAScope((d as any).location_scope ?? "gate");
    setALabel((d as any).location_label ?? "");
    setADorm((d as any).dormitory_id ?? "");
  }, [selectedId, devices]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const selected  = devices.find(d => d.id === selectedId);
  const isOnline  = isLiveOnline(selected);
  const tabletId  = selected?.tablet_id ?? null;
  const fkStatus  = status?.device_status ?? status?.data ?? null;

  const filteredSections = useMemo(() => sections.filter(s => !pushClassId || s.class_id === pushClassId), [sections, pushClassId]);
  const sessionNames     = useMemo(() => [...new Set([...sessions.map(s => s.name), ...logs.map(l => (l as any).sessionName).filter(Boolean)])].sort(), [sessions, logs]);
  const logClassNames    = useMemo(() => [...new Set(logs.map(l => (l as any).className ?? "").filter(Boolean))].sort(), [logs]);
  const logSectionNames  = useMemo(() => [...new Set(logs.map(l => (l as any).section ?? "").filter(Boolean))].sort(), [logs]);
  const filteredUsers    = useMemo(() => {
    let list = deviceUsers;
    const q = userSearch.trim().toLowerCase();
    if (q) list = list.filter(u => (u.name ?? "").toLowerCase().includes(q) || (u.userId ?? u.id ?? "").toLowerCase().includes(q));
    if (userMethodFil) list = list.filter(u => (u.biometricMethods ?? []).some(m => m.toLowerCase().includes(userMethodFil.toLowerCase())));
    return list;
  }, [deviceUsers, userSearch, userMethodFil]);
  const userMethods = useMemo(() => [...new Set(deviceUsers.flatMap(u => u.biometricMethods ?? []))].sort(), [deviceUsers]);
  const anyFilter   = Boolean(fSearch || fStatus || fMethod || fClass || fSection || fDirection || fSession || fGender || fStudentType || fDormitory);
  const anyClientFilter = Boolean(fGender || fStudentType || fDormitory);

  // Stats for reports tab
  const logsStats = useMemo(() => ({
    total:   logs.length,
    present: logs.filter(l => l.status?.toLowerCase() === "present").length,
    late:    logs.filter(l => l.status?.toLowerCase() === "late").length,
    absent:  logs.filter(l => l.status?.toLowerCase() === "absent").length,
    entries: logs.filter(l => l.direction === "In").length,
    exits:   logs.filter(l => l.direction === "Out").length,
    unique:  new Set(logs.map(l => l.studentId)).size,
    methods: logs.reduce((acc, l) => { const m = l.method ?? "unknown"; acc[m] = (acc[m] ?? 0) + 1; return acc; }, {} as Record<string, number>),
  }), [logs]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const handlePullLogs   = async () => { if (!tabletId) { toast.error("Device not linked to tablet"); return; } try { const r = await tabletApi.pullLogs({ tabletId, readMark: 0 }); toast.success(`Pulled ${r.data?.savedCount ?? 0} log(s) — ${r.data?.duplicateCount ?? 0} duplicates`); void loadLogs(); } catch (e: any) { toast.error(e?.message ?? "Failed"); } };
  const handleSyncTime   = async () => { if (!tabletId) { toast.error("Device not linked to tablet"); return; } try { await tabletApi.syncTime(tabletId); toast.success("Device time synced"); } catch (e: any) { toast.error(e?.message ?? "Failed"); } };
  const handleGetUsers   = async () => { if (!tabletId) { toast.error("Device not linked to tablet"); return; } setUsersLoading(true); try { const r = await tabletApi.getUsers(tabletId); setDeviceUsers(r.data?.users ?? []); toast.success(`${r.data?.count ?? 0} enrolled user(s) on device`); } catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setUsersLoading(false); } };
  const handleDeleteUser = async (uid: string) => { if (!tabletId) return; if (!window.confirm(`Remove user ${uid} from device?`)) return; try { await tabletApi.removeUser(tabletId, uid); toast.success("User removed"); setDeviceUsers(p => p.filter(u => (u.userId ?? u.id) !== uid)); } catch (e: any) { toast.error(e?.message ?? "Failed"); } };
  const handleClearLogs  = async () => { if (!tabletId) { toast.error("Device not linked to tablet"); return; } if (!window.confirm(`Delete ALL attendance logs from "${selected?.name}"?\n\n⚠ Logs already pulled to the server are NOT affected.\n\nThis cannot be undone.`)) return; try { await tabletApi.clearLogs(tabletId); toast.success("All logs cleared from device memory"); void loadStatus(); } catch (e: any) { toast.error(e?.message ?? "Failed"); } };
  const handleClearUsers = async () => { if (!tabletId) { toast.error("Device not linked to tablet"); return; } if (!window.confirm(`Delete ALL enrolled users from "${selected?.name}"?\n\n⚠ All fingerprints and face templates will be deleted.\nYou must re-push students to restore them.\n\nThis cannot be undone.`)) return; if (!window.confirm("Confirm — permanently delete all biometric data from device?")) return; try { await tabletApi.clearUsers(tabletId); toast.success("All users cleared. Re-push students to re-enroll."); setDeviceUsers([]); void loadStatus(); } catch (e: any) { toast.error(e?.message ?? "Failed"); } };
  const handleReboot     = async () => { if (!tabletId) { toast.error("Device not linked to tablet"); return; } if (!window.confirm(`Reboot "${selected?.name}"?\n\nThe FK623 will restart and reconnect automatically within 30–60 seconds.`)) return; try { await tabletApi.resetDevice(tabletId); toast.success("Reset command sent — device will reboot automatically"); setTimeout(() => void loadStatus(true), 35_000); } catch (e: any) { toast.error(e?.message ?? "Failed"); } };

  const handlePushStudents = async () => {
    if (!selectedId) return;
    setPushing(true);
    try {
      const payload: any = {};
      if      (pushMode === "class"   && pushClassId)   { payload.mode = "class";   payload.class_id   = pushClassId; }
      else if (pushMode === "section" && pushSectionId) { payload.mode = "section"; payload.section_id = pushSectionId; }
      else if (pushMode === "boarding") { payload.mode = "all"; payload.student_type = "boarding"; }
      else if (pushMode === "day")      { payload.mode = "all"; payload.student_type = "day"; }
      else payload.mode = "all";
      const r = await deviceApi.pushStudents(selectedId, payload);
      const failed = (r as any).failed_count ?? 0;
      failed > 0 ? toast.warning(`Pushed ${r.pushed_count} — ${failed} failed`) : toast.success(`Pushed ${r.pushed_count} student(s) to device`);
      void loadStatus();
    } catch (e: any) { toast.error(e?.message ?? "Failed to push"); }
    finally { setPushing(false); }
  };

  const handleRemoveStudents = async () => {
    if (!selectedId) return;
    if (!window.confirm(`Remove ${removeMode === "all" ? "ALL students" : "students in selected class"} from the FK623 device?`)) return;
    setRemoving(true);
    try {
      const payload: any = { mode: removeMode };
      if (removeMode === "class" && rmClassId) payload.class_id = rmClassId;
      const r = await apiRequest<any>(`/devices/${selectedId}/remove-students`, { method: "POST", auth: "school", body: JSON.stringify(payload) });
      toast.success(`Removed ${(r as any).removed_count ?? 0} student(s) from device`);
      void loadStatus();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setRemoving(false); }
  };

  const handleAssignLocation = async () => {
    if (!selectedId) return;
    setAssigning(true);
    try {
      await apiRequest(`/devices/${selectedId}/assign-location`, { method: "PATCH", auth: "school", body: JSON.stringify({ location_scope: aScope, location_label: aLabel || null, dormitory_id: aDorm || null, auto_push: false }) });
      toast.success("Location saved"); void loadDevices();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setAssigning(false); }
  };

  const handleCreateSession = async () => {
    if (!selectedId || !newName.trim()) { toast.error("Enter a session name"); return; }
    setSaveSess(true);
    try {
      await apiRequest(`/devices/${selectedId}/sessions`, { method: "POST", auth: "school", body: JSON.stringify({ name: newName.trim(), windows: [{ label: "Present", start_time: newStart, end_time: newEnd }] }) });
      toast.success("Session created"); setNewName(""); void loadSessions();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setSaveSess(false); }
  };
  const handleDeleteSession = async (sid: string) => { if (!window.confirm("Delete this attendance session?")) return; try { await apiRequest(`/devices/${selectedId}/sessions/${sid}`, { method: "DELETE", auth: "school" }); toast.success("Session deleted"); void loadSessions(); } catch (e: any) { toast.error(e?.message ?? "Failed"); } };
  const handleToggleSession = async (sid: string, active: boolean) => { try { await apiRequest(`/devices/${selectedId}/sessions/${sid}/${active ? "deactivate" : "activate"}`, { method: "PATCH", auth: "school" }); toast.success(active ? "Deactivated" : "Activated"); void loadSessions(); } catch (e: any) { toast.error(e?.message ?? "Failed"); } };

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExportScans = async () => {
    if (logs.length === 0) { toast.info("No scans to export — adjust filters first"); return; }
    setExporting(true);
    try {
      const devName = selected?.name ?? "device";
      await exportToExcel(
        `attendance-scans-${devName}-${logsDate}.xlsx`,
        "Attendance Scans",
        [
          { header: "#",         key: "no",       width: 5  },
          { header: "Student",   key: "name",     width: 26 },
          { header: "Student ID",key: "sid",      width: 16 },
          { header: "Class",     key: "cls",      width: 14 },
          { header: "Section",   key: "section",  width: 14 },
          { header: "Session",   key: "session",  width: 20 },
          { header: "Time",      key: "time",     width: 10 },
          { header: "Method",    key: "method",   width: 14 },
          { header: "Direction", key: "direction",width: 10 },
          { header: "Status",    key: "status",   width: 12 },
          { header: "Device",    key: "device",   width: 18 },
        ],
        logs.map((l, i) => ({
          no:        i + 1,
          name:      l.studentName ?? "—",
          sid:       l.studentId   ?? "—",
          cls:       (l as any).className  ?? "—",
          section:   (l as any).section    ?? "—",
          session:   (l as any).sessionName ?? (l as any).attendance_period ?? "—",
          time:      fmtTime(l.timestamp),
          method:    l.method      ?? "—",
          direction: l.direction   ?? "—",
          status:    l.status      ?? "—",
          device:    l.deviceId    ?? devName,
        })),
        `Attendance Scans — ${devName} — ${logsDate}`
      );
      toast.success("Export complete");
    } catch (e: any) { toast.error(e?.message ?? "Export failed"); }
    finally { setExporting(false); }
  };

  const handleExportDeviceSummary = async () => {
    setExporting(true);
    try {
      // Fetch all logs for the report date across ALL devices
      const allLogs: any[] = [];
      for (const dev of devices) {
        try {
          const res = await fetchDeviceLogs({ deviceId: dev.id, startDate: reportDate, endDate: reportDate, limit: 1000 });
          allLogs.push(...res.data.map(l => ({ ...l, deviceName: dev.name, deviceScope: (dev as any).location_scope ?? "—" })));
        } catch { /* skip failed device */ }
      }
      if (allLogs.length === 0) { toast.info("No attendance data for this date"); setExporting(false); return; }

      await exportToExcel(
        `device-summary-${reportDate}.xlsx`,
        "Device Summary",
        [
          { header: "#",          key: "no",      width: 5  },
          { header: "Device",     key: "device",  width: 20 },
          { header: "Location",   key: "scope",   width: 14 },
          { header: "Student",    key: "name",    width: 26 },
          { header: "Student ID", key: "sid",     width: 16 },
          { header: "Class",      key: "cls",     width: 14 },
          { header: "Session",    key: "session", width: 20 },
          { header: "Time",       key: "time",    width: 10 },
          { header: "Method",     key: "method",  width: 14 },
          { header: "Direction",  key: "dir",     width: 10 },
          { header: "Status",     key: "status",  width: 12 },
        ],
        allLogs.map((l, i) => ({
          no:      i + 1,
          device:  l.deviceName,
          scope:   l.deviceScope,
          name:    l.studentName ?? "—",
          sid:     l.studentId   ?? "—",
          cls:     l.className   ?? "—",
          session: l.sessionName ?? l.attendance_period ?? "—",
          time:    fmtTime(l.timestamp),
          method:  l.method      ?? "—",
          dir:     l.direction   ?? "—",
          status:  l.status      ?? "—",
        })),
        `All Devices Attendance — ${reportDate}`
      );
      toast.success("Device summary exported");
    } catch (e: any) { toast.error(e?.message ?? "Export failed"); }
    finally { setExporting(false); }
  };

  const clearAllFilters = () => {
    setFSearch(""); setFStatus(""); setFMethod(""); setFClass("");
    setFSection(""); setFDirection(""); setFSession("");
    setFGender(""); setFStudentType(""); setFDormitory("");
    setLogsPage(1);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppLayout title="Device Management" subtitle="Manage biometric devices, push students, pull logs and view attendance">

      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
        Tablets and biometric devices are registered and assigned by the platform administrator. Contact your platform admin to add or change devices.
      </div>

      {devLoading ? (
        <div className="flex gap-5"><Skeleton className="h-96 w-56 shrink-0" /><Skeleton className="flex-1 h-96" /></div>
      ) : devices.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-16 text-center">
          <Shield className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
          <p className="font-semibold text-lg">No devices registered</p>
          <p className="mt-1 text-sm text-muted-foreground">Contact the platform administrator.</p>
        </div>
      ) : (
        <div className="flex gap-5 min-h-0">

          {/* ── LEFT: device selector ── */}
          <div className="w-52 shrink-0 flex flex-col gap-1">
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Devices ({devices.length})</span>
              <button onClick={() => void loadDevices()} disabled={devLoading} title="Refresh" className="rounded p-1 hover:bg-muted disabled:opacity-50">
                <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${devLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
            <div className="flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-200px)]">
              {devices.map(device => {
                const online   = isLiveOnline(device);
                const isActive = device.id === selectedId;
                const scope    = (device as any).location_scope as string | undefined;
                const lbl      = (device as any).location_label as string | undefined;
                return (
                  <button key={device.id} onClick={() => { setSelectedId(device.id); setActiveTab("overview"); }}
                    className={`w-full rounded-xl border text-left transition-all ${isActive ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20" : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"}`}>
                    <div className="px-3.5 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${online ? "bg-green-500 animate-pulse" : "bg-muted-foreground/30"}`} />
                        <span className={`font-semibold text-sm truncate flex-1 ${isActive ? "text-primary" : ""}`}>{device.name}</span>
                        {isActive && <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {scope ? <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${scopeColor(scope)}`}>{scope.replace("_"," ")}</span>
                               : <span className="text-[10px] text-amber-600 font-medium">⚠ Unassigned</span>}
                      </div>
                      {lbl && <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{lbl}</p>}
                      <p className={`mt-1 text-[10px] font-medium ${online ? "text-green-600" : "text-muted-foreground/60"}`}>{online ? "● Online" : "○ Offline"}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── RIGHT: tabs + content ── */}
          <div className="flex-1 min-w-0 flex flex-col gap-0 overflow-y-auto max-h-[calc(100vh-160px)]">
            {!selected ? (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground">
                ← Select a device from the list
              </div>
            ) : (
              <>
                {/* ── Status bar (always visible above tabs) ── */}
                <div className={`rounded-xl border overflow-hidden mb-4 ${isOnline ? "border-green-200" : "border-border"}`}>
                  <div className={`px-5 py-3 ${isOnline ? "bg-green-50" : "bg-muted/20"}`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        {statusLoading ? <span className="h-3.5 w-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" /> : <span className={`h-3.5 w-3.5 rounded-full shrink-0 ${isOnline ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40"}`} />}
                        <div className="min-w-0">
                          <h2 className="font-bold leading-tight truncate">{selected.name}</h2>
                          <p className="text-xs text-muted-foreground">{isOnline ? "Bridge online" : "Bridge offline"} · {fkStatus?.connected ? "FK623 connected" : "FK623 not detected"} · {(selected as any).location_label ?? selected.location ?? "No location"}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        <button onClick={() => void loadStatus()} disabled={statusLoading} className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"><Activity className="h-3.5 w-3.5" /> Check Status</button>
                        <button onClick={handleSyncTime} disabled={!isOnline} className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"><Clock className="h-3.5 w-3.5" /> Sync Time</button>
                        <button onClick={handleGetUsers} disabled={!isOnline} className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"><Users className="h-3.5 w-3.5" /> Get Users</button>
                        <button onClick={handlePullLogs} disabled={!isOnline} className="inline-flex items-center gap-1 rounded-lg bg-primary text-primary-foreground px-2.5 py-1.5 text-xs font-semibold hover:bg-primary/90 disabled:opacity-50"><Download className="h-3.5 w-3.5" /> Pull Logs</button>
                        <div className="hidden sm:block h-4 w-px bg-border self-center mx-0.5" />
                        <button onClick={handleReboot} disabled={!isOnline} className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 px-2.5 py-1.5 text-xs font-semibold hover:bg-amber-100 disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
                        <button onClick={handleClearLogs} disabled={!isOnline} className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive px-2.5 py-1.5 text-xs font-semibold hover:bg-destructive/10 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Clear Logs</button>
                        <button onClick={handleClearUsers} disabled={!isOnline} className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive px-2.5 py-1.5 text-xs font-semibold hover:bg-destructive/10 disabled:opacity-50"><Users className="h-3.5 w-3.5" /> Clear Users</button>
                      </div>
                    </div>
                  </div>
                  {/* FK623 metrics tiles */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-border bg-card">
                    {[
                      { icon: Users,       label: "Users",        val: fkStatus?.users        ?? selected.device_users_count ?? 0 },
                      { icon: Fingerprint, label: "Fingerprints", val: fkStatus?.fingerprints ?? 0 },
                      { icon: Smile,       label: "Faces",        val: fkStatus?.faces        ?? 0 },
                      { icon: CreditCard,  label: "Cards",        val: fkStatus?.cards        ?? 0 },
                      { icon: HardDrive,   label: "Logs",         val: fkStatus?.logs         ?? selected.device_logs_count ?? 0 },
                      { icon: Key,         label: "Serial",       val: fkStatus?.serialNumber ?? "—" },
                    ].map(({ icon: Icon, label, val }) => (
                      <div key={label} className="flex flex-col items-center gap-1 py-3">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-base font-bold leading-none">{val}</span>
                        <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Horizontal tab bar ── */}
                <div className="flex gap-0 border-b border-border mb-4 overflow-x-auto">
                  {TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                        activeTab === tab.id
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                      }`}>
                      <tab.icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* ── Tab content ── */}
                <div className="space-y-4 pb-8">

                  {/* ════ OVERVIEW tab ════ */}
                  {activeTab === "overview" && (
                    <>
                      <Section title="Device Assignment" icon={MapPin}
                        badge={(selected as any).location_scope
                          ? <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${scopeColor((selected as any).location_scope)}`}>{((selected as any).location_scope as string).replace("_"," ")}</span>
                          : <span className="ml-2 text-[10px] text-amber-600 font-medium">not assigned</span>
                        }
                        defaultOpen={!(selected as any).location_scope}
                      >
                        <p className="text-xs text-muted-foreground mb-3">Assign to a physical location. "Dormitory" automatically links scans to boarding attendance.</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-semibold">Location Type</label>
                            <select value={aScope} onChange={e => setAScope(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                              {SCOPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold">Location Name <span className="font-normal text-muted-foreground">(e.g. "Main Gate", "Boys Hostel")</span></label>
                            <input value={aLabel} onChange={e => setALabel(e.target.value)} placeholder={aScope === "gate" ? "Main Gate" : aScope === "dormitory" ? "Boys Hostel" : "Enter name"} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
                          </div>
                        </div>
                        {aScope === "dormitory" && (
                          <div className="mt-3">
                            <label className="mb-1 block text-xs font-semibold">Link to Dormitory</label>
                            <select value={aDorm} onChange={e => setADorm(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                              <option value="">— select dormitory —</option>
                              {dormitories.map(d => <option key={d.id} value={d.id}>{d.name}{d.block_name ? ` (${d.block_name})` : ""}</option>)}
                            </select>
                            {dormitories.length === 0 && <p className="mt-1 text-xs text-amber-600">No dormitories found. Create them in Boarding → Dormitories first.</p>}
                          </div>
                        )}
                        <button onClick={handleAssignLocation} disabled={assigning} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                          {assigning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save Location
                        </button>
                      </Section>

                      <Section title="Attendance Sessions" icon={Zap}
                        badge={<span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{sessions.length}</span>}
                      >
                        <p className="text-xs text-muted-foreground mb-3">Sessions define time windows. The system auto-activates the matching session at the configured time.</p>
                        {sessLoad ? <div className="space-y-2 mb-3"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
                        : sessions.length === 0 ? <p className="mb-3 text-xs text-muted-foreground italic">No sessions yet — create one below.</p>
                        : (
                          <div className="mb-4 space-y-2">
                            {sessions.map(s => (
                              <div key={s.id} className={`flex items-center gap-3 rounded-lg border p-3 ${s.is_active ? "border-green-200 bg-green-50/50" : "border-border"}`}>
                                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${s.is_active ? "bg-green-500 animate-pulse" : "bg-muted-foreground/30"}`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-sm">{s.name}</span>
                                    {s.is_active && <span className="rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-[10px] font-bold uppercase">Active</span>}
                                  </div>
                                  {s.windows.length > 0 && <p className="mt-0.5 text-xs text-muted-foreground">{s.windows.map(w => `${w.label}: ${w.start_time}–${w.end_time}${w.grace_minutes ? ` (+${w.grace_minutes}m)` : ""}`).join(" · ")}</p>}
                                  {s.is_active && s.activated_at && <p className="text-[10px] text-green-600 mt-0.5">Since {fmtFull(s.activated_at)}</p>}
                                </div>
                                <div className="flex gap-1.5 shrink-0">
                                  <button onClick={() => handleToggleSession(s.id, s.is_active)} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold ${s.is_active ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-border hover:bg-muted"}`}>
                                    {s.is_active ? <ZapOff className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                                    {s.is_active ? "Deactivate" : "Activate"}
                                  </button>
                                  <button onClick={() => handleDeleteSession(s.id)} className="inline-flex items-center rounded-lg border border-border px-2 py-1.5 text-[10px] text-destructive hover:bg-destructive/10">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">New Session</p>
                          <div className="grid gap-2 sm:grid-cols-3">
                            <div><label className="mb-1 block text-[10px] font-semibold text-muted-foreground">Name</label><input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Morning" className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm" /></div>
                            <div><label className="mb-1 block text-[10px] font-semibold text-muted-foreground">Start</label><input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm" /></div>
                            <div><label className="mb-1 block text-[10px] font-semibold text-muted-foreground">End</label><input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm" /></div>
                          </div>
                          <button onClick={handleCreateSession} disabled={saveSess || !newName.trim()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50">
                            <Plus className="h-3.5 w-3.5" /> Add Session
                          </button>
                        </div>
                      </Section>

                      {/* Danger Zone */}
                      <Section title="Danger Zone" icon={AlertTriangle} danger defaultOpen={false}>
                        <p className="text-xs text-muted-foreground mb-4">These actions affect the physical FK623 device directly and <strong>cannot be undone</strong>.</p>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                            <p className="text-xs font-semibold text-amber-800">Reset / Reboot Device</p>
                            <p className="text-[10px] text-amber-700">Reboots the FK623. It reconnects automatically within 30–60 seconds.</p>
                            <button onClick={handleReboot} disabled={!isOnline} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-200 disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
                          </div>
                          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                            <p className="text-xs font-semibold text-destructive">Clear Device Logs</p>
                            <p className="text-[10px] text-destructive/80">Deletes all logs stored on the FK623. Server records are kept.</p>
                            <button onClick={handleClearLogs} disabled={!isOnline} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50"><HardDrive className="h-3.5 w-3.5" /> Clear Logs</button>
                          </div>
                          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                            <p className="text-xs font-semibold text-destructive">Delete All Users</p>
                            <p className="text-[10px] text-destructive/80">Removes every enrolled user and their biometric data from the FK623.</p>
                            <button onClick={handleClearUsers} disabled={!isOnline} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50"><Users className="h-3.5 w-3.5" /> Delete All Users</button>
                          </div>
                        </div>
                      </Section>
                    </>
                  )}

                  {/* ════ PUSH / REMOVE tab ════ */}
                  {activeTab === "push" && (
                    <>
                      <Section title="Push Students to Device" icon={Upload}>
                        <p className="text-xs text-muted-foreground mb-3">Sends student records to the FK623 biometric device. Uses your school's real class and section data.</p>
                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Push</label>
                            <select value={pushMode} onChange={e => { setPushMode(e.target.value as any); setPushClassId(""); setPushSectionId(""); }} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                              <option value="all">All active students</option>
                              <option value="boarding">Boarding students only</option>
                              <option value="day">Day students only</option>
                              <option value="class">By class</option>
                              <option value="section">By section</option>
                            </select>
                          </div>
                          {(pushMode === "class" || pushMode === "section") && (
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Class</label>
                              <select value={pushClassId} onChange={e => { setPushClassId(e.target.value); setPushSectionId(""); }} className="h-9 min-w-36 rounded-md border border-input bg-background px-3 text-sm">
                                <option value="">All classes</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </div>
                          )}
                          {pushMode === "section" && (
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Section</label>
                              <select value={pushSectionId} onChange={e => setPushSectionId(e.target.value)} className="h-9 min-w-40 rounded-md border border-input bg-background px-3 text-sm">
                                <option value="">Select section</option>
                                {filteredSections.map(s => <option key={s.id} value={s.id}>{s.full_name || s.name}</option>)}
                              </select>
                            </div>
                          )}
                          <button onClick={handlePushStudents} disabled={pushing || (pushMode === "section" && !pushSectionId)}
                            className="h-9 inline-flex items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                            {pushing ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Pushing…</> : <><Upload className="h-3.5 w-3.5" /> Push Students</>}
                          </button>
                        </div>
                        {!isOnline && <p className="mt-2 text-xs text-amber-600">⚠ Device appears offline. The system will retry automatically for up to 5 minutes.</p>}
                      </Section>

                      <Section title="Remove Students from Device" icon={X}>
                        <p className="text-xs text-muted-foreground mb-3">Removes student records and fingerprints from the FK623 device only. Does <b>not</b> delete them from the school system.</p>
                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Remove</label>
                            <select value={removeMode} onChange={e => { setRemoveMode(e.target.value as any); setRmClassId(""); }} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                              <option value="all">All students</option>
                              <option value="class">By class</option>
                            </select>
                          </div>
                          {removeMode === "class" && (
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Class</label>
                              <select value={rmClassId} onChange={e => setRmClassId(e.target.value)} className="h-9 min-w-36 rounded-md border border-input bg-background px-3 text-sm">
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
                    </>
                  )}

                  {/* ════ ENROLLED USERS tab ════ */}
                  {activeTab === "users" && (
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                      <div className="px-5 py-4 border-b border-border">
                        <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                          <Users className="h-4 w-4 text-primary" /> Enrolled Users on Device
                        </h3>
                        <div className="flex gap-2 flex-wrap items-end">
                          <button onClick={handleGetUsers} disabled={usersLoading || !isOnline}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50">
                            <RefreshCw className={`h-3.5 w-3.5 ${usersLoading ? "animate-spin" : ""}`} />
                            {usersLoading ? "Loading…" : "Fetch from device"}
                          </button>
                          {deviceUsers.length > 0 && (
                            <>
                              <div className="relative flex-1 min-w-44">
                                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search name or device user ID…" className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs" />
                              </div>
                              {userMethods.length > 0 && (
                                <select value={userMethodFil} onChange={e => setUserMethodFil(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                                  <option value="">All Biometric Methods</option>
                                  {userMethods.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      {usersLoading ? <div className="p-4 space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
                      : deviceUsers.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted-foreground italic">Click "Fetch from device" to load enrolled users.</p>
                      : (
                        <>
                          {filteredUsers.length === 0 && (userSearch || userMethodFil) && <p className="px-5 py-3 text-xs text-muted-foreground">No users match the current filters.</p>}
                          <div className="divide-y divide-border">
                            {filteredUsers.map(u => {
                              const uid = u.userId ?? u.id ?? "?";
                              return (
                                <div key={uid} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                                  <Avatar name={u.name || uid} size="sm" />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm truncate">{u.name || "—"}</div>
                                    <div className="text-xs text-muted-foreground font-mono">Device ID: {uid}</div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {(u.biometricMethods ?? []).map((m: string) => <span key={m} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize">{m}</span>)}
                                    <button onClick={() => handleDeleteUser(uid)} className="rounded-lg border border-destructive/30 p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="px-5 py-2 border-t border-border text-xs text-muted-foreground">
                            Showing {filteredUsers.length} of {deviceUsers.length} enrolled users
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* ════ ATTENDANCE SCANS tab ════ */}
                  {activeTab === "scans" && (
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                      <div className="border-b border-border px-5 py-4">
                        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                          <h3 className="font-semibold text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Attendance Scans — {selected.name}</h3>
                          <div className="flex items-center gap-2">
                            <input type="date" value={logsDate} onChange={e => { setLogsDate(e.target.value); setLogsPage(1); }} className="h-8 rounded-md border border-input bg-background px-2 text-sm" />
                            <button onClick={() => void loadLogs()} disabled={logsLoad || clientFiltLoading} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50">
                              <RefreshCw className={`h-3.5 w-3.5 ${logsLoad || clientFiltLoading ? "animate-spin" : ""}`} /> Reload
                            </button>
                            {logs.length > 0 && (
                              <button onClick={handleExportScans} disabled={exporting} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50">
                                <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" /> Export
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Filter row 1: search + status + method + direction */}
                        <div className="flex flex-wrap gap-2 items-end">
                          <div className="relative flex-1 min-w-52">
                            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <input value={fSearch} onChange={e => setFSearch(e.target.value)} placeholder="Search name · student ID · device user ID…" className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs" />
                          </div>
                          <select value={fStatus} onChange={e => { setFStatus(e.target.value); setLogsPage(1); }} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                            <option value="">All Statuses</option>
                            <option value="present">Present</option>
                            <option value="late">Late</option>
                            <option value="absent">Absent</option>
                          </select>
                          <select value={fMethod} onChange={e => { setFMethod(e.target.value); setLogsPage(1); }} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                            <option value="">All Methods</option>
                            <option value="fingerprint">Fingerprint</option>
                            <option value="face">Face</option>
                            <option value="nfc">NFC / RFID</option>
                            <option value="qr">QR Code</option>
                            <option value="manual">Manual</option>
                          </select>
                          <select value={fDirection} onChange={e => { setFDirection(e.target.value); setLogsPage(1); }} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                            <option value="">All Directions</option>
                            <option value="in">Entry (In)</option>
                            <option value="out">Exit (Out)</option>
                          </select>
                        </div>

                        {/* Filter row 2: class + section + session + student type + gender + dormitory */}
                        <div className="mt-2 flex flex-wrap gap-2 items-end">
                          <div>
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Class</label>
                            <select value={fClass} onChange={e => { setFClass(e.target.value); setLogsPage(1); }} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                              <option value="">All Classes</option>
                              {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                              {logClassNames.filter(n => !classes.some(c => c.name === n)).map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Section</label>
                            <select value={fSection} onChange={e => { setFSection(e.target.value); setLogsPage(1); }} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                              <option value="">All Sections</option>
                              {sections.filter(s => !fClass || s.full_name.startsWith(fClass)).map(s => <option key={s.id} value={s.full_name}>{s.full_name}</option>)}
                              {logSectionNames.filter(n => !sections.some(s => s.full_name === n)).map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Session</label>
                            <select value={fSession} onChange={e => { setFSession(e.target.value); setLogsPage(1); }} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                              <option value="">All Sessions</option>
                              {sessionNames.map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Student Type</label>
                            <select value={fStudentType} onChange={e => { setFStudentType(e.target.value); setLogsPage(1); }} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                              <option value="">All Types</option>
                              <option value="boarding">Boarding</option>
                              <option value="day">Day</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Gender</label>
                            <select value={fGender} onChange={e => { setFGender(e.target.value); setLogsPage(1); }} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                              <option value="">Boys & Girls</option>
                              <option value="male">Boys only</option>
                              <option value="female">Girls only</option>
                            </select>
                          </div>
                          {dormitories.length > 0 && (
                            <div>
                              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Dormitory</label>
                              <select value={fDormitory} onChange={e => { setFDormitory(e.target.value); setLogsPage(1); }} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                                <option value="">All Dormitories</option>
                                {dormitories.map(d => <option key={d.id} value={d.id}>{d.name}{d.block_name ? ` — ${d.block_name}` : ""}</option>)}
                              </select>
                            </div>
                          )}
                          {anyFilter && (
                            <button onClick={clearAllFilters} className="h-8 inline-flex items-center gap-1 rounded-md border border-border px-2.5 text-xs text-muted-foreground hover:bg-muted">
                              <X className="h-3 w-3" /> Clear All
                            </button>
                          )}
                        </div>

                        {anyClientFilter && (
                          <div className="mt-2 flex items-center gap-2 text-[11px] text-primary">
                            <Filter className="h-3 w-3" />
                            Client-side filter active — matching students fetched from school database
                            {clientFiltLoading && <RefreshCw className="h-3 w-3 animate-spin" />}
                            {clientStudentIds && !clientFiltLoading && <span className="text-muted-foreground">({clientStudentIds.size} matching students)</span>}
                          </div>
                        )}

                        {/* Stats */}
                        {!logsLoad && logs.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">{logsMeta.total} total</span>
                            <span className="text-success font-medium">{logsStats.present} present</span>
                            <span className="text-amber-600 font-medium">{logsStats.late} late</span>
                            <span className="text-destructive font-medium">{logsStats.absent} absent</span>
                            <span>{logsStats.entries} entries · {logsStats.exits} exits</span>
                            <span>{logsStats.unique} unique students</span>
                          </div>
                        )}
                      </div>

                      {logsLoad || clientFiltLoading ? (
                        <div className="p-4 space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                      ) : logs.length === 0 ? (
                        <div className="px-5 py-12 text-center">
                          <BarChart3 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
                          <p className="text-muted-foreground text-sm">No attendance scans found for this device on {logsDate}.</p>
                          {anyFilter && <p className="mt-1 text-xs text-muted-foreground">Try clearing the filters.</p>}
                        </div>
                      ) : (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                                <tr>{["#","Student","Student ID","Class","Section","Session","Time","Method","Direction","Status"].map(h => <th key={h} className="px-4 py-3 text-left whitespace-nowrap font-semibold">{h}</th>)}</tr>
                              </thead>
                              <tbody>
                                {logs.map((log, i) => {
                                  const l = log as any;
                                  const sess = l.sessionName ?? l.attendance_period ?? null;
                                  return (
                                    <tr key={log.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                                      <td className="px-4 py-2.5 text-muted-foreground text-xs w-10">{(logsPage-1)*LOGS_PER_PAGE+i+1}</td>
                                      <td className="px-4 py-2.5"><div className="flex items-center gap-2"><Avatar name={log.studentName} size="sm" /><span className="font-medium whitespace-nowrap">{log.studentName}</span></div></td>
                                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">{log.studentId}</td>
                                      <td className="px-4 py-2.5 text-xs">{l.className ?? "—"}</td>
                                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.section ?? "—"}</td>
                                      <td className="px-4 py-2.5 text-xs">{sess ? <span className="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-[10px] font-semibold">{sess}</span> : <span className="text-muted-foreground">—</span>}</td>
                                      <td className="px-4 py-2.5 text-xs font-medium whitespace-nowrap">{fmtTime(log.timestamp)}</td>
                                      <td className="px-4 py-2.5 text-xs capitalize text-muted-foreground">{log.method ?? "—"}</td>
                                      <td className="px-4 py-2.5">{log.direction ? <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${log.direction === "In" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{log.direction === "In" ? "Entry" : "Exit"}</span> : <span className="text-muted-foreground text-xs">—</span>}</td>
                                      <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${statusPill(log.status ?? "")}`}>{log.status ?? "—"}</span></td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          {logsMeta.totalPages > 1 && (
                            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                              <span className="text-xs text-muted-foreground">{(logsPage-1)*LOGS_PER_PAGE+1}–{Math.min(logsPage*LOGS_PER_PAGE, logsMeta.total)} of {logsMeta.total}</span>
                              <div className="flex gap-2 items-center">
                                <button onClick={() => setLogsPage(p => p-1)} disabled={logsPage<=1} className="rounded-md border border-border px-3 py-1 text-xs disabled:opacity-50 hover:bg-muted">Previous</button>
                                <span className="text-xs text-muted-foreground px-1">{logsPage} / {logsMeta.totalPages}</span>
                                <button onClick={() => setLogsPage(p => p+1)} disabled={logsPage>=logsMeta.totalPages} className="rounded-md border border-border px-3 py-1 text-xs disabled:opacity-50 hover:bg-muted">Next</button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* ════ REPORTS & EXPORT tab ════ */}
                  {activeTab === "reports" && (
                    <div className="space-y-4">
                      {/* Stats summary */}
                      {logs.length > 0 && (
                        <div className="rounded-xl border border-border bg-card p-5">
                          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Attendance Summary — {selected.name} — {logsDate}</h3>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                            {[
                              { label: "Total Scans",      val: logsStats.total,   color: "text-foreground" },
                              { label: "Present",          val: logsStats.present, color: "text-success" },
                              { label: "Late",             val: logsStats.late,    color: "text-amber-600" },
                              { label: "Absent",           val: logsStats.absent,  color: "text-destructive" },
                              { label: "Unique Students",  val: logsStats.unique,  color: "text-blue-600" },
                              { label: "Entries (In)",     val: logsStats.entries, color: "text-emerald-600" },
                              { label: "Exits (Out)",      val: logsStats.exits,   color: "text-amber-600" },
                            ].map(({ label, val, color }) => (
                              <div key={label} className="rounded-lg border border-border bg-muted/20 p-3 text-center">
                                <div className={`text-2xl font-bold ${color}`}>{val}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                              </div>
                            ))}
                          </div>
                          {Object.keys(logsStats.methods).length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-2">By Scan Method</p>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(logsStats.methods).map(([m, count]) => (
                                  <span key={m} className="rounded-full bg-muted px-3 py-1 text-xs font-medium capitalize">{m}: <b>{count}</b></span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Export cards */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        {/* Export current device scans */}
                        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet className="h-5 w-5 text-green-600" />
                            <h3 className="font-semibold text-sm">Export This Device's Scans</h3>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Exports attendance scans for <b>{selected.name}</b> for the date currently loaded in the Scans tab, with all active filters applied.
                          </p>
                          <div className="text-xs text-muted-foreground">
                            {logs.length > 0 ? <span className="text-green-600 font-medium">{logs.length} records ready to export</span> : <span className="text-amber-600">Go to Scans tab and load data first</span>}
                          </div>
                          <button onClick={handleExportScans} disabled={exporting || logs.length === 0}
                            className="inline-flex items-center gap-2 rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                            {exporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                            {exporting ? "Exporting…" : "Export Scans (.xlsx)"}
                          </button>
                        </div>

                        {/* Export all devices summary */}
                        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                            <h3 className="font-semibold text-sm">Export All Devices Summary</h3>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Exports attendance scans from <b>all {devices.length} device(s)</b> for the selected date into one Excel file — useful for daily reporting.
                          </p>
                          <div className="flex items-end gap-2">
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Date</label>
                              <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-sm" />
                            </div>
                          </div>
                          <button onClick={handleExportDeviceSummary} disabled={exporting}
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                            {exporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                            {exporting ? "Exporting…" : "Export All Devices (.xlsx)"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
