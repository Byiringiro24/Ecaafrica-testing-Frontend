import { createFileRoute, Outlet } from "@tanstack/react-router";
import { staffRouteGuard } from "@/lib/schoolAuth";

/** Layout: school HR at /staff/ (index) + staff panel at /staff/dashboard, etc. */
export const Route = createFileRoute("/staff")({
  beforeLoad: ({ location }) => staffRouteGuard(location),
  component: StaffRouteLayout,
});

function StaffRouteLayout() {
  return <Outlet />;
}
