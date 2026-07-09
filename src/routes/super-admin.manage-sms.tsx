import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { SuperAdminBreadcrumbs } from "@/components/layout/SuperAdminBreadcrumbs";
import { SaInput } from "@/components/super-admin/ui";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/super-admin/manage-sms")({
  component: ManageSmsPage,
});

function ManageSmsPage() {
  const [templateName, setTemplateName] = useState("Attendance SMS Template");
  const [messageBody, setMessageBody] = useState(
    "Education Care\nAttendance: ${student_name} has checked in at ${time}.\nDate : 01/01/2026\nThank you for staying connected."
  );
  const [activeLanguage, setActiveLanguage] = useState("English");

  const previewText = useMemo(() => {
    return messageBody
      .replaceAll("${student_name}", "Jane Doe")
      .replaceAll("${time}", "08:30");
  }, [messageBody]);

  const handleSave = () => {
    toast.success("SMS template updated");
  };

  return (
    <SuperAdminLayout
      title="Manage SMS"
      subtitle="Customize attendance SMS text and placeholders"
      breadcrumbs={
        <SuperAdminBreadcrumbs
          items={[
            { label: "Super Admin", to: "/super-admin" },
            { label: "Manage SMS" },
          ]}
        />
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-3 mb-6">
            <h2 className="text-lg font-semibold">Attendance SMS Template</h2>
            <p className="text-sm text-muted-foreground">
              Super-admins can review and customize the attendance SMS copy. Preserve the student placeholders below and keep the date example format visible.
            </p>
          </div>

          <div className="grid gap-4">
            <SaInput
              label="Template name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />

            <div>
              <label className="block text-xs font-semibold mb-1.5 text-foreground">Template body</label>
              <Textarea
                rows={8}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                className="min-h-[190px]"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Use <span className="font-mono">${"{student_name}"}</span> and <span className="font-mono">${"{time}"}</span> to keep the student name and time placeholders intact.
                Example date format: <span className="font-semibold">Date : 01/01/2026</span>.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Save template
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-sm font-semibold mb-3">Placeholders</h3>
            <div className="grid gap-3 text-sm">
              <div className="rounded-lg border border-border bg-background p-3">
                <div className="font-medium">${"{student_name}"}</div>
                <div className="text-muted-foreground text-xs">Inserts the full student name in the message.</div>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <div className="font-medium">${"{time}"}</div>
                <div className="text-muted-foreground text-xs">Inserts the attendance event time.</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold">Live preview</h3>
                <p className="text-xs text-muted-foreground">Rendered preview with example placeholders.</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                {activeLanguage}
              </span>
            </div>
            <div className="whitespace-pre-wrap rounded-xl border border-border bg-muted/50 p-4 text-sm leading-relaxed text-foreground">
              {previewText}
            </div>
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
