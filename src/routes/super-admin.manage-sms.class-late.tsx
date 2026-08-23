import { createFileRoute } from "@tanstack/react-router";
import { ManageSmsTypePage } from "./-super-admin.manage-sms.common";

export const Route = createFileRoute("/super-admin/manage-sms/class-late")({
  component: () => <ManageSmsTypePage triggerType="class_late" typeLabel="Class Late" />
});
