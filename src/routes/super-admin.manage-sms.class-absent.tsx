import { createFileRoute } from "@tanstack/react-router";
import { ManageSmsTypePage } from "./-super-admin.manage-sms.common";

export const Route = createFileRoute("/super-admin/manage-sms/class-absent")({
  component: () => <ManageSmsTypePage triggerType="class_absent" typeLabel="Class Absent" />
});
