import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { teacherRouteGuard } from "@/lib/schoolAuth";
import { AlertTriangle, TrendingUp, TrendingDown, Minus, X, MessageSquare, Flag } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { TEACHER_ME, studentsInClass } from "@/lib/teacherStaffData";

export const Route = createFileRoute("/teacher/progress")({
  beforeLoad: ({ location }) => teacherRouteGuard(location),
  component: ProgressPage
});

function ProgressPage() {
  const [cls, setCls] = useState(TEACHER_ME.classes[0]);
  const [open, setOpen] = useState<any>(null);

  const rows = useMemo(() => {
    return studentsInClass(cls).map((s, i) => {
      const att = s.attendanceRate;
      const marks = 35 + ((s.id.charCodeAt(5) * 7) % 60);
      const trend = ["up", "down", "flat"][i % 3] as "up" | "down" | "flat";
      const status = marks < 50 || att < 50 ? "Critical" : marks < 60 || att < 70 ? "At Risk" : marks < 75 ? "Good" : "Excellent";
      return { ...s, att, marks, trend, status };
    }).sort((a, b) => b.marks - a.marks);
  }, [cls]);

  const atRisk = rows.filter(r => r.status === "Critical" || r.status === "At Risk").length;

  return (
    <TeacherLayout title="Student Progress" subtitle="Academic and attendance trends">
      {atRisk > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mb-5 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <div className="flex-1 text-sm text-amber-800">
            <b>{atRisk} students</b> in your classes need attention.
          </div>
          <button className="text-xs font-semibold text-amber-700 hover:underline">View At-Risk →</button>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div><label className="text-xs font-semibold text-muted-foreground">Class</label><select value={cls} onChange={e => setCls(e.target.value)} className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm">{TEACHER_ME.classes.map(c => <option key={c}>{c}</option>)}</select></div>
        <div><label className="text-xs font-semibold text-muted-foreground">Term</label><select className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm"><option>Term 2 · 2026</option><option>Term 1 · 2026</option></select></div>
        <div><label className="text-xs font-semibold text-muted-foreground">Subject</label><select className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm"><option>Mathematics</option></select></div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase">
            <tr><th className="text-left p-3">#</th><th className="text-left p-3">Student</th><th className="text-left p-3">Attendance</th><th className="text-left p-3">Avg Marks</th><th className="text-left p-3">Trend</th><th className="text-left p-3">Last Exam</th><th className="text-left p-3">Status</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const Icon = r.trend === "up" ? TrendingUp : r.trend === "down" ? TrendingDown : Minus;
              const atRiskRow = r.status === "Critical" || r.status === "At Risk";
              return (
                <tr key={r.id} onClick={() => setOpen(r)} className={`border-t cursor-pointer ${atRiskRow ? "bg-red-50/40" : i % 2 ? "bg-gray-50" : ""} hover:bg-muted/40`}>
                  <td className="p-3 font-bold">{i + 1}</td>
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-3">{r.att}%</td>
                  <td className="p-3">{r.marks}</td>
                  <td className="p-3"><Icon className={`h-4 w-4 ${r.trend === "up" ? "text-indigo-700" : r.trend === "down" ? "text-red-600" : "text-gray-400"}`} /></td>
                  <td className="p-3">{r.marks - 3}</td>
                  <td className="p-3"><span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${r.status === "Excellent" ? "bg-indigo-100 text-indigo-800" : r.status === "Good" ? "bg-blue-100 text-blue-700" : r.status === "At Risk" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{r.status}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && <StudentDrawer student={open} onClose={() => setOpen(null)} />}
    </TeacherLayout>
  );
}

function StudentDrawer({ student, onClose }: { student: any; onClose: () => void }) {
  const trend = Array.from({ length: 6 }, (_, i) => ({ exam: `E${i + 1}`, score: 50 + ((i * student.id.charCodeAt(5)) % 40) }));
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-lg bg-background shadow-2xl overflow-y-auto animate-in slide-in-from-right">
        <div className="sticky top-0 bg-background z-10 px-6 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary font-bold">{student.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}</div>
            <div><div className="font-display text-lg font-bold">{student.name}</div><div className="text-xs text-muted-foreground">{student.class}</div></div>
          </div>
          <button onClick={onClose} className="rounded-md p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <div className="text-xs uppercase text-muted-foreground mb-2">Marks Trend</div>
            <div className="h-44"><ResponsiveContainer><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="exam" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Line dataKey="score" stroke="#3b5998" strokeWidth={2} /></LineChart></ResponsiveContainer></div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-lg bg-indigo-50 p-3"><div className="font-bold text-indigo-700">{student.att}%</div><div className="text-[10px] uppercase">Attendance</div></div>
            <div className="rounded-lg bg-indigo-50 p-3"><div className="font-bold text-indigo-700">{student.marks}</div><div className="text-[10px] uppercase">Avg Marks</div></div>
            <div className="rounded-lg bg-amber-50 p-3"><div className="font-bold text-amber-600">#{Math.ceil(Math.random() * 30)}</div><div className="text-[10px] uppercase">Class Rank</div></div>
          </div>
          <div className="flex gap-2">
            <button className="flex-1 h-10 rounded-md bg-primary text-primary-foreground font-semibold text-sm inline-flex items-center justify-center gap-2"><MessageSquare className="h-4 w-4" /> Message Parent</button>
            <button className="flex-1 h-10 rounded-md border border-amber-300 text-amber-700 font-semibold text-sm inline-flex items-center justify-center gap-2"><Flag className="h-4 w-4" /> Flag for Counseling</button>
          </div>
        </div>
      </aside>
    </>
  );
}
