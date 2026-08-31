/**
 * DOD Leave Management — full state machine
 * DOD can: view all pending → approve / reject
 *          create leave on behalf of parent (phone call workflow)
 *          see students currently outside
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Check, X, AlertTriangle, Clock, Search } from "lucide-react";
import { toast } from "sonner";
import { DodLayout } from "@/components/layout/DodLayout";
import { directorOfDisciplineRouteGuard } from "@/lib/schoolAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { leavesApi, type LeaveRecord } from "@/lib/boardingApi";

export const Route = createFileRoute("/dod/leaves")({
  beforeLoad: ({ location }) => directorOfDisciplineRouteGuard(location),
  component: DodLeavesPage,
});

type Student = { id: string; first_name: string; last_name: string; student_type?: string | null; current_section?: { name?: string | null } | null; primary_parent?: { first_name?: string | null; last_name?: string | null; phone?: string | null } | null };
type Parent = { id: string; first_name: string; last_name: string; phone: string };

const TABS = ["Pending Approval", "Awaiting Exit", "Currently Outside", "All Leaves"] as const;
type Tab = typeof TABS[number];

const CATEGORY_LABELS: Record<string, string> = {
  short_leave: "Short Leave",
  long_leave: "Long Leave",
  medical_leave: "Medical Leave",
  emergency_leave: "Emergency Leave",
};

const STATE_BADGE: Record<string, string> = {
  requested: "bg-amber-100 text-amber-700",
  pending_dod_approval: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  awaiting_physical_exit: "bg-purple-100 text-purple-700",
  outside_school: "bg-orange-100 text-orange-700",
  returned: "bg-emerald-100 text-emerald-700",
  closed: "bg-muted text-muted-foreground",
  rejected: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

const buildName = (f?: string | null, l?: string | null) => [f, l].filter(Boolean).join(" ") || "—";

function DodLeavesPage() {
  const currentUser = useCurrentUser();
  const [tab, setTab] = useState<Tab>("Pending Approval");
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);

  const load = async () => {
    setLoading(true);
    try {
      const [lv, st, pa] = await Promise.all([
        leavesApi.list({ limit: "2000" }).then(r => Array.isArray(r) ? r : (r as any)?.data ?? []),
        apiRequest<Student[]>("/students?student_type=boarding&limit=2000", { auth: "school" }),
        apiRequest<Parent[]>("/parents?limit=2000", { auth: "school" }),
      ]);
      setLeaves(Array.isArray(lv) ? lv : []);
      setStudents(Array.isArray(st) ? st : []);
      setParents(Array.isArray(pa) ? pa : []);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load leaves");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    let list = leaves;
    if (tab === "Pending Approval") list = list.filter(l => ["requested", "pending_dod_approval"].includes(l.leave_state));
    else if (tab === "Awaiting Exit") list = list.filter(l => l.leave_state === "awaiting_physical_exit");
    else if (tab === "Currently Outside") list = list.filter(l => l.leave_state === "outside_school");
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(l => {
        const s = studentMap.get(l.student_id);
        return buildName(s?.first_name, s?.last_name).toLowerCase().includes(q);
      });
    }
    return list;
  }, [leaves, tab, query, studentMap]);

  const stats = useMemo(() => ({
    pending: leaves.filter(l => ["requested", "pending_dod_approval"].includes(l.leave_state)).length,
    awaitingExit: leaves.filter(l => l.leave_state === "awaiting_physical_exit").length,
    outside: leaves.filter(l => l.leave_state === "outside_school").length,
    lateReturn: leaves.filter(l => l.late_return_flagged && l.leave_state === "outside_school").length,
  }), [leaves]);

  const handleApprove = async (id: string) => {
    setActing(true);
    try {
      await leavesApi.approve(id);
      toast.success("Leave approved — awaiting gate exit confirmation");
      setApproving(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to approve");
    } finally {
      setActing(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) { toast.error("Rejection reason is required"); return; }
    setActing(true);
    try {
      await leavesApi.reject(id, rejectReason.trim());
      toast.success("Leave rejected");
      setRejecting(null);
      setRejectReason("");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to reject");
    } finally {
      setActing(false);
    }
  };

  return (
    <DodLayout title="Leave Management" subtitle="Approve, reject and track all boarding student leave requests">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <StatCard label="Pending Approval"  value={stats.pending}      tone="destructive" />
            <StatCard label="Awaiting Gate Exit" value={stats.awaitingExit} tone="warning" />
            <StatCard label="Currently Outside"  value={stats.outside}      tone="primary" />
            <StatCard label="Late Returns"        value={stats.lateReturn}   tone="destructive" />
          </>
        )}
      </div>

      {/* Red alert for pending */}
      {!loading && stats.pending > 0 && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {stats.pending} leave request{stats.pending !== 1 ? "s" : ""} require your approval.
        </div>
      )}

      {/* Tabs + toolbar */}
      <div className="flex flex-wrap gap-1 border-b border-border mb-4 items-end">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t}
            {t === "Pending Approval" && stats.pending > 0 && (
              <span className="ml-1.5 rounded-full bg-destructive text-white text-[10px] font-bold px-1.5 py-0.5">
                {stats.pending}
              </span>
            )}
          </button>
        ))}
        <div className="ml-auto pb-2 flex gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search student…"
              className="h-8 w-44 rounded-lg border border-border bg-background pl-8 pr-3 text-sm" />
          </div>
          <button onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-semibold hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New Leave
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                {["Student", "Class", "Category", "Type", "From", "To", "Destination", "State", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No leave requests found.</td></tr>
              ) : (
                filtered.map(l => {
                  const s = studentMap.get(l.student_id);
                  const name = buildName(s?.first_name, s?.last_name);
                  const cls = s?.current_section?.name ?? "—";
                  const isOverdue = l.leave_state === "outside_school" && l.end_date < today;
                  const canApprove = ["requested", "pending_dod_approval"].includes(l.leave_state);
                  return (
                    <tr key={l.id} className={`border-t border-border hover:bg-muted/20 ${isOverdue ? "bg-red-50" : ""}`}>
                      <td className="px-4 py-3 font-medium">{name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{cls}</td>
                      <td className="px-4 py-3 text-xs">{CATEGORY_LABELS[l.leave_category] ?? l.leave_category}</td>
                      <td className="px-4 py-3 text-xs">{l.leave_type?.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">{l.start_date}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">{l.end_date}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[140px] truncate">{l.destination ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${STATE_BADGE[l.leave_state] ?? "bg-muted text-muted-foreground"}`}>
                          {l.leave_state.replace(/_/g, " ")}
                        </span>
                        {isOverdue && <span className="ml-1 text-[10px] font-bold text-destructive">OVERDUE</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap space-x-2">
                        {canApprove ? (
                          <>
                            <button onClick={() => setApproving(l.id)}
                              className="text-xs font-semibold text-emerald-600 hover:underline">Approve</button>
                            <button onClick={() => { setRejecting(l.id); setRejectReason(""); }}
                              className="text-xs font-semibold text-destructive hover:underline">Reject</button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approve modal */}
      {approving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
            <h2 className="font-display font-bold text-lg mb-2">Approve Leave Request</h2>
            <p className="text-sm text-muted-foreground mb-5">
              This will move the leave to <strong>Awaiting Physical Exit</strong>. The Gate Keeper will then
              confirm the student's actual departure.
            </p>
            <div className="flex gap-3">
              <button onClick={() => void handleApprove(approving)} disabled={acting}
                className="flex-1 rounded-lg bg-emerald-600 text-white py-2.5 font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50">
                {acting ? "Approving…" : "Confirm Approval"}
              </button>
              <button onClick={() => setApproving(null)} disabled={acting}
                className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
            <h2 className="font-display font-bold text-lg mb-3">Reject Leave Request</h2>
            <label className="block text-sm font-semibold mb-1">Reason (required)</label>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3}
              placeholder="Provide a clear reason for rejection…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => void handleReject(rejecting!)} disabled={acting || !rejectReason.trim()}
                className="flex-1 rounded-lg bg-destructive text-white py-2.5 font-semibold text-sm hover:bg-destructive/90 disabled:opacity-50">
                {acting ? "Rejecting…" : "Confirm Rejection"}
              </button>
              <button onClick={() => setRejecting(null)} disabled={acting}
                className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Leave modal (DOD creates on behalf of parent call) */}
      {showNew && (
        <NewLeaveModal
          students={students}
          onClose={() => setShowNew(false)}
          onCreate={async (payload) => {
            try {
              await leavesApi.create({ ...payload, requested_by_role: "director_of_discipline" });
              toast.success("Leave request created and approved");
              setShowNew(false);
              await load();
            } catch (e: any) {
              toast.error(e?.message ?? "Failed to create leave");
            }
          }}
        />
      )}
    </DodLayout>
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
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-xl my-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg">Create Leave Request</h2>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Student *</label>
            <select value={studentId} onChange={e => setStudentId(e.target.value)} required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="">— select boarding student —</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.first_name} {s.last_name} — {s.current_section?.name ?? "—"}</option>
              ))}
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
                <option value="emergency_leave">Emergency Leave</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Type</label>
              <select value={leaveType} onChange={e => setLeaveType(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="weekend">Weekend Leave</option>
                <option value="medical">Medical Leave</option>
                <option value="emergency">Emergency</option>
                <option value="family">Family Leave</option>
                <option value="home_leave">Home Leave</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">Start Date *</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Return Date *</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Departure Time</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Expected Return Time</label>
              <input type="time" value={returnTime} onChange={e => setReturnTime(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Destination</label>
            <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="e.g. Home — Kigali"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Reason *</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} required placeholder="State the reason for this leave request…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none" />
          </div>
          {leaveCategory === "medical_leave" && (
            <div>
              <label className="block text-sm font-semibold mb-1">Medical Notes</label>
              <textarea value={medicalNotes} onChange={e => setMedicalNotes(e.target.value)} rows={2} placeholder="Medical condition, hospital, etc."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none" />
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 rounded-lg bg-primary text-primary-foreground py-2.5 font-semibold text-sm hover:bg-primary/90 disabled:opacity-50">
              {saving ? "Creating…" : "Create & Approve Leave"}
            </button>
            <button type="button" onClick={onClose}
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
