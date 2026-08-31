/** DOD Patron/Matron management — view all and manage their dormitory assignments */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, Trash2, Plus } from "lucide-react";
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

type StaffUser = { id: string; name: string; email: string; role: string };
type Dormitory = { id: string; name: string; gender: string };

function DodPatronsPage() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [dormitories, setDormitories] = useState<Dormitory[]>([]);
  const [assignments, setAssignments] = useState<Record<string, PatronAssignment[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState<string | null>(null);
  const [selectedDorms, setSelectedDorms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [allStaff, dorms] = await Promise.all([
        apiRequest<StaffUser[]>("/staff?limit=500", { auth: "school" }),
        apiRequest<Dormitory[]>("/boarding/dormitories?limit=100", { auth: "school" }),
      ]);
      const boardingRoles = ["patron", "matron", "boarding_officer", "director_of_discipline"];
      const boardingStaff = (Array.isArray(allStaff) ? allStaff : []).filter(s => boardingRoles.includes(s.role?.toLowerCase() ?? ""));
      setStaff(boardingStaff);
      setDormitories(Array.isArray(dorms) ? dorms : []);

      // Load assignments for each patron
      const assignMap: Record<string, PatronAssignment[]> = {};
      await Promise.all(boardingStaff.map(async s => {
        const list = await patronApi.listPatronAssignments(s.id).catch(() => [] as PatronAssignment[]);
        assignMap[s.id] = Array.isArray(list) ? list : [];
      }));
      setAssignments(assignMap);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load patrons");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleRemove = async (userId: string, dormId: string) => {
    if (!confirm("Remove this dormitory assignment?")) return;
    try {
      await patronApi.remove(userId, dormId);
      toast.success("Assignment removed");
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Failed to remove"); }
  };

  const handleAssign = async () => {
    if (!showAssign || selectedDorms.length === 0) return;
    setSaving(true);
    try {
      await patronApi.assign(showAssign, selectedDorms);
      toast.success("Dormitories assigned");
      setShowAssign(null);
      setSelectedDorms([]);
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Failed to assign"); } finally { setSaving(false); }
  };

  const toggleDorm = (id: string) => setSelectedDorms(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);

  const roleColor = (role: string) => {
    if (role === "patron") return "bg-blue-100 text-blue-700";
    if (role === "matron") return "bg-pink-100 text-pink-700";
    return "bg-muted text-muted-foreground";
  };

  return (
    <DodLayout title="Patrons & Matrons" subtitle="Manage dormitory assignments for boarding staff">
      {loading ? (
        <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}</div>
      ) : staff.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No boarding staff found. Create users with role "patron" or "matron" in Staff Management to assign them here.
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map(s => {
            const dormAssignments = assignments[s.id] ?? [];
            const expanded = expandedUserId === s.id;
            return (
              <div key={s.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/20"
                  onClick={() => setExpandedUserId(expanded ? null : s.id)}>
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                    {s.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{s.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${roleColor(s.role)}`}>
                        {s.role.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">{s.email}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{dormAssignments.length} dorm{dormAssignments.length !== 1 ? "s" : ""}</span>
                    <button onClick={e => { e.stopPropagation(); setShowAssign(s.id); setSelectedDorms([]); }}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted">
                      <Plus className="h-3.5 w-3.5" /> Assign
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-border p-4">
                    {dormAssignments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No dormitories assigned yet. Click "Assign" to add.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {dormAssignments.map(a => (
                          <div key={a.id} className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5">
                            <span className="text-sm font-medium">{a.dormitory?.name ?? a.dormitory_id}</span>
                            {a.dormitory?.gender && (
                              <span className="text-[10px] text-muted-foreground">({a.dormitory.gender})</span>
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

      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
            <h2 className="font-display font-bold text-lg mb-3">Assign Dormitories</h2>
            <p className="text-sm text-muted-foreground mb-4">Select one or more dormitories to assign to this staff member. Existing assignments are kept.</p>
            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              {dormitories.map(d => (
                <label key={d.id} className="flex items-center gap-3 cursor-pointer rounded-lg border border-border p-3 hover:bg-muted/30">
                  <input type="checkbox" checked={selectedDorms.includes(d.id)} onChange={() => toggleDorm(d.id)}
                    className="h-4 w-4 rounded" />
                  <div>
                    <div className="font-semibold text-sm">{d.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{d.gender}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={handleAssign} disabled={saving || selectedDorms.length === 0}
                className="flex-1 rounded-lg bg-primary text-primary-foreground py-2.5 font-semibold text-sm hover:bg-primary/90 disabled:opacity-50">
                {saving ? "Assigning…" : `Assign ${selectedDorms.length} Dorm${selectedDorms.length !== 1 ? "s" : ""}`}
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
