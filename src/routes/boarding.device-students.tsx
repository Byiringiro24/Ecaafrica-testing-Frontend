import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Loader2, Search, UserPlus, Wifi, WifiOff, X } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Avatar } from "@/components/ui-kit/Avatar";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/boarding/device-students")({ component: DeviceStudentsPage });

type Device = {
  id: string;
  name: string;
  location: string;
  maxUsers: number;
  lastSync: string;
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
};

type Student = {
  id: string;
  name: string;
  className: string;
  classId?: string | null;
  residency: "Boarding" | "Day";
  deviceUserId?: string | null;
  deviceSyncStatus?: string | null;
  lastDeviceSync?: string | null;
};

function DeviceStudentsPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [classFilter, setClassFilter] = useState("All");
  const [residencyFilter, setResidencyFilter] = useState<"All" | "Boarding" | "Day">("All");
  const [search, setSearch] = useState("");
  const [showAssignedOnly, setShowAssignedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<{ type: "push-selected" | "push-class" | "push-all" | "push-single" | "remove"; id?: string } | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [deviceData, classData, studentsData] = await Promise.all([
          apiRequest<any[]>("/devices?limit=500&sort=created_at&order=desc", { auth: "school" }),
          apiRequest<ClassRecord[]>("/classes?limit=500", { auth: "school" }),
          apiRequest<any[]>("/students?limit=5000", { auth: "school" }),
        ]);

        const mappedDevices = (Array.isArray(deviceData) ? deviceData : []).map((device) => ({
          id: device.id,
          name: device.name,
          location: device.location ?? "—",
          maxUsers: 200,
          lastSync: device.last_sync_at ? new Date(device.last_sync_at).toLocaleString() : "No sync yet",
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
          deviceUserId: student.device_user_id ?? null,
          deviceSyncStatus: student.device_sync_status ?? null,
          lastDeviceSync: student.last_device_sync ?? null,
        }));

        setDevices(mappedDevices);
        setClasses((Array.isArray(classData) ? classData : []).map((item) => ({ id: item.id, name: item.name })));
        setStudents(mappedStudents);
        if (!deviceId && mappedDevices[0]) setDeviceId(mappedDevices[0].id);
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
          message: status?.message ?? result?.message,
          deviceId: status?.deviceId ?? result?.device_uid,
          serialNumber: status?.serialNumber,
          productName: status?.productName ?? result?.product_name,
          ipAddress: status?.ipAddress ?? result?.tablet_ip,
          last_sync_at: result?.last_sync_at ?? result?.lastSyncAt ?? status?.last_sync_at ?? null,
        });
      } catch {
        setDeviceStatus(null);
      }
    };

    void loadSelectedDeviceStatus();
    setSelectedIds(new Set());
  }, [deviceId]);

  const device = devices.find((item) => item.id === deviceId) ?? devices[0];
  const classOptions = useMemo(
    () => classes.slice().sort((left, right) => left.name.localeCompare(right.name)),
    [classes]
  );
  const assignedStudents = useMemo(
    () => students.filter((student) => Boolean(student.deviceUserId) || student.deviceSyncStatus === "synced"),
    [students]
  );
  const assignedIds = useMemo(() => new Set(assignedStudents.map((student) => student.id)), [assignedStudents]);

  const filteredStudents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return students.filter((student) => {
      const matchesClass = classFilter === "All" || student.classId === classFilter;
      const matchesResidency = residencyFilter === "All" || student.residency === residencyFilter;
      const searchable = `${student.name} ${student.className} ${student.id} ${student.deviceUserId ?? ""}`.toLowerCase();
      const matchesSearch = normalizedSearch === "" || searchable.includes(normalizedSearch);
      const matchesAssigned = !showAssignedOnly || assignedIds.has(student.id);
      return matchesClass && matchesResidency && matchesSearch && matchesAssigned;
    });
  }, [assignedIds, classFilter, residencyFilter, search, showAssignedOnly, students]);

  const assignedList = useMemo(() => students.filter((student) => assignedIds.has(student.id)), [assignedIds, students]);
  const boardersAssigned = assignedList.filter((student) => student.residency === "Boarding").length;
  const dayAssigned = assignedList.filter((student) => student.residency === "Day").length;
  const assignedCount = assignedList.length;
  const capacity = device?.maxUsers ?? 200;
  const unassigned = Math.max(0, students.length - assignedList.length);
  const selectedDeviceLabel = device?.name ?? "Selected device";
  const selectedDeviceLocation = device?.location ?? "—";
  const selectedDeviceLastSync = deviceStatus?.last_sync_at ? new Date(deviceStatus.last_sync_at).toLocaleString() : device?.lastSync ?? "No sync yet";
  const selectedDeviceIsOnline = Boolean(deviceStatus?.connected ?? device?.isConnected);
  const selectedDeviceStatusLabel = selectedDeviceIsOnline ? "Online" : "Offline";

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
    const studentsData = await apiRequest<any[]>("/students?limit=5000", { auth: "school" });
    const mappedStudents = (Array.isArray(studentsData) ? studentsData : []).map((student): Student => ({
      id: student.id,
      name: `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim(),
      className: student.current_section?.full_name ?? student.current_section?.name ?? student.class ?? "—",
      classId: student.current_section?.class_id ?? null,
      residency: student.student_type === "boarding" ? "Boarding" : "Day",
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
      message: status?.message ?? result?.message,
      deviceId: status?.deviceId ?? result?.device_uid,
      serialNumber: status?.serialNumber,
      productName: status?.productName ?? result?.product_name,
      ipAddress: status?.ipAddress ?? result?.tablet_ip,
      last_sync_at: result?.last_sync_at ?? result?.lastSyncAt ?? status?.last_sync_at ?? null,
    });
  };

  const pushStudents = async (studentIds: string[], actionType: "push-selected" | "push-class" | "push-all" | "push-single", actionId?: string) => {
    if (!deviceId) {
      toast.error("Select a device first");
      return;
    }
    if (studentIds.length === 0) {
      toast.error("Select at least one student");
      return;
    }

    setBusyAction({ type: actionType, id: actionId });
    try {
      const result = await apiRequest<any>(`/devices/${deviceId}/push-students`, {
        method: "POST",
        auth: "school",
        body: JSON.stringify({ mode: "selected", student_ids: studentIds }),
      });
      toast.success(`${result?.pushed_count ?? studentIds.length} student(s) pushed to ${device?.name ?? selectedDeviceLabel}`);
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
    await pushStudents(filteredStudents.map((student) => student.id), "push-class");
  };

  const pushAllAssigned = async () => {
    await pushStudents(Array.from(assignedIds), "push-all");
  };

  const pushSingleStudent = async (studentId: string) => {
    await pushStudents([studentId], "push-single", studentId);
  };

  const removeStudent = async (student: Student) => {
    if (!device?.tabletId) {
      toast.error("This device is not linked to a tablet");
      return;
    }
    const userId = student.deviceUserId || student.id;
    if (!window.confirm(`Remove ${student.name} from the device?`)) return;

    setBusyAction({ type: "remove", id: student.id });
    try {
      await apiRequest(`/tablets/${device.tabletId}/device/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        auth: "school",
      });
      toast.success(`${student.name} removed from device`);
      await Promise.all([loadStudents(), loadSelectedDeviceStatus()]);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to remove student from device");
    } finally {
      setBusyAction(null);
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
          disabled={Boolean(busyAction)}
          className="h-10 inline-flex items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busyAction?.type === "push-selected" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Push Selected
        </button>
        <button
          type="button"
          onClick={pushCurrentClass}
          disabled={Boolean(busyAction) || classFilter === "All"}
          className="h-10 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
        >
          {busyAction?.type === "push-class" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />} Push Class
        </button>
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
                  <th className="text-right px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
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
                    <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">No students match your filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
                disabled={Boolean(busyAction)}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
              >
                {busyAction?.type === "push-all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />} Push All
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <InfoItem label="Assigned" value={String(assignedCount)} />
              <InfoItem label="Capacity" value={`${assignedCount}/${capacity}`} />
              <InfoItem label="Boarding" value={String(boardersAssigned)} />
              <InfoItem label="Day" value={String(dayAssigned)} />
            </div>
            <div className="mt-4 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
              {selectedDeviceIsOnline ? "Device online" : "Device offline"}
              {deviceStatus?.message ? ` - ${deviceStatus.message}` : ""}
            </div>
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
    </AppLayout>
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