import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Search, CheckCircle2, X, Clock, FileText, Save } from "lucide-react";
import { toast } from "sonner";
import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { TEACHER_ME, studentsInClass } from "@/lib/teacherStaffData";

export const Route = createFileRoute("/teacher/attendance")({ component: TeacherAttendance });

type AttStatus = "Present" | "Absent" | "Late" | "Excused";
const NEXT: Record<AttStatus, AttStatus> = { Present: "Absent", Absent: "Late", Late: "Excused", Excused: "Present" };
const COLORS: Record<AttStatus, string> = {
  Present: "bg-indigo-100 text-indigo-800 border-indigo-200",
  Absent: "bg-red-100 text-red-700 border-red-300",
  Late: "bg-amber-100 text-amber-700 border-amber-300",
  Excused: "bg-blue-100 text-blue-700 border-blue-300",
};

function TeacherAttendance() {
  const [tab, setTab] = useState<"take" | "history">("take");
  const [cls, setCls] = useState(TEACHER_ME.classes[0]);
  const [period, setPeriod] = useState(1);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loaded, setLoaded] = useState(false);
  const [marks, setMarks] = useState<Record<string, AttStatus>>({});
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [notify, setNotify] = useState(true);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const students = useMemo(() => studentsInClass(cls), [cls]);
  const filtered = students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (!loaded) return;
    const t = setInterval(() => setSavedAt(new Date().toLocaleTimeString()), 30000);
    return () => clearInterval(t);
  }, [loaded]);

  const counts = useMemo(() => {
    const c = { Present: 0, Absent: 0, Late: 0, Excused: 0 };
    Object.values(marks).forEach(s => c[s]++);
    return c;
  }, [marks]);

  const allMarked = students.length > 0 && Object.keys(marks).length === students.length;

  const load = () => {
    setLoaded(true);
    setMarks({});
    setSavedAt(null);
    toast.success(`Loaded ${students.length} students for ${cls}, Period ${period}`);
  };

  const submit = () => {
    setConfirm(false);
    toast.success(`Attendance submitted for ${cls}, Period ${period}. ${notify && counts.Absent > 0 ? `Sending ${counts.Absent} parent SMS…` : ""}`);
    setLoaded(false);
    setMarks({});
  };

  return (
    <TeacherLayout title="Attendance" subtitle="Take attendance for your assigned classes">
      <div className="flex gap-1 border-b border-border mb-5">
        {(["take", "history"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold border-b-2 ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
            {t === "take" ? "Take Attendance" : "History"}
          </button>
        ))}
      </div>

      {tab === "take" && (
        <>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap items-end gap-3 mb-5">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Class</label>
              <select value={cls} onChange={e => { setCls(e.target.value); setLoaded(false); }} className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm">
                {TEACHER_ME.classes.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Period</label>
              <select value={period} onChange={e => setPeriod(+e.target.value)} className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(p => <option key={p} value={p}>Period {p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm" />
            </div>
            <button onClick={load} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">Load Students</button>
          </div>

          {loaded && (
            <div className="grid lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 rounded-xl border border-border bg-card shadow-sm">
                <div className="p-4 border-b border-border flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input value={search} onChange={e => setSearch(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm" placeholder="Search student…" />
                  </div>
                  <button onClick={() => { const m: Record<string, AttStatus> = {}; students.forEach(s => m[s.id] = "Present"); setMarks(m); }}
                    className="h-9 px-3 text-xs font-semibold rounded-md bg-indigo-100 text-indigo-800 hover:bg-indigo-200">Mark All Present</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-xs uppercase">
                      <tr>
                        <th className="text-left p-3 w-10">#</th>
                        <th className="text-left p-3">Student</th>
                        <th className="text-left p-3">Reg #</th>
                        <th className="text-left p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s, i) => {
                        const status = marks[s.id];
                        return (
                          <tr key={s.id} className={`border-t border-border ${i % 2 ? "bg-gray-50" : ""}`}>
                            <td className="p-3 text-muted-foreground">{i + 1}</td>
                            <td className="p-3 font-medium flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-primary/10 text-primary grid place-items-center text-[10px] font-bold">
                                {s.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                              </div>
                              {s.name}
                            </td>
                            <td className="p-3 text-muted-foreground">{s.cardId}</td>
                            <td className="p-3">
                              <button onClick={() => setMarks({ ...marks, [s.id]: status ? NEXT[status] : "Present" })}
                                className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${status ? COLORS[status] : "bg-muted text-muted-foreground border-border"}`}>
                                {status ?? "Mark"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5 shadow-sm h-fit space-y-4">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Session</div>
                  <div className="font-display text-lg font-bold">{cls} · Period {period}</div>
                  <div className="text-xs text-muted-foreground">{TEACHER_ME.subject} · {date}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-indigo-50 p-2"><div className="text-2xl font-bold text-indigo-700">{counts.Present}</div><div className="text-[10px] uppercase text-indigo-800">Present</div></div>
                  <div className="rounded-lg bg-red-50 p-2"><div className="text-2xl font-bold text-red-600">{counts.Absent}</div><div className="text-[10px] uppercase text-red-700">Absent</div></div>
                  <div className="rounded-lg bg-amber-50 p-2"><div className="text-2xl font-bold text-amber-600">{counts.Late}</div><div className="text-[10px] uppercase text-amber-700">Late</div></div>
                  <div className="rounded-lg bg-blue-50 p-2"><div className="text-2xl font-bold text-blue-600">{counts.Excused}</div><div className="text-[10px] uppercase text-blue-700">Excused</div></div>
                </div>
                <div className="text-xs text-muted-foreground">{Object.keys(marks).length} of {students.length} marked</div>
                <textarea placeholder="Session notes (optional)…" className="w-full rounded-md border border-input bg-background p-2 text-sm min-h-[60px]" />
                {savedAt && <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Save className="h-3 w-3" /> Draft saved {savedAt}</div>}
                <button disabled={!allMarked} onClick={() => setConfirm(true)}
                  className="w-full h-10 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">
                  Submit Attendance
                </button>
              </div>
            </div>
          )}
          {!loaded && (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Select a class and period above, then click Load Students to begin.</p>
            </div>
          )}
        </>
      )}

      {tab === "history" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase">
              <tr><th className="text-left p-3">Date</th><th className="text-left p-3">Class</th><th className="text-left p-3">Period</th><th className="text-left p-3">Present</th><th className="text-left p-3">Absent</th><th className="text-left p-3">Late</th><th className="text-left p-3">Submitted</th><th className="text-left p-3">Actions</th></tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className={`border-t border-border ${i % 2 ? "bg-gray-50" : ""}`}>
                  <td className="p-3">2026-05-{String(15 - i).padStart(2, "0")}</td>
                  <td className="p-3 font-semibold">{TEACHER_ME.classes[i % TEACHER_ME.classes.length]}</td>
                  <td className="p-3">P{(i % 6) + 1}</td>
                  <td className="p-3 text-indigo-700 font-semibold">{28 - (i % 4)}</td>
                  <td className="p-3 text-red-600">{i % 3}</td>
                  <td className="p-3 text-amber-600">{i % 2}</td>
                  <td className="p-3 text-muted-foreground">07:{String(45 + i).padStart(2, "0")}</td>
                  <td className="p-3"><button className="text-xs text-primary font-semibold hover:underline">View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setConfirm(false)}>
          <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold">Confirm Submission</h3>
              <button onClick={() => setConfirm(false)} className="rounded-md p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">Submitting attendance for <b>{cls}</b>, Period {period}, {date}</p>
            <div className="flex gap-3 text-sm mb-4">
              <span className="text-indigo-700 font-semibold">{counts.Present} Present</span>
              <span className="text-red-600 font-semibold">{counts.Absent} Absent</span>
              <span className="text-amber-600 font-semibold">{counts.Late} Late</span>
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} />
              Notify {counts.Absent} parent(s) of absent students via SMS
            </label>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setConfirm(false)} className="h-9 px-4 rounded-md border border-border text-sm font-semibold">Cancel</button>
              <button onClick={submit} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </TeacherLayout>
  );
}
