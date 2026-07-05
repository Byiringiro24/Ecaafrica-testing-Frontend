import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { SuperAdminBreadcrumbs } from "@/components/layout/SuperAdminBreadcrumbs";
import { PageTabs, ConfirmDialog, SaInput, SaModal, SaPhoneInput, SaSelect, SaCountrySelect } from "@/components/super-admin/ui";
import { Skeleton } from "@/components/ui/skeleton";
import {
  planBadgeClass,
  statusBadgeClass,
  SCHOOL_MODULES,
} from "@/lib/superAdminMockData";
import { formatRWF } from "@/lib/mockData";
import { apiRequest } from "@/lib/api";
import { parsePhoneValue } from "@/lib/countries";

export const Route = createFileRoute("/super-admin/schools/$id")({ component: SchoolDetailPage });

const ATTENDANCE_SPARK = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  rate: 82 + Math.sin(i / 4) * 8 + (i % 5),
}));

type PlatformPlan = {
  id: string;
  name: string;
  price_monthly?: number | string | null;
  price_annual?: number | string | null;
};

type SchoolOverview = {
  school_id: string;
  student_count: number;
  staff_count: number;
  class_count: number;
  sms_sent_month: number;
};

type SchoolUser = {
  id: string;
  name: string;
  email?: string | null;
  role?: string | null;
  status?: string | null;
  last_login_at?: string | null;
};

type SchoolAuditLog = {
  id: string;
  action: string;
  actor_name?: string | null;
  actor_type?: string | null;
  resource_name?: string | null;
  created_at: string;
};

type SchoolInvoice = {
  id: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  total: number | string;
  status: string;
  currency?: string | null;
};

type SchoolSubscription = {
  id: string;
  status: string;
  billing_cycle?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  trial_ends_at?: string | null;
  grace_ends_at?: string | null;
  plan?: PlatformPlan | null;
};

type SchoolBilling = {
  subscription: SchoolSubscription | null;
  invoices: SchoolInvoice[];
  meta?: { page: number; limit: number; total: number };
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
  trial_ends_at?: string | null;
  grace_ends_at?: string | null;
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

const SCHOOL_TYPES = ["government", "private", "international", "technical", "seminary", "other"] as const;
const STATUS_OPTIONS = ["active", "trial", "grace", "suspended", "expired", "cancelled"] as const;

const toFormState = (s: PlatformSchool): SchoolFormState => ({
  name: s.name ?? "",
  school_type: s.school_type ?? "government",
  province: s.province ?? "",
  district: s.district ?? "",
  country: s.country ?? "",
  sector: s.sector ?? "",
  principal_name: s.principal_name ?? "",
  principal_phone: s.principal_phone ?? "",
  principal_email: s.principal_email ?? "",
  school_phone: s.school_phone ?? "",
  school_email: s.school_email ?? "",
  subscription_plan_id: s.subscription_plan_id ?? "",
  status: s.status ?? "trial",
  timezone: s.timezone ?? "Africa/Kigali",
  currency: s.currency ?? "RWF",
  has_boarding: Boolean(s.has_boarding),
  has_biometrics: Boolean(s.has_biometrics),
  has_gate: Boolean(s.has_gate),
  has_visitor_mgmt: Boolean(s.has_visitor_mgmt),
  has_exam_system: Boolean(s.has_exam_system),
  has_salary_mgmt: Boolean(s.has_salary_mgmt),
  has_parent_app: Boolean(s.has_parent_app),
  has_bulk_sms: Boolean(s.has_bulk_sms)
});

const buildModuleState = (school?: PlatformSchool | null) => ({
  core: true,
  boarding: Boolean(school?.has_boarding),
  biometrics: Boolean(school?.has_biometrics),
  gate: Boolean(school?.has_gate),
  visitor: Boolean(school?.has_visitor_mgmt),
  exam: Boolean(school?.has_exam_system),
  salary: Boolean(school?.has_salary_mgmt),
  parent_app: Boolean(school?.has_parent_app),
});

const moduleStateToPayload = (state: Record<string, boolean>) => ({
  has_boarding: state.boarding,
  has_biometrics: state.biometrics,
  has_gate: state.gate,
  has_visitor_mgmt: state.visitor,
  has_exam_system: state.exam,
  has_salary_mgmt: state.salary,
  has_parent_app: state.parent_app,
});

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "—";
  return parsed.toISOString().slice(0, 10);
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "—";
  return parsed.toLocaleString();
};

