import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Lock } from "lucide-react";
import { FinanceLayout, StatusPill } from "@/components/layout/FinanceLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { AUDIT_LOG } from "@/lib/financeData";

export const Route = createFileRoute("/finance/audit")({ component: AuditPage });

const RULES = [
  "No financial record is ever permanently deleted.",
  "Approved transactions cannot be edited directly.",
  "Any modification requires an audit trail.",
  "All approvals are logged.",
  "All receipts and invoices remain traceable.",
];

function AuditPage() {
  return (
    <FinanceLayout title="Audit &amp; Security" subtitle="Every financial action is traceable (RBAC + Audit Logs)">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard compact label="Logged Actions" value={AUDIT_LOG.length} icon={<ShieldCheck className="h-4 w-4" />} />
        <StatCard compact label="Locked Periods" value={3} tone="primary" icon={<Lock className="h-4 w-4" />} />
        <StatCard compact label="Modules Tracked" value={6} />
        <StatCard compact label="Integrity" value="100%" tone="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border font-display font-bold">Audit Trail</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{["Action", "Module", "Entity", "By", "Role", "Timestamp"].map((h) => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
              <tbody>
                {AUDIT_LOG.map((a) => (
                  <tr key={a.id} className="border-t border-border odd:bg-background even:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{a.action}</td>
                    <td className="px-4 py-3"><StatusPill label={a.module} tone="muted" /></td>
                    <td className="px-4 py-3 text-xs">{a.entity}</td>
                    <td className="px-4 py-3 text-xs">{a.performedBy}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{a.role}</td>
                    <td className="px-4 py-3 font-mono text-[11px]">{a.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 font-display font-bold mb-3"><ShieldCheck className="h-4 w-4 text-success" /> Security Rules</div>
          <ul className="space-y-3">
            {RULES.map((r) => (
              <li key={r} className="flex items-start gap-2 text-sm">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span className="text-muted-foreground">{r}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            Each transaction records: Created By · Updated By · Approved By · Date &amp; Time · User Role · Action.
          </div>
        </div>
      </div>
    </FinanceLayout>
  );
}
