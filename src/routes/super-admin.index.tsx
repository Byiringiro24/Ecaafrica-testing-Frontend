import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Activity, Mail, School, TrendingUp } from "lucide-react";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { ChartCard, LiveClock, Pagination } from "@/components/super-admin/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRWF } from "@/lib/mockData";  
import { apiRequest } from "@/lib/api";
import {  
  SCHOOL_GROWTH, 
  PLATFORM_ACTIVITY,
  ACTIVE_SCHOOL_DEVICES,
  planBadgeClass,
  statusBadgeClass,
} from "@/lib/superAdminMockData";

export const Route = createFileRoute("/super-admin/")({
  component: SuperAdminOverview,
});

function SuperAdminOverview() {
  const [loading, setLoading] = useState(true);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [schools, setSchools] = useState<PlatformSchool[]>([]);
  const [schoolsMeta, setSchoolsMeta] = useState({ page: 1, limit: 10, total: 0 });
  const [overview, setOverview] = useState<null | {
    schools: { total: number; active: number; new: number };
    students: { total: number };
    subscriptions: { active: number };
    mrr: number;
    smsMonthly: number;
    supportOpen: number;
    mrrTrend: { month: string; mrr: number }[];
  }>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await apiRequest<{
          schools: { total: number; active: number; new: number };
          students: { total: number };
          subscriptions: { active: number };
          mrr: number;
          smsMonthly: number;
          supportOpen: number;
          mrrTrend: { month: string; mrr: number }[];
        }>("/platform/overview", { auth: "platform" });
        if (active) setOverview(data);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadSchools = async () => {
      setSchoolsLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      params.set("status", "active");

      try {
        const resp = await apiRequest<ListResponse<PlatformSchool>>(
          `/platform/schools?${params.toString()}`,
          { returnMeta: true }
        );
        if (!active) return;
        const items = Array.isArray(resp?.data) ? resp.data : [];
        setSchools(items);
        setSchoolsMeta(resp?.meta ?? { page, limit: pageSize, total: items.length });
      } catch {
        if (!active) return;
        setSchools([]);
        setSchoolsMeta({ page: 1, limit: pageSize, total: 0 });
      } finally {
        if (active) setSchoolsLoading(false);
      }
    };

    loadSchools();
    return () => {
      active = false;
    };
  }, [page, pageSize]);

  const totalStudents = overview?.students.total ?? 0;
  const activeSchools = overview?.schools.active ?? 0;
  const activeSubs = overview?.subscriptions.active ?? 0;
  const mrr = overview?.mrr ?? 0;
  const smsMonthly = overview?.smsMonthly ?? 0;
  const newSchools = overview?.schools.new ?? 0;
  const supportOpen = overview?.supportOpen ?? 0;

  const formatK = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${Math.round(value / 1000)}K`;
    return value.toString();
  };

  const mrrTrend = (overview?.mrrTrend ?? []).map((item) => {
    const [year, month] = item.month.split("-");
    const label = `${new Date(Number(year), Number(month) - 1, 1).toLocaleString("en-GB", {
      month: "short"
    })} ${year.slice(-2)}`;
    return { month: label, mrr: item.mrr };
  });
  const paginated = schools;

  const formatLastActive = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    const diffMs = Date.now() - date.getTime();
    if (diffMs < 60000) return "just now";
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hrs ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  };

  return (
    <SuperAdminLayout
      title="Platform Overview"
      subtitle="Netrack platform-wide metrics"
      headerExtra={<LiveClock />}
    >
      {loading ? (
        <OverviewSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
            <StatCard compact label="Schools" value={overview?.schools.total ?? 0} trend={`${activeSchools} active`} />
            <StatCard compact label="Devices" value={activeSubs} trend="active devices" tone="success" />
            <StatCard compact label="Students" value={totalStudents.toLocaleString()} />
            {/* <StatCard compact label="Uptime" value="99.8%" tone="success" /> */}
            <StatCard compact label="SMS (mo)" value={formatK(smsMonthly)} icon={<Mail className="h-4 w-4" />} accent="blue" />
            {/* <StatCard compact label="New schools" value={`+${newSchools}`} tone="warning" accent="blue" /> */}
            {/* <StatCard compact label="Support" value={supportOpen} tone="destructive" accent="blue" /> */}
          </div>

          <div className="flex flex-col gap-5 mb-5">
            <ChartCard title="MRR Trend (12 months)" className="border-blue-200/70 bg-blue-50/30">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={mrrTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" fontSize={10} />
                  <YAxis tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} fontSize={10} />
                  <Tooltip formatter={(v: number) => formatRWF(v)} />
                  <Area type="monotone" dataKey="mrr" stroke="#2563eb" fill="#2563eb" fillOpacity={0.25} />
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
                    {schoolsLoading && paginated.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-6">
                          <div className="flex flex-col gap-2">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-4 w-56" />
                          </div>
                        </td>
                      </tr>
                    ) : paginated.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-6 text-sm text-muted-foreground">
                          No active schools found.
                        </td>
                      </tr>
                    ) : (
                      paginated.map(s => (
                        <tr key={s.id} className="border-t border-border hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{s.name}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{`${s.province}, ${s.district}`}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${planBadgeClass(s.subscription_plan?.name ?? "")}`}>
                              {s.subscription_plan?.name ?? "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">{s.student_count ?? 0}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${statusBadgeClass(s.status ?? "")}`}>
                              {s.status ?? "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs">{s.subscription_plan?.sms_bundle ?? "—"}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{formatLastActive(s.updated_at)}</td>
                          <td className="px-4 py-3 whitespace-nowrap space-x-2">
                            <Link to="/super-admin/schools/$id" params={{ id: s.id }} className="text-xs font-semibold text-primary hover:underline">View</Link>
                            <button type="button" className="text-xs text-muted-foreground hover:underline">Contact</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
                <Pagination total={schoolsMeta.total} page={page} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />
            </div>

            <div className="space-y-5">
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm hidden">
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
                <div className="font-display font-semibold mb-3">Active Devices by Schools</div>
                <div className="space-y-2 text-sm">
                  {ACTIVE_SCHOOL_DEVICES.map((a, i) => (
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
        </>
      )}
    </SuperAdminLayout>
  );
}

function OverviewSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card shadow-sm min-w-0 p-3 sm:p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-6 w-16" />
            <Skeleton className="mt-2 h-4 w-24 rounded-full" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-5 mb-5">
        <ChartCard title="MRR Trend (12 months)">
          <Skeleton className="h-[260px] w-full" />
        </ChartCard>
        <ChartCard title="School Growth (new per month)">
          <Skeleton className="h-[260px] w-full" />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border font-display font-semibold flex items-center gap-2">
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <th key={i} className="text-left px-4 py-3">
                      <Skeleton className="h-3 w-14" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-32" />
                    </td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20 rounded-full" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16 rounded-full" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-10" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border">
            <Skeleton className="h-4 w-48" />
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <Skeleton className="h-4 w-28" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
            <Skeleton className="mt-3 h-4 w-32" />
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <Skeleton className="h-4 w-36" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-2 border-b border-border pb-2 last:border-0">
                  <Skeleton className="mt-1.5 h-2 w-2 rounded-full" />
                  <div className="flex-1 min-w-0">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="mt-1 h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
