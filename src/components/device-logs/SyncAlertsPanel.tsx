import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type SyncState = "Synced" | "Queued" | "Failed";

type DeviceLog = {
  id: string;
  deviceId: string;
  studentName: string;
  time: string;
  syncState: SyncState;
};

interface SyncAlertsPanelProps {
  alerts: DeviceLog[];
  maxAlerts?: number;
}

export function SyncAlertsPanel({ alerts, maxAlerts = 4 }: SyncAlertsPanelProps) {
  // Filter to only show logs that are not synced (Queued or Failed)
  const unsyncedAlerts = alerts.filter((log) => log.syncState !== "Synced");
  
  // Limit to the maximum number of alerts
  const displayedAlerts = unsyncedAlerts.slice(0, maxAlerts);

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-display font-bold">Sync Alerts</h4>
        <AlertTriangle className="h-4 w-4 text-amber-600" />
      </div>
      <div className="space-y-2 text-sm">
        {displayedAlerts.length > 0 ? (
          displayedAlerts.map((log) => (
            <div
              key={log.id}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
            >
              <div>
                <div className="font-semibold">{log.deviceId}</div>
                <div className="text-xs text-muted-foreground">
                  {log.studentName} - {log.time}
                </div>
              </div>
              <SyncBadge state={log.syncState} />
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-border px-3 py-4 text-center text-xs text-muted-foreground">
            No sync alerts at the moment.
          </div>
        )}
      </div>
    </div>
  );
}

function SyncBadge({ state }: { state: SyncState }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
        state === "Synced"
          ? "bg-success/15 text-success"
          : state === "Queued"
          ? "bg-amber-100 text-amber-700"
          : "bg-destructive/15 text-destructive"
      )}
    >
      {state}
    </span>
  );
}
