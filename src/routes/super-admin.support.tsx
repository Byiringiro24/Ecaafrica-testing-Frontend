import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { SuperAdminBreadcrumbs } from "@/components/layout/SuperAdminBreadcrumbs";
import { StatCard } from "@/components/ui-kit/StatCard";
import { SaModal, SaInput, SaSelect, FilterBar, Pagination } from "@/components/super-admin/ui";
import { SUPPORT_TICKETS, MOCK_PLATFORM_SCHOOLS } from "@/lib/superAdminMockData";

export const Route = createFileRoute("/super-admin/support")({ component: SupportPage });

function SupportPage() {
  const [statusF, setStatusF] = useState("All");
  const [priorityF, setPriorityF] = useState("All");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [ticket, setTicket] = useState<(typeof SUPPORT_TICKETS)[0] | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const filtered = useMemo(() => {
    let r = [...SUPPORT_TICKETS];
    if (statusF !== "All") r = r.filter(t => t.status === statusF);
    if (priorityF !== "All") r = r.filter(t => t.priority === priorityF);
    return r;
  }, [statusF, priorityF]);

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <SuperAdminLayout
      title="Support Tickets"
      breadcrumbs={<SuperAdminBreadcrumbs items={[{ label: "Super Admin", to: "/super-admin" }, { label: "Support" }]} />}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Open" value={SUPPORT_TICKETS.filter(t => t.status === "Open").length} />
        <StatCard label="In Progress" value={SUPPORT_TICKETS.filter(t => t.status === "In Progress").length} tone="warning" />
        <StatCard label="Resolved Today" value={1} tone="success" />
        <StatCard label="Avg Response" value="2.4h" />
      </div>

      <div className="flex justify-between items-center mb-4">
        <FilterBar>
          <select value={statusF} onChange={e => setStatusF(e.target.value)} className="h-10 rounded-lg border border-border px-3 text-sm"><option>All</option><option>Open</option><option>In Progress</option><option>Resolved</option></select>
          <select value={priorityF} onChange={e => setPriorityF(e.target.value)} className="h-10 rounded-lg border border-border px-3 text-sm"><option>All</option><option>High</option><option>Medium</option><option>Low</option></select>
        </FilterBar>
        <button type="button" onClick={() => setNewOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold shrink-0">
          <Plus className="h-4 w-4" /> New Ticket
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>{["Ticket #", "School", "Subject", "Category", "Priority", "Assigned", "Created", "Updated", "Status"].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {paginated.map(t => (
              <tr key={t.id} onClick={() => setTicket(t)} className="border-t border-border hover:bg-muted/20 cursor-pointer">
                <td className="px-4 py-3 font-mono text-xs">{t.id}</td>
                <td className="px-4 py-3">{t.school}</td>
                <td className="px-4 py-3 font-medium max-w-[200px] truncate">{t.subject}</td>
                <td className="px-4 py-3 text-xs">{t.category}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${t.priority === "High" ? "bg-destructive/10 text-destructive" : t.priority === "Medium" ? "bg-amber-100 text-amber-800" : "bg-muted"}`}>{t.priority}</span></td>
                <td className="px-4 py-3 text-xs">{t.assigned}</td>
                <td className="px-4 py-3 text-xs">{t.created}</td>
                <td className="px-4 py-3 text-xs">{t.updated}</td>
                <td className="px-4 py-3 text-xs">{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination total={filtered.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={n => { setPageSize(n); setPage(1); }} />
      </div>

      {ticket && <TicketDrawer ticket={ticket} onClose={() => setTicket(null)} />}
      <SaModal open={newOpen} onClose={() => setNewOpen(false)} title="New Support Ticket" footer={
        <button type="button" onClick={() => { toast.success("Ticket created"); setNewOpen(false); }} className="w-full rounded-lg bg-primary text-primary-foreground py-2 text-sm font-semibold">Create</button>
      }>
        <div className="space-y-3">
          <SaSelect label="School">{MOCK_PLATFORM_SCHOOLS.map(s => <option key={s.id}>{s.name}</option>)}</SaSelect>
          <SaInput label="Subject" />
          <SaSelect label="Category"><option>Technical</option><option>Billing</option><option>Feature Request</option><option>Other</option></SaSelect>
          <SaSelect label="Priority"><option>High</option><option>Medium</option><option>Low</option></SaSelect>
          <textarea rows={4} placeholder="Description" className="w-full rounded-lg border border-border p-3 text-sm" />
          <SaSelect label="Assign to"><option>Uwase Claudine</option><option>Ingabire Beatrice</option></SaSelect>
        </div>
      </SaModal>
    </SuperAdminLayout>
  );
}

function TicketDrawer({ ticket, onClose }: { ticket: (typeof SUPPORT_TICKETS)[0]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg bg-card h-full shadow-2xl flex flex-col border-l border-border" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border">
          <div className="font-mono text-xs text-muted-foreground">{ticket.id}</div>
          <h3 className="font-display font-semibold text-lg">{ticket.subject}</h3>
          <div className="flex gap-2 mt-2 text-xs">
            <span className="rounded-full bg-destructive/10 text-destructive px-2 py-0.5 font-bold">{ticket.priority}</span>
            <span>{ticket.status}</span>
            <span className="text-muted-foreground">{ticket.school}</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <p className="text-sm text-muted-foreground">School admin reported SMS delivery failures for attendance alerts. Batch #4421 shows 14 undelivered messages.</p>
          <div className="rounded-lg bg-muted/30 p-3 text-sm">
            <div className="font-semibold text-xs mb-1">School Admin · May 14</div>
            Parents did not receive SMS since yesterday afternoon.
          </div>
          <div className="rounded-lg bg-primary/5 p-3 text-sm ml-4">
            <div className="font-semibold text-xs mb-1">Support · May 15</div>
            We are checking Pindo API status for your sender ID.
          </div>
          <div>
            <label className="text-xs font-semibold">Internal notes</label>
            <textarea rows={2} className="w-full mt-1 rounded-lg border border-border p-2 text-sm" placeholder="Not visible to school" />
          </div>
          <SaSelect label="Status"><option>Open</option><option>In Progress</option><option>Resolved</option></SaSelect>
          <SaSelect label="Assign to"><option>{ticket.assigned}</option><option>Karera Thierry</option></SaSelect>
          <textarea rows={3} placeholder="Reply to school admin..." className="w-full rounded-lg border border-border p-3 text-sm" />
        </div>
        <div className="px-6 py-4 border-t border-border flex gap-2">
          <button type="button" onClick={() => toast.success("Reply sent")} className="flex-1 rounded-lg bg-primary text-primary-foreground py-2 text-sm font-semibold">Send</button>
          <button type="button" onClick={() => toast.success("Resolved")} className="rounded-lg border px-3 py-2 text-sm font-semibold">Resolve</button>
          <button type="button" onClick={() => toast.info("Escalated")} className="rounded-lg border px-3 py-2 text-sm font-semibold">Escalate</button>
        </div>
      </div>
    </div>
  );
}
