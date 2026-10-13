import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Download } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui-kit/Avatar";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAllDeviceLogs, fetchAttendanceStats } from "@/lib/device-logs-api";
import type { AttendanceStats, DeviceLog } from "@/lib/device-logs-types";
import { localDateInputValue } from "@/lib/dateInput";
import { exportToExcel } from "@/lib/exportExcel";

export const Route = createFileRoute("/attendance/device-attendance")({
  component: DeviceAttendancePage,
});

const PAGE_SIZE = 25;

/**
 * Determine if a device log scan is a "check-in" (entry) or "check-out" (exit)
 * based on the session name or direction field.
 *
 * Most FK623 gate setups use a SINGLE device for both entry and exit.
 * The session name (from device session config) tells us which window it belongs to.
 * This is more reliable than the raw direction field which often shows "In" for all scans.
 */
const classifyDirection = (log: DeviceLog): "In" | "Out" => {
  const session = (log.sessionName ?? log.statusLabel ?? "").toLowerCase().trim();
  const direction = (log.direction ?? "").toLowerCase();

  // Explicit direction from device — trust it if meaningful
  if (direction === "out" || direction === "exit") return "Out";
  if (direction === "in" || direction === "entry") {
    // But also check session name — some devices set direction="In" for everything
    // while the session name reveals it's actually an exit window
  }

  // Session name patterns for EXIT windows
  const exitPatterns = /exit|out|departure|evening|prep|afternoon|leave\b|end of day|dismissal/i;
  if (exitPatterns.test(session)) return "Out";

  // Session name patterns for ENTRY windows
  const entryPatterns = /entry|arrival|morning|check.?in|school in|gate in|open/i;
  if (entryPatterns.test(session)) return "In";

  // Default: treat as In (most gate devices are entry-only)
  return "In";
};

const METHOD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All Methods" },
  { value: "fingerprint", label: "Fingerprint" },
  { value: "face", label: "Face Recognition" },
  { value: "card", label: "RFID Card" },
];

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All Statuses" },
  { value: "present", label: "Present" },
  { value: "late", label: "Late" },
  { value: "absent", label: "Absent" },
  { value: "excused", label: "Excused" },
  { value: "not_scheduled", label: "Not scheduled" },
];

const formatTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
};

type DeviceAttendanceRow = DeviceLog & {
  firstInTimestamp: string | null;
  lastOutTimestamp: string | null;
};

