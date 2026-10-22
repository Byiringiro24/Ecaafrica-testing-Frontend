import { cn } from "@/lib/utils";

const COLORS = [
  "bg-indigo-500", "bg-indigo-500", "bg-rose-500", "bg-amber-500",
  "bg-sky-500", "bg-fuchsia-500", "bg-teal-500", "bg-orange-500",
];

export function Avatar({
  name,
  size = "md",
  src,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  src?: string | null;
}) {
  const safe = name ?? "";
  const initials = safe.split(" ").filter(Boolean).map(n => n[0]).slice(0, 2).join("").toUpperCase() || "?";
  const code = (safe.charCodeAt(0) || 0) % COLORS.length;
  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-16 w-16 text-lg",
  };

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn("rounded-full object-cover shrink-0", sizes[size])}
        onError={(e) => {
          // fallback to initials on broken image
          (e.currentTarget as HTMLImageElement).style.display = "none";
          (e.currentTarget.nextSibling as HTMLElement | null)?.removeAttribute("hidden");
        }}
      />
    );
  }

  return (
    <div className={cn(
      "grid place-items-center rounded-full font-semibold text-white shrink-0",
      COLORS[code], sizes[size]
    )}>
      {initials}
    </div>
  );
}
