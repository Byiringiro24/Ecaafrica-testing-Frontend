import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, X, RefreshCw, Eye } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { CLASSES, SMS_LOGS, type SMSLog } from "@/lib/mockData";

export const Route = createFileRoute("/notifications")({ component: NotificationsPage });

function NotificationsPage() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [cls, setCls] = useState("All");
  const [trig, setTrig] = useState("All");
  const [stat, setStat] = useState("All");
  const [q, setQ] = useState("");
  const [view, setView] = useState<SMSLog | null>(null);
  const [logs, setLogs] = useState(SMS_LOGS);

  const filtered = useMemo(() => logs.filter(l =>
    (cls === "All" || l.class === cls) &&
    (trig === "All" || l.trigger === trig.toLowerCase()) &&
    (stat === "All" || l.status === stat.toLowerCase()) &&
    (q === "" || l.studentName.toLowerCase().includes(q.toLowerCase()) || l.parentName.toLowerCase().includes(q.toLowerCase()))
  ), [logs, cls, trig, stat, q]);

  const sentToday = logs.filter(l => l.status === "sent").length;
  const failed = logs.filter(l => l.status === "failed").length;
  const monthly = logs.length * 22;
  const rate = Math.round((sentToday / Math.max(1, logs.length)) * 100);

  const retry = (id?: string) => {
    if (id) {
      setLogs(p => p.map(l => l.id === id ? { ...l, status: "sent" } : l));
      toast.success("SMS re-sent");
    } else {
      setLogs(p => p.map(l => l.status === "failed" ? { ...l, status: "sent" } : l));
      toast.success("All failed SMS retried");
    }
  };

  const mask = (phone: string) => phone.replace(/(\d{3})\s\d{3}\s(\d{3})/, "$1 ••• $2");

  return (
    <AppLayout title="SMS Notification Logs" subtitle="Track every parent notification">
      {failed > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 mb-5 flex items-center justify-between">
          <span className="text-amber-900 text-sm font-semibold">⚠️ {failed} SMS failed to deliver</span>
          <button onClick={() => retry()} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-700">
            <RefreshCw className="h-3 w-3" /> Retry All Failed
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KPI label="SMS Sent Today" value={sentToday} tone="success" />
        <KPI label="SMS This Month" value={monthly} />
        <KPI label="Delivery Rate" value={`${rate}%`} tone="success" />
        <KPI label="Failed" value={failed} tone="destructive" />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-2 items-center">
        <input type="date" value={start} onChange={e => setStart(e.target.value)} className={inp} />
        <input type="date" value={end} onChange={e => setEnd(e.target.value)} className={inp} />
        <select value={cls} onChange={e => setCls(e.target.value)} className={inp}><option>All</option>{CLASSES.map(c => <option key={c}>{c}</option>)}</select>
        <select value={trig} onChange={e => setTrig(e.target.value)} className={inp}><option>All</option><option>Present</option><option>Absent</option><option>Late</option></select>
        <select value={stat} onChange={e => setStat(e.target.value)} className={inp}><option>All</option><option>Sent</option><option>Failed</option><option>Pending</option></select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search student or parent…"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" />
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>{["#","Time","Student","Class","Parent","Phone","Trigger","Message","Status","Action"].map(h =>
                <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.slice(0, 30).map((l, i) => (
                <tr key={l.id} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/30">
                  <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">{l.timestamp.slice(11)}</td>
                  <td className="px-4 py-3 font-medium">{l.studentName}</td>
                  <td className="px-4 py-3">{l.class}</td>
                  <td className="px-4 py-3">{l.parentName}</td>
                  <td className="px-4 py-3 font-mono text-xs">{mask(l.phone)}</td>
                  <td className="px-4 py-3"><TriggerBadge trigger={l.trigger} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">{l.message}</td>
                  <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                  <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                    {l.status === "failed" && <button onClick={() => retry(l.id)} className="text-xs font-semibold text-primary hover:underline">Retry</button>}
                    <button onClick={() => setView(l)} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:underline">
                      <Eye className="h-3 w-3" /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-dashed border-border bg-card p-5 text-sm">
        Configure SMS templates and provider in <Link to="/settings" className="text-primary font-semibold hover:underline">Settings →</Link>
      </div>

      {view && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setView(null)}>
          <div className="bg-card rounded-2xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b border-border">
              <h3 className="font-display font-bold">SMS Detail</h3>
              <button onClick={() => setView(null)} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="px-6 py-5 space-y-3 text-sm">
              <Row k="To" v={view.parentName} />
              <Row k="Phone" v={view.phone} />
              <Row k="Student" v={`${view.studentName} (${view.class})`} />
              <Row k="Trigger" v={view.trigger} />
              <Row k="Sent" v={view.timestamp} />
              <Row k="Status" v={view.status} />
              <div>
                <div className="text-xs text-muted-foreground mb-1">Message</div>
                <div className="rounded-lg bg-muted/40 p-3">{view.message}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="font-semibold">{v}</span></div>;
}

function TriggerBadge({ trigger }: { trigger: SMSLog["trigger"] }) {
  const map = {
    present: "bg-success/15 text-success",
    absent: "bg-destructive/15 text-destructive",
    late: "bg-amber-100 text-amber-700",
  };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold capitalize ${map[trigger]}`}>{trigger}</span>;
}
function StatusBadge({ status }: { status: SMSLog["status"] }) {
  const map = {
    sent: ["bg-success/15 text-success", "✓ Sent"],
    failed: ["bg-destructive/15 text-destructive", "✗ Failed"],
    pending: ["bg-amber-100 text-amber-700", "⏳ Pending"],
  } as const;
  const [cls, label] = map[status];
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${cls}`}>{label}</span>;
}
function KPI({ label, value, tone = "primary" as const }: { label: string; value: string | number; tone?: "primary"|"success"|"destructive" }) {
  const colors = { primary: "text-primary", success: "text-success", destructive: "text-destructive" };
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="text-xs uppercase font-semibold text-muted-foreground">{label}</div>
      <div className={`font-display text-3xl font-bold mt-2 ${colors[tone]}`}>{value}</div>
    </div>
  );
}

const inp = "h-10 rounded-lg border border-border bg-background px-3 text-sm";
