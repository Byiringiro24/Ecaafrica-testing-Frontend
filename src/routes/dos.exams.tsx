/** DOS — Exams & Results overview */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DosLayout } from "@/components/layout/DosLayout";
import { directorOfStudiesRouteGuard } from "@/lib/schoolAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/dos/exams")({
  beforeLoad: ({ location }) => directorOfStudiesRouteGuard(location),
  component: DosExamsPage,
});

type Exam = { id: string; name: string; status: string; start_date?: string | null; end_date?: string | null; class?: { name: string } | null; subject?: { name: string } | null };

const STATUS_BADGE: Record<string, string> = {
  draft:      "bg-muted text-muted-foreground",
  scheduled:  "bg-blue-100 text-blue-700",
  ongoing:    "bg-amber-100 text-amber-700",
  completed:  "bg-emerald-100 text-emerald-700",
  published:  "bg-purple-100 text-purple-700",
  cancelled:  "bg-destructive/15 text-destructive",
};

function DosExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<Exam[]>("/exams?limit=500", { auth: "school" })
      .then(d => setExams(Array.isArray(d) ? d : []))
      .catch(e => toast.error(e?.message ?? "Failed to load exams"))
      .finally(() => setLoading(false));
  }, []);

  const byStatus = (s: string) => exams.filter(e => e.status === s).length;

  return (
    <DosLayout title="Exams & Results" subtitle="Monitor exam schedule and results publication">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />) : (
          <>
            {[
              { label: "Scheduled", value: byStatus("scheduled"),  color: "bg-blue-50 border-blue-200" },
              { label: "Ongoing",   value: byStatus("ongoing"),    color: "bg-amber-50 border-amber-200" },
              { label: "Completed", value: byStatus("completed"),  color: "bg-emerald-50 border-emerald-200" },
              { label: "Published", value: byStatus("published"),  color: "bg-purple-50 border-purple-200" },
            ].map(({ label, value, color }) => (
              <div key={label} className={`rounded-xl border p-4 ${color}`}>
                <div className="text-2xl font-bold font-display">{value}</div>
                <div className="text-xs text-muted-foreground mt-1">{label}</div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                {["Exam Name", "Class", "Subject", "Start", "End", "Status"].map(h => (
                  <th key={h} className="text-left px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : exams.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No exams found.</td></tr>
              ) : exams.map(e => (
                <tr key={e.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{e.name}</td>
                  <td className="px-4 py-3 text-xs">{e.class?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">{e.subject?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">{e.start_date?.slice(0, 10) ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">{e.end_date?.slice(0, 10) ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_BADGE[e.status] ?? "bg-muted text-muted-foreground"}`}>
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DosLayout>
  );
}
