import { useCallback, useEffect, useRef, useState } from "react";
import { useGateSocket, type GateSocketEvent } from "@/hooks/useGateSocket";
import { createFileRoute } from "@tanstack/react-router";
import {
  LayoutDashboard, Radio, Users, Cpu, BarChart2,
  LogIn, LogOut, AlertTriangle, Wifi, WifiOff,
  RefreshCw, Search, Download, CheckCircle2, Loader2,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Avatar } from "@/components/ui-kit/Avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/gate")({ component: GatePage });

type AttendanceLog = {
  id: string;
  studentId: string;
  studentName: string;
  timestamp: string;
  method: string;
  direction: string;
  className?: string | null;
  section?: string | null;
  deviceId: string;
  status: string;
  syncState: string;
  sessionName?: string | null;
  flagged: boolean;
  flagReason?: string | null;
};

type AttendanceStats = {
  totalRecords: number;
  uniqueStudents: number;
  fingerprintCount: number;
  faceCount: number;
  cardCount: number;
  passwordCount: number;
  checkInCount: number;
  checkOutCount: number;
};

type Tablet = {
  id: string;
  name: string;
  status: string;
  lastHealthCheck?: string | null;
  location?: string | null;
  ip?: string | null;
  port?: number | null;
};

type StudentOnCampus = {
  id: string;
  first_name: string;
  last_name: string;
  admission_no?: string | null;
};

const TABS = ["Overview", "Live Monitor", "Students", "Devices", "Reports"] as const;
type Tab = (typeof TABS)[number];
const PAGE_SIZE = 25;

const fmt = (ts?: string | null) => {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
};

