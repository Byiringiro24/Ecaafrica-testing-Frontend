import { getPlatformToken, getPlatformAuth, setPlatformAuth, clearPlatformAuth } from "./platformAuth";
import { getSchoolToken, getSchoolAuth, setSchoolAuth, clearSchoolAuth } from "./schoolAuth";

const defaultApiBaseUrl = import.meta.env.DEV
  ? "http://localhost:5000/api/v1"
  : "https://backend.ecareafrica.net/api/v1";

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL?.trim() || defaultApiBaseUrl).replace(/\/$/, "");

type ApiError = {
  status: number;
  code?: string;
  message: string;
  details?: string[];
};

type ApiRequestOptions = RequestInit & {
  auth?: "platform" | "school" | "none";
  returnMeta?: boolean;
  _retry?: boolean;
};

// Deduplicate concurrent refresh calls — one shared promise per auth mode
let schoolRefreshPromise: Promise<string | null> | null = null;
let platformRefreshPromise: Promise<string | null> | null = null;

async function attemptTokenRefresh(authMode: "school" | "platform"): Promise<string | null> {
  const auth = authMode === "school" ? getSchoolAuth() : getPlatformAuth();
  if (!auth?.refreshToken) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: auth.refreshToken }),
    });
    const payload = await response.json();
    if (!response.ok || !payload?.data?.accessToken) return null;

    const updated = {
      accessToken: payload.data.accessToken as string,
      refreshToken: (payload.data.refreshToken as string | null | undefined) ?? auth.refreshToken,
      user: auth.user,
    };

    if (authMode === "school") setSchoolAuth(updated);
    else setPlatformAuth(updated);

    return updated.accessToken;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { auth, returnMeta, _retry, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);
  const authMode = auth ?? "platform";

  if (authMode === "platform") {
    const token = getPlatformToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  if (authMode === "school") {
    const token = getSchoolToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, { ...fetchOptions, headers });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  // On 401 (expired token), attempt a single token refresh then retry
  if (response.status === 401 && !_retry && (authMode === "school" || authMode === "platform")) {
    if (authMode === "school") {
      schoolRefreshPromise ??= attemptTokenRefresh("school").finally(() => {
        schoolRefreshPromise = null;
      });
    } else {
      platformRefreshPromise ??= attemptTokenRefresh("platform").finally(() => {
        platformRefreshPromise = null;
      });
    }

    const newToken = await (authMode === "school" ? schoolRefreshPromise : platformRefreshPromise);

    if (newToken) {
      return apiRequest<T>(path, { ...options, _retry: true });
    }

    // Refresh failed — clear stored auth and send user to login
    if (authMode === "school") {
      clearSchoolAuth();
      if (typeof window !== "undefined") window.location.href = "/login";
    } else {
      clearPlatformAuth();
      if (typeof window !== "undefined") window.location.href = "/login?mode=platform";
    }
    throw { status: 401, message: "Session expired. Please log in again." } as ApiError;
  }

  if (!response.ok || payload?.success === false) {
    const err: ApiError = {
      status: response.status,
      code: payload?.error?.code,
      message: payload?.error?.message ?? response.statusText,
      details: payload?.error?.details ?? []
    };
    throw err;
  }

  if (returnMeta) {
    return payload as T;
  }

  return (payload?.data ?? payload) as T;
}
