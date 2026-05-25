import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser, getInitials, formatRole } from "@/hooks/useCurrentUser";

interface Props {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
}

export function AppHeader({ title, subtitle, onMenuClick }: Props) {
  const [profileOpen, setProfileOpen] = useState(false);
  const currentUser = useCurrentUser();
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
        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen(p => !p)}
            className="hidden sm:flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted"
          >
            <div className="text-right leading-tight">
              <div className="text-sm font-semibold">
                {currentUser?.name ?? "Loading…"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {currentUser?.role ? formatRole(currentUser.role) : ""}
              </div>
            </div>
            {currentUser?.avatar_url ? (
              <img
                src={currentUser.avatar_url}
                alt={currentUser.name}
                className="h-10 w-10 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
                {currentUser ? getInitials(currentUser.name) : "…"}
              </div>
            )}
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
              <button
                onClick={() => { toast.info("Open profile…"); setProfileOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-muted"
              >
                View Profile
              </button>
              <Link
                to="/settings"
                search={{ tab: "profile" }}
                onClick={() => setProfileOpen(false)}
                className="block w-full text-left px-4 py-2 text-sm hover:bg-muted"
              >
                Account Settings
              </Link>
              <button
                onClick={() => { toast.success("Signed out"); setProfileOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-muted"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
