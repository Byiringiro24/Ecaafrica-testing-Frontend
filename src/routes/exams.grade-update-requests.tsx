import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Check, ChevronLeft, ChevronRight, Clock3, History, Loader2, MessageSquare, X } from "lucide-react";
import { toast } from "sonner";
import { getTeacherExams, requestExamModification, type TeacherExam } from "@/lib/exams-api";
import { listExamModificationRequests, reviewExamModificationRequest, type ExamModificationRequest } from "@/lib/exams-admin-api";
import { getSchoolAuth, isSchoolAdminRole, isTeacherRole, isDirectorOfStudiesRole } from "@/lib/schoolAuth";

export const Route = createFileRoute("/exams/grade-update-requests")({
  beforeLoad: ({ location }) => {
    const auth = getSchoolAuth();
    if (auth?.accessToken && (isSchoolAdminRole(auth.user?.role) || isTeacherRole(auth.user?.role) || isDirectorOfStudiesRole(auth.user?.role))) return;
    throw redirect({ to: "/login", search: { redirect: location.pathname } });
  },
  component: GradeUpdateRequestsPage,
});

const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleDateString() : "—";

function RequestSummary({ request }: { request: ExamModificationRequest }) {
  return <div>
    <div className="font-semibold">{request.exam?.name ?? `Exam #${request.exam_id}`}</div>
    <div className="mt-1 text-xs text-muted-foreground">{request.exam?.section?.full_name ?? "—"} · {request.exam?.subject?.name ?? "—"} · {dateLabel(request.exam?.exam_date)}</div>
    <div className="mt-2 text-sm">{request.reason}</div>
    <div className="mt-2 text-xs text-muted-foreground">{request.teacher?.name ?? `Teacher #${request.teacher_id}`} · Requested {new Date(request.created_at).toLocaleString()}</div>
  </div>;
}

function GradeUpdateRequestsPage() {
  const auth = getSchoolAuth();
  return isSchoolAdminRole(auth?.user?.role) ? <AdminRequests /> : <TeacherRequests />;
}

