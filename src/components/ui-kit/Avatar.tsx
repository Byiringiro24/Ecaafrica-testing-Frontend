import { cn } from "@/lib/utils";

const COLORS = [
  "bg-indigo-500", "bg-indigo-500", "bg-rose-500", "bg-amber-500",
  "bg-sky-500", "bg-fuchsia-500", "bg-teal-500", "bg-orange-500",
];

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  const code = name.charCodeAt(0) % COLORS.length;
  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-16 w-16 text-lg",
  };
  return (
    <div className={cn(
      "grid place-items-center rounded-full font-semibold text-white shrink-0",
      COLORS[code], sizes[size]
    )}>
      {initials}
    </div>
  );
}
