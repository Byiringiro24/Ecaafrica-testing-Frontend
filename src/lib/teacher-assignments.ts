import { apiRequest } from "./api";

export interface TeacherAssignmentRecord {
  id: string;
  teacher_id: string;
  section_id: string;
  subject_id: string;
  term_id?: string | null;
}

export interface AssignmentPair {
  section_id: string;
  subject_id: string;
}

const assignmentKey = (sectionId: string, subjectId: string) =>
  `${sectionId}:${subjectId}`;

export async function listTeacherAssignments(teacherId: string) {
  const records = await apiRequest<TeacherAssignmentRecord[]>(
    `/teacher-section-subjects?teacher_id=${teacherId}&limit=500`,
    { auth: "school" }
  );
  return Array.isArray(records) ? records : [];
}

/**
 * Reconciles a teacher's section+subject assignments against what's currently
 * stored: deletes the pairs that were removed, creates the ones that are new,
 * and leaves untouched pairs alone. Returns how many rows changed.
 */
export async function syncTeacherAssignments(
  teacherId: string,
  current: TeacherAssignmentRecord[],
  next: AssignmentPair[]
) {
  const valid = next.filter((item) => item.section_id && item.subject_id);

  const nextKeys = new Set(
    valid.map((item) => assignmentKey(item.section_id, item.subject_id))
  );
  const currentKeys = new Set(
    current.map((item) => assignmentKey(item.section_id, item.subject_id))
  );

  const toRemove = current.filter(
    (item) => !nextKeys.has(assignmentKey(item.section_id, item.subject_id))
  );
  const toAdd = valid.filter(
    (item) => !currentKeys.has(assignmentKey(item.section_id, item.subject_id))
  );

  await Promise.all([
    ...toRemove.map((item) =>
      apiRequest(`/teacher-section-subjects/${item.id}`, {
        method: "DELETE",
        auth: "school",
      })
    ),
    ...toAdd.map((item) =>
      apiRequest("/teacher-section-subjects", {
        method: "POST",
        auth: "school",
        body: JSON.stringify({
          teacher_id: teacherId,
          section_id: item.section_id,
          subject_id: item.subject_id,
        }),
      })
    ),
  ]);

  return { added: toAdd.length, removed: toRemove.length };
}
