import { createFileRoute } from "@tanstack/react-router";
import { ManageSmsTypePage } from "./-super-admin.manage-sms.common";

export const Route = createFileRoute("/super-admin/manage-sms/dormitory-evening-present")({
  component: () => <ManageSmsTypePage triggerType="dormitory_evening_present" typeLabel="Dormitory Evening Present" />
});
