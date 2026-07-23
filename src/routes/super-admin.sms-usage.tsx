import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Clock3, MessageSquareText, Search, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { SuperAdminBreadcrumbs } from "@/components/layout/SuperAdminBreadcrumbs";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/super-admin/sms-usage")({
  component: SmsUsagePage
});

type Spend = { currency: string; amount: number };
type SchoolUsage = {
  school_id: string;
  school_name: string;
  country: string | null;
  total: number;
  sent: number;
  failed: number;
  pending: number;
  currency: string;
  total_spend: number;
};
type SmsUsageResponse = {
  period: { from: string; to: string };
  summary: {
    total: number;
    sent: number;
    failed: number;
    pending: number;
    spend_by_currency: Spend[];
  };
  schools: SchoolUsage[];
};

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);
const monthStart = () => {
  const now = new Date();
  return formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
};
const money = (amount: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
const number = (value: number) => new Intl.NumberFormat().format(value);

function SmsUsagePage() {
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(() => formatDateInput(new Date()));
  const [search, setSearch] = useState("");
  const [data, setData] = useState<SmsUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ from, to });
        setData(await apiRequest<SmsUsageResponse>(`/platform/sms-usage?${params.toString()}`, { auth: "platform" }));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load SMS usage");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [from, to]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data?.schools ?? [];
    return (data?.schools ?? []).filter((row) =>
      `${row.school_name} ${row.country ?? ""}`.toLowerCase().includes(query)
    );
  }, [data?.schools, search]);

  const spendLabel = data?.summary.spend_by_currency.length
    ? data.summary.spend_by_currency.map((item) => money(item.amount, item.currency)).join(" · ")
    : money(0, "RWF");

  return (
    <SuperAdminLayout
      title="SMS Usage & Spend"
      subtitle="Monitor delivery volume and provider charges by school"
      breadcrumbs={<SuperAdminBreadcrumbs items={[{ label: "Super Admin", to: "/super-admin" }, { label: "SMS Usage & Spend" }]} />}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-background p-4 shadow-sm">
          <label className="text-xs font-semibold text-muted-foreground">
            From
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 block h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground" />
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            To
            <input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} className="mt-1 block h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground" />
          </label>
          <label className="relative min-w-[240px] flex-1 text-xs font-semibold text-muted-foreground">
            Find a school
            <Search className="absolute bottom-3 left-3 h-4 w-4" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="School name or country" className="mt-1 h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground" />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric icon={MessageSquareText} label="Total SMS" value={number(data?.summary.total ?? 0)} />
          <Metric icon={CheckCircle2} label="Sent / delivered" value={number(data?.summary.sent ?? 0)} tone="text-emerald-600" />
          <Metric icon={AlertCircle} label="Failed" value={number(data?.summary.failed ?? 0)} tone="text-red-600" />
          <Metric icon={Clock3} label="Pending" value={number(data?.summary.pending ?? 0)} tone="text-amber-600" />
          <Metric icon={WalletCards} label="SMS spend" value={spendLabel} tone="text-primary" />
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold">Spend by school</h2>
            <p className="mt-1 text-xs text-muted-foreground">Spend includes sent and delivered SMS only, using the provider rate captured when each message was queued.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-5 py-3">School</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Sent</th><th className="px-4 py-3">Failed</th><th className="px-4 py-3">Pending</th><th className="px-5 py-3 text-right">Spend</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">Loading SMS usage…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">No SMS usage found for this period.</td></tr>
                ) : rows.map((row) => (
                  <tr key={`${row.school_id}-${row.currency}`} className="hover:bg-muted/40">
                    <td className="px-5 py-4"><div className="font-semibold">{row.school_name}</div><div className="text-xs text-muted-foreground">{row.country ?? "Country not set"}</div></td>
                    <td className="px-4 py-4 font-medium">{number(row.total)}</td>
                    <td className="px-4 py-4 text-emerald-600">{number(row.sent)}</td>
                    <td className="px-4 py-4 text-red-600">{number(row.failed)}</td>
                    <td className="px-4 py-4 text-amber-600">{number(row.pending)}</td>
                    <td className="px-5 py-4 text-right font-semibold">{money(row.total_spend, row.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
}

function Metric({ icon: Icon, label, value, tone = "text-foreground" }: { icon: typeof MessageSquareText; label: string; value: string; tone?: string }) {
  return <div className="rounded-xl border border-border bg-background p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span><Icon className={`h-4 w-4 ${tone}`} /></div><div className={`mt-3 text-2xl font-bold ${tone}`}>{value}</div></div>;
}
