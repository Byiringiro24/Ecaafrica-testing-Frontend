import { createFileRoute } from "@tanstack/react-router";
import SchoolSupportTickets from "@/pages/SchoolSupportTickets";
import { gateKeeperRouteGuard } from "@/lib/schoolAuth";

export const Route = createFileRoute("/gate-keeper/support")({ beforeLoad: ({ location }) => gateKeeperRouteGuard(location), component: () => <SchoolSupportTickets gateKeeper /> });
