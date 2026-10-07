import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Archive, ArrowLeft, CheckCircle2, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiRequest } from "@/lib/api";
import { getSchoolAuth } from "@/lib/schoolAuth";

export const Route = createFileRoute("/staff/archive")({ component: StaffArchivePage });

type ArchivedUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  status?: string | null;
};

type StaffProfile = {
  id: string;
  user_id?: string | null;
  staff_id_number?: string | null;
  department?: string | null;
  join_date?: string | null;
};

type ArchiveRow = {
  userId: string;
  profileId: string | null;
  name: string;
  staffId: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  joinDate: string;
};

const STAFF_ROLES = [
  "teacher",
  "staff",
  "gate_keeper",
  "director_of_discipline",
  "director_of_studies",
  "patron",
  "matron",
  "finance_officer",
  "school_admin",
] as const;

const EMPTY_VALUE = "--";

const toTitleCase = (value: string) =>
  value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());

const displayValue = (value?: string | null) => value || EMPTY_VALUE;

function StaffArchivePage() {
  const [rows, setRows] = useState<ArchiveRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const currentRole = getSchoolAuth()?.user?.role?.toLowerCase() ?? "";
  const canManageAccounts = ["school_admin", "director_of_discipline"].includes(currentRole);

  const loadArchive = async () => {
    setLoading(true);
    try {
      const [inactiveUsers, profiles] = await Promise.all([
        apiRequest<ArchivedUser[]>("/users?status=inactive&limit=1000", { auth: "school" }),
        apiRequest<StaffProfile[]>("/staff/profiles?limit=1000", { auth: "school" }),
      ]);

      const profileByUserId = new Map(
        (Array.isArray(profiles) ? profiles : [])
          .filter((profile) => profile.user_id)
          .map((profile) => [profile.user_id as string, profile])
      );

      const archiveRows = (Array.isArray(inactiveUsers) ? inactiveUsers : [])
        .filter((user) => user.status === "inactive")
        .filter((user) => STAFF_ROLES.includes((user.role ?? "").toLowerCase() as typeof STAFF_ROLES[number]))
        .map((user): ArchiveRow => {
          const profile = profileByUserId.get(user.id);
          return {
            userId: user.id,
            profileId: profile?.id ?? null,
            name: displayValue(user.name),
            staffId: displayValue(profile?.staff_id_number) !== EMPTY_VALUE
              ? displayValue(profile?.staff_id_number)
              : `STF-${user.id}`,
            role: user.role ? toTitleCase(user.role) : EMPTY_VALUE,
            department: displayValue(profile?.department),
            email: displayValue(user.email),
            phone: displayValue(user.phone),
            joinDate: displayValue(profile?.join_date),
          };
        });

      setRows(archiveRows);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load inactive staff archive");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArchive();
  }, []);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return rows;

    return rows.filter((row) =>
      [row.name, row.staffId, row.role, row.department, row.email, row.phone]
        .some((value) => value.toLowerCase().includes(normalizedQuery))
    );
  }, [query, rows]);

  const handleActivate = async (row: ArchiveRow) => {
    if (!canManageAccounts) return;
    if (!window.confirm(`Activate ${row.name}'s staff account?`)) return;

    const actionId = `${row.userId}:activate`;
    setBusyAction(actionId);
    try {
      const updates: Promise<unknown>[] = [
        apiRequest(`/users/${row.userId}`, {
          method: "PATCH",
          auth: "school",
          body: JSON.stringify({ status: "active" }),
        }),
      ];

      if (row.profileId) {
        updates.push(apiRequest(`/staff/profiles/${row.profileId}`, {
          method: "PATCH",
          auth: "school",
          body: JSON.stringify({ employment_status: "active" }),
        }));
      }

      await Promise.all(updates);
      toast.success("Staff account activated");
      await loadArchive();
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to activate staff account");
    } finally {
      setBusyAction((current) => current === actionId ? null : current);
    }
  };

  const handleDelete = async (row: ArchiveRow) => {
    if (!canManageAccounts) return;
    if (!window.confirm(`Delete inactive staff account for ${row.name}?`)) return;

    const actionId = `${row.userId}:delete`;
    setBusyAction(actionId);
    try {
      await apiRequest(`/users/${row.userId}`, {
        method: "DELETE",
        auth: "school",
      });
      toast.success("Inactive staff account deleted");
      await loadArchive();
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to delete staff account");
    } finally {
      setBusyAction((current) => current === actionId ? null : current);
    }
  };

  return (
    <AppLayout title="Inactive Staff Archive" subtitle="Inactive staff accounts are kept here until they are activated or deleted.">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/staff/"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" /> Active Staff
        </Link>
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search inactive staff..."
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-3 text-sm">
          <Archive className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">Inactive staff</span>
          <span className="text-muted-foreground">({filteredRows.length})</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading archive...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            No inactive staff accounts found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Staff ID</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const activateBusy = busyAction === `${row.userId}:activate`;
                  const deleteBusy = busyAction === `${row.userId}:delete`;
                  const busy = activateBusy || deleteBusy;

                  return (
                    <tr key={row.userId} className="border-t border-border odd:bg-background even:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{row.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{row.staffId}</td>
                      <td className="px-4 py-3">{row.role}</td>
                      <td className="px-4 py-3">{row.department}</td>
                      <td className="px-4 py-3 text-xs">
                        <div>{row.email}</div>
                        <div className="text-muted-foreground">{row.phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                          Inactive
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {canManageAccounts ? (
                          <div className="flex items-center gap-3 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleActivate(row)}
                              disabled={busy}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {activateBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                              {activateBusy ? "Activating..." : "Activate"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(row)}
                              disabled={busy}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-destructive hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deleteBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                              {deleteBusy ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">View only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
