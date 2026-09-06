import { createFileRoute } from "@tanstack/react-router";
import { DodLayout } from "@/components/layout/DodLayout";
import { BoardingAttendanceManager } from "@/components/boarding/BoardingAttendanceManager";
import { dodRouteGuard } from "@/lib/schoolAuth";

export const Route = createFileRoute("/dod/attendance")({
  beforeLoad: ({ location }) => dodRouteGuard(location),
  component: () => <DodLayout title="Dormitory Attendance" subtitle="Record attendance for dormitory students only"><BoardingAttendanceManager canEdit /></DodLayout>,
});
