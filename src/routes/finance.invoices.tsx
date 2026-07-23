import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, X, Printer, Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { FinanceLayout, StatusPill } from "@/components/layout/FinanceLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import {
  Modal, TextField, SelectField, FileInput, DocButton, PrimaryButton, GhostButton, openDocument,
  type UploadedDoc,
} from "@/components/finance/ui";
import {
  STUDENT_INVOICES, STUDENTS, FEE_STRUCTURE, formatRWF, schoolInvoiceName,
  ACADEMIC_SESSION, CURRENT_TERM, type StudentInvoice, type InvoiceStatus,
} from "@/lib/financeData";

export const Route = createFileRoute("/finance/invoices")({ component: InvoicesPage });

type InvoiceRow = StudentInvoice & { attachment?: UploadedDoc };

const STATUS_TONE: Record<InvoiceStatus, "success" | "warning" | "destructive" | "muted" | "primary"> = {
  Paid: "success",
  "Partially Paid": "primary",
  Pending: "warning",
  Draft: "muted",
  Cancelled: "destructive",
  Refunded: "destructive",
};

// Seed a few invoices with sample attachments so "view document" is testable
const SEEDED: InvoiceRow[] = STUDENT_INVOICES.map((inv, i) =>
  i % 4 === 0 ? { ...inv, attachment: { name: `${inv.id}.pdf`, seed: true, title: `Invoice ${inv.id}`, type: "application/pdf" } } : inv,
);

