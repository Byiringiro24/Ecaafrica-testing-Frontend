import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { teacherRouteGuard } from "@/lib/schoolAuth";
import { Plus, X, Award, ChevronLeft, ChevronRight, Loader2, ArrowLeft, MessageSquare } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { toast } from "sonner";
import { TeacherLayout } from "@/components/layout/TeacherLayout";
import {
  getTeacherExams,
  createExam,
  getStudentsInSection,
  recordExamResults,
  getExamResults,
  updateExam,
  getTeacherAssignments,
  requestExamModification,
  computeGrade,
  studentDisplayName,
  type TeacherAssignmentPair,
  type TeacherExam,
  type Student,
  type ExamResult,
} from "@/lib/exams-api";
import { listTerms, type TermOption } from "@/lib/report-cards-api";
import { getPassPercentage, listGradingRoles, listExamTypes, type ExamTypeOption, type GradingRole } from "@/lib/exam-configuration-api";
import { listExamModificationRequests, type ExamModificationRequest } from "@/lib/exams-admin-api";

export const Route = createFileRoute("/teacher/exams")({
  beforeLoad: ({ location }) => teacherRouteGuard(location),
  component: TeacherExams,
});

function computeConfiguredGrade(score: number, maxMarks: number, roles: GradingRole[]): string {
  const percentage = maxMarks > 0 ? (score / maxMarks) * 100 : 0;
  const role = roles.find((item) => percentage >= Number(item.min_percentage) && percentage <= Number(item.max_percentage));
  return role?.code ?? computeGrade(score, maxMarks);
}

