import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, X, Award, FileText, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { toast } from "sonner";
import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { TEACHER_ME, EXAMS, gradeForScore, studentsInClass } from "@/lib/teacherStaffData";

export const Route = createFileRoute("/teacher/exams")({ component: TeacherExams });

function TeacherExams() {
  const [tab, setTab] = useState<"upcoming" | "enter" | "published">("upcoming");
  const [createOpen, setCreateOpen] = useState(false);
  const [viewExam, setViewExam] = useState<typeof EXAMS[number] | null>(null);

  const upcoming = EXAMS.filter(e => e.status === "Scheduled" || e.status === "Ongoing");
  const published = EXAMS.filter(e => e.status === "Published" || e.status === "Completed");

  return (
    <TeacherLayout title="Exams & Results" subtitle="Schedule exams and submit student marks">
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-1 border-b border-border">
          {([["upcoming", "Upcoming Exams"], ["enter", "Enter Results"], ["published", "Published Results"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm font-semibold border-b-2 ${tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{l}</button>
          ))}
        </div>
        {tab === "upcoming" && (
          <button onClick={() => setCreateOpen(true)} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Create Exam
          </button>
        )}
      </div>

      {tab === "upcoming" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase">
              <tr><th className="text-left p-3">Exam</th><th className="text-left p-3">Class</th><th className="text-left p-3">Subject</th><th className="text-left p-3">Date</th><th className="text-left p-3">Duration</th><th className="text-left p-3">Max Marks</th><th className="text-left p-3">Type</th><th className="text-left p-3">Status</th></tr>
            </thead>
            <tbody>
              {upcoming.map((e, i) => (
                <tr key={e.id} className={`border-t ${i % 2 ? "bg-gray-50" : ""}`}>
                  <td className="p-3 font-medium">{e.name}</td>
                  <td className="p-3">{e.class}</td>
                  <td className="p-3">{e.subject}</td>
                  <td className="p-3">{e.date}</td>
                  <td className="p-3">{e.duration}m</td>
                  <td className="p-3">{e.maxMarks}</td>
                  <td className="p-3"><span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">{e.type}</span></td>
                  <td className="p-3"><span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-700">{e.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "enter" && <EnterResults />}

      {tab === "published" && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {published.map(e => (
            <div key={e.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-display font-bold">{e.name}</div>
                  <div className="text-xs text-muted-foreground">{e.class} · {e.date}</div>
                </div>
                <Award className="h-5 w-5 text-amber-500" />
              </div>
              <div className="grid grid-cols-2 gap-2 text-center mb-3">
                <div className="rounded bg-indigo-50 p-2"><div className="text-lg font-bold text-indigo-700">{e.passRate}%</div><div className="text-[10px] uppercase">Pass Rate</div></div>
                <div className="rounded bg-indigo-50 p-2"><div className="text-lg font-bold text-indigo-700">{e.averageScore}</div><div className="text-[10px] uppercase">Avg Score</div></div>
              </div>
              <button onClick={() => setViewExam(e)} className="w-full h-8 rounded-md border border-border text-xs font-semibold hover:bg-muted">View Full Results</button>
            </div>
          ))}
        </div>
      )}

      {createOpen && <CreateExamModal onClose={() => setCreateOpen(false)} />}
      {viewExam && <ResultsModal exam={viewExam} onClose={() => setViewExam(null)} />}
    </TeacherLayout>
  );
}

function CreateExamModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold">Create Exam</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <form className="space-y-3" onSubmit={async e => { e.preventDefault(); setLoading(true); await new Promise(r => setTimeout(r, 600)); toast.success("Exam created"); onClose(); }}>
          <div><label className="text-sm font-medium">Exam Name</label><input required placeholder="Term 2 Mathematics CAT" className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium">Class</label><select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">{TEACHER_ME.classes.map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className="text-sm font-medium">Type</label><select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">{["CAT", "Main Exam", "Mock", "Quiz"].map(t => <option key={t}>{t}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-sm font-medium">Date</label><input type="date" required className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" /></div>
            <div><label className="text-sm font-medium">Duration (m)</label><input type="number" required defaultValue={60} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" /></div>
            <div><label className="text-sm font-medium">Max Marks</label><input type="number" required defaultValue={100} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" /></div>
          </div>
          <div><label className="text-sm font-medium">Notes</label><textarea className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm" rows={2} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="h-9 px-4 rounded-md border border-border text-sm font-semibold">Cancel</button>
            <button type="submit" disabled={loading} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Create Exam
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EnterResults() {
  const [cls, setCls] = useState(TEACHER_ME.classes[0]);
  const [examId, setExamId] = useState(EXAMS[0].id);
  const [loaded, setLoaded] = useState(false);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const exam = EXAMS.find(e => e.id === examId)!;
  const students = useMemo(() => studentsInClass(cls), [cls]);

  return (
    <div>
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap items-end gap-3 mb-5">
        <div><label className="text-xs font-semibold text-muted-foreground">Class</label><select value={cls} onChange={e => { setCls(e.target.value); setLoaded(false); }} className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm">{TEACHER_ME.classes.map(c => <option key={c}>{c}</option>)}</select></div>
        <div><label className="text-xs font-semibold text-muted-foreground">Exam</label><select value={examId} onChange={e => setExamId(e.target.value)} className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm">{EXAMS.map(e => <option key={e.id} value={e.id}>{e.name} – {e.class}</option>)}</select></div>
        <button onClick={() => setLoaded(true)} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold">Load Students</button>
      </div>
      {loaded && (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-border text-sm">
            <b>{exam.name}</b> · {cls} · Max marks: {exam.maxMarks} · {Object.keys(marks).length}/{students.length} marked
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase">
              <tr><th className="text-left p-3">Student</th><th className="text-left p-3">Marks</th><th className="text-left p-3">Grade</th><th className="text-left p-3">Remarks</th></tr>
            </thead>
            <tbody>
              {students.map((s, i) => {
                const m = marks[s.id];
                const num = m ? parseFloat(m) : NaN;
                const valid = !isNaN(num) && num >= 0 && num <= exam.maxMarks;
                const g = valid ? gradeForScore(num, exam.maxMarks) : null;
                return (
                  <tr key={s.id} className={`border-t ${i % 2 ? "bg-gray-50" : ""}`}>
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3">
                      <input type="number" min={0} max={exam.maxMarks} value={m ?? ""} onChange={e => setMarks({ ...marks, [s.id]: e.target.value })}
                        className={`h-8 w-20 rounded-md border bg-background px-2 text-sm ${m && !valid ? "border-red-500" : "border-input"}`} />
                      <span className="text-xs text-muted-foreground ml-2">/ {exam.maxMarks}</span>
                    </td>
                    <td className="p-3">{g && <span className={`text-xs font-bold px-2 py-0.5 rounded ${g.color}`}>{g.grade}</span>}</td>
                    <td className="p-3"><input className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" placeholder="Optional remark" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="p-4 border-t border-border flex justify-end gap-2">
            <button className="h-9 px-4 rounded-md border border-border text-sm font-semibold">Save Draft</button>
            <button onClick={() => toast.success("Results submitted to admin")} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold">Submit Results</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultsModal({ exam, onClose }: { exam: any; onClose: () => void }) {
  const distribution = [
    { grade: "A", count: 5 }, { grade: "B", count: 8 }, { grade: "C", count: 10 },
    { grade: "D", count: 4 }, { grade: "F", count: 2 },
  ];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-background p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div><h3 className="font-display text-lg font-bold">{exam.name}</h3><div className="text-xs text-muted-foreground">{exam.class} · {exam.date}</div></div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="h-56">
          <ResponsiveContainer><BarChart data={distribution}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="grade" /><YAxis /><Tooltip /><Bar dataKey="count" fill="#3b5998" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
