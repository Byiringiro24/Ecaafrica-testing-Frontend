import { createFileRoute } from "@tanstack/react-router";
import { ManageSmsTypePage } from "./-super-admin.manage-sms.common";

export const Route = createFileRoute("/super-admin/manage-sms/school-entry")({
  component: () => <ManageSmsTypePage triggerType="school_entry" typeLabel="School Entry" />
});
