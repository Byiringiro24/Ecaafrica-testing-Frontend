import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, Calendar, Database, MessageSquare, Plus, Upload, User } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

type TabId = "school" | "sms" | "calendar" | "profile" | "system";

type AcademicYear = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
};

const tabs: Array<{ id: TabId; label: string; icon: typeof Building2 }> = [
  { id: "school", label: "School", icon: Building2 },
  { id: "sms", label: "SMS", icon: MessageSquare },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "profile", label: "Profile", icon: User },
  { id: "system", label: "System", icon: Database },
];

function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("school");

  return (
    <AppLayout title="Settings" subtitle="Configure school, communication, calendar, and account preferences">
      <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-border bg-background p-2">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={[
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
                active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>

      {activeTab === "school" && <SchoolTab />}
      {activeTab === "sms" && <SMSTab />}
      {activeTab === "calendar" && <CalendarTab />}
      {activeTab === "profile" && <ProfileTab />}
      {activeTab === "system" && <SystemTab />}
    </AppLayout>
  );
}

function SchoolTab() {
  const [schoolName, setSchoolName] = useState("Education Care Africa");
  const [address, setAddress] = useState("Kigali, Rwanda");
  const [district, setDistrict] = useState("Gasabo");
  const [province, setProvince] = useState("Kigali City");
  const [principal, setPrincipal] = useState("Dr. Niyomugabo Jean");
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([
    { id: "ay-1", name: "2025/2026", startDate: "2025-09-01", endDate: "2026-06-30", isCurrent: true },
    { id: "ay-2", name: "2024/2025", startDate: "2024-09-02", endDate: "2025-06-28", isCurrent: false },
  ]);
  const [yearName, setYearName] = useState("");
  const [yearStart, setYearStart] = useState("");
  const [yearEnd, setYearEnd] = useState("");
  const [yearCurrent, setYearCurrent] = useState(true);

  const currentYear = useMemo(() => academicYears.find((year) => year.isCurrent), [academicYears]);

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(String(reader.result ?? ""));
      toast.success("Logo loaded");
    };
    reader.readAsDataURL(file);
  };

  const handleAddYear = () => {
    if (!yearName.trim() || !yearStart || !yearEnd) {
      toast.error("Name, start date, and end date are required");
      return;
    }

    setAcademicYears((prev) => {
      const next = yearCurrent ? prev.map((year) => ({ ...year, isCurrent: false })) : prev;
      return [
        ...next,
        {
          id: `ay-${Date.now()}`,
          name: yearName.trim(),
          startDate: yearStart,
          endDate: yearEnd,
          isCurrent: yearCurrent,
        },
      ];
    });

    setYearName("");
    setYearStart("");
    setYearEnd("");
    setYearCurrent(true);
    toast.success("Academic year added");
  };

  const handleSetCurrent = (id: string) => {
    setAcademicYears((prev) => prev.map((year) => ({ ...year, isCurrent: year.id === id })));
    toast.success("Academic year updated");
  };

  const handleDeleteYear = (id: string) => {
    setAcademicYears((prev) => prev.filter((year) => year.id !== id));
    toast.success("Academic year deleted");
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 rounded-2xl border border-border bg-background p-5 lg:grid-cols-2">
        <div className="space-y-4">
          <h3 className="font-display text-lg font-bold">School Details</h3>
          <Field label="School name">
            <input value={schoolName} onChange={(event) => setSchoolName(event.target.value)} className={inputClass} />
          </Field>
          <Field label="Address">
            <input value={address} onChange={(event) => setAddress(event.target.value)} className={inputClass} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="District">
              <input value={district} onChange={(event) => setDistrict(event.target.value)} className={inputClass} />
            </Field>
            <Field label="Province">
              <input value={province} onChange={(event) => setProvince(event.target.value)} className={inputClass} />
            </Field>
          </div>
          <Field label="Principal">
            <input value={principal} onChange={(event) => setPrincipal(event.target.value)} className={inputClass} />
          </Field>
        </div>

        <div className="space-y-4 rounded-2xl border border-border bg-muted/20 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">School logo</p>
            <p className="mt-2 text-sm text-muted-foreground">Upload a square logo for the school profile and receipts.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background">
              {logoPreview ? (
                <img src={logoPreview} alt="School logo preview" className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-background">
              <Upload className="h-4 w-4" />
              Upload logo
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </label>
          </div>
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current academic year</p>
            <p className="mt-2 text-lg font-semibold">{currentYear?.name ?? "No academic year"}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-background p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-lg font-bold">Academic Years</h3>
            <p className="text-sm text-muted-foreground">Create a new academic year or change the active one.</p>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">{academicYears.length} records</span>
        </div>

        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Start</th>
                <th className="px-3 py-2">End</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {academicYears.map((year) => (
                <tr key={year.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{year.name}</td>
                  <td className="px-3 py-2">{year.startDate}</td>
                  <td className="px-3 py-2">{year.endDate}</td>
                  <td className="px-3 py-2">
                    {year.isCurrent ? (
                      <span className="text-xs font-semibold text-success">Current</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Inactive</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!year.isCurrent && (
                      <button type="button" onClick={() => handleSetCurrent(year.id)} className="mr-3 text-xs font-semibold text-primary hover:underline">
                        Set current
                      </button>
                    )}
                    <button type="button" onClick={() => handleDeleteYear(year.id)} className="text-xs font-semibold text-destructive hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {academicYears.length === 0 && (
                <tr className="border-t border-border">
                  <td colSpan={5} className="px-3 py-3 text-xs text-muted-foreground">
                    No academic years yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Name">
            <input value={yearName} onChange={(event) => setYearName(event.target.value)} className={inputClass} placeholder="2025/2026" />
          </Field>
          <Field label="Start date">
            <input type="date" value={yearStart} onChange={(event) => setYearStart(event.target.value)} className={inputClass} />
          </Field>
          <Field label="End date">
            <input type="date" value={yearEnd} onChange={(event) => setYearEnd(event.target.value)} className={inputClass} />
          </Field>
          <Toggle label="Set as current" checked={yearCurrent} onChange={setYearCurrent} />
        </div>

        <button type="button" onClick={handleAddYear} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" />
          Add academic year
        </button>
      </section>
    </div>
  );
}

function SMSTab() {
  const [monthlyLimit, setMonthlyLimit] = useState(5000);
  const used = 1240;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-background p-5">
        <h3 className="font-display text-lg font-bold">SMS Configuration</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Monthly SMS limit">
            <input type="number" value={monthlyLimit} onChange={(event) => setMonthlyLimit(Number(event.target.value) || 0)} className={inputClass} />
          </Field>
        </div>

        <div className="mt-4 rounded-xl border border-border p-4">
          <div className="mb-2 flex justify-between text-xs">
            <span className="font-semibold">SMS usage this month</span>
            <span className="text-muted-foreground">{used.toLocaleString()} / {monthlyLimit.toLocaleString()}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${Math.min((used / Math.max(monthlyLimit, 1)) * 100, 100)}%` }} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-background p-5">
        <h4 className="font-display text-base font-bold">Notification Triggers</h4>
        <div className="mt-4 space-y-2">
          {[
            "Send SMS when student is marked Present",
            "Send SMS when student is marked Absent",
            "Send SMS when student is marked Late",
            "Send daily summary to all parents",
          ].map((label, index) => (
            <Toggle key={label} label={label} checked={index !== 0} onChange={() => undefined} />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-background p-5">
        <h4 className="font-display text-base font-bold">Default Templates</h4>
        <p className="mt-2 text-xs text-muted-foreground">
          Variables: <code className="rounded bg-muted px-1.5 py-0.5">{`{parentName} {studentName} {class} {status} {date} {time}`}</code>
        </p>
        <div className="mt-4 space-y-3">
          {["Present", "Absent", "Late"].map((status) => (
            <Field key={status} label={`${status} template`}>
              <textarea
                rows={2}
                className={`${inputClass} min-h-24 resize-y py-3`}
                defaultValue={`Mubyeyi {parentName}, umwana wanyu {studentName} wo mu {class} ${status.toLowerCase()} ku ishuri uyu munsi {date} saa {time}.`}
              />
            </Field>
          ))}
        </div>
        <button type="button" onClick={() => toast.success("SMS settings saved")} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Save Changes
        </button>
      </section>
    </div>
  );
}

function CalendarTab() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-background p-5">
        <h3 className="font-display text-lg font-bold">Calendar Settings</h3>
        <p className="mt-2 text-sm text-muted-foreground">Use this section to manage academic terms and holidays.</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <SimpleCard title="Terms" description="Create and review academic terms." />
        <SimpleCard title="Holidays" description="Maintain school and public holiday dates." />
      </section>
    </div>
  );
}

function ProfileTab() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-background p-5">
        <h3 className="font-display text-lg font-bold">Profile</h3>
        <p className="mt-2 text-sm text-muted-foreground">Update your account and communication preferences.</p>
      </section>
      <SimpleCard title="Personal details" description="Name, email, and phone number settings live here." />
    </div>
  );
}

function SystemTab() {
  const [featureFlags, setFeatureFlags] = useState({ attendance: true, boarding: false, finance: true });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-background p-5">
        <h3 className="font-display text-lg font-bold">System Settings</h3>
        <p className="mt-2 text-sm text-muted-foreground">Control global product behavior and feature availability.</p>
      </section>

      <section className="rounded-2xl border border-border bg-background p-5">
        <h4 className="font-display text-base font-bold">Feature Flags</h4>
        <div className="mt-4 space-y-2">
          <Toggle label="Attendance module" checked={featureFlags.attendance} onChange={(checked) => setFeatureFlags((prev) => ({ ...prev, attendance: checked }))} />
          <Toggle label="Boarding module" checked={featureFlags.boarding} onChange={(checked) => setFeatureFlags((prev) => ({ ...prev, boarding: checked }))} />
          <Toggle label="Finance module" checked={featureFlags.finance} onChange={(checked) => setFeatureFlags((prev) => ({ ...prev, finance: checked }))} />
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3">
      <span className="text-sm font-medium">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-9 accent-primary" />
    </label>
  );
}

function SimpleCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <h4 className="font-display text-base font-bold">{title}</h4>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

const inputClass = "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary";
