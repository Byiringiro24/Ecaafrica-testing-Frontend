/** DOD Patron/Matron management -- view, create, and assign to dormitories */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Users, Trash2, Plus, X, Save } from "lucide-react";
import { toast } from "sonner";
import { DodLayout } from "@/components/layout/DodLayout";
import { directorOfDisciplineRouteGuard } from "@/lib/schoolAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { patronApi, type PatronAssignment } from "@/lib/boardingApi";

export const Route = createFileRoute("/dod/patrons")({
  beforeLoad: ({ location }) => directorOfDisciplineRouteGuard(location),
  component: DodPatronsPage,
});

type StaffUser = { id: string; name: string; email: string | null; role: string };
type Dormitory = { id: string; name: string; gender: string; block_name?: string | null };

const BOARDING_ROLES = [
  { value: "patron",  label: "Patron" },
  { value: "matron",  label: "Matron" },
];

function DodPatronsPage() {
  const [staff,       setStaff]       = useState<StaffUser[]>([]);
  const [dormitories, setDormitories] = useState<Dormitory[]>([]);
  const [assignments, setAssignments] = useState<Record<string, PatronAssignment[]>>({});
  const [loading,     setLoading]     = useState(true);
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [showAssign,  setShowAssign]  = useState<string | null>(null);
  const [selectedDorms, setSelectedDorms] = useState<string[]>([]);
  const [saving,      setSaving]      = useState(false);

  // Create user modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "patron", password: "" });

  const load = async () => {
    setLoading(true);
    try {
      const [allStaff, dorms] = await Promise.all([
        apiRequest<any>("/users?limit=500&role=patron,matron", { auth: "school" }),
        apiRequest<any>("/boarding/dormitories?limit=100", { auth: "school" }),
      ]);
      const staffList: StaffUser[] = (allStaff?.data ?? allStaff ?? []).filter(
        (s: any) => ["patron","matron","director_of_discipline"].includes(s.role)
      );
      setStaff(staffList);
      setDormitories(dorms?.data ?? dorms ?? []);
      const map: Record<string, PatronAssignment[]> = {};
      await Promise.all(staffList.map(async s => {
        map[s.id] = await patronApi.listPatronAssignments(s.id).catch(() => []);
      }));
      setAssignments(map);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load");
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body: any = { name: form.name, role: form.role, password: form.password };
      if (form.email) body.email = form.email;
      if (form.phone) body.phone = form.phone;
      await apiRequest("/users", { method: "POST", auth: "school", body: JSON.stringify(body) });
      toast.success(`${form.name} created as ${form.role}`);
      setShowCreate(false);
      setForm({ name: "", email: "", phone: "", role: "patron", password: "" });
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Failed to create"); }
    finally { setSaving(false); }
  };

  const handleRemove = async (userId: string, dormId: string) => {
    if (!confirm("Remove this dormitory assignment?")) return;
    try {
      await patronApi.remove(userId, dormId);
      toast.success("Removed");
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  const handleAssign = async () => {
    if (!showAssign || !selectedDorms.length) return;
    setSaving(true);
    try {
      await patronApi.assign(showAssign, selectedDorms);
      toast.success("Dormitories assigned");
      setShowAssign(null);
      setSelectedDorms([]);
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  const roleColor = (r: string) => ({
    patron: "bg-blue-100 text-blue-700",
    matron: "bg-pink-100 text-pink-700",
  }[r] ?? "bg-muted text-muted-foreground");

  return (
    <DodLayout title="Patrons & Matrons" subtitle="Manage boarding staff and dormitory assignments">
      {/* Toolbar */}
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{staff.length} boarding staff</p>
        <button onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Create Patron/Matron
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>
      ) : staff.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          <Users className="mx-auto h-10 w-10 mb-3 text-muted-foreground/40" />
          No boarding staff yet. Click "Create Patron/Matron" to add one.
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map(s => {
            const dormAssign = assignments[s.id] ?? [];
            const expanded = expandedId === s.id;
            return (
              <div key={s.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/20"
                  onClick={() => setExpandedId(expanded ? null : s.id)}>
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                    {s.name.split(" ").map((w: string) => w[0]).join("").slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{s.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${roleColor(s.role)}`}>
                        {s.role.replace(/_/g," ")}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">{s.email ?? "No email"}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{dormAssign.length} dorm{dormAssign.length !== 1 ? "s" : ""}</span>
                    <button onClick={e => { e.stopPropagation(); setShowAssign(s.id); setSelectedDorms([]); }}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted">
                      <Plus className="h-3.5 w-3.5" /> Assign Dorm
                    </button>
                  </div>
                </div>
                {expanded && (
                  <div className="border-t border-border p-4">
                    {dormAssign.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No dormitories assigned. Click "Assign Dorm" above.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {dormAssign.map(a => (
                          <div key={a.id} className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5">
                            <span className="text-sm font-medium">{a.dormitory?.name ?? a.dormitory_id}</span>
                            {(a.dormitory as any)?.gender && (
                              <span className="text-[10px] text-muted-foreground">({(a.dormitory as any).gender})</span>
                            )}
                            <button onClick={() => void handleRemove(s.id, a.dormitory_id)}
                              className="ml-1 text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create user modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="font-display font-bold text-lg">Create Boarding Staff</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Full Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required
                  placeholder="e.g. Marie Uwase"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Role *</label>
                <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                  {BOARDING_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
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
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Password *</label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))}
                  required minLength={8} placeholder="Min 8 characters"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  <Save className="h-4 w-4" />
                  {saving ? "Creating..." : "Create User"}
                </button>
                <button type="button" onClick={() => setShowCreate(false)}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign dormitories modal */}
      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
            <h2 className="font-display font-bold text-lg mb-1">Assign Dormitories</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Select dormitories to add. Existing assignments are kept.
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              {dormitories.map(d => {
                const alreadyAssigned = (assignments[showAssign] ?? []).some(a => a.dormitory_id === d.id);
                return (
                  <label key={d.id} className={`flex items-center gap-3 cursor-pointer rounded-lg border p-3 ${alreadyAssigned ? "border-emerald-300 bg-emerald-50 opacity-60" : "border-border hover:bg-muted/30"}`}>
                    <input type="checkbox" checked={selectedDorms.includes(d.id) || alreadyAssigned}
                      disabled={alreadyAssigned}
                      onChange={() => setSelectedDorms(p => p.includes(d.id) ? p.filter(x => x !== d.id) : [...p, d.id])}
                      className="h-4 w-4 rounded" />
                    <div>
                      <div className="font-semibold text-sm">{d.name}{alreadyAssigned ? " (assigned)" : ""}</div>
                      <div className="text-xs text-muted-foreground capitalize">{d.gender}{d.block_name ? ` - ${d.block_name}` : ""}</div>
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button onClick={handleAssign} disabled={saving || selectedDorms.length === 0}
                className="flex-1 rounded-lg bg-primary text-primary-foreground py-2.5 font-semibold text-sm hover:bg-primary/90 disabled:opacity-50">
                {saving ? "Assigning..." : `Assign ${selectedDorms.length} Dorm${selectedDorms.length !== 1 ? "s" : ""}`}
              </button>
              <button onClick={() => setShowAssign(null)}
                className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </DodLayout>
  );
}
