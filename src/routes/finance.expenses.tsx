import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Plus, CheckCircle2, XCircle, Wallet, Download, Eye, FileText } from "lucide-react";
import { toast } from "sonner";
import { FinanceLayout, StatusPill } from "@/components/layout/FinanceLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Modal, TextField, SelectField, TextAreaField, FileInput, PrimaryButton, GhostButton,
  type UploadedDoc,
} from "@/components/finance/ui";
import { API_BASE_URL } from "@/lib/api";
import {
  formatRWF, paymentMethodLabel, PAYMENT_METHODS,
  listExpenses, listExpenseCategories, createExpense, approveExpense,
  rejectExpense, markExpensePaid, uploadExpenseDocument,
  type Expense, type ExpenseStatus, type ExpenseListMeta,
} from "@/lib/financeApi";

export const Route = createFileRoute("/finance/expenses")({ component: ExpensesPage });

const STATUS_TONE: Record<ExpenseStatus, "success" | "warning" | "destructive" | "primary"> = {
  paid: "success", approved: "primary", pending: "warning", rejected: "destructive",
};

const STATUS_LABEL: Record<ExpenseStatus, string> = {
  paid: "Paid", approved: "Approved", pending: "Pending", rejected: "Rejected",
};

const TABLE_HEADERS = ["Ref", "Date", "Category", "Description", "Vendor", "Amount", "Document", "Status", "Action"];

const shortDate = (iso: string) => (iso ? iso.slice(0, 10) : "--");

/** Documents are served from the backend's /uploads mount, not the API path. */
export const resolveDocUrl = (url: string) =>
  url.startsWith("http") ? url : `${API_BASE_URL.replace(/\/api\/v1$/, "")}${url}`;

const asDoc = (expense: Expense): UploadedDoc | null =>
  expense.document_url
    ? { name: `${expense.reference}-document`, url: resolveDocUrl(expense.document_url) }
    : null;

