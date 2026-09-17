import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { FinanceLayout } from "@/components/layout/FinanceLayout";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/finance/settings")({ component: FinanceSettingsPage });

function FinanceSettingsPage() {
  const user = useCurrentUser();
  const [busy, setBusy] = useState(false);

  const sendResetLink = async () => {
    if (!user?.email) {
      toast.error("No email is linked to this account");
      return;
    }
    setBusy(true);
    try {
      await apiRequest("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: user.email }),
        auth: "none",
      });
      toast.success("Password reset link sent to your email");
    } catch (error: any) {
      toast.error(error?.message ?? "Unable to send reset link");
    } finally {
      setBusy(false);
    }
  };

  return (
    <FinanceLayout title="Account Settings" subtitle="Manage your finance account securely">
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-lg font-bold">Password</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Send a secure password reset link to {user?.email ?? "your account email"}.
          </p>
          <button
            type="button"
            disabled={busy || !user?.email}
            onClick={() => void sendResetLink()}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LockKeyhole className="h-4 w-4" />
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </section>

        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
          <h2 className="font-display text-lg font-bold">Access scope</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This account is limited to finance modules for its assigned school. School administration settings are unavailable to finance users.
          </p>
        </section>
      </div>
    </FinanceLayout>
  );
}
