import { createFileRoute } from "@tanstack/react-router";
import { ManageSmsTypePage } from "./-super-admin.manage-sms.common";

export const Route = createFileRoute("/super-admin/manage-sms/dormitory-morning-absent")({
  component: () => <ManageSmsTypePage triggerType="dormitory_morning_absent" typeLabel="Dormitory Morning Absent" />
});