function TeacherExams() {
  const [tab, setTab] = useState<"upcoming" | "enter" | "recorded" | "published" | "performance">("upcoming");
  const [createOpen, setCreateOpen] = useState(false);
  const [viewExam, setViewExam] = useState<TeacherExam | null>(null);
  const [exams, setExams] = useState<TeacherExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<{
    sections: Array<{ id: string; name: string; full_name: string; class_id: string }>;
    subjects: Array<{ id: string; name: string; code?: string }>;
    assignments: TeacherAssignmentPair[];
  } | null>(null);
  const [assignedSubjects, setAssignedSubjects] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [gradingRoles, setGradingRoles] = useState<GradingRole[]>([]);

  useEffect(() => {
    loadAssignments();
    loadGradingRoles();
  }, []);

  useEffect(() => {
    if (tab === "enter" || tab === "recorded" || tab === "performance") return;
    loadExams();
  }, [tab, selectedSectionId, selectedSubjectId]);

  const loadAssignments = async () => {
    try {
      setAssignmentsLoading(true);
      const data = await getTeacherAssignments();
      setAssignments(data);
      setAssignedSubjects(data.subjects || []);
    } catch (error) {
      toast.error("Failed to load your class assignments");
      console.error(error);
    } finally {
      setAssignmentsLoading(false);
    }
  };

  const loadGradingRoles = async () => {
    try {
      setGradingRoles(await listGradingRoles());
    } catch (error) {
      console.error(error);
    }
  };

  const loadExams = async () => {
    try {
      setLoading(true);
      const status = tab === "upcoming" ? "scheduled" : tab === "published" || tab === "performance" ? "completed" : undefined;
      const data = await getTeacherExams({
        status,
        section_id: selectedSectionId || undefined,
        subject_id: selectedSubjectId || undefined,
      });
      setExams(data);
    } catch (error) {
      toast.error("Failed to load exams");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const upcoming = exams.filter((exam) => exam.status === "scheduled" || exam.status === "ongoing");
  const published = exams.filter((exam) => exam.status === "completed" || exam.status === "cancelled");

  return (
    <TeacherLayout title="Exams & Results" subtitle="Schedule exams and submit student marks">
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-1 border-b border-border">
          {([['upcoming', 'Upcoming Exams'], ['enter', 'Enter Results'], ['recorded', 'Recorded Grades'], ['published', 'Published Results'], ['performance', 'Student Performance']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 ${tab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'upcoming' && (
          <button
            onClick={() => setCreateOpen(true)}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Create Exam
          </button>
        )}
      </div>

      {assignmentsLoading ? (
        <div className="rounded-xl border border-border bg-card p-4 mb-5 text-sm text-muted-foreground">Loading teacher assignments…</div>
      ) : assignments ? (
        <>
          <div className="rounded-xl border border-border bg-card p-4 mb-5 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Filter by class</label>
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All classes</option>
                {assignments.sections.map((section) => (
                  <option key={section.id} value={section.id}>{section.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Filter by subject</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All subjects</option>
                {assignedSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-border bg-card p-4 mb-5 text-sm text-muted-foreground">No teacher assignment info found.</div>
      )}

      {tab === 'upcoming' && (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading exams...</div>
          ) : upcoming.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No upcoming exams</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase">
                <tr>
                  <th className="text-left p-3">Exam</th>
                  <th className="text-left p-3">Class</th>
                  <th className="text-left p-3">Subject</th>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Max Marks</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((exam, index) => (
                  <tr key={exam.id} className={`border-t ${index % 2 ? 'bg-gray-50' : ''}`}>
                    <td className="p-3 font-medium">{exam.name}</td>
                    <td className="p-3">{exam.section?.full_name || '—'}</td>
                    <td className="p-3">{exam.subject?.name || '—'}</td>
                    <td className="p-3">{exam.exam_date ? new Date(exam.exam_date).toLocaleDateString() : '—'}</td>
                    <td className="p-3">{exam.max_marks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'enter' && (
        <EnterResults
          sectionId={selectedSectionId}
          subjectId={selectedSubjectId}
          assignedSubjects={assignedSubjects}
          gradingRoles={gradingRoles}
        />
      )}

      {tab === 'recorded' && (
        <RecordedGrades gradingRoles={gradingRoles} sectionId={selectedSectionId} subjectId={selectedSubjectId} />
      )}

      {tab === 'published' && (
        <div>
          {loading ? (
            <div className="text-center p-8 text-muted-foreground">Loading results...</div>
          ) : published.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">No published results</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {published.map((exam) => (
                <div key={exam.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-display font-bold">{exam.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {exam.section?.full_name} · {exam.exam_date ? new Date(exam.exam_date).toLocaleDateString() : '—'}
                      </div>
                    </div>
                    <Award className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center mb-3">
                    <div className="rounded bg-indigo-50 p-2">
                      <div className="text-lg font-bold text-indigo-700">{exam.pass_rate || '0'}%</div>
                      <div className="text-[10px] uppercase">Pass Rate</div>
                    </div>
                    <div className="rounded bg-indigo-50 p-2">
                      <div className="text-lg font-bold text-indigo-700">{exam.average_score || '0'}</div>
                      <div className="text-[10px] uppercase">Avg Score</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setViewExam(exam)}
                    className="w-full h-8 rounded-md border border-border text-xs font-semibold hover:bg-muted"
                  >
                    View Full Results
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'performance' && (
        <StudentPerformance
          sectionId={selectedSectionId}
          subjectId={selectedSubjectId}
        />
      )}

      {createOpen && <CreateExamModal gradingRoles={gradingRoles} onClose={() => { setCreateOpen(false); loadExams(); }} />}
      {viewExam && <ResultsModal exam={viewExam} onClose={() => setViewExam(null)} />}
    </TeacherLayout>
  );
}

function CreateExamModal({ onClose, gradingRoles }: { onClose: () => void; gradingRoles: GradingRole[] }) {
  const [loading, setLoading] = useState(false);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [termsLoading, setTermsLoading] = useState(true);
  const [examTypesLoading, setExamTypesLoading] = useState(true);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [examTypes, setExamTypes] = useState<ExamTypeOption[]>([]);
  const [sections, setSections] = useState<Array<{ id: string; name: string; full_name: string }>>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [assignmentPairs, setAssignmentPairs] = useState<TeacherAssignmentPair[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    section_id: "",
    subject_id: "",
    term_id: "",
    exam_type_id: "",
    type: "cat",
    exam_date: new Date().toISOString().slice(0, 10),
    max_marks: 100,
    pass_mark: 50,
  });
  const passPercentage = useMemo(() => getPassPercentage(gradingRoles), [gradingRoles]);
  const calculatedPassMark = Math.round(formData.max_marks * passPercentage) / 100;

  useEffect(() => {
    loadTeacherAssignments();
    loadTerms();
    loadExamTypes();
  }, []);

  const availableSubjects = useMemo(() => {
    if (!formData.section_id) return subjects;
    const ids = new Set(
      assignmentPairs
        .filter((item) => item.section_id === formData.section_id)
        .map((item) => item.subject_id)
    );
    return subjects.filter((subject) => ids.has(subject.id));
  }, [assignmentPairs, formData.section_id, subjects]);

  const loadTeacherAssignments = async () => {
    try {
      setAssignmentsLoading(true);
      const data = await getTeacherAssignments();
      setSections(data.sections || []);
      setSubjects(data.subjects || []);
      setAssignmentPairs(data.assignments || []);
    } catch (error) {
      toast.error("Failed to load teacher assignments");
      console.error(error);
    } finally {
      setAssignmentsLoading(false);
    }
  };

  const loadTerms = async () => {
    try {
      setTermsLoading(true);
      setTerms(await listTerms());
    } catch (error) {
      toast.error("Failed to load school terms");
      console.error(error);
    } finally {
      setTermsLoading(false);
    }
  };

  const loadExamTypes = async () => {
    try {
      setExamTypesLoading(true);
      const types = await listExamTypes();
      setExamTypes(types);
      setFormData((current) => {
        if (current.exam_type_id || types.length === 0) return current;
        return { ...current, exam_type_id: types[0].id };
      });
    } catch (error) {
      toast.error("Failed to load exam types");
      console.error(error);
    } finally {
      setExamTypesLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formData.name || !formData.section_id || !formData.subject_id || !formData.term_id || !formData.exam_type_id) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);
      await createExam({ ...formData, pass_mark: calculatedPassMark });
      toast.success("Exam created successfully");
      onClose();
    } catch (error) {
      toast.error("Failed to create exam");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold">Create Exam</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {assignmentsLoading || termsLoading || examTypesLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading classes and subjects…</div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            {terms.length === 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                No terms are registered for this school. Please contact the school system administrator to create a term before creating an exam.
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Exam Name *</label>
              <input
                required
                placeholder="Term 2 Mathematics CAT"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Class *</label>
                <select
                  required
                  value={formData.section_id}
                  onChange={(e) => setFormData({ ...formData, section_id: e.target.value, subject_id: "" })}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select class</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.full_name || section.name}
                    </option>
                  ))}
                </select>
                {sections.length === 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">No assigned classes found. Please contact your administrator if this is incorrect.</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Subject *</label>
                <select
                  required
                  value={formData.subject_id}
                  onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select subject</option>
                  {availableSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
                {availableSubjects.length === 0 && formData.section_id && (
                  <p className="mt-2 text-xs text-muted-foreground">No subjects assigned for this class.</p>
                )}
                {!formData.section_id && subjects.length === 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">No assigned subjects found. Please contact your administrator.</p>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Term *</label>
              <select
                required
                value={formData.term_id}
                onChange={(e) => setFormData({ ...formData, term_id: e.target.value })}
                disabled={terms.length === 0}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">Select term</option>
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name}{term.is_current ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Exam Date</label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().slice(0, 10)}
                  value={formData.exam_date}
                  onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <select
                  required
                  value={formData.exam_type_id}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, exam_type_id: value, type: "cat" });
                  }}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {examTypes.map((examType) => (
                    <option key={examType.id} value={examType.id}>{examType.name}</option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-muted-foreground">Custom types are managed by your school administrator.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Max Marks</label>
                <input
                  type="number"
                  value={formData.max_marks}
                  onChange={(e) => setFormData({ ...formData, max_marks: parseInt(e.target.value, 10) || 0 })}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Pass Mark (auto-calculated)</label>
                <input
                  type="number"
                  value={calculatedPassMark}
                  readOnly
                  aria-readonly="true"
                  className="mt-1 h-9 w-full rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground"
                />
                <p className="mt-2 text-xs text-muted-foreground">Based on the configured {passPercentage}% passing threshold.</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 rounded-md border border-border text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || terms.length === 0}
                className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Exam
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function RecordedGrades({ gradingRoles, sectionId, subjectId }: { gradingRoles: GradingRole[]; sectionId: string; subjectId: string }) {
  const [exams, setExams] = useState<TeacherExam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const data = await getTeacherExams({ section_id: sectionId || undefined, subject_id: subjectId || undefined });
      setExams(data.filter((exam) => (exam.marked_count ?? 0) > 0));
    } catch (error) {
      toast.error("Failed to load recorded grades");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [sectionId, subjectId]);

  if (selectedExamId) {
    return <EnterResults sectionId={sectionId} subjectId={subjectId} assignedSubjects={[]} gradingRoles={gradingRoles} initialExamId={selectedExamId} recordedMode onBack={() => { setSelectedExamId(null); load(); }} />;
  }

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">Select a recorded exam to review or edit draft marks.</p>
      {loading ? <div className="p-8 text-center text-muted-foreground">Loading recorded grades…</div> : exams.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">No recorded grades yet.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam) => (
            <button key={exam.id} onClick={() => setSelectedExamId(exam.id)} className="rounded-xl border border-border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary">
              <div className="flex items-start justify-between gap-3"><div><div className="font-display font-bold">{exam.name}</div><div className="mt-1 text-xs text-muted-foreground">{exam.section?.full_name ?? "—"} · {exam.subject?.name ?? "—"}</div></div><Award className="h-5 w-5 text-amber-500" /></div>
              <div className="mt-4 flex items-center justify-between text-sm"><span>{exam.marked_count ?? 0} marked · Max {exam.max_marks}</span><span className={`rounded-full px-2 py-1 text-xs font-semibold ${exam.status === "scheduled" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{exam.status === "scheduled" ? "Draft" : "Submitted"}</span></div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EnterResults({
  sectionId,
  subjectId,
  assignedSubjects,
  gradingRoles,
  initialExamId,
  recordedMode = false,
  onBack,
}: {
  sectionId: string;
  subjectId: string;
  assignedSubjects: Array<{ id: string; name: string; code?: string }>;
  gradingRoles: GradingRole[];
  initialExamId?: string;
  recordedMode?: boolean;
  onBack?: () => void;
}) {
  const [exams, setExams] = useState<TeacherExam[]>([]);
  const [selectedExam, setSelectedExam] = useState<TeacherExam | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [results, setResults] = useState<Record<string, { score: string; remarks: string; is_absent: boolean }>>({});
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingExams, setLoadingExams] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadExams();
  }, [sectionId, subjectId]);

  const loadExams = async () => {
    try {
      setLoadingExams(true);
      const data = await getTeacherExams({
        section_id: sectionId || undefined,
        subject_id: subjectId || undefined,
      });
      // Submitted and published exams stay in the list for read-only review.
      const eligible = data.filter(
        (exam) =>
          exam.status === "scheduled" ||
          exam.status === "ongoing" ||
          exam.status === "completed"
      );
      setExams(eligible);
      setSelectedExam(eligible.find((exam) => exam.id === initialExamId) || eligible[0] || null);
    } catch (error) {
      toast.error("Failed to load exams");
      console.error(error);
    } finally {
      setLoadingExams(false);
    }
  };

  const handleLoadStudents = async () => {
    if (!selectedExam || !selectedExam.section_id) {
      toast.error("Please select an exam with a class assigned");
      return;
    }

    try {
      setLoading(true);
      const [studentData, existingResults] = await Promise.all([
        getStudentsInSection(selectedExam.section_id),
        getExamResults(selectedExam.id).catch(() => ({ results: [] as ExamResult[] })),
      ]);
      setStudents(studentData);

      const prefilled: Record<string, { score: string; remarks: string; is_absent: boolean }> = {};
      for (const result of existingResults.results ?? []) {
        prefilled[result.student_id] = {
          score: result.marks_obtained ?? "",
          remarks: result.remarks ?? "",
          is_absent: result.is_absent,
        };
      }
      setResults(prefilled);
      setLoaded(true);
    } catch (error) {
      toast.error("Failed to load students");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialExamId && selectedExam?.id === initialExamId && !loaded) {
      handleLoadStudents();
    }
  }, [initialExamId, selectedExam?.id]);

  const buildPayload = () => {
    const maxMarks = selectedExam ? parseFloat(selectedExam.max_marks) : 100;
    return Object.entries(results)
      .filter(([, result]) => result.score || result.is_absent)
      .map(([student_id, result]) => {
        const score = result.is_absent ? undefined : result.score;
        const numericScore = score ? parseFloat(score) : NaN;
        return {
          student_id,
          score,
          remarks: result.remarks,
          is_absent: result.is_absent,
          grade: !result.is_absent && !Number.isNaN(numericScore)
            ? computeConfiguredGrade(numericScore, maxMarks, gradingRoles)
            : undefined,
        };
      });
  };

  const handleSaveDraft = async () => {
    if (!selectedExam) return;
    const payload = buildPayload();
    if (payload.length === 0) {
      toast.error("Please enter at least one result");
      return;
    }

    try {
      setSubmitting(true);
      await recordExamResults(selectedExam.id, payload);
      toast.success("Results saved as draft");
    } catch (error) {
      toast.error("Failed to save results");
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitResults = async () => {
    if (!selectedExam) return;
    const payload = buildPayload();
    if (payload.length === 0) {
      toast.error("Please enter at least one result");
      return;
    }

    try {
      setSubmitting(true);
      await recordExamResults(selectedExam.id, payload);
      await updateExam(selectedExam.id, { status: "ongoing" });
      toast.success("Results submitted for admin review");
      setLoaded(false);
      setResults({});
      loadExams();
    } catch (error) {
      toast.error("Failed to submit results");
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const gradeForScore = (score: number, maxMarks: number) => computeConfiguredGrade(score, maxMarks, gradingRoles);

  // Publication controls visibility. Editing is controlled separately by the
  // approved-request state (scheduled), so unpublishing does not unlock marks.
  const isPublished = Boolean(selectedExam?.published_at);
  const canEdit = selectedExam?.status === "scheduled";
  const [requestReason, setRequestReason] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [modificationRequests, setModificationRequests] = useState<ExamModificationRequest[]>([]);
  const [requestHistoryPage, setRequestHistoryPage] = useState(0);
  const requestHistoryPageSize = 5;

  useEffect(() => {
    if (!selectedExam) {
      setModificationRequests([]);
      setRequestHistoryPage(0);
      return;
    }
    setRequestHistoryPage(0);
    listExamModificationRequests()
      .then((requests) => setModificationRequests(requests.filter((request) => request.exam_id === selectedExam.id)))
      .catch((error) => console.error("Failed to load modification request history", error));
  }, [selectedExam?.id]);

  const handleModificationRequest = async () => {
    if (!selectedExam || requestReason.trim().length < 5) return toast.error("Please provide a reason of at least 5 characters");
    try {
      setRequesting(true);
      await requestExamModification(selectedExam.id, requestReason.trim());
      toast.success("Modification request sent to the school administrator");
      setRequestReason("");
      const requests = await listExamModificationRequests();
      setModificationRequests(requests.filter((request) => request.exam_id === selectedExam.id));
      setRequestHistoryPage(0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send modification request");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div>
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-wrap items-end gap-3 mb-5">
        {assignedSubjects.length > 0 && (
          <div className="w-full sm:w-56">
            <label className="text-xs font-semibold text-muted-foreground">Filter by subject</label>
            <div className="mt-1 h-9 rounded-md border border-input bg-muted/40 px-3 text-sm flex items-center">
              {subjectId
                ? assignedSubjects.find((subject) => subject.id === subjectId)?.name ?? "Selected subject"
                : "All assigned subjects"}
            </div>
          </div>
        )}
        <div className="flex-1 min-w-[220px]">
          <label className="text-xs font-semibold text-muted-foreground">Exam</label>
          <select
            value={selectedExam?.id || ""}
            onChange={(e) => {
              setSelectedExam(exams.find((exam) => exam.id === e.target.value) || null);
              setLoaded(false);
            }}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Select exam</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.name} — {exam.section?.full_name || exam.section_id}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleLoadStudents}
          disabled={loading || !selectedExam}
          className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          {loading ? "Loading..." : "Load Students"}
        </button>
      </div>

      {loadingExams && <div className="p-8 text-center text-muted-foreground">Loading exams…</div>}

      {!loadingExams && exams.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">No scheduled exams available.</div>
      )}

      {loaded && selectedExam && (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-border text-sm flex items-center justify-between gap-3">
            {onBack && <button onClick={onBack} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back</button>}
            <b>{selectedExam.name}</b> · {selectedExam.section?.full_name} · Max marks: {selectedExam.max_marks} · {Object.keys(results).filter((key) => results[key].score || results[key].is_absent).length}/{students.length} marked
          </div>
          <div className="border-b border-border bg-muted/30 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Grade calculation</div>
            {gradingRoles.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {gradingRoles.map((role) => (
                  <span key={role.id} className="rounded-md border border-border bg-background px-2 py-1 text-xs">
                    <b>{role.code}</b> {role.label} · {role.min_percentage}%–{role.max_percentage}%
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">No active grading roles configured; the default grading scale is being used.</p>
            )}
          </div>
          {isPublished && (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              These results have been published by the school administrator and can no longer
              be edited. Contact your administrator if a correction is needed.
            </div>
          )}
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase">
              <tr>
                <th className="text-left p-3">Student</th>
                <th className="text-left p-3">Marks</th>
                <th className="text-left p-3">Grade</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Comments</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, index) => {
                const result = results[student.id] || { score: "", remarks: "", is_absent: false };
                const maxMarks = parseFloat(selectedExam.max_marks);
                const value = result.score ? parseFloat(result.score) : NaN;
                const valid = !isNaN(value) && value >= 0 && value <= maxMarks;
                const grade = result.is_absent ? "Abs" : valid && result.score ? gradeForScore(value, maxMarks) : null;

                return (
                  <tr key={student.id} className={`border-t ${index % 2 ? 'bg-gray-50' : ''}`}>
                    <td className="p-3 font-medium">{student.first_name} {student.last_name}</td>
                    <td className="p-3">
                      <input
                        type="number"
                        min={0}
                        max={maxMarks}
                        disabled={result.is_absent || isPublished || !canEdit}
                        value={result.score}
                        onChange={(e) => setResults({
                          ...results,
                          [student.id]: { ...result, score: e.target.value, is_absent: false },
                        })}
                        className={`h-8 w-20 rounded-md border bg-background px-2 text-sm disabled:opacity-50 ${result.score && !valid ? 'border-red-500' : 'border-input'}`}
                      />
                      <span className="text-xs text-muted-foreground ml-2">/ {maxMarks}</span>
                    </td>
                    <td className="p-3">
                      {grade && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          grade === 'A' ? 'bg-green-100 text-green-800' :
                          grade === 'B' ? 'bg-blue-100 text-blue-800' :
                          grade === 'C' ? 'bg-yellow-100 text-yellow-800' :
                          grade === 'D' ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {grade}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={result.is_absent}
                          disabled={isPublished || !canEdit}
                          onChange={(e) => setResults({
                            ...results,
                            [student.id]: { ...result, is_absent: e.target.checked, score: e.target.checked ? '' : result.score },
                          })}
                          className="rounded border-input disabled:opacity-50"
                        />
                        <span className="text-xs">Absent</span>
                      </label>
                    </td>
                    <td className="p-3">
                      <input
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50"
                        placeholder="Comment shown on the report card"
                        disabled={isPublished || !canEdit}
                        value={result.remarks}
                        onChange={(e) => setResults({
                          ...results,
                          [student.id]: { ...result, remarks: e.target.value },
                        })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!isPublished && canEdit && (
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <button
                onClick={handleSaveDraft}
                disabled={submitting}
                className="h-9 px-4 rounded-md border border-border text-sm font-semibold"
              >
                Save Draft
              </button>
              <button
                onClick={handleSubmitResults}
                disabled={submitting}
                className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold"
              >
                {submitting ? 'Submitting...' : 'Submit for Review'}
              </button>
            </div>
          )}
          {!canEdit && (
            <div className="border-t border-border bg-amber-50 p-4">
              <div className="text-sm font-semibold text-amber-900">These results are locked for editing.</div>
              <p className="mt-1 text-xs text-amber-800">Unpublishing does not unlock results. Ask the school administrator to approve a grade-update request.</p>
              <textarea value={requestReason} onChange={(e) => setRequestReason(e.target.value)} className="mt-3 min-h-20 w-full rounded-md border border-amber-200 bg-white p-2 text-sm" placeholder="Reason for modification request" />
              <button onClick={handleModificationRequest} disabled={requesting} className="mt-2 inline-flex h-9 items-center gap-2 rounded-md bg-amber-700 px-4 text-sm font-semibold text-white disabled:opacity-50"><MessageSquare className="h-4 w-4" />{requesting ? "Sending…" : "Request modification"}</button>
              <div className="mt-4 border-t border-amber-200 pt-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-amber-900">Recent request history</div>
                {modificationRequests.length === 0 ? (
                  <p className="mt-2 text-xs text-amber-800">No modification requests for this exam yet.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {modificationRequests.slice(requestHistoryPage * requestHistoryPageSize, (requestHistoryPage + 1) * requestHistoryPageSize).map((request) => (
                      <div key={request.id} className="rounded-md border border-amber-200 bg-white/70 p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold capitalize">{request.status}</span>
                          <span className="text-amber-800">{new Date(request.created_at).toLocaleString()}</span>
                        </div>
                        <div className="mt-1 text-amber-950">{request.reason}</div>
                      </div>
                    ))}
                    {modificationRequests.length > requestHistoryPageSize && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-amber-800">
                          Showing {requestHistoryPage * requestHistoryPageSize + 1}–{Math.min((requestHistoryPage + 1) * requestHistoryPageSize, modificationRequests.length)} of {modificationRequests.length}
                        </span>
                        <div className="flex gap-1">
                          <button onClick={() => setRequestHistoryPage((page) => page - 1)} disabled={requestHistoryPage === 0} className="inline-flex h-7 items-center gap-1 rounded border border-amber-300 px-2 text-[11px] font-semibold text-amber-900 disabled:opacity-40"><ChevronLeft className="h-3 w-3" /> Previous</button>
                          <button onClick={() => setRequestHistoryPage((page) => page + 1)} disabled={(requestHistoryPage + 1) * requestHistoryPageSize >= modificationRequests.length} className="inline-flex h-7 items-center gap-1 rounded border border-amber-300 px-2 text-[11px] font-semibold text-amber-900 disabled:opacity-40">Next <ChevronRight className="h-3 w-3" /></button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StudentPerformance({
  sectionId,
  subjectId,
}: {
  sectionId: string;
  subjectId: string;
}) {
  const [exams, setExams] = useState<TeacherExam[]>([]);
  const [selectedExam, setSelectedExam] = useState<TeacherExam | null>(null);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoadingExams(true);
        const data = await getTeacherExams({
          status: "completed",
          section_id: sectionId || undefined,
          subject_id: subjectId || undefined,
        });
        setExams(data);
        const first = data[0] || null;
        setSelectedExam(first);
        if (first) await loadResults(first.id);
        else setResults([]);
      } catch (error) {
        toast.error("Failed to load performance exams");
        console.error(error);
      } finally {
        setLoadingExams(false);
      }
    })();
  }, [sectionId, subjectId]);

  const loadResults = async (examId: string) => {
    try {
      setLoadingResults(true);
      const data = await getExamResults(examId);
      setResults(data.results ?? []);
    } catch (error) {
      toast.error("Failed to load exam performance");
      console.error(error);
    } finally {
      setLoadingResults(false);
    }
  };

  const distribution = () => {
    const stats: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    results.forEach((result) => {
      if (result.grade && stats[result.grade] !== undefined) {
        stats[result.grade] += 1;
      }
    });
    return [
      { grade: 'A', count: stats.A },
      { grade: 'B', count: stats.B },
      { grade: 'C', count: stats.C },
      { grade: 'D', count: stats.D },
      { grade: 'F', count: stats.F },
    ];
  };

  const selectedExamResults = results;
  const passCount = selectedExamResults.filter((result) => {
    if (!selectedExam || !result.marks_obtained) return false;
    const score = parseFloat(result.marks_obtained);
    const passMark = parseFloat(selectedExam.pass_mark);
    return !Number.isNaN(score) && score >= passMark;
  }).length;
  const averageScore = selectedExamResults.length
    ? (selectedExamResults.reduce((sum, result) => sum + (parseFloat(result.marks_obtained || '0') || 0), 0) / selectedExamResults.length).toFixed(1)
    : '0';

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="font-display font-bold text-lg">Student Performance</h2>
          <p className="text-sm text-muted-foreground">Review published exam results and student performance trends.</p>
        </div>
        <div className="w-full sm:w-auto">
          <label className="text-xs uppercase text-muted-foreground">Choose exam</label>
          <select
            value={selectedExam?.id || ''}
            onChange={async (e) => {
              const exam = exams.find((item) => item.id === e.target.value) || null;
              setSelectedExam(exam);
              if (exam) {
                await loadResults(exam.id);
              }
            }}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Select published exam</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>{exam.name} · {exam.section?.full_name || exam.section_id}</option>
            ))}
          </select>
        </div>
      </div>

      {loadingExams ? (
        <div className="p-8 text-center text-muted-foreground">Loading performance exams…</div>
      ) : !selectedExam ? (
        <div className="p-8 text-center text-muted-foreground">Select a published exam to view student performance.</div>
      ) : loadingResults ? (
        <div className="p-8 text-center text-muted-foreground">Loading performance details…</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3 mb-6">
            <div className="rounded-xl bg-muted p-4 text-center">
              <div className="text-xs uppercase text-muted-foreground">Total Students</div>
              <div className="mt-2 text-3xl font-bold">{selectedExamResults.length}</div>
            </div>
            <div className="rounded-xl bg-muted p-4 text-center">
              <div className="text-xs uppercase text-muted-foreground">Pass Rate</div>
              <div className="mt-2 text-3xl font-bold">{selectedExamResults.length ? Math.round((passCount / selectedExamResults.length) * 100) : 0}%</div>
            </div>
            <div className="rounded-xl bg-muted p-4 text-center">
              <div className="text-xs uppercase text-muted-foreground">Avg Score</div>
              <div className="mt-2 text-3xl font-bold">{averageScore}</div>
            </div>
          </div>

          <div className="mb-6 rounded-xl border border-border bg-background p-4">
            <div className="text-sm font-semibold mb-3">Grade Distribution</div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="grade" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase">
                <tr>
                  <th className="text-left p-3">Student</th>
                  <th className="text-center p-3">Marks</th>
                  <th className="text-center p-3">Grade</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-left p-3">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {selectedExamResults.map((result, index) => (
                  <tr key={result.id} className={`${index % 2 ? 'bg-gray-50' : ''}`}>
                    <td className="p-3">{studentDisplayName(result)}</td>
                    <td className="text-center p-3">{result.is_absent ? 'Absent' : `${result.marks_obtained ?? '0'}/${selectedExam.max_marks}`}</td>
                    <td className="text-center p-3">{result.grade || '—'}</td>
                    <td className="text-center p-3">{result.is_absent ? 'Absent' : 'Present'}</td>
                    <td className="p-3">{result.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function ResultsModal({ exam, onClose }: { exam: TeacherExam; onClose: () => void }) {
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResults();
  }, [exam.id]);

  const loadResults = async () => {
    try {
      setLoading(true);
      const data = await getExamResults(exam.id);
      setResults(data.results ?? []);
    } catch (error) {
      toast.error("Failed to load results");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const buildDistribution = () => {
    const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    results.forEach((result) => {
      if (result.grade) {
        dist[result.grade] = (dist[result.grade] || 0) + 1;
      }
    });
    return [
      { grade: 'A', count: dist.A },
      { grade: 'B', count: dist.B },
      { grade: 'C', count: dist.C },
      { grade: 'D', count: dist.D },
      { grade: 'F', count: dist.F },
    ];
  };

  const distribution = buildDistribution();
  const totalMarked = results.filter((result) => result.marks_obtained || result.is_absent).length;
  const passCount = results.filter((result) => {
    if (!result.marks_obtained) return false;
    const score = parseFloat(result.marks_obtained);
    const passMark = parseFloat(exam.pass_mark);
    return !isNaN(score) && !isNaN(passMark) && score >= passMark;
  }).length;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl bg-background p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-lg font-bold">{exam.name}</h3>
            <div className="text-xs text-muted-foreground">{exam.section?.full_name} · {exam.exam_date ? new Date(exam.exam_date).toLocaleDateString() : '—'}</div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-lg bg-muted p-3">
            <div className="text-xs text-muted-foreground">Total Students</div>
            <div className="text-2xl font-bold">{results.length}</div>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <div className="text-xs text-muted-foreground">Pass Rate</div>
            <div className="text-2xl font-bold">{results.length ? Math.round((passCount / results.length) * 100) : 0}%</div>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <div className="text-xs text-muted-foreground">Marked</div>
            <div className="text-2xl font-bold">{totalMarked}/{results.length}</div>
          </div>
        </div>

        {loading ? (
          <div className="text-center p-8 text-muted-foreground">Loading results...</div>
        ) : (
          <>
            <div className="mb-5 p-4 rounded-lg border border-border">
              <h4 className="text-sm font-semibold mb-3">Grade Distribution</h4>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="grade" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mb-5">
              <h4 className="text-sm font-semibold mb-3">Results Table</h4>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2">Student</th>
                      <th className="text-center p-2">Marks</th>
                      <th className="text-center p-2">Grade</th>
                      <th className="text-center p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, index) => (
                      <tr key={result.id} className={`border-t ${index % 2 ? 'bg-gray-50' : ''}`}>
                        <td className="p-2">{studentDisplayName(result)}</td>
                        <td className="text-center p-2">{result.is_absent ? '—' : `${result.marks_obtained ?? '0'}/${exam.max_marks}`}</td>
                        <td className="text-center p-2">{result.grade || '—'}</td>
                        <td className="text-center p-2">{result.is_absent ? 'Absent' : 'Present'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {exam.published_at
                  ? "Published by the school administrator — marks are locked."
                  : "Only a school administrator can publish these results to parents."}
              </p>
              <button onClick={onClose} className="h-9 px-4 rounded-md border border-border text-sm font-semibold">Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
