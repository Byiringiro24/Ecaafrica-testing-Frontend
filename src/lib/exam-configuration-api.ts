import { apiRequest } from "./api";

export interface ExamTypeOption {
  id: string;
  school_id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
}

export interface GradingRole {
  id: string;
  school_id: string;
  code: string;
  label: string;
  min_percentage: string;
  max_percentage: string;
  is_active: boolean;
  sort_order: number;
}

/** Returns the configured percentage at which an exam is considered passed. */
export function getPassPercentage(roles: GradingRole[]): number {
  const passingRoles = roles.filter((role) => !/^(f|fail)/i.test(role.code.trim()));
  if (passingRoles.length > 0) {
    return Math.min(...passingRoles.map((role) => Number(role.min_percentage)));
  }

  const failingRole = roles.find((role) => /^(f|fail)/i.test(role.code.trim()));
  return failingRole ? Math.min(Number(failingRole.max_percentage) + 1, 100) : 50;
}

export const listExamTypes = (includeInactive = false) =>
  apiRequest<ExamTypeOption[]>(`/exam-configuration/exam-types${includeInactive ? "?include_inactive=true" : ""}`, { method: "GET", auth: "school" });

export const createExamType = (data: { name: string; description?: string; is_active?: boolean }) =>
  apiRequest<ExamTypeOption>("/exam-configuration/exam-types", { method: "POST", auth: "school", body: JSON.stringify(data) });

export const updateExamType = (id: string, data: Partial<{ name: string; description: string; is_active: boolean }>) =>
  apiRequest<ExamTypeOption>(`/exam-configuration/exam-types/${id}`, { method: "PATCH", auth: "school", body: JSON.stringify(data) });

export const listGradingRoles = (includeInactive = false) =>
  apiRequest<GradingRole[]>(`/exam-configuration/grading-roles${includeInactive ? "?include_inactive=true" : ""}`, { method: "GET", auth: "school" });

export const createGradingRole = (data: { code: string; label: string; min_percentage: number; max_percentage: number; sort_order?: number; is_active?: boolean }) =>
  apiRequest<GradingRole>("/exam-configuration/grading-roles", { method: "POST", auth: "school", body: JSON.stringify(data) });

export const updateGradingRole = (id: string, data: Partial<{ code: string; label: string; min_percentage: number; max_percentage: number; sort_order: number; is_active: boolean }>) =>
  apiRequest<GradingRole>(`/exam-configuration/grading-roles/${id}`, { method: "PATCH", auth: "school", body: JSON.stringify(data) });
