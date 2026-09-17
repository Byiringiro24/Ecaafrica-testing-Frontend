/**
 * Gate Keeper — Boarding Leave Verification & CONFIRM GATE EXIT
 *
 * Per spec:
 * - Gate keeper can VIEW approved exits with student photo
 * - Gate keeper can CONFIRM GATE EXIT (creates immutable exit audit record)
 * - Gate keeper CANNOT approve/reject leave
 * - Student photo is shown prominently for identity verification
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, ShieldCheck, LogOut, CheckCircle, Clock, AlertTriangle, Download } from "lucide-react";
import { toast } from "sonner";
import { GateKeeperLayout } from "@/components/layout/GateKeeperLayout";
import { gateKeeperRouteGuard } from "@/lib/schoolAuth";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { leavesApi, type ApprovedExit } from "@/lib/boardingApi";
import { exportToExcel } from "@/lib/exportExcel";

export const Route = createFileRoute("/gate-keeper/boarding-leave")({
  beforeLoad: ({ location }) => gateKeeperRouteGuard(location),
  component: GateKeeperBoardingLeavePage,
});

const STATE_BADGE: Record<string, string> = {
  awaiting_physical_exit: "bg-amber-100 text-amber-700",
  outside_school:         "bg-orange-100 text-orange-700",
  returned:               "bg-emerald-100 text-emerald-700",
};

function GateKeeperBoardingLeavePage() {
  const [exits, setExits] = useState<ApprovedExit[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"pending" | "all">("pending");
  const [confirming, setConfirming] = useState<ApprovedExit | null>(null);
  const [notes, setNotes] = useState("");
  const [acting, setActing] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const load = async () => {
    setLoading(true);
    try {
      const data = await leavesApi.getApprovedExits();
      setExits(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load approved exits");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    let list = exits;
    if (view === "pending") list = list.filter(e => e.leave_state === "awaiting_physical_exit");
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(e =>
        e.student.full_name.toLowerCase().includes(q) ||
        (e.student.student_id_number ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [exits, view, query]);

  const stats = {
    awaitingExit: exits.filter(e => e.leave_state === "awaiting_physical_exit").length,
    outside:      exits.filter(e => e.leave_state === "outside_school").length,
    overdue:      exits.filter(e => e.leave_state === "outside_school" && e.end_date < today).length,
  };

  const handleExport = async () => {
    if (filtered.length === 0) { toast.info("No records to export"); return; }
    try {
      await exportToExcel(
        `gate-leave-${today}.xlsx`, "Boarding Leave",
        [
          { header: "Student Name", key: "name", width: 26 },
          { header: "Student ID", key: "sid", width: 16 },
          { header: "Leave Start", key: "start", width: 14 },
          { header: "Due Back", key: "end", width: 14 },
          { header: "State", key: "state", width: 20 },
          { header: "Overdue", key: "overdue", width: 10 },
        ],
        filtered.map(e => ({
          name: e.student.full_name,
          sid: e.student.student_id_number ?? "—",
          start: e.start_date,
          end: e.end_date,
          state: e.leave_state,
          overdue: (e.leave_state === "outside_school" && e.end_date < today) ? "Yes" : "No",
        })),
        `Gate Leave Report — ${today}`
      );
      toast.success("Exported");
    } catch (err: any) { toast.error(err?.message ?? "Export failed"); }
  };

  const handleConfirmExit = async () => {
    if (!confirming) return;
    setActing(true);
    try {
      await leavesApi.confirmExit(confirming.leave_id, notes || undefined);
      toast.success(`Gate exit confirmed for ${confirming.student.full_name}`);
      setConfirming(null);
      setNotes("");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to confirm exit");
    } finally {
      setActing(false);
    }
  };

  return (
    <GateKeeperLayout title="Boarding Leave — Gate Verification" subtitle="Verify student identity and confirm physical exit">
      {/* Security info banner */}
      <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800 text-sm flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          <strong>Security Protocol:</strong> Before allowing a student to exit, verify their physical appearance against the system photo.
          Only students with <strong>Awaiting Exit</strong> status have approved leave. You cannot approve or create leave — contact the Director of Discipline.
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <StatCard label="Awaiting Exit"    value={stats.awaitingExit} tone="warning"     icon={<Clock className="h-5 w-5" />} />
            <StatCard label="Currently Outside" value={stats.outside}     tone="primary"     icon={<LogOut className="h-5 w-5" />} />
            <StatCard label="Overdue Returns"   value={stats.overdue}     tone="destructive" icon={<AlertTriangle className="h-5 w-5" />} />
          </>
        )}
      </div>

      {/* Overdue alert */}
      {!loading && stats.overdue > 0 && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {stats.overdue} student{stats.overdue !== 1 ? "s" : ""} overdue — expected return date has passed. Notify the Director of Discipline.
        </div>
      )}

      {/* Filter toolbar */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search by name or student ID…"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" />
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-1 bg-background">
          {(["pending", "all"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition ${view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              {v === "pending" ? "Awaiting Exit" : "All Approved"}
            </button>
          ))}
        </div>
        <button onClick={handleExport}
          className="h-10 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-semibold hover:bg-muted">
          <Download className="h-4 w-4" /> Export
        </button>
      </div>

      {/* Cards grid — for awaiting exit, show large cards with photo */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-64" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          {view === "pending" ? "No students awaiting gate exit right now." : "No approved exits found."}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(exit => {
            const isAwaiting = exit.leave_state === "awaiting_physical_exit";
            const isOutside  = exit.leave_state === "outside_school";
            const isOverdue  = isOutside && exit.end_date < today;
            return (
              <div key={exit.leave_id}
                className={`rounded-xl border bg-card overflow-hidden transition ${
                  isAwaiting ? "border-amber-300 shadow-md" :
                  isOverdue  ? "border-destructive/40" : "border-border"
                }`}>
                {/* Student photo section */}
                <div className="relative bg-muted/40 p-4 flex items-center gap-4">
                  {exit.student.photo_url ? (
                    <img src={exit.student.photo_url} alt={exit.student.full_name}
                      className="h-20 w-20 rounded-xl object-cover border-2 border-background shadow-md shrink-0" />
                  ) : (
                    <div className="h-20 w-20 rounded-xl bg-muted flex items-center justify-center text-2xl font-bold shrink-0">
                      {(exit.student.first_name?.[0] ?? "") + (exit.student.last_name?.[0] ?? "")}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-display font-bold text-base leading-tight truncate">{exit.student.full_name}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{exit.student.student_id_number ?? "—"}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 capitalize">{exit.student.gender ?? ""}</div>
                    {exit.student.dormitory && (
                      <div className="text-xs text-muted-foreground mt-0.5">{exit.student.dormitory.name}</div>
                    )}
                  </div>
                  {/* State badge top-right */}
                  <span className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATE_BADGE[exit.leave_state] ?? "bg-muted text-muted-foreground"}`}>
                    {exit.leave_state.replace(/_/g, " ")}
                  </span>
                </div>

                {/* Leave details */}
                <div className="px-4 py-3 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Leave Type:</span>
                    <span className="font-medium capitalize">{exit.leave_type?.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Approved:</span>
                    <span>{exit.approved_at?.slice(0, 16).replace("T", " ") ?? "—"}</span>
                  </div>
                  {exit.destination && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Destination:</span>
                      <span className="truncate max-w-[140px] text-right">{exit.destination}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Return by:</span>
                    <span className={isOverdue ? "text-destructive font-bold" : "font-medium"}>
                      {exit.end_date} {isOverdue && "— OVERDUE"}
                    </span>
                  </div>
                  {exit.exit_record && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Exited at:</span>
                      <span className="text-emerald-600 font-medium">{exit.exit_record.exit_at.slice(11, 16)}</span>
                    </div>
                  )}
                </div>

                {/* Action */}
                <div className="px-4 pb-4">
                  {isAwaiting ? (
                    <button onClick={() => { setConfirming(exit); setNotes(""); }}
                      className="w-full rounded-lg bg-emerald-600 text-white py-3 font-bold text-sm hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-sm">
                      <LogOut className="h-4 w-4" />
                      CONFIRM GATE EXIT
                    </button>
                  ) : isOutside ? (
                    <div className={`w-full rounded-lg py-2.5 text-center text-sm font-semibold ${isOverdue ? "bg-destructive/10 text-destructive" : "bg-orange-50 text-orange-700"}`}>
                      {isOverdue ? "⚠ OVERDUE — Notify DOD" : "Student Outside School"}
                    </div>
                  ) : (
                    <div className="w-full rounded-lg bg-emerald-50 text-emerald-700 py-2.5 text-center text-sm font-semibold flex items-center justify-center gap-1.5">
                      <CheckCircle className="h-4 w-4" /> Exit Confirmed
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CONFIRM GATE EXIT modal */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card shadow-2xl overflow-hidden">
            {/* Photo header */}
            <div className="bg-muted/50 p-5 flex items-center gap-4 border-b border-border">
              {confirming.student.photo_url ? (
                <img src={confirming.student.photo_url} alt="" className="h-16 w-16 rounded-xl object-cover border-2 border-white shadow shrink-0" />
              ) : (
                <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center text-xl font-bold shrink-0">
                  {(confirming.student.first_name?.[0] ?? "") + (confirming.student.last_name?.[0] ?? "")}
                </div>
              )}
              <div>
                <div className="font-display font-bold">{confirming.student.full_name}</div>
                <div className="text-xs text-muted-foreground font-mono">{confirming.student.student_id_number}</div>
                <div className="text-xs text-muted-foreground">{confirming.student.dormitory?.name}</div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Identity check instruction */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-800 text-xs">
                <strong>Identity Check:</strong> Visually compare the student in front of you against the photo above before confirming exit.
              </div>

              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Leave Type:</span>
                  <span className="font-medium capitalize">{confirming.leave_type?.replace(/_/g, " ")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expected Return:</span>
                  <span className="font-medium">{confirming.end_date}</span>
                </div>
                {confirming.destination && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Destination:</span>
                    <span>{confirming.destination}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Notes (optional)</label>
                <input value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Parent present at gate"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>

              <button onClick={handleConfirmExit} disabled={acting}
                className="w-full rounded-lg bg-emerald-600 text-white py-3 font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                <LogOut className="h-4 w-4" />
                {acting ? "Confirming…" : "CONFIRM GATE EXIT"}
              </button>
              <button onClick={() => setConfirming(null)} disabled={acting}
                className="w-full rounded-lg border border-border py-2.5 text-sm font-semibold hover:bg-muted">
                Cancel — Do Not Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </GateKeeperLayout>
  );
}
