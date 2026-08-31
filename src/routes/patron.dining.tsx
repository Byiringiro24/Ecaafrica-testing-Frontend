/**
 * Patron Dining Attendance — mark students present/absent for each meal.
 * Students on approved leave are automatically excluded and shown separately.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Utensils, Check, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { PatronLayout } from "@/components/layout/PatronLayout";
import { patronRouteGuard } from "@/lib/schoolAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Skeleton } from "@/components/ui/skeleton";
import { patronApi, diningApi, type PatronAssignment, type DiningRosterItem, type DiningSession } from "@/lib/boardingApi";

export const Route = createFileRoute("/patron/dining")({
  beforeLoad: ({ location }) => patronRouteGuard(location),
  component: PatronDiningPage,
});

const MEALS = ["breakfast", "lunch", "dinner"] as const;
type Meal = typeof MEALS[number];

const MEAL_COLOR: Record<Meal, string> = {
  breakfast: "bg-amber-100 text-amber-700",
  lunch:     "bg-blue-100 text-blue-700",
  dinner:    "bg-indigo-100 text-indigo-700",
};

function PatronDiningPage() {
  const currentUser = useCurrentUser();
  const [myDorms, setMyDorms] = useState<PatronAssignment[]>([]);
  const [selectedDorm, setSelectedDorm] = useState<string | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<Meal>("lunch");
  const [session, setSession] = useState<DiningSession | null>(null);
  const [roster, setRoster] = useState<DiningRosterItem[]>([]);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!currentUser?.id) return;
    patronApi.listPatronAssignments(currentUser.id)
      .then(d => {
        const list = Array.isArray(d) ? d : [];
        setMyDorms(list);
        if (list[0]) setSelectedDorm(list[0].dormitory_id);
      })
      .finally(() => setLoading(false));
  }, [currentUser?.id]);

  const loadSession = async (dormId: string, meal: Meal) => {
    setLoading(true);
    try {
      const sess = await diningApi.openSession({ dormitory_id: dormId, meal_type: meal, session_date: today });
      setSession(sess);
      const rosterData = await diningApi.getRoster(sess.id);
      const r = Array.isArray(rosterData) ? rosterData : [];
      setRoster(r);
      // Pre-populate marks from existing attendance
      const initial: Record<string, string> = {};
      r.forEach(item => { if (item.attendance_status) initial[item.student.id] = item.attendance_status; });
      setMarks(initial);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load dining session");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDorm && selectedMeal) void loadSession(selectedDorm, selectedMeal);
  }, [selectedDorm, selectedMeal]);

  const toggleMark = (studentId: string, status: string) => {
    setMarks(prev => ({ ...prev, [studentId]: prev[studentId] === status ? "" : status }));
  };

  const handleSave = async () => {
    if (!session) return;
    setSaving(true);
    try {
      const markPayload = Object.entries(marks)
        .filter(([, status]) => status)
        .map(([student_id, status]) => ({ student_id, status }));
      await diningApi.markAttendance(session.id, markPayload);
      toast.success("Dining attendance saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async () => {
    if (!session) return;
    setSaving(true);
    try {
      const result = await diningApi.closeSession(session.id);
      toast.success(`Session closed — ${(result as any).total_missing ?? 0} missing students`);
      await loadSession(selectedDorm!, selectedMeal);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to close session");
    } finally {
      setSaving(false);
    }
  };

  const present = roster.filter(r => !r.is_on_leave && marks[r.student.id] === "present").length;
  const absent  = roster.filter(r => !r.is_on_leave && (!marks[r.student.id] || marks[r.student.id] === "absent")).length;
  const onLeave = roster.filter(r => r.is_on_leave).length;

  return (
    <PatronLayout title="Dining Attendance" subtitle="Mark meal attendance for your dormitory students">
      {/* Dorm selector */}
      {myDorms.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {myDorms.map(d => (
            <button key={d.dormitory_id} onClick={() => setSelectedDorm(d.dormitory_id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${selectedDorm === d.dormitory_id ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}>
              {d.dormitory?.name ?? d.dormitory_id}
            </button>
          ))}
        </div>
      )}

      {/* Meal selector */}
      <div className="flex gap-2 mb-5">
        {MEALS.map(m => (
          <button key={m} onClick={() => setSelectedMeal(m)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition ${selectedMeal === m ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}>
            <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold mr-1.5 ${MEAL_COLOR[m]}`}>{m}</span>
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <div className="text-xl font-bold text-emerald-600">{present}</div>
          <div className="text-xs text-muted-foreground">Present</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <div className="text-xl font-bold text-destructive">{absent}</div>
          <div className="text-xs text-muted-foreground">Absent</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <div className="text-xl font-bold text-blue-600">{onLeave}</div>
          <div className="text-xs text-muted-foreground">On Leave (excluded)</div>
        </div>
      </div>

      {/* Session info */}
      {session && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-2.5">
          <span className="text-sm text-muted-foreground">Session: {session.session_date} · {selectedMeal}</span>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
              <Check className="h-3.5 w-3.5" />{saving ? "Saving…" : "Save"}
            </button>
            {!session.closed_at && (
              <button onClick={handleClose} disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted disabled:opacity-50">
                Close Session
              </button>
            )}
            {session.closed_at && (
              <span className="text-xs text-muted-foreground self-center">Closed at {new Date(session.closed_at).toLocaleTimeString()}</span>
            )}
          </div>
        </div>
      )}

      {/* Roster */}
      {loading ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  {["Student", "ID", "Status", "Present", "Absent"].map(h => (
                    <th key={h} className="text-left px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roster.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No students in roster.</td></tr>
                ) : roster.map(item => {
                  const sid = item.student.id;
                  const mark = marks[sid];
                  return (
                    <tr key={sid} className={`border-t border-border ${item.is_on_leave ? "bg-blue-50 opacity-60" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {item.student.photo_url ? (
                            <img src={item.student.photo_url} alt="" className="h-8 w-8 rounded-full object-cover border border-border shrink-0" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                              {(item.student.first_name?.[0] ?? "") + (item.student.last_name?.[0] ?? "")}
                            </div>
                          )}
                          <span className="font-medium">{item.student.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{item.student.student_id_number ?? "—"}</td>
                      <td className="px-4 py-3">
                        {item.is_on_leave ? (
                          <span className="text-xs rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 font-bold">On Leave</span>
                        ) : mark ? (
                          <span className={`text-xs rounded-full px-2 py-0.5 font-bold ${mark === "present" ? "bg-emerald-100 text-emerald-700" : "bg-destructive/15 text-destructive"}`}>
                            {mark}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not marked</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleMark(sid, "present")} disabled={item.is_on_leave}
                          className={`rounded-md p-1.5 transition ${mark === "present" ? "bg-emerald-500 text-white" : "border border-border hover:bg-emerald-50 text-emerald-600"} disabled:opacity-40`}>
                          <Check className="h-4 w-4" />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleMark(sid, "absent")} disabled={item.is_on_leave}
                          className={`rounded-md p-1.5 transition ${mark === "absent" ? "bg-destructive text-white" : "border border-border hover:bg-red-50 text-destructive"} disabled:opacity-40`}>
                          <XIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PatronLayout>
  );
}