function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [meta, setMeta] = useState<ExpenseListMeta | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [status, setStatus] = useState("All");
  const [creating, setCreating] = useState(false);
  const [rejecting, setRejecting] = useState<Expense | null>(null);
  const [payingId, setPayingId] = useState<Expense | null>(null);
  const [viewingDoc, setViewingDoc] = useState<{ expense: Expense; doc: UploadedDoc } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listExpenses({
        limit: 100,
        q: q || undefined,
        category: cat === "All" ? undefined : cat,
        status: status === "All" ? undefined : status,
      });
      setExpenses(res.data);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, [q, cat, status]);

  useEffect(() => {
    listExpenseCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  const runAction = async (label: string, action: () => Promise<unknown>) => {
    try {
      await action();
      toast.success(label);
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "Action failed");
    }
  };

  const totals = meta?.totals;

  const exportCsv = () => {
    if (expenses.length === 0) { toast.error("Nothing to export yet"); return; }
    const headers = ["Reference", "Date", "Category", "Description", "Vendor", "Amount", "Status", "Payment Method", "Document"];
    const rows = expenses.map((e) => [
      e.reference,
      shortDate(e.expense_date),
      e.category,
      e.description,
      e.vendor ?? "",
      e.amount,
      STATUS_LABEL[e.status],
      e.status === "paid" ? paymentMethodLabel(e.payment_method) : "",
      e.document_url ? resolveDocUrl(e.document_url) : "",
    ]);
    const escape = (cell: string | number | null | undefined) => {
      const value = String(cell ?? "");
      return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    };
    const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "expenses.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${expenses.length} expenses exported`);
  };

  return (
    <FinanceLayout title="Expense Tracking" subtitle="Record, approve & monitor school expenditure">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard compact label="Total Expenses" value={formatRWF(totals?.all)} />
        <StatCard compact label="Paid" value={formatRWF(totals?.paid)} tone="success" />
        <StatCard compact label="Pending Approval" value={formatRWF(totals?.pending)} tone="warning" />
        <StatCard compact label="Records" value={meta?.total ?? 0} />
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search description or vendor..." className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option>All</option>{categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option value="All">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
        </select>
        <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">
          <Download className="h-4 w-4" /> Export
        </button>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Record Expense
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{TABLE_HEADERS.map((h) => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} className="border-t border-border">
                    <td colSpan={TABLE_HEADERS.length} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td>
                  </tr>
                ))
              ) : error ? (
                <tr><td colSpan={TABLE_HEADERS.length} className="px-4 py-10 text-center text-sm text-destructive">{error}</td></tr>
              ) : expenses.length === 0 ? (
                <tr><td colSpan={TABLE_HEADERS.length} className="px-4 py-10 text-center text-sm text-muted-foreground">No expenses recorded yet.</td></tr>
              ) : (
                expenses.map((e) => (
                  <tr key={e.id} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/30">
                    <td className="px-4 py-3 font-mono text-xs">{e.reference}</td>
                    <td className="px-4 py-3 text-xs">{shortDate(e.expense_date)}</td>
                    <td className="px-4 py-3"><StatusPill label={e.category} tone="muted" /></td>
                    <td className="px-4 py-3">{e.description}</td>
                    <td className="px-4 py-3 text-xs">{e.vendor || "--"}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{formatRWF(e.amount)}</td>
                    <td className="px-4 py-3">
                      {asDoc(e)
                        ? <button onClick={() => setViewingDoc({ expense: e, doc: asDoc(e)! })} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Eye className="h-3.5 w-3.5" /> View</button>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3"><StatusPill label={STATUS_LABEL[e.status]} tone={STATUS_TONE[e.status]} /></td>
                    <td className="px-4 py-3">
                      {e.status === "pending" ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => runAction("Expense approved", () => approveExpense(e.id))} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><CheckCircle2 className="h-3.5 w-3.5" /> Approve</button>
                          <button onClick={() => setRejecting(e)} className="inline-flex items-center gap-1 text-xs font-semibold text-destructive hover:underline"><XCircle className="h-3.5 w-3.5" /> Reject</button>
                        </div>
                      ) : e.status === "approved" ? (
                        <button onClick={() => setPayingId(e)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Wallet className="h-3.5 w-3.5" /> Mark Paid</button>
                      ) : e.status === "paid" ? (
                        <span className="text-xs text-muted-foreground">{paymentMethodLabel(e.payment_method)}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{e.approved_by_name ?? "--"}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {creating && (
        <RecordExpenseModal
          categories={categories}
          onClose={() => setCreating(false)}
          onCreated={async () => { setCreating(false); await load(); }}
        />
      )}

      {rejecting && (
        <RejectExpenseModal
          expense={rejecting}
          onClose={() => setRejecting(null)}
          onDone={async () => { setRejecting(null); await load(); }}
        />
      )}

      {payingId && (
        <MarkPaidModal
          expense={payingId}
          onClose={() => setPayingId(null)}
          onDone={async () => { setPayingId(null); await load(); }}
        />
      )}

      {viewingDoc && (
        <ViewDocumentModal
          expense={viewingDoc.expense}
          doc={viewingDoc.doc}
          onClose={() => setViewingDoc(null)}
        />
      )}
    </FinanceLayout>
  );
}

function RecordExpenseModal({
  categories,
  onClose,
  onCreated,
}: {
  categories: string[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [localCategories, setLocalCategories] = useState<string[]>(categories);
  const [category, setCategory] = useState(categories[0] ?? "");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [document, setDocument] = useState<UploadedDoc | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLocalCategories((prev) => Array.from(new Set([...categories, ...prev])));
  }, [categories]);

  useEffect(() => {
    if (localCategories.length && !category) setCategory(localCategories[0]);
  }, [localCategories, category]);

  const confirmNewCategory = () => {
    const name = newCategory.trim();
    if (!name) { toast.error("Enter a category name"); return; }
    const existing = localCategories.find((c) => c.toLowerCase() === name.toLowerCase());
    if (existing) {
      setCategory(existing);
    } else {
      setLocalCategories((prev) => [...prev, name]);
      setCategory(name);
    }
    setNewCategory("");
    setAddingCategory(false);
  };

  const submit = async () => {
    const amt = Number(amount.replace(/[^\d.]/g, ""));
    if (!category) { toast.error("Select a category"); return; }
    if (!description.trim()) { toast.error("Enter a description"); return; }
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }

    setSubmitting(true);
    try {
      const created = await createExpense({
        expense_date: date,
        category,
        description: description.trim(),
        amount: amt,
        vendor: vendor.trim() || undefined,
      });

      if (document?.file) {
        await uploadExpenseDocument(created.id, document.file);
      }

      toast.success(`Expense ${created.reference} recorded (${formatRWF(created.amount)})`);
      await onCreated();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to record expense");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Record Expense" subtitle="Submitted as Pending until approved" onClose={onClose} wide
      footer={<><GhostButton onClick={onClose}>Cancel</GhostButton><PrimaryButton onClick={submit}>{submitting ? "Submitting..." : "Submit Expense"}</PrimaryButton></>}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          {addingCategory ? (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">New Category <span className="text-destructive">*</span></label>
              <div className="flex gap-2">
                <input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmNewCategory(); } }}
                  placeholder="e.g. Security"
                  autoFocus
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
                <button type="button" onClick={confirmNewCategory} className="rounded-lg bg-primary text-primary-foreground px-3 text-sm font-semibold hover:bg-primary/90">Add</button>
                <button type="button" onClick={() => { setAddingCategory(false); setNewCategory(""); }} className="rounded-lg border border-border px-3 text-sm font-semibold hover:bg-muted">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <SelectField label="Category" value={category} onChange={setCategory} options={localCategories} required />
              <button type="button" onClick={() => setAddingCategory(true)} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                <Plus className="h-3 w-3" /> New category
              </button>
            </>
          )}
        </div>
        <TextField label="Amount (RWF)" value={amount} onChange={setAmount} placeholder="50000" required />
        <TextField label="Vendor / Payee" value={vendor} onChange={setVendor} placeholder="Supplier name" />
        <TextField label="Date" value={date} onChange={setDate} type="date" required />
      </div>
      <TextAreaField label="Description *" value={description} onChange={setDescription} placeholder="What was this expense for?" />
      <FileInput label="Supporting Document (invoice / receipt)" value={document} onChange={setDocument} />
    </Modal>
  );
}

