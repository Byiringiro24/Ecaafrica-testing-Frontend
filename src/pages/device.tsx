"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  FiActivity,
  FiCheckCircle,
  FiClock,
  FiCpu,
  FiCreditCard,
  FiDatabase,
  FiDownloadCloud,
  FiLock,
  FiMoon,
  FiRefreshCw,
  FiServer,
  FiShield,
  FiSun,
  FiUploadCloud,
  FiUsers,
  FiWifi,
  FiWifiOff,
} from "react-icons/fi";
import { attendanceApi, dashboardApi, deviceApi, studentApi } from "@/lib/api";

type Stats = {
  totalStudents: number;
  totalDevices: number;
  onlineDevices: number;
  attendanceToday: number;
  lateStudents: number;
  totalLogs: number;
};

type DeviceStatus = {
  connected?: boolean;
  deviceId?: string;
  ipAddress?: string;
  port?: number;
  handle?: number;
  serialNumber?: string;
  productName?: string;
  productCode?: string;
  users?: number;
  logs?: number;
  faces?: number;
  fingerprints?: number;
  cards?: number;
};

type AttendanceLog = {
  id: string;
  studentId?: string;
  studentDeviceId?: string;
  studentName: string;
  className?: string;
  section?: string;
  deviceId: string;
  authenticationMethod: string;
  timestamp: string;
  status: string;
  direction?: string;
  attendancePeriod?: string;
};

type AttendanceRule = {
  label: string;
  start: string;
  end: string;
};

type AttendanceSettings = {
  morning: { name: string; rules: AttendanceRule[] };
  evening: { name: string; rules: AttendanceRule[] };
  updatedAt?: string;
};

type Student = {
  studentId: string;
  studentDeviceId: string;
  name: string;
  className: string;
  section?: string;
  assignedDeviceId?: string;
  biometricMethods?: string[];
  deviceUser?: DeviceUser;
};

type DeviceUser = {
  userId: string;
  studentDeviceId: string;
  name: string;
  privilege: number;
  enabled: boolean;
  biometricMethods: string[];
};

const emptyStats: Stats = {
  totalStudents: 0,
  totalDevices: 0,
  onlineDevices: 0,
  attendanceToday: 0,
  lateStudents: 0,
  totalLogs: 0,
};

const classes = ["S1", "S2", "S3", "S4", "S5 MPC", "S5 MEG", "S5 PCB", "S6 MPC", "S6 MEG", "S6 PCB"];

