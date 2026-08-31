/**
 * Patron / Matron Leave page.
 * Per spec:
 * - Can CREATE leave requests for students (on student's behalf)
 * - CANNOT approve/reject — sends to DOD
 * - Can see leave history for assigned dormitory students only
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, X, Clock, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { PatronLayout } from "@/components/layout/PatronLayout";
import { patronRouteGuard } from "@/lib/schoolAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { patronApi, leavesApi, type PatronAssignment, type LeaveRecord } from "@/lib/boardingApi";

export const Route = createFileRoute("/patron/leaves")({
  beforeLoad: ({ location }) => patronRouteGuard(location),
  component: PatronLeavesPage,
});

type Student = { id: string; first_name: string; last_name: string; student_id_number?: string | null; current_section?: { name?: string | null } | null };

const STATE_BADGE: Record<string, string> = {
  requested:            "bg-amber-100 text-amber-700",
  pending_dod_approval: "bg-amber-100 text-amber-700",
  approved:             "bg-blue-100 text-blue-700",
  awaiting_physical_exit:"bg-purple-100 text-purple-700",
  outside_school:       "bg-orange-100 text-orange-700",
  returned:             "bg-emerald-100 text-emerald-700",
  closed:               "bg-muted text-muted-foreground",
  rejected:             "bg-destructive/15 text-destructive",
};

const TABS = ["Pending", "Active", "All"] as const;

function PatronLeavesPage() {
  const currentUser = useCurrentUser();
  const [tab, setTab] = useState<typeof TABS[number]>("Pending");
  const [myDorms, setMyDorms] = useState<PatronAssignment[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [myStudentIds, setMyStudentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const load = async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      const dorms = await patronApi.listPatronAssignments(currentUser.id).catch(() => [] as PatronAssignment[]);
      const dormList = Array.isArray(dorms) ? dorms : [];
      setMyDorms(dormList);
      const dormIds = dormList.map(d => d.dormitory_id);

      const [st, asgn, lv] = await Promise.all([
        apiRequest<Student[]>("/students?student_type=boarding&limit=2000", { auth: "school" }),
        apiRequest<{ student_id: string; dormitory_id: string }[]>("/boarding/assignments?is_active=true&limit=5000", { auth: "school" }),
        leavesApi.list({ limit: "2000" }).then(r => Array.isArray(r) ? r : (r as any)?.data ?? []),
      ]);
      const allStudents = Array.isArray(st) ? st : [];
      const allAssignments = Array.isArray(asgn) ? asgn : [];
      const myIds = new Set(allAssignments.filter(a => dormIds.includes(a.dormitory_id)).map(a => a.student_id));
      setMyStudentIds(myIds);
      setStudents(allStudents.filter(s => myIds.has(s.id)));
      const allLeaves = Array.isArray(lv) ? lv : [];
      setLeaves(allLeaves.filter(l => myIds.has(l.student_id)));
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load leave data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [currentUser?.id]);

  const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);

  const filtered = useMemo(() => {
    if (tab === "Pending") return leaves.filter(l => ["requested", "pending_dod_approval"].includes(l.leave_state));
    if (tab === "Active") return leaves.filter(l => ["awaiting_physical_exit", "outside_school"].includes(l.leave_state));
    return leaves;
  }, [leaves, tab]);

  const stats = {
    pending: leaves.filter(l => ["requested", "pending_dod_approval"].includes(l.leave_state)).length,
    active: leaves.filter(l => l.leave_state === "outside_school").length,
    returned: leaves.filter(l => l.returned_at?.startsWith(today)).length,
    lateReturn: leaves.filter(l => l.late_return_flagged && !l.returned_at).length,
  };

  return (
    <PatronLayout title="Leave Requests" subtitle="Manage leave requests for students in your dormitories">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />) : (
          <>
            <StatCard label="Pending DOD Approval" value={stats.pending} tone="warning" />
            <StatCard label="Currently Outside"     value={stats.active}  tone="primary" />
            <StatCard label="Returned Today"        value={stats.returned} tone="success" />
            <StatCard label="Late Returns"          value={stats.lateReturn} tone="destructive" />
          </>
        )}
      </div>

      {/* Info banner: patron cannot approve */}
      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800 text-sm flex items-start gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        You can create leave requests on behalf of students. Leave approval is handled by the Director of Discipline.
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border mb-4 items-end">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t}
            {t === "Pending" && stats.pending > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5">{stats.pending}</span>
            )}
          </button>
        ))}
        <div className="ml-auto pb-2">
          <button onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-semibold hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New Request
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                {["Student", "Class", "Category", "From", "To", "Destination", "State"].map(h => (
                  <th key={h} className="text-left px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No leave requests in this view.</td></tr>
              ) : filtered.map(l => {
                const s = studentMap.get(l.student_id);
                const isLate = l.late_return_flagged && l.leave_state === "outside_school";
                return (
                  <tr key={l.id} className={`border-t border-border hover:bg-muted/20 ${isLate ? "bg-red-50" : ""}`}>
                    <td className="px-4 py-3 font-medium">{s ? `${s.first_name} ${s.last_name}` : "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s?.current_section?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">{l.leave_category?.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-xs">{l.start_date}</td>
                    <td className="px-4 py-3 text-xs">{l.end_date}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[120px]">{l.destination ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${STATE_BADGE[l.leave_state] ?? "bg-muted text-muted-foreground"}`}>
                        {l.leave_state.replace(/_/g, " ")}
                      </span>
                      {isLate && <span className="ml-1 text-[10px] font-bold text-destructive">LATE</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showNew && (
        <NewLeaveModal students={students} onClose={() => setShowNew(false)}
          onCreate={async (payload) => {
            try {
              await leavesApi.create({ ...payload, requested_by_role: "patron" });
              toast.success("Leave request submitted — awaiting DOD approval");
              setShowNew(false);
              await load();
            } catch (e: any) { toast.error(e?.message ?? "Failed to submit leave"); }
          }} />
      )}
    </PatronLayout>
  );
}

function NewLeaveModal({ students, onClose, onCreate }: {
  students: Student[];
  onClose: () => void;
  onCreate: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [studentId, setStudentId] = useState("");
  const [leaveCategory, setLeaveCategory] = useState("short_leave");
  const [leaveType, setLeaveType] = useState("other");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("14:00");
  const [returnTime, setReturnTime] = useState("20:00");
  const [destination, setDestination] = useState("");
  const [reason, setReason] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !reason.trim()) { toast.error("Student and reason are required"); return; }
    setSaving(true);
    try {
      await onCreate({ student_id: studentId, leave_category: leaveCategory, leave_type: leaveType, start_date: startDate, end_date: endDate, start_time: startTime, expected_return_time: returnTime, destination, reason, medical_notes: medicalNotes || undefined });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-xl my-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg">Create Leave Request</h2>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-4 rounded-lg bg-muted/40 px-3 py-2">
          This request will be forwarded to the Director of Discipline for approval.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Student *</label>
            <select value={studentId} onChange={e => setStudentId(e.target.value)} required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="">— select student —</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.current_section?.name ?? "—"})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">Category</label>
              <select value={leaveCategory} onChange={e => setLeaveCategory(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="short_leave">Short Leave</option>
                <option value="long_leave">Long Leave</option>
                <option value="medical_leave">Medical Leave</option>
                <option value="emergency_leave">Emergency</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Type</label>
              <select value={leaveType} onChange={e => setLeaveType(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="weekend">Weekend Leave</option>
                <option value="medical">Medical Leave</option>
                <option value="emergency">Emergency</option>
                <option value="family">Family</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-semibold mb-1">From *</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-semibold mb-1">Return Date *</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-semibold mb-1">Departure Time</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-semibold mb-1">Return Time</label>
              <input type="time" value={returnTime} onChange={e => setReturnTime(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></div>
          </div>
          <div><label className="block text-sm font-semibold mb-1">Destination</label>
            <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="e.g. Home, Hospital" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></div>
          <div><label className="block text-sm font-semibold mb-1">Reason *</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none" /></div>
          {leaveCategory === "medical_leave" && (
            <div><label className="block text-sm font-semibold mb-1">Medical Notes</label>
              <textarea value={medicalNotes} onChange={e => setMedicalNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none" /></div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-primary text-primary-foreground py-2.5 font-semibold text-sm hover:bg-primary/90 disabled:opacity-50">
              {saving ? "Submitting…" : "Submit to DOD"}
            </button>
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
