import { apiRequest } from "./api";

export interface Exam {
  id: string;
  school_id: string;
  name: string;
  subject_id: string;
  section_id?: string | null;
  teacher_id?: string | null;
  term_id?: string | null;
  type: "cat" | "main_exam" | "mock" | "quiz" | "assignment";
  exam_date?: string | null;
  start_time?: string | null;
  duration_min?: number | null;
  max_marks: string;
  pass_mark: string;
  status: "scheduled" | "ongoing" | "completed" | "cancelled";
  published_at?: string | null;
  published_by?: string | null;
  created_at: string;
  updated_at: string;
  subject?: { id: string; name: string; code?: string };
  section?: { id: string; name: string; full_name: string };
}

export interface ExamResult {
  id: string;
  school_id: string;
  exam_id: string;
  student_id: string;
  marks_obtained?: string | null;
  grade?: string | null;
  grade_label?: string | null;
  is_absent: boolean;
  remarks?: string | null;
  entered_by?: string | null;
  entered_at?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
  student?: {
    id: string;
    first_name: string;
    last_name: string;
    student_id_number?: string | null;
  } | null;
}

export interface ExamResultsResponse {
  exam: {
    id: string;
    name: string;
    max_marks: string;
    pass_mark: string;
  };
  stats: {
    class_average: string | null;
    highest: string | null;
    lowest: string | null;
    count: number;
  };
  results: ExamResult[];
}

export interface Student {
  id: string;
  first_name: string;
  last_name: string;
  student_id_number?: string | null;
}

export interface TeacherExam extends Exam {
  student_count?: number;
  marked_count?: number;
  average_score?: string;
  pass_rate?: string;
}

export interface TeacherAssignmentPair {
  section_id: string;
  subject_id: string;
  section: { id: string; name: string; full_name: string };
  subject: { id: string; name: string; code?: string | null };
}

export interface TeacherAssignmentSubject {
  id: string;
  name: string;
  code?: string;
}

export interface TeacherAssignmentsResponse {
  sections: Array<{ id: string; name: string; full_name: string; class_id: string }>;
  subjects: TeacherAssignmentSubject[];
  assignments: TeacherAssignmentPair[];
}

export function computeGrade(score: number, maxMarks: number): string {
  const percent = maxMarks > 0 ? (score / maxMarks) * 100 : 0;
  if (percent >= 80) return "A";
  if (percent >= 70) return "B";
  if (percent >= 60) return "C";
  if (percent >= 50) return "D";
  return "F";
}

export function studentDisplayName(result: ExamResult): string {
  if (result.student) {
    return `${result.student.first_name} ${result.student.last_name}`.trim();
  }
  return result.student_id;
}

// List exams for current teacher
export async function getTeacherExams(filters?: {
  status?: string;
  section_id?: string;
  subject_id?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.append("status", filters.status);
  if (filters?.section_id) params.append("section_id", filters.section_id);
  if (filters?.subject_id) params.append("subject_id", filters.subject_id);

  return apiRequest<TeacherExam[]>(
    `/exams/teacher/exams${params.toString() ? "?" + params.toString() : ""}`,
    {
      method: "GET",
      auth: "school",
    }
  );
}

// Create exam as teacher
export async function createExam(data: {
  name: string;
  section_id: string;
  subject_id: string;
  type: string;
  exam_date?: string;
  start_time?: string;
  duration_min?: number;
  max_marks: number;
  pass_mark?: number;
}) {
  return apiRequest<Exam>(
    "/exams",
    {
      method: "POST",
      auth: "school",
      body: JSON.stringify({
        ...data,
        max_marks: data.max_marks.toString(),
        pass_mark: data.pass_mark?.toString() || "50",
      }),
    }
  );
}

// Get exam details
export async function getExamDetails(examId: string) {
  return apiRequest<Exam>(
    `/exams/${examId}`,
    {
      method: "GET",
      auth: "school",
    }
  );
}

// Update exam
export async function updateExam(
  examId: string,
  data: Partial<{
    name: string;
    exam_date: string;
    start_time: string;
    duration_min: number;
    max_marks: number;
    pass_mark: number;
    status: string;
  }>
) {
  return apiRequest<Exam>(
    `/exams/${examId}`,
    {
      method: "PATCH",
      auth: "school",
      body: JSON.stringify(data),
    }
  );
}

// Delete exam
export async function deleteExam(examId: string) {
  return apiRequest(
    `/exams/${examId}`,
    {
      method: "DELETE",
      auth: "school",
    }
  );
}

// Get students in a section
export async function getStudentsInSection(sectionId: string) {
  return apiRequest<Student[]>(
    `/sections/${sectionId}/students?limit=500`,
    {
      method: "GET",
      auth: "school",
    }
  );
}

type ResultPayload = {
  student_id: string;
  score?: string;
  remarks?: string;
  is_absent?: boolean;
  grade?: string;
};

// Teachers save marks as a draft. Only a school admin can publish (see
// publishExamResults) — the backend rejects a publish attempt from a teacher.
export async function recordExamResults(examId: string, results: ResultPayload[]) {
  return apiRequest(
    "/exam-results/bulk",
    {
      method: "POST",
      auth: "school",
      body: JSON.stringify({
        exam_id: examId,
        results,
      }),
    }
  );
}

// Get results for an exam
export async function getExamResults(examId: string): Promise<ExamResultsResponse> {
  return apiRequest<ExamResultsResponse>(
    `/exam-results/by-exam/${examId}?limit=500`,
    {
      method: "GET",
      auth: "school",
    }
  );
}

// Get exam summary
export async function getExamSummary(examId: string) {
  return apiRequest(
    `/exam-results/summary/${examId}`,
    {
      method: "GET",
      auth: "school",
    }
  );
}

export interface PublishResult {
  id: string;
  status: string;
  published_at: string | null;
  published_by: string | null;
  published_count?: number;
}

// School admin only — stamps published_at on every result for the exam.
export async function publishExamResults(examId: string) {
  return apiRequest<PublishResult>(
    `/exam-results/publish/${examId}`,
    {
      method: "POST",
      auth: "school",
    }
  );
}

// School admin only — reopens a published exam so teachers can edit again.
export async function unpublishExamResults(examId: string) {
  return apiRequest<PublishResult>(
    `/exam-results/unpublish/${examId}`,
    {
      method: "POST",
      auth: "school",
    }
  );
}

// Get teacher's assigned classes and subjects
export async function getTeacherAssignments() {
  return apiRequest<TeacherAssignmentsResponse>(
    "/exams/teacher/assignments",
    {
      method: "GET",
      auth: "school",
    }
  );
}
