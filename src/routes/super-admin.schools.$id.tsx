import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { SuperAdminBreadcrumbs } from "@/components/layout/SuperAdminBreadcrumbs";
import { PageTabs, ConfirmDialog } from "@/components/super-admin/ui";
import {
  schoolById,
  planBadgeClass,
  statusBadgeClass,
  SCHOOL_MODULES,
} from "@/lib/superAdminMockData";
import { SUBSCRIPTION_INVOICES, formatRWF } from "@/lib/mockData";

export const Route = createFileRoute("/super-admin/schools/$id")({ component: SchoolDetailPage });

const ATTENDANCE_SPARK = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  rate: 82 + Math.sin(i / 4) * 8 + (i % 5),
}));

const SCHOOL_USERS = [
  { name: "Niyonzima Jean", role: "School Admin", email: "admin@school.rw", lastLogin: "2026-05-15", status: "Active" },
  { name: "Uwase Diane", role: "Teacher", email: "diane@school.rw", lastLogin: "2026-05-14", status: "Active" },
  { name: "Habimana Eric", role: "Accountant", email: "eric@school.rw", lastLogin: "2026-05-10", status: "Locked" },
];

const SCHOOL_AUDIT = [
  { at: "2026-05-15 09:00", user: "Karera Thierry", action: "Enabled Biometrics module" },
  { at: "2026-05-10 14:22", user: "Ingabire Beatrice", action: "Invoice INV-2026-0089 marked paid" },
  { at: "2026-05-01 08:15", user: "Karera Thierry", action: "Subscription renewed — Professional" },
];

