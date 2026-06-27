import { useState, useEffect } from "react";
import { RefreshCw, Smartphone, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { deviceApi, tabletApi, Device, Tablet } from "@/lib/deviceApi";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function DeviceManagementNew() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [tablets, setTablets] = useState<Tablet[]>([]);
  const [loading, setLoading] = useState(false);
  const [healthChecking, setHealthChecking] = useState<Record<string, boolean>>({});
  const currentUser = useCurrentUser();
  const isSystemAdmin = currentUser?.role === "system_admin";
  const isSchoolAdmin = currentUser?.role === "school_admin";

  useEffect(() => {
    loadDevices();
    loadTablets();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadDevices();
      loadTablets();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const loadDevices = async () => {
    setLoading(true);
    try {
      const response = await deviceApi.getAll();
      setDevices(response.data || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load devices");
    } finally {
      setLoading(false);
    }
  };

  const loadTablets = async () => {
    try {
      const response = await tabletApi.getAll();
      setTablets(response.data || []);
    } catch (error: any) {
      console.error("Failed to load tablets:", error);
    }
  };

  const checkDeviceHealth = async (device: Device) => {
    if (!device.tablet_ip || !device.tablet_port) {
      toast.error("Device not linked to a tablet");
      return;
    }

    const deviceKey = device.id;
    setHealthChecking((prev) => ({ ...prev, [deviceKey]: true }));

    try {
      // Try to reach the tablet backend
      const tabletUrl = `http://${device.tablet_ip}:${device.tablet_port}/api/health`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(tabletUrl, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        toast.success(`Device ${device.name} is online and reachable`);
        // Update local state to show online
        setDevices((prev) =>
          prev.map((d) =>
            d.id === device.id ? { ...d, is_connected: true, status: "online" } : d
          )
        );
      } else {
        toast.warning(`Device ${device.name} responded but may have issues`);
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        toast.error(`Device ${device.name} connection timeout`);
      } else {
        toast.error(`Device ${device.name} is offline or unreachable`);
      }
      // Update local state to show offline
      setDevices((prev) =>
        prev.map((d) =>
          d.id === device.id ? { ...d, is_connected: false, status: "offline" } : d
        )
      );
    } finally {
      setHealthChecking((prev) => ({ ...prev, [deviceKey]: false }));
    }
  };

  const getTabletForDevice = (device: Device): Tablet | undefined => {
    return tablets.find((t) => t.ip === device.tablet_ip && t.port === device.tablet_port);
  };

  const getModeBadge = (mode: string) => {
    const modeConfig = {
      gate: { variant: "default" as const, label: "Gate" },
      boarding: { variant: "secondary" as const, label: "Boarding" },
      classroom: { variant: "outline" as const, label: "Classroom" },
    };

    const config = modeConfig[mode as keyof typeof modeConfig] || modeConfig.classroom;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStatusIndicator = (device: Device) => {
    if (device.is_connected) {
      return <Badge variant="default" className="bg-green-600">Connected</Badge>;
    }
    return <Badge variant="secondary">Offline</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Device Management</h1>
          <p className="text-gray-600 mt-1">
            {isSystemAdmin 
              ? "Manage biometric devices across all schools (Platform Owner)"
              : "Manage biometric attendance devices and configure attendance rules"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadDevices} disabled={loading} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Devices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{devices.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Connected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {devices.filter(d => d.is_connected).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Offline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {devices.filter(d => !d.is_connected).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {devices.reduce((sum, d) => sum + (d.device_users_count || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Devices Grid */}
      {devices.length === 0 && !loading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Smartphone className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No devices registered</h3>
            <p className="text-gray-600 mb-4">
              {isSystemAdmin 
                ? "Add your first biometric device to start tracking attendance"
                : "No biometric devices have been registered yet. Contact platform administrator to register devices."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device) => {
            const tablet = getTabletForDevice(device);
            const isChecking = healthChecking[device.id];
            
            return (
              <Card key={device.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{device.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {device.device_uid}
                      </CardDescription>
                    </div>
                    {getStatusIndicator(device)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Mode:</span>
                      {getModeBadge(device.mode)}
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Location:</span>
                      <span>{device.location || "Not set"}</span>
                    </div>

                    {device.tablet_ip && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Tablet IP:</span>
                          <span className="font-mono text-xs">
                            {device.tablet_ip}:{device.tablet_port}
                          </span>
                        </div>
                        {tablet && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Tablet:</span>
                            <Badge variant={tablet.status === "online" ? "default" : "secondary"}>
                              {tablet.name}
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Users:</span>
                      <span className="font-semibold">{device.device_users_count || 0}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Logs:</span>
                      <span className="font-semibold">{device.device_logs_count || 0}</span>
                    </div>

                    {device.last_sync_at && (
                      <div className="text-xs text-gray-500">
                        Last sync: {new Date(device.last_sync_at).toLocaleString()}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 space-y-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => checkDeviceHealth(device)}
                      disabled={isChecking || !device.tablet_ip}
                      className="w-full"
                    >
                      <Activity className={`h-4 w-4 mr-2 ${isChecking ? "animate-pulse" : ""}`} />
                      {isChecking ? "Checking..." : "Check Health"}
                    </Button>
                    
                    {/* School Admin Operations */}
                    {isSchoolAdmin && (
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {/* TODO: Open config dialog */}}
                          className="w-full"
                        >
                          Configure
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {/* TODO: Push students */}}
                          className="w-full"
                        >
                          Push Students
                        </Button>
                      </div>
                    )}
                  </div>

                  {device.last_sync_error && (
                    <div className="mt-3 p-2 bg-red-50 rounded text-xs text-red-600">
                      {device.last_sync_error}
                    </div>
                  )}

                  {!device.tablet_ip && (
                    <div className="mt-3 p-2 bg-yellow-50 rounded text-xs text-yellow-600">
                      ⚠️ Device not linked to tablet
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Info Message for School Admin */}
      {isSchoolAdmin && devices.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="text-blue-600 mt-0.5">📚</div>
              <div className="flex-1 text-sm text-blue-800">
                <p className="font-semibold mb-1">School Administrator Access</p>
                <p>
                  You can manage attendance configuration, push students to devices, check health status, and view all device information. 
                  Hardware registration (adding new devices/tablets) is handled by the platform administrator.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Message for System Admin */}
      {isSystemAdmin && devices.length > 0 && (
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="text-purple-600 mt-0.5">🔧</div>
              <div className="flex-1 text-sm text-purple-800">
                <p className="font-semibold mb-1">Platform Administrator Access</p>
                <p>
                  You can register devices and tablets across all schools. School-specific operations (attendance configuration, 
                  student management, pushing data) are handled by school administrators.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
