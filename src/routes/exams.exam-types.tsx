import { createFileRoute } from "@tanstack/react-router";
import { ExamTypesPanel } from "@/components/exams/ExamConfigurationPanel";
import { academicManagementRouteGuard } from "@/lib/schoolAuth";

export const Route = createFileRoute("/exams/exam-types")({ beforeLoad: ({ location }) => academicManagementRouteGuard(location), component: ExamTypesPage });
function ExamTypesPage() { return <ExamTypesPanel />; }
