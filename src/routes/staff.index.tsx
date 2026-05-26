import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Plus, Grid3X3, List, X, Phone, Mail, Calendar, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/staff/")({ component: StaffPage });

type StaffProfileRecord = {
  id: string;
  user_id?: string | null;
  staff_id_number?: string | null;
  gender?: "male" | "female" | "other" | null;
  department?: string | null;
  contract_type?: "permanent" | "contract" | "part_time" | null;
  join_date?: string | null;
  date_of_birth?: string | null;
  national_id?: string | null;
  address?: string | null;
  emergency_contact?: string | null;
  qualifications?: string | null;
  experience?: string | null;
  timetable_access?: string | null;
  basic_salary?: string | null;
  employment_status?: "active" | "on_leave" | "inactive" | null;
  subjects?: string[] | null;
  user?: { id: string; name?: string | null; email?: string | null; role?: string | null } | null;
};

type UserRecord = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  status?: string | null;
};

type SystemSetting = {
  id: string;
  key_name: string;
  value?: string | null;
  parsed_value?: unknown;
  type?: string | null;
};

type StaffRow = {
  id: string;
  userId: string | null;
  staffId: string;
  name: string;
  role: string;
  roleValue: string | null;
  department: string;
  phone: string;
  email: string;
  joinDate: string;
  status: "Active" | "On Leave" | "Inactive";
  statusValue: string | null;
  gender: string;
  contractType: string;
  subjects: string[];
  dateOfBirth: string;
  nationalId: string;
  address: string;
  emergencyContact: string;
  qualifications: string;
  experience: string;
  timetableAccess: string;
  basicSalary: string;
};

const TABS = ["All Staff", "Departments"] as const;
const DEFAULT_DEPARTMENTS = ["Teaching", "Administration", "Boarding", "Finance", "Support"];
const STAFF_DEPARTMENTS_KEY = "staff_departments";
const STAFF_ROLES = ["teacher", "staff", "school_admin"] as const;
const EMPTY_VALUE = "--";
const STAFF_TABLE_HEADERS = ["Name", "Staff ID", "Role", "Department", "Phone", "Join Date", "Status", ""] as const;

const toTitleCase = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const roleLabel = (value?: string | null) => {
  if (!value) return EMPTY_VALUE;
  return toTitleCase(value);
};

const statusLabel = (value?: string | null): StaffRow["status"] => {
  if (value === "on_leave") return "On Leave";
  if (value === "inactive") return "Inactive";
  return "Active";
};

const contractLabel = (value?: string | null) =>
  value ? toTitleCase(value) : EMPTY_VALUE;

const genderLabel = (value?: string | null) =>
  value ? toTitleCase(value) : EMPTY_VALUE;

const mergeUnique = (values: string[]) =>
  Array.from(new Set(values.filter((value) => value && value !== EMPTY_VALUE)));

const normalizeDepartment = (value: string) => value.trim().replace(/\s+/g, " ");

const buildStaffRows = (profiles: StaffProfileRecord[], users: UserRecord[]): StaffRow[] => {
  const userMap = new Map(users.map((user) => [user.id, user]));

  return profiles.map((profile) => {
    const linkedUser = profile.user_id ? userMap.get(profile.user_id) : null;
    const fallbackUser = profile.user ?? null;
    const user = linkedUser ?? fallbackUser;
    const roleValue = user?.role ?? fallbackUser?.role ?? null;

    return {
      id: profile.id,
      userId: profile.user_id ?? user?.id ?? null,
      staffId: profile.staff_id_number ?? `STF-${profile.id}`,
      name: user?.name ?? EMPTY_VALUE,
      role: roleLabel(roleValue),
      roleValue,
      department: profile.department ?? EMPTY_VALUE,
      phone: user?.phone ?? EMPTY_VALUE,
      email: user?.email ?? EMPTY_VALUE,
      joinDate: profile.join_date ?? EMPTY_VALUE,
      status: statusLabel(profile.employment_status),
      statusValue: profile.employment_status ?? null,
      gender: genderLabel(profile.gender),
      contractType: contractLabel(profile.contract_type),
      subjects: profile.subjects ?? [],
      dateOfBirth: profile.date_of_birth ?? EMPTY_VALUE,
      nationalId: profile.national_id ?? EMPTY_VALUE,
      address: profile.address ?? EMPTY_VALUE,
      emergencyContact: profile.emergency_contact ?? EMPTY_VALUE,
      qualifications: profile.qualifications ?? EMPTY_VALUE,
      experience: profile.experience ?? EMPTY_VALUE,
      timetableAccess: profile.timetable_access ?? EMPTY_VALUE,
      basicSalary: profile.basic_salary ?? EMPTY_VALUE,
    };
  });
};

