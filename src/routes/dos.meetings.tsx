import { createFileRoute } from "@tanstack/react-router";
import { DosWorkItemsPage, dosWorkItemGuard } from "@/components/dos/DosWorkItemsPage";

export const Route = createFileRoute("/dos/meetings")({
  beforeLoad: ({ location }) => dosWorkItemGuard(location),
  component: () => <DosWorkItemsPage type="meeting" description="Schedule academic parent, department and examination meetings." />,
});