export default function SmartAttendanceDashboard() {
  const getLocalDateTime = () => {
    const now = new Date();
    const pad = (value: number) => value.toString().padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  };

  const timeToMinutes = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const isMinutesInRange = (minutes: number, start: number, end: number) => {
    if (start <= end) return minutes >= start && minutes <= end;
    return minutes >= start || minutes <= end;
  };

  const [stats, setStats] = useState<Stats>(emptyStats);
  const [device, setDevice] = useState<DeviceStatus | null>(null);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [deviceUsers, setDeviceUsers] = useState<DeviceUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [methodFilter, setMethodFilter] = useState("All Methods");
  const [query, setQuery] = useState("");
  const [readMode, setReadMode] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [settingsDraft, setSettingsDraft] = useState<AttendanceSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deviceTime, setDeviceTime] = useState(getLocalDateTime);
  const [deviceForm, setDeviceForm] = useState({
    deviceId: "DV-KGL-01",
    ipAddress: "10.162.183.16",
    port: 5005,
    license: 1261,
    location: "Main Gate",
  });
  const [studentForm, setStudentForm] = useState({
    name: "",
    studentId: "RW-",
    studentDeviceId: "",
    className: "S1",
    section: "A",
    assignedDeviceId: "DV-KGL-01",
    parentPhone: "",
  });

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("theme");
    const initialTheme = storedTheme === "light" ? "light" : "dark";
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    loadAttendanceSettings();
  }, []);

  const connected = Boolean(device?.connected);
  const isLight = theme === "light";
  const resolveStatusLabel = (log: AttendanceLog) => {
    if (!settingsDraft) return log.status || "Unknown";
    const timestamp = new Date(log.timestamp);
    if (Number.isNaN(timestamp.getTime())) return log.status || "Unknown";
    const minutes = timestamp.getHours() * 60 + timestamp.getMinutes();
    const eveningMatch = settingsDraft.evening.rules.find((rule) =>
      isMinutesInRange(minutes, timeToMinutes(rule.start), timeToMinutes(rule.end))
    );
    if (eveningMatch) {
      const fallback = settingsDraft.evening.rules[settingsDraft.evening.rules.length - 1]?.label;
      return eveningMatch.label || fallback || "Unknown";
    }

    const morningMatch = settingsDraft.morning.rules.find((rule) =>
      isMinutesInRange(minutes, timeToMinutes(rule.start), timeToMinutes(rule.end))
    );
    const fallback = settingsDraft.morning.rules[settingsDraft.morning.rules.length - 1]?.label;
    return morningMatch?.label || fallback || "Unknown";
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesMethod = methodFilter === "All Methods" || log.authenticationMethod === methodFilter;
      const target = `${log.studentName} ${log.studentId} ${log.studentDeviceId} ${log.className} ${log.deviceId}`.toLowerCase();
      return matchesMethod && target.includes(query.toLowerCase());
    });
  }, [logs, methodFilter, query]);

  async function refreshAll() {
    setBusy(true);
    try {
      const [statsRes, recentRes, statusRes, studentsRes] = await Promise.allSettled([
        dashboardApi.getStats(),
        dashboardApi.getRecent(),
        deviceApi.getStatus(),
        studentApi.getAll(),
      ]);
      if (statsRes.status === "fulfilled") setStats(statsRes.value.data.stats || emptyStats);
      if (recentRes.status === "fulfilled") setLogs(recentRes.value.data.recent || []);
      if (statusRes.status === "fulfilled") setDevice(statusRes.value.data.data || null);
      if (studentsRes.status === "fulfilled") setStudents(studentsRes.value.data.students || []);
    } finally {
      setBusy(false);
    }
  }

  async function loadAttendanceSettings() {
    try {
      const res = await attendanceApi.getSettings();
      setSettingsDraft(res.data.settings || null);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to load attendance rules");
    }
  }

  function updatePeriodName(period: "morning" | "evening", value: string) {
    setSettingsDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, [period]: { ...prev[period], name: value } };
    });
  }

  function updateRule(period: "morning" | "evening", index: number, field: keyof AttendanceRule, value: string) {
    setSettingsDraft((prev) => {
      if (!prev) return prev;
      const periodData = prev[period];
      const rules = periodData.rules.map((rule, idx) => (idx === index ? { ...rule, [field]: value } : rule));
      return { ...prev, [period]: { ...periodData, rules } };
    });
  }

  async function saveAttendanceSettings() {
    if (!settingsDraft) return;
    setSavingSettings(true);
    toast.loading("Saving attendance rules...", { id: "attendance-settings" });
    try {
      const res = await attendanceApi.updateSettings(settingsDraft);
      setSettingsDraft(res.data.settings || null);
      toast.success("Attendance rules updated", { id: "attendance-settings" });
      await refreshAll();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Save failed", { id: "attendance-settings" });
    } finally {
      setSavingSettings(false);
    }
  }

  async function connectDevice(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    toast.loading("Connecting to device...", { id: "connect" });
    try {
      const res = await deviceApi.connect(deviceForm);
      setDevice(res.data.data);
      toast.success("Device connected", { id: "connect" });
      await refreshAll();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Connection failed", { id: "connect" });
    } finally {
      setBusy(false);
    }
  }

  async function pullLogs() {
    setBusy(true);
    toast.loading("Pulling device logs...", { id: "logs" });
    try {
      const res = await deviceApi.pullLogs(readMode);
      toast.success(`Pulled ${res.data.data?.count || 0} logs`, { id: "logs" });
      await refreshAll();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Pull logs failed", { id: "logs" });
    } finally {
      setBusy(false);
    }
  }

  async function pullUsers() {
    setBusy(true);
    toast.loading("Pulling users and biometrics...", { id: "users" });
    try {
      const res = await deviceApi.getUsers();
      setDeviceUsers(res.data.data?.users || []);
      toast.success(`Pulled ${res.data.data?.count || 0} device users`, { id: "users" });
      await refreshAll();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Pull users failed", { id: "users" });
    } finally {
      setBusy(false);
    }
  }

  async function syncTime() {
    setBusy(true);
    try {
      await deviceApi.syncTime();
      toast.success("Device time synced");
      setDeviceTime(getLocalDateTime());
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Sync time failed");
    } finally {
      setBusy(false);
    }
  }

  async function applyDeviceTime() {
    if (!deviceTime) {
      toast.error("Select a time first");
      return;
    }
    setBusy(true);
    toast.loading("Setting device time...", { id: "set-time" });
    try {
      await deviceApi.setTime(deviceTime);
      toast.success("Device time updated", { id: "set-time" });
      await refreshAll();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Set time failed", { id: "set-time" });
    } finally {
      setBusy(false);
    }
  }

  async function registerStudent(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    toast.loading("Registering and pushing student...", { id: "student" });
    try {
      const res = await studentApi.create({ ...studentForm, pushToDevice: true });
      if (!res.data.success) throw new Error(res.data.error || "Student saved but push failed");
      toast.success("Student registered and pushed to device", { id: "student" });
      setStudentForm({ ...studentForm, name: "", studentId: "RW-", studentDeviceId: "", parentPhone: "" });
      await pullUsers();
      await refreshAll();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || error?.message || "Registration failed", { id: "student" });
    } finally {
      setBusy(false);
    }
  }

  async function pushAllStudents() {
    setBusy(true);
    toast.loading("Pushing registered students...", { id: "push" });
    try {
      const res = await deviceApi.pushStudents();
      toast.success(`Pushed ${res.data.data?.pushed || 0} students`, { id: "push" });
      await pullUsers();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Push students failed", { id: "push" });
    } finally {
      setBusy(false);
    }
  }

  const statCards = [
    { title: "Students Registered", value: stats.totalStudents, icon: FiUsers, tone: "text-cyan-300 bg-cyan-500/15" },
    { title: "Attendance Today", value: stats.attendanceToday, icon: FiCheckCircle, tone: "text-emerald-300 bg-emerald-500/15" },
    { title: "Connected Devices", value: `${stats.onlineDevices}/${stats.totalDevices}`, icon: connected ? FiWifi : FiWifiOff, tone: connected ? "text-green-300 bg-green-500/15" : "text-red-300 bg-red-500/15" },
    { title: "Late Students", value: stats.lateStudents, icon: FiClock, tone: "text-amber-300 bg-amber-500/15" },
  ];

  return (
    <div className="app-shell">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 p-4 lg:flex-row lg:p-6">
        <aside className="dashboard-panel shrink-0 p-5 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-64 lg:overflow-y-auto">
          <h1 className="mb-8 text-2xl font-bold text-cyan-400">SmartAttend FK</h1>
          <nav className="space-y-3 text-sm">
            <NavItem active icon={<FiActivity />} label="Dashboard" />
            <NavItem icon={<FiUsers />} label="Students" />
            <NavItem icon={<FiServer />} label="Devices" />
            <NavItem icon={<FiCpu />} label="Biometrics" />
            <NavItem icon={<FiDatabase />} label="Attendance Logs" />
            <NavItem icon={<FiRefreshCw />} label="Device Sync" />
            <NavItem icon={<FiShield />} label="Users & Roles" />
          </nav>
        </aside>

        <main className="min-w-0 flex-1 space-y-6">
          <section className="dashboard-panel flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white xl:text-3xl">School Attendance Monitoring System</h2>
              <p className="mt-1 text-slate-400">Real-time FK biometric attendance, student registration, and device sync.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search student, device, class..." className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 outline-none focus:border-cyan-400 sm:w-80" />
              <button
                type="button"
                onClick={() => setTheme(isLight ? "dark" : "light")}
                className="secondary-action"
                aria-pressed={isLight}
                aria-label="Toggle theme"
              >
                {isLight ? <FiMoon /> : <FiSun />} {isLight ? "Dark Mode" : "Light Mode"}
              </button>
              <button onClick={() => document.getElementById("student-form")?.scrollIntoView({ behavior: "smooth" })} className="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-white transition hover:bg-cyan-400">
                Add Student
              </button>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map((item) => (
              <div key={item.title} className="metric-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">{item.title}</p>
                    <h3 className="mt-2 text-3xl font-bold">{item.value}</h3>
                  </div>
                  <div className={`rounded-xl p-4 text-3xl ${item.tone}`}><item.icon /></div>
                </div>
              </div>
            ))}
          </section>

          <section className="dashboard-panel p-6">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-2xl font-bold">Live Attendance Logs</h3>
                <p className="text-sm text-slate-400">Pull all logs for reliability, or only new logs for quick sync.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="form-field w-auto min-w-40 py-2">
                  <option>All Methods</option>
                  <option>Face Recognition</option>
                  <option>Fingerprint</option>
                  <option>RFID Card</option>
                  <option>Password/PIN</option>
                  <option>Device Verified</option>
                </select>
                <select value={readMode} onChange={(e) => setReadMode(Number(e.target.value))} className="form-field w-auto min-w-40 py-2">
                  <option value={0}>All Logs</option>
                  <option value={1}>New Logs</option>
                </select>
                <button onClick={pullLogs} disabled={busy || !connected} className="primary-action disabled:cursor-not-allowed">
                  <FiDownloadCloud /> Pull Device Logs
                </button>
              </div>
            </div>
            <div className="-mx-2 overflow-x-auto px-2">
              <table className="data-table">
                <thead>
                  <tr className="text-slate-400">
                    <th className="pb-4">Student</th>
                    <th className="pb-4">Student ID</th>
                    <th className="pb-4">Class</th>
                    <th className="pb-4">Device ID</th>
                    <th className="pb-4">Authentication Method</th>
                    <th className="pb-4">Time</th>
                    <th className="pb-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length ? filteredLogs.map((log) => (
                    <tr key={log.id} className="transition">
                      <td className="py-4 font-medium">{log.studentName}</td>
                      <td>{log.studentId || "-"}</td>
                      <td>{[log.className, log.section].filter(Boolean).join(" ") || "-"}</td>
                      <td><span className="rounded-full bg-cyan-500/20 px-3 py-1 text-sm text-cyan-300">{log.deviceId}</span></td>
                      <td>{log.authenticationMethod}</td>
                      <td>{new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                      <td><StatusPill status={resolveStatusLabel(log)} /></td>
                    </tr>
                  )) : <tr><td colSpan={7} className="py-8 text-center text-slate-500">No attendance logs loaded yet</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
            <div className="dashboard-panel p-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-2xl font-bold">Connected Device</h3>
                <span className={`rounded-full px-3 py-1 text-sm ${connected ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}>{connected ? "Online" : "Offline"}</span>
              </div>

              <form onSubmit={connectDevice} className="grid gap-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Device ID" value={deviceForm.deviceId} onChange={(value) => setDeviceForm({ ...deviceForm, deviceId: value })} />
                  <Field label="Location" value={deviceForm.location} onChange={(value) => setDeviceForm({ ...deviceForm, location: value })} />
                  <Field label="IP Address" value={deviceForm.ipAddress} onChange={(value) => setDeviceForm({ ...deviceForm, ipAddress: value })} />
                  <Field label="Port" type="number" value={deviceForm.port} onChange={(value) => setDeviceForm({ ...deviceForm, port: Number(value) })} />
                  <Field label="License" type="number" value={deviceForm.license} onChange={(value) => setDeviceForm({ ...deviceForm, license: Number(value) })} />
                  <Field label="Set Time" type="datetime-local" value={deviceTime} onChange={setDeviceTime} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm xl:grid-cols-4">
                  <Info label="Serial" value={device?.serialNumber || "-"} />
                  <Info label="Product" value={device?.productName || device?.productCode || "-"} />
                  <Info label="Users" value={String(device?.users || 0)} />
                  <Info label="Logs" value={String(device?.logs || 0)} />
                </div>
                <div className="flex flex-wrap gap-3">
                  <button disabled={busy} className="primary-action">Connect</button>
                  <button type="button" onClick={pullUsers} disabled={busy || !connected} className="secondary-action">Pull Users</button>
                  <button type="button" onClick={syncTime} disabled={busy || !connected} className="secondary-action">Sync Time</button>
                  <button type="button" onClick={applyDeviceTime} disabled={busy || !connected} className="secondary-action">Set Time</button>
                </div>
              </form>
            </div>

            <div id="student-form" className="dashboard-panel p-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-2xl font-bold">Student Registration</h3>
                <button onClick={pushAllStudents} disabled={busy || !connected} className="primary-action bg-emerald-500 hover:bg-emerald-300">
                  <FiUploadCloud /> Sync All Students
                </button>
              </div>

              <form onSubmit={registerStudent} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Student Full Name" value={studentForm.name} onChange={(value) => setStudentForm({ ...studentForm, name: value })} required />
                  <Field label="Student ID (Rwanda)" value={studentForm.studentId} onChange={(value) => setStudentForm({ ...studentForm, studentId: value.toUpperCase() })} placeholder="RW-0001" required />
                  <Field label="Student Device ID" value={studentForm.studentDeviceId} onChange={(value) => setStudentForm({ ...studentForm, studentDeviceId: value })} placeholder="1001" required />
                  <Field label="Parent Phone" value={studentForm.parentPhone} onChange={(value) => setStudentForm({ ...studentForm, parentPhone: value })} />
                  <SelectField label="Class" value={studentForm.className} onChange={(value) => setStudentForm({ ...studentForm, className: value })} options={classes} />
                  <Field label="Section" value={studentForm.section} onChange={(value) => setStudentForm({ ...studentForm, section: value })} />
                </div>

                <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
                  <h4 className="mb-3 font-semibold">Biometrics Found / Supported</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <Bio icon={<FiUsers />} label="Face Recognition" active={Boolean(device?.faces)} />
                    <Bio icon={<FiCpu />} label="Fingerprint" active={Boolean(device?.fingerprints)} />
                    <Bio icon={<FiCreditCard />} label="RFID Card" active={Boolean(device?.cards)} />
                    <Bio icon={<FiLock />} label="Password / PIN" active={Boolean((device as any)?.passwords)} />
                  </div>
                </div>

                <button disabled={busy || !connected} className="primary-action w-full py-4 text-base">
                  Register and Push to Device
                </button>
              </form>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
            <div className="dashboard-panel p-6">
              <h3 className="mb-5 text-2xl font-bold">Pulled Device Users</h3>
              <div className="space-y-3">
                {deviceUsers.length ? deviceUsers.map((user) => (
                  <div key={user.userId} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="font-bold">{user.name || `Device User ${user.userId}`}</h4>
                        <p className="text-sm text-slate-400">Student Device ID: {user.userId}</p>
                      </div>
                      <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-sm text-cyan-300">{user.enabled ? "Enabled" : "Disabled"}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {user.biometricMethods.map((method) => <span key={method} className="rounded-full bg-slate-900 px-3 py-1 text-xs text-slate-300">{method}</span>)}
                    </div>
                  </div>
                )) : <p className="py-8 text-center text-slate-500">Click Pull Users to read users and biometric methods from the device.</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/15 to-indigo-500/15 p-6">
              <h3 className="mb-4 text-2xl font-bold">Important Information Visible in This System</h3>
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <Feature label="Authentication method used" />
                <Feature label="Device ID used during attendance" />
                <Feature label="Student ID starts with RW" />
                <Feature label="Separate Student Device ID" />
                <Feature label="Class and section" />
                <Feature label="Sync status for pushed students and pulled logs" />
              </div>
            </div>
          </section>

          <section className="dashboard-panel p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-2xl font-bold">Attendance Rules</h3>
                <p className="text-sm text-slate-400">Update default time windows for morning and evening attendance.</p>
              </div>
              <button type="button" onClick={saveAttendanceSettings} disabled={!settingsDraft || savingSettings} className="primary-action">
                {savingSettings ? "Saving..." : "Save Rules"}
              </button>
            </div>

            {settingsDraft ? (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-5">
                  <Field label="Morning Label" value={settingsDraft.morning.name} onChange={(value) => updatePeriodName("morning", value)} />
                  <div className="mt-4 space-y-4">
                    {settingsDraft.morning.rules.map((rule, index) => (
                      <div key={`morning-${index}`} className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <Field label="Status" value={rule.label} onChange={(value) => updateRule("morning", index, "label", value)} />
                        <Field label="Start" type="time" value={rule.start} onChange={(value) => updateRule("morning", index, "start", value)} />
                        <Field label="End" type="time" value={rule.end} onChange={(value) => updateRule("morning", index, "end", value)} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-5">
                  <Field label="Evening Label" value={settingsDraft.evening.name} onChange={(value) => updatePeriodName("evening", value)} />
                  <div className="mt-4 space-y-4">
                    {settingsDraft.evening.rules.map((rule, index) => (
                      <div key={`evening-${index}`} className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <Field label="Status" value={rule.label} onChange={(value) => updateRule("evening", index, "label", value)} />
                        <Field label="Start" type="time" value={rule.start} onChange={(value) => updateRule("evening", index, "start", value)} />
                        <Field label="End" type="time" value={rule.end} onChange={(value) => updateRule("evening", index, "end", value)} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-slate-500">Loading attendance rules...</p>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return <div className={`flex items-center gap-3 rounded-xl p-3 font-medium transition ${active ? "border border-cyan-500 bg-cyan-500/20 text-white" : "text-slate-300 hover:bg-slate-800"}`}>{icon}{label}</div>;
}

function Field({ label, value, onChange, type = "text", placeholder, required = false }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return <label className="block"><span className="mb-1 block text-sm text-slate-400">{label}</span><input required={required} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="form-field" /></label>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="block"><span className="mb-1 block text-sm text-slate-400">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="form-field">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-700 bg-slate-800 p-3"><p className="text-xs uppercase text-slate-500">{label}</p><p className="mt-1 truncate font-semibold text-slate-200">{value}</p></div>;
}

function Bio({ icon, label, active }: { icon: React.ReactNode; label: string; active: boolean }) {
  return <div className={`flex items-center gap-3 rounded-xl border p-4 ${active ? "border-cyan-500/40 bg-slate-900 text-cyan-200" : "border-slate-700 bg-slate-900/60 text-slate-400"}`}>{icon}<span>{label}</span></div>;
}

function StatusPill({ status }: { status: string }) {
  const late = status.toLowerCase().includes("late");
  return <span className={`rounded-full px-3 py-1 text-sm ${late ? "bg-yellow-500/20 text-yellow-300" : "bg-green-500/20 text-green-300"}`}>{status}</span>;
}

function Feature({ label }: { label: string }) {
  return <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 text-slate-200">{label}</div>;
}



