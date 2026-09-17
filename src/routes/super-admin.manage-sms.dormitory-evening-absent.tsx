import { createFileRoute } from "@tanstack/react-router";
import { ManageSmsTypePage } from "./-super-admin.manage-sms.common";

export const Route = createFileRoute("/super-admin/manage-sms/dormitory-evening-absent")({
  component: () => <ManageSmsTypePage triggerType="dormitory_evening_absent" typeLabel="Dormitory Evening Absent" />
});
