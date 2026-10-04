import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Plus, Grid3X3, List, X, Phone, Mail, Calendar, MoreVertical, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { SaPhoneInput } from "@/components/super-admin/ui";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { syncTeacherAssignments } from "@/lib/teacher-assignments";
import { useSchoolCountryName } from "@/hooks/useSchoolCountry";
import { getSchoolAuth, isSchoolAdminRole } from "@/lib/schoolAuth";

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
  user?: { id: string; name?: string | null; email?: string | null; phone?: string | null; role?: string | null } | null;
};

type UserRecord = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  status?: string | null;
};

type ClassRecord = {
  id: string;
  name: string;
};

type SectionRecord = {
  id: string;
  class_id: string;
  full_name: string;
  class_teacher_id?: string | null;
};

type SubjectRecord = {
  id: string;
  name: string;
  code?: string | null;
  is_active: boolean;
};

type TeacherSectionSubjectRecord = {
  id: string;
  teacher_id: string;
  section_id: string;
  subject_id: string;
};

type TeachingAssignmentRow = {
  section_id: string;
  subject_id: string;
  recordId?: string;
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
  assignedClasses: string[];
  assignedSectionIds: string[];
};

const TABS = ["All Staff", "Departments"] as const;
const DEFAULT_DEPARTMENTS = ["Teaching", "Administration", "Boarding", "Security", "Finance"];
const STAFF_DEPARTMENTS_KEY = "staff_departments";
const STAFF_ROLES = ["teacher", "staff", "gate_keeper", "director_of_discipline", "director_of_studies", "patron", "matron", "finance_officer", "school_admin"] as const;
const ROLE_DEPARTMENTS: Record<typeof STAFF_ROLES[number], string> = {
  teacher: "Teaching",
  staff: "Administration",
  gate_keeper: "Security",
  director_of_discipline: "Boarding",
  director_of_studies: "Academics",
  patron: "Boarding",
  matron: "Boarding",
  finance_officer: "Finance",
  school_admin: "Administration",
};
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

