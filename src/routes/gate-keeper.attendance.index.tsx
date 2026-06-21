import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/gate-keeper/attendance/")({
  component: () => <Navigate to="/gate-keeper/attendance/device-attendance" />,
});
