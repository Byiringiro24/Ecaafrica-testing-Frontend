import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, X, Eye, Loader2, Bell } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/notifications")({ component: NotificationsPage });

type NotificationStatus = "queued" | "sent" | "delivered" | "failed" | "retry";

type NotificationLog = {
  id: string;
  created_at: string;
  phone: string | null;
  body_en: string | null;
  status: NotificationStatus;
  channel: "sms";
  trigger_type: string | null;
  recipient_name: string | null;
  recipient_type: string;
};

type NotificationSummary = {
  totalSms: number;
  sent: number;
  failed: number;
  pending: number;
};

type NotificationLogsResponse = {
  data: NotificationLog[];
  meta: {
    page?: number;
    limit?: number;
    total?: number;
    summary?: NotificationSummary;
  };
};

const today = new Date();
const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
const toDateInput = (date: Date) => date.toISOString().slice(0, 10);

const STATUS_OPTIONS: Array<"All" | NotificationStatus> = ["All", "queued", "sent", "delivered", "failed", "retry"];

const formatRecipient = (value?: string | null) => value?.trim() || "Unknown parent";

const formatTrigger = (value?: string | null) => {
  if (!value) return "SMS";
  if (value === "school_entry") return "School entry";
  if (value === "school_exit") return "School exit";
  if (value === "class_entry") return "Class attendance";
  return value.replace(/_/g, " ");
};

const extractStudentName = (message: string | null) => {
  if (!message) return "Unknown student";

  const schoolMatch = message.match(/Your child,\s*(.+?),\s*has/i);
  if (schoolMatch?.[1]) return schoolMatch[1].trim();

  const classMatch = message.match(/Academic Alert:\s*(.+?)\s+has entered/i);
  if (classMatch?.[1]) return classMatch[1].trim();

  return "Unknown student";
};

const getStatusMeta = (status: NotificationStatus) => {
  switch (status) {
    case "sent":
    case "delivered":
      return ["bg-success/15 text-success", "Sent"] as const;
    case "failed":
      return ["bg-destructive/15 text-destructive", "Failed"] as const;
    case "queued":
    case "retry":
      return ["bg-amber-100 text-amber-700", "Pending"] as const;
  }
};

function NotificationsPage() {
  const [start, setStart] = useState(toDateInput(monthStart));
  const [end, setEnd] = useState(toDateInput(today));
  const [status, setStatus] = useState<"All" | NotificationStatus>("All");
  const [q, setQ] = useState("");
  const [view, setView] = useState<NotificationLog | null>(null);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [summary, setSummary] = useState<NotificationSummary>({
    totalSms: 0,
    sent: 0,
    failed: 0,
    pending: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: "1",
          limit: "200",
          from: start,
          to: end,
          channel: "sms"
        });

        if (status !== "All") {
          params.set("status", status);
        }

        const response = await apiRequest<NotificationLogsResponse>(
          `/notifications/logs?${params.toString()}`,
          { auth: "school", returnMeta: true }
        );

        setLogs(response.data ?? []);
        setSummary(response.meta?.summary ?? {
          totalSms: response.meta?.total ?? 0,
          sent: 0,
          failed: 0,
          pending: 0
        });
      } catch (error: any) {
        toast.error(error?.message ?? "Failed to load notification logs");
      } finally {
        setLoading(false);
      }
    };

    void loadLogs();
  }, [start, end, status]);

  const filtered = useMemo(
    () =>
      logs.filter((log) => {
        const message = log.body_en ?? "";
        const recipient = log.recipient_name ?? "";
        const phone = log.phone ?? "";
        const haystack = `${message} ${recipient} ${phone} ${extractStudentName(message)}`.toLowerCase();

        return q === "" || haystack.includes(q.toLowerCase());
      }),
    [logs, q]
  );

  const rate = Math.round((summary.sent / Math.max(1, summary.totalSms)) * 100);

  return (
    <AppLayout title="SMS Notification Logs" subtitle="Track every parent notification">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KPI label="SMS Used" value={summary.totalSms} tone="success" />
        <KPI label="Delivered" value={summary.sent} tone="success" />
        <KPI label="Delivery Rate" value={`${rate}%`} tone="success" />
        <KPI label="Failed" value={summary.failed} tone="destructive" />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-2 items-center">
        <input type="date" value={start} onChange={e => setStart(e.target.value)} className={inp} />
        <input type="date" value={end} onChange={e => setEnd(e.target.value)} className={inp} />
        <select value={status} onChange={e => setStatus(e.target.value as typeof status)} className={inp}>
          {STATUS_OPTIONS.map((option) => <option key={option}>{option}</option>)}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search parent, student, phone, or message…"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" />
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>{["#","Time","Student","Parent","Phone","Trigger","Message","Status","Action"].map(h =>
                <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-10 text-center text-muted-foreground" colSpan={9}>
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading notification logs...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-muted-foreground" colSpan={9}>
                    <div className="flex flex-col items-center gap-2">
                      <Bell className="h-10 w-10 opacity-40" />
                      <p className="text-sm">No SMS notifications found for the selected filters.</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.slice(0, 30).map((log, i) => {
                const message = log.body_en ?? "";
                const recipient = formatRecipient(log.recipient_name);
                const student = extractStudentName(message);
                const [statusClass, statusLabel] = getStatusMeta(log.status);

                return (
                <tr key={log.id} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/30">
                  <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString([], {
                      month: "short",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </td>
                  <td className="px-4 py-3 font-medium">{student}</td>
                  <td className="px-4 py-3">{recipient}</td>
                  <td className="px-4 py-3 font-mono text-xs">{log.phone ?? "—"}</td>
                  <td className="px-4 py-3"><TriggerBadge trigger={formatTrigger(log.trigger_type)} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[240px] truncate">{message}</td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${statusClass}`}>{statusLabel}</span></td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button onClick={() => setView(log)} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:underline">
                      <Eye className="h-3 w-3" /> View
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    
      {view && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setView(null)}>
          <div className="bg-card rounded-2xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b border-border">
              <h3 className="font-display font-bold">SMS Detail</h3>
              <button onClick={() => setView(null)} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="px-6 py-5 space-y-3 text-sm">
              <Row k="To" v={formatRecipient(view.recipient_name)} />
              <Row k="Phone" v={view.phone ?? "—"} />
              <Row k="Student" v={extractStudentName(view.body_en)} />
              <Row k="Trigger" v={formatTrigger(view.trigger_type)} />
              <Row k="Sent" v={new Date(view.created_at).toLocaleString()} />
              <Row k="Status" v={view.status} />
              <div>
                <div className="text-xs text-muted-foreground mb-1">Message</div>
                <div className="rounded-lg bg-muted/40 p-3 whitespace-pre-line">{view.body_en}</div>
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

function TriggerBadge({ trigger }: { trigger: string }) {
  return <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-bold capitalize text-muted-foreground">{trigger}</span>;
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
