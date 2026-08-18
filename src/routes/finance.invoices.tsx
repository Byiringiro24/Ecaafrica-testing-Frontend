import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, X, Printer, Download, Plus, Send, Wallet } from "lucide-react";
import { toast } from "sonner";
import { FinanceLayout, StatusPill } from "@/components/layout/FinanceLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Modal, TextField, FileInput, DocButton, PrimaryButton, GhostButton, openDocument,
  type UploadedDoc,
} from "@/components/finance/ui";
import { API_BASE_URL, apiRequest } from "@/lib/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAcademicSession } from "@/hooks/useAcademicSession";
import { studentIdNumber } from "@/lib/studentIdentity";
import {
  formatRWF, toNum,
  listInvoices, createInvoice, issueInvoice, payInvoice, uploadInvoiceDocument,
  listFeeStructures,
  type Invoice, type InvoiceStatus, type InvoiceListMeta, type FeeStructure,
} from "@/lib/financeApi";

export const Route = createFileRoute("/finance/invoices")({ component: InvoicesPage });

const STATUS_TONE: Record<InvoiceStatus, "success" | "warning" | "destructive" | "muted" | "primary"> = {
  paid: "success",
  partially_paid: "primary",
  pending: "warning",
  draft: "muted",
  cancelled: "destructive",
  refunded: "destructive",
};

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  paid: "Paid",
  partially_paid: "Partially Paid",
  pending: "Pending",
  draft: "Draft",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const TABLE_HEADERS = ["Invoice #", "Student", "Issue", "Due", "Total", "Paid", "Balance", "Status", "Doc", ""];

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

const studentLabel = (s: StudentRecord) =>
  `${[s.first_name, s.last_name].filter(Boolean).join(" ") || "Unnamed"} · Student ID Number: ${studentIdNumber(s)}`;

