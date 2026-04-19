import { fetchAuthSession } from "aws-amplify/auth";
import { API_BASE_URL } from "./amplify-config";

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const baseUrl = API_BASE_URL.replace(/\/+$/, "");
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ── Sessions API ──

export interface Session {
  userId: string;
  sessionId: string;
  name: string;
  targetUrl: string;
  selectors: Record<string, string>;
  pagination: Record<string, string | number>;
  proxy: Record<string, string>;
  schedule: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export const sessionsApi = {
  list: () => request<Session[]>("/sessions"),
  get: (id: string) => request<Session>(`/sessions/${id}`),
  create: (data: Partial<Session>) =>
    request<Session>("/sessions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Session>) =>
    request<{ message: string; sessionId: string }>(`/sessions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ message: string; sessionId: string }>(`/sessions/${id}`, {
      method: "DELETE",
    }),
};

// ── Jobs API ──

export interface Job {
  sessionId: string;
  jobId: string;
  userId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  pagesScraped: number;
  itemsExtracted: number;
  errors: string[];
}

export const jobsApi = {
  trigger: (sessionId: string) =>
    request<Job>("/jobs", {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    }),
  list: () => request<Job[]>("/jobs"),
  get: (jobId: string) => request<Job>(`/jobs/${jobId}`),
};

// ── Dashboard API ──

export interface DashboardMetrics {
  totalSessions: number;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  queuedJobs: number;
  runningJobs: number;
  totalPagesScraped: number;
  totalItemsExtracted: number;
  storageUsedMB: number;
}

export const dashboardApi = {
  getMetrics: () => request<DashboardMetrics>("/dashboard"),
};

// ── Export API ──

export interface ExportFile {
  filename: string;
  size: number;
  url: string;
}

export const exportApi = {
  getDownloadLinks: (sessionId: string, jobId: string) =>
    request<{ jobId: string; files: ExportFile[] }>(
      `/export?sessionId=${sessionId}&jobId=${jobId}`
    ),
};
