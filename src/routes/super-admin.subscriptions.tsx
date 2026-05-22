import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { toast } from "sonner";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { SuperAdminBreadcrumbs } from "@/components/layout/SuperAdminBreadcrumbs";
import { StatCard } from "@/components/ui-kit/StatCard";
import { ChartCard, SaModal, SaSelect, FilterBar, Pagination } from "@/components/super-admin/ui";
import { MOCK_PLATFORM_SCHOOLS, SUBSCRIPTION_HEALTH, planBadgeClass, statusBadgeClass } from "@/lib/superAdminMockData";
import { formatRWF } from "@/lib/mockData";

export const Route = createFileRoute("/super-admin/subscriptions")({ component: SubsPage });

function SubsPage() {
  const [statusF, setStatusF] = useState("All");
  const [planF, setPlanF] = useState("All");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [actionSchool, setActionSchool] = useState<(typeof MOCK_PLATFORM_SCHOOLS)[0] | null>(null);
  const [extendOpen, setExtendOpen] = useState(false);

  const expiring7 = MOCK_PLATFORM_SCHOOLS.filter(s => s.renewal <= "2026-05-17" && s.status !== "expired").length;

  const rows = useMemo(() => {
    let r = [...MOCK_PLATFORM_SCHOOLS];
    if (statusF !== "All") r = r.filter(s => s.status === statusF.toLowerCase());
    if (planF !== "All") r = r.filter(s => s.plan === planF);
    return r;
  }, [statusF, planF]);

  const paginated = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <SuperAdminLayout
      title="Subscriptions"
      breadcrumbs={<SuperAdminBreadcrumbs items={[{ label: "Super Admin", to: "/super-admin" }, { label: "Subscriptions" }]} />}
    >
      {expiring7 > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>⚠️ {expiring7} subscriptions expire within 7 days</span>
          <div className="flex gap-2">
            <button type="button" className="text-xs font-semibold text-primary hover:underline">View All</button>
            <button type="button" onClick={() => toast.success("Renewal reminders queued")} className="rounded-lg bg-amber-600 text-white px-3 py-1 text-xs font-semibold">Send Renewal Reminders</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Active Subscriptions" value={MOCK_PLATFORM_SCHOOLS.filter(s => s.status === "active").length} tone="success" />
        <StatCard label="Expiring This Month" value={3} tone="warning" />
        <StatCard label="Trial Schools" value={MOCK_PLATFORM_SCHOOLS.filter(s => s.status === "trial").length} />
        <StatCard label="Churned This Month" value={1} tone="destructive" />
      </div>

      <ChartCard title="Subscription Health (6 months)" className="mb-5">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={SUBSCRIPTION_HEALTH}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="active" stackId="a" fill="#3b5998" />
            <Bar dataKey="trial" stackId="a" fill="#22c55e" />
            <Bar dataKey="grace" stackId="a" fill="#f59e0b" />
            <Bar dataKey="expired" stackId="a" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <FilterBar>
        <select value={statusF} onChange={e => setStatusF(e.target.value)} className="h-10 min-w-[120px] rounded-lg border border-border px-3 text-sm">
          <option>All</option><option>active</option><option>trial</option><option>grace</option><option>expired</option>
        </select>
        <select value={planF} onChange={e => setPlanF(e.target.value)} className="h-10 min-w-[140px] rounded-lg border border-border px-3 text-sm">
          <option>All</option><option>Starter</option><option>Professional</option><option>Enterprise</option>
        </select>
      </FilterBar>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>{["School", "Plan", "Cycle", "MRR", "Start", "Next Renewal", "Status", "Auto-Renew", ""].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {paginated.map(s => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${planBadgeClass(s.plan)}`}>{s.plan}</span></td>
                <td className="px-4 py-3 text-xs">Monthly</td>
                <td className="px-4 py-3 font-mono text-xs">{formatRWF(s.mrrRwf)}</td>
                <td className="px-4 py-3 text-xs">2025-01-01</td>
                <td className="px-4 py-3 text-xs">{s.renewal}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${statusBadgeClass(s.status)}`}>{s.status}</span></td>
                <td className="px-4 py-3"><input type="checkbox" defaultChecked={s.status === "active"} /></td>
                <td className="px-4 py-3">
                  <button type="button" onClick={() => setActionSchool(s)} className="text-xs font-semibold text-primary hover:underline">Actions</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination total={rows.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={n => { setPageSize(n); setPage(1); }} />
      </div>

      <SaModal open={!!actionSchool} onClose={() => setActionSchool(null)} title="Subscription Actions" subtitle={actionSchool?.name}>
        <div className="space-y-2">
          {["View Details", "Edit Plan", "Apply Discount", "Extend Renewal", "Suspend", "Cancel"].map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => { if (opt === "Extend Renewal") setExtendOpen(true); else toast.info(opt); setActionSchool(null); }}
              className="w-full text-left rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted/40"
            >
              {opt}
            </button>
          ))}
        </div>
      </SaModal>

      <SaModal
        open={extendOpen}
        onClose={() => setExtendOpen(false)}
        title="Extend Renewal"
        footer={<button type="button" onClick={() => { toast.success("Renewal extended"); setExtendOpen(false); }} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold w-full">Confirm</button>}
      >
        <div className="space-y-3">
          <p className="text-sm">Current renewal: <strong>2026-06-01</strong></p>
          <SaSelect label="Extend by"><option>7 days</option><option>14 days</option><option>30 days</option><option>Custom</option></SaSelect>
          <div><label className="text-xs font-semibold">Reason *</label><textarea rows={3} className="w-full mt-1 rounded-lg border border-border p-3 text-sm" /></div>
          <div><label className="text-xs font-semibold">Internal notes</label><textarea rows={2} className="w-full mt-1 rounded-lg border border-border p-3 text-sm" /></div>
        </div>
      </SaModal>
    </SuperAdminLayout>
  );
}
