import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Plus, ToggleLeft, ToggleRight } from "lucide-react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { FinanceLayout, StatusPill } from "@/components/layout/FinanceLayout";
import { Modal, PrimaryButton, GhostButton, TextField } from "@/components/finance/ui";
import { apiRequest } from "@/lib/api";
import { useAcademicSession } from "@/hooks/useAcademicSession";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  createFeeStructure,
  formatCurrency,
  listFeeStructures,
  updateFeeStructure,
  type FeeStructure,
} from "@/lib/financeApi";

export const Route = createFileRoute("/finance/fee-structure/$category")({
  component: FeeCategoryPage,
});
type ClassRecord = { id: string; name: string };
const errorMessage = (error: unknown, fallback: string) =>
  typeof error === "object" &&
  error !== null &&
  "message" in error &&
  typeof error.message === "string"
    ? error.message
    : fallback;

function FeeCategoryPage() {
  const { category } = Route.useParams();
  const session = useAcademicSession();
  const currentUser = useCurrentUser();
  const currency = currentUser?.school_currency ?? "RWF";
  const categoryName = decodeURIComponent(category);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [result, classList] = await Promise.all([
        listFeeStructures({ limit: 500 }),
        apiRequest<ClassRecord[]>("/classes?limit=100", { auth: "school" }),
      ]);
      setStructures(result.data.filter((item) => item.name === categoryName));
      setClasses(classList);
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Could not load fee category"));
    } finally {
      setLoading(false);
    }
  }, [categoryName]);
  useEffect(() => {
    load();
  }, [load]);
  const assigned = useMemo(() => new Set(structures.map((item) => item.class_id)), [structures]);
  const availableClasses = classes.filter((item) => !assigned.has(item.id));
  const active = structures.some((item) => item.is_active !== false);
  const mandatory = structures.length > 0 && structures.every((item) => item.is_mandatory);
  const [updatingMandatory, setUpdatingMandatory] = useState(false);
  const toggle = async (structure: FeeStructure) => {
    try {
      await updateFeeStructure(structure.id, { is_active: structure.is_active === false });
      await load();
      toast.success(
        `Fee for ${classes.find((item) => item.id === structure.class_id)?.name ?? "class"} updated`,
      );
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Could not update fee status"));
    }
  };
  const updateMandatory = async () => {
    if (!structures.length) return;
    const nextMandatory = !mandatory;
    setUpdatingMandatory(true);
    try {
      await Promise.all(
        structures.map((structure) =>
          updateFeeStructure(structure.id, { is_mandatory: nextMandatory }),
        ),
      );
      await load();
      toast.success(nextMandatory ? "Fee is now mandatory to pay" : "Fee is now optional");
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Could not update fee requirement"));
    } finally {
      setUpdatingMandatory(false);
    }
  };

  return (
    <FinanceLayout title={categoryName} subtitle="Fee category · class assignments and status">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/finance/fee-structure"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All fee categories
        </Link>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Assign class
        </button>
      </div>
      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold uppercase text-muted-foreground">
            Assigned classes
          </div>
          <div className="mt-1 text-2xl font-bold">{structures.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Total value</div>
          <div className="mt-1 text-2xl font-bold">
            {formatCurrency(
              structures.reduce((sum, item) => sum + Number(item.amount), 0),
              currency,
            )}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold uppercase text-muted-foreground">
            Category status
          </div>
          <div className="mt-2">
            <div className="flex flex-wrap items-center gap-2">
              {active ? (
                <StatusPill label="Active" tone="success" />
              ) : (
                <StatusPill label="Inactive" tone="muted" />
              )}
              <StatusPill
                label={mandatory ? "Mandatory to pay" : "Optional"}
                tone={mandatory ? "success" : "muted"}
              />
            </div>
            <button
              onClick={updateMandatory}
              disabled={updatingMandatory || loading || !structures.length}
              className="mt-3 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {updatingMandatory
                ? "Updating..."
                : mandatory
                  ? "Make optional"
                  : "Make mandatory to pay"}
            </button>
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-display font-bold">Class assignments</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Set a different amount or deactivate this fee for individual classes.
          </p>
        </div>
        <div className="divide-y divide-border">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading assignments...
            </div>
          ) : structures.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              This category has no class assignments.
            </div>
          ) : (
            structures.map((structure) => (
              <div key={structure.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="min-w-[160px] flex-1">
                  <div className="font-semibold">
                    {classes.find((item) => item.id === structure.class_id)?.name ??
                      "Unassigned class"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {structure.is_mandatory ? "Mandatory" : "Optional"} · Due{" "}
                    {structure.due_date
                      ? new Date(structure.due_date).toLocaleDateString()
                      : "No date"}
                  </div>
                </div>
                <div className="font-mono text-sm font-semibold">
                  {formatCurrency(structure.amount, currency)}
                </div>
                <button
                  onClick={() => toggle(structure)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold"
                >
                  {structure.is_active !== false ? (
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
              </div>
            ))
          )}
        </div>
      </div>
      {adding && (
        <AssignClassModal
          classes={availableClasses}
          academicYearId={session.academicYear?.id ?? null}
          termId={session.term?.id ?? null}
          name={categoryName}
          mandatory={structures[0]?.is_mandatory ?? true}
          onClose={() => setAdding(false)}
          onAdded={async () => {
            setAdding(false);
            await load();
          }}
        />
      )}
    </FinanceLayout>
  );
}

function AssignClassModal({
  classes,
  academicYearId,
  termId,
  name,
  mandatory,
  onClose,
  onAdded,
}: {
  classes: ClassRecord[];
  academicYearId: string | null;
  termId: string | null;
  name: string;
  mandatory: boolean;
  onClose: () => void;
  onAdded: () => Promise<void>;
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    const value = Number(amount.replace(/[^\d.]/g, ""));
    if (!academicYearId) return toast.error("No academic year is set for this school");
    if (!classId) return toast.error("No unassigned class is available");
    if (!value || value <= 0) return toast.error("Enter a valid amount");
    setSubmitting(true);
    try {
      await createFeeStructure({
        academic_year_id: academicYearId,
        term_id: termId ?? undefined,
        class_id: classId,
        name,
        amount: value,
        is_mandatory: mandatory,
        is_active: true,
      });
      toast.success("Class assigned");
      await onAdded();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Could not assign class"));
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Modal
      title="Assign class"
      subtitle={`Add a class to ${name}`}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={submit}>
            {submitting ? "Assigning..." : "Assign class"}
          </PrimaryButton>
        </>
      }
    >
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Class</label>
        <select
          value={classId}
          onChange={(event) => setClassId(event.target.value)}
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
        >
          {classes.length ? (
            classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))
          ) : (
            <option value="">All classes are already assigned</option>
          )}
        </select>
      </div>
      <TextField
        label={`Amount (${currency})`}
        value={amount}
        onChange={setAmount}
        placeholder="50000"
        required
      />
    </Modal>
  );
}
