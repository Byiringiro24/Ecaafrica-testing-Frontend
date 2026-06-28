import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Cpu, HardDrive, Plus, RefreshCw, School, TabletSmartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { SuperAdminBreadcrumbs } from "@/components/layout/SuperAdminBreadcrumbs";
import { EmptyState, PageTabs, SaInput, SaSelect } from "@/components/super-admin/ui";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/api";
import { platformHardwareApi, type Device, type Tablet } from "@/lib/deviceApi";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/super-admin/hardware")({ component: HardwarePage });

type SchoolRecord = {
  id: string;
  name: string;
  code?: string | null;
  status?: string | null;
};

type PlatformTablet = Tablet & {
  school?: { id: string; name: string };
};

type PlatformDevice = Device & {
  school?: { id: string; name: string };
  tablet?: { id: string; name: string; ip: string; port: number };
};

const TABS = ["Create Tablet", "Create Device"];

const emptyTabletForm = {
  name: "",
  ip: "",
  port: "5000",
  location: "",
  notes: "",
};

const emptyDeviceForm = {
  device_uid: "",
  name: "",
  type: "tablet" as "tablet" | "kiosk" | "web",
  mode: "gate" as "gate" | "boarding" | "classroom",
  location: "",
  tablet_id: "",
  device_ip: "",
  device_port: "5005",
  license_number: "1261",
  device_serial: "",
  product_code: "",
  product_name: "",
  firmware_version: "",
};

