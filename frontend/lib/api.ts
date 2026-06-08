const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
}

export class ApiError extends Error {
  status: number;
  info: unknown;

  constructor(message: string, status: number, info?: unknown) {
    super(message);
    this.status = status;
    this.info = info;
  }
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  
  if (options.params) {
    Object.entries(options.params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        url.searchParams.append(key, String(val));
      }
    });
  }

  const headers = new Headers(options.headers);
  
  // Retrieve token from local storage
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("admin_token");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url.toString(), {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errInfo: { detail?: string } | null = null;
    try {
      errInfo = await response.json();
    } catch {
      // ignore
    }
    
    if (response.status === 401 && typeof window !== "undefined") {
      // Clear token and redirect to login if unauthorized
      localStorage.removeItem("admin_token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    throw new ApiError(
      errInfo?.detail || `Máy chủ xử lý yêu cầu thất bại (HTTP ${response.status}).`,
      response.status,
      errInfo
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  try {
    return await response.json() as T;
  } catch {
    throw new ApiError("Máy chủ trả về dữ liệu không hợp lệ.", response.status);
  }
}

export const api = {
  get: <T = unknown>(path: string, params?: Record<string, string | number | undefined>, options?: RequestInit) =>
    request<T>(path, { method: "GET", params, ...options }),
  post: <T = unknown>(path: string, body?: unknown, options?: RequestInit) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined, ...options }),
  patch: <T = unknown>(path: string, body?: unknown, options?: RequestInit) =>
    request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined, ...options }),
  delete: <T = unknown>(path: string, options?: RequestInit) =>
    request<T>(path, { method: "DELETE", ...options }),
};