function StaffPage() {
  const [tab, setTab] = useState<typeof TABS[number]>("All Staff");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("All");
  const [status, setStatus] = useState("All");
  const [profile, setProfile] = useState<StaffRow | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfileRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [departments, setDepartments] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [departmentSetting, setDepartmentSetting] = useState<SystemSetting | null>(null);
  const [loading, setLoading] = useState(false);
  const [departmentsSaving, setDepartmentsSaving] = useState(false);

  const staffRows = useMemo(() => buildStaffRows(staffProfiles, users), [staffProfiles, users]);

  const departmentOptions = useMemo(() => {
    const derived = staffRows.map((staff) => staff.department);
    return mergeUnique([...DEFAULT_DEPARTMENTS, ...departments, ...derived]);
  }, [departments, staffRows]);

  const filtered = useMemo(() => staffRows.filter((staff) =>
    (q === "" || staff.name.toLowerCase().includes(q.toLowerCase()) || staff.staffId.toLowerCase().includes(q.toLowerCase())) &&
    (dept === "All" || staff.department === dept) &&
    (status === "All" || staff.status === status)
  ), [staffRows, q, dept, status]);

  const teaching = staffRows.filter((staff) => staff.roleValue === "teacher").length;
  const nonTeaching = staffRows.length - teaching;
  const activeStaff = staffRows.filter((staff) => staff.statusValue === "active").length;
  const showSkeleton = loading && staffRows.length === 0;

  const nextStaffIdNumber = useMemo(() => {
    const year = new Date().getFullYear();
    const numbers = staffRows
      .map((staff) => {
        const match = staff.staffId.match(/(\d+)$/);
        return match ? Number(match[1]) : NaN;
      })
      .filter((value) => Number.isFinite(value));
    const next = numbers.length ? Math.max(...numbers) + 1 : staffRows.length + 1;
    return `STF-${year}-${String(next).padStart(3, "0")}`;
  }, [staffRows]);

  const loadStaffData = async () => {
    setLoading(true);
    try {
      const [profiles, allUsers] = await Promise.all([
        apiRequest<StaffProfileRecord[]>("/staff/profiles?limit=1000", { auth: "school" }),
        apiRequest<UserRecord[]>("/users?limit=1000", { auth: "school" }),
      ]);

      const staffUsers = (Array.isArray(allUsers) ? allUsers : []).filter((user) =>
        STAFF_ROLES.includes((user.role ?? "") as typeof STAFF_ROLES[number])
      );

      setStaffProfiles(Array.isArray(profiles) ? profiles : []);
      setUsers(staffUsers);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load staff records");
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const setting = await apiRequest<SystemSetting>(`/system-settings/key/${STAFF_DEPARTMENTS_KEY}`, { auth: "school" });
      const parsed = Array.isArray(setting?.parsed_value) ? setting.parsed_value : [];
      setDepartmentSetting(setting ?? null);
      setDepartments(mergeUnique([...DEFAULT_DEPARTMENTS, ...parsed.map((value: any) => String(value))]));
    } catch (error: any) {
      if (error?.status !== 404) {
        toast.error(error?.message ?? "Failed to load departments");
      }
      setDepartments(DEFAULT_DEPARTMENTS);
      setDepartmentSetting(null);
    }
  };

  useEffect(() => {
    loadStaffData();
    loadDepartments();
  }, []);

  const handleCreateDepartment = async (name: string) => {
    const trimmed = normalizeDepartment(name);
    if (!trimmed) {
      toast.error("Department name is required");
      return false;
    }

    const next = mergeUnique([...departments, trimmed]);
    setDepartmentsSaving(true);
    try {
      if (departmentSetting?.id) {
        const updated = await apiRequest<SystemSetting>(`/system-settings/${departmentSetting.id}`, {
          method: "PATCH",
          auth: "school",
          body: JSON.stringify({ value: next, type: "json" })
        });
        setDepartmentSetting(updated);
      } else {
        const created = await apiRequest<SystemSetting>("/system-settings", {
          method: "POST",
          auth: "school",
          body: JSON.stringify({ key_name: STAFF_DEPARTMENTS_KEY, value: next, type: "json" })
        });
        setDepartmentSetting(created);
      }

      setDepartments(next);
      toast.success(`Department ${trimmed} added`);
      return true;
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to create department");
      return false;
    } finally {
      setDepartmentsSaving(false);
    }
  };

  return (
    <AppLayout title="Staff Management" subtitle="Teaching and non-teaching staff directory">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total Staff" value={loading ? EMPTY_VALUE : staffRows.length} />
        <StatCard label="Teaching Staff" value={loading ? EMPTY_VALUE : teaching} />
        <StatCard label="Non-Teaching Staff" value={loading ? EMPTY_VALUE : nonTeaching} />
        <StatCard label="Active Staff" value={loading ? EMPTY_VALUE : activeStaff} />
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
            <div className="relative flex-1 min-w-60">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or staff ID..."
                className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" />
            </div>
            <select value={dept} onChange={e => setDept(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
              <option>All</option>{departmentOptions.map(d => <option key={d}>{d}</option>)}
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
              {showSkeleton ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={`staff-card-${i}`} className="h-44 rounded-xl" />
                ))
              ) : filtered.length ? (
                filtered.map(s => <StaffCard key={s.id} staff={s} onView={() => setProfile(s)} />)
              ) : (
                <div className="col-span-full rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  No staff found for the selected filters.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>{STAFF_TABLE_HEADERS.map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {showSkeleton ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <tr key={`staff-row-${i}`} className="border-t border-border">
                          <td className="px-4 py-3" colSpan={8}><Skeleton className="h-6" /></td>
                        </tr>
                      ))
                    ) : filtered.length ? (
                      filtered.map(s => (
                        <tr key={s.id} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/30">
                          <td className="px-4 py-3 font-medium">{s.name}</td>
                          <td className="px-4 py-3 font-mono text-xs">{s.staffId}</td>
                          <td className="px-4 py-3">{s.role}</td>
                          <td className="px-4 py-3">{s.department}</td>
                          <td className="px-4 py-3 font-mono text-xs">{s.phone}</td>
                          <td className="px-4 py-3 text-xs">{s.joinDate}</td>
                          <td className="px-4 py-3"><StatusPill v={s.status} /></td>
                          <td className="px-4 py-3"><button onClick={() => setProfile(s)} className="text-xs font-semibold text-primary hover:underline">View</button></td>
                        </tr>
                      ))
                    ) : (
                      <tr className="border-t border-border">
                        <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={8}>No staff found for the selected filters.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "Departments" && (
        <DepartmentsTab
          departments={departmentOptions}
          staff={staffRows}
          saving={departmentsSaving}
          onPick={(d) => { setTab("All Staff"); setDept(d); }}
          onCreate={handleCreateDepartment}
        />
      )}

      {profile && <StaffProfileSlideOver staff={profile} onClose={() => setProfile(null)} />}
      {registerOpen && (
        <RegisterStaffModal
          onClose={() => setRegisterOpen(false)}
          onSuccess={() => loadStaffData()}
          departments={departmentOptions}
          staffIdNumber={nextStaffIdNumber}
        />
      )}
    </AppLayout>
  );
}

