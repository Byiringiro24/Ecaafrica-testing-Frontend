/**
 * Device Management — unified page.
 *
 * The user selects ONE device from their school's device list.
 * All operations (push, pull logs, status, attendance) apply to that device.
 *
 * API endpoints used:
 *   GET  /devices                       — list school devices
 *   GET  /devices/:id/status            — real-time bridge+FK623 status
 *   POST /devices/:id/push-students     — push students to FK623
 *   GET  /devices/:id/users (via tablet API) — enrolled users on device
 *   POST /tablets/:id/device/pull-logs  — pull FK623 logs into DB
 *   POST /tablets/:id/device/sync-time  — sync FK623 clock
 *   GET  /attendance/records/device-logs — attendance logs (filtered by device)
 *   GET  /classes + /sections           — for push filter dropdowns
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshCw, Wifi, WifiOff, Upload, Download,
  Clock, Users, Activity, ChevronDown, ChevronUp,
  Fingerprint, Smile, CreditCard, HardDrive,
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { deviceApi, type Device } from "@/lib/deviceApi";
import { tabletApi } from "@/lib/tabletApi";
import { fetchDeviceLogs } from "@/lib/device-logs-api";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Avatar } from "@/components/ui-kit/Avatar";
import { Skeleton } from "@/components/ui/skeleton";

type ClassRecord  = { id: string; name: string };
type SectionRecord = { id: string; name: string; full_name: string; class_id: string };
type DeviceLog    = { id: string; studentName: string; studentId: string; timestamp: string; method: string; status: string; direction: string; className?: string | null };

const formatTime = (ts?: string | null) => {
  if (!ts) return "—";
  const d = new Date(ts);
  return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatDate = (ts?: string | null) => {
  if (!ts) return "—";
  const d = new Date(ts);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString([], { dateStyle: "short", timeStyle: "short" });
};

const statusColor = (s: string) => {
  const lower = s.toLowerCase();
  if (lower.includes("present") || lower.includes("on time")) return "text-success";
  if (lower.includes("late")) return "text-amber-600";
  if (lower.includes("absent")) return "text-destructive";
  return "text-muted-foreground";
};

export default function DeviceManagement() {
  // ── Device list ───────────────────────────────────────────────────────────
  const [devices, setDevices]           = useState<Device[]>([]);
  const [selectedId, setSelectedId]     = useState<string>("");
  const [devicesLoading, setDevicesLoading] = useState(true);

  // ── Status ────────────────────────────────────────────────────────────────
  const [status, setStatus]             = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const statusInFlight                  = useRef(false);

  // ── Push students ─────────────────────────────────────────────────────────
  const [pushMode, setPushMode]         = useState<"all" | "class" | "section">("all");
  const [pushClassId, setPushClassId]   = useState("");
  const [pushSectionId, setPushSectionId] = useState("");
  const [pushing, setPushing]           = useState(false);
  const [classes, setClasses]           = useState<ClassRecord[]>([]);
  const [sections, setSections]         = useState<SectionRecord[]>([]);
  const [showPushPanel, setShowPushPanel] = useState(false);

  // ── Users on device ───────────────────────────────────────────────────────
  const [deviceUsers, setDeviceUsers]   = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showUsers, setShowUsers]       = useState(false);

  // ── Attendance logs ───────────────────────────────────────────────────────
  const [logs, setLogs]                 = useState<DeviceLog[]>([]);
  const [logsLoading, setLogsLoading]   = useState(false);
  const [logsDate, setLogsDate]         = useState(() => new Date().toISOString().slice(0, 10));
  const [logsPage, setLogsPage]         = useState(1);
  const [logsMeta, setLogsMeta]         = useState<{ total: number; totalPages: number }>({ total: 0, totalPages: 1 });
  const LOGS_PER_PAGE = 20;

  // ── Load devices ──────────────────────────────────────────────────────────
  const loadDevices = useCallback(async () => {
    setDevicesLoading(true);
    try {
      const res = await deviceApi.getAll({ limit: 200 });
      const list = res.data ?? [];
      setDevices(list);
      if (list.length && !selectedId) setSelectedId(list[0].id);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load devices");
    } finally {
      setDevicesLoading(false);
    }
  }, [selectedId]);

  // ── Load status for selected device ──────────────────────────────────────
  const loadStatus = useCallback(async (silent = false) => {
    if (!selectedId || statusInFlight.current) return;
    statusInFlight.current = true;
    if (!silent) setStatusLoading(true);
    try {
      const res = await deviceApi.getStatus(selectedId);
      setStatus(res);
      // Update inline status badge in device list
      setDevices(prev => prev.map(d =>
        d.id === selectedId ? { ...d, is_online: res?.is_online ?? false, is_connected: res?.is_connected ?? false } : d
      ));
    } catch (e: any) {
      setStatus({ is_online: false, is_connected: false, status: "offline" });
    } finally {
      statusInFlight.current = false;
      if (!silent) setStatusLoading(false);
    }
  }, [selectedId]);

  // ── Load class/section lists for push filter ──────────────────────────────
  useEffect(() => {
    Promise.all([
      apiRequest<any[]>("/classes?limit=200", { auth: "school" }),
      apiRequest<any[]>("/sections?limit=500", { auth: "school" }),
    ]).then(([cl, se]) => {
      setClasses(Array.isArray(cl) ? cl : []);
      setSections(Array.isArray(se) ? se : []);
    }).catch(() => {});
  }, []);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => { void loadDevices(); }, []);

  // ── Status polling — every 15s ────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId) return;
    void loadStatus();
    const iv = setInterval(() => void loadStatus(true), 15_000);
    return () => clearInterval(iv);
  }, [selectedId, loadStatus]);

  // ── Load attendance logs when device or date changes ─────────────────────
  const loadLogs = useCallback(async () => {
    if (!selectedId) return;
    setLogsLoading(true);
    try {
      const res = await fetchDeviceLogs({
        deviceId: selectedId,
        startDate: logsDate,
        endDate:   logsDate,
        page:  logsPage,
        limit: LOGS_PER_PAGE,
      });
      setLogs(res.data as any[]);
      setLogsMeta({ total: res.meta.total, totalPages: res.meta.totalPages });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load attendance logs");
    } finally {
      setLogsLoading(false);
    }
  }, [selectedId, logsDate, logsPage]);

  useEffect(() => { void loadLogs(); }, [loadLogs]);

  // ── Push students ─────────────────────────────────────────────────────────
  const handlePushStudents = async () => {
    if (!selectedId) return;
    setPushing(true);
    try {
      const payload: any = { mode: pushMode };
      if (pushMode === "class"   && pushClassId)   payload.class_id   = pushClassId;
      if (pushMode === "section" && pushSectionId) payload.section_id = pushSectionId;
      const res = await deviceApi.pushStudents(selectedId, payload);
      toast.success(`Pushed ${res.pushed_count} student(s) to device`);
      void loadStatus();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to push students");
    } finally {
      setPushing(false);
    }
  };

  // ── Pull logs ─────────────────────────────────────────────────────────────
  const handlePullLogs = async () => {
    const device = devices.find(d => d.id === selectedId);
    if (!device?.tablet_id) { toast.error("Device is not linked to a tablet — cannot pull logs directly"); return; }
    try {
      const res = await tabletApi.pullLogs({ tabletId: device.tablet_id, readMark: 0 });
      toast.success(`Pulled ${res.data?.savedCount ?? 0} log(s) (${res.data?.duplicateCount ?? 0} duplicates)`);
      void loadLogs();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to pull logs");
    }
  };

  // ── Sync time ─────────────────────────────────────────────────────────────
  const handleSyncTime = async () => {
    const device = devices.find(d => d.id === selectedId);
    if (!device?.tablet_id) { toast.error("Device is not linked to a tablet"); return; }
    try {
      await tabletApi.syncTime(device.tablet_id);
      toast.success("Device time synced");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to sync time");
    }
  };

  // ── Get enrolled users ────────────────────────────────────────────────────
  const handleGetUsers = async () => {
    const device = devices.find(d => d.id === selectedId);
    if (!device?.tablet_id) { toast.error("Device is not linked to a tablet"); return; }
    setUsersLoading(true);
    setShowUsers(true);
    try {
      const res = await tabletApi.getUsers(device.tablet_id);
      setDeviceUsers(res.data?.users ?? []);
      toast.success(`Fetched ${res.data?.count ?? 0} enrolled user(s)`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to get users");
    } finally {
      setUsersLoading(false);
    }
  };

  const selected = devices.find(d => d.id === selectedId);
  const isOnline = status?.is_online || status?.is_connected || false;
  const filteredSections = sections.filter(s => !pushClassId || s.class_id === pushClassId);

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Device Management</h1>
          <p className="text-sm text-muted-foreground">Manage biometric devices, push students, pull logs and view attendance</p>
        </div>
        <button onClick={() => void loadDevices()} disabled={devicesLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${devicesLoading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {devicesLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : devices.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
          No biometric devices registered for this school.
          Contact the platform administrator to register devices.
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
          {/* ── LEFT: Device selector ── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">Select Device</p>
            {devices.map(device => {
              const online = device.is_online || device.is_connected;
              const active = device.id === selectedId;
              return (
                <button key={device.id} onClick={() => setSelectedId(device.id)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    active ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/40"
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${online ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
                    <span className="font-semibold text-sm truncate">{device.name}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {device.location || "No location"} · {device.mode}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground font-mono">{device.device_uid}</div>
                  {device.last_sync_error && (
                    <div className="mt-1 text-xs text-destructive truncate">{device.last_sync_error}</div>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── RIGHT: Selected device panel ── */}
          {selected && (
            <div className="space-y-5">
              {/* Status bar */}
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    {statusLoading
                      ? <span className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      : <span className={`h-3 w-3 rounded-full ${isOnline ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
                    }
                    <div>
                      <h2 className="font-bold">{selected.name}</h2>
                      <p className="text-xs text-muted-foreground">
                        {isOnline ? "Bridge online" : "Bridge offline"} ·{" "}
                        {status?.device_status?.connected === true ? "FK623 connected" : "FK623 status unknown"} ·{" "}
                        {selected.location || "No location"}
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

                {/* Live metrics */}
                {status?.device_status && (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                      { icon: Users,       label: "Users",        value: status.device_status.users ?? 0 },
                      { icon: Fingerprint, label: "Fingerprints", value: status.device_status.fingerprints ?? 0 },
                      { icon: Smile,       label: "Faces",        value: status.device_status.faces ?? 0 },
                      { icon: CreditCard,  label: "Cards",        value: status.device_status.cards ?? 0 },
                      { icon: HardDrive,   label: "Logs",         value: status.device_status.logs ?? 0 },
                      { icon: Activity,    label: "Serial",       value: status.device_status.serialNumber ?? "—" },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="rounded-lg border border-border bg-muted/20 p-3 text-center">
                        <Icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                        <div className="text-sm font-bold">{value}</div>
                        <div className="text-[10px] text-muted-foreground">{label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Last sync */}
                {selected.last_sync_at && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Last sync: {formatDate(selected.last_sync_at)} · Status: {selected.last_sync_status ?? "—"}
                  </p>
                )}
                {selected.last_sync_error && (
                  <p className="mt-1 text-xs text-destructive">{selected.last_sync_error}</p>
                )}
              </div>

              {/* ── Push Students panel ── */}
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <button onClick={() => setShowPushPanel(p => !p)}
                  className="flex w-full items-center justify-between px-5 py-4 font-semibold hover:bg-muted/30">
                  <span className="flex items-center gap-2"><Upload className="h-4 w-4" /> Push Students to Device</span>
                  {showPushPanel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showPushPanel && (
                  <div className="border-t border-border px-5 py-4 space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Pushes student records to the FK623 biometric device so students can scan.
                      The device must be online and reachable.
                    </p>
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">Mode</label>
                        <select value={pushMode} onChange={e => { setPushMode(e.target.value as any); setPushClassId(""); setPushSectionId(""); }}
                          className="mt-1 block h-9 rounded-md border border-input bg-background px-3 text-sm">
                          <option value="all">All active students</option>
                          <option value="class">By class</option>
                          <option value="section">By section (class + stream)</option>
                        </select>
                      </div>
                      {pushMode === "class" && (
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground">Class</label>
                          <select value={pushClassId} onChange={e => setPushClassId(e.target.value)}
                            className="mt-1 block h-9 min-w-36 rounded-md border border-input bg-background px-3 text-sm">
                            <option value="">Select class</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      )}
                      {pushMode === "section" && (
                        <>
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground">Class</label>
                            <select value={pushClassId} onChange={e => { setPushClassId(e.target.value); setPushSectionId(""); }}
                              className="mt-1 block h-9 min-w-32 rounded-md border border-input bg-background px-3 text-sm">
                              <option value="">All classes</option>
                              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground">Section</label>
                            <select value={pushSectionId} onChange={e => setPushSectionId(e.target.value)}
                              className="mt-1 block h-9 min-w-36 rounded-md border border-input bg-background px-3 text-sm">
                              <option value="">Select section</option>
                              {filteredSections.map(s => <option key={s.id} value={s.id}>{s.full_name || s.name}</option>)}
                            </select>
                          </div>
                        </>
                      )}
                      <button onClick={handlePushStudents}
                        disabled={pushing || !isOnline ||
                          (pushMode === "class"   && !pushClassId) ||
                          (pushMode === "section" && !pushSectionId)}
                        className="h-9 inline-flex items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                        {pushing
                          ? <><span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> Pushing…</>
                          : <><Upload className="h-3.5 w-3.5" /> Push Students</>
                        }
                      </button>
                    </div>
                    {!isOnline && (
                      <p className="text-xs text-amber-600">⚠️ Device appears offline. Ensure the tablet bridge is running and WireGuard VPN is connected before pushing.</p>
                    )}
                  </div>
                )}
              </div>

              {/* ── Enrolled users (on device) ── */}
              {showUsers && (
                <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <h3 className="font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Enrolled Users on Device</h3>
                    <button onClick={() => setShowUsers(false)} className="text-xs text-muted-foreground hover:text-foreground">Hide</button>
                  </div>
                  {usersLoading ? (
                    <div className="p-4 space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-4/5" /></div>
                  ) : deviceUsers.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-muted-foreground">No users found on device.</p>
                  ) : (
                    <div className="divide-y divide-border max-h-64 overflow-y-auto">
                      {deviceUsers.map(u => (
                        <div key={u.userId} className="flex items-center justify-between px-5 py-2.5 text-sm">
                          <div className="flex items-center gap-2">
                            <Avatar name={u.name || u.userId} size="sm" />
                            <div>
                              <div className="font-medium">{u.name || "—"}</div>
                              <div className="text-xs text-muted-foreground font-mono">ID: {u.userId}</div>
                            </div>
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            {(u.biometricMethods || []).map((m: string) => (
                              <span key={m} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">{m}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Attendance logs for this device ── */}
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border">
                  <h3 className="font-semibold flex items-center gap-2"><Activity className="h-4 w-4" /> Attendance Scans — {selected.name}</h3>
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
                            {["#", "Student", "Class", "Time", "Method", "Direction", "Status"].map(h => (
                              <th key={h} className="px-4 py-3 text-left">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {logs.map((log, i) => (
                            <tr key={log.id} className="border-t border-border hover:bg-muted/20">
                              <td className="px-4 py-2.5 text-muted-foreground">{(logsPage - 1) * LOGS_PER_PAGE + i + 1}</td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <Avatar name={log.studentName} size="sm" />
                                  <div>
                                    <div className="font-medium">{log.studentName}</div>
                                    <div className="text-xs text-muted-foreground font-mono">{log.studentId}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-xs">{(log as any).className ?? "—"}</td>
                              <td className="px-4 py-2.5 whitespace-nowrap">{formatTime(log.timestamp)}</td>
                              <td className="px-4 py-2.5 capitalize text-xs">{log.method}</td>
                              <td className="px-4 py-2.5">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  log.direction === "In" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                }`}>{log.direction}</span>
                              </td>
                              <td className={`px-4 py-2.5 capitalize text-xs font-medium ${statusColor(log.status)}`}>{log.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {logsMeta.totalPages > 1 && (
                      <div className="flex items-center justify-between px-5 py-3 border-t border-border text-sm">
                        <span className="text-muted-foreground">
                          {(logsPage - 1) * LOGS_PER_PAGE + 1}–{Math.min(logsPage * LOGS_PER_PAGE, logsMeta.total)} of {logsMeta.total}
                        </span>
                        <div className="flex gap-2">
                          <button onClick={() => setLogsPage(p => p - 1)} disabled={logsPage <= 1}
                            className="rounded-md border border-border px-3 py-1 disabled:opacity-50 hover:bg-muted">Previous</button>
                          <button onClick={() => setLogsPage(p => p + 1)} disabled={logsPage >= logsMeta.totalPages}
                            className="rounded-md border border-border px-3 py-1 disabled:opacity-50 hover:bg-muted">Next</button>
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
