import { useEffect, useState } from "react";
import { X, Award, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  type AdminExam,
  getExamResults,
  publishExamResults,
  studentDisplayName,
  gradeBadgeClass,
  examTypeLabel,
  statusBadgeClass,
} from "@/lib/exams-admin-api";

interface Props {
  exam: AdminExam;
  onClose: () => void;
  onPublished?: () => void;
  allowPublish?: boolean;
}

export function ExamResultsModal({ exam, onClose, onPublished, allowPublish = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof getExamResults>> | null>(null);

  useEffect(() => {
    loadResults();
  }, [exam.id]);

  const loadResults = async () => {
    try {
      setLoading(true);
      const resp = await getExamResults(exam.id);
      setData(resp);
    } catch (error) {
      toast.error("Failed to load exam results");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!confirm(`Publish results for "${exam.name}"? Parents will be able to view these grades.`)) {
      return;
    }
    try {
      setPublishing(true);
      await publishExamResults(exam.id);
      toast.success("Results published successfully");
      onPublished?.();
      onClose();
    } catch (error) {
      toast.error("Failed to publish results");
      console.error(error);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-2xl bg-background shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6 border-b border-border shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              <h3 className="font-display text-lg font-bold">{exam.name}</h3>
            </div>
            <div className="mt-1 text-sm text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
              <span>{exam.section?.full_name ?? "—"}</span>
              <span>{exam.subject?.name ?? "—"}</span>
              <span>{examTypeLabel(exam.type)}</span>
              {exam.exam_date && (
                <span>{new Date(exam.exam_date).toLocaleDateString()}</span>
              )}
              {exam.teacher && <span>Teacher: {exam.teacher.name}</span>}
            </div>
            <div className="mt-2 flex gap-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${statusBadgeClass(exam.status)}`}>
                {exam.status === "ongoing" ? "Awaiting Review" : exam.status}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Loading results…
          </div>
        ) : data ? (
          <>
            <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-border shrink-0">
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <div className="text-lg font-bold">{data.stats.count}</div>
                <div className="text-[10px] uppercase text-muted-foreground">Students Marked</div>
              </div>
              <div className="rounded-lg bg-indigo-50 p-3 text-center">
                <div className="text-lg font-bold text-indigo-700">{data.stats.class_average ?? "—"}</div>
                <div className="text-[10px] uppercase text-muted-foreground">Class Average</div>
              </div>
              <div className="rounded-lg bg-green-50 p-3 text-center">
                <div className="text-lg font-bold text-green-700">{data.stats.highest ?? "—"}</div>
                <div className="text-[10px] uppercase text-muted-foreground">Highest</div>
              </div>
              <div className="rounded-lg bg-amber-50 p-3 text-center">
                <div className="text-lg font-bold text-amber-700">{data.stats.lowest ?? "—"}</div>
                <div className="text-[10px] uppercase text-muted-foreground">Lowest</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-xs uppercase sticky top-0">
                  <tr>
                    <th className="text-left p-3">Student</th>
                    <th className="text-left p-3">Marks</th>
                    <th className="text-left p-3">Grade</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        No results recorded yet
                      </td>
                    </tr>
                  ) : (
                    data.results.map((result, index) => (
                      <tr key={result.id} className={`border-t ${index % 2 ? "bg-muted/30" : ""}`}>
                        <td className="p-3 font-medium">{studentDisplayName(result)}</td>
                        <td className="p-3">
                          {result.is_absent
                            ? "—"
                            : `${result.marks_obtained ?? "—"} / ${data.exam.max_marks}`}
                        </td>
                        <td className="p-3">
                          {result.is_absent ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                              Absent
                            </span>
                          ) : result.grade ? (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${gradeBadgeClass(result.grade)}`}>
                              {result.grade}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-3">
                          {result.published_at ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-green-100 text-green-800">
                              Published
                            </span>
                          ) : (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">{result.remarks ?? "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {allowPublish && exam.status !== "completed" && data.results.length > 0 && (
              <div className="p-4 border-t border-border flex justify-end gap-2 shrink-0">
                <button
                  onClick={onClose}
                  className="h-9 px-4 rounded-md border border-border text-sm font-semibold"
                >
                  Close
                </button>
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2"
                >
                  {publishing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Publish to Parents
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