const buildStaffRows = (
  profiles: StaffProfileRecord[],
  users: UserRecord[],
  sections: SectionRecord[],
  classes: ClassRecord[],
  teachingAssignments: TeacherSectionSubjectRecord[],
  subjectCatalog: SubjectRecord[]
): StaffRow[] => {
  const userMap = new Map(users.map((user) => [user.id, user]));
  const classMap = new Map(classes.map((cls) => [cls.id, cls]));
  const subjectMap = new Map(subjectCatalog.map((subject) => [subject.id, subject.name]));
  const classTeacherAssignments = new Map<string, { classNames: string[]; sectionIds: string[] }>();
  const teachingSubjectsByTeacher = new Map<string, string[]>();

  teachingAssignments.forEach((assignment) => {
    const subjectName = subjectMap.get(assignment.subject_id);
    if (!subjectName) return;
    const current = teachingSubjectsByTeacher.get(assignment.teacher_id) ?? [];
    if (!current.includes(subjectName)) {
      current.push(subjectName);
      teachingSubjectsByTeacher.set(assignment.teacher_id, current);
    }
  });

  sections.forEach((section) => {
    if (!section.class_teacher_id) return;
    const cls = classMap.get(section.class_id);
    const displayName = section.full_name || cls?.name || `Section ${section.id}`;
    const current = classTeacherAssignments.get(section.class_teacher_id) ?? { classNames: [], sectionIds: [] };
    current.classNames.push(displayName);
    current.sectionIds.push(section.id);
    classTeacherAssignments.set(section.class_teacher_id, current);
  });

  return profiles.map((profile) => {
    const linkedUser = profile.user_id ? userMap.get(profile.user_id) : null;
    const fallbackUser = profile.user ?? null;
    const user = linkedUser ?? fallbackUser;
    const roleValue = user?.role ?? fallbackUser?.role ?? null;
    const assignment = profile.user_id ? classTeacherAssignments.get(profile.user_id) : null;
    const teacherId = profile.user_id ?? user?.id ?? null;

    return {
      id: profile.id,
      userId: teacherId,
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
      subjects: teacherId ? (teachingSubjectsByTeacher.get(teacherId) ?? []) : [],
      dateOfBirth: profile.date_of_birth ?? EMPTY_VALUE,
      nationalId: profile.national_id ?? EMPTY_VALUE,
      address: profile.address ?? EMPTY_VALUE,
      emergencyContact: profile.emergency_contact ?? EMPTY_VALUE,
      qualifications: profile.qualifications ?? EMPTY_VALUE,
      experience: profile.experience ?? EMPTY_VALUE,
      timetableAccess: profile.timetable_access ?? EMPTY_VALUE,
      basicSalary: profile.basic_salary ?? EMPTY_VALUE,
      assignedClasses: assignment?.classNames ?? [],
      assignedSectionIds: assignment?.sectionIds ?? [],
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
  const [editProfile, setEditProfile] = useState<StaffRow | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfileRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [sections, setSections] = useState<SectionRecord[]>([]);
  const [teacherSectionSubjects, setTeacherSectionSubjects] = useState<TeacherSectionSubjectRecord[]>([]);
  const [subjectCatalog, setSubjectCatalog] = useState<SubjectRecord[]>([]);
  const [departments, setDepartments] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [loading, setLoading] = useState(false);
  const [accountBusyId, setAccountBusyId] = useState<string | null>(null);
  const canResetPassword = isSchoolAdminRole(getSchoolAuth()?.user?.role);
  const canManageRoles = ["school_admin", "director_of_discipline", "director_of_studies"]
    .includes(getSchoolAuth()?.user?.role?.toLowerCase() ?? "");

  const staffRows = useMemo(
    () => buildStaffRows(staffProfiles, users, sections, classes, teacherSectionSubjects, subjectCatalog),
    [staffProfiles, users, sections, classes, teacherSectionSubjects, subjectCatalog]
  );
  const teacherRows = useMemo(() => staffRows.filter((staff) => staff.roleValue === "teacher"), [staffRows]);

  const departmentOptions = useMemo(() => {
    const derived = staffRows.map((staff) => staff.department);
    return mergeUnique([...DEFAULT_DEPARTMENTS, ...departments, ...derived]);
  }, [departments, staffRows]);

  const filtered = useMemo(() => {
    const baseRows = tab === "Teachers" ? teacherRows : staffRows;
    return baseRows.filter((staff) =>
      (q === "" || staff.name.toLowerCase().includes(q.toLowerCase()) || staff.staffId.toLowerCase().includes(q.toLowerCase())) &&
      (dept === "All" || staff.department === dept) &&
      (status === "All" || staff.status === status)
    );
  }, [staffRows, teacherRows, q, dept, status, tab]);

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
      setDepartments(mergeUnique([...DEFAULT_DEPARTMENTS, ...parsed.map((value: any) => String(value))]));
    } catch (error: any) {
      if (error?.status !== 404) {
        toast.error(error?.message ?? "Failed to load departments");
      }
      setDepartments(DEFAULT_DEPARTMENTS);
    }
  };

  const loadClassAssignments = async () => {
    try {
      const [classRecords, sectionRecords, assignmentRecords, subjectRecords] = await Promise.all([
        apiRequest<ClassRecord[]>('/classes?limit=1000', { auth: 'school' }),
        apiRequest<SectionRecord[]>('/sections?limit=1000', { auth: 'school' }),
        apiRequest<TeacherSectionSubjectRecord[]>('/teacher-section-subjects?limit=1000', { auth: 'school' }),
        apiRequest<SubjectRecord[]>('/subjects?limit=500', { auth: 'school' }),
      ]);
      setClasses(Array.isArray(classRecords) ? classRecords : []);
      setSections(Array.isArray(sectionRecords) ? sectionRecords : []);
      setTeacherSectionSubjects(Array.isArray(assignmentRecords) ? assignmentRecords : []);
      setSubjectCatalog(Array.isArray(subjectRecords) ? subjectRecords : []);
    } catch (error: any) {
      toast.error(error?.message ?? 'Failed to load class assignments');
    }
  };

  useEffect(() => {
    loadStaffData();
    loadDepartments();
    loadClassAssignments();
  }, []);

  const handleToggleAccount = async (staff: StaffRow) => {
    const nextStatus = staff.status === "Inactive" ? "active" : "inactive";
    const label = nextStatus === "active" ? "activate" : "deactivate";

    if (!window.confirm(`Are you sure you want to ${label} this staff account?`)) {
      return;
    }

    setAccountBusyId(staff.id);
    try {
      const updates: Promise<unknown>[] = [
        apiRequest(`/staff/profiles/${staff.id}`, {
          method: "PATCH",
          auth: "school",
          body: JSON.stringify({ employment_status: nextStatus })
        })
      ];

      if (staff.userId) {
        updates.push(apiRequest(`/users/${staff.userId}`, {
          method: "PATCH",
          auth: "school",
          body: JSON.stringify({ status: nextStatus })
        }));
      }

      await Promise.all(updates);
      toast.success(`Staff account ${nextStatus === "active" ? "activated" : "deactivated"}`);
      await loadStaffData();
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to update staff account");
    } finally {
      setAccountBusyId((current) => current === staff.id ? null : current);
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
          {canManageRoles && (
            <Link
              to="/staff/roles"
              className="mr-2 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted"
            >
              <ShieldCheck className="h-4 w-4" /> Role Management
            </Link>
          )}
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {showSkeleton ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={`staff-card-${i}`} className="h-44 rounded-xl" />
                ))
              ) : filtered.length ? (
                filtered.map(s => (
                  <StaffCard
                    key={s.id}
                    staff={s}
                    onView={() => setProfile(s)}
                    onEdit={() => setEditProfile(s)}
                    onToggleAccount={() => handleToggleAccount(s)}
                    busy={accountBusyId === s.id}
                  />
                ))
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
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <button onClick={() => setProfile(s)} className="text-xs font-semibold text-primary hover:underline">View</button>
                              <button
                                onClick={() => handleToggleAccount(s)}
                                disabled={accountBusyId === s.id}
                                className="text-xs font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {accountBusyId === s.id
                                  ? "Updating..."
                                  : s.status === "Inactive"
                                    ? "Activate Account"
                                    : "Deactivate Account"}
                              </button>
                            </div>
                          </td>
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
          onPick={(d) => { setTab("All Staff"); setDept(d); }}
        />
      )}

      {profile && (
        <StaffProfileSlideOver
          staff={profile}
          onClose={() => setProfile(null)}
          canResetPassword={canResetPassword}
        />
      )}
      {editProfile && (
        <EditStaffModal
          staff={editProfile}
          onClose={() => setEditProfile(null)}
          onSuccess={() => {
            loadStaffData();
            loadClassAssignments();
          }}
          departments={departmentOptions}
          sections={sections}
          classes={classes}
        />
      )}
      {registerOpen && (
        <RegisterStaffModal
          onClose={() => setRegisterOpen(false)}
          onSuccess={() => loadStaffData()}
          staffIdNumber={nextStaffIdNumber}
        />
      )}
    </AppLayout>
  );
}

