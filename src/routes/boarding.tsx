import { createFileRoute, Outlet } from "@tanstack/react-router";
import { boardingRouteGuard } from "@/lib/schoolAuth";

export const Route = createFileRoute("/boarding")({
  beforeLoad: ({ location }) => boardingRouteGuard(location),
  component: () => <Outlet />,
});
