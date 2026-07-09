import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/super-admin/system")({
  beforeLoad: () => {
    throw redirect({ to: "/super-admin", replace: true });
  },
});
