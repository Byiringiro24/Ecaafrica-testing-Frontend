/** DOS — Classes and subjects overview */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { DosLayout } from "@/components/layout/DosLayout";
import { directorOfStudiesRouteGuard } from "@/lib/schoolAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/dos/classes")({
  beforeLoad: ({ location }) => directorOfStudiesRouteGuard(location),
  component: DosClassesPage,
});

type ClassRecord = { id: string; name: string; level?: number; sections?: { id: string; name: string; full_name?: string }[] };
type SubjectRecord = { id: string; name: string; code?: string; is_active?: boolean };

const TABS = ["Classes", "Subjects"] as const;

function DosClassesPage() {
  const [tab, setTab] = useState<typeof TABS[number]>("Classes");
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [classForm, setClassForm] = useState({ name: "", level: "" });
  const [subjectForm, setSubjectForm] = useState({ name: "", code: "" });

  const load = () => {
    setLoading(true);
    Promise.all([
      apiRequest<ClassRecord[]>("/classes?limit=200", { auth: "school" }).catch(() => []),
      apiRequest<SubjectRecord[]>("/subjects?limit=200", { auth: "school" }).catch(() => []),
    ]).then(([c, s]) => {
      setClasses(Array.isArray(c) ? c : []);
      setSubjects(Array.isArray(s) ? s : []);
    }).catch(e => toast.error(e?.message ?? "Failed to load")).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classForm.name.trim()) { toast.error("Class name required"); return; }
    setSaving(true);
    try {
      await apiRequest("/classes", { method: "POST", auth: "school", body: JSON.stringify({ name: classForm.name.trim(), level: classForm.level ? Number(classForm.level) : undefined }) });
      toast.success("Class created"); setShowCreate(false); setClassForm({ name: "", level: "" }); load();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setSaving(false); }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectForm.name.trim()) { toast.error("Subject name required"); return; }
    setSaving(true);
    try {
      await apiRequest("/subjects", { method: "POST", auth: "school", body: JSON.stringify({ name: subjectForm.name.trim(), code: subjectForm.code.trim() || null }) });
      toast.success("Subject created"); setShowCreate(false); setSubjectForm({ name: "", code: "" }); load();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setSaving(false); }
  };

  return (
    <DosLayout title="Classes & Subjects" subtitle="Manage academic structure">
      <div className="flex justify-between items-center mb-1">
        <div className="flex gap-1 border-b border-border">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t}
            </button>
          ))}
        </div>
        <button onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90">
          <Plus className="h-4 w-4" /> {tab === "Classes" ? "Add Class" : "Add Subject"}
        </button>
      </div>
      <div className="mt-5">

      {loading ? <Skeleton className="h-64" /> : (
        <>
          {tab === "Classes" && (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {classes.map(c => (
                <div key={c.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="font-semibold">{c.name}</div>
                  {c.level && <div className="text-xs text-muted-foreground">Level {c.level}</div>}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(c.sections ?? []).map(s => (
                      <span key={s.id} className="rounded-md bg-muted px-2 py-0.5 text-xs">{s.name}</span>
                    ))}
                  </div>
                </div>
              ))}
              {classes.length === 0 && <p className="text-sm text-muted-foreground col-span-3">No classes found.</p>}
            </div>
          )}
          {tab === "Subjects" && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    {["Subject", "Code", "Status"].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {subjects.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No subjects found.</td></tr>
                  ) : subjects.map(s => (
                    <tr key={s.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-xs font-mono">{s.code ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${s.is_active !== false ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                          {s.is_active !== false ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>

      {/* Create Class / Subject Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display font-bold">{tab === "Classes" ? "Add Class" : "Add Subject"}</h3>
              <button onClick={() => setShowCreate(false)}><X className="h-4 w-4" /></button>
            </div>
            {tab === "Classes" ? (
              <form onSubmit={handleCreateClass} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Class Name *</label>
                  <input value={classForm.name} onChange={e => setClassForm(f => ({ ...f, name: e.target.value }))} required
                    className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="e.g. Senior 1" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Level</label>
                  <input value={classForm.level} onChange={e => setClassForm(f => ({ ...f, level: e.target.value }))} type="number" min="1"
                    className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="e.g. 1" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
                  <button type="submit" disabled={saving} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">{saving ? "Saving…" : "Create"}</button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreateSubject} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Subject Name *</label>
                  <input value={subjectForm.name} onChange={e => setSubjectForm(f => ({ ...f, name: e.target.value }))} required
                    className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="e.g. Mathematics" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Code</label>
                  <input value={subjectForm.code} onChange={e => setSubjectForm(f => ({ ...f, code: e.target.value }))}
                    className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="e.g. MATH" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
                  <button type="submit" disabled={saving} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">{saving ? "Saving…" : "Create"}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </DosLayout>
  );
}
