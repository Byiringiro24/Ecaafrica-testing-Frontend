import { MapPin, Wifi, WifiOff, Clock } from "lucide-react";
import { StatCard } from "@/components/ui-kit/StatCard";

export type DeviceRecord = {
  id: string;
  name: string;
  device_uid: string;
  location?: string | null;
  mode?: string | null;
  type?: string | null;
  is_active?: boolean;
  is_online?: boolean;
  is_connected?: boolean;
  last_seen_at?: string | null;
  last_sync_status?: string | null;
  last_sync_error?: string | null;
  status?: string | null;
};

/**
 * Determine if a device is actually online right now.
 *
 * Priority:
 *  1. `is_online` / `is_connected` field set by the status check endpoint
 *  2. `last_seen_at` within the last 5 minutes (device was pinging recently)
 *  3. Fall back to offline
 *
 * We deliberately do NOT use `is_active` — that is a registration flag
 * ("this device is configured"), not a real-time connectivity indicator.
 */
export function isDeviceOnline(device: DeviceRecord): boolean {
  // Explicit real-time status from /devices/:id/status or bridge-sse update
  if (device.is_online === true || device.is_connected === true) return true;
  if (device.is_online === false || device.is_connected === false) return false;
  // Fall back to last_seen_at within 10 minutes (matches backend grace window)
  if (device.last_seen_at) {
    const age = Date.now() - new Date(device.last_seen_at).getTime();
    return age < 10 * 60 * 1000;
  }
  return false;
}

/** Human-readable time since last seen */
function lastSeenLabel(last_seen_at?: string | null): string {
  if (!last_seen_at) return "Never";
  const ms = Date.now() - new Date(last_seen_at).getTime();
  if (ms < 60_000)          return "Just now";
  if (ms < 3_600_000)       return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000)      return `${Math.floor(ms / 3_600_000)}h ago`;
  return new Date(last_seen_at).toLocaleDateString();
}

type DeviceLocationRow = {
  label: string;
  online: number;
  offline: number;
};

function buildLocationRows(devices: DeviceRecord[]): DeviceLocationRow[] {
  const grouped = devices.reduce((acc, device) => {
    const key = (device.location?.trim() || device.mode?.trim() || "Unknown location").toLowerCase();
    const label = device.location?.trim() || device.mode?.trim() || "Unknown location";
    const current = acc.get(key) ?? { label, online: 0, offline: 0 };
    if (isDeviceOnline(device)) {
      current.online += 1;
    } else {
      current.offline += 1;
    }
    acc.set(key, current);
    return acc;
  }, new Map<string, DeviceLocationRow>());

  return Array.from(grouped.values()).sort((a, b) => a.label.localeCompare(b.label));
}

export function DeviceStatusCards({ devices }: { devices: DeviceRecord[] }) {
  const onlineDevices  = devices.filter(isDeviceOnline);
  const offlineDevices = devices.filter(d => !isDeviceOnline(d));
  const locationRows   = buildLocationRows(devices);

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
      <StatCard
        label="Online Devices"
        value={onlineDevices.length}
        icon={<Wifi className="h-5 w-5" />}
        trend={`${devices.length} total registered`}
        tone="success"
      />
      <StatCard
        label="Offline Devices"
        value={offlineDevices.length}
        icon={<WifiOff className="h-5 w-5" />}
        trend={offlineDevices.length > 0 ? "Check bridge connectivity" : "All devices reachable"}
        tone={offlineDevices.length > 0 ? "destructive" : "primary"}
      />
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-muted-foreground truncate text-xs uppercase tracking-wider">
              Device Locations
            </p>
            <p className="font-display font-bold truncate text-3xl mt-2">{locationRows.length}</p>
            <p className="text-xs text-muted-foreground mt-1.5 truncate">
              Gate, dormitory, classroom and more
            </p>
          </div>
          <div className="grid shrink-0 place-items-center rounded-lg h-11 w-11 bg-primary/10 text-primary">
            <MapPin className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {locationRows.slice(0, 4).map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-xs"
            >
              <span className="font-semibold truncate">{row.label}</span>
              <span className="text-muted-foreground shrink-0">
                <span className="text-success font-medium">{row.online}</span>
                {" / "}
                <span className={row.offline > 0 ? "text-destructive font-medium" : "text-muted-foreground"}>{row.offline}</span>
              </span>
            </div>
          ))}
          {locationRows.length === 0 && (
            <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
              No devices registered yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
