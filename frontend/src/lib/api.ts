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

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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

// ── User API ──

export interface UserProfile {
  userId: string;
  email?: string;
  plan: "trial" | "starter" | "pro" | "enterprise";
  planName: string;
  trialExpiresAt?: string;
  trialDaysRemaining?: number;
  isTrialExpired?: boolean;
  roomsUsed: number;
  jobsUsedThisMonth: number;
  pagesScrapedThisMonth: number;
  jobLimit: number;
  pageLimit: number;
  roomLimit: number;
}

export const usersApi = {
  getMe: () => request<UserProfile>("/users/me"),
  init: () => request<UserProfile>("/users/me/init", { method: "POST" }),
};

// ── Room API ──

export interface Room {
  userId: string;
  roomId: string;
  name: string;
  targetUrl?: string;
  scrapingMethod: "selectors" | "custom_code";
  selectors?: Record<string, string>;
  customCode?: string;
  codeLanguage?: "python" | "javascript";
  provider: "internal" | "scrapingbee" | "scraperapi" | "brightdata";
  providerApiKey?: string;
  scheduleEnabled: boolean;
  scheduleCron?: string;
  mongodbUri?: string;
  mongodbDatabase?: string;
  mongodbCollection?: string;
  mongodbVerified?: boolean;
  status: "active" | "paused";
  createdAt: string;
  updatedAt: string;
}

export const roomsApi = {
  list: () => request<Room[]>("/rooms"),
  get: (roomId: string) => request<Room>(`/rooms/${roomId}`),
  create: (name: string) => request<Room>("/rooms", { method: "POST", body: JSON.stringify({ name }) }),
  update: (roomId: string, data: Partial<Room>) => request<{ message: string }>(`/rooms/${roomId}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (roomId: string) => request<{ message: string }>(`/rooms/${roomId}`, { method: "DELETE" }),
  verifyMongo: (roomId: string) => request<{ message: string }>(`/rooms/${roomId}/verify-mongo`, { method: "POST" }),
};

// ── Jobs API ──

export interface Job {
  roomId: string;
  jobId: string;
  userId: string;
  status: "pending" | "running" | "completed" | "failed";
  provider: string;
  pagesScraped: number;
  itemsFound: number;
  errorMessage?: string;
  logs: string[];
  createdAt: string;
  completedAt?: string;
}

export const jobsApi = {
  list: (roomId: string) => request<Job[]>(`/rooms/${roomId}/jobs`),
  get: (roomId: string, jobId: string) => request<Job>(`/rooms/${roomId}/jobs/${jobId}`),
  trigger: (roomId: string) => request<Job>(`/rooms/${roomId}/jobs`, { method: "POST" }),
  getExport: (roomId: string, jobId: string) => request<{ downloadUrl: string }>(`/rooms/${roomId}/jobs/${jobId}/export`),
};

// ── Billing API ──

export const billingApi = {
  createOrder: (plan: string) => request<any>("/billing/create-order", { method: "POST", body: JSON.stringify({ plan }) }),
  verifyPayment: (data: any) => request<{ message: string }>("/billing/verify-payment", { method: "POST", body: JSON.stringify(data) }),
};
