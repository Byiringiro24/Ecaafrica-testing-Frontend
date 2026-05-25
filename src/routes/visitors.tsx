import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { UserCheck, Plus, X, Search, LogOut, Eye, Printer, ChevronRight, ChevronLeft, Calendar, CheckCircle2, Clock, Users } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Avatar } from "@/components/ui-kit/Avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { VISITORS, STAFF, STUDENTS, type Visitor, type Staff, type Student } from "@/lib/mockData";

export const Route = createFileRoute("/visitors")({ component: VisitorsPage });

const TABS = ["Active Visitors", "Scheduled", "History", "Logs"] as const;
type Tab = typeof TABS[number];

const hostTitleFor = (role: Staff["role"]) => {
  if (role === "Admin") return "Head Teacher";
  if (role === "Teacher") return "Teacher";
  return "HOD";
};

const hostDisplayName = (staff: Staff) => `${hostTitleFor(staff.role)} ${staff.name}`;

const VISITOR_TYPES = ["Parent/Guardian", "Organization"] as const;
type VisitorType = typeof VISITOR_TYPES[number];

const studentLabel = (student: Student) => `${student.name} - ${student.class}`;

function VisitorsPage() {
  const [tab, setTab] = useState<Tab>("Active Visitors");
  const [list, setList] = useState<Visitor[]>(VISITORS);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [checkoutTarget, setCheckoutTarget] = useState<Visitor | null>(null);
  const [viewing, setViewing] = useState<Visitor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeoutId = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timeoutId);
  }, []);

  const today = list.filter(v => v.date === "today");
  const onCampus = list.filter(v => v.status === "on-campus").length;
  const pendingCheckout = onCampus;
  const todaysCount = today.length;
  const weekTotal = list.filter(v => v.date !== "tomorrow").length;

  return (
    <AppLayout title="Visitor Management" subtitle="Campus visitor check-in & check-out">
      <div className="flex justify-end mb-4">
        <button onClick={() => setRegisterOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:opacity-90">
          <Plus className="h-4 w-4" /> Register Visitor
        </button>
      </div>

      {loading ? (
        <VisitorsSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <StatCard label="Today's Visitors" value={todaysCount} icon={<UserCheck className="h-5 w-5" />} />
            <StatCard label="Currently On Campus" value={onCampus} tone="success" icon={<Users className="h-5 w-5" />} />
            <StatCard label="Pending Check-out" value={pendingCheckout} tone="warning" icon={<Clock className="h-5 w-5" />} />
            <StatCard label="This Week Total" value={weekTotal} icon={<Calendar className="h-5 w-5" />} />
          </div>

          <div className="flex flex-wrap gap-1 border-b border-border mb-4 overflow-x-auto">
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                {t}
              </button>
            ))}
          </div>

          {tab === "Active Visitors" && <ActiveTab list={list.filter(v => v.status === "on-campus")} onCheckout={setCheckoutTarget} onView={setViewing} />}
          {tab === "Scheduled" && <ScheduledTab list={list.filter(v => v.status === "scheduled")} onConfirm={(id) => { setList(prev => prev.map(v => v.id === id ? { ...v, status: "on-campus", checkinTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), date: "today" } : v)); toast.success("Visitor confirmed & checked in"); }} onCancel={(id) => { setList(prev => prev.filter(v => v.id !== id)); toast.success("Appointment cancelled"); }} />}
          {tab === "History" && <HistoryTab list={list.filter(v => v.status === "checked-out")} />}
          {tab === "Logs" && <LogsTab list={list} />}
        </>
      )}

      {registerOpen && <RegisterModal onClose={() => setRegisterOpen(false)} onSave={(v) => { setList(prev => [v, ...prev]); setRegisterOpen(false); toast.success("Visitor checked in successfully"); }} />}
      {checkoutTarget && <CheckoutModal visitor={checkoutTarget} onClose={() => setCheckoutTarget(null)} onConfirm={() => { setList(prev => prev.map(v => v.id === checkoutTarget.id ? { ...v, status: "checked-out", checkoutTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) } : v)); setCheckoutTarget(null); toast.success("Visitor checked out"); }} />}
      {viewing && <ViewModal visitor={viewing} onClose={() => setViewing(null)} />}
    </AppLayout>
  );
}

