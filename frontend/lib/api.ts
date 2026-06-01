const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
}

export class ApiError extends Error {
  status: number;
  info: any;

  constructor(message: string, status: number, info?: any) {
    super(message);
    this.status = status;
    this.info = info;
  }
}

async function request(path: string, options: RequestOptions = {}) {
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
    let errInfo = null;
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
      errInfo?.detail || "An error occurred while fetching the data.",
      response.status,
      errInfo
    );
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

export const api = {
  get: (path: string, params?: Record<string, any>, options?: RequestInit) =>
    request(path, { method: "GET", params, ...options }),
  post: (path: string, body?: any, options?: RequestInit) =>
    request(path, { method: "POST", body: body ? JSON.stringify(body) : undefined, ...options }),
  patch: (path: string, body?: any, options?: RequestInit) =>
    request(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined, ...options }),
  delete: (path: string, options?: RequestInit) =>
    request(path, { method: "DELETE", ...options }),
};
