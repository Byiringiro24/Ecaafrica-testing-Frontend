import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Plus, Grid3X3, List, X, Phone, Mail, Calendar, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { STAFF, STAFF_ATTENDANCE, type Staff } from "@/lib/mockData";

export const Route = createFileRoute("/staff/")({ component: StaffPage });

const TABS = ["All Staff", "Staff Attendance", "Departments"] as const;
const DEPARTMENTS = ["Teaching", "Administration", "Boarding", "Finance", "Support"];

function StaffPage() {
  const [tab, setTab] = useState<typeof TABS[number]>("All Staff");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("All");
  const [status, setStatus] = useState("All");
  const [profile, setProfile] = useState<Staff | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);

  const filtered = useMemo(() => STAFF.filter(s =>
    (q === "" || s.name.toLowerCase().includes(q.toLowerCase()) || s.id.toLowerCase().includes(q.toLowerCase())) &&
    (dept === "All" || s.department === dept) &&
    (status === "All" || s.status === status)
  ), [q, dept, status]);

  const teaching = STAFF.filter(s => s.role === "Teacher").length;
  const nonTeaching = STAFF.length - teaching;
  const activeToday = STAFF_ATTENDANCE.filter(a => a.status === "Present" || a.status === "Late").length;

  return (
    <AppLayout title="Staff Management" subtitle="Teaching and non-teaching staff directory">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total Staff" value={STAFF.length} />
        <StatCard label="Teaching Staff" value={teaching} />
        <StatCard label="Non-Teaching Staff" value={nonTeaching} />
        <StatCard label="Active Today" value={activeToday} />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border mb-4">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
        <div className="ml-auto pb-2">
          <button onClick={() => setRegisterOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-semibold hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Register Staff
          </button>
        </div>
      </div>

      {tab === "All Staff" && (
        <>
          <div className="flex flex-wrap gap-2 items-center mb-4">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or staff ID..."
                className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" />
            </div>
            <select value={dept} onChange={e => setDept(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
              <option>All</option>{DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
            </select>
            <select value={status} onChange={e => setStatus(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
              <option>All</option><option>Active</option><option>On Leave</option><option>Inactive</option>
            </select>
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button onClick={() => setView("grid")} className={`p-2 ${view === "grid" ? "bg-primary text-primary-foreground" : "bg-background"}`}><Grid3X3 className="h-4 w-4" /></button>
              <button onClick={() => setView("table")} className={`p-2 ${view === "table" ? "bg-primary text-primary-foreground" : "bg-background"}`}><List className="h-4 w-4" /></button>
            </div>
          </div>

          {view === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(s => <StaffCard key={s.id} staff={s} onView={() => setProfile(s)} />)}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>{["Name","Staff ID","Role","Department","Phone","Join Date","Status",""].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {filtered.map(s => (
                      <tr key={s.id} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/30">
                        <td className="px-4 py-3 font-medium">{s.name}</td>
                        <td className="px-4 py-3 font-mono text-xs">{s.id}</td>
                        <td className="px-4 py-3">{s.role}</td>
                        <td className="px-4 py-3">{s.department}</td>
                        <td className="px-4 py-3 font-mono text-xs">{s.phone}</td>
                        <td className="px-4 py-3 text-xs">{s.joinDate}</td>
                        <td className="px-4 py-3"><StatusPill v={s.status} /></td>
                        <td className="px-4 py-3"><button onClick={() => setProfile(s)} className="text-xs font-semibold text-primary hover:underline">View</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "Staff Attendance" && <StaffAttendanceTab />}
      {tab === "Departments" && <DepartmentsTab onPick={(d) => { setTab("All Staff"); setDept(d); }} />}

      {profile && <StaffProfileSlideOver staff={profile} onClose={() => setProfile(null)} />}
      {registerOpen && <RegisterStaffModal onClose={() => setRegisterOpen(false)} />}
    </AppLayout>
  );
}

function StaffCard({ staff, onView }: { staff: Staff; onView: () => void }) {
  const initials = staff.name.split(" ").map(p => p[0]).join("").slice(0, 2);
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary font-bold">{initials}</div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{staff.name}</div>
          <div className="text-xs text-muted-foreground">{staff.role} ┬╖ {staff.department}</div>
        </div>
        <button className="rounded p-1 hover:bg-muted"><MoreVertical className="h-4 w-4 text-muted-foreground" /></button>
      </div>
      <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2"><Phone className="h-3 w-3" /> {staff.phone}</div>
        <div className="flex items-center gap-2 truncate"><Mail className="h-3 w-3" /> {staff.email}</div>
        <div className="flex items-center gap-2"><Calendar className="h-3 w-3" /> Joined {staff.joinDate}</div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <StatusPill v={staff.status} />
        <button onClick={onView} className="text-xs font-semibold text-primary hover:underline">View Profile</button>
      </div>
    </div>
  );
}

function StatusPill({ v }: { v: Staff["status"] }) {
  const map = { Active: "bg-success/15 text-success", "On Leave": "bg-amber-100 text-amber-700", Inactive: "bg-muted text-muted-foreground" };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${map[v]}`}>{v}</span>;
}

function StaffAttendanceTab() {
  const present = STAFF_ATTENDANCE.filter(a => a.status === "Present").length;
  const absent = STAFF_ATTENDANCE.filter(a => a.status === "Absent").length;
  const late = STAFF_ATTENDANCE.filter(a => a.status === "Late").length;
  const onLeave = STAFF_ATTENDANCE.filter(a => a.status === "On Leave").length;
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard label="Present" value={present} tone="success" />
        <StatCard label="Absent" value={absent} tone="destructive" />
        <StatCard label="Late" value={late} />
        <StatCard label="On Leave" value={onLeave} />
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{["Name","Role","Department","Check-in","Status"].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
            <tbody>
              {STAFF.map(s => {
                const a = STAFF_ATTENDANCE.find(x => x.staffId === s.id)!;
                return (
                  <tr key={s.id} className="border-t border-border odd:bg-background even:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3">{s.role}</td>
                    <td className="px-4 py-3">{s.department}</td>
                    <td className="px-4 py-3 font-mono text-xs">{a.checkIn}</td>
                    <td className="px-4 py-3"><AttPill v={a.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AttPill({ v }: { v: string }) {
  const map: Record<string,string> = { Present: "bg-success/15 text-success", Absent: "bg-destructive/15 text-destructive", Late: "bg-amber-100 text-amber-700", "On Leave": "bg-blue-100 text-blue-700" };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${map[v]}`}>{v}</span>;
}

function DepartmentsTab({ onPick }: { onPick: (d: string) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {DEPARTMENTS.map(d => {
        const staff = STAFF.filter(s => s.department === d);
        const head = staff[0];
        return (
          <div key={d} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="font-display font-bold text-lg">{d}</div>
            <div className="text-xs text-muted-foreground mt-1">Head: {head?.name ?? "ΓÇö"}</div>
            <div className="text-3xl font-display font-bold mt-3 text-primary">{staff.length}</div>
            <div className="text-xs text-muted-foreground">staff members</div>
            <button onClick={() => onPick(d)} className="mt-3 text-xs font-semibold text-primary hover:underline">View Staff ΓåÆ</button>
          </div>
        );
      })}
    </div>
  );
}

function StaffProfileSlideOver({ staff, onClose }: { staff: Staff; onClose: () => void }) {
  const att = STAFF_ATTENDANCE.find(a => a.staffId === staff.id);
  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-card shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex justify-between items-center sticky top-0 bg-card">
          <h3 className="font-display font-bold">Staff Profile</h3>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary font-display font-bold text-xl">{staff.name.split(" ").map(p => p[0]).join("").slice(0,2)}</div>
            <div>
              <div className="font-display font-bold text-lg">{staff.name}</div>
              <div className="text-sm text-muted-foreground">{staff.role}</div>
              <StatusPill v={staff.status} />
            </div>
          </div>
          <Section title="Personal & Contact">
            <Row k="Staff ID" v={staff.id} />
            <Row k="Gender" v={staff.gender} />
            <Row k="Phone" v={staff.phone} />
            <Row k="Email" v={staff.email} />
          </Section>
          <Section title="Employment">
            <Row k="Department" v={staff.department} />
            <Row k="Join Date" v={staff.joinDate} />
            <Row k="Contract" v={staff.contractType} />
            {staff.subjects && <Row k="Subjects" v={staff.subjects.join(", ")} />}
          </Section>
          <Section title="Attendance Today">
            <Row k="Check-in" v={att?.checkIn ?? "ΓÇö"} />
            <Row k="Status" v={att?.status ?? "ΓÇö"} />
          </Section>
          <Section title="Documents">
            <div className="grid grid-cols-3 gap-2">
              {["Contract","ID Copy","Certificate"].map(d => (
                <div key={d} className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">{d}</div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase font-bold text-muted-foreground mb-2">{title}</div>
      <div className="space-y-1.5 text-sm">{children}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="font-semibold text-right">{v}</span></div>;
}

function RegisterStaffModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState({ name: "", gender: "Male", dob: "", nationalId: "", phone: "", email: "", address: "", emergency: "", role: "Teacher", department: "Teaching", joinDate: "", contract: "Permanent", subjects: [] as string[], generateLogin: true, sendEmail: true });
  const update = (k: string, v: any) => setData(p => ({ ...p, [k]: v }));
  const valid1 = data.name && data.phone && data.email;
  const valid2 = data.role && data.joinDate;
  const submit = () => { toast.success(`Staff ${data.name} registered with ID STF-2025-${String(STAFF.length + 1).padStart(3,"0")}`); onClose(); };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl max-w-2xl w-full" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
          <div>
            <h3 className="font-display font-bold">Register New Staff</h3>
            <div className="text-xs text-muted-foreground">Step {step} of 4</div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-2"><div className="h-1 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${step * 25}%` }} /></div></div>
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Full Name *" value={data.name} onChange={(v: any) => update("name", v)} required />
              <Field label="Gender" type="select" value={data.gender} onChange={(v: any) => update("gender", v)} options={["Male","Female"]} />
              <Field label="Date of Birth" type="date" value={data.dob} onChange={(v: any) => update("dob", v)} />
              <Field label="National ID" value={data.nationalId} onChange={(v: any) => update("nationalId", v)} />
              <Field label="Phone *" value={data.phone} onChange={(v: any) => update("phone", v)} placeholder="+250 7XX XXX XXX" required />
              <Field label="Email *" value={data.email} onChange={(v: any) => update("email", v)} required />
              <Field label="Address" value={data.address} onChange={(v: any) => update("address", v)} />
              <Field label="Emergency Contact" value={data.emergency} onChange={(v: any) => update("emergency", v)} />
            </div>
          )}
          {step === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Staff ID (auto)" value={`STF-2025-${String(STAFF.length + 1).padStart(3,"0")}`} onChange={() => {}} disabled />
              <Field label="Role *" type="select" value={data.role} onChange={(v: any) => update("role", v)} options={["Teacher","Admin","Warden","Accountant","Librarian","Guard","Cleaner","Driver","Cook"]} />
              <Field label="Department" type="select" value={data.department} onChange={(v: any) => update("department", v)} options={DEPARTMENTS} />
              <Field label="Join Date *" type="date" value={data.joinDate} onChange={(v: any) => update("joinDate", v)} required />
              <Field label="Contract Type" type="select" value={data.contract} onChange={(v: any) => update("contract", v)} options={["Permanent","Contract","Part-time"]} />
              {data.role === "Teacher" && (
                <div className="md:col-span-2">
                  <div className="text-xs font-semibold text-muted-foreground mb-1.5">Subjects</div>
                  <div className="flex flex-wrap gap-1.5">
                    {["Mathematics","Physics","Chemistry","Biology","English","Kinyarwanda","French","History","Geography","ICT"].map(s => {
                      const active = data.subjects.includes(s);
                      return (
                        <button key={s} onClick={() => update("subjects", active ? data.subjects.filter(x => x !== s) : [...data.subjects, s])}
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{s}</button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          {step === 3 && (
            <div className="space-y-3">
              <Toggle label="Generate login credentials" checked={data.generateLogin} onChange={(v: any) => update("generateLogin", v)} />
              <Toggle label="Send welcome email" checked={data.sendEmail} onChange={(v: any) => update("sendEmail", v)} />
              <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">Permissions follow the role definition. Manage in Settings ΓåÆ Roles & Permissions.</div>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-2 text-sm">
              <div className="font-semibold mb-2">Review</div>
              {Object.entries(data).filter(([,v]) => typeof v !== "boolean").map(([k,v]: [string, any]) => (
                <div key={k} className="flex justify-between border-b border-border py-1.5"><span className="text-muted-foreground capitalize">{k}</span><span className="font-medium">{Array.isArray(v) ? v.join(", ") : String(v) || "ΓÇö"}</span></div>
              ))}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-between">
          <button onClick={() => step > 1 ? setStep(step - 1) : onClose()} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">{step === 1 ? "Cancel" : "Back"}</button>
          {step < 4 ? (
            <button onClick={() => setStep(step + 1)} disabled={(step === 1 && !valid1) || (step === 2 && !valid2)} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">Next ΓåÆ</button>
          ) : (
            <button onClick={submit} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90">Register Staff</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", options, placeholder, required, disabled }: any) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{label}</label>
      {type === "select" ? (
        <select value={value} onChange={e => onChange(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
          {options.map((o: string) => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
          className={`h-10 w-full rounded-lg border bg-background px-3 text-sm disabled:opacity-60 ${required && !value ? "border-destructive" : "border-border"}`} />
      )}
    </div>
  );
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-border p-3 cursor-pointer">
      <span className="text-sm font-medium">{label}</span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="h-4 w-4" />
    </label>
  );
}
