import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import {
  Building2, MessageSquare, Calendar, User, Database,
  Plus, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { getSchoolAuth, isSchoolAdminRole } from "@/lib/schoolAuth";

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
  const role = getSchoolAuth()?.user?.role ?? null;
  const isSchoolAdmin = isSchoolAdminRole(role);
  const visibleTabs = useMemo(
    () => (isSchoolAdmin ? TABS.filter(t => t.id !== "logs") : TABS),
    [isSchoolAdmin]
  );
  const [tab, setTab] = useState<typeof TABS[number]["id"]>(() => {
    const tabParam = new URLSearchParams(search ?? "").get("tab");
    return visibleTabs.some(t => t.id === tabParam)
      ? (tabParam as typeof TABS[number]["id"])
      : (visibleTabs[0]?.id ?? "school");
  });

  useEffect(() => {
    if (!visibleTabs.some(t => t.id === tab)) {
      setTab(visibleTabs[0]?.id ?? "school");
    }
  }, [tab, visibleTabs]);

  return (
    <AppLayout title="System Settings" subtitle="Configure school, SMS, and user access">
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5">
        <nav className="rounded-xl border border-border bg-card p-2 shadow-sm h-fit">
          {visibleTabs.map(t => {
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
          {!isSchoolAdmin && tab === "logs" && <UserLogsTab />}
        </div>
      </div>
    </AppLayout>
  );
}

const inp = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm";

type AcademicYearRecord = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current?: boolean | null;
};

type TermRecord = {
  id: string;
  academic_year_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current?: boolean | null;
};

type HolidayRecord = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  type?: string | null;
};

type SystemSetting = {
  id: string;
  key_name: string;
  value: string | number | boolean | null;
  type?: string | null;
};

type CurrentUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  phone?: string | null;
};

const SCHOOL_SETTING_KEYS = [
  "school_name",
  "school_logo",
  "school_address",
  "school_district",
  "school_province",
  "school_principal",
] as const;

type SchoolSettingKey = typeof SCHOOL_SETTING_KEYS[number];

