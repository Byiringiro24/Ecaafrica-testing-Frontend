export type PlatformUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

export type PlatformAuthState = {
  accessToken: string;
  refreshToken?: string | null;
  user?: PlatformUser | null;
};

const STORAGE_KEY = "eca_platform_auth";

const isBrowser = () => typeof window !== "undefined";

export const getPlatformAuth = (): PlatformAuthState | null => {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PlatformAuthState;
    if (!parsed?.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const setPlatformAuth = (state: PlatformAuthState) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const clearPlatformAuth = () => {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
};

export const getPlatformToken = () => getPlatformAuth()?.accessToken ?? null;
