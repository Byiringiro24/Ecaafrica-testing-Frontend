import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, X, Check, Search } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/leaves")({ component: LeavesPage });

const TABS = ["Pending","Approved","All History"] as const;

type ParentRecord = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
};

type StudentRecord = {
  id: string;
  first_name: string;
  last_name: string;
  student_type?: "boarding" | "day" | null;
  current_section?: { name?: string | null; full_name?: string | null } | null;
  primary_parent?: { first_name?: string | null; last_name?: string | null; phone?: string | null } | null;
};

type LeaveRecord = {
  id: string;
  student_id: string;
  parent_id?: string | null;
  leave_type: "weekend" | "medical" | "family" | "emergency" | "other";
  start_date: string;
  end_date: string;
  reason?: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  approved_at?: string | null;
  returned_at?: string | null;
};

type LeaveRow = {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  house: string;
  type: string;
  typeValue: LeaveRecord["leave_type"];
  departureDate: string;
  returnDate: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected" | "Cancelled";
  statusValue: LeaveRecord["status"];
  contactPerson: string;
  parentPhone: string;
  requestedBy: string;
  startDateValue: string;
  endDateValue: string;
  approvedAtValue?: string | null;
  returnedAtValue?: string | null;
  parentId?: string | null;
};

type StudentOption = {
  id: string;
  name: string;
  className: string;
  studentType: "boarding" | "day" | null;
  parentName: string;
  parentPhone: string;
  parentId?: string | null;
};

const LEAVE_TYPE_OPTIONS: { label: string; value: LeaveRecord["leave_type"] }[] = [
  { label: "Weekend Leave", value: "weekend" },
  { label: "Medical Leave", value: "medical" },
  { label: "Family Emergency", value: "emergency" },
  { label: "Family Leave", value: "family" },
  { label: "Other", value: "other" }
];

const LEAVE_TYPE_LABELS: Record<LeaveRecord["leave_type"], string> = {
  weekend: "Weekend Leave",
  medical: "Medical Leave",
  emergency: "Family Emergency",
  family: "Family Leave",
  other: "Other"
};

const STATUS_LABELS: Record<LeaveRecord["status"], LeaveRow["status"]> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled"
};

const buildName = (first?: string | null, last?: string | null) =>
  [first, last].filter(Boolean).join(" ").trim();

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
};

