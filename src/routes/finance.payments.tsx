import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, X, Printer } from "lucide-react";
import { toast } from "sonner";
import { FinanceLayout, StatusPill } from "@/components/layout/FinanceLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { FileInput, openDocument, type UploadedDoc } from "@/components/finance/ui";
import { API_BASE_URL, apiRequest } from "@/lib/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { studentIdNumber, studentSearchText } from "@/lib/studentIdentity";
import {
  formatRWF, toNum, paymentMethodLabel, PAYMENT_METHODS,
  listFeeAssignments, listFeeTransactions, createFeeTransaction, uploadTransactionReceipt,
  type FeeAssignment, type FeeTransaction,
} from "@/lib/financeApi";

export const Route = createFileRoute("/finance/payments")({ component: PaymentsPage });

const BALANCE_HEADERS = ["Student", "Fee", "Total", "Paid", "Balance", "Due Date", "Status", "Actions"];

const STATUS_TONE = {
  paid: "success",
  partial: "warning",
  unpaid: "destructive",
  overdue: "destructive",
  waived: "muted",
} as const;

const shortDate = (iso?: string | null) => (iso ? iso.slice(0, 10) : "--");

const docUrl = (url: string) =>
  url.startsWith("http") ? url : `${API_BASE_URL.replace(/\/api\/v1$/, "")}${url}`;

type StudentRecord = {
  id: string;
  student_school_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  student_id_number?: string | null;
};

const fullName = (s?: StudentRecord | null) =>
  s ? [s.first_name, s.last_name].filter(Boolean).join(" ") || "Unnamed" : "--";

function PaymentsPage() {
  const [students, setStudents] = useState<Record<string, StudentRecord>>({});
  const [assignments, setAssignments] = useState<FeeAssignment[]>([]);
  const [transactions, setTransactions] = useState<FeeTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [studentList, assignmentRes, transactionRes] = await Promise.all([
        apiRequest<StudentRecord[]>("/students?limit=1000", { auth: "school" }),
        listFeeAssignments({ limit: 500 }),
        listFeeTransactions({ limit: 500 }),
      ]);
      setStudents(Object.fromEntries(studentList.map((s) => [s.id, s])));
      setAssignments(assignmentRes.data);
      setTransactions(transactionRes.data);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const collected = assignments.reduce((s, a) => s + toNum(a.amount_paid), 0);
  const outstanding = assignments.reduce((s, a) => s + toNum(a.balance), 0);

  return (
    <FinanceLayout title="Payment Management" subtitle="Receive payments, generate receipts & track transactions">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard compact label="Collected" value={formatRWF(collected)} tone="success" />
        <StatCard compact label="Outstanding" value={formatRWF(outstanding)} tone="warning" />
        <StatCard compact label="Transactions" value={transactions.length} />
        <StatCard compact label="Fee Assignments" value={assignments.length} />
      </div>

      <StudentBalancesTab
        assignments={assignments}
        students={students}
        loading={loading}
        error={error}
        onReload={load}
      />
    </FinanceLayout>
  );
}

