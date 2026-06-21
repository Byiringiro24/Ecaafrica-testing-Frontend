import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { GateKeeperLayout } from "@/components/layout/GateKeeperLayout";
import { gateKeeperRouteGuard } from "@/lib/schoolAuth";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Avatar } from "@/components/ui-kit/Avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/gate-keeper/boarding-leave")({
  beforeLoad: ({ location }) => gateKeeperRouteGuard(location),
  component: GateKeeperBoardingLeavePage,
});

type ParentRecord = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
};

type StudentRecord = {
  id: string;
  first_name: string;
  last_name: string;
  student_type?: "boarding" | "day" | null;
  current_section?: { name?: string | null; full_name?: string | null } | null;
  primary_parent?: { first_name?: string | null; last_name?: string | null; phone?: string | null } | null;
};

type LeaveRecord = {
  id: string;
  student_id: string;
  parent_id?: string | null;
  leave_type: "weekend" | "medical" | "family" | "emergency" | "other";
  start_date: string;
  end_date: string;
  reason?: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  approved_at?: string | null;
  returned_at?: string | null;
  exited_at?: string | null;
};

type LeaveRow = {
  id: string;
  studentName: string;
  className: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  contactPerson: string;
  parentPhone: string;
  approvedAt: string;
  returnedAt: string;
  isCurrentlyOut: boolean;
};

const LEAVE_TYPE_LABELS: Record<LeaveRecord["leave_type"], string> = {
  weekend: "Weekend Leave",
  medical: "Medical Leave",
  emergency: "Family Emergency",
  family: "Family Leave",
  other: "Other",
};

const buildName = (first?: string | null, last?: string | null) =>
  [first, last].filter(Boolean).join(" ").trim();

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
};

function GateKeeperBoardingLeavePage() {
  const [requests, setRequests] = useState<LeaveRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [parents, setParents] = useState<ParentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"all" | "currently-out">("currently-out");

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [leaveData, studentData, parentData] = await Promise.all([
          apiRequest<LeaveRecord[]>("/boarding/student-leaves?limit=1000", { auth: "school" }),
          apiRequest<StudentRecord[]>("/students?limit=2000", { auth: "school" }),
          apiRequest<ParentRecord[]>("/parents?limit=2000", { auth: "school" }),
        ]);

        setRequests(Array.isArray(leaveData) ? leaveData : []);
        setStudents(Array.isArray(studentData) ? studentData : []);
        setParents(Array.isArray(parentData) ? parentData : []);
      } catch (error: any) {
        toast.error(error?.message ?? "Failed to load boarding leave records");
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const parentById = useMemo(() => new Map(parents.map((p) => [p.id, p])), [parents]);
  const parentByPhone = useMemo(() => new Map(parents.map((p) => [p.phone, p])), [parents]);

  const rows = useMemo<LeaveRow[]>(() => {
    return requests
      .filter((request) => request.status === "approved")
      .map((request) => {
        const student = studentById.get(request.student_id);
        const studentName = buildName(student?.first_name, student?.last_name) || "Unknown";
        const className =
          student?.current_section?.name ?? student?.current_section?.full_name ?? "—";
        const parentFromLeave = request.parent_id ? parentById.get(request.parent_id) : undefined;
        const parentFromStudent = student?.primary_parent?.phone
          ? parentByPhone.get(student.primary_parent.phone)
          : undefined;
        const parent = parentFromLeave ?? parentFromStudent;
        const contactPerson =
          buildName(parent?.first_name, parent?.last_name) ||
          buildName(student?.primary_parent?.first_name, student?.primary_parent?.last_name) ||
          "—";
        const parentPhone = parent?.phone ?? student?.primary_parent?.phone ?? "—";
        const startDate = formatDate(request.start_date);
        const endDate = formatDate(request.end_date);
        const isCurrentlyOut =
          !request.returned_at && startDate <= today && endDate >= today;

        return {
          id: request.id,
          studentName,
          className,
          leaveType: LEAVE_TYPE_LABELS[request.leave_type] ?? "Other",
          startDate,
          endDate,
          reason: request.reason ?? "—",
          contactPerson,
          parentPhone,
          approvedAt: formatDate(request.approved_at),
          returnedAt: formatDate(request.returned_at),
          isCurrentlyOut,
        };
      })
      .filter((row) => {
        if (view === "currently-out" && !row.isCurrentlyOut) return false;
        if (!query.trim()) return true;
        const needle = query.toLowerCase();
        return (
          row.studentName.toLowerCase().includes(needle) ||
          row.className.toLowerCase().includes(needle) ||
          row.contactPerson.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [requests, studentById, parentById, parentByPhone, query, view, today]);

  const currentlyOut = rows.filter((row) => row.isCurrentlyOut).length;
  const totalApproved = requests.filter((r) => r.status === "approved").length;

  return (
    <GateKeeperLayout
      title="Boarding Leave Verification"
      subtitle="Read-only list of students with approved leave permissions"
    >
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 mb-5 flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          This view is read-only. Verify student identity against approved leave records before
          allowing exit from boarding premises.
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        {loading ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : (
          <>
            <StatCard label="Approved Leaves" value={totalApproved} tone="primary" />
            <StatCard label="Currently Out" value={currentlyOut} tone="warning" />
            <StatCard label="Showing" value={rows.length} tone="secondary" />
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-4">
        <div className="relative flex-1 min-w-60">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by student, class or contact..."
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={view}
          onChange={(e) => setView(e.target.value as typeof view)}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="currently-out">Currently Out</option>
          <option value="all">All Approved</option>
        </select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                {[
                  "Student",
                  "Class",
                  "Leave Type",
                  "Departure",
                  "Return",
                  "Contact",
                  "Status",
                ].map((header) => (
                  <th key={header} className="text-left px-4 py-3 whitespace-nowrap">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Loading approved leave records…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No approved leave records match your filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={row.studentName} size="sm" />
                        <div>
                          <div className="font-semibold">{row.studentName}</div>
                          <div className="text-xs text-muted-foreground max-w-48 truncate">
                            {row.reason}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{row.className}</td>
                    <td className="px-4 py-3">{row.leaveType}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{row.startDate}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{row.endDate}</td>
                    <td className="px-4 py-3">
                      <div>{row.contactPerson}</div>
                      <div className="text-xs text-muted-foreground">{row.parentPhone}</div>
                    </td>
                    <td className="px-4 py-3">
                      {row.isCurrentlyOut ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                          Out on Leave
                        </span>
                      ) : row.returnedAt !== "—" ? (
                        <span className="inline-flex rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">
                          Returned
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                          Approved
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </GateKeeperLayout>
  );
}
