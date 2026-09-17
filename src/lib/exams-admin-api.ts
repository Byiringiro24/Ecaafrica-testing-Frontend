import { apiRequest } from "./api";
import type { Exam, ExamResult, ExamResultsResponse } from "./exams-api";
import {
  getExamResults,
  publishExamResults,
  unpublishExamResults,
  studentDisplayName,
  updateExam,
} from "./exams-api";

export type { ExamResult };
export {
  studentDisplayName,
  getExamResults,
  publishExamResults,
  unpublishExamResults,
  updateExam,
};

export interface AdminExam extends Exam {
  marked_count?: number;
  published_count?: number;
  average_score?: string;
  pass_rate?: string;
  teacher?: { id: string; name: string; email?: string } | null;
}

export interface SectionOption {
  id: string;
  name: string;
  full_name: string;
  class_id: string;
}

export interface SubjectOption {
  id: string;
  name: string;
  code?: string | null;
}

type ListResponse<T> = {
  data: T[];
  meta?: { page?: number; limit?: number; total?: number };
};

export async function listAdminExams(filters?: {
  status?: string;
  section_id?: string;
  subject_id?: string;
  term_id?: string;
  type?: string;
  limit?: number;
  page?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.append("status", filters.status);
  if (filters?.section_id) params.append("section_id", filters.section_id);
  if (filters?.subject_id) params.append("subject_id", filters.subject_id);
  if (filters?.term_id) params.append("term_id", filters.term_id);
  if (filters?.type) params.append("type", filters.type);
  params.append("limit", String(filters?.limit ?? 500));
  if (filters?.page) params.append("page", String(filters.page));

  const resp = await apiRequest<ListResponse<AdminExam>>(
    `/exams?${params.toString()}`,
    { method: "GET", auth: "school", returnMeta: true }
  );
  return resp.data ?? [];
}

export async function getFilterOptions() {
  const [sections, subjects] = await Promise.all([
    apiRequest<SectionOption[]>("/sections?limit=500", { auth: "school" }),
    apiRequest<SubjectOption[]>("/subjects?limit=500", { auth: "school" }),
  ]);
  return { sections, subjects };
}

export function isPendingReview(exam: AdminExam): boolean {
  return (exam.marked_count ?? 0) > 0 && exam.status !== "completed" && exam.status !== "cancelled";
}

export function isPublished(exam: AdminExam): boolean {
  return exam.published_at !== null && exam.published_at !== undefined;
}

export function examTypeLabel(type: string, configuredName?: string | null): string {
  if (configuredName) return configuredName;
  const labels: Record<string, string> = {
    cat: "CAT",
    main_exam: "Main Exam",
    mock: "Mock",
    quiz: "Quiz",
    assignment: "Assignment",
  };
  return labels[type] ?? type;
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "scheduled":
      return "bg-blue-100 text-blue-800";
    case "ongoing":
      return "bg-amber-100 text-amber-800";
    case "completed":
      return "bg-green-100 text-green-800";
    case "cancelled":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function gradeBadgeClass(grade: string | null | undefined): string {
  switch (grade) {
    case "A":
      return "bg-green-100 text-green-800";
    case "B":
      return "bg-blue-100 text-blue-800";
    case "C":
      return "bg-yellow-100 text-yellow-800";
    case "D":
      return "bg-orange-100 text-orange-800";
    case "F":
      return "bg-red-100 text-red-800";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export interface ExamModificationRequest {
  id: string;
  exam_id: string;
  teacher_id: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at?: string | null;
  exam?: {
    id: string;
    name: string;
    status: string;
    exam_date?: string | null;
    subject?: { id: string; name: string } | null;
    section?: { id: string; full_name: string } | null;
  } | null;
  teacher?: { id: string; name: string; email?: string | null } | null;
}

export const listExamModificationRequests = (status?: ExamModificationRequest["status"]) => {
  const query = status ? `?status=${status}` : "";
  return apiRequest<ExamModificationRequest[]>(`/exam-modification-requests${query}`, { method: "GET", auth: "school" });
};

export const reviewExamModificationRequest = (id: string, status: "approved" | "rejected") =>
  apiRequest<ExamModificationRequest>(`/exam-modification-requests/${id}`, { method: "PATCH", auth: "school", body: JSON.stringify({ status }) });

export type ExamResultsData = ExamResultsResponse;
