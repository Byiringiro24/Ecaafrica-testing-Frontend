import { FormEvent, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  School, TabletSmartphone, Cpu, ArrowRight,
  Plus, Trash2, RefreshCw, CheckCircle2, ArrowRightLeft
} from "lucide-react";
import { toast } from "sonner";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { SuperAdminBreadcrumbs } from "@/components/layout/SuperAdminBreadcrumbs";
import { EmptyState, PageTabs, SaInput, SaSelect } from "@/components/super-admin/ui";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/api";
import { platformHardwareApi, type Device, type Tablet } from "@/lib/deviceApi";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/super-admin/hardware")({ component: HardwarePage });

// --- Types --------------------------------------------------------------------

type SchoolRecord = { id: string; name: string; status?: string | null };

type PlatformTablet = Tablet & { school?: { id: string; name: string } | null };
type PlatformDevice = Device & {
  school?: { id: string; name: string } | null;
  tablet?: { id: string; name: string } | null;
};

// --- Constants ----------------------------------------------------------------

const TABS = ["Schools", "Tablets", "Devices", "Assign"] as const;
type Tab = (typeof TABS)[number];

// --- Helpers -----------------------------------------------------------------

const statusColor = (s?: string | null) =>
  s === "active" || s === "trial" ? "bg-success/15 text-success"
    : s === "suspended" ? "bg-destructive/15 text-destructive"
    : "bg-muted text-muted-foreground";

// --- Main Page ----------------------------------------------------------------

function HardwarePage() {
  const [tab, setTab] = useState<Tab>("Schools");
  const [schools, setSchools]   = useState<SchoolRecord[]>([]);
  const [tablets, setTablets]   = useState<PlatformTablet[]>([]);
  const [devices, setDevices]   = useState<PlatformDevice[]>([]);
  const [loading, setLoading]   = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [schoolRes, tabletRes, deviceRes] = await Promise.all([
        apiRequest<{ data: SchoolRecord[] }>("/platform/schools?limit=500", { auth: "platform", returnMeta: true }),
        platformHardwareApi.getTablets({ limit: 500 }),
        platformHardwareApi.getDevices({ limit: 500 }),
      ]);
      setSchools(schoolRes.data ?? []);
      setTablets((tabletRes.data ?? []) as PlatformTablet[]);
      setDevices((deviceRes.data ?? []) as PlatformDevice[]);
    } catch (e: any) { toast.error(e?.message || "Failed to load data"); }
    finally { setLoading(false); }
  };

  useEffect(() => { void loadAll(); }, []);

  return (
    <SuperAdminLayout
      title="Hardware & Assignment"
      subtitle="Register schools, tablets, and devices — then assign them together"
      breadcrumbs={<SuperAdminBreadcrumbs items={[{ label: "Super Admin", to: "/super-admin" }, { label: "Hardware & Assignment" }]} />}
    >
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {schools.length} schools &middot; {tablets.length} tablets &middot; {devices.length} devices
        </p>
        <button onClick={() => void loadAll()} disabled={loading}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold hover:bg-muted disabled:opacity-50">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
        </button>
      </div>

      <PageTabs tabs={[...TABS]} active={tab} onChange={(t) => setTab(t as Tab)} />

      {tab === "Schools" && <SchoolsTab schools={schools} onRefresh={loadAll} />}
      {tab === "Tablets" && <TabletsTab tablets={tablets} schools={schools} onRefresh={loadAll} />}
      {tab === "Devices" && <DevicesTab devices={devices} tablets={tablets} schools={schools} onRefresh={loadAll} />}
      {tab === "Assign"  && <AssignTab  tablets={tablets} devices={devices} schools={schools} onRefresh={loadAll} />}
    </SuperAdminLayout>
  );
}

// --- Schools Tab --------------------------------------------------------------

