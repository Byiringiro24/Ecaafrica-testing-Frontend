import { createFileRoute } from "@tanstack/react-router";
import { ManageSmsTypePage } from "./-super-admin.manage-sms.common";

export const Route = createFileRoute("/super-admin/manage-sms/class-excused")({
  component: () => <ManageSmsTypePage triggerType="class_excused" typeLabel="Class Excused" />
});
