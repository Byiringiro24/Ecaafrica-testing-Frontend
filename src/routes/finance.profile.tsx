import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import { FinanceLayout } from "@/components/layout/FinanceLayout";
import { useCurrentUser, formatRole } from "@/hooks/useCurrentUser";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/finance/profile")({ component: FinanceProfilePage });

function FinanceProfilePage() {
  const cachedUser = useCurrentUser();
  const [user, setUser] = useState(cachedUser);

  useEffect(() => {
    apiRequest<typeof cachedUser>("/auth/me", { auth: "school" }).then(setUser).catch(() => undefined);
  }, []);

  const current = user ?? cachedUser;

  return (
    <FinanceLayout title="View Profile" subtitle="Your finance account and school assignment">
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
              {current?.name?.slice(0, 2).toUpperCase() ?? "FO"}
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">{current?.name ?? "Finance Officer"}</h2>
              <p className="text-sm text-muted-foreground">{current?.role ? formatRole(current.role) : "Finance Officer"}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border border-border bg-card p-6 md:grid-cols-2">
          <ProfileField icon={Mail} label="Email" value={current?.email ?? "Not provided"} />
          <ProfileField icon={Phone} label="Phone" value={current?.phone ?? "Not provided"} />
          <ProfileField icon={ShieldCheck} label="Privilege" value="Finance access only" />
          <ProfileField icon={UserRound} label="School" value={current?.school_name ?? "Assigned school"} />
        </section>
      </div>
    </FinanceLayout>
  );
}

function ProfileField({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}
