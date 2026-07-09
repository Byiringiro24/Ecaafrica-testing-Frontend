import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Trash2,
  UploadCloud,
  Users,
  Wifi,
  WifiOff,
  Radio,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useGateSocket, type GateSocketEvent } from "@/hooks/useGateSocket";
import { fetchDeviceLogs } from "@/lib/device-logs-api";
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
import { DEFAULT_FK623_CONFIG } from "@/lib/tabletApi";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/boarding/devices")({
  component: ServerCommandCenter,
});

type TabId = "overview" | "monitor" | "students" | "devices" | "sessions" | "reports" | "settings";
type MonitorMode = "live" | "database";

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

type SectionRecord = {
  id: string;
  name: string;
  full_name: string;
  class_id: string;
};

type AcademicYearRecord = {
  id: string;
  name: string;
  is_current?: boolean;
  isCurrent?: boolean;
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

type DeviceUser = {
  userId?: string;
  id?: string;
  name?: string;
  privilege?: number;
  enabled?: boolean;
  biometricMethods?: string[];
  backupNumbers?: number[];
};

type PushMode = "selected" | "class" | "all";

const STATUS_POLL_MS = 60_000;
const SLOW_REFRESH_MS = 20 * 60_000;

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
  { id: "reports", label: "Reports", icon: FileSpreadsheet },
];