const formatInvoicePeriod = (start?: string | null, end?: string | null) => {
  if (!start && !end) return "—";
  return `${formatDate(start)} — ${formatDate(end)}`;
};

const formatLocation = (school: PlatformSchool) => {
  const parts = [school.country, school.province, school.district].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
};

const planMonthlyPrice = (plan?: PlatformPlan | null) => {
  if (!plan?.price_monthly) return 0;
  const value = typeof plan.price_monthly === "string" ? Number(plan.price_monthly) : plan.price_monthly;
  return Number.isFinite(value) ? value : 0;
};

const formatAmount = (value?: number | string | null) => {
  if (value === undefined || value === null) return "—";
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? formatRWF(parsed) : "—";
};

function SchoolDetailPage() {
  const { id } = Route.useParams();
  const [school, setSchool] = useState<PlatformSchool | null>(null);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<SchoolOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [billing, setBilling] = useState<SchoolBilling | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [users, setUsers] = useState<SchoolUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [resettingSchoolPassword, setResettingSchoolPassword] = useState(false);
  const [auditLogs, setAuditLogs] = useState<SchoolAuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [tab, setTab] = useState("Overview");
  const [statusActionOpen, setStatusActionOpen] = useState(false);
  const [statusAction, setStatusAction] = useState<"suspend" | "activate">("suspend");
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [editForm, setEditForm] = useState<SchoolFormState | null>(null);
  const [editFormErrors, setEditFormErrors] = useState<Partial<Record<keyof SchoolFormState, boolean>>>({});
  const [savingModules, setSavingModules] = useState(false);
  const moduleDefaults = useMemo(() => buildModuleState(school), [school]);
  const [moduleState, setModuleState] = useState<Record<string, boolean>>(() => buildModuleState(null));

  useEffect(() => {
    setModuleState(moduleDefaults);
  }, [moduleDefaults]);

  useEffect(() => {
    let active = true;
    const loadPlans = async () => {
      try {
        const resp = await apiRequest<{ data: PlatformPlan[] }>("/platform/plans?page=1&limit=200", { returnMeta: true });
        if (!active) return;
        setPlans(Array.isArray(resp?.data) ? resp.data : []);
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
    const loadSchool = async () => {
      setLoading(true);
      try {
        const data = await apiRequest<PlatformSchool>(`/platform/schools/${id}`);
        if (!active) return;
        setSchool(data);
      } catch (error) {
        const message = error && typeof error === "object" && "message" in error ? String(error.message) : "Failed to load school";
        toast.error(message);
        if (active) setSchool(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadSchool();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    setOverview(null);
    setBilling(null);
    setUsers([]);
    setAuditLogs([]);
  }, [id]);

  useEffect(() => {
    let active = true;
    const loadOverview = async () => {
      setOverviewLoading(true);
      try {
        const data = await apiRequest<SchoolOverview>(`/platform/schools/${id}/overview`);
        if (!active) return;
        setOverview(data);
      } catch (error) {
        const message = error && typeof error === "object" && "message" in error ? String(error.message) : "Failed to load overview";
        toast.error(message);
        if (active) setOverview(null);
      } finally {
        if (active) setOverviewLoading(false);
      }
    };

    loadOverview();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (tab !== "Billing") return;
    let active = true;
    const loadBilling = async () => {
      setBillingLoading(true);
      try {
        const data = await apiRequest<SchoolBilling>(`/platform/schools/${id}/billing?page=1&limit=5`);
        if (!active) return;
        setBilling(data);
      } catch (error) {
        const message = error && typeof error === "object" && "message" in error ? String(error.message) : "Failed to load billing";
        toast.error(message);
        if (active) setBilling(null);
      } finally {
        if (active) setBillingLoading(false);
      }
    };

    loadBilling();
    return () => {
      active = false;
    };
  }, [id, tab]);

  useEffect(() => {
    if (tab !== "Users") return;
    let active = true;
    const loadUsers = async () => {
      setUsersLoading(true);
      try {
        const resp = await apiRequest<{ data: SchoolUser[] }>(
          `/platform/schools/${id}/users?page=1&limit=20`,
          { returnMeta: true }
        );
        if (!active) return;
        setUsers(Array.isArray(resp?.data) ? resp.data : []);
      } catch (error) {
        const message = error && typeof error === "object" && "message" in error ? String(error.message) : "Failed to load users";
        toast.error(message);
        if (active) setUsers([]);
      } finally {
        if (active) setUsersLoading(false);
      }
    };

    loadUsers();
    return () => {
      active = false;
    };
  }, [id, tab]);

  useEffect(() => {
    if (tab !== "Audit Log") return;
    let active = true;
    const loadAuditLogs = async () => {
      setAuditLoading(true);
      try {
        const resp = await apiRequest<{ data: SchoolAuditLog[] }>(
          `/platform/schools/${id}/audit-logs?page=1&limit=10`,
          { returnMeta: true }
        );
        if (!active) return;
        setAuditLogs(Array.isArray(resp?.data) ? resp.data : []);
      } catch (error) {
        const message = error && typeof error === "object" && "message" in error ? String(error.message) : "Failed to load audit logs";
        toast.error(message);
        if (active) setAuditLogs([]);
      } finally {
        if (active) setAuditLoading(false);
      }
    };

    loadAuditLogs();
    return () => {
      active = false;
    };
  }, [id, tab]);

  if (loading) {
    return (
      <SuperAdminLayout title="School details">
        <SchoolDetailSkeleton />
      </SuperAdminLayout>
    );
  }

  if (!school) {
    return (
      <SuperAdminLayout title="School not found">
        <p className="text-muted-foreground">No school with ID {id}.</p>
        <Link to="/super-admin/schools" className="text-primary text-sm font-semibold mt-2 inline-block">← Back to Schools</Link>
      </SuperAdminLayout>
    );
  }

  const planName = school.subscription_plan?.name ?? "No plan";
  const studentCount = overview?.student_count ?? school.student_count ?? 0;
  const staffCount = overview?.staff_count ?? school.staff_count ?? 0;
  const classCount = overview?.class_count ?? (studentCount ? Math.ceil(studentCount / 35) : 0);
  const smsMonth = overview?.sms_sent_month ?? 0;
  const location = formatLocation(school);
  const enabledModules = SCHOOL_MODULES.filter((m) => {
    if (m.key === "core") return true;
    if (m.key === "boarding") return Boolean(school.has_boarding);
    if (m.key === "biometrics") return Boolean(school.has_biometrics);
    if (m.key === "gate") return Boolean(school.has_gate);
    if (m.key === "visitor") return Boolean(school.has_visitor_mgmt);
    if (m.key === "exam") return Boolean(school.has_exam_system);
    if (m.key === "salary") return Boolean(school.has_salary_mgmt);
    if (m.key === "parent_app") return Boolean(school.has_parent_app);
    return false;
  });
  const monthlyPrice = planMonthlyPrice(school.subscription_plan);
  const billingPlanName = billing?.subscription?.plan?.name ?? planName;
  const billingStatus = billing?.subscription?.status ?? school.status ?? "—";
  const billingAmount = billing?.subscription?.amount ?? monthlyPrice;
  const trialEnds = formatDate(billing?.subscription?.trial_ends_at ?? school.trial_ends_at);
  const graceEnds = formatDate(billing?.subscription?.grace_ends_at ?? school.grace_ends_at);

  const openEdit = () => {
    setEditForm(toFormState(school));
    setEditOpen(true);
  };

  const handleUpdateSchool = async () => {
    if (!editForm) return;
    const errors: Partial<Record<keyof SchoolFormState, boolean>> = {};
    if (!editForm.name.trim()) errors.name = true;
    if (!editForm.country.trim()) errors.country = true;
    if (!editForm.province.trim()) errors.province = true;
    if (!editForm.district.trim()) errors.district = true;
    if (!editForm.school_email?.trim()) errors.school_email = true;
    if (parsePhoneValue(editForm.school_phone).nationalNumber.length !== 9) errors.school_phone = true;
      const [editForm, setEditForm] = useState<SchoolFormState | null>(null);
      const [editFormErrors, setEditFormErrors] = useState<Partial<Record<keyof SchoolFormState, boolean>>>({});
    if (Object.keys(errors).length > 0) {
      setEditFormErrors(errors);
      toast.error("Please fill all required fields.");
      return;
    }

    const payload: Record<string, unknown> = {
      name: editForm.name.trim(),
      school_type: editForm.school_type || undefined,
      country: editForm.country.trim() || undefined,
      province: editForm.province.trim(),
      district: editForm.district.trim(),
      sector: editForm.sector.trim() || undefined,
      principal_name: editForm.principal_name.trim() || undefined,
      principal_phone: editForm.principal_phone.trim() || undefined,
      principal_email: editForm.principal_email.trim() || undefined,
      school_phone: editForm.school_phone.trim() || undefined,
      school_email: editForm.school_email.trim() || undefined,
      subscription_plan_id: editForm.subscription_plan_id || undefined,
      status: editForm.status || undefined,
      timezone: editForm.timezone.trim() || undefined,
      currency: editForm.currency.trim() || undefined,
      has_boarding: editForm.has_boarding,
      has_biometrics: editForm.has_biometrics,
      has_gate: editForm.has_gate,
      has_visitor_mgmt: editForm.has_visitor_mgmt,
      has_exam_system: editForm.has_exam_system,
      has_salary_mgmt: editForm.has_salary_mgmt,
      has_parent_app: editForm.has_parent_app,
      has_bulk_sms: editForm.has_bulk_sms
    };

    try {
      setEditFormErrors({});
      setSaving(true);
      const updated = await apiRequest<PlatformSchool>(`/platform/schools/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      setSchool(updated);
      toast.success("School updated");
      setEditOpen(false);
    } catch (error) {
      const message = error && typeof error === "object" && "message" in error ? String(error.message) : "Failed to update school";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusAction = (action: "suspend" | "activate") => {
    setStatusAction(action);
    setStatusActionOpen(true);
  };

  const handleConfirmStatusAction = async () => {
    if (!school) return;
    const targetStatus = statusAction === "suspend" ? "suspended" : "active";

    try {
      setActionLoading(true);
      const updated = await apiRequest<PlatformSchool>(`/platform/schools/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: targetStatus })
      });
      setSchool(updated);
      toast.success(`School ${statusAction === "suspend" ? "suspended" : "activated"}`);
      setStatusActionOpen(false);
    } catch (error) {
      const message = error && typeof error === "object" && "message" in error ? String(error.message) : `Failed to ${statusAction} school`;
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveModules = async () => {
    try {
      setSavingModules(true);
      const updated = await apiRequest<PlatformSchool>(`/platform/schools/${id}`, {
        method: "PATCH",
        body: JSON.stringify(moduleStateToPayload(moduleState)),
      });
      setSchool(updated);
      toast.success("Module settings saved");
    } catch (error) {
      const message = error && typeof error === "object" && "message" in error ? String(error.message) : "Failed to save module settings";
      toast.error(message);
    } finally {
      setSavingModules(false);
    }
  };

  const handleResetPassword = async (user: SchoolUser) => {
    if (!user.email) {
      toast.error("User has no email address.");
      return;
    }

    try {
      setResettingUserId(user.id);
      await apiRequest("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: user.email })
      });
      toast.success("Reset link sent.");
    } catch (error) {
      const message = error && typeof error === "object" && "message" in error ? String(error.message) : "Failed to send reset link";
      toast.error(message);
    } finally {
      setResettingUserId(null);
    }
  };

  const handleResetSchoolPassword = async () => {
    const resetEmail = school.school_email ?? school.principal_email;

    if (!resetEmail) {
      toast.error("No school admin email is configured.");
      return;
    }

    try {
      setResettingSchoolPassword(true);
      await apiRequest("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: resetEmail })
      });
      toast.success("Reset link sent to the school admin email.");
    } catch (error) {
      const message = error && typeof error === "object" && "message" in error ? String(error.message) : "Failed to send reset link";
      toast.error(message);
    } finally {
      setResettingSchoolPassword(false);
    }
  };

  return (
    <SuperAdminLayout
      title={school.name}
    >
      <div className="rounded-xl border border-border bg-card p-5 mb-5 shadow-sm">
        <div className="flex flex-wrap gap-4 items-start justify-between">
          <div className="flex gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-xl bg-amber-100 text-amber-800 font-bold text-lg">
              {school.name.split(" ").map(p => p[0]).join("").slice(0, 2)}
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">{school.name}</h2>
              <p className="text-sm text-muted-foreground">{location}</p>
              <div className="flex gap-2 mt-2 items-center flex-wrap">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${planBadgeClass(planName)}`}>{planName}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${statusBadgeClass(school.status ?? "")}`}>{school.status ?? "—"}</span>
              {school.status === "suspended" && (
                <span className="rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[10px] font-semibold">Suspended</span>
              )}
            </div>
          </div>
        </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={openEdit} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">Edit</button>
            <button
              type="button"
              onClick={handleResetSchoolPassword}
              disabled={resettingSchoolPassword || !(school.school_email ?? school.principal_email)}
              className="rounded-lg border border-amber-300 bg-amber-50 text-amber-800 px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
            >
              {resettingSchoolPassword ? "Sending..." : "Reset School Password"}
            </button>
            {school.status === "suspended" ? (
              <button type="button" onClick={() => handleStatusAction("activate")} className="rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 px-3 py-1.5 text-xs font-semibold">Activate</button>
            ) : (
              <button type="button" onClick={() => handleStatusAction("suspend")} className="rounded-lg border border-destructive/40 text-destructive px-3 py-1.5 text-xs font-semibold">Suspend</button>
            )}
          </div>
        </div>
      </div>

      <PageTabs tabs={["Overview", "Modules", "Billing", "Users", "Audit Log"]} active={tab} onChange={setTab} />

      {tab === "Overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold mb-3">School Information</h3>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {[
                ["Country", school.country ?? "—"],
                ["Province", school.province ?? "—"],
                ["District", school.district ?? "—"],
                ["Sector", school.sector ?? "—"],
                ["Admin Email", school.school_email ?? school.principal_email ?? "—"],
                ["School Phone", school.school_phone ?? school.principal_phone ?? "—"],
              ].map(([k, v]) => (
                <div key={k}><dt className="text-muted-foreground text-xs">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
            </dl>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold mb-3">Usage Metrics</h3>
            {overviewLoading ? (
              <div className="grid grid-cols-2 gap-3 text-center">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-lg bg-muted/30 p-3">
                    <Skeleton className="h-6 w-16 mx-auto" />
                    <Skeleton className="mt-2 h-3 w-20 mx-auto" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-center">
                {[
                  ["Students", studentCount],
                  ["Staff", staffCount],
                  ["Classes", classCount],
                  ["SMS (month)", smsMonth],
                ].map(([l, v]) => (
                  <div key={l as string} className="rounded-lg bg-muted/30 p-3">
                    <div className="text-2xl font-bold">{v}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">{l}</div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs font-semibold mt-4 mb-2">Attendance (30 days)</p>
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={ATTENDANCE_SPARK}>
                <Tooltip />
                <Line type="monotone" dataKey="rate" stroke="#3b5998" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold mb-2">Feature flags enabled</h3>
            <div className="flex flex-wrap gap-2">
              {enabledModules.length ? enabledModules.map(m => (
                <span key={m.key} className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-semibold capitalize">{m.label}</span>
              )) : <span className="text-sm text-muted-foreground">Core only</span>}
            </div>
          </div>
        </div>
      )}

      {tab === "Modules" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SCHOOL_MODULES.map(m => (
              <div key={m.key} className="rounded-xl border border-border bg-card p-4 flex justify-between items-center">
                <div>
                  <div className="font-semibold text-sm">{m.label}</div>
                  <div className="text-xs text-muted-foreground">{m.description}</div>
                </div>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={moduleState[m.key]}
                    disabled={m.locked}
                    onChange={e => setModuleState(s => ({ ...s, [m.key]: e.target.checked }))}
                  />
                  <span className="text-xs font-medium">{moduleState[m.key] ? "On" : "Off"}</span>
                </label>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleSaveModules}
            disabled={savingModules}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {savingModules ? "Saving..." : "Save changes"}
          </button>
        </div>
      )}

      {tab === "Billing" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold mb-2">Current Subscription</h3>
            {billingLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-72" />
                <Skeleton className="h-3 w-64" />
              </div>
            ) : (
              <>
                <p className="text-sm">
                  {billingPlanName} · Status {billingStatus} · Monthly {formatAmount(billingAmount)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Trial ends: {trialEnds} · Grace ends: {graceEnds}
                </p>
              </>
            )}
            <div className="flex gap-2 mt-3">
              <button type="button" className="text-xs font-semibold text-primary hover:underline">Create manual invoice</button>
              <button type="button" className="text-xs font-semibold text-primary hover:underline">Override renewal</button>
              <button type="button" className="text-xs font-semibold text-primary hover:underline">Apply discount</button>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase"><tr>{["Invoice", "Period", "Amount", "Status"].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
              <tbody>
                {billingLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-4 py-3"><Skeleton className="h-3 w-20" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-3 w-28" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-3 w-16" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-3 w-16" /></td>
                    </tr>
                  ))
                ) : billing?.invoices?.length ? (
                  billing.invoices.map(inv => (
                    <tr key={inv.id} className="border-t border-border">
                      <td className="px-4 py-3 font-mono text-xs">{inv.invoice_number}</td>
                      <td className="px-4 py-3">{formatInvoicePeriod(inv.period_start, inv.period_end)}</td>
                      <td className="px-4 py-3">{formatAmount(inv.total)}</td>
                      <td className="px-4 py-3 capitalize">{inv.status}</td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-border">
                    <td className="px-4 py-6 text-center text-muted-foreground" colSpan={4}>No invoices yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "Users" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase"><tr>{["Name", "Role", "Email", "Last Login", "Status", ""].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
            <tbody>
              {usersLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-4 py-3"><Skeleton className="h-3 w-28" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-3 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-3 w-32" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-3 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-3 w-16" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-3 w-24" /></td>
                  </tr>
                ))
              ) : users.length ? (
                users.map(u => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3">{u.role ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">{u.email ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">{formatDateTime(u.last_login_at)}</td>
                    <td className="px-4 py-3 capitalize">{u.status ?? "—"}</td>
                    <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleResetPassword(u)}
                        disabled={!u.email || resettingUserId === u.id}
                        className="text-xs text-primary font-semibold hover:underline disabled:opacity-50"
                      >
                        {resettingUserId === u.id ? "Sending..." : "Reset Password"}
                      </button>
                      <button type="button" className="text-xs text-destructive font-semibold hover:underline">Deactivate</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-border">
                  <td className="px-4 py-6 text-center text-muted-foreground" colSpan={6}>No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Audit Log" && (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {auditLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-5 py-3 text-sm flex justify-between gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-56" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-3 w-24" />
              </div>
            ))
          ) : auditLogs.length ? (
            auditLogs.map((e) => (
              <div key={e.id} className="px-5 py-3 text-sm flex justify-between gap-4">
                <div>
                  <div className="font-medium">{e.action}</div>
                  <div className="text-xs text-muted-foreground">{e.actor_name ?? e.actor_type ?? "System"}</div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0">{formatDateTime(e.created_at)}</div>
              </div>
            ))
          ) : (
            <div className="px-5 py-6 text-sm text-muted-foreground">No audit log entries yet.</div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={statusActionOpen}
        onClose={() => setStatusActionOpen(false)}
        onConfirm={handleConfirmStatusAction}
        title={statusAction === "suspend" ? "Suspend school?" : "Activate school?"}
        description={statusAction === "suspend"
          ? "School admins will lose access until reactivated."
          : "School will regain access when activated."}
        confirmLabel={statusAction === "suspend" ? "Suspend" : "Activate"}
        destructive={statusAction === "suspend"}
      />

      <SaModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit School"
        wide
        footer={
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setEditOpen(false)} className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancel</button>
            <button type="button" disabled={saving} onClick={handleUpdateSchool} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold disabled:opacity-60">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        }
      >
        {editForm && (
          <div className="grid grid-cols-2 gap-3">
            <SaInput label="School Name *" value={editForm.name} onChange={e => setEditForm(s => s ? { ...s, name: e.target.value } : s)} className="col-span-2" />
            <SaSelect label="School Type" value={editForm.school_type} onChange={e => setEditForm(s => s ? { ...s, school_type: e.target.value } : s)}>
              {SCHOOL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </SaSelect>
            <SaSelect label="Status" value={editForm.status} onChange={e => setEditForm(s => s ? { ...s, status: e.target.value } : s)}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </SaSelect>
            <SaCountrySelect
              label="Country"
              value={editForm.country}
              onChange={v => setEditForm(s => s ? { ...s, country: v } : s)}
              onTimezoneChange={tz => setEditForm(s => s ? { ...s, timezone: tz } : s)}
              onCurrencyChange={currency => setEditForm(s => s ? { ...s, currency } : s)}
            />
            <SaInput label="Province *" value={editForm.province} onChange={e => setEditForm(s => s ? { ...s, province: e.target.value } : s)} />
            <SaInput label="District *" value={editForm.district} onChange={e => setEditForm(s => s ? { ...s, district: e.target.value } : s)} />
            <SaInput label="Sector" value={editForm.sector} onChange={e => setEditForm(s => s ? { ...s, sector: e.target.value } : s)} />
            <SaSelect label="Plan" value={editForm.subscription_plan_id} onChange={e => setEditForm(s => s ? { ...s, subscription_plan_id: e.target.value } : s)}>
              <option value="">No plan</option>
              {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </SaSelect>
            <SaInput label="Admin Email" value={editForm.school_email} onChange={e => setEditForm(s => s ? { ...s, school_email: e.target.value } : s)} required />
            <SaPhoneInput
              label="School Phone"
              value={editForm.school_phone}
              onChange={v => setEditForm(s => s ? { ...s, school_phone: v } : s)}
              defaultCountryName={editForm.country}
              required
              error={Boolean(editFormErrors.school_phone)}
            />
            <SaInput label="Timezone" value={editForm.timezone} onChange={e => setEditForm(s => s ? { ...s, timezone: e.target.value } : s)} />
            <SaInput label="Currency" value={editForm.currency} onChange={e => setEditForm(s => s ? { ...s, currency: e.target.value } : s)} />

            <div className="col-span-2">
              <div className="text-xs font-semibold mb-2">Modules</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["has_boarding", "Boarding"],
                  ["has_biometrics", "Biometrics"],
                  ["has_gate", "Gate"],
                  ["has_visitor_mgmt", "Visitor Mgmt"],
                  ["has_exam_system", "Exam"],
                  ["has_salary_mgmt", "Salary"],
                  ["has_parent_app", "Parent App"],
                  ["has_bulk_sms", "Bulk SMS"],
                ].map(([key, label]) => (
                  <label key={key as string} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm[key as keyof SchoolFormState] as boolean}
                      onChange={e => setEditForm(s => s ? { ...s, [key]: e.target.checked } : s)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </SaModal>
    </SuperAdminLayout>
  );
}

function SchoolDetailSkeleton() {
  return (
    <>
      <div className="rounded-xl border border-border bg-card p-5 mb-5 shadow-sm">
        <div className="flex flex-wrap gap-4 items-start justify-between">
          <div className="flex gap-4 items-center">
            <Skeleton className="h-16 w-16 rounded-xl" />
            <div>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="mt-2 h-4 w-40" />
              <div className="flex gap-2 mt-2">
                <Skeleton className="h-4 w-20 rounded-full" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border mb-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24" />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-border bg-card p-5">
          <Skeleton className="h-4 w-40" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <Skeleton className="h-4 w-36" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
          <Skeleton className="mt-4 h-3 w-32" />
          <Skeleton className="mt-2 h-12 w-full" />
        </div>
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <Skeleton className="h-4 w-40" />
          <div className="mt-3 flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-20 rounded-full" />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
