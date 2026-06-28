import { useState, useEffect } from "react";
import { RefreshCw, Smartphone, Activity, Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { deviceApi, tabletApi, Device, Tablet } from "@/lib/deviceApi";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { AttendanceConfigDialog } from "@/components/device-management/AttendanceConfigDialog";

export default function DeviceManagementNew() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [tablets, setTablets] = useState<Tablet[]>([]);
  const [loading, setLoading] = useState(false);
  const [healthChecking, setHealthChecking] = useState<Record<string, boolean>>({});
  const [showDialog, setShowDialog] = useState(false);
  const [configDevice, setConfigDevice] = useState<Device | null>(null);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const currentUser = useCurrentUser();
  const isSystemAdmin = currentUser?.role === "system_admin";
  const isSchoolAdmin = currentUser?.role === "school_admin";

  const [formData, setFormData] = useState({
    device_uid: "",
    name: "",
    type: "tablet" as "tablet" | "kiosk" | "web",
    location: "",
    mode: "gate" as "gate" | "boarding" | "classroom",
    pin: "",
    firmware_version: "",
    tablet_ip: "",
    tablet_port: "",
  });

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
    const deviceKey = device.id;
    setHealthChecking((prev) => ({ ...prev, [deviceKey]: true }));

    try {
      const status = await deviceApi.getStatus(device.id);
      const online = Boolean(status.is_connected ?? status.is_online);
      toast[online ? "success" : "warning"](
        `${device.name} is ${online ? "online and reachable" : "offline or unreachable"}`
      );
      setDevices((prev) =>
        prev.map((d) => (d.id === device.id ? { ...d, ...status } : d))
      );
    } catch (error: any) {
      toast.error(error.message || `Failed to check ${device.name}`);
    } finally {
      setHealthChecking((prev) => ({ ...prev, [deviceKey]: false }));
    }
  };

  const handlePushStudents = async (device: Device) => {
    try {
      const result = await deviceApi.pushStudents(device.id, { mode: "all" });
      toast.success(`Queued ${result.pushed_count} students for ${device.name}`);
      loadDevices();
    } catch (error: any) {
      toast.error(error.message || "Failed to push students");
    }
  };

  const handleCreate = () => {
    setEditingDevice(null);
    setFormData({
      device_uid: "",
      name: "",
      type: "tablet",
      location: "",
      mode: "gate",
      pin: "",
      firmware_version: "",
      tablet_ip: "",
      tablet_port: "",
    });
    setShowDialog(true);
  };

  const handleEdit = (device: Device) => {
    setEditingDevice(device);
    setFormData({
      device_uid: device.device_uid,
      name: device.name,
      type: device.type,
      location: device.location || "",
      mode: device.mode,
      pin: "",
      firmware_version: device.firmware_version || "",
      tablet_ip: device.tablet_ip || "",
      tablet_port: device.tablet_port?.toString() || "",
    });
    setShowDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingDevice) {
        // Update existing device
        const updateData: any = {
          name: formData.name,
          type: formData.type,
          location: formData.location || null,
          mode: formData.mode,
          firmware_version: formData.firmware_version || null,
        };

        // Only include pin if provided
        if (formData.pin) {
          updateData.pin = formData.pin;
        }

        await deviceApi.update(editingDevice.id, updateData);
        toast.success("Device updated successfully");
      } else {
        // Create new device
        const createData: any = {
          device_uid: formData.device_uid,
          name: formData.name,
          type: formData.type,
          location: formData.location || undefined,
          mode: formData.mode,
          firmware_version: formData.firmware_version || undefined,
        };

        // Add optional fields
        if (formData.pin) createData.pin = formData.pin;
        if (formData.tablet_ip) createData.tablet_ip = formData.tablet_ip;
        if (formData.tablet_port) createData.tablet_port = parseInt(formData.tablet_port);

        await deviceApi.create(createData);
        toast.success("Device created successfully");
      }

      setShowDialog(false);
      loadDevices();
    } catch (error: any) {
      toast.error(error.message || "Failed to save device");
    }
  };

  const handleDelete = async (device: Device) => {
    if (!confirm(`Are you sure you want to delete "${device.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deviceApi.delete(device.id);
      toast.success("Device deleted successfully");
      loadDevices();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete device");
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
          {isSystemAdmin && (
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Device
            </Button>
          )}
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
            {isSystemAdmin && (
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Add First Device
              </Button>
            )}
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
                    
                    {/* System Admin Operations */}
                    {isSystemAdmin && (
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(device)}
                          className="w-full"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(device)}
                          className="w-full"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfigDevice(device)}
                          className="w-full text-xs"
                        >
                          Settings
                        </Button>
                      </div>
                    )}
                    
                    {/* School Admin Operations */}
                    {isSchoolAdmin && (
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfigDevice(device)}
                          className="w-full"
                        >
                          Configure
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePushStudents(device)}
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

      {/* Add/Edit Device Dialog - Only for system-admin */}
      {isSystemAdmin && (
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingDevice ? "Edit Device" : "Add New Device"}
              </DialogTitle>
              <DialogDescription>
                {editingDevice
                  ? "Update device information and configuration"
                  : "Register a new biometric attendance device for a school"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                {/* Device UID - Only for creation */}
                {!editingDevice && (
                  <div className="space-y-2">
                    <Label htmlFor="device_uid">Device UID *</Label>
                    <Input
                      id="device_uid"
                      value={formData.device_uid}
                      onChange={(e) => setFormData({ ...formData, device_uid: e.target.value })}
                      placeholder="DEV-GATE-001"
                      required
                    />
                    <p className="text-xs text-gray-500">Unique identifier for this device</p>
                  </div>
                )}

                {/* Device Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Device Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Main Gate Scanner"
                    required
                  />
                </div>

                {/* Type and Mode */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Device Type *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: "tablet" | "kiosk" | "web") =>
                        setFormData({ ...formData, type: value })
                      }
                    >
                      <SelectTrigger id="type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tablet">Tablet</SelectItem>
                        <SelectItem value="kiosk">Kiosk</SelectItem>
                        <SelectItem value="web">Web</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mode">Operating Mode *</Label>
                    <Select
                      value={formData.mode}
                      onValueChange={(value: "gate" | "boarding" | "classroom") =>
                        setFormData({ ...formData, mode: value })
                      }
                    >
                      <SelectTrigger id="mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gate">Gate</SelectItem>
                        <SelectItem value="boarding">Boarding</SelectItem>
                        <SelectItem value="classroom">Classroom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Main Entrance"
                  />
                </div>

                {/* Tablet Connection - Only for creation */}
                {!editingDevice && (
                  <>
                    <div className="border-t pt-4">
                      <h3 className="font-semibold mb-3">Tablet Connection (Optional)</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="tablet_ip">Tablet IP Address</Label>
                          <Input
                            id="tablet_ip"
                            value={formData.tablet_ip}
                            onChange={(e) => setFormData({ ...formData, tablet_ip: e.target.value })}
                            placeholder="10.0.0.2"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="tablet_port">Tablet Port</Label>
                          <Input
                            id="tablet_port"
                            type="number"
                            value={formData.tablet_port}
                            onChange={(e) => setFormData({ ...formData, tablet_port: e.target.value })}
                            placeholder="5000"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Link this device to a tablet backend for biometric operations
                      </p>
                    </div>
                  </>
                )}

                {/* Security */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Security</h3>
                  <div className="space-y-2">
                    <Label htmlFor="pin">Device PIN {editingDevice ? "(Leave empty to keep current)" : ""}</Label>
                    <Input
                      id="pin"
                      type="password"
                      value={formData.pin}
                      onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                      placeholder="Enter PIN for device access"
                      required={!editingDevice}
                    />
                    <p className="text-xs text-gray-500">
                      PIN code used to authenticate device operations
                    </p>
                  </div>
                </div>

                {/* Additional Information */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Additional Information</h3>
                  <div className="space-y-2">
                    <Label htmlFor="firmware_version">Firmware Version</Label>
                    <Input
                      id="firmware_version"
                      value={formData.firmware_version}
                      onChange={(e) => setFormData({ ...formData, firmware_version: e.target.value })}
                      placeholder="1.0.0"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingDevice ? "Update Device" : "Create Device"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {configDevice && (
        <AttendanceConfigDialog
          open={Boolean(configDevice)}
          onClose={() => setConfigDevice(null)}
          device={configDevice}
          onSave={() => {
            toast.success("Attendance configuration saved");
            loadDevices();
          }}
        />
      )}
    </div>
  );
}
