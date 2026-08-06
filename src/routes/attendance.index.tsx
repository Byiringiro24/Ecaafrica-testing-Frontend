import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/attendance/")({
  component: () => <Navigate to="/attendance/manual" replace />,
});
