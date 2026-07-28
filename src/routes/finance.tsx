import { createFileRoute, Outlet } from "@tanstack/react-router";
import { financeOfficerRouteGuard } from "@/lib/schoolAuth";

export const Route = createFileRoute("/finance")({
  beforeLoad: ({ location }) => financeOfficerRouteGuard(location),
  component: FinanceRouteLayout,
});

function FinanceRouteLayout() {
  return <Outlet />;
}
