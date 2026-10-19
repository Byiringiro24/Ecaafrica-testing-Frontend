/**
 * Device Management â€” School Admin
 * Professional layout with left device sidebar + tabbed right panel.
 * Everything comes from real school data â€” no hardcoded values.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  RefreshCw, Wifi, WifiOff, Upload, Download, Clock, Users, Activity,
  Fingerprint, Smile, CreditCard, HardDrive, Trash2, Plus, MapPin,
  Zap, ZapOff, AlertTriangle, ChevronDown, ChevronUp, Check, X,
  Shield, Search, Key, RotateCcw, ChevronRight, Filter,
  FileSpreadsheet, BarChart3, Info, Circle,
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

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type Tab          = "overview" | "push" | "users" | "scans" | "reports";
type ConnTier     = "full" | "bridge" | "offline"; // three-tier connection state
type ClassRecord  = { id: string; name: string };
type SectionRecord= { id: string; name: string; full_name: string; class_id: string };
type Dormitory    = { id: string; name: string; block_name?: string | null };
type DeviceUser   = { userId?: string; id?: string; name?: string; privilege?: number; enabled?: boolean; biometricMethods?: string[] };
type DeviceSession= { id: string; name: string; is_active: boolean; activated_at?: string | null; windows: { id?: string; label: string; start_time: string; end_time: string; grace_minutes?: number }[] };

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const fmtTime = (ts?: string | null) => { if (!ts) return "â€”"; const d = new Date(ts); return isNaN(d.getTime()) ? "â€”" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }); };
const fmtFull = (ts?: string | null) => { if (!ts) return "â€”"; const d = new Date(ts); return isNaN(d.getTime()) ? "â€”" : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); };
const isLiveOnline = (d?: Device | null) => { if (!d) return false; if (d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() < 90_000) return true; return Boolean(d.is_connected || d.is_online || d.status === "online"); };

/** Get the three-tier connection status from live status data */
const getConnectionTier = (status: any): ConnTier => {
  if (!status) return "offline";
  if (status.connection_tier) return status.connection_tier as ConnTier;
  // Fallback: infer from available fields
  if (status.fk623_connected || status.device_status?.connected) return "full";
  if (status.bridge_reachable || status.is_online) return "bridge";
  return "offline";
};

/** Dot color + label for each tier */
const tierStyle = (tier: ConnTier) => ({
  full:    { dot: "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.7)] animate-pulse", text: "text-green-600", label: "Connected",    desc: "FK623 + Tablet + WireGuard active" },
  bridge:  { dot: "bg-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.6)] animate-pulse", text: "text-yellow-600", label: "Bridge only", desc: "Tablet reachable â€” FK623 not connected" },
  offline: { dot: "bg-gray-300",                                                      text: "text-muted-foreground",  label: "Offline",      desc: "Bridge not reachable via WireGuard" },
});

/** Sidebar dot color per device (uses cached last_seen_at) */
const deviceDotClass = (d: Device) => {
  if (!isLiveOnline(d)) return "bg-gray-300";
  return "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)] animate-pulse";
};

const scopeColor  = (s?: string) => { if (s === "gate") return "bg-emerald-100 text-emerald-700 border-emerald-200"; if (s === "dormitory") return "bg-blue-100 text-blue-700 border-blue-200"; if (s === "dining_hall") return "bg-amber-100 text-amber-700 border-amber-200"; if (s === "classroom") return "bg-violet-100 text-violet-700 border-violet-200"; return "bg-gray-100 text-gray-600 border-gray-200"; };
const statusPill  = (s: string) => { const l = (s ?? "").toLowerCase(); if (l === "present") return "bg-green-100 text-green-700"; if (l === "late") return "bg-amber-100 text-amber-700"; if (l === "absent") return "bg-red-100 text-red-700"; return "bg-gray-100 text-gray-600"; };

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

const TABS: { id: Tab; label: string; icon: typeof Activity; desc: string }[] = [
  { id: "overview", label: "Overview",         icon: Activity,       desc: "Status, assignment, sessions" },
  { id: "push",     label: "Push / Remove",    icon: Upload,         desc: "Manage student enrollment" },
  { id: "users",    label: "Enrolled Users",   icon: Users,          desc: "View & manage device users" },
  { id: "scans",    label: "Attendance Scans", icon: BarChart3,      desc: "View & filter scan logs" },
  { id: "reports",  label: "Reports & Export", icon: FileSpreadsheet,desc: "Export attendance data" },
];

