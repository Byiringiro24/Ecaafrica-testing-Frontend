import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckCircle2, Clock, ThumbsUp, ThumbsDown } from "lucide-react";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { SuperAdminBreadcrumbs } from "@/components/layout/SuperAdminBreadcrumbs";
import { getNotificationTemplates } from "@/lib/template-api";
import { SMS_TRIGGER_TYPES } from "./-super-admin.manage-sms.common";
import { apiRequest } from "@/lib/api";
import type { NotificationTemplate } from "@/lib/template-api";

const normalizeTemplates = (value: unknown) => {
  if (Array.isArray(value)) return value as NotificationTemplate[];
  if (value && typeof value === "object" && Array.isArray((value as { data?: unknown }).data)) {
    return (value as { data: NotificationTemplate[] }).data;
  }
  return [] as NotificationTemplate[];
};

export const Route = createFileRoute("/super-admin/manage-sms/")({
  component: ManageSmsIndexPage
});

function ManageSmsIndexPage() {
  const [templateCounts, setTemplateCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [pending,    setPending]    = useState<Array<{ id: string; name: string; trigger_type: string; body_en: string; school_name: string | null; created_at: string }>>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);

  const loadPending = async () => {
    setPendingLoading(true);
    try {
      const res = await apiRequest<any>("/notifications/templates/pending", { auth: "platform" });
      const list = Array.isArray(res) ? res : (res as any)?.data ?? [];
      setPending(list);
    } catch { /* ignore */ }
    finally { setPendingLoading(false); }
  };

  const approveOrReject = async (id: string, action: "approve" | "reject") => {
    setActioning(id);
    try {
      await apiRequest(`/notifications/templates/${id}/${action}`, { method: "PATCH", auth: "platform" });
      toast.success(action === "approve" ? "Template approved and now active" : "Template rejected");
      setPending(p => p.filter(t => t.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${action} failed`);
    } finally { setActioning(null); }
  };

  useEffect(() => {
    void loadPending();
    const loadTemplates = async () => {
      setLoading(true);
      try {
        const response = await getNotificationTemplates({ limit: 1000 });
        const templates = normalizeTemplates(response);
        const counts = SMS_TRIGGER_TYPES.reduce<Record<string, number>>((acc, type) => {
          acc[type.value] = templates.filter((template) => template.trigger_type === type.value).length;
          return acc;
        }, {});
        setTemplateCounts(counts);
      } catch (error) {
        console.error("Failed to load SMS template counts:", error);
        toast.error("Failed to load SMS template counts");
      } finally {
        setLoading(false);
      }
    };
    void loadTemplates();
  }, []);

  return (
    <SuperAdminLayout
      title="Manage SMS"
      subtitle="Customize attendance SMS text and placeholders"
      breadcrumbs={
        <SuperAdminBreadcrumbs
          items={[
            { label: "Super Admin", to: "/super-admin" },
            { label: "Manage SMS" }
          ]}
        />
      }
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Registered attendance message catalog</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            System admins register the message text here. Schools can only select a registered message for each attendance source.
            Schools can also submit custom message requests — they appear above for approval.
          </p>
        </div>

        {/* ── Pending school approval requests ─────────────────────────── */}
        {(pendingLoading || pending.length > 0) && (
          <div className="rounded-xl border border-amber-300/60 bg-amber-50/60 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 border-b border-amber-300/60 px-5 py-3 bg-amber-100/60">
              <Clock className="h-4 w-4 text-amber-700" />
              <h2 className="font-semibold text-sm text-amber-800">
                Pending approval — school custom messages
                {pending.length > 0 && <span className="ml-2 rounded-full bg-amber-700 text-white text-[10px] px-2 py-0.5">{pending.length}</span>}
              </h2>
            </div>
            {pendingLoading ? (
              <div className="p-5 text-sm text-muted-foreground">Loading…</div>
            ) : (
              <div className="divide-y divide-amber-200/60">
                {pending.map(t => (
                  <div key={t.id} className="px-5 py-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.trigger_type} · {t.school_name ?? "Unknown school"}</p>
                        <p className="mt-1.5 rounded-lg bg-background/80 border border-border p-2.5 text-xs whitespace-pre-wrap">{t.body_en}</p>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <button type="button" disabled={actioning === t.id}
                          onClick={() => void approveOrReject(t.id, "approve")}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                          <ThumbsUp className="h-3.5 w-3.5" /> Approve
                        </button>
                        <button type="button" disabled={actioning === t.id}
                          onClick={() => void approveOrReject(t.id, "reject")}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50">
                          <ThumbsDown className="h-3.5 w-3.5" /> Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-6">
          {Array.from(new Set(SMS_TRIGGER_TYPES.map((type) => type.group))).map((group) => (
            <section key={group} className="space-y-3">
              <div>
                <h2 className="text-base font-semibold">{group}</h2>
                <p className="text-sm text-muted-foreground">Messages available for this attendance model.</p>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                {SMS_TRIGGER_TYPES.filter((type) => type.group === group).map((type) => (
                  <Link
                    key={type.value}
                    to={`/super-admin/manage-sms/${type.value.replace(/_/g, "-")}`}
                    className="rounded-3xl border border-border bg-background p-6 transition hover:border-primary/80 hover:bg-muted/75"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold">{type.label}</h3>
                        <p className="mt-2 text-sm text-muted-foreground">Manage the approved SMS text for {type.label.toLowerCase()} events.</p>
                      </div>
                      <div className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                        {loading ? "..." : `${templateCounts[type.value] ?? 0} templates`}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </SuperAdminLayout>
  );
}
