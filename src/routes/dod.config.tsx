/** DOD redirect to attendance config */
import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/dod/config")({
  beforeLoad: () => { throw redirect({ to: "/dod/attendance" }); },
  component: () => null,
});
