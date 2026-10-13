/**
 * Device Attendance Page
 *
 * Shows ALL individual scan records from biometric devices.
 * Filters: Device → Session → Date → Method → Status → Search
 *
 * Each row = one scan event, NOT a collapsed summary.
 * Status comes from the session time-window rules configured on the device.
 * The session name (attendance_period) tells you exactly which session this scan belongs to.
 *
 * "Only showing few students": was caused by summarizeDeviceLogs collapsing all
 * scans into one row per student. Removed — every scan now shows as its own row.
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui-kit/Avatar";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchDeviceLogs } from "@/lib/device-logs-api";
import type { DeviceLog } from "@/lib/device-logs-types";
import { localDateInputValue } from "@/lib/dateInput";
import { exportToExcel } from "@/lib/exportExcel";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/attendance/device-attendance")({
  component: DeviceAttendancePage,
});

const PAGE_SIZE = 50;

type DeviceRecord  = { id: string; name: string; location?: string | null };
type SessionRecord = { id: string; name: string; is_active?: boolean };

const formatTime = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString([], { day: "2-digit", month: "short" });
};

const statusClass = (status: string) => {
  const s = status.toLowerCase();
  if (s === "present")      return "bg-success/15 text-success";
  if (s === "late")         return "bg-amber-100 text-amber-700";
  if (s === "absent")       return "bg-destructive/15 text-destructive";
  if (s === "not scheduled" || s === "not_scheduled") return "bg-muted text-muted-foreground";
  return "bg-blue-100 text-blue-700";
};

const METHOD_OPTIONS = [
  { value: "all",         label: "All Methods"     },
  { value: "fingerprint", label: "Fingerprint"     },
  { value: "face",        label: "Face Recognition"},
  { value: "card",        label: "RFID Card"       },
  { value: "manual",      label: "Manual"          },
];

const STATUS_OPTIONS = [
  { value: "all",           label: "All Statuses"  },
  { value: "present",       label: "Present"       },
  { value: "late",          label: "Late"          },
  { value: "absent",        label: "Absent"        },
  { value: "not_scheduled", label: "Not scheduled" },
];

function DeviceAttendancePage() {
  const todayValue = localDateInputValue();

  // ── Devices & sessions ──────────────────────────────────────────────────────
  const [devices, setDevices]           = useState<DeviceRecord[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [sessions, setSessions]         = useState<SessionRecord[]>([]);
  const [selectedSession, setSelectedSession] = useState("all");
  const [devicesLoading, setDevicesLoading] = useState(true);

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [dateFilter,   setDateFilter]   = useState(todayValue);
  const [methodFilter, setMethodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search,       setSearch]       = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // ── Data ────────────────────────────────────────────────────────────────────
  const [logs,    setLogs]    = useState<DeviceLog[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);

  // ── Debounce search ─────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // ── Load devices ─────────────────────────────────────────────────────────────
  useEffect(() => {
    setDevicesLoading(true);
    apiRequest<any>("/devices?limit=200", { auth: "school" })
      .then(res => {
        const list: DeviceRecord[] = (Array.isArray(res) ? res : res?.data ?? [])
          .map((d: any) => ({ id: d.id, name: d.name, location: d.location }));
        setDevices(list);
        if (list.length && !selectedDeviceId) setSelectedDeviceId(list[0].id);
      })
      .catch(() => {})
      .finally(() => setDevicesLoading(false));
  }, []);

  // ── Load sessions for selected device ─────────────────────────────────────
  useEffect(() => {
    if (!selectedDeviceId) { setSessions([]); return; }
    apiRequest<any>(`/devices/${selectedDeviceId}/sessions`, { auth: "school" })
      .then(res => {
        const raw = Array.isArray(res?.sessions) ? res.sessions
          : Array.isArray(res?.data) ? res.data
          : Array.isArray(res) ? res : [];
        setSessions(raw.map((s: any) => ({ id: s.id, name: s.name, is_active: s.is_active })));
      })
      .catch(() => setSessions([]));
  }, [selectedDeviceId]);

  // ── Load attendance logs ───────────────────────────────────────────────────
  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch ALL pages for the given filters so we can show the full count
      // Use a high limit per page to minimise round trips
      const allRows: DeviceLog[] = [];
      let currentPage = 1;
      let totalPages  = 1;

      do {
        const res = await fetchDeviceLogs({
          page:      currentPage,
          limit:     200,
          startDate: dateFilter || undefined,
          endDate:   dateFilter || undefined,
          deviceId:  selectedDeviceId || undefined,
          method:    methodFilter !== "all" ? methodFilter : undefined,
          status:    statusFilter !== "all" ? statusFilter : undefined,
          search:    debouncedSearch || undefined,
        });
        allRows.push(...res.data);
        totalPages  = res.meta.totalPages;
        currentPage += 1;
      } while (currentPage <= totalPages && currentPage <= 20); // cap at 20 pages (4000 rows)

      // Filter by session name client-side (attendance_period field)
      const filtered = selectedSession === "all"
        ? allRows
        : allRows.filter(log => {
            const logSession = (log.sessionName ?? (log as any).attendance_period ?? "").trim().toLowerCase();
            const sel = selectedSession.toLowerCase();
            return logSession === sel || logSession.includes(sel) || sel.includes(logSession);
          });

      // Sort: newest first
      filtered.sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime());

      setLogs(filtered);
      setTotal(filtered.length);
      setPage(1);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load device attendance");
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [dateFilter, selectedDeviceId, selectedSession, methodFilter, statusFilter, debouncedSearch]);

  useEffect(() => { void loadLogs(); }, [loadLogs]);

  // ── Client-side pagination of already-loaded rows ─────────────────────────
  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const pageRows   = useMemo(() => logs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [logs, page]);

  // ── Stats from loaded rows ──────────────────────────────────────────────────
  const stats = useMemo(() => {
    const present  = logs.filter(l => l.status.toLowerCase() === "present").length;
    const late     = logs.filter(l => l.status.toLowerCase() === "late").length;
    const absent   = logs.filter(l => l.status.toLowerCase() === "absent").length;
    const unique   = new Set(logs.map(l => l.studentId || l.studentName)).size;
    return { present, late, absent, unique, total: logs.length };
  }, [logs]);

  // ── Session options from loaded session list ────────────────────────────────
  // Also build from actual log data in case sessions list is empty
  const sessionOptions = useMemo(() => {
    const fromDevice = sessions.map(s => s.name);
    const fromLogs   = [...new Set(
      logs.map(l => (l.sessionName ?? (l as any).attendance_period ?? "").trim()).filter(Boolean)
    )];
    const all = [...new Set([...fromDevice, ...fromLogs])].sort();
    return all;
  }, [sessions, logs]);

  return (
    <>
      {/* ── Filter bar ── */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm mb-5">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Device */}
          <div className="min-w-44 flex-1">
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Device</label>
            <select
              value={selectedDeviceId}
              onChange={e => { setSelectedDeviceId(e.target.value); setSelectedSession("all"); setPage(1); }}
              disabled={devicesLoading}
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">All Devices</option>
              {devices.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}{d.location ? ` (${d.location})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Session — from device sessions + unique session names in logs */}
          <div className="min-w-44 flex-1">
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Session</label>
            <select
              value={selectedSession}
              onChange={e => { setSelectedSession(e.target.value); setPage(1); }}
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="all">All Sessions</option>
              {sessionOptions.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Date</label>
            <input
              type="date"
              value={dateFilter}
              onChange={e => { setDateFilter(e.target.value); setPage(1); }}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            />
          </div>

          {/* Method */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Method</label>
            <select
              value={methodFilter}
              onChange={e => { setMethodFilter(e.target.value); setPage(1); }}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            >
              {METHOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Status</label>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            >
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-52">
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Search</label>
            <Search className="pointer-events-none absolute left-3 bottom-2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Name, student ID, class…"
              className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm"
            />
          </div>

          {/* Reload */}
          <button
            onClick={() => void loadLogs()}
            disabled={loading}
            className="h-9 inline-flex items-center gap-1.5 rounded-md border border-border px-3 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {loading && !logs.length ? (
          Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <StatCard label="Total Scans"     value={stats.total}   tone="primary"     compact />
            <StatCard label="Unique Students" value={stats.unique}  tone="primary"     compact />
            <StatCard label="Present"         value={stats.present} tone="success"     compact />
            <StatCard label="Late"            value={stats.late}    tone="warning"     compact />
            <StatCard label="Absent"          value={stats.absent}  tone="destructive" compact />
          </>
        )}
      </div>

      {/* ── Table ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div>
            <span className="font-semibold text-sm">Device Attendance Scans</span>
            {!loading && (
              <span className="ml-2 text-xs text-muted-foreground">
                {total} record{total !== 1 ? "s" : ""}
                {selectedSession !== "all" && ` · session: ${selectedSession}`}
              </span>
            )}
          </div>
          {!loading && selectedSession !== "all" && (
            <span className="text-xs text-blue-600 bg-blue-50 rounded-full px-3 py-1 font-semibold">
              {selectedSession}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                {["#", "Student", "Class", "Session", "Time Scanned", "Status", "Method"].map(h => (
                  <th key={h} className="text-left px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Loading attendance records…
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No scans found.
                    {selectedSession !== "all" && (
                      <span> Try selecting <b>All Sessions</b> to see if scans exist for other sessions.</span>
                    )}
                  </td>
                </tr>
              ) : (
                pageRows.map((row, i) => {
                  const sessionLabel = (row.sessionName ?? (row as any).attendance_period ?? "—").trim() || "—";
                  return (
                    <tr key={row.id ?? i} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        {(page - 1) * PAGE_SIZE + i + 1}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={row.studentName} size="sm" />
                          <div>
                            <div className="font-medium">{row.studentName}</div>
                            <div className="text-xs text-muted-foreground font-mono">{row.studentId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs">{row.className ?? row.section ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-medium text-blue-700 bg-blue-50 rounded-full px-2 py-0.5">
                          {sessionLabel}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs">
                        <div className="font-medium">{formatTime(row.timestamp)}</div>
                        <div className="text-muted-foreground">{formatDate(row.timestamp)}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground capitalize">
                        {row.method ?? "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && logs.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, logs.length)} of {logs.length}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="rounded-md border border-border px-3 py-1 disabled:opacity-50 hover:bg-muted text-sm"
              >Previous</button>
              <span className="px-2 py-1 text-xs text-muted-foreground">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="rounded-md border border-border px-3 py-1 disabled:opacity-50 hover:bg-muted text-sm"
              >Next</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Export ── */}
      {!loading && logs.length > 0 && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={async () => {
              try {
                await exportToExcel(
                  `device-attendance-${dateFilter}${selectedSession !== "all" ? `-${selectedSession}` : ""}.xlsx`,
                  "Device Attendance",
                  [
                    { header: "#",         key: "no",      width: 5  },
                    { header: "Student",   key: "name",    width: 26 },
                    { header: "ID",        key: "sid",     width: 16 },
                    { header: "Class",     key: "cls",     width: 14 },
                    { header: "Session",   key: "session", width: 22 },
                    { header: "Time",      key: "time",    width: 12 },
                    { header: "Status",    key: "status",  width: 12 },
                    { header: "Method",    key: "method",  width: 14 },
                    { header: "Device ID", key: "device",  width: 18 },
                  ],
                  logs.map((l, i) => ({
                    no:      i + 1,
                    name:    l.studentName ?? "—",
                    sid:     l.studentId   ?? "—",
                    cls:     l.className   ?? "—",
                    session: (l.sessionName ?? (l as any).attendance_period ?? "—").trim() || "—",
                    time:    l.timestamp ? new Date(l.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
                    status:  l.status      ?? "—",
                    method:  l.method      ?? "—",
                    device:  l.deviceId    ?? "—",
                  })),
                  `Device Attendance — ${dateFilter}`
                );
                toast.success("Exported successfully");
              } catch (e: any) { toast.error(e?.message ?? "Export failed"); }
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted/40"
          >
            <Download className="h-4 w-4" /> Export All Records
          </button>
        </div>
      )}
    </>
  );
}
