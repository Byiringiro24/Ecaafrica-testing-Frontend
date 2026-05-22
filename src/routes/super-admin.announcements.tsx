import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { SuperAdminBreadcrumbs } from "@/components/layout/SuperAdminBreadcrumbs";
import { SaModal, SaInput, SaSelect, Pagination } from "@/components/super-admin/ui";
import { ANNOUNCEMENTS } from "@/lib/superAdminMockData";

export const Route = createFileRoute("/super-admin/announcements")({ component: AnnouncementsPage });

function AnnouncementsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<(typeof ANNOUNCEMENTS)[0] | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const paginated = ANNOUNCEMENTS.slice((page - 1) * pageSize, page * pageSize);

  return (
    <SuperAdminLayout
      title="Announcements"
      subtitle="Broadcast to school admin dashboards"
      breadcrumbs={<SuperAdminBreadcrumbs items={[{ label: "Super Admin", to: "/super-admin" }, { label: "Announcements" }]} />}
    >
      <div className="flex justify-end mb-4">
        <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">
          <Plus className="h-4 w-4" /> New Announcement
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>{["Title", "Type", "Target", "Sent", "Status", "Read Rate", ""].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {paginated.map(a => (
              <tr key={a.id} className="border-t border-border hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{a.title}</td>
                <td className="px-4 py-3 text-xs">{a.type}</td>
                <td className="px-4 py-3 text-xs">{a.target}</td>
                <td className="px-4 py-3 text-xs">{a.sentDate}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${a.status === "Sent" ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}>{a.status}</span></td>
                <td className="px-4 py-3">{a.readRate ? `${a.readRate}%` : "—"}</td>
                <td className="px-4 py-3"><button type="button" onClick={() => setDetail(a)} className="text-xs font-semibold text-primary hover:underline">View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination total={ANNOUNCEMENTS.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={() => {}} />
      </div>

      <SaModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Announcement"
        wide
        footer={
          <div className="flex gap-2 justify-end">
            <button type="button" className="rounded-lg border px-4 py-2 text-sm font-semibold">Save Draft</button>
            <button type="button" onClick={() => { toast.success("Scheduled"); setCreateOpen(false); }} className="rounded-lg border px-4 py-2 text-sm font-semibold">Schedule</button>
            <button type="button" onClick={() => { toast.success("Broadcast sent"); setCreateOpen(false); }} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">Send Now</button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <SaInput label="Title *" className="col-span-2" />
          <SaSelect label="Type"><option>Info</option><option>Warning</option><option>Critical Update</option><option>Maintenance Notice</option><option>New Feature</option></SaSelect>
          <SaSelect label="Target"><option>All Schools</option><option>By Plan</option><option>By Province</option><option>Specific Schools</option></SaSelect>
          <div className="col-span-2"><label className="text-xs font-semibold">Message</label><textarea rows={5} className="w-full mt-1 rounded-lg border border-border p-3 text-sm" /></div>
          <SaSelect label="Delivery"><option>Immediately</option><option>Schedule</option></SaSelect>
          <SaInput label="Schedule date" type="datetime-local" />
          <label className="flex items-center gap-2 text-sm col-span-2"><input type="checkbox" defaultChecked /> In-App Banner</label>
          <label className="flex items-center gap-2 text-sm col-span-2"><input type="checkbox" /> Email to admins</label>
        </div>
        <div className="mt-4 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-sm">
          <strong>Preview:</strong> Banner will appear at top of school admin dashboard.
        </div>
      </SaModal>

      {detail && (
        <SaModal open onClose={() => setDetail(null)} title={detail.title}>
          <dl className="text-sm space-y-2">
            <div><dt className="text-muted-foreground text-xs">Sent to</dt><dd>8 schools</dd></div>
            <div><dt className="text-muted-foreground text-xs">Read by</dt><dd>6 admins ({detail.readRate}% open rate)</dd></div>
          </dl>
        </SaModal>
      )}
    </SuperAdminLayout>
  );
}