function SchoolTab() {
  // ── School info state ──────────────────────────────────────
  const [settingsMap, setSettingsMap] = useState<Record<string, SystemSetting>>({});
  const [schoolInfo, setSchoolInfo] = useState<Record<SchoolSettingKey, string>>({
    school_name: "",
    school_logo: "",
    school_address: "",
    school_district: "",
    school_province: "",
    school_principal: "",
  });
  const [infoLoading, setInfoLoading] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);

  // ── Academic year state ────────────────────────────────────
  const [academicYears, setAcademicYears] = useState<AcademicYearRecord[]>([]);
  const [currentYearId, setCurrentYearId] = useState("");
  const [yearLoading, setYearLoading] = useState(false);
  const [yearName, setYearName] = useState("");
  const [yearStart, setYearStart] = useState("");
  const [yearEnd, setYearEnd] = useState("");
  const [yearCurrent, setYearCurrent] = useState(true);

  const loadSchoolInfo = async () => {
    setInfoLoading(true);
    try {
      const settings = await apiRequest<SystemSetting[]>("/system-settings?limit=100", {
        auth: "school",
      });
      const map: Record<string, SystemSetting> = {};
      settings.forEach((s) => { map[s.key_name] = s; });
      setSettingsMap(map);
      setSchoolInfo({
        school_name: String(map.school_name?.value ?? ""),
        school_logo: String(map.school_logo?.value ?? ""),
        school_address: String(map.school_address?.value ?? ""),
        school_district: String(map.school_district?.value ?? ""),
        school_province: String(map.school_province?.value ?? ""),
        school_principal: String(map.school_principal?.value ?? ""),
      });
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load school info");
    } finally {
      setInfoLoading(false);
    }
  };

  const loadAcademicYears = async () => {
    setYearLoading(true);
    try {
      const years = await apiRequest<AcademicYearRecord[]>("/academic-years?limit=50", {
        auth: "school",
      });
      setAcademicYears(years);
      const current = years.find((year) => year.is_current) ?? years[0] ?? null;
      setCurrentYearId(current?.id ?? "");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load academic years");
    } finally {
      setYearLoading(false);
    }
  };

  useEffect(() => {
    loadSchoolInfo();
    loadAcademicYears();
  }, []);

  const handleSaveSchoolInfo = async () => {
    setSavingInfo(true);
    try {
      await Promise.all(
        SCHOOL_SETTING_KEYS.map((key) => {
          const existing = settingsMap[key];
          const value = schoolInfo[key];
          if (existing?.id) {
            return apiRequest(`/system-settings/${existing.id}`, {
              method: "PATCH",
              body: JSON.stringify({ value }),
              auth: "school",
            });
          }
          return apiRequest("/system-settings", {
            method: "POST",
            body: JSON.stringify({ key_name: key, value, type: "string" }),
            auth: "school",
          });
        })
      );
      await loadSchoolInfo();
      toast.success("School information saved");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to save school info");
    } finally {
      setSavingInfo(false);
    }
  };

  const handleSetCurrent = async (id: string) => {
    if (!id) return;
    setYearLoading(true);
    try {
      await apiRequest(`/academic-years/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_current: true }),
        auth: "school",
      });
      await loadAcademicYears();
      toast.success("Academic year updated");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to set current academic year");
    } finally {
      setYearLoading(false);
    }
  };

  const handleCreateYear = async () => {
    if (!yearName.trim() || !yearStart || !yearEnd) {
      toast.error("Name, start date, and end date are required");
      return;
    }
    setYearLoading(true);
    try {
      await apiRequest("/academic-years", {
        method: "POST",
        body: JSON.stringify({
          name: yearName.trim(),
          start_date: yearStart,
          end_date: yearEnd,
          is_current: yearCurrent,
        }),
        auth: "school",
      });
      setYearName("");
      setYearStart("");
      setYearEnd("");
      setYearCurrent(true);
      await loadAcademicYears();
      toast.success("Academic year created");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to create academic year");
    } finally {
      setYearLoading(false);
    }
  };

  const handleDeleteYear = async (id: string) => {
    if (!window.confirm("Delete this academic year?")) return;
    setYearLoading(true);
    try {
      await apiRequest(`/academic-years/${id}`, { method: "DELETE", auth: "school" });
      await loadAcademicYears();
      toast.success("Academic year deleted");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to delete academic year");
    } finally {
      setYearLoading(false);
    }
  };

  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setField("school_logo", reader.result as string);
    reader.readAsDataURL(file);
  };

  const setField = (key: SchoolSettingKey, value: string) =>
    setSchoolInfo((prev) => ({ ...prev, [key]: value }));

  const showInfoSkeleton = infoLoading && Object.keys(settingsMap).length === 0;
  const showYearSkeleton = yearLoading && academicYears.length === 0;

  const currentYear = academicYears.find((y) => y.is_current);

  return (
    <>
      <h3 className="font-display font-bold text-lg mb-5">School Information</h3>

      {/* ── Profile card — displays current data from DB ── */}
      {showInfoSkeleton || showYearSkeleton ? (
        <div className="rounded-2xl border border-border bg-muted/20 p-5 mb-6 flex items-center gap-5">
          <Skeleton className="h-20 w-20 rounded-2xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-64" />
            <div className="flex gap-4 mt-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-muted/10 p-5 mb-6 flex items-center gap-5">
          <div className="h-20 w-20 rounded-2xl border border-border bg-background flex-shrink-0 grid place-items-center overflow-hidden shadow-sm">
            {schoolInfo.school_logo ? (
              <img src={schoolInfo.school_logo} alt="School logo" className="h-full w-full object-cover" />
            ) : (
              <Building2 className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-display font-bold text-xl leading-tight truncate">
              {schoolInfo.school_name || <span className="text-muted-foreground italic">School name not set</span>}
            </p>
            {schoolInfo.school_address && (
              <p className="text-sm text-muted-foreground mt-0.5 truncate">{schoolInfo.school_address}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {schoolInfo.school_district && (
                <span className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">District:</span> {schoolInfo.school_district}
                </span>
              )}
              {schoolInfo.school_province && (
                <span className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Province:</span> {schoolInfo.school_province}
                </span>
              )}
              {schoolInfo.school_principal && (
                <span className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Principal:</span> {schoolInfo.school_principal}
                </span>
              )}
              {currentYear && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-0.5 rounded-full">
                  {currentYear.name} · Current
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Edit form ── */}
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Edit Details</p>

      {showInfoSkeleton ? (
        <div className="grid grid-cols-2 gap-4">
          <FieldSkeleton full />
          <div className="col-span-2 space-y-2">
            <Skeleton className="h-3 w-24" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-20 w-20 rounded-xl" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-9 w-28" />
              </div>
            </div>
          </div>
          <FieldSkeleton full />
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Field label="School Name" full>
            <input className={inp} value={schoolInfo.school_name} onChange={(e) => setField("school_name", e.target.value)} placeholder="e.g. Kigali Academy" />
          </Field>

          <Field label="School Logo" full>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl border border-border bg-muted/30 grid place-items-center overflow-hidden flex-shrink-0">
                {schoolInfo.school_logo ? (
                  <img src={schoolInfo.school_logo} alt="Logo preview" className="h-full w-full object-cover" />
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => logoInputRef.current?.click()}
                  className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">
                  Upload Logo
                </button>
                {schoolInfo.school_logo && (
                  <button type="button" onClick={() => setField("school_logo", "")}
                    className="text-xs text-destructive hover:underline">
                    Remove
                  </button>
                )}
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              </div>
            </div>
          </Field>

          <Field label="Address" full>
            <input className={inp} value={schoolInfo.school_address} onChange={(e) => setField("school_address", e.target.value)} placeholder="e.g. KG 501 St, Kigali" />
          </Field>

          <Field label="District">
            <input className={inp} value={schoolInfo.school_district} onChange={(e) => setField("school_district", e.target.value)} placeholder="e.g. Gasabo" />
          </Field>

          <Field label="Province">
            <input className={inp} value={schoolInfo.school_province} onChange={(e) => setField("school_province", e.target.value)} placeholder="e.g. Kigali" />
          </Field>

          <Field label="Academic Year">
            {showYearSkeleton ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <div className={`${inp} flex items-center justify-between bg-muted/20`}>
                <span className="font-medium">{currentYear?.name ?? "—"}</span>
                {currentYear && (
                  <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Current</span>
                )}
              </div>
            )}
          </Field>

          <Field label="Principal" full>
            <input className={inp} value={schoolInfo.school_principal} onChange={(e) => setField("school_principal", e.target.value)} placeholder="e.g. Jean Bosco Uwimana" />
          </Field>
        </div>
      )}

      <button
        onClick={handleSaveSchoolInfo}
        disabled={savingInfo || infoLoading}
        className="mt-5 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {savingInfo ? "Saving…" : "Save Changes"}
      </button>

      <div className="mt-8 rounded-xl border border-border bg-background p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="font-display font-bold text-base">Academic Years</h4>
            <p className="text-xs text-muted-foreground">Create, set current, or remove academic years.</p>
          </div>
          {yearLoading && <span className="text-xs text-muted-foreground">Updating…</span>}
        </div>

        <div className="rounded-lg border border-border overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Start</th>
                <th className="text-left px-3 py-2">End</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {showYearSkeleton ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={`year-skeleton-${i}`} className="border-t border-border">
                    <td className="px-3 py-2"><Skeleton className="h-4 w-28" /></td>
                    <td className="px-3 py-2"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-3 py-2"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-3 py-2"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-3 py-2 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                  </tr>
                ))
              ) : academicYears.length === 0 ? (
                <tr className="border-t border-border">
                  <td colSpan={5} className="px-3 py-3 text-xs text-muted-foreground">No academic years yet.</td>
                </tr>
              ) : (
                academicYears.map((year) => (
                  <tr key={year.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{year.name}</td>
                    <td className="px-3 py-2">{year.start_date}</td>
                    <td className="px-3 py-2">{year.end_date}</td>
                    <td className="px-3 py-2">
                      {year.is_current
                        ? <span className="text-xs font-semibold text-success">Current</span>
                        : <span className="text-xs text-muted-foreground">Inactive</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!year.is_current && (
                        <button onClick={() => handleSetCurrent(year.id)} className="mr-3 text-xs font-semibold text-primary hover:underline" disabled={yearLoading}>
                          Set current
                        </button>
                      )}
                      <button onClick={() => handleDeleteYear(year.id)} className="text-xs text-destructive hover:underline" disabled={yearLoading}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" full>
            <input value={yearName} onChange={(e) => setYearName(e.target.value)} className={inp} placeholder="2025/2026" />
          </Field>
          <Field label="Start date">
            <input type="date" value={yearStart} onChange={(e) => setYearStart(e.target.value)} className={inp} />
          </Field>
          <Field label="End date">
            <input type="date" value={yearEnd} onChange={(e) => setYearEnd(e.target.value)} className={inp} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={yearCurrent} onChange={(e) => setYearCurrent(e.target.checked)} className="h-4 w-4 accent-primary" />
            Set as current
          </label>
        </div>
        <button onClick={handleCreateYear} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={yearLoading}>
          Add Academic Year
        </button>
      </div>
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
  const [academicYears, setAcademicYears] = useState<AcademicYearRecord[]>([]);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [terms, setTerms] = useState<TermRecord[]>([]);
  const [holidays, setHolidays] = useState<HolidayRecord[]>([]);
  const [yearsLoading, setYearsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [newYearName, setNewYearName] = useState("");
  const [newYearStart, setNewYearStart] = useState("");
  const [newYearEnd, setNewYearEnd] = useState("");
  const [newYearCurrent, setNewYearCurrent] = useState(false);

  const [termName, setTermName] = useState("");
  const [termStart, setTermStart] = useState("");
  const [termEnd, setTermEnd] = useState("");
  const [termCurrent, setTermCurrent] = useState(false);

  const [holidayName, setHolidayName] = useState("");
  const [holidayStart, setHolidayStart] = useState("");
  const [holidayEnd, setHolidayEnd] = useState("");
  const [holidayType, setHolidayType] = useState("school");

  const toDateInput = (value?: string | null) => (value ? value.slice(0, 10) : "");

  const loadAcademicYears = async () => {
    setYearsLoading(true);
    try {
      const years = await apiRequest<AcademicYearRecord[]>("/academic-years?limit=50", {
        auth: "school"
      });
      const normalized = years.map((year) => ({
        ...year,
        start_date: toDateInput(year.start_date),
        end_date: toDateInput(year.end_date)
      }));
      setAcademicYears(normalized);
      const current = normalized.find((year) => year.is_current) ?? normalized[0] ?? null;
      setSelectedYearId((prev) => (
        prev && normalized.some((year) => year.id === prev) ? prev : (current?.id ?? "")
      ));
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load academic years");
    } finally {
      setYearsLoading(false);
    }
  };

  const loadTerms = async (yearId: string) => {
    if (!yearId) {
      setTerms([]);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<TermRecord[]>(
        `/terms?limit=200&academic_year_id=${yearId}`,
        { auth: "school" }
      );
      setTerms(
        data.map((term) => ({
          ...term,
          start_date: toDateInput(term.start_date),
          end_date: toDateInput(term.end_date)
        }))
      );
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load terms");
    } finally {
      setLoading(false);
    }
  };

  const loadHolidays = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<HolidayRecord[]>("/holidays?limit=200", {
        auth: "school"
      });
      setHolidays(
        data.map((holiday) => ({
          ...holiday,
          start_date: toDateInput(holiday.start_date),
          end_date: toDateInput(holiday.end_date)
        }))
      );
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load holidays");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAcademicYears();
    loadHolidays();
  }, []);

  useEffect(() => {
    if (selectedYearId) {
      loadTerms(selectedYearId);
    }
  }, [selectedYearId]);

  const showYearSkeleton = yearsLoading && academicYears.length === 0;
  const showTermsSkeleton = loading && terms.length === 0 && Boolean(selectedYearId);
  const showHolidaysSkeleton = loading && holidays.length === 0;

  const handleSaveYear = async (year: AcademicYearRecord) => {
    setSavingId(`year-${year.id}`);
    try {
      await apiRequest(`/academic-years/${year.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: year.name,
          start_date: year.start_date,
          end_date: year.end_date,
          is_current: year.is_current
        }),
        auth: "school"
      });
      await loadAcademicYears();
      toast.success("Academic year updated");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to update academic year");
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteYear = async (id: string) => {
    if (!window.confirm("Delete this academic year?")) return;
    setSavingId(`year-${id}`);
    try {
      await apiRequest(`/academic-years/${id}`, {
        method: "DELETE",
        auth: "school"
      });
      await loadAcademicYears();
      toast.success("Academic year deleted");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to delete academic year");
    } finally {
      setSavingId(null);
    }
  };

  const handleCreateYear = async () => {
    if (!newYearName.trim() || !newYearStart || !newYearEnd) {
      toast.error("Name, start date, and end date are required");
      return;
    }
    setSavingId("new-year");
    try {
      const created = await apiRequest<AcademicYearRecord>("/academic-years", {
        method: "POST",
        body: JSON.stringify({
          name: newYearName.trim(),
          start_date: newYearStart,
          end_date: newYearEnd,
          is_current: newYearCurrent
        }),
        auth: "school"
      });
      setNewYearName("");
      setNewYearStart("");
      setNewYearEnd("");
      setNewYearCurrent(false);
      await loadAcademicYears();
      if (created?.id) {
        setSelectedYearId(created.id);
      }
      toast.success("Academic year created");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to create academic year");
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveTerm = async (term: TermRecord) => {
    setSavingId(term.id);
    try {
      await apiRequest(`/terms/${term.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: term.name,
          start_date: term.start_date,
          end_date: term.end_date,
          academic_year_id: term.academic_year_id,
          is_current: term.is_current
        }),
        auth: "school"
      });
      await loadTerms(selectedYearId);
      toast.success("Term updated");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to update term");
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteTerm = async (id: string) => {
    if (!window.confirm("Delete this term?")) return;
    setSavingId(id);
    try {
      await apiRequest(`/terms/${id}`, {
        method: "DELETE",
        auth: "school"
      });
      await loadTerms(selectedYearId);
      toast.success("Term deleted");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to delete term");
    } finally {
      setSavingId(null);
    }
  };

  const handleCreateTerm = async () => {
    if (!selectedYearId) {
      toast.error("Select an academic year first");
      return;
    }
    if (!termName.trim() || !termStart || !termEnd) {
      toast.error("Term name, start, and end dates are required");
      return;
    }
    setSavingId("new-term");
    try {
      await apiRequest("/terms", {
        method: "POST",
        body: JSON.stringify({
          academic_year_id: selectedYearId,
          name: termName.trim(),
          start_date: termStart,
          end_date: termEnd,
          is_current: termCurrent
        }),
        auth: "school"
      });
      setTermName("");
      setTermStart("");
      setTermEnd("");
      setTermCurrent(false);
      await loadTerms(selectedYearId);
      toast.success("Term created");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to create term");
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveHoliday = async (holiday: HolidayRecord) => {
    setSavingId(holiday.id);
    try {
      await apiRequest(`/holidays/${holiday.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: holiday.name,
          start_date: holiday.start_date,
          end_date: holiday.end_date,
          type: holiday.type
        }),
        auth: "school"
      });
      await loadHolidays();
      toast.success("Holiday updated");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to update holiday");
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!window.confirm("Delete this holiday?")) return;
    setSavingId(id);
    try {
      await apiRequest(`/holidays/${id}`, {
        method: "DELETE",
        auth: "school"
      });
      await loadHolidays();
      toast.success("Holiday deleted");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to delete holiday");
    } finally {
      setSavingId(null);
    }
  };

  const handleCreateHoliday = async () => {
    if (!holidayName.trim() || !holidayStart || !holidayEnd) {
      toast.error("Holiday name, start, and end dates are required");
      return;
    }
    setSavingId("new-holiday");
    try {
      await apiRequest("/holidays", {
        method: "POST",
        body: JSON.stringify({
          name: holidayName.trim(),
          start_date: holidayStart,
          end_date: holidayEnd,
          type: holidayType
        }),
        auth: "school"
      });
      setHolidayName("");
      setHolidayStart("");
      setHolidayEnd("");
      setHolidayType("school");
      await loadHolidays();
      toast.success("Holiday created");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to create holiday");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <>
      <h3 className="font-display font-bold text-lg mb-4">Academic Calendar</h3>
      <div className="rounded-lg border border-border p-3 mb-4">
        <Field label="Academic year">
          {showYearSkeleton ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className={inp}
            >
              {academicYears.length === 0 && <option value="">No academic year</option>}
              {academicYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}{year.is_current ? " (Current)" : ""}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <h4 className="font-display font-bold mb-3">Academic Years</h4>
      <div className="rounded-lg border border-border overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Start</th>
              <th className="text-left px-3 py-2">End</th>
              <th className="text-left px-3 py-2">Current</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {showYearSkeleton ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={`year-skeleton-${i}`} className="border-t border-border">
                  <td className="px-3 py-2"><Skeleton className="h-4 w-28" /></td>
                  <td className="px-3 py-2"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-3 py-2"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-3 py-2"><Skeleton className="h-4 w-10" /></td>
                  <td className="px-3 py-2 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                </tr>
              ))
            ) : academicYears.length === 0 ? (
              <tr className="border-t border-border">
                <td colSpan={5} className="px-3 py-3 text-xs text-muted-foreground">
                  No academic years yet.
                </td>
              </tr>
            ) : (
              academicYears.map((year) => (
                <tr key={year.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <input
                      value={year.name}
                      onChange={(e) =>
                        setAcademicYears((prev) =>
                          prev.map((item) =>
                            item.id === year.id ? { ...item, name: e.target.value } : item
                          )
                        )
                      }
                      className={inp}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      value={year.start_date}
                      onChange={(e) =>
                        setAcademicYears((prev) =>
                          prev.map((item) =>
                            item.id === year.id ? { ...item, start_date: e.target.value } : item
                          )
                        )
                      }
                      className={inp}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      value={year.end_date}
                      onChange={(e) =>
                        setAcademicYears((prev) =>
                          prev.map((item) =>
                            item.id === year.id ? { ...item, end_date: e.target.value } : item
                          )
                        )
                      }
                      className={inp}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={Boolean(year.is_current)}
                      onChange={(e) =>
                        setAcademicYears((prev) =>
                          prev.map((item) =>
                            item.id === year.id ? { ...item, is_current: e.target.checked } : item
                          )
                        )
                      }
                      className="h-4 w-4 accent-primary"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => handleSaveYear(year)}
                      className="mr-3 text-xs font-semibold text-primary hover:underline"
                      disabled={savingId === `year-${year.id}`}
                    >
                      {savingId === `year-${year.id}` ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => handleDeleteYear(year.id)}
                      className="text-xs text-destructive hover:underline"
                      disabled={savingId === `year-${year.id}`}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-5 gap-2 mb-6">
        <input value={newYearName} onChange={(e) => setNewYearName(e.target.value)} placeholder="2025/2026" className={inp} />
        <input type="date" value={newYearStart} onChange={(e) => setNewYearStart(e.target.value)} className={inp} />
        <input type="date" value={newYearEnd} onChange={(e) => setNewYearEnd(e.target.value)} className={inp} />
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={newYearCurrent} onChange={(e) => setNewYearCurrent(e.target.checked)} className="h-4 w-4 accent-primary" />
          Set current
        </label>
        <button
          onClick={handleCreateYear}
          className="rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground inline-flex items-center justify-center gap-1"
          disabled={savingId === "new-year"}
        >
          <Plus className="h-4 w-4" /> {savingId === "new-year" ? "Saving…" : "Add Academic Year"}
        </button>
      </div>

      <h4 className="font-display font-bold mb-3">Terms</h4>
      <div className="rounded-lg border border-border overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Start</th>
              <th className="text-left px-3 py-2">End</th>
              <th className="text-left px-3 py-2">Current</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {showTermsSkeleton ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={`term-skeleton-${i}`} className="border-t border-border">
                  <td className="px-3 py-2"><Skeleton className="h-4 w-28" /></td>
                  <td className="px-3 py-2"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-3 py-2"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-3 py-2"><Skeleton className="h-4 w-10" /></td>
                  <td className="px-3 py-2 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                </tr>
              ))
            ) : terms.length === 0 ? (
              <tr className="border-t border-border">
                <td colSpan={5} className="px-3 py-3 text-xs text-muted-foreground">
                  {selectedYearId ? "No terms yet." : "Select an academic year to load terms."}
                </td>
              </tr>
            ) : (
              terms.map((term) => (
                <tr key={term.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <input
                      value={term.name}
                      onChange={(e) =>
                        setTerms((prev) =>
                          prev.map((item) =>
                            item.id === term.id ? { ...item, name: e.target.value } : item
                          )
                        )
                      }
                      className={inp}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      value={term.start_date}
                      onChange={(e) =>
                        setTerms((prev) =>
                          prev.map((item) =>
                            item.id === term.id ? { ...item, start_date: e.target.value } : item
                          )
                        )
                      }
                      className={inp}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      value={term.end_date}
                      onChange={(e) =>
                        setTerms((prev) =>
                          prev.map((item) =>
                            item.id === term.id ? { ...item, end_date: e.target.value } : item
                          )
                        )
                      }
                      className={inp}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={Boolean(term.is_current)}
                      onChange={(e) =>
                        setTerms((prev) =>
                          prev.map((item) =>
                            item.id === term.id ? { ...item, is_current: e.target.checked } : item
                          )
                        )
                      }
                      className="h-4 w-4 accent-primary"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => handleSaveTerm(term)}
                      className="mr-3 text-xs font-semibold text-primary hover:underline"
                      disabled={savingId === term.id || loading}
                    >
                      {savingId === term.id ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => handleDeleteTerm(term.id)}
                      className="text-xs text-destructive hover:underline"
                      disabled={savingId === term.id}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-5 gap-2 mb-6">
        <input value={termName} onChange={(e) => setTermName(e.target.value)} placeholder="Term name" className={inp} />
        <input type="date" value={termStart} onChange={(e) => setTermStart(e.target.value)} className={inp} />
        <input type="date" value={termEnd} onChange={(e) => setTermEnd(e.target.value)} className={inp} />
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={termCurrent} onChange={(e) => setTermCurrent(e.target.checked)} className="h-4 w-4 accent-primary" />
          Set current
        </label>
        <button
          onClick={handleCreateTerm}
          className="rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground inline-flex items-center justify-center gap-1"
          disabled={savingId === "new-term"}
        >
          <Plus className="h-4 w-4" /> {savingId === "new-term" ? "Saving…" : "Add Term"}
        </button>
      </div>

      <h4 className="font-display font-bold mb-3">Holidays</h4>
      <div className="rounded-lg border border-border overflow-hidden mb-3">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Start</th>
              <th className="text-left px-3 py-2">End</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {showHolidaysSkeleton ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={`holiday-skeleton-${i}`} className="border-t border-border">
                  <td className="px-3 py-2"><Skeleton className="h-4 w-28" /></td>
                  <td className="px-3 py-2"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-3 py-2"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-3 py-2"><Skeleton className="h-4 w-16" /></td>
                  <td className="px-3 py-2 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                </tr>
              ))
            ) : holidays.length === 0 ? (
              <tr className="border-t border-border">
                <td colSpan={5} className="px-3 py-3 text-xs text-muted-foreground">
                  No holidays yet.
                </td>
              </tr>
            ) : (
              holidays.map((holiday) => (
                <tr key={holiday.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <input
                      value={holiday.name}
                      onChange={(e) =>
                        setHolidays((prev) =>
                          prev.map((item) =>
                            item.id === holiday.id ? { ...item, name: e.target.value } : item
                          )
                        )
                      }
                      className={inp}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      value={holiday.start_date}
                      onChange={(e) =>
                        setHolidays((prev) =>
                          prev.map((item) =>
                            item.id === holiday.id ? { ...item, start_date: e.target.value } : item
                          )
                        )
                      }
                      className={inp}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      value={holiday.end_date}
                      onChange={(e) =>
                        setHolidays((prev) =>
                          prev.map((item) =>
                            item.id === holiday.id ? { ...item, end_date: e.target.value } : item
                          )
                        )
                      }
                      className={inp}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={holiday.type ?? "school"}
                      onChange={(e) =>
                        setHolidays((prev) =>
                          prev.map((item) =>
                            item.id === holiday.id ? { ...item, type: e.target.value } : item
                          )
                        )
                      }
                      className={inp}
                    >
                      {(["national", "school", "exam", "other"] as const).map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => handleSaveHoliday(holiday)}
                      className="mr-3 text-xs font-semibold text-primary hover:underline"
                      disabled={savingId === holiday.id || loading}
                    >
                      {savingId === holiday.id ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => handleDeleteHoliday(holiday.id)}
                      className="text-xs text-destructive hover:underline"
                      disabled={savingId === holiday.id}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-5 gap-2">
        <input value={holidayName} onChange={(e) => setHolidayName(e.target.value)} placeholder="Holiday name" className={inp} />
        <input type="date" value={holidayStart} onChange={(e) => setHolidayStart(e.target.value)} className={inp} />
        <input type="date" value={holidayEnd} onChange={(e) => setHolidayEnd(e.target.value)} className={inp} />
        <select value={holidayType} onChange={(e) => setHolidayType(e.target.value)} className={inp}>
          {(["national", "school", "exam", "other"] as const).map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <button
          onClick={handleCreateHoliday}
          className="rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground inline-flex items-center justify-center gap-1"
          disabled={savingId === "new-holiday"}
        >
          <Plus className="h-4 w-4" /> {savingId === "new-holiday" ? "Saving…" : "Add Holiday"}
        </button>
      </div>
    </>
  );
}

function ProfileTab() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [name, setName] = useState("");
  const [loadingUser, setLoadingUser] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  const loadUser = async () => {
    setLoadingUser(true);
    try {
      const data = await apiRequest<CurrentUser>("/auth/me", { auth: "school" });
      setUser(data);
      setName(data.name ?? "");
    } catch (error: any) {
      const cached = getSchoolAuth()?.user;
      if (cached) {
        setUser(cached);
        setName(cached.name ?? "");
      } else {
        toast.error(error?.message ?? "Failed to load profile");
      }
    } finally {
      setLoadingUser(false);
    }
  };

  useEffect(() => { loadUser(); }, []);

  const showProfileSkeleton = loadingUser && !user;

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    setSavingProfile(true);
    try {
      await apiRequest(`/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
        auth: "school",
      });
      toast.success("Profile updated");
      await loadUser();
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePassword = async () => {
    if (!user?.id) return;
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Fill in all password fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setSavingPwd(true);
    try {
      await apiRequest(`/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ current_password: currentPassword, password: newPassword }),
        auth: "school",
      });
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to update password");
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <>
      <h3 className="font-display font-bold text-lg mb-4">Profile Settings</h3>

      <div className="rounded-xl border border-border bg-background p-4 mb-6">
        <h4 className="font-display font-bold text-base mb-3">Account Information</h4>
        {showProfileSkeleton ? (
          <div className="grid grid-cols-2 gap-4">
            <FieldSkeleton full />
            <FieldSkeleton full />
            <FieldSkeleton full />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Full Name" full>
              <input className={inp} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Email" full>
              <input className={`${inp} opacity-60`} value={user?.email ?? ""} readOnly />
            </Field>
            <Field label="Role" full>
              <input className={`${inp} opacity-60`} value={user?.role ?? ""} readOnly />
            </Field>
          </div>
        )}
        <button
          onClick={handleSaveProfile}
          disabled={savingProfile || loadingUser}
          className="mt-4 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {savingProfile ? "Saving…" : "Save Profile"}
        </button>
      </div>

      <div className="rounded-xl border border-border bg-background p-4">
        <h4 className="font-display font-bold text-base mb-3">Change Password</h4>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Current Password" full>
            <input type="password" className={inp} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </Field>
          <Field label="New Password" full>
            <input type="password" className={inp} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </Field>
          <Field label="Confirm New Password" full>
            <input type="password" className={inp} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </Field>
        </div>
        <button
          onClick={handleSavePassword}
          disabled={savingPwd || loadingUser}
          className="mt-4 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {savingPwd ? "Saving…" : "Save Password"}
        </button>
      </div>
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

function FieldSkeleton({ full }: { full?: boolean }) {
  return (
    <div className={`space-y-2 ${full ? "col-span-2" : ""}`}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