function StaffCard({ staff, onView }: { staff: StaffRow; onView: () => void }) {
  const initials = staff.name !== EMPTY_VALUE
    ? staff.name.split(" ").map(p => p[0]).join("").slice(0, 2)
    : "--";
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary font-bold">{initials}</div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{staff.name}</div>
          <div className="text-xs text-muted-foreground">{staff.role} | {staff.department}</div>
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

function StatusPill({ v }: { v: StaffRow["status"] }) {
  const map = { Active: "bg-success/15 text-success", "On Leave": "bg-amber-100 text-amber-700", Inactive: "bg-muted text-muted-foreground" };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${map[v]}`}>{v}</span>;
}

function DepartmentsTab({
  departments,
  staff,
  onPick,
  onCreate,
  saving
}: {
  departments: string[];
  staff: StaffRow[];
  onPick: (d: string) => void;
  onCreate: (name: string) => Promise<boolean> | boolean;
  saving: boolean;
}) {
  const [newDepartment, setNewDepartment] = useState("");

  const handleCreate = async () => {
    const ok = await onCreate(newDepartment);
    if (ok) setNewDepartment("");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-xs uppercase font-bold text-muted-foreground mb-2">Create Department</div>
        <div className="flex flex-wrap gap-2">
          <input
            value={newDepartment}
            onChange={(e) => setNewDepartment(e.target.value)}
            placeholder="e.g. Procurement"
            className="h-10 flex-1 min-w-55 rounded-lg border border-border bg-background px-3 text-sm"
          />
          <button
            onClick={handleCreate}
            disabled={saving || !newDepartment.trim()}
            className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            Add Department
          </button>
        </div>
      </div>

      {departments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          No departments available yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map(d => {
            const members = staff.filter(s => s.department === d);
            const head = members[0];
            return (
              <div key={d} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="font-display font-bold text-lg">{d}</div>
                <div className="text-xs text-muted-foreground mt-1">Head: {head?.name ?? EMPTY_VALUE}</div>
                <div className="text-3xl font-display font-bold mt-3 text-primary">{members.length}</div>
                <div className="text-xs text-muted-foreground">staff members</div>
                <button onClick={() => onPick(d)} className="mt-3 text-xs font-semibold text-primary hover:underline">View Staff</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StaffProfileSlideOver({ staff, onClose }: { staff: StaffRow; onClose: () => void }) {
  const initials = staff.name !== EMPTY_VALUE
    ? staff.name.split(" ").map(p => p[0]).join("").slice(0, 2)
    : "--";
  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-card shadow-2xl overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex justify-between items-center sticky top-0 bg-card">
          <h3 className="font-display font-bold">Staff Profile</h3>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary font-display font-bold text-xl">{initials}</div>
            <div>
              <div className="font-display font-bold text-lg">{staff.name}</div>
              <div className="text-sm text-muted-foreground">{staff.role}</div>
              <StatusPill v={staff.status} />
            </div>
          </div>
          <Section title="Personal & Contact">
            <Row k="Staff ID" v={staff.staffId} />
            <Row k="Gender" v={staff.gender} />
            <Row k="Date of Birth" v={staff.dateOfBirth} />
            <Row k="National ID" v={staff.nationalId} />
            <Row k="Phone" v={staff.phone} />
            <Row k="Email" v={staff.email} />
            <Row k="Address" v={staff.address} />
            <Row k="Emergency Contact" v={staff.emergencyContact} />
          </Section>
          <Section title="Employment">
            <Row k="Role" v={staff.role} />
            <Row k="Department" v={staff.department} />
            <Row k="Join Date" v={staff.joinDate} />
            <Row k="Contract" v={staff.contractType} />
            <Row k="Status" v={staff.status} />
            <Row k="Salary" v={staff.basicSalary} />
            <Row k="Qualifications" v={staff.qualifications} />
            <Row k="Experience" v={staff.experience} />
            <Row k="Timetable Access" v={staff.timetableAccess} />
            {staff.subjects.length > 0 && <Row k="Subjects" v={staff.subjects.join(", ")} />}
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
  const value = v && v.trim() ? v : EMPTY_VALUE;
  return <div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="font-semibold text-right">{value}</span></div>;
}

function RegisterStaffModal({
  onClose,
  onSuccess,
  departments,
  staffIdNumber
}: {
  onClose: () => void;
  onSuccess: () => void;
  departments: string[];
  staffIdNumber: string;
}) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const roleOptions = [
    { label: "Teacher", value: "teacher" },
    { label: "Staff", value: "staff" },
    { label: "School Admin", value: "school_admin" },
  ];
  const contractOptions = [
    { label: "Permanent", value: "permanent" },
    { label: "Contract", value: "contract" },
    { label: "Part-time", value: "part_time" },
  ];
  const timetableOptions = [
    { label: "Full", value: "full" },
    { label: "View only", value: "view_only" },
    { label: "None", value: "none" },
  ];

  const [data, setData] = useState({
    name: "",
    gender: "Male",
    dob: "",
    nationalId: "",
    phone: "",
    email: "",
    address: "",
    emergency: "",
    role: roleOptions[0].value,
    department: departments[0] ?? "",
    joinDate: "",
    contract: contractOptions[0].value,
    salary: "",
    subjects: [] as string[],
    qualifications: "",
    experience: "",
    timetableAccess: timetableOptions[1].value,
    generateLogin: true,
    sendEmail: true,
    password: "",
  });

  useEffect(() => {
    if (departments.length && !data.department) {
      setData((prev) => ({ ...prev, department: departments[0] }));
    }
  }, [departments, data.department]);

  const update = (k: string, v: any) => setData(p => ({ ...p, [k]: v }));
  const valid1 = data.name.trim() && (data.phone.trim() || data.email.trim());
  const valid2 = data.joinDate;
  const valid3 = !data.generateLogin || data.password.trim().length >= 8;

  const generatePassword = () => {
    const suffix = Math.random().toString(36).slice(2, 8);
    update("password", `Staff@${suffix}`);
  };

  const submit = async () => {
    if (!valid1 || !valid2 || !valid3) return;
    setSubmitting(true);
    try {
      const password = data.password.trim();
      if (data.generateLogin && password.length < 8) {
        toast.error("Temporary password must be at least 8 characters");
        setSubmitting(false);
        return;
      }

      const user = await apiRequest<UserRecord>("/users", {
        method: "POST",
        auth: "school",
        body: JSON.stringify({
          name: data.name.trim(),
          email: data.email.trim() || null,
          phone: data.phone.trim() || null,
          role: data.role,
          status: data.generateLogin ? "active" : "pending",
          password: password || `Staff@${Math.random().toString(36).slice(2, 10)}`,
        })
      });

      await apiRequest("/staff/profiles", {
        method: "POST",
        auth: "school",
        body: JSON.stringify({
          user_id: user.id,
          staff_id_number: staffIdNumber,
          gender: data.gender.toLowerCase(),
          department: data.department || undefined,
          contract_type: data.contract || undefined,
          join_date: data.joinDate || undefined,
          date_of_birth: data.dob || undefined,
          national_id: data.nationalId || undefined,
          address: data.address || undefined,
          emergency_contact: data.emergency || undefined,
          qualifications: data.qualifications || undefined,
          experience: data.experience || undefined,
          timetable_access: data.timetableAccess || undefined,
          basic_salary: data.salary.trim() ? data.salary.trim() : undefined,
          employment_status: "active",
          subjects: data.role === "teacher" && data.subjects.length ? data.subjects : undefined,
        })
      });

      toast.success(`Staff ${data.name} registered successfully`);
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to register staff");
    } finally {
      setSubmitting(false);
    }
  };

  const reviewItems = [
    { label: "Staff ID", value: staffIdNumber },
    { label: "Full Name", value: data.name },
    { label: "Gender", value: data.gender },
    { label: "Date of Birth", value: data.dob },
    { label: "National ID", value: data.nationalId },
    { label: "Phone", value: data.phone },
    { label: "Email", value: data.email },
    { label: "Address", value: data.address },
    { label: "Emergency Contact", value: data.emergency },
    { label: "Role", value: roleLabel(data.role) },
    { label: "Department", value: data.department },
    { label: "Join Date", value: data.joinDate },
    { label: "Contract Type", value: toTitleCase(data.contract) },
    { label: "Salary", value: data.salary },
    { label: "Qualifications", value: data.qualifications },
    { label: "Experience", value: data.experience },
    { label: "Timetable Access", value: toTitleCase(data.timetableAccess) },
    { label: "Subjects", value: data.subjects.join(", ") },
  ];

  if (data.generateLogin) {
    reviewItems.push({ label: "Temporary Password", value: data.password || EMPTY_VALUE });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl max-w-2xl w-full" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
          <div>
            <h3 className="font-display font-bold">Register New Staff</h3>
            <div className="text-xs text-muted-foreground">Step {step} of 4</div>
          </div>
          <button onClick={onClose} disabled={submitting} className="rounded-md p-1.5 hover:bg-muted disabled:opacity-60"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-2"><div className="h-1 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${step * 25}%` }} /></div></div>
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Full Name *" value={data.name} onChange={(v: any) => update("name", v)} required />
              <Field label="Gender" type="select" value={data.gender} onChange={(v: any) => update("gender", v)} options={["Male","Female","Other"]} />
              <Field label="Date of Birth" type="date" value={data.dob} onChange={(v: any) => update("dob", v)} />
              <Field label="National ID" value={data.nationalId} onChange={(v: any) => update("nationalId", v)} />
              <Field label="Phone" value={data.phone} onChange={(v: any) => update("phone", v)} placeholder="+250 7XX XXX XXX" />
              <Field label="Email" value={data.email} onChange={(v: any) => update("email", v)} />
              <Field label="Address" value={data.address} onChange={(v: any) => update("address", v)} />
              <Field label="Emergency Contact" value={data.emergency} onChange={(v: any) => update("emergency", v)} />
            </div>
          )}
          {step === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Staff ID (auto)" value={staffIdNumber} onChange={() => {}} disabled />
              <Field label="Role" type="select" value={data.role} onChange={(v: any) => update("role", v)} options={roleOptions.map(o => o.value)} optionLabels={roleOptions.reduce((acc, o) => ({ ...acc, [o.value]: o.label }), {})} />
              <Field label="Department" type="select" value={data.department} onChange={(v: any) => update("department", v)} options={departments} />
              <Field label="Join Date *" type="date" value={data.joinDate} onChange={(v: any) => update("joinDate", v)} required />
              <Field label="Contract Type" type="select" value={data.contract} onChange={(v: any) => update("contract", v)} options={contractOptions.map(o => o.value)} optionLabels={contractOptions.reduce((acc, o) => ({ ...acc, [o.value]: o.label }), {})} />
              <Field label="Salary" value={data.salary} onChange={(v: any) => update("salary", v)} placeholder="e.g. 350,000" />
              {data.role === "teacher" && (
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
              <Field label="Qualifications" value={data.qualifications} onChange={(v: any) => update("qualifications", v)} placeholder="e.g. B.Ed, M.Sc" />
              <Field label="Experience" value={data.experience} onChange={(v: any) => update("experience", v)} placeholder="e.g. 6 years" />
              <Field label="Timetable Access" type="select" value={data.timetableAccess} onChange={(v: any) => update("timetableAccess", v)} options={timetableOptions.map(o => o.value)} optionLabels={timetableOptions.reduce((acc, o) => ({ ...acc, [o.value]: o.label }), {})} />
            </div>
          )}
          {step === 3 && (
            <div className="space-y-3">
              <Toggle label="Generate login credentials" checked={data.generateLogin} onChange={(v: any) => update("generateLogin", v)} />
              {data.generateLogin && (
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-end">
                  <Field label="Temporary Password *" type="password" value={data.password} onChange={(v: any) => update("password", v)} required />
                  <button onClick={generatePassword} className="h-10 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-muted">Generate</button>
                </div>
              )}
              <Toggle label="Send welcome email" checked={data.sendEmail} onChange={(v: any) => update("sendEmail", v)} />
              <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">Permissions follow the role definition. Manage in Settings - Roles and Permissions.</div>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-2 text-sm">
              <div className="font-semibold mb-2">Review</div>
              {reviewItems.map((item) => (
                <div key={item.label} className="flex justify-between border-b border-border py-1.5">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium">{item.value || EMPTY_VALUE}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-between">
          <button onClick={() => step > 1 ? setStep(step - 1) : onClose()} disabled={submitting} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-60">{step === 1 ? "Cancel" : "Back"}</button>
          {step < 4 ? (
            <button onClick={() => setStep(step + 1)} disabled={(step === 1 && !valid1) || (step === 2 && !valid2) || (step === 3 && !valid3)} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">Next</button>
          ) : (
            <button onClick={submit} disabled={submitting} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">Register Staff</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", options, optionLabels, placeholder, required, disabled }: any) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{label}</label>
      {type === "select" ? (
        <select value={value} onChange={e => onChange(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
          {options.map((o: string) => (
            <option key={o} value={o}>{optionLabels?.[o] ?? o}</option>
          ))}
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
