import type { SectionOption, SubjectOption } from "@/lib/exams-admin-api";

interface Props {
  sections: SectionOption[];
  subjects: SubjectOption[];
  sectionId: string;
  subjectId: string;
  status?: string;
  showStatus?: boolean;
  onSectionChange: (id: string) => void;
  onSubjectChange: (id: string) => void;
  onStatusChange?: (status: string) => void;
}

export function ExamFilters({
  sections,
  subjects,
  sectionId,
  subjectId,
  status = "",
  showStatus = false,
  onSectionChange,
  onSubjectChange,
  onStatusChange,
}: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <label className="text-sm font-medium">Filter by class</label>
        <select
          value={sectionId}
          onChange={(e) => onSectionChange(e.target.value)}
          className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All classes</option>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.full_name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium">Filter by subject</label>
        <select
          value={subjectId}
          onChange={(e) => onSubjectChange(e.target.value)}
          className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All subjects</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
      </div>
      {showStatus && onStatusChange && (
        <div>
          <label className="text-sm font-medium">Filter by status</label>
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="ongoing">In Progress / Submitted</option>
            <option value="completed">Published</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      )}
    </div>
  );
}
