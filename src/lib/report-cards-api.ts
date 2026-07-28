import { apiRequest, API_BASE_URL } from "./api";

export interface ReportCardSubject {
  subject_id: string;
  subject_name: string;
  subject_code: string | null;
  percentage: number | null;
  grade: string | null;
  comments: string | null;
  is_absent: boolean;
}

export interface ReportCardStudent {
  id: string;
  first_name: string;
  last_name: string;
  other_names: string | null;
  full_name: string;
  student_id_number: string | null;
  section: { id: string; name: string; full_name: string } | null;
}

export interface ReportCardTerm {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  academic_year: string | null;
}

export interface ReportCardSchool {
  name: string;
  logo_url: string | null;
}

export interface StudentReportCard {
  school: ReportCardSchool;
  term: ReportCardTerm;
  prepared_by: string | null;
  issued_on: string;
  student: ReportCardStudent;
  subjects: ReportCardSubject[];
}

export interface SectionReportCards {
  school: ReportCardSchool;
  term: ReportCardTerm;
  section: { id: string; name: string; full_name: string };
  prepared_by: string | null;
  issued_on: string;
  cards: Array<{ student: ReportCardStudent; subjects: ReportCardSubject[] }>;
}

export interface TermOption {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

export function resolveLogoUrl(logoUrl?: string | null): string {
  if (!logoUrl) return "";
  if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) return logoUrl;
  const origin = API_BASE_URL.replace(/\/api\/v1$/, "");
  return logoUrl.startsWith("/") ? `${origin}${logoUrl}` : `${origin}/${logoUrl}`;
}

export async function getStudentReportCard(studentId: string, termId?: string) {
  const params = termId ? `?term_id=${encodeURIComponent(termId)}` : "";
  return apiRequest<StudentReportCard>(`/report-cards/student/${studentId}${params}`, {
    method: "GET",
    auth: "school",
  });
}

export async function getSectionReportCards(sectionId: string, termId?: string) {
  const params = termId ? `?term_id=${encodeURIComponent(termId)}` : "";
  return apiRequest<SectionReportCards>(`/report-cards/section/${sectionId}${params}`, {
    method: "GET",
    auth: "school",
  });
}

export async function listTerms() {
  return apiRequest<TermOption[]>("/terms?limit=100", { method: "GET", auth: "school" });
}

export async function listSectionStudents(sectionId: string) {
  return apiRequest<Array<{ id: string; first_name: string; last_name: string; student_id_number?: string | null }>>(
    `/sections/${sectionId}/students?limit=500`,
    { method: "GET", auth: "school" }
  );
}
