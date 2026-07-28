import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Search } from "lucide-react";
import { FinanceLayout, StatusPill } from "@/components/layout/FinanceLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listFinanceAuditLogs, listFinanceAuditModules,
  type FinanceAuditEntry, type FinanceAuditMeta,
} from "@/lib/financeApi";

export const Route = createFileRoute("/finance/audit")({ component: AuditPage });

const RULES = [
  "No financial record is ever permanently deleted.",
  "Approved transactions cannot be edited directly.",
  "Any modification requires an audit trail.",
  "All approvals are logged.",
  "All receipts and invoices remain traceable.",
];

const TABLE_HEADERS = ["Action", "Module", "Entity", "By", "Role", "Timestamp"] as const;

const formatTimestamp = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });
};

function AuditPage() {
  const [entries, setEntries] = useState<FinanceAuditEntry[]>([]);
  const [meta, setMeta] = useState<FinanceAuditMeta | null>(null);
  const [modules, setModules] = useState<string[]>([]);
  const [moduleFilter, setModuleFilter] = useState("All");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listFinanceAuditLogs({
        limit: 100,
        q: q || undefined,
        module: moduleFilter === "All" ? undefined : moduleFilter,
      });
      setEntries(res.data);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load audit trail");
    } finally {
      setLoading(false);
    }
  }, [q, moduleFilter]);

  useEffect(() => {
    listFinanceAuditModules().then(setModules).catch(() => setModules([]));
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  return (
    <FinanceLayout title="Audit &amp; Security" subtitle="Every financial action is traceable (RBAC + Audit Logs)">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <StatCard compact label="Logged Actions" value={meta?.total ?? 0} icon={<ShieldCheck className="h-4 w-4" />} />
        <StatCard compact label="Modules Tracked" value={meta?.modules_tracked ?? 0} />
        <StatCard compact label="Showing" value={entries.length} tone="primary" />
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search action, entity or actor..." className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" />
        </div>
        <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option>All</option>{modules.map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border font-display font-bold">Audit Trail</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{TABLE_HEADERS.map((h) => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }, (_, i) => (
                    <tr key={i} className="border-t border-border">
                      <td colSpan={TABLE_HEADERS.length} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td>
                    </tr>
                  ))
                ) : error ? (
                  <tr><td colSpan={TABLE_HEADERS.length} className="px-4 py-10 text-center text-sm text-destructive">{error}</td></tr>
                ) : entries.length === 0 ? (
                  <tr><td colSpan={TABLE_HEADERS.length} className="px-4 py-10 text-center text-sm text-muted-foreground">No finance actions logged yet.</td></tr>
                ) : (
                  entries.map((a) => (
                    <tr key={a.id} className="border-t border-border odd:bg-background even:bg-muted/20">
                      <td className="px-4 py-3 font-medium capitalize">{a.action}</td>
                      <td className="px-4 py-3"><StatusPill label={a.module} tone="muted" /></td>
                      <td className="px-4 py-3 text-xs">{a.entity ?? "--"}</td>
                      <td className="px-4 py-3 text-xs">{a.performed_by ?? "--"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{a.role ?? "--"}</td>
                      <td className="px-4 py-3 font-mono text-[11px]">{formatTimestamp(a.timestamp)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-5">
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

          {meta?.by_module?.length ? (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="font-display font-bold mb-3">Actions by Module</div>
              <ul className="space-y-2">
                {meta.by_module.map((m) => (
                  <li key={`${m.module}-${m.resource_type}`} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{m.module}</span>
                    <span className="font-semibold">{m.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </FinanceLayout>
  );
}
