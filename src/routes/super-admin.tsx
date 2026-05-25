import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getPlatformAuth } from "@/lib/platformAuth";

/** Layout route — child pages render via Outlet (see super-admin.index.tsx, etc.) */
export const Route = createFileRoute("/super-admin")({
  beforeLoad: ({ location }) => {
    const auth = getPlatformAuth();
    if (!auth?.accessToken) {
      const rawSearch = location.search;
      const search =
        typeof rawSearch === "string"
          ? rawSearch
          : new URLSearchParams(rawSearch ?? {}).toString();
      const searchSuffix = search
        ? search.startsWith("?")
          ? search
          : `?${search}`
        : "";
      const redirectTo = `${location.pathname}${searchSuffix}`;
      throw redirect({ to: "/login", search: { redirect: redirectTo } });
    }
  },
  component: SuperAdminRouteLayout,
});

function SuperAdminRouteLayout() {
  return <Outlet />;
}
