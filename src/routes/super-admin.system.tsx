import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { SuperAdminBreadcrumbs } from "@/components/layout/SuperAdminBreadcrumbs";
import { PageTabs } from "@/components/super-admin/ui";
import { SMS_PROVIDERS, PLAN_OPTIONS } from "@/lib/mockData";
import { SMS_TEMPLATE_LIST } from "@/lib/mockData";

export const Route = createFileRoute("/super-admin/system")({ component: SystemPage });

const TABS = ["SMS Providers", "Notification Templates", "Feature Flags", "Maintenance", "Plans & Pricing", "Integrations"];

function SystemPage() {
  const [tab, setTab] = useState(TABS[0]);
  const [maintenance, setMaintenance] = useState(false);

  return (
    <SuperAdminLayout
      title="System Settings"
      subtitle="Platform-wide configuration"
      breadcrumbs={<SuperAdminBreadcrumbs items={[{ label: "Super Admin", to: "/super-admin" }, { label: "System Settings" }]} />}
    >
      <PageTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "SMS Providers" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Drag to reorder failover priority (mock UI).</p>
          {SMS_PROVIDERS.map((p, i) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-5 flex flex-wrap gap-4 items-center justify-between">
              <div>
                <div className="font-semibold">{p.name} {p.recommended && <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded ml-1">Default</span>}</div>
                <div className="text-xs text-muted-foreground">Priority #{i + 1} · Sender: {p.senderId}</div>
              </div>
              <div className="flex gap-2 items-center">
                <input type="password" value="••••••••••••" readOnly className="h-9 w-40 rounded-lg border border-border px-2 text-xs" />
                <button type="button" onClick={() => toast.success("Test SMS sent")} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Test</button>
                {!p.recommended && <button type="button" onClick={() => toast.success("Set as default")} className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold">Set Default</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "Notification Templates" && (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {SMS_TEMPLATE_LIST.slice(0, 8).map(t => (
            <div key={t.key} className="px-5 py-3 flex justify-between items-center">
              <div>
                <div className="font-medium text-sm">{t.label}</div>
                <div className="text-xs text-muted-foreground">{t.trigger} · EN / KIN</div>
              </div>
              <button type="button" onClick={() => toast.info("Edit template")} className="text-xs font-semibold text-primary hover:underline">Edit</button>
            </div>
          ))}
        </div>
      )}

      {tab === "Feature Flags" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            ["Boarding Module", "Global default for new schools"],
            ["Biometrics", "Global default for new schools"],
            ["Gate Management", "Global default"],
            ["Bulk SMS", "Platform-wide"],
            ["CSV Export", "Platform-wide"],
            ["Parent Mobile App", "Global"],
            ["Exam System", "Beta flag"],
            ["Salary Management", "Beta flag"],
            ["Visitor Management", "Global"],
          ].map(([name, note]) => (
            <label key={name} className="rounded-xl border border-border bg-card p-4 flex justify-between items-start gap-3 cursor-pointer">
              <div>
                <div className="font-semibold text-sm">{name}</div>
                <div className="text-xs text-muted-foreground">{note}</div>
              </div>
              <input type="checkbox" defaultChecked className="mt-1" />
            </label>
          ))}
        </div>
      )}

      {tab === "Maintenance" && (
        <div className="space-y-4">
          <div className={`rounded-xl border-2 p-6 ${maintenance ? "border-destructive bg-destructive/5" : "border-border bg-card"}`}>
            <div className="flex justify-between items-center">
              <div>
                <div className="font-display font-bold text-lg">Global Maintenance Mode</div>
                <p className="text-sm text-muted-foreground mt-1">School admins see maintenance screen; super admins can be exempt.</p>
              </div>
              <input type="checkbox" checked={maintenance} onChange={e => setMaintenance(e.target.checked)} className="h-5 w-5" />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold">Start</label><input type="datetime-local" className="h-10 w-full mt-1 rounded-lg border border-border px-3 text-sm" /></div>
            <div><label className="text-xs font-semibold">End</label><input type="datetime-local" className="h-10 w-full mt-1 rounded-lg border border-border px-3 text-sm" /></div>
            <div className="col-span-2"><label className="text-xs font-semibold">Message</label><textarea rows={3} className="w-full mt-1 rounded-lg border border-border p-3 text-sm" defaultValue="Scheduled maintenance. We'll be back shortly." /></div>
            <label className="flex items-center gap-2 text-sm col-span-2"><input type="checkbox" defaultChecked /> Exempt Super Admins</label>
          </div>
        </div>
      )}

      {tab === "Plans & Pricing" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase"><tr><th className="text-left px-4 py-3">Feature</th>{PLAN_OPTIONS.map(p => <th key={p.id} className="text-left px-4 py-3">{p.name}</th>)}</tr></thead>
            <tbody>
              <tr className="border-t border-border"><td className="px-4 py-3">Monthly (RWF)</td>{PLAN_OPTIONS.map(p => <td key={p.id} className="px-4 py-3"><input defaultValue={p.monthly} className="w-24 h-8 border rounded px-2 text-xs" /></td>)}</tr>
              <tr className="border-t border-border"><td className="px-4 py-3">Annual (RWF)</td>{PLAN_OPTIONS.map(p => <td key={p.id} className="px-4 py-3"><input defaultValue={p.annual} className="w-24 h-8 border rounded px-2 text-xs" /></td>)}</tr>
            </tbody>
          </table>
          <div className="p-4 border-t">
            <button type="button" onClick={() => toast.success("Pricing saved — affects new subscriptions")} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">Save Pricing</button>
          </div>
        </div>
      )}

      {tab === "Integrations" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            ["MTN Mobile Money", "configured"],
            ["Airtel Money", "not configured"],
            ["Pindo SMS", "configured"],
            ["Africa's Talking", "inactive"],
            ["SendGrid Email", "configured"],
            ["Internal Analytics", "active"],
          ].map(([name, status]) => (
            <div key={name} className="rounded-xl border border-border bg-card p-5">
              <div className="flex justify-between items-start">
                <div className="font-semibold">{name}</div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status.includes("configured") || status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-muted"}`}>{status}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Last tested: May 14, 2026</p>
              <button type="button" className="mt-3 text-xs font-semibold text-primary hover:underline">Configure</button>
            </div>
          ))}
        </div>
      )}
    </SuperAdminLayout>
  );
}
