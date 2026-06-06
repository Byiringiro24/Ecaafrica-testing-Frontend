import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { SuperAdminBreadcrumbs } from "@/components/layout/SuperAdminBreadcrumbs";
import { EmptyState, FilterBar, Pagination, SaInput, SaModal, SaSelect } from "@/components/super-admin/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { planBadgeClass, statusBadgeClass } from "@/lib/superAdminMockData";

export const Route = createFileRoute("/super-admin/schools/")({
  component: SchoolsIndexPage,
});

type PlatformPlan = {
  id: string;
  name: string;
  price_monthly?: number | string | null;
  price_annual?: number | string | null;
  student_limit?: number | null;
  staff_limit?: number | null;
  sms_bundle?: number | null;
  is_active?: boolean | null;
};

type PlatformSchool = {
  id: string;
  uuid?: string;
  name: string;
  school_type?: string | null;
  province: string;
  district: string;
  country?: string | null;
  sector?: string | null;
  principal_name?: string | null;
  principal_phone?: string | null;
  principal_email?: string | null;
  school_phone?: string | null;
  school_email?: string | null;
  subscription_plan_id?: string | null;
  subscription_plan?: PlatformPlan | null;
  status?: string | null;
  timezone?: string | null;
  currency?: string | null;
  has_boarding?: boolean | null;
  has_biometrics?: boolean | null;
  has_gate?: boolean | null;
  has_visitor_mgmt?: boolean | null;
  has_exam_system?: boolean | null;
  has_salary_mgmt?: boolean | null;
  has_parent_app?: boolean | null;
  has_bulk_sms?: boolean | null;
  student_count?: number | null;
  staff_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ListResponse<T> = {
  data: T[];
  meta?: { page: number; limit: number; total: number };
};

type SchoolFormState = {
  name: string;
  school_type: string;
  province: string;
  district: string;
  country: string;
  sector: string;
  principal_name: string;
  principal_phone: string;
  principal_email: string;
  school_phone: string;
  school_email: string;
  subscription_plan_id: string;
  status: string;
  timezone: string;
  currency: string;
  has_boarding: boolean;
  has_biometrics: boolean;
  has_gate: boolean;
  has_visitor_mgmt: boolean;
  has_exam_system: boolean;
  has_salary_mgmt: boolean;
  has_parent_app: boolean;
  has_bulk_sms: boolean;
};

const STATUS_OPTIONS = ["active", "trial", "grace", "suspended", "expired", "cancelled"] as const;
const SCHOOL_TYPES = ["government", "private", "international", "technical", "seminary", "other"] as const;
const COUNTRY_OPTIONS = (() => {
  if (typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function") {
    try {
      const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
      if (typeof Intl.supportedValuesOf === "function") {
        return Intl.supportedValuesOf("region")
          .filter((code) => /^[A-Z]{2}$/.test(code))
          .map((code) => displayNames.of(code))
          .filter((name): name is string => Boolean(name))
          .sort((a, b) => a.localeCompare(b));
      }
    } catch {
      // Fallback when Intl.supportedValuesOf is unsupported or fails
    }
  }

  return [
    "Rwanda",
    "Uganda",
    "Kenya",
    "Tanzania",
    "South Africa",
    "Nigeria",
    "Ghana",
    "Egypt",
    "Morocco",
    "Zimbabwe"
  ];
})();
type ModuleKey =
  | "has_boarding"
  | "has_biometrics"
  | "has_gate"
  | "has_visitor_mgmt"
  | "has_exam_system"
  | "has_salary_mgmt"
  | "has_parent_app"
  | "has_bulk_sms";

const MODULE_FIELDS: Array<{ key: ModuleKey; label: string; description: string }> = [
  { key: "has_boarding", label: "Boarding", description: "Dormitory management" },
  { key: "has_biometrics", label: "Biometrics", description: "Fingerprint enrollment" },
  { key: "has_gate", label: "Gate Management", description: "Entry/exit control" },
  { key: "has_visitor_mgmt", label: "Visitor Management", description: "Visitor check-ins" },
  { key: "has_exam_system", label: "Exam System", description: "Exams and results" },
  { key: "has_salary_mgmt", label: "Salary Management", description: "Payroll for staff" },
  { key: "has_parent_app", label: "Parent App", description: "Parent mobile access" },
  { key: "has_bulk_sms", label: "Bulk SMS", description: "Mass messaging" },
];

const EMPTY_FORM: SchoolFormState = {
  name: "",
  school_type: "government",
  province: "",
  district: "",
  country: "",
  sector: "",
  principal_name: "",
  principal_phone: "",
  principal_email: "",
  school_phone: "",
  school_email: "",
  subscription_plan_id: "",
  status: "trial",
  timezone: "Africa/Kigali",
  currency: "RWF",
  has_boarding: false,
  has_biometrics: false,
  has_gate: false,
  has_visitor_mgmt: false,
  has_exam_system: false,
  has_salary_mgmt: false,
  has_parent_app: false,
  has_bulk_sms: false,
};

function SchoolsIndexPage() {
  const [schools, setSchools] = useState<PlatformSchool[]>([]);
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [schoolType, setSchoolType] = useState("all");
  const [countryFilter, setCountryFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<SchoolFormState>(() => ({ ...EMPTY_FORM }));
  const [creating, setCreating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const showSkeleton = loading && schools.length === 0;

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / pageSize));

  useEffect(() => {
    let active = true;
    const loadPlans = async () => {
      try {
        const resp = await apiRequest<ListResponse<PlatformPlan>>("/platform/plans?page=1&limit=200", { returnMeta: true });
        if (!active) return;
        const items = Array.isArray(resp?.data) ? resp.data : [];
        setPlans(items);
      } catch (error) {
        const message = error && typeof error === "object" && "message" in error ? String(error.message) : "Failed to load plans";
        toast.error(message);
      }
    };

    loadPlans();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadSchools = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      if (search.trim()) params.set("q", search.trim());
      if (status !== "all") params.set("status", status);
      if (schoolType !== "all") params.set("school_type", schoolType);
      if (countryFilter.trim()) params.set("country", countryFilter.trim());

      try {
        const resp = await apiRequest<ListResponse<PlatformSchool>>(`/platform/schools?${params.toString()}`, { returnMeta: true });
        if (!active) return;
        const items = Array.isArray(resp?.data) ? resp.data : [];
        setSchools(items);
        setMeta(resp?.meta ?? { page, limit: pageSize, total: items.length });
      } catch (error) {
        if (!active) return;
        const message = error && typeof error === "object" && "message" in error ? String(error.message) : "Failed to load schools";
        toast.error(message);
        setSchools([]);
        setMeta({ page: 1, limit: pageSize, total: 0 });
      } finally {
        if (active) setLoading(false);
      }
    };

    loadSchools();
    return () => {
      active = false;
    };
  }, [page, pageSize, search, status, schoolType, countryFilter, refreshKey]);

  const statusCounts = useMemo(() => {
    const counts = { active: 0, trial: 0, suspended: 0 };
    schools.forEach((s) => {
      if (s.status === "active") counts.active += 1;
      if (s.status === "trial") counts.trial += 1;
      if (s.status === "suspended") counts.suspended += 1;
    });
    return counts;
  }, [schools]);

  const resetForm = () => setForm({ ...EMPTY_FORM });

  const handleCreateSchool = async () => {
    if (!form.name.trim() || !form.country.trim() || !form.province.trim() || !form.district.trim()) {
      toast.error("Name, country, province, and district are required.");
      return;
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      school_type: form.school_type || undefined,
      country: form.country.trim(),
      province: form.province.trim(),
      district: form.district.trim(),
      sector: form.sector.trim() || undefined,
      principal_name: form.principal_name.trim() || undefined,
      principal_phone: form.principal_phone.trim() || undefined,
      principal_email: form.principal_email.trim() || undefined,
      school_phone: form.school_phone.trim() || undefined,
      school_email: form.school_email.trim() || undefined,
      subscription_plan_id: form.subscription_plan_id || undefined,
      status: form.status || undefined,
      timezone: form.timezone.trim() || undefined,
      currency: form.currency.trim() || undefined,
      has_boarding: form.has_boarding,
      has_biometrics: form.has_biometrics,
      has_gate: form.has_gate,
      has_visitor_mgmt: form.has_visitor_mgmt,
      has_exam_system: form.has_exam_system,
      has_salary_mgmt: form.has_salary_mgmt,
      has_parent_app: form.has_parent_app,
      has_bulk_sms: form.has_bulk_sms,
    };

    try {
      setCreating(true);
      await apiRequest<PlatformSchool>("/platform/schools", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success("School created. Welcome email queued if an email was provided.");
      setCreateOpen(false);
      resetForm();
      setPage(1);
      setRefreshKey((k) => k + 1);
    } catch (error) {
      const message = error && typeof error === "object" && "message" in error ? String(error.message) : "Failed to create school";
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <SuperAdminLayout
      title="Schools"
      subtitle="Manage onboarded schools and onboarding"
      breadcrumbs={<SuperAdminBreadcrumbs items={[{ label: "Super Admin", to: "/super-admin" }, { label: "Schools" }]} />}
    >
      {showSkeleton ? (
        <SchoolsSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">Total Schools</div>
              <div className="text-2xl font-bold">{meta.total}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">Active</div>
              <div className="text-2xl font-bold">{statusCounts.active}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">Trials</div>
              <div className="text-2xl font-bold">{statusCounts.trial}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">Suspended</div>
              <div className="text-2xl font-bold">{statusCounts.suspended}</div>
            </div>
          </div>

          <FilterBar>
            <div className="relative flex-1 min-w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by name, province, or district"
                className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
              />
            </div>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="h-10 min-w-[140px] rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="all">All Statuses</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <select
              value={schoolType}
              onChange={(e) => { setSchoolType(e.target.value); setPage(1); }}
              className="h-10 min-w-[140px] rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="all">All Types</option>
              {SCHOOL_TYPES.map((opt) => (
                <option key={opt} value={opt}>{toTitle(opt)}</option>
              ))}
            </select>
            <div className="min-w-[160px]">
              <input
                value={countryFilter}
                onChange={(e) => { setCountryFilter(e.target.value); setPage(1); }}
                placeholder="Country"
                list="country-options"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="h-10 inline-flex items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> New School
            </button>
          </FilterBar>

          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-8 text-sm text-muted-foreground">Loading schools...</div>
            ) : schools.length === 0 ? (
              <EmptyState message="No schools found for these filters." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      {[
                        "School",
                        "Location",
                        "Type",
                        "Plan",
                        "Students",
                        "Staff",
                        "Status",
                        "",
                      ].map((h) => (
                        <th key={h} className="text-left px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {schools.map((s) => (
                      <tr key={s.id} className="border-t border-border hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">
                          <div className="font-medium">{s.name}</div>
                          <div className="text-[11px] text-muted-foreground">{s.school_email ?? s.principal_email ?? "—"}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatLocation(s)}
                        </td>
                        <td className="px-4 py-3 text-xs">{toTitle(s.school_type ?? "—")}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${planBadgeClass(s.subscription_plan?.name ?? "")}`}>
                            {s.subscription_plan?.name ?? "No plan"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold">{s.student_count ?? 0}</td>
                        <td className="px-4 py-3 text-xs font-semibold">{s.staff_count ?? 0}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${statusBadgeClass(s.status ?? "")}`}>
                            {s.status ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Link
                            to="/super-admin/schools/$id"
                            params={{ id: s.id }}
                            className="text-xs font-semibold text-primary hover:underline"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination
              total={meta.total}
              page={page}
              pageSize={pageSize}
              onPage={(p) => setPage(Math.min(Math.max(1, p), totalPages))}
              onPageSize={(n) => { setPageSize(n); setPage(1); }}
            />
          </div>
        </>
      )}

      <SaModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create School"
        subtitle="A welcome email will be sent to the school or principal email."
        footer={
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setCreateOpen(false); resetForm(); }}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateSchool}
              disabled={creating}
              className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {creating ? "Creating..." : "Create School"}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SaInput label="School Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <SaSelect label="School Type" value={form.school_type} onChange={(e) => setForm({ ...form, school_type: e.target.value })}>
            {SCHOOL_TYPES.map((opt) => (
              <option key={opt} value={opt}>{toTitle(opt)}</option>
            ))}
          </SaSelect>
          <SaInput label="Country *" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Search or select country" list="country-options" />
          <SaInput label="Province *" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
          <SaInput label="District *" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
          <SaSelect label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </SaSelect>
          <SaInput label="School Email" type="email" value={form.school_email} onChange={(e) => setForm({ ...form, school_email: e.target.value })} />
          <SaInput label="School Phone" value={form.school_phone} onChange={(e) => setForm({ ...form, school_phone: e.target.value })} />
          <SaInput label="Principal Name" value={form.principal_name} onChange={(e) => setForm({ ...form, principal_name: e.target.value })} />
          <SaInput label="Principal Email" type="email" value={form.principal_email} onChange={(e) => setForm({ ...form, principal_email: e.target.value })} />
          <SaInput label="Principal Phone" value={form.principal_phone} onChange={(e) => setForm({ ...form, principal_phone: e.target.value })} />
          <SaSelect label="Subscription Plan" value={form.subscription_plan_id} onChange={(e) => setForm({ ...form, subscription_plan_id: e.target.value })}>
            <option value="">No plan</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.name}</option>
            ))}
          </SaSelect>
          <SaInput label="Timezone" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
          <SaInput label="Currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
        </div>

        <datalist id="country-options">
          {COUNTRY_OPTIONS.map((country) => (
            <option key={country} value={country} />
          ))}
        </datalist>

        <div className="mt-5">
          <div className="text-xs font-semibold text-muted-foreground mb-2">Enabled Modules</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {MODULE_FIELDS.map((m) => (
              <label key={m.key} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{m.label}</div>
                  <div className="text-xs text-muted-foreground">{m.description}</div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(form[m.key])}
                  onChange={(e) => setForm({ ...form, [m.key]: e.target.checked })}
                />
              </label>
            ))}
          </div>
        </div>
      </SaModal>
    </SuperAdminLayout>
  );
}

function SchoolsSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-6 w-12" />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-4">
        <Skeleton className="h-10 flex-1 min-w-[240px]" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                {Array.from({ length: 8 }).map((_, i) => (
                  <th key={i} className="text-left px-4 py-3">
                    <Skeleton className="h-3 w-16" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-20 rounded-full" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-16 rounded-full" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-10" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border">
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    </>
  );
}

function toTitle(value: string) {
  return value
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatLocation(school: PlatformSchool) {
  const parts = [school.province, school.district, school.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}
