import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { SuperAdminBreadcrumbs } from "@/components/layout/SuperAdminBreadcrumbs";

export const Route = createFileRoute("/super-admin/features")({ component: FeaturesPage });

const FLAGS = [
  { key: "boarding", name: "Boarding Module", desc: "Global on/off default for new schools", beta: false },
  { key: "biometrics", name: "Biometrics", desc: "Global default for new schools", beta: false },
  { key: "gate", name: "Gate Management", desc: "Global default", beta: false },
  { key: "bulk_sms", name: "Bulk SMS", desc: "Platform-wide bulk messaging", beta: false },
  { key: "csv_export", name: "CSV Export", desc: "Allow CSV exports platform-wide", beta: false },
  { key: "parent_app", name: "Parent Mobile App", desc: "Parent portal access", beta: false },
  { key: "exam", name: "Exam System", desc: "Results & grading module", beta: true },
  { key: "salary", name: "Salary Management", desc: "Staff payroll module", beta: true },
  { key: "visitor", name: "Visitor Management", desc: "Visitor check-in module", beta: false },
];

function FeaturesPage() {
  return (
    <SuperAdminLayout
      title="Feature Flags"
      subtitle="Global defaults — per-school overrides in school profile"
      breadcrumbs={
        <SuperAdminBreadcrumbs
          items={[
            { label: "Super Admin", to: "/super-admin" },
            { label: "System", to: "/super-admin/system" },
            { label: "Feature Flags" },
          ]}
        />
      }
    >
      <p className="text-sm text-muted-foreground mb-4">
        Also available under <Link to="/super-admin/system" className="text-primary font-semibold hover:underline">System Settings → Feature Flags</Link>.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {FLAGS.map(f => (
          <div key={f.key} className="rounded-xl border border-border bg-card p-5">
            <div className="flex justify-between items-start gap-3">
              <div>
                <div className="font-semibold flex items-center gap-2">
                  {f.name}
                  {f.beta && <span className="text-[9px] bg-violet-100 text-violet-800 px-1.5 py-0.5 rounded font-bold uppercase">Beta</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
                <p className="text-[10px] text-muted-foreground mt-2 italic">Applies to new schools by default</p>
              </div>
              <input type="checkbox" defaultChecked={f.key !== "exam"} onChange={() => toast.success(`${f.name} updated`)} />
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => toast.success("Feature flags saved")} className="mt-6 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">
        Save all flags
      </button>
    </SuperAdminLayout>
  );
}
