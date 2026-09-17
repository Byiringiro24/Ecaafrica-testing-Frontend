import { createFileRoute, Outlet } from "@tanstack/react-router";
import { GateKeeperLayout } from "@/components/layout/GateKeeperLayout";
import { GateKeeperAttendanceNav } from "@/components/gate-keeper/GateKeeperAttendanceNav";
import { gateKeeperRouteGuard } from "@/lib/schoolAuth";

export const Route = createFileRoute("/gate-keeper/attendance")({
  beforeLoad: ({ location }) => gateKeeperRouteGuard(location),
  component: GateKeeperAttendanceLayout,
});

function GateKeeperAttendanceLayout() {
  return (
    <GateKeeperLayout
      title="Gate Attendance"
      subtitle="View attendance recorded by devices"
    >
      <GateKeeperAttendanceNav />
      <Outlet />
    </GateKeeperLayout>
  );
}
