/**
 * DOD Dormitory Management — create/edit dormitories, rooms, beds, assign patrons/matrons.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Users, Home } from "lucide-react";
import { toast } from "sonner";
import { DodLayout } from "@/components/layout/DodLayout";
import { directorOfDisciplineRouteGuard } from "@/lib/schoolAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { patronApi, type PatronAssignment } from "@/lib/boardingApi";

export const Route = createFileRoute("/dod/dormitories")({
  beforeLoad: ({ location }) => directorOfDisciplineRouteGuard(location),
  component: DodDormitoriesPage,
});

type Dormitory = {
  id: string; name: string; gender: string;
  hostel_name?: string | null; block_name?: string | null;
  building?: string | null; capacity?: number; is_active?: boolean;
};
type Room = { id: string; dormitory_id: string; room_number: string; capacity?: number; bed_count?: number };

function DodDormitoriesPage() {
  const [dormitories, setDormitories] = useState<Dormitory[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [patrons, setPatrons] = useState<{ dormId: string; assignments: PatronAssignment[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDorm, setSelectedDorm] = useState<Dormitory | null>(null);
  const [showDormForm, setShowDormForm] = useState(false);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [showPatronForm, setShowPatronForm] = useState(false);
  const [editingDorm, setEditingDorm] = useState<Dormitory | null>(null);

  const [dormForm, setDormForm] = useState({ name: "", gender: "male", hostel_name: "", block_name: "", building: "", capacity: "60" });
  const [roomForm, setRoomForm] = useState({ room_number: "", capacity: "6", bed_count: "6" });
  const [availableStaff, setAvailableStaff] = useState<{ id: string; name: string; role: string }[]>([]);
  const [patronUserId, setPatronUserId] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [dorms, rms, staff] = await Promise.all([
        apiRequest<Dormitory[]>("/boarding/dormitories?limit=100", { auth: "school" }),
        apiRequest<Room[]>("/boarding/rooms?limit=500", { auth: "school" }),
        apiRequest<{ id: string; name: string; role: string }[]>("/staff?limit=200", { auth: "school" }).catch(() => []),
      ]);
      const dormList = Array.isArray(dorms) ? dorms : [];
      setDormitories(dormList);
      setRooms(Array.isArray(rms) ? rms : []);
      // Filter staff to boarding roles
      const boardingStaff = (Array.isArray(staff) ? staff : []).filter(s =>
        ["patron", "matron"].includes(s.role?.toLowerCase() ?? "")
      );
      setAvailableStaff(boardingStaff);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load dormitories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const roomsForDorm = (dormId: string) => rooms.filter(r => r.dormitory_id === dormId);

  const handleSaveDorm = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name: dormForm.name, gender: dormForm.gender, hostel_name: dormForm.hostel_name || undefined, block_name: dormForm.block_name || undefined, building: dormForm.building || undefined, capacity: Number(dormForm.capacity) };
    try {
      if (editingDorm) {
        await apiRequest(`/boarding/dormitories/${editingDorm.id}`, { method: "PATCH", body: JSON.stringify(payload), auth: "school" });
        toast.success("Dormitory updated");
      } else {
        await apiRequest("/boarding/dormitories", { method: "POST", body: JSON.stringify(payload), auth: "school" });
        toast.success("Dormitory created");
      }
      setShowDormForm(false);
      setEditingDorm(null);
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Failed to save dormitory"); }
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDorm) return;
    try {
      await apiRequest("/boarding/rooms", { method: "POST", body: JSON.stringify({ dormitory_id: selectedDorm.id, room_number: roomForm.room_number, capacity: Number(roomForm.capacity), bed_count: Number(roomForm.bed_count) }), auth: "school" });
      toast.success("Room added");
      setShowRoomForm(false);
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Failed to add room"); }
  };

  const handleAssignPatron = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDorm || !patronUserId) return;
    try {
      await patronApi.assign(patronUserId, [selectedDorm.id]);
      toast.success("Patron/Matron assigned to dormitory");
      setShowPatronForm(false);
      setPatronUserId("");
    } catch (e: any) { toast.error(e?.message ?? "Failed to assign patron"); }
  };

  const openEdit = (d: Dormitory) => {
    setEditingDorm(d);
    setDormForm({ name: d.name, gender: d.gender, hostel_name: d.hostel_name ?? "", block_name: d.block_name ?? "", building: d.building ?? "", capacity: String(d.capacity ?? 60) });
    setShowDormForm(true);
  };

  return (
    <DodLayout title="Dormitory Management" subtitle="Manage hostels, blocks, rooms, and patron assignments">
      <div className="flex justify-between items-center mb-5">
        <p className="text-sm text-muted-foreground">Structure: School → Hostel → Block → Room → Bed → Student</p>
        <button onClick={() => { setEditingDorm(null); setDormForm({ name: "", gender: "male", hostel_name: "", block_name: "", building: "", capacity: "60" }); setShowDormForm(true); }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add Dormitory
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}</div>
      ) : dormitories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-14 text-center text-muted-foreground text-sm">
          No dormitories yet. Click "Add Dormitory" to create the first one.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {dormitories.map(d => {
            const dormRooms = roomsForDorm(d.id);
            return (
              <div key={d.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-primary" />
                      <span className="font-display font-bold">{d.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${d.gender === "female" ? "bg-pink-100 text-pink-700" : "bg-blue-100 text-blue-700"}`}>{d.gender}</span>
                    </div>
                    {(d.hostel_name || d.block_name) && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {[d.hostel_name, d.block_name].filter(Boolean).join(" › ")}
                      </div>
                    )}
                    {d.building && <div className="text-xs text-muted-foreground">{d.building}</div>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(d)} className="rounded-md p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground">
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex gap-4 text-xs text-muted-foreground mb-3">
                  <span>Capacity: <strong className="text-foreground">{d.capacity ?? "—"}</strong></span>
                  <span>Rooms: <strong className="text-foreground">{dormRooms.length}</strong></span>
                </div>

                {/* Rooms list */}
                {dormRooms.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {dormRooms.slice(0, 8).map(r => (
                      <span key={r.id} className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-mono">
                        {r.room_number}
                      </span>
                    ))}
                    {dormRooms.length > 8 && <span className="text-xs text-muted-foreground">+{dormRooms.length - 8} more</span>}
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={() => { setSelectedDorm(d); setRoomForm({ room_number: "", capacity: "6", bed_count: "6" }); setShowRoomForm(true); }}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted">
                    <Plus className="h-3.5 w-3.5" /> Room
                  </button>
                  <button onClick={() => { setSelectedDorm(d); setShowPatronForm(true); }}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted">
                    <Users className="h-3.5 w-3.5" /> Assign Patron
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dormitory form */}
      {showDormForm && (
        <Modal title={editingDorm ? "Edit Dormitory" : "Add Dormitory"} onClose={() => setShowDormForm(false)}>
          <form onSubmit={handleSaveDorm} className="space-y-4">
            <Field label="Dormitory Name *"><input value={dormForm.name} onChange={e => setDormForm(p => ({ ...p, name: e.target.value }))} required className="field" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Gender">
                <select value={dormForm.gender} onChange={e => setDormForm(p => ({ ...p, gender: e.target.value }))} className="field">
                  <option value="male">Boys</option>
                  <option value="female">Girls</option>
                </select>
              </Field>
              <Field label="Capacity">
                <input type="number" value={dormForm.capacity} onChange={e => setDormForm(p => ({ ...p, capacity: e.target.value }))} className="field" />
              </Field>
              <Field label="Hostel Name"><input value={dormForm.hostel_name} onChange={e => setDormForm(p => ({ ...p, hostel_name: e.target.value }))} placeholder="e.g. Hostel A" className="field" /></Field>
              <Field label="Block Name"><input value={dormForm.block_name} onChange={e => setDormForm(p => ({ ...p, block_name: e.target.value }))} placeholder="e.g. Block 1" className="field" /></Field>
            </div>
            <Field label="Building"><input value={dormForm.building} onChange={e => setDormForm(p => ({ ...p, building: e.target.value }))} className="field" /></Field>
            <div className="flex gap-3 pt-1">
              <button type="submit" className="flex-1 rounded-lg bg-primary text-primary-foreground py-2.5 font-semibold text-sm hover:bg-primary/90">
                {editingDorm ? "Update" : "Create"}
              </button>
              <button type="button" onClick={() => setShowDormForm(false)} className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Room form */}
      {showRoomForm && selectedDorm && (
        <Modal title={`Add Room to ${selectedDorm.name}`} onClose={() => setShowRoomForm(false)}>
          <form onSubmit={handleSaveRoom} className="space-y-4">
            <Field label="Room Number *"><input value={roomForm.room_number} onChange={e => setRoomForm(p => ({ ...p, room_number: e.target.value }))} required placeholder="e.g. A-101" className="field" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Capacity"><input type="number" value={roomForm.capacity} onChange={e => setRoomForm(p => ({ ...p, capacity: e.target.value }))} className="field" /></Field>
              <Field label="Bed Count"><input type="number" value={roomForm.bed_count} onChange={e => setRoomForm(p => ({ ...p, bed_count: e.target.value }))} className="field" /></Field>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="submit" className="flex-1 rounded-lg bg-primary text-primary-foreground py-2.5 font-semibold text-sm hover:bg-primary/90">Add Room</button>
              <button type="button" onClick={() => setShowRoomForm(false)} className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Patron assignment */}
      {showPatronForm && selectedDorm && (
        <Modal title={`Assign Patron/Matron to ${selectedDorm.name}`} onClose={() => setShowPatronForm(false)}>
          <form onSubmit={handleAssignPatron} className="space-y-4">
            <p className="text-sm text-muted-foreground">Select a staff member with patron or matron role to assign to this dormitory. They will only see students in assigned dormitories.</p>
            <Field label="Staff Member *">
              <select value={patronUserId} onChange={e => setPatronUserId(e.target.value)} required className="field">
                <option value="">— select staff —</option>
                {availableStaff.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.role?.replace(/_/g, " ")})</option>
                ))}
              </select>
            </Field>
            {availableStaff.length === 0 && (
              <p className="text-xs text-amber-600">No staff with patron/matron roles found. Create users with role "patron" or "matron" in Staff Management.</p>
            )}
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={!patronUserId} className="flex-1 rounded-lg bg-primary text-primary-foreground py-2.5 font-semibold text-sm hover:bg-primary/90 disabled:opacity-50">Assign</button>
              <button type="button" onClick={() => setShowPatronForm(false)} className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </DodLayout>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-1">{label}</label>
      {children}
      <style>{".field{@apply w-full rounded-lg border border-border bg-background px-3 py-2 text-sm;}"}</style>
    </div>
  );
}
