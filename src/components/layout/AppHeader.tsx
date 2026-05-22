import { Bell, Menu, Search } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
}

export function AppHeader({ title, subtitle, onMenuClick }: Props) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="flex items-center gap-4 px-4 md:px-8 py-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden rounded-md p-2 hover:bg-muted"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl md:text-2xl font-bold text-foreground truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>

        <div className="hidden md:flex relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search students, classes..."
            className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <button className="relative grid h-10 w-10 place-items-center rounded-lg border border-border bg-card hover:bg-muted">
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive" />
        </button>

        <div className="hidden sm:flex items-center gap-3">
          <div className="text-right leading-tight">
            <div className="text-sm font-semibold">Mugisha Jean</div>
            <div className="text-[11px] text-muted-foreground">Super Admin</div>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
            MJ
          </div>
        </div>
      </div>
    </header>
  );
}
