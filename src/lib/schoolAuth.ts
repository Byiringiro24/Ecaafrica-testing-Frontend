export type SchoolUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  school_country?: string | null;
};

import { redirect } from "@tanstack/react-router";

export type SchoolAuthState = {
  accessToken: string;
  refreshToken?: string | null;
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

// ─── Role checks ─────────────────────────────────────────────────────────────

export const isSchoolAdminRole = (role?: string | null) => {
  if (!role) return false;
  const r = role.trim().toLowerCase();
  return r === "school_admin" || r === "school admin";
};

export const isTeacherRole = (role?: string | null) => {
  if (!role) return false;
  return role.trim().toLowerCase() === "teacher";
};

export const isGateKeeperRole = (role?: string | null) => {
  if (!role) return false;
  return role.trim().toLowerCase() === "gate_keeper";
};

export const isDirectorOfDisciplineRole = (role?: string | null) => {
  if (!role) return false;
  return role.trim().toLowerCase() === "director_of_discipline";
};

/** Alias kept for any existing callers */
export const isDodRole = isDirectorOfDisciplineRole;

export const isDirectorOfStudiesRole = (role?: string | null) => {
  if (!role) return false;
  return role.trim().toLowerCase() === "director_of_studies";
};

export const isPatronRole = (role?: string | null) => {
  if (!role) return false;
  return ["patron", "matron"].includes(role.trim().toLowerCase());
};

export const isFinanceOfficerRole = (role?: string | null) => {
  if (!role) return false;
  return role.trim().toLowerCase() === "finance_officer";
};

export const isStaffRole = (role?: string | null) => {
  if (!role) return false;
  return role.trim().toLowerCase() === "staff";
};

/** Boarding operations: DOD, patron, matron, school_admin.
 *  boarding_officer is removed — DOD is the primary authority. */
export const isBoardingRole = (role?: string | null) => {
  if (!role) return false;
  const r = role.trim().toLowerCase();
  return ["director_of_discipline", "patron", "matron", "school_admin"].includes(r);
};

// ─── Role → home route ───────────────────────────────────────────────────────

export const roleHome = (role?: string | null): string => {
  switch (role?.trim().toLowerCase()) {
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

export const schoolAdminRouteGuard = (location: { pathname: string; search?: unknown }) => {
  const auth = getSchoolAuth();
  if (auth?.accessToken && isSchoolAdminRole(auth.user?.role)) return;
  throw redirect({ to: "/login", search: { redirect: makeRedirect(location) } });
};

export const teacherRouteGuard = (location: { pathname: string; search?: unknown }) => {
  const auth = getSchoolAuth();
  if (auth?.accessToken && isTeacherRole(auth.user?.role)) return;
  throw redirect({ to: "/login", search: { redirect: makeRedirect(location) } });
};

export const gateKeeperRouteGuard = (location: { pathname: string; search?: unknown }) => {
  const auth = getSchoolAuth();
  if (auth?.accessToken && isGateKeeperRole(auth.user?.role)) return;
  throw redirect({ to: "/login", search: { redirect: makeRedirect(location) } });
};

export const financeOfficerRouteGuard = (location: { pathname: string; search?: unknown }) => {
  const auth = getSchoolAuth();
  if (auth?.accessToken && isFinanceOfficerRole(auth.user?.role)) return;
  throw redirect({ to: "/login", search: { redirect: makeRedirect(location) } });
};

export const dodRouteGuard = (location: { pathname: string; search?: unknown }) => {
  const auth = getSchoolAuth();
  if (auth?.accessToken && isDirectorOfDisciplineRole(auth.user?.role)) return;
  throw redirect({ to: "/login", search: { redirect: makeRedirect(location) } });
};

/** Alias — both names used across dod.*.tsx files */
export const directorOfDisciplineRouteGuard = dodRouteGuard;

export const directorOfStudiesRouteGuard = (location: { pathname: string; search?: unknown }) => {
  const auth = getSchoolAuth();
  if (auth?.accessToken && isDirectorOfStudiesRole(auth.user?.role)) return;
  throw redirect({ to: "/login", search: { redirect: makeRedirect(location) } });
};

export const patronRouteGuard = (location: { pathname: string; search?: unknown }) => {
  const auth = getSchoolAuth();
  if (auth?.accessToken && isPatronRole(auth.user?.role)) return;
  throw redirect({ to: "/login", search: { redirect: makeRedirect(location) } });
};

export const staffRouteGuard = (location: { pathname: string; search?: unknown }) => {
  const auth = getSchoolAuth();
  if (auth?.accessToken && isStaffRole(auth.user?.role)) return;
  throw redirect({ to: "/login", search: { redirect: makeRedirect(location) } });
};

/** Boarding layout guard — DOD and school_admin.
 *  Patron/matron use patronRouteGuard on their own /patron/* routes. */
export const boardingRouteGuard = (location: { pathname: string; search?: unknown }) => {
  const auth = getSchoolAuth();
  if (
    auth?.accessToken &&
    (isDirectorOfDisciplineRole(auth.user?.role) || isSchoolAdminRole(auth.user?.role))
  ) return;
  throw redirect({ to: "/login", search: { redirect: makeRedirect(location) } });
};
