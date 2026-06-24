import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, UserPlus, ArrowUpRight, X } from "lucide-react";
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
};

type Student = {
  id: string;
  name: string;
  class: string;
  residency: "Boarding" | "Day";
};

const CLASSES = ["S1", "S2", "S3", "S4", "S5", "S6"];

function DeviceStudentsPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [classFilter, setClassFilter] = useState("All");
  const [residencyFilter, setResidencyFilter] = useState<"All" | "Boarding" | "Day">("All");
  const [search, setSearch] = useState("");
  const [showAssignedOnly, setShowAssignedOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [deviceData, studentsData] = await Promise.all([
          apiRequest<any[]>("/devices?limit=500&sort=created_at&order=desc", { auth: "school" }),
          apiRequest<any[]>("/students?limit=5000", { auth: "school" }),
        ]);
        const mappedDevices = (Array.isArray(deviceData) ? deviceData : []).map((device) => ({
          id: device.id,
          name: device.name,
          location: device.location ?? "—",
          maxUsers: 200,
          lastSync: device.last_sync_at ? new Date(device.last_sync_at).toLocaleString() : "No sync yet",
        }));
        const mappedStudents = (Array.isArray(studentsData) ? studentsData : []).map((student) => ({
          id: student.id,
          name: `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim(),
          class: student.current_section?.name ?? student.class ?? "—",
          residency: student.student_type === "boarding" ? "Boarding" : "Day",
        }));
        setDevices(mappedDevices);
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

  const assignedIds = useMemo(() => new Set(assignments[deviceId] ?? []), [assignments, deviceId]);
  const device = devices.find((d) => d.id === deviceId) ?? devices[0];

  const filteredStudents = useMemo(() => {
    const assignedSet = new Set(assignments[deviceId] ?? []);
    return students.filter((student) => {
      const matchesClass = classFilter === "All" || student.class === classFilter;
      const matchesResidency = residencyFilter === "All" || student.residency === residencyFilter;
      const matchesSearch = search === "" || student.name.toLowerCase().includes(search.toLowerCase());
      const matchesAssigned = !showAssignedOnly || assignedSet.has(student.id);
      return matchesClass && matchesResidency && matchesSearch && matchesAssigned;
    });
  }, [assignments, classFilter, residencyFilter, search, showAssignedOnly, deviceId, students]);

  const assignedList = useMemo(() => students.filter((s) => assignedIds.has(s.id)), [assignedIds, students]);
  const boardersAssigned = assignedList.filter((s) => s.residency === "Boarding").length;
  const dayAssigned = assignedList.filter((s) => s.residency === "Day").length;
  const unassigned = students.length - assignedIds.size;

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
    const allSelected = filteredStudents.every((s) => selectedIds.has(s.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map((s) => s.id)));
    }
  };

  const addSelected = () => {
    if (selectedIds.size === 0) {
      toast.error("Select at least one student");
      return;
    }
    setAssignments((prev) => {
      const current = new Set(prev[deviceId] ?? []);
      selectedIds.forEach((id) => current.add(id));
      return { ...prev, [deviceId]: Array.from(current) };
    });
    toast.success(`Added ${selectedIds.size} students to ${deviceId}`);
    setSelectedIds(new Set());
  };

  const pushSelected = async () => {
    if (selectedIds.size === 0) {
      toast.error("Select students to push");
      return;
    }
    try {
      await apiRequest(`/devices/${deviceId}/push-students`, {
        method: "POST",
        auth: "school",
        body: JSON.stringify({ mode: "selected", student_ids: Array.from(selectedIds) }),
      });
      toast.success(`Pushed ${selectedIds.size} students to ${device?.name ?? deviceId}`);
      setSelectedIds(new Set());
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to push selected students");
    }
  };

  const pushAllAssigned = async () => {
    try {
      await apiRequest(`/devices/${deviceId}/push-students`, {
        method: "POST",
        auth: "school",
        body: JSON.stringify({ mode: "selected", student_ids: Array.from(assignedIds) }),
      });
      toast.success(`Pushed ${assignedIds.size} students to ${device?.name ?? deviceId}`);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to push assigned students");
    }
  };

  const removeStudent = (id: string) => {
    setAssignments((prev) => {
      const current = new Set(prev[deviceId] ?? []);
      current.delete(id);
      return { ...prev, [deviceId]: Array.from(current) };
    });
    toast.info("Student removed from device");
  };

  return (
    <AppLayout title="Device Students" subtitle="Assign boarding and day students to biometric devices">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Assigned Students" value={assignedIds.size} tone="success" icon={<UserPlus className="h-5 w-5" />} />
        <StatCard label="Boarding" value={boardersAssigned} />
        <StatCard label="Day Students" value={dayAssigned} />
        <StatCard label="Unassigned" value={unassigned} tone="warning" />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-3 items-center mb-5">
        <select
          value={deviceId}
          onChange={(event) => setDeviceId(event.target.value)}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          {devices.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select
          value={classFilter}
          onChange={(event) => setClassFilter(event.target.value)}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="All">All Classes</option>
          {CLASSES.map((c) => <option key={c}>{c}</option>)}
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
        <div className="relative flex-1 min-w-[12.5rem]">
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
          onClick={addSelected}
          className="h-10 inline-flex items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <UserPlus className="h-4 w-4" /> Add Selected
        </button>
        <button
          type="button"
          onClick={pushSelected}
          className="h-10 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-muted"
        >
          <ArrowUpRight className="h-4 w-4" /> Push Selected
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-5">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold">Student Assignment</h3>
              <p className="text-xs text-muted-foreground">Select students and assign them to {device?.name ?? "the selected device"}.</p>
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
                      checked={filteredStudents.length > 0 && filteredStudents.every((s) => selectedIds.has(s.id))}
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
                      <td className="px-5 py-3">{student.class}</td>
                      <td className="px-5 py-3"><ResidencyBadge residency={student.residency} /></td>
                      <td className="px-5 py-3"><AssignmentBadge assigned={assigned} /></td>
                      <td className="px-5 py-3 text-right">
                        {assigned ? (
                          <button
                            type="button"
                            onClick={() => removeStudent(student.id)}
                            className="text-xs font-semibold text-destructive hover:underline"
                          >
                            Remove
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedIds((prev) => new Set(prev).add(student.id))}
                            className="text-xs font-semibold text-primary hover:underline"
                          >
                            Add
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
                <div className="font-display font-bold text-lg mt-1">{device?.name ?? "No device"}</div>
                <div className="text-xs text-muted-foreground">{device?.location ?? "—"} - Last sync {device?.lastSync ?? "—"}</div>
              </div>
              <button
                type="button"
                onClick={pushAllAssigned}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
              >
                <ArrowUpRight className="h-4 w-4" /> Push All
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <InfoItem label="Assigned" value={String(assignedIds.size)} />
              <InfoItem label="Capacity" value={`${assignedIds.size}/${device?.maxUsers ?? 0}`} />
              <InfoItem label="Boarding" value={String(boardersAssigned)} />
              <InfoItem label="Day" value={String(dayAssigned)} />
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
                    <div className="text-xs text-muted-foreground">{student.class} - {student.residency}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeStudent(student.id)}
                    className="text-xs font-semibold text-destructive hover:underline"
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
