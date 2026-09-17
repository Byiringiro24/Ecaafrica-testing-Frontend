import { createFileRoute } from "@tanstack/react-router";
import { ManageSmsTypePage } from "./-super-admin.manage-sms.common";

export const Route = createFileRoute("/super-admin/manage-sms/device-late")({
  component: () => <ManageSmsTypePage triggerType="device_late" typeLabel="Attendance Device Late" />
});
