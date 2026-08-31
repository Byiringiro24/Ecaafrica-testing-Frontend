/** DOS — monitor class attendance submission across all sections */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { DosLayout } from "@/components/layout/DosLayout";
import { directorOfStudiesRouteGuard } from "@/lib/schoolAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/dos/attendance")({
  beforeLoad: ({ location }) => directorOfStudiesRouteGuard(location),
  component: DosAttendancePage,
});

type AttSession = {
  id: string; session_date: string; session_type: string;
  submitted_at?: string | null; started_at?: string | null;
  section?: { id: string; name: string; full_name?: string | null } | null;
};

function DosAttendancePage() {
  const [sessions, setSessions] = useState<AttSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [query, setQuery] = useState("");

  useEffect(() => {
    setLoading(true);
    apiRequest<AttSession[]>(`/attendance/sessions?date=${date}&limit=500&session_type=class`, { auth: "school" })
      .then(d => setSessions(Array.isArray(d) ? d : []))
      .catch(e => toast.error(e?.message ?? "Failed to load"))
      .finally(() => setLoading(false));
  }, [date]);

  const filtered = sessions.filter(s => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (s.section?.name ?? "").toLowerCase().includes(q) ||
           (s.section?.full_name ?? "").toLowerCase().includes(q);
  });

  const submitted = filtered.filter(s => s.submitted_at).length;
  const pending   = filtered.filter(s => !s.submitted_at).length;

  return (
    <DosLayout title="Class Attendance" subtitle="Monitor attendance submission across all classes">
      {/* Date + search */}
      <div className="flex flex-wrap gap-3 items-center mb-5">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search class…"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" />
        </div>
        <div className="flex gap-4 text-sm">
          <span className="text-emerald-600 font-semibold">{submitted} submitted</span>
          <span className="text-destructive font-semibold">{pending} pending</span>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                {["Class / Section", "Type", "Started", "Submitted", "Status"].map(h => (
                  <th key={h} className="text-left px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No attendance sessions found for {date}.</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{s.section?.full_name ?? s.section?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-xs capitalize">{s.session_type.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-xs">{s.started_at ? new Date(s.started_at).toLocaleTimeString() : "—"}</td>
                  <td className="px-4 py-3 text-xs">{s.submitted_at ? new Date(s.submitted_at).toLocaleTimeString() : "—"}</td>
                  <td className="px-4 py-3">
                    {s.submitted_at ? (
                      <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold">
                        <CheckCircle className="h-4 w-4" /> Submitted
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-destructive text-xs font-semibold">
                        <XCircle className="h-4 w-4" /> Pending
                      </div>
                    )}
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
