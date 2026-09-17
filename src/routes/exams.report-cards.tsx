import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Printer, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { ReportCard } from "@/components/reports/ReportCard";
import { studentIdNumber } from "@/lib/studentIdentity";
import { getFilterOptions, type SectionOption } from "@/lib/exams-admin-api";
import {
  getSectionReportCards,
  getStudentReportCard,
  listSectionStudents,
  listTerms,
  publishSectionReportCards,
  type ReportCardSchool,
  type ReportCardStudent,
  type ReportCardSubject,
  type ReportCardTerm,
  type TermOption,
} from "@/lib/report-cards-api";

export const Route = createFileRoute("/exams/report-cards")({
  component: ReportCardsPage,
});

type StudentOption = {
  id: string;
  student_school_id?: string | null;
  first_name: string;
  last_name: string;
  student_id_number?: string | null;
};

type LoadedCard = { student: ReportCardStudent; subjects: ReportCardSubject[] };

const ALL_STUDENTS = "__all__";

const selectClass =
  "mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

function ReportCardsPage() {
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);

  const [sectionId, setSectionId] = useState("");
  const [termId, setTermId] = useState("");
  const [studentId, setStudentId] = useState("");

  const [school, setSchool] = useState<ReportCardSchool | null>(null);
  const [term, setTerm] = useState<ReportCardTerm | null>(null);
  const [preparedBy, setPreparedBy] = useState<string | null>(null);
  const [issuedOn, setIssuedOn] = useState<string>("");
  const [cards, setCards] = useState<LoadedCard[]>([]);

  const [loading, setLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [opts, termList] = await Promise.all([getFilterOptions(), listTerms()]);
        setSections(opts.sections);
        setTerms(termList);
        const current = termList.find((item) => item.is_current);
        if (current) setTermId(current.id);
      } catch (error: any) {
        toast.error(error?.message ?? "Failed to load report card options");
      }
    })();
  }, []);

  useEffect(() => {
    setStudentId("");
    setStudents([]);
    setCards([]);
    if (!sectionId) return;

    (async () => {
      try {
        setStudentsLoading(true);
        const list = await listSectionStudents(sectionId);
        setStudents(list);
      } catch (error: any) {
        toast.error(error?.message ?? "Failed to load students");
      } finally {
        setStudentsLoading(false);
      }
    })();
  }, [sectionId]);

  const canGenerate = Boolean(sectionId && studentId);

  const handleGenerate = async () => {
    if (!canGenerate) return;

    try {
      setLoading(true);
      if (studentId === ALL_STUDENTS) {
        const data = await getSectionReportCards(sectionId, termId || undefined);
        setSchool(data.school);
        setTerm(data.term);
        setPreparedBy(data.prepared_by);
        setIssuedOn(data.issued_on);
        setCards(data.cards);
        if (data.cards.length === 0) {
          toast.info("No students enrolled in this class");
        }
      } else {
        const data = await getStudentReportCard(studentId, termId || undefined);
        setSchool(data.school);
        setTerm(data.term);
        setPreparedBy(data.prepared_by);
        setIssuedOn(data.issued_on);
        setCards([{ student: data.student, subjects: data.subjects }]);
      }
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to generate report card");
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  const hasResults = useMemo(
    () => cards.some((card) => card.subjects.length > 0),
    [cards]
  );

  const handlePublish = async () => {
    if (!sectionId) return;
    const termName = termId
      ? terms.find((item) => item.id === termId)?.name ?? "this term"
      : "the current term";

    if (
      !confirm(
        `Publish all exam results for this class (${termName}) to parents' Reports screens? This cannot be undone until you unpublish.`
      )
    ) {
      return;
    }

    try {
      setPublishing(true);
      const result = await publishSectionReportCards(sectionId, termId || undefined);
      toast.success(
        `Published ${result.published_exams} exam(s) — ${result.published_results} result(s) now visible to parents.`
      );
      if (result.skipped.length > 0) {
        const summary = result.skipped
          .map((item) => `${item.name} (${item.reason})`)
          .join(", ");
        toast.info(`Skipped: ${summary}`);
      }
      setCards([]);
      if (studentId) handleGenerate();
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to publish report cards");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div>
      <div className="no-print">
        <p className="mb-4 text-sm text-muted-foreground">
          Generate a printable report card from published results. Pick a class, a term and a
          student, then print or save as PDF.
        </p>

        <div className="mb-5 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-4">
          <div>
            <label className="text-sm font-medium">Class</label>
            <select
              value={sectionId}
              onChange={(event) => setSectionId(event.target.value)}
              className={selectClass}
            >
              <option value="">Select class</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Term</label>
            <select
              value={termId}
              onChange={(event) => setTermId(event.target.value)}
              className={selectClass}
            >
              <option value="">Current term</option>
              {terms.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.is_current ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Student</label>
            <select
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              disabled={!sectionId || studentsLoading}
              className={`${selectClass} disabled:opacity-50`}
            >
              <option value="">
                {studentsLoading ? "Loading students…" : "Select student"}
              </option>
              {students.length > 0 && (
                <option value={ALL_STUDENTS}>All students in class</option>
              )}
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.first_name} {student.last_name}
                  {` · Student ID Number: ${studentIdNumber(student)}`}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate || loading}
              className="h-9 flex-1 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : (
                "Generate"
              )}
            </button>
            {cards.length > 0 && (
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold hover:bg-muted"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
            )}
            {sectionId && (
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-green-600 px-4 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {publishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Publish All Results
              </button>
            )}
          </div>
        </div>

        {cards.length > 0 && !hasResults && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            No published results found for this term. Publish exam results from the Review
            Submissions tab first.
          </div>
        )}
      </div>

      {school && term && cards.length > 0 && (
        <div className="print-area space-y-8">
          {cards.map((card) => (
            <div key={card.student.id} className="report-card-page">
              <ReportCard
                school={school}
                term={term}
                student={card.student}
                subjects={card.subjects}
                preparedBy={preparedBy}
                issuedOn={issuedOn}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
