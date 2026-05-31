import { cn } from "@/lib/utils";

type Status = "Present" | "Absent" | "Late" | "Excused";

const MAP: Record<Status, string> = {
  Present: "bg-success/15 text-success",
  Absent: "bg-destructive/15 text-destructive",
  Late: "bg-warning/15 text-warning-foreground",
  Excused: "bg-blue-100 text-blue-700",
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
