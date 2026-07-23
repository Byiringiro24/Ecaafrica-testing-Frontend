import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, X, Printer, CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";
import { FinanceLayout, StatusPill } from "@/components/layout/FinanceLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Modal, TextField, PrimaryButton, GhostButton } from "@/components/finance/ui";
import {
  PAYSLIPS, PAYROLL_RUNS, PAYROLL_MONTH, formatRWF, schoolInvoiceName, FINANCE_ME,
  type Payslip, type PayrollStatus,
} from "@/lib/financeData";

export const Route = createFileRoute("/finance/payroll")({ component: PayrollPage });

const STATUS_TONE: Record<PayrollStatus, "success" | "warning" | "muted" | "primary"> = {
  Paid: "success", Approved: "primary", Submitted: "warning", Draft: "muted",
};

function PayrollPage() {
  const [slips, setSlips] = useState<Payslip[]>(PAYSLIPS);
  const [q, setQ] = useState("");
  const [viewing, setViewing] = useState<Payslip | null>(null);
  const [adding, setAdding] = useState(false);

  const rows = useMemo(
    () => slips.filter((p) => q === "" || p.name.toLowerCase().includes(q.toLowerCase()) || p.role.toLowerCase().includes(q.toLowerCase())),
    [slips, q],
  );

  const gross = slips.reduce((s, p) => s + p.gross, 0);
  const deductions = slips.reduce((s, p) => s + p.deductions, 0);
  const net = gross - deductions;

  const addSlip = (p: Payslip) => {
    setSlips((prev) => [p, ...prev]);
    setAdding(false);
    toast.success(`Payslip added for ${p.name} (net ${formatRWF(p.net)})`);
  };

  return (
    <FinanceLayout title="Salary Management" subtitle={`Payroll for ${PAYROLL_MONTH}`}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard compact label="Employees" value={slips.length} />
        <StatCard compact label="Gross Payroll" value={formatRWF(gross)} />
        <StatCard compact label="Total Deductions" value={formatRWF(deductions)} tone="warning" />
        <StatCard compact label="Net Payable" value={formatRWF(net)} tone="success" />
      </div>

      {/* Payroll runs history */}
      <div className="rounded-xl border border-border bg-card overflow-hidden mb-5">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div className="font-display font-bold">Payroll Runs</div>
          <button onClick={() => toast.success(`${PAYROLL_MONTH} payroll submitted for approval`)} className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:bg-primary/90">Generate {PAYROLL_MONTH}</button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{["Month", "Employees", "Gross", "Deductions", "Net", "Status", "Approved By"].map((h) => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
          <tbody>
            {PAYROLL_RUNS.map((r) => (
              <tr key={r.month} className="border-t border-border odd:bg-background even:bg-muted/20">
                <td className="px-4 py-3 font-medium">{r.month}</td>
                <td className="px-4 py-3">{r.employees}</td>
                <td className="px-4 py-3 font-mono text-xs">{formatRWF(r.gross)}</td>
                <td className="px-4 py-3 font-mono text-xs">{formatRWF(r.deductions)}</td>
                <td className="px-4 py-3 font-mono text-xs font-semibold text-success">{formatRWF(r.net)}</td>
                <td className="px-4 py-3">
                  <StatusPill label={r.status} tone={STATUS_TONE[r.status]} />
                  {r.status === "Submitted" && (
                    <button onClick={() => toast.success(`${r.month} payroll approved`)} className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><CheckCircle2 className="h-3.5 w-3.5" /> Approve</button>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.approvedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Employee payslips */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search employee or role..." className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" />
        </div>
        <button onClick={() => toast.success("Salary register exported")} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">Export Register</button>
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add Payslip
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{["Employee", "Role", "Basic", "Allowances", "Deductions", "Net", "Status", ""].map((h) => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/30">
                  <td className="px-4 py-3 font-medium">{p.name}<div className="text-[11px] text-muted-foreground">{p.employeeId}</div></td>
                  <td className="px-4 py-3">{p.role}</td>
                  <td className="px-4 py-3 font-mono text-xs">{formatRWF(p.basic)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{formatRWF(p.allowances + p.overtime + p.bonus)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-destructive">{formatRWF(p.deductions)}</td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-success">{formatRWF(p.net)}</td>
                  <td className="px-4 py-3"><StatusPill label={p.status} tone={STATUS_TONE[p.status]} /></td>
                  <td className="px-4 py-3"><button onClick={() => setViewing(p)} className="text-xs font-semibold text-primary hover:underline">Payslip</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewing && <PayslipModal p={viewing} onClose={() => setViewing(null)} />}
      {adding && <AddPayslipModal nextIndex={slips.length} onClose={() => setAdding(false)} onAdd={addSlip} />}
    </FinanceLayout>
  );
}

function AddPayslipModal({ nextIndex, onClose, onAdd }: { nextIndex: number; onClose: () => void; onAdd: (p: Payslip) => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [basic, setBasic] = useState("");
  const [allowances, setAllowances] = useState("");
  const [overtime, setOvertime] = useState("");
  const [bonus, setBonus] = useState("");
  const [loanRecovery, setLoanRecovery] = useState("");

  const n = (v: string) => parseInt(v.replace(/\D/g, "")) || 0;
  const gross = n(basic) + n(allowances) + n(overtime) + n(bonus);
  const tax = Math.round(gross * 0.15);
  const pension = Math.round(n(basic) * 0.05);
  const deductions = tax + pension + n(loanRecovery);
  const net = gross - deductions;

  const submit = () => {
    if (!name.trim()) { toast.error("Enter employee name"); return; }
    if (n(basic) <= 0) { toast.error("Enter a valid basic salary"); return; }
    onAdd({
      id: `PS-2026-06-${String(nextIndex + 1).padStart(3, "0")}`,
      employeeId: `STF-NEW-${nextIndex + 1}`,
      name: name.trim(),
      role: role.trim() || "Staff",
      department: department.trim() || "General",
      month: PAYROLL_MONTH,
      basic: n(basic), allowances: n(allowances), overtime: n(overtime), bonus: n(bonus),
      tax, pension, loanRecovery: n(loanRecovery),
      gross, deductions, net,
      status: "Draft",
    });
  };

  return (
    <Modal title="Add Payslip" subtitle={`Salary entry for ${PAYROLL_MONTH}`} onClose={onClose} wide
      footer={<><GhostButton onClick={onClose}>Cancel</GhostButton><PrimaryButton onClick={submit}>Add Payslip (net {formatRWF(net)})</PrimaryButton></>}>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Employee Name" value={name} onChange={setName} placeholder="Full name" required />
        <TextField label="Role" value={role} onChange={setRole} placeholder="e.g. Teacher" />
        <TextField label="Department" value={department} onChange={setDepartment} placeholder="e.g. Teaching" />
        <TextField label="Basic Salary (RWF)" value={basic} onChange={setBasic} placeholder="350000" required />
        <TextField label="Allowances (RWF)" value={allowances} onChange={setAllowances} placeholder="63000" />
        <TextField label="Overtime (RWF)" value={overtime} onChange={setOvertime} placeholder="0" />
        <TextField label="Bonus (RWF)" value={bonus} onChange={setBonus} placeholder="0" />
        <TextField label="Loan Recovery (RWF)" value={loanRecovery} onChange={setLoanRecovery} placeholder="0" />
      </div>
      <div className="rounded-lg bg-muted/40 p-3 text-sm grid grid-cols-3 gap-2">
        <div><div className="text-[11px] text-muted-foreground">Gross</div><div className="font-mono font-semibold">{formatRWF(gross)}</div></div>
        <div><div className="text-[11px] text-muted-foreground">Deductions</div><div className="font-mono font-semibold text-destructive">{formatRWF(deductions)}</div></div>
        <div><div className="text-[11px] text-muted-foreground">Net Pay</div><div className="font-mono font-semibold text-success">{formatRWF(net)}</div></div>
      </div>
      <p className="text-[11px] text-muted-foreground">Tax (PAYE 15%) and pension (RSSB 5% of basic) are auto-calculated.</p>
    </Modal>
  );
}

function PayslipModal({ p, onClose }: { p: Payslip; onClose: () => void }) {
  const Row = ({ label, value, tone }: { label: string; value: number; tone?: "add" | "sub" }) => (
    <div className="flex justify-between text-sm py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${tone === "sub" ? "text-destructive" : ""}`}>{tone === "sub" ? "− " : ""}{formatRWF(value)}</span>
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-border bg-primary text-primary-foreground rounded-t-2xl">
          <div className="text-xs uppercase tracking-wider">Payslip</div>
          <div className="font-display font-bold text-lg mt-1">{schoolInvoiceName}</div>
          <div className="text-xs opacity-90 mt-1">{p.month} · {p.id}</div>
        </div>
        <div className="px-6 py-5">
          <div className="rounded-lg bg-muted/40 p-3 mb-4">
            <div className="font-semibold">{p.name}</div>
            <div className="text-xs text-muted-foreground">{p.role} · {p.department} · {p.employeeId}</div>
          </div>
          <div className="text-xs font-bold uppercase text-muted-foreground mb-1">Earnings</div>
          <Row label="Basic Salary" value={p.basic} />
          <Row label="Allowances" value={p.allowances} />
          <Row label="Overtime" value={p.overtime} />
          <Row label="Bonus" value={p.bonus} />
          <div className="flex justify-between text-sm font-semibold border-t border-border pt-1 mt-1"><span>Gross</span><span className="font-mono">{formatRWF(p.gross)}</span></div>

          <div className="text-xs font-bold uppercase text-muted-foreground mb-1 mt-4">Deductions</div>
          <Row label="Tax (PAYE)" value={p.tax} tone="sub" />
          <Row label="Pension (RSSB)" value={p.pension} tone="sub" />
          <Row label="Loan Recovery" value={p.loanRecovery} tone="sub" />
          <div className="flex justify-between text-sm font-semibold border-t border-border pt-1 mt-1"><span>Total Deductions</span><span className="font-mono text-destructive">− {formatRWF(p.deductions)}</span></div>

          <div className="flex justify-between items-center border-t-2 border-border pt-3 mt-3">
            <span className="font-bold">Net Pay</span>
            <span className="font-display text-2xl font-bold text-success">{formatRWF(p.net)}</span>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"><Printer className="h-4 w-4" /> Print</button>
          <button onClick={() => toast.success("Payslip PDF downloaded")} className="rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold hover:opacity-90">Download PDF</button>
        </div>
      </div>
    </div>
  );
}
