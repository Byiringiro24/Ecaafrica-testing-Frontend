import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { teacherRouteGuard } from "@/lib/schoolAuth";
import { ChevronLeft, ChevronRight, Printer, List, Grid3X3 } from "lucide-react";
import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { TODAY_SCHEDULE, TEACHER_ME } from "@/lib/teacherStaffData";

export const Route = createFileRoute("/teacher/schedule")({
  beforeLoad: ({ location }) => teacherRouteGuard(location),
  component: SchedulePage
});

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const PERIODS = [
  { p: 1, time: "07:00–07:45" }, { p: 2, time: "07:45–08:30" },
  { p: 3, time: "08:30–09:15" }, { p: 4, time: "09:15–10:00" },
  { p: 0, time: "10:00–10:30", brk: "Break" },
  { p: 5, time: "10:30–11:15" }, { p: 6, time: "11:15–12:00" },
  { p: 0, time: "12:00–13:00", brk: "Lunch" },
  { p: 7, time: "13:00–13:45" }, { p: 8, time: "13:45–14:30" },
];

function SchedulePage() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [w, setW] = useState(0);
  const cellFor = (day: string, period: number) => {
    const idx = (DAYS.indexOf(day) + period) % TEACHER_ME.classes.length;
    if ((day === "Wed" && period === 7) || (day === "Fri" && period === 8)) return null;
    return { class: TEACHER_ME.classes[idx], subject: TEACHER_ME.subject };
  };
  return (
    <TeacherLayout title="My Timetable" subtitle={TEACHER_ME.subject}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <button onClick={() => setW(w - 1)} className="h-9 w-9 grid place-items-center rounded-md border border-border hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
          <div className="font-semibold text-sm">Week of May {15 + w * 7}, 2026</div>
          <button onClick={() => setW(w + 1)} className="h-9 w-9 grid place-items-center rounded-md border border-border hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setView("grid")} className={`h-9 w-9 grid place-items-center rounded-md ${view === "grid" ? "bg-primary text-primary-foreground" : "border border-border"}`}><Grid3X3 className="h-4 w-4" /></button>
          <button onClick={() => setView("list")} className={`h-9 w-9 grid place-items-center rounded-md ${view === "list" ? "bg-primary text-primary-foreground" : "border border-border"}`}><List className="h-4 w-4" /></button>
          <button onClick={() => window.print()} className="h-9 px-3 rounded-md border border-border text-sm font-semibold inline-flex items-center gap-2"><Printer className="h-4 w-4" /> Print</button>
        </div>
      </div>
      {view === "grid" ? (
        <div className="rounded-xl border border-border bg-card overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase">
              <tr><th className="text-left p-3 w-32">Period</th>{DAYS.map(d => <th key={d} className="text-center p-3">{d}</th>)}</tr>
            </thead>
            <tbody>
              {PERIODS.map((p, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="p-3 align-top">{p.brk ? <div className="text-xs font-semibold text-muted-foreground">{p.brk}</div> : <><div className="font-semibold">P{p.p}</div><div className="text-[11px] text-muted-foreground">{p.time}</div></>}</td>
                  {DAYS.map(d => {
                    if (p.brk) return <td key={d} className="p-2"><div className="rounded bg-gray-100 text-gray-500 text-center text-xs py-3">{p.brk}</div></td>;
                    const c = cellFor(d, p.p);
                    return <td key={d} className="p-2">{c ? <div className="rounded-lg bg-primary/10 border border-primary/30 px-3 py-2 text-center"><div className="font-bold text-primary text-sm">{c.class}</div><div className="text-[10px] text-muted-foreground">{c.subject}</div></div> : <div className="rounded bg-gray-50 h-12" />}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border shadow-sm">
          {TODAY_SCHEDULE.map(s => (
            <div key={s.period} className="flex items-center gap-4 p-4">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary font-bold">P{s.period}</div>
              <div className="flex-1"><div className="font-semibold text-sm">{s.class} · {s.subject}</div><div className="text-xs text-muted-foreground">{s.time} · {s.room}</div></div>
            </div>
          ))}
        </div>
      )}
    </TeacherLayout>
  );
}
