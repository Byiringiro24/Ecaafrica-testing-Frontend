import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { SuperAdminBreadcrumbs } from "@/components/layout/SuperAdminBreadcrumbs";
import { StatCard } from "@/components/ui-kit/StatCard";
import {
  ChartCard,
  EmptyState,
  FilterBar,
  Pagination,
  SaInput,
  SaModal,
  SaSelect,
} from "@/components/super-admin/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { formatRWF } from "@/lib/mockData";

export const Route = createFileRoute("/super-admin/subscriptions")({ component: SubsPage });

function SubsPage() {
  const [statusF, setStatusF] = useState("all");
  const [rows, setRows] = useState<Subscription[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [form, setForm] = useState<SubscriptionForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiRequest<{ data: Subscription[] }>(
        `/platform/subscriptions?page=1&limit=200${statusF !== "all" ? `&status=${statusF}` : ""}`,
        { returnMeta: true },
      ),
      apiRequest<{ data: Plan[] }>("/platform/plans?page=1&limit=200", { returnMeta: true }),
    ])
      .then(([subscriptions, planResponse]) => {
        setRows(subscriptions?.data ?? []);
        setPlans(planResponse?.data ?? []);
      })
      .catch((error) => {
        setRows([]);
        toast.error(error?.message ?? "Unable to load subscriptions");
      })
      .finally(() => setLoading(false));
  }, [statusF]);

  const paginated = rows.slice((page - 1) * pageSize, page * pageSize);
  const update = async (subscription: Subscription, data: Record<string, unknown>) => {
    try {
      const updated = await apiRequest<Subscription>(`/platform/subscriptions/${subscription.id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      setRows((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      toast.success("Subscription updated");
    } catch (error) {
      toast.error(error?.message ?? "Unable to update subscription");
    }
  };
  const openEdit = (subscription: Subscription) => {
    setEditing(subscription);
    setForm({
      plan_id: subscription.plan_id,
      billing_cycle: subscription.billing_cycle,
      amount: String(subscription.amount ?? ""),
      status: subscription.status,
      auto_renew: String(subscription.auto_renew),
    });
  };
  const setField = (key: keyof SubscriptionForm, value: string) =>
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "plan_id" || key === "billing_cycle") {
        const plan = plans.find((item) => item.id === next.plan_id);
        if (plan)
          next.amount = String(
            next.billing_cycle === "annual" ? plan.price_annual : plan.price_monthly,
          );
      }
      return next;
    });
  const saveEdit = async () => {
    if (!editing || !form.plan_id) return;
    setSaving(true);
    try {
      const updated = await apiRequest<Subscription>(`/platform/subscriptions/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          plan_id: form.plan_id,
          billing_cycle: form.billing_cycle,
          amount: Number(form.amount),
          status: form.status,
          auto_renew: form.auto_renew === "true",
        }),
      });
      setRows((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setEditing(null);
      toast.success("Subscription plan updated");
    } catch (error) {
      toast.error(error?.message ?? "Unable to update subscription plan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SuperAdminLayout
      title="Subscriptions"
      breadcrumbs={
        <SuperAdminBreadcrumbs
          items={[{ label: "Super Admin", to: "/super-admin" }, { label: "Subscriptions" }]}
        />
      }
    >
      {loading ? (
        <SubscriptionsSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <StatCard
              label="Active Subscriptions"
              value={rows.filter((s) => s.status === "active").length}
              tone="success"
            />
            <StatCard
              label="Trial Schools"
              value={rows.filter((s) => s.status === "trial").length}
            />
            <StatCard
              label="Grace Period"
              value={rows.filter((s) => s.status === "grace").length}
              tone="warning"
            />
            <StatCard
              label="Cancelled / Expired"
              value={rows.filter((s) => ["cancelled", "expired"].includes(s.status)).length}
              tone="destructive"
            />
          </div>

          <FilterBar>
            <select
              value={statusF}
              onChange={(e) => {
                setStatusF(e.target.value);
                setPage(1);
              }}
              className="h-10 min-w-[120px] rounded-lg border border-border px-3 text-sm"
            >
              <option value="all">All statuses</option>
              <option>active</option>
              <option>trial</option>
              <option>grace</option>
              <option>expired</option>
              <option>cancelled</option>
            </select>
          </FilterBar>

          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    {[
                      "School",
                      "Plan",
                      "Cycle",
                      "MRR",
                      "Start",
                      "Next Renewal",
                      "Status",
                      "Auto-Renew",
                      "",
                    ].map((h) => (
                      <th key={h} className="text-left px-4 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={9}>
                        <EmptyState message="No subscriptions match this status." />
                      </td>
                    </tr>
                  ) : (
                    paginated.map((s) => (
                      <tr key={s.id} className="border-t border-border">
                        <td className="px-4 py-3 font-medium">{s.school?.name ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">
                            {s.plan?.name ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs capitalize">{s.billing_cycle}</td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {formatRWF(Number(s.amount))}
                        </td>
                        <td className="px-4 py-3 text-xs">{date(s.starts_at)}</td>
                        <td className="px-4 py-3 text-xs">{date(s.ends_at)}</td>
                        <td className="px-4 py-3">
                          <SubscriptionStatus status={s.status} />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={s.auto_renew}
                            onChange={(e) => update(s, { auto_renew: e.target.checked })}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => openEdit(s)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            >
                              <Pencil className="h-3.5 w-3.5" /> Edit plan
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                update(s, {
                                  status: s.status === "active" ? "cancelled" : "active",
                                })
                              }
                              className="text-xs font-semibold text-primary hover:underline"
                            >
                              {s.status === "active" ? "Cancel" : "Activate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              total={rows.length}
              page={page}
              pageSize={pageSize}
              onPage={setPage}
              onPageSize={(n) => {
                setPageSize(n);
                setPage(1);
              }}
            />
          </div>
        </>
      )}

      <SubscriptionModal
        open={Boolean(editing)}
        subscription={editing}
        plans={plans}
        form={form}
        saving={saving}
        onChange={setField}
        onClose={() => setEditing(null)}
        onSave={() => void saveEdit()}
      />
    </SuperAdminLayout>
  );
}

type Plan = {
  id: string;
  name: string;
  price_monthly: number | string;
  price_annual: number | string;
  is_active: boolean;
};
type Subscription = {
  id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  amount: number | string;
  auto_renew: boolean;
  starts_at: string;
  ends_at?: string | null;
  school?: { name: string };
  plan?: { name: string };
};
type SubscriptionForm = {
  plan_id: string;
  billing_cycle: string;
  amount: string;
  status: string;
  auto_renew: string;
};
const emptyForm: SubscriptionForm = {
  plan_id: "",
  billing_cycle: "monthly",
  amount: "",
  status: "active",
  auto_renew: "true",
};

function SubscriptionModal({
  open,
  subscription,
  plans,
  form,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  open: boolean;
  subscription: Subscription | null;
  plans: Plan[];
  form: SubscriptionForm;
  saving: boolean;
  onChange: (key: keyof SubscriptionForm, value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <SaModal
      open={open}
      onClose={onClose}
      title="Update subscription plan"
      subtitle={
        subscription?.school?.name
          ? `Change the plan assigned to ${subscription.school.name}.`
          : "Change the plan and billing settings."
      }
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SaSelect
          label="Subscription plan"
          value={form.plan_id}
          onChange={(event) => onChange("plan_id", event.target.value)}
        >
          <option value="">Select a plan</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
              {!plan.is_active ? " (inactive)" : ""}
            </option>
          ))}
        </SaSelect>
        <SaSelect
          label="Billing cycle"
          value={form.billing_cycle}
          onChange={(event) => onChange("billing_cycle", event.target.value)}
        >
          <option value="monthly">Monthly</option>
          <option value="annual">Annual</option>
          <option value="term">Term</option>
          <option value="weekly">Weekly</option>
          <option value="daily">Daily</option>
        </SaSelect>
        <SaInput
          label="Amount (RWF)"
          type="number"
          min="0"
          value={form.amount}
          onChange={(event) => onChange("amount", event.target.value)}
        />
        <SaSelect
          label="Status"
          value={form.status}
          onChange={(event) => onChange("status", event.target.value)}
        >
          <option>active</option>
          <option>trial</option>
          <option>grace</option>
          <option>expired</option>
          <option>cancelled</option>
          <option>pending</option>
        </SaSelect>
        <SaSelect
          label="Auto-renew"
          value={form.auto_renew}
          onChange={(event) => onChange("auto_renew", event.target.value)}
        >
          <option value="true">Enabled</option>
          <option value="false">Disabled</option>
        </SaSelect>
      </div>
    </SaModal>
  );
}
const date = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : "—");

function SubscriptionStatus({ status }: { status: string }) {
  const tone =
    {
      active: "bg-emerald-100 text-emerald-800",
      trial: "bg-blue-100 text-blue-800",
      grace: "bg-amber-100 text-amber-800",
      expired: "bg-slate-100 text-slate-700",
      cancelled: "bg-red-100 text-red-800",
      pending: "bg-violet-100 text-violet-800",
    }[status] ?? "bg-muted text-muted-foreground";

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${tone}`}>
      {status}
    </span>
  );
}

function SubscriptionsSkeleton() {
  return (
    <>
      <div className="rounded-lg border border-border px-4 py-3 mb-4">
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-6 w-16" />
          </div>
        ))}
      </div>
      <ChartCard title="Subscription Health (6 months)" className="mb-5">
        <Skeleton className="h-[260px] w-full" />
      </ChartCard>
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              {Array.from({ length: 9 }).map((_, i) => (
                <th key={i} className="text-left px-4 py-3">
                  <Skeleton className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="border-t border-border">
                {Array.from({ length: 9 }).map((__, j) => (
                  <td key={j} className="px-4 py-3">
                    <Skeleton className="h-4 w-20" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-border">
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    </>
  );
}
