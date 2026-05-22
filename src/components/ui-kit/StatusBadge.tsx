import { cn } from "@/lib/utils";
import type { Status } from "@/lib/mockData";

const MAP: Record<Status, string> = {
  Present: "bg-success/15 text-success",
  Absent: "bg-destructive/15 text-destructive",
  Late: "bg-warning/15 text-warning-foreground",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
      MAP[status],
      status === "Late" && "bg-amber-100 text-amber-700"
    )}>
      {status}
    </span>
  );
}