const timestampValue = (value?: string | null) => {
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const studentKey = (log: DeviceLog) => {
  const id = log.studentId?.trim();
  if (id) return `id:${id}`;
  const name = log.studentName?.trim().toLowerCase();
  return name ? `name:${name}` : `log:${log.id}`;
};

/** Collapse raw device scans into one first-in/last-out row per student.
 *
 * Check-in and check-out are determined by the device session the scan belongs to,
 * not the raw direction field (which the FK623 often sets to "In" for all scans).
 * Sessions named "Morning / Entry / Arrival" = check-in.
 * Sessions named "Evening / Exit / Prep / Afternoon" = check-out.
 */
const summarizeDeviceLogs = (source: DeviceLog[]): DeviceAttendanceRow[] => {
  const grouped = new Map<string, DeviceLog[]>();

  source.forEach((log) => {
    const key = studentKey(log);
    const entries = grouped.get(key) ?? [];
    entries.push(log);
    grouped.set(key, entries);
  });

  return Array.from(grouped.entries())
    .map(([key, entries]) => {
      const chronological = entries
        .slice()
        .sort((a, b) => timestampValue(a.timestamp) - timestampValue(b.timestamp));

      const firstScan = chronological[0];

      // Classify each scan using session name → direction
      const inScans  = chronological.filter(log => classifyDirection(log) === "In");
      const outScans = chronological.filter(log => classifyDirection(log) === "Out");

      const firstIn = inScans[0] ?? firstScan;
      // Last-out: prefer an explicit exit-session scan; fall back to last scan
      // ONLY if it is a different scan from firstIn (avoids same-time issue)
      const lastOut = outScans.length > 0
        ? outScans[outScans.length - 1]
        : chronological.length > 1
          ? chronological[chronological.length - 1]
          : null;  // single scan = no exit recorded

      const statuses = chronological.map((log) => log.status.toLowerCase());
      const status = statuses.some((value) => ["present", "excused", "still at school"].includes(value))
        ? "Present"
        : statuses.includes("late")
          ? "Late"
          : statuses.includes("absent")
            ? "Absent"
            : firstScan.status;

      return {
        ...firstIn,
        id: `summary:${key}`,
        status,
        direction: "In" as const,
        timestamp: firstIn.timestamp,
        firstInTimestamp: firstIn.timestamp ?? null,
        // Only set lastOut if it's a genuinely different scan (different timestamp)
        lastOutTimestamp: lastOut && lastOut.timestamp !== firstIn.timestamp
          ? lastOut.timestamp ?? null
          : null,
      };
    })
    .sort((a, b) =>
      timestampValue(b.lastOutTimestamp ?? b.firstInTimestamp) -
      timestampValue(a.lastOutTimestamp ?? a.firstInTimestamp)
    );
};

const statusClasses = (status: string) => {
  switch (status) {
    case "Present":
      return "bg-success/15 text-success";
    case "Absent":
      return "bg-destructive/15 text-destructive";
    case "Late":
      return "bg-amber-100 text-amber-700";
    case "Not scheduled":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-blue-100 text-blue-700";
  }
};

function DeviceAttendancePage() {
  const todayValue = localDateInputValue();
  const [devices, setDevices] = useState<Array<{ id: string; name: string; location?: string | null }>>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [allLogs, setAllLogs] = useState<DeviceAttendanceRow[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState(todayValue);
  const [page, setPage] = useState(1);

  // Load device list for the selector
  useEffect(() => {
    import("@/lib/deviceApi").then(({ deviceApi }) => {
      deviceApi.getAll({ limit: 200 }).then(res => {
        const list = (res.data ?? []).map((d: any) => ({ id: d.id, name: d.name, location: d.location }));
        setDevices(list);
        if (list.length && !selectedDeviceId) setSelectedDeviceId(list[0].id);
      }).catch(() => {});
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      try {
        const [rawLogs, statRes] = await Promise.all([
          fetchAllDeviceLogs({
            startDate: dateFilter || undefined,
            endDate: dateFilter || undefined,
            // Filter by selected device — shows only that device's scans
            deviceId: selectedDeviceId || undefined,
            status: statusFilter !== "all" ? statusFilter : undefined,
            method: methodFilter !== "all" ? methodFilter : undefined,
            search: debouncedQuery || undefined,
          }),
          fetchAttendanceStats({
            startDate: dateFilter || undefined,
            endDate: dateFilter || undefined,
          }),
        ]);

        if (cancelled) return;
        const summarizedLogs = summarizeDeviceLogs(rawLogs);
        setAllLogs(summarizedLogs);
        setStats({
          ...statRes,
          totalRecords: summarizedLogs.length,
          uniqueStudents: summarizedLogs.length,
          checkInCount: summarizedLogs.filter((log) => Boolean(log.firstInTimestamp)).length,
          checkOutCount: summarizedLogs.filter((log) => Boolean(log.lastOutTimestamp)).length,
        });
      } catch (error: any) {
        if (cancelled) return;
        toast.error(error?.message ?? "Failed to load device attendance records");
        setAllLogs([]);
        setStats(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [dateFilter, statusFilter, methodFilter, debouncedQuery, selectedDeviceId]);

  const totalPages = Math.max(1, Math.ceil(allLogs.length / PAGE_SIZE));
  const startIndex = (page - 1) * PAGE_SIZE;
  const logs = useMemo(() => allLogs.slice(startIndex, startIndex + PAGE_SIZE), [allLogs, startIndex]);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {loading && !stats ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : (
          <>
            <StatCard label="Total Records" value={stats?.totalRecords ?? allLogs.length} tone="primary" />
            <StatCard label="Unique Students" value={stats?.uniqueStudents ?? 0} tone="primary" />
            <StatCard label="Check-ins" value={stats?.checkInCount ?? 0} tone="success" />
            <StatCard label="Check-outs" value={stats?.checkOutCount ?? 0} tone="warning" />
          </>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-3 items-center mb-5">
        {/* Device selector — required: user must choose which device to view */}
        <select
          value={selectedDeviceId}
          onChange={(e) => { setSelectedDeviceId(e.target.value); setPage(1); }}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm min-w-40"
        >
          <option value="">All Devices</option>
          {devices.map(d => (
            <option key={d.id} value={d.id}>{d.name}{d.location ? ` (${d.location})` : ""}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-60">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by student name, ID or class..."
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
          />
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => {
            setDateFilter(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={methodFilter}
          onChange={(e) => {
            setMethodFilter(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          {METHOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                {["#", "Student", "Class", "Status", "Check In", "Check Out", "Session", "Scan Method"].map((header) => (
                  <th key={header} className="text-left px-4 py-3 whitespace-nowrap">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Loading device attendance records…
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No device attendance records found for the selected filters.
                  </td>
                </tr>
              ) : (
                logs.map((row, index) => (
                  <tr key={row.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground">{startIndex + index + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={row.studentName} size="sm" />
                        <div>
                          <div className="font-semibold">{row.studentName}</div>
                          <div className="text-xs text-muted-foreground">{row.studentId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{row.className ?? row.section ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClasses(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatTime(row.firstInTimestamp)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.lastOutTimestamp
                        ? formatTime(row.lastOutTimestamp)
                        : <span className="text-muted-foreground text-xs">Not recorded</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {row.sessionName ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        {row.method}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && allLogs.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              Showing {startIndex + 1}–{Math.min(startIndex + logs.length, allLogs.length)} of {allLogs.length}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-md border border-border px-3 py-1 disabled:opacity-50 hover:bg-muted"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-md border border-border px-3 py-1 disabled:opacity-50 hover:bg-muted"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {!loading && allLogs.length > 0 && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={async () => {
              try {
                await exportToExcel(
                  `device-attendance-${dateFilter}.xlsx`, "Device Attendance",
                  [
                    { header: "#", key: "no", width: 6 },
                    { header: "Student Name", key: "name", width: 26 },
                    { header: "Student ID", key: "sid", width: 16 },
                    { header: "Class", key: "cls", width: 18 },
                    { header: "Status", key: "status", width: 12 },
                    { header: "First In", key: "time", width: 14 },
                    { header: "Last Out", key: "timeOut", width: 14 },
                    { header: "Method", key: "method", width: 14 },
                    { header: "Device", key: "device", width: 18 },
                  ],
                  allLogs.map((l: DeviceAttendanceRow, i) => ({
                    no: i + 1,
                    name: l.studentName ?? "—",
                    sid: l.studentId ?? "—",
                    cls: l.className ?? "—",
                    status: l.status ?? "—",
                    time: l.firstInTimestamp ? new Date(l.firstInTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
                    timeOut: l.lastOutTimestamp ? new Date(l.lastOutTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
                    method: l.method ?? "—",
                    device: l.deviceId ?? "—",
                  })),
                  `Device Attendance — ${dateFilter}`
                );
                toast.success("Exported");
              } catch (e: any) { toast.error(e?.message ?? "Export failed"); }
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted/40"
          >
            <Download className="h-4 w-4" />
            Export Records
          </button>
        </div>
      )}
    </>
  );
}
