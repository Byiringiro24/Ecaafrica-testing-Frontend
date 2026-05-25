import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { SuperAdminBreadcrumbs } from "@/components/layout/SuperAdminBreadcrumbs";
import { SaModal, FilterBar, Pagination, JsonDiff } from "@/components/super-admin/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { AUDIT_LOGS } from "@/lib/superAdminMockData";

export const Route = createFileRoute("/super-admin/audit")({ component: AuditPage });

function AuditPage() {
  const [severity, setSeverity] = useState("All");
  const [action, setAction] = useState("All");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [detail, setDetail] = useState<(typeof AUDIT_LOGS)[0] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    let r = [...AUDIT_LOGS];
    if (severity !== "All") r = r.filter(l => l.severity === severity.toLowerCase());
    if (action !== "All") r = r.filter(l => l.action === action);
    return r;
  }, [severity, action]);

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <SuperAdminLayout
      title="Audit Logs"
      breadcrumbs={<SuperAdminBreadcrumbs items={[{ label: "Super Admin", to: "/super-admin" }, { label: "Audit Logs" }]} />}
    >
      {loading ? (
        <AuditSkeleton />
      ) : (
        <>
          <div className="flex flex-wrap justify-between gap-3 mb-4">
            <FilterBar>
              <input type="date" className="h-10 rounded-lg border border-border px-3 text-sm" />
              <span className="text-muted-foreground text-xs">to</span>
              <input type="date" className="h-10 rounded-lg border border-border px-3 text-sm" />
              <select value={action} onChange={e => setAction(e.target.value)} className="h-10 rounded-lg border border-border px-3 text-sm">
                <option>All</option><option>created</option><option>updated</option><option>suspended</option><option>setting_changed</option>
              </select>
              <select value={severity} onChange={e => setSeverity(e.target.value)} className="h-10 rounded-lg border border-border px-3 text-sm">
                <option>All</option><option>info</option><option>warning</option><option>critical</option>
              </select>
            </FilterBar>
            <button type="button" onClick={() => toast.success("CSV exported")} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-semibold">
              <Download className="h-4 w-4" /> Export CSV
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>{["Timestamp", "User", "Role", "Action", "Resource", "School", "IP", "Severity"].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr>
              </thead>
              <tbody>
                {paginated.map(log => (
                  <tr
                    key={log.id}
                    onClick={() => setDetail(log)}
                    className={`border-t border-border cursor-pointer hover:bg-muted/30 ${log.severity === "critical" ? "bg-destructive/5" : log.severity === "warning" ? "bg-amber-50/50" : ""}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{log.timestamp}</td>
                    <td className="px-4 py-3">{log.user}</td>
                    <td className="px-4 py-3 text-xs">{log.role}</td>
                    <td className="px-4 py-3 capitalize">{log.action}</td>
                    <td className="px-4 py-3 text-xs">{log.resourceType}: {log.resourceName}</td>
                    <td className="px-4 py-3 text-xs">{log.school}</td>
                    <td className="px-4 py-3 font-mono text-xs">{log.ip}</td>
                    <td className="px-4 py-3 capitalize"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${log.severity === "critical" ? "bg-destructive/10 text-destructive" : log.severity === "warning" ? "bg-amber-100 text-amber-800" : "bg-muted"}`}>{log.severity}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination total={filtered.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={n => { setPageSize(n); setPage(1); }} />
          </div>
        </>
      )}

      {detail && (
        <SaModal open onClose={() => setDetail(null)} title="Audit Log Detail" wide>
          <dl className="grid grid-cols-2 gap-2 text-sm mb-4">
            <div><dt className="text-xs text-muted-foreground">Timestamp</dt><dd className="font-mono">{detail.timestamp}</dd></div>
            <div><dt className="text-xs text-muted-foreground">User</dt><dd>{detail.user} ({detail.role})</dd></div>
            <div><dt className="text-xs text-muted-foreground">Action</dt><dd className="capitalize">{detail.action} — {detail.resourceType}</dd></div>
            <div><dt className="text-xs text-muted-foreground">IP / UA</dt><dd className="font-mono text-xs">{detail.ip}</dd></div>
          </dl>
          <p className="text-sm">{detail.resourceName} @ {detail.school}</p>
          <JsonDiff before={detail.before} after={detail.after} />
        </SaModal>
      )}
    </SuperAdminLayout>
  );
}

function AuditSkeleton() {
  return (
    <>
      <div className="flex flex-wrap justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-4 w-6" />
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-28" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              {Array.from({ length: 8 }).map((_, i) => (
                <th key={i} className="text-left px-4 py-3"><Skeleton className="h-3 w-16" /></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="border-t border-border">
                {Array.from({ length: 8 }).map((__, j) => (
                  <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-border">
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    </>
  );
}