function SchoolDetailPage() {
  const { id } = Route.useParams();
  const school = schoolById(id);
  const [tab, setTab] = useState("Overview");
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [moduleState, setModuleState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SCHOOL_MODULES.map(m => [m.key, m.locked || false])),
  );

  if (!school) {
    return (
      <SuperAdminLayout title="School not found">
        <p className="text-muted-foreground">No school with ID {id}.</p>
        <Link to="/super-admin/schools" className="text-primary text-sm font-semibold mt-2 inline-block">← Back to Schools</Link>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout
      title={school.name}
      subtitle={school.location}
      breadcrumbs={
        <SuperAdminBreadcrumbs
          items={[
            { label: "Super Admin", to: "/super-admin" },
            { label: "Schools", to: "/super-admin/schools" },
            { label: school.name },
          ]}
        />
      }
    >
      <div className="rounded-xl border border-border bg-card p-5 mb-5 shadow-sm">
        <div className="flex flex-wrap gap-4 items-start justify-between">
          <div className="flex gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-xl bg-amber-100 text-amber-800 font-bold text-lg">
              {school.name.split(" ").map(p => p[0]).join("").slice(0, 2)}
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">{school.name}</h2>
              <p className="text-sm text-muted-foreground">{school.location}</p>
              <div className="flex gap-2 mt-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${planBadgeClass(school.plan)}`}>{school.plan}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${statusBadgeClass(school.status)}`}>{school.status}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">Edit</button>
            <button type="button" onClick={() => setSuspendOpen(true)} className="rounded-lg border border-destructive/40 text-destructive px-3 py-1.5 text-xs font-semibold">Suspend</button>
            <button type="button" className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">Export</button>
          </div>
        </div>
      </div>

      <PageTabs tabs={["Overview", "Modules", "Billing", "Users", "Audit Log"]} active={tab} onChange={setTab} />

      {tab === "Overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold mb-3">School Information</h3>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {[
                ["Address", school.address ?? "—"],
                ["Principal", school.principal ?? "—"],
                ["Phone", school.phone ?? "—"],
                ["Email", school.email ?? "—"],
                ["RNE #", school.rne ?? "—"],
                ["Type", school.type],
              ].map(([k, v]) => (
                <div key={k}><dt className="text-muted-foreground text-xs">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
            </dl>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold mb-3">Usage Metrics</h3>
            <div className="grid grid-cols-2 gap-3 text-center">
              {[
                ["Students", school.students],
                ["Staff", school.staff],
                ["Classes", Math.ceil(school.students / 35)],
                ["SMS (month)", school.smsUsed],
              ].map(([l, v]) => (
                <div key={l as string} className="rounded-lg bg-muted/30 p-3">
                  <div className="text-2xl font-bold">{v}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">{l}</div>
                </div>
              ))}
            </div>
            <p className="text-xs font-semibold mt-4 mb-2">Attendance (30 days)</p>
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={ATTENDANCE_SPARK}>
                <Tooltip />
                <Line type="monotone" dataKey="rate" stroke="#3b5998" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold mb-2">Feature flags enabled</h3>
            <div className="flex flex-wrap gap-2">
              {school.modules.length ? school.modules.map(m => (
                <span key={m} className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-semibold capitalize">{m}</span>
              )) : <span className="text-sm text-muted-foreground">Core only</span>}
            </div>
          </div>
        </div>
      )}

      {tab === "Modules" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SCHOOL_MODULES.map(m => (
              <div key={m.key} className="rounded-xl border border-border bg-card p-4 flex justify-between items-center">
                <div>
                  <div className="font-semibold text-sm">{m.label}</div>
                  <div className="text-xs text-muted-foreground">{m.description}</div>
                </div>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={moduleState[m.key]}
                    disabled={m.locked}
                    onChange={e => setModuleState(s => ({ ...s, [m.key]: e.target.checked }))}
                  />
                  <span className="text-xs font-medium">{moduleState[m.key] ? "On" : "Off"}</span>
                </label>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => toast.success("Module settings saved")} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">
            Save changes
          </button>
        </div>
      )}

      {tab === "Billing" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold mb-2">Current Subscription</h3>
            <p className="text-sm">{school.plan} · Renews {school.renewal} · MRR {formatRWF(school.mrrRwf)}</p>
            <div className="flex gap-2 mt-3">
              <button type="button" className="text-xs font-semibold text-primary hover:underline">Create manual invoice</button>
              <button type="button" className="text-xs font-semibold text-primary hover:underline">Override renewal</button>
              <button type="button" className="text-xs font-semibold text-primary hover:underline">Apply discount</button>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase"><tr>{["Invoice", "Period", "Amount", "Status"].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
              <tbody>
                {SUBSCRIPTION_INVOICES.slice(0, 5).map(inv => (
                  <tr key={inv.id} className="border-t border-border">
                    <td className="px-4 py-3 font-mono text-xs">{inv.id}</td>
                    <td className="px-4 py-3">{inv.period}</td>
                    <td className="px-4 py-3">{formatRWF(inv.amount)}</td>
                    <td className="px-4 py-3 capitalize">{inv.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "Users" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase"><tr>{["Name", "Role", "Email", "Last Login", "Status", ""].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
            <tbody>
              {SCHOOL_USERS.map(u => (
                <tr key={u.email} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3">{u.role}</td>
                  <td className="px-4 py-3 text-xs">{u.email}</td>
                  <td className="px-4 py-3 text-xs">{u.lastLogin}</td>
                  <td className="px-4 py-3">{u.status}</td>
                  <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                    <button type="button" onClick={() => toast.info("Password reset email sent")} className="text-xs text-primary font-semibold hover:underline">Reset Password</button>
                    <button type="button" className="text-xs text-destructive font-semibold hover:underline">Deactivate</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Audit Log" && (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {SCHOOL_AUDIT.map((e, i) => (
            <div key={i} className="px-5 py-3 text-sm flex justify-between gap-4">
              <div>
                <div className="font-medium">{e.action}</div>
                <div className="text-xs text-muted-foreground">{e.user}</div>
              </div>
              <div className="text-xs text-muted-foreground shrink-0">{e.at}</div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={suspendOpen}
        onClose={() => setSuspendOpen(false)}
        onConfirm={() => toast.success(`${school.name} suspended`)}
        title="Suspend school?"
        description="School admins will lose access until reactivated."
        confirmLabel="Suspend"
        destructive
      />
    </SuperAdminLayout>
  );
}
