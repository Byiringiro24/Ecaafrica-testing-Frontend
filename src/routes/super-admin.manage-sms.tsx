import { useEffect, useState, useCallback } from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
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
  TemplateCreateInput,
  TemplateUpdateInput
} from "@/lib/template-api";

const renderTemplateText = (
  body: string,
  variables: Record<string, string | number | boolean> = {}
) =>
  body.replace(/\{\{\s*([\w.]+)\s*\}\}|\$\{\s*([\w.]+)\s*\}/g, (_, keyA: string, keyB: string) => {
    const key = keyA ?? keyB;
    const value = variables[key];
    return value !== undefined && value !== null ? String(value) : "";
  });

const SMS_TRIGGER_TYPES = [
  { value: "school_entry", label: "School Entry" },
  { value: "school_exit", label: "School Exit" },
  { value: "class_entry", label: "Class Entry" },
  { value: "class_absent", label: "Class Absent" },
] as const;

export const Route = createFileRoute("/super-admin/manage-sms")({
  component: ManageSmsRouteLayout,
});

function ManageSmsRouteLayout() {
  return <Outlet />;
}

function ManageSmsPage() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);

  const normalizeTemplates = useCallback((value: unknown) => {
    if (Array.isArray(value)) return value as NotificationTemplate[];
    if (value && typeof value === "object" && Array.isArray((value as { data?: unknown }).data)) {
      return (value as { data: NotificationTemplate[] }).data;
    }
    return [] as NotificationTemplate[];
  }, []);
  const [selectedTriggerType, setSelectedTriggerType] = useState<SMS_TRIGGER_TYPES[0]["value"] | null>(
    SMS_TRIGGER_TYPES[0].value
  );
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);
  // Form state for editing/creating template
  const [templateName, setTemplateName] = useState("");
  const [messageBodyEn, setMessageBodyEn] = useState("");
  const [messageBodyKin, setMessageBodyKin] = useState("");
  const [isActive, setIsActive] = useState(true);
  // Preview state
  const [previewText, setPreviewText] = useState("");
  const [previewLanguage, setPreviewLanguage] = useState<"en" | "kin">("en");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load templates when component triggers type changes
  useEffect(() => {
    if (selectedTriggerType) {
      loadTemplates();
    }
  }, [selectedTriggerType]);

  // Load templates of selected type
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getNotificationTemplates({
        trigger_type: selectedTriggerType,
        limit: 100
      });
      const nextTemplates = normalizeTemplates(response);
      setTemplates(nextTemplates);

      // If we had a previously selected template, try to find it in the new list
      if (selectedTemplate) {
        const found = nextTemplates.find((template) => template.id === selectedTemplate.id);
        if (found) {
          setSelectedTemplate(found);
          populateFormFromTemplate(found);
        } else if (nextTemplates.length > 0) {
          // Select first template if previous selection not found
          const nextTemplate = nextTemplates[0];
          setSelectedTemplate(nextTemplate);
          populateFormFromTemplate(nextTemplate);
        } else {
          // No templates, clear form for creating new one
          setSelectedTemplate(null);
          resetForm();
        }
      } else if (nextTemplates.length > 0) {
        // Select first template by default
        const nextTemplate = nextTemplates[0];
        setSelectedTemplate(nextTemplate);
        populateFormFromTemplate(nextTemplate);
      } else {
        // No templates, prepare to create new one
        setSelectedTemplate(null);
        resetForm();
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
      toast.error("Failed to load SMS templates");
    } finally {
      setLoading(false);
    }
  }, [selectedTriggerType]);

  // Populate form fields from template
  const populateFormFromTemplate = (template: NotificationTemplate) => {
    setTemplateName(template.name);
    setMessageBodyEn(template.body_en);
    setMessageBodyKin(template.body_kin || "");
    setIsActive(template.is_active);
  };

  // Reset form to default values
  const resetForm = () => {
    setTemplateName(`Attendance SMS Template - ${selectedTriggerType?.replace("_", " ").toUpperCase() || ""}`);
    setMessageBodyEn("Education Care\nAttendance: ${student_name} has checked in at ${time}.\nThank you for staying connected.");
    setMessageBodyKin("Esoho y'Icare\nAhazwe: ${student_name} yaraze ku ishuri ku ${time}.\nMurakoze cyane kugira intege.");
    setIsActive(true);
  };

  // Generate preview text
  const generatePreview = useCallback(async () => {
    const language = previewLanguage;
    const body = language === "en" ? messageBodyEn : messageBodyKin;

    if (!body.trim()) {
      setPreviewText("");
      return;
    }

    const variables = {
      student_name: "Jane Doe",
      studentName: "Jane Doe",
      time: "08:30"
    };

    if (selectedTemplate) {
      try {
        const response = await renderNotificationTemplate(
          selectedTemplate.id,
          variables,
          language
        );
        setPreviewText(response.rendered);
        return;
      } catch (error) {
        console.error("Failed to render template preview:", error);
      }
    }

    setPreviewText(renderTemplateText(body, variables));
  }, [messageBodyEn, messageBodyKin, previewLanguage, selectedTemplate]);

  // Handle template selection change
  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      populateFormFromTemplate(template);
    }
  };

  // Handle save button click
  const handleSave = useCallback(async () => {
    if (!templateName.trim()) {
      toast.error("Template name is required");
      return;
    }

    if (!selectedTriggerType) {
      toast.error("Please select a template type");
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
        trigger_type: selectedTriggerType,
        body_en: messageBodyEn.trim(),
        body_kin: messageBodyKin.trim() || null,
        is_active: isActive
      };

      let result;
      if (selectedTemplate) {
        // Update existing template
        result = await updateNotificationTemplate(selectedTemplate.id, templateData);
        toast.success("SMS template updated successfully");
      } else {
        // Create new template
        result = await createNotificationTemplate(templateData);
        toast.success("SMS template created successfully");
        
        // Select the newly created template
        setSelectedTemplate(result);
      }
      
      // Refresh the template list
      await loadTemplates();
    } catch (error) {
      console.error("Failed to save template:", error);
      toast.error("Failed to save SMS template");
    } finally {
      setSaving(false);
    }
  }, [
    templateName, 
    messageBodyEn, 
    messageBodyKin, 
    isActive, 
    selectedTemplate, 
    selectedTriggerType,
    loadTemplates
  ]);

  // Handle delete button click
  const handleDelete = useCallback(async () => {
    if (!selectedTemplate) return;

    if (!window.confirm("Are you sure you want to delete this template? This action cannot be undone.")) {
      return;
    }

    try {
      await deleteNotificationTemplate(selectedTemplate.id);
      toast.success("SMS template deleted successfully");

      const remainingTemplates = templates.filter((template) => template.id !== selectedTemplate.id);
      if (remainingTemplates.length > 0) {
        const nextTemplate = remainingTemplates[0];
        setSelectedTemplate(nextTemplate);
        populateFormFromTemplate(nextTemplate);
      } else {
        setSelectedTemplate(null);
        resetForm();
      }

      await loadTemplates();
    } catch (error) {
      console.error("Failed to delete template:", error);
      toast.error("Failed to delete SMS template");
    }
  }, [selectedTemplate, templates, loadTemplates]);

  // Handle language change for preview
  const handlePreviewLanguageChange = (language: "en" | "kin") => {
    setPreviewLanguage(language);
    generatePreview();
  };

  useEffect(() => {
    void generatePreview();
  }, [generatePreview]);

  // Initial load
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  if (loading) {
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
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading SMS templates...</p>
        </div>
      </SuperAdminLayout>
    );
  }

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
      <div className="grid gap-6 xl:grid-cols-[0.35fr_0.65fr]">
        {/* Sidebar - Template List and Controls */}
        <div className="space-y-4">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">SMS Template Types</h2>
            <div className="space-y-2">
              {SMS_TRIGGER_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setSelectedTriggerType(type.value)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-${selectedTriggerType === type.value ? "primary" : "background"} 
                    text-${selectedTriggerType === type.value ? "primary-foreground" : "foreground"} 
                    hover:bg-${selectedTriggerType === type.value ? "primary/90" : "muted/50"}`}
                >
                  <span>{type.label}</span>
                  <span className="text-xs">{(templates ?? []).filter((template) => template.trigger_type === type.value).length} templates</span>
                </button>
              ))}
            </div>
          </div>

          {(selectedTemplate || templates.length === 0) && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Template Actions</h2>
              <div className="space-y-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold 
                    ${saving ? "bg-muted" : "bg-primary"} 
                    ${saving ? "text-muted-foreground" : "text-primary-foreground"}
                    ${!saving ? "hover:bg-primary/90" : ""}
                    disabled:opacity-60`}
                >
                  {saving ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.989 8.989 0 014 16a9 9 0 1112 0c0 1.105-.19 2.165-.5 3.14m5.657-4.015a9 9 0 1012 0c0-1.105.19-2.165.5-3.14m-5.657 4.015V4h5z" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l2.828 2.828M12 12l2.828 2.828M21 21l-2.828-2.828M3 21l2.828-2.828M21 3l-2.828 2.828" />
                      </svg>
                      Save Template
                    </>
                  )}
                </button>
                
                {selectedTemplate && (
                  <button
                    onClick={handleDelete}
                    className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Template
                  </button>
                )}
              </div>
            </div>
          )}
          
          {!selectedTemplate && !templates.length && selectedTriggerType && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">No Templates Found</h2>
              <p className="text-sm text-muted-foreground">
                No SMS templates found for {selectedTriggerType.replace("_", " ").toLowerCase()}. 
                Create one to get started.
              </p>
              <button
                onClick={() => {
                  setSelectedTemplate(null);
                  resetForm();
                }}
                className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Create New Template
              </button>
            </div>
          )}
        </div>

        {/* Main Content - Form and Preview */}
        <div className="space-y-6">
          {/* Template Selection */}
          {!selectedTemplate && templates.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Select a Template to Edit</h2>
              <div className="space-y-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => handleTemplateSelect(template.id)}
                    className={`cursor-pointer rounded-lg border border-border p-4 hover:bg-muted/50 
                      ${selectedTemplate?.id === template.id ? "bg-primary/50 border-primary" : ""}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">{template.name}</h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {template.trigger_type.replace("_", " ").toUpperCase()}
                        </p>
                      </div>
                      <div className="text-xs">
                        {template.is_active ? (
                          <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">Active</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-800">Inactive</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Template Form */}
          {(selectedTemplate || templates.length === 0) && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">
                {selectedTemplate ? "Edit SMS Template" : "Create New SMS Template"}
              </h2>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold mb-1.5 text-foreground">Template Name</label>
                  <SaInput
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold mb-1.5 text-foreground">Template Type</label>
                  <div className="text-sm text-muted-foreground">
                    {selectedTriggerType ? 
                      `${selectedTriggerType.replace("_", " ").toUpperCase()} (${selectedTemplate?.name || ""})` :
                      "Select a template type from the sidebar"}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold mb-1.5 text-foreground">English Template</label>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs text-muted-foreground">
                      Use <code className="text-xs">${"{student_name}"}</code> and <code className="text-xs">${"{time}"}</code> for placeholders
                    </span>
                  </div>
                  <Textarea
                    rows={6}
                    value={messageBodyEn}
                    onChange={(e) => {
                      setMessageBodyEn(e.target.value);
                      // Auto-update preview when English text changes and English is selected
                      if (previewLanguage === "en") {
                        generatePreview();
                      }
                    }}
                    className="min-h-[120px]"
                  />
                </div>

                {messageBodyKin !== undefined && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold mb-1.5 text-foreground">Kinyarwanda Template (Optional)</label>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs text-muted-foreground">
                        Use <code className="text-xs">${"{student_name}"}</code> and <code className="text-xs">${"{time}"}</code> for placeholders
                      </span>
                    </div>
                    <Textarea
                      rows={6}
                      value={messageBodyKin}
                      onChange={(e) => {
                        setMessageBodyKin(e.target.value);
                        // Auto-update preview when Kinyarwanda text changes and Kinyarwanda is selected
                        if (previewLanguage === "kin") {
                          generatePreview();
                        }
                      }}
                      className="min-h-[120px]"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-semibold mb-1.5 text-foreground">Status</label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="h-4 w-4 rounded border-primary focus:ring-primary"
                      />
                      <span className="text-sm font-medium">Active</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Preview Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Live Preview</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewLanguage("en")}
                    className={`px-2 py-1 rounded-md text-xs font-semibold 
                      ${previewLanguage === "en" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => setPreviewLanguage("kin")}
                    className={`px-2 py-1 rounded-md text-xs font-semibold 
                      ${previewLanguage === "kin" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}
                  >
                    Kinyarwanda
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Rendered preview with example placeholders.
              </p>
              <div className="whitespace-pre-wrap rounded-xl border border-border bg-muted/50 p-4 text-sm leading-relaxed text-foreground min-h-[80px]">
                {previewText || "Enter template text to see preview..."}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
