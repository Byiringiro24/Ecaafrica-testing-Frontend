import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { SuperAdminBreadcrumbs } from "@/components/layout/SuperAdminBreadcrumbs";
import { StatCard } from "@/components/ui-kit/StatCard";
import { ChartCard, PageTabs } from "@/components/super-admin/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { MOCK_PLATFORM_SCHOOLS } from "@/lib/superAdminMockData";

export const Route = createFileRoute("/super-admin/analytics")({ component: AnalyticsPage });

const ATTENDANCE_TREND = Array.from({ length: 14 }, (_, i) => ({
  day: `May ${i + 1}`,
  rate: 88 + (i % 5) - 2,
  records: 12000 + i * 400,
}));

const API_TREND = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, ms: 100 + (i % 7) * 15 + Math.sin(i) * 20 }));

function AnalyticsPage() {
  const [tab, setTab] = useState("Usage");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 550);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SuperAdminLayout
      title="Platform Analytics"
      breadcrumbs={<SuperAdminBreadcrumbs items={[{ label: "Super Admin", to: "/super-admin" }, { label: "Analytics" }]} />}
    >
      {loading ? (
        <AnalyticsSkeleton />
      ) : (
        <>
          <PageTabs tabs={["Usage", "Attendance", "SMS", "Performance"]} active={tab} onChange={setTab} />

          {tab === "Usage" && (
            <>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <StatCard label="DAU" value="1,240" />
                <StatCard label="WAU" value="3,890" />
                <StatCard label="MAU" value="8,420" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
                <ChartCard title="Feature Adoption">
                  <div className="space-y-2 text-sm">
                    {[
                      ["Core Attendance", 100],
                      ["Boarding", 62],
                      ["Biometrics", 48],
                      ["Gate", 41],
                      ["Exam System", 28],
                    ].map(([f, pct]) => (
                      <div key={f as string}>
                        <div className="flex justify-between text-xs mb-1"><span>{f}</span><span>{pct}%</span></div>
                        <div className="h-2 bg-muted rounded-full"><div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </ChartCard>
                <ChartCard title="Login Heatmap (sample)">
                  <div className="grid grid-cols-7 gap-1 text-[10px]">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => <div key={d} className="text-center font-bold text-muted-foreground">{d}</div>)}
                    {Array.from({ length: 7 * 8 }, (_, i) => (
                      <div key={i} className="aspect-square rounded" style={{ background: `oklch(0.5 0.1 265 / ${0.1 + (i % 7) * 0.12})` }} title={`${8 + (i % 8)}:00`} />
                    ))}
                  </div>
                </ChartCard>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="font-semibold mb-3">Top Active Schools</div>
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground"><tr><th className="text-left py-2">School</th><th className="text-right">Logins (7d)</th></tr></thead>
                  <tbody>
                    {MOCK_PLATFORM_SCHOOLS.slice(0, 5).map((s, i) => (
                      <tr key={s.id} className="border-t border-border"><td className="py-2">{s.name}</td><td className="py-2 text-right font-bold">{420 - i * 40}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === "Attendance" && (
            <>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <StatCard label="Records Processed" value="1.2M" />
                <StatCard label="Avg Daily Rate" value="91.4%" tone="success" />
              </div>
              <ChartCard title="Platform Attendance Trend" className="mb-5">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={ATTENDANCE_TREND}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" fontSize={10} /><YAxis yAxisId="left" domain={[80, 100]} /><YAxis yAxisId="right" orientation="right" /><Tooltip /><Line yAxisId="left" dataKey="rate" stroke="#3b5998" strokeWidth={2} name="Rate %" /><Line yAxisId="right" dataKey="records" stroke="#f59e0b" strokeWidth={2} name="Records" /></LineChart>
                </ResponsiveContainer>
              </ChartCard>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="font-semibold text-amber-900 mb-2">Schools with lowest attendance</div>
                <ul className="text-sm space-y-1 text-amber-800">
                  <li>GS Nyamirambo — 72%</li>
                  <li>GS Rwamagana — 78%</li>
                </ul>
              </div>
            </>
          )}

          {tab === "SMS" && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <StatCard label="SMS This Month" value="248,120" />
                <StatCard label="All Time" value="2.4M" />
                <StatCard label="Delivery Rate" value="98.2%" tone="success" />
                <StatCard label="Cost / SMS" value="12" />
              </div>
              <ChartCard title="SMS by Provider" className="mb-5">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={[{ name: "Pindo", value: 62 }, { name: "Africa's Talking", value: 22 }, { name: "Twilio", value: 10 }, { name: "MTN", value: 6 }]} dataKey="value" outerRadius={90} label>
                      {["#3b5998", "#545f72", "#f59e0b", "#ef4444"].map((c, i) => <Cell key={i} fill={c} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="font-semibold mb-2">Failed SMS Log</div>
                <div className="text-sm space-y-2">
                  <div className="flex justify-between border-b py-2"><span>GS Kacyiru — batch #4421</span><span className="text-amber-600">14 failed</span></div>
                  <div className="flex justify-between border-b py-2"><span>ES Remera — batch #4418</span><span className="text-amber-600">3 failed</span></div>
                </div>
              </div>
            </>
          )}

          {tab === "Performance" && (
            <>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <StatCard label="API p95" value="124ms" tone="success" />
                <StatCard label="Error Rate" value="0.12%" />
                <StatCard label="Queue Backlog" value="3" />
              </div>
              <ChartCard title="API Response Time" className="mb-5">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={API_TREND}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="hour" fontSize={9} /><YAxis /><Tooltip /><Area dataKey="ms" stroke="#3b5998" fill="#3b5998" fillOpacity={0.2} /></AreaChart>
                </ResponsiveContainer>
              </ChartCard>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-3 font-semibold border-b">Slowest Endpoints</div>
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      ["/api/reports/export", "842ms"],
                      ["/api/attendance/bulk", "520ms"],
                      ["/api/sms/send-batch", "380ms"],
                    ].map(([ep, ms]) => (
                      <tr key={ep as string} className="border-t border-border"><td className="px-4 py-2 font-mono text-xs">{ep}</td><td className="px-4 py-2 text-right font-bold text-amber-700">{ms}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </SuperAdminLayout>
  );
}

function AnalyticsSkeleton() {
  return (
    <>
      <div className="flex flex-wrap gap-1 border-b border-border mb-5 overflow-x-auto">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 mb-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-6 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <ChartCard title="Feature Adoption">
          <Skeleton className="h-[180px] w-full" />
        </ChartCard>
        <ChartCard title="Login Heatmap (sample)">
          <Skeleton className="h-[180px] w-full" />
        </ChartCard>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <Skeleton className="h-4 w-40" />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    </>
  );
}
