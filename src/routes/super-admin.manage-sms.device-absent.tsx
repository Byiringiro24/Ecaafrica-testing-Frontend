import { createFileRoute } from "@tanstack/react-router";
import { ManageSmsTypePage } from "./-super-admin.manage-sms.common";

export const Route = createFileRoute("/super-admin/manage-sms/device-absent")({
  component: () => <ManageSmsTypePage triggerType="device_absent" typeLabel="Attendance Device Absent" />
});
