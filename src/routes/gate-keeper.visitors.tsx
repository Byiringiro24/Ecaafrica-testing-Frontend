import { createFileRoute } from "@tanstack/react-router";
import { GateKeeperLayout } from "@/components/layout/GateKeeperLayout";
import { gateKeeperRouteGuard } from "@/lib/schoolAuth";
import { VisitorsManagement } from "@/routes/visitors";

export const Route = createFileRoute("/gate-keeper/visitors")({
  beforeLoad: ({ location }) => gateKeeperRouteGuard(location),
  component: GateKeeperVisitorsPage,
});

function GateKeeperVisitorsPage() {
  return (
    <GateKeeperLayout
      title="Visitor Management"
      subtitle="Campus visitor check-in & check-out"
    >
      <VisitorsManagement />
    </GateKeeperLayout>
  );
}
