import { useState } from "react";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import {
  Building2, MessageSquare, Calendar, User, Database,
  Plus, Trash2, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

const TABS = [
  { id: "school", label: "School Information", icon: Building2 },
  { id: "sms", label: "SMS Configuration", icon: MessageSquare },
  { id: "calendar", label: "Academic Calendar", icon: Calendar },
  { id: "profile", label: "Profile Settings", icon: User },
  { id: "logs", label: "User logs", icon: Database },
] as const;

function SettingsPage() {
  const search = useRouterState({ select: (s) => s.location.search });
  const [tab, setTab] = useState<typeof TABS[number]["id"]>(() => {
    const tabParam = new URLSearchParams(search ?? "").get("tab");
    return TABS.some(t => t.id === tabParam) ? (tabParam as typeof TABS[number]["id"]) : "school";
  });

  return (
    <AppLayout title="System Settings" subtitle="Configure school, SMS, and user access">
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
          {tab === "profile" && <ProfileTab />}
          {tab === "logs" && <UserLogsTab />}
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
  const used = 1240, limit = 5000;
  return (
    <>
      <h3 className="font-display font-bold text-lg mb-4">SMS Configuration</h3>
      <div className="grid grid-cols-2 gap-4">
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

function ProfileTab() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSave = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Fill in all password fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    toast.success("Password updated");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <>
      <h3 className="font-display font-bold text-lg mb-4">Profile Settings</h3>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Current Password" full>
          <input
            type="password"
            className={inp}
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
          />
        </Field>
        <Field label="New Password" full>
          <input
            type="password"
            className={inp}
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
          />
        </Field>
        <Field label="Confirm New Password" full>
          <input
            type="password"
            className={inp}
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
          />
        </Field>
      </div>
      <button onClick={handleSave} className="mt-5 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
        Save Password
      </button>
    </>
  );
}

function UserLogsTab() {
  const logs = [
    { user: "Mugisha Jean", role: "Super Admin", action: "Updated fee settings", time: "Today 08:14", ip: "10.0.0.12" },
    { user: "Uwase Diane", role: "Admin", action: "Approved leave request", time: "Today 07:55", ip: "10.0.0.23" },
    { user: "Habimana Eric", role: "Teacher", action: "Marked attendance", time: "Yesterday", ip: "10.0.0.31" },
    { user: "Keza Sandrine", role: "Receptionist", action: "Registered visitor", time: "1 week ago", ip: "10.0.0.44" },
  ];
  return (
    <>
      <h3 className="font-display font-bold text-lg mb-4">User logs</h3>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>{["User","Role","Action","Time","IP"].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {logs.map((l, i) => (
              <tr key={i} className="border-t border-border odd:bg-background even:bg-muted/20">
                <td className="px-4 py-3 font-medium">{l.user}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{l.role}</td>
                <td className="px-4 py-3">{l.action}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{l.time}</td>
                <td className="px-4 py-3 font-mono text-xs">{l.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={`block ${full ? "col-span-2" : ""}`}><span className="text-xs font-semibold mb-1.5 block">{label}</span>{children}</label>;
}
