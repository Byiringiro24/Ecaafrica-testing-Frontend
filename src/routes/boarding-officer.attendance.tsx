import { createFileRoute } from "@tanstack/react-router";
import { BoardingOfficerLayout } from "@/components/layout/BoardingOfficerLayout";
import { BoardingAttendanceManager } from "@/components/boarding/BoardingAttendanceManager";
import { boardingOfficerRouteGuard } from "@/lib/schoolAuth";

export const Route = createFileRoute("/boarding-officer/attendance")({
  beforeLoad: ({ location }) => boardingOfficerRouteGuard(location),
  component: () => <BoardingOfficerLayout title="Dormitory Attendance" subtitle="Record attendance for dormitory students only"><BoardingAttendanceManager canEdit /></BoardingOfficerLayout>,
});
