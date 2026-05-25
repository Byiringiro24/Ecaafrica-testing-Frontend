import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, UserPlus, Phone, Download, Upload, Grid3X3, List, X } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Avatar } from "@/components/ui-kit/Avatar";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { STUDENTS, CLASSES, type Student } from "@/lib/mockData";
import { StudentRegistrationModal } from "@/components/modals/StudentRegistrationModal";
import { toast } from "sonner";

export const Route = createFileRoute("/students")({
  component: StudentsPage,
});

function StudentsPage() {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("All");
  const [residencyFilter, setResidencyFilter] = useState<"All" | "Boarding" | "Day">("All");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [profile, setProfile] = useState<Student | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeoutId = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timeoutId);
  }, []);

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    toast.success(`Selected ${file.name} for import`);
    event.target.value = "";
  };

  const filtered = useMemo(() => STUDENTS.filter(s =>
    (classFilter === "All" || s.class === classFilter) &&
    (residencyFilter === "All" || s.residency === residencyFilter) &&
    (search === "" || s.name.toLowerCase().includes(search.toLowerCase()) || s.id.toLowerCase().includes(search.toLowerCase()))
  ), [search, classFilter, residencyFilter]);

  const total = STUDENTS.length;
  const male = STUDENTS.filter(s => s.gender === "Male").length;
  const female = STUDENTS.filter(s => s.gender === "Female").length;
  const boarding = STUDENTS.filter(s => s.residency === "Boarding").length;
  const day = STUDENTS.filter(s => s.residency === "Day").length;

  return (
    <AppLayout title="Student Management" subtitle={`${STUDENTS.length} students enrolled`}>
      {loading ? (
        <StudentsSkeleton view={view} />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            <StatCard label="Total Students" value={total} />
            <StatCard label="Male" value={male} />
            <StatCard label="Female" value={female} />
            <StatCard label="Boarding" value={boarding} />
            <StatCard label="Day Students" value={day} />
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px]">
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
              {CLASSES.map(c => <option key={c}>{c}</option>)}
            </select>
            <select value={residencyFilter} onChange={(e) => setResidencyFilter(e.target.value as any)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
              <option value="All">All Students</option>
              <option value="Day">Day Student</option>
              <option value="Boarding">Boarding Student</option>
            </select>
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setView("grid")}
                className={`p-2 ${view === "grid" ? "bg-primary text-primary-foreground" : "bg-background"}`}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView("table")}
                className={`p-2 ${view === "table" ? "bg-primary text-primary-foreground" : "bg-background"}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            <a
              href="/students-import-template.csv"
              download="ecareafrica-students-template.csv"
              className="h-10 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold hover:bg-muted"
            >
              <Download className="h-4 w-4" /> Download Excel Template
            </a>
            <label className="h-10 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold hover:bg-muted cursor-pointer">
              <Upload className="h-4 w-4" /> Import from Excel
              <input
                type="file"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleImport}
                className="hidden"
              />
            </label>
            <button
              onClick={() => setOpen(true)}
              className="h-10 inline-flex items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <UserPlus className="h-4 w-4" /> Register New Student
            </button>
          </div>

          {view === "grid" ? (
            <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map(s => (
                <div key={s.id} className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start justify-between">
                    <Avatar name={s.name} size="lg" />
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {s.residency}
                    </span>
                  </div>
                  <h3 className="font-display font-bold mt-3 truncate">{s.name}</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{s.id}</p>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-semibold">{s.class}</span>
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                      s.attendanceRate >= 85 ? "bg-success/15 text-success" :
                      s.attendanceRate >= 70 ? "bg-amber-100 text-amber-700" :
                      "bg-destructive/15 text-destructive"
                    }`}>
                      {s.attendanceRate}% attendance
                    </span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span className="truncate">{s.parentPhone}</span>
                  </div>
                  <button onClick={() => setProfile(s)} className="mt-3 text-xs font-semibold text-primary hover:underline">
                    View Profile
                  </button>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="col-span-full text-center py-16 text-muted-foreground">No students match your search.</div>
              )}
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      {[
                        "Name",
                        "Student ID",
                        "Class",
                        "Residency",
                        "Parent",
                        "Phone",
                        "Attendance",
                        "",
                      ].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(s => (
                      <tr key={s.id} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/30">
                        <td className="px-4 py-3 font-medium">{s.name}</td>
                        <td className="px-4 py-3 font-mono text-xs">{s.id}</td>
                        <td className="px-4 py-3">{s.class}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-muted-foreground">{s.residency}</td>
                        <td className="px-4 py-3">{s.parentName}</td>
                        <td className="px-4 py-3 font-mono text-xs">{s.parentPhone}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                            s.attendanceRate >= 85 ? "bg-success/15 text-success" :
                            s.attendanceRate >= 70 ? "bg-amber-100 text-amber-700" :
                            "bg-destructive/15 text-destructive"
                          }`}>
                            {s.attendanceRate}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => setProfile(s)} className="text-xs font-semibold text-primary hover:underline">View</button>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No students match your search.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <StudentRegistrationModal open={open} onClose={() => setOpen(false)} />
      {profile && <StudentProfileSlideOver student={profile} onClose={() => setProfile(null)} />}
    </AppLayout>
  );
}

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
        <Skeleton className="h-10 flex-1 min-w-[220px]" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-40" />
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
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-5 w-24" />
              </div>
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
                <tr>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <th key={`student-head-skeleton-${i}`} className="text-left px-4 py-3">
                      <Skeleton className="h-3 w-16" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`student-row-skeleton-${i}`} className="border-t border-border">
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={`student-cell-skeleton-${i}-${j}`} className="px-4 py-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
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

function StudentProfileSlideOver({ student, onClose }: { student: Student; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div
        className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-card shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border flex justify-between items-center sticky top-0 bg-card">
          <h3 className="font-display font-bold">Student Profile</h3>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-4">
            <Avatar name={student.name} size="lg" />
            <div>
              <div className="font-display font-bold text-lg">{student.name}</div>
              <div className="text-sm text-muted-foreground font-mono">{student.id}</div>
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-semibold">{student.class}</span>
                <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{student.residency}</span>
              </div>
            </div>
          </div>

          <DetailSection title="Student Details">
            <DetailRow label="Gender" value={student.gender} />
            <DetailRow label="Attendance Rate" value={`${student.attendanceRate}%`} />
            <DetailRow label="Card ID" value={student.cardId} />
          </DetailSection>

          <DetailSection title="Parent / Guardian">
            <DetailRow label="Name" value={student.parentName} />
            <DetailRow label="Phone" value={student.parentPhone} />
          </DetailSection>
        </div>
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase font-bold text-muted-foreground mb-2">{title}</div>
      <div className="grid grid-cols-2 gap-y-2 text-sm">
        {children}
      </div>
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
