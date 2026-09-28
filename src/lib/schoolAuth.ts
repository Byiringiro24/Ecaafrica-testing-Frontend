import { redirect } from "@tanstack/react-router";

export type SchoolUserRole = {
  id: string;
  name: string;
  slug: string;
  permissions?: unknown;
  is_system?: boolean;
};

export type SchoolUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  /** Primary role — the role the user is currently acting as */
  role?: string | null;
  /** All additional roles assigned via user_roles (patron+teacher, DOS+teacher, etc.) */
  roles?: SchoolUserRole[];
  school_country?: string | null;
  school_name?: string | null;
  school_logo_url?: string | null;
  avatar_url?: string | null;
};

export type SchoolAuthState = {
  accessToken: string;
  refreshToken?: string | null;
  /** The role the user has chosen to act as for this session (for role-switching) */
  activeRole?: string | null;
  user?: SchoolUser | null;
};

const STORAGE_KEY = "eca_school_auth";

const isBrowser = () => typeof window !== "undefined";

export const getSchoolAuth = (): SchoolAuthState | null => {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SchoolAuthState;
    if (!parsed?.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const setSchoolAuth = (state: SchoolAuthState) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const clearSchoolAuth = () => {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
};

export const getSchoolToken = () => getSchoolAuth()?.accessToken ?? null;

// ─── Active role resolution ───────────────────────────────────────────────────
// If the user has switched to a secondary role (role-switching UI),
// activeRole overrides auth.user.role for routing decisions.
// The backend JWT still has the primary role — secondary_roles in JWT handles API access.

export const getActiveRole = (): string | null => {
  const auth = getSchoolAuth();
  return auth?.activeRole ?? auth?.user?.role ?? null;
};

/** Switch the active role the user is currently navigating as. */
export const switchRole = (newRole: string) => {
  const auth = getSchoolAuth();
  if (!auth) return;
  setSchoolAuth({ ...auth, activeRole: newRole });
};

/** All roles available to this user (primary + secondary). */
export const getAvailableRoles = (): string[] => {
  const auth = getSchoolAuth();
  if (!auth?.user) return [];
  const primary = auth.user.role ?? null;
  const secondary = (auth.user.roles ?? []).map((r) => r.slug).filter(Boolean);
  const all = primary ? [primary, ...secondary.filter((r) => r !== primary)] : secondary;
  return all;
};

// ─── Role checks (check primary AND secondary roles) ─────────────────────────

/** Get all effective roles for the authenticated user */
const getEffectiveRoles = (): string[] => {
  const auth = getSchoolAuth();
  if (!auth?.user) return [];
  const primary = auth.user.role;
  const secondary = (auth.user.roles ?? []).map((r) => r.slug).filter(Boolean);
  return primary ? [primary, ...secondary] : secondary;
};

const hasAnyRole = (...roles: string[]): boolean => {
  const effective = getEffectiveRoles();
  return roles.some((r) => effective.includes(r));
};

export const isSchoolAdminRole = (role?: string | null) => {
  if (role) {
    const r = role.trim().toLowerCase();
    return r === "school_admin" || r === "school admin";
  }
  return hasAnyRole("school_admin");
};

export const isTeacherRole = (role?: string | null) => {
  if (role) return role.trim().toLowerCase() === "teacher";
  return hasAnyRole("teacher");
};

export const isGateKeeperRole = (role?: string | null) => {
  if (role) return role.trim().toLowerCase() === "gate_keeper";
  return hasAnyRole("gate_keeper");
};

export const isDirectorOfDisciplineRole = (role?: string | null) => {
  if (role) return role.trim().toLowerCase() === "director_of_discipline";
  return hasAnyRole("director_of_discipline");
};

/** Alias kept for any existing callers */
export const isDodRole = isDirectorOfDisciplineRole;

export const isDirectorOfStudiesRole = (role?: string | null) => {
  if (role) return role.trim().toLowerCase() === "director_of_studies";
  return hasAnyRole("director_of_studies");
};

export const isPatronRole = (role?: string | null) => {
  if (role) return ["patron", "matron"].includes(role.trim().toLowerCase());
  return hasAnyRole("patron", "matron");
};

export const isFinanceOfficerRole = (role?: string | null) => {
  if (role) return role.trim().toLowerCase() === "finance_officer";
  return hasAnyRole("finance_officer");
};

export const isStaffRole = (role?: string | null) => {
  if (role) return role.trim().toLowerCase() === "staff";
  return hasAnyRole("staff");
};

/** Boarding operations: DOD, patron, matron, school_admin. */
export const isBoardingRole = (role?: string | null) => {
  if (role) {
    const r = role.trim().toLowerCase();
    return ["director_of_discipline", "patron", "matron", "school_admin"].includes(r);
  }
  return hasAnyRole("director_of_discipline", "patron", "matron", "school_admin");
};

// ─── Role → home route ───────────────────────────────────────────────────────

export const roleHome = (role?: string | null): string => {
  const r = (role ?? getActiveRole() ?? "").trim().toLowerCase();
  switch (r) {
    case "school_admin":           return "/dashboard";
    case "director_of_discipline": return "/dod/dashboard";
    case "director_of_studies":    return "/dos/dashboard";
    case "patron":
    case "matron":                 return "/patron/dashboard";
    case "gate_keeper":            return "/gate-keeper/dashboard";
    case "teacher":                return "/teacher/dashboard";
    case "finance_officer":        return "/finance";
    case "staff":                  return "/staff/dashboard";
    default:                       return "/dashboard";
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeRedirect = (location: { pathname: string; search?: unknown }) => {
  const rawSearch = location.search;
  const search =
    typeof rawSearch === "string"
      ? rawSearch
      : new URLSearchParams((rawSearch as Record<string, string>) ?? {}).toString();
  const suffix = search ? (search.startsWith("?") ? search : `?${search}`) : "";
  return `${location.pathname}${suffix}`;
};

// ─── Route guards ─────────────────────────────────────────────────────────────
// Each guard checks BOTH the primary role AND secondary roles so that e.g.
// a Teacher who also has DOS role can access /dos/* pages.

const makeGuard =
  (checkFn: () => boolean) =>
  (location: { pathname: string; search?: unknown }) => {
    const auth = getSchoolAuth();
    if (auth?.accessToken && checkFn()) return;
    throw redirect({ to: "/login", search: { redirect: makeRedirect(location) } });
  };

export const schoolAdminRouteGuard = makeGuard(() => isSchoolAdminRole());

export const teacherRouteGuard = makeGuard(() => isTeacherRole());

export const gateKeeperRouteGuard = makeGuard(() => isGateKeeperRole());

export const financeOfficerRouteGuard = makeGuard(() => isFinanceOfficerRole());

export const dodRouteGuard = makeGuard(() => isDirectorOfDisciplineRole());

/** Alias — both names used across dod.*.tsx files */
export const directorOfDisciplineRouteGuard = dodRouteGuard;

export const directorOfStudiesRouteGuard = makeGuard(() => isDirectorOfStudiesRole());

export const patronRouteGuard = makeGuard(() => isPatronRole());

export const staffRouteGuard = makeGuard(() => isStaffRole());

/** Boarding layout guard — DOD, school_admin, patron, matron. */
export const boardingRouteGuard = makeGuard(() => isBoardingRole());
