/** Patron — view of assigned dormitories with room allocation capability */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Pencil, X, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PatronLayout } from "@/components/layout/PatronLayout";
import { patronRouteGuard } from "@/lib/schoolAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { patronApi, type PatronAssignment } from "@/lib/boardingApi";
import { exportToExcel } from "@/lib/exportExcel";

export const Route = createFileRoute("/patron/dormitories")({
  beforeLoad: ({ location }) => patronRouteGuard(location),
  component: PatronDormitoriesPage,
});

type Student = { id: string; first_name: string; last_name: string; student_id_number?: string | null; photo_url?: string | null; gender?: string | null; boarding_status?: string | null };
type Assignment = { id: string; student_id: string; dormitory_id: string; room_id?: string | null; bed_number?: string | null; room?: { id: string; room_number: string } | null };
type Room = { id: string; room_number: string; capacity?: number | null; dormitory_id: string };

const STATUS_COLOR: Record<string, string> = {
  in_school: "bg-emerald-100 text-emerald-700",
  in_dormitory: "bg-emerald-100 text-emerald-700",
  outside_school: "bg-orange-100 text-orange-700",
  on_short_leave: "bg-amber-100 text-amber-700",
  on_long_leave: "bg-amber-100 text-amber-700",
  on_medical_leave: "bg-blue-100 text-blue-700",
  absent: "bg-destructive/15 text-destructive",
};

