import { createFileRoute } from "@tanstack/react-router";
import TabletManagement from "@/pages/school-admin/TabletManagement";

export const Route = createFileRoute("/tablets")({
  component: TabletManagement,
});
