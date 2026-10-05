import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Loader2, RefreshCw, ShieldCheck, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiRequest } from "@/lib/api";
import { getSchoolAuth } from "@/lib/schoolAuth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/staff/roles")({
  beforeLoad: () => {
    const auth = getSchoolAuth();
    const role = auth?.user?.role?.toLowerCase();
    if (
      auth?.accessToken &&
      ["school_admin", "director_of_discipline", "director_of_studies"].includes(role ?? "")
    ) return;
    throw redirect({ to: "/login" });
  },
  component: StaffRoleManagementPage,
});

type Role = {
  id: string;
  name: string;
  slug: string;
  is_system?: boolean;
};

type UserRole = Pick<Role, "id" | "name" | "slug">;

type User = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  status: string;
  roles?: UserRole[];
};

const roleLabel = (slug: string) =>
  slug.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const roleColor = (slug: string) => {
  if (slug === "school_admin") return "bg-rose-100 text-rose-700";
  if (["director_of_discipline", "director_of_studies"].includes(slug)) return "bg-violet-100 text-violet-700";
  if (["teacher", "staff"].includes(slug)) return "bg-emerald-100 text-emerald-700";
  return "bg-blue-100 text-blue-700";
};

function StaffRoleManagementPage() {
  const currentRole = getSchoolAuth()?.user?.role?.toLowerCase();
  const canAssign = currentRole === "school_admin" || currentRole === "director_of_discipline";
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [userList, roleList] = await Promise.all([
        apiRequest<User[]>("/users?limit=1000", { auth: "school" }),
        apiRequest<Role[]>("/roles?limit=1000", { auth: "school" }),
      ]);
      const eligibleUsers = (Array.isArray(userList) ? userList : []).filter(
        (user) => user.role?.trim().toLowerCase() !== "student",
      );
      const assignableRoles = (Array.isArray(roleList) ? roleList : []).filter(
        (role) => role.slug.trim().toLowerCase() !== "student",
      );
      setUsers(eligibleUsers);
      setRoles(assignableRoles);
      setSelectedRole((current) => assignableRoles.some((role) => role.id === current) ? current : assignableRoles[0]?.id || "");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load users and roles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      [user.name, user.email, user.phone, user.role].some((value) => value?.toLowerCase().includes(query)),
    );
  }, [search, users]);

  const assignedRoles = (user: User) => [
    { id: `primary-${user.role}`, name: roleLabel(user.role), slug: user.role, primary: true },
    ...(user.roles ?? []).map((role) => ({ ...role, primary: false })),
  ];

  const assignRole = async (user: User) => {
    if (!selectedRole || !canAssign) return;
    const role = roles.find((item) => item.id === selectedRole);
    if (!role) return;
    setBusyKey(`${user.id}:assign`);
    try {
      const updated = await apiRequest<User>(`/users/${user.id}/roles`, {
        method: "POST",
        auth: "school",
        body: JSON.stringify({ role_id: role.id }),
      });
      setUsers((current) => current.map((item) => (item.id === user.id ? updated : item)));
      toast.success(`${role.name} assigned to ${user.name}`);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to assign role");
    } finally {
      setBusyKey(null);
    }
  };

  const removeRole = async (user: User, role: UserRole) => {
    if (!canAssign) return;
    setBusyKey(`${user.id}:${role.id}`);
    try {
      const updated = await apiRequest<User>(`/users/${user.id}/roles/${role.id}`, {
        method: "DELETE",
        auth: "school",
      });
      setUsers((current) => current.map((item) => (item.id === user.id ? updated : item)));
      toast.success(`${role.name} removed from ${user.name}`);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to remove role");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <AppLayout title="Role Management" subtitle="Assign additional roles to existing school users" allowDirectorOfDiscipline>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/staff/management"
          className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" /> Staff Management
        </Link>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
        </button>
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <Users className="mb-3 h-5 w-5 text-primary" />
          <div className="text-2xl font-bold">{users.length}</div>
          <div className="text-sm text-muted-foreground">Eligible users</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <ShieldCheck className="mb-3 h-5 w-5 text-primary" />
          <div className="text-2xl font-bold">{roles.length}</div>
          <div className="text-sm text-muted-foreground">Available roles</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <UserPlus className="mb-3 h-5 w-5 text-primary" />
          <div className="text-sm font-semibold">{canAssign ? "You can assign roles" : "View-only access"}</div>
          <div className="text-sm text-muted-foreground">
            {canAssign ? "Choose a role for any user below." : "Contact a school admin to change assignments."}
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search users by name, email, phone, or role..."
          className="min-w-60 flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
        />
        <select
          value={selectedRole}
          onChange={(event) => setSelectedRole(event.target.value)}
          disabled={!canAssign || roles.length === 0}
          className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm disabled:opacity-60"
        >
          {roles.length === 0 ? <option value="">No roles available</option> : null}
          {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
        </select>
      </div>

      {!canAssign && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You can review assignments, but only School Admins and Directors of Discipline can change them.
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="space-y-3 p-5">{[1, 2, 3, 4].map((item) => <div key={item} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No users found.</div>
        ) : (
          <div className="divide-y divide-border">
            {filteredUsers.map((user) => {
              const currentRoles = assignedRoles(user);
              const assignedIds = new Set(currentRoles.map((role) => role.id));
              const availableRoles = roles.filter((role) => !assignedIds.has(role.id));
              return (
                <div key={user.id} className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {user.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-48 flex-1">
                    <div className="font-semibold">{user.name}</div>
                    <div className="text-xs text-muted-foreground">{user.email || user.phone || "No contact details"}</div>
                  </div>
                  <div className="flex flex-1 flex-wrap gap-2">
                    {currentRoles.map((role) => (
                      <span key={`${user.id}-${role.id}`} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", roleColor(role.slug))}>
                        {roleLabel(role.slug)}{role.primary ? " · Primary" : ""}
                        {!role.primary && canAssign && (
                          <button type="button" onClick={() => void removeRole(user, role)} disabled={busyKey === `${user.id}:${role.id}`} title={`Remove ${role.name}`}>
                            {busyKey === `${user.id}:${role.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => void assignRole(user)}
                    disabled={!canAssign || !selectedRole || availableRoles.length === 0 || busyKey === `${user.id}:assign`}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyKey === `${user.id}:assign` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Assign selected role
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
