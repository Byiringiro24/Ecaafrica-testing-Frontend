import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Download } from "lucide-react";
import { toast } from "sonner";
import { StaffLayout } from "@/components/layout/StaffLayout";
import { ABSENCE_ALERTS_STAFF } from "@/lib/teacherStaffData";

export const Route = createFileRoute("/staff/alerts")({ component: AlertsPage });

const SEV_COLOR: any = { HIGH: "border-red-500 bg-red-50", MEDIUM: "border-amber-500 bg-amber-50", LOW: "border-indigo-500 bg-indigo-50" };
const SEV_BADGE: any = { HIGH: "bg-red-600 text-white", MEDIUM: "bg-amber-500 text-white", LOW: "bg-indigo-700 text-white" };

function exportAlertsCsv() {
  const headers = ["Time", "Student", "Class", "Dorm", "Type", "Severity", "Status", "Resolved By", "Notes"];
  const rows = ABSENCE_ALERTS_STAFF.map((a) => [a.time, a.studentName, a.class, a.dorm, a.alertType, a.severity, a.status, a.resolvedBy ?? "", a.notes ?? ""]);
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `absence-alerts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Alerts exported to Excel (CSV)");
}

function AlertsPage() {
  const [showRules, setShowRules] = useState(false);
  const active = ABSENCE_ALERTS_STAFF.filter(a => a.status === "Active");
  return (
    <StaffLayout title="Absence Alerts" subtitle="Active and historical absence alerts">
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={exportAlertsCsv}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold"
        >
          <Download className="h-4 w-4" /> Export Excel
        </button>
      </div>
      <div className="space-y-3 mb-6">
        {active.map(a => (
          <div key={a.id} className={`rounded-xl border-l-4 p-4 ${SEV_COLOR[a.severity]} flex items-center gap-4`}>
            <AlertTriangle className="h-6 w-6" />
            <div className="flex-1">
              <div className="font-semibold">{a.studentName} <span className="text-xs text-muted-foreground">({a.class} · {a.dorm})</span></div>
              <div className="text-sm text-muted-foreground">{a.alertType} — {a.time}</div>
            </div>
            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${SEV_BADGE[a.severity]}`}>{a.severity}</span>
            <div className="flex gap-2">
              <button className="text-xs font-semibold text-primary hover:underline">Notify Parent</button>
              <button className="text-xs font-semibold text-indigo-800 hover:underline">Resolve</button>
            </div>
          </div>
        ))}
      </div>
      <h3 className="font-display font-bold mb-3">Alerts History</h3>
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase"><tr><th className="text-left p-3">Time</th><th className="text-left p-3">Student</th><th className="text-left p-3">Type</th><th className="text-left p-3">Severity</th><th className="text-left p-3">Status</th><th className="text-left p-3">Notes</th></tr></thead>
          <tbody>
            {ABSENCE_ALERTS_STAFF.map((a, i) => (
              <tr key={a.id} className={`border-t ${i % 2 ? "bg-gray-50" : ""}`}>
                <td className="p-3 text-xs">{a.time}</td>
                <td className="p-3 font-medium">{a.studentName} <span className="text-xs text-muted-foreground">({a.class})</span></td>
                <td className="p-3 text-xs">{a.alertType}</td>
                <td className="p-3"><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${SEV_BADGE[a.severity]}`}>{a.severity}</span></td>
                <td className="p-3"><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${a.status === "Active" ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-800"}`}>{a.status}</span></td>
                <td className="p-3 text-xs text-muted-foreground">{a.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={() => setShowRules(s => !s)} className="mt-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        Alert Rules {showRules ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {showRules && (
        <div className="mt-2 rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground space-y-1">
          <div>• Morning roll absent + no leave = LOW alert</div>
          <div>• Evening roll absent = MEDIUM alert</div>
          <div>• Gate exit without return within 2 hours = HIGH alert</div>
          <div>• 3+ consecutive absences = MEDIUM alert</div>
        </div>
      )}
    </StaffLayout>
  );
}
