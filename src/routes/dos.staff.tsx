/** DOS — Teaching staff view */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { DosLayout } from "@/components/layout/DosLayout";
import { directorOfStudiesRouteGuard } from "@/lib/schoolAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/dos/staff")({
  beforeLoad: ({ location }) => directorOfStudiesRouteGuard(location),
  component: DosStaffPage,
});

type StaffRecord = { id: string; name: string; email?: string | null; role: string };

function DosStaffPage() {
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "teacher", password: "" });

  const load = () => {
    apiRequest<StaffRecord[]>("/users?limit=500&role=teacher,staff", { auth: "school" })
      .then(d => {
        const list = Array.isArray(d) ? d : (d as any)?.data ?? [];
        setStaff(list.filter((s: StaffRecord) => ["teacher", "staff"].includes(s.role?.toLowerCase() ?? "")));
      })
      .catch(e => toast.error(e?.message ?? "Failed to load staff"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.password.trim()) { toast.error("Name and password required"); return; }
    if (!form.email.trim() && !form.phone.trim()) { toast.error("Email or phone required"); return; }
    setSaving(true);
    try {
      await apiRequest("/users", {
        method: "POST", auth: "school",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          role: form.role,
          password: form.password,
        }),
      });
      toast.success("Staff created");
      setShowCreate(false);
      setForm({ name: "", email: "", phone: "", role: "teacher", password: "" });
      load();
    } catch (e: any) { toast.error(e?.message ?? "Failed to create"); }
    finally { setSaving(false); }
  };

  return (
    <DosLayout title="Teaching Staff" subtitle="View and create academic staff">
      <div className="flex justify-between items-center mb-5">
        <p className="text-sm text-muted-foreground">{staff.length} teaching staff</p>
        <button onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Create Staff
        </button>
      </div>

      {loading ? <Skeleton className="h-64" /> : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                {["Name", "Email", "Role"].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No academic staff found.</td></tr>
              ) : staff.map(s => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{s.email ?? "—"}</td>
                  <td className="px-4 py-3 text-xs capitalize">{s.role.replace(/_/g, " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold">Create Teaching Staff</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Full Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="e.g. John Doe" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Role *</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm">
                  <option value="teacher">Teacher</option>
                  <option value="staff">Staff</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Email</label>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email"
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="email@school.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Phone</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="+250..." />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Temporary Password *</label>
                <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} type="password" required minLength={8}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="Min 8 characters" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">
                  {saving ? "Creating…" : "Create Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DosLayout>
  );
}
