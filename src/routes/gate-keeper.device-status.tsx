import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { RefreshCw, Wifi, WifiOff, Clock } from "lucide-react";
import { toast } from "sonner";
import { GateKeeperLayout } from "@/components/layout/GateKeeperLayout";
import { gateKeeperRouteGuard } from "@/lib/schoolAuth";
import { DeviceStatusCards, isDeviceOnline, type DeviceRecord } from "@/components/ui-kit/DeviceStatusCards";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/gate-keeper/device-status")({
  beforeLoad: ({ location }) => gateKeeperRouteGuard(location),
  component: GateKeeperDeviceStatusPage,
});

function lastSeenLabel(last_seen_at?: string | null): string {
  if (!last_seen_at) return "Never";
  const ms = Date.now() - new Date(last_seen_at).getTime();
  if (ms < 60_000)      return "Just now";
  if (ms < 3_600_000)   return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000)  return `${Math.floor(ms / 3_600_000)}h ago`;
  return new Date(last_seen_at).toLocaleDateString();
}

function GateKeeperDeviceStatusPage() {
  const [devices, setDevices]     = useState<DeviceRecord[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadDevices = async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      // GET /devices returns devices with last_seen_at and is_online/is_connected
      // populated from the DB (updated by bridge-sse job on every scan and
      // pull-logs sweep). For real-time status we use the 5-minute last_seen_at window.
      const data = await apiRequest<any>(
        "/devices?limit=500&sort=last_seen_at&order=desc",
        { auth: "school" }
      );
      const list: DeviceRecord[] = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.data) ? (data as any).data : [];
      setDevices(list);
      setLastRefresh(new Date());
    } catch (error: any) {
      if (!silent) toast.error(error?.message ?? "Failed to load device status");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => { void loadDevices(); }, []);

  // Auto-refresh every 30 seconds — matches the bridge-sse last_seen_at update interval
  useEffect(() => {
    const iv = setInterval(() => void loadDevices(true), 30_000);
    return () => clearInterval(iv);
  }, []);

  const onlineCount  = devices.filter(isDeviceOnline).length;
  const offlineCount = devices.length - onlineCount;

  return (
    <GateKeeperLayout
      title="Device Status"
      subtitle="Live status of all campus biometric devices"
    >
      {/* Header bar */}
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `${devices.length} devices — `}
            {!loading && (
              <>
                <span className="text-success font-semibold">{onlineCount} online</span>
                {offlineCount > 0 && <>, <span className="text-destructive font-semibold">{offlineCount} offline</span></>}
              </>
            )}
          </span>
          {lastRefresh && !loading && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> Updated {lastSeenLabel(lastRefresh.toISOString())}
            </span>
          )}
        </div>
        <button
          onClick={() => void loadDevices()}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${(loading || refreshing) ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Status cards */}
      {loading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : (
        <DeviceStatusCards devices={devices} />
      )}

      {/* Device table */}
      {!loading && devices.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-display font-bold text-lg">All Devices</h3>
            <span className="text-xs text-muted-foreground">
              Status based on last contact — auto-refreshes every 30s
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  {["Name", "UID", "Location", "Mode", "Status", "Last Contact", "Sync"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => {
                  const online = isDeviceOnline(device);
                  return (
                    <tr key={device.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-3 font-semibold">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${online ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
                          {device.name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{device.device_uid}</td>
                      <td className="px-4 py-3">{device.location ?? "—"}</td>
                      <td className="px-4 py-3 capitalize">{device.mode ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          online
                            ? "bg-success/15 text-success"
                            : "bg-destructive/15 text-destructive"
                        }`}>
                          {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                          {online ? "Online" : "Offline"}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                        {device.last_seen_at ? lastSeenLabel(device.last_seen_at) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {device.last_sync_error ? (
                          <span className="text-destructive truncate max-w-[180px] block" title={device.last_sync_error}>
                            {device.last_sync_error.slice(0, 40)}{device.last_sync_error.length > 40 ? "…" : ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground capitalize">{device.last_sync_status ?? "—"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && devices.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          No devices registered. Contact the platform administrator.
        </div>
      )}
    </GateKeeperLayout>
  );
}
