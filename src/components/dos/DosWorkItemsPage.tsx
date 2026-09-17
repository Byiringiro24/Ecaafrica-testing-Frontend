import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { DosLayout } from "@/components/layout/DosLayout";
import { apiRequest } from "@/lib/api";
import { directorOfStudiesRouteGuard } from "@/lib/schoolAuth";

export type DosWorkItemType =
  | "calendar" | "curriculum" | "syllabus" | "lesson_plan" | "performance"
  | "risk" | "intervention" | "referral" | "meeting" | "parent_chat" | "alert"
  | "room" | "substitution" | "assessment";

type WorkItem = {
  id: string; type: DosWorkItemType; title: string; status: string; priority: string;
  student_id?: string | null; payload: Record<string, unknown>; updated_at: string;
};

const labels: Record<DosWorkItemType, string> = {
  calendar: "Academic Calendar", curriculum: "Curriculum", syllabus: "Syllabus Progress",
  lesson_plan: "Lesson Plans", performance: "Academic Performance", risk: "Academic Risk",
  intervention: "Interventions", referral: "DOD/DOS Referrals", meeting: "Academic Meetings",
  parent_chat: "Parent Academic Chat", alert: "Academic Alerts", room: "Rooms",
  substitution: "Teacher Substitution", assessment: "Assessments"
};

const defaultPayload: Record<string, unknown> = {
  academic_year: "", term: "", class_name: "", subject: "", teacher: "",
  notes: "", review_date: "", outcome: ""
};

export function DosWorkItemsPage({ type, description }: { type: DosWorkItemType; description: string }) {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<WorkItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ title: "", student_id: "", priority: "normal", status: "open", payload: JSON.stringify(defaultPayload, null, 2) });

  const load = async () => {
    setLoading(true);
    try {
      const result = await apiRequest<{ data: WorkItem[] }>(`/dos/work-items?type=${type}&limit=200`, { auth: "school" });
      setItems(Array.isArray(result) ? result : result.data ?? []);
    } catch (error: any) { toast.error(error?.message ?? `Failed to load ${labels[type]}`); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [type]);

  const filtered = useMemo(() => items.filter(item =>
    (!query || item.title.toLowerCase().includes(query.toLowerCase()) || item.student_id?.includes(query)) &&
    (!status || item.status === status)
  ), [items, query, status]);

  const reset = () => {
    setEditing(null);
    setFormOpen(false);
    setForm({ title: "", student_id: "", priority: "normal", status: "open", payload: JSON.stringify(defaultPayload, null, 2) });
  };
  const startEdit = (item: WorkItem) => {
    setEditing(item);
    setFormOpen(true);
    setForm({ title: item.title, student_id: item.student_id ?? "", priority: item.priority, status: item.status, payload: JSON.stringify(item.payload ?? {}, null, 2) });
  };
  const save = async () => {
    if (form.title.trim().length < 2) { toast.error("Enter a title"); return; }
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(form.payload || "{}"); } catch { toast.error("Payload must be valid JSON"); return; }
    try {
      const body = { type, title: form.title.trim(), student_id: form.student_id || null, priority: form.priority, status: form.status, payload };
      if (editing) await apiRequest(`/dos/work-items/${editing.id}`, { auth: "school", method: "PATCH", body: JSON.stringify(body) });
      else await apiRequest("/dos/work-items", { auth: "school", method: "POST", body: JSON.stringify(body) });
      toast.success(editing ? "DOS record updated" : "DOS record created"); reset(); await load();
    } catch (error: any) { toast.error(error?.message ?? "Unable to save record"); }
  };
  const remove = async (item: WorkItem) => {
    if (!window.confirm(`Delete ${item.title}?`)) return;
    try { await apiRequest(`/dos/work-items/${item.id}`, { auth: "school", method: "DELETE" }); toast.success("Record deleted"); await load(); }
    catch (error: any) { toast.error(error?.message ?? "Unable to delete record"); }
  };

  return <DosLayout title={labels[type]} subtitle={description}>
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <div className="relative min-w-56 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search records…" className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" /></div>
      <select value={status} onChange={e => setStatus(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="">All statuses</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select>
      <button onClick={() => { reset(); setFormOpen(true); }} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> New record</button>
    </div>
    {formOpen && <div className="mb-5 rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-lg font-bold">{editing ? "Edit record" : `New ${labels[type]} record`}</h2><button onClick={reset}><X className="h-5 w-5" /></button></div>
      <div className="grid gap-3 md:grid-cols-4"><input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Title / subject" className="h-10 rounded-lg border border-input bg-background px-3 text-sm md:col-span-2" /><input value={form.student_id} onChange={e => setForm(p => ({ ...p, student_id: e.target.value }))} placeholder="Student ID (optional)" className="h-10 rounded-lg border border-input bg-background px-3 text-sm" /><select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="low">Low priority</option><option value="normal">Normal priority</option><option value="high">High priority</option><option value="urgent">Urgent</option></select></div>
      <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr]"><select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select><textarea value={form.payload} onChange={e => setForm(p => ({ ...p, payload: e.target.value }))} rows={6} className="rounded-lg border border-input bg-background p-3 font-mono text-xs" aria-label="DOS record details JSON" /></div>
      <div className="mt-3 flex justify-end gap-2"><button onClick={reset} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">Cancel</button><button onClick={() => void save()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save record</button></div>
    </div>}
    <div className="overflow-hidden rounded-xl border border-border bg-card"><table className="w-full text-sm"><thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Title</th><th className="px-4 py-3">Student</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr></thead><tbody>{loading ? <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr> : filtered.length === 0 ? <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No {labels[type].toLowerCase()} records yet.</td></tr> : filtered.map(item => <tr key={item.id} className="border-t border-border"><td className="px-4 py-3 font-medium">{item.title}</td><td className="px-4 py-3 text-muted-foreground">{item.student_id ?? "—"}</td><td className="px-4 py-3 capitalize">{item.priority}</td><td className="px-4 py-3"><span className="rounded-full bg-muted px-2 py-1 text-xs capitalize">{item.status.replace("_", " ")}</span></td><td className="px-4 py-3 text-right"><button onClick={() => startEdit(item)} className="mr-2 rounded-md p-2 hover:bg-muted"><Pencil className="h-4 w-4" /></button><button onClick={() => void remove(item)} className="rounded-md p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div>
  </DosLayout>;
}

export const dosWorkItemGuard = directorOfStudiesRouteGuard;
