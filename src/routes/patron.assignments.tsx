import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Home, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { PatronLayout } from "@/components/layout/PatronLayout";
import { patronRouteGuard } from "@/lib/schoolAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { apiRequest } from "@/lib/api";
import { patronApi, type PatronAssignment } from "@/lib/boardingApi";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/patron/assignments")({
  beforeLoad: ({ location }) => patronRouteGuard(location),
  component: PatronAssignmentsPage,
});

type Student = {
  id: string;
  first_name: string;
  last_name: string;
  other_names?: string | null;
  student_id_number?: string | null;
  gender?: string | null;
  photo_url?: string | null;
  boarding_status?: string | null;
};
type Assignment = { student_id: string; dormitory_id: string; dormitory?: { name?: string | null } | null };
type AcademicYear = { id: string; name: string; is_current?: boolean; isCurrent?: boolean };

function PatronAssignmentsPage() {
  const user = useCurrentUser();
  const role = user?.role === "matron" ? "Matron" : "Patron";
  const expectedGender = user?.role === "matron" ? "female" : "male";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [dormitories, setDormitories] = useState<PatronAssignment[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedDormitory, setSelectedDormitory] = useState("");
  const [selectedYear, setSelectedYear] = useState("");

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [studentList, assignmentList, dormList, yearList] = await Promise.all([
        apiRequest<Student[]>("/boarding/assignments/assignable-students", { auth: "school" }),
        apiRequest<Assignment[]>("/boarding/assignments?is_active=true&limit=5000", { auth: "school" }),
        patronApi.listPatronAssignments(user.id),
        apiRequest<AcademicYear[]>("/academic-years?limit=100", { auth: "school" }),
      ]);
      setStudents(Array.isArray(studentList) ? studentList : []);
      setAssignments(Array.isArray(assignmentList) ? assignmentList : []);
      setDormitories(Array.isArray(dormList) ? dormList : []);
      const availableYears = Array.isArray(yearList) ? yearList : [];
      setYears(availableYears);
      setSelectedYear(
        availableYears.find((year) => year.is_current || year.isCurrent)?.id ??
          availableYears[0]?.id ?? "",
      );
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load boarding students");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [user?.id]);

  const assignmentByStudent = useMemo(
    () => new Map(assignments.map((assignment) => [assignment.student_id, assignment])),
    [assignments],
  );
  const compatibleDormitories = dormitories.filter(
    (assignment) => assignment.dormitory?.gender === expectedGender,
  );
  const filteredStudents = students.filter((student) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return `${student.first_name} ${student.last_name} ${student.student_id_number ?? ""}`
      .toLowerCase().includes(term);
  });
  const assignableStudents = students.filter((student) => !assignmentByStudent.has(student.id));

  const assignStudent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedStudent || !selectedDormitory || !selectedYear) {
      toast.error("Select a student, dormitory, and academic year");
      return;
    }
    setSaving(true);
    try {
      await apiRequest("/boarding/assignments", {
        method: "POST",
        auth: "school",
        body: JSON.stringify({
          student_id: selectedStudent,
          dormitory_id: selectedDormitory,
          academic_year_id: selectedYear,
          assigned_at: new Date().toISOString().slice(0, 10),
        }),
      });
      toast.success("Student assigned to dormitory");
      setSelectedStudent("");
      setSelectedDormitory("");
      await load();
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to assign student");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PatronLayout title="Assign Boarding Students" subtitle={`${role} access — assign students to your dormitories`}>
      <div className="mb-5 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
        You can place boarding students only in your assigned {expectedGender === "male" ? "boys'" : "girls'"} dormitories.
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div><h2 className="font-display font-bold text-lg">Boarding Students</h2><p className="text-xs text-muted-foreground">{students.length} active boarding students</p></div>
              <UserPlus className="h-5 w-5 text-primary" />
            </div>
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student or ID" className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm" /></div>
          </div>
          {loading ? <div className="space-y-2 p-4"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div> : (
            <div className="divide-y divide-border max-h-[32rem] overflow-y-auto">
              {filteredStudents.map((student) => {
                const assignment = assignmentByStudent.get(student.id);
                const selected = selectedStudent === student.id;
                return <button key={student.id} type="button" onClick={() => { setSelectedStudent(student.id); setSelectedDormitory(""); }} className={`flex w-full items-center gap-3 p-4 text-left hover:bg-muted/30 ${selected ? "bg-primary/5" : ""}`}>
                  {student.photo_url ? <img src={student.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{student.first_name[0]}{student.last_name[0]}</div>}
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{student.first_name} {student.last_name}</span><span className="block text-xs text-muted-foreground">{student.student_id_number ?? "No student ID"} · {student.gender ?? "gender not set"}</span></span>
                  {assignment ? <span className="text-xs text-emerald-600">{assignment.dormitory?.name ?? "Assigned"}</span> : <span className="text-xs text-amber-600">Unassigned</span>}
                </button>;
              })}
              {!filteredStudents.length && <p className="p-8 text-center text-sm text-muted-foreground">No boarding students found.</p>}
            </div>
          )}
        </section>

        <form onSubmit={assignStudent} className="h-fit rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><Home className="h-5 w-5 text-primary" /><h2 className="font-display font-bold text-lg">Assign to Dormitory</h2></div>
          <div className="space-y-4">
            <label className="block text-sm font-semibold">Student<select value={selectedStudent} onChange={(event) => setSelectedStudent(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"><option value="">Select unassigned student</option>{assignableStudents.map((student) => <option key={student.id} value={student.id}>{student.first_name} {student.last_name} — {student.student_id_number ?? "No ID"}</option>)}</select></label>
            <label className="block text-sm font-semibold">Dormitory<select value={selectedDormitory} onChange={(event) => setSelectedDormitory(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"><option value="">Select your dormitory</option>{compatibleDormitories.map((dormitory) => <option key={dormitory.dormitory_id} value={dormitory.dormitory_id}>{dormitory.dormitory?.name}</option>)}</select></label>
            <label className="block text-sm font-semibold">Academic year<select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"><option value="">Select academic year</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></label>
            <button type="submit" disabled={saving || !selectedStudent || !selectedDormitory || !selectedYear} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{saving ? "Assigning…" : "Assign Student"}</button>
          </div>
        </form>
      </div>
    </PatronLayout>
  );
}