function SchoolsTab({ schools, onRefresh }: { schools: SchoolRecord[]; onRefresh: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-lg">Registered Schools</h2>
          <p className="text-xs text-muted-foreground">Schools are created in the Schools section. This tab shows what exists for reference.</p>
        </div>
        <Badge variant="secondary">{schools.length} total</Badge>
      </div>
      {schools.length === 0
        ? <EmptyState message="No schools registered yet. Go to Super Admin ? Schools to create one." />
        : (
          <div className="divide-y divide-border">
            {schools.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted shrink-0">
                  <School className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{s.name}</div>
                </div>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", statusColor(s.status))}>
                  {s.status ?? "unknown"}
                </span>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

// --- Tablets Tab -------------------------------------------------------------
// Create new tablets and list existing ones. IP/port hidden from UI.

function TabletsTab({ tablets, schools, onRefresh }: {
  tablets: PlatformTablet[]; schools: SchoolRecord[]; onRefresh: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", ip: "", port: "5000", location: "", notes: "", school_id: "" });

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.school_id) { toast.error("Select a school"); return; }
    setSaving(true);
    try {
      await platformHardwareApi.createTablet({
        school_id: form.school_id,
        name: form.name,
        ip: form.ip,
        port: Number(form.port || 5000),
        location: form.location || undefined,
        notes: form.notes || undefined,
      });
      toast.success("Tablet registered");
      setForm({ name: "", ip: "", port: "5000", location: "", notes: "", school_id: form.school_id });
      onRefresh();
    } catch (e: any) { toast.error(e?.message || "Failed to create tablet"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (t: PlatformTablet) => {
    if (!confirm(`Delete tablet "${t.name}"?`)) return;
    try { await platformHardwareApi.deleteTablet(t.id); toast.success("Deleted"); onRefresh(); }
    catch (e: any) { toast.error(e?.message || "Failed"); }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <TabletSmartphone className="h-5 w-5 text-amber-600" />
          <div>
            <h2 className="font-display text-lg font-semibold">Register Tablet Bridge</h2>
            <p className="text-xs text-muted-foreground">A Windows PC that bridges the biometric device to the backend.</p>
          </div>
        </div>
        <form onSubmit={handleCreate} className="grid gap-4">
          <SaSelect label="School *" value={form.school_id} onChange={e => setForm({...form, school_id: e.target.value})}>
            <option value="">— select school —</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SaSelect>
          <SaInput label="Tablet Name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Main Gate Tablet" required />
          {/* IP and port are technical fields — shown to admin but labeled clearly */}
          <div className="grid gap-3 md:grid-cols-2">
            <SaInput label="Bridge IP (WireGuard VPN) *" value={form.ip} onChange={e => setForm({...form, ip: e.target.value})} placeholder="10.0.0.2" required />
            <SaInput label="API Port *" type="number" value={form.port} onChange={e => setForm({...form, port: e.target.value})} required />
          </div>
          <SaInput label="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="Main Entrance Gate" />
          <label>
            <span className="mb-1.5 block text-xs font-semibold">Notes</span>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Optional notes" />
          </label>
          <button type="submit" disabled={saving || !form.school_id}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <Plus className="h-4 w-4" /> Register Tablet
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">All Tablets</h2>
          <Badge variant="secondary">{tablets.length}</Badge>
        </div>
        {tablets.length === 0 ? <EmptyState message="No tablets registered yet." /> : (
          <div className="divide-y divide-border">
            {tablets.map(t => {
              const school = schools.find(s => String(s.id) === String(t.school_id));
              return (
                <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted shrink-0">
                    <TabletSmartphone className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{t.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {school?.name ?? "Unassigned"}{t.location ? ` · ${t.location}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                      t.status === "online" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                    )}>{t.status}</span>
                    <button onClick={() => void handleDelete(t)} className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// --- Devices Tab -------------------------------------------------------------
// Create FK623 device records. No IP shown — IP is internal.

function DevicesTab({ devices, tablets, schools, onRefresh }: {
  devices: PlatformDevice[]; tablets: PlatformTablet[];
  schools: SchoolRecord[]; onRefresh: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    school_id: "", name: "", device_uid: "",
    type: "tablet" as "tablet"|"kiosk"|"web",
    mode: "gate" as "gate"|"boarding"|"classroom",
    location: "",
    device_ip: "", device_port: "4370", license_number: "0",
    device_serial: "", product_name: "",
  });

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.school_id) { toast.error("Select a school"); return; }
    setSaving(true);
    try {
      await platformHardwareApi.createDevice({
        school_id: form.school_id,
        device_uid: form.device_uid,
        name: form.name,
        type: form.type,
        mode: form.mode,
        location: form.location || undefined,
        tablet_ip: form.device_ip || undefined,
        tablet_port: form.device_port ? Number(form.device_port) : undefined,
        license_number: form.license_number ? Number(form.license_number) : undefined,
        device_serial: form.device_serial || undefined,
        product_name: form.product_name || undefined,
      } as any);
      toast.success("Device registered");
      setForm(f => ({ ...f, name: "", device_uid: "", location: "", device_serial: "", product_name: "" }));
      onRefresh();
    } catch (e: any) { toast.error(e?.message || "Failed to create device"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (d: PlatformDevice) => {
    if (!confirm(`Delete device "${d.name}"?`)) return;
    try { await platformHardwareApi.deleteDevice(d.id); toast.success("Deleted"); onRefresh(); }
    catch (e: any) { toast.error(e?.message || "Failed"); }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="h-5 w-5 text-amber-600" />
          <div>
            <h2 className="font-display text-lg font-semibold">Register Biometric Device</h2>
            <p className="text-xs text-muted-foreground">FK623 fingerprint / face reader. Link it to a tablet after creation using the Assign tab.</p>
          </div>
        </div>
        <form onSubmit={handleCreate} className="grid gap-4">
          <SaSelect label="School *" value={form.school_id} onChange={e => setForm({...form, school_id: e.target.value})}>
            <option value="">— select school —</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SaSelect>
          <div className="grid gap-3 md:grid-cols-2">
            <SaInput label="Device Name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Main Gate Reader" required />
            <SaInput label="Device UID *" value={form.device_uid} onChange={e => setForm({...form, device_uid: e.target.value})} placeholder="FK623-GATE-01" required />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <SaSelect label="Mode *" value={form.mode} onChange={e => setForm({...form, mode: e.target.value as any})}>
              <option value="gate">Gate</option>
              <option value="boarding">Boarding</option>
              <option value="classroom">Classroom</option>
            </SaSelect>
            <SaInput label="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="Main Gate" />
          </div>
          {/* Device serial / product name — visible to admin, not to school users */}
          <div className="grid gap-3 md:grid-cols-2">
            <SaInput label="Serial Number" value={form.device_serial} onChange={e => setForm({...form, device_serial: e.target.value})} />
            <SaInput label="Product Name" value={form.product_name} onChange={e => setForm({...form, product_name: e.target.value})} placeholder="FK623" />
          </div>
          {/* Device IP/port — internal network details, admin only */}
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 grid gap-3 md:grid-cols-3">
            <p className="md:col-span-3 text-xs text-muted-foreground font-medium">Device network settings (internal — not shown to school users)</p>
            <SaInput label="Device IP" value={form.device_ip} onChange={e => setForm({...form, device_ip: e.target.value})} placeholder="192.168.1.x" />
            <SaInput label="Device Port" type="number" value={form.device_port} onChange={e => setForm({...form, device_port: e.target.value})} />
            <SaInput label="License No." type="number" value={form.license_number} onChange={e => setForm({...form, license_number: e.target.value})} />
          </div>
          <button type="submit" disabled={saving || !form.school_id}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <Plus className="h-4 w-4" /> Register Device
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">All Devices</h2>
          <Badge variant="secondary">{devices.length}</Badge>
        </div>
        {devices.length === 0 ? <EmptyState message="No devices registered yet." /> : (
          <div className="divide-y divide-border">
            {devices.map(d => {
              const school = schools.find(s => String(s.id) === String(d.school_id));
              const linkedTablet = d.tablet ?? tablets.find(t => String(t.id) === String(d.tablet_id));
              return (
                <div key={d.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted shrink-0">
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{d.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {school?.name ?? "?"} · {d.mode}
                      {linkedTablet ? ` · linked to ${linkedTablet.name}` : " · no tablet linked"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={d.is_connected ? "default" : "secondary"} className={d.is_connected ? "bg-success/15 text-success" : ""}>
                      {d.is_connected ? "Connected" : "Offline"}
                    </Badge>
                    <button onClick={() => void handleDelete(d)} className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
