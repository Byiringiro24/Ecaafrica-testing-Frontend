import { useState, useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, X, Pencil, Trash2, Loader2, BookOpen, Users, GraduationCap, Printer, Copy } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/timetable")({ component: TimetablePage });

type Period = { id: string; name: string; start_time: string; end_time: string; is_break: boolean; sort_order: number };
type Slot = { id: string; section_id: string; subject_id: string; teacher_id: string; period_id: string; day_of_week: number; room?: string | null; term_id?: string | null };
type Section = { id: string; name: string; full_name: string };
type Subject = { id: string; name: string; code?: string | null };
type Teacher = { id: string; name: string; email?: string | null };
type Term = { id: string; name: string; is_current?: boolean | null };
type SectionAssignment = { id: string; teacher_id: string; subject_id: string; section_id: string; term_id?: string | null };
type CopyLegacyResult = { source_count: number; created_count: number; skipped_count: number; conflicts: string[] };

const DAYS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
];

const AUTH = { auth: "school" as const };

/** Renders a period time as "3:30 PM". Accepts "HH:mm", "HH:mm:ss" or an ISO datetime. */
function formatPeriodTime(value?: string | null) {
  if (!value) return "";
  const match = /(\d{1,2}):(\d{2})/.exec(
    value.includes("T") ? value.slice(value.indexOf("T") + 1) : value,
  );
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = match[2];
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes} ${suffix}`;
}

function formatPeriodRange(start?: string | null, end?: string | null) {
  const from = formatPeriodTime(start);
  const to = formatPeriodTime(end);
  if (!from && !to) return "—";
  return `${from} – ${to}`;
}

function TimetablePage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [sectionAssignments, setSectionAssignments] = useState<SectionAssignment[]>([]);
  const [sectionId, setSectionId] = useState("");
  const [termId, setTermId] = useState("");
  const [loading, setLoading] = useState(true);
  const [periodModal, setPeriodModal] = useState(false);
  const [slotModal, setSlotModal] = useState<{ period_id: string; day_of_week: number } | null>(null);
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);
  const [combinedModal, setCombinedModal] = useState(false);
  const [copyingLegacy, setCopyingLegacy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [periodData, sectionData, subjectData, teacherData, termData] = await Promise.all([
          apiRequest<Period[]>("/timetable-periods?limit=50", AUTH),
          apiRequest<Section[]>("/sections?limit=200", AUTH),
          apiRequest<Subject[]>("/subjects?limit=200", AUTH),
          // Any school user may be assigned as the teacher of a timetable slot.
          // Do not filter by the user's primary role here; role management is
          // independent from timetable responsibility.
          apiRequest<Teacher[]>("/users?limit=5000", AUTH),
          apiRequest<Term[]>("/terms?limit=100", AUTH).catch(() => []),
        ]);
        setPeriods((periodData ?? []).sort((a, b) => a.sort_order - b.sort_order));
        setSections(sectionData ?? []);
        setSubjects(subjectData ?? []);
        setTeachers(teacherData ?? []);
        setTerms(termData ?? []);
        const currentTerm = (termData ?? []).find((term) => term.is_current);
        if (currentTerm) setTermId(currentTerm.id);
      } catch (error: any) {
        toast.error(error?.message ?? "Failed to load timetable data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!sectionId) { setSlots([]); setSectionAssignments([]); return; }
    (async () => {
      try {
        const [slotData, assignmentData] = await Promise.all([
          apiRequest<Slot[]>(
            `/timetable-slots?section_id=${sectionId}&limit=200${termId ? `&term_id=${termId}` : "&term_id=legacy"}`,
            AUTH
          ),
          apiRequest<SectionAssignment[]>(
            `/teacher-section-subjects?section_id=${sectionId}&limit=500`,
            AUTH
          ),
        ]);
        setSlots(slotData ?? []);
        setSectionAssignments(assignmentData ?? []);
      } catch { setSlots([]); setSectionAssignments([]); }
    })();
  }, [sectionId, termId]);

  /** subject_id → teacher_id for the selected class (first teacher assigned to that subject) */
  const subjectTeacherMap = useMemo(() => {
    const map: Record<string, string> = {};
    sectionAssignments.forEach((a) => {
      if (!map[a.subject_id]) map[a.subject_id] = a.teacher_id;
    });
    return map;
  }, [sectionAssignments]);

  const slotMap = useMemo(() => {
    const map = new Map<string, Slot>();
    slots.forEach((s) => map.set(`${s.period_id}:${s.day_of_week}`, s));
    return map;
  }, [slots]);

  const section = sections.find((s) => s.id === sectionId);
  const term = terms.find((item) => item.id === termId);

  const handleDeleteSlot = async (slot: Slot) => {
    try {
      await apiRequest(`/timetable-slots/${slot.id}`, { method: "DELETE", ...AUTH });
      setSlots((prev) => prev.filter((s) => s.id !== slot.id));
      toast.success("Slot removed");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to remove slot");
    }
  };

  const handleSaveSlot = async (period_id: string, day_of_week: number, data: { subject_id: string; teacher_id: string }) => {
    try {
      const created = await apiRequest<Slot>("/timetable-slots", {
        method: "POST",
        body: JSON.stringify({ section_id: sectionId, period_id, day_of_week, ...data, ...(termId ? { term_id: termId } : {}) }),
        ...AUTH,
      });
      setSlots((prev) => [...prev.filter((s) => s.period_id !== period_id || s.day_of_week !== day_of_week), created]);
      setSlotModal(null);
      toast.success("Slot assigned");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to assign slot");
    }
  };

  const handleSaveCombined = async (data: { section_ids: string[]; subject_id: string; teacher_id: string; period_id: string; day_of_week: number; room?: string }) => {
    try {
      await apiRequest("/timetable-slots/bulk", {
        method: "POST",
        body: JSON.stringify({ ...data, term_id: termId }),
        ...AUTH,
      });
      setCombinedModal(false);
      toast.success(`Combined lesson assigned to ${data.section_ids.length} classes`);
      if (sectionId) {
        const refreshed = await apiRequest<Slot[]>(`/timetable-slots?section_id=${sectionId}&limit=200${termId ? `&term_id=${termId}` : "&term_id=legacy"}`, AUTH);
        setSlots(refreshed ?? []);
      }
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to assign combined lesson");
    }
  };

  const handleCopyLegacy = async () => {
    if (!termId) {
      toast.error("Select a destination term first");
      return;
    }
    const destinationTerm = terms.find((item) => item.id === termId);
    if (!window.confirm(`Copy the legacy timetable into ${destinationTerm?.name ?? "this term"}? The legacy timetable will remain unchanged.`)) return;
    setCopyingLegacy(true);
    try {
      const result = await apiRequest<CopyLegacyResult>("/timetable-slots/copy-legacy", {
        method: "POST",
        body: JSON.stringify({ term_id: termId }),
        ...AUTH,
      });
      if (result.source_count === 0) {
        toast.info("No legacy timetable slots were found to copy");
      } else {
        const conflictText = result.conflicts.length ? ` ${result.conflicts.length} conflict${result.conflicts.length === 1 ? "" : "s"} skipped.` : "";
        toast.success(`Copied ${result.created_count} of ${result.source_count} legacy timetable slots.${conflictText}`);
      }
      if (sectionId) {
        const refreshed = await apiRequest<Slot[]>(`/timetable-slots?section_id=${sectionId}&limit=200&term_id=${termId}`, AUTH);
        setSlots(refreshed ?? []);
      }
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to copy the legacy timetable");
    } finally {
      setCopyingLegacy(false);
    }
  };

  const handleUpdateSlot = async (slot: Slot, data: { subject_id: string; teacher_id: string }) => {
    try {
      const updated = await apiRequest<Slot>(`/timetable-slots/${slot.id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        ...AUTH,
      });
      setSlots((prev) => prev.map((s) => (s.id === slot.id ? updated : s)));
      setEditingSlot(null);
      toast.success("Slot updated");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to update slot");
    }
  };

  if (loading) {
    return (
      <AppLayout title="Timetable" subtitle="Loading…">
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Timetable" subtitle={section ? `Managing: ${section.full_name}` : "Select a class to manage its timetable"}>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48">
          <select
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="">Select a class…</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setPeriodModal(true)}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Manage Periods
        </button>
        <select value={termId} onChange={(event) => setTermId(event.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option value="">Legacy timetable (no term)</option>
          {terms.map((term) => <option key={term.id} value={term.id}>{term.name}{term.is_current ? " (current)" : ""}</option>)}
        </select>
        <button
          onClick={() => void handleCopyLegacy()}
          disabled={!termId || copyingLegacy || periods.length === 0}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 text-sm font-semibold text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
          title={!termId ? "Select a destination term first" : "Copy the legacy timetable into the selected term"}
        >
          {copyingLegacy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
          {copyingLegacy ? "Copying…" : "Copy legacy to term"}
        </button>
        <button
          onClick={() => window.print()}
          disabled={!sectionId}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          title={!sectionId ? "Select a class before printing" : "Print this class timetable"}
        >
          <Printer className="h-4 w-4" /> Print
        </button>
        <button
          onClick={() => setCombinedModal(true)}
          disabled={!termId || !terms.length || periods.length === 0}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 text-sm font-semibold text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
          title={!terms.length || !termId ? "Select an academic term before assigning combined classes" : "Assign one teacher to multiple classes"}
        >
          <Users className="h-4 w-4" /> Combined Class
        </button>
      </div>

      {/* Timetable Grid */}
      <div className="print-area timetable-print">
        <div className="hidden print:block mb-4">
          <h1 className="text-xl font-bold">Timetable</h1>
          <p className="text-sm text-gray-600">
            {section?.full_name ?? ""}{term ? ` · ${term.name}` : ""}
          </p>
        </div>

      {sectionId && periods.length > 0 ? (
        <div className="rounded-xl border border-border bg-card overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase">
              <tr>
                <th className="p-3 text-left w-36">Period</th>
                {DAYS.map((d) => (
                  <th key={d.value} className="p-3 text-center w-40">{d.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr key={period.id} className="border-t border-border">
                  <td className={`p-3 align-top ${period.is_break ? "bg-muted/30" : ""}`}>
                    <div className="font-semibold text-sm">{period.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatPeriodRange(period.start_time, period.end_time)}
                    </div>
                    {period.is_break && (
                      <div className="mt-1 text-[10px] font-semibold text-amber-600 uppercase">Break</div>
                    )}
                  </td>
                  {DAYS.map((day) => {
                    const key = `${period.id}:${day.value}`;
                    const slot = slotMap.get(key);
                    return (
                      <td key={day.value} className="p-1.5 align-top">
                        {period.is_break ? (
                          <div className="flex h-full min-h-[60px] items-center justify-center rounded-lg bg-muted/20 text-xs text-muted-foreground">
                            —
                          </div>
                        ) : slot ? (
                          <div className="group relative rounded-lg border border-primary/20 bg-primary/5 p-2">
                            <div className="text-xs font-semibold">
                              {subjects.find((s) => s.id === slot.subject_id)?.name ?? "—"}
                            </div>
                            <div className="mt-0.5 text-[11px] text-muted-foreground">
                              {teachers.find((t) => t.id === slot.teacher_id)?.name ?? "—"}
                            </div>
                            {slot.room && (
                              <div className="text-[10px] text-muted-foreground">Room: {slot.room}</div>
                            )}
                            <div className="no-print mt-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setEditingSlot(slot)}
                                className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/10"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteSlot(slot)}
                                className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-red-600 hover:bg-red-50"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            className="no-print flex h-full min-h-[60px] w-full items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-colors"
                            onClick={() => setSlotModal({ period_id: period.id, day_of_week: day.value })}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : sectionId && periods.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          <BookOpen className="mx-auto mb-3 h-8 w-8 opacity-40" />
          No periods defined yet. Click "Manage Periods" to add time periods.
        </div>
      ) : !sectionId ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          <GraduationCap className="mx-auto mb-3 h-8 w-8 opacity-40" />
          Select a class above to view and edit its timetable.
        </div>
      ) : null}
      </div>

      {/* Slot assignment modal */}
      {(slotModal || editingSlot) && (
        <SlotModal
          period={periods.find((p) => p.id === (slotModal?.period_id ?? editingSlot?.period_id ?? ""))}
          day={DAYS.find((d) => d.value === (slotModal?.day_of_week ?? editingSlot?.day_of_week ?? 0))}
          subjects={subjects}
          teachers={teachers}
          subjectTeacherMap={subjectTeacherMap}
          initialSubjectId={editingSlot?.subject_id ?? ""}
          initialTeacherId={editingSlot?.teacher_id ?? ""}
          onSave={(data) => {
            if (editingSlot) {
              handleUpdateSlot(editingSlot, data);
            } else if (slotModal) {
              handleSaveSlot(slotModal.period_id, slotModal.day_of_week, data);
            }
          }}
          onClose={() => { setSlotModal(null); setEditingSlot(null); }}
        />
      )}

      {/* Period Management Modal */}
      {periodModal && (
        <PeriodModal
          periods={periods}
          onClose={() => setPeriodModal(false)}
          onPeriodsChange={setPeriods}
        />
      )}
      {combinedModal && (
        <CombinedSlotModal
          sections={sections}
          subjects={subjects}
          teachers={teachers}
          periods={periods}
          term={terms.find((term) => term.id === termId)}
          onSave={handleSaveCombined}
          onClose={() => setCombinedModal(false)}
        />
      )}
    </AppLayout>
  );
}

/* ─── Slot Assignment Modal ─── */
function SlotModal({
  period, day, subjects, teachers, subjectTeacherMap, initialSubjectId, initialTeacherId, onSave, onClose,
}: {
  period?: Period; day?: typeof DAYS[number]; subjects: Subject[]; teachers: Teacher[];
  subjectTeacherMap: Record<string, string>;
  initialSubjectId: string; initialTeacherId: string;
  onSave: (data: { subject_id: string; teacher_id: string }) => void; onClose: () => void;
}) {
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [teacherId, setTeacherId] = useState(initialTeacherId);

  const handleSubjectChange = (id: string) => {
    setSubjectId(id);
    setTeacherId(subjectTeacherMap[id] ?? "");
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-display font-bold">
            {initialSubjectId ? "Edit Slot" : "Assign Slot"}
          </h3>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {period && day && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <span className="font-semibold">{period.name}</span>
              <span className="text-muted-foreground"> ({formatPeriodRange(period.start_time, period.end_time)})</span>
              <span className="ml-2 font-semibold">· {day.label}</span>
            </div>
          )}
          <label className="block">
            <span className="text-xs font-semibold mb-1.5 block">Subject</span>
            <select value={subjectId} onChange={(e) => handleSubjectChange(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
              <option value="">Select subject…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ""}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold mb-1.5 block">Teacher</span>
            <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
              <option value="">Select teacher…</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {subjectId && subjectTeacherMap[subjectId] && (
              <span className="mt-1.5 block text-[11px] text-muted-foreground">
                Auto-filled from the teacher assigned to this subject in the selected class.
              </span>
            )}
          </label>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
          <button
            onClick={() => { if (!subjectId || !teacherId) { toast.error("Select both subject and teacher"); return; } onSave({ subject_id: subjectId, teacher_id: teacherId }); }}
            disabled={!subjectId || !teacherId}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {initialSubjectId ? "Update" : "Assign"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Period Management Modal ─── */
function CombinedSlotModal({
  sections, subjects, teachers, periods, term, onSave, onClose,
}: {
  sections: Section[]; subjects: Subject[]; teachers: Teacher[]; periods: Period[]; term?: Term;
  onSave: (data: { section_ids: string[]; subject_id: string; teacher_id: string; period_id: string; day_of_week: number; room?: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [periodId, setPeriodId] = useState(periods.find((period) => !period.is_break)?.id ?? "");
  const [day, setDay] = useState(1);
  const [room, setRoom] = useState("");
  const [saving, setSaving] = useState(false);
  const toggleSection = (id: string) => setSectionIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!term) { toast.error("Select an academic term before assigning a combined class"); return; }
    if (sectionIds.length < 2) { toast.error("Select at least two classes"); return; }
    if (!subjectId || !teacherId || !periodId) { toast.error("Select subject, teacher, and period"); return; }
    setSaving(true);
    try { await onSave({ section_ids: sectionIds, subject_id: subjectId, teacher_id: teacherId, period_id: periodId, day_of_week: day, room: room.trim() || undefined }); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4"><div><h3 className="font-display font-bold">Assign Combined Class</h3><p className="text-xs text-muted-foreground">One teacher, subject, room, and period for multiple classes.</p></div><button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button></div>
        <form onSubmit={submit} className="space-y-4 px-6 py-5">
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">Term: <b>{term?.name ?? "Not selected"}</b>. Combined classes must be term-scoped.</div>
          <label className="block"><span className="mb-1 block text-xs font-semibold">Classes (select at least two)</span><div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-border p-2">{sections.map((section) => <label key={section.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-muted/40"><input type="checkbox" checked={sectionIds.includes(section.id)} onChange={() => toggleSection(section.id)} /><span className="text-sm">{section.full_name || section.name}</span></label>)}</div></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-1 block text-xs font-semibold">Day</span><select value={day} onChange={(event) => setDay(Number(event.target.value))} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm">{DAYS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold">Period</span><select value={periodId} onChange={(event) => setPeriodId(event.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm">{periods.filter((period) => !period.is_break).map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}</select></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold">Subject</span><select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="">Select subject</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}{subject.code ? ` (${subject.code})` : ""}</option>)}</select></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold">Teacher</span><select value={teacherId} onChange={(event) => setTeacherId(event.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="">Select teacher</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></label>
          </div>
          <label className="block"><span className="mb-1 block text-xs font-semibold">Shared room (optional)</span><input value={room} onChange={(event) => setRoom(event.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm" placeholder="e.g. Room 4" /></label>
          <div className="flex justify-end gap-2 border-t border-border pt-4"><button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button><button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? "Assigning…" : "Assign combined class"}</button></div>
        </form>
      </div>
    </div>
  );
}

function PeriodModal({
  periods, onClose, onPeriodsChange,
}: {
  periods: Period[]; onClose: () => void; onPeriodsChange: (p: Period[]) => void;
}) {
  const [list, setList] = useState<Period[]>(periods);
  const [saving, setSaving] = useState(false);

  const [newName, setNewName] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newIsBreak, setNewIsBreak] = useState(false);

  const loadPeriods = async () => {
    const data = await apiRequest<Period[]>("/timetable-periods?limit=50", AUTH);
    const sorted = (data ?? []).sort((a, b) => a.sort_order - b.sort_order);
    setList(sorted);
    onPeriodsChange(sorted);
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newStart || !newEnd) { toast.error("Name, start, and end are required"); return; }
    setSaving(true);
    try {
      await apiRequest("/timetable-periods", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), start_time: newStart, end_time: newEnd, is_break: newIsBreak }),
        ...AUTH,
      });
      setNewName(""); setNewStart(""); setNewEnd(""); setNewIsBreak(false);
      await loadPeriods();
      toast.success("Period created");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to create period");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiRequest(`/timetable-periods/${id}`, { method: "DELETE", ...AUTH });
      await loadPeriods();
      toast.success("Period deleted");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to delete period");
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-card shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-8 py-5 border-b border-border shrink-0">
          <h3 className="font-display font-bold text-lg">Manage Periods</h3>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="px-8 py-5 border-b border-border shrink-0">
          <div className="grid grid-cols-12 gap-4 items-end">
            <div className="col-span-3">
              <label className="text-xs font-semibold mb-1.5 block">Name</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="P1" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" />
            </div>
            <div className="col-span-3">
              <label className="text-xs font-semibold mb-1.5 block">Start</label>
              <input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" />
            </div>
            <div className="col-span-3">
              <label className="text-xs font-semibold mb-1.5 block">End</label>
              <input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" />
            </div>
            <div className="col-span-1">
              <label className="text-xs font-semibold mb-1.5 block">&nbsp;</label>
              <label className="flex items-center gap-1.5 h-10 text-sm whitespace-nowrap">
                <input type="checkbox" checked={newIsBreak} onChange={(e) => setNewIsBreak(e.target.checked)} className="h-4 w-4 rounded border-input" />
                Break
              </label>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold mb-1.5 block">&nbsp;</label>
              <button
                onClick={handleCreate} disabled={saving}
                className="h-10 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-4">
          {list.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No periods yet. Add one above.</div>
          ) : (
            <div className="space-y-1">
              {list.map((p, i) => (
                <div key={p.id} className="flex items-center gap-4 rounded-lg px-3 py-2.5 hover:bg-muted/50 text-sm">
                  <span className="w-6 text-xs text-muted-foreground shrink-0">{i + 1}.</span>
                  <span className="w-32 font-semibold truncate">{p.name}</span>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {formatPeriodRange(p.start_time, p.end_time)}
                  </span>
                  {p.is_break && <span className="text-[10px] font-semibold text-amber-600 uppercase">Break</span>}
                  <div className="flex-1" />
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="rounded p-1.5 text-muted-foreground hover:text-red-600 shrink-0"
                    aria-label="Delete period"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end px-8 py-5 border-t border-border shrink-0">
          <button onClick={onClose} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Done</button>
        </div>
      </div>
    </div>
  );
}
