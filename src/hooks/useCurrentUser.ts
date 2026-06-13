import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getSchoolAuth } from "@/lib/schoolAuth";

export type CurrentUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  avatar_url: string | null;
  school_country?: string | null;
};

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0]?.slice(0, 2).toUpperCase() ?? "??";
}

export function formatRole(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function fromCache(): CurrentUser | null {
  const cached = getSchoolAuth()?.user;
  if (!cached?.name) return null;
  return {
    id: cached.id,
    name: cached.name,
    email: cached.email ?? null,
    phone: null,
    role: cached.role ?? "",
    status: "active",
    avatar_url: null,
    school_country: cached.school_country ?? null,
  };
}

export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(fromCache);

  useEffect(() => {
    apiRequest<CurrentUser>("/auth/me", { auth: "school" })
      .then(data => setUser(data))
      .catch(() => {
        const fallback = fromCache();
        if (fallback) setUser(fallback);
      });
  }, []);

  return user;
}
