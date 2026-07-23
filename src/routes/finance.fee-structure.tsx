import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { FinanceLayout, StatusPill } from "@/components/layout/FinanceLayout";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Modal, TextField, SelectField, FormField, PrimaryButton, GhostButton } from "@/components/finance/ui";
import { FEE_CATEGORIES, formatRWF, ACADEMIC_SESSION, type FeeCategory, type FeeFrequency } from "@/lib/financeData";

export const Route = createFileRoute("/finance/fee-structure")({ component: FeeStructurePage });

const LEVELS = ["S1", "S2", "S3", "S4", "S5", "S6"];
const FREQUENCIES: FeeFrequency[] = ["One Time", "Monthly", "Term", "Annual"];

function FeeStructurePage() {
  const [cats, setCats] = useState<FeeCategory[]>(FEE_CATEGORIES);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const rows = cats.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  const activeCount = cats.filter((c) => c.active).length;
  const mandatoryCount = cats.filter((c) => c.mandatory).length;

  const toggleActive = (id: string) => {
    setCats((prev) => prev.map((c) => (c.id === id ? { ...c, active: !c.active } : c)));
    const c = cats.find((x) => x.id === id);
    toast.success(`${c?.name} ${c?.active ? "deactivated" : "activated"} (history preserved)`);
  };

  const addCategory = (c: FeeCategory) => {
    setCats((prev) => [c, ...prev]);
    setCreating(false);
    toast.success(`Fee category "${c.name}" created & ${c.active ? "activated" : "saved as inactive"}`);
  };

  return (
    <FinanceLayout title="Fee Structure" subtitle={`Fee categories for the ${ACADEMIC_SESSION} academic session`}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard compact label="Fee Categories" value={cats.length} />
        <StatCard compact label="Active" value={activeCount} tone="success" />
        <StatCard compact label="Mandatory" value={mandatoryCount} tone="primary" />
        <StatCard compact label="Discount Eligible" value={cats.filter((c) => c.discountEligible).length} tone="warning" />
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
                <th className="text-left px-4 py-3">Frequency</th>
                {LEVELS.map((l) => <th key={l} className="text-right px-4 py-3">{l}</th>)}
                <th className="text-center px-4 py-3">Mandatory</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-center px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-border odd:bg-background even:bg-muted/20 hover:bg-accent/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-[11px] text-muted-foreground">{c.id} · eff. {c.effectiveDate}</div>
                  </td>
                  <td className="px-4 py-3"><StatusPill label={c.frequency} tone="muted" /></td>
                  {LEVELS.map((l) => <td key={l} className="px-4 py-3 text-right font-mono text-xs">{c.amounts[l] ? formatRWF(c.amounts[l]) : "—"}</td>)}
                  <td className="px-4 py-3 text-center">{c.mandatory ? "✅" : "—"}</td>
                  <td className="px-4 py-3 text-center">{c.active ? <StatusPill label="Active" tone="success" /> : <StatusPill label="Inactive" tone="muted" />}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleActive(c.id)} className="text-xs font-semibold text-primary hover:underline">
                      {c.active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Fees can be activated/deactivated without deleting history. Discounts, scholarships and late-fee configuration are supported per category.
      </p>

      {creating && <CreateFeeModal nextId={cats.length + 1} onClose={() => setCreating(false)} onCreate={addCategory} />}
    </FinanceLayout>
  );
}

function CreateFeeModal({ nextId, onClose, onCreate }: { nextId: number; onClose: () => void; onCreate: (c: FeeCategory) => void }) {
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<FeeFrequency>("Term");
  const [amount, setAmount] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [mandatory, setMandatory] = useState(true);
  const [discountEligible, setDiscountEligible] = useState(false);
  const [active, setActive] = useState(true);

  const submit = () => {
    if (!name.trim()) { toast.error("Enter a fee category name"); return; }
    const amt = parseInt(amount.replace(/\D/g, ""));
    if (!amt || amt <= 0) { toast.error("Enter a valid base amount"); return; }
    onCreate({
      id: `FC-${String(nextId).padStart(2, "0")}`,
      name: name.trim(),
      frequency,
      session: ACADEMIC_SESSION,
      amounts: LEVELS.reduce((o, l) => ({ ...o, [l]: amt }), {}),
      mandatory,
      active,
      effectiveDate,
      discountEligible,
    });
  };

  return (
    <Modal title="Create Fee Category" subtitle="Applied across all class levels (editable later)" onClose={onClose}
      footer={<><GhostButton onClick={onClose}>Cancel</GhostButton><PrimaryButton onClick={submit}>Create &amp; Activate</PrimaryButton></>}>
      <TextField label="Fee Category Name" value={name} onChange={setName} placeholder="e.g. Examination Fee" required />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Frequency" value={frequency} onChange={(v) => setFrequency(v as FeeFrequency)} options={FREQUENCIES} required />
        <TextField label="Base Amount (RWF)" value={amount} onChange={setAmount} placeholder="50000" required />
      </div>
      <TextField label="Effective Date" value={effectiveDate} onChange={setEffectiveDate} type="date" required />
      <div className="flex flex-wrap gap-4 pt-1">
        <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} /> Mandatory</label>
        <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={discountEligible} onChange={(e) => setDiscountEligible(e.target.checked)} /> Discount eligible</label>
        <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Activate now</label>
      </div>
    </Modal>
  );
}
