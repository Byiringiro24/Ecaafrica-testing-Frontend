import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, Download } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui-kit/Avatar";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchDeviceLogs, fetchAttendanceStats } from "@/lib/device-logs-api";
import type { AttendanceStats, DeviceLog, PaginationMeta } from "@/lib/device-logs-types";
import { localDateInputValue } from "@/lib/dateInput";
import { exportToExcel } from "@/lib/exportExcel";

export const Route = createFileRoute("/attendance/device-attendance")({
  component: DeviceAttendancePage,
});

const PAGE_SIZE = 25;

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
];

const formatTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
};

const statusClasses = (status: string) => {
  switch (status) {
    case "Present":
      return "bg-success/15 text-success";
    case "Absent":
      return "bg-destructive/15 text-destructive";
    case "Late":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-blue-100 text-blue-700";
  }
};

function DeviceAttendancePage() {
  const todayValue = localDateInputValue();
  const [logs, setLogs] = useState<DeviceLog[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, page: 1, limit: PAGE_SIZE, totalPages: 1 });
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState(todayValue);
  const [page, setPage] = useState(1);

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
        const [logRes, statRes] = await Promise.all([
          fetchDeviceLogs({
            page,
            limit: PAGE_SIZE,
            startDate: dateFilter || undefined,
            endDate: dateFilter || undefined,
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
        setLogs(logRes.data);
        setMeta(logRes.meta);
        setStats(statRes);
      } catch (error: any) {
        if (cancelled) return;
        toast.error(error?.message ?? "Failed to load device attendance records");
        setLogs([]);
        setStats(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [page, dateFilter, statusFilter, methodFilter, debouncedQuery]);

  const totalPages = Math.max(1, meta.totalPages);
  const startIndex = (meta.page - 1) * meta.limit;

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
            <StatCard label="Total Records" value={stats?.totalRecords ?? meta.total} tone="primary" />
            <StatCard label="Unique Students" value={stats?.uniqueStudents ?? 0} tone="primary" />
            <StatCard label="Check-ins" value={stats?.checkInCount ?? 0} tone="success" />
            <StatCard label="Check-outs" value={stats?.checkOutCount ?? 0} tone="warning" />
          </>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-3 items-center mb-5">
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
                {["#", "Student", "Class", "Status", "Time", "Scan Method"].map((header) => (
                  <th key={header} className="text-left px-4 py-3 whitespace-nowrap">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Loading device attendance records…
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
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
                    <td className="px-4 py-3 whitespace-nowrap">{formatTime(row.timestamp)}</td>
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

        {!loading && meta.total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              Showing {startIndex + 1}–{Math.min(startIndex + logs.length, meta.total)} of {meta.total}
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

      {!loading && logs.length > 0 && (
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
                    { header: "Time In", key: "time", width: 14 },
                    { header: "Method", key: "method", width: 14 },
                    { header: "Device", key: "device", width: 18 },
                  ],
                  logs.map((l: DeviceLog, i) => ({
                    no: i + 1,
                    name: l.studentName ?? "—",
                    sid: l.studentId ?? "—",
                    cls: l.className ?? "—",
                    status: l.status ?? "—",
                    time: l.timestamp ? new Date(l.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
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
