import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { FinanceLayout, StatusPill } from "@/components/layout/FinanceLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal, TextField, PrimaryButton, GhostButton } from "@/components/finance/ui";
import { apiRequest } from "@/lib/api";
import { useAcademicSession } from "@/hooks/useAcademicSession";
import {
  formatRWF, toNum,
  listFeeStructures, createFeeStructure, deleteFeeStructure,
  type FeeStructure,
} from "@/lib/financeApi";

export const Route = createFileRoute("/finance/fee-structure")({ component: FeeStructurePage });

type ClassRecord = { id: string; name: string };

// The backend stores one row per class; the page shows one row per fee name
// with a column per class, so rows sharing a name are grouped together.
type FeeGroup = {
  name: string;
  is_mandatory: boolean;
  byClass: Record<string, FeeStructure>;
  total: number;
};

const groupByName = (structures: FeeStructure[]): FeeGroup[] => {
  const groups = new Map<string, FeeGroup>();

  for (const s of structures) {
    const group = groups.get(s.name) ?? {
      name: s.name,
      is_mandatory: s.is_mandatory,
      byClass: {},
      total: 0,
    };
    if (s.class_id) group.byClass[s.class_id] = s;
    group.total += toNum(s.amount);
    group.is_mandatory = group.is_mandatory || s.is_mandatory;
    groups.set(s.name, group);
  }

  return [...groups.values()];
};

function FeeStructurePage() {
  const session = useAcademicSession();
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
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
    } catch (err: any) {
      setError(err?.message ?? "Failed to load fee structures");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => groupByName(structures), [structures]);
  const rows = groups.filter((g) => g.name.toLowerCase().includes(q.toLowerCase()));
  const mandatoryCount = groups.filter((g) => g.is_mandatory).length;

  const removeGroup = async (group: FeeGroup) => {
    const ids = structures.filter((s) => s.name === group.name).map((s) => s.id);
    try {
      await Promise.all(ids.map((id) => deleteFeeStructure(id)));
      toast.success(`"${group.name}" removed`);
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to remove fee category — student assignments may exist");
    }
  };

  const headerCount = classes.length + 4;

  return (
    <FinanceLayout
      title="Fee Structure"
      subtitle={session.academicYear ? `Fee categories for ${session.academicYear.name}` : "Fee categories"}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard compact label="Fee Categories" value={groups.length} />
        <StatCard compact label="Structure Rows" value={structures.length} tone="primary" />
        <StatCard compact label="Mandatory" value={mandatoryCount} tone="success" />
        <StatCard compact label="Classes Covered" value={classes.length} tone="warning" />
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search fee categories..." className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" />
        </div>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Create Fee Category
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Fee Category</th>
                {classes.map((c) => <th key={c.id} className="text-right px-4 py-3">{c.name}</th>)}
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-center px-4 py-3">Mandatory</th>
                <th className="text-center px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} className="border-t border-border"><td colSpan={headerCount} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
                ))
              ) : error ? (
                <tr><td colSpan={headerCount} className="px-4 py-10 text-center text-sm text-destructive">{error}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={headerCount} className="px-4 py-10 text-center text-sm text-muted-foreground">No fee categories defined yet.</td></tr>
              ) : (
                rows.map((g) => (
                  <tr key={g.name} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/30">
                    <td className="px-4 py-3 font-medium">{g.name}</td>
                    {classes.map((c) => (
                      <td key={c.id} className="px-4 py-3 text-right font-mono text-xs">
                        {g.byClass[c.id] ? formatRWF(g.byClass[c.id].amount) : "--"}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold">{formatRWF(g.total)}</td>
                    <td className="px-4 py-3 text-center">{g.is_mandatory ? <StatusPill label="Yes" tone="success" /> : <StatusPill label="No" tone="muted" />}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => removeGroup(g)} className="text-xs font-semibold text-destructive hover:underline">Remove</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        A fee category spanning several classes is stored as one structure row per class. Removing a category deletes every row that shares its name; rows already assigned to students cannot be deleted.
      </p>

      {creating && (
        <CreateFeeModal
          classes={classes}
          academicYearId={session.academicYear?.id ?? null}
          termId={session.term?.id ?? null}
          onClose={() => setCreating(false)}
          onCreated={async () => { setCreating(false); await load(); }}
        />
      )}
    </FinanceLayout>
  );
}

function CreateFeeModal({
  classes,
  academicYearId,
  termId,
  onClose,
  onCreated,
}: {
  classes: ClassRecord[];
  academicYearId: string | null;
  termId: string | null;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [mandatory, setMandatory] = useState(true);
  const [selectedClasses, setSelectedClasses] = useState<Record<string, boolean>>(() =>
    classes.reduce((acc, c) => ({ ...acc, [c.id]: true }), {} as Record<string, boolean>)
  );
  const [submitting, setSubmitting] = useState(false);

  const targets = classes.filter((c) => selectedClasses[c.id]);

  const submit = async () => {
    if (!academicYearId) { toast.error("No academic year is set for this school"); return; }
    if (!name.trim()) { toast.error("Enter a fee category name"); return; }
    const amt = Number(amount.replace(/[^\d.]/g, ""));
    if (!amt || amt <= 0) { toast.error("Enter a valid base amount"); return; }
    if (targets.length === 0) { toast.error("Select at least one class"); return; }

    setSubmitting(true);
    try {
      await Promise.all(
        targets.map((c) =>
          createFeeStructure({
            academic_year_id: academicYearId,
            term_id: termId ?? undefined,
            class_id: c.id,
            name: name.trim(),
            amount: amt,
            is_mandatory: mandatory,
            due_date: dueDate || undefined,
          })
        )
      );
      toast.success(`Fee category "${name.trim()}" created for ${targets.length} class(es)`);
      await onCreated();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create fee category");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Create Fee Category" subtitle="One structure row is created per selected class" onClose={onClose} wide
      footer={<><GhostButton onClick={onClose}>Cancel</GhostButton><PrimaryButton onClick={submit}>{submitting ? "Creating..." : `Create for ${targets.length} class(es)`}</PrimaryButton></>}>
      <TextField label="Fee Category Name" value={name} onChange={setName} placeholder="e.g. Examination Fee" required />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Amount per Class (RWF)" value={amount} onChange={setAmount} placeholder="50000" required />
        <TextField label="Due Date" value={dueDate} onChange={setDueDate} type="date" />
      </div>

      <div>
        <div className="text-xs font-bold text-muted-foreground mb-2">Apply To Classes</div>
        {classes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No classes defined yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {classes.map((c) => (
              <label key={c.id} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/30">
                <input type="checkbox" checked={!!selectedClasses[c.id]} onChange={(e) => setSelectedClasses((p) => ({ ...p, [c.id]: e.target.checked }))} />
                {c.name}
              </label>
            ))}
          </div>
        )}
      </div>

      <label className="inline-flex items-center gap-2 text-sm pt-1">
        <input type="checkbox" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} /> Mandatory
      </label>
    </Modal>
  );
}