function ViewDocumentModal({
  expense,
  doc,
  onClose,
}: {
  expense: Expense;
  doc: UploadedDoc;
  onClose: () => void;
}) {
  const url = doc.url ?? "";
  const isImage = /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url);
  const isPdf = /\.pdf(\?|$)/i.test(url);

  return (
    <Modal
      title={`Document — ${expense.reference}`}
      subtitle={`${expense.category} · ${formatRWF(expense.amount)}`}
      onClose={onClose}
      wide
      footer={
        <>
          <GhostButton onClick={onClose}>Close</GhostButton>
          <a href={url} target="_blank" rel="noopener noreferrer" download
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90">
            <Download className="h-4 w-4" /> Download
          </a>
        </>
      }
    >
      <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
        {isImage ? (
          <img src={url} alt={`Document for ${expense.reference}`} className="w-full max-h-[60vh] object-contain bg-background" />
        ) : isPdf ? (
          <iframe src={url} title={`Document for ${expense.reference}`} className="w-full h-[60vh] bg-background" />
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">This file type can't be previewed inline.</p>
            <p className="text-xs text-muted-foreground">{doc.name}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function RejectExpenseModal({
  expense,
  onClose,
  onDone,
}: {
  expense: Expense;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!reason.trim()) { toast.error("A rejection reason is required"); return; }
    setSubmitting(true);
    try {
      await rejectExpense(expense.id, reason.trim());
      toast.success("Expense rejected");
      await onDone();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to reject expense");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Reject ${expense.reference}`} subtitle={expense.description} onClose={onClose}
      footer={<><GhostButton onClick={onClose}>Cancel</GhostButton><PrimaryButton onClick={submit}>{submitting ? "Rejecting..." : "Reject Expense"}</PrimaryButton></>}>
      <TextAreaField label="Reason" value={reason} onChange={setReason} placeholder="Why is this expense being rejected?" />
    </Modal>
  );
}

function MarkPaidModal({
  expense,
  onClose,
  onDone,
}: {
  expense: Expense;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0].value);
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await markExpensePaid(expense.id, { payment_method: method, paid_at: paidAt });
      toast.success(`${expense.reference} marked paid`);
      await onDone();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to mark expense paid");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Mark ${expense.reference} Paid`} subtitle={`${formatRWF(expense.amount)} — ${expense.description}`} onClose={onClose}
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
