import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { X, Loader2, Download, FileText, Check, Clock, AlertCircle, Save, ClipboardList, BarChart3, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { StaffLayout } from "@/components/layout/StaffLayout";
import { MY_STAFF_ATTENDANCE, CLASSES, studentsInClass } from "@/lib/teacherStaffData";
import type { Status } from "@/lib/mockData";

export const Route = createFileRoute("/staff/my-attendance")({ component: MyAttendance });

type Tab = "overview" | "mark" | "reports";

function MyAttendance() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <StaffLayout title="Attendance" subtitle="Track your own attendance, mark students, and view reports">
      <div className="mb-6 inline-flex rounded-xl border border-border bg-card p-1 shadow-sm">
        <TabBtn active={tab === "overview"} onClick={() => setTab("overview")} icon={<CalendarIcon className="h-4 w-4" />}>My Attendance</TabBtn>
        <TabBtn active={tab === "mark"} onClick={() => setTab("mark")} icon={<ClipboardList className="h-4 w-4" />}>Mark Students</TabBtn>
        <TabBtn active={tab === "reports"} onClick={() => setTab("reports")} icon={<BarChart3 className="h-4 w-4" />}>Reports</TabBtn>
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "mark" && <MarkAttendanceTab />}
      {tab === "reports" && <ReportsTab />}
    </StaffLayout>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${active ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:bg-muted"}`}>
      {icon}{children}
    </button>
  );
}

