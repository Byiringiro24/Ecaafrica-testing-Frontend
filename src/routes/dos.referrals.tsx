import { createFileRoute } from "@tanstack/react-router";
import { DosWorkItemsPage, dosWorkItemGuard } from "@/components/dos/DosWorkItemsPage";

export const Route = createFileRoute("/dos/referrals")({
  beforeLoad: ({ location }) => dosWorkItemGuard(location),
  component: () => <DosWorkItemsPage type="referral" description="Manage controlled DOS/DOD academic referrals." />,
});
