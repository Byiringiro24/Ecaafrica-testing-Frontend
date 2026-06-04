import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: string;
  tone?: "primary" | "success" | "destructive" | "warning";
  accent?: "blue";
  /** Denser layout for dashboard grids with many KPIs */
  compact?: boolean;
}

const TONES = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/15 text-success",
  destructive: "bg-destructive/15 text-destructive",
  warning: "bg-amber-100 text-amber-700",
};

const ACCENTS = {
  blue: "border-blue-200/70 bg-blue-50/60",
};

export function StatCard({ label, value, icon, trend, tone = "primary", accent, compact }: Props) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card shadow-sm min-w-0",
        compact ? "p-3 sm:p-4" : "p-5",
        accent ? ACCENTS[accent] : null
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={cn(
            "font-medium text-muted-foreground truncate",
            compact ? "text-[10px] uppercase tracking-wide" : "text-xs uppercase tracking-wider",
          )}>
            {label}
          </p>
          <p className={cn(
            "font-display font-bold mt-1 truncate",
            compact ? "text-lg sm:text-xl" : "text-3xl mt-2",
          )}>
            {value}
          </p>
          {trend && (
            <p className={cn(
              "font-semibold mt-1 inline-flex max-w-full truncate rounded-full px-1.5 py-0.5",
              compact ? "text-[10px]" : "text-xs mt-1.5 px-2",
              TONES[tone],
            )}>
              {trend}
            </p>
          )}
        </div>
        {icon && (
          <div className={cn("grid shrink-0 place-items-center rounded-lg", compact ? "h-8 w-8" : "h-11 w-11", TONES[tone])}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
