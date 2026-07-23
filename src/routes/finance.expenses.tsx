import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { FinanceLayout, StatusPill } from "@/components/layout/FinanceLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import {
  Modal, TextField, SelectField, TextAreaField, FileInput, DocButton, PrimaryButton, GhostButton,
  type UploadedDoc,
} from "@/components/finance/ui";
import { EXPENSES, EXPENSE_CATEGORIES, formatRWF, FINANCE_ME, type Expense, type ExpenseStatus } from "@/lib/financeData";

export const Route = createFileRoute("/finance/expenses")({ component: ExpensesPage });

type ExpenseRow = Expense & { document?: UploadedDoc };

const STATUS_TONE: Record<ExpenseStatus, "success" | "warning" | "destructive" | "primary"> = {
  Paid: "success", Approved: "primary", Pending: "warning", Rejected: "destructive",
};

// Seed rows that were flagged as having a document get a sample viewable doc
const SEEDED: ExpenseRow[] = EXPENSES.map((e) =>
  e.hasDocument ? { ...e, document: { name: `${e.id}-receipt.pdf`, seed: true, title: `Expense ${e.id} — ${e.category}`, type: "application/pdf" } } : e,
);

function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseRow[]>(SEEDED);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [status, setStatus] = useState("All");
  const [creating, setCreating] = useState(false);

  const rows = useMemo(
    () => expenses.filter(
      (e) =>
        (q === "" || e.description.toLowerCase().includes(q.toLowerCase()) || e.vendor.toLowerCase().includes(q.toLowerCase())) &&
        (cat === "All" || e.category === cat) &&
        (status === "All" || e.status === status),
    ),
    [expenses, q, cat, status],
  );

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const paid = expenses.filter((e) => e.status === "Paid").reduce((s, e) => s + e.amount, 0);
  const pending = expenses.filter((e) => e.status === "Pending").reduce((s, e) => s + e.amount, 0);

  const approve = (id: string) => {
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, status: "Approved", approvedBy: FINANCE_ME.name } : e)));
    toast.success("Expense approved");
  };

  const addExpense = (e: ExpenseRow) => {
    setExpenses((prev) => [e, ...prev]);
    setCreating(false);
    toast.success(`Expense ${e.id} recorded (${formatRWF(e.amount)})`);
  };

  return (
    <FinanceLayout title="Expense Tracking" subtitle="Record, approve & monitor school expenditure">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard compact label="Total Expenses" value={formatRWF(total)} />
        <StatCard compact label="Paid" value={formatRWF(paid)} tone="success" />
        <StatCard compact label="Pending Approval" value={formatRWF(pending)} tone="warning" />
        <StatCard compact label="Records" value={expenses.length} />
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search description or vendor..." className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option>All</option>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option>All</option><option>Pending</option><option>Approved</option><option>Paid</option><option>Rejected</option>
        </select>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Record Expense
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{["Ref", "Date", "Category", "Description", "Vendor", "Amount", "Document", "Status", "Action"].map((h) => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/30">
                  <td className="px-4 py-3 font-mono text-xs">{e.id}</td>
                  <td className="px-4 py-3 text-xs">{e.date}</td>
                  <td className="px-4 py-3"><StatusPill label={e.category} tone="muted" /></td>
                  <td className="px-4 py-3">{e.description}</td>
                  <td className="px-4 py-3 text-xs">{e.vendor}</td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{formatRWF(e.amount)}</td>
                  <td className="px-4 py-3"><DocButton doc={e.document ?? null} /></td>
                  <td className="px-4 py-3"><StatusPill label={e.status} tone={STATUS_TONE[e.status]} /></td>
                  <td className="px-4 py-3">
                    {e.status === "Pending"
                      ? <button onClick={() => approve(e.id)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><CheckCircle2 className="h-3.5 w-3.5" /> Approve</button>
                      : <span className="text-xs text-muted-foreground">{e.approvedBy}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {creating && <RecordExpenseModal nextIndex={expenses.length} onClose={() => setCreating(false)} onCreate={addExpense} />}
    </FinanceLayout>
  );
}

function RecordExpenseModal({ nextIndex, onClose, onCreate }: { nextIndex: number; onClose: () => void; onCreate: (e: ExpenseRow) => void }) {
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [document, setDocument] = useState<UploadedDoc | null>(null);

  const submit = () => {
    const amt = parseInt(amount.replace(/\D/g, ""));
    if (!description.trim()) { toast.error("Enter a description"); return; }
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    onCreate({
      id: `EXP-2026-${300 + nextIndex}`,
      date,
      category,
      description: description.trim(),
      vendor: vendor.trim() || "—",
      amount: amt,
      hasDocument: !!document,
      status: "Pending",
      approvedBy: "—",
      document: document ?? undefined,
    });
  };

  return (
    <Modal title="Record Expense" subtitle="Submitted as Pending until approved by the Finance Manager" onClose={onClose} wide
      footer={<><GhostButton onClick={onClose}>Cancel</GhostButton><PrimaryButton onClick={submit}>Submit Expense</PrimaryButton></>}>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Category" value={category} onChange={setCategory} options={EXPENSE_CATEGORIES} required />
        <TextField label="Amount (RWF)" value={amount} onChange={setAmount} placeholder="50000" required />
        <TextField label="Vendor / Payee" value={vendor} onChange={setVendor} placeholder="Supplier name" />
        <TextField label="Date" value={date} onChange={setDate} type="date" required />
      </div>
      <TextAreaField label="Description" value={description} onChange={setDescription} placeholder="What was this expense for?" />
      <FileInput label="Supporting Document (invoice / receipt)" value={document} onChange={setDocument} />
    </Modal>
  );
}