// â”€â”€â”€ Card wrapper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TabletIpForm — update tablet WireGuard IP and trigger immediate FK623 reconnect
function TabletIpForm({ tabletId, currentIp, onReconnected }: {
  tabletId: string; currentIp: string; onReconnected: () => void;
}) {
  const [ip,     setIp]    = useState(currentIp || "");
  const [port,   setPort]  = useState(5000);
  const [saving, setSaving]= useState(false);
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ip.trim()) { toast.error("Enter a valid IP address"); return; }
    setSaving(true);
    try {
      await apiRequest(`/tablets/${tabletId}`, { method: "PATCH", body: JSON.stringify({ ip: ip.trim(), port }), auth: "school" });
      toast.success(`Tablet IP updated to ${ip.trim()}:${port}`);
      try {
        await apiRequest(`/tablets/${tabletId}/device/connect`, { method: "POST", body: JSON.stringify({}), auth: "school" });
        toast.success("Reconnected to FK623 device");
      } catch { toast("IP saved. Bridge will reconnect automatically.", { icon: "ℹ️" }); }
      onReconnected();
    } catch (e: any) { toast.error(e?.message ?? "Failed to update IP"); }
    finally { setSaving(false); }
  };
  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-semibold text-foreground">Tablet WireGuard IP <span className="text-red-500">*</span></label>
          <input value={ip} onChange={e => setIp(e.target.value)} placeholder="e.g. 10.0.0.2" required className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-mono shadow-sm" />
          <p className="mt-1 text-[11px] text-muted-foreground">Run <code className="bg-muted px-1 rounded">wg show</code> on the server or check the tablet WireGuard wizard to find this IP.</p>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">Bridge Port</label>
          <input type="number" value={port} onChange={e => setPort(Number(e.target.value))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm" />
        </div>
      </div>
      <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 shadow-sm transition-all">
        {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
        {saving ? "Saving..." : "Update & Reconnect"}
      </button>
    </form>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card shadow-sm overflow-hidden ${className}`}>{children}</div>;
}
function CardHeader({ title, subtitle, icon: Icon, action, badge }: { title: string; subtitle?: string; icon?: typeof Activity; action?: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-border">
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && <div className="rounded-lg bg-primary/10 p-1.5 shrink-0"><Icon className="h-4 w-4 text-primary" /></div>}
        <div className="min-w-0">
          <div className="flex items-center gap-2">{badge}<h3 className="font-semibold text-sm">{title}</h3></div>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0 ml-3">{action}</div>}
    </div>
  );
}

// â”€â”€â”€ Collapsible â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Collapse({ title, icon: Icon, children, open: controlledOpen, onToggle, badge, danger = false, defaultOpen = false }: {
  title: string; icon: typeof Activity; children: React.ReactNode;
  open?: boolean; onToggle?: () => void;
  badge?: React.ReactNode; danger?: boolean; defaultOpen?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen   = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const doToggle = onToggle ?? (() => setInternalOpen(o => !o));
  return (
    <Card className={danger ? "border-red-200" : ""}>
      <button onClick={doToggle} className={`w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors text-left ${danger ? "bg-red-50/50" : ""}`}>
        <span className="flex items-center gap-2.5 font-semibold text-sm">
          <Icon className={`h-4 w-4 shrink-0 ${danger ? "text-red-500" : "text-primary"}`} />
          {title}{badge}
        </span>
        {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {isOpen && <div className="px-5 py-5 border-t border-border">{children}</div>}
    </Card>
  );
}

// â”€â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function DeviceManagement() {
  const [activeTab,  setActiveTab]  = useState<Tab>("overview");
  const [devices,    setDevices]    = useState<Device[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [devLoading, setDevLoading] = useState(true);
  const [status,        setStatus]        = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const statusFlight = useRef(false);

  // Reference data from school API
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
  const [logs,            setLogs]            = useState<DeviceLog[]>([]);
  const [logsLoad,        setLogsLoad]        = useState(false);
  const [logsDate,        setLogsDate]        = useState(localDateInputValue);
  const [logsPage,        setLogsPage]        = useState(1);
  const [logsMeta,        setLogsMeta]        = useState({ total: 0, totalPages: 1 });
  const [fSearch,         setFSearch]         = useState("");
  const [fStatus,         setFStatus]         = useState("");
  const [fMethod,         setFMethod]         = useState("");
  const [fClass,          setFClass]          = useState("");
  const [fSection,        setFSection]        = useState("");
  const [fDirection,      setFDirection]      = useState("");
  const [fSession,        setFSession]        = useState("");
  const [fGender,         setFGender]         = useState("");
  const [fStudentType,    setFStudentType]     = useState("");
  const [fDormitory,      setFDormitory]       = useState("");
  const [debouncedQ,      setDebouncedQ]       = useState("");
  const [clientStudentIds,   setClientStudentIds]   = useState<Set<string> | null>(null);
  const [clientFiltLoading,  setClientFiltLoading]  = useState(false);

  // Reports
  const [reportDate, setReportDate] = useState(localDateInputValue);
  const [exporting,  setExporting]  = useState(false);

  useEffect(() => { const t = setTimeout(() => { setDebouncedQ(fSearch); setLogsPage(1); }, 350); return () => clearTimeout(t); }, [fSearch]);

  // â”€â”€ Loaders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      if (fDormitory) list = list.filter((s: any) => (s.student_dorm_assignments ?? []).some((d: any) => String(d.dormitory_id ?? d.id) === fDormitory));
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
        search: debouncedQ || undefined, status: fStatus || undefined,
        method: fMethod || undefined, className: fClass || undefined,
        section: fSection || undefined, direction: fDirection || undefined,
      });
      let data = res.data as any[];
      if (fSession) data = data.filter(l => (l.sessionName ?? (l as any).attendance_period ?? "").toLowerCase().includes(fSession.toLowerCase()));
      if (studentIdSet) data = data.filter(l => studentIdSet.has(String(l.studentId)));
      setLogs(data);
      setLogsMeta({ total: studentIdSet ? data.length : res.meta.total, totalPages: studentIdSet ? Math.max(1, Math.ceil(data.length / LOGS_PER_PAGE)) : res.meta.totalPages });
    } catch (e: any) { toast.error(e?.message ?? "Failed to load logs"); }
    finally { setLogsLoad(false); }
  }, [selectedId, logsDate, logsPage, debouncedQ, fStatus, fMethod, fClass, fSection, fDirection, fSession, resolveClientStudentIds]);

  // â”€â”€ Effects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    void loadStatus(); void loadSessions();
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

  // â”€â”€ Derived â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const selected  = devices.find(d => d.id === selectedId);
  const isOnline  = isLiveOnline(selected);
  const tabletId  = selected?.tablet_id ?? null;
  const fkStatus  = status?.device_status ?? status?.data ?? null;
  const connTier  = getConnectionTier(status);
  const tierInfo  = tierStyle(connTier);
  // Push is only available when FK623 + Tablet + WireGuard are all active
  const canPush   = connTier === "full";
  const canAction = connTier !== "offline"; // sync time, get users etc work if bridge is reachable

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
  const logsStats   = useMemo(() => ({
    total:   logs.length,
    present: logs.filter(l => l.status?.toLowerCase() === "present").length,
    late:    logs.filter(l => l.status?.toLowerCase() === "late").length,
    absent:  logs.filter(l => l.status?.toLowerCase() === "absent").length,
    entries: logs.filter(l => l.direction === "In").length,
    exits:   logs.filter(l => l.direction === "Out").length,
    unique:  new Set(logs.map(l => l.studentId)).size,
    byMethod: logs.reduce((a, l) => { const m = l.method ?? "unknown"; a[m] = (a[m] ?? 0) + 1; return a; }, {} as Record<string, number>),
  }), [logs]);

  // â”€â”€ Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const act = async (fn: () => Promise<void>) => { try { await fn(); } catch (e: any) { toast.error(e?.message ?? "Operation failed"); } };

  const handlePullLogs   = () => act(async () => { if (!tabletId) throw new Error("No tablet"); const r = await tabletApi.pullLogs({ tabletId, readMark: 0 }); toast.success(`Pulled ${r.data?.savedCount ?? 0} log(s) â€” ${r.data?.duplicateCount ?? 0} duplicates`); void loadLogs(); });
  const handleSyncTime   = () => act(async () => { if (!tabletId) throw new Error("No tablet"); await tabletApi.syncTime(tabletId); toast.success("Device time synced to server"); });
  const handleGetUsers   = async () => { if (!tabletId) { toast.error("No tablet linked"); return; } setUsersLoading(true); try { const r = await tabletApi.getUsers(tabletId); setDeviceUsers(r.data?.users ?? []); toast.success(`${r.data?.count ?? 0} enrolled users`); } catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setUsersLoading(false); } };
  const handleDeleteUser = (uid: string) => act(async () => { if (!tabletId) throw new Error("No tablet"); if (!window.confirm(`Remove user ${uid} from device?`)) return; await tabletApi.removeUser(tabletId, uid); toast.success("User removed"); setDeviceUsers(p => p.filter(u => (u.userId ?? u.id) !== uid)); });
  const handleClearLogs  = () => act(async () => { if (!tabletId) throw new Error("No tablet"); if (!window.confirm(`Delete ALL logs from "${selected?.name}"?\n\nLogs pulled to the server are kept. This cannot be undone.`)) return; await tabletApi.clearLogs(tabletId); toast.success("Logs cleared from device"); void loadStatus(); });
  const handleClearUsers = () => act(async () => { if (!tabletId) throw new Error("No tablet"); if (!window.confirm(`Delete ALL enrolled users from "${selected?.name}"?\n\nAll fingerprints and face data will be lost. Re-push students to restore.`)) return; if (!window.confirm("Confirm â€” this is irreversible.")) return; await tabletApi.clearUsers(tabletId); toast.success("All users cleared"); setDeviceUsers([]); void loadStatus(); });
  const handleReboot     = () => act(async () => { if (!tabletId) throw new Error("No tablet"); if (!window.confirm(`Reboot "${selected?.name}"? It will reconnect in ~30â€“60 seconds.`)) return; await tabletApi.resetDevice(tabletId); toast.success("Reboot command sent"); setTimeout(() => void loadStatus(true), 35_000); });

  const handlePushStudents = async () => {
    if (!selectedId) return;
    // Warn if not fully connected, but still allow (retry runs for 5 min)
    if (connTier === "offline") {
      toast.warning("Device is offline. Push command will be sent and retried for up to 5 minutes once the bridge comes back online.");
    } else if (connTier === "bridge") {
      toast.warning("FK623 device not physically connected. Push will be sent and retried for up to 5 minutes.");
    }
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
      failed > 0
        ? toast.warning(`Pushed ${r.pushed_count}/${(r as any).selected_count ?? r.pushed_count + failed} â€” ${failed} failed. Check device connection.`)
        : toast.success(`Pushed ${r.pushed_count} student(s) to device successfully`);
      void loadStatus();
    } catch (e: any) {
      const msg = e?.message ?? "Push failed";
      // Distinguish "no tablet configured" from network errors
      if (msg.includes("no API URL") || msg.includes("no tablet") || msg.includes("tablet connection configured")) {
        toast.error("Device has no tablet bridge configured. Set the tablet IP/port in Device Assignment first.");
      } else if (msg.includes("ECONNREFUSED") || msg.includes("ETIMEDOUT") || msg.includes("No response") || msg.includes("timed out")) {
        toast.error("Push timed out after 5 minutes â€” bridge was unreachable. Check WireGuard VPN and tablet power.");
      } else {
        toast.error(msg);
      }
    }
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
    } catch (e: any) { toast.error(e?.message ?? "Remove failed"); }
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
  const handleDeleteSession = (sid: string) => act(async () => { if (!window.confirm("Delete this attendance session?")) return; await apiRequest(`/devices/${selectedId}/sessions/${sid}`, { method: "DELETE", auth: "school" }); toast.success("Session deleted"); void loadSessions(); });
  const handleToggleSession = (sid: string, active: boolean) => act(async () => { await apiRequest(`/devices/${selectedId}/sessions/${sid}/${active ? "deactivate" : "activate"}`, { method: "PATCH", auth: "school" }); toast.success(active ? "Deactivated" : "Activated"); void loadSessions(); });

  const handleExportScans = async () => {
    if (logs.length === 0) { toast.info("Load scans first"); return; }
    setExporting(true);
    try {
      const devName = selected?.name ?? "device";
      await exportToExcel(`scans-${devName}-${logsDate}.xlsx`, "Attendance Scans",
        [
          { header: "#",         key: "no",      width: 5  },
          { header: "Student",   key: "name",    width: 26 },
          { header: "Student ID",key: "sid",     width: 16 },
          { header: "Class",     key: "cls",     width: 14 },
          { header: "Section",   key: "section", width: 14 },
          { header: "Session",   key: "session", width: 20 },
          { header: "Time",      key: "time",    width: 10 },
          { header: "Method",    key: "method",  width: 14 },
          { header: "Direction", key: "dir",     width: 10 },
          { header: "Status",    key: "status",  width: 12 },
        ],
        logs.map((l, i) => ({ no: i+1, name: l.studentName ?? "â€”", sid: l.studentId ?? "â€”", cls: (l as any).className ?? "â€”", section: (l as any).section ?? "â€”", session: (l as any).sessionName ?? (l as any).attendance_period ?? "â€”", time: fmtTime(l.timestamp), method: l.method ?? "â€”", dir: l.direction ?? "â€”", status: l.status ?? "â€”" })),
        `Attendance Scans â€” ${devName} â€” ${logsDate}`
      );
      toast.success("Export complete");
    } catch (e: any) { toast.error(e?.message ?? "Export failed"); }
    finally { setExporting(false); }
  };

  const handleExportAllDevices = async () => {
    setExporting(true);
    try {
      const allLogs: any[] = [];
      for (const dev of devices) {
        try {
          const res = await fetchDeviceLogs({ deviceId: dev.id, startDate: reportDate, endDate: reportDate, limit: 1000 });
          allLogs.push(...res.data.map(l => ({ ...l, _deviceName: dev.name, _scope: (dev as any).location_scope ?? "â€”" })));
        } catch { /* skip */ }
      }
      if (allLogs.length === 0) { toast.info("No attendance data for this date"); return; }
      await exportToExcel(`all-devices-${reportDate}.xlsx`, "All Devices",
        [
          { header: "#",         key: "no",     width: 5  },
          { header: "Device",    key: "device", width: 20 },
          { header: "Location",  key: "scope",  width: 14 },
          { header: "Student",   key: "name",   width: 26 },
          { header: "Student ID",key: "sid",    width: 16 },
          { header: "Class",     key: "cls",    width: 14 },
          { header: "Session",   key: "session",width: 20 },
          { header: "Time",      key: "time",   width: 10 },
          { header: "Method",    key: "method", width: 14 },
          { header: "Direction", key: "dir",    width: 10 },
          { header: "Status",    key: "status", width: 12 },
        ],
        allLogs.map((l, i) => ({ no: i+1, device: l._deviceName, scope: l._scope, name: l.studentName ?? "â€”", sid: l.studentId ?? "â€”", cls: l.className ?? "â€”", session: l.sessionName ?? l.attendance_period ?? "â€”", time: fmtTime(l.timestamp), method: l.method ?? "â€”", dir: l.direction ?? "â€”", status: l.status ?? "â€”" })),
        `All Devices Attendance â€” ${reportDate}`
      );
      toast.success("All-device report exported");
    } catch (e: any) { toast.error(e?.message ?? "Export failed"); }
    finally { setExporting(false); }
  };

  const clearAllFilters = () => { setFSearch(""); setFStatus(""); setFMethod(""); setFClass(""); setFSection(""); setFDirection(""); setFSession(""); setFGender(""); setFStudentType(""); setFDormitory(""); setLogsPage(1); };

  // â”€â”€ Select helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const Sel = ({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) => (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs">
        {children}
      </select>
    </div>
  );

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <AppLayout title="Device Management" subtitle="Manage biometric devices, push students, pull logs and view attendance">

      {/* Info banner */}
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>Tablets and biometric devices are registered by the <b>platform administrator</b>. Contact your platform admin to add or remove devices.</span>
      </div>

      {devLoading ? (
        <div className="flex gap-5">
          <div className="w-52 space-y-2"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
          <div className="flex-1 space-y-4"><Skeleton className="h-40" /><Skeleton className="h-60" /></div>
        </div>
      ) : devices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-16 text-center">
          <Shield className="h-14 w-14 mx-auto mb-4 text-muted-foreground/20" />
          <p className="font-semibold text-lg text-foreground">No devices registered</p>
          <p className="mt-1 text-sm text-muted-foreground max-w-xs mx-auto">No biometric devices have been assigned to your school yet. Contact the platform administrator.</p>
        </div>
      ) : (
        <div className="flex gap-5 items-start">

          {/* â•â•â• LEFT SIDEBAR â•â•â• */}
          <div className="w-52 shrink-0">
            <div className="flex items-center justify-between mb-2 px-0.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Devices ({devices.length})</span>
              <button onClick={() => void loadDevices()} disabled={devLoading} className="rounded-lg p-1.5 hover:bg-muted transition-colors" title="Refresh device list">
                <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${devLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-200px)]">
              {devices.map(device => {
                const online   = isLiveOnline(device);
                const isActive = device.id === selectedId;
                const scope    = (device as any).location_scope as string | undefined;
                const lbl      = (device as any).location_label as string | undefined;
                const err      = device.last_sync_error ?? (device as any).last_status_message;
                return (
                  <button key={device.id} onClick={() => { setSelectedId(device.id); setActiveTab("overview"); }}
                    className={`w-full rounded-xl border text-left transition-all duration-150 ${isActive ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/20" : "border-border bg-card hover:border-primary/30 hover:bg-muted/20 hover:shadow-sm"}`}
                  >
                    <div className="p-3.5">
                      {/* Name + status */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={`h-2.5 w-2.5 rounded-full shrink-0 flex-none ${deviceDotClass(device)}`} />
                        <span className={`font-semibold text-sm truncate flex-1 ${isActive ? "text-primary" : "text-foreground"}`}>{device.name}</span>
                        {isActive && <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />}
                      </div>
                      {/* Scope badge */}
                      {scope
                        ? <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${scopeColor(scope)}`}>{scope.replace("_"," ")}</span>
                        : <span className="text-[10px] text-amber-600 font-semibold">âš  Not assigned</span>
                      }
                      {lbl && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{lbl}</p>}
                      {/* Online text */}
                      <p className={`text-[10px] font-medium mt-1 ${online ? "text-green-600" : "text-muted-foreground"}`}>
                        {online ? "â— Connected" : "â—‹ Offline"}
                      </p>
                      {/* Error chip */}
                      {err && <div className="mt-1.5 rounded-lg bg-red-50 border border-red-200 px-2 py-1 text-[10px] text-red-600 leading-snug line-clamp-2">{err}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* â•â•â• RIGHT PANEL â•â•â• */}
          <div className="flex-1 min-w-0 space-y-4">

            {!selected ? (
              <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border text-center gap-2">
                <ChevronRight className="h-8 w-8 text-muted-foreground/30 -rotate-180" />
                <p className="font-medium text-muted-foreground">Select a device from the list</p>
                <p className="text-xs text-muted-foreground/60">Click any device on the left to manage it</p>
              </div>
            ) : (
              <>
                {/* â”€â”€ Device header card â”€â”€ */}
                <Card>
                  {/* Title row */}
                  <div className={`px-5 py-4 ${connTier === "full" ? "bg-gradient-to-r from-green-50 to-emerald-50/30" : connTier === "bridge" ? "bg-gradient-to-r from-yellow-50 to-amber-50/20" : "bg-muted/30"}`}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Three-tier status icon */}
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${connTier === "full" ? "bg-green-100" : connTier === "bridge" ? "bg-yellow-100" : "bg-gray-100"}`}>
                          {statusLoading
                            ? <RefreshCw className="h-5 w-5 text-primary animate-spin" />
                            : connTier === "full"
                              ? <Wifi className="h-5 w-5 text-green-600" />
                              : connTier === "bridge"
                                ? <Wifi className="h-5 w-5 text-yellow-500" />
                                : <WifiOff className="h-5 w-5 text-gray-400" />
                          }
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="font-bold text-lg leading-tight">{selected.name}</h2>
                            {(selected as any).location_scope && (
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${scopeColor((selected as any).location_scope)}`}>
                                {((selected as any).location_scope as string).replace("_"," ")}
                              </span>
                            )}
                            {/* Connection tier badge */}
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                              connTier === "full"   ? "bg-green-100 border-green-300 text-green-700" :
                              connTier === "bridge" ? "bg-yellow-100 border-yellow-300 text-yellow-700" :
                              "bg-gray-100 border-gray-200 text-gray-500"
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${tierInfo.dot.replace("animate-pulse","")}`} />
                              {tierInfo.label}
                            </span>
                          </div>
                          <p className={`text-xs mt-0.5 font-medium ${tierInfo.text}`}>{tierInfo.desc}</p>
                          {status?.last_status_message && (
                            <p className="text-xs text-muted-foreground mt-0.5">{status.last_status_message}</p>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        <button onClick={() => void loadStatus()} disabled={statusLoading}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 shadow-sm transition-all">
                          <Activity className="h-3.5 w-3.5" /> Check Status
                        </button>
                        <button onClick={handleSyncTime} disabled={connTier === "offline"}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 shadow-sm transition-all">
                          <Clock className="h-3.5 w-3.5" /> Sync Time
                        </button>
                        <button onClick={handleGetUsers} disabled={connTier === "offline"}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 shadow-sm transition-all">
                          <Users className="h-3.5 w-3.5" /> Get Users
                        </button>
                        <button onClick={handlePullLogs} disabled={connTier === "offline"}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-white px-3 py-1.5 text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 shadow-sm transition-all">
                          <Download className="h-3.5 w-3.5" /> Pull Logs
                        </button>
                        <div className="w-px h-6 bg-border self-center mx-1" />
                        <button onClick={handleReboot} disabled={connTier === "offline"}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 px-3 py-1.5 text-xs font-semibold hover:bg-amber-100 disabled:opacity-50 shadow-sm transition-all" title="Reboot FK623 device">
                          <RotateCcw className="h-3.5 w-3.5" /> Reset
                        </button>
                        <button onClick={handleClearLogs} disabled={connTier === "offline"}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 px-3 py-1.5 text-xs font-semibold hover:bg-red-100 disabled:opacity-50 shadow-sm transition-all" title="Delete all logs from FK623">
                          <Trash2 className="h-3.5 w-3.5" /> Clear Logs
                        </button>
                        <button onClick={handleClearUsers} disabled={connTier === "offline"}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 px-3 py-1.5 text-xs font-semibold hover:bg-red-100 disabled:opacity-50 shadow-sm transition-all" title="Delete all users from FK623">
                          <Users className="h-3.5 w-3.5" /> Clear Users
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* FK623 metrics â€” 6 tiles */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-border">
                    {[
                      { icon: Users,       label: "Users",        val: fkStatus?.users        ?? selected.device_users_count ?? 0, color: "text-blue-600"   },
                      { icon: Fingerprint, label: "Fingerprints", val: fkStatus?.fingerprints ?? 0,                                color: "text-purple-600" },
                      { icon: Smile,       label: "Faces",        val: fkStatus?.faces        ?? 0,                                color: "text-green-600"  },
                      { icon: CreditCard,  label: "Cards",        val: fkStatus?.cards        ?? 0,                                color: "text-orange-600" },
                      { icon: HardDrive,   label: "Log Records",  val: fkStatus?.logs         ?? selected.device_logs_count ?? 0, color: "text-indigo-600" },
                      { icon: Key,         label: "Serial No.",   val: fkStatus?.serialNumber ?? "â€”",                             color: "text-gray-500"   },
                    ].map(({ icon: Icon, label, val, color }) => (
                      <div key={label} className="flex flex-col items-center justify-center gap-1 py-4 bg-card hover:bg-muted/10 transition-colors">
                        <Icon className={`h-4 w-4 ${color}`} />
                        <span className="text-xl font-bold leading-none text-foreground">{val}</span>
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Last sync info */}
                  {(selected.last_sync_at || selected.last_sync_error) && (
                    <div className="border-t border-border px-5 py-2 bg-muted/10 flex flex-wrap gap-x-6 text-xs text-muted-foreground">
                      {selected.last_sync_at && <span>Last sync: <b className="text-foreground">{fmtFull(selected.last_sync_at)}</b> â€” {selected.last_sync_status ?? "â€”"}</span>}
                      {selected.last_sync_error && <span className="text-red-600">{selected.last_sync_error}</span>}
                    </div>
                  )}
                </Card>

                {/* â”€â”€ Tab navigation â”€â”€ */}
                <div className="flex border-b border-border overflow-x-auto -mb-0">
                  {TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-all ${
                        activeTab === tab.id
                          ? "border-primary text-primary bg-primary/5"
                          : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                      }`}>
                      <tab.icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* â”€â”€ Tab content â”€â”€ */}
                <div className="space-y-4">

                  {/* â•â•â•â• OVERVIEW â•â•â•â• */}
                  {activeTab === "overview" && (
                    <>
                      {/* ── Tablet Connection (IP Update + Reconnect) ── */}
                      <Collapse title="Tablet Connection" icon={Wifi}
                        badge={
                          <span className={`ml-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            connTier === "full"   ? "bg-green-100 border-green-300 text-green-700" :
                            connTier === "bridge" ? "bg-yellow-100 border-yellow-300 text-yellow-700" :
                            "bg-gray-100 border-gray-200 text-gray-500"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${tierInfo.dot.replace("animate-pulse","")}`} />
                            {tierInfo.label}
                          </span>
                        }
                        defaultOpen={connTier === "offline"}
                      >
                        <p className="text-sm text-muted-foreground mb-4">
                          The tablet must be reachable via <b>WireGuard VPN</b>. Enter the tablet's VPN IP (e.g. <code className="bg-muted px-1 rounded text-xs">10.0.0.2</code>) and click <b>Update & Reconnect</b>. The FK623 device connects automatically through the tablet bridge.
                        </p>
                        {tabletId ? (
                          <TabletIpForm
                            tabletId={tabletId}
                            currentIp={(selected as any).tablet?.ip ?? (selected as any).tablet_ip ?? ""}
                            onReconnected={() => { void loadStatus(); void loadDevices(); }}
                          />
                        ) : (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                            No tablet linked to this device. Contact the platform administrator to register a tablet and link it here.
                          </div>
                        )}
                      </Collapse>

                      {/* Device Assignment */}
                      <Collapse title="Device Assignment" icon={MapPin}
                        badge={(selected as any).location_scope
                          ? <span className={`ml-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${scopeColor((selected as any).location_scope)}`}>{((selected as any).location_scope as string).replace("_"," ")}</span>
                          : <span className="ml-2 text-[10px] text-amber-600 font-semibold">Not assigned</span>
                        }
                        defaultOpen={!(selected as any).location_scope}
                      >
                        <p className="text-sm text-muted-foreground mb-4">Assign this device to a physical location. Setting <b>Dormitory</b> automatically links biometric scans to boarding attendance records.</p>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-foreground">Location Type</label>
                            <select value={aScope} onChange={e => setAScope(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm">
                              {SCOPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-foreground">Location Name <span className="font-normal text-muted-foreground">(e.g. "Main Gate", "Boys Hostel")</span></label>
                            <input value={aLabel} onChange={e => setALabel(e.target.value)} placeholder={aScope === "gate" ? "e.g. Main Gate" : aScope === "dormitory" ? "e.g. Boys Hostel Block A" : "Enter a descriptive name"} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm" />
                          </div>
                        </div>
                        {aScope === "dormitory" && (
                          <div className="mt-4">
                            <label className="mb-1.5 block text-xs font-semibold text-foreground">Link to Dormitory <span className="font-normal text-muted-foreground">(enables automatic boarding attendance)</span></label>
                            <select value={aDorm} onChange={e => setADorm(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm">
                              <option value="">â€” select a dormitory â€”</option>
                              {dormitories.map(d => <option key={d.id} value={d.id}>{d.name}{d.block_name ? ` (${d.block_name})` : ""}</option>)}
                            </select>
                            {dormitories.length === 0 && <p className="mt-1.5 text-xs text-amber-600">No dormitories found. Create them in Boarding â†’ Dormitories first.</p>}
                          </div>
                        )}
                        <button onClick={handleAssignLocation} disabled={assigning} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 shadow-sm transition-all">
                          {assigning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save Location
                        </button>
                      </Collapse>

                      {/* Attendance Sessions */}
                      <Collapse title="Attendance Sessions" icon={Zap}
                        badge={<span className="ml-2 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">{sessions.length}</span>}
                        defaultOpen
                      >
                        <p className="text-sm text-muted-foreground mb-4">Sessions define time windows for attendance. The system <b>auto-activates</b> the matching session when the current time falls within a window.</p>

                        {sessLoad ? (
                          <div className="space-y-2 mb-4"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
                        ) : sessions.length === 0 ? (
                          <div className="mb-4 rounded-xl border border-dashed border-border p-6 text-center">
                            <Zap className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                            <p className="text-sm text-muted-foreground">No sessions configured yet</p>
                            <p className="text-xs text-muted-foreground/70 mt-0.5">Create one below to start tracking attendance windows</p>
                          </div>
                        ) : (
                          <div className="mb-5 space-y-2">
                            {sessions.map(s => (
                              <div key={s.id} className={`flex items-center gap-3 rounded-xl border p-4 transition-colors ${s.is_active ? "border-green-200 bg-green-50" : "border-border bg-muted/20"}`}>
                                <div className={`h-3 w-3 rounded-full shrink-0 ${s.is_active ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" : "bg-gray-300"}`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-sm">{s.name}</span>
                                    {s.is_active && <span className="rounded-full bg-green-100 border border-green-300 px-2 py-0.5 text-[10px] font-bold text-green-700 uppercase tracking-wide">Active</span>}
                                  </div>
                                  {s.windows.length > 0 && (
                                    <p className="text-xs text-muted-foreground mt-0.5">{s.windows.map(w => `${w.label}: ${w.start_time}â€“${w.end_time}${w.grace_minutes ? ` (+${w.grace_minutes}m grace)` : ""}`).join(" Â· ")}</p>
                                  )}
                                  {s.is_active && s.activated_at && <p className="text-[10px] text-green-600 mt-0.5">Active since {fmtFull(s.activated_at)}</p>}
                                </div>
                                <div className="flex gap-2 shrink-0">
                                  <button onClick={() => handleToggleSession(s.id, s.is_active)}
                                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${s.is_active ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-border bg-white hover:bg-gray-50"}`}>
                                    {s.is_active ? <><ZapOff className="h-3.5 w-3.5" /> Deactivate</> : <><Zap className="h-3.5 w-3.5" /> Activate</>}
                                  </button>
                                  <button onClick={() => handleDeleteSession(s.id)} className="rounded-lg border border-border bg-white p-1.5 text-red-500 hover:bg-red-50 transition-all">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* New session form */}
                        <div className="rounded-xl border border-dashed border-border bg-muted/10 p-4">
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">New Session</p>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Session Name</label>
                              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Morning Arrival" className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm" />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Start Time</label>
                              <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm" />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-muted-foreground">End Time</label>
                              <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm" />
                            </div>
                          </div>
                          <button onClick={handleCreateSession} disabled={saveSess || !newName.trim()} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 shadow-sm transition-all">
                            <Plus className="h-4 w-4" /> Add Session
                          </button>
                        </div>
                      </Collapse>

                      {/* Danger Zone */}
                      <Collapse title="Danger Zone" icon={AlertTriangle} danger>
                        <p className="text-sm text-muted-foreground mb-5">These actions affect the <b>physical FK623 device</b> directly and <b>cannot be undone</b>. Use with caution.</p>
                        <div className="grid gap-4 sm:grid-cols-3">
                          {[
                            { title: "Reset / Reboot Device", desc: "Reboots the FK623. It will reconnect automatically within 30â€“60 seconds.", action: handleReboot, label: "Reset Device", icon: RotateCcw, color: "border-amber-200 bg-amber-50" as const, btnColor: "border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200" as const },
                            { title: "Clear Device Logs",     desc: "Deletes all attendance logs stored on the FK623. Records already pulled to the server are not affected.", action: handleClearLogs, label: "Clear Logs", icon: HardDrive, color: "border-red-200 bg-red-50" as const, btnColor: "border-red-300 bg-red-100 text-red-800 hover:bg-red-200" as const },
                            { title: "Delete All Users",      desc: "Removes every enrolled user and their biometric data. You must re-push students to restore access.", action: handleClearUsers, label: "Delete All Users", icon: Users, color: "border-red-300 bg-red-50" as const, btnColor: "border-red-400 bg-red-100 text-red-900 hover:bg-red-200" as const },
                          ].map(({ title, desc, action, label, icon: Icon, color, btnColor }) => (
                            <div key={title} className={`rounded-xl border p-4 space-y-3 ${color}`}>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-red-600 shrink-0" />
                                <p className="text-sm font-semibold text-foreground">{title}</p>
                              </div>
                              <p className="text-xs text-muted-foreground">{desc}</p>
                              <button onClick={action} disabled={connTier === "offline"} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 transition-all ${btnColor}`}>
                                <Icon className="h-3.5 w-3.5" /> {label}
                              </button>
                            </div>
                          ))}
                        </div>
                      </Collapse>
                    </>
                  )}

                  {/* â•â•â•â• PUSH / REMOVE â•â•â•â• */}
                  {activeTab === "push" && (
                    <>
                      <Card>
                        <CardHeader title="Push Students to Device" subtitle="Send student records to the FK623 biometric device" icon={Upload} />
                        <div className="px-5 py-5">
                          <p className="text-sm text-muted-foreground mb-4">Students are pushed to the device so they can scan in using their fingerprint or face. All options below use your school's real data.</p>
                          <div className="flex flex-wrap items-end gap-3">
                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Push Mode</label>
                              <select value={pushMode} onChange={e => { setPushMode(e.target.value as any); setPushClassId(""); setPushSectionId(""); }} className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm">
                                <option value="all">All active students</option>
                                <option value="boarding">Boarding students only</option>
                                <option value="day">Day students only</option>
                                <option value="class">By class</option>
                                <option value="section">By section</option>
                              </select>
                            </div>
                            {(pushMode === "class" || pushMode === "section") && (
                              <div>
                                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Class</label>
                                <select value={pushClassId} onChange={e => { setPushClassId(e.target.value); setPushSectionId(""); }} className="h-10 min-w-40 rounded-lg border border-input bg-background px-3 text-sm shadow-sm">
                                  <option value="">All classes</option>
                                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                              </div>
                            )}
                            {pushMode === "section" && (
                              <div>
                                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Section</label>
                                <select value={pushSectionId} onChange={e => setPushSectionId(e.target.value)} className="h-10 min-w-44 rounded-lg border border-input bg-background px-3 text-sm shadow-sm">
                                  <option value="">Select section</option>
                                  {filteredSections.map(s => <option key={s.id} value={s.id}>{s.full_name || s.name}</option>)}
                                </select>
                              </div>
                            )}
                            <button onClick={handlePushStudents} disabled={pushing || (pushMode === "section" && !pushSectionId)}
                              className="h-10 inline-flex items-center gap-2 rounded-lg bg-primary text-white px-5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 shadow-sm transition-all">
                              {pushing ? <><RefreshCw className="h-4 w-4 animate-spin" /> Pushingâ€¦</> : <><Upload className="h-4 w-4" /> Push Students</>}
                            </button>
                          </div>
                          {!isOnline && <div className="mt-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"><AlertTriangle className="h-4 w-4 shrink-0" /> Device appears offline. The system will retry automatically for up to 5 minutes.</div>}
                        </div>
                      </Card>

                      <Card>
                        <CardHeader title="Remove Students from Device" subtitle="Remove student fingerprints from the FK623 (does not delete from school)" icon={X} />
                        <div className="px-5 py-5">
                          <p className="text-sm text-muted-foreground mb-4">This removes student records and biometric data <b>from the physical device only</b>. Students remain in the school system and can be re-pushed at any time.</p>
                          <div className="flex flex-wrap items-end gap-3">
                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Remove</label>
                              <select value={removeMode} onChange={e => { setRemoveMode(e.target.value as any); setRmClassId(""); }} className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm">
                                <option value="all">All students</option>
                                <option value="class">By class</option>
                              </select>
                            </div>
                            {removeMode === "class" && (
                              <div>
                                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Class</label>
                                <select value={rmClassId} onChange={e => setRmClassId(e.target.value)} className="h-10 min-w-40 rounded-lg border border-input bg-background px-3 text-sm shadow-sm">
                                  <option value="">Select class</option>
                                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                              </div>
                            )}
                            <button onClick={handleRemoveStudents} disabled={removing || (removeMode === "class" && !rmClassId)}
                              className="h-10 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 text-red-700 px-5 text-sm font-semibold hover:bg-red-100 disabled:opacity-50 shadow-sm transition-all">
                              {removing ? <><RefreshCw className="h-4 w-4 animate-spin" /> Removingâ€¦</> : <><Trash2 className="h-4 w-4" /> Remove Students</>}
                            </button>
                          </div>
                        </div>
                      </Card>
                    </>
                  )}

                  {/* â•â•â•â• ENROLLED USERS â•â•â•â• */}
                  {activeTab === "users" && (
                    <Card>
                      <CardHeader
                        title="Enrolled Users on Device"
                        subtitle={deviceUsers.length > 0 ? `${filteredUsers.length} of ${deviceUsers.length} users shown` : "Fetch live user list from the FK623 device"}
                        icon={Users}
                        badge={deviceUsers.length > 0 ? <span className="rounded-full bg-blue-100 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700">{deviceUsers.length}</span> : undefined}
                        action={
                          <button onClick={handleGetUsers} disabled={usersLoading || !isOnline}
                            className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 shadow-sm transition-all">
                            <RefreshCw className={`h-3.5 w-3.5 ${usersLoading ? "animate-spin" : ""}`} />
                            {usersLoading ? "Loadingâ€¦" : "Fetch from Device"}
                          </button>
                        }
                      />

                      {/* Search + method filter */}
                      {deviceUsers.length > 0 && (
                        <div className="px-5 py-3 border-b border-border flex flex-wrap gap-2 items-end bg-muted/10">
                          <div className="relative flex-1 min-w-52">
                            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search by name or device user IDâ€¦" className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-xs shadow-sm" />
                          </div>
                          {userMethods.length > 0 && (
                            <select value={userMethodFil} onChange={e => setUserMethodFil(e.target.value)} className="h-8 rounded-lg border border-input bg-background px-2 text-xs shadow-sm">
                              <option value="">All Biometric Methods</option>
                              {userMethods.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                          )}
                          {(userSearch || userMethodFil) && (
                            <button onClick={() => { setUserSearch(""); setUserMethodFil(""); }} className="h-8 inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 text-xs text-muted-foreground hover:bg-gray-50">
                              <X className="h-3 w-3" /> Clear
                            </button>
                          )}
                        </div>
                      )}

                      {usersLoading ? (
                        <div className="p-5 space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
                      ) : deviceUsers.length === 0 ? (
                        <div className="px-5 py-12 text-center">
                          <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
                          <p className="font-medium text-muted-foreground">No users loaded yet</p>
                          <p className="text-xs text-muted-foreground/70 mt-1">Click "Fetch from Device" above to load the enrolled user list from the FK623</p>
                        </div>
                      ) : (
                        <>
                          {filteredUsers.length === 0 && (userSearch || userMethodFil) && (
                            <p className="px-5 py-3 text-sm text-muted-foreground italic">No users match the current filters.</p>
                          )}
                          <div className="divide-y divide-border">
                            {filteredUsers.map(u => {
                              const uid = u.userId ?? u.id ?? "?";
                              return (
                                <div key={uid} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                                  <Avatar name={u.name || uid} size="sm" />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm">{u.name || "â€”"}</div>
                                    <div className="text-xs text-muted-foreground font-mono">Device ID: {uid}</div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {(u.biometricMethods ?? []).map((m: string) => (
                                      <span key={m} className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-700 capitalize">{m}</span>
                                    ))}
                                    {u.enabled === false && <span className="rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-500">Disabled</span>}
                                    <button onClick={() => handleDeleteUser(uid)} className="rounded-lg border border-red-200 p-1.5 text-red-500 hover:bg-red-50 hover:border-red-300 transition-all" title="Remove from device">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="px-5 py-2 border-t border-border bg-muted/10 text-xs text-muted-foreground">
                            Showing {filteredUsers.length} of {deviceUsers.length} enrolled users
                          </div>
                        </>
                      )}
                    </Card>
                  )}

                  {/* â•â•â•â• ATTENDANCE SCANS â•â•â•â• */}
                  {activeTab === "scans" && (
                    <Card>
                      <div className="px-5 py-4 border-b border-border">
                        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                          <div>
                            <h3 className="font-semibold text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Attendance Scans â€” {selected.name}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">Filter and view scan records from this device</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <input type="date" value={logsDate} onChange={e => { setLogsDate(e.target.value); setLogsPage(1); }} className="h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm" />
                            <button onClick={() => void loadLogs()} disabled={logsLoad || clientFiltLoading}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 shadow-sm">
                              <RefreshCw className={`h-3.5 w-3.5 ${logsLoad || clientFiltLoading ? "animate-spin" : ""}`} /> Reload
                            </button>
                            {logs.length > 0 && (
                              <button onClick={handleExportScans} disabled={exporting}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 text-green-700 px-3 py-1.5 text-xs font-semibold hover:bg-green-100 disabled:opacity-50 shadow-sm">
                                <FileSpreadsheet className="h-3.5 w-3.5" /> Export
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Filter row 1 */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          <div className="relative flex-1 min-w-52">
                            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <input value={fSearch} onChange={e => setFSearch(e.target.value)} placeholder="Search name Â· student ID Â· device user IDâ€¦" className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-xs shadow-sm" />
                          </div>
                          {[
                            { val: fStatus, set: setFStatus, opts: [["","All Statuses"],["present","Present"],["late","Late"],["absent","Absent"]] },
                            { val: fMethod, set: setFMethod, opts: [["","All Methods"],["fingerprint","Fingerprint"],["face","Face"],["nfc","NFC/RFID"],["qr","QR Code"],["manual","Manual"]] },
                            { val: fDirection, set: setFDirection, opts: [["","All Directions"],["in","Entry (In)"],["out","Exit (Out)"]] },
                          ].map(({ val, set, opts }, idx) => (
                            <select key={idx} value={val} onChange={e => { set(e.target.value); setLogsPage(1); }} className="h-8 rounded-lg border border-input bg-background px-2 text-xs shadow-sm">
                              {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                          ))}
                        </div>

                        {/* Filter row 2 */}
                        <div className="flex flex-wrap gap-2 items-end">
                          <Sel label="Class" value={fClass} onChange={v => { setFClass(v); setLogsPage(1); }}>
                            <option value="">All Classes</option>
                            {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            {logClassNames.filter(n => !classes.some(c => c.name === n)).map(n => <option key={n} value={n}>{n}</option>)}
                          </Sel>
                          <Sel label="Section" value={fSection} onChange={v => { setFSection(v); setLogsPage(1); }}>
                            <option value="">All Sections</option>
                            {sections.filter(s => !fClass || s.full_name.startsWith(fClass)).map(s => <option key={s.id} value={s.full_name}>{s.full_name}</option>)}
                            {logSectionNames.filter(n => !sections.some(s => s.full_name === n)).map(n => <option key={n} value={n}>{n}</option>)}
                          </Sel>
                          <Sel label="Session" value={fSession} onChange={v => { setFSession(v); setLogsPage(1); }}>
                            <option value="">All Sessions</option>
                            {sessionNames.map(n => <option key={n} value={n}>{n}</option>)}
                          </Sel>
                          <Sel label="Student Type" value={fStudentType} onChange={v => { setFStudentType(v); setLogsPage(1); }}>
                            <option value="">All Types</option>
                            <option value="boarding">Boarding</option>
                            <option value="day">Day</option>
                          </Sel>
                          <Sel label="Gender" value={fGender} onChange={v => { setFGender(v); setLogsPage(1); }}>
                            <option value="">Boys & Girls</option>
                            <option value="male">Boys only</option>
                            <option value="female">Girls only</option>
                          </Sel>
                          {dormitories.length > 0 && (
                            <Sel label="Dormitory" value={fDormitory} onChange={v => { setFDormitory(v); setLogsPage(1); }}>
                              <option value="">All Dormitories</option>
                              {dormitories.map(d => <option key={d.id} value={d.id}>{d.name}{d.block_name ? ` â€” ${d.block_name}` : ""}</option>)}
                            </Sel>
                          )}
                          {anyFilter && (
                            <button onClick={clearAllFilters} className="h-8 inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 text-xs text-muted-foreground hover:bg-gray-50 shadow-sm self-end">
                              <X className="h-3 w-3" /> Clear All
                            </button>
                          )}
                        </div>

                        {anyClientFilter && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-primary bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                            <Filter className="h-3.5 w-3.5 shrink-0" />
                            <span>Filtering by student attributes â€” matching {clientStudentIds?.size ?? "â€¦"} student(s) from school database</span>
                            {clientFiltLoading && <RefreshCw className="h-3 w-3 animate-spin ml-auto" />}
                          </div>
                        )}

                        {/* Stats row */}
                        {!logsLoad && logs.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-4 text-xs">
                            {[
                              { label: "Total",   val: logsMeta.total,    cls: "text-foreground font-bold" },
                              { label: "Present", val: logsStats.present, cls: "text-green-600 font-semibold" },
                              { label: "Late",    val: logsStats.late,    cls: "text-amber-600 font-semibold" },
                              { label: "Absent",  val: logsStats.absent,  cls: "text-red-600 font-semibold" },
                              { label: "Entries", val: logsStats.entries, cls: "text-gray-600" },
                              { label: "Exits",   val: logsStats.exits,   cls: "text-gray-600" },
                              { label: "Unique",  val: logsStats.unique,  cls: "text-blue-600 font-semibold" },
                            ].map(({ label, val, cls }) => (
                              <span key={label} className={cls}>{val} <span className="font-normal text-muted-foreground">{label}</span></span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Table */}
                      {logsLoad || clientFiltLoading ? (
                        <div className="p-5 space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                      ) : logs.length === 0 ? (
                        <div className="py-14 text-center">
                          <BarChart3 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
                          <p className="font-medium text-muted-foreground">No scans found</p>
                          <p className="text-xs text-muted-foreground/70 mt-1">No attendance scans for {selected.name} on {logsDate}{anyFilter ? " â€” try clearing filters" : ""}</p>
                        </div>
                      ) : (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/30 border-b border-border">
                                <tr>
                                  {["#","Student","Student ID","Class","Section","Session","Time","Method","Direction","Status"].map(h => (
                                    <th key={h} className="px-4 py-3 text-left whitespace-nowrap text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {logs.map((log, i) => {
                                  const l = log as any;
                                  const sess = l.sessionName ?? l.attendance_period ?? null;
                                  return (
                                    <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                                      <td className="px-4 py-3 text-muted-foreground text-xs">{(logsPage-1)*LOGS_PER_PAGE+i+1}</td>
                                      <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                          <Avatar name={log.studentName || log.studentId || "?"} size="sm" />
                                          <span className="font-medium whitespace-nowrap">{log.studentName || log.studentId || "Unknown"}</span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{log.studentId}</td>
                                      <td className="px-4 py-3 text-xs">{l.className ?? "â€”"}</td>
                                      <td className="px-4 py-3 text-xs text-muted-foreground">{l.section ?? "â€”"}</td>
                                      <td className="px-4 py-3 text-xs">
                                        {sess ? <span className="rounded-full bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 text-[10px] font-semibold">{sess}</span> : <span className="text-muted-foreground">â€”</span>}
                                      </td>
                                      <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap">{fmtTime(log.timestamp)}</td>
                                      <td className="px-4 py-3 text-xs capitalize text-muted-foreground">{log.method ?? "â€”"}</td>
                                      <td className="px-4 py-3">
                                        {log.direction
                                          ? <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${log.direction === "In" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>{log.direction === "In" ? "Entry" : "Exit"}</span>
                                          : <span className="text-muted-foreground text-xs">â€”</span>
                                        }
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${statusPill(log.status ?? "")}`}>{log.status ?? "â€”"}</span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          {logsMeta.totalPages > 1 && (
                            <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/10">
                              <span className="text-xs text-muted-foreground">{(logsPage-1)*LOGS_PER_PAGE+1}â€“{Math.min(logsPage*LOGS_PER_PAGE, logsMeta.total)} of {logsMeta.total}</span>
                              <div className="flex gap-2 items-center">
                                <button onClick={() => setLogsPage(p => p-1)} disabled={logsPage<=1} className="rounded-lg border border-border bg-white px-3 py-1 text-xs disabled:opacity-40 hover:bg-gray-50 shadow-sm">Previous</button>
                                <span className="text-xs text-muted-foreground font-medium">{logsPage} / {logsMeta.totalPages}</span>
                                <button onClick={() => setLogsPage(p => p+1)} disabled={logsPage>=logsMeta.totalPages} className="rounded-lg border border-border bg-white px-3 py-1 text-xs disabled:opacity-40 hover:bg-gray-50 shadow-sm">Next</button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </Card>
                  )}

                  {/* â•â•â•â• REPORTS & EXPORT â•â•â•â• */}
                  {activeTab === "reports" && (
                    <div className="space-y-4">
                      {/* Quick stats */}
                      {logs.length > 0 && (
                        <Card>
                          <CardHeader title="Attendance Summary" subtitle={`${selected.name} â€” ${logsDate} â€” ${logs.length} records loaded`} icon={BarChart3} />
                          <div className="px-5 py-5">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                              {[
                                { label: "Total Scans",     val: logsStats.total,   color: "bg-blue-50   border-blue-200   text-blue-800"   },
                                { label: "Present",         val: logsStats.present, color: "bg-green-50  border-green-200  text-green-800"  },
                                { label: "Late",            val: logsStats.late,    color: "bg-amber-50  border-amber-200  text-amber-800"  },
                                { label: "Absent",          val: logsStats.absent,  color: "bg-red-50    border-red-200    text-red-800"    },
                                { label: "Unique Students", val: logsStats.unique,  color: "bg-violet-50 border-violet-200 text-violet-800" },
                                { label: "Entries",         val: logsStats.entries, color: "bg-emerald-50 border-emerald-200 text-emerald-800" },
                                { label: "Exits",           val: logsStats.exits,   color: "bg-orange-50 border-orange-200 text-orange-800" },
                              ].map(({ label, val, color }) => (
                                <div key={label} className={`rounded-xl border p-4 text-center ${color}`}>
                                  <div className="text-2xl font-bold">{val}</div>
                                  <div className="text-xs font-medium mt-0.5 opacity-80">{label}</div>
                                </div>
                              ))}
                            </div>
                            {Object.keys(logsStats.byMethod).length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">By Scan Method</p>
                                <div className="flex flex-wrap gap-2">
                                  {Object.entries(logsStats.byMethod).map(([m, count]) => (
                                    <span key={m} className="rounded-full bg-gray-100 border border-gray-200 px-3 py-1.5 text-xs font-medium capitalize text-gray-700">{m}: <b className="text-foreground">{count}</b></span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </Card>
                      )}

                      {/* Export options */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        {/* This device */}
                        <Card>
                          <CardHeader title="Export This Device's Scans" subtitle="Current filters applied" icon={FileSpreadsheet} />
                          <div className="px-5 py-5 space-y-3">
                            <p className="text-sm text-muted-foreground">Export attendance scans for <b>{selected.name}</b> for the date loaded in the Scans tab, with all active filters applied.</p>
                            <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${logs.length > 0 ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                              {logs.length > 0 ? `âœ“ ${logs.length} records ready to export` : "âš  Load data in the Scans tab first"}
                            </div>
                            <button onClick={handleExportScans} disabled={exporting || logs.length === 0}
                              className="inline-flex items-center gap-2 rounded-lg bg-green-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-green-700 disabled:opacity-50 shadow-sm transition-all">
                              {exporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                              {exporting ? "Exportingâ€¦" : "Export Scans (.xlsx)"}
                            </button>
                          </div>
                        </Card>

                        {/* All devices */}
                        <Card>
                          <CardHeader title="All Devices Daily Summary" subtitle={`${devices.length} device(s) in this school`} icon={FileSpreadsheet} />
                          <div className="px-5 py-5 space-y-3">
                            <p className="text-sm text-muted-foreground">Export attendance scans from <b>all {devices.length} device(s)</b> for a selected date into one combined Excel file.</p>
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Report Date</label>
                              <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm" />
                            </div>
                            <button onClick={handleExportAllDevices} disabled={exporting}
                              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 shadow-sm transition-all">
                              {exporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                              {exporting ? "Exportingâ€¦" : "Export All Devices (.xlsx)"}
                            </button>
                          </div>
                        </Card>
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