function AdminRequests() {
  const [requests, setRequests] = useState<ExamModificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const load = async () => { try { setLoading(true); setRequests(await listExamModificationRequests()); } catch (error) { toast.error("Failed to load grade-update requests"); console.error(error); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const review = async (request: ExamModificationRequest, status: "approved" | "rejected") => { try { setReviewing(request.id); await reviewExamModificationRequest(request.id, status); toast.success(status === "approved" ? "Grade update approved" : "Grade update request rejected"); await load(); } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to review request"); } finally { setReviewing(null); } };
  const pending = requests.filter((request) => request.status === "pending");
  const history = requests.filter((request) => request.status !== "pending");
  return <Page title="Approve a request before a teacher can update submitted marks or grades. Unpublishing results does not approve editing.">
    <RequestSection title="Pending grade-update requests" icon={<Clock3 className="h-4 w-4" />} empty="No pending grade-update requests." items={pending}>
      {(request) => <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex flex-wrap items-start justify-between gap-4"><RequestSummary request={request} /><div className="flex gap-2"><button onClick={() => review(request, "rejected")} disabled={reviewing === request.id} className="inline-flex h-9 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-semibold disabled:opacity-50">{reviewing === request.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Reject</button><button onClick={() => review(request, "approved")} disabled={reviewing === request.id} className="inline-flex h-9 items-center gap-1 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white disabled:opacity-50">{reviewing === request.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve update</button></div></div></div>}
    </RequestSection>
    <RecentHistory title="Recent request history" empty="No reviewed requests yet." items={history}>
      {(request) => <div className="rounded-xl border border-border bg-card p-4"><div className="flex items-start justify-between gap-3"><RequestSummary request={request} /><Status status={request.status} /></div></div>}
    </RecentHistory>
  </Page>;
}

function TeacherRequests() {
  const [requests, setRequests] = useState<ExamModificationRequest[]>([]);
  const [exams, setExams] = useState<TeacherExam[]>([]);
  const [examId, setExamId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const load = async () => { try { setLoading(true); const [requestData, examData] = await Promise.all([listExamModificationRequests(), getTeacherExams()]); setRequests(requestData); setExams(examData.filter((exam) => (exam.marked_count ?? 0) > 0 && exam.status !== "scheduled" && exam.status !== "cancelled")); } catch (error) { toast.error("Failed to load your modification requests"); console.error(error); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const pendingExamIds = useMemo(() => new Set(requests.filter((request) => request.status === "pending").map((request) => request.exam_id)), [requests]);
  const submit = async () => { if (!examId) return toast.error("Choose the exam you want to modify"); if (reason.trim().length < 5) return toast.error("Please provide a reason of at least 5 characters"); try { setSubmitting(true); await requestExamModification(examId, reason.trim()); toast.success("Modification request sent to the school administrator"); setExamId(""); setReason(""); await load(); } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to send modification request"); } finally { setSubmitting(false); } };
  return <Page title="Choose the submitted exam you want to correct. An administrator must approve the request before editing is unlocked.">
    {loading ? <Loading /> : <>
      <section className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center gap-2 font-display font-bold"><MessageSquare className="h-5 w-5 text-primary" /> Request a grade update</div><div className="mt-4 grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-end"><label className="text-sm font-medium">Exam<select value={examId} onChange={(event) => setExamId(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Choose an exam</option>{exams.map((exam) => <option key={exam.id} value={exam.id} disabled={pendingExamIds.has(exam.id)}>{exam.name} — {exam.section?.full_name ?? "—"}{pendingExamIds.has(exam.id) ? " (request pending)" : ""}</option>)}</select></label><label className="text-sm font-medium">Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-10 w-full rounded-md border border-input bg-background p-2 text-sm" placeholder="Explain why the submitted marks or grades need correction" /></label><button onClick={submit} disabled={submitting} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{submitting && <Loader2 className="h-4 w-4 animate-spin" />} Send request</button></div>{exams.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No submitted exams with recorded marks are available for modification.</p>}</section>
      <RecentHistory title="Recent modification requests" empty="You have not submitted any modification requests." items={requests}>{(request) => <div className="rounded-xl border border-border bg-card p-4"><div className="flex items-start justify-between gap-3"><RequestSummary request={request} /><Status status={request.status} /></div></div>}</RecentHistory>
    </>}
  </Page>;
}

function Page({ title, children }: { title: string; children: ReactNode }) { return <div><div className="mb-5"><h2 className="font-display text-lg font-bold">Grade update requests</h2><p className="mt-1 text-sm text-muted-foreground">{title}</p></div>{children}</div>; }
function Loading() { return <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">Loading requests…</div>; }
function Status({ status }: { status: string }) { return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${status === "approved" ? "bg-emerald-100 text-emerald-700" : status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{status}</span>; }
function RequestSection({ title, icon, empty, items, children }: { title: string; icon: ReactNode; empty: string; items: ExamModificationRequest[]; children: (request: ExamModificationRequest) => ReactNode }) { return <section className="mb-6"><div className="mb-3 flex items-center gap-2 font-display font-bold">{icon}{title}</div>{items.length === 0 ? <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{empty}</div> : <div className="space-y-3">{items.map((request) => <div key={request.id}>{children(request)}</div>)}</div>}</section>; }
function RecentHistory({ title, empty, items, children }: { title: string; empty: string; items: ExamModificationRequest[]; children: (request: ExamModificationRequest) => ReactNode }) {
  const [page, setPage] = useState(0);
  const pageSize = 5;
  const pageCount = Math.ceil(items.length / pageSize);
  const visible = items.slice(page * pageSize, (page + 1) * pageSize);

  useEffect(() => setPage(0), [items.length]);

  return <section className="mb-6">
    <div className="mb-3 flex items-center gap-2 font-display font-bold"><History className="h-4 w-4" />{title}</div>
    {items.length === 0 ? <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{empty}</div> : <>
      <div className="space-y-3">{visible.map((request) => <div key={request.id}>{children(request)}</div>)}</div>
      {pageCount > 1 && <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, items.length)} of {items.length}</span>
        <div className="flex gap-2"><button onClick={() => setPage((current) => current - 1)} disabled={page === 0} className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-3 text-xs font-semibold disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" /> Previous</button><button onClick={() => setPage((current) => current + 1)} disabled={page === pageCount - 1} className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-3 text-xs font-semibold disabled:opacity-40">Next <ChevronRight className="h-3.5 w-3.5" /></button></div>
      </div>}
    </>}
  </section>;
}
