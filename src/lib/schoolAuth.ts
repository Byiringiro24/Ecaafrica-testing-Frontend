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

export const isSchoolAdminRole = (role?: string | null) => {
  if (!role) return false;
  const normalized = role.trim().toLowerCase();
  return normalized === "school_admin" || normalized === "school admin";
};

export const isTeacherRole = (role?: string | null) => {
  if (!role) return false;
  return role.trim().toLowerCase() === "teacher";
};

export const isGateKeeperRole = (role?: string | null) => {
  if (!role) return false;
  return role.trim().toLowerCase() === "gate_keeper";
};

export const isDodRole = (role?: string | null) => {
  if (!role) return false;
  return role.trim().toLowerCase() === "director_of_discipline";
};

export const isFinanceOfficerRole = (role?: string | null) => {
  if (!role) return false;
  return role.trim().toLowerCase() === "finance_officer";
};

export const roleHome = (role?: string | null) => {
  switch (role?.trim().toLowerCase()) {
    case "finance_officer": return "/finance";
    case "teacher": return "/teacher/dashboard";
    case "gate_keeper": return "/gate-keeper/dashboard";
    case "director_of_discipline": return "/dod/dashboard";
    default: return "/login";
  }
};

export const schoolAdminRouteGuard = (location: { pathname: string; search?: unknown }) => {
  const auth = getSchoolAuth();
  if (auth?.accessToken && isSchoolAdminRole(auth.user?.role)) return;
  const rawSearch = location.search;
  const search = typeof rawSearch === "string" ? rawSearch : new URLSearchParams((rawSearch as Record<string, string>) ?? {}).toString();
  const suffix = search ? (search.startsWith("?") ? search : `?${search}`) : "";
  throw redirect({ to: "/login", search: { redirect: `${location.pathname}${suffix}` } });
};

export const teacherRouteGuard = (location: { pathname: string; search?: unknown }) => {
  const auth = getSchoolAuth();
  if (auth?.accessToken && isTeacherRole(auth.user?.role)) {
    return;
  }

  const rawSearch = location.search;
  const search = typeof rawSearch === "string"
    ? rawSearch
    : new URLSearchParams((rawSearch as Record<string, string>) ?? {}).toString();
  const searchSuffix = search
    ? search.startsWith("?")
      ? search
      : `?${search}`
    : "";
  const redirectTo = `${location.pathname}${searchSuffix}`;
  throw redirect({ to: "/login", search: { redirect: redirectTo } });
};

export const gateKeeperRouteGuard = (location: { pathname: string; search?: unknown }) => {
  const auth = getSchoolAuth();
  if (auth?.accessToken && isGateKeeperRole(auth.user?.role)) {
    return;
  }

  const rawSearch = location.search;
  const search = typeof rawSearch === "string"
    ? rawSearch
    : new URLSearchParams((rawSearch as Record<string, string>) ?? {}).toString();
  const searchSuffix = search
    ? search.startsWith("?")
      ? search
      : `?${search}`
    : "";
  const redirectTo = `${location.pathname}${searchSuffix}`;
  throw redirect({ to: "/login", search: { redirect: redirectTo } });
};

export const financeOfficerRouteGuard = (location: { pathname: string; search?: unknown }) => {
  const auth = getSchoolAuth();
  if (auth?.accessToken && isFinanceOfficerRole(auth.user?.role)) {
    return;
  }

  const rawSearch = location.search;
  const search = typeof rawSearch === "string"
    ? rawSearch
    : new URLSearchParams((rawSearch as Record<string, string>) ?? {}).toString();
  const searchSuffix = search
    ? search.startsWith("?")
      ? search
      : `?${search}`
    : "";
  const redirectTo = `${location.pathname}${searchSuffix}`;
  throw redirect({ to: "/login", search: { redirect: redirectTo } });
};

export const dodRouteGuard = (location: { pathname: string; search?: unknown }) => {
  const auth = getSchoolAuth();
  if (auth?.accessToken && isDodRole(auth.user?.role)) {
    return;
  }

  const rawSearch = location.search;
  const search = typeof rawSearch === "string"
    ? rawSearch
    : new URLSearchParams((rawSearch as Record<string, string>) ?? {}).toString();
  const searchSuffix = search
    ? search.startsWith("?")
      ? search
      : `?${search}`
    : "";
  const redirectTo = `${location.pathname}${searchSuffix}`;
  throw redirect({ to: "/login", search: { redirect: redirectTo } });
};
