"use client";
/**
 * RoleSwitcher — shown in the sidebar/nav when the logged-in user holds
 * more than one role (e.g. Teacher + DOS, Patron + Teacher, etc.)
 *
 * Clicking a different role updates activeRole in localStorage and
 * navigates the user to that role's home dashboard.
 */
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, Check, RefreshCw } from "lucide-react";
import {
  getAvailableRoles,
  getActiveRole,
  switchRole,
  roleHome,
} from "@/lib/schoolAuth";

const ROLE_LABELS: Record<string, string> = {
  school_admin:            "School Admin",
  director_of_discipline:  "Director of Discipline",
  director_of_studies:     "Director of Studies",
  teacher:                 "Teacher",
  patron:                  "Patron",
  matron:                  "Matron",
  gate_keeper:             "Gate Keeper",
  finance_officer:         "Finance Officer",
  staff:                   "Staff",
};

const ROLE_COLORS: Record<string, string> = {
  school_admin:            "bg-blue-100 text-blue-700",
  director_of_discipline:  "bg-orange-100 text-orange-700",
  director_of_studies:     "bg-purple-100 text-purple-700",
  teacher:                 "bg-emerald-100 text-emerald-700",
  patron:                  "bg-rose-100 text-rose-700",
  matron:                  "bg-pink-100 text-pink-700",
  gate_keeper:             "bg-slate-100 text-slate-700",
  finance_officer:         "bg-amber-100 text-amber-700",
  staff:                   "bg-gray-100 text-gray-700",
};

function roleLabel(slug: string) {
  return ROLE_LABELS[slug] ?? slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function roleColor(slug: string) {
  return ROLE_COLORS[slug] ?? "bg-muted text-muted-foreground";
}

export function RoleSwitcher() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const available = getAvailableRoles();
  const active    = getActiveRole();

  // Only render if the user has more than one role
  if (available.length <= 1) return null;

  const handleSwitch = (role: string) => {
    if (role === active) { setOpen(false); return; }
    switchRole(role);
    setOpen(false);
    // Navigate to the home page for the new role
    void navigate({ to: roleHome(role) });
    // Reload the page to ensure all route guards re-evaluate with the new role
    setTimeout(() => window.location.reload(), 50);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm hover:bg-muted transition w-full"
      >
        <RefreshCw className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${roleColor(active ?? "")}`}>
          {roleLabel(active ?? "")}
        </span>
        <ChevronDown className={`ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card shadow-lg py-1">
          <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Switch Role
          </p>
          {available.map((role) => (
            <button
              key={role}
              onClick={() => handleSwitch(role)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition text-left"
            >
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${roleColor(role)}`}>
                {roleLabel(role)}
              </span>
              {role === active && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
