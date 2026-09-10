import { createFileRoute, Outlet } from "@tanstack/react-router";
import { getSchoolAuth } from "@/lib/schoolAuth";
import { redirect } from "@tanstack/react-router";

/** Layout: school HR at /staff/ (index) + staff management at /staff/management */
export const Route = createFileRoute("/staff")({
  beforeLoad: () => {
    const auth = getSchoolAuth();
    const role = auth?.user?.role?.toLowerCase();
    // Staff role → /staff/ HR pages
    // school_admin, DOD, DOS → /staff/management only (they have their own beforeLoad there)
    const allowed = ["staff", "school_admin", "director_of_discipline", "director_of_studies"];
    if (auth?.accessToken && role && allowed.includes(role)) return;
    throw redirect({ to: "/login" });
  },
  component: StaffRouteLayout,
});

function StaffRouteLayout() {
  return <Outlet />;
}
