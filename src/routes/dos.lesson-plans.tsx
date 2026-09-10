import { createFileRoute } from "@tanstack/react-router";
import { DosWorkItemsPage, dosWorkItemGuard } from "@/components/dos/DosWorkItemsPage";

export const Route = createFileRoute("/dos/lesson-plans")({
  beforeLoad: ({ location }) => dosWorkItemGuard(location),
  component: () => <DosWorkItemsPage type="lesson_plan" description="Review lesson-plan submissions and lesson coverage." />,
});
