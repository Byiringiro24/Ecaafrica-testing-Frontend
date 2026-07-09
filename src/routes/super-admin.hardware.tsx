import { FormEvent, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  School, TabletSmartphone, Cpu, ArrowRight,
  Plus, Trash2, RefreshCw, CheckCircle2, ArrowRightLeft,
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

type SchoolRecord = { id: string; name: string; status?: string | null };
type PlatformTablet = Tablet & { school?: { id: string; name: string } | null };
type PlatformDevice = Device & {
  school?: { id: string; name: string } | null;
  tablet?: { id: string; name: string } | null;
};

const TABS = ["Schools", "Tablets", "Devices", "Assign"] as const;
type Tab = (typeof TABS)[number];

const statusColor = (s?: string | null) =>
  s === "active" || s === "trial" ? "bg-emerald-100 text-emerald-700"
    : s === "suspended" ? "bg-rose-100 text-rose-700"
    : "bg-muted text-muted-foreground";

const staleness = (lastCheck?: string | null) => {
  if (!lastCheck) return { label: "never checked", stale: true };
  const diff = Date.now() - new Date(lastCheck).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return { label: "just now", stale: false };
  if (mins < 60) return { label: `${mins}m ago`, stale: mins > 5 };
  return { label: `${Math.floor(mins / 60)}h ago`, stale: true };
};

function HardwarePage() {
  const [tab, setTab] = useState<Tab>("Schools");
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [tablets, setTablets] = useState<PlatformTablet[]>([]);
  const [devices, setDevices] = useState<PlatformDevice[]>([]);
  const [loading, setLoading] = useState(false);

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
      title="Tablets & Devices"
      subtitle="Register tablets and biometric devices, then assign them to schools"
      breadcrumbs={<SuperAdminBreadcrumbs items={[{ label: "Super Admin", to: "/super-admin" }, { label: "Tablets & Devices" }]} />}
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
      {tab === "Schools" && <SchoolsTab schools={schools} />}
      {tab === "Tablets" && <TabletsTab tablets={tablets} schools={schools} onRefresh={loadAll} />}
      {tab === "Devices" && <DevicesTab devices={devices} tablets={tablets} schools={schools} onRefresh={loadAll} />}
      {tab === "Assign"  && <AssignTab  tablets={tablets} devices={devices} schools={schools} onRefresh={loadAll} />}
    </SuperAdminLayout>
  );
}

