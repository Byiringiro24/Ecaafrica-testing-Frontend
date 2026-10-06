/** DOS — monitor class attendance submission across all sections */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Search, Download } from "lucide-react";
import { toast } from "sonner";
import { DosLayout } from "@/components/layout/DosLayout";
import { directorOfStudiesRouteGuard } from "@/lib/schoolAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { exportToExcel } from "@/lib/exportExcel";
import { attendanceDate, formatAttendanceDateTime, formatAttendanceTime } from "@/lib/attendanceTime";

export const Route = createFileRoute("/dos/attendance")({
  beforeLoad: ({ location }) => directorOfStudiesRouteGuard(location),
  component: DosAttendancePage,
});

type AttSession = {
  id: string;
  session_date: string;
  session_type: string;
  submitted_at?: string | null;
  started_at?: string | null;
  teacher?: { id: string; name: string } | null;
  period?: { id: string; name: string } | null;
  section?: {
    id: string;
    name: string;
    full_name?: string | null;
    class?: { id?: string; name?: string } | null;
  } | null;
};

type ClassOption = { id: string; name: string; level?: number | null };

function DosAttendancePage() {
  const [sessions, setSessions] = useState<AttSession[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(attendanceDate());
  const [query, setQuery] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "submitted" | "pending">("all");

  useEffect(() => {
    setLoading(true);
    const queryParams = new URLSearchParams({ date, limit: "500", session_type: "class" });
    if (selectedClassId !== "all") queryParams.set("class_id", selectedClassId);

    apiRequest<AttSession[]>(`/attendance/sessions?${queryParams.toString()}`, { auth: "school" })
      .then(d => setSessions(Array.isArray(d) ? d : []))
      .catch(e => toast.error(e?.message ?? "Failed to load"))
      .finally(() => setLoading(false));
  }, [date, selectedClassId]);

  useEffect(() => {
    apiRequest<ClassOption[]>("/classes?limit=500", { auth: "school" })
      .then((data) => setClasses(Array.isArray(data) ? data : []))
      .catch(() => setClasses([]));
  }, []);

  const filtered = sessions.filter(s => {
    const q = query.trim().toLowerCase();
    const matchesText = !q || (s.section?.name ?? "").toLowerCase().includes(q) ||
      (s.section?.full_name ?? "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all"
      ? true
      : statusFilter === "submitted"
        ? Boolean(s.submitted_at)
        : !s.submitted_at;
    return matchesText && matchesStatus;
  });

  const submitted = filtered.filter(s => s.submitted_at).length;
  const pending   = filtered.filter(s => !s.submitted_at).length;

  const handleExport = async () => {
    if (filtered.length === 0) { toast.info("No data to export"); return; }
    try {
      await exportToExcel(
        `class-attendance-${date}.xlsx`, "Class Attendance",
        [
          { header: "Class / Section", key: "section", width: 26 },
          { header: "Type", key: "type", width: 14 },
          { header: "Started", key: "started", width: 18 },
          { header: "Submitted", key: "submitted", width: 18 },
          { header: "Status", key: "status", width: 14 },
        ],
        filtered.map(s => ({
          section: s.section?.full_name ?? s.section?.name ?? "—",
          type: s.session_type,
          started: formatAttendanceTime(s.started_at),
          submitted: s.submitted_at ? formatAttendanceDateTime(s.submitted_at) : "Pending",
          status: s.submitted_at ? "Submitted" : "Pending",
        })),
        `Class Attendance — ${date}`
      );
      toast.success("Exported attendance");
    } catch (e: any) { toast.error(e?.message ?? "Export failed"); }
  };

  return (
    <DosLayout title="Class Attendance" subtitle="Monitor attendance submission across all classes">
      {/* Date + search */}
      <div className="flex flex-wrap gap-3 items-center mb-5">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
        <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option value="all">All classes</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>{cls.name}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as "all" | "submitted" | "pending")}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option value="all">All sessions</option>
          <option value="submitted">Submitted only</option>
          <option value="pending">Pending only</option>
        </select>
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search class…"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" />
        </div>
        <div className="flex gap-4 text-sm">
          <span className="text-emerald-600 font-semibold">{submitted} submitted</span>
          <span className="text-destructive font-semibold">{pending} pending</span>
          <button onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-semibold hover:bg-muted ml-2">
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                {["Class / Section", "Teacher", "Period", "Type", "Started", "Submitted", "Status"].map(h => (
                  <th key={h} className="text-left px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No attendance sessions found for {date}.</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{s.section?.full_name ?? s.section?.name ?? "—"}</td>
                  <td className="px-4 py-3">{s.teacher?.name ?? "Unknown teacher"}</td>
                  <td className="px-4 py-3">{s.period?.name ?? "No period"}</td>
                  <td className="px-4 py-3 text-xs capitalize">{s.session_type.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-xs">{formatAttendanceTime(s.started_at)}</td>
                  <td className="px-4 py-3 text-xs">{s.submitted_at ? formatAttendanceDateTime(s.submitted_at) : "—"}</td>
                  <td className="px-4 py-3">
                    {s.submitted_at ? (
                      <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold">
                        <CheckCircle className="h-4 w-4" /> Submitted
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-destructive text-xs font-semibold">
                        <XCircle className="h-4 w-4" /> Pending
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DosLayout>
  );
}
