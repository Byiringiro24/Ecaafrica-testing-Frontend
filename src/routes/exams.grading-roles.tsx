import { createFileRoute } from "@tanstack/react-router";
import { GradingRolesPanel } from "@/components/exams/ExamConfigurationPanel";
import { academicManagementRouteGuard } from "@/lib/schoolAuth";

export const Route = createFileRoute("/exams/grading-roles")({ beforeLoad: ({ location }) => academicManagementRouteGuard(location), component: GradingRolesPage });
function GradingRolesPage() { return <GradingRolesPanel />; }
