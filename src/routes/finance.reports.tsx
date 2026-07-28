import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { FileText, Download, Users, Wallet, Receipt, Boxes } from "lucide-react";
import { toast } from "sonner";
import { FinanceLayout } from "@/components/layout/FinanceLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatRWF, toNum,
  getFinanceSummary, getCollectionsReport, getDefaultersReport,
  getExpensesByCategory, getPayrollSummary, getInventoryValuation,
  type FinanceSummary, type CollectionsReport, type Defaulter,
  type ExpenseByCategory, type PayrollSummaryRow, type InventoryValuation,
} from "@/lib/financeApi";

export const Route = createFileRoute("/finance/reports")({ component: ReportsPage });

const shortMonth = (iso: string) => {
  const [year, month] = iso.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString("en", { month: "short" });
};

/** Reports export client-side — the JSON endpoints are the only data source. */
function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (cell: string | number) => {
    const value = String(cell ?? "");
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  };
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function ReportSection({
  title,
  icon,
  csv,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  csv?: { headers: string[]; rows: (string | number)[][] };
  children: React.ReactNode;
}) {
  const exportCsv = () => {
    if (!csv || csv.rows.length === 0) {
      toast.error("Nothing to export yet");
      return;
    }
    downloadCsv(`${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`, csv.headers, csv.rows);
    toast.success(`${title} exported to CSV`);
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2 font-display font-bold">{icon}{title}</div>
        <div className="flex gap-1">
          <button onClick={exportCsv} className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold hover:bg-muted">CSV</button>
          <button onClick={() => window.print()} className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold hover:bg-muted">Print</button>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function ReportsPage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [collections, setCollections] = useState<CollectionsReport | null>(null);
  const [defaulters, setDefaulters] = useState<Defaulter[]>([]);
  const [expenseCats, setExpenseCats] = useState<ExpenseByCategory[]>([]);
  const [payroll, setPayroll] = useState<PayrollSummaryRow[]>([]);
  const [inventory, setInventory] = useState<InventoryValuation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [summaryData, collectionsData, defaultersData, expenseData, payrollData, inventoryData] =
          await Promise.all([
            getFinanceSummary(),
            getCollectionsReport(),
            getDefaultersReport({ limit: 20 }),
            getExpensesByCategory(),
            getPayrollSummary(),
            getInventoryValuation(),
          ]);
        if (cancelled) return;
        setSummary(summaryData);
        setCollections(collectionsData);
        setDefaulters(defaultersData);
        setExpenseCats(expenseData);
        setPayroll(payrollData);
        setInventory(inventoryData);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Failed to load reports");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <FinanceLayout title="Financial Reporting" subtitle="Real-time collection, payroll, expense & inventory reports">
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">{error}</div>
      </FinanceLayout>
    );
  }

  if (loading) {
    return (
      <FinanceLayout title="Financial Reporting" subtitle="Real-time collection, payroll, expense & inventory reports">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <div className="space-y-5">
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
        </div>
      </FinanceLayout>
    );
  }

  const monthlyChart = (collections?.monthly ?? []).map((m) => ({
    month: shortMonth(m.month),
    collected: toNum(m.collected),
    expected: toNum(m.expected),
  }));
  const expenseChart = expenseCats.map((c) => ({ name: c.category, amount: toNum(c.amount) }));
  const payrollChart = payroll.map((p) => ({ dept: p.department, net: toNum(p.net) }));

  return (
    <FinanceLayout title="Financial Reporting" subtitle="Real-time collection, payroll, expense & inventory reports">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard compact label="Collection Rate" value={`${summary?.collection_rate ?? 0}%`} tone="success" icon={<Wallet className="h-4 w-4" />} />
        <StatCard compact label="Defaulters" value={summary?.defaulters ?? 0} tone="destructive" icon={<Users className="h-4 w-4" />} />
        <StatCard compact label="Payroll (Net)" value={formatRWF(summary?.payroll_net)} icon={<Users className="h-4 w-4" />} />
        <StatCard compact label="Inventory Value" value={formatRWF(summary?.inventory_value)} icon={<Boxes className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-1 gap-5">
        <ReportSection
          title="Collection Report (Monthly)"
          icon={<Wallet className="h-4 w-4 text-primary" />}
          csv={{
            headers: ["Month", "Expected", "Collected"],
            rows: (collections?.monthly ?? []).map((m) => [m.month, m.expected, m.collected]),
          }}
        >
          {monthlyChart.length === 0 ? (
            <Empty label="No collection data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyChart}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis width={44} tickFormatter={(v) => `${v / 1000000}M`} />
                <Tooltip formatter={(v: number) => formatRWF(v)} /><Legend />
                <Bar dataKey="expected" fill="#cbd5e1" name="Expected" /><Bar dataKey="collected" fill="#3b5998" name="Collected" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ReportSection>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ReportSection
            title="Student Defaulters"
            icon={<Users className="h-4 w-4 text-destructive" />}
            csv={{
              headers: ["Student", "Student Number", "Fee", "Amount Due", "Amount Paid", "Balance", "Status"],
              rows: defaulters.map((d) => [d.student_name, d.student_number, d.fee, d.amount_due, d.amount_paid, d.balance, d.status]),
            }}
          >
            {defaulters.length === 0 ? (
              <Empty label="No outstanding balances" />
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground"><tr><th className="text-left py-2">Student</th><th className="text-left py-2">Fee</th><th className="text-right py-2">Balance</th></tr></thead>
                <tbody>
                  {defaulters.map((d, i) => (
                    <tr key={`${d.student_number}-${i}`} className="border-t border-border">
                      <td className="py-2 font-medium">{d.student_name}<div className="text-[11px] text-muted-foreground">{d.student_number}</div></td>
                      <td className="py-2 text-xs">{d.fee}</td>
                      <td className="py-2 text-right font-mono text-destructive">{formatRWF(d.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ReportSection>

          <ReportSection
            title="Category-wise Expenses"
            icon={<Receipt className="h-4 w-4 text-amber-600" />}
            csv={{
              headers: ["Category", "Amount", "Count"],
              rows: expenseCats.map((c) => [c.category, c.amount, c.count]),
            }}
          >
            {expenseChart.length === 0 ? (
              <Empty label="No expenses recorded yet" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={expenseChart} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tickFormatter={(v) => `${v / 1000}k`} /><YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatRWF(v)} />
                  <Bar dataKey="amount" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ReportSection>
        </div>

        <ReportSection
          title="Payroll Summary (by Department)"
          icon={<FileText className="h-4 w-4 text-primary" />}
          csv={{
            headers: ["Department", "Employees", "Gross", "Deductions", "Net"],
            rows: payroll.map((p) => [p.department, p.employees, p.gross, p.deductions, p.net]),
          }}
        >
          {payrollChart.length === 0 ? (
            <Empty label="No payroll data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={payrollChart}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="dept" tick={{ fontSize: 11 }} /><YAxis width={44} tickFormatter={(v) => `${v / 1000000}M`} />
                <Tooltip formatter={(v: number) => formatRWF(v)} />
                <Line dataKey="net" stroke="#3b5998" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ReportSection>

        <ReportSection
          title="Inventory Valuation"
          icon={<Boxes className="h-4 w-4 text-primary" />}
          csv={{
            headers: ["Code", "Item", "Supplier", "Quantity", "Unit Cost", "Total Value"],
            rows: (inventory?.items ?? []).map((it) => [it.code, it.item_name, it.supplier_name ?? "", it.quantity, it.unit_cost, it.total_value]),
          }}
        >
          {!inventory?.items.length ? (
            <Empty label="No inventory items yet" />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground"><tr><th className="text-left py-2">Item</th><th className="text-right py-2">Qty</th><th className="text-right py-2">Unit</th><th className="text-right py-2">Value</th></tr></thead>
              <tbody>
                {inventory.items.map((it) => (
                  <tr key={it.id} className="border-t border-border">
                    <td className="py-2 font-medium">{it.item_name}<div className="text-[11px] text-muted-foreground">{it.code}</div></td>
                    <td className="py-2 text-right">{it.quantity}</td>
                    <td className="py-2 text-right font-mono text-xs">{formatRWF(it.unit_cost)}</td>
                    <td className="py-2 text-right font-mono text-xs font-semibold">{formatRWF(it.total_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ReportSection>
      </div>

      <div className="mt-5 flex items-center gap-2 text-sm">
        <Download className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">Every report can be exported to CSV or printed.</span>
      </div>
    </FinanceLayout>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="grid h-[200px] place-items-center text-sm text-muted-foreground">{label}</div>;
}
