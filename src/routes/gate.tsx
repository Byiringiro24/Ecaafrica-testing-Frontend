import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ChevronDown } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { GATE_ENTRY_LOGS, GATE_EXIT_LOGS, STUDENTS } from "@/lib/mockData";

export const Route = createFileRoute("/gate")({ component: GatePage });

const TABS = ["Entry Log","Exit Log","Time Analytics"] as const;

function GatePage() {
  const [tab, setTab] = useState<typeof TABS[number]>("Entry Log");
  const [now, setNow] = useState(new Date());
  const [showDup, setShowDup] = useState(false);

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(i);
  }, []);

  const onCampus = GATE_ENTRY_LOGS.length - GATE_EXIT_LOGS.filter(e => e.status === "Still Out").length;
  const exited = GATE_EXIT_LOGS.length;
  const lateEntries = GATE_ENTRY_LOGS.filter(e => e.status === "Late").length;
  const unauthorized = 2;
  const totalEnrolled = STUDENTS.length;
  const onCampusPct = Math.round((onCampus / totalEnrolled) * 100);

  return (
    <AppLayout title="Gate Management" subtitle="Entry, exit & on-campus tracking">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-5">
        <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="On Campus Now" value={onCampus} tone="success" />
          <StatCard label="Exited Today" value={exited} />
          <StatCard label="Late Entries" value={lateEntries} tone="destructive" />
          <StatCard label="Unauthorized Exits" value={unauthorized} tone="destructive" />
        </div>
        <div className="rounded-xl border border-border bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-5 shadow-lg">
          <div className="text-xs uppercase tracking-wider font-bold opacity-90">Live Campus Status</div>
          <div className="font-display text-4xl font-bold mt-1">{onCampus}</div>
          <div className="text-xs opacity-90">students currently on campus</div>
          <div className="mt-3">
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-white transition-all" style={{ width: `${onCampusPct}%` }} /></div>
            <div className="text-xs opacity-80 mt-1">{onCampusPct}% of {totalEnrolled} enrolled</div>
          </div>
          <div className="text-[10px] opacity-70 mt-2">Updated {now.toLocaleTimeString()}</div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border mb-4">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{t}</button>
        ))}
      </div>

      {tab === "Entry Log" && <EntryLogTab />}
      {tab === "Exit Log" && <ExitLogTab />}
      {tab === "Time Analytics" && <TimeAnalyticsTab />}

      <div className="mt-5 rounded-xl border border-border bg-card overflow-hidden">
        <button onClick={() => setShowDup(s => !s)} className="w-full flex justify-between items-center px-5 py-3 text-sm font-bold hover:bg-muted/30">
          <span>⚠️ Duplicate Prevention Log (3 today)</span><ChevronDown className={`h-4 w-4 transition-transform ${showDup && "rotate-180"}`} />
        </button>
        {showDup && (
          <div className="border-t border-border p-4 space-y-2 text-sm">
            {[
              { name: "Nkurunziza Jean", time: "07:48", original: "07:32" },
              { name: "Uwimana Marie", time: "07:55", original: "07:41" },
              { name: "Habimana Patrick", time: "08:02", original: "07:38" },
            ].map((d, i) => (
              <div key={i} className="flex justify-between items-center rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-amber-900">
                <span><strong>{d.name}</strong> tried duplicate scan at {d.time}</span><span className="text-xs">Original entry: {d.original}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function EntryLogTab() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{["#","Time","Student","Class","Method","Status","Guard",""].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
          <tbody>
            {GATE_ENTRY_LOGS.slice(0, 20).map((e, i) => (
              <tr key={e.id} className={`border-t border-border ${e.status === "Late" ? "bg-amber-50" : "odd:bg-background even:bg-muted/20"}`}>
                <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-3 font-mono text-xs">{e.time}</td>
                <td className="px-4 py-3 font-medium">{e.studentName}</td>
                <td className="px-4 py-3">{e.class}</td>
                <td className="px-4 py-3 text-xs">{e.method}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${e.status === "Late" ? "bg-amber-200 text-amber-900" : "bg-success/15 text-success"}`}>{e.status}</span></td>
                <td className="px-4 py-3 text-xs">{e.guard}</td>
                <td className="px-4 py-3"><button className="text-xs font-semibold text-primary hover:underline">Flag</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExitLogTab() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{["#","Time","Student","Class","Exit Type","Authorized By","Expected Return","Status"].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
          <tbody>
            {GATE_EXIT_LOGS.map((e, i) => (
              <tr key={e.id} className={`border-t border-border ${e.status === "Still Out" ? "bg-destructive/5" : "odd:bg-background even:bg-muted/20"}`}>
                <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-3 font-mono text-xs">{e.time}</td>
                <td className="px-4 py-3 font-medium">{e.studentName}</td>
                <td className="px-4 py-3">{e.class}</td>
                <td className="px-4 py-3 text-xs">{e.exitType}</td>
                <td className="px-4 py-3 text-xs">{e.authorizedBy}</td>
                <td className="px-4 py-3 font-mono text-xs">{e.expectedReturn}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${e.status === "Still Out" ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"}`}>{e.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TimeAnalyticsTab() {
  const dist = [
    { slot: "06:30", count: 8 }, { slot: "06:45", count: 22 }, { slot: "07:00", count: 56 },
    { slot: "07:15", count: 142 }, { slot: "07:30", count: 98 }, { slot: "07:45", count: 64 },
    { slot: "08:00", count: 32 }, { slot: "08:15+", count: 12 },
  ];
  const week = [
    { day: "Mon", count: 478 }, { day: "Tue", count: 492 }, { day: "Wed", count: 465 },
    { day: "Thu", count: 510 }, { day: "Fri", count: 488 },
  ];
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex justify-between items-center mb-3">
          <div className="font-display font-bold">Entry Time Distribution</div>
          <div className="rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-bold">Peak: 07:15–07:30 — 142 students</div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={dist}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="slot" /><YAxis /><Tooltip />
            <Area dataKey="count" stroke="#3b5998" fill="#3b5998" fillOpacity={0.25} /></AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="font-display font-bold mb-3">Daily On-Campus Count</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={week}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip />
              <Bar dataKey="count" fill="#545f72" radius={[6,6,0,0]} /></BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div><div className="text-xs uppercase font-bold text-muted-foreground">Avg Entry Time</div><div className="font-display text-2xl font-bold mt-1">07:32</div></div>
          <div><div className="text-xs uppercase font-bold text-muted-foreground">Earliest</div><div className="font-display text-2xl font-bold mt-1">06:18</div></div>
          <div><div className="text-xs uppercase font-bold text-muted-foreground">Latest</div><div className="font-display text-2xl font-bold mt-1 text-destructive">08:42</div></div>
        </div>
      </div>
    </div>
  );
}
