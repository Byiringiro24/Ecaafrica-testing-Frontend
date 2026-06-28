import { FormEvent, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Cpu,
  Eye,
  HardDrive,
  PencilLine,
  Plus,
  RefreshCw,
  Settings2,
  TabletSmartphone,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/boarding/devices")({ component: BoardingDevicesPage });

type DeviceStatus = "online" | "offline" | "maintenance";
type InventoryMode = "tablets" | "devices";

type Device = {
  id: string;
  name: string;
  location?: string | null;
  ip?: string | null;
  model?: string | null;
  firmware?: string | null;
  status: DeviceStatus;
  lastSync?: string | null;
  students?: number | null;
  battery?: number | null;
  alerts?: number | null;
  source: InventoryMode;
  is_active?: boolean;
  device_uid?: string;
  api_url?: string;
  tablet_ip?: string;
  tablet_port?: number | null;
  last_seen_at?: string | null;
  last_sync_at?: string | null;
};

const DEVICE_MODELS = ["FK-Access X2", "FK-Access X1", "FK-Edge 2"];

function BoardingDevicesPage() {
  const [mode, setMode] = useState<InventoryMode>("tablets");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    deviceId: "",
    ip: "",
    location: "",
    model: DEVICE_MODELS[0],
    firmware: "",
  });

  const stats = useMemo(() => {
    const total = devices.length;
    const online = devices.filter((d) => d.status === "online").length;
    const offline = devices.filter((d) => d.status === "offline").length;
    const maintenance = devices.filter((d) => d.status === "maintenance").length;
    const lastSync = devices.find((d) => d.lastSync)?.lastSync || "No syncs yet";
    return { total, online, offline, maintenance, lastSync };
  }, [devices]);

  const loadDevices = async () => {
    setLoading(true);
    try {
      const mapped = mode === "tablets" ? await loadTabletInventory() : await loadHardwareDeviceInventory();
      setDevices(mapped);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load devices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDevices();
  }, [mode]);

  const loadTabletInventory = async (): Promise<Device[]> => {
    const response = await apiRequest<any>("/tablets?page=1&limit=500", { auth: "school" });
    const items = Array.isArray(response?.data) ? response.data : [];

    return items.map((tablet) => ({
      id: String(tablet.id),
      name: tablet.name,
      location: tablet.location ?? null,
      ip: tablet.ip ? `${tablet.ip}${tablet.port ? `:${tablet.port}` : ""}` : null,
      model: tablet.os_info ?? "Tablet",
      firmware: tablet.firmware_version ?? null,
      status: normalizeStatus(tablet.status, tablet.is_active),
      lastSync: formatDate(tablet.last_health_check),
      students: null,
      battery: null,
      alerts: null,
      source: "tablets",
      ...tablet,
    }));
  };

  const loadHardwareDeviceInventory = async (): Promise<Device[]> => {
    const data = await apiRequest<any[]>("/devices?limit=500&sort=created_at&order=desc", { auth: "school" });
    const items = Array.isArray(data) ? data : [];

    return items.map((device) => ({
      id: String(device.id),
      name: device.name,
      location: device.location ?? null,
      ip: device.tablet_ip
        ? `${device.tablet_ip}${device.tablet_port ? `:${device.tablet_port}` : ""}`
        : device.api_url ?? null,
      model: device.type ?? null,
      firmware: device.firmware_version ?? null,
      status: normalizeStatus(device.status, device.is_active),
      lastSync: formatDate(device.last_sync_at ?? device.last_seen_at ?? device.last_connection_at),
      students: typeof device.device_users_count === "number" ? device.device_users_count : null,
      battery: null,
      alerts: [device.connection_error, device.last_sync_error].filter(Boolean).length || null,
      source: "devices",
      ...device,
    }));
  };

  const registerDevice = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const payload = {
        device_uid: form.deviceId,
        name: form.name || form.deviceId,
        type: "tablet",
        location: form.location || undefined,
        mode: "boarding",
        api_url: form.ip ? `http://${form.ip}:5000` : undefined,
        tablet_ip: form.ip || undefined,
        tablet_port: form.ip ? 5000 : undefined,
        firmware_version: form.firmware || undefined,
      };
      await apiRequest("/devices", { method: "POST", body: JSON.stringify(payload), auth: "school" });
      toast.success(`Device registered: ${payload.name}`);
      setRegisterOpen(false);
      setForm({ name: "", deviceId: "", ip: "", location: "", model: DEVICE_MODELS[0], firmware: "" });
      await loadDevices();
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to register device");
    }
  };

  return (
    <AppLayout title="Device Management" subtitle="Boarding device registry, health, and syncs">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-border bg-card p-1">
          <button
            type="button"
            onClick={() => setMode("tablets")}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold",
              mode === "tablets" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <TabletSmartphone className="h-4 w-4" /> Tablets
          </button>
          <button
            type="button"
            onClick={() => setMode("devices")}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold",
              mode === "devices" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <HardDrive className="h-4 w-4" /> Hardware Devices
          </button>
        </div>

        <button
          type="button"
          onClick={() => setRegisterOpen(true)}
          disabled={mode === "tablets"}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Register Device
        </button>
        <button
          type="button"
          onClick={() => void loadDevices()}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
        </button>
        <div className="ml-auto text-xs text-muted-foreground">
          Last sync: <span className="font-semibold text-foreground">{stats.lastSync}</span>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Devices" value={stats.total} icon={<Cpu className="h-5 w-5" />} />
        <StatCard label="Online" value={stats.online} tone="success" icon={<Wifi className="h-5 w-5" />} />
        <StatCard label="Offline" value={stats.offline} tone="destructive" icon={<WifiOff className="h-5 w-5" />} />
        <StatCard label="Maintenance" value={stats.maintenance} tone="warning" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <div className="col-span-full rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Loading device inventory...
          </div>
        ) : devices.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No {mode === "tablets" ? "tablets" : "hardware devices"} registered yet.
          </div>
        ) : (
          devices.map((device) => (
            <DeviceCard
              key={`${device.source}-${device.id}`}
              device={device}
              onView={() => toast.info(`Viewing ${device.name}`)}
              onConfig={() => toast.info(`Opening configuration for ${device.id}`)}
              onRename={() => toast.success(`Rename ready for ${device.id}`)}
            />
          ))
        )}
      </div>

      {registerOpen && mode === "devices" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setRegisterOpen(false)}>
          <div
            className="w-full max-w-lg rounded-lg border border-border bg-card shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <form onSubmit={registerDevice} className="space-y-4 p-6">
              <div>
                <h3 className="font-display text-lg font-bold">Register Boarding Device</h3>
                <p className="text-xs text-muted-foreground">Add a new biometric device for boarding attendance.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Device Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} placeholder="Dormitory A Entrance" />
                <Field label="Device ID" value={form.deviceId} onChange={(value) => setForm({ ...form, deviceId: value })} placeholder="BD-DEV-05" required />
                <Field label="IP Address" value={form.ip} onChange={(value) => setForm({ ...form, ip: value })} placeholder="10.60.11.30" />
                <Field label="Location" value={form.location} onChange={(value) => setForm({ ...form, location: value })} placeholder="Dorm C" />
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-muted-foreground">Model</span>
                  <select
                    value={form.model}
                    onChange={(event) => setForm({ ...form, model: event.target.value })}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    {DEVICE_MODELS.map((model) => (
                      <option key={model}>{model}</option>
                    ))}
                  </select>
                </label>
                <Field label="Firmware" value={form.firmware} onChange={(value) => setForm({ ...form, firmware: value })} placeholder="v3.4.1" />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRegisterOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Register Device
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function DeviceCard({
  device,
  onView,
  onConfig,
  onRename,
}: {
  device: Device;
  onView: () => void;
  onConfig: () => void;
  onRename: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{device.id}</div>
          <div className="font-display mt-1 text-lg font-bold">{device.name}</div>
          <div className="text-xs text-muted-foreground">
            {displayValue(device.location)} - {displayValue(device.model)}
          </div>
        </div>
        <DeviceStatusPill status={device.status} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <InfoItem label="IP Address" value={displayValue(device.ip)} />
        <InfoItem label="Firmware" value={displayValue(device.firmware)} />
        <InfoItem label="Students" value={displayNumber(device.students)} />
        <InfoItem label="Alerts" value={displayNumber(device.alerts)} highlight={Boolean(device.alerts && device.alerts > 0)} />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Battery</span>
          <span className={device.battery !== null && device.battery !== undefined && device.battery < 25 ? "text-destructive" : "text-foreground"}>
            {device.battery === null || device.battery === undefined ? "-" : `${device.battery}%`}
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full", device.battery !== null && device.battery !== undefined && device.battery < 25 ? "bg-destructive" : "bg-success")}
            style={{ width: `${device.battery ?? 0}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>Last sync: {device.lastSync || "No sync yet"}</span>
        <span className="flex items-center gap-1">
          {device.status === "online" ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {device.status === "online" ? "Online" : device.status === "offline" ? "Offline" : "Maintenance"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton onClick={onView} icon={<Eye className="h-4 w-4" />} label="View" />
        <ActionButton onClick={onConfig} icon={<Settings2 className="h-4 w-4" />} label="Attendance Config" />
        <ActionButton onClick={onRename} icon={<PencilLine className="h-4 w-4" />} label="Rename" />
      </div>
    </div>
  );
}

function DeviceStatusPill({ status }: { status: DeviceStatus }) {
  const styles: Record<DeviceStatus, string> = {
    online: "bg-success/15 text-success",
    offline: "bg-destructive/15 text-destructive",
    maintenance: "bg-amber-100 text-amber-700",
  };
  const label = status === "online" ? "Online" : status === "offline" ? "Offline" : "Maintenance";
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", styles[status])}>{label}</span>;
}

function InfoItem({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-lg border border-border px-3 py-2", highlight && "border-destructive/40 bg-destructive/5")}>
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className={cn("font-semibold", highlight && "text-destructive")}>{value}</div>
    </div>
  );
}

function ActionButton({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
    >
      {icon}
      {label}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
      />
    </label>
  );
}

function normalizeStatus(status: unknown, isActive?: boolean): DeviceStatus {
  if (isActive === false) return "offline";
  if (status === "online") return "online";
  if (status === "maintenance") return "maintenance";
  return "offline";
}

function formatDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : null;
}

function displayValue(value: unknown) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function displayNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : String(value);
}
