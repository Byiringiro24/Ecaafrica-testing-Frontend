import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Download } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui-kit/Avatar";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/attendance/device-attendance")({
  component: DeviceAttendancePage,
});

type ApiStatus = "present" | "absent" | "late" | "excused";

type ApiRecord = {
  id: string;
  session_id: string;
  student_id: string;
  status: ApiStatus;
  scan_method?: string | null;
  scanned_at?: string | null;
  created_at?: string | null;
};

type ApiSession = {
  id: string;
  section_id: string;
  session_date: string;
  session_type?: string | null;
};

type ApiStudent = {
  id: string;
  first_name: string;
  last_name: string;
  student_id_number?: string | null;
  current_section?: { name: string; full_name: string } | null;
};

type AttendanceRow = {
  id: string;
  studentName: string;
  studentNumber: string;
  className: string;
  status: string;
  scanMethod: string;
  time: string;
  date: string;
};

const PAGE_SIZE = 25;

const formatTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB");
};

const capitalizeStatus = (status: string) => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const formatScanMethod = (method?: string | null) => {
  if (!method) return "Unknown";
  if (method === "manual") return "Manual";
  return method
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

function DeviceAttendancePage() {
  const todayValue = new Date().toISOString().slice(0, 10);
  const [records, setRecords] = useState<ApiRecord[]>([]);
  const [sessions, setSessions] = useState<ApiSession[]>([]);
  const [students, setStudents] = useState<Record<string, ApiStudent>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ApiStatus>("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState(todayValue);
  const [page, setPage] = useState(1);

  const loadData = async () => {
    setLoading(true);
    try {
      const [recordList, sessionList, studentList] = await Promise.all([
        apiRequest<ApiRecord[]>(
          `/attendance/records?date=${dateFilter}&limit=5000`,
          { auth: "school" }
        ),
        apiRequest<ApiSession[]>(
          `/attendance/sessions?date=${dateFilter}&limit=500`,
          { auth: "school" }
        ),
        apiRequest<ApiStudent[]>("/students?limit=2000", { auth: "school" }),
      ]);

      setRecords(Array.isArray(recordList) ? recordList : []);
      setSessions(Array.isArray(sessionList) ? sessionList : []);

      const studentMap = (Array.isArray(studentList) ? studentList : []).reduce<
        Record<string, ApiStudent>
      >((acc, student) => {
        acc[student.id] = student;
        return acc;
      }, {});
      setStudents(studentMap);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load device attendance records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [dateFilter]);

  const sessionMap = useMemo(
    () => new Map(sessions.map((s) => [s.id, s])),
    [sessions]
  );

  const deviceRecords = useMemo(() => {
    return records.filter(
      (record) => record.scan_method && record.scan_method !== "manual"
    );
  }, [records]);

  const rows = useMemo<AttendanceRow[]>(() => {
    return deviceRecords
      .filter(
        (record) =>
          (statusFilter === "all" || record.status === statusFilter) &&
          (methodFilter === "all" || record.scan_method === methodFilter)
      )
      .map((record) => {
        const student = students[record.student_id];
        const session = sessionMap.get(record.session_id);
        const studentName = student
          ? [student.first_name, student.last_name].filter(Boolean).join(" ")
          : "Unknown Student";
        const className =
          student?.current_section?.full_name ??
          student?.current_section?.name ??
          "—";

        return {
          id: record.id,
          studentName,
          studentNumber: student?.student_id_number ?? "—",
          className,
          status: capitalizeStatus(record.status),
          scanMethod: formatScanMethod(record.scan_method),
          time: formatTime(record.scanned_at ?? record.created_at),
          date: formatDate(session?.session_date ?? record.scanned_at),
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
  }, [deviceRecords, students, sessionMap, statusFilter, methodFilter, query]);

  const uniqueMethods = useMemo(() => {
    const methods = new Set<string>();
    deviceRecords.forEach((record) => {
      if (record.scan_method && record.scan_method !== "manual") {
        methods.add(record.scan_method);
      }
    });
    return Array.from(methods).sort();
  }, [deviceRecords]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      present: rows.filter((r) => r.status === "Present").length,
      absent: rows.filter((r) => r.status === "Absent").length,
      late: rows.filter((r) => r.status === "Late").length,
    };
  }, [rows]);

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
            <StatCard label="Total Records" value={stats.total} tone="primary" />
            <StatCard label="Present" value={stats.present} tone="success" />
            <StatCard label="Absent" value={stats.absent} tone="destructive" />
            <StatCard label="Late" value={stats.late} tone="warning" />
          </>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-3 items-center mb-5">
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
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as typeof statusFilter);
            setPage(1);
          }}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="present">Present</option>
          <option value="absent">Absent</option>
          <option value="late">Late</option>
          <option value="excused">Excused</option>
        </select>
        <select
          value={methodFilter}
          onChange={(e) => {
            setMethodFilter(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="all">All Methods</option>
          {uniqueMethods.map((method) => (
            <option key={method} value={method}>
              {formatScanMethod(method)}
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
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No device attendance records found for the selected filters.
                  </td>
                </tr>
              ) : (
                pageRows.map((row, index) => (
                  <tr key={row.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground">
                      {(page - 1) * PAGE_SIZE + index + 1}
                    </td>
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
                          row.status === "Present"
                            ? "bg-success/15 text-success"
                            : row.status === "Absent"
                            ? "bg-destructive/15 text-destructive"
                            : row.status === "Late"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{row.time}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        {row.scanMethod}
                      </span>
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
                className="rounded-md border border-border px-3 py-1 disabled:opacity-50 hover:bg-muted"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-border px-3 py-1 disabled:opacity-50 hover:bg-muted"
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
            onClick={() => toast.info("Export feature coming soon")}
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
