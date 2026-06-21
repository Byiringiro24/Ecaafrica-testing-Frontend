import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GateKeeperLayout } from "@/components/layout/GateKeeperLayout";
import { gateKeeperRouteGuard } from "@/lib/schoolAuth";
import { DeviceStatusCards, type DeviceRecord } from "@/components/ui-kit/DeviceStatusCards";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/gate-keeper/device-status")({
  beforeLoad: ({ location }) => gateKeeperRouteGuard(location),
  component: GateKeeperDeviceStatusPage,
});

function GateKeeperDeviceStatusPage() {
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDevices = async () => {
      setLoading(true);
      try {
        const data = await apiRequest<DeviceRecord[]>(
          "/devices?limit=500&sort=created_at&order=desc",
          { auth: "school" }
        );
        setDevices(Array.isArray(data) ? data : []);
      } catch (error: any) {
        toast.error(error?.message ?? "Failed to load device status");
      } finally {
        setLoading(false);
      }
    };

    void loadDevices();
  }, []);

  return (
    <GateKeeperLayout
      title="Device Status"
      subtitle="Active and offline devices by location"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Monitor gate scanners, boarding devices, and other campus hardware.
        </p>
        <span className="text-xs text-muted-foreground shrink-0">
          {loading ? "Loading…" : `${devices.length} devices`}
        </span>
      </div>

      {loading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : (
        <DeviceStatusCards devices={devices} />
      )}

      {!loading && devices.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-display font-bold text-lg">All Devices</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  {["Name", "UID", "Location", "Mode", "Status", "Last Seen"].map((header) => (
                    <th key={header} className="text-left px-4 py-3 whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr key={device.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3 font-semibold">{device.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{device.device_uid}</td>
                    <td className="px-4 py-3">{device.location ?? "—"}</td>
                    <td className="px-4 py-3 capitalize">{device.mode ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          device.is_active === false
                            ? "bg-destructive/15 text-destructive"
                            : "bg-success/15 text-success"
                        }`}
                      >
                        {device.is_active === false ? "Offline" : "Active"}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {device.last_seen_at
                        ? new Date(device.last_seen_at).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </GateKeeperLayout>
  );
}
