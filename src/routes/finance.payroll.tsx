import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Printer, CheckCircle2, Plus, Send, Wallet } from "lucide-react";
import { toast } from "sonner";
import { FinanceLayout, StatusPill } from "@/components/layout/FinanceLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal, TextField, SelectField, PrimaryButton, GhostButton } from "@/components/finance/ui";
import { apiRequest } from "@/lib/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  formatRWF, toNum, PAYMENT_METHODS,
  listPayrollRuns, createPayrollRun, submitPayrollRun, approvePayrollRun, markPayrollRunPaid,
  listPayslips, addPayslip, markPayslipPaid,
  type PayrollRun, type Payslip, type PayrollRunStatus, type PayslipListMeta,
} from "@/lib/financeApi";

export const Route = createFileRoute("/finance/payroll")({ component: PayrollPage });

const STATUS_TONE: Record<PayrollRunStatus, "success" | "warning" | "muted" | "primary"> = {
  paid: "success", approved: "primary", submitted: "warning", draft: "muted",
};

const STATUS_LABEL: Record<PayrollRunStatus, string> = {
  paid: "Paid", approved: "Approved", submitted: "Submitted", draft: "Draft",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const periodLabel = (run: Pick<PayrollRun, "month" | "year">) =>
  `${MONTH_NAMES[run.month - 1] ?? run.month} ${run.year}`;

const RUN_HEADERS = ["Period", "Employees", "Gross", "Deductions", "Net", "Status", "Action"];
const SLIP_HEADERS = ["Employee", "Role", "Basic", "Allowances", "Deductions", "Net", "Status", ""];

type StaffProfile = {
  id: string;
  staff_id_number?: string | null;
  department?: string | null;
  basic_salary?: string | null;
  user?: { name?: string | null; role?: string | null } | null;
};

function PayrollPage() {
  const currentUser = useCurrentUser();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [slips, setSlips] = useState<Payslip[]>([]);
  const [slipMeta, setSlipMeta] = useState<PayslipListMeta | null>(null);
  const [q, setQ] = useState("");
  const [viewing, setViewing] = useState<Payslip | null>(null);
  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [payingSlip, setPayingSlip] = useState<Payslip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    const res = await listPayrollRuns({ limit: 50 });
    setRuns(res.data);
    setSelectedRunId((prev) => prev ?? res.data[0]?.id ?? null);
    return res.data;
  }, []);

  const loadSlips = useCallback(async (runId: string | null, search: string) => {
    const res = await listPayslips({
      limit: 200,
      payroll_run_id: runId ?? undefined,
      q: search || undefined,
    });
    setSlips(res.data);
    setSlipMeta(res.meta);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const runList = await loadRuns();
      const runId = selectedRunId ?? runList[0]?.id ?? null;
      await loadSlips(runId, q);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load payroll");
    } finally {
      setLoading(false);
    }
    // selectedRunId/q intentionally read fresh on each call
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadRuns, loadSlips]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      loadSlips(selectedRunId, q).catch(() => undefined);
    }, q ? 300 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRunId, q]);

  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? null;

  const generateRun = async () => {
    const now = new Date();
    setGenerating(true);
    try {
      const created = await createPayrollRun({ month: now.getMonth() + 1, year: now.getFullYear() });
      toast.success(`${periodLabel(created)} payroll generated with ${created.payslip_count} payslip(s)`);
      setSelectedRunId(created.id);
      await reload();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to generate payroll run");
    } finally {
      setGenerating(false);
    }
  };

  const runAction = async (label: string, action: () => Promise<unknown>) => {
    try {
      await action();
      toast.success(label);
      await reload();
    } catch (err: any) {
      toast.error(err?.message ?? "Action failed");
    }
  };

  return (
    <FinanceLayout
      title="Salary Management"
      subtitle={selectedRun ? `Payroll for ${periodLabel(selectedRun)}` : "Payroll runs and payslips"}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard compact label="Employees" value={selectedRun?.employee_count ?? slips.length} />
        <StatCard compact label="Gross Payroll" value={formatRWF(slipMeta?.total_gross)} />
        <StatCard compact label="Total Deductions" value={formatRWF(slipMeta?.total_deductions)} tone="warning" />
        <StatCard compact label="Net Payable" value={formatRWF(slipMeta?.total_net)} tone="success" />
      </div>

      {/* Payroll runs history */}
      <div className="rounded-xl border border-border bg-card overflow-hidden mb-5">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div className="font-display font-bold">Payroll Runs</div>
          <button onClick={generateRun} disabled={generating} className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:bg-primary/90 disabled:opacity-60">
            {generating ? "Generating..." : "Generate Current Month"}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{RUN_HEADERS.map((h) => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }, (_, i) => (
                  <tr key={i} className="border-t border-border"><td colSpan={RUN_HEADERS.length} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
                ))
              ) : error ? (
                <tr><td colSpan={RUN_HEADERS.length} className="px-4 py-10 text-center text-sm text-destructive">{error}</td></tr>
              ) : runs.length === 0 ? (
                <tr><td colSpan={RUN_HEADERS.length} className="px-4 py-10 text-center text-sm text-muted-foreground">No payroll runs yet. Generate one to get started.</td></tr>
              ) : (
                runs.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedRunId(r.id)}
                    className={`border-t border-border cursor-pointer hover:bg-accent/30 ${r.id === selectedRunId ? "bg-accent/40" : "odd:bg-background even:bg-muted/20"}`}
                  >
                    <td className="px-4 py-3 font-medium">{periodLabel(r)}</td>
                    <td className="px-4 py-3">{r.employee_count}</td>
                    <td className="px-4 py-3 font-mono text-xs">{formatRWF(r.total_gross)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{formatRWF(r.total_deductions)}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-success">{formatRWF(r.total_net)}</td>
                    <td className="px-4 py-3"><StatusPill label={STATUS_LABEL[r.status]} tone={STATUS_TONE[r.status]} /></td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {r.status === "draft" && (
                        <button onClick={() => runAction(`${periodLabel(r)} submitted for approval`, () => submitPayrollRun(r.id))} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Send className="h-3.5 w-3.5" /> Submit</button>
                      )}
                      {r.status === "submitted" && (
                        <button onClick={() => runAction(`${periodLabel(r)} approved`, () => approvePayrollRun(r.id))} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><CheckCircle2 className="h-3.5 w-3.5" /> Approve</button>
                      )}
                      {r.status === "approved" && (
                        <button onClick={() => runAction(`${periodLabel(r)} marked paid`, () => markPayrollRunPaid(r.id))} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Wallet className="h-3.5 w-3.5" /> Mark Paid</button>
                      )}
                      {r.status === "paid" && <span className="text-xs text-muted-foreground">{r.approved_by_name ?? "--"}</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee payslips */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search employee, reference or department..." className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" />
        </div>
        <button
          onClick={() => setAdding(true)}
          disabled={!selectedRun || selectedRun.status !== "draft"}
          title={selectedRun?.status !== "draft" ? "Payslips can only be added to a draft run" : undefined}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add Payslip
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{SLIP_HEADERS.map((h) => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} className="border-t border-border"><td colSpan={SLIP_HEADERS.length} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
                ))
              ) : slips.length === 0 ? (
                <tr><td colSpan={SLIP_HEADERS.length} className="px-4 py-10 text-center text-sm text-muted-foreground">No payslips for this run yet.</td></tr>
              ) : (
                slips.map((p) => (
                  <tr key={p.id} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/30">
                    <td className="px-4 py-3 font-medium">{p.staff_name}<div className="text-[11px] text-muted-foreground">{p.staff_number}</div></td>
                    <td className="px-4 py-3 text-xs">{p.role ?? "--"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{formatRWF(p.basic_salary)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{formatRWF(toNum(p.allowances) + toNum(p.overtime) + toNum(p.bonus))}</td>
                    <td className="px-4 py-3 font-mono text-xs text-destructive">{formatRWF(p.total_deductions)}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-success">{formatRWF(p.net_salary)}</td>
                    <td className="px-4 py-3"><StatusPill label={STATUS_LABEL[p.status]} tone={STATUS_TONE[p.status]} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setViewing(p)} className="text-xs font-semibold text-primary hover:underline">Payslip</button>
                        {p.status === "approved" && (
                          <button onClick={() => setPayingSlip(p)} className="text-xs font-semibold text-primary hover:underline">Mark Paid</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewing && (
        <PayslipModal
          p={viewing}
          schoolName={currentUser?.school_name ?? "School"}
          period={selectedRun ? periodLabel(selectedRun) : ""}
          onClose={() => setViewing(null)}
        />
      )}
      {adding && selectedRun && (
        <AddPayslipModal
          run={selectedRun}
          existingStaffIds={slips.map((s) => s.staff_id)}
          onClose={() => setAdding(false)}
          onAdded={async () => { setAdding(false); await reload(); }}
        />
      )}
      {payingSlip && (
        <MarkSlipPaidModal
          slip={payingSlip}
          onClose={() => setPayingSlip(null)}
          onDone={async () => { setPayingSlip(null); await reload(); }}
        />
      )}
    </FinanceLayout>
  );
}

function AddPayslipModal({
  run,
  existingStaffIds,
  onClose,
  onAdded,
}: {
  run: PayrollRun;
  existingStaffIds: string[];
  onClose: () => void;
  onAdded: () => Promise<void>;
}) {
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [staffId, setStaffId] = useState("");
  const [basic, setBasic] = useState("");
  const [allowances, setAllowances] = useState("");
  const [overtime, setOvertime] = useState("");
  const [bonus, setBonus] = useState("");
  const [loanRecovery, setLoanRecovery] = useState("");
  const [otherDeductions, setOtherDeductions] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiRequest<StaffProfile[]>("/staff/profiles?limit=500", { auth: "school" })
      .then((profiles) => {
        const available = profiles.filter((p) => !existingStaffIds.includes(p.id));
        setStaff(available);
        const first = available[0];
        if (first) {
          setStaffId(first.id);
          setBasic(first.basic_salary ?? "");
        }
      })
      .catch(() => setStaff([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const n = (v: string) => Number(v.replace(/[^\d.]/g, "")) || 0;
  // Mirrors the server-owned formula so the preview matches what gets saved.
  const gross = n(basic) + n(allowances) + n(overtime) + n(bonus);
  const tax = Math.round(gross * 0.15);
  const pension = Math.round(n(basic) * 0.05);
  const deductions = tax + pension + n(loanRecovery) + n(otherDeductions);
  const net = gross - deductions;

  const selectStaff = (id: string) => {
    setStaffId(id);
    const profile = staff.find((s) => s.id === id);
    if (profile?.basic_salary) setBasic(profile.basic_salary);
  };

  const submit = async () => {
    if (!staffId) { toast.error("Select a staff member"); return; }
    if (n(basic) <= 0) { toast.error("Enter a valid basic salary"); return; }
    if (net < 0) { toast.error("Deductions exceed gross pay"); return; }

    setSubmitting(true);
    try {
      const created = await addPayslip(run.id, {
        staff_id: staffId,
        basic_salary: n(basic),
        allowances: n(allowances),
        overtime: n(overtime),
        bonus: n(bonus),
        loan_recovery: n(loanRecovery),
        other_deductions: n(otherDeductions),
      });
      toast.success(`Payslip added for ${created.staff_name} (net ${formatRWF(created.net_salary)})`);
      await onAdded();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to add payslip");
    } finally {
      setSubmitting(false);
    }
  };

  const staffLabel = (s: StaffProfile) =>
    `${s.user?.name ?? "Unnamed"}${s.staff_id_number ? ` · ${s.staff_id_number}` : ""}`;

  return (
    <Modal title="Add Payslip" subtitle={`Salary entry for ${periodLabel(run)}`} onClose={onClose} wide
      footer={<><GhostButton onClick={onClose}>Cancel</GhostButton><PrimaryButton onClick={submit}>{submitting ? "Adding..." : `Add Payslip (net ${formatRWF(net)})`}</PrimaryButton></>}>
      {staff.length === 0 ? (
        <p className="text-sm text-muted-foreground">Every staff member already has a payslip in this run.</p>
      ) : (
        <>
          <SelectField
            label="Staff Member"
            value={staffId}
            onChange={selectStaff}
            options={staff.map((s) => s.id)}
            optionLabels={staff.reduce((acc, s) => ({ ...acc, [s.id]: staffLabel(s) }), {} as Record<string, string>)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Basic Salary (RWF)" value={basic} onChange={setBasic} placeholder="350000" required />
            <TextField label="Allowances (RWF)" value={allowances} onChange={setAllowances} placeholder="0" />
            <TextField label="Overtime (RWF)" value={overtime} onChange={setOvertime} placeholder="0" />
            <TextField label="Bonus (RWF)" value={bonus} onChange={setBonus} placeholder="0" />
            <TextField label="Loan Recovery (RWF)" value={loanRecovery} onChange={setLoanRecovery} placeholder="0" />
            <TextField label="Other Deductions (RWF)" value={otherDeductions} onChange={setOtherDeductions} placeholder="0" />
          </div>
          <div className="rounded-lg bg-muted/40 p-3 text-sm grid grid-cols-3 gap-2">
            <div><div className="text-[11px] text-muted-foreground">Gross</div><div className="font-mono font-semibold">{formatRWF(gross)}</div></div>
            <div><div className="text-[11px] text-muted-foreground">Deductions</div><div className="font-mono font-semibold text-destructive">{formatRWF(deductions)}</div></div>
            <div><div className="text-[11px] text-muted-foreground">Net Pay</div><div className="font-mono font-semibold text-success">{formatRWF(net)}</div></div>
          </div>
          <p className="text-[11px] text-muted-foreground">Tax (PAYE 15%) and pension (RSSB 5% of basic) are calculated on the server.</p>
        </>
      )}
    </Modal>
  );
}

function MarkSlipPaidModal({
  slip,
  onClose,
  onDone,
}: {
  slip: Payslip;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0].value);
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await markPayslipPaid(slip.id, { payment_method: method, paid_at: paidAt });
      toast.success(`${slip.staff_name}'s payslip marked paid`);
      await onDone();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to mark payslip paid");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Pay ${slip.staff_name}`} subtitle={`Net ${formatRWF(slip.net_salary)} — ${slip.reference}`} onClose={onClose}
      footer={<><GhostButton onClick={onClose}>Cancel</GhostButton><PrimaryButton onClick={submit}>{submitting ? "Saving..." : "Confirm Payment"}</PrimaryButton></>}>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Payment Method"
          value={method}
          onChange={setMethod}
          options={PAYMENT_METHODS.map((m) => m.value)}
          optionLabels={PAYMENT_METHODS.reduce((acc, m) => ({ ...acc, [m.value]: m.label }), {} as Record<string, string>)}
          required
        />
        <TextField label="Paid On" value={paidAt} onChange={setPaidAt} type="date" required />
      </div>
    </Modal>
  );
}

function PayslipModal({
  p,
  schoolName,
  period,
  onClose,
}: {
  p: Payslip;
  schoolName: string;
  period: string;
  onClose: () => void;
}) {
  const Row = ({ label, value, tone }: { label: string; value: string | number; tone?: "sub" }) => (
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
          <div className="font-display font-bold text-lg mt-1">{schoolName}</div>
          <div className="text-xs opacity-90 mt-1">{period} · {p.reference}</div>
        </div>
        <div className="px-6 py-5">
          <div className="rounded-lg bg-muted/40 p-3 mb-4">
            <div className="font-semibold">{p.staff_name}</div>
            <div className="text-xs text-muted-foreground">{[p.role, p.department, p.staff_number].filter(Boolean).join(" · ")}</div>
          </div>
          <div className="text-xs font-bold uppercase text-muted-foreground mb-1">Earnings</div>
          <Row label="Basic Salary" value={p.basic_salary} />
          <Row label="Allowances" value={p.allowances} />
          <Row label="Overtime" value={p.overtime} />
          <Row label="Bonus" value={p.bonus} />
          <div className="flex justify-between text-sm font-semibold border-t border-border pt-1 mt-1"><span>Gross</span><span className="font-mono">{formatRWF(p.gross_salary)}</span></div>

          <div className="text-xs font-bold uppercase text-muted-foreground mb-1 mt-4">Deductions</div>
          <Row label="Tax (PAYE)" value={p.tax} tone="sub" />
          <Row label="Pension (RSSB)" value={p.pension} tone="sub" />
          <Row label="Loan Recovery" value={p.loan_recovery} tone="sub" />
          <Row label="Other Deductions" value={p.other_deductions} tone="sub" />
          <div className="flex justify-between text-sm font-semibold border-t border-border pt-1 mt-1"><span>Total Deductions</span><span className="font-mono text-destructive">− {formatRWF(p.total_deductions)}</span></div>

          <div className="flex justify-between items-center border-t-2 border-border pt-3 mt-3">
            <span className="font-bold">Net Pay</span>
            <span className="font-display text-2xl font-bold text-success">{formatRWF(p.net_salary)}</span>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"><Printer className="h-4 w-4" /> Print</button>
        </div>
      </div>
    </div>
  );
}
