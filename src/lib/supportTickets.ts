import { apiRequest } from "./api";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketCategory = "technical" | "billing" | "feature_request" | "other";
export type TicketPriority = "low" | "medium" | "high" | "critical";

export type SupportTicketMessage = {
  id: string;
  ticket_id: string;
  sender_type: "school_user" | "platform_user";
  sender_id: string;
  body: string;
  created_at: string;
};

export type SupportTicket = {
  id: string;
  ticket_number: string;
  school_id: string;
  opened_by: string | null;
  assigned_to: string | null;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  audience: "school_admin" | "platform_admin";
  source: "gate_keeper" | "school_admin";
  created_at: string;
  updated_at: string;
  messages: SupportTicketMessage[];
};

export const listSchoolTickets = () => apiRequest<SupportTicket[]>("/support-tickets", { auth: "school" });

export const createSchoolTicket = (input: { subject: string; category: TicketCategory; priority: TicketPriority; body: string }) =>
  apiRequest<SupportTicket>("/support-tickets", { method: "POST", body: JSON.stringify(input), auth: "school" });

export const replyToSchoolTicket = (id: string, body: string) =>
  apiRequest<SupportTicketMessage>(`/support-tickets/${id}/replies`, { method: "POST", body: JSON.stringify({ body }), auth: "school" });

export const updateSchoolTicket = (id: string, status: TicketStatus) =>
  apiRequest<SupportTicket>(`/support-tickets/${id}`, { method: "PATCH", body: JSON.stringify({ status }), auth: "school" });