const unwrapList = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  const anyPayload = payload as any;
  if (Array.isArray(anyPayload?.data)) return anyPayload.data;
  if (Array.isArray(anyPayload?.tablets)) return anyPayload.tablets;
  if (Array.isArray(anyPayload?.devices)) return anyPayload.devices;
  if (Array.isArray(anyPayload?.students)) return anyPayload.students;
  if (Array.isArray(anyPayload?.users)) return anyPayload.users;
  if (Array.isArray(anyPayload?.logs)) return anyPayload.logs;
  if (Array.isArray(anyPayload?.data?.users)) return anyPayload.data.users;
  if (Array.isArray(anyPayload?.data?.logs)) return anyPayload.data.logs;
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
  const [sections, setSections] = useState<SectionRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [deviceUsers, setDeviceUsers] = useState<DeviceUser[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [selectedTabletId, setSelectedTabletId] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [classId, setClassId] = useState("");
  const [pushMode, setPushMode] = useState<PushMode>("selected");
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [readMark, setReadMark] = useState(0);
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [manualDeviceTime, setManualDeviceTime] = useState("");
  const [manualLogForm, setManualLogForm] = useState({
    student_id: "",
    event_type: "entry",
    scan_method: "fingerprint",
    scanned_at: "",
  });
  const [manualEventForm, setManualEventForm] = useState({
    student_id: "",
    session_name: "",
    scan_method: "fingerprint",
    scanned_at: "",
  });
  const [absentDate, setAbsentDate] = useState(new Date().toISOString().slice(0, 10));
  const refreshAllInFlight = useRef(false);
  const statusPollInFlight = useRef(false);

  // ── Live Monitor state ─────────────────────────────────────────────────────
  const [monitorMode, setMonitorMode] = useState<MonitorMode>("live");
  const [liveEvents, setLiveEvents] = useState<GateSocketEvent[]>([]);
  const [liveSearch, setLiveSearch] = useState("");
  const [liveDirectionFilter, setLiveDirectionFilter] = useState("");

  // Database logs state
  const [dbLogs, setDbLogs] = useState<any[]>([]);
  const [dbLogsLoading, setDbLogsLoading] = useState(false);
  const [dbLogsMeta, setDbLogsMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [dbLogsPage, setDbLogsPage] = useState(1);
  const [dbStartDate, setDbStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [dbEndDate, setDbEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [dbStartTime, setDbStartTime] = useState("00:00");
  const [dbEndTime, setDbEndTime] = useState("23:59");
  const [dbSearch, setDbSearch] = useState("");
  const [dbDirectionFilter, setDbDirectionFilter] = useState("");
  const [dbMethodFilter, setDbMethodFilter] = useState("");
  // ─────────────────────────────────────────────────────────────────────────

  const [tabletForm, setTabletForm] = useState({ name: "Main Gate Tablet", ip: "", port: 5000, location: "" });
  const [deviceForm, setDeviceForm] = useState({ ...DEFAULT_FK623_CONFIG });
  const [studentForm, setStudentForm] = useState({
    first_name: "",
    last_name: "",
    student_id_number: "",
    section_id: "",
    student_type: "boarding",
  });
  const [sessionForm, setSessionForm] = useState({
    name: "Morning",
    label: "Arrived on time",
    start_time: "07:00",
    end_time: "07:30",
  });

  const selectedDevice = devices.find((device) => device.id === selectedDeviceId) ?? devices[0];
  const selectedTablet =
    tablets.find((tablet) => tablet.id === selectedTabletId) ??
    tablets.find((tablet) => tablet.id === selectedDevice?.tablet_id) ??
    tablets[0];
  const selectedAcademicYear = academicYears.find((year) => year.is_current || year.isCurrent) ?? academicYears[0];
  const classSections = sections.filter((section) => !classId || section.class_id === classId);

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

  async function refreshAll(showSpinner = true) {
    if (refreshAllInFlight.current) return;
    refreshAllInFlight.current = true;
    if (showSpinner) setBusy(true);
    try {
      const [deviceData, tabletData, classData, sectionData, yearData, studentData] = await Promise.all([
        apiRequest<Device[]>("/devices?limit=500&sort=created_at&order=desc", { auth: "school" }),
        apiRequest<{ data?: Tablet[] } | Tablet[]>("/tablets?limit=500", { auth: "school" }),
        apiRequest<ClassRecord[]>("/classes?limit=500", { auth: "school" }),
        apiRequest<SectionRecord[]>("/sections?limit=1000&sort=full_name&order=asc", { auth: "school" }),
        apiRequest<AcademicYearRecord[]>("/academic-years?limit=50", { auth: "school" }),
        apiRequest<Student[]>("/students?limit=5000&status=active", { auth: "school" }),
      ]);

      const nextDevices = unwrapList<Device>(deviceData);
      const nextTablets = unwrapList<Tablet>(tabletData);
      const nextClasses = unwrapList<ClassRecord>(classData);
      const nextSections = unwrapList<SectionRecord>(sectionData);
      const nextAcademicYears = unwrapList<AcademicYearRecord>(yearData);
      const nextStudents = unwrapList<Student>(studentData);
      setDevices(nextDevices);
      setTablets(nextTablets);
      setClasses(nextClasses);
      setSections(nextSections);
      setAcademicYears(nextAcademicYears);
      setStudents(nextStudents);
      setSelectedDeviceId((current) => current || nextDevices[0]?.id || "");
      setSelectedTabletId((current) => current || nextTablets[0]?.id || "");

      const currentDevice = nextDevices.find((device) => device.id === selectedDeviceId) ?? nextDevices[0];
      const today = new Date().toISOString().slice(0, 10);
      if (currentDevice) {
        const [logsResult, sessionsResult] = await Promise.allSettled([
          apiRequest<AttendanceLog[]>(`/devices/${currentDevice.id}/logs?limit=500`, { auth: "school" }),
          apiRequest<{ sessions?: DeviceSession[] }>(`/devices/${currentDevice.id}/sessions`, { auth: "school" }),
        ]);
        if (logsResult.status === "fulfilled") {
          const nextLogs = unwrapList<AttendanceLog>(logsResult.value);
          setLogs(nextLogs);
          setStats({
            totalStudents: nextStudents.length,
            attendanceToday: nextLogs.filter((log) => log.scanned_at?.startsWith(today)).length,
            totalLogs: nextLogs.length,
            checkInCount: nextLogs.filter((log) => log.event_type === "entry").length,
            checkOutCount: nextLogs.filter((log) => log.event_type === "exit").length,
            fingerprintCount: nextLogs.filter((log) => log.scan_method === "fingerprint").length,
            faceCount: nextLogs.filter((log) => log.scan_method === "face").length,
            cardCount: nextLogs.filter((log) => log.scan_method === "nfc").length,
            passwordCount: nextLogs.filter((log) => log.scan_method === "manual").length,
            totalDevices: nextDevices.length,
            onlineDevices: nextDevices.filter((device) => device.status === "online" || device.is_connected).length,
          });
        }
        if (sessionsResult.status === "fulfilled") setSessions(sessionsResult.value.sessions ?? []);
      }

      setStats((current) => ({
        ...current,
        totalStudents: nextStudents.length,
        totalDevices: nextDevices.length,
        onlineDevices: nextDevices.filter((device) => device.status === "online" || device.is_connected).length,
        attendanceToday: current.totalLogs ? current.attendanceToday : logs.filter((log) => log.scanned_at?.startsWith(today)).length,
      }));
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load attendance devices");
    } finally {
      refreshAllInFlight.current = false;
      if (showSpinner) setBusy(false);
    }
  }

  useEffect(() => {
    void refreshAll();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) void refreshAll(false);
    }, SLOW_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [selectedDeviceId, selectedTabletId]);

  useEffect(() => {
    if (selectedDeviceId) void loadDeviceDetails(selectedDeviceId);
  }, [selectedDeviceId]);

  useEffect(() => {
    if (!autoReconnect || !selectedTabletId) return;
    const timer = window.setInterval(() => {
      void refreshDeviceConnection();
    }, STATUS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [autoReconnect, selectedDevice?.id, selectedTablet?.id]);

  useEffect(() => {
    if (!studentForm.section_id && classSections[0]?.id) {
      setStudentForm((current) => ({ ...current, section_id: classSections[0].id }));
    }
  }, [classId, sections]);

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
      if (selectedDevice?.id) await loadDeviceDetails(selectedDevice.id);
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

  async function setDeviceTime() {
    if (!selectedTablet?.id) {
      toast.error("Select a tablet first");
      return;
    }
    if (!manualDeviceTime) {
      toast.error("Choose the date and time to set");
      return;
    }
    try {
      await apiRequest(`/tablets/${selectedTablet.id}/device/set-time`, {
        method: "POST",
        auth: "school",
        body: JSON.stringify({ datetime: new Date(manualDeviceTime).toISOString() }),
      });
      toast.success("Device time updated");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to set device time");
    }
  }

  async function checkTabletHealth() {
    if (!selectedTablet?.id) {
      toast.error("Select a tablet first");
      return;
    }
    setBusy(true);
    try {
      const result = await apiRequest<any>(`/tablets/${selectedTablet.id}/health`, { auth: "school" });
      const healthy = Boolean(result?.healthy ?? result?.data?.healthy);
      toast[healthy ? "success" : "warning"](
        healthy ? `${selectedTablet.name} bridge is reachable` : result?.error || "Tablet bridge is offline"
      );
      setTablets((items) =>
        items.map((tablet) =>
          tablet.id === selectedTablet.id ? { ...tablet, status: healthy ? "online" : "offline" } : tablet
        )
      );
    } catch (error: any) {
      toast.error(error?.message ?? "Tablet health check failed");
    } finally {
      setBusy(false);
    }
  }

  async function checkLiveDeviceStatus() {
    if (!selectedTablet?.id) {
      toast.error("Select a tablet first");
      return;
    }
    setBusy(true);
    try {
      const result = await apiRequest<any>(`/tablets/${selectedTablet.id}/device/status`, { auth: "school" });
      const status = result?.data ?? result;
      toast[status?.connected ? "success" : "warning"](
        status?.connected
          ? `FK623 connected: ${status.users ?? 0} users, ${status.logs ?? 0} logs`
          : status?.message || "FK623 is not connected"
      );
      const connected = Boolean(status?.connected);
      setDevices((items) =>
        items.map((device) =>
          device.id === selectedDevice?.id
            ? {
                ...device,
                status: connected ? "online" : "offline",
                is_connected: connected,
                device_users_count: Number(status?.users ?? device.device_users_count ?? 0),
                device_logs_count: Number(status?.logs ?? device.device_logs_count ?? 0),
              }
            : device
        )
      );
      setTablets((items) =>
        items.map((tablet) =>
          tablet.id === selectedTablet.id ? { ...tablet, status: connected ? "online" : "offline" } : tablet
        )
      );
    } catch (error: any) {
      toast.error(error?.message ?? "Device status check failed");
    } finally {
      setBusy(false);
    }
  }

  async function powerOffDevice() {
    if (!selectedTablet?.id) {
      toast.error("Select a tablet first");
      return;
    }
    if (!window.confirm("Power off the physical FK623 device?")) return;
    setBusy(true);
    try {
      await apiRequest(`/tablets/${selectedTablet.id}/device/poweroff`, {
        method: "POST",
        auth: "school",
      });
      toast.success("Power off command sent");
      await refreshAll();
    } catch (error: any) {
      toast.error(error?.message ?? "Power off failed");
    } finally {
      setBusy(false);
    }
  }

  async function refreshDeviceConnection() {
    if (!selectedTablet?.id) return;
    if (statusPollInFlight.current) return;
    statusPollInFlight.current = true;
    try {
      const result = await apiRequest<any>(`/tablets/${selectedTablet.id}/device/status`, { auth: "school" });
      const status = result?.data ?? result;
      const connected = Boolean(status?.connected);
      setDevices((items) =>
        items.map((device) =>
          device.id === selectedDevice?.id
            ? {
                ...device,
                status: connected ? "online" : "offline",
                is_connected: connected,
                device_users_count: Number(status?.users ?? device.device_users_count ?? 0),
                device_logs_count: Number(status?.logs ?? device.device_logs_count ?? 0),
              }
            : device
        )
      );
      setTablets((items) =>
        items.map((tablet) =>
          tablet.id === selectedTablet.id ? { ...tablet, status: connected ? "online" : "offline" } : tablet
        )
      );
    } catch {
      // Polling keeps trying; visible manual actions still show toasts.
    } finally {
      statusPollInFlight.current = false;
    }
  }

  async function pullDeviceUsers() {
    if (!selectedTablet?.id) {
      toast.error("Select a tablet first");
      return;
    }
    setBusy(true);
    try {
      const result = await apiRequest<any>(`/tablets/${selectedTablet.id}/device/users`, { auth: "school" });
      setDeviceUsers(unwrapList<DeviceUser>(result?.data ?? result));
      toast.success("Device users refreshed");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load device users");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDeviceUser(userId?: string) {
    if (!selectedTablet?.id || !userId) return;
    if (!window.confirm(`Delete device user ${userId}?`)) return;
    setBusy(true);
    try {
      await apiRequest(`/tablets/${selectedTablet.id}/device/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        auth: "school",
      });
      toast.success("Device user deleted");
      await pullDeviceUsers();
    } catch (error: any) {
      toast.error(error?.message ?? "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function clearDeviceData(kind: "logs" | "all") {
    if (!selectedTablet?.id) return;
    const label = kind === "all" ? "all users and logs" : "device logs";
    if (!window.confirm(`Clear ${label} from the device?`)) return;
    setBusy(true);
    try {
      await apiRequest(`/tablets/${selectedTablet.id}/device/${kind === "all" ? "clear-all" : "clear-logs"}`, {
        method: "POST",
        auth: "school",
      });
      toast.success(kind === "all" ? "Device reset completed" : "Device logs cleared");
      await refreshAll();
    } catch (error: any) {
      toast.error(error?.message ?? "Device command failed");
    } finally {
      setBusy(false);
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
          ? { mode: "class", class_id: classId || undefined }
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
      await refreshAll(false);
    } catch (error: any) {
      toast.error(error?.message ?? "Student push failed");
    } finally {
      setBusy(false);
    }
  }

  async function addSingleStudentToDevice(student: Student) {
    if (!selectedDevice?.id && !selectedTablet?.id) {
      toast.error("Select a device or tablet first");
      return;
    }
    try {
      if (selectedDevice?.id) {
        await apiRequest(`/devices/${selectedDevice.id}/push-students`, {
          method: "POST",
          auth: "school",
          body: JSON.stringify({ mode: "selected", student_ids: [student.id] }),
        });
      } else {
        await apiRequest(`/tablets/${selectedTablet!.id}/device/users`, {
          method: "POST",
          auth: "school",
          body: JSON.stringify({ userId: buildDeviceUserId(student), name: studentName(student) }),
        });
      }
      toast.success(`${studentName(student)} pushed to device`);
      await refreshDeviceConnection();
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to push student");
    }
  }

  async function createStudentInClass(event: FormEvent) {
    event.preventDefault();
    if (!studentForm.first_name.trim() || !studentForm.last_name.trim()) {
      toast.error("Enter the student's first and last name");
      return;
    }
    if (!studentForm.section_id) {
      toast.error("Choose a class section for this student");
      return;
    }
    if (!selectedAcademicYear?.id) {
      toast.error("Create an academic year before enrolling students");
      return;
    }

    setBusy(true);
    try {
      const created = await apiRequest<Student>("/students", {
        method: "POST",
        auth: "school",
        body: JSON.stringify({
          first_name: studentForm.first_name.trim(),
          last_name: studentForm.last_name.trim(),
          student_id_number: studentForm.student_id_number.trim() || undefined,
          student_type: studentForm.student_type,
          status: "active",
        }),
      });

      await apiRequest(`/students/${created.id}/enrollments`, {
        method: "POST",
        auth: "school",
        body: JSON.stringify({
          section_id: studentForm.section_id,
          academic_year_id: selectedAcademicYear.id,
          status: "active",
        }),
      });

      toast.success("Student added to class. Push the class again to update the device.");
      setSelectedStudentIds((current) => new Set(current).add(created.id));
      setStudentForm((current) => ({ ...current, first_name: "", last_name: "", student_id_number: "" }));
      await refreshAll();
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to add student to class");
    } finally {
      setBusy(false);
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

  async function deleteSession(sessionId: string) {
    if (!selectedDevice?.id) return;
    if (!window.confirm("Delete this attendance session?")) return;
    setBusy(true);
    try {
      await apiRequest(`/devices/${selectedDevice.id}/sessions/${sessionId}`, {
        method: "DELETE",
        auth: "school",
      });
      toast.success("Session deleted");
      await loadDeviceDetails(selectedDevice.id);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to delete session");
    } finally {
      setBusy(false);
    }
  }

  async function markAbsent(session: DeviceSession) {
    if (!selectedDevice?.id) return;
    if (!window.confirm(`Mark missing students absent for ${session.name} on ${absentDate}?`)) return;
    setBusy(true);
    try {
      const result = await apiRequest<any>(`/devices/${selectedDevice.id}/sessions/${session.id}/mark-absent`, {
        method: "POST",
        auth: "school",
        body: JSON.stringify({ date: absentDate }),
      });
      toast.success(`Marked ${result?.absent_count ?? 0} student(s) absent`);
      await loadDeviceDetails(selectedDevice.id);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to mark absent students");
    } finally {
      setBusy(false);
    }
  }

  async function createManualLog(event: FormEvent) {
    event.preventDefault();
    if (!selectedDevice?.id) {
      toast.error("Select a device first");
      return;
    }
    setBusy(true);
    try {
      await apiRequest(`/devices/${selectedDevice.id}/logs`, {
        method: "POST",
        auth: "school",
        body: JSON.stringify({
          student_id: manualLogForm.student_id || undefined,
          event_type: manualLogForm.event_type,
          scan_method: manualLogForm.scan_method,
          scanned_at: manualLogForm.scanned_at ? new Date(manualLogForm.scanned_at).toISOString() : undefined,
        }),
      });
      toast.success("Manual device log saved");
      await loadDeviceDetails(selectedDevice.id);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to save manual log");
    } finally {
      setBusy(false);
    }
  }

  async function recordManualAttendanceEvent(event: FormEvent) {
    event.preventDefault();
    if (!selectedDevice?.id) {
      toast.error("Select a device first");
      return;
    }
    setBusy(true);
    try {
      await apiRequest(`/devices/${selectedDevice.id}/attendance-events`, {
        method: "POST",
        auth: "school",
        body: JSON.stringify({
          student_id: manualEventForm.student_id || undefined,
          session_name: manualEventForm.session_name || undefined,
          scan_method: manualEventForm.scan_method,
          scanned_at: manualEventForm.scanned_at ? new Date(manualEventForm.scanned_at).toISOString() : undefined,
        }),
      });
      toast.success("Manual attendance event recorded");
      await loadDeviceDetails(selectedDevice.id);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to record attendance event");
    } finally {
      setBusy(false);
    }
  }

  const connected = Boolean(selectedDevice?.is_connected || selectedDevice?.status === "online");

  // ── Socket-backed live monitor ──────────────────────────────────────────
  const handleGateEvent = useCallback((event: GateSocketEvent) => {
    setLiveEvents((prev) => {
      // Deduplicate: keep latest scan per student
      const filtered = prev.filter((e) => e.studentId !== event.studentId);
      return [event, ...filtered].slice(0, 200); // cap at 200 rows
    });
  }, []);

  useGateSocket({
    enabled: activeTab === "monitor" && monitorMode === "live",
    onEvent: handleGateEvent,
  });

  // ── Database logs loader ─────────────────────────────────────────────────
  const loadDbLogs = useCallback(async (page = 1) => {
    setDbLogsLoading(true);
    try {
      const startDateTime = dbStartDate ? `${dbStartDate}T${dbStartTime || "00:00"}:00` : undefined;
      const endDateTime = dbEndDate ? `${dbEndDate}T${dbEndTime || "23:59"}:59` : undefined;
      const result = await fetchDeviceLogs({
        page,
        limit: 20,
        startDate: startDateTime,
        endDate: endDateTime,
        search: dbSearch || undefined,
        method: dbMethodFilter || undefined,
      });
      setDbLogs(result.data ?? []);
      setDbLogsMeta(result.meta ?? { total: 0, page, limit: 20, totalPages: 1 });
      setDbLogsPage(page);
    } catch {
      // silent — table shows empty
    } finally {
      setDbLogsLoading(false);
    }
  }, [dbStartDate, dbEndDate, dbStartTime, dbEndTime, dbSearch, dbMethodFilter]);

  useEffect(() => {
    if (activeTab === "monitor" && monitorMode === "database") {
      void loadDbLogs(1);
    }
  }, [activeTab, monitorMode]);

  const filteredLiveEvents = useMemo(() => {
    const q = liveSearch.trim().toLowerCase();
    return liveEvents.filter((e) => {
      const matchDir = !liveDirectionFilter ||
        e.direction.toLowerCase().includes(liveDirectionFilter.toLowerCase());
      const matchSearch = !q ||
        e.studentName.toLowerCase().includes(q) ||
        e.studentId.toLowerCase().includes(q);
      return matchDir && matchSearch;
    });
  }, [liveEvents, liveSearch, liveDirectionFilter]);

  return (
    <AppLayout title="Attendance Devices" subtitle="Configure tablets, biometric devices, and student pushes">
      <div className="space-y-6 pb-6">
        <section className="overflow-hidden rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/10 via-background to-background p-5 shadow-[0_18px_60px_-30px_rgba(33,65,127,0.45)] md:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                <ShieldCheck size={16} /> PostgreSQL and Prisma command center
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl"> Biometric Attendance Management </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Manage live device commands and store attendance data in the existing backend database.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,18rem)_auto_auto] sm:items-center">
              <select value={selectedDeviceId} onChange={(event) => setSelectedDeviceId(event.target.value)} className="form-field min-w-0 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100 shadow-sm backdrop-blur-md focus:border-primary focus:ring-2 focus:ring-primary/20">
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>{device.name}</option>
                ))}
              </select>
              <div className={cn("flex items-center gap-2 rounded-2xl border px-4 py-3 shadow-sm", connected ? "border-emerald-200 bg-emerald-50/80 text-emerald-700" : "border-rose-200 bg-rose-50/80 text-rose-700")}>
                {connected ? <Wifi size={16} /> : <WifiOff size={16} />}
                <span className="text-sm font-semibold">{connected ? "Device Online" : "Device Offline"}</span>
              </div>
              <button type="button" onClick={() => void refreshAll()} disabled={busy} className="primary-action inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                {busy ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />} Refresh
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-border/70 bg-card/95 p-3 shadow-[0_14px_40px_-28px_rgba(15,23,42,0.45)] backdrop-blur-sm">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all duration-200",
                      activeTab === item.id ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon size={16} /> {item.label}
            </button>
          ))}
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Students" value={stats.totalStudents} icon={Users} tone="blue" />
          <MetricCard label="Today Logs" value={stats.attendanceToday} icon={CheckCircle2} tone="emerald" />
          <MetricCard label="Devices Online" value={`${stats.onlineDevices}/${stats.totalDevices}`} icon={Wifi} tone="cyan" />
          <MetricCard label="Stored Logs" value={stats.totalLogs} icon={Database} tone="violet" />
        </section>

        {activeTab === "overview" && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
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
            <div className="space-y-4">
              <Panel title="Push Target" icon={UploadCloud}>
                <div className="grid gap-3">
                  <label className="grid gap-1 text-sm font-medium text-slate-600">
                    Class
                    <select value={classId} onChange={(event) => setClassId(event.target.value)} className="form-field">
                      <option value="">All classes</option>
                      {classes.map((klass) => (
                        <option key={klass.id} value={klass.id}>{klass.level_label || klass.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-slate-600">
                    Push mode
                    <select value={pushMode} onChange={(event) => setPushMode(event.target.value as PushMode)} className="form-field">
                      <option value="selected">Selected students</option>
                      <option value="class">Whole class</option>
                      <option value="all">All active students</option>
                    </select>
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button type="button" onClick={() => setPushMode("class")} disabled={!classId} className="secondary-action inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700/60 bg-slate-950/75 px-4 py-3 text-sm font-semibold text-slate-100 shadow-md backdrop-blur-md transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60">
                      <Users size={16} /> Use class
                    </button>
                    <button type="button" onClick={pushStudents} disabled={busy} className="primary-action inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                      <UploadCloud size={16} /> Push now
                    </button>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/60 p-4 text-xs leading-5 text-muted-foreground">
                    {pushMode === "class"
                      ? `${filteredStudents.length} active student(s) from this class will be sent to the device.`
                      : pushMode === "all"
                        ? `${students.length} active student(s) from the PostgreSQL student database will be sent.`
                        : `${selectedStudentIds.size} selected student(s) will be sent.`}
                  </div>
                </div>
              </Panel>

              <Panel title="Add Student To Class" icon={Plus}>
                <form onSubmit={createStudentInClass} className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="First Name" value={studentForm.first_name} onChange={(value) => setStudentForm({ ...studentForm, first_name: value })} required />
                    <Field label="Last Name" value={studentForm.last_name} onChange={(value) => setStudentForm({ ...studentForm, last_name: value })} required />
                  </div>
                  <Field label="Student Number" value={studentForm.student_id_number} onChange={(value) => setStudentForm({ ...studentForm, student_id_number: value })} />
                  <label className="grid gap-1.5 text-sm font-medium text-muted-foreground">
                    Section
                    <select value={studentForm.section_id} onChange={(event) => setStudentForm({ ...studentForm, section_id: event.target.value })} className="form-field rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100 shadow-sm backdrop-blur-md focus:border-primary focus:ring-2 focus:ring-primary/20" required>
                      <option value="">Choose section</option>
                      {classSections.map((section) => (
                        <option key={section.id} value={section.id}>{section.full_name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium text-muted-foreground">
                    Student Type
                    <select value={studentForm.student_type} onChange={(event) => setStudentForm({ ...studentForm, student_type: event.target.value })} className="form-field rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100 shadow-sm backdrop-blur-md focus:border-primary focus:ring-2 focus:ring-primary/20">
                      <option value="boarding">Boarding</option>
                      <option value="day">Day</option>
                    </select>
                  </label>
                  <button className="primary-action inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60" disabled={busy || !selectedAcademicYear}>
                    <Plus size={16} /> Add to class
                  </button>
                  <p className="text-xs text-muted-foreground">
                    Enrolls in {selectedAcademicYear?.name ?? "the current academic year"}; push the class afterward to update the device.
                  </p>
                </form>
              </Panel>
            </div>
            <Panel
              title="Students"
              icon={Users}
              action={
                <div className="relative min-w-60">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} className="form-field pl-9 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100 shadow-sm backdrop-blur-md placeholder:text-slate-500 focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Search students" />
                </div>
              }
            >
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border bg-muted/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Shown</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{filteredStudents.length}</p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Selected</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{selectedStudentIds.size}</p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Total Class Data</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{students.length}</p>
                </div>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-border/70 bg-background/80">
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
                          <button type="button" onClick={() => addSingleStudentToDevice(student)} className="secondary-action inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700/60 bg-slate-950/75 px-3 py-2 text-sm font-semibold text-slate-100 shadow-md backdrop-blur-md transition-colors hover:bg-slate-900">
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
                  <button disabled={busy} className="primary-action inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"><Globe2 size={16} /> Register Tablet</button>
                </form>
              </Panel>
              <Panel title="Connect FK623" icon={Cpu}>
                <form onSubmit={connectDevice} className="grid gap-3">
                  <select value={selectedTablet?.id ?? ""} onChange={(event) => setSelectedTabletId(event.target.value)} className="form-field rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100 shadow-sm backdrop-blur-md focus:border-primary focus:ring-2 focus:ring-primary/20">
                    {tablets.map((tablet) => <option key={tablet.id} value={tablet.id}>{tablet.name} - {tablet.ip}:{tablet.port}</option>)}
                  </select>
                  <Field label="Device UID" value={deviceForm.deviceId} onChange={(value) => setDeviceForm({ ...deviceForm, deviceId: value })} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Device IP" value={deviceForm.ipAddress} onChange={(value) => setDeviceForm({ ...deviceForm, ipAddress: value })} />
                    <Field label="Device Port" type="number" value={deviceForm.port} onChange={(value) => setDeviceForm({ ...deviceForm, port: Number(value) })} />
                    <Field label="License" type="number" value={deviceForm.license} onChange={(value) => setDeviceForm({ ...deviceForm, license: Number(value) })} />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <button disabled={busy} className="primary-action inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"><Wifi size={16} /> Connect</button>
                    <button type="button" onClick={syncTime} className="secondary-action inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700/60 bg-slate-950/75 px-4 py-3 text-sm font-semibold text-slate-100 shadow-md backdrop-blur-md transition-colors hover:bg-slate-900"><Clock size={16} /> Sync</button>
                    <button type="button" onClick={disconnectDevice} className="secondary-action inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-300/40 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-700 shadow-md backdrop-blur-md transition-colors hover:bg-rose-500/20"><Power size={16} /> Disconnect</button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button type="button" onClick={checkTabletHealth} disabled={busy} className="secondary-action inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700/60 bg-slate-950/75 px-4 py-3 text-sm font-semibold text-slate-100 shadow-md backdrop-blur-md transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60">
                      <Network size={16} /> Bridge Health
                    </button>
                    <button type="button" onClick={checkLiveDeviceStatus} disabled={busy} className="secondary-action inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700/60 bg-slate-950/75 px-4 py-3 text-sm font-semibold text-slate-100 shadow-md backdrop-blur-md transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60">
                      <Activity size={16} /> Live Status
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <Field
                      label="Manual Device Time"
                      type="datetime-local"
                      value={manualDeviceTime}
                      onChange={setManualDeviceTime}
                    />
                    <button type="button" onClick={setDeviceTime} disabled={busy || !manualDeviceTime} className="secondary-action self-end inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700/60 bg-slate-950/75 px-4 py-3 text-sm font-semibold text-slate-100 shadow-md backdrop-blur-md transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60">
                      <Clock size={16} /> Set Time
                    </button>
                    <button type="button" onClick={powerOffDevice} disabled={busy} className="secondary-action self-end inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-300/40 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-700 shadow-md backdrop-blur-md transition-colors hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60">
                      <Power size={16} /> Power Off
                    </button>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={autoReconnect}
                      onChange={(event) => setAutoReconnect(event.target.checked)}
                    />
                    Auto reconnect and status poll
                  </label>
                </form>
              </Panel>
            </div>
            <div className="space-y-4">
              <Panel title="Device Fleet" icon={HardDrive}>
                <div className="space-y-3">
                  {devices.map((device) => (
                    <button
                      key={device.id}
                      type="button"
                      onClick={() => setSelectedDeviceId(device.id)}
                      className={cn("group w-full rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md", selectedDeviceId === device.id ? "border-primary/30 bg-primary/5 shadow-[0_12px_30px_-22px_rgba(33,65,127,0.45)]" : "border-border bg-background hover:border-primary/20 hover:bg-muted/50")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-foreground">{device.name}</div>
                          <div className="text-xs text-muted-foreground">{device.device_uid ?? device.id} - {device.location ?? "No location"}</div>
                        </div>
                        <StatusPill value={device.is_connected || device.status === "online" ? "online" : "offline"} />
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                        <span>Users: {device.device_users_count ?? 0}</span>
                        <span>Logs: {device.device_logs_count ?? 0}</span>
                        <span>Sync: {device.last_sync_status ?? "none"}</span>
                      </div>
                    </button>
                  ))}
                  {!devices.length && <EmptyState text="No devices yet. Register a tablet and connect a biometric device." />}
                </div>
              </Panel>
              <Panel
                title="Live Device Users"
                icon={Users}
                action={
                  <button type="button" onClick={pullDeviceUsers} disabled={busy} className="secondary-action inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700/60 bg-slate-950/75 px-4 py-3 text-sm font-semibold text-slate-100 shadow-md backdrop-blur-md transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60">
                    <RefreshCw size={16} /> Refresh Users
                  </button>
                }
              >
                <div className="mb-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => clearDeviceData("logs")} disabled={busy} className="secondary-action inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700/60 bg-slate-950/75 px-4 py-3 text-sm font-semibold text-slate-100 shadow-md backdrop-blur-md transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60">
                    <Trash2 size={16} /> Clear Logs
                  </button>
                  <button type="button" onClick={() => clearDeviceData("all")} disabled={busy} className="secondary-action inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-300/40 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-700 shadow-md backdrop-blur-md transition-colors hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60">
                    <Trash2 size={16} /> Reset Device
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>User ID</th>
                        <th>Name</th>
                        <th>Privilege</th>
                        <th>Status</th>
                        <th>Methods</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deviceUsers.map((user) => {
                        const userId = user.userId ?? user.id ?? "";
                        return (
                          <tr key={userId || user.name}>
                            <td className="font-mono">{userId || "-"}</td>
                            <td>{user.name || "-"}</td>
                            <td>{user.privilege === 1 ? "Admin" : "User"}</td>
                            <td><StatusPill value={user.enabled === false ? "disabled" : "enabled"} /></td>
                            <td>{user.biometricMethods?.length ? user.biometricMethods.join(", ") : "-"}</td>
                            <td>
                              <button type="button" onClick={() => deleteDeviceUser(userId)} disabled={busy || !userId} className="secondary-action inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-700 shadow-md backdrop-blur-md transition-colors hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60">
                                <Trash2 size={14} /> Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!deviceUsers.length && <EmptyState text="No live device users loaded." />}
                </div>
              </Panel>
            </div>
          </motion.section>
        )}

        {false && activeTab === "sessions" && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <Panel title="Create Attendance Window" icon={Calendar}>
              <form onSubmit={createSession} className="grid gap-3">
                <Field label="Session Name" value={sessionForm.name} onChange={(value) => setSessionForm({ ...sessionForm, name: value })} required />
                <Field label="Status Label" value={sessionForm.label} onChange={(value) => setSessionForm({ ...sessionForm, label: value })} required />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Start" type="time" value={sessionForm.start_time} onChange={(value) => setSessionForm({ ...sessionForm, start_time: value })} required />
                  <Field label="End" type="time" value={sessionForm.end_time} onChange={(value) => setSessionForm({ ...sessionForm, end_time: value })} required />
                </div>
                <button className="primary-action inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60" disabled={busy}><Plus size={16} /> Save Session</button>
              </form>
            </Panel>
            <Panel title="Saved Sessions" icon={Clock}>
              <div className="mb-4 max-w-xs">
                <Field label="Absent Date" type="date" value={absentDate} onChange={setAbsentDate} />
              </div>
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div key={session.id} className="rounded-2xl border border-border bg-muted/40 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="font-semibold text-foreground">{session.name}</div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => markAbsent(session)} disabled={busy} className="secondary-action inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700/60 bg-slate-950/75 px-3 py-2 text-sm font-semibold text-slate-100 shadow-md backdrop-blur-md transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60">
                          <CheckCircle2 size={14} /> Mark Absent
                        </button>
                        <button type="button" onClick={() => deleteSession(session.id)} disabled={busy} className="secondary-action inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-700 shadow-md backdrop-blur-md transition-colors hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60">
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {session.windows.map((window) => (
                        <span key={window.id ?? `${window.start_time}-${window.end_time}`} className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground">
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
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Mode toggle */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border/70 bg-card p-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMonitorMode("live")}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
                    monitorMode === "live"
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/25"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Radio size={15} className={monitorMode === "live" ? "animate-pulse" : ""} />
                  Live Attendance
                  {monitorMode === "live" && liveEvents.length > 0 && (
                    <span className="ml-1 rounded-full bg-white/25 px-1.5 py-0.5 text-xs">{liveEvents.length}</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setMonitorMode("database"); void loadDbLogs(1); }}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
                    monitorMode === "database"
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Database size={15} />
                  Logs in Database
                </button>
              </div>
              <button
                type="button"
                onClick={pullLogs}
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? <Loader2 className="animate-spin" size={15} /> : <DownloadCloud size={15} />}
                Sync Now
              </button>
            </div>

            {/* ─── LIVE MODE ─── */}
            {monitorMode === "live" && (
              <div className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
                <Panel
                  title="Live Attendance Feed"
                  icon={Activity}
                  action={
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        Live
                      </span>
                      <button
                        type="button"
                        onClick={() => setLiveEvents([])}
                        className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
                      >
                        Clear
                      </button>
                    </div>
                  }
                >
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={liveSearch}
                        onChange={(e) => setLiveSearch(e.target.value)}
                        className="w-full form-field pl-9 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-2.5 text-slate-100 text-sm shadow-sm backdrop-blur-md placeholder:text-slate-500"
                        placeholder="Search by name or ID…"
                      />
                    </div>
                    <select
                      value={liveDirectionFilter}
                      onChange={(e) => setLiveDirectionFilter(e.target.value)}
                      className="form-field rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-slate-100 text-sm shadow-sm backdrop-blur-md"
                    >
                      <option value="">All directions</option>
                      <option value="In">Entry (In)</option>
                      <option value="Out">Exit (Out)</option>
                    </select>
                  </div>
                  {filteredLiveEvents.length === 0 ? (
                    <EmptyState text="Waiting for scans… The feed updates automatically when a student scans." />
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-border/70">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Student</th>
                            <th>Direction</th>
                            <th>Method</th>
                            <th>Class</th>
                            <th>Status</th>
                            <th>Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLiveEvents.map((event) => (
                            <tr key={`${event.studentId}-${event.timestamp}`}>
                              <td>
                                <div className="font-semibold text-foreground">{event.studentName}</div>
                                <div className="text-xs text-muted-foreground">{event.studentId}</div>
                              </td>
                              <td>
                                <span className={cn(
                                  "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                                  event.direction === "In" || event.direction === "entry"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-amber-100 text-amber-700"
                                )}>
                                  {event.direction}
                                </span>
                              </td>
                              <td>{event.method}</td>
                              <td>{event.className ?? event.section ?? "-"}</td>
                              <td><StatusPill value={event.status} /></td>
                              <td className="text-xs">{new Date(event.timestamp).toLocaleTimeString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>

                <div className="space-y-4">
                  <Panel title="Manual Attendance Event" icon={CheckCircle2}>
                    <form onSubmit={recordManualAttendanceEvent} className="grid gap-3">
                      <SelectField label="Student" value={manualEventForm.student_id} onChange={(value) => setManualEventForm({ ...manualEventForm, student_id: value })}>
                        <option value="">No student selected</option>
                        {students.map((student) => <option key={student.id} value={student.id}>{studentName(student)}</option>)}
                      </SelectField>
                      <SelectField label="Session" value={manualEventForm.session_name} onChange={(value) => setManualEventForm({ ...manualEventForm, session_name: value })}>
                        <option value="">Default session</option>
                        {sessions.map((session) => <option key={session.id} value={session.name}>{session.name}</option>)}
                      </SelectField>
                      <SelectField label="Scan Method" value={manualEventForm.scan_method} onChange={(value) => setManualEventForm({ ...manualEventForm, scan_method: value })}>
                        <option value="fingerprint">Fingerprint</option>
                        <option value="face">Face</option>
                        <option value="nfc">Card</option>
                        <option value="manual">Manual/PIN</option>
                      </SelectField>
                      <Field label="Scanned At" type="datetime-local" value={manualEventForm.scanned_at} onChange={(value) => setManualEventForm({ ...manualEventForm, scanned_at: value })} />
                      <button className="primary-action inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60" disabled={busy}>
                        <CheckCircle2 size={16} /> Record Event
                      </button>
                    </form>
                  </Panel>
                </div>
              </div>
            )}

            {/* ─── DATABASE MODE ─── */}
            {monitorMode === "database" && (
              <Panel title="Attendance Logs — Database" icon={Database}>
                {/* Filters */}
                <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                    Start Date
                    <input
                      type="date"
                      value={dbStartDate}
                      onChange={(e) => setDbStartDate(e.target.value)}
                      className="form-field rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-slate-100 text-sm shadow-sm backdrop-blur-md"
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                    Start Time
                    <input
                      type="time"
                      value={dbStartTime}
                      onChange={(e) => setDbStartTime(e.target.value)}
                      className="form-field rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-slate-100 text-sm shadow-sm backdrop-blur-md"
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                    End Date
                    <input
                      type="date"
                      value={dbEndDate}
                      onChange={(e) => setDbEndDate(e.target.value)}
                      className="form-field rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-slate-100 text-sm shadow-sm backdrop-blur-md"
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                    End Time
                    <input
                      type="time"
                      value={dbEndTime}
                      onChange={(e) => setDbEndTime(e.target.value)}
                      className="form-field rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-slate-100 text-sm shadow-sm backdrop-blur-md"
                    />
                  </label>
                </div>
                <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={dbSearch}
                      onChange={(e) => setDbSearch(e.target.value)}
                      className="w-full form-field pl-9 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-2.5 text-slate-100 text-sm shadow-sm backdrop-blur-md placeholder:text-slate-500"
                      placeholder="Search by student name, ID, class…"
                    />
                  </div>
                  <select
                    value={dbMethodFilter}
                    onChange={(e) => setDbMethodFilter(e.target.value)}
                    className="form-field rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-slate-100 text-sm shadow-sm backdrop-blur-md"
                  >
                    <option value="">All methods</option>
                    <option value="fingerprint">Fingerprint</option>
                    <option value="face">Face</option>
                    <option value="card">Card/RFID</option>
                    <option value="manual">Manual/PIN</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void loadDbLogs(1)}
                    disabled={dbLogsLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:opacity-60"
                  >
                    {dbLogsLoading ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />}
                    Search
                  </button>
                </div>

                {/* Summary */}
                <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{dbLogsMeta.total} records found</span>
                  <span>Page {dbLogsMeta.page} of {dbLogsMeta.totalPages}</span>
                </div>

                {/* Table */}
                {dbLogsLoading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                    <Loader2 className="animate-spin" size={18} /> Loading…
                  </div>
                ) : dbLogs.length === 0 ? (
                  <EmptyState text="No logs found for the selected filters. Try adjusting the date range." />
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-border/70">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Class</th>
                          <th>Method</th>
                          <th>Direction</th>
                          <th>Session</th>
                          <th>Status</th>
                          <th>Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dbLogs.map((log) => (
                          <tr key={log.id}>
                            <td>
                              <div className="font-semibold text-foreground">{log.studentName ?? log.student_name ?? "Unknown"}</div>
                              <div className="text-xs text-muted-foreground">{log.studentId ?? log.student_id ?? "-"}</div>
                            </td>
                            <td>{log.className ?? log.class_name ?? "-"}</td>
                            <td>{log.method ?? log.authentication_method ?? "-"}</td>
                            <td>
                              <span className={cn(
                                "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                                (log.direction === "In" || log.direction === "entry")
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700"
                              )}>
                                {log.direction ?? "-"}
                              </span>
                            </td>
                            <td>{log.sessionName ?? log.attendance_period ?? "-"}</td>
                            <td><StatusPill value={log.status ?? "synced"} /></td>
                            <td className="text-xs">
                              {log.timestamp ? new Date(log.timestamp).toLocaleString() : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination */}
                {dbLogsMeta.totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <button
                      type="button"
                      disabled={dbLogsMeta.page <= 1 || dbLogsLoading}
                      onClick={() => void loadDbLogs(dbLogsMeta.page - 1)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted disabled:opacity-40"
                    >
                      <ChevronLeft size={15} /> Previous
                    </button>
                    <span className="text-xs text-muted-foreground">
                      Showing {((dbLogsMeta.page - 1) * dbLogsMeta.limit) + 1}–{Math.min(dbLogsMeta.page * dbLogsMeta.limit, dbLogsMeta.total)} of {dbLogsMeta.total}
                    </span>
                    <button
                      type="button"
                      disabled={dbLogsMeta.page >= dbLogsMeta.totalPages || dbLogsLoading}
                      onClick={() => void loadDbLogs(dbLogsMeta.page + 1)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted disabled:opacity-40"
                    >
                      Next <ChevronRight size={15} />
                    </button>
                  </div>
                )}
              </Panel>
            )}
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

        {false && activeTab === "settings" && (
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
    blue: "bg-primary/10 text-primary border-primary/15",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    cyan: "bg-cyan-50 text-cyan-700 border-cyan-100",
    violet: "bg-violet-50 text-violet-700 border-violet-100",
  };
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-[0_10px_35px_-28px_rgba(15,23,42,0.5)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
        </div>
        <div className={cn("rounded-2xl border p-3", tones[tone])}><Icon size={21} /></div>
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, action, children }: { title: string; icon: typeof Users; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.45)]">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-2xl bg-primary/10 p-2 text-primary"><Icon size={18} /></div>
          <h2 className="font-semibold text-foreground">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-muted-foreground">
      {label}
      <input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="form-field rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100 shadow-sm backdrop-blur-md placeholder:text-slate-500 focus:border-primary focus:ring-2 focus:ring-primary/20" />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-muted-foreground">
      {label}
      <select required={required} value={value} onChange={(event) => onChange(event.target.value)} className="form-field rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100 shadow-sm backdrop-blur-md focus:border-primary focus:ring-2 focus:ring-primary/20">
        {children}
      </select>
    </label>
  );
}

function LogTable({ logs }: { logs: AttendanceLog[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/70">
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
                <div className="font-semibold text-foreground">{`${log.first_name ?? ""} ${log.last_name ?? ""}`.trim() || log.student_id_number || log.student_id || "Unknown"}</div>
                <div className="text-xs text-muted-foreground">{log.student_id_number ?? log.student_id ?? "-"}</div>
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
    <div className="rounded-2xl border border-border bg-muted/60 p-4">
      <Icon className="text-primary" size={18} />
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function MetricBox({ label, value, color }: { label: string; value: string | number; color: "blue" | "emerald" | "amber" | "rose" }) {
  const colors = {
    blue: "bg-primary/10 text-primary border-primary/15",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <div className={cn("rounded-xl border p-4", colors[color])}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const tone = normalized.includes("online") || normalized.includes("synced") || normalized.includes("present")
    ? "bg-emerald-100 text-emerald-700"
    : normalized.includes("late") || normalized.includes("partial")
      ? "bg-amber-100 text-amber-700"
      : normalized.includes("offline") || normalized.includes("failed") || normalized.includes("absent")
        ? "bg-rose-100 text-rose-700"
        : "bg-muted text-muted-foreground";
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize", tone)}>{value}</span>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">{text}</div>;
}
