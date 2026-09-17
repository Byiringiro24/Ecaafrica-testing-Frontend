import { useEffect, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { SuperAdminBreadcrumbs } from "@/components/layout/SuperAdminBreadcrumbs";
import { SaInput } from "@/components/super-admin/ui";
import { Textarea } from "@/components/ui/textarea";
import {
  getNotificationTemplates,
  createNotificationTemplate,
  updateNotificationTemplate,
  deleteNotificationTemplate,
  renderNotificationTemplate,
  NotificationTemplate,
  TemplateCreateInput
} from "@/lib/template-api";

export const SMS_TRIGGER_TYPES = [
  { value: "school_entry", label: "School Entry", group: "Gate & school" },
  { value: "school_exit", label: "School Exit", group: "Gate & school" },
  { value: "class_entry", label: "Class Present", group: "Classroom" },
  { value: "class_late", label: "Class Late", group: "Classroom" },
  { value: "class_absent", label: "Class Absent", group: "Classroom" },
  { value: "class_excused", label: "Class Excused", group: "Classroom" },
  { value: "dormitory_morning_present", label: "Dormitory Morning Present", group: "Dormitory" },
  { value: "dormitory_morning_absent", label: "Dormitory Morning Absent", group: "Dormitory" },
  { value: "dormitory_morning_on_leave", label: "Dormitory Morning On Leave", group: "Dormitory" },
  { value: "dormitory_evening_present", label: "Dormitory Evening Present", group: "Dormitory" },
  { value: "dormitory_evening_absent", label: "Dormitory Evening Absent", group: "Dormitory" },
  { value: "dormitory_evening_on_leave", label: "Dormitory Evening On Leave", group: "Dormitory" },
  { value: "device_late", label: "Attendance Device Late", group: "Device status" },
  { value: "device_absent", label: "Attendance Device Absent", group: "Device status" }
] as const;

const normalizeTemplates = (value: unknown) => {
  if (Array.isArray(value)) return value as NotificationTemplate[];
  if (value && typeof value === "object" && Array.isArray((value as { data?: unknown }).data)) {
    return (value as { data: NotificationTemplate[] }).data;
  }
  return [] as NotificationTemplate[];
};

const renderTemplateText = (
  body: string,
  variables: Record<string, string | number | boolean> = {}
) =>
  body
    .replace(/\{\{\s*([\w.]+)\s*\}\}|\$\{\s*([\w.]+)\s*\}/g, (_, keyA: string, keyB: string) => {
      const key = keyA ?? keyB;
      const value = variables[key];
      return value !== undefined && value !== null ? String(value) : "";
    })
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/&#x20;|&nbsp;/gi, " ")
    .replace(/&#x0a;|&#10;/gi, "\n")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

const defaultBodies: Record<string, string> = {
  school_entry: "Education Care\nAttendance: Your child, ${student_name}, has arrived safely at school.\nDate: ${date}\nTime: ${time}",
  school_exit: "Education Care\nAttendance: Your child, ${student_name}, has left school safely.\nDate: ${date}\nTime: ${time}",
  class_entry: "Education Care\nAttendance: ${student_name} is present in class.\nDate: ${date}\nTime: ${time}",
  class_late: "Education Care\nAttendance: ${student_name} arrived late to class.\nDate: ${date}\nTime: ${time}",
  class_absent: "Education Care\nAttendance alert: ${student_name} was absent from class.\nDate: ${date}\nTime: ${time}\nPlease follow up with the school.",
  class_excused: "Education Care\nAttendance: ${student_name} was excused from class.\nDate: ${date}\nTime: ${time}",
  dormitory_morning_present: "Education Care\nBoarding attendance: ${student_name} was present during the morning dormitory roll call.\nDate: ${date}\nTime: ${time}",
  dormitory_morning_absent: "Education Care\nBoarding attendance alert: ${student_name} was absent from the morning dormitory roll call.\nDate: ${date}\nTime: ${time}",
  dormitory_morning_on_leave: "Education Care\nBoarding attendance: ${student_name} was recorded on leave during the morning roll call.\nDate: ${date}\nTime: ${time}",
  dormitory_evening_present: "Education Care\nBoarding attendance: ${student_name} was present during the evening dormitory roll call.\nDate: ${date}\nTime: ${time}",
  dormitory_evening_absent: "Education Care\nBoarding attendance alert: ${student_name} was absent from the evening dormitory roll call.\nDate: ${date}\nTime: ${time}",
  dormitory_evening_on_leave: "Education Care\nBoarding attendance: ${student_name} was recorded on leave during the evening roll call.\nDate: ${date}\nTime: ${time}",
  device_late: "Education Care\nAttendance alert: ${student_name} was recorded late.\nDate: ${date}\nTime: ${time}",
  device_absent: "Education Care\nAttendance alert: ${student_name} was not recorded during the configured attendance window.\nDate: ${date}\nTime: ${time}"
};

type ManageSmsTypePageProps = {
  triggerType: string;
  typeLabel: string;
};

export function ManageSmsTypePage({ triggerType, typeLabel }: ManageSmsTypePageProps) {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [messageBodyEn, setMessageBodyEn] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [previewText, setPreviewText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const resetForm = useCallback(() => {
    setTemplateName(`Attendance SMS Template - ${typeLabel.toUpperCase()}`);
    setMessageBodyEn(defaultBodies[triggerType]);
    setIsActive(true);
  }, [triggerType, typeLabel]);

  const populateFormFromTemplate = useCallback((template: NotificationTemplate) => {
    setTemplateName(template.name);
    setMessageBodyEn(template.body_en);
    setIsActive(template.is_active);
  }, []);

  const loadTemplates = useCallback(async () => {
    setLoading(true);

    try {
      const response = await getNotificationTemplates({
        trigger_type: triggerType,
        limit: 100
      });

      const nextTemplates = normalizeTemplates(response);
      setTemplates(nextTemplates);

      if (nextTemplates.length > 0) {
        const firstTemplate = nextTemplates[0];
        setSelectedTemplate(firstTemplate);
        populateFormFromTemplate(firstTemplate);
      } else {
        setSelectedTemplate(null);
        resetForm();
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
      toast.error("Failed to load SMS templates");
    } finally {
      setLoading(false);
    }
  }, [triggerType, populateFormFromTemplate, resetForm]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const generatePreview = useCallback(async () => {
    const body = messageBodyEn;

    if (!body.trim()) {
      setPreviewText("");
      return;
    }

    const variables = {
      student_name: "Jane Doe",
      studentName: "Jane Doe",
      time: "08:30",
      date: "23/08/2026",
      attendance_status: "present",
      status: "present",
      session_name: "Morning"
    };

    if (selectedTemplate) {
      try {
        const response = await renderNotificationTemplate(
          selectedTemplate.id,
          variables,
          "en"
        );
        setPreviewText(response.rendered);
        return;
      } catch (error) {
        console.error("Failed to render template preview:", error);
      }
    }

    setPreviewText(renderTemplateText(body, variables));
  }, [messageBodyEn, selectedTemplate]);

  useEffect(() => {
    void generatePreview();
  }, [generatePreview]);

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      populateFormFromTemplate(template);
    }
  };

  const handleSave = useCallback(async () => {
    if (!templateName.trim()) {
      toast.error("Template name is required");
      return;
    }

    setSaving(true);

    try {
      const templateData: TemplateCreateInput = {
        name: templateName.trim(),
        slug: templateName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, ""),
        trigger_type: triggerType,
        body_en: messageBodyEn.trim(),
        body_kin: null,
        is_active: isActive
      };

      if (selectedTemplate) {
        await updateNotificationTemplate(selectedTemplate.id, templateData);
        toast.success("SMS template updated successfully");
      } else {
        await createNotificationTemplate(templateData);
        toast.success("SMS template created successfully");
      }

      await loadTemplates();
    } catch (error) {
      console.error("Failed to save template:", error);
      toast.error("Failed to save SMS template");
    } finally {
      setSaving(false);
    }
  }, [templateName, triggerType, messageBodyEn, isActive, selectedTemplate, loadTemplates]);

  const handleDelete = useCallback(async () => {
    if (!selectedTemplate) return;

    if (!window.confirm("Are you sure you want to delete this template? This action cannot be undone.")) {
      return;
    }

    try {
      await deleteNotificationTemplate(selectedTemplate.id);
      toast.success("SMS template deleted successfully");
      await loadTemplates();
    } catch (error) {
      console.error("Failed to delete template:", error);
      toast.error("Failed to delete SMS template");
    }
  }, [selectedTemplate, loadTemplates]);

  return (
    <SuperAdminLayout
      title={`${typeLabel} SMS`}
      subtitle={`Customize ${typeLabel} attendance SMS text and placeholders`}
      breadcrumbs={
        <SuperAdminBreadcrumbs
          items={[
            { label: "Super Admin", to: "/super-admin" },
            { label: "Manage SMS", to: "/super-admin/manage-sms" },
            { label: typeLabel }
          ]}
        />
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {SMS_TRIGGER_TYPES.map((type) => (
            <Link
              key={type.value}
              to={`/super-admin/manage-sms/${type.value.replace(/_/g, "-")}`}
              className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                type.value === triggerType
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              {type.label}
            </Link>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.35fr_0.65fr]">
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Template list</h2>
                  <p className="text-sm text-muted-foreground">Manage {typeLabel.toLowerCase()} SMS templates.</p>
                </div>
                <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {templates.length} template{templates.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="space-y-2">
                {templates.length > 0 ? (
                  templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => handleTemplateSelect(template.id)}
                      className={`w-full text-left rounded-xl border p-4 transition ${
                        selectedTemplate?.id === template.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:border-primary/80"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold">{template.name}</p>
                          <p className="text-xs text-muted-foreground">{template.is_active ? "Active" : "Inactive"}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">Edit</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-muted/50 p-6 text-sm text-muted-foreground">
                    No templates exist yet for this SMS type. Use the editor to create one.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-4 rounded-xl border border-border bg-background p-6 shadow-sm">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">{selectedTemplate ? "Edit SMS Template" : "Create SMS Template"}</h2>
                <p className="text-sm text-muted-foreground">This registered system template can be selected by schools for {typeLabel.toLowerCase()} attendance events.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground">Template Name</label>
                  <SaInput value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground">English Template</label>
                  <div className="text-xs text-muted-foreground">
                    Available placeholders: <code className="rounded bg-muted px-1 py-0.5 text-xs">${"{student_name}"}</code>, <code className="rounded bg-muted px-1 py-0.5 text-xs">${"{time}"}</code>, <code className="rounded bg-muted px-1 py-0.5 text-xs">${"{date}"}</code>, <code className="rounded bg-muted px-1 py-0.5 text-xs">${"{status}"}</code>, and <code className="rounded bg-muted px-1 py-0.5 text-xs">${"{session_name}"}</code>.
                  </div>
                  <Textarea rows={6} value={messageBodyEn} onChange={(e) => setMessageBodyEn(e.target.value)} className="min-h-[120px]" />
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-primary text-primary focus:ring-primary" />
                    Active
                  </label>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button onClick={handleSave} disabled={saving} className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                    {saving ? "Saving..." : "Save Template"}
                  </button>
                  {selectedTemplate && (
                    <button onClick={handleDelete} className="inline-flex items-center justify-center rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90">
                      Delete Template
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-border bg-muted/50 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Preview</h3>
                  <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">English</span>
              </div>
              <div className="min-h-[100px] whitespace-pre-wrap rounded-xl border border-border bg-background p-4 text-sm leading-relaxed text-foreground">
                {previewText || "Enter template text to see preview."}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
