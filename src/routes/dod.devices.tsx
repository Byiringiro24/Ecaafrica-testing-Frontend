/**
 * DOD — Device Location Assignment
 *
 * DOD sees all tablets/devices assigned to their school.
 * For each device they can:
 *   1. Assign it to a location (gate, dormitory, dining hall, classroom)
 *   2. See which students will be pushed to it (auto-grouped in 2000 max)
 *   3. Push a specific group to the tablet
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Cpu, RefreshCw, Upload, ChevronDown, ChevronRight,
  CheckCircle2, AlertTriangle, Users, Home, Utensils,
  Shield, BookOpen, Save,
} from "lucide-react";
import { toast } from "sonner";
import { DodLayout } from "@/components/layout/DodLayout";
import { directorOfDisciplineRouteGuard } from "@/lib/schoolAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { deviceLocationApi } from "@/lib/boardingApi";
import { cn } from "@/lib/utils";
import { isDeviceOnline } from "@/components/ui-kit/DeviceStatusCards";

export const Route = createFileRoute("/dod/devices")({
  beforeLoad: ({ location }) => directorOfDisciplineRouteGuard(location),
  component: DodDevicesPage,
});

const DEVICE_CAPACITY = 2000;

const getDeviceSyncStatus = (status?: string | null) => {
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
  return { label: normalized.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()), tone: "bg-slate-100 text-slate-700 border border-slate-200" };
};

const SCOPE_OPTIONS = [
  { value: "gate",        label: "Gate (all students)",        icon: Shield   },
  { value: "dormitory",   label: "Dormitory (boarding only)",  icon: Home     },
  { value: "dining_hall", label: "Dining Hall (boarding only)",icon: Utensils },
  { value: "classroom",   label: "Classroom (all students)",   icon: BookOpen },
  { value: "other",       label: "Other",                      icon: Cpu      },
];

type DeviceRow = {
  id: string; name: string; device_uid: string; mode: string;
  is_connected: boolean; location_scope: string | null;
  location_label: string | null; dormitory_id: string | null;
  last_sync_status?: string | null;
  last_status_message?: string | null;
  dormitory?: { id: string; name: string } | null;
  tablet?: { id: string; name: string; ip: string } | null;
};

type Dormitory = { id: string; name: string; block_name?: string | null; gender: string };

type StudentGroup = {
  group: number; label: string;
  students: Array<{
    id: string; full_name: string;
    student_id_number?: string | null;
    student_type: string;
    photo_url?: string | null;
    device_sync_status?: string | null;
    sync_status?: "pushed" | "pending" | "failed";
    class_name?: string | null;
  }>;
};

type StudentFilterState = {
  status: "all" | "pushed" | "pending" | "failed";
  className: string;
  query: string;
};

const DEFAULT_FILTER: StudentFilterState = { status: "all", className: "all", query: "" };

const getStudentSyncStatus = (student: { device_sync_status?: string | null; device_user_id?: string | null }) => {
  const raw = (student.device_sync_status ?? "").trim().toLowerCase();
  if (raw === "failed" || raw === "disabled") return "failed" as const;
  if (["syncing", "pending", "in_progress", "processing", ""].includes(raw)) return "pending" as const;
  if (student.device_user_id) return "pushed" as const;
  return "pending" as const;
};

function DodDevicesPage() {
  const [devices,     setDevices]     = useState<DeviceRow[]>([]);
  const [dormitories, setDormitories] = useState<Dormitory[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [expanded,    setExpanded]    = useState<string | null>(null);
  const [editing,     setEditing]     = useState<string | null>(null);
  const [editForm,    setEditForm]    = useState({ location_scope: "gate", dormitory_id: "", location_label: "" });
  const [saving,      setSaving]      = useState(false);
  const [groups,      setGroups]      = useState<Record<string, { total: number; groupCount: number; groups: StudentGroup[] }>>({});
  const [pushing,     setPushing]     = useState<string | null>(null);
  const [studentFilters, setStudentFilters] = useState<Record<string, StudentFilterState>>({});

  const load = async () => {
    setLoading(true);
    try {
      const [devRes, dormRes] = await Promise.all([
        apiRequest<any>("/devices?limit=200", { auth: "school" }),
        apiRequest<any>("/boarding/dormitories?limit=200", { auth: "school" }),
      ]);
      setDevices((devRes as any)?.data ?? devRes ?? []);
      setDormitories((dormRes as any)?.data ?? dormRes ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load devices");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    void load();
    // Background refresh every 60s so DOD sees updated status without manual refresh
    const iv = setInterval(() => void load(), 60_000);
    return () => clearInterval(iv);
  }, []);

  const loadGroups = async (deviceId: string) => {
    if (groups[deviceId]) return;
    try {
      const r = await deviceLocationApi.getAssignedStudents(deviceId);
      const d = (r as any)?.data ?? r;
      setGroups(prev => ({
        ...prev,
        [deviceId]: { total: d.total, groupCount: d.groupCount, groups: d.groups ?? [] },
      }));
    } catch { /* silently ignore */ }
  };

  const startEdit = (d: DeviceRow) => {
    setEditing(d.id);
    setEditForm({
      location_scope: d.location_scope ?? "gate",
      dormitory_id:   d.dormitory_id ?? "",
      location_label: d.location_label ?? "",
    });
  };

  const handleSave = async (deviceId: string) => {
    setSaving(true);
    try {
      const r = await deviceLocationApi.assign(deviceId, {
        location_scope: editForm.location_scope,
        location_label: editForm.location_label || null,
        dormitory_id:   editForm.dormitory_id || null,
        auto_push:      true,
        group:          1,
      });
      const data = (r as any)?.data ?? r;
      toast.success(data?.push?.message ?? "Device location saved and students pushed");
      setEditing(null);
      setGroups(prev => { const n = {...prev}; delete n[deviceId]; return n; });
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally { setSaving(false); }
  };

  const handlePushGroup = async (deviceId: string, group: number) => {
    setPushing(`${deviceId}-${group}`);
    try {
      await deviceLocationApi.pushGroup(deviceId, group);
      toast.success(`Group ${group} pushed to device`);
    } catch (e: any) {
      toast.error(e?.message ?? "Push failed — check tablet connection");
    } finally { setPushing(null); }
  };

  const scopeLabel = (scope?: string | null) =>
    SCOPE_OPTIONS.find(o => o.value === scope)?.label ?? scope ?? "Unassigned";

  const getDeviceFilter = (deviceId: string): StudentFilterState =>
    studentFilters[deviceId] ?? DEFAULT_FILTER;

  const updateDeviceFilter = (deviceId: string, updates: Partial<StudentFilterState>) => {
    setStudentFilters(prev => ({
      ...prev,
      [deviceId]: { ...DEFAULT_FILTER, ...(prev[deviceId] ?? {}), ...updates },
    }));
  };

  return (
    <DodLayout title="Device Location Assignment" subtitle="Assign tablets to gates, dormitories, dining halls and classrooms — students are auto-grouped and pushed">

      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{devices.length} device{devices.length !== 1 ? "s" : ""} — max {DEVICE_CAPACITY} students per device</p>
        <button onClick={() => void load()} disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>
      ) : devices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-16 text-center">
          <Cpu className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No devices assigned. Contact Super Admin to assign tablets to your school.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map(d => {
            const isExpanded = expanded === d.id;
            const isEditing  = editing === d.id;
            const grp        = groups[d.id];

            const syncState = getDeviceSyncStatus(d.last_sync_status);
            return (
              <div key={d.id} className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Header row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted shrink-0">
                    <Cpu className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{d.name}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold",
                        isDeviceOnline(d) ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground")}>
                        {isDeviceOnline(d) ? "Online" : "Offline"}
                      </span>
                      {d.location_scope ? (
                        <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[10px] font-bold capitalize">
                          {d.location_scope.replace(/_/g, " ")}{d.location_label ? ` - ${d.location_label}` : ""}
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-bold">Not assigned</span>
                      )}
                      {syncState && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${syncState.tone}`}>
                          {syncState.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {d.tablet ? `Tablet: ${d.tablet.name} (${d.tablet.ip})` : "No tablet linked"}
                      {d.dormitory ? ` · Dorm: ${d.dormitory.name}` : ""}
                    </p>
                    {d.last_status_message && (
                      <p className="mt-1 text-[11px] text-muted-foreground">{d.last_status_message}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => startEdit(d)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                      <Save className="h-3.5 w-3.5" /> Assign
                    </button>
                    <button onClick={() => { const n = isExpanded ? null : d.id; setExpanded(n); if (n) void loadGroups(d.id); }}
                      className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Edit form */}
                {isEditing && (
                  <div className="border-t border-border px-5 py-4 bg-muted/20 space-y-4">
                    <p className="text-sm font-semibold">Assign "{d.name}" to a location</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold">Location Type</label>
                        <select value={editForm.location_scope}
                          onChange={e => setEditForm(f => ({...f, location_scope: e.target.value, dormitory_id: ""}))}
                          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                          {SCOPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      {(editForm.location_scope === "dormitory" || editForm.location_scope === "dining_hall") && (
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold">Dormitory</label>
                          <select value={editForm.dormitory_id}
                            onChange={e => setEditForm(f => ({...f, dormitory_id: e.target.value}))}
                            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                            <option value="">-- select dormitory --</option>
                            {dormitories.map(dorm => (
                              <option key={dorm.id} value={dorm.id}>
                                {dorm.name}{dorm.block_name ? ` (${dorm.block_name})` : ""} - {dorm.gender}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold">Location Name</label>
                        <input value={editForm.location_label}
                          onChange={e => setEditForm(f => ({...f, location_label: e.target.value}))}
                          placeholder={editForm.location_scope === "gate" ? "e.g. Main Gate" : editForm.location_scope === "dormitory" ? "e.g. Boys Block A" : "Location name"}
                          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" />
                      </div>
                    </div>
                    <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
                      After saving, students for this location are automatically pushed to the linked tablet (Group 1, max {DEVICE_CAPACITY}).
                      For more than {DEVICE_CAPACITY} students, use multiple devices and push different groups.
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => void handleSave(d.id)} disabled={saving}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                        <CheckCircle2 className="h-4 w-4" />
                        {saving ? "Saving..." : "Save and Push Students"}
                      </button>
                      <button onClick={() => setEditing(null)}
                        className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">Cancel</button>
                    </div>
                  </div>
                )}

                {/* Expanded: student groups */}
                {isExpanded && !isEditing && (
                  <div className="border-t border-border px-5 py-4 space-y-3">
                    {!grp ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <RefreshCw className="h-4 w-4 animate-spin" /> Loading students...
                      </div>
                    ) : grp.total === 0 ? (
                      <div className="flex items-center gap-2 text-sm text-amber-600">
                        <AlertTriangle className="h-4 w-4" /> No students. Assign a location first.
                      </div>
                    ) : (() => {
                      const filter = getDeviceFilter(d.id);
                      const classOptions = Array.from(
                        new Set(grp.groups.flatMap(g => g.students.map(s => s.class_name).filter(Boolean) as string[]))
                      ).sort();

                      const filteredGroups = grp.groups.map(g => ({
                        ...g,
                        students: g.students.filter(s => {
                          const status = s.sync_status ?? getStudentSyncStatus(s);
                          const matchesStatus = filter.status === "all" || status === filter.status;
                          const matchesClass = filter.className === "all" || s.class_name === filter.className;
                          const query = filter.query.trim().toLowerCase();
                          const matchesQuery = !query || [
                            s.full_name,
                            s.student_id_number ?? "",
                            s.class_name ?? "",
                          ].join(" ").toLowerCase().includes(query);
                          return matchesStatus && matchesClass && matchesQuery;
                        }),
                      })).filter(g => g.students.length > 0);

                      const visibleTotal = filteredGroups.reduce((sum, g) => sum + g.students.length, 0);
                      const counts = grp.groups.flatMap(g => g.students).reduce((acc, s) => {
                        const status = s.sync_status ?? getStudentSyncStatus(s);
                        acc[status] += 1;
                        return acc;
                      }, { pushed: 0, pending: 0, failed: 0 } as Record<"pushed" | "pending" | "failed", number>);

                      return (
                        <>
                          <div className="flex flex-col gap-3 rounded-xl border border-border bg-slate-50 p-3">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-sm font-semibold">{grp.total} students</span>
                              <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-bold">Pushed {counts.pushed}</span>
                              <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-bold">Pending {counts.pending}</span>
                              <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-bold">Failed {counts.failed}</span>
                              {grp.groupCount > 1 && (
                                <span className="rounded-full bg-amber-100 text-amber-700 px-3 py-0.5 text-xs font-bold">
                                  {grp.groupCount} groups needed (max {DEVICE_CAPACITY}/device)
                                </span>
                              )}
                            </div>
                            <div className="grid gap-2 md:grid-cols-[140px_180px_1fr]">
                              <select value={filter.status} onChange={e => updateDeviceFilter(d.id, { status: e.target.value as StudentFilterState["status"] })}
                                className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
                                <option value="all">All Status</option>
                                <option value="pushed">Pushed</option>
                                <option value="pending">Pending</option>
                                <option value="failed">Failed</option>
                              </select>
                              <select value={filter.className} onChange={e => updateDeviceFilter(d.id, { className: e.target.value })}
                                className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
                                <option value="all">All Classes</option>
                                {classOptions.map(cls => <option key={cls} value={cls}>{cls}</option>)}
                              </select>
                              <input value={filter.query} onChange={e => updateDeviceFilter(d.id, { query: e.target.value })}
                                placeholder="Search student name / ID / class"
                                className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
                            </div>
                            <p className="text-xs text-muted-foreground">Showing {visibleTotal} of {grp.total} students</p>
                          </div>
                          {filteredGroups.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                              No students match the current filter.
                            </div>
                          ) : filteredGroups.map(g => (
                            <div key={g.group} className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold text-sm">{g.label}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Day: {g.students.filter(s => s.student_type === "day").length} &nbsp;|&nbsp;
                                    Boarding: {g.students.filter(s => s.student_type === "boarding").length}
                                  </p>
                                </div>
                                {d.tablet && (
                                  <button onClick={() => void handlePushGroup(d.id, g.group)}
                                    disabled={!!pushing}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                                    <Upload className="h-3.5 w-3.5" />
                                    {pushing === `${d.id}-${g.group}` ? "Pushing..." : `Push Group ${g.group}`}
                                  </button>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {g.students.slice(0, 10).map(s => {
                                  const status = s.sync_status ?? getStudentSyncStatus(s);
                                  return (
                                    <div key={s.id} className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1 text-xs">
                                      {s.photo_url ? (
                                        <img src={s.photo_url} alt="" className="h-5 w-5 rounded-full object-cover border border-border shrink-0" />
                                      ) : (
                                        <div className={cn(
                                          "h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0",
                                          s.student_type === "boarding" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                                        )}>
                                          {s.full_name.split(" ").map(w => w[0]).join("").slice(0,2)}
                                        </div>
                                      )}
                                      <span className="truncate max-w-[80px]">{s.full_name}</span>
                                      <span className={cn(
                                        "rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                                        status === "pushed" ? "bg-emerald-100 text-emerald-700" :
                                        status === "failed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                                      )}>{status === "pushed" ? "Pushed" : status === "failed" ? "Failed" : "Pending"}</span>
                                    </div>
                                  );
                                })}
                                {g.students.length > 10 && (
                                  <div className="flex items-center rounded-lg border border-dashed border-border px-2 py-1 text-xs text-muted-foreground">
                                    +{g.students.length - 10} more
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DodLayout>
  );
}
