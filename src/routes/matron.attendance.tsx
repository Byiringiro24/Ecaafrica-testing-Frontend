import { createFileRoute } from "@tanstack/react-router";
import { patronRouteGuard } from "@/lib/schoolAuth";
// Matrons use the same boarding attendance page as patrons
// (sessions, device push, manual attendance correction)
import { PatronAttendancePage } from "@/routes/patron.attendance";

export const Route = createFileRoute("/matron/attendance" as any)({
  beforeLoad: ({ location }) => patronRouteGuard(location),
  component: PatronAttendancePage,
});
