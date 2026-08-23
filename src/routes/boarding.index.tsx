import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Building2, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { studentIdNumber } from "@/lib/studentIdentity";

export const Route = createFileRoute("/boarding/")({ component: BoardingPage });

type BoardingStudent = {
  id: string;
  first_name: string;
  last_name: string;
  student_id_number?: string | null;
  current_section?: {
    id?: string;
    name?: string;
    full_name?: string;
    class_id?: string;
  } | null;
};

type DormitoryRecord = {
  id: string;
  name: string;
  capacity?: number | null;
  gender?: string | null;
  description?: string | null;
};

type DormAssignment = {
  student_id: string;
  dormitory_id: string;
  dormitory?: { name?: string | null } | null;
};

type BoardingRow = {
  id: string;
  studentName: string;
  studentNumber: string;
  className: string;
  dormitoryName: string;
};

function BoardingPage() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<BoardingStudent[]>([]);
  const [dormitories, setDormitories] = useState<DormitoryRecord[]>([]);
  const [assignments, setAssignments] = useState<DormAssignment[]>([]);
  const [search, setSearch] = useState("");
  const [dormFilter, setDormFilter] = useState("All");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [studentList, dormList, assignmentList] = await Promise.all([
          apiRequest<BoardingStudent[]>("/students?student_type=boarding&limit=5000", {
            auth: "school",
          }),
          apiRequest<DormitoryRecord[]>("/boarding/dormitories?limit=100", { auth: "school" }),
          apiRequest<DormAssignment[]>("/boarding/assignments?is_active=true&limit=5000", {
            auth: "school",
          }),
        ]);

        setStudents(Array.isArray(studentList) ? studentList : []);
        setDormitories(Array.isArray(dormList) ? dormList : []);
        setAssignments(Array.isArray(assignmentList) ? assignmentList : []);
      } catch (error: any) {
        toast.error(error?.message ?? "Failed to load boarding data");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const assignmentByStudent = useMemo(() => {
    const map = new Map<string, DormAssignment>();
    assignments.forEach((assignment) => map.set(assignment.student_id, assignment));
    return map;
  }, [assignments]);

  const dormNameById = useMemo(
    () => new Map(dormitories.map((dormitory) => [dormitory.id, dormitory.name])),
    [dormitories]
  );

  const rows = useMemo<BoardingRow[]>(() => {
    return students.map((student) => {
      const assignment = assignmentByStudent.get(student.id);
      const dormitoryName =
        assignment?.dormitory?.name ??
        (assignment ? dormNameById.get(assignment.dormitory_id) : undefined) ??
        "Unassigned";

      return {
        id: student.id,
        studentName: `${student.first_name} ${student.last_name}`.trim(),
        studentNumber: studentIdNumber(student),
        className:
          student.current_section?.full_name ?? student.current_section?.name ?? "—",
        dormitoryName,
      };
    });
  }, [students, assignmentByStudent, dormNameById]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesDorm = dormFilter === "All" || row.dormitoryName === dormFilter;
      const searchable = `${row.studentName} ${row.studentNumber} ${row.className} ${row.dormitoryName}`.toLowerCase();
      const matchesSearch = term === "" || searchable.includes(term);
      return matchesDorm && matchesSearch;
    });
  }, [rows, search, dormFilter]);

  const dormitoryCards = useMemo(() => {
    return dormitories.map((dormitory) => {
      const assignedCount = assignments.filter((assignment) => assignment.dormitory_id === dormitory.id).length;
      return {
        ...dormitory,
        assignedCount,
      };
    });
  }, [dormitories, assignments]);

  const totalBoarders = students.length;
  const assignedBoarders = rows.filter((row) => row.dormitoryName !== "Unassigned").length;
  const unassignedBoarders = totalBoarders - assignedBoarders;

  return (
    <AppLayout title="Boarding" subtitle="Boarding students and the dormitories they are assigned to">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {loading ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : (
          <>
            <StatCard label="Total Boarders" value={totalBoarders} tone="primary" />
            <StatCard label="Assigned Boarders" value={assignedBoarders} tone="success" />
            <StatCard label="Unassigned" value={unassignedBoarders} tone="warning" />
            <StatCard label="Dormitories" value={dormitories.length} tone="secondary" />
          </>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm mb-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="rounded-lg bg-primary/10 text-primary p-2">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-base">Dormitory overview</h3>
            <p className="text-sm text-muted-foreground">
              Live dormitory records from the school database. No seed data is used here.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <>
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </>
          ) : dormitoryCards.length === 0 ? (
            <div className="text-sm text-muted-foreground">No dormitories found.</div>
          ) : (
            dormitoryCards.map((dormitory) => (
              <div key={dormitory.id} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{dormitory.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {dormitory.gender ?? "unspecified"}
                      {typeof dormitory.capacity === "number" ? ` • Capacity ${dormitory.capacity}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {dormitory.assignedCount} assigned
                  </span>
                </div>
                {dormitory.description ? (
                  <p className="mt-2 text-sm text-muted-foreground">{dormitory.description}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm mb-5 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Dormitory</label>
          <select
            value={dormFilter}
            onChange={(e) => setDormFilter(e.target.value)}
            className="mt-1 h-10 min-w-44 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="All">All dormitories</option>
            {dormitories.map((dormitory) => (
              <option key={dormitory.id} value={dormitory.name}>
                {dormitory.name}
              </option>
            ))}
          </select>
        </div>
        <div className="relative flex-1 min-w-60">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student, class, dormitory…"
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                {["Student", "Student No.", "Class", "Dormitory"].map((heading) => (
                  <th key={heading} className="text-left px-4 py-3">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Loading boarding students…
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No boarding students match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="border-t border-border odd:bg-background even:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{row.studentName}</td>
                    <td className="px-4 py-3">{row.studentNumber}</td>
                    <td className="px-4 py-3">{row.className}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${row.dormitoryName === "Unassigned" ? "bg-amber-100 text-amber-700" : "bg-success/15 text-success"}`}>
                        <Users className="h-3.5 w-3.5" />
                        {row.dormitoryName}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
