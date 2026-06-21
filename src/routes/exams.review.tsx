import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ExamFilters } from "@/components/exams/ExamFilters";
import { ExamResultsModal } from "@/components/exams/ExamResultsModal";
import {
  listAdminExams,
  getFilterOptions,
  isPendingReview,
  publishExamResults,
  examTypeLabel,
  statusBadgeClass,
  type AdminExam,
  type SectionOption,
  type SubjectOption,
} from "@/lib/exams-admin-api";

export const Route = createFileRoute("/exams/review")({
  component: ExamsReviewPage,
});

function ExamsReviewPage() {
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [viewExam, setViewExam] = useState<AdminExam | null>(null);

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    loadExams();
  }, [sectionId, subjectId]);

  const loadFilters = async () => {
    try {
      const opts = await getFilterOptions();
      setSections(opts.sections);
      setSubjects(opts.subjects);
    } catch (error) {
      console.error(error);
    }
  };

  const loadExams = async () => {
    try {
      setLoading(true);
      const data = await listAdminExams({
        section_id: sectionId || undefined,
        subject_id: subjectId || undefined,
        limit: 500,
      });
      setExams(data.filter(isPendingReview));
    } catch (error) {
      toast.error("Failed to load submissions");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPublish = async (exam: AdminExam) => {
    if (!confirm(`Publish "${exam.name}" results to parents?`)) return;
    try {
      setPublishingId(exam.id);
      await publishExamResults(exam.id);
      toast.success("Results published successfully");
      loadExams();
    } catch (error) {
      toast.error("Failed to publish results");
      console.error(error);
    } finally {
      setPublishingId(null);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, AdminExam[]>();
    for (const exam of exams) {
      const key = exam.section?.full_name ?? "Unassigned";
      const list = map.get(key) ?? [];
      list.push(exam);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [exams]);

  return (
    <div>
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          Review marks submitted by teachers. Filter by class and subject, verify results, then publish so parents can view grades.
        </p>
      </div>

      <ExamFilters
        sections={sections}
        subjects={subjects}
        sectionId={sectionId}
        subjectId={subjectId}
        onSectionChange={setSectionId}
        onSubjectChange={setSubjectId}
      />

      <div className="rounded-xl border border-border bg-card p-4 mb-5 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase text-muted-foreground">Pending review</div>
          <div className="text-2xl font-display font-bold">{exams.length}</div>
        </div>
        <div className="text-sm text-muted-foreground">
          {sectionId || subjectId ? "Filtered results" : "All classes & subjects"}
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Loading submissions…</div>
      ) : exams.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <div className="text-muted-foreground">No submissions awaiting review</div>
          <p className="text-sm text-muted-foreground mt-2">
            When teachers submit marks, they will appear here for your approval.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([className, classExams]) => (
            <div key={className} className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-muted/50 border-b border-border font-semibold">
                {className}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({classExams.length} exam{classExams.length !== 1 ? "s" : ""})
                </span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted text-xs uppercase">
                  <tr>
                    <th className="text-left p-3">Exam</th>
                    <th className="text-left p-3">Subject</th>
                    <th className="text-left p-3">Teacher</th>
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Type</th>
                    <th className="text-left p-3">Marked</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {classExams.map((exam, index) => (
                    <tr key={exam.id} className={`border-t ${index % 2 ? "bg-muted/20" : ""}`}>
                      <td className="p-3 font-medium">{exam.name}</td>
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
                      <td className="p-3">{exam.marked_count ?? 0} students</td>
                      <td className="p-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${statusBadgeClass(exam.status)}`}>
                          Awaiting Review
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setViewExam(exam)}
                            className="h-8 px-3 rounded-md border border-border text-xs font-semibold inline-flex items-center gap-1 hover:bg-muted"
                          >
                            <Eye className="h-3.5 w-3.5" /> Review
                          </button>
                          <button
                            onClick={() => handleQuickPublish(exam)}
                            disabled={publishingId === exam.id}
                            className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            {publishingId === exam.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                            Publish
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {viewExam && (
        <ExamResultsModal
          exam={viewExam}
          allowPublish
          onClose={() => setViewExam(null)}
          onPublished={loadExams}
        />
      )}
    </div>
  );
}
