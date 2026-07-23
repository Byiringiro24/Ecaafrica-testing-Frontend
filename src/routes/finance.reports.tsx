import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { FileText, Download, Users, Wallet, Receipt, Boxes } from "lucide-react";
import { toast } from "sonner";
import { FinanceLayout, ChartCard } from "@/components/layout/FinanceLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import {
  financeSummary, formatRWF, MONTHLY_COLLECTIONS, STUDENT_FEES, STUDENTS,
  PAYSLIPS, EXPENSES, EXPENSE_CATEGORIES, INVENTORY_ITEMS,
} from "@/lib/financeData";

export const Route = createFileRoute("/finance/reports")({ component: ReportsPage });

const EXPORTS = ["PDF", "Excel", "CSV", "Print"];

function ReportSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2 font-display font-bold">{icon}{title}</div>
        <div className="flex gap-1">
          {EXPORTS.map((e) => (
            <button key={e} onClick={() => e === "Print" ? window.print() : toast.success(`${title} exported to ${e}`)} className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold hover:bg-muted">{e}</button>
          ))}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function ReportsPage() {
  const s = financeSummary();

  const defaulters = STUDENT_FEES.filter((f) => f.status === "Overdue" || f.status === "Unpaid")
    .map((f) => ({ f, student: STUDENTS.find((x) => x.id === f.studentId)! })).slice(0, 8);

  const expenseByCat = EXPENSE_CATEGORIES.map((c) => ({
    name: c, amount: EXPENSES.filter((e) => e.category === c).reduce((a, e) => a + e.amount, 0),
  })).filter((e) => e.amount > 0);

  return (
    <FinanceLayout title="Financial Reporting" subtitle="Real-time collection, payroll, expense & inventory reports">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard compact label="Collection Rate" value={`${s.collectionRate}%`} tone="success" icon={<Wallet className="h-4 w-4" />} />
        <StatCard compact label="Defaulters" value={s.defaulters} tone="destructive" icon={<Users className="h-4 w-4" />} />
        <StatCard compact label="Payroll (Net)" value={formatRWF(s.payrollNet)} icon={<Users className="h-4 w-4" />} />
        <StatCard compact label="Inventory Value" value={formatRWF(s.inventoryValue)} icon={<Boxes className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-1 gap-5">
        {/* Collections report */}
        <ReportSection title="Collection Report (Monthly)" icon={<Wallet className="h-4 w-4 text-primary" />}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={MONTHLY_COLLECTIONS}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis width={44} tickFormatter={(v) => `${v / 1000000}M`} />
              <Tooltip formatter={(v: number) => formatRWF(v)} /><Legend />
              <Bar dataKey="expected" fill="#cbd5e1" name="Expected" /><Bar dataKey="collected" fill="#3b5998" name="Collected" />
            </BarChart>
          </ResponsiveContainer>
        </ReportSection>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Defaulters (student report) */}
          <ReportSection title="Student Defaulters" icon={<Users className="h-4 w-4 text-destructive" />}>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground"><tr><th className="text-left py-2">Student</th><th className="text-left py-2">Class</th><th className="text-right py-2">Balance</th></tr></thead>
              <tbody>
                {defaulters.map(({ f, student }) => (
                  <tr key={f.studentId} className="border-t border-border">
                    <td className="py-2 font-medium">{student.name}</td>
                    <td className="py-2">{student.class}</td>
                    <td className="py-2 text-right font-mono text-destructive">{formatRWF(f.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ReportSection>

          {/* Expense report */}
          <ReportSection title="Category-wise Expenses" icon={<Receipt className="h-4 w-4 text-amber-600" />}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={expenseByCat} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tickFormatter={(v) => `${v / 1000}k`} /><YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatRWF(v)} />
                <Bar dataKey="amount" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </ReportSection>
        </div>

        {/* Payroll summary */}
        <ReportSection title="Payroll Summary (by Department)" icon={<FileText className="h-4 w-4 text-primary" />}>
          <PayrollByDept />
        </ReportSection>

        {/* Inventory report */}
        <ReportSection title="Inventory Valuation" icon={<Boxes className="h-4 w-4 text-primary" />}>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground"><tr><th className="text-left py-2">Item</th><th className="text-right py-2">Qty</th><th className="text-right py-2">Unit</th><th className="text-right py-2">Value</th></tr></thead>
            <tbody>
              {INVENTORY_ITEMS.map((it) => (
                <tr key={it.id} className="border-t border-border">
                  <td className="py-2 font-medium">{it.item}</td>
                  <td className="py-2 text-right">{it.quantity}</td>
                  <td className="py-2 text-right font-mono text-xs">{formatRWF(it.unitCost)}</td>
                  <td className="py-2 text-right font-mono text-xs font-semibold">{formatRWF(it.quantity * it.unitCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportSection>
      </div>

      <div className="mt-5 flex items-center gap-2 text-sm">
        <Download className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">Export options available on every report: PDF · Excel · CSV · Print</span>
      </div>
    </FinanceLayout>
  );
}

function PayrollByDept() {
  const depts = Array.from(new Set(PAYSLIPS.map((p) => p.department)));
  const data = depts.map((d) => ({
    dept: d,
    net: PAYSLIPS.filter((p) => p.department === d).reduce((s, p) => s + p.net, 0),
  }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="dept" tick={{ fontSize: 11 }} /><YAxis width={44} tickFormatter={(v) => `${v / 1000000}M`} />
        <Tooltip formatter={(v: number) => formatRWF(v)} />
        <Line dataKey="net" stroke="#3b5998" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
