import { FormEvent, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, EyeOff, LockKeyhole, Save, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { SuperAdminBreadcrumbs } from "@/components/layout/SuperAdminBreadcrumbs";
import { apiRequest } from "@/lib/api";
import { getPlatformAuth } from "@/lib/platformAuth";

export const Route = createFileRoute("/super-admin/settings")({ component: SettingsPage });

function SettingsPage() {
  const platformUser = getPlatformAuth()?.user;

  return (
    <SuperAdminLayout
      title="Settings"
      subtitle="Manage your system administrator account and password."
      breadcrumbs={<SuperAdminBreadcrumbs items={[{ label: "Super Admin", to: "/super-admin" }, { label: "Settings" }]} />}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-lg font-bold">Account</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Details for the signed-in system administrator.</p>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</dt>
              <dd className="truncate font-semibold">{platformUser?.name ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</dt>
              <dd className="truncate font-semibold">{platformUser?.email ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</dt>
              <dd className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                <ShieldCheck className="h-3.5 w-3.5" />
                {formatRole(platformUser?.role)}
              </dd>
            </div>
          </dl>
        </section>

        <ChangePasswordCard />
      </div>
    </SuperAdminLayout>
  );
}

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!currentPassword) {
      toast.error("Enter your current password");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("New password must be different from the current password");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setSaving(true);
    try {
      await apiRequest("/auth/platform/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated successfully");
    } catch (error: any) {
      toast.error(error?.message ?? "Unable to change password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <LockKeyhole className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-display text-lg font-bold">Change password</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Use a strong password with at least 8 characters.</p>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <PasswordField
          label="Old password"
          value={currentPassword}
          show={showCurrent}
          onChange={setCurrentPassword}
          onToggle={() => setShowCurrent((value) => !value)}
          placeholder="Enter your current password"
          autoComplete="current-password"
        />
        <PasswordField
          label="New password"
          value={newPassword}
          show={showNew}
          onChange={setNewPassword}
          onToggle={() => setShowNew((value) => !value)}
          placeholder="Enter a new password"
          autoComplete="new-password"
        />
        <PasswordField
          label="Confirm new password"
          value={confirmPassword}
          show={showConfirm}
          onChange={setConfirmPassword}
          onToggle={() => setShowConfirm((value) => !value)}
          placeholder="Re-enter the new password"
          autoComplete="new-password"
        />

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Update password"}
          </button>
        </div>
      </form>
    </section>
  );
}

function PasswordField({
  label,
  value,
  show,
  onChange,
  onToggle,
  placeholder,
  autoComplete
}: {
  label: string;
  value: string;
  show: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
  placeholder: string;
  autoComplete: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-foreground">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="h-10 w-full rounded-lg border border-border bg-background pl-3 pr-11 text-sm outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function formatRole(role?: string | null) {
  if (!role) return "System admin";
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
