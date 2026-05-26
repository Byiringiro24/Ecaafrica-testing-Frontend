import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Send, History, Megaphone, Download, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Avatar } from "@/components/ui-kit/Avatar";
import { SMSComposeModal } from "@/components/modals/SMSComposeModal";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { apiRequest } from "@/lib/api";
import { SMS_LOGS, TODAY_ATTENDANCE } from "@/lib/mockData";

export const Route = createFileRoute("/parents")({ component: ParentsPage });

type ParentRecord = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  phone_alt?: string | null;
  email?: string | null;
  address?: string | null;
};

type StudentRecord = {
  id: string;
  first_name: string;
  last_name: string;
  current_section?: { name?: string | null; full_name?: string | null } | null;
  primary_parent?: { first_name?: string | null; last_name?: string | null; phone?: string | null } | null;
};

type StudentView = {
  id: string;
  name: string;
  class: string;
  parentName: string;
  parentPhone: string;
};

type ParentRow = {
  id: string;
  name: string;
  phone: string;
  district: string;
  studentIds: string[];
  lastSMSSent: string;
  totalSMSCount: number;
};

const UNKNOWN_DISTRICT = "Unknown";

const buildFullName = (first?: string | null, last?: string | null) =>
  [first, last].filter(Boolean).join(" ").trim();

const extractDistrict = (address?: string | null) => {
  if (!address) return UNKNOWN_DISTRICT;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return UNKNOWN_DISTRICT;
  return parts[parts.length - 1];
};

