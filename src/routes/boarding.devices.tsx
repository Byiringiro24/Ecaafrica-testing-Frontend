import { FormEvent, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  DownloadCloud,
  FileSpreadsheet,
  Globe2,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Network,
  Plus,
  Power,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  UploadCloud,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/boarding/devices")({
  component: ServerCommandCenter,
});

type TabId = "overview" | "monitor" | "students" | "devices" | "sessions" | "reports" | "settings";

type Stats = {
  totalStudents: number;
  attendanceToday: number;
  totalLogs: number;
  checkInCount: number;
  checkOutCount: number;
  fingerprintCount: number;
  faceCount: number;
  cardCount: number;
  passwordCount: number;
  onlineDevices: number;
  totalDevices: number;
};

type Device = {
  id: string;
  name: string;
  location?: string | null;
  status?: string;
  is_connected?: boolean;
  tablet_id?: string | null;
  tablet_ip?: string | null;
  tablet_port?: string | number | null;
  device_uid?: string;
  product_name?: string | null;
  product_code?: string | null;
  device_users_count?: number | null;
  device_logs_count?: number | null;
  last_sync_at?: string | null;
  last_sync_status?: string | null;
};

type Tablet = {
  id: string;
  name: string;
  ip: string;
  port: number;
  url?: string;
  location?: string | null;
  status: "online" | "offline" | "error" | "maintenance";
  last_health_check?: string | null;
};

type ClassRecord = {
  id: string;
  name: string;
  level_label?: string | null;
};

type Student = {
  id: string;
  first_name?: string;
  last_name?: string;
  student_id_number?: string | null;
  device_user_id?: string | null;
  device_sync_status?: string | null;
  last_device_sync?: string | null;
  student_type?: "boarding" | "day";
  current_section?: {
    id: string;
    name: string;
    full_name: string;
    class_id: string;
  } | null;
};

type AttendanceLog = {
  id: string;
  device_id?: string | null;
  student_id?: string | null;
  student_id_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  scan_method?: string;
  event_type?: string;
  scanned_at?: string | null;
  attendance_status?: string | null;
  status_label?: string | null;
  session_name?: string | null;
};

type DeviceSession = {
  id: string;
  name: string;
  windows: { id?: string; label: string; start_time: string; end_time: string }[];
};

type PushMode = "selected" | "class" | "all";

const emptyStats: Stats = {
  totalStudents: 0,
  attendanceToday: 0,
  totalLogs: 0,
  checkInCount: 0,
  checkOutCount: 0,
  fingerprintCount: 0,
  faceCount: 0,
  cardCount: 0,
  passwordCount: 0,
  onlineDevices: 0,
  totalDevices: 0,
};

const navItems: Array<{ id: TabId; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "monitor", label: "Live Monitor", icon: Activity },
  { id: "students", label: "Students", icon: Users },
  { id: "devices", label: "Devices", icon: Cpu },
  { id: "sessions", label: "Sessions", icon: Calendar },
  { id: "reports", label: "Reports", icon: FileSpreadsheet },
  { id: "settings", label: "Settings", icon: Settings },
];

const unwrapList = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  const anyPayload = payload as any;
  if (Array.isArray(anyPayload?.data)) return anyPayload.data;
  if (Array.isArray(anyPayload?.tablets)) return anyPayload.tablets;
  if (Array.isArray(anyPayload?.devices)) return anyPayload.devices;
  if (Array.isArray(anyPayload?.students)) return anyPayload.students;
  return [];
};

