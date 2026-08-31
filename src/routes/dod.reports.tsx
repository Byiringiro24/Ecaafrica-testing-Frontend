/** DOD Boarding Reports — daily attendance, leave, dormitory-wise, late returns */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BarChart3, Download } from "lucide-react";
import { toast } from "sonner";
import { DodLayout } from "@/components/layout/DodLayout";
import { directorOfDisciplineRouteGuard } from "@/lib/schoolAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { leavesApi, type LeaveRecord } from "@/lib/boardingApi";

export const Route = createFileRoute("/dod/reports")({
  beforeLoad: ({ location }) => directorOfDisciplineRouteGuard(location),
  component: DodReportsPage,
});

type Student = { id: string; first_name: string; last_name: string; student_id_number?: string | null };
type Dormitory = { id: string; name: string; block_name?: string | null };
type Assignment = { student_id: string; dormitory_id: string };

const TABS = ["Daily Attendance", "Leave Report", "Students Outside"] as const;

function DodReportsPage() {
  const [tab, setTab] = useState<typeof TABS[number]>("Daily Attendance");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [dormitories, setDormitories] = useState<Dormitory[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [lv, st, dm, as_] = await Promise.all([
        leavesApi.list({ limit: "2000" }).then(r => Array.isArray(r) ? r : (r as any)?.data ?? []),
        apiRequest<Student[]>("/students?student_type=boarding&limit=2000", { auth: "school" }),
        apiRequest<Dormitory[]>("/boarding/dormitories?limit=100", { auth: "school" }),
        apiRequest<Assignment[]>("/boarding/assignments?is_active=true&limit=5000", { auth: "school" }),
      ]);
      setLeaves(Array.isArray(lv) ? lv : []);
      setStudents(Array.isArray(st) ? st : []);
      setDormitories(Array.isArray(dm) ? dm : []);
      setAssignments(Array.isArray(as_) ? as_ : []);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load report data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const studentMap = new Map(students.map(s => [s.id, s]));
  const assignMap = new Map(assignments.map(a => [a.student_id, a.dormitory_id]));
  const dormMap = new Map(dormitories.map(d => [d.id, d]));

  const onLeaveOnDate = leaves.filter(l =>
    (l.leave_state === "outside_school" || (l.status === "approved" && !l.returned_at)) &&
    l.start_date <= date && l.end_date >= date
  );
  const onLeaveIds = new Set(onLeaveOnDate.map(l => l.student_id));
  const lateReturns = leaves.filter(l => l.late_return_flagged && !l.returned_at && l.end_date < date);
  const currentlyOutside = leaves.filter(l => l.leave_state === "outside_school");

  // dorm-wise summary
  const dormSummary = dormitories.map(d => {
    const studentsInDorm = assignments.filter(a => a.dormitory_id === d.id).map(a => a.student_id);
    const onLeaveInDorm = studentsInDorm.filter(id => onLeaveIds.has(id)).length;
    return { ...d, total: studentsInDorm.length, onLeave: onLeaveInDorm, inside: studentsInDorm.length - onLeaveInDorm };
  }).filter(d => d.total > 0);

  const handleExport = () => {
    toast.info("Export feature — connect to a CSV/Excel library in production.");
  };

  return (
    <DodLayout title="Boarding Reports" subtitle="Daily and historical boarding summaries">
      <div className="flex flex-wrap gap-1 border-b border-border mb-5 items-end">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
        <div className="ml-auto pb-2 flex gap-2 items-center">
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="h-8 rounded-lg border border-border bg-background px-3 text-sm" />
          <button onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-semibold hover:bg-muted">
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">{[1, 2].map(i => <Skeleton key={i} className="h-32" />)}</div>
      ) : (
        <>
          {tab === "Daily Attendance" && (
            <div className="space-y-5">
              {/* Summary row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{students.length}</div>
                  <div className="text-xs text-muted-foreground mt-1">Total Boarders</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-600">{students.length - onLeaveIds.size}</div>
                  <div className="text-xs text-muted-foreground mt-1">Inside School</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                  <div className="text-2xl font-bold text-amber-600">{onLeaveIds.size}</div>
                  <div className="text-xs text-muted-foreground mt-1">On Leave</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                  <div className="text-2xl font-bold text-destructive">{lateReturns.length}</div>
                  <div className="text-xs text-muted-foreground mt-1">Late Returns</div>
                </div>
              </div>

              {/* Dormitory breakdown */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-muted/30">
                  <h3 className="font-semibold">Dormitory Breakdown — {date}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        {["Dormitory", "Total", "Inside", "On Leave", "% Present"].map(h => (
                          <th key={h} className="text-left px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dormSummary.map(d => (
                        <tr key={d.id} className="border-t border-border hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{d.name}{d.block_name ? ` (${d.block_name})` : ""}</td>
                          <td className="px-4 py-3">{d.total}</td>
                          <td className="px-4 py-3 text-emerald-600 font-semibold">{d.inside}</td>
                          <td className="px-4 py-3 text-amber-600 font-semibold">{d.onLeave}</td>
                          <td className="px-4 py-3">
                            {d.total > 0 ? `${Math.round((d.inside / d.total) * 100)}%` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === "Leave Report" && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      {["Student", "Category", "Type", "From", "To", "State", "Late Return"].map(h => (
                        <th key={h} className="text-left px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No leave records found.</td></tr>
                    ) : leaves.slice(0, 100).map(l => {
                      const s = studentMap.get(l.student_id);
                      return (
                        <tr key={l.id} className="border-t border-border hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{s ? `${s.first_name} ${s.last_name}` : l.student_id}</td>
                          <td className="px-4 py-3 text-xs">{l.leave_category?.replace(/_/g, " ")}</td>
                          <td className="px-4 py-3 text-xs">{l.leave_type?.replace(/_/g, " ")}</td>
                          <td className="px-4 py-3 text-xs">{l.start_date}</td>
                          <td className="px-4 py-3 text-xs">{l.end_date}</td>
                          <td className="px-4 py-3 text-xs capitalize">{l.leave_state?.replace(/_/g, " ")}</td>
                          <td className="px-4 py-3">
                            {l.late_return_flagged ? <span className="text-xs font-bold text-destructive">YES</span> : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "Students Outside" && (
            <div className="space-y-3">
              {currentlyOutside.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No students currently outside school.</div>
              ) : currentlyOutside.map(l => {
                const s = studentMap.get(l.student_id);
                const dormId = assignMap.get(l.student_id);
                const dorm = dormId ? dormMap.get(dormId) : undefined;
                const isLate = l.end_date < date;
                return (
                  <div key={l.id} className={`rounded-xl border p-4 ${isLate ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}>
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-muted font-bold text-sm shrink-0">
                        {s ? (s.first_name[0] + s.last_name[0]) : "??"}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">{s ? `${s.first_name} ${s.last_name}` : "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">{s?.student_id_number ?? ""} · {dorm?.name ?? "—"}</div>
                      </div>
                      <div className="text-right text-xs">
                        <div>Left: {l.exited_at?.slice(0, 16).replace("T", " ") ?? l.start_date}</div>
                        <div className={isLate ? "text-destructive font-bold" : ""}>Return: {l.end_date} {isLate && "OVERDUE"}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </DodLayout>
  );
}
