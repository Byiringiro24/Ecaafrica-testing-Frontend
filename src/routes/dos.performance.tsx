import { createFileRoute } from "@tanstack/react-router";
import { DosWorkItemsPage, dosWorkItemGuard } from "@/components/dos/DosWorkItemsPage";

export const Route = createFileRoute("/dos/performance")({
  beforeLoad: ({ location }) => dosWorkItemGuard(location),
  component: () => <DosWorkItemsPage type="performance" description="Record and review academic performance monitoring." />,
});
