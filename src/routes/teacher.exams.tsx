import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { teacherRouteGuard } from "@/lib/schoolAuth";
import { Plus, X, Award, Loader2 } from "lucide-react";
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
  computeGrade,
  studentDisplayName,
  type TeacherAssignmentPair,
  type TeacherExam,
  type Student,
  type ExamResult,
} from "@/lib/exams-api";

export const Route = createFileRoute("/teacher/exams")({
  beforeLoad: ({ location }) => teacherRouteGuard(location),
  component: TeacherExams,
});

function TeacherExams() {
  const [tab, setTab] = useState<"upcoming" | "enter" | "published" | "performance">("upcoming");
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

  useEffect(() => {
    loadAssignments();
  }, []);

  const mergedAssignmentSubjects = useMemo(
    () => Array.from(new Set(assignments?.subjects.map((subject) => subject.name) || [])),
    [assignments?.subjects]
  );

  useEffect(() => {
    if (tab === "enter" || tab === "performance") return;
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
          {([['upcoming', 'Upcoming Exams'], ['enter', 'Enter Results'], ['published', 'Published Results'], ['performance', 'Student Performance']] as const).map(([key, label]) => (
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
          <div className="rounded-xl border border-border bg-card p-4 mb-5 grid gap-3 sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase text-muted-foreground">Classes managed</div>
              <div className="mt-1 font-semibold">{assignments.sections.length}</div>
              <div className="mt-2 text-sm text-slate-600">{assignments.sections.map((section) => section.full_name).join(", ") || "No classes assigned"}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Subjects taught</div>
              <div className="mt-1 font-semibold">{mergedAssignmentSubjects.length}</div>
              <div className="mt-2 text-sm text-slate-600">{mergedAssignmentSubjects.join(", ") || "No subjects assigned"}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Teaching assignments</div>
              <div className="mt-2 text-sm text-slate-600 space-y-1">
                {assignments.assignments.length > 0 ? (
                  assignments.assignments.map((item) => (
                    <div key={`${item.section_id}-${item.subject_id}`}>
                      {item.section.full_name} — {item.subject.name}
                    </div>
                  ))
                ) : (
                  "No class/subject assignments yet. Contact your administrator."
                )}
              </div>
            </div>
          </div>

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
                  <th className="text-left p-3">Duration</th>
                  <th className="text-left p-3">Max Marks</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((exam, index) => (
                  <tr key={exam.id} className={`border-t ${index % 2 ? 'bg-gray-50' : ''}`}>
                    <td className="p-3 font-medium">{exam.name}</td>
                    <td className="p-3">{exam.section?.full_name || '—'}</td>
                    <td className="p-3">{exam.subject?.name || '—'}</td>
                    <td className="p-3">{exam.exam_date ? new Date(exam.exam_date).toLocaleDateString() : '—'}</td>
                    <td className="p-3">{exam.duration_min ?? '—'}m</td>
                    <td className="p-3">{exam.max_marks}</td>
                    <td className="p-3">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">{exam.type}</span>
                    </td>
                    <td className="p-3">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-700 capitalize">{exam.status}</span>
                    </td>
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
        />
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

      {createOpen && <CreateExamModal onClose={() => { setCreateOpen(false); loadExams(); }} />}
      {viewExam && <ResultsModal exam={viewExam} onClose={() => setViewExam(null)} />}
    </TeacherLayout>
  );
}

function CreateExamModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [sections, setSections] = useState<Array<{ id: string; name: string; full_name: string }>>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [assignmentPairs, setAssignmentPairs] = useState<TeacherAssignmentPair[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    section_id: "",
    subject_id: "",
    type: "cat",
    exam_date: new Date().toISOString().slice(0, 10),
    max_marks: 100,
    pass_mark: 50,
  });

  useEffect(() => {
    loadTeacherAssignments();
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formData.name || !formData.section_id || !formData.subject_id) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);
      await createExam(formData);
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

        {assignmentsLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading classes and subjects…</div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
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
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="cat">CAT</option>
                  <option value="main_exam">Main Exam</option>
                  <option value="mock">Mock</option>
                  <option value="quiz">Quiz</option>
                  <option value="assignment">Assignment</option>
                </select>
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
                <label className="text-sm font-medium">Pass Mark</label>
                <input
                  type="number"
                  value={formData.pass_mark}
                  onChange={(e) => setFormData({ ...formData, pass_mark: parseInt(e.target.value, 10) || 0 })}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
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
                disabled={loading}
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

function EnterResults({
  sectionId,
  subjectId,
  assignedSubjects,
}: {
  sectionId: string;
  subjectId: string;
  assignedSubjects: Array<{ id: string; name: string; code?: string }>;
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
      // Published exams stay in the list so the teacher can review their marks
      // read-only; the grid disables editing when published_at is set.
      const eligible = data.filter(
        (exam) =>
          exam.status === "scheduled" ||
          exam.status === "ongoing" ||
          exam.status === "completed"
      );
      setExams(eligible);
      setSelectedExam(eligible[0] || null);
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
            ? computeGrade(numericScore, maxMarks)
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

  const gradeForScore = (score: number, maxMarks: number) => computeGrade(score, maxMarks);

  // Once the admin publishes, marks are frozen — the backend rejects edits with a 409.
  const isPublished = Boolean(selectedExam?.published_at);

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
          <div className="px-4 py-3 border-b border-border text-sm">
            <b>{selectedExam.name}</b> · {selectedExam.section?.full_name} · Max marks: {selectedExam.max_marks} · {Object.keys(results).filter((key) => results[key].score || results[key].is_absent).length}/{students.length} marked
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
                        disabled={result.is_absent || isPublished}
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
                          disabled={isPublished}
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
                        disabled={isPublished}
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
          {!isPublished && (
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