function StatusPill({ status }: { status: Visitor["status"] }) {
  const map = { "on-campus": "bg-success/15 text-success", "checked-out": "bg-muted text-muted-foreground", "scheduled": "bg-amber-100 text-amber-700" };
  const label = { "on-campus": "On Campus", "checked-out": "Checked Out", "scheduled": "Scheduled" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[status]}`}>{label[status]}</span>;
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground"><UserCheck className="h-6 w-6" /></div>
      <p className="mt-3 text-sm text-muted-foreground">{msg}</p>
    </div>
  );
}

function ActiveTab({ list, onCheckout, onView }: { list: Visitor[]; onCheckout: (v: Visitor) => void; onView: (v: Visitor) => void }) {
  if (list.length === 0) return <EmptyState msg="No visitors currently on campus." />;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Visitor</th>
            <th className="px-4 py-3 text-left">Purpose</th>
            <th className="px-4 py-3 text-left">Host</th>
            <th className="px-4 py-3 text-left">Check-in</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((v, i) => (
            <tr key={v.id} className={`border-t border-border hover:bg-muted/40 ${i % 2 ? "bg-muted/20" : ""}`}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={v.name} />
                  <div>
                    <p className="font-semibold">{v.name}</p>
                    <p className="text-xs text-muted-foreground">{v.organization}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">{v.purpose}</td>
              <td className="px-4 py-3">{v.host}</td>
              <td className="px-4 py-3 font-mono text-xs">{v.checkinTime}</td>
              <td className="px-4 py-3"><StatusPill status={v.status} /></td>
              <td className="px-4 py-3 text-right">
                <div className="inline-flex items-center gap-2">
                  <button onClick={() => onView(v)} className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted"><Eye className="h-3.5 w-3.5" /></button>
                  <button onClick={() => onCheckout(v)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"><LogOut className="h-3.5 w-3.5" /> Check-out</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScheduledTab({ list, onConfirm, onCancel }: { list: Visitor[]; onConfirm: (id: string) => void; onCancel: (id: string) => void }) {
  if (list.length === 0) return <EmptyState msg="No upcoming scheduled visits." />;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Visitor</th>
            <th className="px-4 py-3 text-left">Host</th>
            <th className="px-4 py-3 text-left">Date / Time</th>
            <th className="px-4 py-3 text-left">Purpose</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((v, i) => (
            <tr key={v.id} className={`border-t border-border hover:bg-muted/40 ${i % 2 ? "bg-muted/20" : ""}`}>
              <td className="px-4 py-3 font-semibold">{v.name}</td>
              <td className="px-4 py-3">{v.host}</td>
              <td className="px-4 py-3">{v.appointmentDate} {v.appointmentTime}</td>
              <td className="px-4 py-3">{v.purpose}</td>
              <td className="px-4 py-3"><span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700">Confirmed</span></td>
              <td className="px-4 py-3 text-right">
                <div className="inline-flex items-center gap-2">
                  <button onClick={() => onConfirm(v.id)} className="rounded-md bg-success/15 text-success px-3 py-1.5 text-xs font-semibold hover:bg-success/25">Check in</button>
                  <button onClick={() => onCancel(v.id)} className="rounded-md bg-destructive/15 text-destructive px-3 py-1.5 text-xs font-semibold hover:bg-destructive/25">Cancel</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryTab({ list }: { list: Visitor[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => list.filter(v => v.name.toLowerCase().includes(q.toLowerCase()) || v.host.toLowerCase().includes(q.toLowerCase())), [list, q]);
  if (list.length === 0) return <EmptyState msg="No visitor history yet." />;
  return (
    <>
      <div className="mb-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search visitor or host…" className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-sm" />
        </div>
        <input type="date" className="rounded-lg border border-border bg-card px-3 py-2 text-sm" />
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Visitor</th>
              <th className="px-4 py-3 text-left">Host</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Check-in</th>
              <th className="px-4 py-3 text-left">Check-out</th>
              <th className="px-4 py-3 text-left">Duration</th>
              <th className="px-4 py-3 text-left">Purpose</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v, i) => (
              <tr key={v.id} className={`border-t border-border hover:bg-muted/40 ${i % 2 ? "bg-muted/20" : ""}`}>
                <td className="px-4 py-3 font-semibold">{v.name}</td>
                <td className="px-4 py-3">{v.host}</td>
                <td className="px-4 py-3 capitalize">{v.date}</td>
                <td className="px-4 py-3 font-mono text-xs">{v.checkinTime}</td>
                <td className="px-4 py-3 font-mono text-xs">{v.checkoutTime || "—"}</td>
                <td className="px-4 py-3">{computeDuration(v.checkinTime, v.checkoutTime)}</td>
                <td className="px-4 py-3">{v.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function LogsTab({ list }: { list: Visitor[] }) {
  const events: { time: string; name: string; action: "Entry" | "Exit"; officer: string }[] = [];
  list.forEach(v => {
    if (v.checkinTime && v.checkinTime !== "—") events.push({ time: v.checkinTime, name: v.name, action: "Entry", officer: "Officer Niyonzima" });
    if (v.checkoutTime) events.push({ time: v.checkoutTime, name: v.name, action: "Exit", officer: "Officer Niyonzima" });
  });
  events.sort((a, b) => b.time.localeCompare(a.time));
  if (events.length === 0) return <EmptyState msg="No gate events recorded." />;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr><th className="px-4 py-3 text-left">Timestamp</th><th className="px-4 py-3 text-left">Visitor</th><th className="px-4 py-3 text-left">Action</th><th className="px-4 py-3 text-left">Gate Officer</th></tr>
        </thead>
        <tbody>
          {events.map((e, i) => (
            <tr key={i} className={`border-t border-border ${i % 2 ? "bg-muted/20" : ""}`}>
              <td className="px-4 py-3 font-mono text-xs">{e.time}</td>
              <td className="px-4 py-3 font-semibold">{e.name}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${e.action === "Entry" ? "bg-success/15 text-success" : "bg-blue-100 text-blue-700"}`}>{e.action}</span>
              </td>
              <td className="px-4 py-3">{e.officer}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VisitorsSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`visitor-stat-skeleton-${i}`} className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-6 w-12" />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border mb-4 overflow-x-auto pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={`visitor-tab-skeleton-${i}`} className="h-8 w-28 rounded-full" />
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {Array.from({ length: 6 }).map((_, i) => (
                <th key={`visitor-head-skeleton-${i}`} className="px-4 py-3 text-left">
                  <Skeleton className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={`visitor-row-skeleton-${i}`} className="border-t border-border">
                {Array.from({ length: 6 }).map((__, j) => (
                  <td key={`visitor-cell-skeleton-${i}-${j}`} className="px-4 py-3">
                    <Skeleton className="h-4 w-24" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function computeDuration(inT?: string, outT?: string) {
  if (!inT || !outT || inT === "—") return "—";
  const [h1, m1] = inT.split(":").map(Number);
  const [h2, m2] = outT.split(":").map(Number);
  const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins < 0) return "—";
  const h = Math.floor(mins / 60); const m = mins % 60;
  return `${h}h ${m}m`;
}

// =================== Modals ===================
function useEsc(onClose: () => void) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn); return () => window.removeEventListener("keydown", fn);
  }, [onClose]);
}

function ModalShell({ onClose, children, size = "lg" }: { onClose: () => void; children: React.ReactNode; size?: "md" | "lg" | "xl" }) {
  useEsc(onClose);
  const w = size === "md" ? "max-w-md" : size === "xl" ? "max-w-3xl" : "max-w-xl";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`w-full ${w} rounded-2xl bg-card shadow-2xl border border-border max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function RegisterModal({ onClose, onSave }: { onClose: () => void; onSave: (v: Visitor) => void }) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState({
    name: "", nationalId: "", phone: "", organization: "",
    visitorType: "Parent/Guardian" as VisitorType,
    studentSearch: "",
    purpose: "Parent Visit" as Visitor["purpose"], host: STAFF[0] ? hostDisplayName(STAFF[0]) : "",
    appointmentDate: new Date().toISOString().slice(0, 10), appointmentTime: "09:00",
    duration: "1 hr", notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const studentOptions = useMemo(() => STUDENTS.map(s => ({ id: s.id, label: studentLabel(s) })), []);
  const matchedStudent = useMemo(() => {
    const q = data.studentSearch.trim().toLowerCase();
    if (!q) return null;
    const match = studentOptions.find(o => o.label.toLowerCase() === q);
    return match ? STUDENTS.find(s => s.id === match.id) ?? null : null;
  }, [data.studentSearch, studentOptions]);
  const relationshipOrg = data.visitorType === "Parent/Guardian"
    ? (matchedStudent ? `Parent of ${matchedStudent.name} (${matchedStudent.class})` : "")
    : data.organization;
  const organizationValue = relationshipOrg.trim() || "—";

  const validateStep = (s: number) => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!data.name.trim()) e.name = "Required";
      if (!data.nationalId.trim()) e.nationalId = "Required";
      if (data.visitorType === "Parent/Guardian" && !matchedStudent) e.studentSearch = "Select a student";
      if (data.visitorType === "Organization" && !data.organization.trim()) e.organization = "Required";
    }
    if (s === 2) {
      if (!data.host) e.host = "Required";
    }
    setErrors(e); return Object.keys(e).length === 0;
  };

  const next = () => { if (validateStep(step)) setStep(s => s + 1); };

  const submit = () => {
    setSubmitting(true);
    setTimeout(() => {
      const id = `V${String(Math.floor(Math.random() * 9000) + 1000)}`;
      const v: Visitor = {
        id, name: data.name, nationalId: data.nationalId, phone: data.phone,
        organization: organizationValue, purpose: data.purpose, host: data.host,
        checkinTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "on-campus", date: "today", notes: data.notes,
      };
      onSave(v);
    }, 600);
  };

  return (
    <ModalShell onClose={onClose} size="xl">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h2 className="font-display text-lg font-bold">Register Visitor</h2>
          <p className="text-xs text-muted-foreground">Step {step} of 3</p>
        </div>
        <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
      </div>

      <div className="px-6 pt-4">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map(n => (
            <div key={n} className="flex-1">
              <div className={`h-1.5 rounded-full ${n <= step ? "bg-primary" : "bg-muted"}`} />
              <p className={`mt-1.5 text-[10px] uppercase tracking-wide font-semibold ${n <= step ? "text-primary" : "text-muted-foreground"}`}>
                {n === 1 ? "Visitor Info" : n === 2 ? "Visit Details" : "Confirm"}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-4">
        {step === 1 && (
          <>
            <Field label="Full Name" required error={errors.name}>
              <input className={inputCls(!!errors.name)} value={data.name} onChange={e => setData({ ...data, name: e.target.value })} placeholder="e.g. Bizimana Jean Pierre" />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="National ID / Passport" required error={errors.nationalId}>
                <input className={inputCls(!!errors.nationalId)} value={data.nationalId} onChange={e => setData({ ...data, nationalId: e.target.value })} placeholder="1199…" />
              </Field>
              <Field label="Phone" required error={errors.phone}>
                <input className={inputCls(!!errors.phone)} value={data.phone} onChange={e => setData({ ...data, phone: e.target.value })} placeholder="+250 7XX XXX XXX" />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Visitor Type" required>
                <select
                  className={inputCls(false)}
                  value={data.visitorType}
                  onChange={e => {
                    const visitorType = e.target.value as VisitorType;
                    const nextPurpose = visitorType === "Parent/Guardian"
                      ? "Parent Visit"
                      : data.purpose === "Parent Visit" ? "Official Business" : data.purpose;
                    setData({ ...data, visitorType, purpose: nextPurpose });
                  }}
                >
                  {VISITOR_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              {data.visitorType === "Parent/Guardian" ? (
                <Field label="Student (Search)" required error={errors.studentSearch}>
                  <input
                    list="visitor-students"
                    className={inputCls(!!errors.studentSearch)}
                    value={data.studentSearch}
                    onChange={e => setData({ ...data, studentSearch: e.target.value })}
                    placeholder="e.g. Fabrice - S1A"
                  />
                  <datalist id="visitor-students">
                    {studentOptions.map(o => <option key={o.id} value={o.label} />)}
                  </datalist>
                  {matchedStudent && (
                    <p className="mt-1 text-xs text-muted-foreground">Saved as: Parent of {matchedStudent.name} ({matchedStudent.class})</p>
                  )}
                </Field>
              ) : (
                <Field label="Organization / Relationship" required error={errors.organization}>
                  <input
                    className={inputCls(!!errors.organization)}
                    value={data.organization}
                    onChange={e => setData({ ...data, organization: e.target.value })}
                    placeholder="e.g. Ministry of Education"
                  />
                </Field>
              )}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Purpose of Visit" required>
                <select className={inputCls(false)} value={data.purpose} onChange={e => setData({ ...data, purpose: e.target.value as Visitor["purpose"] })}>
                  {["Parent Visit", "Official Business", "Delivery", "Inspection", "Other"].map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Host (Staff)" required error={errors.host}>
                <select className={inputCls(!!errors.host)} value={data.host} onChange={e => setData({ ...data, host: e.target.value })}>
                  {STAFF.map(s => {
                    const label = hostDisplayName(s);
                    return <option key={s.id} value={label}>{label}</option>;
                  })}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Date">
                <input type="date" className={inputCls(false)} value={data.appointmentDate} onChange={e => setData({ ...data, appointmentDate: e.target.value })} />
              </Field>
              <Field label="Time">
                <input type="time" className={inputCls(false)} value={data.appointmentTime} onChange={e => setData({ ...data, appointmentTime: e.target.value })} />
              </Field>
              <Field label="Expected Duration">
                <select className={inputCls(false)} value={data.duration} onChange={e => setData({ ...data, duration: e.target.value })}>
                  {["30 min", "1 hr", "2 hrs", "Half day", "Full day"].map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Notes">
              <textarea rows={3} className={inputCls(false)} value={data.notes} onChange={e => setData({ ...data, notes: e.target.value })} placeholder="Any additional info…" />
            </Field>
          </>
        )}
        {step === 3 && (
          <>
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2 text-sm">
              <Row k="Visitor" v={data.name} />
              <Row k="National ID" v={data.nationalId} />
              <Row k="Phone" v={data.phone} />
              {data.visitorType === "Parent/Guardian" && matchedStudent && (
                <Row k="Student" v={`${matchedStudent.name} (${matchedStudent.class})`} />
              )}
              <Row k="Organization / Relationship" v={organizationValue} />
              <Row k="Purpose" v={data.purpose} />
              <Row k="Host" v={data.host} />
              <Row k="When" v={`${data.appointmentDate} • ${data.appointmentTime} (${data.duration})`} />
              {data.notes && <Row k="Notes" v={data.notes} />}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-muted/20">
        <button onClick={() => step === 1 ? onClose() : setStep(s => s - 1)} className="inline-flex items-center gap-1 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
          <ChevronLeft className="h-4 w-4" /> {step === 1 ? "Cancel" : "Back"}
        </button>
        {step < 3 ? (
          <button onClick={next} className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
            Next <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button disabled={submitting} onClick={submit} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {submitting && <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
            Confirm & Check-in
          </button>
        )}
      </div>

      {/* Print badge layout (visible only on print) */}
      <div className="hidden print:block fixed inset-0 bg-white p-12">
        <div className="border-4 border-slate-900 p-8 max-w-md mx-auto text-center">
          <p className="text-4xl font-bold tracking-widest">VISITOR</p>
          <div className="mx-auto my-6 h-32 w-32 bg-muted grid place-items-center text-muted-foreground">PHOTO</div>
          <p className="text-2xl font-bold">{data.name}</p>
          <p className="mt-2 text-sm">Host: {data.host}</p>
          <p className="text-sm">Purpose: {data.purpose}</p>
          <p className="text-sm">Date: {data.appointmentDate}</p>
        </div>
      </div>
    </ModalShell>
  );
}

function CheckoutModal({ visitor, onClose, onConfirm }: { visitor: Visitor; onClose: () => void; onConfirm: () => void }) {
  const [notes, setNotes] = useState("");
  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <ModalShell onClose={onClose} size="md">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="font-display text-lg font-bold">Check-out Visitor</h2>
        <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
      </div>
      <div className="p-6 space-y-3 text-sm">
        <Row k="Visitor" v={visitor.name} />
        <Row k="Check-in" v={visitor.checkinTime} />
        <Row k="Check-out" v={now} />
        <Row k="Duration" v={computeDuration(visitor.checkinTime, now)} />
        <Field label="Notes (optional)">
          <textarea rows={2} className={inputCls(false)} value={notes} onChange={e => setNotes(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-6 py-4 bg-muted/20">
        <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
        <button onClick={onConfirm} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <CheckCircle2 className="h-4 w-4" /> Complete Check-out
        </button>
      </div>
    </ModalShell>
  );
}

function ViewModal({ visitor, onClose }: { visitor: Visitor; onClose: () => void }) {
  return (
    <ModalShell onClose={onClose} size="md">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="font-display text-lg font-bold">Visitor Details</h2>
        <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
      </div>
      <div className="p-6 space-y-2 text-sm">
        <div className="flex items-center gap-3 mb-3">
          <Avatar name={visitor.name} />
          <div><p className="font-semibold">{visitor.name}</p><p className="text-xs text-muted-foreground">{visitor.organization}</p></div>
        </div>
        <Row k="National ID" v={visitor.nationalId} />
        <Row k="Phone" v={visitor.phone} />
        <Row k="Purpose" v={visitor.purpose} />
        <Row k="Host" v={visitor.host} />
        <Row k="Check-in" v={visitor.checkinTime} />
        <Row k="Check-out" v={visitor.checkoutTime || "—"} />
        <Row k="Status" v={visitor.status} />
      </div>
    </ModalShell>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-foreground mb-1.5">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4"><span className="text-muted-foreground">{k}</span><span className="font-medium text-right">{v}</span></div>;
}
function inputCls(err: boolean) {
  return `w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${err ? "border-destructive" : "border-border"}`;
}
