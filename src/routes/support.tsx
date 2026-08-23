import { createFileRoute } from "@tanstack/react-router";
import SchoolSupportTickets from "@/pages/SchoolSupportTickets";
import { schoolAdminRouteGuard } from "@/lib/schoolAuth";

export const Route = createFileRoute("/support")({ beforeLoad: ({ location }) => schoolAdminRouteGuard(location), component: SchoolSupportTickets });
