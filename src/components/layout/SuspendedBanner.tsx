/**
 * SuspendedBanner — shown at the top of every school portal when school status is suspended/expired/cancelled.
 * Reads school_status from the current user (comes from /auth/me → school.status).
 */
import { AlertTriangle } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const SUSPENDED_STATUSES = ["suspended", "expired", "cancelled"];

const STATUS_LABELS: Record<string, { label: string; message: string; color: string }> = {
  suspended: {
    label: "SUSPENDED",
    message: "This school account has been suspended. Contact the platform administrator to restore access.",
    color: "border-rose-400 bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-700",
  },
  expired: {
    label: "SUBSCRIPTION EXPIRED",
    message: "This school's subscription has expired. Renew your plan to continue using EcaAfrica.",
    color: "border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-700",
  },
  cancelled: {
    label: "ACCOUNT CANCELLED",
    message: "This school account has been cancelled. Contact the platform administrator for assistance.",
    color: "border-rose-400 bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-700",
  },
};

export function SuspendedBanner() {
  const user = useCurrentUser();
  const status = user?.school_status?.toLowerCase();

  if (!status || !SUSPENDED_STATUSES.includes(status)) return null;

  const cfg = STATUS_LABELS[status] ?? STATUS_LABELS.suspended;

  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 mb-4 ${cfg.color}`}>
      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
      <div>
        <p className="font-bold text-sm">{cfg.label}</p>
        <p className="text-sm mt-0.5">{cfg.message}</p>
      </div>
    </div>
  );
}