function SchoolsTab({ schools }: { schools: SchoolRecord[] }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-lg">Registered Schools</h2>
          <p className="text-xs text-muted-foreground">Schools are created in the Schools section. This is a read-only reference.</p>
        </div>
        <Badge variant="secondary">{schools.length} total</Badge>
      </div>
      {schools.length === 0 ? <EmptyState message="No schools registered yet." /> : (
        <div className="divide-y divide-border">
          {schools.map(s => (
            <div key={s.id} className="flex items-center gap-3 px-5 py-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted shrink-0">
                <School className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{s.name}</div>
                <div className="text-xs text-muted-foreground font-mono">id: {s.id}</div>
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

function TabletsTab({ tablets, schools, onRefresh }: {
  tablets: PlatformTablet[]; schools: SchoolRecord[]; onRefresh: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [pinging, setPinging] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<Record<string, "online" | "offline" | "checking">>({});
  const [form, setForm] = useState({ name: "", ip: "", port: "5000", location: "", notes: "", school_id: "" });

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.school_id) { toast.error("Select a school"); return; }
    setSaving(true);
    try {
      await platformHardwareApi.createTablet({
        school_id: form.school_id, name: form.name, ip: form.ip,
        port: Number(form.port || 5000),
        location: form.location || undefined, notes: form.notes || undefined,
      });
      toast.success("Tablet registered");
      setForm({ name: "", ip: "", port: "5000", location: "", notes: "", school_id: form.school_id });
      onRefresh();
    } catch (e: any) { toast.error(e?.message || "Failed"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (t: PlatformTablet) => {
    if (!confirm(`Delete tablet "${t.name}"?`)) return;
    try { await platformHardwareApi.deleteTablet(t.id); toast.success("Deleted"); onRefresh(); }
    catch (e: any) { toast.error(e?.message || "Failed"); }
  };

  const handlePing = async (t: PlatformTablet) => {
    setPinging(t.id);
    setLiveStatus(prev => ({ ...prev, [t.id]: "checking" }));
    try {
      const res = await apiRequest<any>(`/platform/hardware/tablets/${t.id}/ping`, { auth: "platform" });
      const online = res?.healthy === true || res?.success === true;
      setLiveStatus(prev => ({ ...prev, [t.id]: online ? "online" : "offline" }));
      toast[online ? "success" : "warning"](
        online ? `${t.name} is reachable` : `${t.name} not reachable — check WireGuard VPN`
      );
    } catch {
      setLiveStatus(prev => ({ ...prev, [t.id]: "offline" }));
      toast.warning(`${t.name} not reachable — check WireGuard VPN and bridge app`);
    } finally { setPinging(null); }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <TabletSmartphone className="h-5 w-5 text-amber-600" />
          <div>
            <h2 className="font-display text-lg font-semibold">Register Tablet Bridge</h2>
            <p className="text-xs text-muted-foreground">Windows PC that runs the bridge app and connects over WireGuard VPN.</p>
          </div>
        </div>
        <form onSubmit={handleCreate} className="grid gap-4">
          <SaSelect label="School *" value={form.school_id} onChange={e => setForm({...form, school_id: e.target.value})}>
            <option value="">-- select school --</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SaSelect>
          <SaInput label="Tablet Name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Main Gate Tablet" required />
          <div className="grid gap-3 md:grid-cols-2">
            <SaInput label="WireGuard VPN IP *" value={form.ip} onChange={e => setForm({...form, ip: e.target.value})} placeholder="10.0.0.2" required />
            <SaInput label="Bridge API Port *" type="number" value={form.port} onChange={e => setForm({...form, port: e.target.value})} required />
          </div>
          <SaInput label="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="Main Gate" />
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
          <div>
            <h2 className="font-display text-lg font-semibold">All Tablets</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Click the refresh icon to do a live ping.</p>
          </div>
          <Badge variant="secondary">{tablets.length}</Badge>
        </div>
        {tablets.length === 0 ? <EmptyState message="No tablets registered yet." /> : (
          <div className="divide-y divide-border">
            {tablets.map(t => {
              const school = schools.find(s => String(s.id) === String(t.school_id));
              const live = liveStatus[t.id];
              const displayStatus = live ?? t.status;
              const { label: staleLabel, stale } = staleness(t.last_health_check);
              return (
                <div key={t.id} className="px-5 py-3">
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted shrink-0">
                      <TabletSmartphone className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{t.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {school ? school.name : <span className="text-amber-600 font-medium">Not assigned to a school</span>}
                        {t.location ? ` · ${t.location}` : ""}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">{t.ip}:{t.port}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize block",
                          displayStatus === "online" ? "bg-emerald-100 text-emerald-700"
                          : displayStatus === "checking" ? "bg-blue-100 text-blue-700"
                          : "bg-muted text-muted-foreground"
                        )}>
                          {displayStatus === "checking" ? "pinging..." : (displayStatus ?? "unknown")}
                          {live && <span className="ml-1 opacity-60 text-[10px]">(live)</span>}
                        </span>
                        <span className={cn("text-[10px] block mt-0.5", stale ? "text-amber-600" : "text-muted-foreground")}>
                          {stale ? "stale: " : ""}{staleLabel}
                        </span>
                      </div>
                      <button onClick={() => void handlePing(t)} disabled={pinging === t.id}
                        title="Live ping" className="p-1.5 rounded-md border border-border hover:bg-muted text-muted-foreground disabled:opacity-40">
                        <RefreshCw className={cn("h-3.5 w-3.5", pinging === t.id && "animate-spin")} />
                      </button>
                      <button onClick={() => void handleDelete(t)} className="p-1.5 rounded-md hover:bg-rose-50 hover:text-rose-600 text-muted-foreground">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
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

function DevicesTab({ devices, tablets, schools, onRefresh }: {
  devices: PlatformDevice[]; tablets: PlatformTablet[];
  schools: SchoolRecord[]; onRefresh: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    school_id: "", name: "", device_uid: "",
    mode: "gate" as "gate" | "boarding" | "classroom",
    location: "", device_ip: "", device_port: "4370", license_number: "0",
    device_serial: "", product_name: "",
  });

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.school_id) { toast.error("Select a school"); return; }
    setSaving(true);
    try {
      await platformHardwareApi.createDevice({
        school_id: form.school_id, device_uid: form.device_uid, name: form.name,
        type: "tablet", mode: form.mode, location: form.location || undefined,
        tablet_ip: form.device_ip || undefined,
        tablet_port: form.device_port ? Number(form.device_port) : undefined,
        license_number: form.license_number ? Number(form.license_number) : undefined,
        device_serial: form.device_serial || undefined,
        product_name: form.product_name || undefined,
      } as any);
      toast.success("Device registered");
      setForm(f => ({ ...f, name: "", device_uid: "", location: "", device_serial: "", product_name: "" }));
      onRefresh();
    } catch (e: any) { toast.error(e?.message || "Failed"); }
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
            <p className="text-xs text-muted-foreground">FK623 fingerprint/face reader. Link to a tablet in the Assign tab.</p>
          </div>
        </div>
        <form onSubmit={handleCreate} className="grid gap-4">
          <SaSelect label="School *" value={form.school_id} onChange={e => setForm({...form, school_id: e.target.value})}>
            <option value="">-- select school --</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SaSelect>
          <div className="grid gap-3 md:grid-cols-2">
            <SaInput label="Device Name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Main Gate Reader" required />
            <SaInput label="Device UID *" value={form.device_uid} onChange={e => setForm({...form, device_uid: e.target.value})} placeholder="FK623-GATE-01" required />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <SaSelect label="Mode *" value={form.mode} onChange={e => setForm({...form, mode: e.target.value as any})}>
              <option value="gate">Gate (entry/exit)</option>
              <option value="boarding">Boarding (dormitory)</option>
              <option value="classroom">Classroom</option>
            </SaSelect>
            <SaInput label="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="Main Gate" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <SaInput label="Serial Number" value={form.device_serial} onChange={e => setForm({...form, device_serial: e.target.value})} />
            <SaInput label="Product Name" value={form.product_name} onChange={e => setForm({...form, product_name: e.target.value})} placeholder="FK623" />
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 grid gap-3 md:grid-cols-3">
            <p className="md:col-span-3 text-xs font-semibold text-amber-800">Network settings (internal — not shown to school users)</p>
            <SaInput label="Device IP (LAN)" value={form.device_ip} onChange={e => setForm({...form, device_ip: e.target.value})} placeholder="192.168.1.x" />
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
                      {school?.name ?? <span className="text-amber-600">No school</span>} · {d.mode}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {linkedTablet
                        ? <span className="text-emerald-700">Linked: {linkedTablet.name}</span>
                        : <span className="text-amber-600">Not linked to tablet — auto-pull inactive</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      d.is_connected ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground")}>
                      {d.is_connected ? "Online" : "Offline"}
                    </span>
                    <button onClick={() => void handleDelete(d)} className="p-1.5 rounded-md hover:bg-rose-50 hover:text-rose-600 text-muted-foreground">
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

function AssignTab({ tablets, devices, schools, onRefresh }: {
  tablets: PlatformTablet[]; devices: PlatformDevice[];
  schools: SchoolRecord[]; onRefresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [tabletSchoolForm, setTabletSchoolForm] = useState({ tablet_id: "", school_id: "" });
  const [linkForm, setLinkForm] = useState({ device_id: "", tablet_id: "" });
  const [deviceSchoolForm, setDeviceSchoolForm] = useState({ device_id: "", school_id: "" });

  const handleReassignTablet = async (e: FormEvent) => {
    e.preventDefault();
    const tablet = tablets.find(t => t.id === tabletSchoolForm.tablet_id);
    const school = schools.find(s => s.id === tabletSchoolForm.school_id);
    if (!tablet || !school) { toast.error("Select both tablet and school"); return; }
    if (!confirm(`Move "${tablet.name}" to "${school.name}"?`)) return;
    setBusy(true);
    try {
      await platformHardwareApi.updateTablet(tabletSchoolForm.tablet_id, { school_id: tabletSchoolForm.school_id } as any);
      toast.success(`Tablet moved to ${school.name}`);
      setTabletSchoolForm({ tablet_id: "", school_id: "" });
      onRefresh();
    } catch (e: any) { toast.error(e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  const handleLinkDevice = async (e: FormEvent) => {
    e.preventDefault();
    const device = devices.find(d => d.id === linkForm.device_id);
    const tablet = tablets.find(t => t.id === linkForm.tablet_id);
    if (!device || !tablet) { toast.error("Select both device and tablet"); return; }
    setBusy(true);
    try {
      await platformHardwareApi.updateDevice(linkForm.device_id, { tablet_id: linkForm.tablet_id });
      toast.success(`"${device.name}" linked to "${tablet.name}"`);
      setLinkForm({ device_id: "", tablet_id: "" });
      onRefresh();
    } catch (e: any) { toast.error(e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  const handleReassignDevice = async (e: FormEvent) => {
    e.preventDefault();
    const device = devices.find(d => d.id === deviceSchoolForm.device_id);
    const school = schools.find(s => s.id === deviceSchoolForm.school_id);
    if (!device || !school) { toast.error("Select both device and school"); return; }
    if (!confirm(`Move device "${device.name}" to "${school.name}"?`)) return;
    setBusy(true);
    try {
      await platformHardwareApi.updateDevice(deviceSchoolForm.device_id, { school_id: deviceSchoolForm.school_id } as any);
      toast.success(`Device moved to ${school.name}`);
      setDeviceSchoolForm({ device_id: "", school_id: "" });
      onRefresh();
    } catch (e: any) { toast.error(e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
        <strong>Auto-pull requires:</strong> (1) Tablet assigned to school, (2) Device linked to tablet, (3) WireGuard VPN active on the Windows PC, (4) Bridge app running on the Windows PC. Once all four are done, logs pull every 10 seconds automatically and SMS is sent to parents instantly.
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Action 1 */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-amber-100">
              <TabletSmartphone className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Assign Tablet to School</h2>
              <p className="text-xs text-muted-foreground">Move a tablet to a different school</p>
            </div>
          </div>
          <form onSubmit={handleReassignTablet} className="grid gap-3">
            <SaSelect label="Tablet" value={tabletSchoolForm.tablet_id}
              onChange={e => setTabletSchoolForm(f => ({ ...f, tablet_id: e.target.value }))}>
              <option value="">-- select tablet --</option>
              {tablets.map(t => {
                const cs = schools.find(s => String(s.id) === String(t.school_id));
                return <option key={t.id} value={t.id}>{t.name} {cs ? `(${cs.name})` : "(unassigned)"}</option>;
              })}
            </SaSelect>
            {tabletSchoolForm.tablet_id && (() => {
              const t = tablets.find(x => x.id === tabletSchoolForm.tablet_id);
              const s = schools.find(x => String(x.id) === String(t?.school_id));
              return s ? <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs">Currently: <strong>{s.name}</strong></div> : null;
            })()}
            <SaSelect label="Move to School" value={tabletSchoolForm.school_id}
              onChange={e => setTabletSchoolForm(f => ({ ...f, school_id: e.target.value }))}>
              <option value="">-- select target school --</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </SaSelect>
            <button type="submit" disabled={busy || !tabletSchoolForm.tablet_id || !tabletSchoolForm.school_id}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
              <ArrowRightLeft className="h-4 w-4" /> Move Tablet
            </button>
          </form>
        </section>

        {/* Action 2 */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-100">
              <ArrowRight className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Link Device to Tablet</h2>
              <p className="text-xs text-muted-foreground">This enables auto-pull for that device</p>
            </div>
          </div>
          <form onSubmit={handleLinkDevice} className="grid gap-3">
            <SaSelect label="Biometric Device (FK623)" value={linkForm.device_id}
              onChange={e => setLinkForm(f => ({ ...f, device_id: e.target.value }))}>
              <option value="">-- select device --</option>
              {devices.map(d => {
                const ct = tablets.find(t => String(t.id) === String(d.tablet_id));
                return <option key={d.id} value={d.id}>{d.name} {ct ? `-> ${ct.name}` : "(not linked)"}</option>;
              })}
            </SaSelect>
            {linkForm.device_id && (() => {
              const d = devices.find(x => x.id === linkForm.device_id);
              const t = tablets.find(x => String(x.id) === String(d?.tablet_id));
              return (
                <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
                  {t ? <>Currently: <strong>{t.name}</strong></> : <span className="text-amber-600">Not linked yet</span>}
                </div>
              );
            })()}
            <SaSelect label="Tablet (Windows Bridge)" value={linkForm.tablet_id}
              onChange={e => setLinkForm(f => ({ ...f, tablet_id: e.target.value }))}>
              <option value="">-- select tablet --</option>
              {tablets.map(t => {
                const s = schools.find(x => String(x.id) === String(t.school_id));
                return <option key={t.id} value={t.id}>{t.name} {s ? `(${s.name})` : ""}</option>;
              })}
            </SaSelect>
            <button type="submit" disabled={busy || !linkForm.device_id || !linkForm.tablet_id}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              <CheckCircle2 className="h-4 w-4" /> Link Device
            </button>
          </form>
        </section>

        {/* Action 3 */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-100">
              <Cpu className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Reassign Device to School</h2>
              <p className="text-xs text-muted-foreground">Move a biometric device to a different school</p>
            </div>
          </div>
          <form onSubmit={handleReassignDevice} className="grid gap-3">
            <SaSelect label="Device" value={deviceSchoolForm.device_id}
              onChange={e => setDeviceSchoolForm(f => ({ ...f, device_id: e.target.value }))}>
              <option value="">-- select device --</option>
              {devices.map(d => {
                const cs = schools.find(s => String(s.id) === String(d.school_id));
                return <option key={d.id} value={d.id}>{d.name} {cs ? `(${cs.name})` : "(unassigned)"}</option>;
              })}
            </SaSelect>
            {deviceSchoolForm.device_id && (() => {
              const d = devices.find(x => x.id === deviceSchoolForm.device_id);
              const s = schools.find(x => String(x.id) === String(d?.school_id));
              return s ? <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs">Currently: <strong>{s.name}</strong></div> : null;
            })()}
            <SaSelect label="Move to School" value={deviceSchoolForm.school_id}
              onChange={e => setDeviceSchoolForm(f => ({ ...f, school_id: e.target.value }))}>
              <option value="">-- select target school --</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </SaSelect>
            <button type="submit" disabled={busy || !deviceSchoolForm.device_id || !deviceSchoolForm.school_id}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              <ArrowRightLeft className="h-4 w-4" /> Move Device
            </button>
          </form>
        </section>
      </div>

      {/* Assignments overview table */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold">Assignments Overview</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Auto-pull is Active only when a device has both a school AND a linked tablet.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {["Device", "Mode", "School", "Linked Tablet", "Auto-pull", "Status"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {devices.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">No devices registered yet</td></tr>
              ) : devices.map(d => {
                const school = schools.find(s => String(s.id) === String(d.school_id));
                const linkedTablet = d.tablet ?? tablets.find(t => String(t.id) === String(d.tablet_id));
                const autopullReady = Boolean(linkedTablet) && Boolean(school);
                return (
                  <tr key={d.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{d.device_uid}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">{d.mode}</span>
                    </td>
                    <td className="px-4 py-3">
                      {school ? <span className="font-medium">{school.name}</span>
                        : <span className="text-amber-600 text-xs font-medium">Not assigned</span>}
                    </td>
                    <td className="px-4 py-3">
                      {linkedTablet ? <span className="font-medium">{linkedTablet.name}</span>
                        : <span className="text-amber-600 text-xs font-medium">Not linked</span>}
                    </td>
                    <td className="px-4 py-3">
                      {autopullReady
                        ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Active</span>
                        : <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Incomplete</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        d.is_connected ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground")}>
                        {d.is_connected ? "Online" : "Offline"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
