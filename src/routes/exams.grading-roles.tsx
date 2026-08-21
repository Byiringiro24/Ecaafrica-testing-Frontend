import { createFileRoute } from "@tanstack/react-router";
import { GradingRolesPanel } from "@/components/exams/ExamConfigurationPanel";
import { schoolAdminRouteGuard } from "@/lib/schoolAuth";

export const Route = createFileRoute("/exams/grading-roles")({ beforeLoad: ({ location }) => schoolAdminRouteGuard(location), component: GradingRolesPage });
function GradingRolesPage() { return <GradingRolesPanel />; }
