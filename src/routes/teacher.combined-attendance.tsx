import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Loader2, Save, Users } from "lucide-react";
import { toast } from "sonner";
import { TeacherLayout } from "@/components/layout/TeacherLayout";
import { teacherRouteGuard, getSchoolAuth } from "@/lib/schoolAuth";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/teacher/combined-attendance")({
  beforeLoad: ({ location }) => teacherRouteGuard(location),
  component: CombinedAttendancePage,
});

type Period = { id: string; name: string; start_time: string; end_time: string; is_break: boolean; sort_order: number };
type Slot = { id: string; section_id: string; subject_id: string; teacher_id: string; period_id: string; day_of_week: number; term_id?: string | null; room?: string | null };
type Section = { id: string; name: string; full_name?: string | null };
type Subject = { id: string; name: string; code?: string | null };
type Student = { id: string; first_name: string; last_name: string; student_id_number?: string | null; section_id: string };
type Status = "present" | "absent" | "late" | "excused";
type Session = { id: string; section_id: string; submitted_at?: string | null };
type RecordRow = { student_id: string; status: Status };
type StudentListResponse = Student[] | { data?: Student[] | { data?: Student[] } };

const DAYS = [{ label: "Monday", value: 1 }, { label: "Tuesday", value: 2 }, { label: "Wednesday", value: 3 }, { label: "Thursday", value: 4 }, { label: "Friday", value: 5 }];
const STATUS_LABEL: Record<Status, string> = { present: "Present", absent: "Absent", late: "Late", excused: "Excused" };
const STATUS_CLASSES: Record<Status, string> = {
  present: "bg-success/15 text-success border-success/30",
  absent: "bg-destructive/15 text-destructive border-destructive/30",
  late: "bg-amber-100 text-amber-700 border-amber-200",
  excused: "bg-blue-100 text-blue-700 border-blue-200",
};
const today = () => new Date().toISOString().slice(0, 10);

function unwrapStudents(value: StudentListResponse): Student[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (value?.data && !Array.isArray(value.data) && Array.isArray(value.data.data)) return value.data.data;
  return [];
}

function nextStatus(current?: Status): Status {
  const order: Status[] = ["present", "absent", "late", "excused"];
  if (!current) return order[0];
  return order[(order.indexOf(current) + 1) % order.length];
}

