import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Activity, Mail, School, TrendingUp } from "lucide-react";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { ChartCard, LiveClock, Pagination } from "@/components/super-admin/ui";
import { formatRWF } from "@/lib/mockData";
import {
  MOCK_PLATFORM_SCHOOLS,
  MRR_TREND,
  SCHOOL_GROWTH,
  PLATFORM_ACTIVITY,
  planBadgeClass,
  statusBadgeClass,
} from "@/lib/superAdminMockData";

export const Route = createFileRoute("/super-admin/")({
  component: SuperAdminOverview,
});

function SuperAdminOverview() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalStudents = MOCK_PLATFORM_SCHOOLS.reduce((s, x) => s + x.students, 0);
  const activeSchools = MOCK_PLATFORM_SCHOOLS.filter(s => s.status === "active").length;
  const activeSubs = MOCK_PLATFORM_SCHOOLS.filter(s => ["active", "trial", "grace"].includes(s.status)).length;
  const mrr = MOCK_PLATFORM_SCHOOLS.reduce((s, x) => s + x.mrrRwf, 0);
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return MOCK_PLATFORM_SCHOOLS.slice(start, start + pageSize);
  }, [page, pageSize]);

  return (
    <SuperAdminLayout
      title="Platform Overview"
      subtitle="Netrack platform-wide metrics"
      headerExtra={<LiveClock />}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
        <StatCard compact label="Schools" value={MOCK_PLATFORM_SCHOOLS.length} trend={`${activeSchools} active`} />
        <StatCard compact label="Active subs" value={activeSubs} trend={formatRWF(mrr)} tone="success" />
        <StatCard compact label="Students" value={totalStudents.toLocaleString()} />
        <StatCard compact label="MRR" value={formatRWF(2340000)} tone="success" icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard compact label="Uptime" value="99.8%" tone="success" />
        <StatCard compact label="SMS (mo)" value="248K" icon={<Mail className="h-4 w-4" />} />
        <StatCard compact label="New schools" value="+3" tone="warning" />
        <StatCard compact label="Support" value={5} tone="destructive" />
      </div>

      <div className="flex flex-col gap-5 mb-5">
        <ChartCard title="MRR Trend (12 months)">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={MRR_TREND}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" fontSize={10} />
              <YAxis tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} fontSize={10} />
              <Tooltip formatter={(v: number) => formatRWF(v)} />
              <Area type="monotone" dataKey="mrr" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.25} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="School Growth (new per month)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={SCHOOL_GROWTH}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" fontSize={10} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="schools" fill="#3b5998" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border font-display font-semibold flex items-center gap-2">
            <School className="h-4 w-4 text-amber-600" /> Active Schools
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  {["School", "Location", "Plan", "Students", "Status", "SMS", "Last Active", ""].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(s => (
                  <tr key={s.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.location}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${planBadgeClass(s.plan)}`}>{s.plan}</span></td>
                    <td className="px-4 py-3">{s.students}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${statusBadgeClass(s.status)}`}>{s.status}</span></td>
                    <td className="px-4 py-3 text-xs">{s.smsUsed.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.lastActive}</td>
                    <td className="px-4 py-3 whitespace-nowrap space-x-2">
                      <Link to="/super-admin/schools/$id" params={{ id: s.id }} className="text-xs font-semibold text-primary hover:underline">View</Link>
                      <button type="button" className="text-xs text-muted-foreground hover:underline">Contact</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={MOCK_PLATFORM_SCHOOLS.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="font-display font-semibold mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600" /> System Health
            </div>
            <ul className="space-y-2 text-sm">
              {[
                { k: "API Response Time", v: "124ms", ok: true },
                { k: "Database", v: "Healthy", ok: true },
                { k: "SMS Gateway (Pindo)", v: "Online", ok: true },
                { k: "Background Jobs", v: "3 running", ok: true },
                { k: "Last backup", v: "2 hours ago", ok: true },
              ].map(m => (
                <li key={m.k} className="flex justify-between border-b border-border pb-2 last:border-0">
                  <span className="text-muted-foreground">{m.k}</span>
                  <span className={m.ok ? "font-semibold text-emerald-600" : "font-semibold text-destructive"}>{m.v}</span>
                </li>
              ))}
            </ul>
            <Link to="/super-admin/system" className="mt-3 inline-block text-xs font-semibold text-primary hover:underline">
              View System Status →
            </Link>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="font-display font-semibold mb-3">Recent Platform Activity</div>
            <div className="space-y-2 text-sm">
              {PLATFORM_ACTIVITY.map((a, i) => (
                <div key={i} className="flex gap-2 border-b border-border pb-2 last:border-0">
                  <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${a.tone === "warning" ? "bg-amber-500" : a.tone === "destructive" ? "bg-destructive" : "bg-primary"}`} />
                  <div className="flex-1 min-w-0">
                    <p>{a.text}</p>
                    <p className="text-xs text-muted-foreground">{a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