const studentName = (student: Student) =>
  `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim() || student.student_id_number || student.id;

const buildDeviceUserId = (student: Student) => {
  if (student.device_user_id) return student.device_user_id;
  const fromStudentNumber = student.student_id_number?.match(/\d+/g)?.join("");
  return fromStudentNumber || student.id;
};

function ServerCommandCenter() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [devices, setDevices] = useState<Device[]>([]);
  const [tablets, setTablets] = useState<Tablet[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [selectedTabletId, setSelectedTabletId] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [classId, setClassId] = useState("");
  const [pushMode, setPushMode] = useState<PushMode>("selected");
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [readMark, setReadMark] = useState(0);

  const [tabletForm, setTabletForm] = useState({ name: "Main Gate Tablet", ip: "", port: 5000, location: "" });
  const [deviceForm, setDeviceForm] = useState({ deviceId: "FK623-MAIN", ipAddress: "", port: 5005, license: 1261 });
  const [sessionForm, setSessionForm] = useState({
    name: "Morning",
    label: "Arrived on time",
    start_time: "07:00",
    end_time: "07:30",
  });

  const selectedDevice = devices.find((device) => device.id === selectedDeviceId) ?? devices[0];
  const selectedTablet = tablets.find((tablet) => tablet.id === selectedTabletId) ?? tablets[0];

  const filteredStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return students.filter((student) => {
      const inClass = !classId || student.current_section?.class_id === classId;
      const searchable = `${studentName(student)} ${student.student_id_number ?? ""} ${student.current_section?.full_name ?? ""}`.toLowerCase();
      return inClass && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [classId, query, students]);

  const methodData = useMemo(
    () =>
      [
        { name: "Fingerprint", value: stats.fingerprintCount, color: "#2563eb" },
        { name: "Face", value: stats.faceCount, color: "#059669" },
        { name: "Card", value: stats.cardCount, color: "#d97706" },
        { name: "Password", value: stats.passwordCount, color: "#7c3aed" },
      ].filter((item) => item.value > 0),
    [stats]
  );

  const dailyData = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days.map((day, index) => ({
      day,
      logs: logs.filter((log) => log.scanned_at && new Date(log.scanned_at).getDay() === index).length,
    }));
  }, [logs]);

  async function refreshAll() {
    setBusy(true);
    try {
      const [deviceData, tabletData, classData, studentData] = await Promise.all([
        apiRequest<Device[]>("/devices?limit=500&sort=created_at&order=desc", { auth: "school" }),
        apiRequest<{ data?: Tablet[] } | Tablet[]>("/tablets?limit=500", { auth: "school" }),
        apiRequest<ClassRecord[]>("/classes?limit=500", { auth: "school" }),
        apiRequest<Student[]>("/students?limit=5000&status=active", { auth: "school" }),
      ]);

      const nextDevices = unwrapList<Device>(deviceData);
      const nextTablets = unwrapList<Tablet>(tabletData);
      const nextClasses = unwrapList<ClassRecord>(classData);
      const nextStudents = unwrapList<Student>(studentData);
      setDevices(nextDevices);
      setTablets(nextTablets);
      setClasses(nextClasses);
      setStudents(nextStudents);
      setSelectedDeviceId((current) => current || nextDevices[0]?.id || "");
      setSelectedTabletId((current) => current || nextTablets[0]?.id || "");

      const currentDevice = nextDevices.find((device) => device.id === selectedDeviceId) ?? nextDevices[0];
      if (currentDevice) {
        const [statusResult, logsResult, sessionsResult] = await Promise.allSettled([
          apiRequest(`/devices/${currentDevice.id}/status`, { auth: "school" }),
          apiRequest<AttendanceLog[]>(`/devices/${currentDevice.id}/logs?limit=500`, { auth: "school" }),
          apiRequest<{ sessions?: DeviceSession[] }>(`/devices/${currentDevice.id}/sessions`, { auth: "school" }),
        ]);
        if (statusResult.status === "fulfilled") {
          setDevices((items) =>
            items.map((device) => (device.id === currentDevice.id ? { ...device, ...(statusResult.value as Device) } : device))
          );
        }
        if (logsResult.status === "fulfilled") setLogs(unwrapList<AttendanceLog>(logsResult.value));
        if (sessionsResult.status === "fulfilled") setSessions(sessionsResult.value.sessions ?? []);
      }

      const today = new Date().toISOString().slice(0, 10);
      const allLogs = logs.length ? logs : [];
      setStats({
        totalStudents: nextStudents.length,
        attendanceToday: allLogs.filter((log) => log.scanned_at?.startsWith(today)).length,
        totalLogs: allLogs.length,
        checkInCount: allLogs.filter((log) => log.event_type === "entry").length,
        checkOutCount: allLogs.filter((log) => log.event_type === "exit").length,
        fingerprintCount: allLogs.filter((log) => log.scan_method === "fingerprint").length,
        faceCount: allLogs.filter((log) => log.scan_method === "face").length,
        cardCount: allLogs.filter((log) => log.scan_method === "nfc").length,
        passwordCount: allLogs.filter((log) => log.scan_method === "manual").length,
        totalDevices: nextDevices.length,
        onlineDevices: nextDevices.filter((device) => device.status === "online" || device.is_connected).length,
      });
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load attendance devices");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refreshAll();
  }, []);

  useEffect(() => {
    if (selectedDeviceId) void loadDeviceDetails(selectedDeviceId);
  }, [selectedDeviceId]);

  async function loadDeviceDetails(deviceId: string) {
    try {
      const [logsResult, sessionsResult] = await Promise.allSettled([
        apiRequest<AttendanceLog[]>(`/devices/${deviceId}/logs?limit=500`, { auth: "school" }),
        apiRequest<{ sessions?: DeviceSession[] }>(`/devices/${deviceId}/sessions`, { auth: "school" }),
      ]);
      if (logsResult.status === "fulfilled") setLogs(unwrapList<AttendanceLog>(logsResult.value));
      if (sessionsResult.status === "fulfilled") setSessions(sessionsResult.value.sessions ?? []);
    } catch {
      // Background refresh only.
    }
  }

  async function registerTablet(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = {
        name: tabletForm.name,
        ip: tabletForm.ip,
        port: Number(tabletForm.port),
        location: tabletForm.location || undefined,
      };
      const response = await apiRequest<{ tablet: Tablet }>("/tablets", {
        method: "POST",
        auth: "school",
        body: JSON.stringify(payload),
      });
      toast.success("Tablet registered in PostgreSQL");
      setSelectedTabletId(response.tablet.id);
      await refreshAll();
    } catch (error: any) {
      toast.error(error?.message ?? "Tablet registration failed");
    } finally {
      setBusy(false);
    }
  }

  async function connectDevice(event: FormEvent) {
    event.preventDefault();
    if (!selectedTablet?.id) {
      toast.error("Register or select a tablet first");
      return;
    }
    setBusy(true);
    try {
      await apiRequest(`/tablets/${selectedTablet.id}/device/connect`, {
        method: "POST",
        auth: "school",
        body: JSON.stringify(deviceForm),
      });
      toast.success("Device connected through tablet");
      await refreshAll();
    } catch (error: any) {
      toast.error(error?.message ?? "Device connection failed");
    } finally {
      setBusy(false);
    }
  }

  async function disconnectDevice() {
    if (!selectedTablet?.id) return;
    setBusy(true);
    try {
      await apiRequest(`/tablets/${selectedTablet.id}/device/disconnect`, {
        method: "POST",
        auth: "school",
      });
      toast.success("Device disconnected");
      await refreshAll();
    } catch (error: any) {
      toast.error(error?.message ?? "Disconnect failed");
    } finally {
      setBusy(false);
    }
  }

  async function pullLogs() {
    if (!selectedTablet?.id) {
      toast.error("Select a tablet first");
      return;
    }
    setBusy(true);
    try {
      const result = await apiRequest<any>(`/tablets/${selectedTablet.id}/device/pull-logs`, {
        method: "POST",
        auth: "school",
        body: JSON.stringify({ readMark }),
      });
      const savedCount = result?.data?.savedCount ?? result?.savedCount ?? 0;
      toast.success(`Saved ${savedCount} log(s) to PostgreSQL`);
      await refreshAll();
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to pull logs");
    } finally {
      setBusy(false);
    }
  }

  async function syncTime() {
    if (!selectedTablet?.id) return;
    try {
      await apiRequest(`/tablets/${selectedTablet.id}/device/sync-time`, { method: "POST", auth: "school" });
      toast.success("Device time synced");
    } catch (error: any) {
      toast.error(error?.message ?? "Time sync failed");
    }
  }

  async function pushStudents() {
    if (!selectedDevice?.id) {
      toast.error("Select a device first");
      return;
    }
    const body =
      pushMode === "all"
        ? { mode: "all" }
        : pushMode === "class"
          ? { mode: "class", class_id: classId }
          : { mode: "selected", student_ids: Array.from(selectedStudentIds) };

    if (pushMode === "class" && !classId) {
      toast.error("Choose a class to push");
      return;
    }
    if (pushMode === "selected" && selectedStudentIds.size === 0) {
      toast.error("Choose at least one student");
      return;
    }

    setBusy(true);
    try {
      const result = await apiRequest<any>(`/devices/${selectedDevice.id}/push-students`, {
        method: "POST",
        auth: "school",
        body: JSON.stringify(body),
      });
      toast.success(`Pushed ${result.pushed_count ?? 0}/${result.selected_count ?? 0} student(s)`);
      setSelectedStudentIds(new Set());
      await refreshAll();
    } catch (error: any) {
      toast.error(error?.message ?? "Student push failed");
    } finally {
      setBusy(false);
    }
  }

  async function addSingleStudentToDevice(student: Student) {
    if (!selectedTablet?.id) {
      toast.error("Select a tablet first");
      return;
    }
    try {
      await apiRequest(`/tablets/${selectedTablet.id}/device/users`, {
        method: "POST",
        auth: "school",
        body: JSON.stringify({ userId: buildDeviceUserId(student), name: studentName(student) }),
      });
      toast.success(`${studentName(student)} pushed to device`);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to push student");
    }
  }

  async function createSession(event: FormEvent) {
    event.preventDefault();
    if (!selectedDevice?.id) return;
    setBusy(true);
    try {
      await apiRequest(`/devices/${selectedDevice.id}/sessions`, {
        method: "POST",
        auth: "school",
        body: JSON.stringify({
          name: sessionForm.name,
          windows: [{ label: sessionForm.label, start_time: sessionForm.start_time, end_time: sessionForm.end_time }],
        }),
      });
      toast.success("Attendance session saved");
      await loadDeviceDetails(selectedDevice.id);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to save session");
    } finally {
      setBusy(false);
    }
  }

  const connected = Boolean(selectedDevice?.is_connected || selectedDevice?.status === "online");

  return (
    <AppLayout title="Attendance Devices" subtitle="Configure tablets, biometric devices, sessions, and student pushes">
      <div className="space-y-6">
        <section className="dashboard-panel p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-700">
                <ShieldCheck size={16} /> PostgreSQL and Prisma command center
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">FK Biometric Attendance Console</h1>
              <p className="mt-1 text-sm text-slate-600">Manage live device commands and store attendance data in the existing backend database.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select value={selectedDeviceId} onChange={(event) => setSelectedDeviceId(event.target.value)} className="form-field max-w-xs">
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>{device.name}</option>
                ))}
              </select>
              <div className={cn("flex items-center gap-2 rounded-xl border px-4 py-3", connected ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50")}>
                {connected ? <Wifi size={16} className="text-emerald-700" /> : <WifiOff size={16} className="text-rose-700" />}
                <span className={cn("text-sm font-semibold", connected ? "text-emerald-700" : "text-rose-700")}>{connected ? "Device Online" : "Device Offline"}</span>
              </div>
              <button type="button" onClick={refreshAll} disabled={busy} className="primary-action">
                {busy ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />} Refresh
              </button>
            </div>
          </div>
        </section>

        <section className="dashboard-panel flex flex-wrap gap-2 p-3">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
                activeTab === item.id ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <item.icon size={16} /> {item.label}
            </button>
          ))}
        </section>

        {activeTab === "overview" && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Students" value={stats.totalStudents} icon={Users} tone="blue" />
              <MetricCard label="Today Logs" value={stats.attendanceToday} icon={CheckCircle2} tone="emerald" />
              <MetricCard label="Devices Online" value={`${stats.onlineDevices}/${stats.totalDevices}`} icon={Wifi} tone="cyan" />
              <MetricCard label="Stored Logs" value={stats.totalLogs} icon={Database} tone="violet" />
            </div>
            <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
              <Panel title="Attendance by Day" icon={BarChart3}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="day" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="logs" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
              <Panel title="Verification Methods" icon={KeyRound}>
                {methodData.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={methodData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95}>
                        {methodData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState text="Pull device logs to build method statistics." />
                )}
              </Panel>
            </div>
          </motion.section>
        )}

        {activeTab === "students" && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 xl:grid-cols-[0.9fr_1.4fr]">
            <Panel title="Push Target" icon={UploadCloud}>
              <div className="grid gap-3">
                <label className="grid gap-1 text-sm font-medium text-slate-600">
                  Push mode
                  <select value={pushMode} onChange={(event) => setPushMode(event.target.value as PushMode)} className="form-field">
                    <option value="selected">Selected students</option>
                    <option value="class">Whole class</option>
                    <option value="all">All active students</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-600">
                  Class
                  <select value={classId} onChange={(event) => setClassId(event.target.value)} className="form-field">
                    <option value="">All classes</option>
                    {classes.map((klass) => (
                      <option key={klass.id} value={klass.id}>{klass.level_label || klass.name}</option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={pushStudents} disabled={busy} className="primary-action">
                  <UploadCloud size={16} /> Push to selected device
                </button>
                <p className="text-xs text-slate-500">
                  Selected: {selectedStudentIds.size}. Filtered by class: {filteredStudents.length}.
                </p>
              </div>
            </Panel>
            <Panel
              title="Students"
              icon={Users}
              action={
                <div className="relative min-w-60">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} className="form-field pl-9" placeholder="Search students" />
                </div>
              }
            >
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={filteredStudents.length > 0 && filteredStudents.every((student) => selectedStudentIds.has(student.id))}
                          onChange={() => {
                            const allSelected = filteredStudents.every((student) => selectedStudentIds.has(student.id));
                            setSelectedStudentIds(allSelected ? new Set() : new Set(filteredStudents.map((student) => student.id)));
                          }}
                        />
                      </th>
                      <th>Student</th>
                      <th>Class</th>
                      <th>Device User</th>
                      <th>Sync</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student) => (
                      <tr key={student.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedStudentIds.has(student.id)}
                            onChange={() =>
                              setSelectedStudentIds((current) => {
                                const next = new Set(current);
                                if (next.has(student.id)) next.delete(student.id);
                                else next.add(student.id);
                                return next;
                              })
                            }
                          />
                        </td>
                        <td>
                          <div className="font-semibold text-slate-900">{studentName(student)}</div>
                          <div className="text-xs text-slate-500">{student.student_id_number ?? student.id}</div>
                        </td>
                        <td>{student.current_section?.full_name ?? "Unassigned"}</td>
                        <td className="font-mono">{buildDeviceUserId(student)}</td>
                        <td><StatusPill value={student.device_sync_status || "not synced"} /></td>
                        <td>
                          <button type="button" onClick={() => addSingleStudentToDevice(student)} className="secondary-action px-3 py-2">
                            <Plus size={14} /> Add one
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filteredStudents.length && <EmptyState text="No students match your filters." />}
              </div>
            </Panel>
          </motion.section>
        )}

        {activeTab === "devices" && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 xl:grid-cols-[0.9fr_1.2fr]">
            <div className="space-y-4">
              <Panel title="Register Tablet" icon={Network}>
                <form onSubmit={registerTablet} className="grid gap-3">
                  <Field label="Tablet Name" value={tabletForm.name} onChange={(value) => setTabletForm({ ...tabletForm, name: value })} required />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Tablet IP" value={tabletForm.ip} onChange={(value) => setTabletForm({ ...tabletForm, ip: value })} required />
                    <Field label="Tablet API Port" type="number" value={tabletForm.port} onChange={(value) => setTabletForm({ ...tabletForm, port: Number(value) })} required />
                  </div>
                  <Field label="Location" value={tabletForm.location} onChange={(value) => setTabletForm({ ...tabletForm, location: value })} />
                  <button disabled={busy} className="primary-action"><Globe2 size={16} /> Register Tablet</button>
                </form>
              </Panel>
              <Panel title="Connect FK623" icon={Cpu}>
                <form onSubmit={connectDevice} className="grid gap-3">
                  <select value={selectedTabletId} onChange={(event) => setSelectedTabletId(event.target.value)} className="form-field">
                    {tablets.map((tablet) => <option key={tablet.id} value={tablet.id}>{tablet.name} - {tablet.ip}:{tablet.port}</option>)}
                  </select>
                  <Field label="Device UID" value={deviceForm.deviceId} onChange={(value) => setDeviceForm({ ...deviceForm, deviceId: value })} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Device IP" value={deviceForm.ipAddress} onChange={(value) => setDeviceForm({ ...deviceForm, ipAddress: value })} />
                    <Field label="Device Port" type="number" value={deviceForm.port} onChange={(value) => setDeviceForm({ ...deviceForm, port: Number(value) })} />
                    <Field label="License" type="number" value={deviceForm.license} onChange={(value) => setDeviceForm({ ...deviceForm, license: Number(value) })} />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <button disabled={busy} className="primary-action"><Wifi size={16} /> Connect</button>
                    <button type="button" onClick={syncTime} className="secondary-action"><Clock size={16} /> Sync</button>
                    <button type="button" onClick={disconnectDevice} className="secondary-action text-rose-600"><Power size={16} /> Disconnect</button>
                  </div>
                </form>
              </Panel>
            </div>
            <Panel title="Device Fleet" icon={HardDrive}>
              <div className="space-y-3">
                {devices.map((device) => (
                  <button
                    key={device.id}
                    type="button"
                    onClick={() => setSelectedDeviceId(device.id)}
                    className={cn("w-full rounded-xl border p-4 text-left transition hover:bg-slate-50", selectedDeviceId === device.id ? "border-blue-500 bg-blue-50/50" : "border-slate-200")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-950">{device.name}</div>
                        <div className="text-xs text-slate-500">{device.device_uid ?? device.id} - {device.location ?? "No location"}</div>
                      </div>
                      <StatusPill value={device.is_connected || device.status === "online" ? "online" : "offline"} />
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                      <span>Users: {device.device_users_count ?? 0}</span>
                      <span>Logs: {device.device_logs_count ?? 0}</span>
                      <span>Sync: {device.last_sync_status ?? "none"}</span>
                    </div>
                  </button>
                ))}
                {!devices.length && <EmptyState text="No devices yet. Register a tablet and connect a biometric device." />}
              </div>
            </Panel>
          </motion.section>
        )}

        {activeTab === "sessions" && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <Panel title="Create Attendance Window" icon={Calendar}>
              <form onSubmit={createSession} className="grid gap-3">
                <Field label="Session Name" value={sessionForm.name} onChange={(value) => setSessionForm({ ...sessionForm, name: value })} required />
                <Field label="Status Label" value={sessionForm.label} onChange={(value) => setSessionForm({ ...sessionForm, label: value })} required />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Start" type="time" value={sessionForm.start_time} onChange={(value) => setSessionForm({ ...sessionForm, start_time: value })} required />
                  <Field label="End" type="time" value={sessionForm.end_time} onChange={(value) => setSessionForm({ ...sessionForm, end_time: value })} required />
                </div>
                <button className="primary-action" disabled={busy}><Plus size={16} /> Save Session</button>
              </form>
            </Panel>
            <Panel title="Saved Sessions" icon={Clock}>
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div key={session.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="font-semibold text-slate-950">{session.name}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {session.windows.map((window) => (
                        <span key={window.id ?? `${window.start_time}-${window.end_time}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {window.label}: {window.start_time}-{window.end_time}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {!sessions.length && <EmptyState text="No sessions saved for this device yet." />}
              </div>
            </Panel>
          </motion.section>
        )}

        {activeTab === "monitor" && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Panel title="Live Attendance Logs" icon={Activity} action={<button type="button" onClick={pullLogs} disabled={busy} className="primary-action"><DownloadCloud size={16} /> Pull Logs</button>}>
              <div className="mb-4 flex max-w-xs items-center gap-2">
                <Field label="Read Mark" type="number" value={readMark} onChange={(value) => setReadMark(Number(value))} />
              </div>
              <LogTable logs={logs} />
            </Panel>
          </motion.section>
        )}

        {activeTab === "reports" && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Panel title="Report Preview" icon={FileSpreadsheet}>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricBox label="Total Logs" value={logs.length} color="blue" />
                <MetricBox label="Present" value={logs.filter((log) => log.attendance_status === "present").length} color="emerald" />
                <MetricBox label="Late" value={logs.filter((log) => log.attendance_status === "late").length} color="amber" />
                <MetricBox label="Absent" value={logs.filter((log) => log.attendance_status === "absent").length} color="rose" />
              </div>
            </Panel>
          </motion.section>
        )}

        {activeTab === "settings" && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Panel title="Storage and API" icon={Settings}>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Feature icon={Database} label="Database" value="PostgreSQL via Prisma" />
                <Feature icon={Network} label="Frontend API" value="/api/v1" />
                <Feature icon={ShieldCheck} label="Security" value="School JWT required" />
                <Feature icon={Cpu} label="Device Path" value="Server to tablet REST" />
              </div>
            </Panel>
          </motion.section>
        )}
      </div>
    </AppLayout>
  );
}

