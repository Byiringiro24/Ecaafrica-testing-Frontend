import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { SuperAdminBreadcrumbs } from "@/components/layout/SuperAdminBreadcrumbs";
import { SaModal, SaInput, SaSelect, PageTabs, Pagination } from "@/components/super-admin/ui";
import { PLATFORM_USERS, MOCK_PLATFORM_SCHOOLS } from "@/lib/superAdminMockData";

export const Route = createFileRoute("/super-admin/users")({ component: UsersPage });

const ROLE_TABS = ["All", "Platform Admin", "Support", "Sales", "Finance", "Developers"];

function UsersPage() {
  const [roleTab, setRoleTab] = useState("All");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<(typeof PLATFORM_USERS)[0] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    if (roleTab === "All") return PLATFORM_USERS;
    const map: Record<string, string> = { Developers: "Developer" };
    const role = map[roleTab] ?? roleTab;
    return PLATFORM_USERS.filter(u => u.role === role || (roleTab === "Developers" && u.role === "Developer"));
  }, [roleTab]);

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <SuperAdminLayout
      title="Platform Users"
      subtitle="Internal Netrack / SchoolOS team accounts"
      breadcrumbs={<SuperAdminBreadcrumbs items={[{ label: "Super Admin", to: "/super-admin" }, { label: "Platform Users" }]} />}
    >
      <div className="flex justify-end mb-4">
        <button type="button" onClick={() => setInviteOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">
          <Plus className="h-4 w-4" /> Invite User
        </button>
      </div>

      <PageTabs tabs={ROLE_TABS} active={roleTab} onChange={t => { setRoleTab(t); setPage(1); }} />

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>{["", "Name", "Email", "Role", "Last Login", "Status", "Permissions", ""].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {paginated.map(u => (
              <tr key={u.id} className="border-t border-border hover:bg-muted/20">
                <td className="px-4 py-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-amber-100 text-amber-800 font-bold text-xs">
                    {u.name.split(" ").map(p => p[0]).join("").slice(0, 2)}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-xs">{u.email}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-bold">{u.role}</span></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{u.lastLogin}</td>
                <td className="px-4 py-3">{u.status}</td>
                <td className="px-4 py-3 text-xs">{u.permissions}</td>
                <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                  <button type="button" onClick={() => setEditUser(u)} className="text-xs font-semibold text-primary hover:underline">Edit</button>
                  <button type="button" onClick={() => toast.info(`${u.name} deactivated`)} className="text-xs text-muted-foreground hover:underline">Deactivate</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination total={filtered.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={n => { setPageSize(n); setPage(1); }} />
      </div>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <PermissionsDrawer user={editUser} onClose={() => setEditUser(null)} />
    </SuperAdminLayout>
  );
}

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <SaModal
      open
      onClose={onClose}
      title="Invite User"
      footer={
        <button type="button" onClick={() => { toast.success("Invite sent"); onClose(); }} className="w-full rounded-lg bg-primary text-primary-foreground py-2 text-sm font-semibold">
          Send Invite Email
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <SaInput label="Name *" />
        <SaInput label="Email *" type="email" />
        <SaSelect label="Role" className="col-span-2">
          <option>Platform Admin</option><option>Support</option><option>Sales</option><option>Finance</option><option>Developer</option><option>Read-only</option>
        </SaSelect>
        <SaSelect label="Access Level" className="col-span-2">
          <option>All Schools</option><option>Assigned Schools only</option>
        </SaSelect>
        <SaSelect label="Assigned Schools" className="col-span-2" multiple>
          {MOCK_PLATFORM_SCHOOLS.map(s => <option key={s.id}>{s.name}</option>)}
        </SaSelect>
      </div>
    </SaModal>
  );
}

function PermissionsDrawer({ user, onClose }: { user: (typeof PLATFORM_USERS)[0] | null; onClose: () => void }) {
  const perms = [
    "Can onboard schools",
    "Can modify subscriptions",
    "Can view billing",
    "Can modify system settings",
    "Can access audit logs",
    "Can create invoices",
    "Can suspend schools",
  ];
  if (!user) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md bg-card h-full shadow-2xl flex flex-col border-l border-border" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border">
          <h3 className="font-display font-semibold">Edit Permissions</h3>
          <p className="text-sm text-muted-foreground">{user.name}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {perms.map(p => (
            <label key={p} className="flex items-center justify-between border-b border-border pb-2 text-sm">
              <span>{p}</span>
              <input type="checkbox" defaultChecked={user.role === "Platform Admin"} />
            </label>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-border">
          <button type="button" onClick={() => { toast.success("Permissions saved"); onClose(); }} className="w-full rounded-lg bg-primary text-primary-foreground py-2 text-sm font-semibold">Save</button>
        </div>
      </div>
    </div>
  );
}
