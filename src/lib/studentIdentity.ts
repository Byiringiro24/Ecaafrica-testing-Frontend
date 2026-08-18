export type StudentIdentity = {
  id?: string | number | null;
  student_school_id?: string | number | null;
  student_id_number?: string | number | null;
  first_name?: string | null;
  last_name?: string | null;
};

/** The school-issued Student ID Number is the primary identifier shown to users. */
export const studentIdNumber = (student?: StudentIdentity | null) =>
  student?.student_id_number?.toString().trim() ||
  (student?.student_school_id !== null && student?.student_school_id !== undefined
    ? student.student_school_id.toString()
    : student?.id?.toString()) ||
  "—";

export const studentFullName = (student?: StudentIdentity | null) =>
  [student?.first_name, student?.last_name].filter(Boolean).join(" ") || "Unnamed student";

export const studentSearchText = (student?: StudentIdentity | null) =>
  `${studentFullName(student)} ${studentIdNumber(student)} ${student?.student_school_id ?? ""} ${student?.student_id_number ?? ""}`.toLowerCase();

export const studentLabel = (student?: StudentIdentity | null) =>
  `${studentFullName(student)} · Student ID Number: ${studentIdNumber(student)}`;
