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
import {
  financeSummary, formatRWF, DAILY_COLLECTIONS, MONTHLY_COLLECTIONS,
  TRANSACTIONS, EXPENSE_CATEGORIES, EXPENSES, FINANCE_ME,
} from "@/lib/financeData";

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

function FinanceDashboard() {
  const s = financeSummary();
  const methods = ["Cash", "MTN MoMo", "Airtel Money", "Bank Transfer", "Cheque"].map((m) => ({
    name: m,
    value: TRANSACTIONS.filter((t) => t.method === m).reduce((a, t) => a + t.amount, 0),
  }));
  const expenseByCat = EXPENSE_CATEGORIES.map((c) => ({
    name: c,
    value: EXPENSES.filter((e) => e.category === c).reduce((a, e) => a + e.amount, 0),
  })).filter((e) => e.value > 0);

  return (
    <FinanceLayout
      title={`Welcome, ${FINANCE_ME.name.split(" ")[0]}`}
      subtitle="Finance Department — full financial control centre"
    >
      {/* Primary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        <StatCard compact label="Total Expected" value={formatRWF(s.expected)} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard compact label="Collected" value={formatRWF(s.collected)} tone="success" icon={<Wallet className="h-4 w-4" />} trend={`${s.collectionRate}% rate`} />
        <StatCard compact label="Outstanding" value={formatRWF(s.outstanding)} tone="warning" />
        <StatCard compact label="Overdue" value={formatRWF(s.overdue)} tone="destructive" icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard compact label="Payroll (Net)" value={formatRWF(s.payrollNet)} icon={<Users className="h-4 w-4" />} />
        <StatCard compact label="Inventory Value" value={formatRWF(s.inventoryValue)} icon={<Boxes className="h-4 w-4" />} />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard compact label="Expenses Paid" value={formatRWF(s.expensesPaid)} />
        <StatCard compact label="Pending Expenses" value={formatRWF(s.expensesPending)} tone="warning" />
        <StatCard compact label="Supplier Payable" value={formatRWF(s.supplierPayable)} tone="destructive" />
        <StatCard compact label="Net Cash Position" value={formatRWF(s.netPosition)} tone={s.netPosition >= 0 ? "success" : "destructive"} />
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
        <ChartCard title="Daily Collections (This Month)">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={DAILY_COLLECTIONS}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis width={40} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip formatter={(v: number) => formatRWF(v)} />
              <Area dataKey="amount" stroke="#3b5998" fill="#3b5998" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Collected vs Expected (6 months)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={MONTHLY_COLLECTIONS}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis width={40} tickFormatter={(v) => `${v / 1000000}M`} />
              <Tooltip formatter={(v: number) => formatRWF(v)} />
              <Bar dataKey="expected" fill="#cbd5e1" /><Bar dataKey="collected" fill="#3b5998" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Payment Methods">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={methods} dataKey="value" nameKey="name" outerRadius={90} label={(e: any) => e.name}>
                {methods.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatRWF(v)} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Expenses by Category">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={expenseByCat} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tickFormatter={(v) => `${v / 1000}k`} /><YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatRWF(v)} />
              <Bar dataKey="value" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-5">
        <Link to="/finance/reports" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          View all financial reports <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </FinanceLayout>
  );
}
