import { createFileRoute } from "@tanstack/react-router";
import { BoardingAttendanceManager } from "@/components/boarding/BoardingAttendanceManager";

export const Route = createFileRoute("/attendance/boarding-manual")({
  component: BoardingManualAttendancePage,
});

function BoardingManualAttendancePage() {
  return <BoardingAttendanceManager canEdit={true} />;
}