function PatronDormitoriesPage() {
  const currentUser = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [dormAssignments, setDormAssignments] = useState<PatronAssignment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentAssignments, setStudentAssignments] = useState<Assignment[]>([]);
  const [selectedDorm, setSelectedDorm] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  useEffect(() => {
    if (!currentUser?.id) return;
    const load = async () => {
      setLoading(true);
      try {
        const myDorms = await patronApi.listPatronAssignments(currentUser.id).catch(() => []);
        const dormList = Array.isArray(myDorms) ? myDorms : [];
        setDormAssignments(dormList);
        if (dormList.length === 0) { setLoading(false); return; }
        setSelectedDorm(dormList[0].dormitory_id);

        const [st, asgn, rm] = await Promise.all([
          apiRequest<Student[]>("/students?student_type=boarding&limit=2000", { auth: "school" }),
          apiRequest<Assignment[]>("/boarding/assignments?is_active=true&limit=5000", { auth: "school" }),
          apiRequest<Room[]>("/boarding/rooms?limit=1000", { auth: "school" }).catch(() => [] as Room[]),
        ]);
        setStudents(Array.isArray(st) ? st : []);
        setStudentAssignments(Array.isArray(asgn) ? asgn : []);
        setRooms(Array.isArray(rm) ? rm : []);
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to load dormitory data");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [currentUser?.id]);

  const myDormIds = new Set(dormAssignments.map(d => d.dormitory_id));
  const studentMap = new Map(students.map(s => [s.id, s]));
  const studentsInDorm = (dormId: string) =>
    studentAssignments.filter(a => a.dormitory_id === dormId).map(a => ({
      assignment: a,
      student: studentMap.get(a.student_id),
    })).filter(x => x.student);

  const activeDorm = dormAssignments.find(d => d.dormitory_id === selectedDorm);
  const activeStudents = selectedDorm ? studentsInDorm(selectedDorm) : [];

  const handleExport = async () => {
    if (activeStudents.length === 0) { toast.info("No students to export"); return; }
    const dormName = activeDorm?.dormitory?.name ?? selectedDorm ?? "dorm";
    try {
      await exportToExcel(
        `dormitory-${dormName.replace(/\s+/g, "-").toLowerCase()}.xlsx`, "Students",
        [
          { header: "#", key: "no", width: 6 },
          { header: "Student Name", key: "name", width: 26 },
          { header: "Student ID", key: "sid", width: 16 },
          { header: "Room", key: "room", width: 12 },
          { header: "Bed", key: "bed", width: 8 },
          { header: "Gender", key: "gender", width: 10 },
          { header: "Status", key: "status", width: 16 },
        ],
        activeStudents.map(({ student, assignment }, i) => ({
          no: i + 1,
          name: student ? `${student.first_name} ${student.last_name}` : "—",
          sid: student?.student_id_number ?? "—",
          room: assignment.room?.room_number ?? "—",
          bed: assignment.bed_number ?? "—",
          gender: student?.gender ?? "—",
          status: student?.boarding_status ?? "active",
        })),
        `${dormName} — Student List`
      );
      toast.success("Exported");
    } catch (e: any) { toast.error(e?.message ?? "Export failed"); }
  };

  return (
    <>
    <PatronLayout title="My Dormitories" subtitle="Students in your assigned dormitories">
      {loading ? (
        <Skeleton className="h-80" />
      ) : dormAssignments.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-800 text-sm">
          No dormitories assigned to you. Contact the Director of Discipline.
        </div>
      ) : (
        <div className="flex gap-5">
          {/* Dorm selector sidebar */}
          <div className="w-48 shrink-0 space-y-1">
            {dormAssignments.map(d => (
              <button key={d.dormitory_id} onClick={() => setSelectedDorm(d.dormitory_id)}
                className={`w-full text-left rounded-lg px-3 py-2.5 text-sm font-medium transition ${selectedDorm === d.dormitory_id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                {d.dormitory?.name ?? d.dormitory_id}
                <div className="text-[11px] mt-0.5 opacity-70 capitalize">{d.dormitory?.gender ?? ""}</div>
              </button>
            ))}
          </div>

          {/* Student list */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold">{activeDorm?.dormitory?.name ?? "Students"}</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{activeStudents.length} students</span>
                <button onClick={handleExport}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                  <Download className="h-3.5 w-3.5" /> Export
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      {["Photo", "Student", "ID", "Room", "Bed", "Status", ""].map(h => (
                        <th key={h} className="text-left px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeStudents.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No students in this dormitory.</td></tr>
                    ) : activeStudents.map(({ student, assignment }) => (
                      <tr key={assignment.student_id} className="border-t border-border hover:bg-muted/20">
                        <td className="px-4 py-3">
                          {student!.photo_url ? (
                            <img src={student!.photo_url} alt="" className="h-9 w-9 rounded-full object-cover border border-border" />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                              {(student!.first_name?.[0] ?? "") + (student!.last_name?.[0] ?? "")}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">{student!.first_name} {student!.last_name}</td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{student!.student_id_number ?? "—"}</td>
                        <td className="px-4 py-3 text-xs">{assignment.room?.room_number ?? "—"}</td>
                        <td className="px-4 py-3 text-xs">{assignment.bed_number ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_COLOR[student!.boarding_status ?? ""] ?? "bg-muted text-muted-foreground"}`}>
                            {(student!.boarding_status ?? "unknown").replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setEditingAssignment(assignment)}
                            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold hover:bg-muted"
                          >
                            <Pencil className="h-3 w-3" /> Assign Room
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </PatronLayout>
    {editingAssignment && selectedDorm && (
      <RoomAssignModal
        assignment={editingAssignment}
        dormId={selectedDorm}
        rooms={rooms}
        onClose={() => setEditingAssignment(null)}
        onSuccess={() => {
          setEditingAssignment(null);
          apiRequest<Assignment[]>("/boarding/assignments?is_active=true&limit=5000", { auth: "school" })
            .then(r => { if (Array.isArray(r)) setStudentAssignments(r); })
            .catch(() => null);
        }}
      />
    )}
    </>
  );
}

// ── Room Assignment Modal ────────────────────────────────────────────────────
// Allows patron to set room_id and bed_number on a dorm assignment.
function RoomAssignModal({
  assignment,
  dormId,
  rooms,
  onClose,
  onSuccess,
}: {
  assignment: Assignment;
  dormId: string;
  rooms: Room[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const dormRooms = rooms.filter(r => r.dormitory_id === dormId);
  const [roomId, setRoomId] = useState(assignment.room?.id ?? "");
  const [bed, setBed] = useState(assignment.bed_number ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiRequest(`/boarding/assignments/${assignment.id}`, {
        method: "PATCH",
        auth: "school",
        body: JSON.stringify({
          room_id: roomId || null,
          bed_number: bed.trim() || null,
        }),
      });
      toast.success("Room assignment updated");
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update room assignment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-card shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold">Assign Room</h3>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4">
          <label className="block">
            <span className="text-xs font-semibold mb-1.5 block">Room</span>
            <select value={roomId} onChange={e => setRoomId(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
              <option value="">— No room assigned —</option>
              {dormRooms.map(r => (
                <option key={r.id} value={r.id}>Room {r.room_number}{r.capacity ? ` (cap. ${r.capacity})` : ""}</option>
              ))}
            </select>
            {dormRooms.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">No rooms defined for this dormitory yet. Ask the school admin to add rooms first.</p>
            )}
          </label>
          <label className="block">
            <span className="text-xs font-semibold mb-1.5 block">Bed Number <span className="font-normal text-muted-foreground">(optional)</span></span>
            <input value={bed} onChange={e => setBed(e.target.value)}
              placeholder="e.g. B12"
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
          </label>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} disabled={saving}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50">
            Cancel
          </button>
          <button onClick={() => void handleSave()} disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
