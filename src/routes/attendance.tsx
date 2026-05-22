import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Download } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Avatar } from "@/components/ui-kit/Avatar";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import {
  TODAY_ATTENDANCE, STUDENTS, CLASSES, todayCounts, type AttendanceRecord, type Status,
} from "@/lib/mockData";

export const Route = createFileRoute("/attendance")({
  component: AttendancePage,
});

function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>(TODAY_ATTENDANCE);
  const [classFilter, setClassFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"All" | Status>("All");
  const [residencyFilter, setResidencyFilter] = useState<"All" | "Boarding" | "Day">("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const counts = todayCounts();
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const updateStatus = (id: string, status: Status) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status, timeIn: status === "Absent" ? "—" : r.timeIn } : r));
    toast.info(`Marked ${status}`);
  };

  const filtered = useMemo(() => records.filter(r => {
    const student = STUDENTS.find(s => s.id === r.studentId);
    return (
      (classFilter === "All" || r.class === classFilter) &&
      (statusFilter === "All" || r.status === statusFilter) &&
      (residencyFilter === "All" || student?.residency === residencyFilter) &&
      (search === "" || r.studentName.toLowerCase().includes(search.toLowerCase()))
    );
  }), [records, classFilter, statusFilter, residencyFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <AppLayout title="Live Attendance" subtitle="Scan student ID cards to mark attendance">
      {/* Filter bar */}
      <div className="mt-6 rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <input
          type="date"
          defaultValue={new Date().toISOString().slice(0,10)}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        />
        <select value={classFilter} onChange={(e) => { setClassFilter(e.target.value); setPage(1); }}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option value="All">All Classes</option>
          {CLASSES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option value="All">All Statuses</option>
          <option>Present</option><option>Absent</option><option>Late</option>
        </select>
        <select value={residencyFilter} onChange={(e) => { setResidencyFilter(e.target.value as any); setPage(1); }}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option value="All">All Students</option>
          <option value="Day">Day School</option>
          <option value="Boarding">Boarding</option>
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name…"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
          />
        </div>
        <button
          onClick={() => toast.success("Excel export generated")}
          className="h-10 inline-flex items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Download className="h-4 w-4" /> Export Excel
        </button>
      </div>

      {/* Table */}
      <div className="mt-6 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex flex-wrap gap-2 items-center justify-between">
          <h3 className="font-display font-bold">Today's Attendance — {today}</h3>
          <div className="text-xs text-muted-foreground space-x-3">
            <span>Total: <b className="text-foreground">{counts.total}</b></span>
            <span>Present: <b className="text-success">{counts.present}</b></span>
            <span>Absent: <b className="text-destructive">{counts.absent}</b></span>
            <span>Late: <b className="text-amber-600">{counts.late}</b></span>
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
                <th className="text-right px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((r, i) => {
                const stu = STUDENTS.find(s => s.id === r.studentId);
                return (
                  <tr key={r.id} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/40 transition-colors">
                    <td className="px-5 py-3 text-muted-foreground">{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.studentName} size="sm" />
                        <span className="font-medium">{r.studentName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{stu?.cardId}</td>
                    <td className="px-5 py-3">{r.class}</td>
                    <td className="px-5 py-3">{r.timeIn}</td>
                    <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-5 py-3 text-right space-x-2">
                      <button onClick={() => updateStatus(r.id, "Late")} className="text-xs font-semibold text-amber-600 hover:underline">Mark Late</button>
                      <button onClick={() => updateStatus(r.id, "Absent")} className="text-xs font-semibold text-destructive hover:underline">Mark Absent</button>
                    </td>
                  </tr>
                );
              })}
              {pageItems.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">No records match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-t border-border text-sm">
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <div className="space-x-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-md border border-border disabled:opacity-50 hover:bg-muted">Previous</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 rounded-md border border-border disabled:opacity-50 hover:bg-muted">Next</button>
          </div>
        </div>
      </div>

    </AppLayout>
  );
}
