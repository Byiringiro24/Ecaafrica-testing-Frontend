import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Eye } from "lucide-react";
import { toast } from "sonner";
import { ExamResultsModal } from "@/components/exams/ExamResultsModal";
import {
  getFilterOptions,
  listAdminExams,
  examTypeLabel,
  statusBadgeClass,
  isPublished,
  type AdminExam,
  type SectionOption,
} from "@/lib/exams-admin-api";
import type { TermOption } from "@/lib/report-cards-api";
import { listTerms } from "@/lib/report-cards-api";

export const Route = createFileRoute("/exams/published/all")({
  component: AllPublishedExamsPage,
});

function AllPublishedExamsPage() {
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [sectionId, setSectionId] = useState("");
  const [termId, setTermId] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewExam, setViewExam] = useState<AdminExam | null>(null);

  useEffect(() => {
    Promise.all([getFilterOptions(), listTerms()])
      .then(([options, termOptions]) => {
        setSections(options.sections);
        setTerms(termOptions);
      })
      .catch(() => toast.error("Failed to load exam filters"));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setExams(
          await listAdminExams({
            section_id: sectionId || undefined,
            term_id: termId || undefined,
            limit: 500,
          }),
        );
      } catch (error) {
        toast.error("Failed to load exams");
        console.error(error);
      } finally {
        setLoading(false);
      }
    })();
  }, [sectionId, termId]);

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-lg font-bold">Whole exam register</h2>
        <p className="text-sm text-muted-foreground">
          View every exam across the school and filter it by class or term.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 mb-5 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium" htmlFor="all-exams-class">
            Filter by class
          </label>
          <select
            id="all-exams-class"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
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
          <label className="text-sm font-medium" htmlFor="all-exams-term">
            Filter by term
          </label>
          <select
            id="all-exams-term"
            value={termId}
            onChange={(e) => setTermId(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All terms</option>
            {terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading exams…</div>
        ) : exams.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No exams found</div>
        ) : (
          <table className="w-full min-w-[850px] text-sm">
            <thead className="bg-muted text-xs uppercase">
              <tr>
                <th className="text-left p-3">Exam</th>
                <th className="text-left p-3">Class</th>
                <th className="text-left p-3">Subject</th>
                <th className="text-left p-3">Term</th>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Type</th>
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
                  <td className="p-3">
                    {terms.find((term) => term.id === exam.term_id)?.name ?? "—"}
                  </td>
                  <td className="p-3">
                    {exam.exam_date ? new Date(exam.exam_date).toLocaleDateString() : "—"}
                  </td>
                  <td className="p-3">{examTypeLabel(exam.type, exam.exam_type?.name)}</td>
                  <td className="p-3">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${isPublished(exam) ? "bg-green-100 text-green-800" : statusBadgeClass(exam.status)}`}
                    >
                      {isPublished(exam) ? "Published" : "Unpublished"}
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
      {viewExam && <ExamResultsModal exam={viewExam} onClose={() => setViewExam(null)} />}
    </div>
  );
}
