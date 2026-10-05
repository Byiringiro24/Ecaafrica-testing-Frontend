import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getActiveRole, getSchoolAuth } from "@/lib/schoolAuth";

export type CurrentUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  avatar_url: string | null;
  school_country?: string | null;
  school_currency?: string | null;
  school_name?: string | null;
  school_province?: string | null;
  school_district?: string | null;
  school_sector?: string | null;
  school_logo_url?: string | null;
  school_website?: string | null;
  school_principal_name?: string | null;
  school_principal_phone?: string | null;
  school_principal_email?: string | null;
  school_phone?: string | null;
  school_email?: string | null;
  roles?: { id?: string; name?: string; slug: string }[];
  school_status?: string | null;
};

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0]?.slice(0, 2).toUpperCase() ?? "??";
}

export function formatRole(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fromCache(): CurrentUser | null {
  const cached = getSchoolAuth()?.user;
  if (!cached?.name) return null;
  return {
    id: cached.id,
    name: cached.name,
    email: cached.email ?? null,
    phone: null,
    role: getActiveRole() ?? cached.role ?? "",
    status: "active",
    avatar_url: null,
    school_country: cached.school_country ?? null,
    roles: cached.roles,
  };
}

export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(fromCache);

  useEffect(() => {
    apiRequest<CurrentUser>("/auth/me", { auth: "school" })
      .then((data) => setUser({ ...data, role: getActiveRole() ?? data.role }))
      .catch(() => {
        const fallback = fromCache();
        if (fallback) setUser(fallback);
      });
  }, []);

  return user;
}
