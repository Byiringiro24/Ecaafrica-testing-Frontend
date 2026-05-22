import { createFileRoute } from "@tanstack/react-router";
import { Users, CheckCircle2, XCircle, Clock } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Avatar } from "@/components/ui-kit/Avatar";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import {
  todayCounts, WEEK_ATTENDANCE, CLASS_PIE, RECENT_CHECKINS, ABSENCE_ALERTS,
} from "@/lib/mockData";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

const PIE_COLORS = [
  "#3b5998","#545f72","#F59E0B","#EF4444","#0EA5E9","#A855F7",
  "#14B8A6","#F97316","#6366F1","#22C55E","#EAB308","#F43F5E",
];

function DashboardPage() {
  const { total, present, absent, late } = todayCounts();
  const pct = (n: number) => ((n / total) * 100).toFixed(0);

  return (
    <AppLayout
      title="Dashboard Overview"
      subtitle="Real-time attendance insights for your school"
    >
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Students" value={total} icon={<Users className="h-5 w-5" />} trend="↑ 4 this term" tone="primary" />
        <StatCard label="Present Today" value={present} icon={<CheckCircle2 className="h-5 w-5" />} trend={`${pct(present)}% of total`} tone="success" />
        <StatCard label="Absent Today" value={absent} icon={<XCircle className="h-5 w-5" />} trend={`${pct(absent)}% of total`} tone="destructive" />
        <StatCard label="Late Arrivals" value={late} icon={<Clock className="h-5 w-5" />} trend={`${pct(late)}% of total`} tone="warning" />
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mt-6">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg">This Week's Attendance</h3>
            <span className="text-xs text-muted-foreground">Mon – Fri</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={WEEK_ATTENDANCE} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Present" fill="#545f72" radius={[6,6,0,0]} />
                <Bar dataKey="Absent" fill="#EF4444" radius={[6,6,0,0]} />
                <Bar dataKey="Late" fill="#F59E0B" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-display font-bold text-lg mb-4">Attendance by Class Today</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={CLASS_PIE} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                  {CLASS_PIE.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mt-6">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-display font-bold text-lg mb-4">Recent Check-ins</h3>
          <div className="space-y-2">
            {RECENT_CHECKINS.map((c, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/60 transition-colors">
                <Avatar name={c.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.class} • {c.time}</p>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg">Absence Alerts</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-destructive font-semibold">
              {ABSENCE_ALERTS.length} students
            </span>
          </div>
          <div className="space-y-2">
            {ABSENCE_ALERTS.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <Avatar name={a.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.class} • {a.daysMissed} days missed</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
