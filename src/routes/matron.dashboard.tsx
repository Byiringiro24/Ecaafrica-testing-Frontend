import { createFileRoute } from "@tanstack/react-router";
import { PatronDashboard } from "./patron.dashboard";
import { patronRouteGuard } from "@/lib/schoolAuth";

/** Matrons use the same boarding dashboard and assignment tools as patrons. */
export const Route = createFileRoute("/matron/dashboard")({
  beforeLoad: ({ location }) => patronRouteGuard(location),
  component: PatronDashboard,
});
