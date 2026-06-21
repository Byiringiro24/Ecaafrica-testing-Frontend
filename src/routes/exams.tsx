import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { ExamsNav } from "@/components/exams/ExamsNav";

export const Route = createFileRoute("/exams")({
  component: ExamsLayout,
});

function ExamsLayout() {
  return (
    <AppLayout
      title="Exams & Results"
      subtitle="Review teacher submissions and publish grades to parents"
    >
      <ExamsNav />
      <Outlet />
    </AppLayout>
  );
}