const fmtFull = (ts?: string | null) => {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const todayIso = () => new Date().toISOString().slice(0, 10);

function GatePage() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [date, setDate] = useState(todayIso());

  // shared data
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [tablets, setTablets] = useState<Tablet[]>([]);
  const [studentsOnCampus, setStudentsOnCampus] = useState<StudentOnCampus[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncSaved, setSyncSaved] = useState(0);

  // live monitor state
  const [liveLogs, setLiveLogs] = useState<AttendanceLog[]>([]);
  const [liveSearch, setLiveSearch] = useState("");
  const [liveDirFilter, setLiveDirFilter] = useState("All");
  const [liveLoading, setLiveLoading] = useState(false);

  // history filter state
  const [histSearch, setHistSearch] = useState("");
  const [histDir, setHistDir] = useState("All");
  const [histStatus, setHistStatus] = useState("All");
  const [histMethod, setHistMethod] = useState("All");

  // -- Fetch helpers ---------------------------------------------------------

  const fetchLogs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        startDate: date,
        endDate: date,
      });
      if (histDir !== "All") q.append("status", histDir === "In" ? "present" : "absent");
      if (histSearch) q.append("search", histSearch);
      if (histMethod !== "All") q.append("method", histMethod);

      const res = await apiRequest<{ data: AttendanceLog[]; meta: any }>(
        `/attendance/records/device-logs?${q}`,
        { auth: "school", returnMeta: true }
      );
      setLogs(res.data ?? []);
      setTotalLogs(res.meta?.total ?? 0);
      setTotalPages(res.meta?.totalPages ?? 1);
    } catch (e: any) {
      if (!silent) toast.error(e?.message ?? "Failed to load logs");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [page, date, histDir, histSearch, histMethod]);

  const fetchStats = useCallback(async () => {
    try {
      const s = await apiRequest<AttendanceStats>(
        `/attendance/records/device-logs/stats?startDate=${date}&endDate=${date}`,
        { auth: "school" }
      );
      setStats(s as AttendanceStats);
    } catch { /* silent */ }
  }, [date]);

  const fetchTablets = useCallback(async () => {
    try {
      const res = await apiRequest<{ data: Tablet[] }>(
        "/tablets/device-logs/list?is_active=true",
        { auth: "school" }
      );
      setTablets((res as any)?.data ?? []);
    } catch { /* silent */ }
  }, []);

  const fetchStudentsOnCampus = useCallback(async () => {
    try {
      const res = await apiRequest<StudentOnCampus[]>(
        "/gate/logs/active-on-campus",
        { auth: "school" }
      );
      setStudentsOnCampus(Array.isArray(res) ? res : []);
    } catch { /* silent */ }
  }, []);

  const fetchLiveLogs = useCallback(async () => {
    setLiveLoading(true);
    try {
      const today = todayIso();
      const res = await apiRequest<{ data: AttendanceLog[] }>(
        `/attendance/records/device-logs/today`,
        { auth: "school" }
      );
      const all: AttendanceLog[] = (res as any)?.data ?? [];
      setLiveLogs(all);
    } catch { /* silent */ }
    finally { setLiveLoading(false); }
  }, []);


  // -- Effects ---------------------------------------------------------------

  useEffect(() => {
    void Promise.all([fetchLogs(), fetchStats(), fetchTablets(), fetchStudentsOnCampus()]);
  }, [date, page, histDir, histSearch, histMethod]);

  // Live monitor: fetch today logs on tab switch, then socket keeps it live
  useEffect(() => {
    if (tab === "Live Monitor") {
      void fetchLiveLogs();
    }
  }, [tab]);

  // Socket: receive gate events in real-time (fires instantly after each device scan)
  useGateSocket({
    enabled: tab === "Live Monitor",
    onEvent: (event: GateSocketEvent) => {
      setLiveLogs(prev => {
        // Avoid duplicate entries (same logId already in list)
        if (prev.some(l => l.id === event.logId)) return prev;
        const newLog: AttendanceLog = {
          id: event.logId,
          studentId: event.studentId,
          studentName: event.studentName,
          timestamp: event.timestamp,
          method: event.method,
          direction: event.direction === "entry" ? "In" : event.direction === "exit" ? "Out" : event.direction,
          className: event.className ?? null,
          section: event.section ?? null,
          deviceId: event.deviceId,
          status: event.status.charAt(0).toUpperCase() + event.status.slice(1),
          syncState: "Synced",
          sessionName: event.sessionName ?? null,
          flagged: false,
        };
        return [newLog, ...prev];
      });
      // Also refresh today stats
      void fetchStats();
    },
  });

  // reset page on filter change
  useEffect(() => { setPage(1); }, [date, histDir, histSearch, histMethod]);

  // -- Sync Now --------------------------------------------------------------

  const handleSyncNow = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await apiRequest<{ totalSaved: number; summary: string }>(
        "/tablets/pull-all-logs",
        { method: "POST", auth: "school" }
      );
      const saved = (res as any)?.totalSaved ?? 0;
      setSyncSaved(saved);
      setLastSync(new Date());
      toast.success(`Synced — ${saved} new logs pulled`);
      await Promise.all([fetchLogs(true), fetchStats(), fetchStudentsOnCampus()]);
      if (tab === "Live Monitor") await fetchLiveLogs();
    } catch (e: any) {
      toast.error(e?.message ?? "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  // -- Computed --------------------------------------------------------------

  const onlinePct = tablets.length
    ? Math.round((tablets.filter(t => t.status === "online").length / tablets.length) * 100)
    : 0;

  const filteredLive = liveLogs.filter(l => {
    const matchDir = liveDirFilter === "All" || l.direction === liveDirFilter;
    const matchQ = !liveSearch || l.studentName.toLowerCase().includes(liveSearch.toLowerCase())
      || l.studentId.toLowerCase().includes(liveSearch.toLowerCase());
    return matchDir && matchQ;
  });

  // hourly distribution for analytics
  const hourDist: { slot: string; count: number }[] = Array.from({ length: 13 }, (_, i) => ({
    slot: `${String(6 + i).padStart(2, "0")}:00`,
    count: logs.filter(l => new Date(l.timestamp).getHours() === 6 + i).length,
  }));

  const uniqueMethods = Array.from(new Set(logs.map(l => l.method).filter(m => m && m !== "Unknown")));

  return (
    <AppLayout title="Gate Management" subtitle="Entry, exit and on-campus tracking">

      {/* Sync status */}
      {lastSync && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Last sync: {lastSync.toLocaleTimeString()} — {syncSaved} new logs pulled from devices</span>
        </div>
      )}

      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="date"
          value={date}
          onChange={e => { setDate(e.target.value); setPage(1); }}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        />
        <button
          type="button"
          onClick={() => void Promise.all([fetchLogs(), fetchStats(), fetchTablets(), fetchStudentsOnCampus()])}
          disabled={loading}
          className="h-10 inline-flex items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
        </button>
        <button
          type="button"
          onClick={handleSyncNow}
          disabled={syncing}
          className="h-10 inline-flex items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {syncing ? <><Loader2 className="h-4 w-4 animate-spin" /> Syncing…</> : <><Wifi className="h-4 w-4" /> Sync Now</>}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-5">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors",
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "Overview" && <LayoutDashboard className="h-3.5 w-3.5" />}
            {t === "Live Monitor" && <Radio className="h-3.5 w-3.5" />}
            {t === "Students" && <Users className="h-3.5 w-3.5" />}
            {t === "Devices" && <Cpu className="h-3.5 w-3.5" />}
            {t === "Reports" && <BarChart2 className="h-3.5 w-3.5" />}
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview"     && <OverviewTab stats={stats} logs={logs} tablets={tablets} loading={loading} studentsOnCampus={studentsOnCampus} date={date} onSyncNow={handleSyncNow} syncing={syncing} />}
      {tab === "Live Monitor" && <LiveMonitorTab logs={filteredLive} loading={liveLoading} search={liveSearch} onSearch={setLiveSearch} dirFilter={liveDirFilter} onDirFilter={setLiveDirFilter} onRefresh={fetchLiveLogs} />}
      {tab === "Students"     && <StudentsTab studentsOnCampus={studentsOnCampus} logs={logs} loading={loading} />}
      {tab === "Devices"      && <DevicesTab tablets={tablets} onRefresh={fetchTablets} />}
      {tab === "Reports"      && <ReportsTab logs={logs} stats={stats} hourDist={hourDist} methods={uniqueMethods} date={date} />}

    </AppLayout>
  );
}


