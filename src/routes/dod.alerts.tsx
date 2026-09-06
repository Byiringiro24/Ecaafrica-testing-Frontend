/** DOD Alerts & Exceptions — missing attendance, late returns, overdue leaves */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Clock, UserX, Check } from "lucide-react";
import { toast } from "sonner";
import { DodLayout } from "@/components/layout/DodLayout";
import { directorOfDisciplineRouteGuard } from "@/lib/schoolAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/dod/alerts")({
  beforeLoad: ({ location }) => directorOfDisciplineRouteGuard(location),
  component: DodAlertsPage,
});

type Alert = {
  id: string; student_id: string; alert_type: string; severity: string;
  status: string; description?: string | null; dormitory_id?: string | null;
  escalation_sent_at?: string | null; parent_sms_sent_at?: string | null;
  created_at: string;
  student?: { first_name?: string; last_name?: string; student_id_number?: string | null } | null;
  dormitory?: { name?: string } | null;
};

const SEVERITY_STYLE: Record<string, string> = {
  high: "bg-destructive/15 text-destructive border-destructive/30",
  medium: "bg-amber-50 text-amber-800 border-amber-200",
  low: "bg-blue-50 text-blue-700 border-blue-200",
};

const TYPE_LABELS: Record<string, string> = {
  boarding_absent: "Missing Attendance",
  gate_exit_no_return: "No Return After Exit",
  leave_overdue: "Leave Overdue",
  consecutive_absent: "Consecutive Absence",
  unauthorized_exit: "Unauthorized Exit",
};

function DodAlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<Alert[]>("/boarding/absence-alerts?limit=200&status=active", { auth: "school" });
      setAlerts(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleResolve = async (id: string) => {
    try {
      await apiRequest(`/boarding/absence-alerts/${id}/resolve`, {
        method: "PATCH",
        body: JSON.stringify({ resolution_note: resolutionNote }),
        auth: "school",
      });
      toast.success("Alert resolved");
      setResolving(null);
      setResolutionNote("");
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Failed to resolve"); }
  };

  const highCount = alerts.filter(a => a.severity === "high").length;
  const medCount = alerts.filter(a => a.severity === "medium").length;

  return (
    <DodLayout title="Alerts & Exceptions" subtitle="Active boarding alerts requiring your attention">
      {!loading && alerts.length > 0 && (
        <div className={`mb-5 rounded-lg border px-4 py-3 flex items-center gap-2 ${highCount > 0 ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-sm font-semibold">
            {highCount > 0 ? `${highCount} HIGH severity alert${highCount !== 1 ? "s" : ""} — immediate attention required` : `${medCount} medium-priority alert${medCount !== 1 ? "s" : ""}`}
          </span>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}</div>
      ) : alerts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-14 text-center text-sm text-muted-foreground">
          No active alerts. All boarding operations are running normally.
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(a => {
            const studentName = a.student ? `${a.student.first_name ?? ""} ${a.student.last_name ?? ""}`.trim() : "Unknown Student";
            return (
              <div key={a.id} className={`rounded-xl border p-4 ${SEVERITY_STYLE[a.severity] ?? "bg-muted"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-sm">{studentName}</div>
                      <div className="text-xs mt-0.5">
                        <span className="font-bold">{TYPE_LABELS[a.alert_type] ?? a.alert_type}</span>
                        {a.dormitory?.name && <span className="text-muted-foreground"> · {a.dormitory.name}</span>}
                      </div>
                      {a.description && <div className="text-xs mt-1 text-muted-foreground">{a.description}</div>}
                      <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>Severity: <strong className="text-foreground capitalize">{a.severity}</strong></span>
                        {a.escalation_sent_at && <span className="text-amber-600">Patron/DOD notified</span>}
                        {a.parent_sms_sent_at && <span className="text-primary">Parent SMS sent</span>}
                        <span>Created: {new Date(a.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => { setResolving(a.id); setResolutionNote(""); }}
                    className="shrink-0 inline-flex items-center gap-1 rounded-md border border-current px-2.5 py-1.5 text-xs font-semibold hover:bg-white/20">
                    <Check className="h-3.5 w-3.5" /> Resolve
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {resolving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
            <h2 className="font-display font-bold text-lg mb-3">Resolve Alert</h2>
            <label className="block text-sm font-semibold mb-1">Resolution Note</label>
            <textarea value={resolutionNote} onChange={e => setResolutionNote(e.target.value)} rows={3}
              placeholder="Describe the action taken…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => void handleResolve(resolving)}
                className="flex-1 rounded-lg bg-emerald-600 text-white py-2.5 font-semibold text-sm hover:bg-emerald-700">
                Mark Resolved
              </button>
              <button onClick={() => setResolving(null)}
                className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </DodLayout>
  );
}
