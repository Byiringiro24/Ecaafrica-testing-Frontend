/**
 * Dining Hall Attendance — school admin / DOD / patron
 * - Choose dormitory, meal type (breakfast / lunch / dinner), and date
 * - Opens or fetches a dining session for that combination
 * - Shows roster of students assigned to that dormitory
 * - Toggle each student present / absent / on_leave
 * - Save draft or Submit (closes the session)
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Search, Send, Users, Utensils } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/attendance/dining-hall" as any)({
  component: DiningHallAttendancePage,
});

type Dormitory    = { id: string; name: string; hostel_name?: string | null };
type MealType     = "breakfast" | "lunch" | "dinner";
type AttStatus    = "present" | "absent" | "on_leave";

type DiningSession = {
  id: string;
  dormitory_id: string | null;
  meal_type: MealType;
  session_date: string;
  opened_at: string;
  closed_at?: string | null;
};

type RosterEntry = {
  student: {
    id: string;
    first_name: string;
    last_name: string;
    full_name: string;
    student_id_number?: string | null;
    photo_url?: string | null;
  };
  is_on_leave: boolean;
  attendance_status: AttStatus | null;
};

const MEALS: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch",     label: "Lunch"      },
  { value: "dinner",    label: "Dinner"      },
];

const STATUS_OPTS: { value: AttStatus; label: string; cls: string }[] = [
  { value: "present",  label: "Present",  cls: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  { value: "absent",   label: "Absent",   cls: "bg-red-100     text-red-700     border-red-300"     },
  { value: "on_leave", label: "On Leave", cls: "bg-amber-100   text-amber-700   border-amber-300"   },
];

const today = () => new Date().toISOString().slice(0, 10);

function DiningHallAttendancePage() {
  const [dormitories, setDormitories] = useState<Dormitory[]>([]);
  const [dormId,      setDormId]      = useState("");
  const [mealType,    setMealType]    = useState<MealType>("breakfast");
  const [date,        setDate]        = useState(today());
  const [session,     setSession]     = useState<DiningSession | null>(null);
  const [roster,      setRoster]      = useState<RosterEntry[]>([]);
  const [marks,       setMarks]       = useState<Record<string, AttStatus>>({});
  const [search,      setSearch]      = useState("");
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);

  // Load dormitories once
  useEffect(() => {
    apiRequest<any>("/boarding/dormitories?limit=500", { auth: "school" })
      .then(res => {
        const list: Dormitory[] = Array.isArray(res) ? res : (res as any)?.data ?? [];
        setDormitories(list);
        if (!dormId && list[0]) setDormId(list[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Reload session + roster when filters change
  useEffect(() => {
    if (!dormId) return;
    void loadSession();
  }, [dormId, mealType, date]);

  const loadSession = async () => {
    setLoading(true);
    setSession(null); setRoster([]); setMarks({});
    try {
      // List existing sessions for this dorm + meal + date
      const sessRes = await apiRequest<any>(
        `/boarding/dining/sessions?dormitory_id=${dormId}&meal_type=${mealType}&session_date=${date}&limit=5`,
        { auth: "school" }
      );
      const sessions: DiningSession[] = Array.isArray(sessRes) ? sessRes : (sessRes as any)?.data ?? [];
      const existing = sessions[0] ?? null;

      if (existing) {
        setSession(existing);
        const rosterRes = await apiRequest<any>(`/boarding/dining/sessions/${existing.id}/roster`, { auth: "school" });
        const entries: RosterEntry[] = Array.isArray(rosterRes) ? rosterRes : (rosterRes as any)?.data ?? [];
        setRoster(entries);
        const initialMarks: Record<string, AttStatus> = {};
        entries.forEach(e => {
          if (e.attendance_status) initialMarks[e.student.id] = e.attendance_status;
          else if (e.is_on_leave)   initialMarks[e.student.id] = "on_leave";
          else                      initialMarks[e.student.id] = "present";
        });
        setMarks(initialMarks);
      } else {
        // No session yet — still load roster preview from boarding assignments
        const assignRes = await apiRequest<any>(
          `/boarding/assignments?dormitory_id=${dormId}&is_active=true&limit=2000`,
          { auth: "school" }
        );
        const assignments: any[] = Array.isArray(assignRes) ? assignRes : (assignRes as any)?.data ?? [];
        const preview: RosterEntry[] = assignments.map(a => ({
          student: {
            id: a.student?.id ?? a.student_id,
            first_name: a.student?.first_name ?? "",
            last_name:  a.student?.last_name  ?? "",
            full_name:  `${a.student?.first_name ?? ""} ${a.student?.last_name ?? ""}`.trim(),
            student_id_number: a.student?.student_id_number ?? null,
            photo_url: a.student?.photo_url ?? null,
          },
          is_on_leave: false,
          attendance_status: null,
        }));
        setRoster(preview);
        const initialMarks: Record<string, AttStatus> = {};
        preview.forEach(e => { initialMarks[e.student.id] = "present"; });
        setMarks(initialMarks);
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load dining session");
    } finally {
      setLoading(false);
    }
  };

  const openAndSave = async (submit = false) => {
    if (!dormId) { toast.error("Select a dormitory first"); return; }
    setSaving(true);
    try {
      let activeSession = session;

      // Open session if not already open
      if (!activeSession) {
        activeSession = await apiRequest<DiningSession>("/boarding/dining/sessions", {
          method: "POST",
          auth: "school",
          body: JSON.stringify({ dormitory_id: dormId, meal_type: mealType, session_date: date }),
        });
        setSession(activeSession);
      }

      // Save marks
      const markPayload = Object.entries(marks).map(([student_id, status]) => ({ student_id, status }));
      if (markPayload.length > 0) {
        await apiRequest(`/boarding/dining/sessions/${activeSession!.id}/attendance`, {
          method: "POST",
          auth: "school",
          body: JSON.stringify({ marks: markPayload }),
        });
      }

      if (submit) {
        await apiRequest(`/boarding/dining/sessions/${activeSession!.id}/close`, {
          method: "POST",
          auth: "school",
        });
        toast.success("Dining attendance submitted and session closed");
        void loadSession();
      } else {
        toast.success("Dining attendance saved");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save dining attendance");
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter(e =>
      `${e.student.full_name} ${e.student.student_id_number ?? ""}`.toLowerCase().includes(q)
    );
  }, [roster, search]);

  const counts = useMemo(() => ({
    present:  Object.values(marks).filter(v => v === "present").length,
    absent:   Object.values(marks).filter(v => v === "absent").length,
    on_leave: Object.values(marks).filter(v => v === "on_leave").length,
  }), [marks]);

  const isClosed = Boolean(session?.closed_at);
  const dorm = dormitories.find(d => d.id === dormId);

  return (
    <div className="space-y-5">
      {/* Header info */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <Utensils className="mt-1 h-5 w-5 text-primary shrink-0" />
          <div>
            <h2 className="font-display text-lg font-bold">Dining Hall Attendance</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Record which boarding students were present for each meal.
              Biometric scans from a device assigned to the dining hall are recorded automatically —
              this page allows manual entry and correction.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Dormitory</label>
          <select value={dormId} onChange={e => setDormId(e.target.value)}
            className="mt-1 block h-9 min-w-44 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Select dormitory</option>
            {dormitories.map(d => (
              <option key={d.id} value={d.id}>
                {d.hostel_name ? `${d.hostel_name} — ` : ""}{d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Meal</label>
          <select value={mealType} onChange={e => setMealType(e.target.value as MealType)}
            className="mt-1 block h-9 rounded-md border border-input bg-background px-3 text-sm">
            {MEALS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Date</label>
          <input type="date" max={today()} value={date}
            onChange={e => setDate(e.target.value)}
            className="mt-1 block h-9 rounded-md border border-input bg-background px-3 text-sm" />
        </div>
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search student…"
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm" />
        </div>
        {/* Mark all present */}
        {!isClosed && roster.length > 0 && (
          <button type="button" disabled={saving}
            onClick={() => {
              const next: Record<string, AttStatus> = {};
              roster.forEach(e => { next[e.student.id] = "present"; });
              setMarks(next);
            }}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" /> All Present
          </button>
        )}
        {!isClosed && (
          <>
            <button disabled={saving || !dormId || roster.length === 0}
              onClick={() => void openAndSave(false)}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50">
              {saving ? "Saving…" : "Save draft"}
            </button>
            <button disabled={saving || !dormId || roster.length === 0}
              onClick={() => void openAndSave(true)}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              <Send className="h-4 w-4" /> {saving ? "Saving…" : "Submit meal"}
            </button>
          </>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Present"  value={counts.present}  icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Absent"   value={counts.absent}   icon={<Users className="h-5 w-5" />} tone="destructive" />
        <StatCard label="On Leave" value={counts.on_leave} icon={<Users className="h-5 w-5" />} tone="warning" />
      </div>

      {/* Session status banner */}
      {session && (
        <div className={`rounded-xl border px-4 py-3 text-sm flex items-center justify-between ${
          isClosed
            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
            : "border-amber-300 bg-amber-50 text-amber-800"
        }`}>
          <span>
            {isClosed
              ? `Session closed — ${dorm?.name} · ${mealType} · ${date}`
              : `Session open — ${dorm?.name} · ${mealType} · ${date}`}
          </span>
          {isClosed && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">Submitted</span>
          )}
        </div>
      )}

      {/* Roster table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="font-display font-bold">
              {dorm ? `${dorm.hostel_name ? dorm.hostel_name + " — " : ""}${dorm.name}` : "Dormitory roster"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {date} · {mealType} · {roster.length} students
              {!session ? " · session not yet opened" : ""}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{filtered.length} shown</span>
        </div>

        {loading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-4/5" />
            <Skeleton className="h-7 w-3/5" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            No students assigned to this dormitory yet. Assign them in the Dormitory Assignments section.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Student ID</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(entry => {
                  const s = entry.student;
                  const current = marks[s.id] ?? (entry.is_on_leave ? "on_leave" : "present");
                  const statusInfo = STATUS_OPTS.find(o => o.value === current) ?? STATUS_OPTS[0];

                  return (
                    <tr key={s.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2.5">
                          {s.photo_url ? (
                            <img src={s.photo_url} alt="" className="h-8 w-8 rounded-full object-cover border border-border" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                              {(s.first_name[0] ?? "") + (s.last_name[0] ?? "")}
                            </div>
                          )}
                          <span>{s.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {s.student_id_number ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {isClosed ? (
                          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusInfo.cls}`}>
                            {statusInfo.label}
                          </span>
                        ) : (
                          <div className="flex gap-1.5 flex-wrap">
                            {STATUS_OPTS.map(opt => (
                              <button key={opt.value} type="button"
                                onClick={() => setMarks(m => ({ ...m, [s.id]: opt.value }))}
                                disabled={entry.is_on_leave && opt.value !== "on_leave"}
                                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
                                  current === opt.value
                                    ? opt.cls
                                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                                }`}>
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
