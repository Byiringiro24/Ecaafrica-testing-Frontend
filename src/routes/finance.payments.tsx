import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, X, Printer, Send } from "lucide-react";
import { toast } from "sonner";
import { FinanceLayout, StatusPill } from "@/components/layout/FinanceLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { FileInput, openDocument, type UploadedDoc } from "@/components/finance/ui";
import {
  STUDENTS, STUDENT_FEES, TRANSACTIONS, FEE_STRUCTURE, PAYMENT_METHODS,
  formatRWF, schoolInvoiceName, FINANCE_ME,
  type StudentFee, type FeeTransaction,
} from "@/lib/financeData";

export const Route = createFileRoute("/finance/payments")({ component: PaymentsPage });

const TABS = ["Student Balances", "Transaction Logs"] as const;

function PaymentsPage() {
  const [tab, setTab] = useState<typeof TABS[number]>("Student Balances");
  const collected = STUDENT_FEES.reduce((s, f) => s + f.paid, 0);
  const outstanding = STUDENT_FEES.reduce((s, f) => s + f.balance, 0);

  return (
    <FinanceLayout title="Payment Management" subtitle="Receive payments, generate receipts & track transactions">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard compact label="Collected" value={formatRWF(collected)} tone="success" />
        <StatCard compact label="Outstanding" value={formatRWF(outstanding)} tone="warning" />
        <StatCard compact label="Transactions" value={TRANSACTIONS.length} />
        <StatCard compact label="Methods" value={PAYMENT_METHODS.length} />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Student Balances" && <StudentBalancesTab />}
      {tab === "Transaction Logs" && <TransactionLogsTab />}
    </FinanceLayout>
  );
}

