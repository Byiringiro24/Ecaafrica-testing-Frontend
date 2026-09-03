import { FormEvent, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  School, TabletSmartphone, Cpu, ArrowRight,
  Plus, Trash2, RefreshCw, CheckCircle2, ArrowRightLeft,
  Pencil, X, Save, Link2, Zap, AlertTriangle, Info,
  Wifi, Key, Copy, ClipboardPaste, WifiOff, ShieldCheck, Activity,
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

const TABS = ["Schools", "Tablets", "Devices", "Assign", "Device Locations", "VPN Setup"] as const;
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
      {tab === "Device Locations" && <DeviceLocationsTab devices={devices} schools={schools} onRefresh={loadAll} />}
      {tab === "VPN Setup" && <VpnSetupTab />}
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

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", ip: "", port: "5000", location: "", notes: "", school_id: "" });

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

  const startEdit = (t: PlatformTablet) => {
    setEditingId(t.id);
    setEditForm({
      name: t.name ?? "",
      ip: (t as any).ip ?? "",
      port: String((t as any).port ?? 5000),
      location: (t as any).location ?? "",
      notes: (t as any).notes ?? "",
      school_id: String(t.school_id ?? ""),
    });
  };

  const cancelEdit = () => { setEditingId(null); };

  const handleSaveEdit = async (t: PlatformTablet) => {
    setSaving(true);
    try {
      await platformHardwareApi.updateTablet(t.id, {
        name: editForm.name,
        ip: editForm.ip,
        port: Number(editForm.port || 5000),
        location: editForm.location || undefined,
        notes: editForm.notes || undefined,
        school_id: editForm.school_id || undefined,
      } as any);
      toast.success("Tablet updated");
      setEditingId(null);
      onRefresh();
    } catch (e: any) { toast.error(e?.message || "Failed to save"); }
    finally { setSaving(false); }
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
            <p className="text-xs text-muted-foreground mt-0.5">Click the pencil to edit, refresh icon to ping.</p>
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
              const isEditing = editingId === t.id;
              return (
                <div key={t.id} className="px-5 py-3">
                  {isEditing ? (
                    /* ── Inline edit form ── */
                    <div className="grid gap-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-primary">Editing: {t.name}</span>
                        <button onClick={cancelEdit} className="p-1 rounded hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
                      </div>
                      <SaSelect label="School" value={editForm.school_id} onChange={e => setEditForm({...editForm, school_id: e.target.value})}>
                        <option value="">-- no school --</option>
                        {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </SaSelect>
                      <SaInput label="Name" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} required />
                      <div className="grid gap-2 grid-cols-2">
                        <SaInput label="VPN IP" value={editForm.ip} onChange={e => setEditForm({...editForm, ip: e.target.value})} placeholder="10.0.0.2" />
                        <SaInput label="Port" type="number" value={editForm.port} onChange={e => setEditForm({...editForm, port: e.target.value})} />
                      </div>
                      <SaInput label="Location" value={editForm.location} onChange={e => setEditForm({...editForm, location: e.target.value})} />
                      <label>
                        <span className="mb-1 block text-xs font-semibold">Notes</span>
                        <textarea value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} rows={2}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                      </label>
                      <div className="flex gap-2">
                        <button onClick={() => void handleSaveEdit(t)} disabled={saving}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                          <Save className="h-3.5 w-3.5" /> Save
                        </button>
                        <button onClick={cancelEdit}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Normal row ── */
                    <div className="flex items-start gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted shrink-0">
                        <TabletSmartphone className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">{t.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {school ? school.name : <span className="text-amber-600 font-medium">Not assigned to a school</span>}
                          {(t as any).location ? ` · ${(t as any).location}` : ""}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">{(t as any).ip}:{(t as any).port}</div>
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
                        <button onClick={() => startEdit(t)} title="Edit tablet"
                          className="p-1.5 rounded-md hover:bg-amber-50 hover:text-amber-600 text-muted-foreground border border-border">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => void handleDelete(t)} className="p-1.5 rounded-md hover:bg-rose-50 hover:text-rose-600 text-muted-foreground">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
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
  const [connecting, setConnecting] = useState<string | null>(null);
  const [form, setForm] = useState({
    school_id: "", name: "", device_uid: "",
    mode: "gate" as "gate" | "boarding" | "classroom",
    location: "", device_ip: "", device_port: "5005", license_number: "1261",
    device_serial: "", product_name: "", tablet_id: "",
  });

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", school_id: "", mode: "gate" as "gate" | "boarding" | "classroom",
    location: "", device_ip: "", device_port: "4370", license_number: "0",
    device_serial: "", product_name: "",
  });

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.school_id) { toast.error("Select a school"); return; }
    setSaving(true);
    try {
      const created = await platformHardwareApi.createDevice({
        school_id: form.school_id, device_uid: form.device_uid, name: form.name,
        type: "tablet", mode: form.mode, location: form.location || undefined,
        tablet_ip: form.device_ip || undefined,
        tablet_port: form.device_port ? Number(form.device_port) : undefined,
        license_number: form.license_number ? Number(form.license_number) : undefined,
        device_serial: form.device_serial || undefined,
        product_name: form.product_name || undefined,
        tablet_id: form.tablet_id || undefined,
      } as any);

      // If a tablet was selected, auto-link and trigger the bridge connect
      if (form.tablet_id && created) {
        const deviceId = (created as any)?.id ?? (created as any)?.data?.id;
        if (deviceId) {
          // Link device to tablet
          await platformHardwareApi.updateDevice(String(deviceId), { tablet_id: form.tablet_id } as any);
          // Trigger bridge connect-saved so FK623 TCP handshake happens immediately
          const tablet = tablets.find(t => t.id === form.tablet_id);
          if (tablet) {
            try {
              await apiRequest(`/tablets/${form.tablet_id}/device/connect`, {
                method: "POST",
                body: JSON.stringify({ ipAddress: form.device_ip, port: Number(form.device_port), license: Number(form.license_number) }),
                auth: "school",
              });
              toast.success("Device registered, linked and connected to FK623 — auto-pull is now active ✓");
            } catch {
              toast.success("Device registered and linked. Bridge connect will retry automatically.");
            }
          }
        }
      } else {
        toast.success("Device registered. Link it to a tablet in the Assign tab to enable auto-pull.");
      }

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

  const startEdit = (d: PlatformDevice) => {
    setEditingId(d.id);
    setEditForm({
      name: d.name ?? "",
      school_id: String(d.school_id ?? ""),
      mode: (d.mode as any) ?? "gate",
      location: (d as any).location ?? "",
      device_ip: (d as any).tablet_ip ?? "",
      device_port: String((d as any).tablet_port ?? 4370),
      license_number: String((d as any).license_number ?? 0),
      device_serial: (d as any).device_serial ?? "",
      product_name: (d as any).product_name ?? "",
    });
  };

  const cancelEdit = () => setEditingId(null);

  const handleConnectDevice = async (d: PlatformDevice) => {
    const tablet = tablets.find(t => String(t.id) === String(d.tablet_id));
    if (!tablet) { toast.error("Device is not linked to a tablet. Link it first in the Assign tab."); return; }
    setConnecting(d.id);
    try {
      await apiRequest(`/tablets/${tablet.id}/device/connect`, {
        method: "POST",
        body: JSON.stringify({
          ipAddress: (d as any).tablet_ip,
          port: (d as any).tablet_port ?? 5005,
          license: (d as any).license_number ?? 1261,
        }),
        auth: "school",
      });
      toast.success(`Connected to FK623 via ${tablet.name} — auto-pull is active ✓`);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message?.includes("timeout") 
        ? `Timeout — check WireGuard VPN and bridge app on the Windows tablet`
        : e?.message || "Connection failed");
    } finally { setConnecting(null); }
  };

  const handleSaveEdit = async (d: PlatformDevice) => {
    setSaving(true);
    try {
      await platformHardwareApi.updateDevice(d.id, {
        name: editForm.name,
        school_id: editForm.school_id || undefined,
        mode: editForm.mode,
        location: editForm.location || undefined,
        tablet_ip: editForm.device_ip || undefined,
        tablet_port: editForm.device_port ? Number(editForm.device_port) : undefined,
        license_number: editForm.license_number ? Number(editForm.license_number) : undefined,
        device_serial: editForm.device_serial || undefined,
        product_name: editForm.product_name || undefined,
      } as any);
      toast.success("Device updated");
      setEditingId(null);
      onRefresh();
    } catch (e: any) { toast.error(e?.message || "Failed to save"); }
    finally { setSaving(false); }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
      {/* ── Create form ── */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="h-5 w-5 text-amber-600" />
          <div>
            <h2 className="font-display text-lg font-semibold">Register Biometric Device</h2>
            <p className="text-xs text-muted-foreground">FK623 fingerprint/face reader. Link to a tablet in the Assign tab.</p>
          </div>
        </div>
        <form onSubmit={handleCreate} className="grid gap-4">
          <SaSelect label="School *" value={form.school_id} onChange={e => setForm({...form, school_id: e.target.value, tablet_id: ""})}>
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
            <SaInput label="Product Name" value={form.product_name} onChange={e => setForm({...form, product_name: e.target.value})} placeholder="Pollo / FK623" />
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 grid gap-3 md:grid-cols-3">
            <p className="md:col-span-3 text-xs font-semibold text-amber-800">FK623 network settings (school LAN — internal)</p>
            <SaInput label="Device IP (LAN)" value={form.device_ip} onChange={e => setForm({...form, device_ip: e.target.value})} placeholder="192.168.1.118" />
            <SaInput label="Device Port" type="number" value={form.device_port} onChange={e => setForm({...form, device_port: e.target.value})} />
            <SaInput label="License No." type="number" value={form.license_number} onChange={e => setForm({...form, license_number: e.target.value})} />
          </div>

          {/* ── Tablet link — optional but enables one-step setup ── */}
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5 text-blue-700" />
              <p className="text-xs font-semibold text-blue-800">Link to Tablet (recommended)</p>
            </div>
            <p className="text-xs text-blue-700">
              Linking now enables auto-pull immediately after registration — no need to visit the Assign tab.
              Only tablets assigned to the selected school are shown.
            </p>
            <SaSelect label="Tablet (Windows Bridge)" value={form.tablet_id} onChange={e => setForm({...form, tablet_id: e.target.value})}>
              <option value="">-- link later in Assign tab --</option>
              {tablets
                .filter(t => !form.school_id || String(t.school_id) === form.school_id)
                .map(t => <option key={t.id} value={t.id}>{t.name} ({(t as any).ip}:{(t as any).port})</option>)}
            </SaSelect>
            {form.tablet_id && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Auto-connect will trigger after registration
              </div>
            )}
          </div>

          <button type="submit" disabled={saving || !form.school_id}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <Plus className="h-4 w-4" /> {form.tablet_id ? "Register & Connect Device" : "Register Device"}
          </button>
        </form>
      </section>

      {/* ── Device list ── */}
      <section className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">All Devices</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Click the pencil to edit any device.</p>
          </div>
          <Badge variant="secondary">{devices.length}</Badge>
        </div>
        {devices.length === 0 ? <EmptyState message="No devices registered yet." /> : (
          <div className="divide-y divide-border">
            {devices.map(d => {
              const school = schools.find(s => String(s.id) === String(d.school_id));
              const linkedTablet = d.tablet ?? tablets.find(t => String(t.id) === String(d.tablet_id));
              const isEditing = editingId === d.id;
              return (
                <div key={d.id} className="px-5 py-3">
                  {isEditing ? (
                    /* ── Inline edit form ── */
                    <div className="grid gap-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-primary">Editing: {d.name}</span>
                        <button onClick={cancelEdit} className="p-1 rounded hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
                      </div>
                      <SaSelect label="School" value={editForm.school_id} onChange={e => setEditForm({...editForm, school_id: e.target.value})}>
                        <option value="">-- no school --</option>
                        {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </SaSelect>
                      <div className="grid gap-2 grid-cols-2">
                        <SaInput label="Name" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} required />
                        <SaSelect label="Mode" value={editForm.mode} onChange={e => setEditForm({...editForm, mode: e.target.value as any})}>
                          <option value="gate">Gate</option>
                          <option value="boarding">Boarding</option>
                          <option value="classroom">Classroom</option>
                        </SaSelect>
                      </div>
                      <SaInput label="Location" value={editForm.location} onChange={e => setEditForm({...editForm, location: e.target.value})} />
                      <div className="grid gap-2 grid-cols-2">
                        <SaInput label="Serial No." value={editForm.device_serial} onChange={e => setEditForm({...editForm, device_serial: e.target.value})} />
                        <SaInput label="Product Name" value={editForm.product_name} onChange={e => setEditForm({...editForm, product_name: e.target.value})} />
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 grid gap-2 grid-cols-3">
                        <p className="col-span-3 text-xs font-semibold text-amber-800">Network (internal)</p>
                        <SaInput label="Device IP" value={editForm.device_ip} onChange={e => setEditForm({...editForm, device_ip: e.target.value})} />
                        <SaInput label="Port" type="number" value={editForm.device_port} onChange={e => setEditForm({...editForm, device_port: e.target.value})} />
                        <SaInput label="License No." type="number" value={editForm.license_number} onChange={e => setEditForm({...editForm, license_number: e.target.value})} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => void handleSaveEdit(d)} disabled={saving}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                          <Save className="h-3.5 w-3.5" /> Save
                        </button>
                        <button onClick={cancelEdit}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Normal row ── */
                    <div className="flex items-center gap-3">
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
                        {linkedTablet && !d.is_connected && (
                          <button
                            onClick={() => void handleConnectDevice(d)}
                            disabled={connecting === d.id}
                            title="Connect to FK623 device via bridge"
                            className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50">
                            <Zap className={cn("h-3 w-3", connecting === d.id && "animate-pulse")} />
                            {connecting === d.id ? "Connecting…" : "Connect"}
                          </button>
                        )}
                        {d.is_connected && (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                            <CheckCircle2 className="h-3 w-3" /> Auto-pull active
                          </span>
                        )}
                        <button onClick={() => startEdit(d)} title="Edit device"
                          className="p-1.5 rounded-md hover:bg-amber-50 hover:text-amber-600 text-muted-foreground border border-border">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => void handleDelete(d)} className="p-1.5 rounded-md hover:bg-rose-50 hover:text-rose-600 text-muted-foreground">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
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
  const [connecting, setConnecting] = useState<string | null>(null);
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
      toast.success(`"${device.name}" linked to "${tablet.name}" — triggering FK623 connect…`);
      // Auto-trigger bridge connect after linking
      try {
        await apiRequest(`/tablets/${linkForm.tablet_id}/device/connect`, {
          method: "POST",
          body: JSON.stringify({
            ipAddress: (device as any).tablet_ip,
            port: (device as any).tablet_port ?? 5005,
            license: (device as any).license_number ?? 1261,
          }),
          auth: "school",
        });
        toast.success("FK623 connected — auto-pull is now active ✓");
      } catch {
        toast.info("Linked. FK623 connect will retry automatically every 5s.");
      }
      setLinkForm({ device_id: "", tablet_id: "" });
      onRefresh();
    } catch (e: any) { toast.error(e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  const handleConnectFK623 = async (device: PlatformDevice) => {
    const tablet = tablets.find(t => String(t.id) === String(device.tablet_id));
    if (!tablet) { toast.error("Device not linked to a tablet"); return; }
    setConnecting(device.id);
    try {
      await apiRequest(`/tablets/${tablet.id}/device/connect`, {
        method: "POST",
        body: JSON.stringify({
          ipAddress: (device as any).tablet_ip,
          port: (device as any).tablet_port ?? 5005,
          license: (device as any).license_number ?? 1261,
        }),
        auth: "school",
      });
      toast.success(`FK623 connected via ${tablet.name} — auto-pull active ✓`);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message?.includes("timeout")
        ? "Timeout — check WireGuard VPN and FKBridge.exe on the Windows PC"
        : e?.message || "Connection failed");
    } finally { setConnecting(null); }
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
        <strong>Auto-pull requires 4 things — all manageable from this page:</strong>
        <ol className="mt-1.5 ml-4 list-decimal space-y-0.5 text-xs">
          <li>Tablet registered with correct WireGuard VPN IP (10.0.0.x)</li>
          <li>Device registered with FK623 LAN IP, port and license, and linked to the tablet</li>
          <li>WireGuard VPN tunnel active on the Windows PC at the school</li>
          <li>FK623 Bridge app (FKBridge.exe) running on the Windows PC</li>
        </ol>
        <p className="mt-1.5 text-xs text-amber-700">
          Steps 1–2 are done here. Steps 3–4 are done on the Windows PC at the school (one-time setup).
          Once all four are done, logs pull every 5 seconds automatically and SMS is sent to parents instantly.
        </p>
      </div>

      {/* ── Live status summary cards ── */}
      {devices.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {(() => {
            const linked = devices.filter(d => d.tablet_id);
            const connected = devices.filter(d => d.is_connected);
            const incomplete = devices.filter(d => !d.tablet_id || !d.school_id);
            return [
              { label: "Linked to tablet", count: linked.length, total: devices.length, color: "emerald" },
              { label: "FK623 connected", count: connected.length, total: devices.length, color: "blue" },
              { label: "Incomplete setup", count: incomplete.length, total: devices.length, color: "amber" },
            ].map(s => (
              <div key={s.label} className={cn(
                "rounded-xl border p-4",
                s.color === "emerald" ? "border-emerald-200 bg-emerald-50" :
                s.color === "blue" ? "border-blue-200 bg-blue-50" :
                "border-amber-200 bg-amber-50"
              )}>
                <div className={cn("text-2xl font-bold",
                  s.color === "emerald" ? "text-emerald-700" :
                  s.color === "blue" ? "text-blue-700" : "text-amber-700"
                )}>
                  {s.count}<span className="text-sm font-normal text-muted-foreground">/{s.total}</span>
                </div>
                <div className="text-xs font-medium mt-1">{s.label}</div>
              </div>
            ));
          })()}
        </div>
      )}

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
                {["Device", "Mode", "School", "Linked Tablet", "Auto-pull", "Status", "Action"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {devices.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-muted-foreground">No devices registered yet</td></tr>
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
                    <td className="px-4 py-3">
                      {linkedTablet && !d.is_connected ? (
                        <button
                          onClick={() => void handleConnectFK623(d)}
                          disabled={connecting === d.id}
                          className="inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50">
                          <Zap className={cn("h-3 w-3", connecting === d.id && "animate-pulse")} />
                          {connecting === d.id ? "Connecting…" : "Connect FK623"}
                        </button>
                      ) : d.is_connected ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Link device first</span>
                      )}
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

// ─────────────────────────────────────────────────────────────────────────────
// VPN Setup Tab
// Two-panel layout:
//   LEFT  = Server side  (runs on EcareAfrica server via backend API)
//   RIGHT = Tablet side  (calls the tablet bridge API at http://TABLET_IP:5000)
//
// Flow:
//   1. Server panel: click "Get Server Info" → shows server public key + next VPN IP
//   2. Tablet panel: enter tablet bridge URL, click "Generate Keys on Tablet" → shows tablet public key
//   3. Copy tablet public key → paste into server panel → click "Add Peer to VPN" → server adds peer
//   4. Copy server public key + VPN IP → paste into tablet panel → click "Install & Activate VPN"
//   5. Both sides show green "Active" status
// ─────────────────────────────────────────────────────────────────────────────

type VpnServerStatus = {
  serverPublicKey: string;
  interfaceUp: boolean;
  serverVpnIp: string;
  nextAvailableIp: string;
  peerCount: number;
  serverEndpoint: string;
  vpnSubnet: string;
  peers: Array<{ publicKey: string; allowedIps: string; endpoint: string; latestHandshake: string }>;
};

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error("Copy failed — select and copy manually"); }
  };
  return (
    <button onClick={handleCopy} type="button"
      className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold transition-colors",
        copied ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-border bg-background text-muted-foreground hover:bg-muted")}>
      {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied!" : label}
    </button>
  );
}

function KeyBox({ label, value, placeholder }: { label: string; value: string; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">{label}</span>
        {value && <CopyButton value={value} />}
      </div>
      <div className={cn("rounded-lg border bg-muted/50 px-3 py-2 font-mono text-xs break-all",
        value ? "text-foreground border-border" : "text-muted-foreground border-dashed border-border")}>
        {value || placeholder || "—"}
      </div>
    </div>
  );
}

function VpnSetupTab() {
  // ── State ──
  const [serverStatus, setServerStatus] = useState<VpnServerStatus | null>(null);
  const [serverLoading, setServerLoading] = useState(false);

  // Step 2: paste tablet public key + assign VPN IP → add peer
  const [tabletPublicKey, setTabletPublicKey] = useState("");
  const [assignedVpnIp,   setAssignedVpnIp]   = useState("");
  const [peerComment,     setPeerComment]      = useState("");
  const [addingPeer,      setAddingPeer]       = useState(false);
  const [peerAdded,       setPeerAdded]        = useState(false);
  const [addedVpnIp,      setAddedVpnIp]       = useState("");

  // Ping — server pings a VPN IP (ICMP, same as running ping in server terminal)
  const [pingTarget,  setPingTarget]  = useState("");
  const [pinging2,    setPinging2]    = useState(false);
  const [pingResult,  setPingResult]  = useState<{ success: boolean; output: string; rttMs?: number } | null>(null);

  // Peer management — edit / delete
  const [editingPeer,    setEditingPeer]    = useState<string | null>(null); // publicKey being edited
  const [editPeerIp,     setEditPeerIp]     = useState("");
  const [savingPeer,     setSavingPeer]     = useState(false);
  const [deletingPeer,   setDeletingPeer]   = useState<string | null>(null);

  useEffect(() => { void loadServerStatus(); }, []);

  const loadServerStatus = async () => {
    setServerLoading(true);
    try {
      const res = await apiRequest<{ data: VpnServerStatus }>("/platform/hardware/vpn/status", { auth: "platform" });
      const data = (res as any)?.data ?? res;
      setServerStatus(data);
      if (!assignedVpnIp) setAssignedVpnIp(data.nextAvailableIp || "");
    } catch (e: any) {
      toast.error(e?.message || "Failed to load server VPN status.");
    } finally { setServerLoading(false); }
  };

  const handleAddPeer = async () => {
    if (!tabletPublicKey.trim()) { toast.error("Paste the tablet public key first"); return; }
    if (!assignedVpnIp.trim())   { toast.error("Enter the VPN IP to assign"); return; }
    setAddingPeer(true);
    try {
      await apiRequest("/platform/hardware/vpn/peers", {
        method: "POST",
        auth: "platform",
        body: JSON.stringify({
          publicKey: tabletPublicKey.trim(),
          vpnIp: assignedVpnIp.trim(),
          comment: peerComment || `Tablet ${assignedVpnIp.trim()}`,
        }),
      });
      setAddedVpnIp(assignedVpnIp.trim());
      setPeerAdded(true);
      toast.success(`Peer added — tablet VPN IP is ${assignedVpnIp}`);
      void loadServerStatus();
    } catch (e: any) {
      toast.error(e?.message || "Failed to add peer");
    } finally { setAddingPeer(false); }
  };

  const handlePingVpn = async () => {
    const t = pingTarget.trim();
    if (!t) { toast.error("Enter an IP address to ping"); return; }
    setPinging2(true); setPingResult(null);
    try {
      const res = await apiRequest<{ data: { success: boolean; output: string; rttMs?: number } }>(
        "/platform/hardware/vpn/ping",
        { method: "POST", auth: "platform", body: JSON.stringify({ target: t, count: 4 }) }
      );
      const data = (res as any)?.data ?? res;
      setPingResult(data);
      if (data.success) toast.success(`Ping ${t} — ${data.rttMs != null ? `avg ${data.rttMs}ms` : "reachable"}`);
      else toast.error(`Ping ${t} — no response`);
    } catch (e: any) {
      setPingResult({ success: false, output: e?.message || "Request failed" });
      toast.error(e?.message || "Ping request failed");
    } finally { setPinging2(false); }
  };

  const handleDeletePeer = async (publicKey: string, vpnIp: string) => {
    if (!confirm(`Remove peer ${vpnIp} from WireGuard?\n\nThe tablet will lose VPN access immediately.`)) return;
    setDeletingPeer(publicKey);
    try {
      await apiRequest(`/platform/hardware/vpn/peers/${encodeURIComponent(publicKey)}`, {
        method: "DELETE", auth: "platform",
      });
      toast.success(`Peer ${vpnIp} removed from VPN`);
      void loadServerStatus();
    } catch (e: any) {
      toast.error(e?.message || "Failed to remove peer");
    } finally { setDeletingPeer(null); }
  };

  const handleUpdatePeer = async (publicKey: string) => {
    if (!editPeerIp.trim()) { toast.error("Enter a valid VPN IP"); return; }
    setSavingPeer(true);
    try {
      await apiRequest(`/platform/hardware/vpn/peers/${encodeURIComponent(publicKey)}`, {
        method: "PATCH", auth: "platform",
        body: JSON.stringify({ vpnIp: editPeerIp.trim() }),
      });
      toast.success(`Peer updated — new IP: ${editPeerIp}`);
      setEditingPeer(null);
      void loadServerStatus();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update peer");
    } finally { setSavingPeer(false); }
  };

  return (
    <div className="space-y-5">

      {/* ── Flow guide ── */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-semibold mb-2">How to connect a new tablet — no SSH needed</p>
        <ol className="list-decimal ml-4 space-y-1 text-xs text-blue-700">
          <li><strong>Tablet wizard Step 2 (Keys):</strong> Generate keys on tablet → <em>copy the tablet public key</em></li>
          <li><strong>Here below (Step 2):</strong> Paste tablet public key → click <em>Add Peer to VPN</em></li>
          <li><strong>Here below (Step 1):</strong> Copy server public key + assigned VPN IP</li>
          <li><strong>Tablet wizard Step 3 (Configure):</strong> Paste server public key + VPN IP</li>
          <li><strong>Tablet wizard Step 4 (Activate):</strong> Tunnel goes live → ping test green</li>
          <li><strong>Tablets tab:</strong> Register tablet using the VPN IP (e.g. 10.0.0.3) and port 5000</li>
        </ol>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">

        {/* ════════ SERVER INFO (copy to tablet) ════════ */}
        <section className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-100 shrink-0">
                <ShieldCheck className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <h2 className="font-semibold text-sm">Step 1 — Server Info</h2>
                <p className="text-xs text-muted-foreground">Copy these into the tablet wizard (Step 3)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                serverStatus?.interfaceUp ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
              )}>
                {serverStatus?.interfaceUp
                  ? <><Wifi className="h-3 w-3" /> VPN Active</>
                  : <><WifiOff className="h-3 w-3" /> VPN Down</>}
              </span>
              <button
                onClick={() => void loadServerStatus()}
                disabled={serverLoading}
                className="p-1.5 rounded-md border border-border hover:bg-muted text-muted-foreground disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", serverLoading && "animate-spin")} />
              </button>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <KeyBox
              label="Server Public Key — paste this into tablet wizard Step 3"
              value={serverStatus?.serverPublicKey || ""}
              placeholder={
                serverLoading ? "Loading…"
                : serverStatus ? "Not found — run: wg show wg0 public-key on server"
                : "Click refresh ← to load"
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <KeyBox label="Server Endpoint" value={serverStatus?.serverEndpoint || ""} />
              <KeyBox label="Next Available VPN IP" value={serverStatus?.nextAvailableIp || ""} />
            </div>
            {serverStatus?.vpnSubnet && (
              <div className="rounded-lg border border-muted bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Subnet: <span className="font-mono font-semibold text-foreground">{serverStatus.vpnSubnet}</span>
                {" · "}Server: <span className="font-mono font-semibold text-foreground">{serverStatus.serverVpnIp}</span>
                {" · "}Peers: <span className="font-semibold text-foreground">{serverStatus.peerCount}</span>
              </div>
            )}
            {serverStatus && serverStatus.peers.length > 0 && (
              <div className="border-t border-border pt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {serverStatus.peers.length} Registered Peer{serverStatus.peers.length !== 1 ? "s" : ""}
                </p>
                {serverStatus.peers.map((p, i) => {
                  const peerIp = p.allowedIps.split("/")[0];
                  const isEditing = editingPeer === p.publicKey;
                  const isDeleting = deletingPeer === p.publicKey;
                  const isConnected = p.latestHandshake !== "never";
                  return (
                    <div key={i} className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs space-y-1.5">
                      {isEditing ? (
                        /* ── Edit IP inline ── */
                        <div className="space-y-2">
                          <p className="font-semibold text-foreground">Edit peer IP</p>
                          <div className="flex gap-2">
                            <input
                              value={editPeerIp}
                              onChange={e => setEditPeerIp(e.target.value)}
                              placeholder="10.0.0.x"
                              className="flex-1 rounded border border-border bg-background px-2 py-1 font-mono text-xs"
                              onKeyDown={e => e.key === "Enter" && void handleUpdatePeer(p.publicKey)}
                            />
                            <button onClick={() => void handleUpdatePeer(p.publicKey)} disabled={savingPeer}
                              className="rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                              {savingPeer ? "…" : "Save"}
                            </button>
                            <button onClick={() => setEditingPeer(null)}
                              className="rounded border border-border px-2 py-1 text-xs hover:bg-muted">
                              Cancel
                            </button>
                          </div>
                          <div className="font-mono text-muted-foreground truncate">{p.publicKey}</div>
                        </div>
                      ) : (
                        /* ── Normal row ── */
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-semibold">{p.allowedIps}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={cn(
                                "rounded-full px-2 py-0.5 font-semibold",
                                isConnected ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                              )}>
                                {isConnected ? "Connected" : "No handshake yet"}
                              </span>
                              <button
                                onClick={() => { setEditingPeer(p.publicKey); setEditPeerIp(peerIp); }}
                                title="Change VPN IP"
                                className="p-1 rounded hover:bg-amber-100 hover:text-amber-700 text-muted-foreground border border-border">
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => void handleDeletePeer(p.publicKey, peerIp)}
                                disabled={isDeleting}
                                title="Remove this peer from VPN"
                                className="p-1 rounded hover:bg-rose-100 hover:text-rose-700 text-muted-foreground border border-border disabled:opacity-40">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          <div className="text-muted-foreground font-mono truncate">{p.publicKey.slice(0, 28)}…</div>
                          {p.endpoint && <div className="text-muted-foreground">Endpoint: {p.endpoint}</div>}
                          <div className="text-muted-foreground">Last handshake: {p.latestHandshake}</div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Ping from server ── */}
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ping from Server — test VPN reachability
              </p>
              <p className="text-xs text-muted-foreground">
                Sends ICMP ping from the server to any VPN IP — exactly like running{" "}
                <code className="font-mono text-xs bg-muted px-1 rounded">ping -c 4 10.0.0.3</code> in the server terminal.
              </p>
              <div className="flex gap-2">
                <input
                  value={pingTarget}
                  onChange={e => { setPingTarget(e.target.value); setPingResult(null); }}
                  placeholder="10.0.0.3 (tablet VPN IP)"
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
                  onKeyDown={e => e.key === "Enter" && void handlePingVpn()}
                />
                <button
                  onClick={() => void handlePingVpn()}
                  disabled={pinging2 || !pingTarget.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold hover:bg-primary/90 disabled:opacity-50"
                >
                  {pinging2
                    ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Pinging…</>
                    : <><Activity className="h-3.5 w-3.5" /> Ping</>}
                </button>
              </div>
              {/* Auto-fill from peer list */}
              {serverStatus && serverStatus.peers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {serverStatus.peers.map((p, i) => {
                    const ip = p.allowedIps.split("/")[0];
                    return (
                      <button key={i} onClick={() => { setPingTarget(ip); setPingResult(null); }}
                        className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-mono hover:border-primary hover:text-primary transition">
                        {ip}
                      </button>
                    );
                  })}
                  <span className="self-center text-xs text-muted-foreground">← click to ping</span>
                </div>
              )}
              {pingResult && (
                <div className={cn(
                  "rounded-xl border p-4 space-y-2",
                  pingResult.success
                    ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800"
                    : "border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800"
                )}>
                  <div className={cn("flex items-center gap-2 font-semibold text-sm",
                    pingResult.success ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                  )}>
                    {pingResult.success
                      ? <><CheckCircle2 className="h-4 w-4" /> {pingTarget} is reachable via VPN{pingResult.rttMs != null ? ` — avg ${pingResult.rttMs}ms` : ""}</>
                      : <><WifiOff className="h-4 w-4" /> {pingTarget} did not respond — VPN tunnel may not be active</>}
                  </div>
                  <pre className="rounded-lg bg-black/10 dark:bg-white/5 p-3 text-xs font-mono text-foreground/80 overflow-x-auto whitespace-pre-wrap max-h-40">
                    {pingResult.output}
                  </pre>
                  {!pingResult.success && (
                    <ul className="list-disc pl-4 text-xs space-y-0.5 text-muted-foreground">
                      <li>Make sure the tablet has activated its WireGuard tunnel (wizard Step 4)</li>
                      <li>Make sure the server added this tablet as a peer (Step 2 above)</li>
                      <li>Check server firewall: <code className="font-mono">ufw allow 51820/udp</code></li>
                      <li>Check WireGuard status: <code className="font-mono">wg show</code></li>
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ════════ REGISTER TABLET (paste public key here) ════════ */}
        <section className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-amber-100 shrink-0">
              <Key className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Step 2 — Register Tablet on VPN</h2>
              <p className="text-xs text-muted-foreground">Paste the tablet public key from the wizard</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <p className="font-semibold mb-1">From tablet wizard Step 2 (Keys):</p>
              <p>Copy the public key shown on the tablet (e.g. <span className="font-mono">gbHhDpRr…=</span>) and paste it below.</p>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold">
                Tablet Public Key <span className="text-muted-foreground font-normal">(from tablet wizard)</span>
              </span>
              <div className="flex gap-2">
                <input
                  value={tabletPublicKey}
                  onChange={e => { setTabletPublicKey(e.target.value); setPeerAdded(false); }}
                  placeholder="Paste tablet public key here…"
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
                />
                {tabletPublicKey && (
                  <button onClick={() => { setTabletPublicKey(""); setPeerAdded(false); }}
                    className="p-2 rounded-md border border-border hover:bg-muted text-muted-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">Assign VPN IP</span>
                <input
                  value={assignedVpnIp}
                  onChange={e => { setAssignedVpnIp(e.target.value); setPeerAdded(false); }}
                  placeholder="10.0.0.3"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">Label (optional)</span>
                <input
                  value={peerComment}
                  onChange={e => setPeerComment(e.target.value)}
                  placeholder="e.g. Green Hills Tablet 1"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
                />
              </label>
            </div>

            <button
              onClick={() => void handleAddPeer()}
              disabled={addingPeer || !tabletPublicKey.trim() || !assignedVpnIp.trim()}
              className={cn(
                "w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50",
                peerAdded
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {addingPeer
                ? <><RefreshCw className="h-4 w-4 animate-spin" /> Adding peer…</>
                : peerAdded
                ? <><CheckCircle2 className="h-4 w-4" /> Peer Added</>
                : <><Key className="h-4 w-4" /> Add Peer to VPN</>}
            </button>

            {/* Success — show exactly what to copy into tablet wizard Step 3 */}
            {peerAdded && (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-emerald-800">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <p className="font-semibold text-sm">Tablet registered! Now configure the tablet.</p>
                </div>
                <p className="text-xs text-emerald-700">
                  Go to <strong>tablet wizard Step 3 (Configure)</strong> and enter these values:
                </p>
                <div className="space-y-2">
                  <div className="rounded-lg border border-emerald-200 bg-white p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-900">Server Public Key</span>
                      {serverStatus?.serverPublicKey && <CopyButton value={serverStatus.serverPublicKey} label="Copy" />}
                    </div>
                    <div className="font-mono text-xs break-all text-emerald-800">
                      {serverStatus?.serverPublicKey || "— click refresh on Step 1 panel —"}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-emerald-200 bg-white p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-emerald-900">Server Endpoint</span>
                        {serverStatus?.serverEndpoint && <CopyButton value={serverStatus.serverEndpoint} label="Copy" />}
                      </div>
                      <div className="font-mono text-xs text-emerald-800">{serverStatus?.serverEndpoint || "—"}</div>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-white p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-emerald-900">Your VPN IP</span>
                        <CopyButton value={addedVpnIp} label="Copy" />
                      </div>
                      <div className="font-mono text-xs font-bold text-emerald-800">{addedVpnIp}</div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-emerald-700 border-t border-emerald-200 pt-2">
                  After Step 4 (Activate) succeeds, register this tablet in the <strong>Tablets tab</strong> with IP <strong className="font-mono">{addedVpnIp}</strong> port <strong>5000</strong>.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}


// ── Device Location Assignment Tab ───────────────────────────────────────────

function DeviceLocationsTab({
  devices,
  schools,
  onRefresh,
}: {
  devices: PlatformDevice[];
  schools: SchoolRecord[];
  onRefresh: () => void;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    location_scope: string;
    dormitory_id: string;
    location_label: string;
  }>({ location_scope: "gate", dormitory_id: "", location_label: "" });
  const [dormitories, setDormitories] = useState<{ id: string; name: string; block_name?: string | null }[]>([]);
  const [saving, setSaving] = useState(false);

  const loadDormitories = async (schoolId: string) => {
    try {
      const res = await apiRequest<{ data: { id: string; name: string; block_name?: string | null }[] }>(
        `/boarding/dormitories?limit=200`,
        { auth: "school" }
      );
      setDormitories(res.data ?? []);
    } catch { setDormitories([]); }
  };

  const startEdit = (d: PlatformDevice) => {
    setEditId(d.id);
    setForm({
      location_scope: (d as any).location_scope ?? "gate",
      dormitory_id: (d as any).dormitory_id ?? "",
      location_label: (d as any).location_label ?? "",
    });
    if (d.school?.id) void loadDormitories(d.school.id);
  };

  const handleSave = async () => {
    if (!editId) return;
    setSaving(true);
    try {
      await apiRequest(`/devices/${editId}/assign-location`, {
        method: "PATCH",
        body: JSON.stringify({
          location_scope: form.location_scope,
          dormitory_id: form.dormitory_id || null,
          location_label: form.location_label || null,
        }),
        auth: "school",
      });
      toast.success("Device location updated");
      setEditId(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update device location");
    } finally {
      setSaving(false);
    }
  };

  const SCOPES = [
    { value: "gate", label: "Gate (entry/exit)" },
    { value: "dormitory", label: "Dormitory" },
    { value: "dining_hall", label: "Dining Hall" },
    { value: "classroom", label: "Classroom" },
    { value: "library", label: "Library" },
    { value: "other", label: "Other" },
  ];

  const scopeColor = (s?: string) => {
    if (s === "dormitory") return "bg-blue-100 text-blue-700";
    if (s === "dining_hall") return "bg-amber-100 text-amber-700";
    if (s === "gate") return "bg-emerald-100 text-emerald-700";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-1">
          <Cpu className="h-4 w-4 text-primary" />
          <h2 className="font-display font-bold">Device Location Assignment</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Assign each device to a specific location (gate, dormitory, dining hall). Dormitory-assigned devices
          enable boarding attendance to be automatically linked to the correct block/hostel.
        </p>
      </div>

      {devices.length === 0 ? (
        <EmptyState message="No devices registered yet. Register devices in the Devices tab." />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="divide-y divide-border">
            {devices.map((d) => (
              <div key={d.id} className="px-5 py-4">
                {editId === d.id ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">{d.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">{d.device_uid}</span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <SaSelect
                        label="Location Type"
                        value={form.location_scope}
                        onChange={(e) => setForm({ ...form, location_scope: e.target.value })}
                      >
                        {SCOPES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </SaSelect>
                      <SaSelect
                        label="Dormitory (if applicable)"
                        value={form.dormitory_id}
                        onChange={(e) => setForm({ ...form, dormitory_id: e.target.value })}
                      >
                        <option value="">— no specific dormitory —</option>
                        {dormitories.map((dorm) => (
                          <option key={dorm.id} value={dorm.id}>
                            {dorm.name}{dorm.block_name ? ` (${dorm.block_name})` : ""}
                          </option>
                        ))}
                      </SaSelect>
                      <SaInput
                        label="Location Label"
                        value={form.location_label}
                        onChange={(e) => setForm({ ...form, location_label: e.target.value })}
                        placeholder="e.g. Boys Block A — Main Door"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        <Save className="h-3.5 w-3.5" />
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={() => setEditId(null)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                      >
                        <X className="h-3.5 w-3.5" /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-muted shrink-0">
                      <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{d.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{d.device_uid}</span>
                        {d.school && (
                          <span className="text-xs bg-muted rounded px-1.5 py-0.5">{d.school.name}</span>
                        )}
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold capitalize", scopeColor((d as any).location_scope))}>
                          {(d as any).location_scope ?? "unassigned"}
                        </span>
                      </div>
                      {(d as any).location_label && (
                        <div className="text-xs text-muted-foreground mt-0.5">{(d as any).location_label}</div>
                      )}
                    </div>
                    <button
                      onClick={() => startEdit(d)}
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Assign
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