function ParentsPage() {
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState("All");
  const [smsStatus, setSmsStatus] = useState("All");
  const [composeFor, setComposeFor] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<ParentRow | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [parents, setParents] = useState<ParentRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const studentViews = useMemo<StudentView[]>(() =>
    students.map((student) => {
      const name = buildFullName(student.first_name, student.last_name) || "Unnamed";
      const className = student.current_section?.name ?? student.current_section?.full_name ?? "—";
      const parentName = buildFullName(student.primary_parent?.first_name, student.primary_parent?.last_name);
      return {
        id: student.id,
        name,
        class: className,
        parentName,
        parentPhone: student.primary_parent?.phone ?? ""
      };
    }),
    [students]
  );

  const studentsById = useMemo(() =>
    new Map(studentViews.map((student) => [student.id, student])),
    [studentViews]
  );

  const parentRows = useMemo<ParentRow[]>(() => {
    const studentsByParentPhone = new Map<string, string[]>();
    studentViews.forEach((student) => {
      if (!student.parentPhone) return;
      const existing = studentsByParentPhone.get(student.parentPhone) ?? [];
      existing.push(student.id);
      studentsByParentPhone.set(student.parentPhone, existing);
    });

    return parents.map((parent) => {
      const name = buildFullName(parent.first_name, parent.last_name) || "Unnamed";
      const smsLogs = SMS_LOGS.filter(
        (log) => log.phone === parent.phone || log.parentName === name
      );

      return {
        id: parent.id,
        name,
        phone: parent.phone,
        district: extractDistrict(parent.address),
        studentIds: studentsByParentPhone.get(parent.phone) ?? [],
        lastSMSSent: smsLogs[0]?.timestamp ?? "—",
        totalSMSCount: smsLogs.length
      };
    });
  }, [parents, studentViews]);

  const districtOptions = useMemo(() => {
    const districts = new Set<string>();
    parentRows.forEach((parent) => {
      if (parent.district) districts.add(parent.district);
    });
    return Array.from(districts).sort();
  }, [parentRows]);

  const smsParents = useMemo(() =>
    parentRows.map((parent) => ({
      id: parent.id,
      name: parent.name,
      phone: parent.phone,
      studentIds: parent.studentIds
    })),
    [parentRows]
  );

  const smsStudents = useMemo(() =>
    studentViews.map((student) => ({
      id: student.id,
      name: student.name,
      class: student.class,
      parentName: student.parentName,
      parentPhone: student.parentPhone
    })),
    [studentViews]
  );

  const loadParents = async () => {
    setLoading(true);
    try {
      const [parentData, studentData] = await Promise.all([
        apiRequest<ParentRecord[]>("/parents?limit=1000", { auth: "school" }),
        apiRequest<StudentRecord[]>("/students?limit=2000", { auth: "school" })
      ]);

      setParents(Array.isArray(parentData) ? parentData : []);
      setStudents(Array.isArray(studentData) ? studentData : []);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load parent records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadParents();
  }, []);

  const filtered = parentRows.filter((parent) => {
    if (district !== "All" && parent.district !== district) return false;
    if (q) {
      const t = q.toLowerCase();
      const childMatch = parent.studentIds.some((id) =>
        studentsById.get(id)?.name.toLowerCase().includes(t)
      );
      if (!parent.name.toLowerCase().includes(t) && !parent.phone.includes(t) && !childMatch) return false;
    }
    return true;
  });

  const failedToday = SMS_LOGS.filter(s => s.status === "failed").length;
  const sentToday = SMS_LOGS.filter(s => s.status === "sent").length;

  return (
    <AppLayout title="Parent Management" subtitle={`${parentRows.length} parents registered`}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <Stat label="Total Parents" value={parentRows.length} />
        <Stat label="SMS Sent Today" value={sentToday} tone="success" />
        <Stat label="Failed Deliveries" value={failedToday} tone="destructive"
          extra={failedToday > 0 && <button onClick={() => toast.success("Retrying failed SMS…")} className="text-xs font-semibold text-destructive hover:underline">Retry All</button>} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search parent, phone, or student…"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" />
        </div>
        <select value={district} onChange={e => setDistrict(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option>All</option>{districtOptions.map(d => <option key={d}>{d}</option>)}
        </select>
        <select value={smsStatus} onChange={e => setSmsStatus(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option>All</option><option>Sent</option><option>Failed</option><option>Pending</option>
        </select>
        <button onClick={() => setBulkOpen(true)} className="h-10 inline-flex items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          <Megaphone className="h-4 w-4" /> Bulk SMS
        </button>
        <button onClick={() => toast.success("Contacts exported (CSV)")} className="h-10 inline-flex items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted">
          <Download className="h-4 w-4" /> Export
        </button>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>{["Parent","Phone","District","Children","Last SMS","Total SMS","Actions"].map(h =>
                <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    <Loader2 className="inline-flex h-4 w-4 animate-spin mr-2" /> Loading parents…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No parents found.
                  </td>
                </tr>
              ) : (
                filtered.map((parent) => {
                  const children = parent.studentIds
                    .map((id) => studentsById.get(id))
                    .filter(Boolean);

                  return (
                    <tr key={parent.id} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5"><Avatar name={parent.name} size="sm" />
                          <span className="font-medium">{parent.name}</span></div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{parent.phone}</td>
                      <td className="px-4 py-3">{parent.district}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {children.length === 0 && (
                            <span className="text-xs text-muted-foreground">No linked students</span>
                          )}
                          {children.map((child) => child && (
                            <span key={child.id} className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-semibold">
                              {child.name.split(" ")[0]} <span className="opacity-70">({child.class})</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{parent.lastSMSSent}</td>
                      <td className="px-4 py-3">{parent.totalSMSCount}</td>
                      <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                        <button onClick={() => setComposeFor(parent.id)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                          <Send className="h-3 w-3" /> Send SMS
                        </button>
                        <button onClick={() => setHistoryFor(parent)} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:underline">
                          <History className="h-3 w-3" /> History
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SMSComposeModal
        open={!!composeFor}
        parentId={composeFor || undefined}
        parents={smsParents}
        students={smsStudents}
        onClose={() => setComposeFor(null)}
      />
      {historyFor && <HistoryDrawer parent={historyFor} onClose={() => setHistoryFor(null)} />}
      {bulkOpen && (
        <BulkSMSModal
          onClose={() => setBulkOpen(false)}
          parentCount={parentRows.length}
          students={smsStudents}
        />
      )}
    </AppLayout>
  );
}

function Stat({ label, value, tone = "primary", extra }: { label: string; value: number; tone?: "primary" | "success" | "destructive"; extra?: React.ReactNode }) {
  const colors = { primary: "text-primary", success: "text-success", destructive: "text-destructive" };
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="text-xs uppercase font-semibold text-muted-foreground">{label}</div>
      <div className={`font-display text-3xl font-bold mt-2 ${colors[tone]}`}>{value}</div>
      {extra && <div className="mt-2">{extra}</div>}
    </div>
  );
}

function HistoryDrawer({ parent, onClose }: { parent: ParentRow; onClose: () => void }) {
  const logs = SMS_LOGS.filter((log) => log.phone === parent.phone || log.parentName === parent.name);
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-full max-w-md bg-card shadow-2xl h-screen flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <div className="font-display font-bold">{parent.name}</div>
            <div className="text-xs text-muted-foreground font-mono">{parent.phone}</div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {logs.length === 0 && <p className="text-center text-muted-foreground text-sm">No SMS history.</p>}
          {logs.map(l => {
            const tcls = l.trigger === "present" ? "border-l-success" : l.trigger === "absent" ? "border-l-destructive" : "border-l-amber-500";
            return (
              <div key={l.id} className={`border-l-4 ${tcls} bg-muted/30 p-3 rounded-r-lg`}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold">{l.studentName}</span>
                  <span className="text-muted-foreground">{l.timestamp}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{l.message}</p>
                <div className="mt-1.5">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    l.status === "sent" ? "bg-success/15 text-success" :
                    l.status === "failed" ? "bg-destructive/15 text-destructive" :
                    "bg-amber-100 text-amber-700"
                  }`}>{l.status}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BulkSMSModal({
  onClose,
  parentCount,
  students
}: {
  onClose: () => void;
  parentCount: number;
  students: StudentView[];
}) {
  const [target, setTarget] = useState<"all"|"absent"|"risk"|"class">("absent");
  const [cls, setCls] = useState("S1A");
  const [message, setMessage] = useState("Mubyeyi, umwana wanyu yagombye kuza ku ishuri uyu munsi. Murakoze. — SmartAttend");
  const [confirm, setConfirm] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const targetCount = useMemo(() => {
    if (target === "all") return parentCount;
    if (target === "absent") return TODAY_ATTENDANCE.filter(a => a.status === "Absent").length;
    if (target === "risk") return 0;
    return students.filter(s => s.class === cls).length;
  }, [target, cls, parentCount, students]);

  const start = () => {
    setProgress({ current: 0, total: targetCount });
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setProgress({ current: i, total: targetCount });
      if (i >= targetCount) {
        clearInterval(interval);
        setTimeout(() => {
          toast.success(`Bulk SMS complete — ${targetCount} parents notified`);
          onClose();
        }, 400);
      }
    }, 60);
  };

  return (
    <div className="fixed inset-0 z-[55] grid place-items-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-display font-bold">Send Bulk SMS</h3>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        {progress ? (
          <div className="p-8 text-center">
            <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin" />
            <p className="mt-4 font-semibold">Sending {progress.current} of {progress.total}…</p>
            <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${(progress.current/progress.total)*100}%` }} />
            </div>
          </div>
        ) : (
          <>
            <div className="px-6 py-5 space-y-4">
              <div>
                <div className="text-xs font-semibold mb-2">Target audience</div>
                <div className="space-y-1.5">
                  {([
                    ["all", "All Parents"],
                    ["absent", "Parents of Absent Students Today"],
                    ["risk", "Parents of At-Risk Students (<70%)"],
                    ["class", "Specific Class"],
                  ] as const).map(([k, l]) => (
                    <label key={k} className="flex items-center gap-2 text-sm">
                      <input type="radio" checked={target === k} onChange={() => setTarget(k)} className="accent-primary" />
                      {l}
                    </label>
                  ))}
                </div>
                {target === "class" && (
                  <select value={cls} onChange={e => setCls(e.target.value)} className="mt-2 h-10 rounded-lg border border-border bg-background px-3 text-sm">
                    {["S1A","S1B","S2A","S2B","S3A","S3B","S4A","S4B","S5A","S5B","S6A","S6B"].map(c => <option key={c}>{c}</option>)}
                  </select>
                )}
              </div>
              <div className="rounded-lg bg-muted/40 p-3 text-sm">This will send to <b>{targetCount}</b> parents.</div>
              <div>
                <div className="text-xs font-semibold mb-1.5">Message</div>
                <textarea rows={4} value={message} onChange={e => setMessage(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background p-3 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
              <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
              <button onClick={() => setConfirm(true)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Send to {targetCount} Parents
              </button>
            </div>
          </>
        )}
      </div>
      <ConfirmModal open={confirm} title="Confirm Bulk SMS" message={`Send this SMS to ${targetCount} parents?`} confirmLabel="Send"
        onConfirm={start} onClose={() => setConfirm(false)} />
    </div>
  );
}
