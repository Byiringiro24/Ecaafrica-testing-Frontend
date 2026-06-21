import { MapPin, Wifi, WifiOff } from "lucide-react";
import { StatCard } from "@/components/ui-kit/StatCard";

export type DeviceRecord = {
  id: string;
  name: string;
  device_uid: string;
  location?: string | null;
  mode?: string | null;
  type?: string | null;
  is_active?: boolean;
  last_seen_at?: string | null;
};

type DeviceLocationRow = {
  label: string;
  active: number;
  offline: number;
};

function buildLocationRows(devices: DeviceRecord[]): DeviceLocationRow[] {
  const grouped = devices.reduce((acc, device) => {
    const key = (device.location?.trim() || device.mode?.trim() || "Unknown location").toLowerCase();
    const label = device.location?.trim() || device.mode?.trim() || "Unknown location";
    const current = acc.get(key) ?? { label, active: 0, offline: 0 };
    if (device.is_active === false) {
      current.offline += 1;
    } else {
      current.active += 1;
    }
    acc.set(key, current);
    return acc;
  }, new Map<string, DeviceLocationRow>());

  return Array.from(grouped.values()).sort((a, b) => a.label.localeCompare(b.label));
}

export function DeviceStatusCards({ devices }: { devices: DeviceRecord[] }) {
  const activeDevices = devices.filter((device) => device.is_active !== false);
  const offlineDevices = devices.filter((device) => device.is_active === false);
  const deviceLocationRows = buildLocationRows(devices);

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
      <StatCard
        label="Active Devices"
        value={activeDevices.length}
        icon={<Wifi className="h-5 w-5" />}
        trend="Online and reachable"
        tone="success"
      />
      <StatCard
        label="Offline Devices"
        value={offlineDevices.length}
        icon={<WifiOff className="h-5 w-5" />}
        trend="Not currently connected"
        tone="destructive"
      />
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-muted-foreground truncate text-xs uppercase tracking-wider">
              Device Locations
            </p>
            <p className="font-display font-bold truncate text-3xl mt-2">{deviceLocationRows.length}</p>
            <p className="text-xs text-muted-foreground mt-1.5 truncate">
              Gate, dormitory, classroom and more
            </p>
          </div>
          <div className="grid shrink-0 place-items-center rounded-lg h-11 w-11 bg-primary/10 text-primary">
            <MapPin className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {deviceLocationRows.slice(0, 4).map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-xs"
            >
              <span className="font-semibold truncate">{row.label}</span>
              <span className="text-muted-foreground shrink-0">
                A {row.active} / O {row.offline}
              </span>
            </div>
          ))}
          {deviceLocationRows.length === 0 && (
            <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
              No devices registered yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
