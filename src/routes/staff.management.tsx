/**
 * School Admin / DOD — Staff Management
 * Create, view and manage all school staff users.
 * Assign patron/matron to dormitories from the same page.
 * DOD can only manage boarding-related roles.
 */
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, RefreshCw, Users, Save, X, Home, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiRequest } from "@/lib/api";
import { patronApi } from "@/lib/boardingApi";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getSchoolAuth } from "@/lib/schoolAuth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/staff/management")({
  beforeLoad: () => {
    const auth = getSchoolAuth();
    const role = auth?.user?.role?.toLowerCase();
    if (
      auth?.accessToken &&
      (role === "school_admin" || role === "director_of_discipline" || role === "director_of_studies")
    ) return;
    throw redirect({ to: "/login" });
  },
  component: StaffManagementPage,
});

type StaffUser = {
  id: string; name: string; email: string | null; phone: string | null;
  role: string; status: string; created_at: string; roles?: { slug: string }[];
};
type Dormitory = { id: string; name: string; block_name?: string | null; hostel_name?: string | null; gender: string };

// All roles school_admin can assign; DOD subset is enforced by backend
const ALL_ROLES = [
  { value: "teacher",                label: "Teacher" },
  { value: "staff",                  label: "Staff" },
  { value: "gate_keeper",            label: "Gate Keeper" },
  { value: "patron",                 label: "Patron" },
  { value: "matron",                 label: "Matron" },
  { value: "director_of_discipline", label: "Director of Discipline" },
  { value: "director_of_studies",    label: "Director of Studies" },
  { value: "finance_officer",        label: "Finance Officer" },
  { value: "school_admin",           label: "School Admin" },
];

const DOD_ROLES = [
  "teacher", "staff", "gate_keeper", "patron", "matron",
  "director_of_studies", "finance_officer",
];

const DOS_ROLES = [
  "teacher", "staff",
];

const ROLE_COLOR: Record<string, string> = {
  patron:                 "bg-blue-100 text-blue-700",
  matron:                 "bg-pink-100 text-pink-700",
  director_of_discipline: "bg-purple-100 text-purple-700",
  director_of_studies:    "bg-violet-100 text-violet-700",
  gate_keeper:            "bg-amber-100 text-amber-700",
  teacher:                "bg-emerald-100 text-emerald-700",
  school_admin:           "bg-rose-100 text-rose-700",
};

const emptyForm = { name: "", email: "", phone: "", role: "teacher", secondaryRoles: [] as string[], password: "", status: "active" };

