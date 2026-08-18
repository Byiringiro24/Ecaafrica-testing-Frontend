import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, Search, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";

type Dormitory = { id: string; name: string; gender?: string; capacity?: number };
type Status = "present" | "absent" | "on_leave";
type RollCall = { id: string; dormitory_id: string; roll_date: string; session_type: "morning" | "evening"; submitted_at?: string | null };
type Student = { id: string; first_name: string; last_name: string; student_id_number?: string | null; room?: { room_number?: string | null } | null; record?: { id: string; status: Status; notes?: string | null } | null };
type Roster = { roll_call: RollCall; dormitory: Dormitory; students: Student[] };

const statusLabel: Record<Status, string> = { present: "Present", absent: "Absent", on_leave: "On leave" };
const today = () => new Date().toISOString().slice(0, 10);

export function BoardingAttendanceManager({ canEdit = false }: { canEdit?: boolean }) {
  const [date, setDate] = useState(today());
  const [sessionType, setSessionType] = useState<"morning" | "evening">("morning");
  const [dormitoryId, setDormitoryId] = useState("");
  const [dormitories, setDormitories] = useState<Dormitory[]>([]);
  const [rollCalls, setRollCalls] = useState<RollCall[]>([]);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadDormitories = async () => {
    const data = await apiRequest<Dormitory[]>("/boarding/dormitories?limit=500", { auth: "school" });
    setDormitories(Array.isArray(data) ? data : []);
    if (!dormitoryId && data?.[0]) setDormitoryId(data[0].id);
  };
  const loadRollCalls = async () => {
    if (!dormitoryId) return;
    const query = new URLSearchParams({ dormitory_id: dormitoryId, roll_date: date, session_type: sessionType, limit: "10" });
    const data = await apiRequest<RollCall[]>(`/boarding/roll-calls?${query}`, { auth: "school" });
    setRollCalls(Array.isArray(data) ? data : []);
  };
  const loadRoster = async (id: string) => {
    const data = await apiRequest<Roster>(`/boarding/roll-calls/${id}/roster`, { auth: "school" });
    setRoster(data);
    const next: Record<string, Status> = {};
    data.students.forEach((student) => { next[student.id] = student.record?.status ?? "present"; });
    setStatuses(next);
  };

  useEffect(() => { void (async () => { setLoading(true); try { await loadDormitories(); } catch (error: any) { toast.error(error?.message ?? "Failed to load dormitories"); } finally { setLoading(false); } })(); }, []);
  useEffect(() => { void (async () => { try { setRoster(null); await loadRollCalls(); } catch (error: any) { toast.error(error?.message ?? "Failed to load boarding attendance"); } })(); }, [dormitoryId, date, sessionType]);
  useEffect(() => { if (rollCalls[0]) void loadRoster(rollCalls[0].id).catch((error: any) => toast.error(error?.message ?? "Failed to load roster")); }, [rollCalls[0]?.id]);

  const filteredStudents = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (roster?.students ?? []).filter((student) => !needle || `${student.first_name} ${student.last_name} ${student.student_id_number ?? ""}`.toLowerCase().includes(needle));
  }, [roster, search]);
  const counts = useMemo(() => Object.values(statuses).reduce((result, status) => ({ ...result, [status]: result[status] + 1 }), { present: 0, absent: 0, on_leave: 0 }), [statuses]);

  const ensureRollCall = async () => {
    if (rollCalls[0]) return rollCalls[0];
    const created = await apiRequest<RollCall>("/boarding/roll-calls", { method: "POST", auth: "school", body: JSON.stringify({ dormitory_id: dormitoryId, roll_date: date, session_type: sessionType }) });
    setRollCalls([created]);
    await loadRoster(created.id);
    return created;
  };
  const save = async (submit = false) => {
    if (!canEdit || !dormitoryId) return;
    setSaving(true);
    try {
      const rollCall = await ensureRollCall();
      const records = (roster?.students ?? []).map((student) => ({
        student_id: student.id,
        status: statuses[student.id] ?? "present"
      }));
      if (records.length) await apiRequest(`/boarding/roll-calls/${rollCall.id}/records/bulk`, { method: "POST", auth: "school", body: JSON.stringify({ records }) });
      if (submit) await apiRequest(`/boarding/roll-calls/${rollCall.id}`, { method: "PATCH", auth: "school", body: JSON.stringify({ submitted_at: new Date().toISOString() }) });
      toast.success(submit ? "Dormitory attendance submitted" : "Dormitory attendance saved");
      await loadRollCalls(); await loadRoster(rollCall.id);
    } catch (error: any) { toast.error(error?.message ?? "Failed to save dormitory attendance"); } finally { setSaving(false); }
  };

  return <div className="space-y-5">
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap items-end gap-3">
      <div><label className="text-xs font-semibold text-muted-foreground">Date</label><input type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block h-9 rounded-md border border-input bg-background px-3 text-sm" /></div>
      <div><label className="text-xs font-semibold text-muted-foreground">Dormitory</label><select value={dormitoryId} onChange={(e) => setDormitoryId(e.target.value)} className="mt-1 block h-9 min-w-44 rounded-md border border-input bg-background px-3 text-sm"><option value="">Select dormitory</option>{dormitories.map((dorm) => <option key={dorm.id} value={dorm.id}>{dorm.name}</option>)}</select></div>
      <div><label className="text-xs font-semibold text-muted-foreground">Roll call</label><select value={sessionType} onChange={(e) => setSessionType(e.target.value as "morning" | "evening")} className="mt-1 block h-9 rounded-md border border-input bg-background px-3 text-sm"><option value="morning">Morning</option><option value="evening">Evening</option></select></div>
      <div className="relative min-w-56 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search dormitory student…" className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm" /></div>
      {canEdit && <button disabled={saving || !dormitoryId} onClick={() => void save(true)} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" />{saving ? "Saving…" : "Submit roll call"}</button>}
    </div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><StatCard label="Present" value={counts.present} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" /><StatCard label="Absent" value={counts.absent} icon={<ClipboardCheck className="h-5 w-5" />} tone="destructive" /><StatCard label="On leave" value={counts.on_leave} icon={<Users className="h-5 w-5" />} tone="warning" /></div>
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h3 className="font-display font-bold">{roster?.dormitory.name ?? "Dormitory roster"}</h3><p className="text-xs text-muted-foreground">Separate from class attendance · {date} · {sessionType}</p></div><span className="text-xs text-muted-foreground">{filteredStudents.length} students</span></div>
      {loading ? <div className="space-y-3 p-6"><Skeleton className="h-7 w-full" /><Skeleton className="h-7 w-4/5" /></div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Student ID</th><th className="px-4 py-3">Room</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{filteredStudents.length === 0 ? <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No active students are assigned to this dormitory.</td></tr> : filteredStudents.map((student) => <tr key={student.id} className="border-t border-border"><td className="px-4 py-3 font-medium">{student.first_name} {student.last_name}</td><td className="px-4 py-3 font-mono text-xs">{student.student_id_number ?? "—"}</td><td className="px-4 py-3">{student.room?.room_number ?? "—"}</td><td className="px-4 py-3">{canEdit && !roster?.roll_call.submitted_at ? <select value={statuses[student.id] ?? "present"} onChange={(e) => setStatuses((current) => ({ ...current, [student.id]: e.target.value as Status }))} className="h-8 rounded-md border border-input bg-background px-2 text-sm">{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> : <span className={statuses[student.id] === "present" ? "text-success" : statuses[student.id] === "absent" ? "text-destructive" : "text-amber-600"}>{statusLabel[statuses[student.id] ?? "present"]}</span>}</td></tr>)}</tbody></table></div>}
    </div>
  </div>;
}