function CombinedAttendancePage() {
  const teacherId = getSchoolAuth()?.user?.id ?? "";
  const [periods, setPeriods] = useState<Period[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [date, setDate] = useState(today());
  const [lessonKey, setLessonKey] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [sessions, setSessions] = useState<Record<string, Session>>({});
  const [loading, setLoading] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!teacherId) { setLoading(false); return; }
    Promise.all([
      apiRequest<Period[]>("/timetable-periods?limit=100", { auth: "school" }),
      apiRequest<Slot[]>(`/timetable-slots?teacher_id=${teacherId}&limit=500`, { auth: "school" }),
      apiRequest<Section[]>("/sections?limit=500", { auth: "school" }),
      apiRequest<Subject[]>("/subjects?limit=500", { auth: "school" }),
    ]).then(([periodData, slotData, sectionData, subjectData]) => {
      setPeriods((periodData ?? []).sort((a, b) => a.sort_order - b.sort_order));
      setSlots(slotData ?? []);
      setSections(sectionData ?? []);
      setSubjects(subjectData ?? []);
    }).catch((error: any) => toast.error(error?.message ?? "Failed to load combined classes")).finally(() => setLoading(false));
  }, [teacherId]);

  const lessons = useMemo(() => {
    const grouped = new Map<string, { key: string; day: number; periodId: string; subjectId: string; termId?: string | null; sectionIds: string[] }>();
    slots.forEach((slot) => {
      const key = `${slot.day_of_week}:${slot.period_id}:${slot.subject_id}:${slot.term_id ?? "legacy"}`;
      const lesson = grouped.get(key) ?? { key, day: slot.day_of_week, periodId: slot.period_id, subjectId: slot.subject_id, termId: slot.term_id, sectionIds: [] };
      if (!lesson.sectionIds.includes(slot.section_id)) lesson.sectionIds.push(slot.section_id);
      grouped.set(key, lesson);
    });
    return Array.from(grouped.values()).filter((lesson) => lesson.sectionIds.length > 1).sort((a, b) => a.day - b.day || (periods.find((p) => p.id === a.periodId)?.sort_order ?? 0) - (periods.find((p) => p.id === b.periodId)?.sort_order ?? 0));
  }, [slots, periods]);

  const selectedLesson = lessons.find((lesson) => lesson.key === lessonKey);
  const sectionName = (id: string) => sections.find((section) => section.id === id)?.full_name ?? sections.find((section) => section.id === id)?.name ?? id;
  const periodName = (id: string) => periods.find((period) => period.id === id)?.name ?? "Period";
  const subjectName = (id: string) => subjects.find((subject) => subject.id === id)?.name ?? "Subject";

  const loadRoster = async (lesson: typeof selectedLesson) => {
    if (!lesson) return;
    setLoadingRoster(true);
    try {
      // Use the section roster endpoint so the class membership comes from
      // active student-section enrollments directly. The general students
      // endpoint also applies boarding-supervisor filters for multi-role users,
      // which can incorrectly hide an otherwise valid class roster.
      const studentBatches = await Promise.all(lesson.sectionIds.map((sectionId) => apiRequest<StudentListResponse>(`/sections/${sectionId}/students?limit=5000`, { auth: "school" })));
      const nextStudents = studentBatches.flatMap((batch, index) => unwrapStudents(batch).map((student) => ({ ...student, section_id: lesson.sectionIds[index] })));
      const sessionBatches = await Promise.all(lesson.sectionIds.map((sectionId) => apiRequest<Session[]>(`/attendance/sessions?section_id=${sectionId}&date=${date}&period_id=${lesson.periodId}&teacher_id=${teacherId}&limit=1`, { auth: "school" }).catch(() => [])));
      const nextSessions: Record<string, Session> = {};
      sessionBatches.forEach((batch, index) => { if (batch[0]) nextSessions[lesson.sectionIds[index]] = batch[0]; });
      const recordBatches = await Promise.all(Object.values(nextSessions).map((session) => apiRequest<RecordRow[]>(`/attendance/records?session_id=${session.id}&limit=2000`, { auth: "school" }).catch(() => [])));
      const nextMarks: Record<string, Status> = {};
      recordBatches.flat().forEach((record) => { nextMarks[record.student_id] = record.status; });
      setStudents(nextStudents);
      setSessions(nextSessions);
      setMarks(nextMarks);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to load combined class roster");
    } finally { setLoadingRoster(false); }
  };

  useEffect(() => { if (selectedLesson) void loadRoster(selectedLesson); else { setStudents([]); setMarks({}); setSessions({}); } }, [lessonKey, date]);

  const counts = useMemo(() => students.reduce((result, student) => { const status = marks[student.id]; if (status) result[status] += 1; return result; }, { present: 0, absent: 0, late: 0, excused: 0 } as Record<Status, number>), [students, marks]);
  const allMarked = students.length > 0 && students.every((student) => Boolean(marks[student.id]));
  const hasMarks = students.some((student) => Boolean(marks[student.id]));
  const locked = Boolean(selectedLesson && selectedLesson.sectionIds.every((id) => sessions[id]?.submitted_at));

  const saveDraft = async () => {
    if (!selectedLesson || !hasMarks || locked) return;
    setSaving(true);
    try {
      for (const sectionId of selectedLesson.sectionIds) {
        let session = sessions[sectionId];
        if (session?.submitted_at) continue;
        const sectionStudents = students.filter((student) => student.section_id === sectionId);
        const markedStudents = sectionStudents.filter((student) => marks[student.id]);
        if (!markedStudents.length) continue;
        if (!session) {
          session = await apiRequest<Session>("/attendance/sessions", { method: "POST", auth: "school", body: JSON.stringify({ section_id: sectionId, subject_id: selectedLesson.subjectId, teacher_id: teacherId, period_id: selectedLesson.periodId, session_date: date, session_type: "class", started_at: new Date().toISOString() }) });
        }
        await apiRequest("/attendance/records/bulk", { method: "POST", auth: "school", body: JSON.stringify({ session_id: session.id, scan_method: "manual", notify: false, records: markedStudents.map((student) => ({ student_id: student.id, status: marks[student.id] })) }) });
      }
      toast.success("Attendance draft saved");
      await loadRoster(selectedLesson);
    } catch (error: any) { toast.error(error?.message ?? "Failed to save attendance draft"); }
    finally { setSaving(false); }
  };

  const save = async () => {
    if (!selectedLesson || !allMarked || locked) return;
    setSaving(true);
    try {
      for (const sectionId of selectedLesson.sectionIds) {
        let session = sessions[sectionId];
        if (session?.submitted_at) continue;
        if (!session) {
          session = await apiRequest<Session>("/attendance/sessions", { method: "POST", auth: "school", body: JSON.stringify({ section_id: sectionId, subject_id: selectedLesson.subjectId, teacher_id: teacherId, period_id: selectedLesson.periodId, session_date: date, session_type: "class", started_at: new Date().toISOString() }) });
        }
        const sectionStudents = students.filter((student) => student.section_id === sectionId);
        await apiRequest("/attendance/records/bulk", { method: "POST", auth: "school", body: JSON.stringify({ session_id: session.id, scan_method: "manual", records: sectionStudents.map((student) => ({ student_id: student.id, status: marks[student.id] })) }) });
        await apiRequest(`/attendance/sessions/${session.id}/close`, { method: "PATCH", auth: "school" });
      }
      toast.success("Combined class attendance submitted for every class");
      await loadRoster(selectedLesson);
    } catch (error: any) { toast.error(error?.message ?? "Failed to submit combined attendance"); }
    finally { setSaving(false); }
  };

  if (loading) return <TeacherLayout title="Combined Class Attendance" subtitle="Loading…"><div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></TeacherLayout>;
  return <TeacherLayout title="Combined Class Attendance" subtitle="Record one shared lesson while preserving each class attendance record">
    <div className="mb-5 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary">This page is only for lessons assigned to two or more classes at the same day, period, subject, and teacher. Your normal class attendance page is unchanged.</div>
    <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <label><span className="mb-1 block text-xs font-semibold text-muted-foreground">Combined lesson</span><select value={lessonKey} onChange={(event) => setLessonKey(event.target.value)} className="h-10 min-w-72 rounded-lg border border-border bg-background px-3 text-sm"><option value="">Select a combined lesson</option>{lessons.map((lesson) => <option key={lesson.key} value={lesson.key}>{DAYS.find((day) => day.value === lesson.day)?.label} · {periodName(lesson.periodId)} · {subjectName(lesson.subjectId)} · {lesson.sectionIds.map(sectionName).join(" + ")}</option>)}</select></label>
      <label><span className="mb-1 block text-xs font-semibold text-muted-foreground">Date</span><input type="date" max={today()} value={date} onChange={(event) => setDate(event.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" /></label>
      <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" /> {selectedLesson?.sectionIds.length ?? 0} classes</div>
    </div>
    {lessons.length === 0 ? <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground"><CalendarDays className="mx-auto mb-3 h-8 w-8 opacity-40" />No combined lessons are assigned to you yet. Ask the School Admin or DOS to assign the same teacher, subject, period, day, and term to multiple classes.</div> : selectedLesson ? <>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Summary label="Present" value={counts.present} color="text-success" /><Summary label="Absent" value={counts.absent} color="text-destructive" /><Summary label="Late" value={counts.late} color="text-amber-600" /><Summary label="Marked" value={`${Object.keys(marks).length}/${students.length}`} color="text-primary" /></div>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div><h3 className="font-display font-bold">{subjectName(selectedLesson.subjectId)}</h3><p className="text-xs text-muted-foreground">{selectedLesson.sectionIds.map(sectionName).join(" + ")} · {date}</p></div><button onClick={() => void saveDraft()} disabled={saving || loadingRoster || !hasMarks || locked} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"><Save className="h-4 w-4" />Save draft</button><button onClick={() => void save()} disabled={saving || loadingRoster || !allMarked || locked} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Save className="h-4 w-4" />{locked ? "Submitted" : saving ? "Submitting…" : "Submit attendance"}</button></div>{loadingRoster ? <div className="p-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3">Student</th><th className="px-5 py-3">Class</th><th className="px-5 py-3">Status</th></tr></thead><tbody>{students.map((student) => { const status = marks[student.id]; return <tr key={student.id} className="border-t border-border"><td className="px-5 py-3 font-medium">{student.first_name} {student.last_name}<div className="text-xs font-normal text-muted-foreground">{student.student_id_number ?? "—"}</div></td><td className="px-5 py-3">{sectionName(student.section_id)}</td><td className="px-5 py-3"><button type="button" onClick={() => !locked && setMarks((current) => ({ ...current, [student.id]: nextStatus(current[student.id]) }))} disabled={locked} className={`rounded-full border px-2.5 py-1 text-xs font-semibold disabled:cursor-not-allowed ${status ? STATUS_CLASSES[status] : "bg-muted text-muted-foreground border-border"}`}>{status ? STATUS_LABEL[status] : "Mark"}</button></td></tr>; })}</tbody></table></div>}</div>
    </> : <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground"><CheckCircle2 className="mx-auto mb-3 h-8 w-8 opacity-40" />Select a combined lesson to load its students.</div>}
  </TeacherLayout>;
}

function Summary({ label, value, color }: { label: string; value: string | number; color: string }) { return <div className="rounded-xl border border-border bg-card p-4"><div className={`text-2xl font-bold ${color}`}>{value}</div><div className="text-xs uppercase text-muted-foreground">{label}</div></div>; }
