import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { teacherRouteGuard } from "@/lib/schoolAuth";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/teacher/settings")({
  beforeLoad: ({ location }) => teacherRouteGuard(location),
  component: TeacherSettingsPage,
});

function TeacherSettingsPage() {
  const user = useCurrentUser();
  const [sendingReset, setSendingReset] = useState(false);

  const sendResetLink = async () => {
    if (!user?.email) {
      toast.error("No email is linked to this account");
      return;
    }

    setSendingReset(true);
    try {
      await apiRequest("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: user.email }),
        auth: "none",
      });
      toast.success("Password reset link sent to your email");
    } catch (error: any) {
      toast.error(error?.message ?? "Unable to send password reset link");
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <TeacherLayout title="Account Settings" subtitle="Manage your teacher account and security preferences">
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary"><UserRound className="h-5 w-5" /></div>
            <div>
              <h2 className="font-display text-lg font-bold">Account information</h2>
              <p className="mt-1 text-sm text-muted-foreground">Your account details used to access the teacher dashboard.</p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <SettingValue label="Name" value={user?.name ?? "Teacher"} />
            <SettingValue label="Role" value="Teacher" />
            <SettingValue label="Email" value={user?.email ?? "Not available"} />
            <SettingValue label="Phone" value={user?.phone ?? "Not available"} />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <h2 className="font-display text-lg font-bold">Security</h2>
              <p className="mt-1 text-sm text-muted-foreground">Keep your account secure by updating your password regularly.</p>
            </div>
          </div>
          <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="text-sm font-semibold">Reset your password</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  We’ll send a secure reset link to {user?.email ?? "your account email"}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void sendResetLink()}
                disabled={sendingReset || !user?.email}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LockKeyhole className="h-4 w-4" />
                {sendingReset ? "Sending…" : "Send reset link"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </TeacherLayout>
  );
}

function SettingValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 flex h-10 items-center rounded-md bg-muted px-3 text-sm">{value}</div>
    </div>
  );
}
