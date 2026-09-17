import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSchoolAuth, isDirectorOfDisciplineRole } from "@/lib/schoolAuth";

export const Route = createFileRoute("/dod")({
  beforeLoad: ({ location }) => {
    const auth = getSchoolAuth();
    if (auth?.accessToken && isDirectorOfDisciplineRole(auth.user?.role)) return;
    throw redirect({ to: "/login", search: { redirect: location.pathname } });
  },
  component: () => <Outlet />,
});
