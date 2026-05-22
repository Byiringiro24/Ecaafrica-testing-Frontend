import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, X, Check, Search } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { LEAVE_REQUESTS, STUDENTS, schoolConfig, type LeaveRequest } from "@/lib/mockData";

export const Route = createFileRoute("/leaves")({ component: LeavesPage });

const TABS = ["Pending","Approved","All History"] as const;

function LeavesPage() {
  const [tab, setTab] = useState<typeof TABS[number]>("Pending");
  const [requests, setRequests] = useState(LEAVE_REQUESTS);
  const [approving, setApproving] = useState<LeaveRequest | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const pending = requests.filter(r => r.status === "Pending").length;
  const approvedToday = requests.filter(r => r.status === "Approved").length;
  const out = requests.filter(r => r.status === "Approved" && r.returnDate >= new Date().toISOString().slice(0,10)).length;
  const returned = approvedToday - out;

  const filtered = useMemo(() => {
    if (tab === "All History") return requests;
    return requests.filter(r => r.status === tab);
  }, [requests, tab]);

  const onLeaveStudents = requests.filter(r => r.status === "Approved");

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
              {filtered.map((r, i) => (
                <tr key={r.id} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/30">
                  <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{r.studentName}</td>
                  <td className="px-4 py-3">{r.class}</td>
                  <td className="px-4 py-3 text-xs">{r.house}</td>
                  <td className="px-4 py-3 text-xs">{r.type}</td>
                  <td className="px-4 py-3 text-xs">{r.departureDate}</td>
                  <td className="px-4 py-3 text-xs">{r.returnDate}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[180px] truncate">{r.reason}</td>
                  <td className="px-4 py-3"><LeaveStatus v={r.status} /></td>
                  <td className="px-4 py-3 space-x-1.5 whitespace-nowrap">
                    {r.status === "Pending" ? (<>
                      <button onClick={() => setApproving(r)} className="text-xs font-semibold text-success hover:underline">✅ Approve</button>
                    </>) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5">
        <h2 className="font-display font-bold text-lg mb-3">Students Currently on Leave</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {onLeaveStudents.slice(0, 6).map(r => {
            const overdue = r.returnDate < new Date().toISOString().slice(0,10);
            return (
              <div key={r.id} className={`rounded-xl border ${overdue ? "border-destructive bg-destructive/5" : "border-border bg-card"} p-4`}>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary font-bold text-xs">{r.studentName.split(" ").map(p => p[0]).join("").slice(0,2)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{r.studentName}</div>
                    <div className="text-xs text-muted-foreground">{r.class} · {r.house}</div>
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

      {approving && <ApproveModal req={approving} onClose={() => setApproving(null)} onConfirm={() => { setRequests(p => p.map(x => x.id === approving.id ? { ...x, status: "Approved" } : x)); toast.success(`Leave approved & SMS sent to ${approving.contactPerson}`); setApproving(null); }} />}
      {newOpen && <NewLeaveModal onClose={() => setNewOpen(false)} onCreate={(req) => { setRequests(p => [req, ...p]); toast.success("Leave request submitted (Pending)"); setNewOpen(false); }} />}
    </AppLayout>
  );
}

function LeaveStatus({ v }: { v: LeaveRequest["status"] }) {
  const map = { Pending: "bg-amber-100 text-amber-700", Approved: "bg-success/15 text-success", Rejected: "bg-destructive/15 text-destructive" };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${map[v]}`}>{v}</span>;
}

function ApproveModal({ req, onClose, onConfirm }: { req: LeaveRequest; onClose: () => void; onConfirm: () => void }) {
  const [authBy, setAuthBy] = useState("Warden");
  const [sms, setSms] = useState(true);
  const preview = `Dear ${req.contactPerson}, your child ${req.studentName} has been granted ${req.type} from ${req.departureDate} to ${req.returnDate}. — ${schoolConfig.schoolName}`;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex justify-between items-center"><h3 className="font-display font-bold">Approve Leave Request</h3><button onClick={onClose}><X className="h-4 w-4" /></button></div>
        <div className="px-6 py-5 space-y-4">
          <div className="rounded-lg bg-muted/40 p-3">
            <div className="font-bold">{req.studentName}</div>
            <div className="text-xs text-muted-foreground mt-1">{req.class} · {req.house}</div>
            <div className="text-xs text-muted-foreground">Parent: {req.contactPerson} · {req.parentPhone}</div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground text-xs">Type:</span> <div className="font-semibold">{req.type}</div></div>
            <div><span className="text-muted-foreground text-xs">Destination:</span> <div className="font-semibold">{req.destination}</div></div>
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

function NewLeaveModal({ onClose, onCreate }: { onClose: () => void; onCreate: (r: LeaveRequest) => void }) {
  const [step, setStep] = useState(1);
  const [studentId, setStudentId] = useState("");
  const [q, setQ] = useState("");
  const [type, setType] = useState<LeaveRequest["type"]>("Weekend Leave");
  const [dep, setDep] = useState("");
  const [ret, setRet] = useState("");
  const [reason, setReason] = useState("");
  const [destination, setDestination] = useState("");
  const [contact, setContact] = useState("");

  const matches = STUDENTS.filter(s => q && s.name.toLowerCase().includes(q.toLowerCase())).slice(0, 5);
  const student = STUDENTS.find(s => s.id === studentId);

  const submit = () => {
    if (!student) return;
    onCreate({
      id: `LV-${Date.now()}`, studentId: student.id, studentName: student.name, class: student.class,
      house: "Day Scholar", type, departureDate: dep, returnDate: ret, reason, destination,
      contactPerson: contact || student.parentName, parentPhone: student.parentPhone, status: "Pending", requestedBy: contact || student.parentName,
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
          <div><h3 className="font-display font-bold">New Leave Request</h3><div className="text-xs text-muted-foreground">Step {step} of 3</div></div>
          <button onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-3 min-h-[260px]">
          {step === 1 && (
            <div>
              <label className="block text-xs font-semibold mb-1.5">Search Student *</label>
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Type a name..." className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" /></div>
              <div className="mt-2 space-y-1">
                {matches.map(s => <button key={s.id} onClick={() => { setStudentId(s.id); setQ(s.name); }} className={`w-full flex justify-between rounded-lg border px-3 py-2 text-sm text-left ${studentId === s.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}><span>{s.name}</span><span className="text-xs text-muted-foreground">{s.class}</span></button>)}
              </div>
              {student && <div className="mt-3 rounded-lg bg-success/10 text-success p-2 text-xs">Selected: {student.name} ({student.class})</div>}
            </div>
          )}
          {step === 2 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="block text-xs font-semibold mb-1.5">Type *</label><select value={type} onChange={e => setType(e.target.value as any)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">{["Weekend Leave","Medical Leave","Family Emergency","School Trip","Day Exeat","Holiday Leave"].map(t => <option key={t}>{t}</option>)}</select></div>
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
              <div className="flex justify-between border-b border-border py-1.5"><span className="text-muted-foreground">Type</span><span className="font-semibold">{type}</span></div>
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