// --- Overview Tab -------------------------------------------------------------

function OverviewTab({ stats, logs, tablets, loading, studentsOnCampus, date, onSyncNow, syncing }: {
  stats: AttendanceStats | null;
  logs: AttendanceLog[];
  tablets: Tablet[];
  loading: boolean;
  studentsOnCampus: StudentOnCampus[];
  date: string;
  onSyncNow: () => void;
  syncing: boolean;
}) {
  const online = tablets.filter(t => t.status === "online").length;
  const entries = logs.filter(l => l.direction === "In").length;
  const exits   = logs.filter(l => l.direction === "Out").length;
  const flagged = logs.filter(l => l.flagged).length;
  const isToday = date === new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {loading ? (
          [1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <StatCard label="On Campus Now" value={studentsOnCampus.length} tone="success" icon={<Users className="h-5 w-5" />} />
            <StatCard label={`Entries (${date})`} value={entries} tone="primary" icon={<LogIn className="h-5 w-5" />} />
            <StatCard label={`Exits (${date})`} value={exits} icon={<LogOut className="h-5 w-5" />} />
            <StatCard label="Flagged" value={flagged} tone={flagged > 0 ? "destructive" : "primary"} icon={<AlertTriangle className="h-5 w-5" />} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Campus status card */}
        <div className="rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-5 shadow-lg">
          <div className="text-xs uppercase tracking-wider font-bold opacity-90">Live Campus Status</div>
          <div className="font-display text-5xl font-bold mt-2">{studentsOnCampus.length}</div>
          <div className="text-sm opacity-90 mt-1">students currently on campus</div>
          <div className="mt-4 space-y-1 text-xs opacity-80">
            <div className="flex justify-between"><span>Entries today</span><span className="font-bold">{entries}</span></div>
            <div className="flex justify-between"><span>Exits today</span><span className="font-bold">{exits}</span></div>
            <div className="flex justify-between"><span>Unique students</span><span className="font-bold">{stats?.uniqueStudents ?? 0}</span></div>
          </div>
        </div>

        {/* Recent logs */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-display font-bold">Recent Scans</h3>
            <span className="text-xs text-muted-foreground">Latest {Math.min(logs.length, 8)} of {logs.length}</span>
          </div>
          <div className="divide-y divide-border">
            {loading ? (
              [1,2,3,4].map(i => <div key={i} className="px-5 py-3"><Skeleton className="h-8" /></div>)
            ) : logs.slice(0, 8).map(log => (
              <div key={log.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30">
                <div className="flex items-center gap-3">
                  <Avatar name={log.studentName} size="sm" />
                  <div>
                    <div className="text-sm font-semibold">{log.studentName}</div>
                    <div className="text-xs text-muted-foreground">{log.className ?? "—"} · {log.method}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <span className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    log.direction === "In" ? "bg-success/15 text-success" : "bg-amber-100 text-amber-700"
                  )}>{log.direction}</span>
                  <span className="font-mono text-xs text-muted-foreground">{fmt(log.timestamp)}</span>
                </div>
              </div>
            ))}
            {!loading && logs.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No logs for this date. Use <strong>Sync Now</strong> to pull from devices.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Device health summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {tablets.slice(0, 6).map(t => (
          <div key={t.id} className="rounded-xl border border-border bg-card px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">{t.name}</div>
              <div className="text-xs text-muted-foreground">{t.location ?? "No location"}</div>
            </div>
            <span className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              t.status === "online" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
            )}>
              {t.status === "online" ? "Online" : "Offline"}
            </span>
          </div>
        ))}
        {tablets.length === 0 && <div className="rounded-xl border border-border bg-card px-4 py-4 text-sm text-muted-foreground col-span-3">No devices registered.</div>}
      </div>
    </div>
  );
}


