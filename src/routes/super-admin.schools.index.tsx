import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy, Grid3X3, List, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { SuperAdminBreadcrumbs } from "@/components/layout/SuperAdminBreadcrumbs";
import {
  SaModal, SaInput, SaSelect, FilterBar, ConfirmDialog, Pagination,
} from "@/components/super-admin/ui";
import {
  MOCK_PLATFORM_SCHOOLS,
  ONBOARDING_MODULES,
  genTempPassword,
  planBadgeClass,
  statusBadgeClass,
  type PlatformSchool,
} from "@/lib/superAdminMockData";
import { formatRWF, PLAN_OPTIONS } from "@/lib/mockData";

export const Route = createFileRoute("/super-admin/schools/")({
  component: SchoolsPage,
});

const PLANS = ["All", "Starter", "Professional", "Enterprise", "Trial"];
const STATUSES = ["All", "active", "trial", "suspended", "expired", "grace"];
const PROVINCES = ["All", "Kigali City", "Eastern", "Western", "Northern", "Southern"];

function SchoolsPage() {
  const [view, setView] = useState<"grid" | "table">("grid");
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState("All");
  const [status, setStatus] = useState("All");
  const [province, setProvince] = useState("All");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<PlatformSchool | null>(null);

  const filtered = useMemo(() => {
    let rows = [...MOCK_PLATFORM_SCHOOLS];
    if (q) rows = rows.filter(s => s.name.toLowerCase().includes(q.toLowerCase()));
    if (plan !== "All") rows = rows.filter(s => s.plan === plan);
    if (status !== "All") rows = rows.filter(s => s.status === status);
    if (province !== "All") rows = rows.filter(s => s.province === province);
    rows.sort((a, b) => {
      if (sort === "students") return b.students - a.students;
      if (sort === "renewal") return a.renewal.localeCompare(b.renewal);
      return a.name.localeCompare(b.name);
    });
    return rows;
  }, [q, plan, status, province, sort]);

  const stats = {
    total: MOCK_PLATFORM_SCHOOLS.length,
    active: MOCK_PLATFORM_SCHOOLS.filter(s => s.status === "active").length,
    trial: MOCK_PLATFORM_SCHOOLS.filter(s => s.status === "trial").length,
    suspended: MOCK_PLATFORM_SCHOOLS.filter(s => s.status === "suspended" || s.status === "expired").length,
  };

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <SuperAdminLayout
      title="Schools"
      subtitle="Onboard and manage tenant schools"
      breadcrumbs={
        <SuperAdminBreadcrumbs items={[{ label: "Super Admin", to: "/super-admin" }, { label: "Schools" }]} />
      }
    >
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div className="flex flex-wrap gap-2 text-xs">
          {([["Total", stats.total], ["Active", stats.active], ["Trial", stats.trial], ["Suspended", stats.suspended]] as const).map(([l, v]) => (
            <span key={l} className="rounded-full bg-muted px-3 py-1 font-semibold">
              {l}: <span className="text-foreground">{v}</span>
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setOnboardOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" /> Onboard New School
        </button>
      </div>

      <FilterBar>
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setPage(1); }}
          placeholder="Search schools..."
          className="h-10 flex-1 min-w-[200px] rounded-lg border border-border bg-background px-3 text-sm"
        />
        <select value={plan} onChange={e => setPlan(e.target.value)} className="h-10 rounded-lg border border-border px-3 text-sm">
          {PLANS.map(p => <option key={p}>{p}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="h-10 rounded-lg border border-border px-3 text-sm">
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={province} onChange={e => setProvince(e.target.value)} className="h-10 rounded-lg border border-border px-3 text-sm">
          {PROVINCES.map(p => <option key={p}>{p}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)} className="h-10 rounded-lg border border-border px-3 text-sm">
          <option value="name">Sort: Name</option>
          <option value="students">Sort: Students</option>
          <option value="renewal">Sort: Renewal</option>
        </select>
        <div className="flex rounded-lg border border-border overflow-hidden ml-auto">
          <button type="button" onClick={() => setView("grid")} className={`p-2 ${view === "grid" ? "bg-primary text-primary-foreground" : ""}`}><Grid3X3 className="h-4 w-4" /></button>
          <button type="button" onClick={() => setView("table")} className={`p-2 ${view === "table" ? "bg-primary text-primary-foreground" : ""}`}><List className="h-4 w-4" /></button>
        </div>
      </FilterBar>

      {view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginated.map(s => (
            <SchoolCard key={s.id} school={s} onSuspend={() => setSuspendTarget(s)} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  {["", "Name", "Location", "Plan", "Status", "Students", "Staff", "Renewal", "MRR", ""].map(h => (
                    <th key={h} className="text-left px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(s => (
                  <tr key={s.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-amber-100 text-amber-800 font-bold text-xs">
                        {s.name.split(" ").map(p => p[0]).join("").slice(0, 2)}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.location}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${planBadgeClass(s.plan)}`}>{s.plan}</span></td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${statusBadgeClass(s.status)}`}>{s.status}</span></td>
                    <td className="px-4 py-3">{s.students}</td>
                    <td className="px-4 py-3">{s.staff}</td>
                    <td className="px-4 py-3 text-xs">{s.renewal}</td>
                    <td className="px-4 py-3 font-mono text-xs">{formatRWF(s.mrrRwf)}</td>
                    <td className="px-4 py-3 whitespace-nowrap space-x-2">
                      <Link to="/super-admin/schools/$id" params={{ id: s.id }} className="text-xs font-semibold text-primary hover:underline">View</Link>
                      <button type="button" onClick={() => setSuspendTarget(s)} className="text-xs text-destructive hover:underline">Suspend</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={filtered.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={n => { setPageSize(n); setPage(1); }} />
        </div>
      )}

      {view === "grid" && (
        <div className="mt-4">
          <Pagination total={filtered.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={n => { setPageSize(n); setPage(1); }} />
        </div>
      )}

      {onboardOpen && <OnboardModal onClose={() => setOnboardOpen(false)} />}
      <ConfirmDialog
        open={!!suspendTarget}
        onClose={() => setSuspendTarget(null)}
        onConfirm={() => toast.success(`${suspendTarget?.name} suspended`)}
        title="Suspend school?"
        description={`This will restrict access for ${suspendTarget?.name}. You can reactivate later.`}
        confirmLabel="Suspend"
        destructive
      />
    </SuperAdminLayout>
  );
}

function SchoolCard({ school: s, onSuspend }: { school: PlatformSchool; onSuspend: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-lg bg-amber-100 text-amber-800 font-bold">{s.name.split(" ").map(p => p[0]).join("").slice(0, 2)}</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate">{s.name}</div>
          <div className="text-xs text-muted-foreground">{s.location}</div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${statusBadgeClass(s.status)}`}>{s.status}</span>
      </div>
      <div className="flex gap-2 mt-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${planBadgeClass(s.plan)}`}>{s.plan}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
        <div><span className="text-muted-foreground text-xs">Students</span><div className="font-bold">{s.students}</div></div>
        <div><span className="text-muted-foreground text-xs">Renewal</span><div className="font-medium text-xs">{s.renewal}</div></div>
        <div><span className="text-muted-foreground text-xs">SMS used</span><div className="font-medium">{s.smsUsed}</div></div>
        <div><span className="text-muted-foreground text-xs">Staff</span><div className="font-medium">{s.staff}</div></div>
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        <Link to="/super-admin/schools/$id" params={{ id: s.id }} className="flex-1 text-center rounded-lg bg-primary text-primary-foreground px-2 py-1.5 text-xs font-semibold">View</Link>
        <button type="button" className="rounded-lg border border-border px-2 py-1.5 text-xs font-semibold">Edit</button>
        <button type="button" onClick={onSuspend} className="rounded-lg border border-destructive/30 text-destructive px-2 py-1.5 text-xs font-semibold">Suspend</button>
        <button type="button" className="rounded-lg border border-border px-2 py-1.5 text-xs font-semibold">Contact</button>
      </div>
    </div>
  );
}

function OnboardModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [tempPw, setTempPw] = useState(() => genTempPassword());
  const [copied, setCopied] = useState(false);
  const [modules, setModules] = useState<Record<string, boolean>>({ core: true });
  const [selectedPlan, setSelectedPlan] = useState("professional");
  const [success, setSuccess] = useState(false);

  const addonTotal = ONBOARDING_MODULES.filter(m => modules[m.key]).reduce((s, m) => s + m.price, 0);
  const base = PLAN_OPTIONS.find(p => p.id === selectedPlan)?.monthly ?? 45000;

  if (success) {
    return (
      <SaModal open title="School created" onClose={onClose}>
        <div className="text-center py-8">
          <div className="text-5xl mb-4">🎉</div>
          <h4 className="font-display text-xl font-bold text-emerald-700">School created successfully!</h4>
          <Link to="/super-admin/schools/$id" params={{ id: "SCH001" }} className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
            View school profile →
          </Link>
        </div>
      </SaModal>
    );
  }

  return (
    <SaModal
      open
      onClose={onClose}
      title="Onboard New School"
      subtitle={`Step ${step} of 5`}
      wide
      footer={
        <div className="flex justify-between">
          <button type="button" onClick={() => (step > 1 ? setStep(step - 1) : onClose())} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">
            {step === 1 ? "Cancel" : "Back"}
          </button>
          {step < 5 ? (
            <button type="button" onClick={() => setStep(step + 1)} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">Next →</button>
          ) : (
            <button type="button" onClick={() => setSuccess(true)} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">Create School</button>
          )}
        </div>
      }
    >
      <div className="h-1 bg-muted rounded-full overflow-hidden mb-5"><div className="h-full bg-amber-500 transition-all" style={{ width: `${step * 20}%` }} /></div>
      {step === 1 && (
        <div className="grid grid-cols-2 gap-3">
          <SaInput label="School Name *" />
          <SaSelect label="School Type"><option>Government</option><option>Private</option><option>International</option><option>Technical</option><option>Seminary</option></SaSelect>
          <SaSelect label="Province"><option>Kigali City</option><option>Eastern</option><option>Western</option><option>Northern</option><option>Southern</option></SaSelect>
          <SaInput label="District" />
          <SaInput label="Sector" />
          <SaInput label="Physical Address" className="col-span-2" />
          <SaInput label="RNE Registration Number" />
          <SaInput label="Founded Year" type="number" />
        </div>
      )}
      {step === 2 && (
        <div className="grid grid-cols-2 gap-3">
          <SaInput label="Principal Name *" />
          <SaInput label="Principal Phone *" />
          <SaInput label="Principal Email *" />
          <SaInput label="School Phone" />
          <SaInput label="School Email" />
          <SaInput label="School Website" />
          <SaInput label="Admin Name *" />
          <SaInput label="Admin Email *" />
          <div className="col-span-2">
            <label className="block text-xs font-semibold mb-1.5">Temporary Password (auto-generated)</label>
            <div className="flex gap-2">
              <input readOnly value={tempPw} className="h-10 flex-1 rounded-lg border border-border bg-muted/30 px-3 text-sm font-mono" />
              <button type="button" onClick={() => { navigator.clipboard.writeText(tempPw); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="h-10 px-3 rounded-lg border border-border">
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </button>
              <button type="button" onClick={() => setTempPw(genTempPassword())} className="text-xs font-semibold text-primary">Regenerate</button>
            </div>
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {PLAN_OPTIONS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPlan(p.id)}
                className={`rounded-xl border-2 p-4 text-left transition-colors ${selectedPlan === p.id ? "border-amber-500 bg-amber-50" : "border-border"}`}
              >
                <div className="font-bold">{p.name}</div>
                <div className="text-xl font-bold text-amber-700 mt-1">{p.monthly.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">RWF/mo</span></div>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SaSelect label="Billing Cycle"><option>Monthly</option><option>Annual (save 10%)</option></SaSelect>
            <SaInput label="Start Date" type="date" defaultValue="2026-05-21" />
            <SaSelect label="Trial Period"><option>None</option><option>14 days</option><option>30 days</option></SaSelect>
            <SaInput label="Promo Code (optional)" />
          </div>
          <div className="rounded-lg bg-muted/40 p-3 text-sm">Estimated MRR: <strong>{formatRWF(base + addonTotal)}</strong></div>
        </div>
      )}
      {step === 4 && (
        <div className="space-y-2">
          {ONBOARDING_MODULES.map(m => (
            <label key={m.key} className={`flex items-start gap-3 rounded-lg border p-3 ${m.included ? "opacity-70" : ""}`}>
              <input
                type="checkbox"
                checked={!!modules[m.key]}
                disabled={m.included}
                onChange={e => setModules(prev => ({ ...prev, [m.key]: e.target.checked }))}
                className="mt-1"
              />
              <div>
                <div className="font-semibold text-sm">{m.label}</div>
                <div className="text-xs text-muted-foreground">{m.desc}{m.price > 0 && ` (+${m.price.toLocaleString()} RWF/mo)`}</div>
              </div>
            </label>
          ))}
          <div className="text-sm font-semibold pt-2">Add-ons: {formatRWF(addonTotal)} · Total MRR: {formatRWF(base + addonTotal)}</div>
        </div>
      )}
      {step === 5 && (
        <div className="space-y-3 text-sm">
          <p>Review all entered details before creating the school tenant.</p>
          <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Send Welcome Email to Principal</label>
          <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Send Setup Instructions to Admin</label>
        </div>
      )}
    </SaModal>
  );
}
