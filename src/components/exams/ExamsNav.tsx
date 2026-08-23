import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/exams", label: "Overview", match: "exact" as const },
  { to: "/exams/terms", label: "Terms", match: "prefix" as const },
  { to: "/exams/exam-types", label: "Exam Types", match: "prefix" as const },
  { to: "/exams/grading-roles", label: "Grading Roles", match: "prefix" as const },
  { to: "/exams/review", label: "Review Submissions", match: "prefix" as const },
  { to: "/exams/grade-update-requests", label: "Grade Update Requests", match: "prefix" as const },
  { to: "/exams/schedule", label: "Exam Schedule", match: "prefix" as const },
  { to: "/exams/published", label: "Published Results", match: "exact" as const },
  { to: "/exams/published/all", label: "Whole Exam", match: "prefix" as const },
  { to: "/exams/report-cards", label: "Report Cards", match: "prefix" as const },
  { to: "/exams/analytics", label: "Analytics", match: "prefix" as const },
] as const;

export function ExamsNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const normalized = pathname.replace(/\/+$/, "") || "/";

  return (
    <div className="flex flex-wrap gap-1 border-b border-border mb-5">
      {TABS.map((tab) => {
        const normalizedTo = tab.to.replace(/\/+$/, "") || "/";
        const active =
          tab.match === "exact"
            ? normalized === normalizedTo
            : normalized === normalizedTo || normalized.startsWith(`${normalizedTo}/`);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              "px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
