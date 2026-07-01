import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, UserPlus, Grid3X3, List, X, Phone, Pencil, Check, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Avatar } from "@/components/ui-kit/Avatar";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentRegistrationModal } from "@/components/modals/StudentRegistrationModal";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/students")({
  component: StudentsPage,
});

type ApiStudent = {
  id: string;
  student_id_number: string | null;
  first_name: string;
  last_name: string;
  other_names: string | null;
  date_of_birth: string | null;
  gender: "male" | "female" | "other" | null;
  student_type: "boarding" | "day" | null;
  status: string | null;
  combination: string | null;
  enrollment_year: number | null;
  blood_group: string | null;
  religion: string | null;
  previous_school: string | null;
  national_id: string | null;
  created_at: string;
  primary_parent: {
    first_name: string;
    last_name: string;
    phone: string;
  } | null;
  current_section: {
    name: string;
    full_name: string;
  } | null;
  device_user_id?: string | null;
  device_sync_status?: string | null;
  last_device_sync?: string | null;
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function pushStatusLabel(student: ApiStudent) {
  if (student.device_user_id || student.device_sync_status === "synced") return "Pushed to device";
  if (student.device_sync_status && student.device_sync_status !== "not synced") return capitalize(student.device_sync_status);
  return "Not pushed";
}

function pushStatusClass(student: ApiStudent) {
  if (student.device_user_id || student.device_sync_status === "synced") return "bg-success/15 text-success";
  if (student.device_sync_status && student.device_sync_status !== "not synced") return "bg-amber-100 text-amber-700";
  return "bg-muted text-muted-foreground";
}

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.split("T")[0];
}

// ─── Page ────────────────────────────────────────────────────────────────────