/* ---------- OVERVIEW (own attendance) ---------- */
function OverviewTab() {
  const [open, setOpen] = useState(false);
  const present = MY_STAFF_ATTENDANCE.filter(a => a.status === "Present" && a.notes !== "Weekend").length;
  const late = MY_STAFF_ATTENDANCE.filter(a => a.status === "Late").length;
  const workdays = MY_STAFF_ATTENDANCE.filter(a => a.notes !== "Weekend").length;
  const pct = Math.round((present / workdays) * 100);

  return (
    <>
      <div className="grid lg:grid-cols-3 gap-5 mb-6">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-display font-bold mb-3">This Month</h3>
          <div className="flex items-center gap-5">
            <div className="relative h-24 w-24">
              <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
                <circle cx="18" cy="18" r="16" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                <circle cx="18" cy="18" r="16" fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeDasharray={`${pct} 100`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 grid place-items-center font-display text-xl font-bold">{pct}%</div>
            </div>
            <div className="text-sm space-y-1">
              <div><span className="text-indigo-700 font-semibold">{present}</span> Present</div>
              <div><span className="text-amber-600 font-semibold">{late}</span> Late</div>
              <div><span className="text-red-600 font-semibold">0</span> Absent</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-display font-bold mb-3">Leave Balance</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Annual Leave</span><span className="font-semibold">12 / 24 days</span></div>
            <div className="flex justify-between"><span>Sick Leave</span><span className="font-semibold">7 / 10 days</span></div>
            <div className="flex justify-between"><span>Emergency Leave</span><span className="font-semibold">3 / 5 days</span></div>
          </div>
          <button onClick={() => setOpen(true)} className="mt-4 w-full h-9 rounded-md bg-primary text-primary-foreground text-sm font-semibold">Apply for Leave</button>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-display font-bold mb-3">Quick Stats</h3>
          <div className="text-sm space-y-2">
            <div>On-time arrival: <b>{Math.round((present / workdays) * 100)}%</b></div>
            <div>Avg hours/day: <b>9h 50m</b></div>
            <div>Best streak: <b>14 days</b></div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-display font-bold">Daily Log</h3>
          <button onClick={() => downloadCsv("my-attendance.csv", ["Date", "Day", "Check-in", "Check-out", "Hours", "Status"], MY_STAFF_ATTENDANCE.map(r => [r.date, r.day, r.checkIn, r.checkOut, r.hours, r.status]))} className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-md border border-border hover:bg-muted"><Download className="h-3.5 w-3.5" /> Export CSV</button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase"><tr><th className="text-left p-3">Date</th><th className="text-left p-3">Day</th><th className="text-left p-3">Check-in</th><th className="text-left p-3">Check-out</th><th className="text-left p-3">Hours</th><th className="text-left p-3">Status</th><th className="text-left p-3">Notes</th></tr></thead>
          <tbody>
            {MY_STAFF_ATTENDANCE.map((r, i) => (
              <tr key={r.date} className={`border-t ${i % 2 ? "bg-muted/30" : ""}`}>
                <td className="p-3">{r.date}</td><td className="p-3">{r.day}</td>
                <td className="p-3 font-mono">{r.checkIn}</td><td className="p-3 font-mono">{r.checkOut}</td><td className="p-3">{r.hours}</td>
                <td className="p-3"><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${r.status === "Present" ? "bg-indigo-100 text-indigo-800" : r.status === "Late" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{r.status}</span></td>
                <td className="p-3 text-xs text-muted-foreground">{r.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && <LeaveModal onClose={() => setOpen(false)} />}
    </>
  );
}

/* ---------- MARK STUDENT ATTENDANCE ---------- */
function MarkAttendanceTab() {
  const [cls, setCls] = useState(CLASSES[0]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const students = useMemo(() => studentsInClass(cls), [cls]);
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setAll = (s: Status) => {
    const m: Record<string, Status> = {};
    students.forEach(st => { m[st.id] = s; });
    setMarks(m);
  };
  const setOne = (id: string, s: Status) => setMarks(prev => ({ ...prev, [id]: s }));

  const counts = {
    present: students.filter(s => marks[s.id] === "Present").length,
    absent: students.filter(s => marks[s.id] === "Absent").length,
    late: students.filter(s => marks[s.id] === "Late").length,
  };
  const marked = counts.present + counts.absent + counts.late;

  const saveDraft = () => {
    setSavedAt(new Date().toLocaleTimeString());
    toast.success("Draft saved");
  };
  const submit = async () => {
    if (marked < students.length) {
      if (!confirm(`Only ${marked} of ${students.length} students marked. Submit anyway?`)) return;
    }
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 700));
    setSubmitting(false);
    toast.success(`Attendance submitted for ${cls} (${date})`);
    setMarks({});
    setSavedAt(null);
  };

  return (
    <div>
      <div className="rounded-xl border border-border bg-card p-4 mb-4 shadow-sm flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Class</label>
          <select value={cls} onChange={e => { setCls(e.target.value); setMarks({}); }} className="h-10 rounded-md border border-input bg-background px-3 text-sm font-medium min-w-[120px]">
            {CLASSES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm font-medium" />
        </div>
        <div className="flex-1" />
        <div className="flex gap-2">
          <button onClick={() => setAll("Present")} className="h-10 px-3 rounded-md bg-indigo-100 text-indigo-800 text-xs font-bold hover:bg-indigo-200">All Present</button>
          <button onClick={() => setMarks({})} className="h-10 px-3 rounded-md bg-muted text-xs font-bold hover:bg-muted/70">Reset</button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <StatPill label="Total" value={students.length} tone="default" />
        <StatPill label="Present" value={counts.present} tone="indigo" />
        <StatPill label="Late" value={counts.late} tone="amber" />
        <StatPill label="Absent" value={counts.absent} tone="red" />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase">
            <tr><th className="text-left p-3 w-16">#</th><th className="text-left p-3">Student</th><th className="text-left p-3">ID</th><th className="text-right p-3 pr-6">Mark</th></tr>
          </thead>
          <tbody>
            {students.map((s, i) => {
              const m = marks[s.id];
              return (
                <tr key={s.id} className={`border-t ${i % 2 ? "bg-muted/30" : ""}`}>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</td>
                  <td className="p-3">
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.gender} · {s.class}</div>
                  </td>
                  <td className="p-3 font-mono text-xs">{s.id}</td>
                  <td className="p-3 pr-6">
                    <div className="flex justify-end gap-1.5">
                      <MarkBtn active={m === "Present"} onClick={() => setOne(s.id, "Present")} tone="indigo" icon={<Check className="h-3.5 w-3.5" />}>P</MarkBtn>
                      <MarkBtn active={m === "Late"} onClick={() => setOne(s.id, "Late")} tone="amber" icon={<Clock className="h-3.5 w-3.5" />}>L</MarkBtn>
                      <MarkBtn active={m === "Absent"} onClick={() => setOne(s.id, "Absent")} tone="red" icon={<AlertCircle className="h-3.5 w-3.5" />}>A</MarkBtn>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-4 mt-5 rounded-xl border border-border bg-card/95 backdrop-blur p-4 shadow-lg flex items-center gap-4">
        <div className="text-sm">
          <div className="font-semibold">{marked} / {students.length} marked</div>
          {savedAt && <div className="text-xs text-muted-foreground">Draft saved at {savedAt}</div>}
        </div>
        <div className="flex-1" />
        <button onClick={saveDraft} className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-border text-sm font-semibold hover:bg-muted"><Save className="h-4 w-4" /> Save Draft</button>
        <button onClick={submit} disabled={submitting} className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">{submitting && <Loader2 className="h-4 w-4 animate-spin" />} Submit Attendance</button>
      </div>
    </div>
  );
}

function StatPill({ label, value, tone }: { label: string; value: number; tone: "default" | "indigo" | "amber" | "red" }) {
  const colors = { default: "bg-card text-foreground border-border", indigo: "bg-indigo-50 text-indigo-800 border-indigo-200", amber: "bg-amber-50 text-amber-800 border-amber-200", red: "bg-red-50 text-red-800 border-red-200" };
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${colors[tone]}`}>
      <div className="text-xs font-semibold uppercase opacity-70">{label}</div>
      <div className="font-display text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function MarkBtn({ active, onClick, tone, icon, children }: { active: boolean; onClick: () => void; tone: "indigo" | "amber" | "red"; icon: React.ReactNode; children: React.ReactNode }) {
  const colors = {
    indigo: active ? "bg-indigo-600 text-white border-indigo-600" : "border-indigo-300 text-indigo-700 hover:bg-indigo-50",
    amber: active ? "bg-amber-500 text-white border-amber-500" : "border-amber-300 text-amber-700 hover:bg-amber-50",
    red: active ? "bg-red-600 text-white border-red-600" : "border-red-300 text-red-700 hover:bg-red-50",
  };
  return <button onClick={onClick} className={`inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-xs font-bold border transition ${colors[tone]}`}>{icon}{children}</button>;
}

/* ---------- REPORTS ---------- */
function ReportsTab() {
  const trend = MY_STAFF_ATTENDANCE.slice().reverse().map(r => ({
    date: r.date.slice(5),
    Present: r.status === "Present" && r.notes !== "Weekend" ? 1 : 0,
    Late: r.status === "Late" ? 1 : 0,
    Absent: r.status === "Absent" ? 1 : 0,
  }));

  const present = MY_STAFF_ATTENDANCE.filter(a => a.status === "Present" && a.notes !== "Weekend").length;
  const late = MY_STAFF_ATTENDANCE.filter(a => a.status === "Late").length;
  const absent = MY_STAFF_ATTENDANCE.filter(a => a.status === "Absent").length;
  const pie = [
    { name: "Present", value: present, fill: "hsl(var(--primary))" },
    { name: "Late", value: late, fill: "#f59e0b" },
    { name: "Absent", value: absent || 1, fill: "#ef4444" },
  ];

  const classBreakdown = CLASSES.slice(0, 8).map(c => {
    const total = studentsInClass(c).length;
    const p = Math.max(0, total - ((c.charCodeAt(1) + c.charCodeAt(2)) % 4));
    const a = total - p;
    return { class: c, Present: p, Absent: a };
  });

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-3 gap-4">
        <ReportCard title="Total Working Days" value="14" sub="Last 2 weeks" />
        <ReportCard title="Attendance Rate" value={`${Math.round((present / (present + late + absent || 1)) * 100)}%`} sub="Your average" tone="indigo" />
        <ReportCard title="Punctuality" value={`${Math.round((present / (present + late || 1)) * 100)}%`} sub="On-time arrivals" tone="amber" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold">Attendance Trend (14 days)</h3>
            <button onClick={() => downloadCsv("attendance-trend.csv", ["Date", "Present", "Late", "Absent"], trend.map(r => [r.date, r.Present, r.Late, r.Absent]))} className="text-xs font-semibold inline-flex items-center gap-1 hover:underline"><Download className="h-3 w-3" /> CSV</button>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="Present" stackId="a" fill="hsl(var(--primary))" />
                <Bar dataKey="Late" stackId="a" fill="#f59e0b" />
                <Bar dataKey="Absent" stackId="a" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-display font-bold mb-3">Status Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {pie.map((p, i) => <Cell key={i} fill={p.fill} />)}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold">Class Attendance Today</h3>
          <button onClick={() => downloadCsv("class-attendance.csv", ["Class", "Present", "Absent"], classBreakdown.map(r => [r.class, r.Present, r.Absent]))} className="text-xs font-semibold inline-flex items-center gap-1 hover:underline"><Download className="h-3 w-3" /> CSV</button>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={classBreakdown}>
              <XAxis dataKey="class" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Present" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="font-display font-bold mb-3">Download Reports</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <button onClick={() => downloadCsv("monthly-report.csv", ["Date", "Status", "Check-in", "Check-out"], MY_STAFF_ATTENDANCE.map(r => [r.date, r.status, r.checkIn, r.checkOut]))} className="rounded-lg border border-border p-4 text-left hover:bg-muted transition">
            <FileText className="h-5 w-5 text-primary mb-2" />
            <div className="font-semibold text-sm">Monthly Report</div>
            <div className="text-xs text-muted-foreground">CSV · last 14 days</div>
          </button>
          <button onClick={() => toast.success("Term report generation queued")} className="rounded-lg border border-border p-4 text-left hover:bg-muted transition">
            <FileText className="h-5 w-5 text-primary mb-2" />
            <div className="font-semibold text-sm">Term Summary</div>
            <div className="text-xs text-muted-foreground">PDF · full term</div>
          </button>
          <button onClick={() => toast.success("Report sent to admin")} className="rounded-lg border border-border p-4 text-left hover:bg-muted transition">
            <FileText className="h-5 w-5 text-primary mb-2" />
            <div className="font-semibold text-sm">Send to Admin</div>
            <div className="text-xs text-muted-foreground">Email this month's data</div>
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportCard({ title, value, sub, tone = "default" }: { title: string; value: string; sub: string; tone?: "default" | "indigo" | "amber" }) {
  const colors = { default: "", indigo: "bg-indigo-50 border-indigo-200", amber: "bg-amber-50 border-amber-200" };
  return (
    <div className={`rounded-xl border border-border bg-card p-5 shadow-sm ${colors[tone]}`}>
      <div className="text-xs font-semibold uppercase text-muted-foreground">{title}</div>
      <div className="font-display text-3xl font-bold mt-1">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

/* ---------- LEAVE MODAL ---------- */
function LeaveModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold">Apply for Leave</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <form className="space-y-3" onSubmit={async e => { e.preventDefault(); setLoading(true); await new Promise(r => setTimeout(r, 500)); toast.success("Leave application submitted"); onClose(); }}>
          <div><label className="text-sm font-medium">Leave Type</label><select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option>Annual Leave</option><option>Sick Leave</option><option>Emergency Leave</option></select></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium">Start</label><input type="date" required className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" /></div><div><label className="text-sm font-medium">End</label><input type="date" required className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" /></div></div>
          <div><label className="text-sm font-medium">Reason</label><textarea required className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm min-h-[70px]" /></div>
          <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={onClose} className="h-9 px-4 rounded-md border border-border text-sm font-semibold">Cancel</button><button type="submit" disabled={loading} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2">{loading && <Loader2 className="h-4 w-4 animate-spin" />} Submit</button></div>
        </form>
      </div>
    </div>
  );
}

/* ---------- CSV helper ---------- */
function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast.success(`${filename} downloaded`);
}
