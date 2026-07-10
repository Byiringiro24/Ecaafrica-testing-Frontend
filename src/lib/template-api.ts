import { apiRequest } from "./api";

export interface NotificationTemplate {
  id: string;
  school_id: string | null;
  name: string;
  slug: string;
  trigger_type: string;
  body_en: string;
  body_kin: string | null;
  variables: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateCreateInput {
  name: string;
  slug: string;
  trigger_type: string;
  body_en: string;
  body_kin?: string | null;
  variables?: Record<string, string | number | boolean> | null;
  is_active?: boolean;
}

export interface TemplateUpdateInput extends Partial<TemplateCreateInput> {}

// Get all templates (for platform admin, this will get global templates)
// For school-specific templates, you would need to provide school context
export function getNotificationTemplates(
  filters: {
    is_active?: boolean;
    trigger_type?: string;
    page?: number;
    limit?: number;
    search?: string;
  } = {}
) {
  const params = new URLSearchParams();
  
  if (filters.is_active !== undefined) {
    params.append("is_active", String(filters.is_active));
  }
  
  if (filters.trigger_type) {
    params.append("trigger_type", filters.trigger_type);
  }
  
  if (filters.page !== undefined) {
    params.append("page", String(filters.page));
  }
  
  if (filters.limit !== undefined) {
    params.append("limit", String(filters.limit));
  }
  
  if (filters.search) {
    params.append("q", filters.search);
  }
  
  return apiRequest<{
    data: NotificationTemplate[];
    meta: { page: number; limit: number; total: number };
  }>(
    `/notifications/templates${params.toString() ? "?" + params.toString() : ""}`,
    {
      method: "GET",
      auth: "platform", // Using platform auth for super admin access
    }
  );
}

// Get a specific template by ID
export function getNotificationTemplateById(id: string) {
  return apiRequest<NotificationTemplate>(
    `/notifications/templates/${id}`,
    {
      method: "GET",
      auth: "platform",
    }
  );
}

// Create a new template
export function createNotificationTemplate(data: TemplateCreateInput) {
  return apiRequest<NotificationTemplate>(
    `/notifications/templates`,
    {
      method: "POST",
      auth: "platform",
      body: JSON.stringify(data),
    }
  );
}

// Update an existing template
export function updateNotificationTemplate(
  id: string,
  data: TemplateUpdateInput
) {
  return apiRequest<NotificationTemplate>(
    `/notifications/templates/${id}`,
    {
      method: "PATCH",
      auth: "platform",
      body: JSON.stringify(data),
    }
  );
}

// Delete a template
export function deleteNotificationTemplate(id: string) {
  return apiRequest(
    `/notifications/templates/${id}`,
    {
      method: "DELETE",
      auth: "platform",
    }
  );
}

// Render a template with variables
export function renderNotificationTemplate(
  id: string,
  variables: Record<string, string | number | boolean> = {},
  language: "en" | "kin" = "en"
) {
  return apiRequest<{
    template_id: string;
    language: string;
    rendered: string;
  }>(
    `/notifications/templates/${id}/render`,
    {
      method: "POST",
      auth: "platform",
      body: JSON.stringify({ variables, language }),
    }
  );
}