function StudentBalancesTab() {
  const [q, setQ] = useState("");
  const [cls, setCls] = useState("All");
  const [status, setStatus] = useState("All");
  const [paying, setPaying] = useState<StudentFee | null>(null);
  const [receipt, setReceipt] = useState<{ tx: FeeTransaction; balance: number; proof: UploadedDoc | null } | null>(null);

  const rows = useMemo(
    () => STUDENT_FEES.map((f) => ({ fee: f, student: STUDENTS.find((s) => s.id === f.studentId)! }))
      .filter((r) => (q === "" || r.student.name.toLowerCase().includes(q.toLowerCase())) &&
        (cls === "All" || r.student.class === cls) && (status === "All" || r.fee.status === status))
      .slice(0, 40),
    [q, cls, status],
  );

  return (
    <div>
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by student name..." className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" />
        </div>
        <select value={cls} onChange={(e) => setCls(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option>All</option>{["S1A", "S1B", "S2A", "S2B", "S3A", "S3B", "S4A", "S4B", "S5A", "S5B", "S6A", "S6B"].map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option>All</option><option>Paid</option><option>Partial</option><option>Unpaid</option><option>Overdue</option>
        </select>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{["Student", "Class", "Total", "Paid", "Balance", "Last Payment", "Status", "Actions"].map((h) => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map(({ fee, student }) => (
                <tr key={fee.studentId} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/30">
                  <td className="px-4 py-3 font-medium">{student.name}</td>
                  <td className="px-4 py-3">{student.class}</td>
                  <td className="px-4 py-3">{formatRWF(fee.total)}</td>
                  <td className="px-4 py-3 text-success font-semibold">{formatRWF(fee.paid)}</td>
                  <td className="px-4 py-3 text-destructive font-semibold">{formatRWF(fee.balance)}</td>
                  <td className="px-4 py-3 text-xs">{fee.lastPayment}</td>
                  <td className="px-4 py-3"><FeeStatus v={fee.status} /></td>
                  <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                    <button onClick={() => setPaying(fee)} className="text-xs font-semibold text-primary hover:underline">Record Payment</button>
                    <button onClick={() => toast.success(`Reminder SMS sent to ${student.parentName}`)} className="text-xs font-semibold text-muted-foreground hover:underline">Remind</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {paying && <RecordPaymentModal fee={paying} onClose={() => setPaying(null)} onPosted={(tx, bal, proof) => { setPaying(null); setReceipt({ tx, balance: bal, proof }); }} />}
      {receipt && <ReceiptModal tx={receipt.tx} balance={receipt.balance} proof={receipt.proof} onClose={() => setReceipt(null)} />}
    </div>
  );
}

function FeeStatus({ v }: { v: StudentFee["status"] }) {
  const map = { Paid: "success", Partial: "warning", Unpaid: "destructive", Overdue: "muted" } as const;
  return <StatusPill label={v} tone={map[v]} />;
}

function RecordPaymentModal({ fee, onClose, onPosted }: { fee: StudentFee; onClose: () => void; onPosted: (tx: FeeTransaction, balance: number, proof: UploadedDoc | null) => void }) {
  const student = STUDENTS.find((s) => s.id === fee.studentId)!;
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("Mobile Money");
  const [ref, setRef] = useState("");
  const [proof, setProof] = useState<UploadedDoc | null>(null);
  const submit = () => {
    const amt = parseInt(amount.replace(/\D/g, ""));
    if (!amt || amt <= 0) { toast.error("Enter a valid positive amount"); return; }
    const tx: FeeTransaction = {
      id: `TXN-${Date.now()}`, receiptNo: `RCP-2026-${String(500 + TRANSACTIONS.length).padStart(4, "0")}`,
      date: new Date().toISOString().slice(0, 10), studentId: student.id, studentName: student.name, class: student.class,
      amount: amt, method: method as FeeTransaction["method"], reference: ref || `${method}-${Date.now()}`, collectedBy: `${FINANCE_ME.name} (${FINANCE_ME.role})`, status: "Completed",
    };
    toast.success(`Payment of ${formatRWF(amt)} recorded`);
    onPosted(tx, Math.max(0, fee.balance - amt), proof);
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
          <h3 className="font-display font-bold">Record Payment</h3>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="rounded-lg bg-muted/40 p-3"><div className="font-semibold">{student.name}</div><div className="text-xs text-muted-foreground">{student.class} · Balance: <span className="text-destructive font-bold">{formatRWF(fee.balance)}</span></div></div>
          <div>
            <div className="text-xs font-bold text-muted-foreground mb-2">Fee Breakdown</div>
            <div className="space-y-1 text-sm">
              {FEE_STRUCTURE.map((f) => <div key={f.name} className="flex justify-between border-b border-border py-1"><span>{f.name}</span><span className="font-mono">{formatRWF(f.amounts[student.class.slice(0, 2)] || 0)}</span></div>)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (RWF) *" value={amount} onChange={setAmount} placeholder="50000" />
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
                {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <Field label="Reference" value={ref} onChange={setRef} placeholder="MoMo TX ID" />
            <Field label="Collected By" value={FINANCE_ME.name} onChange={() => {}} disabled />
          </div>
          <FileInput label="Proof of Payment (optional)" value={proof} onChange={setProof} />
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
          <button onClick={submit} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90">Post Payment</button>
        </div>
      </div>
    </div>
  );
}

function ReceiptModal({ tx, balance, proof, onClose }: { tx: FeeTransaction; balance: number; proof: UploadedDoc | null; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-border bg-primary text-primary-foreground rounded-t-2xl">
          <div className="text-xs uppercase tracking-wider">Inyemeza · Receipt</div>
          <div className="font-display font-bold text-xl mt-1">{schoolInvoiceName}</div>
          <div className="text-xs opacity-90 mt-1">Receipt #: {tx.receiptNo}</div>
        </div>
        <div className="px-6 py-5 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-semibold">{tx.date}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Student</span><span className="font-semibold">{tx.studentName}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Class</span><span className="font-semibold">{tx.class}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span className="font-semibold">{tx.method}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="font-mono text-xs">{tx.reference}</span></div>
          <div className="border-t border-border pt-3 mt-3 flex justify-between items-center">
            <span className="font-bold">Amount Paid</span><span className="font-display text-2xl font-bold text-success">{formatRWF(tx.amount)}</span>
          </div>
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Remaining Balance</span><span className="font-semibold">{formatRWF(balance)}</span></div>
          <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">School stamp &amp; signature</div>
          {proof && (
            <button onClick={() => openDocument(proof)} className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">
              View attached proof: {proof.name}
            </button>
          )}
        </div>
        <div className="px-6 py-4 border-t border-border flex flex-wrap justify-end gap-2">
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"><Printer className="h-4 w-4" /> Print</button>
          <button onClick={() => toast.success("Receipt PDF generated")} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">Download PDF</button>
          <button onClick={() => toast.success("Sent to parent via SMS")} className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold hover:bg-primary/90"><Send className="h-4 w-4" /> Send SMS</button>
        </div>
      </div>
    </div>
  );
}

function TransactionLogsTab() {
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const totalAmount = TRANSACTIONS.reduce((s, t) => s + t.amount, 0);
  const slice = TRANSACTIONS.slice(page * pageSize, (page + 1) * pageSize);
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-muted-foreground">{TRANSACTIONS.length} transactions · Total: <span className="font-bold text-foreground">{formatRWF(totalAmount)}</span></div>
        <button onClick={() => toast.success("CSV exported")} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">Export CSV</button>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{["Receipt #", "Date", "Student", "Class", "Amount", "Method", "Collected By", "Status"].map((h) => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
            <tbody>
              {slice.map((t) => (
                <tr key={t.id} className="border-t border-border odd:bg-background even:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs">{t.receiptNo}</td>
                  <td className="px-4 py-3 text-xs">{t.date}</td>
                  <td className="px-4 py-3 font-medium">{t.studentName}</td>
                  <td className="px-4 py-3">{t.class}</td>
                  <td className="px-4 py-3 font-semibold text-success">{formatRWF(t.amount)}</td>
                  <td className="px-4 py-3 text-xs">{t.method}</td>
                  <td className="px-4 py-3 text-xs">{t.collectedBy}</td>
                  <td className="px-4 py-3"><StatusPill label={t.status} tone="success" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between items-center px-4 py-3 border-t border-border text-xs">
          <span className="text-muted-foreground">Page {page + 1} of {Math.ceil(TRANSACTIONS.length / pageSize)}</span>
          <div className="space-x-2">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded border border-border px-3 py-1 disabled:opacity-50">Prev</button>
            <button disabled={(page + 1) * pageSize >= TRANSACTIONS.length} onClick={() => setPage((p) => p + 1)} className="rounded border border-border px-3 py-1 disabled:opacity-50">Next</button>
          </div>
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
