import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Pencil } from "lucide-react";
import { toast } from "sonner";
import { FinanceLayout } from "@/components/layout/FinanceLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal, TextField, PrimaryButton, GhostButton } from "@/components/finance/ui";
import { apiRequest } from "@/lib/api";
import { formatRWF } from "@/lib/financeApi";

export const Route = createFileRoute("/finance/salary-management")({
  component: SalaryManagementPage,
});

type StaffProfile = {
  id: string;
  staff_id_number?: string | null;
  department?: string | null;
  basic_salary?: string | null;
  employment_status?: "active" | "on_leave" | "inactive" | null;
  user?: { name?: string | null; role?: string | null } | null;
};

function SalaryManagementPage() {
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStaff(await apiRequest<StaffProfile[]>("/staff/profiles?limit=1000", { auth: "school" }));
    } catch (err: any) {
      setError(err?.message ?? "Failed to load staff salaries");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const activeStaff = staff
    .filter((member) => member.employment_status === "active")
    .filter((member) => {
      const term = q.trim().toLowerCase();
      return (
        !term ||
        [member.user?.name, member.staff_id_number, member.department]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(term))
      );
    });
  const allActive = staff.filter((member) => member.employment_status === "active");
  const configured = allActive.filter((member) => Number(member.basic_salary ?? 0) > 0).length;

  return (
    <FinanceLayout title="Salary Management" subtitle="Set and maintain basic salaries for payroll">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <StatCard compact label="Active Staff" value={allActive.length} />
        <StatCard
          compact
          label="Salaries Configured"
          value={`${configured}/${allActive.length}`}
          tone={configured === allActive.length ? "success" : "warning"}
        />
        <StatCard
          compact
          label="Missing Salaries"
          value={allActive.length - configured}
          tone={configured === allActive.length ? "success" : "warning"}
        />
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex flex-wrap gap-3 items-center justify-between">
          <div>
            <div className="font-display font-bold">Staff Salaries</div>
            <div className="text-xs text-muted-foreground">
              Every active staff member needs a basic salary before payroll can be generated.
            </div>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search staff..."
              className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Employee</th>
                <th className="text-left px-4 py-3">Department</th>
                <th className="text-left px-4 py-3">Basic Salary</th>
                <th className="text-right px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} className="border-t border-border">
                    <td colSpan={4} className="px-4 py-3">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-destructive">
                    {error}
                  </td>
                </tr>
              ) : activeStaff.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No active staff found.
                  </td>
                </tr>
              ) : (
                activeStaff.map((member) => {
                  const hasSalary = Number(member.basic_salary ?? 0) > 0;
                  return (
                    <tr
                      key={member.id}
                      className="border-t border-border odd:bg-background even:bg-muted/20"
                    >
                      <td className="px-4 py-3 font-medium">
                        {member.user?.name ?? "Unnamed"}
                        <div className="text-[11px] text-muted-foreground">
                          {member.staff_id_number ?? "--"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">{member.department ?? "--"}</td>
                      <td
                        className={`px-4 py-3 font-mono text-xs ${hasSalary ? "" : "text-warning"}`}
                      >
                        {hasSalary ? formatRWF(member.basic_salary) : "Not set"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setEditing(member)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit salary
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {editing && (
        <SalaryModal
          staff={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await loadStaff();
          }}
        />
      )}
    </FinanceLayout>
  );
}

function SalaryModal({
  staff,
  onClose,
  onSaved,
}: {
  staff: StaffProfile;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [salary, setSalary] = useState(staff.basic_salary ?? "");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const value = Number(salary.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid basic salary");
      return;
    }
    setSaving(true);
    try {
      await apiRequest(`/staff/profiles/${staff.id}`, {
        method: "PATCH",
        auth: "school",
        body: JSON.stringify({ basic_salary: value }),
      });
      toast.success(`Salary saved for ${staff.user?.name ?? "staff member"}`);
      await onSaved();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save salary");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      title="Set Basic Salary"
      subtitle={staff.user?.name ?? "Staff member"}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={submit}>{saving ? "Saving..." : "Save Salary"}</PrimaryButton>
        </>
      }
    >
      <TextField
        label="Basic Salary (RWF)"
        value={salary}
        onChange={setSalary}
        placeholder="350000"
        required
      />
      <p className="text-xs text-muted-foreground">
        This amount will be used when the next payroll run is generated.
      </p>
    </Modal>
  );
}
