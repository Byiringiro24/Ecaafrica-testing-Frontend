import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout route for /super-admin/schools — list is super-admin.schools.index.tsx */
export const Route = createFileRoute("/super-admin/schools")({
  component: SchoolsRouteLayout,
});

function SchoolsRouteLayout() {
  return <Outlet />;
}