function HardwarePage() {
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [tablets, setTablets] = useState<PlatformTablet[]>([]);
  const [devices, setDevices] = useState<PlatformDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tabletForm, setTabletForm] = useState(emptyTabletForm);
  const [deviceForm, setDeviceForm] = useState(emptyDeviceForm);

  const selectedSchool = useMemo(
    () => schools.find((school) => String(school.id) === selectedSchoolId),
    [schools, selectedSchoolId]
  );

  const selectedTablet = useMemo(
    () => tablets.find((tablet) => String(tablet.id) === deviceForm.tablet_id),
    [tablets, deviceForm.tablet_id]
  );

  useEffect(() => {
    void loadSchools();
  }, []);

  useEffect(() => {
    if (selectedSchoolId) void loadHardware();
  }, [selectedSchoolId]);

  const loadSchools = async () => {
    setLoading(true);
    try {
      const response = await apiRequest<{ data: SchoolRecord[] }>("/platform/schools?limit=500", {
        auth: "platform",
        returnMeta: true,
      });
      const items = response.data ?? [];
      setSchools(items);
      setSelectedSchoolId((current) => current || String(items[0]?.id ?? ""));
    } catch (error: any) {
      toast.error(error?.message || "Failed to load schools");
    } finally {
      setLoading(false);
    }
  };

  const loadHardware = async () => {
    if (!selectedSchoolId) return;
    setLoading(true);
    try {
      const [tabletResponse, deviceResponse] = await Promise.all([
        platformHardwareApi.getTablets({ school_id: selectedSchoolId, limit: 500 }),
        platformHardwareApi.getDevices({ school_id: selectedSchoolId, limit: 500 }),
      ]);
      setTablets((tabletResponse.data ?? []) as PlatformTablet[]);
      setDevices((deviceResponse.data ?? []) as PlatformDevice[]);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load hardware");
    } finally {
      setLoading(false);
    }
  };

  const createTablet = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedSchoolId) {
      toast.error("Select a school first");
      return;
    }

    setSaving(true);
    try {
      await platformHardwareApi.createTablet({
        school_id: selectedSchoolId,
        name: tabletForm.name,
        ip: tabletForm.ip,
        port: Number(tabletForm.port || 5000),
        location: tabletForm.location || undefined,
        notes: tabletForm.notes || undefined,
      });
      toast.success("Tablet created and assigned to school");
      setTabletForm(emptyTabletForm);
      await loadHardware();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create tablet");
    } finally {
      setSaving(false);
    }
  };

  const createDevice = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedSchoolId) {
      toast.error("Select a school first");
      return;
    }

    const fallbackIp = selectedTablet?.ip ?? "";
    const deviceIp = deviceForm.device_ip || fallbackIp;
    const selectedTabletUrl = selectedTablet ? `http://${selectedTablet.ip}:${selectedTablet.port}` : undefined;

    setSaving(true);
    try {
      await platformHardwareApi.createDevice({
        school_id: selectedSchoolId,
        device_uid: deviceForm.device_uid,
        name: deviceForm.name,
        type: deviceForm.type,
        mode: deviceForm.mode,
        location: deviceForm.location || undefined,
        tablet_id: deviceForm.tablet_id || undefined,
        tablet_ip: deviceIp || undefined,
        tablet_port: deviceForm.device_port ? Number(deviceForm.device_port) : undefined,
        license_number: deviceForm.license_number ? Number(deviceForm.license_number) : undefined,
        device_serial: deviceForm.device_serial || undefined,
        product_code: deviceForm.product_code || undefined,
        product_name: deviceForm.product_name || undefined,
        firmware_version: deviceForm.firmware_version || undefined,
        api_url: selectedTabletUrl,
      } as any);
      toast.success("Device created and assigned to school");
      setDeviceForm(emptyDeviceForm);
      await loadHardware();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create device");
    } finally {
      setSaving(false);
    }
  };

  const deleteTablet = async (tablet: PlatformTablet) => {
    if (!confirm(`Delete tablet "${tablet.name}"?`)) return;
    try {
      await platformHardwareApi.deleteTablet(tablet.id);
      toast.success("Tablet removed");
      await loadHardware();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete tablet");
    }
  };

  const deleteDevice = async (device: PlatformDevice) => {
    if (!confirm(`Delete device "${device.name}"?`)) return;
    try {
      await platformHardwareApi.deleteDevice(device.id);
      toast.success("Device removed");
      await loadHardware();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete device");
    }
  };

  return (
    <SuperAdminLayout
      title="Hardware Assignment"
      subtitle="Create tablet bridges and biometric devices, then assign them to schools"
      breadcrumbs={<SuperAdminBreadcrumbs items={[{ label: "Super Admin", to: "/super-admin" }, { label: "Hardware Assignment" }]} />}
    >
      <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <School className="h-4 w-4 text-amber-600" />
            School Assignment Target
          </div>
          <SaSelect
            label="School"
            value={selectedSchoolId}
            onChange={(event) => setSelectedSchoolId(event.target.value)}
            disabled={loading || schools.length === 0}
          >
            <option value="">Select school</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </SaSelect>
          {selectedSchool && (
            <div className="mt-2 text-xs text-muted-foreground">
              New tablets and devices will be assigned to <span className="font-semibold text-foreground">{selectedSchool.name}</span>.
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => void loadHardware()}
          disabled={!selectedSchoolId || loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      <PageTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === "Create Tablet" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <TabletSmartphone className="h-5 w-5 text-amber-600" />
              <div>
                <h2 className="font-display text-lg font-semibold">Create Tablet Bridge</h2>
                <p className="text-xs text-muted-foreground">Based on the migration tablet registration flow: name, IP, API port, location.</p>
              </div>
            </div>
            <form onSubmit={createTablet} className="grid gap-4">
              <SaInput label="Tablet Name" value={tabletForm.name} onChange={(e) => setTabletForm({ ...tabletForm, name: e.target.value })} placeholder="Main Gate Tablet" required />
              <div className="grid gap-4 md:grid-cols-2">
                <SaInput label="Tablet Bridge IP" value={tabletForm.ip} onChange={(e) => setTabletForm({ ...tabletForm, ip: e.target.value })} placeholder="10.212.124.16" required />
                <SaInput label="Tablet API Port" type="number" value={tabletForm.port} onChange={(e) => setTabletForm({ ...tabletForm, port: e.target.value })} required />
              </div>
              <SaInput label="Location" value={tabletForm.location} onChange={(e) => setTabletForm({ ...tabletForm, location: e.target.value })} placeholder="Main Gate" />
              <label>
                <span className="mb-1.5 block text-xs font-semibold">Notes</span>
                <textarea
                  value={tabletForm.notes}
                  onChange={(e) => setTabletForm({ ...tabletForm, notes: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Bridge device used for FK623 communication"
                />
              </label>
              <button
                type="submit"
                disabled={saving || !selectedSchoolId}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Create Tablet
              </button>
            </form>
          </section>

          <HardwareList
            title="Assigned Tablets"
            empty="No tablets assigned to this school yet."
            items={tablets}
            render={(tablet) => (
              <HardwareRow
                key={tablet.id}
                icon={<TabletSmartphone className="h-4 w-4" />}
                title={tablet.name}
                subtitle={`${tablet.ip}:${tablet.port}${tablet.location ? ` - ${tablet.location}` : ""}`}
                badge={tablet.status}
                onDelete={() => void deleteTablet(tablet)}
              />
            )}
          />
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Cpu className="h-5 w-5 text-amber-600" />
              <div>
                <h2 className="font-display text-lg font-semibold">Create Hardware Device</h2>
                <p className="text-xs text-muted-foreground">Assign FK623/device metadata to the selected school and optionally link it to a tablet bridge.</p>
              </div>
            </div>
            <form onSubmit={createDevice} className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <SaInput label="Device UID" value={deviceForm.device_uid} onChange={(e) => setDeviceForm({ ...deviceForm, device_uid: e.target.value })} placeholder="FK623-MAIN-GATE" required />
                <SaInput label="Device Name" value={deviceForm.name} onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })} placeholder="Main Gate FK623" required />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <SaSelect label="Type" value={deviceForm.type} onChange={(e) => setDeviceForm({ ...deviceForm, type: e.target.value as any })}>
                  <option value="tablet">Tablet</option>
                  <option value="kiosk">Kiosk</option>
                  <option value="web">Web</option>
                </SaSelect>
                <SaSelect label="Mode" value={deviceForm.mode} onChange={(e) => setDeviceForm({ ...deviceForm, mode: e.target.value as any })}>
                  <option value="gate">Gate</option>
                  <option value="boarding">Boarding</option>
                  <option value="classroom">Classroom</option>
                </SaSelect>
                <SaInput label="Location" value={deviceForm.location} onChange={(e) => setDeviceForm({ ...deviceForm, location: e.target.value })} placeholder="Main Gate" />
              </div>
              <SaSelect
                label="Tablet Bridge"
                value={deviceForm.tablet_id}
                onChange={(e) => setDeviceForm({ ...deviceForm, tablet_id: e.target.value })}
              >
                <option value="">No linked tablet bridge</option>
                {tablets.map((tablet) => (
                  <option key={tablet.id} value={tablet.id}>
                    {tablet.name} - {tablet.ip}:{tablet.port}
                  </option>
                ))}
              </SaSelect>
              <div className="grid gap-4 md:grid-cols-3">
                <SaInput label="FK623 Device IP" value={deviceForm.device_ip} onChange={(e) => setDeviceForm({ ...deviceForm, device_ip: e.target.value })} placeholder={selectedTablet?.ip ?? "10.212.124.16"} />
                <SaInput label="FK623 Port" type="number" value={deviceForm.device_port} onChange={(e) => setDeviceForm({ ...deviceForm, device_port: e.target.value })} />
                <SaInput label="License" type="number" value={deviceForm.license_number} onChange={(e) => setDeviceForm({ ...deviceForm, license_number: e.target.value })} />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <SaInput label="Serial Number" value={deviceForm.device_serial} onChange={(e) => setDeviceForm({ ...deviceForm, device_serial: e.target.value })} />
                <SaInput label="Product Code" value={deviceForm.product_code} onChange={(e) => setDeviceForm({ ...deviceForm, product_code: e.target.value })} />
                <SaInput label="Product Name" value={deviceForm.product_name} onChange={(e) => setDeviceForm({ ...deviceForm, product_name: e.target.value })} />
              </div>
              <SaInput label="Firmware Version" value={deviceForm.firmware_version} onChange={(e) => setDeviceForm({ ...deviceForm, firmware_version: e.target.value })} placeholder="1.0.0" />
              <button
                type="submit"
                disabled={saving || !selectedSchoolId}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Create Device
              </button>
            </form>
          </section>

          <HardwareList
            title="Assigned Devices"
            empty="No devices assigned to this school yet."
            items={devices}
            render={(device) => (
              <HardwareRow
                key={device.id}
                icon={<HardDrive className="h-4 w-4" />}
                title={device.name}
                subtitle={`${device.device_uid} - ${device.tablet_ip ?? "No device IP"}${device.tablet ? ` - ${device.tablet.name}` : ""}`}
                badge={device.is_connected ? "connected" : device.mode}
                onDelete={() => void deleteDevice(device)}
              />
            )}
          />
        </div>
      )}
    </SuperAdminLayout>
  );
}

function HardwareList<T>({
  title,
  empty,
  items,
  render,
}: {
  title: string;
  empty: string;
  items: T[];
  render: (item: T) => ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
      </div>
      {items.length === 0 ? <EmptyState message={empty} /> : <div className="divide-y divide-border">{items.map(render)}</div>}
    </section>
  );
}

function HardwareRow({
  icon,
  title,
  subtitle,
  badge,
  onDelete,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  badge?: string;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
      {badge && <Badge variant="secondary" className="capitalize">{badge}</Badge>}
      <button type="button" onClick={onDelete} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
