import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { X, Users, CheckCircle2, ClipboardCheck, MessageSquare } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { TEACHER_ME, studentsInClass } from "@/lib/teacherStaffData";

export const Route = createFileRoute("/teacher/classes")({ component: TeacherClasses });

function TeacherClasses() {
  const [openClass, setOpenClass] = useState<string | null>(null);
  const [tab, setTab] = useState<"students" | "attendance" | "exams">("students");

  return (
    <TeacherLayout title="My Classes" subtitle={`Term 2 · 2026 · ${TEACHER_ME.classes.length} classes`}>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TEACHER_ME.classes.map((cls) => {
          const students = studentsInClass(cls);
          const att = 80 + (cls.charCodeAt(1) % 15);
          return (
            <div key={cls} className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-display font-bold text-2xl">{cls}</div>
                  <div className="text-xs text-muted-foreground">{TEACHER_ME.subject}</div>
                </div>
                {cls === TEACHER_ME.classTeacher && (
                  <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-amber-100 text-amber-700">Class Teacher</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm mb-2">
                <Users className="h-4 w-4 text-muted-foreground" /> {students.length} students
              </div>
              <div className="text-xs text-muted-foreground mb-1">Avg attendance this week</div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-indigo-500" style={{ width: `${att}%` }} />
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">{att}% · last taken 2h ago</div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => { setOpenClass(cls); setTab("students"); }} className="flex-1 h-8 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
                  View Students
                </button>
                <button className="h-8 px-3 text-xs font-semibold rounded-md border border-border hover:bg-muted">Attendance</button>
              </div>
            </div>
          );
        })}
      </div>

      {openClass && (
        <ClassDrawer cls={openClass} tab={tab} setTab={setTab} onClose={() => setOpenClass(null)} />
      )}
    </TeacherLayout>
  );
}

function ClassDrawer({ cls, tab, setTab, onClose }: { cls: string; tab: any; setTab: any; onClose: () => void }) {
  const students = studentsInClass(cls);
  const trend = Array.from({ length: 14 }, (_, i) => ({ day: `D${i + 1}`, attendance: 80 + ((i * 7) % 18) }));
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-2xl bg-background shadow-2xl overflow-y-auto animate-in slide-in-from-right">
        <div className="sticky top-0 bg-background z-10 px-6 py-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold">{cls}</h2>
            <p className="text-sm text-muted-foreground">{TEACHER_ME.subject} · {TEACHER_ME.name}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-6 pt-4">
          <div className="flex gap-1 border-b border-border">
            {(["students", "attendance", "exams"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold capitalize border-b-2 ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
                {t === "exams" ? "Exam Results" : t}
              </button>
            ))}
          </div>
        </div>
        <div className="p-6">
          {tab === "students" && (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted text-xs uppercase">
                  <tr><th className="text-left p-3">Name</th><th className="text-left p-3">Reg #</th><th className="text-left p-3">Attendance</th></tr>
                </thead>
                <tbody>
                  {students.map((s, i) => (
                    <tr key={s.id} className={`border-t border-border ${i % 2 ? "bg-gray-50" : ""}`}>
                      <td className="p-3 font-medium">{s.name}</td>
                      <td className="p-3 text-muted-foreground">{s.cardId}</td>
                      <td className="p-3">{s.attendanceRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tab === "attendance" && (
            <div className="h-72">
              <ResponsiveContainer>
                <AreaChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" fontSize={11} />
                  <YAxis fontSize={11} domain={[60, 100]} />
                  <Tooltip />
                  <Area type="monotone" dataKey="attendance" stroke="#3b5998" fill="#3b5998" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          {tab === "exams" && (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted text-xs uppercase">
                  <tr><th className="text-left p-3">Exam</th><th className="text-left p-3">Avg</th><th className="text-left p-3">High</th><th className="text-left p-3">Low</th><th className="text-left p-3">Pass %</th></tr>
                </thead>
                <tbody>
                  {[{ n: "Term 1 CAT 1", a: 68, h: 92, l: 41, p: 78 }, { n: "Term 1 Main", a: 72, h: 95, l: 48, p: 84 }, { n: "Term 2 CAT 1", a: 70, h: 90, l: 45, p: 80 }].map((e, i) => (
                    <tr key={i} className={`border-t ${i % 2 ? "bg-gray-50" : ""}`}>
                      <td className="p-3 font-medium">{e.n}</td><td className="p-3">{e.a}</td><td className="p-3 text-indigo-700 font-semibold">{e.h}</td><td className="p-3 text-red-600">{e.l}</td><td className="p-3">{e.p}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
