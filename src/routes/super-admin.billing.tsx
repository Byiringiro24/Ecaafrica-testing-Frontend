import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Printer } from "lucide-react";
import { toast } from "sonner";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { SuperAdminBreadcrumbs } from "@/components/layout/SuperAdminBreadcrumbs";
import { StatCard } from "@/components/ui-kit/StatCard";
import { PageTabs, SaModal, SaInput, SaSelect, Pagination, ConfirmDialog } from "@/components/super-admin/ui";
import { PLATFORM_INVOICES, MOCK_PLATFORM_SCHOOLS } from "@/lib/superAdminMockData";
import { formatRWF } from "@/lib/mockData";

export const Route = createFileRoute("/super-admin/billing")({ component: BillingPage });

const TABS = ["All Invoices", "Outstanding", "Paid", "Overdue", "Void"];

function BillingPage() {
  const [tab, setTab] = useState<typeof TABS[number]>("All Invoices");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailInv, setDetailInv] = useState<(typeof PLATFORM_INVOICES)[0] | null>(null);
  const [voidTarget, setVoidTarget] = useState<(typeof PLATFORM_INVOICES)[0] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (tab === "All Invoices") return PLATFORM_INVOICES;
    if (tab === "Outstanding") return PLATFORM_INVOICES.filter(i => i.status === "pending");
    if (tab === "Paid") return PLATFORM_INVOICES.filter(i => i.status === "paid");
    if (tab === "Overdue") return PLATFORM_INVOICES.filter(i => i.status === "overdue");
    return PLATFORM_INVOICES.filter(i => i.status === "void");
  }, [tab]);

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const outstanding = PLATFORM_INVOICES.filter(i => i.status === "overdue" || i.status === "pending").reduce((s, i) => s + i.amount, 0);

  return (
    <SuperAdminLayout
      title="Billing & Invoices"
      breadcrumbs={<SuperAdminBreadcrumbs items={[{ label: "Super Admin", to: "/super-admin" }, { label: "Billing" }]} />}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="This Month" value={formatRWF(348000)} tone="success" />
        <StatCard label="Last Month" value={formatRWF(312000)} />
        <StatCard label="YTD Revenue" value={formatRWF(4200000)} tone="success" />
        <StatCard label="Outstanding" value={formatRWF(outstanding)} tone={outstanding > 0 ? "destructive" : "primary"} />
      </div>

      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <PageTabs tabs={[...TABS]} active={tab} onChange={t => { setTab(t as typeof tab); setPage(1); }} />
        <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold shrink-0">
          <Plus className="h-4 w-4" /> Create Invoice
        </button>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex gap-2 text-xs">
          <button type="button" onClick={() => toast.success("Reminders sent")} className="rounded-lg border px-3 py-1.5 font-semibold">Send Reminders</button>
          <button type="button" className="rounded-lg border px-3 py-1.5 font-semibold">Export CSV</button>
          <button type="button" onClick={() => toast.success("Marked paid")} className="rounded-lg border px-3 py-1.5 font-semibold">Bulk Mark Paid</button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 w-8"><input type="checkbox" onChange={e => setSelected(e.target.checked ? new Set(paginated.map(i => i.id)) : new Set())} /></th>
              {["Invoice #", "School", "Period", "Issue", "Due", "Amount", "Status", "Paid", ""].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">No invoices in this tab</td></tr>
            ) : paginated.map(inv => (
              <tr key={inv.id} className="border-t border-border hover:bg-muted/20">
                <td className="px-4 py-3"><input type="checkbox" checked={selected.has(inv.id)} onChange={e => { const n = new Set(selected); e.target.checked ? n.add(inv.id) : n.delete(inv.id); setSelected(n); }} /></td>
                <td className="px-4 py-3 font-mono text-xs">{inv.id}</td>
                <td className="px-4 py-3">{inv.schoolName}</td>
                <td className="px-4 py-3 text-xs">{inv.period}</td>
                <td className="px-4 py-3 text-xs">{inv.issueDate}</td>
                <td className="px-4 py-3 text-xs">{inv.dueDate}</td>
                <td className="px-4 py-3 font-semibold">{formatRWF(inv.amount)}</td>
                <td className="px-4 py-3"><InvoiceStatus status={inv.status} /></td>
                <td className="px-4 py-3 text-xs">{inv.paymentDate ?? "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap space-x-2">
                  <button type="button" onClick={() => setDetailInv(inv)} className="text-xs font-semibold text-primary hover:underline">View</button>
                  <button type="button" onClick={() => toast.info("PDF downloaded")} className="text-xs hover:underline">Download</button>
                  {inv.status === "overdue" && <button type="button" onClick={() => toast.success("Reminder sent")} className="text-xs hover:underline">Remind</button>}
                  {inv.status === "pending" && <button type="button" onClick={() => toast.success("Marked paid")} className="text-xs hover:underline">Mark Paid</button>}
                  <button type="button" onClick={() => setVoidTarget(inv)} className="text-xs text-destructive hover:underline">Void</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination total={filtered.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={n => { setPageSize(n); setPage(1); }} />
      </div>

      <CreateInvoiceModal open={createOpen} onClose={() => setCreateOpen(false)} />
      {detailInv && <InvoiceDetailModal invoice={detailInv} onClose={() => setDetailInv(null)} />}
      <ConfirmDialog open={!!voidTarget} onClose={() => setVoidTarget(null)} onConfirm={() => toast.success("Invoice voided")} title="Void invoice?" description="This cannot be undone." confirmLabel="Void" destructive />
    </SuperAdminLayout>
  );
}

function InvoiceStatus({ status }: { status: string }) {
  const cls = status === "paid" ? "bg-emerald-100 text-emerald-800" : status === "overdue" ? "bg-destructive/10 text-destructive" : status === "pending" ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${cls}`}>{status}</span>;
}

function CreateInvoiceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [lines, setLines] = useState([{ desc: "", qty: 1, price: 0 }]);
  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const [vat, setVat] = useState(true);
  const total = subtotal * (vat ? 1.18 : 1);
  if (!open) return null;
  return (
    <SaModal open onClose={onClose} title="Create Invoice" wide footer={
      <div className="flex gap-2 justify-end">
        <button type="button" className="rounded-lg border px-4 py-2 text-sm font-semibold">Save as Draft</button>
        <button type="button" onClick={() => { toast.success("Invoice issued"); onClose(); }} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">Issue Invoice</button>
      </div>
    }>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <SaSelect label="School">{MOCK_PLATFORM_SCHOOLS.map(s => <option key={s.id}>{s.name}</option>)}</SaSelect>
        <SaInput label="Invoice Date" type="date" defaultValue="2026-05-21" />
        <SaInput label="Due Date" type="date" defaultValue="2026-06-05" />
      </div>
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-4 gap-2 mb-2">
          <SaInput label="Description" className="col-span-2" />
          <SaInput label="Qty" type="number" defaultValue="1" />
          <SaInput label="Unit Price" type="number" />
        </div>
      ))}
      <button type="button" onClick={() => setLines([...lines, { desc: "", qty: 1, price: 0 }])} className="text-xs font-semibold text-primary mb-4">+ Add line item</button>
      <div className="text-sm space-y-1 border-t pt-3">
        <div className="flex justify-between"><span>Subtotal</span><span>{formatRWF(subtotal)}</span></div>
        <label className="flex items-center gap-2"><input type="checkbox" checked={vat} onChange={e => setVat(e.target.checked)} /> VAT 18%</label>
        <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{formatRWF(Math.round(total))}</span></div>
      </div>
      <textarea rows={2} placeholder="Notes" className="w-full mt-3 rounded-lg border border-border p-3 text-sm" />
    </SaModal>
  );
}

function InvoiceDetailModal({ invoice, onClose }: { invoice: (typeof PLATFORM_INVOICES)[0]; onClose: () => void }) {
  return (
    <SaModal open onClose={onClose} title="" wide>
      <div className="invoice-print relative p-6 border border-border rounded-lg bg-white text-foreground">
        {invoice.status === "paid" && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><span className="text-6xl font-black text-emerald-500/20 -rotate-12">PAID</span></div>}
        {invoice.status === "overdue" && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><span className="text-6xl font-black text-red-500/20 -rotate-12">OVERDUE</span></div>}
        <div className="flex justify-between mb-6">
          <div><div className="font-display font-bold text-xl">SchoolOS</div><div className="text-xs text-muted-foreground">Netrack Company Ltd</div></div>
          <div className="text-right text-sm"><div className="font-mono font-bold">{invoice.id}</div><div>Issued: {invoice.issueDate}</div><div>Due: {invoice.dueDate}</div></div>
        </div>
        <div className="mb-4 text-sm"><strong>Bill To:</strong><br />{invoice.schoolName}<br />Kigali, Rwanda</div>
        <table className="w-full text-sm mb-4"><thead><tr className="border-b"><th className="text-left py-2">Description</th><th className="text-right py-2">Amount</th></tr></thead>
          <tbody><tr><td className="py-2">Platform subscription — {invoice.period}</td><td className="text-right py-2 font-semibold">{formatRWF(invoice.amount)}</td></tr></tbody>
        </table>
        <div className="text-right text-2xl font-bold">{formatRWF(invoice.amount)}</div>
        <p className="text-xs text-muted-foreground mt-4">Pay via Bank: BK 1234567890 · MTN MoMo: *182*8*1#</p>
        <div className="flex gap-2 mt-6 print:hidden">
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold"><Printer className="h-3.5 w-3.5" /> Download PDF</button>
          <button type="button" onClick={() => toast.success("Sent to school")} className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold">Send to School</button>
          <button type="button" onClick={() => toast.success("Marked paid")} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Mark as Paid</button>
        </div>
      </div>
    </SaModal>
  );
}
