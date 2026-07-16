const API_BASE = "/api";

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("nexus_token");
}

export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (body && method !== "GET") {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(data.error || "Request failed", response.status);
  }

  // Return the full response object for paginated results,
  // or the data field for simple responses
  if (data.data !== undefined && (data.total !== undefined || data.totalPages !== undefined)) {
    return data as T;
  }
  return data.data !== undefined ? data.data : data;
}

export function setToken(token: string) {
  localStorage.setItem("nexus_token", token);
}

export function clearToken() {
  localStorage.removeItem("nexus_token");
}

export function getStoredToken(): string | null {
  return getToken();
}