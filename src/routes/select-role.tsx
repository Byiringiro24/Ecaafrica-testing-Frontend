import { createFileRoute, redirect } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { getAvailableRoles, getSchoolAuth, roleHome, switchRole } from "@/lib/schoolAuth";

export const Route = createFileRoute("/select-role")({
  validateSearch: (search) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: ({ location }) => {
    if (!getSchoolAuth()?.accessToken) {
      throw redirect({ to: "/login", search: { redirect: location.pathname } });
    }
  },
  component: RoleSelectionPage,
});

const ROLE_LABELS: Record<string, string> = {
  school_admin: "School Admin",
  director_of_discipline: "Director of Discipline",
  director_of_studies: "Director of Studies",
  teacher: "Teacher",
  patron: "Patron",
  matron: "Matron",
  gate_keeper: "Gate Keeper",
  finance_officer: "Finance Officer",
  staff: "Staff",
};

const label = (role: string) => ROLE_LABELS[role] ?? role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function RoleSelectionPage() {
  const { redirect } = Route.useSearch();
  const auth = getSchoolAuth();
  const roles = getAvailableRoles();

  const choose = (role: string) => {
    switchRole(role);
    window.location.replace(redirect || roleHome(role));
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Choose workspace</p>
          <h1 className="mt-2 font-display text-2xl font-bold">Where would you like to work?</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This account has more than one role. You can switch workspaces later without signing out.
          </p>
        </div>
        <div className="space-y-3">
          {roles.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => choose(role)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-4 py-4 text-left transition hover:border-primary hover:bg-primary/5"
            >
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span className="flex-1 font-semibold">{label(role)}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
        {!auth?.user && <p className="mt-4 text-xs text-muted-foreground">Loading account…</p>}
      </section>
    </main>
  );
}
