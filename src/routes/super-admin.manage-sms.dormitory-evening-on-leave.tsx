import { createFileRoute } from "@tanstack/react-router";
import { ManageSmsTypePage } from "./-super-admin.manage-sms.common";

export const Route = createFileRoute("/super-admin/manage-sms/dormitory-evening-on-leave")({
  component: () => <ManageSmsTypePage triggerType="dormitory_evening_on_leave" typeLabel="Dormitory Evening On Leave" />
});
