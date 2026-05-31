import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Wifi, WifiOff, RefreshCw, AlertTriangle, Database } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Avatar } from "@/components/ui-kit/Avatar";
import { cn } from "@/lib/utils";
import { TODAY_ATTENDANCE, type Status } from "@/lib/mockData";

export const Route = createFileRoute("/boarding/device-logs")({ component: DeviceLogsPage });

type DeviceStatus = "online" | "offline" | "maintenance";

type Device = {
  id: string;
  name: string;
  location: string;
  status: DeviceStatus;
  lastPing: string;
};

type DeviceLog = {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  status: Status;
  method: string;
  direction: "Entry" | "Exit";
  deviceId: string;
  time: string;
  syncState: "Synced" | "Queued" | "Failed";
};

const DEVICES: Device[] = [
  { id: "BD-DEV-01", name: "Dormitory A Entrance", location: "Dorm A", status: "online", lastPing: "1 min ago" },
  { id: "BD-DEV-02", name: "Dormitory B Entrance", location: "Dorm B", status: "online", lastPing: "3 min ago" },
  { id: "BD-DEV-03", name: "Dining Hall", location: "Dining Hall", status: "maintenance", lastPing: "22 min ago" },
  { id: "BD-DEV-04", name: "Dormitory C Rear Gate", location: "Dorm C", status: "offline", lastPing: "2 hrs ago" },
];

const METHODS = ["Face ID", "Fingerprint", "RFID Card", "PIN"];
const EMPTY_TIME = "\u2014";

const DEVICE_LOGS: DeviceLog[] = TODAY_ATTENDANCE.map((record, index) => {
  const time = record.timeIn === EMPTY_TIME ? `07:${String(40 + (index % 15)).padStart(2, "0")}` : record.timeIn;
  return {
    id: `LOG-${index}`,
    studentId: record.studentId,
    studentName: record.studentName,
    className: record.class,
    status: record.status,
    method: METHODS[index % METHODS.length],
    direction: index % 3 === 0 ? "Exit" : "Entry",
    deviceId: DEVICES[index % DEVICES.length].id,
    time,
    syncState: index % 9 === 0 ? "Failed" : index % 6 === 0 ? "Queued" : "Synced",
  };
});

function DeviceLogsPage() {
  const [deviceFilter, setDeviceFilter] = useState("All");
  const [methodFilter, setMethodFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"All" | Status>("All");
  const [syncFilter, setSyncFilter] = useState<"All" | "Synced" | "Queued" | "Failed">("All");
  const [search, setSearch] = useState("");

  const filteredLogs = useMemo(() => {
    return DEVICE_LOGS.filter((log) => {
      const matchesDevice = deviceFilter === "All" || log.deviceId === deviceFilter;
      const matchesMethod = methodFilter === "All" || log.method === methodFilter;
      const matchesStatus = statusFilter === "All" || log.status === statusFilter;
      const matchesSync = syncFilter === "All" || log.syncState === syncFilter;
      const target = `${log.studentName} ${log.studentId} ${log.deviceId}`.toLowerCase();
      const matchesSearch = search === "" || target.includes(search.toLowerCase());
      return matchesDevice && matchesMethod && matchesStatus && matchesSync && matchesSearch;
    });
  }, [deviceFilter, methodFilter, statusFilter, syncFilter, search]);

  const stats = useMemo(() => {
    const total = DEVICE_LOGS.length;
    const synced = DEVICE_LOGS.filter((l) => l.syncState === "Synced").length;
    const queued = DEVICE_LOGS.filter((l) => l.syncState === "Queued").length;
    const failed = DEVICE_LOGS.filter((l) => l.syncState === "Failed").length;
    const online = DEVICES.filter((d) => d.status === "online").length;
    return { total, synced, queued, failed, online };
  }, []);

  return (
    <AppLayout title="Device Logs" subtitle="Attendance logs and monitoring from boarding devices">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total Logs" value={stats.total} icon={<Database className="h-5 w-5" />} />
        <StatCard label="Synced" value={stats.synced} tone="success" />
        <StatCard label="Queued" value={stats.queued} tone="warning" />
        <StatCard label="Failed" value={stats.failed} tone="destructive" />
        <StatCard label="Devices Online" value={stats.online} tone="success" icon={<Wifi className="h-5 w-5" />} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-3 items-center mb-5">
        <select
          value={deviceFilter}
          onChange={(event) => setDeviceFilter(event.target.value)}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="All">All Devices</option>
          {DEVICES.map((d) => <option key={d.id} value={d.id}>{d.id}</option>)}
        </select>
        <select
          value={methodFilter}
          onChange={(event) => setMethodFilter(event.target.value)}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="All">All Methods</option>
          {METHODS.map((m) => <option key={m}>{m}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as "All" | Status)}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="All">All Status</option>
          <option value="Present">Present</option>
          <option value="Late">Late</option>
          <option value="Absent">Absent</option>
        </select>
        <select
          value={syncFilter}
          onChange={(event) => setSyncFilter(event.target.value as "All" | "Synced" | "Queued" | "Failed")}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="All">All Sync</option>
          <option value="Synced">Synced</option>
          <option value="Queued">Queued</option>
          <option value="Failed">Failed</option>
        </select>
        <div className="relative flex-1 min-w-[200px]">
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
          onClick={() => setSearch("")}
          className="h-10 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-muted"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.65fr_1fr] gap-5">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold">Attendance Logs</h3>
              <p className="text-xs text-muted-foreground">Live attendance logs across all boarding devices.</p>
            </div>
            <div className="text-xs text-muted-foreground">Showing {filteredLogs.length} records</div>
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
                  <th className="text-left px-5 py-3">Sync</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="border-t border-border odd:bg-background even:bg-muted/20">
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{log.time}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={log.studentName} size="sm" />
                        <div>
                          <div className="font-medium">{log.studentName}</div>
                          <div className="text-xs text-muted-foreground">{log.studentId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">{log.className}</td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{log.deviceId}</span>
                    </td>
                    <td className="px-5 py-3 text-xs">{log.method}</td>
                    <td className="px-5 py-3 text-xs">{log.direction}</td>
                    <td className="px-5 py-3"><StatusBadge status={log.status} /></td>
                    <td className="px-5 py-3"><SyncBadge state={log.syncState} /></td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">No logs match your filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-display font-bold">Device Health</h4>
              <span className="text-xs text-muted-foreground">Live status</span>
            </div>
            <div className="space-y-3">
              {DEVICES.map((device) => (
                <div key={device.id} className="rounded-lg border border-border px-3 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">{device.name}</div>
                      <div className="text-xs text-muted-foreground">Last ping {device.lastPing}</div>
                    </div>
                    <span className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      device.status === "online"
                        ? "bg-success/15 text-success"
                        : device.status === "offline"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-amber-100 text-amber-700"
                    )}>
                      {device.status === "online" ? "Online" : device.status === "offline" ? "Offline" : "Maintenance"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    {device.status === "online" ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                    <span>{device.location}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-display font-bold">Sync Alerts</h4>
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
            <div className="space-y-2 text-sm">
              {DEVICE_LOGS.filter((l) => l.syncState !== "Synced").slice(0, 4).map((log) => (
                <div key={log.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div>
                    <div className="font-semibold">{log.deviceId}</div>
                    <div className="text-xs text-muted-foreground">{log.studentName} - {log.time}</div>
                  </div>
                  <SyncBadge state={log.syncState} />
                </div>
              ))}
              {DEVICE_LOGS.every((l) => l.syncState === "Synced") && (
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
