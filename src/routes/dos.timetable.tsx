/** DOS — Timetable overview (read-only view of all sections) */
import { createFileRoute, Link } from "@tanstack/react-router";
import { DosLayout } from "@/components/layout/DosLayout";
import { directorOfStudiesRouteGuard } from "@/lib/schoolAuth";

export const Route = createFileRoute("/dos/timetable")({
  beforeLoad: ({ location }) => directorOfStudiesRouteGuard(location),
  component: DosTimetablePage,
});

function DosTimetablePage() {
  return (
    <DosLayout title="Timetable Overview" subtitle="Review and approve class timetables">
      <div className="rounded-xl border border-border bg-card p-6 text-center space-y-3">
        <p className="text-muted-foreground text-sm">
          The timetable module is managed under the School Admin panel.
          As Director of Studies, use the link below to view the full timetable.
        </p>
        <Link to="/timetable"
          className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:bg-primary/90">
          Open Timetable Module
        </Link>
      </div>
    </DosLayout>
  );
}
