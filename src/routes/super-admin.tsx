import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout route — child pages render via Outlet (see super-admin.index.tsx, etc.) */
export const Route = createFileRoute("/super-admin")({
  component: SuperAdminRouteLayout,
});

function SuperAdminRouteLayout() {
  return <Outlet />;
}
