import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { SuperAdminBreadcrumbs } from "@/components/layout/SuperAdminBreadcrumbs";
import { getNotificationTemplates } from "@/lib/template-api";
import { SMS_TRIGGER_TYPES } from "./-super-admin.manage-sms.common";
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

  useEffect(() => {
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
          <h2 className="text-lg font-semibold">Pick an SMS category</h2>
          <p className="text-sm text-muted-foreground">Each attendance SMS type has its own settings page.</p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {SMS_TRIGGER_TYPES.map((type) => (
            <Link
              key={type.value}
              to={`/super-admin/manage-sms/${type.value.replace(/_/g, "-")}`}
              className="rounded-3xl border border-border bg-background p-6 transition hover:border-primary/80 hover:bg-muted/75"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{type.label}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">Manage SMS templates for {type.label.toLowerCase()} attendance.</p>
                </div>
                <div className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {loading ? "..." : `${templateCounts[type.value] ?? 0} templates`}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </SuperAdminLayout>
  );
}
