/**
 * DOD Gate Exits — view the full exit log (read-only for DOD, action is gate keeper's)
 * Shows approved exits, currently outside students, and late returns.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { DodLayout } from "@/components/layout/DodLayout";
import { directorOfDisciplineRouteGuard } from "@/lib/schoolAuth";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { leavesApi, type ApprovedExit } from "@/lib/boardingApi";

export const Route = createFileRoute("/dod/gate-exits")({
  beforeLoad: ({ location }) => directorOfDisciplineRouteGuard(location),
  component: DodGateExitsPage,
});

function DodGateExitsPage() {
  const [exits, setExits] = useState<ApprovedExit[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    leavesApi.getApprovedExits()
      .then(data => setExits(Array.isArray(data) ? data : []))
      .catch(e => toast.error(e?.message ?? "Failed to load exits"))
      .finally(() => setLoading(false));
  }, []);

  const outside = exits.filter(e => e.leave_state === "outside_school");
  const awaitingExit = exits.filter(e => e.leave_state === "awaiting_physical_exit");
  const lateReturns = exits.filter(e => e.leave_state === "outside_school" && e.end_date < today);

  return (
    <DodLayout title="Gate Exits" subtitle="Students awaiting or currently on approved exit">
      <div className="grid grid-cols-3 gap-3 mb-5">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <StatCard label="Awaiting Exit"    value={awaitingExit.length} tone="warning" icon={<ShieldCheck className="h-5 w-5" />} />
            <StatCard label="Currently Outside" value={outside.length}     tone="primary"  icon={<Clock className="h-5 w-5" />} />
            <StatCard label="Late Returns"      value={lateReturns.length} tone="destructive" icon={<AlertTriangle className="h-5 w-5" />} />
          </>
        )}
      </div>

      {!loading && lateReturns.length > 0 && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {lateReturns.length} student{lateReturns.length !== 1 ? "s" : ""} overdue — expected return date has passed.
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                {["Student", "ID", "Dormitory", "Room", "Leave Type", "Approved", "Expected Return", "Exited At", "State"].map(h => (
                  <th key={h} className="text-left px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : exits.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No approved exits found.</td></tr>
              ) : (
                exits.map(e => {
                  const isLate = e.leave_state === "outside_school" && e.end_date < today;
                  return (
                    <tr key={e.leave_id} className={`border-t border-border hover:bg-muted/20 ${isLate ? "bg-red-50" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {e.student.photo_url ? (
                            <img src={e.student.photo_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0 border border-border" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                              {(e.student.first_name?.[0] ?? "") + (e.student.last_name?.[0] ?? "")}
                            </div>
                          )}
                          <div>
                            <div className="font-medium">{e.student.full_name}</div>
                            <div className="text-xs text-muted-foreground">{e.student.gender}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono">{e.student.student_id_number ?? "—"}</td>
                      <td className="px-4 py-3 text-xs">{e.student.dormitory?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-xs">{e.student.room?.room_number ?? "—"}</td>
                      <td className="px-4 py-3 text-xs">{e.leave_type?.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 text-xs">{e.approved_at?.slice(0, 10) ?? "—"}</td>
                      <td className="px-4 py-3 text-xs">{e.end_date}</td>
                      <td className="px-4 py-3 text-xs">{e.exit_record?.exit_at?.slice(0, 16).replace("T", " ") ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          isLate ? "bg-destructive/15 text-destructive"
                          : e.leave_state === "outside_school" ? "bg-orange-100 text-orange-700"
                          : "bg-purple-100 text-purple-700"
                        }`}>
                          {isLate ? "OVERDUE" : e.leave_state.replace(/_/g, " ")}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DodLayout>
  );
}
