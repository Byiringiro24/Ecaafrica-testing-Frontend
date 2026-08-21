import { createFileRoute } from "@tanstack/react-router";
import { ExamTypesPanel } from "@/components/exams/ExamConfigurationPanel";
import { schoolAdminRouteGuard } from "@/lib/schoolAuth";

export const Route = createFileRoute("/exams/exam-types")({ beforeLoad: ({ location }) => schoolAdminRouteGuard(location), component: ExamTypesPage });
function ExamTypesPage() { return <ExamTypesPanel />; }