function StudentBalancesTab({
  assignments,
  students,
  loading,
  error,
  onReload,
}: {
  assignments: FeeAssignment[];
  students: Record<string, StudentRecord>;
  loading: boolean;
  error: string | null;
  onReload: () => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [paying, setPaying] = useState<FeeAssignment | null>(null);
  const [receipt, setReceipt] = useState<{ tx: FeeTransaction; balance: number; proof: UploadedDoc | null } | null>(null);

  const rows = assignments.filter((a) => {
    const name = a.student_name ?? fullName(students[a.student_id]);
    return (
      (q === "" || `${name} ${studentSearchText(students[a.student_id])}`.toLowerCase().includes(q.toLowerCase())) &&
      (status === "All" || a.status === status)
    );
  });

  return (
    <div>
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by student name or Student ID Number..." className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option value="All">All</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="unpaid">Unpaid</option>
          <option value="overdue">Overdue</option>
          <option value="waived">Waived</option>
        </select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{BALANCE_HEADERS.map((h) => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} className="border-t border-border"><td colSpan={BALANCE_HEADERS.length} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
                ))
              ) : error ? (
                <tr><td colSpan={BALANCE_HEADERS.length} className="px-4 py-10 text-center text-sm text-destructive">{error}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={BALANCE_HEADERS.length} className="px-4 py-10 text-center text-sm text-muted-foreground">No fee assignments yet.</td></tr>
              ) : (
                rows.map((a) => {
                  const student = students[a.student_id];
                  return (
                    <tr key={a.id} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/30">
                      <td className="px-4 py-3 font-medium">
                        {a.student_name ?? fullName(student)}
                        <div className="text-[11px] text-muted-foreground">Student ID Number: {studentIdNumber(student)}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">{a.fee_name ?? "--"}</td>
                      <td className="px-4 py-3">{formatRWF(a.amount_due)}</td>
                      <td className="px-4 py-3 text-success font-semibold">{formatRWF(a.amount_paid)}</td>
                      <td className="px-4 py-3 text-destructive font-semibold">{formatRWF(a.balance)}</td>
                      <td className="px-4 py-3 text-xs">{shortDate(a.due_date)}</td>
                      <td className="px-4 py-3"><StatusPill label={a.status} tone={STATUS_TONE[a.status] ?? "muted"} /></td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {toNum(a.balance) > 0 ? (
                          <button onClick={() => setPaying(a)} className="text-xs font-semibold text-primary hover:underline">Record Payment</button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Settled</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {paying && (
        <RecordPaymentModal
          assignment={paying}
          studentName={paying.student_name ?? fullName(students[paying.student_id])}
          onClose={() => setPaying(null)}
          onPosted={async (tx, balance, proof) => {
            setPaying(null);
            setReceipt({ tx, balance, proof });
            await onReload();
          }}
        />
      )}
      {receipt && (
        <ReceiptModal
          tx={receipt.tx}
          studentName={receipt.tx.student_name ?? fullName(students[receipt.tx.student_id])}
          balance={receipt.balance}
          proof={receipt.proof}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  );
}

function RecordPaymentModal({
  assignment,
  studentName,
  onClose,
  onPosted,
}: {
  assignment: FeeAssignment;
  studentName: string;
  onClose: () => void;
  onPosted: (tx: FeeTransaction, balance: number, proof: UploadedDoc | null) => Promise<void>;
}) {
  const currentUser = useCurrentUser();
  const [amount, setAmount] = useState(assignment.balance);
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0].value);
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<UploadedDoc | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const amt = Number(amount.replace(/[^\d.]/g, ""));
    if (!amt || amt <= 0) { toast.error("Enter a valid positive amount"); return; }
    if (amt > toNum(assignment.balance)) { toast.error("Amount exceeds the outstanding balance"); return; }

    setSubmitting(true);
    try {
      let tx = await createFeeTransaction({
        student_id: assignment.student_id,
        fee_assignment_id: assignment.id,
        amount: amt,
        payment_method: method,
        payment_ref: reference || undefined,
      });

      if (proof?.file) {
        tx = await uploadTransactionReceipt(tx.id, proof.file);
      }

      toast.success(`Payment of ${formatRWF(amt)} recorded`);
      await onPosted(tx, Math.max(0, toNum(assignment.balance) - amt), proof);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
          <h3 className="font-display font-bold">Record Payment</h3>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="rounded-lg bg-muted/40 p-3">
            <div className="font-semibold">{studentName}</div>
            <div className="text-xs text-muted-foreground">
              {assignment.fee_name ?? "Fee"} · Balance: <span className="text-destructive font-bold">{formatRWF(assignment.balance)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (RWF) *" value={amount} onChange={setAmount} placeholder="50000" />
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <Field label="Reference" value={reference} onChange={setReference} placeholder="MoMo TX ID" />
            <Field label="Collected By" value={currentUser?.name ?? ""} onChange={() => {}} disabled />
          </div>
          <FileInput label="Proof of Payment (optional)" value={proof} onChange={setProof} />
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
          <button onClick={submit} disabled={submitting} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">
            {submitting ? "Posting..." : "Post Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReceiptModal({
  tx,
  studentName,
  balance,
  proof,
  onClose,
}: {
  tx: FeeTransaction;
  studentName: string;
  balance: number;
  proof: UploadedDoc | null;
  onClose: () => void;
}) {
  const currentUser = useCurrentUser();

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-border bg-primary text-primary-foreground rounded-t-2xl">
          <div className="text-xs uppercase tracking-wider">Inyemeza · Receipt</div>
          <div className="font-display font-bold text-xl mt-1">{currentUser?.school_name ?? "School"}</div>
          <div className="text-xs opacity-90 mt-1">Receipt #: {tx.receipt_number}</div>
        </div>
        <div className="px-6 py-5 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-semibold">{shortDate(tx.paid_at)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Student</span><span className="font-semibold">{studentName}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span className="font-semibold">{paymentMethodLabel(tx.payment_method)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="font-mono text-xs">{tx.payment_ref ?? "--"}</span></div>
          <div className="border-t border-border pt-3 mt-3 flex justify-between items-center">
            <span className="font-bold">Amount Paid</span><span className="font-display text-2xl font-bold text-success">{formatRWF(tx.amount)}</span>
          </div>
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Remaining Balance</span><span className="font-semibold">{formatRWF(balance)}</span></div>
          <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">School stamp &amp; signature</div>
          {(tx.receipt_url || proof) && (
            <button
              onClick={() => openDocument(tx.receipt_url ? { name: tx.receipt_number, url: docUrl(tx.receipt_url) } : proof!)}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
            >
              View attached proof
            </button>
          )}
        </div>
        <div className="px-6 py-4 border-t border-border flex flex-wrap justify-end gap-2">
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"><Printer className="h-4 w-4" /> Print</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, disabled }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60" />
    </div>
  );
}