function StaffManagementPage() {
  const user = useCurrentUser();
  const isDod = user?.role === "director_of_discipline";
  const isDos = user?.role === "director_of_studies";
  const availableRoles = isDod
    ? ALL_ROLES.filter(r => DOD_ROLES.includes(r.value))
    : isDos
    ? ALL_ROLES.filter(r => DOS_ROLES.includes(r.value))
    : ALL_ROLES; // school_admin gets all

  const [staff,       setStaff]       = useState<StaffUser[]>([]);
  const [dormitories, setDormitories] = useState<Dormitory[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [search,      setSearch]      = useState("");
  const [filterRole,  setFilterRole]  = useState("");

  // Create / edit form
  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState<string | null>(null);
  const [form,      setForm]      = useState({ ...emptyForm });

  const toggleSecondaryRole = (role: string) => {
    setForm((prev) => {
      const current = prev.secondaryRoles ?? [];
      const exists = current.includes(role);
      return {
        ...prev,
        secondaryRoles: exists ? current.filter((item) => item !== role) : [...current, role]
      };
    });
  };

  // Dorm assignment modal
  const [assignUserId,   setAssignUserId]   = useState<string | null>(null);
  const [assignUserName, setAssignUserName] = useState("");
  const [selectedDorms,  setSelectedDorms]  = useState<string[]>([]);
  const [currentAssign,  setCurrentAssign]  = useState<{ dormitory_id: string; dormitory?: Dormitory | null }[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [usersRes, dormsRes] = await Promise.all([
        apiRequest<{ data: StaffUser[] }>("/users?limit=500", { auth: "school" }),
        apiRequest<{ data: Dormitory[] }>("/boarding/dormitories?limit=200", { auth: "school" }),
      ]);
      setStaff((usersRes as any).data ?? usersRes as any ?? []);
      setDormitories((dormsRes as any).data ?? dormsRes as any ?? []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load staff");
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        const body: any = {
          name: form.name,
          role: form.role,
          roles: (form.secondaryRoles ?? []).filter((role) => role !== form.role),
          status: form.status
        };
        if (form.email) body.email = form.email;
        if (form.phone) body.phone = form.phone;
        if (form.password) body.password = form.password;
        await apiRequest(`/users/${editId}`, { method: "PATCH", auth: "school", body: JSON.stringify(body) });
        toast.success("User updated");
      } else {
        const body: any = {
          name: form.name,
          role: form.role,
          roles: (form.secondaryRoles ?? []).filter((role) => role !== form.role),
          password: form.password
        };
        if (form.email) body.email = form.email;
        if (form.phone) body.phone = form.phone;
        await apiRequest("/users", { method: "POST", auth: "school", body: JSON.stringify(body) });
        toast.success("User created");
      }
      setShowForm(false);
      setEditId(null);
      setForm({ ...emptyForm });
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save user");
    } finally { setSaving(false); }
  };

  const handleDelete = async (u: StaffUser) => {
    if (!confirm(`Delete "${u.name}"? This cannot be undone.`)) return;
    try {
      await apiRequest(`/users/${u.id}`, { method: "DELETE", auth: "school" });
      toast.success("User deleted");
      await load();
    } catch (e: any) { toast.error(e?.message || "Failed to delete"); }
  };

  const startEdit = (u: StaffUser) => {
    setEditId(u.id);
    const secondaryRoles = (u.roles ?? []).map((role) => role.slug).filter((slug) => slug && slug !== u.role);
    setForm({ name: u.name, email: u.email ?? "", phone: u.phone ?? "", role: u.role, secondaryRoles, password: "", status: u.status });
    setShowForm(true);
  };

  const openAssign = async (u: StaffUser) => {
    setAssignUserId(u.id);
    setAssignUserName(u.name);
    setSelectedDorms([]);
    try {
      const list = await patronApi.listPatronAssignments(u.id);
      setCurrentAssign(Array.isArray(list) ? (list as any) : []);
    } catch { setCurrentAssign([]); }
  };

  const handleAssign = async () => {
    if (!assignUserId || selectedDorms.length === 0) return;
    setSaving(true);
    try {
      await patronApi.assign(assignUserId, selectedDorms);
      toast.success(`Assigned ${selectedDorms.length} dormitor${selectedDorms.length !== 1 ? "ies" : "y"} to ${assignUserName}`);
      setAssignUserId(null);
      setSelectedDorms([]);
      await load();
    } catch (e: any) { toast.error(e?.message || "Failed to assign"); }
    finally { setSaving(false); }
  };

  const handleRemoveAssign = async (userId: string, dormId: string) => {
    try {
      await patronApi.remove(userId, dormId);
      toast.success("Assignment removed");
      setCurrentAssign(p => p.filter(a => a.dormitory_id !== dormId));
    } catch (e: any) { toast.error(e?.message || "Failed to remove"); }
  };

  const filtered = staff.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.name.toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
    const matchRole = !filterRole || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const isBoardingRole = (role: string) => ["patron", "matron"].includes(role);
  const assignUser = assignUserId ? staff.find(u => u.id === assignUserId) : undefined;
  const compatibleDormitories = assignUser
    ? dormitories.filter(d => d.gender === (assignUser.role === "patron" ? "male" : "female"))
    : dormitories;

  return (
    <AppLayout title="Staff Management" subtitle="Create and manage school staff users">
      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email..." className="flex-1 min-w-48 rounded-xl border border-border bg-background px-4 py-2.5 text-sm" />
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
          <option value="">All roles</option>
          {availableRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <button onClick={() => void load()} disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
        <Link
          to="/staff/roles"
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted"
        >
          <ShieldCheck className="h-4 w-4" /> Role Management
        </Link>
        <button onClick={() => { setEditId(null); setForm({ ...emptyForm, role: availableRoles[0]?.value ?? "teacher" }); setShowForm(true); }}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Create User
        </button>
      </div>

      {/* Staff list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          <Users className="mx-auto h-10 w-10 mb-3 text-muted-foreground/40" />
          No staff found. Click "Create User" to add your first staff member.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map(u => (
              <div key={u.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/20">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                  {u.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{u.name}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold capitalize", ROLE_COLOR[u.role] ?? "bg-muted text-muted-foreground")}>
                      {u.role.replace(/_/g, " ")}
                    </span>
                    {u.status !== "active" && (
                      <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-bold capitalize">{u.status}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{u.email || u.phone || "No contact"}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isBoardingRole(u.role) && (
                    <button onClick={() => void openAssign(u)}
                      title="Assign dormitories"
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted">
                      <Home className="h-3.5 w-3.5" /> Dorms
                    </button>
                  )}
                  <button onClick={() => startEdit(u)} title="Edit"
                    className="p-1.5 rounded-md border border-border hover:bg-amber-50 hover:text-amber-600 text-muted-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => void handleDelete(u)} title="Delete"
                    className="p-1.5 rounded-md border border-border hover:bg-rose-50 hover:text-rose-600 text-muted-foreground">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="font-display font-bold text-lg">{editId ? "Edit User" : "Create User"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Full Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required
                  placeholder="e.g. John Doe"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
                    placeholder="user@school.ac"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Phone</label>
                  <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                    placeholder="+250..."
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Primary Role *</label>
                  <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))} required
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                    {availableRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                {editId && (
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold">Status</label>
                    <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold">Additional Roles</label>
                <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-background p-2">
                  {availableRoles
                    .filter((role) => role.value !== form.role)
                    .map((role) => {
                      const checked = (form.secondaryRoles ?? []).includes(role.value);
                      return (
                        <button
                          key={role.value}
                          type="button"
                          onClick={() => toggleSecondaryRole(role.value)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs font-medium transition",
                            checked ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground"
                          )}
                        >
                          {role.label}
                        </button>
                      );
                    })}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">{editId ? "New Password (leave blank to keep current)" : "Password *"}</label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))}
                  required={!editId} minLength={8} placeholder={editId ? "Leave blank to keep current" : "Min 8 characters"}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : editId ? "Save Changes" : "Create User"}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dormitory assignment modal */}
      {assignUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-card shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="font-display font-bold text-lg">Dormitory Assignments</h2>
                <p className="text-sm text-muted-foreground">{assignUserName}</p>
              </div>
              <button onClick={() => setAssignUserId(null)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Current assignments */}
              {currentAssign.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Currently Assigned</p>
                  <div className="flex flex-wrap gap-2">
                    {currentAssign.map(a => (
                      <div key={a.dormitory_id} className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm">
                        {(a.dormitory as any)?.name ?? a.dormitory_id}
                        <button onClick={() => void handleRemoveAssign(assignUserId, a.dormitory_id)}
                          className="text-muted-foreground hover:text-destructive ml-1">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Add new */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Add Dormitories</p>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {compatibleDormitories
                    .filter(d => !currentAssign.some(a => a.dormitory_id === d.id))
                    .map(d => (
                      <label key={d.id} className="flex items-center gap-3 cursor-pointer rounded-lg border border-border p-3 hover:bg-muted/30">
                        <input type="checkbox" checked={selectedDorms.includes(d.id)} onChange={() => setSelectedDorms(p => p.includes(d.id) ? p.filter(x => x !== d.id) : [...p, d.id])}
                          className="h-4 w-4 rounded" />
                        <div>
                          <div className="font-semibold text-sm">{d.name}</div>
                          <div className="text-xs text-muted-foreground capitalize">{d.gender}{d.block_name ? ` · ${d.block_name}` : ""}</div>
                        </div>
                      </label>
                    ))}
                  {compatibleDormitories.filter(d => !currentAssign.some(a => a.dormitory_id === d.id)).length === 0 && (
                    <p className="text-sm text-muted-foreground py-3 text-center">All dormitories already assigned</p>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={handleAssign} disabled={saving || selectedDorms.length === 0}
                  className="flex-1 rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
                  {saving ? "Saving..." : `Assign ${selectedDorms.length} Dorm${selectedDorms.length !== 1 ? "s" : ""}`}
                </button>
                <button onClick={() => setAssignUserId(null)}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
