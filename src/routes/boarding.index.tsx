import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { X, Bell, Check } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { DORMITORIES, TODAY_ROLLCALL, STUDENTS, type Dormitory } from "@/lib/mockData";

export const Route = createFileRoute("/boarding/")({ component: BoardingPage });

const LOG_TABS = ["Morning Log", "Evening Log", "Dormitory Logs"] as const;
type LogTab = typeof LOG_TABS[number];

function BoardingPage() {
  const [house, setHouse] = useState<Dormitory | null>(null);
  const [rollCall, setRollCall] = useState<{ dorm: Dormitory; period: "Morning" | "Evening" } | null>(null);
  const [tab, setTab] = useState<LogTab>("Evening Log");

  const totalBoarders = DORMITORIES.reduce((s, d) => s + d.studentIds.length, 0);
  const presentTonight = TODAY_ROLLCALL.filter(r => r.evening === "Present").length;
  const onLeave = TODAY_ROLLCALL.filter(r => r.evening === "On Leave").length;
  const absent = TODAY_ROLLCALL.filter(r => r.evening === "Absent").length;
  const alerts = TODAY_ROLLCALL.filter(r => r.consecutiveAbsences >= 2);

  const rollLogs = useMemo(() => TODAY_ROLLCALL.map(r => {
    const student = STUDENTS.find(s => s.id === r.studentId);
    const dorm = DORMITORIES.find(d => d.studentIds.includes(r.studentId));
    return {
      id: r.studentId,
      studentName: student?.name ?? "Unknown",
      className: student?.class ?? "—",
      dormName: dorm?.name ?? "Day Scholar",
      parentName: student?.parentName ?? "",
      morning: r.morning,
      evening: r.evening,
      consecutiveAbsences: r.consecutiveAbsences,
    };
  }), []);

  const dormLogs = useMemo(() => DORMITORIES.map(d => {
    const ids = new Set(d.studentIds);
    const dormRoll = TODAY_ROLLCALL.filter(r => ids.has(r.studentId));
    const present = dormRoll.filter(r => r.evening === "Present").length;
    const leave = dormRoll.filter(r => r.evening === "On Leave").length;
    const abs = dormRoll.filter(r => r.evening === "Absent").length;
    const occ = (d.studentIds.length / d.capacity) * 100;
    return {
      dorm: d,
      present,
      leave,
      absent: abs,
      occupancy: Math.round(occ),
    };
  }), []);

  return (
    <AppLayout title="Boarding Management" subtitle="Dormitories, roll calls & absence monitoring">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <StatCard label="Total Boarders" value={totalBoarders} />
        <StatCard label="Present Tonight" value={presentTonight} tone="success" />
        <StatCard label="On Approved Leave" value={onLeave} />
        <StatCard label="Unaccounted" value={absent} tone="destructive" />
        <StatCard label="Absence Alerts" value={alerts.length} tone="destructive" />
      </div>

      <div className="flex gap-1 border-b border-border mb-4">
        {LOG_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Morning Log" && (
        <RollLogTable
          rows={rollLogs}
          period="Morning"
          onNotify={(name) => toast.success(`SMS sent to ${name}`)}
        />
      )}
      {tab === "Evening Log" && (
        <RollLogTable
          rows={rollLogs}
          period="Evening"
          onNotify={(name) => toast.success(`SMS sent to ${name}`)}
        />
      )}
      {tab === "Dormitory Logs" && (
        <DormitoryLogTable
          rows={dormLogs}
          onView={(d) => setHouse(d)}
          onRollCall={(d) => setRollCall({ dorm: d, period: "Evening" })}
        />
      )}

      {house && <HouseDetailDrawer dorm={house} onClose={() => setHouse(null)} />}
      {rollCall && <RollCallModal dorm={rollCall.dorm} period={rollCall.period} onClose={() => setRollCall(null)} />}
    </AppLayout>
  );
}

