import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Printer, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ReportCard } from "@/components/reports/ReportCard";
import { getFilterOptions, type SectionOption } from "@/lib/exams-admin-api";
import {
  getSectionReportCards,
  getStudentReportCard,
  listSectionStudents,
  listTerms,
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
                  {student.student_id_number ? ` (${student.student_id_number})` : ""}
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
