export type SchoolUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

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
