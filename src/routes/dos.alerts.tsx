import { createFileRoute } from "@tanstack/react-router";
import { DosWorkItemsPage, dosWorkItemGuard } from "@/components/dos/DosWorkItemsPage";

export const Route = createFileRoute("/dos/alerts")({
  beforeLoad: ({ location }) => dosWorkItemGuard(location),
  component: () => <DosWorkItemsPage type="alert" description="Manage academic alerts and escalation status." />,
});
