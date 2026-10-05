import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/attendance/dining-assignments")({ component: DiningAssignments });
type Teacher = { id: string; name: string; email?: string | null };
type Assignment = { id: string; teacher_id: string; teacher?: Teacher; gender_group: "boys" | "girls"; start_date: string; end_date: string };
const today = () => new Date().toISOString().slice(0, 10);

function DiningAssignments() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [form, setForm] = useState({ teacher_id: "", gender_group: "boys", start_date: today(), end_date: today() });
  const load = async () => {
    try {
      const [users, rows] = await Promise.all([
        apiRequest<any>("/staff?status=active&limit=500", { auth: "school" }),
        apiRequest<Assignment[]>("/boarding/dining/assignments?date=" + today(), { auth: "school" }),
      ]);
      setTeachers(Array.isArray(users) ? users : users?.data ?? []);
      setAssignments(Array.isArray(rows) ? rows : (rows as any)?.data ?? []);
    } catch (e: any) { toast.error(e?.message ?? "Failed to load dining assignments"); }
  };
  useEffect(() => { void load(); }, []);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.teacher_id) return toast.error("Select a teacher");
    try { await apiRequest("/boarding/dining/assignments", { method: "POST", auth: "school", body: JSON.stringify(form) }); toast.success("Dining duty assigned"); await load(); }
    catch (err: any) { toast.error(err?.message ?? "Could not assign teacher"); }
  };
  const remove = async (id: string) => { try { await apiRequest(`/boarding/dining/assignments/${id}`, { method: "DELETE", auth: "school" }); await load(); } catch (e: any) { toast.error(e?.message ?? "Could not remove assignment"); } };
  return <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-5"><div className="flex items-center gap-3"><Users className="h-5 w-5 text-primary" /><div><h2 className="font-display text-lg font-bold">Assign dining attendance teachers</h2><p className="text-sm text-muted-foreground">Multiple teachers can be assigned to either group. Only assigned teachers receive the dining attendance page.</p></div></div>
        <form onSubmit={save} className="mt-5 grid gap-3 md:grid-cols-5">
          <select value={form.teacher_id} onChange={e => setForm({ ...form, teacher_id: e.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="">Select teacher</option>{teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <select value={form.gender_group} onChange={e => setForm({ ...form, gender_group: e.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="boys">Boys</option><option value="girls">Girls</option></select>
          <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm" />
          <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm" />
          <button className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">Assign teacher</button>
        </form>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card"><table className="w-full text-sm"><thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Teacher</th><th className="px-4 py-3">Group</th><th className="px-4 py-3">Duty dates</th><th /></tr></thead><tbody>{assignments.map(a => <tr key={a.id} className="border-t"><td className="px-4 py-3 font-medium">{a.teacher?.name ?? a.teacher_id}</td><td className="px-4 py-3 capitalize">{a.gender_group}</td><td className="px-4 py-3">{a.start_date} — {a.end_date}</td><td className="px-4 py-3 text-right"><button onClick={() => void remove(a.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></button></td></tr>)}{!assignments.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No active assignments for today.</td></tr>}</tbody></table></div>
    </div>;
}