function RollLogTable({ rows, period, onNotify }: { rows: { id: string; studentName: string; className: string; dormName: string; parentName: string; morning: "Present" | "Absent" | "On Leave"; evening: "Present" | "Absent" | "On Leave"; consecutiveAbsences: number; }[]; period: "Morning" | "Evening"; onNotify: (name: string) => void; }) {
  const statusClass: Record<"Present" | "Absent" | "On Leave", string> = {
    Present: "bg-success/15 text-success",
    Absent: "bg-destructive/15 text-destructive",
    "On Leave": "bg-blue-100 text-blue-700",
  };
  const pickStatus = (r: (typeof rows)[number]) => period === "Morning" ? r.morning : r.evening;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>{["#","Student","Class","House","Status","Consecutive Absences","Actions"].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const status = pickStatus(r);
              return (
                <tr key={r.id} className={`border-t border-border ${status === "Absent" ? "bg-destructive/5" : "odd:bg-background even:bg-muted/20"}`}>
                  <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{r.studentName}</td>
                  <td className="px-4 py-3">{r.className}</td>
                  <td className="px-4 py-3 text-xs">{r.dormName}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${statusClass[status]}`}>{status}</span></td>
                  <td className="px-4 py-3"><span className={`font-bold ${r.consecutiveAbsences >= 3 ? "text-destructive" : "text-amber-600"}`}>{r.consecutiveAbsences} days</span></td>
                  <td className="px-4 py-3">
                    <button onClick={() => onNotify(r.parentName || r.studentName)} className="text-xs font-semibold text-primary hover:underline">Notify Parent</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DormitoryLogTable({ rows, onView, onRollCall }: { rows: { dorm: Dormitory; present: number; leave: number; absent: number; occupancy: number; }[]; onView: (d: Dormitory) => void; onRollCall: (d: Dormitory) => void; }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>{["Dormitory","Warden","Occupancy","Present","On Leave","Absent","Actions"].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.dorm.id} className="border-t border-border odd:bg-background even:bg-muted/20">
                <td className="px-4 py-3 font-medium">{r.dorm.name}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.dorm.warden}</td>
                <td className="px-4 py-3 text-xs">
                  {r.dorm.studentIds.length}/{r.dorm.capacity} ({r.occupancy}%)
                </td>
                <td className="px-4 py-3 text-success font-semibold">{r.present}</td>
                <td className="px-4 py-3 text-blue-700 font-semibold">{r.leave}</td>
                <td className="px-4 py-3 text-destructive font-semibold">{r.absent}</td>
                <td className="px-4 py-3 space-x-2">
                  <button onClick={() => onView(r.dorm)} className="text-xs font-semibold text-primary hover:underline">View House</button>
                  <button onClick={() => onRollCall(r.dorm)} className="text-xs font-semibold text-muted-foreground hover:underline">Roll Call</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HouseDetailDrawer({ dorm, onClose }: { dorm: Dormitory; onClose: () => void }) {
  const [tab, setTab] = useState<"Tonight" | "This Week" | "Absence History">("Tonight");
  const ids = new Set(dorm.studentIds);
  const students = STUDENTS.filter(s => ids.has(s.id));
  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-card shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex justify-between items-center sticky top-0 bg-card">
          <div><h3 className="font-display font-bold">{dorm.name}</h3><div className="text-xs text-muted-foreground">Warden: {dorm.warden}</div></div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 pt-3">
          <div className="flex border-b border-border">
            {(["Tonight","This Week","Absence History"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-xs font-semibold border-b-2 -mb-px ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{t}</button>
            ))}
          </div>
        </div>
        <div className="p-6 space-y-2">
          {students.map(s => {
            const r = TODAY_ROLLCALL.find(x => x.studentId === s.id);
            const status = r?.evening ?? "Present";
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary text-xs font-bold">{s.name.split(" ").map(p => p[0]).join("").slice(0,2)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.class} · {s.parentPhone}</div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${status === "Present" ? "bg-success/15 text-success" : status === "Absent" ? "bg-destructive/15 text-destructive" : "bg-blue-100 text-blue-700"}`}>{status}</span>
                {r && r.consecutiveAbsences > 0 && <span className="text-xs text-amber-600 font-bold">{r.consecutiveAbsences}d</span>}
                <button onClick={() => toast.success("Notified")} className="rounded p-1.5 hover:bg-muted"><Bell className="h-3.5 w-3.5" /></button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RollCallModal({ dorm, period, onClose }: { dorm: Dormitory; period: "Morning" | "Evening"; onClose: () => void }) {
  const ids = new Set(dorm.studentIds);
  const students = STUDENTS.filter(s => ids.has(s.id));
  const [marks, setMarks] = useState<Record<string, "Present" | "Absent" | "On Leave">>({});
  const marked = Object.keys(marks).length;

  const submit = () => {
    const absents = Object.entries(marks).filter(([,v]) => v === "Absent");
    toast.success(`Roll Call submitted: ${marked}/${students.length} marked. Auto-SMS for ${absents.length} absences sent.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
          <div>
            <h3 className="font-display font-bold">{period} Roll Call — {dorm.name}</h3>
            <div className="text-xs text-muted-foreground">{new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 pt-3">
          <div className="flex justify-between text-xs mb-1"><span className="font-semibold">{marked} / {students.length} marked</span></div>
          <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${(marked / students.length) * 100}%` }} /></div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {students.map(s => {
            const m = marks[s.id];
            return (
              <div key={s.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                <div className="flex-1 text-sm font-medium">{s.name}</div>
                <button onClick={() => setMarks(p => ({ ...p, [s.id]: "Present" }))} className={`rounded-md px-2.5 py-1 text-xs font-bold ${m === "Present" ? "bg-success text-white" : "bg-success/10 text-success hover:bg-success/20"}`}>✅</button>
                <button onClick={() => setMarks(p => ({ ...p, [s.id]: "Absent" }))} className={`rounded-md px-2.5 py-1 text-xs font-bold ${m === "Absent" ? "bg-destructive text-white" : "bg-destructive/10 text-destructive hover:bg-destructive/20"}`}>🔴</button>
                <button onClick={() => setMarks(p => ({ ...p, [s.id]: "On Leave" }))} className={`rounded-md px-2.5 py-1 text-xs font-bold ${m === "On Leave" ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-700 hover:bg-blue-200"}`}>🏖</button>
              </div>
            );
          })}
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-between">
          <div className="flex gap-2">
            <button onClick={() => setMarks(Object.fromEntries(students.map(s => [s.id, "Present" as const])))} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">Mark All Present</button>
          </div>
          <button onClick={submit} className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold"><Check className="h-4 w-4" /> Submit Roll Call</button>
        </div>
      </div>
    </div>
  );
}
