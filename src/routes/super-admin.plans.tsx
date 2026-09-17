import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { SuperAdminBreadcrumbs } from "@/components/layout/SuperAdminBreadcrumbs";
import { EmptyState, SaInput, SaModal, SaSelect } from "@/components/super-admin/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { formatRWF } from "@/lib/mockData";

export const Route = createFileRoute("/super-admin/plans")({ component: SubscriptionPlansPage });

type Plan = { id: string; name: string; price_monthly: number | string; price_annual: number | string; student_limit: number; staff_limit: number; sms_bundle: number; features?: unknown; is_active: boolean; sort_order: number };
type PlanForm = { name: string; price_monthly: string; price_annual: string; student_limit: string; staff_limit: string; sms_bundle: string; features: string; is_active: string };
const emptyForm: PlanForm = { name: "", price_monthly: "", price_annual: "", student_limit: "", staff_limit: "", sms_bundle: "", features: "", is_active: "true" };

function SubscriptionPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const response = await apiRequest<{ data: Plan[] }>("/platform/plans?page=1&limit=200", { returnMeta: true });
      setPlans(Array.isArray(response?.data) ? response.data : []);
    } catch (error) { toast.error(errorMessage(error, "Unable to load subscription plans")); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadPlans(); }, []);

  const visiblePlans = useMemo(() => filter === "all" ? plans : plans.filter(plan => plan.is_active === (filter === "active")), [filter, plans]);
  const setField = (key: keyof PlanForm, value: string) => setForm(current => ({ ...current, [key]: value }));
  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (plan: Plan) => {
    setEditing(plan);
    setForm({ name: plan.name, price_monthly: String(plan.price_monthly ?? ""), price_annual: String(plan.price_annual ?? ""), student_limit: String(plan.student_limit ?? ""), staff_limit: String(plan.staff_limit ?? ""), sms_bundle: String(plan.sms_bundle ?? ""), features: featureList(plan.features).join(", "), is_active: String(plan.is_active) });
    setModalOpen(true);
  };
  const savePlan = async () => {
    if (!form.name.trim()) { toast.error("Plan name is required"); return; }
    setSaving(true);
    const body = { name: form.name.trim(), price_monthly: numberValue(form.price_monthly), price_annual: numberValue(form.price_annual), student_limit: integerValue(form.student_limit), staff_limit: integerValue(form.staff_limit), sms_bundle: integerValue(form.sms_bundle), features: { items: form.features.split(",").map(item => item.trim()).filter(Boolean) }, is_active: form.is_active === "true" };
    try {
      const saved = await apiRequest<Plan>(editing ? `/platform/plans/${editing.id}` : "/platform/plans", { method: editing ? "PATCH" : "POST", body: JSON.stringify(body) });
      setPlans(current => editing ? current.map(plan => plan.id === saved.id ? saved : plan) : [saved, ...current]);
      setModalOpen(false); toast.success(editing ? "Subscription plan updated" : "Subscription plan created");
    } catch (error) { toast.error(errorMessage(error, "Unable to save subscription plan")); }
    finally { setSaving(false); }
  };
  const removePlan = async (plan: Plan) => {
    if (!window.confirm(`Delete ${plan.name}? Existing subscriptions will not be changed.`)) return;
    try { await apiRequest(`/platform/plans/${plan.id}`, { method: "DELETE" }); setPlans(current => current.filter(item => item.id !== plan.id)); toast.success("Subscription plan deleted"); }
    catch (error) { toast.error(errorMessage(error, "Unable to delete subscription plan")); }
  };

  return <SuperAdminLayout title="Subscription Plans" subtitle="Configure the plans available to schools on the platform." breadcrumbs={<SuperAdminBreadcrumbs items={[{ label: "Super Admin", to: "/super-admin" }, { label: "Subscription Plans" }]} />} headerExtra={<button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> New plan</button>}>
    {loading ? <PlansSkeleton /> : <>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3"><Summary label="Total plans" value={plans.length} /><Summary label="Active plans" value={plans.filter(plan => plan.is_active).length} /><Summary label="Inactive plans" value={plans.filter(plan => !plan.is_active).length} /></div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2">{["all", "active", "inactive"].map(value => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize ${filter === value ? "bg-amber-500 text-amber-950" : "border border-border hover:bg-muted"}`}>{value}</button>)}</div><p className="text-xs text-muted-foreground">{visiblePlans.length} plan{visiblePlans.length === 1 ? "" : "s"}</p></div>
      {visiblePlans.length === 0 ? <div className="rounded-xl border border-border bg-card"><EmptyState message="No subscription plans found." /></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visiblePlans.map(plan => <PlanCard key={plan.id} plan={plan} onEdit={() => openEdit(plan)} onDelete={() => void removePlan(plan)} />)}</div>}
    </>}
    <PlanModal open={modalOpen} editing={editing} form={form} saving={saving} onChange={setField} onClose={() => setModalOpen(false)} onSave={() => void savePlan()} />
  </SuperAdminLayout>;
}

function PlanCard({ plan, onEdit, onDelete }: { plan: Plan; onEdit: () => void; onDelete: () => void }) {
  return <article className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-lg font-bold">{plan.name}</h2><p className="mt-1 text-xs text-muted-foreground">Plan ID: {plan.id}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${plan.is_active ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}>{plan.is_active ? "Active" : "Inactive"}</span></div><div className="my-5"><span className="font-display text-2xl font-bold">{formatRWF(Number(plan.price_monthly))}</span><span className="text-xs text-muted-foreground"> / month</span><p className="mt-1 text-xs text-muted-foreground">{formatRWF(Number(plan.price_annual))} billed annually</p></div><div className="grid grid-cols-3 gap-2 border-y border-border py-4 text-center text-xs"><Metric label="Students" value={plan.student_limit} /><Metric label="Staff" value={plan.staff_limit} /><Metric label="SMS / month" value={plan.sms_bundle} /></div><ul className="mt-4 min-h-20 flex-1 space-y-2 text-sm">{featureList(plan.features).slice(0, 5).map(feature => <li key={feature} className="flex gap-2"><span className="text-emerald-600">✓</span><span>{feature}</span></li>)}{featureList(plan.features).length === 0 && <li className="text-xs text-muted-foreground">No feature notes added.</li>}</ul><div className="mt-5 flex gap-2 border-t border-border pt-4"><button type="button" onClick={onEdit} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"><Pencil className="h-3.5 w-3.5" /> Edit</button><button type="button" onClick={onDelete} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /> Delete</button></div></article>;
}

function PlanModal({ open, editing, form, saving, onChange, onClose, onSave }: { open: boolean; editing: Plan | null; form: PlanForm; saving: boolean; onChange: (key: keyof PlanForm, value: string) => void; onClose: () => void; onSave: () => void }) {
  return <SaModal open={open} onClose={onClose} title={editing ? "Edit subscription plan" : "Create subscription plan"} subtitle="Set limits and pricing used for school subscriptions." wide footer={<div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">Cancel</button><button type="button" disabled={saving} onClick={onSave} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? "Saving…" : editing ? "Save changes" : "Create plan"}</button></div>}><div className="grid gap-4 sm:grid-cols-2"><SaInput label="Plan name" value={form.name} onChange={event => onChange("name", event.target.value)} placeholder="e.g. Professional" className="sm:col-span-2" /><SaInput label="Monthly price (RWF)" type="number" min="0" value={form.price_monthly} onChange={event => onChange("price_monthly", event.target.value)} /><SaInput label="Annual price (RWF)" type="number" min="0" value={form.price_annual} onChange={event => onChange("price_annual", event.target.value)} /><SaInput label="Student limit" type="number" min="0" value={form.student_limit} onChange={event => onChange("student_limit", event.target.value)} /><SaInput label="Staff limit" type="number" min="0" value={form.staff_limit} onChange={event => onChange("staff_limit", event.target.value)} /><SaInput label="SMS bundle / month" type="number" min="0" value={form.sms_bundle} onChange={event => onChange("sms_bundle", event.target.value)} /><SaSelect label="Status" value={form.is_active} onChange={event => onChange("is_active", event.target.value)}><option value="true">Active</option><option value="false">Inactive</option></SaSelect><div className="sm:col-span-2"><label className="mb-1.5 block text-xs font-semibold">Features</label><textarea rows={4} value={form.features} onChange={event => onChange("features", event.target.value)} placeholder="Attendance, Parent SMS, Advanced reports" className="w-full rounded-lg border border-border bg-background p-3 text-sm" /><p className="mt-1 text-[11px] text-muted-foreground">Separate features with commas.</p></div></div></SaModal>;
}

function Summary({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-border bg-card p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl font-bold">{value}</p></div>; }
function Metric({ label, value }: { label: string; value: number }) { return <div><p className="font-semibold">{value.toLocaleString()}</p><p className="mt-1 text-[10px] text-muted-foreground">{label}</p></div>; }
function featureList(features: unknown): string[] { if (Array.isArray(features)) return features.filter((item): item is string => typeof item === "string"); if (features && typeof features === "object") { const items = (features as { items?: unknown }).items; if (Array.isArray(items)) return items.filter((item): item is string => typeof item === "string"); } return []; }
function numberValue(value: string) { const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0; }
function integerValue(value: string) { return Math.round(numberValue(value)); }
function errorMessage(error: unknown, fallback: string) { return error && typeof error === "object" && "message" in error ? String(error.message) : fallback; }
function PlansSkeleton() { return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="rounded-2xl border border-border bg-card p-5"><Skeleton className="h-6 w-36" /><Skeleton className="mt-8 h-8 w-40" /><Skeleton className="mt-6 h-12 w-full" /><Skeleton className="mt-6 h-20 w-full" /></div>)}</div>; }