function StudentsPage() {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("All");
  const [residencyFilter, setResidencyFilter] = useState<"All" | "Boarding" | "Day">("All");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [page, setPage] = useState(1);
  const [profile, setProfile] = useState<ApiStudent | null>(null);
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState<ApiStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 15;

  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<ApiStudent[]>("/students?limit=10000", { auth: "school" });
      setStudents(Array.isArray(data) ? data : []);
    } catch (err: any) {
      const msg = err?.message ?? "Failed to load students";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchStudents(); }, []);

  const availableClasses = useMemo(() => {
    const seen = new Set<string>();
    students.forEach(s => { if (s.current_section) seen.add(s.current_section.full_name); });
    return Array.from(seen).sort();
  }, [students]);

  const filtered = useMemo(() => students.filter(s => {
    const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
    const studentId = (s.student_id_number ?? "").toLowerCase();
    const sectionName = s.current_section?.full_name ?? "";
    const residency = s.student_type ? capitalize(s.student_type) : "";
    return (
      (classFilter === "All" || sectionName === classFilter) &&
      (residencyFilter === "All" || residency === residencyFilter) &&
      (search === "" || fullName.includes(search.toLowerCase()) || studentId.includes(search.toLowerCase()))
    );
  }), [students, search, classFilter, residencyFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleStudents = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const total = students.length;
  const male = students.filter(s => s.gender === "male").length;
  const female = students.filter(s => s.gender === "female").length;
  const boarding = students.filter(s => s.student_type === "boarding").length;
  const day = students.filter(s => s.student_type === "day").length;
  const isEmpty = total === 0;
  const pageStart = filtered.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, filtered.length);

  useEffect(() => {
    setPage(1);
  }, [search, classFilter, residencyFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleEditSuccess = async () => {
    setProfile(null);
    await fetchStudents();
  };

  return (
    <AppLayout title="Student Management" subtitle={`${total} students enrolled`}>
      {loading ? (
        <StudentsSkeleton view={view} />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <p className="text-sm">{error}</p>
          <button onClick={() => void fetchStudents()} className="mt-3 text-sm font-semibold text-primary hover:underline">
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            <StatCard label="Total Students" value={total} />
            <StatCard label="Male" value={male} />
            <StatCard label="Female" value={female} />
            <StatCard label="Boarding" value={boarding} />
            <StatCard label="Day Schooler" value={day} />
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-55">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or ID…"
                className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
              />
            </div>
            <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
              <option value="All">All Classes</option>
              {availableClasses.map(c => <option key={c}>{c}</option>)}
            </select>
            <select value={residencyFilter} onChange={(e) => setResidencyFilter(e.target.value as "All" | "Boarding" | "Day")}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
              <option value="All">All Students</option>
              <option value="Day">Day Schooler</option>
              <option value="Boarding">Boarding Student</option>
            </select>
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button onClick={() => setView("grid")}
                className={`p-2 ${view === "grid" ? "bg-primary text-primary-foreground" : "bg-background"}`}>
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button onClick={() => setView("table")}
                className={`p-2 ${view === "table" ? "bg-primary text-primary-foreground" : "bg-background"}`}>
                <List className="h-4 w-4" />
              </button>
            </div>
            <button onClick={() => setOpen(true)}
              className="h-10 inline-flex items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              <UserPlus className="h-4 w-4" /> Register New Student
            </button>
          </div>

          {isEmpty ? (
            <div className="mt-10 rounded-xl border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">No students recorded yet.</p>
              <button
                onClick={() => setOpen(true)}
                className="mt-4 h-10 inline-flex items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <UserPlus className="h-4 w-4" /> Register Student
              </button>
            </div>
          ) : view === "grid" ? (
            <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleStudents.map(s => {
                const fullName = `${s.first_name} ${s.last_name}`;
                const residency = s.student_type ? capitalize(s.student_type) : null;
                const sectionName = s.current_section?.full_name;
                const parentPhone = s.primary_parent?.phone;
                return (
                  <div key={s.id} className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-start justify-between">
                      <Avatar name={fullName} size="lg" />
                      {residency && (
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          {residency}
                        </span>
                      )}
                    </div>
                    <h3 className="font-display font-bold mt-3 truncate">{fullName}</h3>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{s.student_id_number ?? "—"}</p>
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      {sectionName && (
                        <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-semibold">
                          {sectionName}
                        </span>
                      )}
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${pushStatusClass(s)}`}>
                        {pushStatusLabel(s)}
                      </span>
                    </div>
                    {parentPhone && (
                      <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span className="truncate">{parentPhone}</span>
                      </div>
                    )}
                    <button onClick={() => setProfile(s)} className="mt-3 text-xs font-semibold text-primary hover:underline">
                      View Profile
                    </button>
                  </div>
                );
              })}
              {filtered.length === 0 && total > 0 && (
                <div className="col-span-full text-center py-16 text-muted-foreground">No students match your search.</div>
              )}
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3">Name</th>
                      <th className="text-left px-4 py-3">Student ID</th>
                      <th className="text-left px-4 py-3">Class</th>
                      <th className="text-left px-4 py-3">Residency</th>
                      <th className="text-left px-4 py-3">Device</th>
                      <th className="text-left px-4 py-3">Parent</th>
                      <th className="text-left px-4 py-3">Phone</th>
                      <th className="text-left px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleStudents.map(s => {
                      const fullName = `${s.first_name} ${s.last_name}`;
                      const residency = s.student_type ? capitalize(s.student_type) : "—";
                      const sectionName = s.current_section?.full_name ?? "—";
                      const parentName = s.primary_parent ? `${s.primary_parent.first_name} ${s.primary_parent.last_name}` : "—";
                      const parentPhone = s.primary_parent?.phone ?? "—";
                      return (
                        <tr key={s.id} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/30">
                          <td className="px-4 py-3 font-medium">{fullName}</td>
                          <td className="px-4 py-3 font-mono text-xs">{s.student_id_number ?? "—"}</td>
                          <td className="px-4 py-3">{sectionName}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-muted-foreground">{residency}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${pushStatusClass(s)}`}>
                              {pushStatusLabel(s)}
                            </span>
                          </td>
                          <td className="px-4 py-3">{parentName}</td>
                          <td className="px-4 py-3 font-mono text-xs">{parentPhone}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => setProfile(s)} className="text-xs font-semibold text-primary hover:underline">View</button>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && total > 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No students match your search.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Showing {pageStart}–{pageEnd} of {filtered.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <StudentRegistrationModal open={open} onClose={() => setOpen(false)} onSuccess={() => void fetchStudents()} />
      {profile && (
        <StudentProfileSlideOver
          student={profile}
          onClose={() => setProfile(null)}
          onEditSuccess={handleEditSuccess}
        />
      )}
    </AppLayout>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function StudentsSkeleton({ view }: { view: "grid" | "table" }) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={`stat-skeleton-${i}`} className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-6 w-12" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <Skeleton className="h-10 flex-1 min-w-55" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-44" />
      </div>
      {view === "grid" ? (
        <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={`student-skeleton-${i}`} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <Skeleton className="h-12 w-12 rounded-full" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="mt-3 h-4 w-32" />
              <Skeleton className="mt-2 h-3 w-24" />
              <div className="mt-3 flex items-center gap-2"><Skeleton className="h-5 w-12" /></div>
              <Skeleton className="mt-3 h-3 w-28" />
              <Skeleton className="mt-3 h-3 w-20" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>{Array.from({ length: 7 }).map((_, i) => (
                  <th key={`head-skeleton-${i}`} className="text-left px-4 py-3"><Skeleton className="h-3 w-16" /></th>
                ))}</tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`row-skeleton-${i}`} className="border-t border-border">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={`cell-skeleton-${i}-${j}`} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Profile slide-over ──────────────────────────────────────────────────────

function StudentProfileSlideOver({
  student,
  onClose,
  onEditSuccess,
}: {
  student: ApiStudent;
  onClose: () => void;
  onEditSuccess: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);

  const fullName = `${student.first_name} ${student.last_name}`;
  const residency = student.student_type ? capitalize(student.student_type) : null;
  const gender = student.gender ? capitalize(student.gender) : "—";
  const sectionName = student.current_section?.full_name ?? null;
  const parentName = student.primary_parent
    ? `${student.primary_parent.first_name} ${student.primary_parent.last_name}`
    : "—";
  const parentPhone = student.primary_parent?.phone ?? "—";
  const dob = student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : "—";

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
        <div
          className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-card shadow-2xl overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* header */}
          <div className="px-6 py-4 border-b border-border flex justify-between items-center sticky top-0 bg-card z-10">
            <h3 className="font-display font-bold">Student Profile</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* content */}
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-4">
              <Avatar name={fullName} size="lg" />
              <div>
                <div className="font-display font-bold text-lg">{fullName}</div>
                <div className="text-sm text-muted-foreground font-mono">{student.student_id_number ?? "—"}</div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  {sectionName && (
                    <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-semibold">
                      {sectionName}
                    </span>
                  )}
                  {residency && (
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                      {residency}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <DetailSection title="Student Details">
              <DetailRow label="Gender" value={gender} />
              <DetailRow label="Date of Birth" value={dob} />
              {student.combination && <DetailRow label="Combination" value={student.combination} />}
              {student.blood_group && <DetailRow label="Blood Group" value={student.blood_group} />}
              {student.religion && <DetailRow label="Religion" value={student.religion} />}
              {student.enrollment_year && <DetailRow label="Enrollment Year" value={String(student.enrollment_year)} />}
              {student.previous_school && <DetailRow label="Previous School" value={student.previous_school} />}
              <DetailRow label="Status" value={student.status ? capitalize(student.status) : "—"} />
            </DetailSection>

            <DetailSection title="Parent / Guardian">
              <DetailRow label="Name" value={parentName} />
              <DetailRow label="Phone" value={parentPhone} />
            </DetailSection>
          </div>
        </div>
      </div>

      {editOpen && (
        <EditStudentModal
          student={student}
          onClose={() => setEditOpen(false)}
          onSuccess={() => { setEditOpen(false); onEditSuccess(); }}
        />
      )}
    </>
  );
}

// ─── Edit modal ──────────────────────────────────────────────────────────────

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const STATUSES = ["active", "inactive", "transferred", "graduated", "expelled"];
const YEARS = ["2022", "2023", "2024", "2025", "2026"];

interface EditForm {
  studentIdNumber: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  residency: string;
  combination: string;
  year: string;
  bloodGroup: string;
  religion: string;
  previousSchool: string;
  status: string;
}

function EditStudentModal({
  student,
  onClose,
  onSuccess,
}: {
  student: ApiStudent;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<EditForm>({
    studentIdNumber: student.student_id_number ?? "",
    firstName: student.first_name,
    lastName: student.last_name,
    dob: toDateInput(student.date_of_birth),
    gender: student.gender ? capitalize(student.gender) : "Male",
    residency: student.student_type ? capitalize(student.student_type) : "Day",
    combination: student.combination ?? "",
    year: student.enrollment_year ? String(student.enrollment_year) : String(new Date().getFullYear()),
    bloodGroup: student.blood_group ?? "",
    religion: student.religion ?? "",
    previousSchool: student.previous_school ?? "",
    status: student.status ?? "active",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof EditForm, boolean>>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof EditForm>(k: K, v: EditForm[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  const validate = () => {
    const e: typeof errors = {};
    if (!form.firstName.trim()) e.firstName = true;
    if (!form.lastName.trim()) e.lastName = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await apiRequest(`/students/${student.id}`, {
        method: "PATCH",
        auth: "school",
        body: JSON.stringify({
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          student_id_number: form.studentIdNumber.trim() || undefined,
          date_of_birth: form.dob || undefined,
          gender: form.gender.toLowerCase(),
          student_type: form.residency.toLowerCase(),
          combination: form.combination || undefined,
          enrollment_year: form.year ? parseInt(form.year, 10) : undefined,
          blood_group: form.bloodGroup || undefined,
          religion: form.religion.trim() || undefined,
          previous_school: form.previousSchool.trim() || undefined,
          status: form.status || undefined,
        }),
      });
      toast.success("Student updated successfully");
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update student");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 grid place-items-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-card shadow-2xl max-h-[90vh] flex flex-col">

        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-display text-lg font-bold">Edit Student</h2>
          <button onClick={onClose} disabled={saving} className="rounded-md p-1.5 hover:bg-muted disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* body */}
        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-6">

          {/* Basic info */}
          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground mb-3">Basic Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <EField label="Student ID Number">
                <input value={form.studentIdNumber} onChange={e => set("studentIdNumber", e.target.value)}
                  className={eCls()} placeholder="e.g. 2024001" />
              </EField>
              <EField label="First Name *" error={errors.firstName}>
                <input value={form.firstName} onChange={e => set("firstName", e.target.value)}
                  className={eCls(errors.firstName)} placeholder="First name" />
              </EField>
              <EField label="Last Name *" error={errors.lastName}>
                <input value={form.lastName} onChange={e => set("lastName", e.target.value)}
                  className={eCls(errors.lastName)} placeholder="Last name" />
              </EField>
              <EField label="Date of Birth">
                <input type="date" value={form.dob} onChange={e => set("dob", e.target.value)} className={eCls()} />
              </EField>
              <EField label="Gender">
                <div className="flex gap-3 h-10 items-center">
                  {["Male", "Female"].map(g => (
                    <label key={g} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" checked={form.gender === g} onChange={() => set("gender", g)} className="accent-primary" />
                      {g}
                    </label>
                  ))}
                </div>
              </EField>
              <EField label="Residency">
                <select value={form.residency} onChange={e => set("residency", e.target.value)} className={eCls()}>
                  <option value="Day">Day Schooler</option>
                  <option value="Boarding">Boarding Student</option>
                </select>
              </EField>
              <EField label="Status">
                <select value={form.status} onChange={e => set("status", e.target.value)} className={eCls()}>
                  {STATUSES.map(s => (
                    <option key={s} value={s}>{capitalize(s)}</option>
                  ))}
                </select>
              </EField>
            </div>
          </div>

          {/* Academic info */}
          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground mb-3">Academic Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <EField label="Year of Enrollment">
                <select value={form.year} onChange={e => set("year", e.target.value)} className={eCls()}>
                  {YEARS.map(y => <option key={y}>{y}</option>)}
                </select>
              </EField>
              <EField label="Combination (optional)">
                <select value={form.combination} onChange={e => set("combination", e.target.value)} className={eCls()}>
                  <option value="">None</option>
                  {["PCM", "PCB", "MCB", "HEG", "MEG", "MPC", "HGL"].map(c => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </EField>
              <EField label="Blood Group">
                <select value={form.bloodGroup} onChange={e => set("bloodGroup", e.target.value)} className={eCls()}>
                  <option value="">Select…</option>
                  {BLOOD_GROUPS.map(g => <option key={g}>{g}</option>)}
                </select>
              </EField>
              <EField label="Religion (optional)">
                <input value={form.religion} onChange={e => set("religion", e.target.value)}
                  className={eCls()} placeholder="e.g. Catholic" />
              </EField>
              <EField label="Previous School (optional)" className="sm:col-span-2">
                <input value={form.previousSchool} onChange={e => set("previousSchool", e.target.value)}
                  className={eCls()} placeholder="e.g. GS Kicukiro" />
              </EField>
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function eCls(error?: boolean) {
  return cn(
    "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30",
    error ? "border-destructive" : "border-border"
  );
}

function EField({
  label, error, className, children,
}: {
  label: string; error?: boolean; className?: string; children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className={cn("text-xs font-semibold mb-1.5 block", error ? "text-destructive" : "text-foreground")}>
        {label}
      </span>
      {children}
    </label>
  );
}

// ─── Shared detail components ────────────────────────────────────────────────

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase font-bold text-muted-foreground mb-2">{title}</div>
      <div className="grid grid-cols-2 gap-y-2 text-sm">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium">{value || "—"}</div>
    </>
  );
}
