import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, LockKeyhole, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

type TabId = "school" | "reset-password";

type AcademicYearApi = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
};

type AcademicYear = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
};

const tabs: Array<{ id: TabId; label: string; icon: typeof Building2 }> = [
  { id: "school", label: "School", icon: Building2 },
  { id: "reset-password", label: "Reset Password", icon: LockKeyhole },
];

function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("school");

  return (
    <AppLayout title="Settings" subtitle="Configure school, communication, and account preferences">
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
      {activeTab === "reset-password" && <ResetPasswordTab />}
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
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [editingYearId, setEditingYearId] = useState<string | null>(null);
  const [yearName, setYearName] = useState("");
  const [yearStart, setYearStart] = useState("");
  const [yearEnd, setYearEnd] = useState("");
  const [yearCurrent, setYearCurrent] = useState(true);

  const currentYear = useMemo(() => academicYears.find((year) => year.isCurrent), [academicYears]);

  const normalizeAcademicYear = (year: any): AcademicYear => ({
    id: year.id,
    name: year.name,
    startDate: year.start_date ?? year.startDate,
    endDate: year.end_date ?? year.endDate,
    isCurrent: year.is_current ?? year.isCurrent ?? false,
  });

  useEffect(() => {
    const loadAcademicYears = async () => {
      try {
        const years = await apiRequest<AcademicYearApi[]>('/academic-years?limit=100', {
          auth: 'school'
        });
        setAcademicYears(years.map(normalizeAcademicYear));
      } catch (error: any) {
        toast.error(error?.message ?? 'Failed to load academic years');
      }
    };

    void loadAcademicYears();
  }, []);

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

  const handleAddYear = async () => {
    if (!yearName.trim() || !yearStart || !yearEnd) {
      toast.error("Name, start date, and end date are required");
      return;
    }

    const nextYear = {
      name: yearName.trim(),
      start_date: yearStart,
      end_date: yearEnd,
      is_current: yearCurrent,
    };

    try {
      if (editingYearId) {
        const updated = await apiRequest<AcademicYearApi>(`/academic-years/${editingYearId}`, {
          method: "PATCH",
          body: JSON.stringify(nextYear),
          auth: "school"
        });

        setAcademicYears((prev) =>
          prev.map((year) =>
            year.id === editingYearId
              ? normalizeAcademicYear(updated)
              : year
          )
        );
        toast.success("Academic year updated");
      } else {
        const created = await apiRequest<AcademicYearApi>('/academic-years', {
          method: "POST",
          body: JSON.stringify(nextYear),
          auth: "school"
        });

        setAcademicYears((prev) => {
          const clearedCurrent = nextYear.is_current ? prev.map((year) => ({ ...year, isCurrent: false })) : prev;
          return [...clearedCurrent, normalizeAcademicYear(created)];
        });
        toast.success("Academic year added");
      }

      setYearName("");
      setYearStart("");
      setYearEnd("");
      setYearCurrent(true);
      setEditingYearId(null);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to save academic year");
    }
  };

  const handleEditYear = (id: string) => {
    const year = academicYears.find((item) => item.id === id);
    if (!year) return;

    setEditingYearId(year.id);
    setYearName(year.name);
    setYearStart(year.startDate);
    setYearEnd(year.endDate);
    setYearCurrent(year.isCurrent);
  };

  const handleSetCurrent = async (id: string) => {
    try {
      await apiRequest<AcademicYear>(`/academic-years/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_current: true }),
        auth: "school"
      });

      setAcademicYears((prev) => prev.map((year) => ({ ...year, isCurrent: year.id === id })));
      toast.success("Academic year updated");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to update academic year");
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 rounded-2xl border border-border bg-background p-5 lg:grid-cols-2">
        <div className="space-y-4">
          <h3 className="font-display text-lg font-bold">School Details</h3>
          <Field label="School name">
            <input value={schoolName} readOnly className={inputClass} />
          </Field>
          <Field label="Address">
            <input value={address} readOnly className={inputClass} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="District">
              <input value={district} readOnly className={inputClass} />
            </Field>
            <Field label="Province">
              <input value={province} readOnly className={inputClass} />
            </Field>
          </div>
          <Field label="Principal">
            <input value={principal} readOnly className={inputClass} />
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
                    <button type="button" onClick={() => handleEditYear(year.id)} className="text-xs font-semibold text-primary hover:underline">
                      Edit
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
          {editingYearId ? "Update academic year" : "Add academic year"}
        </button>
      </section>
    </div>
  );
}

function ResetPasswordTab() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-background p-5">
        <h3 className="font-display text-lg font-bold">Reset Password</h3>
        <p className="mt-2 text-sm text-muted-foreground">Send a password reset link to the current account email.</p>
      </section>
      <section className="rounded-2xl border border-border bg-background p-5">
        <Field label="Email address">
          <input value="admin@educationcareafrica.rw" readOnly className={inputClass} />
        </Field>
        <button type="button" onClick={() => toast.success("Password reset link sent")} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          <LockKeyhole className="h-4 w-4" />
          Send reset link
        </button>
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
