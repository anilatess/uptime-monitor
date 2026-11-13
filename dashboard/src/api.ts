const API_URL = "http://localhost:3000";

export interface Monitor {
  id: number;
  name: string;
  url: string;
  intervalMinutes: number;
  createdAt: string;
}

export interface PeriodStats {
  totalChecks: number;
  uptimePercent: number | null;
  avgResponseTimeMs: number | null;
}

export interface CheckResult {
  id: number;
  monitorId: number;
  statusCode: number | null;
  responseTimeMs: number | null;
  isUp: boolean;
  checkedAt: string;
}

export interface Stats {
  monitor: { id: number; name: string; url: string };
  currentStatus: "up" | "down" | "unknown";
  lastCheckedAt: string | null;
  last24h: PeriodStats;
  last7d: PeriodStats;
  last30d: PeriodStats;
  recentDowns: CheckResult[];
}

export function getToken(): string | null {
  return localStorage.getItem("token");
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.error ?? data?.errors?.[0]?.message ?? "Bir hata oluştu";
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export const api = {
  register: (email: string, password: string) =>
    request<{ token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    request<{ token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  listMonitors: () => request<Monitor[]>("/monitors"),
  createMonitor: (data: { name: string; url: string; intervalMinutes: number }) =>
    request<Monitor>("/monitors", { method: "POST", body: JSON.stringify(data) }),
  deleteMonitor: (id: number) => request<void>(`/monitors/${id}`, { method: "DELETE" }),
  getStats: (id: number) => request<Stats>(`/monitors/${id}/stats`),
  getChecks: (id: number) => request<CheckResult[]>(`/monitors/${id}/checks`),
};