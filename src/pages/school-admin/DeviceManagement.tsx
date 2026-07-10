import { useState, useEffect, useRef } from "react";
import { RefreshCw, Download, Clock } from "lucide-react";
import { Button } from "../../components/ui/button";
import { DeviceCard } from "../../components/device-management/DeviceCard";
import { DeviceStatusPanel } from "../../components/device-management/DeviceStatusPanel";
import { tabletApi, Tablet, DeviceStatus } from "../../lib/tabletApi";
import { toast } from "sonner";

export default function DeviceManagement() {
  const [tablets, setTablets] = useState<Tablet[]>([]);
  const [selectedTablet, setSelectedTablet] = useState<Tablet | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [deviceUsers, setDeviceUsers] = useState<any[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const statusRequestInFlight = useRef(false);

  useEffect(() => { loadTablets(); }, []);

  useEffect(() => {
    if (tablets.length > 0 && !selectedTablet) setSelectedTablet(tablets[0]);
  }, [tablets]);

  useEffect(() => {
    if (selectedTablet) loadDeviceStatus(selectedTablet.id);
  }, [selectedTablet]);

  // Poll device status every 15 seconds
  useEffect(() => {
    if (!selectedTablet) return;
    const interval = setInterval(() => {
      loadDeviceStatus(selectedTablet.id, true);
    }, 15_000);
    return () => clearInterval(interval);
  }, [selectedTablet]);

  const loadTablets = async (silent = false) => {
    setLoading(true);
    try {
      const response = await tabletApi.getAll();
      setTablets(response.tablets || []);
    } catch (error: any) {
      if (!silent) toast.error(error.message || "Failed to load tablets");
    } finally {
      setLoading(false);
    }
  };

  const loadDeviceStatus = async (tabletId: string, silent = false) => {
    if (statusRequestInFlight.current) return;
    statusRequestInFlight.current = true;
    if (!silent) setStatusLoading(true);
    try {
      const response = await tabletApi.getStatus(tabletId);
      setDeviceStatus(response.data);
      setStatusMessage(response.data?.message || null);
      setTablets((current) =>
        current.map((t) =>
          t.id === tabletId
            ? { ...t, status: response.data?.connected ? "online" : "offline" }
            : t
        )
      );
    } catch (error: any) {
      setDeviceStatus({ connected: false, message: error.message || "Device status unavailable" });
      setStatusMessage(error.message || "Device status unavailable");
      if (!silent) toast.error(error.message || "Failed to load device status");
    } finally {
      statusRequestInFlight.current = false;
      if (!silent) setStatusLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (selectedTablet) await loadDeviceStatus(selectedTablet.id);
    await loadTablets(true);
  };

  const handlePullLogs = async () => {
    if (!selectedTablet) return;
    try {
      const response = await tabletApi.pullLogs({ tabletId: selectedTablet.id, readMark: 0 });
      toast.success(`Pulled ${response.data.savedCount} logs (${response.data.duplicateCount} duplicates)`);
      await loadDeviceStatus(selectedTablet.id);
    } catch (error: any) {
      toast.error(error.message || "Failed to pull logs");
    }
  };

  const handlePullUsers = async () => {
    if (!selectedTablet) return;
    try {
      const response = await tabletApi.getUsers(selectedTablet.id);
      setDeviceUsers(response.data.users || []);
      toast.success(`Fetched ${response.data.count} users from device`);
    } catch (error: any) {
      toast.error(error.message || "Failed to pull users");
    }
  };

  const handleSyncTime = async () => {
    if (!selectedTablet) return;
    try {
      await tabletApi.syncTime(selectedTablet.id);
      toast.success("Device time synced successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to sync time");
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Device Management</h1>
          <p className="text-gray-600 mt-1">
            View assigned biometric devices and their connection status
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={loading || statusLoading} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Info banner — registration is super admin only */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
        Tablets and biometric devices are registered and assigned by the platform admin.
        Contact your platform admin to add or change devices for your school.
      </div>

      {/* Tablets Grid — view only */}
      {tablets.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <h3 className="text-lg font-semibold mb-2">No tablets assigned</h3>
          <p className="text-gray-600">
            No tablets have been assigned to your school yet. Contact the platform administrator.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tablets.map((tablet) => (
              <DeviceCard
                key={tablet.id}
                tablet={tablet}
                onConnect={undefined}
                onDisconnect={undefined}
                onSync={undefined}
                onEdit={undefined}
                onDelete={undefined}
              />
            ))}
          </div>

          {selectedTablet && (
            <>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-2xl font-bold">
                  Device Status: {selectedTablet.name}
                </h2>
                {statusMessage && (
                  <span className="text-sm text-gray-500">{statusMessage}</span>
                )}
                <div className="flex gap-2">
                  <Button onClick={handleSyncTime} disabled={!deviceStatus?.connected} variant="outline" size="sm">
                    <Clock className="mr-2 h-4 w-4" />
                    Sync Time
                  </Button>
                  <Button onClick={handlePullUsers} disabled={!deviceStatus?.connected} variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Pull Users
                  </Button>
                  <Button onClick={handlePullLogs} disabled={!deviceStatus?.connected} size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Pull Logs
                  </Button>
                </div>
              </div>

              <DeviceStatusPanel status={deviceStatus} loading={statusLoading} />

              {deviceUsers.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    Device Users ({deviceUsers.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {deviceUsers.map((user) => (
                      <div key={user.userId} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                        <div className="font-semibold">{user.name}</div>
                        <div className="text-sm text-gray-600">ID: {user.userId}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
