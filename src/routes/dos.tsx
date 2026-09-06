import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSchoolAuth, isDirectorOfStudiesRole } from "@/lib/schoolAuth";

export const Route = createFileRoute("/dos")({
  beforeLoad: ({ location }) => {
    const auth = getSchoolAuth();
    if (auth?.accessToken && isDirectorOfStudiesRole(auth.user?.role)) return;
    throw redirect({ to: "/login", search: { redirect: location.pathname } });
  },
  component: () => <Outlet />,
});
