/** DOS — Full timetable management (same functionality as school admin timetable) */
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Plus, X, Trash2, Loader2, Settings, Clock } from "lucide-react";
import { toast } from "sonner";
import { DosLayout } from "@/components/layout/DosLayout";
import { directorOfStudiesRouteGuard } from "@/lib/schoolAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/dos/timetable")({
  beforeLoad: ({ location }) => directorOfStudiesRouteGuard(location),
  component: DosTimetablePage,
});

const AUTH = { auth: "school" as const };
const DAYS = [
  { label: "Mon", value: 1 }, { label: "Tue", value: 2 },
  { label: "Wed", value: 3 }, { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
];

type Period   = { id: string; name: string; start_time: string; end_time: string; is_break: boolean; sort_order: number };
type Section  = { id: string; name: string; full_name: string };
type Subject  = { id: string; name: string; code?: string | null };
type Teacher  = { id: string; name: string };
type Term     = { id: string; name: string; is_current?: boolean | null };
type Slot     = { id: string; section_id: string; subject_id: string; teacher_id: string; period_id: string; day_of_week: number; room?: string | null; term_id?: string | null };

function fmt(v?: string | null) {
  if (!v) return "";
  const m = /(\d{1,2}):(\d{2})/.exec(v.includes("T") ? v.slice(v.indexOf("T") + 1) : v);
  if (!m) return "";
  const h = Number(m[1]); const min = m[2];
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${min} ${ampm}`;
}

function DosTimetablePage() {
  const [periods, setPeriods]   = useState<Period[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [terms, setTerms]       = useState<Term[]>([]);
  const [slots, setSlots]       = useState<Slot[]>([]);
  const [loading, setLoading]   = useState(true);
  const [viewMode, setViewMode] = useState<"Timetable Grid" | "Manage Periods">("Timetable Grid");

  const [sectionId, setSectionId] = useState("");
  const [termId, setTermId]       = useState("");
  const [saving, setSaving]       = useState(false);

  // Add slot form
  const [showAdd, setShowAdd]     = useState(false);
  const [addDay, setAddDay]       = useState(1);
  const [addPeriodId, setAddPeriodId] = useState("");
  const [addSubjectId, setAddSubjectId] = useState("");
  const [addTeacherId, setAddTeacherId] = useState("");
  const [addRoom, setAddRoom]     = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [pRes, secRes, subRes, tRes, termRes] = await Promise.all([
          apiRequest<Period[]>("/timetable-periods?limit=100", AUTH).catch(() => []),
          apiRequest<Section[]>("/sections?limit=200", AUTH).catch(() => []),
          apiRequest<Subject[]>("/subjects?limit=200", AUTH).catch(() => []),
          apiRequest<Teacher[]>("/users?role=teacher&limit=200", AUTH).catch(() => []),
          apiRequest<Term[]>("/terms?limit=20", AUTH).catch(() => []),
        ]);
        const ps = Array.isArray(pRes) ? pRes : [];
        const ss = Array.isArray(secRes) ? secRes : [];
        const subs = Array.isArray(subRes) ? subRes : [];
        const ts = Array.isArray(tRes) ? (tRes as any)?.data ?? tRes : [];
        const terms_ = Array.isArray(termRes) ? termRes : [];
        setPeriods(ps.sort((a, b) => a.sort_order - b.sort_order));
        setSections(ss);
        setSubjects(subs);
        setTeachers(Array.isArray(ts) ? ts : []);
        setTerms(terms_);
        const curr = terms_.find(t => t.is_current);
        if (curr && !termId) setTermId(curr.id);
        if (ss.length > 0 && !sectionId) setSectionId(ss[0].id);
        setAddPeriodId(ps.length > 0 ? ps[0].id : "");
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to load timetable data");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!sectionId) return;
    const params = new URLSearchParams({ section_id: sectionId, limit: "500" });
    if (termId) params.set("term_id", termId);
    apiRequest<Slot[]>(`/timetable-slots?${params}`, AUTH)
      .then(d => setSlots(Array.isArray(d) ? d : []))
      .catch(e => toast.error(e?.message ?? "Failed to load slots"));
  }, [sectionId, termId]);

  const slotMap = useMemo(() => {
    const m = new Map<string, Slot>();
    slots.forEach(s => m.set(`${s.day_of_week}-${s.period_id}`, s));
    return m;
  }, [slots]);

  const subjectName = (id: string) => subjects.find(s => s.id === id)?.name ?? "—";
  const teacherName = (id: string) => teachers.find(t => t.id === id)?.name ?? "—";

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionId || !addPeriodId || !addSubjectId || !addTeacherId) {
      toast.error("All fields required"); return;
    }
    setSaving(true);
    try {
      await apiRequest("/timetable-slots", {
        method: "POST", ...AUTH,
        body: JSON.stringify({
          section_id: sectionId, period_id: addPeriodId,
          subject_id: addSubjectId, teacher_id: addTeacherId,
          day_of_week: addDay, room: addRoom || null, term_id: termId || null,
        }),
      });
      toast.success("Slot added");
      setShowAdd(false);
      setAddRoom("");
      // Refresh slots
      const params = new URLSearchParams({ section_id: sectionId, limit: "500" });
      if (termId) params.set("term_id", termId);
      const updated = await apiRequest<Slot[]>(`/timetable-slots?${params}`, AUTH).catch(() => []);
      setSlots(Array.isArray(updated) ? updated : []);
    } catch (e: any) { toast.error(e?.message ?? "Failed to add slot"); }
    finally { setSaving(false); }
  };

  const handleDeleteSlot = async (slot: Slot) => {
    try {
      await apiRequest(`/timetable-slots/${slot.id}`, { method: "DELETE", ...AUTH });
      setSlots(prev => prev.filter(s => s.id !== slot.id));
      toast.success("Slot removed");
    } catch (e: any) { toast.error(e?.message ?? "Failed to delete slot"); }
  };

  return (
    <DosLayout title="Timetable" subtitle="Plan and manage class timetables">
      {/* View tabs */}
      <div className="flex gap-1 border-b border-border mb-5">
        {(["Timetable Grid", "Manage Periods"] as const).map(t => (
          <button key={t} onClick={() => setViewMode(t as any)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px flex items-center gap-2 ${(viewMode as string) === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t === "Timetable Grid" ? <Clock className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
            {t}
          </button>
        ))}
      </div>

      {(viewMode as string) === "Manage Periods" ? (
        <PeriodsManager periods={periods} onRefresh={async () => {
          const p = await apiRequest<Period[]>("/timetable-periods?limit=100", AUTH).catch(() => []);
          setPeriods((Array.isArray(p) ? p : []).sort((a, b) => a.sort_order - b.sort_order));
        }} />
      ) : (
      <>
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center mb-5">
        <select value={sectionId} onChange={e => setSectionId(e.target.value)}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm min-w-40">
          <option value="">— Select Section —</option>
          {sections.map(s => <option key={s.id} value={s.id}>{s.full_name || s.name}</option>)}
        </select>
        {terms.length > 0 && (
          <select value={termId} onChange={e => setTermId(e.target.value)}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm min-w-36">
            <option value="">All Terms</option>
            {terms.map(t => <option key={t.id} value={t.id}>{t.name}{t.is_current ? " (current)" : ""}</option>)}
          </select>
        )}
        <button onClick={() => setShowAdd(true)} disabled={!sectionId}
          className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
          <Plus className="h-4 w-4" /> Add Slot
        </button>
      </div>

      {loading ? <Skeleton className="h-64" /> : !sectionId ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">Select a section to view its timetable.</div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 border-r border-border w-32">Period</th>
                {DAYS.map(d => <th key={d.value} className="text-center px-3 py-3 border-r border-border last:border-r-0 min-w-32">{d.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {periods.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No periods configured. Set up periods in School Admin → Timetable.</td></tr>
              ) : periods.map(p => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3 border-r border-border font-medium">
                    <div>{p.name}</div>
                    <div className="text-[11px] text-muted-foreground">{fmt(p.start_time)} – {fmt(p.end_time)}</div>
                  </td>
                  {DAYS.map(d => {
                    const slot = slotMap.get(`${d.value}-${p.id}`);
                    return (
                      <td key={d.value} className="px-2 py-2 border-r border-border last:border-r-0 text-center align-top">
                        {p.is_break ? (
                          <span className="text-[11px] text-muted-foreground italic">Break</span>
                        ) : slot ? (
                          <div className="rounded-lg bg-primary/10 text-primary p-2 text-left relative group">
                            <div className="font-semibold text-xs">{subjectName(slot.subject_id)}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{teacherName(slot.teacher_id)}</div>
                            {slot.room && <div className="text-[10px] text-muted-foreground">Room {slot.room}</div>}
                            <button onClick={() => void handleDeleteSlot(slot)}
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 rounded p-0.5 hover:bg-destructive/20 text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => { setAddDay(d.value); setAddPeriodId(p.id); setShowAdd(true); }}
                            className="w-full h-10 rounded-lg border border-dashed border-border text-muted-foreground text-xs hover:border-primary hover:text-primary transition">
                            +
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
      )}

      {/* Add Slot Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display font-bold">Add Timetable Slot</h3>
              <button onClick={() => setShowAdd(false)}><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleAddSlot} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Day</label>
                <select value={addDay} onChange={e => setAddDay(Number(e.target.value))}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm">
                  {DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Period</label>
                <select value={addPeriodId} onChange={e => setAddPeriodId(e.target.value)} required
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm">
                  {periods.filter(p => !p.is_break).map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({fmt(p.start_time)})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Subject</label>
                <select value={addSubjectId} onChange={e => setAddSubjectId(e.target.value)} required
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm">
                  <option value="">— Select —</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Teacher</label>
                <select value={addTeacherId} onChange={e => setAddTeacherId(e.target.value)} required
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm">
                  <option value="">— Select —</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Room (optional)</label>
                <input value={addRoom} onChange={e => setAddRoom(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm" placeholder="e.g. Lab 1" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowAdd(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
                <button type="submit" disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? "Saving…" : "Add Slot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </>
      )}
    </DosLayout>
  );
}

// ── Periods Manager sub-component ──────────────────────────────────────────
function PeriodsManager({ periods, onRefresh }: { periods: Period[]; onRefresh: () => Promise<void> }) {
  const AUTH = { auth: "school" as const };
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", start_time: "07:00", end_time: "07:45", is_break: false, sort_order: "" });
  const [show, setShow] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    try {
      await apiRequest("/timetable-periods", {
        method: "POST", ...AUTH,
        body: JSON.stringify({
          name: form.name.trim(),
          start_time: form.start_time,
          end_time: form.end_time,
          is_break: form.is_break,
          sort_order: form.sort_order ? Number(form.sort_order) : periods.length + 1,
        }),
      });
      toast.success("Period created");
      setShow(false);
      setForm({ name: "", start_time: "07:00", end_time: "07:45", is_break: false, sort_order: "" });
      await onRefresh();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await apiRequest(`/timetable-periods/${id}`, { method: "DELETE", ...AUTH });
      toast.success("Period deleted");
      await onRefresh();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setDeleting(null); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{periods.length} period{periods.length !== 1 ? "s" : ""} configured</p>
        <button onClick={() => setShow(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add Period
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              {["Order", "Name", "Start", "End", "Type", ""].map(h => (
                <th key={h} className="text-left px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                No periods yet. Add periods to enable the timetable grid.
              </td></tr>
            ) : periods.map(p => (
              <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                <td className="px-4 py-3 text-xs text-muted-foreground">{p.sort_order}</td>
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 text-xs">{p.start_time ? fmt(p.start_time) : "—"}</td>
                <td className="px-4 py-3 text-xs">{p.end_time ? fmt(p.end_time) : "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${p.is_break ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {p.is_break ? "Break" : "Class"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => void handleDelete(p.id)} disabled={deleting === p.id}
                    className="p-1.5 rounded-md border border-border hover:bg-rose-50 hover:text-rose-600 text-muted-foreground disabled:opacity-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display font-bold">Add Period</h3>
              <button onClick={() => setShow(false)}><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm" placeholder="e.g. Period 1 / Lunch Break" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Start Time</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">End Time</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Sort Order</label>
                <input type="number" min="1" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm" placeholder="e.g. 1" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isBreak" checked={form.is_break} onChange={e => setForm(f => ({ ...f, is_break: e.target.checked }))} className="accent-primary" />
                <label htmlFor="isBreak" className="text-sm font-medium cursor-pointer">This is a break / recess</label>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShow(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
                <button type="submit" disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? "Adding…" : "Add Period"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
