/** DOS — Academic reports overview */
import { createFileRoute, Link } from "@tanstack/react-router";
import { DosLayout } from "@/components/layout/DosLayout";
import { directorOfStudiesRouteGuard } from "@/lib/schoolAuth";
import { BarChart3, FileText, GraduationCap, ClipboardCheck } from "lucide-react";

export const Route = createFileRoute("/dos/reports")({
  beforeLoad: ({ location }) => directorOfStudiesRouteGuard(location),
  component: DosReportsPage,
});

function DosReportsPage() {
  const reportLinks = [
    { to: "/dos/attendance", label: "Attendance Summary",    desc: "Daily class attendance submission rates by section", icon: ClipboardCheck },
    { to: "/dos/exams",      label: "Exam Results",          desc: "Published and pending exam results by class",         icon: GraduationCap },
    { to: "/dos/classes",    label: "Class & Subject Report", desc: "Academic structure — classes, sections, subjects",    icon: FileText },
    { to: "/dos/staff",      label: "Staff Allocation",      desc: "Teaching staff assignments and roles",                icon: BarChart3 },
  ];

  return (
    <DosLayout title="Academic Reports" subtitle="Reports and summaries for academic oversight">
      <div className="grid gap-4 md:grid-cols-2">
        {reportLinks.map(({ to, label, desc, icon: Icon }) => (
          <Link key={to} to={to}
            className="rounded-xl border border-border bg-card p-5 flex items-start gap-4 hover:bg-muted/30 transition">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-sm">{label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </DosLayout>
  );
}
