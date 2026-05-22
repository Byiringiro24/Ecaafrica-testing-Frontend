import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  to?: string;
}

export function SuperAdminBreadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-4 flex-wrap" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />}
          {item.to ? (
            <Link to={item.to} className="hover:text-foreground font-medium transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-semibold">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
