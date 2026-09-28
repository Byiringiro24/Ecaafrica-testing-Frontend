import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Loader2, Search, Trash2, UserPlus, Wifi, WifiOff, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Avatar } from "@/components/ui-kit/Avatar";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/boarding/device-students")({ component: DeviceStudentsPage });

const STUDENTS_PER_PAGE = 10;

type Device = {
  id: string;
  name: string;
  location: string;
  maxUsers: number;
  lastSync: string;
  lastSyncStatus?: string | null;
  lastStatusMessage?: string | null;
  tabletId?: string | null;
  deviceUsersCount?: number;
  deviceLogsCount?: number;
  isConnected?: boolean;
};

type ClassRecord = {
  id: string;
  name: string;
};

type DeviceStatus = {
  connected?: boolean;
  users?: number;
  logs?: number;
  message?: string;
  deviceId?: string;
  serialNumber?: string;
  productName?: string;
  ipAddress?: string;
  last_sync_at?: string | null;
  last_sync_status?: string | null;
};

type Student = {
  id: string;
  name: string;
  className: string;
  classId?: string | null;
  residency: "Boarding" | "Day";
  gender?: "male" | "female" | null;
  deviceUserId?: string | null;
  deviceSyncStatus?: string | null;
  lastDeviceSync?: string | null;
};

const getDeviceSyncState = (status?: string | null) => {
  const normalized = status?.trim().toLowerCase();
  if (!normalized) return null;

  if (["syncing", "pending", "in_progress", "processing"].includes(normalized)) {
    return { label: "In Progress", tone: "bg-amber-100 text-amber-800 border border-amber-200" };
  }
  if (normalized === "partial") {
    return { label: "Partial", tone: "bg-orange-100 text-orange-800 border border-orange-200" };
  }
  if (normalized === "failed") {
    return { label: "Failed", tone: "bg-red-100 text-red-800 border border-red-200" };
  }
  if (normalized === "synced") {
    return { label: "Synced", tone: "bg-emerald-100 text-emerald-800 border border-emerald-200" };
  }
  return {
    label: normalized.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
    tone: "bg-slate-100 text-slate-700 border border-slate-200"
  };
};

function DeviceStudentsPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [classFilter, setClassFilter] = useState("All");
  const [residencyFilter, setResidencyFilter] = useState<"All" | "Boarding" | "Day">("All");
  const [genderFilter, setGenderFilter] = useState<"All" | "male" | "female">("All");
  const [search, setSearch] = useState("");
  const [showAssignedOnly, setShowAssignedOnly] = useState(false);
  const [studentPage, setStudentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<{ type: "push-selected" | "push-class" | "push-all" | "push-single" | "remove"; id?: string } | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);

  // ── Delete modal state ────────────────────────────────────────────────────
  type DeleteTarget =
    | { mode: "single";    student: Student }
    | { mode: "selected";  count: number; ids: string[] }
    | { mode: "class";     className: string; classId: string }
    | { mode: "all";       count: number };
  const [deleteTarget,   setDeleteTarget]   = useState<DeleteTarget | null>(null);
  const [deleteStep,     setDeleteStep]     = useState<1 | 2>(1);   // step 1 = first confirm, step 2 = final confirm
  const [deleting,       setDeleting]       = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [deviceData, classData, studentsData] = await Promise.all([
          apiRequest<any[]>("/devices?limit=500&sort=created_at&order=desc", { auth: "school" }),
          apiRequest<ClassRecord[]>("/classes?limit=500", { auth: "school" }),
          apiRequest<any[]>("/students?limit=5000&status=active", { auth: "school" }),
        ]);

        const mappedDevices = (Array.isArray(deviceData) ? deviceData : []).map((device) => ({
          id: device.id,
          name: device.name,
          location: device.location ?? "—",
          maxUsers: 200,
          lastSync: device.last_sync_at ? new Date(device.last_sync_at).toLocaleString() : "No sync yet",
          lastSyncStatus: device.last_sync_status ?? null,
          lastStatusMessage: device.last_status_message ?? null,
          tabletId: device.tablet_id ?? null,
          deviceUsersCount: Number(device.device_users_count ?? 0),
          deviceLogsCount: Number(device.device_logs_count ?? 0),
          isConnected: Boolean(device.is_connected || device.status === "online"),
        }));

        const mappedStudents = (Array.isArray(studentsData) ? studentsData : []).map((student): Student => ({
          id: student.id,
          name: `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim(),
          className: student.current_section?.full_name ?? student.current_section?.name ?? student.class ?? "—",
          classId: student.current_section?.class_id ?? null,
          residency: student.student_type === "boarding" ? "Boarding" : "Day",
          gender: student.gender ?? null,
          deviceUserId: student.device_user_id ?? null,
          deviceSyncStatus: student.device_sync_status ?? null,
          lastDeviceSync: student.last_device_sync ?? null,
        }));

        setDevices(mappedDevices);
        setClasses((Array.isArray(classData) ? classData : []).map((item) => ({ id: item.id, name: item.name })));
        setStudents(mappedStudents);
      } catch (error: any) {
        toast.error(error?.message ?? "Failed to load device student data");
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  useEffect(() => {
    if (!deviceId) return;

    const loadSelectedDeviceStatus = async () => {
      try {
        const result = await apiRequest<any>(`/devices/${deviceId}/status`, { auth: "school" });
        const status = result?.device_status ?? result?.data?.device_status ?? result?.data ?? result;
        setDeviceStatus({
          connected: Boolean(status?.connected ?? result?.is_connected ?? result?.is_online),
          users: Number(status?.users ?? result?.device_users_count ?? result?.users ?? 0),
          logs: Number(status?.logs ?? result?.device_logs_count ?? result?.logs ?? 0),
          message: status?.message ?? result?.message ?? result?.last_status_message ?? null,
          deviceId: status?.deviceId ?? result?.device_uid,
          serialNumber: status?.serialNumber,
          productName: status?.productName ?? result?.product_name,
          ipAddress: status?.ipAddress ?? result?.tablet_ip,
          last_sync_at: result?.last_sync_at ?? result?.lastSyncAt ?? status?.last_sync_at ?? null,
          last_sync_status: result?.last_sync_status ?? status?.last_sync_status ?? null,
        });
      } catch {
        setDeviceStatus(null);
      }
    };

    void loadSelectedDeviceStatus();
    // Also reload students so device_sync_status reflects the newly selected device
    void loadStudents();
    setSelectedIds(new Set());
  }, [deviceId]);

  const device = devices.find((item) => item.id === deviceId) ?? devices[0];
  const classOptions = useMemo(
    () => classes.slice().sort((left, right) => left.name.localeCompare(right.name)),
    [classes]
  );
  const assignedStudents = useMemo(
    () => students.filter((student) => student.deviceSyncStatus === "synced"),
    [students]
  );
  const assignedIds = useMemo(() => new Set(assignedStudents.map((student) => student.id)), [assignedStudents]);

  const filteredStudents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return students.filter((student) => {
      const matchesClass = classFilter === "All" || student.classId === classFilter;
      const matchesResidency = residencyFilter === "All" || student.residency === residencyFilter;
      const matchesGender = genderFilter === "All" || student.gender === genderFilter;
      const searchable = `${student.name} ${student.className} ${student.id} ${student.deviceUserId ?? ""}`.toLowerCase();
      const matchesSearch = normalizedSearch === "" || searchable.includes(normalizedSearch);
      const matchesAssigned = !showAssignedOnly || assignedIds.has(student.id);
      return matchesClass && matchesResidency && matchesGender && matchesSearch && matchesAssigned;
    });
  }, [assignedIds, classFilter, residencyFilter, genderFilter, search, showAssignedOnly, students]);

  const studentPageCount = Math.max(1, Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE));
  const paginatedStudents = useMemo(() => {
    const start = (studentPage - 1) * STUDENTS_PER_PAGE;
    return filteredStudents.slice(start, start + STUDENTS_PER_PAGE);
  }, [filteredStudents, studentPage]);

  useEffect(() => {
    setStudentPage(1);
  }, [classFilter, residencyFilter, genderFilter, search, showAssignedOnly, deviceId]);

  useEffect(() => {
    setStudentPage((page) => Math.min(page, studentPageCount));
  }, [studentPageCount]);

  const assignedList = useMemo(() => students.filter((student) => assignedIds.has(student.id)), [assignedIds, students]);
  const boardersAssigned = assignedList.filter((student) => student.residency === "Boarding").length;
  const dayAssigned = assignedList.filter((student) => student.residency === "Day").length;
  const assignedCount = assignedList.length;
  const capacity = device?.maxUsers ?? 200;
  const unassigned = Math.max(0, students.length - assignedList.length);
  const selectedDeviceLabel = device?.name ?? (deviceId ? "Selected device" : "No device selected");
  const selectedDeviceLocation = device?.location ?? "—";
  const selectedDeviceLastSync = deviceStatus?.last_sync_at ? new Date(deviceStatus.last_sync_at).toLocaleString() : device?.lastSync ?? "No sync yet";
  const selectedDeviceIsOnline = Boolean(deviceStatus?.connected ?? device?.isConnected);
  const selectedDeviceStatusLabel = selectedDeviceIsOnline ? "Online" : "Offline";
  const selectedDeviceSyncState = getDeviceSyncState(deviceStatus?.last_sync_status ?? device?.lastSyncStatus ?? null);
  const selectedDeviceSyncMessage = deviceStatus?.message ?? device?.lastStatusMessage ?? "No push activity yet";
  const hasSelectedDevice = Boolean(deviceId);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (filteredStudents.length === 0) return;
    const allSelected = filteredStudents.every((student) => selectedIds.has(student.id));
    setSelectedIds(allSelected ? new Set() : new Set(filteredStudents.map((student) => student.id)));
  };

  const loadStudents = async () => {
    const studentsData = await apiRequest<any[]>("/students?limit=5000&status=active", { auth: "school" });
    const mappedStudents = (Array.isArray(studentsData) ? studentsData : []).map((student): Student => ({
      id: student.id,
      name: `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim(),
      className: student.current_section?.full_name ?? student.current_section?.name ?? student.class ?? "—",
      classId: student.current_section?.class_id ?? null,
      residency: student.student_type === "boarding" ? "Boarding" : "Day",
      gender: student.gender ?? null,
      deviceUserId: student.device_user_id ?? null,
      deviceSyncStatus: student.device_sync_status ?? null,
      lastDeviceSync: student.last_device_sync ?? null,
    }));
    setStudents(mappedStudents);
  };

  const loadSelectedDeviceStatus = async () => {
    if (!deviceId) return;
    const result = await apiRequest<any>(`/devices/${deviceId}/status`, { auth: "school" });
    const status = result?.device_status ?? result?.data?.device_status ?? result?.data ?? result;
    setDeviceStatus({
      connected: Boolean(status?.connected ?? result?.is_connected ?? result?.is_online),
      users: Number(status?.users ?? result?.device_users_count ?? result?.users ?? 0),
      logs: Number(status?.logs ?? result?.device_logs_count ?? result?.logs ?? 0),
      message: status?.message ?? result?.message ?? result?.last_status_message ?? null,
      deviceId: status?.deviceId ?? result?.device_uid,
      serialNumber: status?.serialNumber,
      productName: status?.productName ?? result?.product_name,
      ipAddress: status?.ipAddress ?? result?.tablet_ip,
      last_sync_at: result?.last_sync_at ?? result?.lastSyncAt ?? status?.last_sync_at ?? null,
      last_sync_status: result?.last_sync_status ?? status?.last_sync_status ?? null,
    });
  };

  const pushStudents = async (studentIds: string[], actionType: "push-selected" | "push-class" | "push-all" | "push-single", actionId?: string) => {
    if (!deviceId) {
      toast.error("Select a device first");
      return;
    }
    if (actionType !== "push-class" && actionType !== "push-all" && studentIds.length === 0) {
      toast.error("Select at least one student");
      return;
    }

    setBusyAction({ type: actionType, id: actionId });
    try {
      const genderParam = genderFilter !== "All" ? { gender: genderFilter } : {};
      const body =
        actionType === "push-all"
          ? JSON.stringify({ mode: "all", ...genderParam })
          : actionType === "push-class"
            ? JSON.stringify({ mode: "class", class_id: classFilter, ...genderParam })
            : JSON.stringify({ mode: "selected", student_ids: studentIds });
      const result = await apiRequest<any>(`/devices/${deviceId}/push-students`, {
        method: "POST",
        auth: "school",
        body,
      });
      const pushed = result?.pushed_count ?? result?.data?.pushed_count ?? 0;
      const failed = result?.failed_count ?? result?.data?.failed_count ?? 0;
      const selected = result?.selected_count ?? result?.data?.selected_count ?? studentIds.length;
      if (failed > 0) {
        toast.warning(`Pushed ${pushed}/${selected} student(s) to ${device?.name ?? selectedDeviceLabel}. ${failed} failed.`);
      } else {
        toast.success(`Pushed ${pushed}/${selected} student(s) to ${device?.name ?? selectedDeviceLabel}`);
      }
      setSelectedIds(new Set());
      await Promise.all([loadStudents(), loadSelectedDeviceStatus()]);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to push selected students");
    } finally {
      setBusyAction(null);
    }
  };

  const pushSelected = async () => {
    await pushStudents(Array.from(selectedIds), "push-selected");
  };

  const pushCurrentClass = async () => {
    if (classFilter === "All") {
      toast.error("Choose a class first");
      return;
    }
    await pushStudents([], "push-class");
  };

  const pushAllAssigned = async () => {
    // Send mode:all — backend fetches all active students for this school
    await pushStudents([], "push-all");
  };

  const pushSingleStudent = async (studentId: string) => {
    await pushStudents([studentId], "push-single", studentId);
  };

  const removeStudent = async (student: Student) => {
    // Open double-confirm modal for single student
    setDeleteTarget({ mode: "single", student });
    setDeleteStep(1);
  };

  const removeSelected = () => {
    if (selectedIds.size === 0) { toast.error("Select at least one student first"); return; }
    setDeleteTarget({ mode: "selected", count: selectedIds.size, ids: Array.from(selectedIds) });
    setDeleteStep(1);
  };

  const removeCurrentClass = () => {
    if (classFilter === "All") { toast.error("Choose a class first"); return; }
    const cls = classOptions.find(c => c.id === classFilter);
    setDeleteTarget({ mode: "class", className: cls?.name ?? classFilter, classId: classFilter });
    setDeleteStep(1);
  };

  const removeAllAssigned = () => {
    if (assignedCount === 0) { toast.error("No assigned students to remove"); return; }
    setDeleteTarget({ mode: "all", count: assignedCount });
    setDeleteStep(1);
  };

  /** Called when user clicks the final "Confirm delete" in step 2 */
  const executeDelete = async () => {
    if (!deleteTarget || !deviceId) return;
    setDeleting(true);
    try {
      let body: Record<string, unknown>;
      if (deleteTarget.mode === "single") {
        body = { mode: "selected", student_ids: [deleteTarget.student.id] };
      } else if (deleteTarget.mode === "selected") {
        body = { mode: "selected", student_ids: deleteTarget.ids };
      } else if (deleteTarget.mode === "class") {
        body = { mode: "class", class_id: deleteTarget.classId };
      } else {
        body = { mode: "all" };
      }

      const result = await apiRequest<any>(`/devices/${deviceId}/remove-students`, {
        method: "POST",
        auth: "school",
        body: JSON.stringify(body),
      });
      const removed = result?.removed_count ?? result?.data?.removed_count ?? 0;
      const failed  = result?.failed_count  ?? result?.data?.failed_count  ?? 0;
      if (failed > 0) {
        toast.warning(`Removed ${removed} students. ${failed} failed — device may be offline.`);
      } else {
        toast.success(`${removed} student${removed !== 1 ? "s" : ""} removed from device and fingerprints deleted.`);
      }
      setDeleteTarget(null);
      setSelectedIds(new Set());
      await Promise.all([loadStudents(), loadSelectedDeviceStatus()]);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to remove students from device");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Device Students" subtitle="Assign boarding and day students to biometric devices">
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
          Loading device students...
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Device Students" subtitle="Assign boarding and day students to biometric devices">
      {!hasSelectedDevice && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Select a device to enable push and remove actions.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard label="Assigned Students" value={assignedCount} tone="success" icon={<UserPlus className="h-5 w-5" />} />
        <StatCard label="Boarding" value={boardersAssigned} />
        <StatCard label="Day Students" value={dayAssigned} />
        <StatCard label="Unassigned" value={unassigned} tone="warning" />
        <StatCard
          label="Device Status"
          value={selectedDeviceStatusLabel}
          tone={selectedDeviceIsOnline ? "success" : "warning"}
          icon={selectedDeviceIsOnline ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-3 items-center mb-5">
        <select
          value={deviceId}
          onChange={(event) => setDeviceId(event.target.value)}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="">Select a device</option>
          {devices.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <select
          value={classFilter}
          onChange={(event) => setClassFilter(event.target.value)}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="All">All Classes</option>
          {classOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select
          value={residencyFilter}
          onChange={(event) => setResidencyFilter(event.target.value as "All" | "Boarding" | "Day")}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="All">All Students</option>
          <option value="Boarding">Boarding</option>
          <option value="Day">Day</option>
        </select>
        <select
          value={genderFilter}
          onChange={(event) => setGenderFilter(event.target.value as "All" | "male" | "female")}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="All">All Genders</option>
          <option value="male">Boys</option>
          <option value="female">Girls</option>
        </select>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showAssignedOnly}
            onChange={(event) => setShowAssignedOnly(event.target.checked)}
          />
          Show assigned only
        </label>
        <div className="relative flex-1 min-w-50">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search students"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={pushSelected}
          disabled={!hasSelectedDevice || Boolean(busyAction)}
          className="h-10 inline-flex items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busyAction?.type === "push-selected" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Push Selected
        </button>
        <button
          type="button"
          onClick={pushCurrentClass}
          disabled={!hasSelectedDevice || Boolean(busyAction) || classFilter === "All"}
          className="h-10 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
        >
          {busyAction?.type === "push-class" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />} Push Class
        </button>
        {/* ── Remove buttons ── */}
        {selectedIds.size > 0 && (
          <button type="button" onClick={removeSelected} disabled={!hasSelectedDevice}
            className="h-10 inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 text-sm font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50">
            <Trash2 className="h-4 w-4" /> Remove Selected ({selectedIds.size})
          </button>
        )}
        {classFilter !== "All" && (
          <button type="button" onClick={removeCurrentClass} disabled={!hasSelectedDevice}
            className="h-10 inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 text-sm font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50">
            <Trash2 className="h-4 w-4" /> Remove Class
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-5">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold">Student Assignment</h3>
              <p className="text-xs text-muted-foreground">Select students and assign them to {device?.name ?? selectedDeviceLabel}.</p>
            </div>
            <div className="text-xs text-muted-foreground">
              Selected: <span className="font-semibold text-foreground">{selectedIds.size}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-5 py-3">
                    <input
                      type="checkbox"
                      checked={filteredStudents.length > 0 && filteredStudents.every((student) => selectedIds.has(student.id))}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="text-left px-5 py-3">Student</th>
                  <th className="text-left px-5 py-3">Class</th>
                  <th className="text-left px-5 py-3">Residency</th>
                  <th className="text-left px-5 py-3">Assignment</th>
                  <th className="text-left px-5 py-3">Gender</th>
                  <th className="text-right px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map((student) => {
                  const assigned = assignedIds.has(student.id);
                  return (
                    <tr key={student.id} className="border-t border-border odd:bg-background even:bg-muted/20">
                      <td className="px-5 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(student.id)}
                          onChange={() => toggleSelect(student.id)}
                        />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={student.name} size="sm" />
                          <div>
                            <div className="font-medium">{student.name}</div>
                            <div className="text-xs text-muted-foreground">{student.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">{student.className}</td>
                      <td className="px-5 py-3"><ResidencyBadge residency={student.residency} /></td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${student.gender === "male" ? "bg-blue-100 text-blue-700" : student.gender === "female" ? "bg-pink-100 text-pink-700" : "bg-muted text-muted-foreground"}`}>
                          {student.gender === "male" ? "Boy" : student.gender === "female" ? "Girl" : "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3"><AssignmentBadge assigned={assigned} /></td>
                      <td className="px-5 py-3 text-right">
                        {assigned ? (
                          <button
                            type="button"
                            onClick={() => removeStudent(student)}
                            className="text-xs font-semibold text-destructive hover:underline disabled:opacity-50"
                            disabled={Boolean(busyAction)}
                          >
                            {busyAction?.type === "remove" && busyAction.id === student.id ? (
                              <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Removing</span>
                            ) : (
                              "Remove"
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => pushSingleStudent(student.id)}
                            className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                            disabled={Boolean(busyAction)}
                          >
                            {busyAction?.type === "push-single" && busyAction.id === student.id ? (
                              <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Adding</span>
                            ) : (
                              "Add"
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">No students match your filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredStudents.length > 0 && (
            <div className="flex items-center justify-between border-t border-border px-5 py-3">
              <p className="text-xs text-muted-foreground">
                Showing {(studentPage - 1) * STUDENTS_PER_PAGE + 1}–{Math.min(studentPage * STUDENTS_PER_PAGE, filteredStudents.length)} of {filteredStudents.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStudentPage((page) => Math.max(1, page - 1))}
                  disabled={studentPage === 1}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="min-w-16 text-center text-xs text-muted-foreground">
                  Page {studentPage} of {studentPageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setStudentPage((page) => Math.min(studentPageCount, page + 1))}
                  disabled={studentPage === studentPageCount}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Selected device</div>
                <div className="font-display font-bold text-lg mt-1">{selectedDeviceLabel}</div>
                <div className="text-xs text-muted-foreground">{selectedDeviceLocation} - Last sync {selectedDeviceLastSync}</div>
              </div>
              <button
                type="button"
                onClick={pushAllAssigned}
                disabled={!hasSelectedDevice || Boolean(busyAction)}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
              >
                {busyAction?.type === "push-all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />} Push All
              </button>
              {assignedCount > 0 && (
                <button type="button" onClick={removeAllAssigned} disabled={!hasSelectedDevice}
                  className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50">
                  <Trash2 className="h-4 w-4" /> Remove All
                </button>
              )}            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <InfoItem label="Assigned" value={String(assignedCount)} />
              <InfoItem label="Capacity" value={`${assignedCount}/${capacity}`} />
              <InfoItem label="Boarding" value={String(boardersAssigned)} />
              <InfoItem label="Day" value={String(dayAssigned)} />
            </div>
            <div className="mt-4 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
              {selectedDeviceIsOnline ? "Device online" : "Device offline"}
              {deviceStatus?.message || device?.lastStatusMessage ? ` - ${deviceStatus?.message ?? device?.lastStatusMessage}` : ""}
            </div>
            {selectedDeviceSyncState && (
              <div className="mt-3 rounded-lg px-3 py-2 text-xs">
                <span className={`inline-flex items-center rounded-full px-2 py-1 font-semibold ${selectedDeviceSyncState.tone}`}>
                  {selectedDeviceSyncState.label}
                </span>
                <span className="ml-2 text-muted-foreground">{selectedDeviceSyncMessage}</span>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-display font-bold">Assigned Students</h4>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" /> Clear Selection
              </button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {assignedList.slice(0, 10).map((student) => (
                <div key={student.id} className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2">
                  <Avatar name={student.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{student.name}</div>
                    <div className="text-xs text-muted-foreground">{student.className} - {student.residency}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeStudent(student)}
                    className="text-xs font-semibold text-destructive hover:underline disabled:opacity-50"
                    disabled={Boolean(busyAction)}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {assignedList.length === 0 && (
                <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  No students assigned to this device yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Double-confirm delete modal ── */}
      {deleteTarget && (
        <DeleteConfirmModal
          target={deleteTarget}
          step={deleteStep}
          deleting={deleting}
          onStepUp={() => setDeleteStep(2)}
          onConfirm={() => void executeDelete()}
          onCancel={() => { setDeleteTarget(null); setDeleteStep(1); }}
          deviceName={device?.name ?? selectedDeviceLabel}
        />
      )}
    </AppLayout>
  );
}

// ── Double-confirm delete modal ───────────────────────────────────────────────
// (rendered at the bottom, outside AppLayout so it covers the full screen)
function DeleteConfirmModal({
  target,
  step,
  deleting,
  onStepUp,
  onConfirm,
  onCancel,
  deviceName,
}: {
  target: { mode: string; student?: { name: string }; count?: number; className?: string };
  step: 1 | 2;
  deleting: boolean;
  onStepUp: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  deviceName: string;
}) {
  const label =
    target.mode === "single"   ? `${target.student!.name}` :
    target.mode === "selected" ? `${target.count} selected students` :
    target.mode === "class"    ? `all students in class "${(target as any).className}"` :
                                 `all ${target.count} assigned students`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-destructive/40 bg-card p-6 shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-destructive/15 text-destructive shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg">
              {step === 1 ? "Remove from device?" : "Are you absolutely sure?"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {step === 1 ? "Confirm to proceed" : "This cannot be undone — click once more to confirm"}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm space-y-1">
          <p className="font-semibold text-destructive">You are about to remove {label}</p>
          <p className="text-muted-foreground">from device: <span className="font-semibold text-foreground">{deviceName}</span></p>
          <p className="text-muted-foreground text-xs mt-1.5">
            This will <strong>delete their fingerprints</strong> from the FK623 device.
            Their records in the school database are not affected — you can re-push them at any time.
          </p>
        </div>

        {step === 1 ? (
          <div className="flex gap-3">
            <button type="button" onClick={onStepUp}
              className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-semibold text-white hover:bg-destructive/90">
              Yes, remove from device
            </button>
            <button type="button" onClick={onCancel}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button type="button" onClick={onConfirm} disabled={deleting}
              className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-bold text-white hover:bg-destructive/90 disabled:opacity-60 inline-flex items-center justify-center gap-2">
              {deleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</> : "Confirm — delete fingerprints now"}
            </button>
            <button type="button" onClick={onCancel} disabled={deleting}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ResidencyBadge({ residency }: { residency: Student["residency"] }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
        residency === "Boarding" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
      )}
    >
      {residency}
    </span>
  );
}

function AssignmentBadge({ assigned }: { assigned: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
        assigned ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
      )}
    >
      {assigned ? "Assigned" : "Not Assigned"}
    </span>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
