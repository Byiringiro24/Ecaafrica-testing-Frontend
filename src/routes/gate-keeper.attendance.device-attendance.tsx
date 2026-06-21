import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Download } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui-kit/Avatar";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { todayIso } from "@/lib/gateKeeperAttendance";

export const Route = createFileRoute("/gate-keeper/attendance/device-attendance")({
  component: DeviceAttendancePage,
});

type GateLogRecord = {
  id: string;
  student_id?: string | null;
  event_type: "entry" | "exit";
  scan_method?: string | null;
  scanned_at?: string | null;
  device_id?: string | null;
  is_flagged?: boolean;
  flag_reason?: string | null;
};

type StudentRecord = {
  id: string;
  first_name: string;
  last_name: string;
  student_id_number?: string | null;
  current_section?: { full_name?: string | null; name?: string | null } | null;
};

type AttendanceRow = {
  id: string;
  studentName: string;
  studentNumber: string;
  className: string;
  eventType: "Entry" | "Exit";
  scanMethod: string;
  time: string;
  deviceId: string;
  flagged: boolean;
  flagReason: string;
};

const PAGE_SIZE = 25;

const formatTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
};

function DeviceAttendancePage() {
  const [logs, setLogs] = useState<GateLogRecord[]>([]);
  const [students, setStudents] = useState<Record<string, StudentRecord>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [eventFilter, setEventFilter] = useState<"all" | "entry" | "exit">("all");
  const [dateFilter, setDateFilter] = useState(todayIso());
  const [page, setPage] = useState(1);

  const loadData = async () => {
    setLoading(true);
    try {
      const [gateLogs, studentList] = await Promise.all([
        apiRequest<GateLogRecord[]>(
          `/gate/logs?limit=1000&sort=scanned_at&order=desc&date=${dateFilter}`,
          { auth: "school" }
        ),
        apiRequest<StudentRecord[]>("/students?limit=2000", { auth: "school" }),
      ]);

      setLogs(Array.isArray(gateLogs) ? gateLogs : []);

      const studentMap = (Array.isArray(studentList) ? studentList : []).reduce<
        Record<string, StudentRecord>
      >((acc, student) => {
        acc[student.id] = student;
        return acc;
      }, {});
      setStudents(studentMap);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load device attendance logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [dateFilter]);

  const rows = useMemo<AttendanceRow[]>(() => {
    return logs
      .filter((log) => eventFilter === "all" || log.event_type === eventFilter)
      .map((log) => {
        const student = log.student_id ? students[log.student_id] : undefined;
        const studentName = student
          ? [student.first_name, student.last_name].filter(Boolean).join(" ")
          : "Unknown Student";
        const className =
          student?.current_section?.full_name ??
          student?.current_section?.name ??
          "—";

        return {
          id: log.id,
          studentName,
          studentNumber: student?.student_id_number ?? "—",
          className,
          eventType: log.event_type === "entry" ? "Entry" : "Exit",
          scanMethod: log.scan_method ?? "manual",
          time: formatTime(log.scanned_at),
          deviceId: log.device_id ?? "—",
          flagged: Boolean(log.is_flagged),
          flagReason: log.flag_reason ?? "—",
        };
      })
      .filter((row) => {
        if (!query.trim()) return true;
        const needle = query.toLowerCase();
        return (
          row.studentName.toLowerCase().includes(needle) ||
          row.studentNumber.toLowerCase().includes(needle) ||
          row.className.toLowerCase().includes(needle)
        );
      });
  }, [logs, students, eventFilter, query]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const entries = rows.filter((row) => row.eventType === "Entry").length;
  const exits = rows.filter((row) => row.eventType === "Exit").length;
  const flagged = rows.filter((row) => row.flagged).length;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {loading ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : (
          <>
            <StatCard label="Total Logs" value={rows.length} tone="primary" />
            <StatCard label="Entries" value={entries} tone="success" />
            <StatCard label="Exits" value={exits} tone="secondary" />
            <StatCard label="Flagged" value={flagged} tone={flagged ? "destructive" : "primary"} />
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-4">
        <div className="relative flex-1 min-w-60">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
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
          value={eventFilter}
          onChange={(e) => {
            setEventFilter(e.target.value as typeof eventFilter);
            setPage(1);
          }}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="all">All Events</option>
          <option value="entry">Entries Only</option>
          <option value="exit">Exits Only</option>
        </select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                {["Student", "Class", "Event", "Time", "Method", "Device", "Status"].map((header) => (
                  <th key={header} className="text-left px-4 py-3 whitespace-nowrap">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Loading device attendance logs…
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No device attendance logs found for the selected filters.
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr key={row.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={row.studentName} size="sm" />
                        <div>
                          <div className="font-semibold">{row.studentName}</div>
                          <div className="text-xs text-muted-foreground">{row.studentNumber}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{row.className}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          row.eventType === "Entry"
                            ? "bg-success/15 text-success"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {row.eventType}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{row.time}</td>
                    <td className="px-4 py-3 capitalize">{row.scanMethod.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3">{row.deviceId}</td>
                    <td className="px-4 py-3">
                      {row.flagged ? (
                        <span className="text-xs font-semibold text-destructive" title={row.flagReason}>
                          Flagged
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Normal</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && rows.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} of{" "}
              {rows.length}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-md border border-border px-3 py-1 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-border px-3 py-1 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {!loading && rows.length > 0 && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => toast.info("Export coming soon")}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted/40"
          >
            <Download className="h-4 w-4" />
            Export Logs
          </button>
        </div>
      )}
    </>
  );
}
