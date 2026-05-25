import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { SuperAdminBreadcrumbs } from "@/components/layout/SuperAdminBreadcrumbs";
import { StatCard } from "@/components/ui-kit/StatCard";
import { ChartCard } from "@/components/super-admin/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { MRR_TREND, REVENUE_BY_PLAN, REVENUE_BY_PROVINCE, CHURN_ANALYSIS, PAYMENT_METHODS, MOCK_PLATFORM_SCHOOLS } from "@/lib/superAdminMockData";
import { formatRWF } from "@/lib/mockData";

export const Route = createFileRoute("/super-admin/revenue")({ component: RevenuePage });

const PERIODS = ["This Month", "Last 3 Months", "This Year", "Custom Range"];

function RevenuePage() {
  const [period, setPeriod] = useState(PERIODS[0]);
  const [loading, setLoading] = useState(true);
  const topSchools = [...MOCK_PLATFORM_SCHOOLS].sort((a, b) => b.mrrRwf - a.mrrRwf);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 650);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SuperAdminLayout
      title="Revenue Analytics"
      breadcrumbs={<SuperAdminBreadcrumbs items={[{ label: "Super Admin", to: "/super-admin" }, { label: "Revenue" }]} />}
    >
      {loading ? (
        <RevenueSkeleton />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-5">
            {PERIODS.map(p => (
              <button key={p} type="button" onClick={() => setPeriod(p)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${period === p ? "bg-amber-500 text-amber-950" : "border border-border"}`}>{p}</button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
            <StatCard label="Total Revenue" value={formatRWF(2340000)} tone="success" />
            <StatCard label="MRR" value={formatRWF(2340000)} />
            <StatCard label="ARR" value={formatRWF(28080000)} />
            <StatCard label="Avg / School" value={formatRWF(292500)} />
            <StatCard label="New MRR" value={formatRWF(125000)} tone="success" />
            <StatCard label="Churned MRR" value={formatRWF(45000)} tone="destructive" />
          </div>

          <ChartCard title="MRR Growth" className="mb-5">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={MRR_TREND}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" fontSize={10} /><YAxis tickFormatter={v => `${(v / 1e6).toFixed(1)}M`} /><Tooltip formatter={(v: number) => formatRWF(v)} /><Area dataKey="mrr" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} /></AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <ChartCard title="Revenue by Plan">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={REVENUE_BY_PLAN}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(v: number) => formatRWF(v)} /><Legend /><Bar dataKey="Starter" fill="#94a3b8" /><Bar dataKey="Professional" fill="#3b5998" /><Bar dataKey="Enterprise" fill="#f59e0b" /></BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Revenue by Province">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={REVENUE_BY_PROVINCE} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tickFormatter={v => `${v / 1e6}M`} /><YAxis dataKey="province" type="category" width={80} /><Tooltip formatter={(v: number) => formatRWF(v)} /><Bar dataKey="revenue" fill="#3b5998" /></BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <ChartCard title="Churn Analysis (new vs churned MRR)" className="mb-5">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={CHURN_ANALYSIS}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(v: number) => formatRWF(v)} /><Legend /><Line dataKey="newMrr" stroke="#22c55e" strokeWidth={2} /><Line dataKey="churnedMrr" stroke="#ef4444" strokeWidth={2} /></LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="px-5 py-4 font-display font-semibold border-b border-border">Top Schools by Revenue</div>
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase"><tr>{["#", "School", "Plan", "MRR", "Lifetime", "Months", "Province"].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
                <tbody>
                  {topSchools.map((s, i) => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="px-4 py-3 font-bold text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-xs">{s.plan}</td>
                      <td className="px-4 py-3 font-mono text-xs">{formatRWF(s.mrrRwf)}</td>
                      <td className="px-4 py-3 text-xs">{formatRWF(s.mrrRwf * 14)}</td>
                      <td className="px-4 py-3 text-xs">14</td>
                      <td className="px-4 py-3 text-xs">{s.province}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ChartCard title="Payment Methods">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart><Pie data={PAYMENT_METHODS} dataKey="value" nameKey="name" outerRadius={80} label={e => `${e.name} ${e.value}%`}>
                  {PAYMENT_METHODS.map((_, i) => <Cell key={i} fill={["#3b5998", "#f59e0b", "#94a3b8"][i]} />)}
                </Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
    </SuperAdminLayout>
  );
}

function RevenueSkeleton() {
  return (
    <>
      <div className="flex flex-wrap gap-2 mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-28" />
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-6 w-20" />
          </div>
        ))}
      </div>
      <ChartCard title="MRR Growth" className="mb-5">
        <Skeleton className="h-[280px] w-full" />
      </ChartCard>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <ChartCard title="Revenue by Plan">
          <Skeleton className="h-[260px] w-full" />
        </ChartCard>
        <ChartCard title="Revenue by Province">
          <Skeleton className="h-[260px] w-full" />
        </ChartCard>
      </div>
      <ChartCard title="Churn Analysis (new vs churned MRR)" className="mb-5">
        <Skeleton className="h-[240px] w-full" />
      </ChartCard>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border"><Skeleton className="h-4 w-40" /></div>
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
        <ChartCard title="Payment Methods">
          <Skeleton className="h-[220px] w-full" />
        </ChartCard>
      </div>
    </>
  );
}
