import { useState, useEffect, useRef } from "react";
import { Plus, RefreshCw, Download, Clock } from "lucide-react";
import { Button } from "../../components/ui/button";
import { DeviceCard } from "../../components/device-management/DeviceCard";
import { DeviceStatusPanel } from "../../components/device-management/DeviceStatusPanel";
import { AddTabletModal } from "../../components/device-management/AddTabletModal";
import { DEFAULT_FK623_CONFIG, tabletApi, Tablet, DeviceStatus } from "../../lib/tabletApi";
import { apiRequest } from "../../lib/api";
import { toast } from "sonner";

export default function DeviceManagement() {
  const [tablets, setTablets] = useState<Tablet[]>([]);
  const [selectedTablet, setSelectedTablet] = useState<Tablet | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTablet, setEditingTablet] = useState<Tablet | null>(null);
  const [deviceUsers, setDeviceUsers] = useState<any[]>([]);
  const [readMark, setReadMark] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const statusRequestInFlight = useRef(false);

  // Load tablets on mount
  useEffect(() => {
    loadTablets();
  }, []);

  // Auto-select first tablet when tablets load
  useEffect(() => {
    if (tablets.length > 0 && !selectedTablet) {
      setSelectedTablet(tablets[0]);
    }
  }, [tablets]);

  // Reload device status when selected tablet changes
  useEffect(() => {
    if (selectedTablet) {
      loadDeviceStatus(selectedTablet.id);
    }
  }, [selectedTablet]);

  // Poll live status. The backend attempts reconnect when the FK623 is disconnected.
  useEffect(() => {
    if (!selectedTablet) return;
    
    const interval = setInterval(() => {
      loadDeviceStatus(selectedTablet.id, true); // silent reload
    }, 60000);

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
        current.map((tablet) =>
          tablet.id === tabletId
            ? { ...tablet, status: response.data?.connected ? "online" : "offline" }
            : tablet
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
    if (selectedTablet) {
      await loadDeviceStatus(selectedTablet.id);
    }
    await loadTablets(true);
  };

  const handleSaveTablet = async (data: any) => {
    if (editingTablet) {
      await tabletApi.update(editingTablet.id, data);
      toast.success("Tablet updated successfully");
    } else {
      await tabletApi.create(data);
      toast.success("Tablet added successfully");
    }
    setEditingTablet(null);
    await loadTablets();
  };

  const handleConnect = async (tablet: Tablet) => {
    try {
      const response = await tabletApi.connect({
        tabletId: tablet.id,
        ...DEFAULT_FK623_CONFIG,
      });
      setDeviceStatus(response.data);
      setStatusMessage(response.data?.message || null);
      toast.success("Connected to device successfully");
      await loadTablets();
    } catch (error: any) {
      toast.error(error.message || "Failed to connect to device");
    }
  };

  const handleDisconnect = async (tablet: Tablet) => {
    try {
      await tabletApi.disconnect(tablet.id);
      setDeviceStatus(null);
      toast.success("Disconnected from device");
      await loadTablets();
    } catch (error: any) {
      toast.error(error.message || "Failed to disconnect");
    }
  };

  const handleSync = async (tablet: Tablet) => {
    try {
      await tabletApi.syncTime(tablet.id);
      toast.success("Time synced successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to sync time");
    }
  };

  const handleEdit = (tablet: Tablet) => {
    setEditingTablet(tablet);
    setShowAddModal(true);
  };

  const handleDelete = async (tablet: Tablet) => {
    if (!confirm(`Are you sure you want to delete ${tablet.name}?`)) return;
    
    try {
      await tabletApi.delete(tablet.id);
      toast.success("Tablet deleted successfully");
      await loadTablets();
      if (selectedTablet?.id === tablet.id) {
        setSelectedTablet(null);
        setDeviceStatus(null);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to delete tablet");
    }
  };

  const handlePullLogs = async () => {
    if (!selectedTablet) return;
    
    try {
      const response = await tabletApi.pullLogs({
        tabletId: selectedTablet.id,
        readMark,
      });
      toast.success(
        `Pulled ${response.data.savedCount} logs (${response.data.duplicateCount} duplicates)`
      );
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
            Manage biometric attendance devices and synchronize data
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} disabled={loading || statusLoading} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Tablet
          </Button>
        </div>
      </div>

      {/* Tablets Grid */}
      {tablets.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <div className="mx-auto max-w-md">
            <h3 className="text-lg font-semibold mb-2">No tablets registered</h3>
            <p className="text-gray-600 mb-4">
              Add your first tablet device to start managing biometric attendance
            </p>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Tablet
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tablets.map((tablet) => (
              <DeviceCard
                key={tablet.id}
                tablet={tablet}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onSync={handleSync}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>

          {/* Device Status Section */}
          {selectedTablet && (
            <>
              <div className="flex items-center justify-between">
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

              {/* Device Users Section */}
              {deviceUsers.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    Device Users ({deviceUsers.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {deviceUsers.map((user) => (
                      <div
                        key={user.userId}
                        className="rounded-lg border border-gray-100 bg-gray-50 p-4"
                      >
                        <div className="font-semibold">{user.name}</div>
                        <div className="text-sm text-gray-600">ID: {user.userId}</div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(user.biometricMethods || []).map((method: string) => (
                            <span
                              key={method}
                              className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full"
                            >
                              {method}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      <AddTabletModal
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingTablet(null);
        }}
        mode={editingTablet ? "edit" : "create"}
        initialData={editingTablet}
        onSubmit={handleSaveTablet}
      />
    </div>
  );
}



