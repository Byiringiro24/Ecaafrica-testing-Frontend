import { createFileRoute } from "@tanstack/react-router";
import { ManageSmsTypePage } from "./-super-admin.manage-sms.common";

export const Route = createFileRoute("/super-admin/manage-sms/class-entry")({
  component: () => <ManageSmsTypePage triggerType="class_entry" typeLabel="Class Entry" />
});
