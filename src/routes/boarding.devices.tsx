import { FormEvent, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Cpu, Plus, Wifi, WifiOff, Eye, Settings2, PencilLine, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/boarding/devices")({ component: BoardingDevicesPage });

type DeviceStatus = "online" | "offline" | "maintenance";

type Device = {
  id: string;
  name: string;
  location: string;
  ip: string;
  model: string;
  firmware: string;
  status: DeviceStatus;
  lastSync: string;
  students: number;
  battery: number;
  alerts: number;
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
  const [registerOpen, setRegisterOpen] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    deviceId: "",
    ip: "",
    location: "",
    model: DEVICE_MODELS[0],
    firmware: "v3.4.1",
  });

  const stats = useMemo(() => {
    const total = devices.length;
    const online = devices.filter((d) => d.status === "online").length;
    const offline = devices.filter((d) => d.status === "offline").length;
    const maintenance = devices.filter((d) => d.status === "maintenance").length;
    const lastSync = devices.find((d) => d.status === "online")?.lastSync || "No syncs yet";
    return { total, online, offline, maintenance, lastSync };
  }, [devices]);

  const loadDevices = async () => {
    try {
      const data = await apiRequest<any[]>("/devices?limit=500&sort=created_at&order=desc", { auth: "school" });
      const mapped = (Array.isArray(data) ? data : []).map((device) => ({
        id: device.id,
        name: device.name,
        location: device.location ?? "—",
        ip: device.tablet_ip ?? device.api_url ?? "—",
        model: device.type ?? "tablet",
        firmware: device.firmware_version ?? "—",
        status: device.is_active === false ? "offline" : device.status === "online" ? "online" : "offline",
        lastSync: device.last_sync_at ? new Date(device.last_sync_at).toLocaleString() : "No sync yet",
        students: 0,
        battery: 100,
        alerts: device.last_sync_status === "queued" ? 1 : 0,
        ...device,
      }));
      setDevices(mapped);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load devices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDevices();
  }, []);

  const registerDevice = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const payload = {
        device_uid: form.deviceId || `DEV-${Date.now()}`,
        name: form.name || form.deviceId || "New device",
        type: "tablet",
        location: form.location || "Main Campus",
        mode: "boarding",
        api_url: `http://${form.ip || "127.0.0.1"}:5000`,
        tablet_ip: form.ip || "127.0.0.1",
        tablet_port: 5000,
        firmware_version: form.firmware,
      };
      await apiRequest("/devices", { method: "POST", body: JSON.stringify(payload), auth: "school" });
      toast.success(`Device registered: ${payload.name}`);
      setRegisterOpen(false);
      setForm({
        name: "",
        deviceId: "",
        ip: "",
        location: "",
        model: DEVICE_MODELS[0],
        firmware: "v3.4.1",
      });
      await loadDevices();
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to register device");
    }
  };

  return (
    <AppLayout title="Device Management" subtitle="Boarding device registry, health, and syncs">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <button
          type="button"
          onClick={() => setRegisterOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Register Device
        </button>
        <button
          type="button"
          onClick={() => toast.info("Auto-discovery started")}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted"
        >
          <RefreshCw className="h-4 w-4" /> Auto-Discover
        </button>
        <div className="ml-auto text-xs text-muted-foreground">
          Last sync: <span className="font-semibold text-foreground">{stats.lastSync}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Devices" value={stats.total} icon={<Cpu className="h-5 w-5" />} />
        <StatCard label="Online" value={stats.online} tone="success" icon={<Wifi className="h-5 w-5" />} />
        <StatCard label="Offline" value={stats.offline} tone="destructive" icon={<WifiOff className="h-5 w-5" />} />
        <StatCard label="Maintenance" value={stats.maintenance} tone="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Loading device inventory…
          </div>
        ) : devices.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No devices registered yet.
          </div>
        ) : devices.map((device) => (
          <DeviceCard
            key={device.id}
            device={device}
            onView={() => toast.info(`Viewing ${device.name}`)}
            onConfig={() => toast.info(`Opening configuration for ${device.id}`)}
            onRename={() => toast.success(`Rename ready for ${device.id}`)}
          />
        ))}
      </div>

      {registerOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setRegisterOpen(false)}>
          <div
            className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <form onSubmit={registerDevice} className="p-6 space-y-4">
              <div>
                <h3 className="font-display font-bold text-lg">Register Boarding Device</h3>
                <p className="text-xs text-muted-foreground">Add a new biometric device for boarding attendance.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Device Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} placeholder="Dormitory A Entrance" />
                <Field label="Device ID" value={form.deviceId} onChange={(value) => setForm({ ...form, deviceId: value })} placeholder="BD-DEV-05" required />
                <Field label="IP Address" value={form.ip} onChange={(value) => setForm({ ...form, ip: value })} placeholder="10.60.11.30" required />
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
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{device.id}</div>
          <div className="font-display font-bold text-lg mt-1">{device.name}</div>
          <div className="text-xs text-muted-foreground">{device.location} - {device.model}</div>
        </div>
        <DeviceStatusPill status={device.status} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <InfoItem label="IP Address" value={device.ip} />
        <InfoItem label="Firmware" value={device.firmware} />
        <InfoItem label="Students" value={String(device.students)} />
        <InfoItem label="Alerts" value={String(device.alerts)} highlight={device.alerts > 0} />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Battery</span>
          <span className={device.battery < 25 ? "text-destructive" : "text-foreground"}>{device.battery}%</span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full", device.battery < 25 ? "bg-destructive" : "bg-success")}
            style={{ width: `${device.battery}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>Last sync: {device.lastSync}</span>
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
