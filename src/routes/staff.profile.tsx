import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Phone, Building2, Calendar, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { StaffLayout } from "@/components/layout/StaffLayout";
import { STAFF_ME } from "@/lib/teacherStaffData";

export const Route = createFileRoute("/staff/profile")({ component: StaffProfile });

function StaffProfile() {
  const [tab, setTab] = useState<"personal" | "work" | "security">("personal");
  return (
    <StaffLayout title="My Profile">
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm h-fit text-center">
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-primary text-primary-foreground font-bold text-3xl mb-3">{STAFF_ME.initials}</div>
          <h2 className="font-display font-bold text-lg">{STAFF_ME.name}</h2>
          <div className="text-xs text-muted-foreground">{STAFF_ME.employeeId}</div>
          <div className="flex justify-center gap-2 mt-3">
            <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-indigo-100 text-indigo-800">{STAFF_ME.role}</span>
          </div>
          <div className="mt-5 space-y-2 text-sm text-left">
            <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {STAFF_ME.email}</div>
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {STAFF_ME.phone}</div>
            <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" /> {STAFF_ME.department}</div>
            <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> Joined {STAFF_ME.dateJoined}</div>
          </div>
          <button className="mt-5 w-full h-9 rounded-md bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2"><Pencil className="h-4 w-4" /> Edit Profile</button>
        </div>
        <div className="lg:col-span-2 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex border-b border-border">
            {(["personal", "work", "security"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-semibold capitalize border-b-2 ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{t === "personal" ? "Personal Info" : t === "work" ? "Work Info" : "Security"}</button>
            ))}
          </div>
          <div className="p-6">
            {tab === "personal" && (
              <form className="grid sm:grid-cols-2 gap-4 text-sm" onSubmit={e => { e.preventDefault(); toast.success("Profile updated"); }}>
                {[["Full Name", STAFF_ME.name], ["Date of Birth", "1980-09-22"], ["Gender", "Male"], ["National ID", "1198080055667788"], ["Address", "Kicukiro, Kigali"], ["Emergency Contact", "+250 788 555 444"]].map(([l, v]) => (
                  <div key={l}><label className="text-xs font-semibold text-muted-foreground">{l}</label><input defaultValue={v} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" /></div>
                ))}
                <div className="sm:col-span-2 flex justify-end"><button className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold">Save Changes</button></div>
              </form>
            )}
            {tab === "work" && (
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                {[["Employee ID", STAFF_ME.employeeId], ["Department", STAFF_ME.department], ["Position", STAFF_ME.role], ["Date Joined", STAFF_ME.dateJoined], ["Contract Type", "Permanent"], ["Section", STAFF_ME.section]].map(([l, v]) => (
                  <div key={l}><div className="text-xs font-semibold text-muted-foreground">{l}</div><div className="mt-1 h-9 px-3 grid items-center rounded-md bg-muted text-sm">{v}</div></div>
                ))}
              </div>
            )}
            {tab === "security" && <PwdForm />}
          </div>
        </div>
      </div>
    </StaffLayout>
  );
}
function PwdForm() {
  const [loading, setLoading] = useState(false);
  return (
    <form className="space-y-4 max-w-md" onSubmit={async e => { e.preventDefault(); setLoading(true); await new Promise(r => setTimeout(r, 500)); setLoading(false); toast.success("Password updated"); }}>
      <div><label className="text-sm font-medium">Current Password</label><input type="password" required className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" /></div>
      <div><label className="text-sm font-medium">New Password</label><input type="password" required className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" /></div>
      <div><label className="text-sm font-medium">Confirm</label><input type="password" required className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" /></div>
      <button disabled={loading} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2">{loading && <Loader2 className="h-4 w-4 animate-spin" />} Update</button>
    </form>
  );
}
