import { createFileRoute } from "@tanstack/react-router";
import { ManageSmsTypePage } from "./-super-admin.manage-sms.common";

export const Route = createFileRoute("/super-admin/manage-sms/dormitory-morning-present")({
  component: () => <ManageSmsTypePage triggerType="dormitory_morning_present" typeLabel="Dormitory Morning Present" />
});
