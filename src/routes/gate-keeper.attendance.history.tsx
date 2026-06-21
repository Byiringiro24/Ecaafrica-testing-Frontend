import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui-kit/Avatar";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import {
  type ApiRecord,
  type ApiSession,
  type ApiStudent,
  type ClassRecord,
  type SectionRecord,
  type UiStatus,
  STATUS_LABEL,
  formatLongDate,
  formatTime,
  todayIso,
} from "@/lib/gateKeeperAttendance";

export const Route = createFileRoute("/gate-keeper/attendance/history")({
  component: AttendanceHistoryPage,
});

const PAGE_SIZE = 25;

type HistoryRow = {
  id: string;
  studentName: string;
  cardId: string;
  className: string;
  timeIn: string;
  status: UiStatus;
  submitted: boolean;
};

function AttendanceHistoryPage() {
  const todayValue = todayIso();
  const [classRecords, setClassRecords] = useState<ClassRecord[]>([]);
  const [sectionRecords, setSectionRecords] = useState<SectionRecord[]>([]);
  const [studentsById, setStudentsById] = useState<Record<string, ApiStudent>>({});
  const [sessions, setSessions] = useState<ApiSession[]>([]);
  const [records, setRecords] = useState<ApiRecord[]>([]);
  const [dateFilter, setDateFilter] = useState(todayValue);
  const [classFilter, setClassFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"All" | UiStatus>("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const classMap = useMemo(
    () => new Map(classRecords.map((item) => [item.id, item])),
    [classRecords]
  );
  const sectionMap = useMemo(
    () => new Map(sectionRecords.map((item) => [item.id, item])),
    [sectionRecords]
  );

  const classLabelForSection = (sectionId?: string) => {
    if (!sectionId) return "—";
    const section = sectionMap.get(sectionId);
    if (!section) return "—";
    const cls = classMap.get(section.class_id);
    if (cls) return `${cls.name}${section.name}`;
    return section.full_name || section.name;
  };

  const loadClassData = async () => {
    try {
      const [classes, sections] = await Promise.all([
        apiRequest<ClassRecord[]>("/classes?limit=200", { auth: "school" }),
        apiRequest<SectionRecord[]>("/sections?limit=200", { auth: "school" }),
      ]);
      setClassRecords(Array.isArray(classes) ? classes : []);
      setSectionRecords(Array.isArray(sections) ? sections : []);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load classes");
    }
  };

  const fetchStudentsForSections = async (sectionIds: string[]) => {
    if (!sectionIds.length) return;
    const batches = await Promise.all(
      sectionIds.map((sectionId) =>
        apiRequest<ApiStudent[]>(`/students?section_id=${sectionId}&limit=1000`, {
          auth: "school",
        }).catch(() => [])
      )
    );
    const merged = batches.flat();
    if (!merged.length) return;
    setStudentsById((prev) => {
      const next = { ...prev };
      merged.forEach((student) => {
        next[student.id] = student;
      });
      return next;
    });
  };

  const loadHistory = async (targetDate: string) => {
    setLoading(true);
    try {
      const [sessionList, recordList] = await Promise.all([
        apiRequest<ApiSession[]>(`/attendance/sessions?date=${targetDate}&limit=500`, {
          auth: "school",
        }),
        apiRequest<ApiRecord[]>(`/attendance/records?date=${targetDate}&limit=5000`, {
          auth: "school",
        }),
      ]);

      setSessions(Array.isArray(sessionList) ? sessionList : []);
      setRecords(Array.isArray(recordList) ? recordList : []);

      const sectionIds = Array.from(new Set(sessionList.map((session) => session.section_id)));
      await fetchStudentsForSections(sectionIds);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load attendance history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadClassData();
  }, []);

  useEffect(() => {
    void loadHistory(dateFilter);
  }, [dateFilter]);

  const sessionMap = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);

  const classOptions = useMemo(() => {
    return sectionRecords.map((section) => {
      const cls = classMap.get(section.class_id);
      const label = cls ? `${cls.name}${section.name}` : section.full_name || section.name;
      return { id: section.id, label };
    });
  }, [sectionRecords, classMap]);

  const rows = useMemo<HistoryRow[]>(() => {
    return records.map((record) => {
      const session = sessionMap.get(record.session_id);
      const sectionId = session?.section_id ?? "";
      const student = studentsById[record.student_id];
      const studentName = student
        ? `${student.first_name} ${student.last_name}`.trim()
        : "Unknown student";
      const cardId = student?.student_id_number ?? "—";
      const status = STATUS_LABEL[record.status];
      const timeIn = formatTime(record.scanned_at ?? record.created_at, record.status);
      const className = sectionId
        ? classLabelForSection(sectionId)
        : student?.current_section?.full_name ?? "—";

      return {
        id: record.id,
        studentName,
        cardId,
        className,
        timeIn,
        status,
        submitted: Boolean(session?.submitted_at),
      };
    });
  }, [records, sessionMap, studentsById, classMap, sectionMap]);

  const counts = useMemo(() => {
    return records.reduce(
      (acc, record) => {
        acc.total += 1;
        if (record.status === "present") acc.present += 1;
        if (record.status === "absent") acc.absent += 1;
        if (record.status === "late") acc.late += 1;
        if (record.status === "excused") acc.excused += 1;
        return acc;
      },
      { total: 0, present: 0, absent: 0, late: 0, excused: 0 }
    );
  }, [records]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const session = sessionMap.get(
        records.find((r) => r.id === row.id)?.session_id ?? ""
      );
      const matchesClass =
        classFilter === "All" || session?.section_id === classFilter;
      const matchesStatus = statusFilter === "All" || row.status === statusFilter;
      const target = `${row.studentName} ${row.cardId}`.toLowerCase();
      const matchesSearch = search === "" || target.includes(search.toLowerCase());
      return matchesClass && matchesStatus && matchesSearch;
    });
  }, [rows, classFilter, statusFilter, search, sessionMap, records]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const dateLabel = useMemo(() => formatLongDate(dateFilter), [dateFilter]);

  useEffect(() => {
    setPage(1);
  }, [dateFilter, classFilter, statusFilter, search]);

  const clampDate = (value: string) => {
    if (value && value > todayValue) {
      toast.error("Future dates are not allowed");
      return todayValue;
    }
    return value;
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-3 items-center mb-5">
        <input
          type="date"
          value={dateFilter}
          max={todayValue}
          onChange={(event) => setDateFilter(clampDate(event.target.value))}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        />
        <select
          value={classFilter}
          onChange={(event) => setClassFilter(event.target.value)}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="All">All Classes</option>
          {classOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as "All" | UiStatus)}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="All">All Statuses</option>
          <option>Present</option>
          <option>Absent</option>
          <option>Late</option>
          <option>Excused</option>
        </select>
        <div className="relative flex-1 min-w-50">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by student name…"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex flex-wrap gap-2 items-center justify-between">
          <div>
            <h3 className="font-display font-bold">Attendance History — {dateLabel}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">View-only records after submission</p>
          </div>
          <div className="text-xs text-muted-foreground space-x-3">
            <span>
              Total: <b className="text-foreground">{counts.total}</b>
            </span>
            <span>
              Present: <b className="text-success">{counts.present}</b>
            </span>
            <span>
              Absent: <b className="text-destructive">{counts.absent}</b>
            </span>
            <span>
              Late: <b className="text-amber-600">{counts.late}</b>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-3">#</th>
                <th className="text-left px-5 py-3">Student</th>
                <th className="text-left px-5 py-3">Card ID</th>
                <th className="text-left px-5 py-3">Class</th>
                <th className="text-left px-5 py-3">Time In</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Submission</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-5 py-6">
                    <Skeleton className="h-6 w-full" />
                  </td>
                </tr>
              )}
              {!loading &&
                pageItems.map((row, index) => (
                  <tr
                    key={row.id}
                    className="border-t border-border odd:bg-background even:bg-muted/20"
                  >
                    <td className="px-5 py-3 text-muted-foreground">
                      {(page - 1) * PAGE_SIZE + index + 1}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={row.studentName} size="sm" />
                        <span className="font-medium">{row.studentName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                      {row.cardId}
                    </td>
                    <td className="px-5 py-3">{row.className}</td>
                    <td className="px-5 py-3">{row.timeIn}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs font-semibold ${
                          row.submitted ? "text-success" : "text-amber-600"
                        }`}
                      >
                        {row.submitted ? "Submitted" : "Draft"}
                      </span>
                    </td>
                  </tr>
                ))}
              {!loading && pageItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                    No attendance records match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-border text-sm">
          <span className="text-muted-foreground">
            Page {page} of {totalPages} · {filtered.length} record
            {filtered.length === 1 ? "" : "s"}
          </span>
          <div className="space-x-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-md border border-border disabled:opacity-50 hover:bg-muted"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-md border border-border disabled:opacity-50 hover:bg-muted"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
