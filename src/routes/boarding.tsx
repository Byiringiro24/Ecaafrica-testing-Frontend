import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { X, Bell, AlertTriangle, Check } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { DORMITORIES, TODAY_ROLLCALL, STUDENTS, type Dormitory } from "@/lib/mockData";

export const Route = createFileRoute("/boarding")({ component: BoardingPage });

function BoardingPage() {
  const [house, setHouse] = useState<Dormitory | null>(null);
  const [rollCall, setRollCall] = useState<{ dorm: Dormitory; period: "Morning" | "Evening" } | null>(null);

  const totalBoarders = DORMITORIES.reduce((s, d) => s + d.studentIds.length, 0);
  const presentTonight = TODAY_ROLLCALL.filter(r => r.evening === "Present").length;
  const onLeave = TODAY_ROLLCALL.filter(r => r.evening === "On Leave").length;
  const absent = TODAY_ROLLCALL.filter(r => r.evening === "Absent").length;
  const alerts = TODAY_ROLLCALL.filter(r => r.consecutiveAbsences >= 2);

  return (
    <AppLayout title="Boarding Management" subtitle="Dormitories, roll calls & absence monitoring">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <StatCard label="Total Boarders" value={totalBoarders} />
        <StatCard label="Present Tonight" value={presentTonight} tone="success" />
        <StatCard label="On Approved Leave" value={onLeave} />
        <StatCard label="Unaccounted" value={absent} tone="destructive" />
        <StatCard label="Absence Alerts" value={alerts.length} tone="destructive" />
      </div>

      <div className="mb-5">
        <h2 className="font-display font-bold text-lg mb-3">Dormitory Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {DORMITORIES.map(d => {
            const ids = new Set(d.studentIds);
            const dormRoll = TODAY_ROLLCALL.filter(r => ids.has(r.studentId));
            const present = dormRoll.filter(r => r.evening === "Present").length;
            const leave = dormRoll.filter(r => r.evening === "On Leave").length;
            const abs = dormRoll.filter(r => r.evening === "Absent").length;
            const occ = (d.studentIds.length / d.capacity) * 100;
            return (
              <div key={d.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="font-display font-bold">{d.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Warden: {d.warden}</div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1"><span className="font-semibold">{d.studentIds.length} / {d.capacity} occupied</span><span className="text-muted-foreground">{Math.round(occ)}%</span></div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary" style={{ width: `${occ}%` }} /></div>
                </div>
                <div className="flex justify-between text-xs mt-3">
                  <span className="text-success font-semibold">● {present} Present</span>
                  <span className="text-blue-600 font-semibold">● {leave} Leave</span>
                  <span className="text-destructive font-semibold">● {abs} Absent</span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setHouse(d)} className="flex-1 rounded-lg border border-border px-2 py-1.5 text-xs font-semibold hover:bg-muted">View House</button>
                  <button onClick={() => setRollCall({ dorm: d, period: "Evening" })} className="flex-1 rounded-lg bg-primary text-primary-foreground px-2 py-1.5 text-xs font-semibold">Roll Call</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-5">
        <h2 className="font-display font-bold text-lg mb-3">Absence Monitoring</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{["Student","House","Consecutive Absences","Last Seen","Status","Actions"].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
              <tbody>
                {alerts.sort((a,b) => b.consecutiveAbsences - a.consecutiveAbsences).slice(0, 12).map(r => {
                  const s = STUDENTS.find(x => x.id === r.studentId)!;
                  const dorm = DORMITORIES.find(d => d.studentIds.includes(r.studentId));
                  const critical = r.consecutiveAbsences >= 3;
                  return (
                    <tr key={r.studentId} className={`border-t border-border ${critical ? "bg-destructive/5" : "odd:bg-background even:bg-muted/20"}`}>
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-xs">{dorm?.name}</td>
                      <td className="px-4 py-3"><span className={`font-bold ${critical ? "text-destructive" : "text-amber-600"}`}>{r.consecutiveAbsences} days</span></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">2 days ago</td>
                      <td className="px-4 py-3">{critical ? <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 text-destructive px-2 py-0.5 text-[11px] font-bold"><AlertTriangle className="h-3 w-3" /> Critical</span> : <span className="inline-flex rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[11px] font-bold">Warning</span>}</td>
                      <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                        <button onClick={() => toast.success(`SMS sent to ${s.parentName}`)} className="text-xs font-semibold text-primary hover:underline">Notify Parent</button>
                        <button onClick={() => toast.info("Escalated to admin")} className="text-xs font-semibold text-muted-foreground hover:underline">Escalate</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {house && <HouseDetailDrawer dorm={house} onClose={() => setHouse(null)} />}
      {rollCall && <RollCallModal dorm={rollCall.dorm} period={rollCall.period} onClose={() => setRollCall(null)} />}
    </AppLayout>
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