function LeavesPage() {
  const [tab, setTab] = useState<typeof TABS[number]>("Pending");
  const [requests, setRequests] = useState<LeaveRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [parents, setParents] = useState<ParentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState<LeaveRow | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const parentById = useMemo(() =>
    new Map(parents.map((parent) => [parent.id, parent])),
    [parents]
  );

  const parentByPhone = useMemo(() =>
    new Map(parents.map((parent) => [parent.phone, parent])),
    [parents]
  );

  const studentById = useMemo(() =>
    new Map(students.map((student) => [student.id, student])),
    [students]
  );

  const studentOptions = useMemo<StudentOption[]>(() =>
    students.map((student) => {
      const name = buildName(student.first_name, student.last_name) || "Unnamed";
      const className = student.current_section?.name ?? student.current_section?.full_name ?? "—";
      const parentName = buildName(student.primary_parent?.first_name, student.primary_parent?.last_name) || "—";
      const parentPhone = student.primary_parent?.phone ?? "";
      const parentId = parentPhone ? parentByPhone.get(parentPhone)?.id ?? null : null;

      return {
        id: student.id,
        name,
        className,
        studentType: student.student_type ?? null,
        parentName,
        parentPhone,
        parentId
      };
    }),
    [students, parentByPhone]
  );

  const leaveRows = useMemo<LeaveRow[]>(() =>
    requests.map((request) => {
      const student = studentById.get(request.student_id);
      const studentName = buildName(student?.first_name, student?.last_name) || "Unknown";
      const className = student?.current_section?.name ?? student?.current_section?.full_name ?? "—";
      const house = student?.student_type === "boarding" ? "Boarding" : "Day Scholar";
      const parentFromLeave = request.parent_id ? parentById.get(request.parent_id) : undefined;
      const parentFromStudent = student?.primary_parent?.phone
        ? parentByPhone.get(student.primary_parent.phone)
        : undefined;
      const parent = parentFromLeave ?? parentFromStudent;
      const parentName = parent ? buildName(parent.first_name, parent.last_name) : "";
      const contactPerson = parentName || buildName(student?.primary_parent?.first_name, student?.primary_parent?.last_name) || "—";
      const parentPhone = parent?.phone ?? student?.primary_parent?.phone ?? "—";
      const startDate = formatDate(request.start_date);
      const endDate = formatDate(request.end_date);
      const approvedAt = request.approved_at ? formatDate(request.approved_at) : null;
      const returnedAt = request.returned_at ? formatDate(request.returned_at) : null;

      return {
        id: request.id,
        studentId: request.student_id,
        studentName,
        className,
        house,
        type: LEAVE_TYPE_LABELS[request.leave_type] ?? "Other",
        typeValue: request.leave_type,
        departureDate: startDate,
        returnDate: endDate,
        reason: request.reason ?? "—",
        status: STATUS_LABELS[request.status],
        statusValue: request.status,
        contactPerson,
        parentPhone,
        requestedBy: contactPerson,
        startDateValue: startDate,
        endDateValue: endDate,
        approvedAtValue: approvedAt,
        returnedAtValue: returnedAt,
        parentId: parent?.id ?? request.parent_id ?? null
      };
    }),
    [requests, studentById, parentById, parentByPhone]
  );

  const pending = leaveRows.filter((row) => row.statusValue === "pending").length;
  const approvedToday = leaveRows.filter(
    (row) => row.statusValue === "approved" && row.approvedAtValue === today
  ).length;
  const out = leaveRows.filter(
    (row) => row.statusValue === "approved" && !row.returnedAtValue && row.startDateValue <= today && row.endDateValue >= today
  ).length;
  const returned = leaveRows.filter((row) => row.returnedAtValue === today).length;

  const filtered = useMemo(() => {
    if (tab === "All History") return leaveRows;
    if (tab === "Approved") return leaveRows.filter((row) => row.statusValue === "approved");
    return leaveRows.filter((row) => row.statusValue === "pending");
  }, [leaveRows, tab]);

  const onLeaveStudents = useMemo(() =>
    leaveRows.filter((row) => row.statusValue === "approved" && !row.returnedAtValue && row.startDateValue <= today),
    [leaveRows, today]
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [leaveData, studentData, parentData] = await Promise.all([
        apiRequest<LeaveRecord[]>("/boarding/student-leaves?limit=1000", { auth: "school" }),
        apiRequest<StudentRecord[]>("/students?limit=2000", { auth: "school" }),
        apiRequest<ParentRecord[]>("/parents?limit=2000", { auth: "school" })
      ]);

      setRequests(Array.isArray(leaveData) ? leaveData : []);
      setStudents(Array.isArray(studentData) ? studentData : []);
      setParents(Array.isArray(parentData) ? parentData : []);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load leave requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <AppLayout title="Leave Management" subtitle="Uruhushya · Approve & track student leave">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Pending Requests" value={pending} tone="destructive" />
        <StatCard label="Approved Today" value={approvedToday} tone="success" />
        <StatCard label="Currently Out" value={out} />
        <StatCard label="Returned Today" value={returned} tone="success" />
      </div>

      <div className="flex gap-1 border-b border-border mb-4 items-end">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{t}</button>
        ))}
        <div className="ml-auto pb-2">
          <button onClick={() => setNewOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-semibold hover:bg-primary/90"><Plus className="h-4 w-4" /> New Leave Request</button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{["#","Student","Class","House","Type","Departure","Return","Reason","Status","Actions"].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm text-muted-foreground">Loading leave requests…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm text-muted-foreground">No leave requests found.</td>
                </tr>
              ) : (
                filtered.map((r, i) => (
                  <tr key={r.id} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/30">
                    <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3 font-medium">{r.studentName}</td>
                    <td className="px-4 py-3">{r.className}</td>
                    <td className="px-4 py-3 text-xs">{r.house}</td>
                    <td className="px-4 py-3 text-xs">{r.type}</td>
                    <td className="px-4 py-3 text-xs">{r.departureDate}</td>
                    <td className="px-4 py-3 text-xs">{r.returnDate}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-45 truncate">{r.reason}</td>
                    <td className="px-4 py-3"><LeaveStatus v={r.status} /></td>
                    <td className="px-4 py-3 space-x-1.5 whitespace-nowrap">
                      {r.status === "Pending" ? (
                        <button onClick={() => setApproving(r)} className="text-xs font-semibold text-success hover:underline">✅ Approve</button>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5">
        <h2 className="font-display font-bold text-lg mb-3">Students Currently on Leave</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {onLeaveStudents.slice(0, 6).map(r => {
            const overdue = r.endDateValue < today;
            return (
              <div key={r.id} className={`rounded-xl border ${overdue ? "border-destructive bg-destructive/5" : "border-border bg-card"} p-4`}>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary font-bold text-xs">{r.studentName.split(" ").map(p => p[0]).join("").slice(0,2)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{r.studentName}</div>
                    <div className="text-xs text-muted-foreground">{r.className} · {r.house}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${overdue ? "bg-destructive text-white" : "bg-blue-100 text-blue-700"}`}>{overdue ? "OVERDUE" : r.type}</span>
                </div>
                <div className="mt-3 text-xs space-y-1">
                  <div><span className="text-muted-foreground">Departure:</span> {r.departureDate}</div>
                  <div><span className="text-muted-foreground">Expected:</span> {r.returnDate}</div>
                  <div><span className="text-muted-foreground">Contact:</span> {r.parentPhone}</div>
                </div>
                {overdue && <button onClick={() => toast.success(`Notified ${r.contactPerson}`)} className="mt-3 w-full rounded-lg bg-destructive text-white px-3 py-1.5 text-xs font-semibold">Notify Parent</button>}
              </div>
            );
          })}
        </div>
      </div>

      {approving && (
        <ApproveModal
          req={approving}
          onClose={() => setApproving(null)}
          onConfirm={async () => {
            try {
              const updated = await apiRequest<LeaveRecord>(`/boarding/student-leaves/${approving.id}/approve`, {
                method: "PATCH",
                auth: "school"
              });
              setRequests((prev) => prev.map((item) => item.id === updated.id ? updated : item));
              toast.success(`Leave approved & SMS queued for ${approving.contactPerson}`);
            } catch (error: any) {
              toast.error(error?.message ?? "Failed to approve leave request");
            } finally {
              setApproving(null);
            }
          }}
        />
      )}
      {newOpen && (
        <NewLeaveModal
          students={studentOptions}
          onClose={() => setNewOpen(false)}
          onCreate={async (payload) => {
            try {
              const created = await apiRequest<LeaveRecord>("/boarding/student-leaves", {
                method: "POST",
                auth: "school",
                body: JSON.stringify(payload)
              });
              setRequests((prev) => [created, ...prev]);
              toast.success("Leave request submitted (Pending)");
              setNewOpen(false);
            } catch (error: any) {
              toast.error(error?.message ?? "Failed to submit leave request");
            }
          }}
        />
      )}
    </AppLayout>
  );
}

function LeaveStatus({ v }: { v: LeaveRow["status"] }) {
  const map = {
    Pending: "bg-amber-100 text-amber-700",
    Approved: "bg-success/15 text-success",
    Rejected: "bg-destructive/15 text-destructive",
    Cancelled: "bg-muted text-muted-foreground"
  };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${map[v]}`}>{v}</span>;
}

function ApproveModal({ req, onClose, onConfirm }: { req: LeaveRow; onClose: () => void; onConfirm: () => void }) {
  const [authBy, setAuthBy] = useState("Warden");
  const [sms, setSms] = useState(true);
  const preview = `Dear ${req.contactPerson}, your child ${req.studentName} has been granted ${req.type} from ${req.departureDate} to ${req.returnDate}. — SmartAttend`;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex justify-between items-center"><h3 className="font-display font-bold">Approve Leave Request</h3><button onClick={onClose}><X className="h-4 w-4" /></button></div>
        <div className="px-6 py-5 space-y-4">
          <div className="rounded-lg bg-muted/40 p-3">
            <div className="font-bold">{req.studentName}</div>
            <div className="text-xs text-muted-foreground mt-1">{req.className} · {req.house}</div>
            <div className="text-xs text-muted-foreground">Parent: {req.contactPerson} · {req.parentPhone}</div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground text-xs">Type:</span> <div className="font-semibold">{req.type}</div></div>
            <div><span className="text-muted-foreground text-xs">Destination:</span> <div className="font-semibold">—</div></div>
            <div><span className="text-muted-foreground text-xs">Departure:</span> <div className="font-semibold">{req.departureDate}</div></div>
            <div><span className="text-muted-foreground text-xs">Return:</span> <div className="font-semibold">{req.returnDate}</div></div>
          </div>
          <div className="text-xs text-muted-foreground">Reason: <span className="text-foreground">{req.reason}</span></div>
          <div>
            <label className="block text-xs font-semibold mb-1.5">Authorized By</label>
            <select value={authBy} onChange={e => setAuthBy(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
              <option>Warden</option><option>Deputy Head</option><option>Head Teacher</option>
            </select>
          </div>
          <label className="flex items-center justify-between rounded-lg border border-border p-3"><span className="text-sm">Send approval SMS to parent</span><input type="checkbox" checked={sms} onChange={e => setSms(e.target.checked)} /></label>
          {sms && <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs"><div className="font-bold mb-1 text-primary">SMS Preview</div>{preview}</div>}
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">Cancel</button>
          <button onClick={onConfirm} className="inline-flex items-center gap-1.5 rounded-lg bg-success text-white px-4 py-2 text-sm font-semibold hover:bg-success/90"><Check className="h-4 w-4" /> Approve & Notify</button>
        </div>
      </div>
    </div>
  );
}

function NewLeaveModal({
  onClose,
  onCreate,
  students
}: {
  onClose: () => void;
  onCreate: (payload: {
    student_id: string;
    parent_id?: string | null;
    leave_type: LeaveRecord["leave_type"];
    start_date: string;
    end_date: string;
    reason: string;
  }) => void | Promise<void>;
  students: StudentOption[];
}) {
  const [step, setStep] = useState(1);
  const [studentId, setStudentId] = useState("");
  const [q, setQ] = useState("");
  const [type, setType] = useState<LeaveRecord["leave_type"]>("weekend");
  const [dep, setDep] = useState("");
  const [ret, setRet] = useState("");
  const [reason, setReason] = useState("");
  const [destination, setDestination] = useState("");
  const [contact, setContact] = useState("");

  const matches = students
    .filter((s) => s.studentType === "boarding")
    .filter((s) => q && s.name.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 5);
  const student = students.find((s) => s.id === studentId);

  const submit = () => {
    if (!student) return;
    onCreate({
      student_id: student.id,
      parent_id: student.parentId ?? undefined,
      leave_type: type,
      start_date: dep,
      end_date: ret,
      reason
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
          <div><h3 className="font-display font-bold">New Leave Request</h3><div className="text-xs text-muted-foreground">Step {step} of 3</div></div>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-3 min-h-65">
          {step === 1 && (
            <div>
              <label className="block text-xs font-semibold mb-1.5">Search Student *</label>
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Type a name..." className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" /></div>
              <div className="mt-2 space-y-1">
                {matches.map(s => <button key={s.id} onClick={() => { setStudentId(s.id); setQ(s.name); }} className={`w-full flex justify-between rounded-lg border px-3 py-2 text-sm text-left ${studentId === s.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}><span>{s.name}</span><span className="text-xs text-muted-foreground">{s.className}</span></button>)}
              </div>
              {student && <div className="mt-3 rounded-lg bg-success/10 text-success p-2 text-xs">Selected: {student.name} ({student.className})</div>}
            </div>
          )}
          {step === 2 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="block text-xs font-semibold mb-1.5">Type *</label><select value={type} onChange={e => setType(e.target.value as any)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">{LEAVE_TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
              <div><label className="block text-xs font-semibold mb-1.5">Departure *</label><input type="date" value={dep} onChange={e => setDep(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" /></div>
              <div><label className="block text-xs font-semibold mb-1.5">Return *</label><input type="date" value={ret} onChange={e => setRet(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" /></div>
              <div className="col-span-2"><label className="block text-xs font-semibold mb-1.5">Destination</label><input value={destination} onChange={e => setDestination(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" /></div>
              <div className="col-span-2"><label className="block text-xs font-semibold mb-1.5">Contact Person</label><input value={contact} onChange={e => setContact(e.target.value)} placeholder={student?.parentName} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" /></div>
              <div className="col-span-2"><label className="block text-xs font-semibold mb-1.5">Reason *</label><textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="w-full rounded-lg border border-border bg-background p-3 text-sm" /></div>
            </div>
          )}
          {step === 3 && student && (
            <div className="space-y-2 text-sm">
              <div className="font-bold mb-2">Review</div>
              <div className="flex justify-between border-b border-border py-1.5"><span className="text-muted-foreground">Student</span><span className="font-semibold">{student.name}</span></div>
              <div className="flex justify-between border-b border-border py-1.5"><span className="text-muted-foreground">Type</span><span className="font-semibold">{LEAVE_TYPE_LABELS[type]}</span></div>
              <div className="flex justify-between border-b border-border py-1.5"><span className="text-muted-foreground">Dates</span><span className="font-semibold">{dep} → {ret}</span></div>
              <div className="flex justify-between border-b border-border py-1.5"><span className="text-muted-foreground">Destination</span><span className="font-semibold">{destination || "—"}</span></div>
              <div className="border-b border-border py-1.5"><div className="text-muted-foreground text-xs">Reason</div><div>{reason}</div></div>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-between">
          <button onClick={() => step > 1 ? setStep(step - 1) : onClose()} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">{step === 1 ? "Cancel" : "Back"}</button>
          {step < 3 ? (
            <button onClick={() => setStep(step + 1)} disabled={(step === 1 && !studentId) || (step === 2 && (!dep || !ret || !reason))} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold disabled:opacity-50">Next →</button>
          ) : (
            <button onClick={submit} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">Submit Request</button>
          )}
        </div>
      </div>
    </div>
  );
}
