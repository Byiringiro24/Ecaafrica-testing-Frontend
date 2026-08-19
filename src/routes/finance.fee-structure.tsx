import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronRight,
  CircleDollarSign,
  Plus,
  Search,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { toast } from "sonner";
import { FinanceLayout, StatusPill } from "@/components/layout/FinanceLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal, TextField, PrimaryButton, GhostButton } from "@/components/finance/ui";
import { apiRequest } from "@/lib/api";
import { useAcademicSession } from "@/hooks/useAcademicSession";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  formatCurrency,
  toNum,
  listFeeStructures,
  createFeeStructure,
  deleteFeeStructure,
  updateFeeStructure,
  type FeeStructure,
} from "@/lib/financeApi";

export const Route = createFileRoute("/finance/fee-structure")({ component: FeeStructurePage });
type ClassRecord = { id: string; name: string };
type FeeGroup = {
  name: string;
  structures: FeeStructure[];
  total: number;
  active: boolean;
  mandatory: boolean;
};
const errorMessage = (error: unknown, fallback: string) =>
  typeof error === "object" &&
  error !== null &&
  "message" in error &&
  typeof error.message === "string"
    ? error.message
    : fallback;

function groupByCategory(structures: FeeStructure[]) {
  const groups = new Map<string, FeeGroup>();
  structures.forEach((structure) => {
    const group = groups.get(structure.name) ?? {
      name: structure.name,
      structures: [],
      total: 0,
      active: false,
      mandatory: false,
    };
    group.structures.push(structure);
    group.total += toNum(structure.amount);
    group.active = group.active || structure.is_active !== false;
    group.mandatory = group.mandatory || structure.is_mandatory;
    groups.set(structure.name, group);
  });
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function FeeStructurePage() {
  const session = useAcademicSession();
  const currentUser = useCurrentUser();
  const currency = currentUser?.school_currency ?? "RWF";
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState<FeeGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [structureRes, classList] = await Promise.all([
        listFeeStructures({ limit: 500 }),
        apiRequest<ClassRecord[]>("/classes?limit=100", { auth: "school" }),
      ]);
      setStructures(structureRes.data);
      setClasses(classList);
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to load fee structures"));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const allGroups = useMemo(() => groupByCategory(structures), [structures]);
  const groups = useMemo(
    () =>
      allGroups.filter(
        (group) =>
          group.name.toLowerCase().includes(query.toLowerCase()) &&
          (filter === "all" || (filter === "active" ? group.active : !group.active)),
      ),
    [allGroups, query, filter],
  );
  const activeCount = allGroups.filter((group) => group.active).length;
  const assignedClassCount = new Set(
    structures.map((structure) => structure.class_id).filter(Boolean),
  ).size;
  const toggleCategory = async (group: FeeGroup) => {
    const nextActive = !group.active;
    try {
      await Promise.all(
        group.structures.map((structure) =>
          updateFeeStructure(structure.id, { is_active: nextActive }),
        ),
      );
      toast.success(`${group.name} is now ${nextActive ? "active" : "inactive"}`);
      await load();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Could not update fee status"));
    }
  };
  return (
    <FinanceLayout
      title="Fee Structure"
      subtitle={
        session.academicYear
          ? `Manage categories and class assignments · ${session.academicYear.name}`
          : "Manage categories and class assignments"
      }
    >
      <div className="mb-5 rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Fee administration
            </p>
            <h2 className="font-display text-xl font-bold">
              Keep categories simple. Manage classes inside them.
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Create one fee category, then open it to assign amounts and classes. Inactive fees
              stay available for history without being used for new billing.
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New fee category
          </button>
        </div>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard compact label="Categories" value={allGroups.length} />
        <StatCard compact label="Active categories" value={activeCount} tone="success" />
        <StatCard compact label="Class assignments" value={structures.length} tone="primary" />
        <StatCard
          compact
          label="Classes covered"
          value={assignedClassCount || classes.length}
          tone="warning"
        />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search fee categories..."
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
          />
        </div>
        <div className="flex rounded-lg border border-border bg-card p-1">
          {(["all", "active", "inactive"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${filter === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Fee category</th>
                <th className="px-4 py-3">Classes assigned</th>
                <th className="px-4 py-3">Total value</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Manage</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }, (_, index) => (
                  <tr key={index} className="border-t border-border">
                    <td colSpan={6} className="px-4 py-4">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-destructive">
                    {error}
                  </td>
                </tr>
              ) : groups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No fee categories match your filters.
                  </td>
                </tr>
              ) : (
                groups.map((group) => {
                  const classNames = group.structures.map(
                    (structure) =>
                      classes.find((item) => item.id === structure.class_id)?.name ?? "Unassigned",
                  );
                  return (
                    <tr key={group.name} className="border-t border-border hover:bg-accent/20">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                            <CircleDollarSign className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-semibold">{group.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {group.structures.length} class{" "}
                              {group.structures.length === 1 ? "assignment" : "assignments"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[280px] px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {classNames.slice(0, 4).map((name, index) => (
                            <span
                              key={`${name}-${index}`}
                              className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium"
                            >
                              {name}
                            </span>
                          ))}
                          {classNames.length > 4 && (
                            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                              +{classNames.length - 4} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs font-semibold">
                        {formatCurrency(group.total, currency)}
                      </td>
                      <td className="px-4 py-4">
                        {group.mandatory ? (
                          <StatusPill label="Mandatory" tone="success" />
                        ) : (
                          <StatusPill label="Optional" tone="muted" />
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => toggleCategory(group)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold"
                          title={`Set ${group.active ? "inactive" : "active"}`}
                        >
                          {group.active ? (
                            <>
                              <ToggleRight className="h-5 w-5 text-emerald-600" />
                              <span className="text-emerald-700">Active</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                              <span className="text-muted-foreground">Inactive</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => setManaging(group)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
                        >
                          Manage <ChevronRight className="h-3.5 w-3.5" />
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
      {creating && (
        <CreateFeeModal
          classes={classes}
          currency={currency}
          academicYearId={session.academicYear?.id ?? null}
          termId={session.term?.id ?? null}
          onClose={() => setCreating(false)}
          onCreated={async () => {
            setCreating(false);
            await load();
          }}
        />
      )}
      {managing && (
        <ManageFeeModal
          group={managing}
          classes={classes}
          currency={currency}
          academicYearId={session.academicYear?.id ?? null}
          termId={session.term?.id ?? null}
          onClose={() => setManaging(null)}
          onUpdated={async () => {
            setManaging(null);
            await load();
          }}
        />
      )}
    </FinanceLayout>
  );
}

function ManageFeeModal({
  group,
  classes,
  currency,
  academicYearId,
  termId,
  onClose,
  onUpdated,
}: {
  group: FeeGroup;
  classes: ClassRecord[];
  currency: string;
  academicYearId: string | null;
  termId: string | null;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const assignedIds = new Set(group.structures.map((structure) => structure.class_id));
  const availableClasses = classes.filter((item) => !assignedIds.has(item.id));
  const [classId, setClassId] = useState(availableClasses[0]?.id ?? "");
  const [amount, setAmount] = useState(group.structures[0]?.amount ?? "");
  const [busy, setBusy] = useState(false);
  const mandatory = group.mandatory;
  const updateMandatory = async () => {
    setBusy(true);
    try {
      await Promise.all(
        group.structures.map((structure) =>
          updateFeeStructure(structure.id, { is_mandatory: !mandatory }),
        ),
      );
      toast.success(!mandatory ? "Fee is now mandatory to pay" : "Fee is now optional");
      await onUpdated();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Could not update fee status"));
      setBusy(false);
    }
  };
  const removeClass = async (structure: FeeStructure) => {
    const className = classes.find((item) => item.id === structure.class_id)?.name ?? "this class";
    if (!window.confirm(`Remove ${className} from the ${group.name} fee?`)) return;
    setBusy(true);
    try {
      await deleteFeeStructure(structure.id);
      toast.success(`${className} removed from fee`);
      await onUpdated();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Could not remove class from fee"));
      setBusy(false);
    }
  };
  const addClass = async () => {
    const value = Number(amount.replace(/[^\d.]/g, ""));
    if (!academicYearId) return toast.error("No academic year is set for this school");
    if (!classId) return toast.error("Select a class to add");
    if (!value || value <= 0) return toast.error("Enter a valid amount");
    setBusy(true);
    try {
      await createFeeStructure({
        academic_year_id: academicYearId,
        term_id: termId ?? undefined,
        class_id: classId,
        name: group.name,
        amount: value,
        is_mandatory: mandatory,
        is_active: true,
      });
      toast.success("Class added to fee");
      await onUpdated();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Could not add class to fee"));
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`Manage ${group.name}`}
      subtitle="Add classes and choose whether this fee is mandatory to pay"
      onClose={onClose}
      wide
      footer={
        <>
          <GhostButton onClick={onClose}>Close</GhostButton>
        </>
      }
    >
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Fee status
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusPill
            label={mandatory ? "Mandatory to pay" : "Optional"}
            tone={mandatory ? "success" : "muted"}
          />
          <button
            onClick={updateMandatory}
            disabled={busy}
            className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mandatory ? "Make optional" : "Make mandatory to pay"}
          </button>
        </div>
      </div>
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Assigned classes
        </div>
        <div className="flex flex-wrap gap-2">
          {group.structures.map((structure) => (
            <span
              key={structure.id}
              className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs font-medium"
            >
              {classes.find((item) => item.id === structure.class_id)?.name ?? "Unassigned"}
              <button
                type="button"
                onClick={() => removeClass(structure)}
                disabled={busy}
                aria-label={`Remove ${classes.find((item) => item.id === structure.class_id)?.name ?? "class"} from fee`}
                title="Remove class from fee"
                className="text-muted-foreground hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      </div>
      <div className="border-t border-border pt-4">
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Add class to this fee
        </div>
        {availableClasses.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Class
              </label>
              <select
                value={classId}
                onChange={(event) => setClassId(event.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                {availableClasses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <TextField
              label={`Amount per class (${currency})`}
              value={amount}
              onChange={setAmount}
              placeholder="50000"
              required
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            All available classes are already assigned.
          </p>
        )}
      </div>
      {availableClasses.length > 0 && (
        <PrimaryButton onClick={addClass} disabled={busy}>
          {busy ? "Saving..." : "Add class"}
        </PrimaryButton>
      )}
    </Modal>
  );
}

function CreateFeeModal({
  classes,
  currency,
  academicYearId,
  termId,
  onClose,
  onCreated,
}: {
  classes: ClassRecord[];
  currency: string;
  academicYearId: string | null;
  termId: string | null;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [mandatory, setMandatory] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    classes.reduce(
      (result, item) => ({ ...result, [item.id]: true }),
      {} as Record<string, boolean>,
    ),
  );
  const targets = classes.filter((item) => selected[item.id]);
  const submit = async () => {
    if (!academicYearId) return toast.error("No academic year is set for this school");
    const value = Number(amount.replace(/[^\d.]/g, ""));
    if (!name.trim()) return toast.error("Enter a fee category name");
    if (!value || value <= 0) return toast.error("Enter a valid amount");
    if (!targets.length) return toast.error("Select at least one class");
    setSubmitting(true);
    try {
      await Promise.all(
        targets.map((item) =>
          createFeeStructure({
            academic_year_id: academicYearId,
            term_id: termId ?? undefined,
            class_id: item.id,
            name: name.trim(),
            amount: value,
            is_mandatory: mandatory,
            is_active: true,
          }),
        ),
      );
      toast.success(`${name.trim()} created`);
      await onCreated();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Failed to create fee category"));
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Modal
      title="New fee category"
      subtitle="Create the category once, then assign it to selected classes"
      onClose={onClose}
      wide
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={submit}>
            {submitting ? "Creating..." : `Create for ${targets.length} classes`}
          </PrimaryButton>
        </>
      }
    >
      <TextField
        label="Category name"
        value={name}
        onChange={setName}
        placeholder="e.g. Examination Fee"
        required
      />
      <TextField
        label={`Amount per class (${currency})`}
        value={amount}
        onChange={setAmount}
        placeholder="50000"
        required
      />
      <div>
        <div className="mb-2 text-xs font-bold text-muted-foreground">Assign to classes</div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {classes.map((item) => (
            <label
              key={item.id}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/30"
            >
              <input
                type="checkbox"
                checked={!!selected[item.id]}
                onChange={(event) =>
                  setSelected((previous) => ({ ...previous, [item.id]: event.target.checked }))
                }
              />
              {item.name}
            </label>
          ))}
        </div>
      </div>
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={mandatory}
          onChange={(event) => setMandatory(event.target.checked)}
        />{" "}
        Mandatory fee
      </label>
    </Modal>
  );
}