function MetricCard({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: typeof Users; tone: "blue" | "emerald" | "cyan" | "violet" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    cyan: "bg-cyan-50 text-cyan-700 border-cyan-100",
    violet: "bg-violet-50 text-violet-700 border-violet-100",
  };
  return (
    <div className="metric-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
        </div>
        <div className={cn("rounded-xl border p-3", tones[tone])}><Icon size={21} /></div>
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, action, children }: { title: string; icon: typeof Users; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="dashboard-panel p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-slate-100 p-2 text-slate-700"><Icon size={18} /></div>
          <h2 className="font-semibold text-slate-950">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-600">
      {label}
      <input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="form-field" />
    </label>
  );
}

function LogTable({ logs }: { logs: AttendanceLog[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Device</th>
            <th>Method</th>
            <th>Direction</th>
            <th>Session</th>
            <th>Status</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>
                <div className="font-semibold text-slate-900">{`${log.first_name ?? ""} ${log.last_name ?? ""}`.trim() || log.student_id_number || log.student_id || "Unknown"}</div>
                <div className="text-xs text-slate-500">{log.student_id_number ?? log.student_id ?? "-"}</div>
              </td>
              <td>{log.device_id ?? "-"}</td>
              <td>{log.scan_method ?? "-"}</td>
              <td>{log.event_type ?? "-"}</td>
              <td>{log.session_name ?? "-"}</td>
              <td><StatusPill value={log.attendance_status ?? "synced"} /></td>
              <td>{log.scanned_at ? new Date(log.scanned_at).toLocaleString() : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!logs.length && <EmptyState text="No logs yet. Pull logs from the selected tablet." />}
    </div>
  );
}

function Feature({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <Icon className="text-blue-600" size={18} />
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function MetricBox({ label, value, color }: { label: string; value: string | number; color: "blue" | "emerald" | "amber" | "rose" }) {
  const colors = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <div className={cn("rounded-xl border p-4", colors[color])}>
      <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const tone = normalized.includes("online") || normalized.includes("synced") || normalized.includes("present")
    ? "bg-emerald-50 text-emerald-700"
    : normalized.includes("late") || normalized.includes("partial")
      ? "bg-amber-50 text-amber-700"
      : normalized.includes("offline") || normalized.includes("failed") || normalized.includes("absent")
        ? "bg-rose-50 text-rose-700"
        : "bg-slate-100 text-slate-700";
  return <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", tone)}>{value}</span>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">{text}</div>;
}
