import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, Eye, LockOpen, Loader2, List } from "lucide-react";
import { toast } from "sonner";
import { ExamFilters } from "@/components/exams/ExamFilters";
import { ExamResultsModal } from "@/components/exams/ExamResultsModal";
import { listTerms, type TermOption } from "@/lib/report-cards-api";
import {
  listAdminExams,
  getFilterOptions,
  isPublished,
  unpublishExamResults,
  type AdminExam,
  type SectionOption,
  type SubjectOption,
} from "@/lib/exams-admin-api";

export const Route = createFileRoute("/exams/published")({
  component: ExamsPublishedPage,
});

function ExamsPublishedPage() {
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [termId, setTermId] = useState("");
  const [publicationStatus, setPublicationStatus] = useState("published");
  const [loading, setLoading] = useState(true);
  const [viewExam, setViewExam] = useState<AdminExam | null>(null);
  const [unpublishingId, setUnpublishingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getFilterOptions(), listTerms()])
      .then(([opts, termOptions]) => {
        setSections(opts.sections);
        setSubjects(opts.subjects);
        setTerms(termOptions);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    loadExams();
  }, [sectionId, subjectId, termId, publicationStatus]);

  const loadExams = async () => {
    try {
      setLoading(true);
      const data = await listAdminExams({
        section_id: sectionId || undefined,
        subject_id: subjectId || undefined,
        term_id: termId || undefined,
        limit: 500,
      });
      setExams(
        data.filter((exam) =>
          publicationStatus === "published"
            ? isPublished(exam)
            : publicationStatus === "unpublished"
              ? !isPublished(exam)
              : true,
        ),
      );
    } catch (error) {
      toast.error("Failed to load published results");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnpublish = async (exam: AdminExam) => {
    if (
      !confirm(
        `Unpublish "${exam.name}"? Parents will no longer see these grades. The teacher will still need an approved grade-update request to edit them.`,
      )
    ) {
      return;
    }

    try {
      setUnpublishingId(exam.id);
      await unpublishExamResults(exam.id);
      toast.success("Results unpublished. Teacher editing still requires admin approval.");
      loadExams();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unpublish results");
    } finally {
      setUnpublishingId(null);
    }
  };

  const summary = useMemo(() => {
    const withRate = exams.filter((e) => e.pass_rate);
    const avgPass =
      withRate.length > 0
        ? Math.round(
            withRate.reduce((s, e) => s + parseFloat(e.pass_rate ?? "0"), 0) / withRate.length,
          )
        : null;
    const withAvg = exams.filter((e) => e.average_score);
    const avgScore =
      withAvg.length > 0
        ? (
            withAvg.reduce((s, e) => s + parseFloat(e.average_score ?? "0"), 0) / withAvg.length
          ).toFixed(1)
        : null;
    return {
      avgPass,
      avgScore,
      totalStudents: exams.reduce((s, e) => s + (e.marked_count ?? 0), 0),
    };
  }, [exams]);

  return (
    <div>
      <div className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Review exam publication status and performance summaries by class and subject.
          </p>
          <Link
            to="/exams/published/all"
            className="h-9 rounded-md border border-border px-3 text-sm font-semibold inline-flex items-center gap-2 hover:bg-muted"
          >
            <List className="h-4 w-4" /> Whole exam register
          </Link>
        </div>
      </div>

      <ExamFilters
        sections={sections}
        subjects={subjects}
        sectionId={sectionId}
        subjectId={subjectId}
        onSectionChange={setSectionId}
        onSubjectChange={setSubjectId}
      />

      <div className="rounded-xl border border-border bg-card p-4 mb-5">
        <label className="text-sm font-medium" htmlFor="published-term">
          Filter by term
        </label>
        <select
          id="published-term"
          value={termId}
          onChange={(e) => setTermId(e.target.value)}
          className="mt-1 h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All terms</option>
          {terms.map((term) => (
            <option key={term.id} value={term.id}>
              {term.name}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 mb-5">
        <label className="text-sm font-medium" htmlFor="publication-status">
          Filter by publication
        </label>
        <select
          id="publication-status"
          value={publicationStatus}
          onChange={(e) => setPublicationStatus(e.target.value)}
          className="mt-1 h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="published">Published</option>
          <option value="unpublished">Unpublished</option>
          <option value="all">All exams</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <div className="text-2xl font-display font-bold">{exams.length}</div>
          <div className="text-xs uppercase text-muted-foreground mt-1">
            {publicationStatus === "published"
              ? "Published Exams"
              : publicationStatus === "unpublished"
                ? "Unpublished Exams"
                : "All Exams"}
          </div>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
          <div className="text-2xl font-display font-bold text-green-700">
            {summary.avgPass !== null ? `${summary.avgPass}%` : "—"}
          </div>
          <div className="text-xs uppercase text-green-800/70 mt-1">Avg Pass Rate</div>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-center">
          <div className="text-2xl font-display font-bold text-indigo-700">
            {summary.avgScore ?? "—"}
          </div>
          <div className="text-xs uppercase text-indigo-800/70 mt-1">Avg Score</div>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Loading published results…</div>
      ) : exams.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          No{" "}
          {publicationStatus === "unpublished"
            ? "unpublished"
            : publicationStatus === "all"
              ? ""
              : "published"}{" "}
          exams found.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {exams.map((exam) => (
            <div key={exam.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <div className="font-display font-bold truncate">{exam.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {exam.section?.full_name} · {exam.subject?.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {exam.exam_date ? new Date(exam.exam_date).toLocaleDateString() : "—"}
                    {exam.teacher && ` · ${exam.teacher.name}`}
                  </div>
                </div>
                <Award className="h-5 w-5 text-amber-500 shrink-0" />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div className="rounded bg-indigo-50 p-2">
                  <div className="text-lg font-bold text-indigo-700">{exam.pass_rate ?? "—"}%</div>
                  <div className="text-[10px] uppercase">Pass Rate</div>
                </div>
                <div className="rounded bg-green-50 p-2">
                  <div className="text-lg font-bold text-green-700">
                    {exam.average_score ?? "—"}
                  </div>
                  <div className="text-[10px] uppercase">Avg Score</div>
                </div>
                <div className="rounded bg-muted/50 p-2">
                  <div className="text-lg font-bold">{exam.marked_count ?? 0}</div>
                  <div className="text-[10px] uppercase">Students</div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setViewExam(exam)}
                  className="h-8 flex-1 rounded-md border border-border text-xs font-semibold inline-flex items-center justify-center gap-1 hover:bg-muted"
                >
                  <Eye className="h-3.5 w-3.5" /> View Results
                </button>
                {isPublished(exam) && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleUnpublish(exam);
                    }}
                    disabled={unpublishingId === exam.id}
                    className="relative z-10 pointer-events-auto h-8 px-3 rounded-md border border-amber-300 text-amber-800 text-xs font-semibold inline-flex items-center justify-center gap-1 hover:bg-amber-50 disabled:opacity-50"
                    title="Unpublish exam results"
                  >
                    {unpublishingId === exam.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <LockOpen className="h-3.5 w-3.5" />
                    )}
                    Unpublish
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewExam && <ExamResultsModal exam={viewExam} onClose={() => setViewExam(null)} />}
    </div>
  );
}
