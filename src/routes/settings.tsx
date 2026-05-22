import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Building2, MessageSquare, Calendar, Fingerprint, Users, Database,
  Eye, EyeOff, Plus, Trash2, Upload, X,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { BiometricEnrollModal } from "@/components/modals/BiometricEnrollModal";
import { biometricStats, BIOMETRIC_PROFILES, STUDENTS } from "@/lib/mockData";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

const TABS = [
  { id: "school", label: "School Information", icon: Building2 },
  { id: "sms", label: "SMS Configuration", icon: MessageSquare },
  { id: "calendar", label: "Academic Calendar", icon: Calendar },
  { id: "biometric", label: "Biometric Configuration", icon: Fingerprint },
  { id: "users", label: "User Accounts", icon: Users },
  { id: "system", label: "System & Data", icon: Database },
] as const;

function SettingsPage() {
  const [tab, setTab] = useState<typeof TABS[number]["id"]>("school");

  return (
    <AppLayout title="System Settings" subtitle="Configure school, SMS, biometrics, and more">
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5">
        <nav className="rounded-xl border border-border bg-card p-2 shadow-sm h-fit">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold ${
                  tab === t.id ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                }`}>
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </nav>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {tab === "school" && <SchoolTab />}
          {tab === "sms" && <SMSTab />}
          {tab === "calendar" && <CalendarTab />}
          {tab === "biometric" && <BiometricTab />}
          {tab === "users" && <UsersTab />}
          {tab === "system" && <SystemTab />}
        </div>
      </div>
    </AppLayout>
  );
}

const inp = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm";

function SchoolTab() {
  return (
    <>
      <h3 className="font-display font-bold text-lg mb-4">School Information</h3>
      <div className="grid grid-cols-2 gap-4">
        <Field label="School Name" full><input className={inp} defaultValue="Groupe Scolaire de Kigali" /></Field>
        <Field label="School Logo" full>
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-lg border-2 border-dashed border-border grid place-items-center bg-muted/30">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <button className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">Upload Logo</button>
          </div>
        </Field>
        <Field label="Address" full><input className={inp} defaultValue="KK 15 Avenue, Kicukiro" /></Field>
        <Field label="District"><input className={inp} defaultValue="Kicukiro" /></Field>
        <Field label="Province"><input className={inp} defaultValue="Kigali City" /></Field>
        <Field label="Academic Year"><select className={inp}><option>2024–2025</option><option>2025–2026</option></select></Field>
        <Field label="Principal"><input className={inp} defaultValue="Dr. Mukamana Diane" /></Field>
      </div>
      <button onClick={() => toast.success("School info saved")} className="mt-5 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Save Changes</button>
    </>
  );
}

function SMSTab() {
  const [show, setShow] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const used = 1240, limit = 5000;
  return (
    <>
      <h3 className="font-display font-bold text-lg mb-4">SMS Configuration</h3>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Provider"><select className={inp}><option>Africa's Talking</option><option>Twilio</option><option>MTN SMS API</option></select></Field>
        <Field label="Sender ID / Short Code"><input className={inp} defaultValue="SmartAttend" /></Field>
        <Field label="API Key" full>
          <div className="relative">
            <input type={show ? "text" : "password"} className={inp} defaultValue="atsk_live_3f8c2d9b4e1a6f7c" />
            <button onClick={() => setShow(s => !s)} type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-muted">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        <Field label="Monthly SMS Limit" full><input type="number" className={inp} defaultValue={limit} /></Field>
      </div>

      <div className="mt-4 rounded-lg border border-border p-4">
        <div className="flex justify-between text-xs mb-2">
          <span className="font-semibold">SMS usage this month</span>
          <span className="text-muted-foreground">{used.toLocaleString()} / {limit.toLocaleString()}</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${(used/limit)*100}%` }} />
        </div>
      </div>

      <h4 className="font-display font-bold mt-6 mb-3">Notification Triggers</h4>
      <div className="space-y-2">
        {["Send SMS when student is marked Present","Send SMS when student is marked Absent","Send SMS when student is marked Late","Send daily summary to all parents"].map((l, i) => (
          <label key={l} className="flex items-center justify-between p-3 rounded-lg border border-border">
            <span className="text-sm">{l}</span>
            <input type="checkbox" defaultChecked={i !== 0} className="h-5 w-9 accent-primary" />
          </label>
        ))}
        <Field label="Daily summary time"><input type="time" defaultValue="17:00" className={inp} /></Field>
      </div>

      <h4 className="font-display font-bold mt-6 mb-3">Send Test SMS</h4>
      <div className="flex gap-2">
        <input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="+250 78X XXX XXX" className={inp} />
        <button onClick={() => testPhone ? toast.success(`Test SMS sent to ${testPhone}`) : toast.error("Enter a phone number")} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground whitespace-nowrap">Send Test</button>
      </div>

      <h4 className="font-display font-bold mt-6 mb-3">Default Templates</h4>
      <p className="text-xs text-muted-foreground mb-3">Variables: <code className="bg-muted px-1.5 py-0.5 rounded">{`{parentName} {studentName} {class} {status} {date} {time}`}</code></p>
      <div className="space-y-3">
        {(["Present","Absent","Late"] as const).map(s => (
          <Field key={s} label={`${s} template`} full>
            <textarea rows={2} className="w-full rounded-lg border border-border bg-background p-3 text-sm"
              defaultValue={`Mubyeyi {parentName}, umwana wanyu {studentName} wo mu {class} ${s.toLowerCase()} ku ishuri uyu munsi {date} saa {time}.`} />
          </Field>
        ))}
      </div>
      <button onClick={() => toast.success("SMS settings saved")} className="mt-5 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Save Changes</button>
    </>
  );
}

