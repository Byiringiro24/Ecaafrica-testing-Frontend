/**
 * Patron Boarding Attendance — view and manually correct attendance
 * for students in assigned dormitories only.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RefreshCw, AlertTriangle, CheckCircle, Clock, UserX } from "lucide-react";
import { toast } from "sonner";
import { PatronLayout } from "@/components/layout/PatronLayout";
import { patronRouteGuard } from "@/lib/schoolAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { patronApi, boardingAttendanceApi, type PatronAssignment, type BoardingSession } from "@/lib/boardingApi";

export const Route = createFileRoute("/patron/attendance")({
  beforeLoad: ({ location }) => patronRouteGuard(location),
  component: PatronAttendancePage,
});

const STATUS_ICON: Record<string, React.ReactNode> = {
  present:           <CheckCircle className="h-4 w-4 text-emerald-600" />,
  late:              <Clock className="h-4 w-4 text-amber-600" />,
  missing_attendance:<UserX className="h-4 w-4 text-destructive" />,
  on_approved_leave: <CheckCircle className="h-4 w-4 text-blue-600" />,
  manual_adjusted:   <CheckCircle className="h-4 w-4 text-purple-600" />,
};

const STATUS_COLOR: Record<string, string> = {
  present:            "bg-emerald-100 text-emerald-700",
  late:               "bg-amber-100 text-amber-700",
  missing_attendance: "bg-destructive/15 text-destructive",
  on_approved_leave:  "bg-blue-100 text-blue-700",
  manual_adjusted:    "bg-purple-100 text-purple-700",
};

type AttendanceRecord = {
  id: string; student_id: string; status: string; scan_time?: string | null;
  is_manual?: boolean; manual_reason?: string | null;
  student?: { id: string; first_name: string; last_name: string; photo_url?: string | null; student_id_number?: string | null } | null;
};

function PatronAttendancePage() {
  const currentUser = useCurrentUser();
  const [myDorms, setMyDorms] = useState<PatronAssignment[]>([]);
  const [selectedDorm, setSelectedDorm] = useState<string | null>(null);
  const [session, setSession] = useState<(BoardingSession & { records: AttendanceRecord[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [correcting, setCorrecting] = useState<AttendanceRecord | null>(null);
  const [correctForm, setCorrectForm] = useState({ status: "present", reason: "" });
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
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentUser?.id]);

  const loadSession = async (dormId: string) => {
    setLoading(true);
    try {
      // Try to find today's session for this dorm, or open one
      const sess = await boardingAttendanceApi.openSession(dormId, today);
      const full = await boardingAttendanceApi.getSessionSummary(sess.id);
      setSession(full as any);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load attendance session");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDorm) void loadSession(selectedDorm);
  }, [selectedDorm]);

  const handleCorrect = async () => {
    if (!session || !correcting || !correctForm.reason.trim()) {
      toast.error("Reason is required for manual correction"); return;
    }
    setSaving(true);
    try {
      await boardingAttendanceApi.correctAttendance(session.id, correcting.student_id, correctForm.status, correctForm.reason);
      toast.success("Attendance corrected");
      setCorrecting(null);
      await loadSession(selectedDorm!);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to correct attendance");
    } finally {
      setSaving(false);
    }
  };

  const records: AttendanceRecord[] = (session as any)?.records ?? [];
  const missingCount = records.filter(r => r.status === "missing_attendance").length;

  return (
    <PatronLayout title="Boarding Attendance" subtitle="Monitor and manage attendance for your dormitories">
      {/* Dorm selector */}
      {myDorms.length > 1 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {myDorms.map(d => (
            <button key={d.dormitory_id} onClick={() => setSelectedDorm(d.dormitory_id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${selectedDorm === d.dormitory_id ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}>
              {d.dormitory?.name ?? d.dormitory_id}
            </button>
          ))}
        </div>
      )}

      {/* Summary stats */}
      {session && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <StatMini label="Expected"       value={session.total_expected} />
          <StatMini label="Present"        value={session.total_present}  color="emerald" />
          <StatMini label="Late"           value={session.total_late}     color="amber" />
          <StatMini label="On Leave"       value={session.total_on_leave} color="blue" />
          <StatMini label="Missing"        value={session.total_missing}  color="red" />
        </div>
      )}

      {/* Missing alert */}
      {!loading && missingCount > 0 && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {missingCount} student{missingCount !== 1 ? "s" : ""} missing boarding attendance — DOD has been notified.
        </div>
      )}

      {/* Reconcile button */}
      {session && !session.reconciled_at && (
        <div className="mb-4 flex items-center gap-3">
          <button onClick={async () => {
            setOpening(true);
            try {
              await boardingAttendanceApi.reconcile(session.id);
              toast.success("Session reconciled");
              await loadSession(selectedDorm!);
            } catch (e: any) { toast.error(e?.message ?? "Failed to reconcile"); }
            finally { setOpening(false); }
          }} disabled={opening}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${opening ? "animate-spin" : ""}`} />
            {opening ? "Reconciling…" : "Reconcile Attendance Now"}
          </button>
          <span className="text-xs text-muted-foreground">Run after the attendance window closes to finalize who is Present/Missing.</span>
        </div>
      )}

      {/* Records table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                {["Photo", "Student", "ID", "Status", "Scan Time", "Manual", "Action"].map(h => (
                  <th key={h} className="text-left px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No attendance records. Open a session first.</td></tr>
              ) : records.map(r => (
                <tr key={r.id} className={`border-t border-border hover:bg-muted/20 ${r.status === "missing_attendance" ? "bg-red-50" : ""}`}>
                  <td className="px-4 py-3">
                    {r.student?.photo_url ? (
                      <img src={r.student.photo_url} alt="" className="h-8 w-8 rounded-full object-cover border border-border" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                        {(r.student?.first_name?.[0] ?? "") + (r.student?.last_name?.[0] ?? "")}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">{r.student ? `${r.student.first_name} ${r.student.last_name}` : "—"}</td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{r.student?.student_id_number ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {STATUS_ICON[r.status]}
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_COLOR[r.status] ?? "bg-muted text-muted-foreground"}`}>
                        {r.status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">{r.scan_time ? new Date(r.scan_time).toLocaleTimeString() : "—"}</td>
                  <td className="px-4 py-3">
                    {r.is_manual ? <span className="text-xs text-purple-600 font-semibold">MANUAL</span> : <span className="text-xs text-muted-foreground">Biometric</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => { setCorrecting(r); setCorrectForm({ status: r.status, reason: "" }); }}
                      className="text-xs font-semibold text-primary hover:underline">
                      Correct
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual correction modal */}
      {correcting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
            <h2 className="font-display font-bold text-lg mb-1">Manual Attendance Correction</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Biometric failure or operational exception only. Every manual change is fully audited.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold mb-1">New Status</label>
                <select value={correctForm.status} onChange={e => setCorrectForm(p => ({ ...p, status: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="on_approved_leave">On Approved Leave</option>
                  <option value="missing_attendance">Missing Attendance</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Reason (required)</label>
                <textarea value={correctForm.reason} onChange={e => setCorrectForm(p => ({ ...p, reason: e.target.value }))}
                  rows={3} placeholder="Device failure, biometric mismatch, or approved exception…"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={handleCorrect} disabled={saving || !correctForm.reason.trim()}
                  className="flex-1 rounded-lg bg-primary text-primary-foreground py-2.5 font-semibold text-sm hover:bg-primary/90 disabled:opacity-50">
                  {saving ? "Saving…" : "Save Correction"}
                </button>
                <button onClick={() => setCorrecting(null)}
                  className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PatronLayout>
  );
}

function StatMini({ label, value, color }: { label: string; value: number; color?: string }) {
  const c = { emerald: "text-emerald-600", amber: "text-amber-600", blue: "text-blue-600", red: "text-destructive" };
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <div className={`text-xl font-bold font-display ${color ? c[color as keyof typeof c] : ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
