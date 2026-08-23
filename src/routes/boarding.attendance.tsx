import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { BoardingAttendanceManager } from "@/components/boarding/BoardingAttendanceManager";

export const Route = createFileRoute("/boarding/attendance")({ component: () => <AppLayout title="Dormitory Attendance" subtitle="Review boarding students by dormitory and roll-call session"><BoardingAttendanceManager /></AppLayout> });