function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meta, setMeta] = useState<InvoiceListMeta | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [viewing, setViewing] = useState<{ invoice: Invoice; autoPrint: boolean } | null>(null);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listInvoices({
        limit: 100,
        q: q || undefined,
        status: status === "All" ? undefined : status,
      });
      setInvoices(res.data);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [q, status]);

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

  return (
    <FinanceLayout title="Invoice Management" subtitle="Generate and track student invoices">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard compact label="Invoices" value={meta?.total ?? 0} />
        <StatCard compact label="Total Billed" value={formatRWF(meta?.total_billed)} />
        <StatCard compact label="Total Paid" value={formatRWF(meta?.total_paid)} tone="success" />
        <StatCard compact label="Outstanding" value={formatRWF(meta?.total_outstanding)} tone="warning" />
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student name, Student ID Number or invoice #..." className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option value="All">All</option>
          {(Object.keys(STATUS_LABEL) as InvoiceStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Generate Invoice
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>{TABLE_HEADERS.map((h) => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} className="border-t border-border"><td colSpan={TABLE_HEADERS.length} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
                ))
              ) : error ? (
                <tr><td colSpan={TABLE_HEADERS.length} className="px-4 py-10 text-center text-sm text-destructive">{error}</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={TABLE_HEADERS.length} className="px-4 py-10 text-center text-sm text-muted-foreground">No invoices yet.</td></tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/30">
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{inv.invoice_number}</td>
                    <td className="px-4 py-3 font-medium">{inv.student_name}<div className="text-[11px] text-muted-foreground">Student ID Number: {inv.student_number}</div></td>
                    <td className="px-4 py-3 text-xs">{shortDate(inv.issue_date)}</td>
                    <td className="px-4 py-3 text-xs">{shortDate(inv.due_date)}</td>
                    <td className="px-4 py-3 font-semibold">{formatRWF(inv.total)}</td>
                    <td className="px-4 py-3 text-success">{formatRWF(inv.amount_paid)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-destructive">{formatRWF(inv.balance)}</td>
                    <td className="px-4 py-3"><StatusPill label={STATUS_LABEL[inv.status]} tone={STATUS_TONE[inv.status]} /></td>
                    <td className="px-4 py-3"><DocButton doc={inv.document_url ? { name: `${inv.invoice_number}.pdf`, url: docUrl(inv.document_url) } : null} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setViewing({ invoice: inv, autoPrint: false })} className="text-xs font-semibold text-primary hover:underline">View</button>
                        <button onClick={() => setViewing({ invoice: inv, autoPrint: true })} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Printer className="h-3.5 w-3.5" /> Print</button>
                        {inv.status === "draft" && (
                          <button onClick={() => runAction(`${inv.invoice_number} issued`, () => issueInvoice(inv.id))} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Send className="h-3.5 w-3.5" /> Issue</button>
                        )}
                        {(inv.status === "pending" || inv.status === "partially_paid") && (
                          <button onClick={() => setPaying(inv)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Wallet className="h-3.5 w-3.5" /> Pay</button>
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

      {viewing && <InvoiceModal invoice={viewing.invoice} autoPrint={viewing.autoPrint} onClose={() => setViewing(null)} />}
      {creating && (
        <GenerateInvoiceModal
          onClose={() => setCreating(false)}
          onCreated={async () => { setCreating(false); await load(); }}
        />
      )}
      {paying && (
        <RecordPaymentModal
          invoice={paying}
          onClose={() => setPaying(null)}
          onDone={async () => { setPaying(null); await load(); }}
        />
      )}
    </FinanceLayout>
  );
}

function GenerateInvoiceModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const session = useAcademicSession();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [studentId, setStudentId] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [attachment, setAttachment] = useState<UploadedDoc | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);

  useEffect(() => {
    Promise.all([
      apiRequest<StudentRecord[]>("/students?limit=500", { auth: "school" }),
      listFeeStructures({ limit: 200 }),
    ])
      .then(([studentList, structureRes]) => {
        setStudents(studentList);
        setStructures(structureRes.data);
      })
      .catch((err: any) => toast.error(err?.message ?? "Failed to load invoice options"));
  }, []);

  const filteredStudents = studentSearch.trim()
    ? students.filter((s) =>
        studentLabel(s).toLowerCase().includes(studentSearch.toLowerCase())
      )
    : students;

  const handleSelectStudent = (s: StudentRecord) => {
    setStudentId(s.id);
    setStudentSearch(studentLabel(s));
    setShowStudentDropdown(false);
  };

  const items = structures
    .filter((f) => selected[f.id])
    .map((f) => ({ label: f.name, amount: toNum(f.amount), fee_structure_id: f.id }));
  const total = items.reduce((s, i) => s + i.amount, 0);

  const submit = async () => {
    if (!studentId) { toast.error("Select a student"); return; }
    if (items.length === 0) { toast.error("Select at least one fee item"); return; }

    setSubmitting(true);
    try {
      const created = await createInvoice({
        student_id: studentId,
        items,
        due_date: dueDate,
        academic_year_id: session.academicYear?.id,
        term_id: session.term?.id,
      });

      if (attachment?.file) {
        await uploadInvoiceDocument(created.id, attachment.file);
      }

      toast.success(`Invoice ${created.invoice_number} generated for ${created.student_name}`);
      await onCreated();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to generate invoice");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedStudent = students.find((s) => s.id === studentId);

  return (
    <Modal title="Generate Invoice" subtitle="Create a student invoice from the fee structure" onClose={onClose} wide
      footer={<><GhostButton onClick={onClose}>Cancel</GhostButton><PrimaryButton onClick={submit}>{submitting ? "Generating..." : `Generate Invoice (${formatRWF(total)})`}</PrimaryButton></>}>
      <div className="relative">
        <div className="text-xs font-bold text-muted-foreground mb-1.5">Student <span className="text-destructive">*</span></div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={studentSearch}
            onChange={(e) => { setStudentSearch(e.target.value); setStudentId(""); setShowStudentDropdown(true); }}
            onFocus={() => setShowStudentDropdown(true)}
            onBlur={() => setShowStudentDropdown(false)}
            placeholder="Search student by name or Student ID Number..."
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
          />
        </div>
        {showStudentDropdown && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-52 overflow-y-auto">
            {filteredStudents.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">No students match "{studentSearch}".</div>
            ) : (
              filteredStudents.slice(0, 50).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={() => handleSelectStudent(s)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50"
                >
                  {studentLabel(s)}
                </button>
              ))
            )}
          </div>
        )}
      </div>
      {selectedStudent && (
        <div className="rounded-lg bg-muted/40 p-3 text-sm">
          <span className="font-semibold">{studentLabel(selectedStudent)}</span>
          {session.label && <span className="text-muted-foreground"> · {session.label}</span>}
        </div>
      )}

      <div>
        <div className="text-xs font-bold text-muted-foreground mb-2">Fee Items</div>
        {structures.length === 0 ? (
          <p className="text-sm text-muted-foreground">No fee structures defined yet.</p>
        ) : (
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {structures.map((f) => (
              <label key={f.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/30">
                <span className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={!!selected[f.id]} onChange={(e) => setSelected((p) => ({ ...p, [f.id]: e.target.checked }))} />
                  {f.name}
                  {f.class_name && <span className="text-[10px] uppercase text-muted-foreground">({f.class_name})</span>}
                  {f.is_mandatory && <span className="text-[10px] uppercase text-muted-foreground">(mandatory)</span>}
                </span>
                <span className="font-mono text-xs">{formatRWF(f.amount)}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TextField label="Due Date" value={dueDate} onChange={setDueDate} type="date" required />
      </div>

      <div className="flex justify-between text-sm border-t border-border pt-3">
        <span className="text-muted-foreground">Total</span>
        <span className="font-display text-lg font-bold text-primary">{formatRWF(total)}</span>
      </div>
      <FileInput label="Attach Document (optional)" value={attachment} onChange={setAttachment} />
    </Modal>
  );
}

function RecordPaymentModal({
  invoice,
  onClose,
  onDone,
}: {
  invoice: Invoice;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [amount, setAmount] = useState(invoice.balance);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const value = Number(amount.replace(/[^\d.]/g, ""));
    if (!value || value <= 0) { toast.error("Enter a valid amount"); return; }
    if (value > toNum(invoice.balance)) { toast.error("Amount exceeds the outstanding balance"); return; }

    setSubmitting(true);
    try {
      await payInvoice(invoice.id, value);
      toast.success(`${formatRWF(value)} applied to ${invoice.invoice_number}`);
      await onDone();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Apply Payment — ${invoice.invoice_number}`} subtitle={`Balance ${formatRWF(invoice.balance)} for ${invoice.student_name}`} onClose={onClose}
      footer={<><GhostButton onClick={onClose}>Cancel</GhostButton><PrimaryButton onClick={submit}>{submitting ? "Applying..." : "Apply Payment"}</PrimaryButton></>}>
      <TextField label="Amount (RWF)" value={amount} onChange={setAmount} required />
      <p className="text-[11px] text-muted-foreground">
        This updates the invoice only. Record the cash movement on the Payments page so it counts toward collections.
      </p>
    </Modal>
  );
}

function InvoiceModal({ invoice, autoPrint, onClose }: { invoice: Invoice; autoPrint?: boolean; onClose: () => void }) {
  const currentUser = useCurrentUser();
  const session = useAcademicSession();

  useEffect(() => {
    if (!autoPrint) return;
    const timer = setTimeout(() => window.print(), 150);
    return () => clearTimeout(timer);
  }, [autoPrint]);

  const attachment = invoice.document_url
    ? { name: `${invoice.invoice_number}.pdf`, url: docUrl(invoice.document_url) }
    : null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-card shadow-2xl border border-border max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4 no-print">
          <h2 className="font-display text-lg font-bold">Invoice {invoice.invoice_number}</h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-5 invoice-print">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-display text-xl font-bold text-primary">{currentUser?.school_name ?? "School"}</div>
              <p className="text-xs text-muted-foreground">{session.label ?? ""}</p>
              <p className="text-xs font-mono font-semibold mt-1">Invoice {invoice.invoice_number}</p>
              <p className="text-xs text-muted-foreground">Issued {shortDate(invoice.issue_date)} · Due {shortDate(invoice.due_date)}</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Billed to</div>
              <div className="font-semibold">{invoice.student_name}</div>
              <div className="text-xs text-muted-foreground">Student ID Number: {invoice.student_number}</div>
            </div>
          </div>

          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr><th className="px-4 py-2 text-left">Fee Item</th><th className="px-4 py-2 text-right">Amount</th></tr>
            </thead>
            <tbody>
              {invoice.items.map((it) => (
                <tr key={it.id} className="border-t border-border"><td className="px-4 py-2.5">{it.label}</td><td className="px-4 py-2.5 text-right font-mono">{formatRWF(it.amount)}</td></tr>
              ))}
            </tbody>
            <tfoot className="text-sm">
              <tr className="border-t border-border"><td className="px-4 py-2 text-right text-muted-foreground">Subtotal</td><td className="px-4 py-2 text-right font-mono">{formatRWF(invoice.subtotal)}</td></tr>
              {toNum(invoice.previous_balance) > 0 && <tr><td className="px-4 py-2 text-right text-muted-foreground">Previous Balance</td><td className="px-4 py-2 text-right font-mono">{formatRWF(invoice.previous_balance)}</td></tr>}
              {toNum(invoice.discount) > 0 && <tr><td className="px-4 py-2 text-right text-muted-foreground">Discount</td><td className="px-4 py-2 text-right font-mono text-success">− {formatRWF(invoice.discount)}</td></tr>}
              {toNum(invoice.late_charges) > 0 && <tr><td className="px-4 py-2 text-right text-muted-foreground">Late Charges</td><td className="px-4 py-2 text-right font-mono text-destructive">{formatRWF(invoice.late_charges)}</td></tr>}
              <tr className="border-t border-border bg-muted/30"><td className="px-4 py-3 text-right font-bold">Total Due</td><td className="px-4 py-3 text-right font-bold text-primary">{formatRWF(invoice.total)}</td></tr>
              <tr><td className="px-4 py-2 text-right text-muted-foreground">Paid</td><td className="px-4 py-2 text-right font-mono text-success">{formatRWF(invoice.amount_paid)}</td></tr>
              <tr><td className="px-4 py-2 text-right font-semibold">Balance</td><td className="px-4 py-2 text-right font-mono font-semibold text-destructive">{formatRWF(invoice.balance)}</td></tr>
            </tfoot>
          </table>

          <div className="flex items-center justify-between">
            <StatusPill label={STATUS_LABEL[invoice.status]} tone={STATUS_TONE[invoice.status]} />
            <div className="flex gap-2 no-print">
              {attachment && <button onClick={() => openDocument(attachment)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"><Download className="h-4 w-4" /> Attachment</button>}
              <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold hover:opacity-90"><Printer className="h-4 w-4" /> Print</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
