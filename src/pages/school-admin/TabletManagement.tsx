import { useState, useEffect } from "react";
import { Plus, RefreshCw, Edit, Trash2, Server, Wifi, WifiOff, AlertCircle, Settings, Activity } from "lucide-react";
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
import { toast } from "sonner";
import { tabletApi, Tablet } from "@/lib/deviceApi";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const TABLET_LIST_REFRESH_MS = 20 * 60_000;

export default function TabletManagement() {
  const [tablets, setTablets] = useState<Tablet[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTablet, setEditingTablet] = useState<Tablet | null>(null);
  const [healthChecking, setHealthChecking] = useState<Record<string, boolean>>({});
  const currentUser = useCurrentUser();
  const isSystemAdmin = currentUser?.role === "system_admin";
  const isSchoolAdmin = currentUser?.role === "school_admin";
  const [formData, setFormData] = useState({
    name: "",
    ip: "",
    port: 5000,
    location: "",
    notes: "",
    firmware_version: "",
    os_info: "",
  });

  useEffect(() => {
    loadTablets();
    
    // Auto-refresh every 20 minutes
    const interval = setInterval(() => {
      loadTablets();
    }, TABLET_LIST_REFRESH_MS);
    
    return () => clearInterval(interval);
  }, []);

  const loadTablets = async () => {
    setLoading(true);
    try {
      const response = await tabletApi.getAll();
      setTablets(response.data || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load tablets");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTablet(null);
    setFormData({
      name: "",
      ip: "",
      port: 5000,
      location: "",
      notes: "",
      firmware_version: "",
      os_info: "",
    });
    setShowDialog(true);
  };

  const handleEdit = (tablet: Tablet) => {
    setEditingTablet(tablet);
    setFormData({
      name: tablet.name,
      ip: tablet.ip,
      port: tablet.port,
      location: tablet.location || "",
      notes: tablet.notes || "",
      firmware_version: tablet.firmware_version || "",
      os_info: tablet.os_info || "",
    });
    setShowDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingTablet) {
        await tabletApi.update(editingTablet.id, formData);
        toast.success("Tablet updated successfully");
      } else {
        await tabletApi.create(formData);
        toast.success("Tablet created successfully");
      }
      setShowDialog(false);
      loadTablets();
    } catch (error: any) {
      toast.error(error.message || "Failed to save tablet");
    }
  };

  const handleDelete = async (tablet: Tablet) => {
    if (!confirm(`Are you sure you want to delete "${tablet.name}"?`)) return;

    try {
      await tabletApi.delete(tablet.id);
      toast.success("Tablet deleted successfully");
      loadTablets();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete tablet");
    }
  };

  const handleCheckHealth = async (tablet: Tablet) => {
    const tabletKey = tablet.id;
    setHealthChecking((prev) => ({ ...prev, [tabletKey]: true }));

    try {
      const health = await tabletApi.checkHealth(tablet.id);
      if (health.healthy) {
        toast.success(`Tablet ${tablet.name} is online and responding`);
        setTablets((prev) =>
          prev.map((t) =>
            t.id === tablet.id ? { ...t, status: "online" as const } : t
          )
        );
      } else {
        toast.warning(health.error || `Tablet ${tablet.name} is offline or unreachable`);
        setTablets((prev) =>
          prev.map((t) =>
            t.id === tablet.id ? { ...t, status: "offline" as const } : t
          )
        );
      }
    } catch (error: any) {
      toast.error(error.message || `Tablet ${tablet.name} is offline or unreachable`);
      setTablets((prev) =>
        prev.map((t) =>
          t.id === tablet.id ? { ...t, status: "offline" as const } : t
        )
      );
    } finally {
      setHealthChecking((prev) => ({ ...prev, [tabletKey]: false }));
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      online: { variant: "default" as const, icon: Wifi, color: "text-green-600" },
      offline: { variant: "secondary" as const, icon: WifiOff, color: "text-gray-600" },
      error: { variant: "destructive" as const, icon: AlertCircle, color: "text-red-600" },
      maintenance: { variant: "outline" as const, icon: Settings, color: "text-yellow-600" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.offline;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tablet Management</h1>
          <p className="text-gray-600 mt-1">
            {isSystemAdmin
              ? "Manage tablet devices across all schools (Platform Owner)"
              : "View tablet devices and their connection status"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadTablets} disabled={loading} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {isSystemAdmin && (
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Tablet
            </Button>
          )}
        </div>
      </div>

      {/* Tablets Grid */}
      {tablets.length === 0 && !loading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Server className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No tablets registered</h3>
            <p className="text-gray-600 mb-4">
              {isSystemAdmin
                ? "Add your first tablet device to start managing biometric attendance"
                : "No tablets have been registered yet. Contact platform administrator."}
            </p>
            {isSystemAdmin && (
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Add First Tablet
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tablets.map((tablet) => {
            const isChecking = healthChecking[tablet.id];
            
            return (
              <Card key={tablet.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{tablet.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {tablet.location || "No location set"}
                      </CardDescription>
                    </div>
                    {getStatusBadge(tablet.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">IP Address:</span>
                      <span className="font-mono">{tablet.ip}:{tablet.port}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">UUID:</span>
                      <span className="font-mono text-xs">{tablet.uuid.slice(0, 8)}...</span>
                    </div>
                    {tablet.firmware_version && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Firmware:</span>
                        <span>{tablet.firmware_version}</span>
                      </div>
                    )}
                    {tablet.os_info && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">OS:</span>
                        <span>{tablet.os_info}</span>
                      </div>
                    )}
                    {tablet.last_health_check && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Last Check:</span>
                        <span className="text-xs">
                          {new Date(tablet.last_health_check).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCheckHealth(tablet)}
                      disabled={isChecking}
                      className="flex-1"
                    >
                      <Activity className={`h-4 w-4 mr-1 ${isChecking ? "animate-pulse" : ""}`} />
                      {isChecking ? "Checking..." : "Check Health"}
                    </Button>
                    {isSystemAdmin && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(tablet)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(tablet)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </>
                    )}
                  </div>

                  {tablet.notes && (
                    <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-600">
                      {tablet.notes}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Info Message for School Admin */}
      {isSchoolAdmin && tablets.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="text-blue-600 mt-0.5">ℹ️</div>
              <div className="flex-1 text-sm text-blue-800">
                <p className="font-semibold mb-1">School Administrator View</p>
                <p>
                  You can view tablet information and check their health status. 
                  To register new tablets or modify hardware settings, please contact the platform administrator.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Message for System Admin */}
      {isSystemAdmin && tablets.length > 0 && (
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="text-purple-600 mt-0.5">🔧</div>
              <div className="flex-1 text-sm text-purple-800">
                <p className="font-semibold mb-1">Platform Administrator View</p>
                <p>
                  You can manage tablets across all schools. School-specific operations (attendance configuration, student management) 
                  are handled by school administrators.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog - Only for system-admin */}
      {isSystemAdmin && (
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingTablet ? "Edit Tablet" : "Add New Tablet"}
              </DialogTitle>
              <DialogDescription>
                {editingTablet
                  ? "Update tablet information"
                  : "Register a new tablet device that will connect to biometric hardware"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Tablet Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Main Tablet (VPN)"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ip">IP Address *</Label>
                    <Input
                      id="ip"
                      value={formData.ip}
                      onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                      placeholder="10.0.0.2"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="port">Port *</Label>
                    <Input
                      id="port"
                      type="number"
                      value={formData.port}
                      onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                      placeholder="5000"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Main Office"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firmware">Firmware Version</Label>
                    <Input
                      id="firmware"
                      value={formData.firmware_version}
                      onChange={(e) => setFormData({ ...formData, firmware_version: e.target.value })}
                      placeholder="2.1.0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="os">OS Info</Label>
                    <Input
                      id="os"
                      value={formData.os_info}
                      onChange={(e) => setFormData({ ...formData, os_info: e.target.value })}
                      placeholder="Windows 11 Pro"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes about this tablet..."
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingTablet ? "Update Tablet" : "Create Tablet"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
