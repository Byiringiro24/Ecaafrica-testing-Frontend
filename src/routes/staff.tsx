import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout: school HR at /staff/ (index) + staff panel at /staff/dashboard, etc. */
export const Route = createFileRoute("/staff")({
  component: StaffRouteLayout,
});

function StaffRouteLayout() {
  return <Outlet />;
}
