import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { DodLayout } from "@/components/layout/DodLayout";
import { dodRouteGuard } from "@/lib/schoolAuth";
import { apiRequest } from "@/lib/api";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/dod/supervisors")({
  beforeLoad: ({ location }) => dodRouteGuard(location),
  component: DodSupervisorsPage,
});

type Dormitory = { id: string; name: string; gender: string; capacity: number };
type Supervisor = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: "patron" | "matron";
  dormitories: Dormitory[];
};

const blankForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  role: "patron" as "patron" | "matron",
  dormitoryIds: [] as string[],
};

function DodSupervisorsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [dormitories, setDormitories] = useState<Dormitory[]>([]);
  const [form, setForm] = useState(blankForm);
  const [editing, setEditing] = useState<Supervisor | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [supervisorList, dormitoryList] = await Promise.all([
        apiRequest<Supervisor[]>("/boarding/supervisors", { auth: "school" }),
        apiRequest<Dormitory[]>("/boarding/dormitories?limit=500", { auth: "school" }),
      ]);
      setSupervisors(Array.isArray(supervisorList) ? supervisorList : []);
      setDormitories(Array.isArray(dormitoryList) ? dormitoryList : []);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load Patron and Matron records");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(
    () => ({
      patrons: supervisors.filter((person) => person.role === "patron").length,
      matrons: supervisors.filter((person) => person.role === "matron").length,
      assignedDormitories: new Set(
        supervisors.flatMap((person) => person.dormitories.map((dorm) => dorm.id)),
      ).size,
    }),
    [supervisors],
  );

  const toggleDormitory = (id: string) =>
    setForm((current) => ({
      ...current,
      dormitoryIds: current.dormitoryIds.includes(id)
        ? current.dormitoryIds.filter((value) => value !== id)
        : [...current.dormitoryIds, id],
    }));

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm);
    setShowForm(true);
  };
  const openEdit = (person: Supervisor) => {
    setEditing(person);
    setForm({
      name: person.name,
      email: person.email ?? "",
      phone: person.phone ?? "",
      password: "",
      role: person.role,
      dormitoryIds: person.dormitories.map((dorm) => dorm.id),
    });
    setShowForm(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await apiRequest(`/boarding/supervisors/${editing.id}/dormitories`, {
          method: "PATCH",
          auth: "school",
          body: JSON.stringify({ dormitory_ids: form.dormitoryIds }),
        });
        toast.success("Dormitory assignments updated");
      } else {
        await apiRequest("/boarding/supervisors", {
          method: "POST",
          auth: "school",
          body: JSON.stringify({
            name: form.name,
            email: form.email || null,
            phone: form.phone || null,
            password: form.password,
            role: form.role,
            dormitory_ids: form.dormitoryIds,
          }),
        });
        toast.success(`${form.role === "patron" ? "Patron" : "Matron"} created and assigned`);
      }
      setShowForm(false);
      setEditing(null);
      setForm(blankForm);
      await load();
    } catch (error: any) {
      toast.error(error?.message ?? "Unable to save the supervisor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DodLayout
      title="Patron & Matron Management"
      subtitle="Create supervisors and assign one or more dormitories"
    >
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-3 gap-3 sm:w-[34rem]">
          <StatCard compact label="Patrons" value={stats.patrons} />
          <StatCard compact label="Matrons" value={stats.matrons} tone="success" />
          <StatCard
            compact
            label="Covered dorms"
            value={stats.assignedDormitories}
            tone="warning"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Add Patron / Matron
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={submit} className="mb-6 rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">
                {editing ? "Reassign dormitories" : "New boarding supervisor"}
              </h2>
              <p className="text-sm text-muted-foreground">
                A supervisor may be responsible for multiple dormitories.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
          {!editing && (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium">
                Full name
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                />
              </label>
              <label className="text-sm font-medium">
                Role
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as "patron" | "matron" })
                  }
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                >
                  <option value="patron">Patron</option>
                  <option value="matron">Matron</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                />
              </label>
              <label className="text-sm font-medium">
                Phone
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                />
              </label>
              <label className="text-sm font-medium md:col-span-2">
                Temporary password
                <input
                  required
                  minLength={8}
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                />
              </label>
            </div>
          )}
          <fieldset className="mt-4">
            <legend className="text-sm font-medium">Assigned dormitories</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {dormitories.map((dorm) => (
                <label
                  key={dorm.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={form.dormitoryIds.includes(dorm.id)}
                    onChange={() => toggleDormitory(dorm.id)}
                  />
                  <span>
                    <span className="font-medium">{dorm.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {dorm.gender} · capacity {dorm.capacity}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-5 flex justify-end">
            <button
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {saving ? "Saving…" : editing ? "Save assignments" : "Create supervisor"}
            </button>
          </div>
        </form>
      )}

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Boarding supervisors</h2>
        </div>
        {loading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : supervisors.length === 0 ? (
          <div className="grid min-h-48 place-items-center p-6 text-center text-sm text-muted-foreground">
            <UsersRound className="mb-2 h-7 w-7" />
            No Patrons or Matrons have been created.
          </div>
        ) : (
          <div className="divide-y">
            {supervisors.map((person) => (
              <div
                key={person.id}
                className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center"
              >
                <div className="min-w-48 flex-1">
                  <p className="font-semibold">{person.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {person.email || person.phone || "No contact details"}
                  </p>
                </div>
                <span
                  className={
                    person.role === "patron"
                      ? "w-fit rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700"
                      : "w-fit rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700"
                  }
                >
                  {person.role === "patron" ? "Patron" : "Matron"}
                </span>
                <div className="flex flex-1 flex-wrap gap-1.5">
                  {person.dormitories.length ? (
                    person.dormitories.map((dorm) => (
                      <span key={dorm.id} className="rounded-full bg-muted px-2 py-1 text-xs">
                        {dorm.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-amber-700">No dormitory assigned</span>
                  )}
                </div>
                <button
                  onClick={() => openEdit(person)}
                  className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                >
                  Manage assignments
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </DodLayout>
  );
}
