import { getPlatformToken } from "./platformAuth";

export const API_BASE_URL = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:5000/api/v1"
).replace(/\/+$/, "");

type ApiError = {
  status: number;
  code?: string;
  message: string;
  details?: string[];
};

type ApiRequestOptions = RequestInit & {
  auth?: "platform" | "none";
  returnMeta?: boolean;
};

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { auth, returnMeta, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);
  const authMode = auth ?? "platform";

  if (authMode === "platform") {
    const token = getPlatformToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  if (!headers.has("Content-Type") && options.body) {
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
