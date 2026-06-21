import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Eye } from "lucide-react";
import { toast } from "sonner";
import { ExamFilters } from "@/components/exams/ExamFilters";
import { ExamResultsModal } from "@/components/exams/ExamResultsModal";
import {
  listAdminExams,
  getFilterOptions,
  examTypeLabel,
  statusBadgeClass,
  type AdminExam,
  type SectionOption,
  type SubjectOption,
} from "@/lib/exams-admin-api";

export const Route = createFileRoute("/exams/schedule")({
  component: ExamsSchedulePage,
});

function ExamsSchedulePage() {
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewExam, setViewExam] = useState<AdminExam | null>(null);

  useEffect(() => {
    getFilterOptions().then((opts) => {
      setSections(opts.sections);
      setSubjects(opts.subjects);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    loadExams();
  }, [sectionId, subjectId, status]);

  const loadExams = async () => {
    try {
      setLoading(true);
      const data = await listAdminExams({
        section_id: sectionId || undefined,
        subject_id: subjectId || undefined,
        status: status || undefined,
        limit: 500,
      });
      setExams(data);
    } catch (error) {
      toast.error("Failed to load exams");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          View all scheduled, in-progress, and completed exams across the school.
        </p>
      </div>

      <ExamFilters
        sections={sections}
        subjects={subjects}
        sectionId={sectionId}
        subjectId={subjectId}
        status={status}
        showStatus
        onSectionChange={setSectionId}
        onSubjectChange={setSubjectId}
        onStatusChange={setStatus}
      />

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading exams…</div>
        ) : exams.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No exams found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase">
              <tr>
                <th className="text-left p-3">Exam</th>
                <th className="text-left p-3">Class</th>
                <th className="text-left p-3">Subject</th>
                <th className="text-left p-3">Teacher</th>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Max Marks</th>
                <th className="text-left p-3">Marked</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {exams.map((exam, index) => (
                <tr key={exam.id} className={`border-t ${index % 2 ? "bg-muted/20" : ""}`}>
                  <td className="p-3 font-medium">{exam.name}</td>
                  <td className="p-3">{exam.section?.full_name ?? "—"}</td>
                  <td className="p-3">{exam.subject?.name ?? "—"}</td>
                  <td className="p-3">{exam.teacher?.name ?? "—"}</td>
                  <td className="p-3">
                    {exam.exam_date ? new Date(exam.exam_date).toLocaleDateString() : "—"}
                  </td>
                  <td className="p-3">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                      {examTypeLabel(exam.type)}
                    </span>
                  </td>
                  <td className="p-3">{exam.max_marks}</td>
                  <td className="p-3">{exam.marked_count ?? 0}</td>
                  <td className="p-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${statusBadgeClass(exam.status)}`}>
                      {exam.status === "ongoing" && (exam.marked_count ?? 0) > 0
                        ? "Submitted"
                        : exam.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    {(exam.marked_count ?? 0) > 0 && (
                      <button
                        onClick={() => setViewExam(exam)}
                        className="h-8 px-3 rounded-md border border-border text-xs font-semibold inline-flex items-center gap-1 hover:bg-muted"
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {viewExam && (
        <ExamResultsModal
          exam={viewExam}
          allowPublish={viewExam.status !== "completed"}
          onClose={() => setViewExam(null)}
          onPublished={loadExams}
        />
      )}
    </div>
  );
}
