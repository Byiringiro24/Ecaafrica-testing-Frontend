import { createFileRoute } from "@tanstack/react-router";
import DeviceManagement from "@/pages/school-admin/DeviceManagement";

export const Route = createFileRoute("/devices")({
  component: DeviceManagement,
});
