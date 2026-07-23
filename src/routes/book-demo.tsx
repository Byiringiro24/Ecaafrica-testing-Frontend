import { createFileRoute } from "@tanstack/react-router";
import BookDemo from "@/pages/BookDemo";

export const Route = createFileRoute("/book-demo")({
  component: BookDemo,
});
