/** DOS — Academic Reports: real attendance rates, exam stats, class summary */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { DosLayout } from "@/components/layout/DosLayout";
import { directorOfStudiesRouteGuard } from "@/lib/schoolAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { exportToExcel } from "@/lib/exportExcel";

export const Route = createFileRoute("/dos/reports")({
  beforeLoad: ({ location }) => directorOfStudiesRouteGuard(location),
  component: DosReportsPage,
});

const today = new Date().toISOString().slice(0, 10);
const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

type Section  = { id: string; name: string; full_name?: string | null };
type Session  = { id: string; section_id: string; session_date: string; submitted_at?: string | null; started_at?: string | null };
type Exam     = { id: string; name: string; status: string; class?: { name?: string | null } | null };
type Subject  = { id: string; name: string };
type StaffUser= { id: string; name: string; role: string };

function DosReportsPage() {
  const [sections, setSections]   = useState<Section[]>([]);
  const [sessions, setSessions]   = useState<Session[]>([]);
  const [exams, setExams]         = useState<Exam[]>([]);
  const [subjects, setSubjects]   = useState<Subject[]>([]);
  const [staff, setStaff]         = useState<StaffUser[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<"Attendance" | "Exams" | "Structure">("Attendance");

  const load = async () => {
    setLoading(true);
    try {
      const [secRes, sessRes, examRes, subRes, staffRes] = await Promise.all([
        apiRequest<Section[]>("/sections?limit=200", { auth: "school" }).catch(() => []),
        apiRequest<Session[]>(`/attendance/sessions?date=${weekAgo}&limit=1000`, { auth: "school" }).catch(() => []),
        apiRequest<Exam[]>("/exams?limit=500", { auth: "school" }).catch(() => []),
        apiRequest<Subject[]>("/subjects?limit=200", { auth: "school" }).catch(() => []),
        apiRequest<StaffUser[]>("/users?role=teacher&limit=200", { auth: "school" }).catch(() => []),
      ]);
      setSections(Array.isArray(secRes) ? secRes : []);
      setSessions(Array.isArray(sessRes) ? sessRes : []);
      setExams(Array.isArray(examRes) ? examRes : []);
      setSubjects(Array.isArray(subRes) ? subRes : []);
      const s = Array.isArray(staffRes) ? staffRes : (staffRes as any)?.data ?? [];
      setStaff(Array.isArray(s) ? s : []);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  // Attendance chart: per-section submission rate this week
  const attendanceChart = sections.map(sec => {
    const secSessions = sessions.filter(s => s.section_id === sec.id);
    const submitted   = secSessions.filter(s => s.submitted_at).length;
    const total       = secSessions.length;
    return {
      name: sec.full_name || sec.name,
      rate: total > 0 ? Math.round((submitted / total) * 100) : 0,
      submitted,
      total,
    };
  }).filter(s => s.total > 0).sort((a, b) => b.rate - a.rate).slice(0, 12);

  // Exam stats
  const examStats = {
    total:     exams.length,
    scheduled: exams.filter(e => e.status === "scheduled").length,
    ongoing:   exams.filter(e => e.status === "ongoing").length,
    completed: exams.filter(e => e.status === "completed").length,
    published: exams.filter(e => e.status === "published").length,
  };

  const handleExportAttendance = async () => {
    if (attendanceChart.length === 0) { toast.info("No data"); return; }
    try {
      await exportToExcel(
        `attendance-report-${today}.xlsx`, "Attendance",
        [
          { header: "Section", key: "name", width: 26 },
          { header: "Sessions", key: "total", width: 12 },
          { header: "Submitted", key: "submitted", width: 12 },
          { header: "Rate (%)", key: "rate", width: 12 },
        ],
        attendanceChart,
        `Attendance Submission Rate — Week of ${weekAgo}`
      );
      toast.success("Exported");
    } catch (e: any) { toast.error(e?.message ?? "Export failed"); }
  };

  const handleExportExams = async () => {
    if (exams.length === 0) { toast.info("No data"); return; }
    try {
      await exportToExcel(
        `exams-report-${today}.xlsx`, "Exams",
        [
          { header: "Exam Name", key: "name", width: 28 },
          { header: "Class", key: "cls", width: 20 },
          { header: "Status", key: "status", width: 14 },
        ],
        exams.map(e => ({ name: e.name, cls: e.class?.name ?? "—", status: e.status })),
        `Exams Report — ${today}`
      );
      toast.success("Exported");
    } catch (e: any) { toast.error(e?.message ?? "Export failed"); }
  };

  const TABS = ["Attendance", "Exams", "Structure"] as const;

  return (
    <DosLayout title="Academic Reports" subtitle="Real-time academic data and summaries">
      {/* Tabs */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-1 border-b border-border">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t}
            </button>
          ))}
        </div>
        <button onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-64" /></div>
      ) : (
        <>
          {/* ── Attendance Tab ── */}
          {tab === "Attendance" && (
            <div className="space-y-5">
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Total Sections",   value: sections.length,                                        color: "bg-blue-50 border-blue-200 text-blue-700" },
                  { label: "Sessions This Week",value: sessions.length,                                        color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
                  { label: "Submitted",         value: sessions.filter(s => s.submitted_at).length,            color: "bg-purple-50 border-purple-200 text-purple-700" },
                  { label: "Pending",           value: sessions.filter(s => !s.submitted_at).length,           color: "bg-amber-50 border-amber-200 text-amber-700" },
                ].map(({ label, value, color }) => (
                  <div key={label} className={`rounded-xl border p-4 ${color}`}>
                    <div className="text-2xl font-bold font-display">{value}</div>
                    <div className="text-xs mt-1 opacity-80">{label}</div>
                  </div>
                ))}
              </div>

              {/* Bar chart */}
              {attendanceChart.length > 0 ? (
                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="font-display font-bold">Attendance Submission Rate by Section</h3>
                      <p className="text-xs text-muted-foreground">Past 7 days — % of sessions submitted</p>
                    </div>
                    <button onClick={handleExportAttendance}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                      <Download className="h-3.5 w-3.5" /> Export
                    </button>
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={attendanceChart} margin={{ top: 4, right: 8, bottom: 40, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                      <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => [`${v}%`, "Rate"]} />
                      <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                        {attendanceChart.map((entry, i) => (
                          <Cell key={i} fill={entry.rate >= 80 ? "#10b981" : entry.rate >= 60 ? "#f59e0b" : "#ef4444"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
                  No attendance sessions found for the past 7 days.
                </div>
              )}

              {/* Table */}
              {attendanceChart.length > 0 && (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        {["Section", "Total Sessions", "Submitted", "Rate"].map(h => (
                          <th key={h} className="text-left px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceChart.map(row => (
                        <tr key={row.name} className="border-t border-border hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{row.name}</td>
                          <td className="px-4 py-3 text-xs">{row.total}</td>
                          <td className="px-4 py-3 text-xs">{row.submitted}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              row.rate >= 80 ? "bg-emerald-100 text-emerald-700"
                              : row.rate >= 60 ? "bg-amber-100 text-amber-700"
                              : "bg-destructive/15 text-destructive"
                            }`}>{row.rate}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Exams Tab ── */}
          {tab === "Exams" && (
            <div className="space-y-5">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: "Total",     value: examStats.total,     color: "bg-muted" },
                  { label: "Scheduled", value: examStats.scheduled, color: "bg-blue-50 border-blue-200" },
                  { label: "Ongoing",   value: examStats.ongoing,   color: "bg-amber-50 border-amber-200" },
                  { label: "Completed", value: examStats.completed, color: "bg-emerald-50 border-emerald-200" },
                  { label: "Published", value: examStats.published, color: "bg-purple-50 border-purple-200" },
                ].map(({ label, value, color }) => (
                  <div key={label} className={`rounded-xl border p-4 ${color}`}>
                    <div className="text-2xl font-bold font-display">{value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{label}</div>
                  </div>
                ))}
              </div>

              {/* Exam list */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex justify-between items-center px-5 py-3 border-b border-border">
                  <span className="font-semibold text-sm">{exams.length} exams</span>
                  <button onClick={handleExportExams}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                    <Download className="h-3.5 w-3.5" /> Export
                  </button>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      {["Exam Name", "Class", "Status"].map(h => (
                        <th key={h} className="text-left px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {exams.length === 0 ? (
                      <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No exams found.</td></tr>
                    ) : exams.map(e => (
                      <tr key={e.id} className="border-t border-border hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{e.name}</td>
                        <td className="px-4 py-3 text-xs">{e.class?.name ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${
                            e.status === "published" ? "bg-purple-100 text-purple-700"
                            : e.status === "completed" ? "bg-emerald-100 text-emerald-700"
                            : e.status === "ongoing" ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                          }`}>{e.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Structure Tab ── */}
          {tab === "Structure" && (
            <div className="grid md:grid-cols-2 gap-5">
              {/* Sections */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-muted/30">
                  <h3 className="font-semibold text-sm">{sections.length} Sections</h3>
                </div>
                <div className="divide-y divide-border max-h-64 overflow-y-auto">
                  {sections.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-muted-foreground">No sections.</div>
                  ) : sections.map(s => (
                    <div key={s.id} className="px-5 py-2.5 text-sm">{s.full_name || s.name}</div>
                  ))}
                </div>
              </div>

              {/* Subjects */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-muted/30">
                  <h3 className="font-semibold text-sm">{subjects.length} Subjects</h3>
                </div>
                <div className="divide-y divide-border max-h-64 overflow-y-auto">
                  {subjects.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-muted-foreground">No subjects.</div>
                  ) : subjects.map(s => (
                    <div key={s.id} className="px-5 py-2.5 text-sm flex justify-between">
                      <span>{s.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Staff */}
              <div className="rounded-xl border border-border bg-card overflow-hidden md:col-span-2">
                <div className="px-5 py-3 border-b border-border bg-muted/30">
                  <h3 className="font-semibold text-sm">{staff.length} Teaching Staff</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      {["Name", "Role"].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {staff.length === 0 ? (
                      <tr><td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">No teaching staff found.</td></tr>
                    ) : staff.map(s => (
                      <tr key={s.id} className="border-t border-border hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{s.name}</td>
                        <td className="px-4 py-3 text-xs capitalize">{s.role.replace(/_/g, " ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </DosLayout>
  );
}
