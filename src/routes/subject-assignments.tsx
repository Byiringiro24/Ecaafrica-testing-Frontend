import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Save, Trash2, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiRequest } from "@/lib/api";
import {
  listTeacherAssignments,
  syncTeacherAssignments,
  type AssignmentPair,
  type TeacherAssignmentRecord,
} from "@/lib/teacher-assignments";

export const Route = createFileRoute("/subject-assignments")({
  component: SubjectAssignmentsPage,
});

type TeacherRecord = { id: string; name: string; email?: string | null; role: string };
type SectionRecord = { id: string; name: string; full_name: string };
type SubjectRecord = { id: string; name: string; code?: string | null; is_active: boolean };

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

function SubjectAssignmentsPage() {
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [sections, setSections] = useState<SectionRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);

  const [teacherId, setTeacherId] = useState("");
  const [saved, setSaved] = useState<TeacherAssignmentRecord[]>([]);
  const [rows, setRows] = useState<AssignmentPair[]>([]);

  const [loading, setLoading] = useState(true);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingSubject, setCreatingSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectCode, setNewSubjectCode] = useState("");
  const [subjectSubmitting, setSubjectSubmitting] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editingSubjectName, setEditingSubjectName] = useState("");
  const [subjectUpdating, setSubjectUpdating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [userList, sectionList, subjectList] = await Promise.all([
          apiRequest<TeacherRecord[]>("/users?role=teacher&limit=500", { auth: "school" }),
          apiRequest<SectionRecord[]>("/sections?limit=500", { auth: "school" }),
          apiRequest<SubjectRecord[]>("/subjects?limit=500", { auth: "school" }),
        ]);
        setTeachers((userList ?? []).filter((user) => user.role === "teacher"));
        setSections(sectionList ?? []);
        setSubjects(subjectList ?? []);
      } catch (error: any) {
        toast.error(error?.message ?? "Failed to load assignment options");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!teacherId) {
      setSaved([]);
      setRows([]);
      return;
    }

    (async () => {
      try {
        setRowsLoading(true);
        const records = await listTeacherAssignments(teacherId);
        setSaved(records);
        setRows(
          records.map((item) => ({
            section_id: item.section_id,
            subject_id: item.subject_id,
          }))
        );
      } catch (error: any) {
        toast.error(error?.message ?? "Failed to load teacher assignments");
      } finally {
        setRowsLoading(false);
      }
    })();
  }, [teacherId]);

  const handleCreateSubject = async () => {
    if (!newSubjectName.trim()) { toast.error("Enter a subject name"); return; }
    setSubjectSubmitting(true);
    try {
      const created = await apiRequest<SubjectRecord>("/subjects", {
        auth: "school",
        method: "POST",
        body: JSON.stringify({ name: newSubjectName.trim(), code: newSubjectCode.trim() || null }),
      });
      setSubjects((prev) => [...prev, created]);
      setNewSubjectName("");
      setNewSubjectCode("");
      setCreatingSubject(false);
      toast.success(`Subject "${created.name}" created`);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create subject");
    } finally {
      setSubjectSubmitting(false);
    }
  };

  const toggleSubject = async (subject: SubjectRecord) => {
    try {
      const updated = await apiRequest<SubjectRecord>(`/subjects/${subject.id}`, {
        auth: "school",
        method: "PATCH",
        body: JSON.stringify({ is_active: !subject.is_active }),
      });
      setSubjects((prev) => prev.map((item) => item.id === updated.id ? updated : item));
      toast.success(`Subject "${updated.name}" ${updated.is_active ? "activated" : "deactivated"}`);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to update subject status");
    }
  };

  const saveSubjectName = async () => {
    const name = editingSubjectName.trim();
    if (!editingSubjectId || name.length < 2) {
      toast.error("Subject name must be at least 2 characters");
      return;
    }
    setSubjectUpdating(true);
    try {
      const updated = await apiRequest<SubjectRecord>(`/subjects/${editingSubjectId}`, {
        auth: "school",
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      setSubjects((prev) => prev.map((item) => item.id === updated.id ? updated : item));
      setEditingSubjectId(null);
      toast.success(`Subject renamed to "${updated.name}"`);
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to rename subject");
    } finally {
      setSubjectUpdating(false);
    }
  };

  const sectionName = (id: string) =>
    sections.find((section) => section.id === id)?.full_name ?? id;
  const subjectName = (id: string) =>
    subjects.find((subject) => subject.id === id)?.name ?? id;

  const duplicateIndexes = useMemo(() => {
    const seen = new Map<string, number>();
    const dupes = new Set<number>();
    rows.forEach((row, index) => {
      if (!row.section_id || !row.subject_id) return;
      const key = `${row.section_id}:${row.subject_id}`;
      if (seen.has(key)) {
        dupes.add(index);
        dupes.add(seen.get(key)!);
      } else {
        seen.set(key, index);
      }
    });
    return dupes;
  }, [rows]);

  const updateRow = (index: number, field: keyof AssignmentPair, value: string) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const handleSave = async () => {
    if (!teacherId) return;

    if (duplicateIndexes.size > 0) {
      toast.error("Remove duplicate class + subject rows before saving");
      return;
    }

    const incomplete = rows.some((row) => !row.section_id || !row.subject_id);
    if (incomplete) {
      toast.error("Every row needs both a class and a subject");
      return;
    }

    try {
      setSaving(true);
      const { added, removed } = await syncTeacherAssignments(teacherId, saved, rows);
      const records = await listTeacherAssignments(teacherId);
      setSaved(records);
      toast.success(
        added || removed
          ? `Assignments saved (${added} added, ${removed} removed)`
          : "No changes to save"
      );
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to save assignments");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout
      title="Subject Assignments"
      subtitle="Assign teachers to the classes and subjects they will grade"
    >
      <div className="mb-5 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Teacher</label>
        </div>
        <select
          value={teacherId}
          onChange={(event) => setTeacherId(event.target.value)}
          disabled={loading}
          className={`mt-1 ${selectClass} max-w-md disabled:opacity-50`}
        >
          <option value="">{loading ? "Loading teachers…" : "Select a teacher"}</option>
          {teachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.name}
              {teacher.email ? ` (${teacher.email})` : ""}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-muted-foreground">
          A teacher can only create exams and enter marks for the class + subject pairs
          assigned here.
        </p>
      </div>

      <div className="mb-5 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold">Subjects</h3>
            <p className="text-xs text-muted-foreground">New subjects are inactive until activated.</p>
          </div>
          <button
            type="button"
            onClick={() => setCreatingSubject((v) => !v)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" /> New Subject
          </button>
        </div>
        {creatingSubject && (
          <div className="flex flex-wrap gap-2 items-end border-t border-border pt-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Name *</label>
              <input
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateSubject(); } }}
                placeholder="e.g. Mathematics"
                autoFocus
                className="h-9 rounded-md border border-input bg-background px-3 text-sm w-48"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Code (optional)</label>
              <input
                value={newSubjectCode}
                onChange={(e) => setNewSubjectCode(e.target.value)}
                placeholder="e.g. MATH"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm w-32"
              />
            </div>
            <button
              type="button"
              onClick={handleCreateSubject}
              disabled={subjectSubmitting}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {subjectSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </button>
            <button
              type="button"
              onClick={() => { setCreatingSubject(false); setNewSubjectName(""); setNewSubjectCode(""); }}
              className="inline-flex h-9 items-center px-3 text-sm font-semibold rounded-md border border-border hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        )}
        {!creatingSubject && (
          <div className="flex flex-wrap gap-1.5">
            {subjects.length === 0
              ? <span className="text-xs text-muted-foreground">No subjects yet.</span>
              : subjects.map((s) => editingSubjectId === s.id ? (
                  <span key={s.id} className="inline-flex items-center gap-1">
                    <input value={editingSubjectName} onChange={(e) => setEditingSubjectName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void saveSubjectName(); if (e.key === "Escape") setEditingSubjectId(null); }}
                      autoFocus className="h-7 w-40 rounded-md border border-input bg-background px-2 text-xs" />
                    <button type="button" onClick={() => void saveSubjectName()} disabled={subjectUpdating}
                      className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50">Save</button>
                    <button type="button" onClick={() => setEditingSubjectId(null)} className="rounded-md border border-border px-2 py-1 text-xs">Cancel</button>
                  </span>
                ) : (
                  <span key={s.id} className="inline-flex items-center gap-1">
                    <button type="button" onClick={() => toggleSubject(s)}
                      title={s.is_active ? "Deactivate subject" : "Activate subject before assigning it"}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.is_active ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                      {s.name}{s.code ? ` (${s.code})` : ""} · {s.is_active ? "Active" : "Activate"}
                    </button>
                    <button type="button" onClick={() => { setEditingSubjectId(s.id); setEditingSubjectName(s.name); }}
                      className="rounded-md border border-border px-1.5 py-0.5 text-xs hover:bg-muted">Edit</button>
                  </span>
                ))}
          </div>
        )}
      </div>

      {!teacherId ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          <BookOpen className="mx-auto mb-3 h-8 w-8 opacity-40" />
          Select a teacher to manage their subject assignments.
        </div>
      ) : rowsLoading ? (
        <div className="p-8 text-center text-muted-foreground">Loading assignments…</div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase">
              <tr>
                <th className="p-3 text-left">Class</th>
                <th className="p-3 text-left">Subject</th>
                <th className="w-16 p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-muted-foreground">
                    No assignments yet. Add a row to get started.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr
                    key={index}
                    className={`border-t border-border ${
                      duplicateIndexes.has(index) ? "bg-red-50" : ""
                    }`}
                  >
                    <td className="p-2">
                      <select
                        value={row.section_id}
                        onChange={(event) =>
                          updateRow(index, "section_id", event.target.value)
                        }
                        className={selectClass}
                      >
                        <option value="">Select class</option>
                        {sections.map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.full_name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <select
                        value={row.subject_id}
                        onChange={(event) =>
                          updateRow(index, "subject_id", event.target.value)
                        }
                        className={selectClass}
                      >
                        <option value="">Select subject</option>
                        {subjects.filter((subject) => subject.is_active || subject.id === row.subject_id).map((subject) => (
                          <option key={subject.id} value={subject.id} disabled={!subject.is_active}>
                            {subject.name}{!subject.is_active ? " (inactive)" : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2 text-right">
                      <button
                        type="button"
                        onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                        className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-red-600"
                        aria-label="Remove assignment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="flex items-center justify-between gap-3 border-t border-border p-3">
            <button
              type="button"
              onClick={() => setRows((prev) => [...prev, { section_id: "", subject_id: "" }])}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold hover:bg-muted"
            >
              <Plus className="h-4 w-4" /> Add assignment
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save assignments
            </button>
          </div>
        </div>
      )}

      {teacherId && saved.length > 0 && (
        <div className="mt-5 rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 font-display font-bold">Currently saved</h3>
          <div className="flex flex-wrap gap-2">
            {saved.map((item) => (
              <span
                key={item.id}
                className="rounded-full bg-muted px-3 py-1 text-xs font-medium"
              >
                {sectionName(item.section_id)} — {subjectName(item.subject_id)}
              </span>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
