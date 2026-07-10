import { createFileRoute } from "@tanstack/react-router";
import { ManageSmsTypePage } from "./-super-admin.manage-sms.common";

export const Route = createFileRoute("/super-admin/manage-sms/school-exit")({
  component: () => <ManageSmsTypePage triggerType="school_exit" typeLabel="School Exit" />
});
