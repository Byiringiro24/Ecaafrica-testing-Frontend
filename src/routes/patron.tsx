import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSchoolAuth, isPatronRole } from "@/lib/schoolAuth";

export const Route = createFileRoute("/patron")({
  beforeLoad: ({ location }) => {
    const auth = getSchoolAuth();
    if (auth?.accessToken && isPatronRole(auth.user?.role)) return;
    throw redirect({ to: "/login", search: { redirect: location.pathname } });
  },
  component: () => <Outlet />,
});