function StaffCard({
  staff,
  onView,
  onEdit,
  onToggleAccount,
  busy
}: {
  staff: StaffRow;
  onView: () => void;
  onEdit: () => void;
  onToggleAccount: () => void;
  busy: boolean;
}) {
  const initials = staff.name !== EMPTY_VALUE
    ? staff.name.split(" ").map(p => p[0]).join("").slice(0, 2)
    : "--";
  const manageLabel = staff.status === "Inactive" ? "Activate Account" : "Deactivate Account";
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary font-bold">{initials}</div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{staff.name}</div>
          <div className="text-xs text-muted-foreground">{staff.role} | {staff.department}</div>
        </div>
        <button
          type="button"
          onClick={onToggleAccount}
          disabled={busy}
          className="rounded p-1 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={manageLabel}
          title={manageLabel}
        >
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2"><Phone className="h-3 w-3" /> {staff.phone}</div>
        <div className="flex items-center gap-2 truncate"><Mail className="h-3 w-3" /> {staff.email}</div>
        <div className="flex items-center gap-2"><Calendar className="h-3 w-3" /> Joined {staff.joinDate}</div>
        {staff.subjects.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-600">
            <span className="font-semibold">Teaching Subjects:</span>
            {staff.subjects.map((subject) => (
              <span key={subject} className="rounded-full border border-border bg-muted px-2 py-0.5">
                {subject}
              </span>
            ))}
          </div>
        )}
        {staff.assignedClasses.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-600 mt-2">
            <span className="font-semibold">Class Teacher:</span>
            {staff.assignedClasses.map((className) => (
              <span key={className} className="rounded-full border border-border bg-muted px-2 py-0.5">
                {className}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <StatusPill v={staff.status} />
        <div className="flex items-center gap-3">
          <button onClick={onToggleAccount} disabled={busy} className="text-xs font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Updating..." : manageLabel}
          </button>
          <button onClick={onEdit} className="text-xs font-semibold text-primary hover:underline">Edit Profile</button>
          <button onClick={onView} className="text-xs font-semibold text-primary hover:underline">View Profile</button>
        </div>
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
  onPick
}: {
  departments: string[];
  staff: StaffRow[];
  onPick: (d: string) => void;
}) {
  return (
    <div className="space-y-4">
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

function StaffProfileSlideOver({ staff, onClose, canResetPassword }: { staff: StaffRow; onClose: () => void; canResetPassword: boolean }) {
  const [resettingPassword, setResettingPassword] = useState(false);
  const initials = staff.name !== EMPTY_VALUE
    ? staff.name.split(" ").map(p => p[0]).join("").slice(0, 2)
    : "--";
  return (
    <div className="fixed inset-0 z-50 bg-black/50">
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-card shadow-2xl overflow-y-auto">
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
          {canResetPassword && staff.userId && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-semibold text-amber-900">Account security</div>
              <p className="mt-1 text-xs text-amber-800">Send this staff member a secure password-reset link by email.</p>
              <button
                type="button"
                disabled={resettingPassword || !staff.email || staff.email === EMPTY_VALUE}
                onClick={async () => {
                  if (!window.confirm(`Send a password reset link to ${staff.email}?`)) return;
                  setResettingPassword(true);
                  try {
                    await apiRequest(`/users/${staff.userId}/reset-password`, { method: "POST", auth: "school" });
                    toast.success("Password reset link sent to the staff member.");
                  } catch (error: any) {
                    toast.error(error?.message ?? "Failed to send password reset link");
                  } finally {
                    setResettingPassword(false);
                  }
                }}
                className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-amber-300 bg-background px-3 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resettingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                {resettingPassword ? "Sending link..." : "Reset password"}
              </button>
            </div>
          )}
          <Section title="Personal & Contact">
            <Row k="Staff ID" v={staff.staffId} />
            <Row k="Gender" v={staff.gender} />
            <Row k="Phone" v={staff.phone} />
            <Row k="Email" v={staff.email} />
          </Section>
          <Section title="Employment">
            <Row k="Role" v={staff.role} />
            <Row k="Department" v={staff.department} />
            <Row k="Join Date" v={staff.joinDate} />
            <Row k="Contract" v={staff.contractType} />
            <Row k="Status" v={staff.status} />
            <Row k="Timetable Access" v={staff.timetableAccess} />
            {staff.subjects.length > 0 && <Row k="Teaching Subjects" v={staff.subjects.join(", ")} />}
            {staff.assignedClasses.length > 0 && <Row k="Assigned Classes" v={staff.assignedClasses.join(", ")} />}
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
  staffIdNumber
}: {
  onClose: () => void;
  onSuccess: () => void;
  staffIdNumber: string;
}) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const schoolCountry = useSchoolCountryName();
  const roleOptions = [
    { label: "Teacher", value: "teacher" },
    { label: "Staff", value: "staff" },
    { label: "Gate Keeper", value: "gate_keeper" },
    { label: "Director of Discipline (DOD)", value: "director_of_discipline" },
    { label: "Director of Studies (DOS)", value: "director_of_studies" },
    { label: "Patron", value: "patron" },
    { label: "Matron", value: "matron" },
    { label: "Finance Officer", value: "finance_officer" },
    { label: "School Admin", value: "school_admin" },
  ];

  const [data, setData] = useState({
    name: "",
    gender: "Male",
    phone: "",
    email: "",
    joinDate: "",
    address: "",
    role: roleOptions[0].value,
    secondaryRoles: [] as string[],
  });

  const department = ROLE_DEPARTMENTS[data.role as typeof STAFF_ROLES[number]];

  const update = (k: string, v: any) => {
    setData(p => ({ ...p, [k]: v }));
    if (submissionError) setSubmissionError(null);
    if (k === "email" && emailError) setEmailError(null);
  };
  const todayValue = new Date().toISOString().slice(0, 10);
  const valid1 = Boolean(data.name.trim() && (data.phone.trim() || data.email.trim()));

  const submit = async () => {
    if (!valid1) {
      return;
    }
    setSubmissionError(null);
    setEmailError(null);
    setSubmitting(true);
    try {
      const password = `Staff@${Math.random().toString(36).slice(2, 10)}`;

      const user = await apiRequest<UserRecord>("/users", {
        method: "POST",
        auth: "school",
        body: JSON.stringify({
          name: data.name.trim(),
          email: data.email.trim() || null,
          phone: data.phone.trim() || null,
          role: data.role,
          roles: data.secondaryRoles.filter((role) => role !== data.role),
          status: "active",
          password,
        })
      });

      await apiRequest("/staff/profiles", {
        method: "POST",
        auth: "school",
        body: JSON.stringify({
          user_id: user.id,
          staff_id_number: staffIdNumber,
          gender: data.gender.toLowerCase(),
          department,
          join_date: data.joinDate || undefined,
          employment_status: "active",
        })
      }).catch(async (profileError) => {
        // Roll back the user we just created, otherwise the orphaned account
        // blocks retrying with the same email.
        await apiRequest(`/users/${user.id}`, { method: "DELETE", auth: "school" }).catch(() => {});
        throw profileError;
      });

      if (data.email.trim()) {
        await apiRequest("/auth/staff-onboarding", {
          method: "POST",
          auth: "school",
          body: JSON.stringify({ email: data.email.trim() })
        });
      }

      toast.success(`Staff ${data.name} registered successfully`);
      onSuccess();
      onClose();
    } catch (error: any) {
      const rawMessage = error?.message ?? "Failed to register staff";
      const isEmailConflict =
        error?.status === 409 ||
        error?.code === "conflict" ||
        /email already in use/i.test(rawMessage);

      if (isEmailConflict) {
        const message = "Email already in use. Use a different email or update the existing staff account.";
        setEmailError(message);
        setSubmissionError(message);
        setStep(1);
        toast.error(message);
      } else {
        setSubmissionError(rawMessage);
        toast.error(rawMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const reviewItems = [
    { label: "Staff ID", value: staffIdNumber },
    { label: "Full Name", value: data.name },
    { label: "Gender", value: data.gender },
    { label: "Email", value: data.email },
    { label: "Address", value: data.address },
    { label: "Role", value: roleOptions.find((o) => o.value === data.role)?.label ?? data.role },
    { label: "Additional roles", value: data.secondaryRoles.map((role) => roleOptions.find((o) => o.value === role)?.label ?? role).join(", ") },
    { label: "Department", value: department },
    { label: "Join Date", value: data.joinDate },
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="bg-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
          <div>
            <h3 className="font-display font-bold">Register New Staff</h3>
            <div className="text-xs text-muted-foreground">Step {step} of 2</div>
          </div>
          <button onClick={onClose} disabled={submitting} className="rounded-md p-1.5 hover:bg-muted disabled:opacity-60"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-2">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${(step / 2) * 100}%` }} />
          </div>
        </div>
        <div className="flex-1 min-h-0 px-6 py-4 space-y-4 overflow-y-auto">
          {submissionError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {submissionError}
            </div>
          )}
          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Full Name *" value={data.name} onChange={(v: any) => update("name", v)} required />
              <Field label="Gender" type="select" value={data.gender} onChange={(v: any) => update("gender", v)} options={["Male", "Female", "Other"]} />
              <SaPhoneInput
                label="Phone"
                value={data.phone}
                onChange={(v) => update("phone", v)}
                defaultCountryName={schoolCountry ?? undefined}
                placeholder="Phone number"
                className="md:col-span-2"
              />
              <Field label="Email" value={data.email} onChange={(v: any) => update("email", v)} error={emailError ?? undefined} />
              <Field label="Join Date" type="date" value={data.joinDate} onChange={(v: any) => update("joinDate", v)} max={todayValue} />
              <Field label="Address" value={data.address} onChange={(v: any) => update("address", v)} className="md:col-span-2" />
              <Field label="Role" type="select" value={data.role} onChange={(v: any) => update("role", v)} options={roleOptions.map((o) => o.value)} optionLabels={roleOptions.reduce((acc, o) => ({ ...acc, [o.value]: o.label }), {} as Record<string, string>)} />
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Additional roles</label>
                <div className="max-h-28 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                  {roleOptions.filter((option) => option.value !== data.role).map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={data.secondaryRoles.includes(option.value)}
                        onChange={(event) => update("secondaryRoles", event.target.checked
                          ? [...data.secondaryRoles, option.value]
                          : data.secondaryRoles.filter((role) => role !== option.value))}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Department</label>
                <div className="flex h-10 w-full items-center rounded-lg border border-border bg-muted px-3 text-sm">{department}</div>
                <div className="mt-1 text-xs text-muted-foreground">Set automatically from the selected role.</div>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3">
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
          {step < 2 ? (
            <button onClick={() => setStep(step + 1)} disabled={step === 1 && !valid1} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">Next</button>
          ) : (
            <button onClick={submit} disabled={submitting} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">Register Staff</button>
          )}
        </div>
      </div>
    </div>
  );
}

function EditStaffModal({
  staff,
  onClose,
  onSuccess,
  departments,
  sections,
  classes
}: {
  staff: StaffRow;
  onClose: () => void;
  onSuccess: () => void;
  departments: string[];
  sections: SectionRecord[];
  classes: ClassRecord[];
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const schoolCountry = useSchoolCountryName();
  const [data, setData] = useState({
    name: staff.name === EMPTY_VALUE ? "" : staff.name,
    role: staff.roleValue ?? "staff",
    department: staff.department === EMPTY_VALUE ? "" : staff.department,
    gender: staff.gender === EMPTY_VALUE ? "Male" : staff.gender,
    phone: staff.phone === EMPTY_VALUE ? "" : staff.phone,
    email: staff.email === EMPTY_VALUE ? "" : staff.email,
    contractType: staff.contractType === EMPTY_VALUE ? "" : staff.contractType,
    timetableAccess: staff.timetableAccess === EMPTY_VALUE ? "" : staff.timetableAccess,
  });
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>(staff.assignedSectionIds ?? []);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [newTeachingSubject, setNewTeachingSubject] = useState("");
  const [creatingSubject, setCreatingSubject] = useState(false);
  const [teachingAssignments, setTeachingAssignments] = useState<TeachingAssignmentRow[]>([]);
  const [initialTeachingAssignments, setInitialTeachingAssignments] = useState<TeacherSectionSubjectRecord[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editingSubjectName, setEditingSubjectName] = useState("");
  const [subjectUpdating, setSubjectUpdating] = useState(false);
  const timetableAccessOptions = ["Full Access", "Limited Access", "Read Only"];

  useEffect(() => {
    if (data.role !== "teacher") return;

    (async () => {
      setAssignmentsLoading(true);
      try {
        const subjectRecords = await apiRequest<SubjectRecord[]>("/subjects?limit=500", { auth: "school" });
        setSubjects(Array.isArray(subjectRecords) ? subjectRecords : []);

        if (staff.userId) {
          const assignmentRecords = await apiRequest<TeacherSectionSubjectRecord[]>(
            `/teacher-section-subjects?teacher_id=${staff.userId}&limit=500`,
            { auth: "school" }
          );
          const existing = Array.isArray(assignmentRecords) ? assignmentRecords : [];
          setInitialTeachingAssignments(existing);
          setTeachingAssignments(
            existing.map((item) => ({
              recordId: item.id,
              section_id: item.section_id,
              subject_id: item.subject_id,
            }))
          );
        } else {
          setInitialTeachingAssignments([]);
          setTeachingAssignments([]);
        }
      } catch (err: any) {
        toast.error(err?.message ?? "Failed to load teaching assignments");
      } finally {
        setAssignmentsLoading(false);
      }
    })();
  }, [data.role, staff.userId]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/staff/profiles/${staff.id}`, {
        method: "PATCH",
        auth: "school",
        body: JSON.stringify({
          gender: data.gender ? data.gender.toLowerCase() : null,
          department: data.department || null,
          timetable_access: data.timetableAccess || null,
        })
      });

      await apiRequest(`/users/${staff.userId}`, {
        method: "PATCH",
        auth: "school",
        body: JSON.stringify({
          name: data.name || undefined,
          email: data.email || null,
          phone: data.phone || null,
          role: data.role || undefined
        })
      });

      if (staff.userId) {
        const currentSectionIds = staff.assignedSectionIds ?? [];
        const nextSectionIds = data.role === "teacher" ? selectedSectionIds : [];

        const sectionsToUnassign = currentSectionIds.filter((id) => !nextSectionIds.includes(id));
        const sectionsToAssign = nextSectionIds.filter((id) => !currentSectionIds.includes(id));

        await Promise.all([
          ...sectionsToUnassign.map((sectionId) =>
            apiRequest(`/sections/${sectionId}`, {
              method: "PATCH",
              auth: "school",
              body: JSON.stringify({ class_teacher_id: null })
            })
          ),
          ...sectionsToAssign.map((sectionId) =>
            apiRequest(`/sections/${sectionId}`, {
              method: "PATCH",
              auth: "school",
              body: JSON.stringify({ class_teacher_id: staff.userId })
            })
          )
        ]);

        if (data.role === "teacher") {
          await syncTeacherAssignments(
            staff.userId,
            initialTeachingAssignments,
            teachingAssignments
          );
        }
      }

      toast.success("Staff profile updated.");
      onSuccess();
      onClose();
    } catch (err: any) {
      const message = err?.message ?? "Failed to update staff profile";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const removeTeachingAssignment = (index: number) => {
    setTeachingAssignments((prev) => prev.filter((_, i) => i !== index));
  };

  const updateTeachingAssignment = (
    index: number,
    field: "section_id" | "subject_id",
    value: string
  ) => {
    setTeachingAssignments((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const addTeachingAssignment = () => {
    setTeachingAssignments((prev) => [...prev, { section_id: "", subject_id: "" }]);
  };

  const handleCreateTeachingSubject = async () => {
    const name = newTeachingSubject.trim();
    if (name.length < 2) {
      toast.error("Subject name must be at least 2 characters");
      return;
    }
    if (subjects.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      toast.error("Subject already exists");
      setNewTeachingSubject("");
      return;
    }

    setCreatingSubject(true);
    try {
      const created = await apiRequest<SubjectRecord>("/subjects", {
        method: "POST",
        auth: "school",
        body: JSON.stringify({ name }),
      });
      setSubjects((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      setNewTeachingSubject("");
      toast.success(`Subject "${created.name}" created`);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create subject");
    } finally {
      setCreatingSubject(false);
    }
  };

  const toggleTeachingSubject = async (subject: SubjectRecord) => {
    try {
      const updated = await apiRequest<SubjectRecord>(`/subjects/${subject.id}`, {
        method: "PATCH",
        auth: "school",
        body: JSON.stringify({ is_active: !subject.is_active }),
      });
      setSubjects((prev) => prev.map((item) => item.id === updated.id ? updated : item));
      toast.success(`Subject "${updated.name}" ${updated.is_active ? "activated" : "deactivated"}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update subject status");
    }
  };

  const saveTeachingSubjectName = async () => {
    const name = editingSubjectName.trim();
    if (!editingSubjectId || name.length < 2) {
      toast.error("Subject name must be at least 2 characters");
      return;
    }
    setSubjectUpdating(true);
    try {
      const updated = await apiRequest<SubjectRecord>(`/subjects/${editingSubjectId}`, {
        method: "PATCH",
        auth: "school",
        body: JSON.stringify({ name }),
      });
      setSubjects((prev) => prev.map((item) => item.id === updated.id ? updated : item));
      setEditingSubjectId(null);
      toast.success(`Subject renamed to "${updated.name}"`);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to rename subject");
    } finally {
      setSubjectUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="bg-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-border flex justify-between items-center sticky top-0 bg-card">
          <h3 className="font-display font-bold">Edit Staff Profile</h3>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Full Name" value={data.name} onChange={(v: any) => setData((prev) => ({ ...prev, name: v }))} />
            <Field label="Role" type="select" value={data.role} onChange={(v: any) => setData((prev) => ({ ...prev, role: v }))} options={[...STAFF_ROLES]} optionLabels={STAFF_ROLES.reduce((acc, r) => ({ ...acc, [r]: toTitleCase(r) }), {} as Record<string, string>)} />
            <Field label="Gender" type="select" value={data.gender} onChange={(v: any) => setData((prev) => ({ ...prev, gender: v }))} options={["Male", "Female", "Other"]} />
            <Field label="Department" type="select" value={data.department} onChange={(v: any) => setData((prev) => ({ ...prev, department: v }))} options={departments} />
            <SaPhoneInput label="Phone" value={data.phone} onChange={(v) => setData((prev) => ({ ...prev, phone: v }))} defaultCountryName={schoolCountry ?? undefined} className="md:col-span-2" />
            <Field label="Email" value={data.email} onChange={(v: any) => setData((prev) => ({ ...prev, email: v }))} className="md:col-span-2" />
            <Field
              label="Timetable Access"
              type="select"
              value={data.timetableAccess}
              onChange={(v: any) => setData((prev) => ({ ...prev, timetableAccess: v }))}
              options={timetableAccessOptions}
              optionLabels={{
                "Full Access": "Full Access",
                "Limited Access": "Limited Access",
                "Read Only": "Read Only"
              }}
            />
            {data.role === "teacher" && (
              <div className="md:col-span-2 space-y-2">
                <label className="block text-xs font-semibold text-muted-foreground">Assigned Class Teacher Sections</label>
                <div className="grid gap-2">
                  {sections.length === 0 ? (
                    <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">No class sections loaded.</div>
                  ) : (
                    sections.map((section) => {
                      const cls = classes.find((c) => c.id === section.class_id);
                      const label = section.full_name || `${cls?.name ?? "Class"} ${section.id}`;
                      const checked = selectedSectionIds.includes(section.id);
                      return (
                        <label key={section.id} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedSectionIds((prev) =>
                                prev.includes(section.id)
                                  ? prev.filter((item) => item !== section.id)
                                  : [...prev, section.id]
                              );
                            }}
                          />
                          <span>{label}</span>
                        </label>
                      );
                    })
                  )}
                </div>
                {selectedSectionIds.length === 0 && (
                  <div className="text-xs text-muted-foreground">Choose sections where this teacher should be the class teacher.</div>
                )}
              </div>
            )}
            {data.role === "teacher" && (
              <div className="md:col-span-2 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Teaching Assignments (Class + Subject)
                  </label>
                  <button
                    type="button"
                    onClick={addTeachingAssignment}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    + Add assignment
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={newTeachingSubject}
                    onChange={(e) => setNewTeachingSubject(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreateTeachingSubject();
                      }
                    }}
                    placeholder="Create subject (e.g. Mathematics)"
                    className="h-10 flex-1 min-w-48 rounded-lg border border-border bg-background px-3 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleCreateTeachingSubject}
                    disabled={creatingSubject || newTeachingSubject.trim().length < 2}
                    className="h-10 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-60"
                  >
                    {creatingSubject ? "Adding…" : "Add Subject"}
                  </button>
                </div>
                {subjects.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {subjects.map((subject) => editingSubjectId === subject.id ? (
                      <span key={subject.id} className="inline-flex items-center gap-1">
                        <input value={editingSubjectName} onChange={(e) => setEditingSubjectName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") void saveTeachingSubjectName(); if (e.key === "Escape") setEditingSubjectId(null); }}
                          autoFocus className="h-8 w-40 rounded-md border border-input bg-background px-2 text-xs" />
                        <button type="button" onClick={() => void saveTeachingSubjectName()} disabled={subjectUpdating}
                          className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50">Save</button>
                        <button type="button" onClick={() => setEditingSubjectId(null)} className="rounded-md border border-border px-2 py-1 text-xs">Cancel</button>
                      </span>
                    ) : (
                      <span key={subject.id} className="inline-flex items-center gap-1">
                        <button type="button" onClick={() => toggleTeachingSubject(subject)}
                          title={subject.is_active ? "Deactivate subject" : "Activate subject before assigning it"}
                          className={`rounded-full px-3 py-1 text-xs font-medium ${subject.is_active ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                          {subject.name} · {subject.is_active ? "Active" : "Activate"}
                        </button>
                        <button type="button" onClick={() => { setEditingSubjectId(subject.id); setEditingSubjectName(subject.name); }}
                          className="rounded-md border border-border px-1.5 py-1 text-xs hover:bg-muted">Edit</button>
                      </span>
                    ))}
                  </div>
                ) : (
                  !assignmentsLoading && (
                    <div className="text-xs text-muted-foreground">
                      No subjects yet. Create one above, then pick it in each assignment row.
                    </div>
                  )
                )}
                {assignmentsLoading ? (
                  <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                    Loading teaching assignments…
                  </div>
                ) : teachingAssignments.length === 0 ? (
                  <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                    No class/subject teaching assignments yet. Add one so the teacher can schedule exams and enter marks.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {teachingAssignments.map((assignment, index) => (
                        <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                          <select
                            value={assignment.section_id}
                            onChange={(e) => updateTeachingAssignment(index, "section_id", e.target.value)}
                            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                          >
                            <option value="">Select class</option>
                            {sections.map((section) => {
                              const sectionClass = classes.find((c) => c.id === section.class_id);
                              const label = section.full_name || `${sectionClass?.name ?? "Class"} ${section.id}`;
                              return (
                                <option key={section.id} value={section.id}>{label}</option>
                              );
                            })}
                          </select>
                          <select
                            value={assignment.subject_id}
                            onChange={(e) => updateTeachingAssignment(index, "subject_id", e.target.value)}
                            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                          >
                            <option value="">Select subject</option>
                            {subjects.filter((subject) => subject.is_active || subject.id === assignment.subject_id).map((subject) => (
                              <option key={subject.id} value={subject.id} disabled={!subject.is_active}>{subject.name}{!subject.is_active ? " (inactive)" : ""}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => removeTeachingAssignment(index)}
                            className="h-10 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted"
                          >
                            Remove
                          </button>
                        </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} disabled={submitting} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-60">Cancel</button>
          <button onClick={submit} disabled={submitting} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">Save Changes</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", options, optionLabels, placeholder, required, disabled, error, max, className }: any) {
  const borderClass = error || (required && !value) ? "border-destructive" : "border-border";
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{label}</label>
      {type === "select" ? (
        <select value={value} onChange={e => onChange(e.target.value)} className={`h-10 w-full rounded-lg border ${borderClass} bg-background px-3 text-sm`}>
          {options.map((o: string) => (
            <option key={o} value={o}>{optionLabels?.[o] ?? o}</option>
          ))}
        </select>
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
          max={max}
          className={`h-10 w-full rounded-lg border bg-background px-3 text-sm disabled:opacity-60 ${borderClass}`} />
      )}
      {error && <div className="mt-1 text-xs text-destructive">{error}</div>}
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
