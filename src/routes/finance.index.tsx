import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Wallet, TrendingUp, AlertTriangle, Users, Receipt, Boxes,
  ListTree, FileText, BarChart3, ArrowRight,
} from "lucide-react";
import { FinanceLayout, ChartCard } from "@/components/layout/FinanceLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  formatRWF, toNum, paymentMethodLabel,
  getFinanceSummary, getDailyCollections, getMonthlyCollections,
  getPaymentMethodTotals, getExpensesByCategory,
  type FinanceSummary, type DailyCollection, type MonthlyCollection,
  type PaymentMethodTotal, type ExpenseByCategory,
} from "@/lib/financeApi";

export const Route = createFileRoute("/finance/")({ component: FinanceDashboard });

const COLORS = ["#3b5998", "#545f72", "#f59e0b", "#ef4444", "#6366f1", "#10b981"];

const QUICK_LINKS = [
  { to: "/finance/fee-structure", label: "Fee Structure", icon: ListTree },
  { to: "/finance/invoices", label: "Invoices", icon: FileText },
  { to: "/finance/payments", label: "Payments", icon: Wallet },
  { to: "/finance/payroll", label: "Payroll", icon: Users },
  { to: "/finance/expenses", label: "Expenses", icon: Receipt },
  { to: "/finance/inventory", label: "Inventory", icon: Boxes },
  { to: "/finance/reports", label: "Reports", icon: BarChart3 },
] as const;

const shortDay = (iso: string) => iso.slice(8, 10);
const shortMonth = (iso: string) => {
  const [year, month] = iso.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString("en", { month: "short" });
};

function FinanceDashboard() {
  const currentUser = useCurrentUser();
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [daily, setDaily] = useState<DailyCollection[]>([]);
  const [monthly, setMonthly] = useState<MonthlyCollection[]>([]);
  const [methods, setMethods] = useState<PaymentMethodTotal[]>([]);
  const [expenseCats, setExpenseCats] = useState<ExpenseByCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [summaryData, dailyData, monthlyData, methodData, categoryData] = await Promise.all([
          getFinanceSummary(),
          getDailyCollections(),
          getMonthlyCollections({ months: 6 }),
          getPaymentMethodTotals(),
          getExpensesByCategory(),
        ]);
        if (cancelled) return;
        setSummary(summaryData);
        setDaily(dailyData);
        setMonthly(monthlyData);
        setMethods(methodData);
        setExpenseCats(categoryData);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Failed to load finance dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = currentUser?.name?.split(" ")[0] ?? "Finance Officer";

  const dailyChart = daily.map((d) => ({ day: shortDay(d.date), amount: toNum(d.amount) }));
  const monthlyChart = monthly.map((m) => ({
    month: shortMonth(m.month),
    collected: toNum(m.collected),
    expected: toNum(m.expected),
  }));
  const methodChart = methods
    .map((m) => ({ name: paymentMethodLabel(m.payment_method), value: toNum(m.amount) }))
    .filter((m) => m.value > 0);
  const expenseChart = expenseCats.map((c) => ({ name: c.category, value: toNum(c.amount) }));

  if (error) {
    return (
      <FinanceLayout title={`Welcome, ${firstName}`} subtitle="Finance Department — full financial control centre">
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
          {error}
        </div>
      </FinanceLayout>
    );
  }

  return (
    <FinanceLayout
      title={`Welcome, ${firstName}`}
      subtitle="Finance Department — full financial control centre"
    >
      {loading || !summary ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
          </div>
        </div>
      ) : (
        <>
          {/* Primary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <StatCard compact label="Outstanding" value={formatRWF(summary.outstanding)} tone="warning" />
            <StatCard compact label="Overdue" value={formatRWF(summary.overdue)} tone="destructive" icon={<AlertTriangle className="h-4 w-4" />} />
            <StatCard compact label="Payroll (Net)" value={formatRWF(summary.payroll_net)} icon={<Users className="h-4 w-4" />} />
            <StatCard compact label="Inventory Value" value={formatRWF(summary.inventory_value)} icon={<Boxes className="h-4 w-4" />} />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <StatCard compact label="Expenses Paid" value={formatRWF(summary.expenses_paid)} />
            <StatCard compact label="Pending Expenses" value={formatRWF(summary.expenses_pending)} tone="warning" />
            <StatCard compact label="Supplier Payable" value={formatRWF(summary.supplier_payable)} tone="destructive" />
            <StatCard compact label="Net Cash Position" value={formatRWF(summary.net_position)} tone={toNum(summary.net_position) >= 0 ? "success" : "destructive"} />
          </div>

          {/* Quick access to every module */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-5">
            {QUICK_LINKS.map((q) => {
              const Icon = q.icon;
              return (
                <Link key={q.to} to={q.to} className="group rounded-xl border border-border bg-card p-3 text-center hover:border-primary hover:shadow-sm transition-colors">
                  <div className="mx-auto grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="mt-1.5 text-[11px] font-semibold">{q.label}</div>
                </Link>
              );
            })}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <ChartCard title="Daily Collections (Last 30 days)">
              {dailyChart.length === 0 ? (
                <EmptyChart label="No collections recorded yet" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={dailyChart}>
                    <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis width={40} tickFormatter={(v) => `${v / 1000}k`} />
                    <Tooltip formatter={(v: number) => formatRWF(v)} />
                    <Area dataKey="amount" stroke="#3b5998" fill="#3b5998" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard title="Collected vs Expected (6 months)">
              {monthlyChart.length === 0 ? (
                <EmptyChart label="No monthly data yet" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthlyChart}>
                    <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis width={40} tickFormatter={(v) => `${v / 1000000}M`} />
                    <Tooltip formatter={(v: number) => formatRWF(v)} />
                    <Bar dataKey="expected" fill="#cbd5e1" /><Bar dataKey="collected" fill="#3b5998" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCard title="Payment Methods">
              {methodChart.length === 0 ? (
                <EmptyChart label="No payments recorded yet" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={methodChart} dataKey="value" nameKey="name" outerRadius={90} label={(e: any) => e.name}>
                      {methodChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatRWF(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard title="Expenses by Category">
              {expenseChart.length === 0 ? (
                <EmptyChart label="No expenses recorded yet" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={expenseChart} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tickFormatter={(v) => `${v / 1000}k`} /><YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => formatRWF(v)} />
                    <Bar dataKey="value" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          <div className="mt-5">
            <Link to="/finance/reports" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
              View all financial reports <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </>
      )}
    </FinanceLayout>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="grid h-[260px] place-items-center text-sm text-muted-foreground">{label}</div>
  );
}
