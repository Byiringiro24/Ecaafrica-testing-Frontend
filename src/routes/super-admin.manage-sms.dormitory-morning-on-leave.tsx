import { createFileRoute } from "@tanstack/react-router";
import { ManageSmsTypePage } from "./-super-admin.manage-sms.common";

export const Route = createFileRoute("/super-admin/manage-sms/dormitory-morning-on-leave")({
  component: () => <ManageSmsTypePage triggerType="dormitory_morning_on_leave" typeLabel="Dormitory Morning On Leave" />
});
