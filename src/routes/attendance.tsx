import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { AttendanceNav } from "@/components/attendance/AttendanceNav";

export const Route = createFileRoute("/attendance")({
  component: AttendanceLayout,
});

function AttendanceLayout() {
  return (
    <AppLayout
      title="Attendance"
      subtitle="Review and manage attendance records"
      allowDirectorOfDiscipline
    >
      <AttendanceNav />
      <Outlet />
    </AppLayout>
  );
}
