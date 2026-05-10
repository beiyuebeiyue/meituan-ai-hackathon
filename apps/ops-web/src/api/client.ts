const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8001/api/v1";
const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
const TOKEN_KEY = "ops_access_token";

type RequestOptions = RequestInit & { skipAuth?: boolean };

export function getOpsToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setOpsToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearOpsToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth, headers, body, ...init } = options;
  const requestHeaders = new Headers(headers);
  if (body && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }
  if (!skipAuth) {
    const token = getOpsToken();
    if (token) requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    body,
    headers: requestHeaders,
  });
  if (!response.ok) {
    if (response.status === 401) clearOpsToken();
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export type MetricPair = {
  total: number;
  today: number;
};

export type OpsDashboard = {
  report_date: string;
  timezone: string;
  metrics: {
    users: MetricPair;
    merchants: MetricPair;
    images: MetricPair;
    likes: MetricPair;
    collects: MetricPair;
    shares: MetricPair;
    tryon_users: MetricPair;
    bookings: MetricPair;
    completed_bookings: MetricPair;
    revenue: MetricPair;
  };
  popular_nails: PopularNail[];
};

export type PopularNail = {
  note_id: string;
  keyword: string;
  title: string;
  desc: string;
  tag_list: string[];
  image_list: string[];
  liked_count: number;
  collected_count: number;
  share_count: number;
};

export type OpsUser = {
  id: string;
  uid: number;
  username: string;
  phone?: string | null;
  avatar_url?: string | null;
  last_login_ip_location?: string | null;
  role: string;
  created_at: string;
  booking_count: number;
  tryon_count: number;
  like_count: number;
  collect_count: number;
};

export type OpsMerchant = {
  id: string;
  merchant_user_id: string;
  merchant_name: string;
  merchant_phone?: string | null;
  name: string;
  city: string;
  address: string;
  contact_phone?: string | null;
  created_at: string;
  booking_count: number;
  completed_booking_count: number;
};

export type OpsMerchantUser = {
  id: string;
  uid: number;
  username: string;
  phone?: string | null;
  avatar_url?: string | null;
  last_login_ip_location?: string | null;
  role: string;
  created_at: string;
  shop_count: number;
  booking_count: number;
  completed_booking_count: number;
};

export type ListResponse<T> = {
  items: T[];
  total: number;
};

export type CouponGrantPayload = {
  target_type: "user";
  target_id: string;
  coupon_name: string;
  amount: number;
  valid_from?: string;
  valid_until?: string;
  note?: string;
};

export type CouponGrant = CouponGrantPayload & {
  id: string;
  target_name: string;
  note: string;
  created_by: string;
  created_at: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatResponse = {
  reply: string;
  model: string;
};

export type OpsReport = {
  id: string;
  report_date: string;
  markdown_content: string;
  summary_text: string;
  report_json: Record<string, unknown>;
  local_file_path: string;
  created_at: string;
};

export type ReportGenerateResponse = {
  report_date: string;
  markdown_content: string;
  summary_text: string;
  report_json: Record<string, unknown>;
};

export type PerformanceMetrics = {
  report_date: string;
  top_clicked_styles: Array<Record<string, unknown>>;
  top_exposed_styles: Array<Record<string, unknown>>;
  high_impression_low_ctr: Array<Record<string, unknown>>;
  low_impression_high_ctr: Array<Record<string, unknown>>;
};

export const api = {
  login: (username: string, password: string) =>
    request<{ access_token: string; token_type: string }>("/ops/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
      skipAuth: true,
    }),
  getDashboard: () => request<OpsDashboard>("/ops/dashboard"),
  getUsers: (query = "", limit = 50, offset = 0) =>
    request<ListResponse<OpsUser>>(`/ops/users?query=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`),
  getUser: (id: string) => request<OpsUser>(`/ops/users/${id}`),
  getMerchants: (query = "", city = "", limit = 50, offset = 0) =>
    request<ListResponse<OpsMerchant>>(
      `/ops/merchants?query=${encodeURIComponent(query)}&city=${encodeURIComponent(city)}&limit=${limit}&offset=${offset}`,
    ),
  getMerchantCities: () => request<string[]>("/ops/merchants/cities"),
  getMerchant: (id: string) => request<OpsMerchant>(`/ops/merchants/${id}`),
  getMerchantUsers: (query = "", limit = 50, offset = 0) =>
    request<ListResponse<OpsMerchantUser>>(
      `/ops/merchant-users?query=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`,
    ),
  getMerchantUser: (id: string) => request<OpsMerchantUser>(`/ops/merchant-users/${id}`),
  createCouponGrant: (payload: CouponGrantPayload) =>
    request<CouponGrant>("/ops/coupons/grants", { method: "POST", body: JSON.stringify(payload) }),
  getCouponGrants: (limit = 50, offset = 0) => request<ListResponse<CouponGrant>>(`/ops/coupons/grants?limit=${limit}&offset=${offset}`),
  chat: (messages: ChatMessage[]) =>
    request<ChatResponse>("/ops/ai/chat", { method: "POST", body: JSON.stringify({ messages }) }),
  generateReport: () => request<ReportGenerateResponse>("/ops/reports/generate", { method: "POST" }),
  saveReport: (payload: ReportGenerateResponse) =>
    request<OpsReport>("/ops/reports/save", { method: "POST", body: JSON.stringify(payload) }),
  getTodayReport: () => request<OpsReport | null>("/ops/reports/today"),
  getReportHistory: () => request<OpsReport[]>("/ops/reports/history"),
  getPerformance: () => request<PerformanceMetrics>("/ops/metrics/performance"),
};

export function resolveAssetUrl(value?: string | null): string {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("assets/")) return `${API_ORIGIN}/openclaw-assets/${value.slice("assets/".length)}`;
  if (value.startsWith("/")) return `${API_ORIGIN}${value}`;
  if (value.startsWith("data/")) return `${API_ORIGIN}/files/${value.slice("data/".length)}`;
  return `${API_ORIGIN}/${value}`;
}