function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>(SEEDED);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"All" | InvoiceStatus>("All");
  const [viewing, setViewing] = useState<InvoiceRow | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = useMemo(
    () => invoices.filter(
      (inv) =>
        (q === "" || inv.studentName.toLowerCase().includes(q.toLowerCase()) || inv.id.toLowerCase().includes(q.toLowerCase())) &&
        (status === "All" || inv.status === status),
    ),
    [invoices, q, status],
  );

  const totalBilled = invoices.reduce((s, i) => s + i.total, 0);
  const totalPaid = invoices.reduce((s, i) => s + i.paid, 0);

  const addInvoice = (inv: InvoiceRow) => {
    setInvoices((prev) => [inv, ...prev]);
    setCreating(false);
    toast.success(`Invoice ${inv.id} generated for ${inv.studentName}`);
  };

  return (
    <FinanceLayout title="Invoice Management" subtitle="Generate and track student invoices">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard compact label="Invoices" value={invoices.length} />
        <StatCard compact label="Total Billed" value={formatRWF(totalBilled)} />
        <StatCard compact label="Total Paid" value={formatRWF(totalPaid)} tone="success" />
        <StatCard compact label="Outstanding" value={formatRWF(totalBilled - totalPaid)} tone="warning" />
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student or invoice #..." className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          {["All", "Draft", "Pending", "Partially Paid", "Paid", "Cancelled", "Refunded"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Generate Invoice
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>{["Invoice #", "Student", "Class", "Issue", "Due", "Total", "Paid", "Status", "Doc", ""].map((h) => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((inv) => (
                <tr key={inv.id} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/30">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{inv.id}</td>
                  <td className="px-4 py-3 font-medium">{inv.studentName}</td>
                  <td className="px-4 py-3">{inv.class}</td>
                  <td className="px-4 py-3 text-xs">{inv.issueDate}</td>
                  <td className="px-4 py-3 text-xs">{inv.dueDate}</td>
                  <td className="px-4 py-3 font-semibold">{formatRWF(inv.total)}</td>
                  <td className="px-4 py-3 text-success">{formatRWF(inv.paid)}</td>
                  <td className="px-4 py-3"><StatusPill label={inv.status} tone={STATUS_TONE[inv.status]} /></td>
                  <td className="px-4 py-3"><DocButton doc={inv.attachment ?? null} /></td>
                  <td className="px-4 py-3"><button onClick={() => setViewing(inv)} className="text-xs font-semibold text-primary hover:underline">View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewing && <InvoiceModal invoice={viewing} onClose={() => setViewing(null)} />}
      {creating && <GenerateInvoiceModal nextIndex={invoices.length} onClose={() => setCreating(false)} onCreate={addInvoice} />}
    </FinanceLayout>
  );
}

function GenerateInvoiceModal({ nextIndex, onClose, onCreate }: { nextIndex: number; onClose: () => void; onCreate: (inv: InvoiceRow) => void }) {
  const [studentId, setStudentId] = useState(STUDENTS[0].id);
  const [term, setTerm] = useState(CURRENT_TERM);
  const [dueDate, setDueDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); });
  const [discount, setDiscount] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    FEE_STRUCTURE.reduce((o, f) => ({ ...o, [f.name]: f.mandatory }), {}),
  );
  const [attachment, setAttachment] = useState<UploadedDoc | null>(null);

  const student = STUDENTS.find((s) => s.id === studentId)!;
  const lvl = student.class.slice(0, 2);
  const items = FEE_STRUCTURE.filter((f) => selected[f.name]).map((f) => ({ label: f.name, amount: f.amounts[lvl] ?? 0 }));
  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const disc = parseInt(discount.replace(/\D/g, "")) || 0;
  const total = Math.max(0, subtotal - disc);

  const submit = () => {
    if (items.length === 0) { toast.error("Select at least one fee item"); return; }
    const now = new Date();
    onCreate({
      id: `INV-2026-${1000 + nextIndex + 100}`,
      studentId: student.id,
      studentName: student.name,
      class: student.class,
      session: ACADEMIC_SESSION,
      term,
      issueDate: now.toISOString().slice(0, 10),
      dueDate,
      items,
      discount: disc,
      previousBalance: 0,
      lateCharges: 0,
      total,
      paid: 0,
      status: "Pending",
      attachment: attachment ?? undefined,
    });
  };

  return (
    <Modal title="Generate Invoice" subtitle="Create a student invoice from the fee structure" onClose={onClose} wide
      footer={<><GhostButton onClick={onClose}>Cancel</GhostButton><PrimaryButton onClick={submit}>Generate Invoice ({formatRWF(total)})</PrimaryButton></>}>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Student" value={studentId} onChange={setStudentId} options={STUDENTS.map((s) => s.id)} required />
        <SelectField label="Term" value={term} onChange={setTerm} options={["Term 1", "Term 2", "Term 3"]} required />
      </div>
      <div className="rounded-lg bg-muted/40 p-3 text-sm">
        <span className="font-semibold">{student.name}</span>
        <span className="text-muted-foreground"> · {student.class} · {student.residency}</span>
      </div>
      <div>
        <div className="text-xs font-bold text-muted-foreground mb-2">Fee Items</div>
        <div className="space-y-1.5">
          {FEE_STRUCTURE.map((f) => (
            <label key={f.name} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/30">
              <span className="inline-flex items-center gap-2">
                <input type="checkbox" checked={!!selected[f.name]} onChange={(e) => setSelected((p) => ({ ...p, [f.name]: e.target.checked }))} />
                {f.name} {f.mandatory && <span className="text-[10px] uppercase text-muted-foreground">(mandatory)</span>}
              </span>
              <span className="font-mono text-xs">{formatRWF(f.amounts[lvl] ?? 0)}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Discount (RWF)" value={discount} onChange={setDiscount} placeholder="0" />
        <TextField label="Due Date" value={dueDate} onChange={setDueDate} type="date" required />
      </div>
      <div className="flex justify-between text-sm border-t border-border pt-3">
        <span className="text-muted-foreground">Subtotal {disc > 0 && `− discount ${formatRWF(disc)}`}</span>
        <span className="font-display text-lg font-bold text-primary">{formatRWF(total)}</span>
      </div>
      <FileInput label="Attach Document (optional)" value={attachment} onChange={setAttachment} />
    </Modal>
  );
}

function InvoiceModal({ invoice, onClose }: { invoice: InvoiceRow; onClose: () => void }) {
  const subtotal = invoice.items.reduce((s, i) => s + i.amount, 0);
  const balance = invoice.total - invoice.paid;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-card shadow-2xl border border-border max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-display text-lg font-bold">Invoice {invoice.id}</h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-display text-xl font-bold text-primary">{schoolInvoiceName}</div>
              <p className="text-xs text-muted-foreground">{invoice.session} · {invoice.term}</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Billed to</div>
              <div className="font-semibold">{invoice.studentName}</div>
              <div className="text-xs text-muted-foreground">Class {invoice.class}</div>
            </div>
          </div>

          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr><th className="px-4 py-2 text-left">Fee Item</th><th className="px-4 py-2 text-right">Amount</th></tr>
            </thead>
            <tbody>
              {invoice.items.map((it, i) => (
                <tr key={i} className="border-t border-border"><td className="px-4 py-2.5">{it.label}</td><td className="px-4 py-2.5 text-right font-mono">{formatRWF(it.amount)}</td></tr>
              ))}
            </tbody>
            <tfoot className="text-sm">
              <tr className="border-t border-border"><td className="px-4 py-2 text-right text-muted-foreground">Subtotal</td><td className="px-4 py-2 text-right font-mono">{formatRWF(subtotal)}</td></tr>
              {invoice.previousBalance > 0 && <tr><td className="px-4 py-2 text-right text-muted-foreground">Previous Balance</td><td className="px-4 py-2 text-right font-mono">{formatRWF(invoice.previousBalance)}</td></tr>}
              {invoice.discount > 0 && <tr><td className="px-4 py-2 text-right text-muted-foreground">Discount</td><td className="px-4 py-2 text-right font-mono text-success">− {formatRWF(invoice.discount)}</td></tr>}
              {invoice.lateCharges > 0 && <tr><td className="px-4 py-2 text-right text-muted-foreground">Late Charges</td><td className="px-4 py-2 text-right font-mono text-destructive">{formatRWF(invoice.lateCharges)}</td></tr>}
              <tr className="border-t border-border bg-muted/30"><td className="px-4 py-3 text-right font-bold">Total Due</td><td className="px-4 py-3 text-right font-bold text-primary">{formatRWF(invoice.total)}</td></tr>
              <tr><td className="px-4 py-2 text-right text-muted-foreground">Paid</td><td className="px-4 py-2 text-right font-mono text-success">{formatRWF(invoice.paid)}</td></tr>
              <tr><td className="px-4 py-2 text-right font-semibold">Balance</td><td className="px-4 py-2 text-right font-mono font-semibold text-destructive">{formatRWF(balance)}</td></tr>
            </tfoot>
          </table>

          <div className="flex items-center justify-between">
            <StatusPill label={invoice.status} tone={STATUS_TONE[invoice.status]} />
            <div className="flex gap-2">
              {invoice.attachment && <button onClick={() => openDocument(invoice.attachment!)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"><Download className="h-4 w-4" /> Attachment</button>}
              <button onClick={() => toast.success("Downloading PDF…")} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"><Download className="h-4 w-4" /> PDF</button>
              <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold hover:opacity-90"><Printer className="h-4 w-4" /> Print</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
