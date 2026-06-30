import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Wifi, WifiOff, RefreshCw, Database, AlertTriangle, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Avatar } from "@/components/ui-kit/Avatar";
import { cn } from "@/lib/utils";
import { fetchDeviceLogs, fetchAttendanceStats, fetchTablets } from "@/lib/device-logs-api";
import type { DeviceLog, Tablet, AttendanceStats, SyncState } from "@/lib/device-logs-types";
import { formatTimestamp } from "@/lib/device-logs-utils";

export const Route = createFileRoute("/boarding/device-logs")({ component: DeviceLogsPage });

const DEVICE_LOG_REFRESH_MS = 20 * 60_000;

function DeviceLogsPage() {
  // State management
  const [logs, setLogs] = useState<DeviceLog[]>([]);
  const [tablets, setTablets] = useState<Tablet[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [deviceFilter, setDeviceFilter] = useState("All");
  const [methodFilter, setMethodFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [syncFilter, setSyncFilter] = useState<"All" | SyncState>("All");
  const [search, setSearch] = useState("");
  
  // Pagination
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // Fetch all data
  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [logsResponse, statsData, tabletsData] = await Promise.all([
        fetchDeviceLogs({ page: 1, limit: 1000 }), // Fetch more logs for client-side filtering
        fetchAttendanceStats(),
        fetchTablets({ is_active: true })
      ]);
      
      setLogs(logsResponse.data);
      setStats(statsData);
      setTablets(tabletsData.data);
    } catch (err: any) {
      console.error('Error fetching device logs data:', err);
      setError(err.message || 'Failed to fetch device logs');
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchAllData();
  }, []);

  // Auto-refresh every 20 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchAllData();
      }
    }, DEVICE_LOG_REFRESH_MS);

    return () => clearInterval(interval);
  }, []);

  // Visibility change handler
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchAllData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Get unique methods from logs
  const uniqueMethods = useMemo(() => {
    const methods = new Set(logs.map(log => log.method));
    return Array.from(methods).filter(m => m && m !== 'Unknown');
  }, [logs]);

  // Get unique devices from logs
  const uniqueDevices = useMemo(() => {
    const devices = new Set(logs.map(log => log.deviceId));
    return Array.from(devices).filter(d => d);
  }, [logs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesDevice = deviceFilter === "All" || log.deviceId === deviceFilter;
      const matchesMethod = methodFilter === "All" || log.method === methodFilter;
      const matchesStatus = statusFilter === "All" || log.status === statusFilter;
      const matchesSync = syncFilter === "All" || log.syncState === syncFilter;
      const target = `${log.studentName} ${log.studentId} ${log.deviceId}`.toLowerCase();
      const matchesSearch = search === "" || target.includes(search.toLowerCase());
      return matchesDevice && matchesMethod && matchesStatus && matchesSync && matchesSearch;
    });
  }, [logs, deviceFilter, methodFilter, statusFilter, syncFilter, search]);

  // Calculate display stats from current logs
  const displayStats = useMemo(() => {
    const total = logs.length;
    const synced = logs.filter((l) => l.syncState === "Synced").length;
    const queued = logs.filter((l) => l.syncState === "Queued").length;
    const failed = logs.filter((l) => l.syncState === "Failed").length;
    const online = tablets.filter((t) => t.status === "online").length;
    return { total, synced, queued, failed, online };
  }, [logs, tablets]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [deviceFilter, methodFilter, statusFilter, syncFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const pageLogs = filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Manual refresh handler
  const handleRefresh = () => {
    fetchAllData();
  };

  // Loading state
  if (loading && logs.length === 0) {
    return (
      <AppLayout title="Device Logs" subtitle="Attendance logs and monitoring from boarding devices">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading device logs...</span>
        </div>
      </AppLayout>
    );
  }

  // Error state
  if (error && logs.length === 0) {
    return (
      <AppLayout title="Device Logs" subtitle="Attendance logs and monitoring from boarding devices">
        <div className="rounded-xl border border-destructive bg-destructive/10 p-6 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-3" />
          <h3 className="font-semibold text-lg mb-2">Failed to Load Device Logs</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" /> Try Again
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Device Logs" subtitle="Attendance logs and monitoring from boarding devices">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total Logs" value={displayStats.total} icon={<Database className="h-5 w-5" />} />
        <StatCard label="Synced" value={displayStats.synced} tone="success" />
        <StatCard label="Queued" value={displayStats.queued} tone="warning" />
        <StatCard label="Failed" value={displayStats.failed} tone="destructive" />
        <StatCard label="Devices Online" value={displayStats.online} tone="success" icon={<Wifi className="h-5 w-5" />} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-3 items-center mb-5">
        <select
          value={deviceFilter}
          onChange={(event) => setDeviceFilter(event.target.value)}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="All">All Devices</option>
          {uniqueDevices.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          value={methodFilter}
          onChange={(event) => setMethodFilter(event.target.value)}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="All">All Methods</option>
          {uniqueMethods.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="All">All Status</option>
          <option value="Present">Present</option>
          <option value="Late">Late</option>
          <option value="Absent">Absent</option>
        </select>
        <select
          value={syncFilter}
          onChange={(event) => setSyncFilter(event.target.value as "All" | SyncState)}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="All">All Sync</option>
          <option value="Synced">Synced</option>
          <option value="Queued">Queued</option>
          <option value="Failed">Failed</option>
        </select>
        <div className="relative flex-1 min-w-50">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search student or device"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="h-10 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.65fr_1fr] gap-5">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold">Attendance Logs</h3>
              <p className="text-xs text-muted-foreground">Live attendance logs across all boarding devices.</p>
            </div>
            <div className="text-xs text-muted-foreground">
              Showing {pageLogs.length} of {filteredLogs.length} records
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-5 py-3">Time</th>
                  <th className="text-left px-5 py-3">Student</th>
                  <th className="text-left px-5 py-3">Class</th>
                  <th className="text-left px-5 py-3">Device</th>
                  <th className="text-left px-5 py-3">Method</th>
                  <th className="text-left px-5 py-3">Direction</th>
                  <th className="text-left px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {pageLogs.map((log) => (
                  <tr key={log.id} className="border-t border-border odd:bg-background even:bg-muted/20">
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={log.studentName} size="sm" />
                        <div>
                          <div className="font-medium">{log.studentName}</div>
                          <div className="text-xs text-muted-foreground">{log.studentId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">{log.className || '—'}</td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{log.deviceId}</span>
                    </td>
                    <td className="px-5 py-3 text-xs">{log.method}</td>
                    <td className="px-5 py-3 text-xs">{log.direction}</td>
                    <td className="px-5 py-3">
                      <span className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        log.status === "Present" && "bg-success/15 text-success",
                        log.status === "Late" && "bg-amber-100 text-amber-700",
                        log.status === "Absent" && "bg-destructive/15 text-destructive"
                      )}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                      {search || deviceFilter !== "All" || methodFilter !== "All" || statusFilter !== "All" || syncFilter !== "All"
                        ? "No logs match your filters."
                        : "No device logs found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-t border-border text-sm">
            <span className="text-muted-foreground">Page {page} of {totalPages}</span>
            <div className="space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-md border border-border disabled:opacity-50 hover:bg-muted"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-md border border-border disabled:opacity-50 hover:bg-muted"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-display font-bold">Device Health</h4>
              <span className="text-xs text-muted-foreground">Live status</span>
            </div>
            <div className="space-y-3">
              {tablets.length === 0 ? (
                <div className="rounded-lg border border-border px-3 py-6 text-center text-sm text-muted-foreground">
                  No devices found. Please register devices first.
                </div>
              ) : (
                tablets.map((tablet) => (
                  <div key={tablet.id} className="rounded-lg border border-border px-3 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">{tablet.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {tablet.lastHealthCheck ? `Last ping ${new Date(tablet.lastHealthCheck).toLocaleTimeString()}` : 'No ping data'}
                        </div>
                      </div>
                      <span className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        tablet.status === "online"
                          ? "bg-success/15 text-success"
                          : tablet.status === "offline"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-amber-100 text-amber-700"
                      )}>
                        {tablet.status === "online" ? "Online" : tablet.status === "offline" ? "Offline" : "Maintenance"}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      {tablet.status === "online" ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                      <span>{tablet.location || 'No location'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-display font-bold">Sync Alerts</h4>
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
            <div className="space-y-2 text-sm">
              {logs.filter((l) => l.syncState !== "Synced").slice(0, 4).map((log) => (
                <div key={log.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div>
                    <div className="font-semibold">{log.deviceId}</div>
                    <div className="text-xs text-muted-foreground">{log.studentName} - {formatTimestamp(log.timestamp)}</div>
                  </div>
                  <SyncBadge state={log.syncState} />
                </div>
              ))}
              {logs.every((l) => l.syncState === "Synced") && (
                <div className="rounded-lg border border-border px-3 py-4 text-center text-xs text-muted-foreground">
                  No sync alerts at the moment.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function SyncBadge({ state }: { state: "Synced" | "Queued" | "Failed" }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
        state === "Synced"
          ? "bg-success/15 text-success"
          : state === "Queued"
          ? "bg-amber-100 text-amber-700"
          : "bg-destructive/15 text-destructive"
      )}
    >
      {state}
    </span>
  );
}