// --- Live Monitor Tab ---------------------------------------------------------
// Shows today's logs, deduped by student (latest scan only), auto-polls every 30 s

function LiveMonitorTab({ logs, loading, search, onSearch, dirFilter, onDirFilter, onRefresh }: {
  logs: AttendanceLog[];
  loading: boolean;
  search: string;
  onSearch: (v: string) => void;
  dirFilter: string;
  onDirFilter: (v: string) => void;
  onRefresh: () => void;
}) {
  // Deduplicate: show only the latest scan per student (no duplicate rows)
  const deduped = (() => {
    const map = new Map<string, AttendanceLog>();
    for (const l of [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())) {
      map.set(l.studentId, l);
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  })();

  const entries = deduped.filter(l => l.direction === "In").length;
  const exits   = deduped.filter(l => l.direction === "Out").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="On Campus" value={entries} tone="success" icon={<LogIn className="h-5 w-5" />} />
        <StatCard label="Exited" value={exits} icon={<LogOut className="h-5 w-5" />} />
        <StatCard label="Unique Students" value={deduped.length} />
        <StatCard label="Total Scans Today" value={logs.length} />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search student name or ID…"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={dirFilter}
          onChange={e => onDirFilter(e.target.value)}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="All">All</option>
          <option value="In">In</option>
          <option value="Out">Out</option>
        </select>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="h-10 inline-flex items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
        </button>
        <span className="text-xs text-muted-foreground ml-1">Auto-refreshes every 30 s</span>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-display font-bold">Live Attendance — Today</h3>
          <div className="flex items-center gap-1.5 text-xs text-success font-semibold">
            <span className="inline-block h-2 w-2 rounded-full bg-success animate-pulse" />
            Live
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                {["Student", "Class", "Direction", "Method", "Device", "Time", "Status"].map(h => (
                  <th key={h} className="text-left px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && deduped.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : deduped.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No attendance records for today yet.</td></tr>
              ) : deduped.map(log => (
                <tr key={log.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={log.studentName} size="sm" />
                      <div>
                        <div className="font-semibold text-sm">{log.studentName}</div>
                        <div className="text-xs text-muted-foreground">{log.studentId}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">{log.className ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      log.direction === "In" ? "bg-success/15 text-success" : "bg-amber-100 text-amber-700"
                    )}>{log.direction}</span>
                  </td>
                  <td className="px-4 py-3 text-xs capitalize">{log.method}</td>
                  <td className="px-4 py-3 text-xs">{log.deviceId}</td>
                  <td className="px-4 py-3 font-mono text-xs">{fmt(log.timestamp)}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      log.status === "Present" && "bg-success/15 text-success",
                      log.status === "Late" && "bg-amber-100 text-amber-700",
                      log.status === "Absent" && "bg-destructive/15 text-destructive",
                    )}>{log.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


// --- Students Tab -------------------------------------------------------------

function StudentsTab({ studentsOnCampus, logs, loading }: {
  studentsOnCampus: StudentOnCampus[];
  logs: AttendanceLog[];
  loading: boolean;
}) {
  const [search, setSearch] = useState("");

  const filtered = studentsOnCampus.filter(s => {
    const n = `${s.first_name} ${s.last_name}`.toLowerCase();
    return !search || n.includes(search.toLowerCase()) || (s.admission_no ?? "").includes(search);
  });

  // build a lookup: studentId -> last scan time from logs
  const lastScan = new Map<string, string>();
  for (const log of logs) {
    if (!lastScan.has(log.studentId) || new Date(log.timestamp) > new Date(lastScan.get(log.studentId)!)) {
      lastScan.set(log.studentId, log.timestamp);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="On Campus Now" value={studentsOnCampus.length} tone="success" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Scanned Today" value={logs.length} tone="primary" />
        <StatCard label="Flagged" value={logs.filter(l => l.flagged).length} tone={logs.filter(l => l.flagged).length > 0 ? "destructive" : "primary"} />
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search students on campus…"
          className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
        />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="font-display font-bold">Students Currently On Campus</h3>
          <p className="text-xs text-muted-foreground">Based on latest gate scan — entry without a matching exit</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Student</th>
                <th className="text-left px-4 py-3">Admission No.</th>
                <th className="text-left px-4 py-3">Last Scan</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No students currently on campus.</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={`${s.first_name} ${s.last_name}`} size="sm" />
                      <span className="font-semibold">{s.first_name} {s.last_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">{s.admission_no ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{fmt(lastScan.get(s.id))}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-success/15 text-success px-2.5 py-0.5 text-xs font-semibold">On Campus</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


// --- Devices Tab --------------------------------------------------------------

function DevicesTab({ tablets, onRefresh }: { tablets: Tablet[]; onRefresh: () => void }) {
  const online  = tablets.filter(t => t.status === "online").length;
  const offline = tablets.filter(t => t.status === "offline").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Devices" value={tablets.length} icon={<Cpu className="h-5 w-5" />} />
        <StatCard label="Online" value={online} tone="success" icon={<Wifi className="h-5 w-5" />} />
        <StatCard label="Offline" value={offline} tone="destructive" icon={<WifiOff className="h-5 w-5" />} />
        <StatCard label="In Maintenance" value={tablets.filter(t => t.status === "maintenance").length} tone="warning" />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold">Device / Tablet Status</h3>
            <p className="text-xs text-muted-foreground">Logs are pulled automatically every 5 minutes from online devices</p>
          </div>
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        <div className="divide-y divide-border">
          {tablets.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">No devices found. Register devices via the Super Admin panel.</div>
          ) : tablets.map(t => (
            <div key={t.id} className="flex items-center justify-between px-5 py-4 hover:bg-muted/20">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-9 w-9 rounded-lg grid place-items-center text-white",
                  t.status === "online" ? "bg-success" : t.status === "offline" ? "bg-destructive" : "bg-amber-500"
                )}>
                  {t.status === "online" ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                </div>
                <div>
                  <div className="font-semibold text-sm">{t.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {[t.ip, t.port ? String(t.port) : null, t.location].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <div className="text-xs text-muted-foreground">Last ping</div>
                  <div className="text-xs font-mono">{fmt(t.lastHealthCheck)}</div>
                </div>
                <span className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                  t.status === "online" ? "bg-success/15 text-success"
                    : t.status === "offline" ? "bg-destructive/15 text-destructive"
                    : "bg-amber-100 text-amber-700"
                )}>{t.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// --- Reports Tab --------------------------------------------------------------

function ReportsTab({ logs, stats, hourDist, methods, date }: {
  logs: AttendanceLog[];
  stats: AttendanceStats | null;
  hourDist: { slot: string; count: number }[];
  methods: string[];
  date: string;
}) {
  const peakSlot = hourDist.reduce((best, h) => h.count > best.count ? h : best, { slot: "—", count: 0 });
  const avgHour = logs.length > 0
    ? Math.round(logs.reduce((s, l) => s + new Date(l.timestamp).getHours(), 0) / logs.length)
    : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Scans" value={stats?.totalRecords ?? logs.length} />
        <StatCard label="Unique Students" value={stats?.uniqueStudents ?? 0} />
        <StatCard label="Fingerprint Scans" value={stats?.fingerprintCount ?? 0} />
        <StatCard label="Face Recognition" value={stats?.faceCount ?? 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-display font-bold">Entry Time Distribution</div>
              <div className="text-xs text-muted-foreground">{date}</div>
            </div>
            {peakSlot.count > 0 && (
              <div className="rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-bold">
                Peak: {peakSlot.slot} — {peakSlot.count} scans
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={hourDist}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="slot" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area dataKey="count" name="Scans" stroke="#3b5998" fill="#3b5998" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="font-display font-bold">Scan Summary</div>
          <div className="space-y-3">
            {[
              { label: "Total Records", value: stats?.totalRecords ?? logs.length },
              { label: "Check-ins (In)", value: stats?.checkInCount ?? logs.filter(l => l.direction === "In").length },
              { label: "Check-outs (Out)", value: stats?.checkOutCount ?? logs.filter(l => l.direction === "Out").length },
              { label: "Fingerprint", value: stats?.fingerprintCount ?? 0 },
              { label: "Face", value: stats?.faceCount ?? 0 },
              { label: "Card / RFID", value: stats?.cardCount ?? 0 },
              { label: "Peak Hour", value: peakSlot.count > 0 ? peakSlot.slot : "—" },
              { label: "Avg. Hour", value: logs.length > 0 ? `${String(avgHour).padStart(2, "0")}:00` : "—" },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0 last:pb-0">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-bold">{r.value}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => toast.info("CSV export coming soon")}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted/40"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Method breakdown */}
      {methods.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="font-display font-bold mb-3">Authentication Methods</div>
          <div className="flex flex-wrap gap-3">
            {methods.map(m => {
              const count = logs.filter(l => l.method === m).length;
              const pct = logs.length ? Math.round((count / logs.length) * 100) : 0;
              return (
                <div key={m} className="rounded-lg border border-border px-4 py-3 min-w-[140px]">
                  <div className="text-sm font-semibold">{m}</div>
                  <div className="font-display text-2xl font-bold mt-1">{count}</div>
                  <div className="text-xs text-muted-foreground">{pct}% of total</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}



