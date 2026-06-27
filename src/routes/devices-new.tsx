import { createFileRoute } from "@tanstack/react-router";
import DeviceManagementNew from "@/pages/school-admin/DeviceManagementNew";

export const Route = createFileRoute("/devices-new")({
  component: DeviceManagementNew,
});