function CalendarTab() {
  const [holidays, setHolidays] = useState([
    { name: "Independence Day", start: "2025-07-01", end: "2025-07-01" },
    { name: "Liberation Day", start: "2025-07-04", end: "2025-07-04" },
    { name: "Christmas Holiday", start: "2025-12-22", end: "2026-01-05" },
  ]);
  const [name, setName] = useState(""); const [s, setS] = useState(""); const [e, setE] = useState("");
  return (
    <>
      <h3 className="font-display font-bold text-lg mb-4">Academic Calendar</h3>
      {[
        { t: "Term 1", s: "2025-01-13", e: "2025-04-04" },
        { t: "Term 2", s: "2025-04-28", e: "2025-07-18" },
        { t: "Term 3", s: "2025-09-08", e: "2025-12-19" },
      ].map(t => (
        <div key={t.t} className="grid grid-cols-3 gap-3 mb-3">
          <Field label={`${t.t} start`}><input type="date" defaultValue={t.s} className={inp} /></Field>
          <Field label={`${t.t} end`}><input type="date" defaultValue={t.e} className={inp} /></Field>
        </div>
      ))}

      <h4 className="font-display font-bold mt-6 mb-3">Holidays</h4>
      <div className="rounded-lg border border-border overflow-hidden mb-3">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr><th className="text-left px-3 py-2">Name</th><th className="text-left px-3 py-2">Start</th><th className="text-left px-3 py-2">End</th><th /></tr></thead>
          <tbody>
            {holidays.map((h, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-3 py-2">{h.name}</td>
                <td className="px-3 py-2">{h.start}</td>
                <td className="px-3 py-2">{h.end}</td>
                <td className="px-3 py-2 text-right"><button onClick={() => setHolidays(p => p.filter((_, j) => j !== i))} className="text-destructive hover:underline text-xs"><Trash2 className="h-3.5 w-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <input value={name} onChange={ev => setName(ev.target.value)} placeholder="Holiday name" className={inp} />
        <input type="date" value={s} onChange={ev => setS(ev.target.value)} className={inp} />
        <input type="date" value={e} onChange={ev => setE(ev.target.value)} className={inp} />
        <button onClick={() => { if (name && s && e) { setHolidays(p => [...p, { name, start: s, end: e }]); setName(""); setS(""); setE(""); } }}
          className="rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground inline-flex items-center justify-center gap-1"><Plus className="h-4 w-4" /> Add</button>
      </div>
      <button onClick={() => toast.success("Calendar saved")} className="mt-5 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Save Calendar</button>
    </>
  );
}

function BiometricTab() {
  const stats = biometricStats();
  const [enroll, setEnroll] = useState<{ mode: "face" | "fingerprint"; name?: string } | null>(null);
  const [unenrolledOpen, setUnenrolledOpen] = useState(false);
  const unenrolled = STUDENTS.filter(s => {
    const b = BIOMETRIC_PROFILES.find(p => p.studentId === s.id);
    return !b?.hasFace || !b?.hasFingerprint;
  });

  return (
    <>
      <h3 className="font-display font-bold text-lg mb-4">Biometric Configuration</h3>
      <div className="space-y-2 mb-5">
        {["Enable Face Recognition attendance","Enable Fingerprint attendance","Require biometric confirmation for card scan"].map((l, i) => (
          <label key={l} className="flex items-center justify-between p-3 rounded-lg border border-border">
            <span className="text-sm">{l}</span>
            <input type="checkbox" defaultChecked={i < 2} className="h-5 w-9 accent-primary" />
          </label>
        ))}
      </div>

      <h4 className="font-display font-bold mb-3">Enrollment Stats</h4>
      <div className="grid grid-cols-2 gap-4 mb-5">
        <ProgressCard icon="📷" label="Face enrolled" value={stats.face} total={stats.total} />
        <ProgressCard icon="👆" label="Fingerprint enrolled" value={stats.finger} total={stats.total} />
      </div>

      <button onClick={() => setUnenrolledOpen(true)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">View Unenrolled Students ({unenrolled.length})</button>

      <div className="mt-6 rounded-lg border border-border p-4">
        <div className="text-sm font-semibold mb-2">Face Recognition Confidence Threshold</div>
        <input type="range" min={70} max={99} defaultValue={85} className="w-full accent-primary" />
        <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>70% (Lenient)</span><span>99% (Strict)</span></div>
      </div>

      <button onClick={() => setEnroll({ mode: "face" })} className="mt-5 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Test Face Recognition</button>

      {enroll && <BiometricEnrollModal open mode={enroll.mode} studentName={enroll.name} onClose={() => setEnroll(null)} />}

      {unenrolledOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setUnenrolledOpen(false)}>
          <div className="bg-card rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col" onClick={ev => ev.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b border-border">
              <h3 className="font-display font-bold">Unenrolled Students</h3>
              <button onClick={() => setUnenrolledOpen(false)} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2">
              {unenrolled.map(s => {
                const b = BIOMETRIC_PROFILES.find(p => p.studentId === s.id);
                return (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div>
                      <div className="font-medium text-sm">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.class} • {b?.hasFace ? "✓" : "✗"} Face • {b?.hasFingerprint ? "✓" : "✗"} Finger</div>
                    </div>
                    <button onClick={() => setEnroll({ mode: !b?.hasFace ? "face" : "fingerprint", name: s.name })} className="text-xs font-semibold text-primary hover:underline">Enroll Now</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ProgressCard({ icon, label, value, total }: { icon: string; label: string; value: number; total: number }) {
  const pct = Math.round((value/total)*100);
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="text-sm font-semibold mb-2">{icon} {label}: <span className="text-primary">{value} / {total}</span></div>
      <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function UsersTab() {
  const users = [
    { name: "Mugisha Jean", email: "jean@gskigali.rw", role: "Super Admin", last: "Today 08:14", active: true },
    { name: "Uwase Diane", email: "diane@gskigali.rw", role: "Admin", last: "Yesterday", active: true },
    { name: "Habimana Eric", email: "eric@gskigali.rw", role: "Teacher", last: "2 days ago", active: true },
    { name: "Keza Sandrine", email: "sandrine@gskigali.rw", role: "Receptionist", last: "1 week ago", active: false },
  ];
  const [add, setAdd] = useState(false);
  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-display font-bold text-lg">User Accounts</h3>
        <button onClick={() => setAdd(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> Add User</button>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{["Name","Email","Role","Last Login","Status","Actions"].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={i} className="border-t border-border odd:bg-background even:bg-muted/20">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3"><span className="rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-semibold">{u.role}</span></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{u.last}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${u.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{u.active ? "Active" : "Inactive"}</span></td>
                <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                  <button onClick={() => toast.info("Edit role…")} className="text-xs font-semibold text-primary hover:underline">Edit Role</button>
                  <button onClick={() => toast.success(`${u.name} ${u.active ? "deactivated" : "activated"}`)} className="text-xs font-semibold text-destructive hover:underline">{u.active ? "Deactivate" : "Activate"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {add && (
        <div className="fixed inset-0 z-[55] grid place-items-center bg-black/50 p-4" onClick={() => setAdd(false)}>
          <div className="bg-card rounded-2xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b border-border"><h3 className="font-display font-bold">Add User</h3><button onClick={() => setAdd(false)} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button></div>
            <div className="p-6 space-y-4">
              <Field label="Full Name" full><input className={inp} placeholder="e.g. Mukamana Grace" /></Field>
              <Field label="Email" full><input type="email" className={inp} placeholder="user@gskigali.rw" /></Field>
              <Field label="Role" full><select className={inp}><option>Super Admin</option><option>Admin</option><option>Teacher</option><option>Receptionist</option></select></Field>
              <button onClick={() => { toast.success("Invitation sent"); setAdd(false); }} className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Send Invite</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SystemTab() {
  const [confirmClear, setConfirmClear] = useState(false);
  return (
    <>
      <h3 className="font-display font-bold text-lg mb-4">System & Data</h3>
      <div className="space-y-3">
        <button onClick={() => toast.success("Student data exported (CSV)")} className="w-full text-left p-4 rounded-lg border border-border hover:bg-muted">
          <div className="font-semibold text-sm">Export all student data (CSV)</div>
          <div className="text-xs text-muted-foreground mt-1">Includes all 60 students, parent contacts, and class assignments</div>
        </button>
        <div className="p-4 rounded-lg border border-border">
          <div className="font-semibold text-sm mb-2">Export attendance records</div>
          <div className="flex gap-2">
            <input type="date" className={inp} />
            <input type="date" className={inp} />
            <button onClick={() => toast.success("Attendance exported (CSV)")} className="rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground whitespace-nowrap">Export</button>
          </div>
        </div>
        <div className="p-4 rounded-lg border border-destructive/40 bg-destructive/5">
          <div className="font-semibold text-sm text-destructive mb-1">⚠️ Danger Zone</div>
          <div className="text-xs text-muted-foreground mb-3">Permanently clear today's attendance records. This action cannot be undone.</div>
          <button onClick={() => setConfirmClear(true)} className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground">Clear Today's Attendance</button>
        </div>
        <div className="p-4 rounded-lg border border-border bg-muted/20 text-xs text-muted-foreground">
          SmartAttend v2.1.0 — © 2025 Rwanda Secondary School System
        </div>
      </div>
      <ConfirmModal open={confirmClear} title="Clear Attendance" message="This will delete today's attendance records permanently. Are you sure?" danger confirmLabel="Yes, clear"
        onConfirm={() => toast.success("Today's attendance cleared")} onClose={() => setConfirmClear(false)} />
    </>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={`block ${full ? "col-span-2" : ""}`}><span className="text-xs font-semibold mb-1.5 block">{label}</span>{children}</label>;
}
