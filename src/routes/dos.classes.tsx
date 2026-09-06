/** DOS — Classes and subjects overview */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiRequest<ClassRecord[]>("/classes?limit=200", { auth: "school" }).catch(() => []),
      apiRequest<SubjectRecord[]>("/subjects?limit=200", { auth: "school" }).catch(() => []),
    ]).then(([c, s]) => {
      setClasses(Array.isArray(c) ? c : []);
      setSubjects(Array.isArray(s) ? s : []);
    }).catch(e => toast.error(e?.message ?? "Failed to load")).finally(() => setLoading(false));
  }, []);

  return (
    <DosLayout title="Classes & Subjects" subtitle="Overview of academic structure">
      <div className="flex gap-1 border-b border-border mb-5">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

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
    </DosLayout>
  );
}
