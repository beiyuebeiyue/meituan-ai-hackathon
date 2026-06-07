const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";
const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
const TOKEN_KEY = "ops_access_token";
export const OPS_AUTH_CHANGED_EVENT = "ops-auth-changed";

type RequestOptions = RequestInit & { skipAuth?: boolean };

export function getOpsToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setOpsToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event(OPS_AUTH_CHANGED_EVENT));
}

export function clearOpsToken() {
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event(OPS_AUTH_CHANGED_EVENT));
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

export type OpsAnalyticsOverview = {
  start_date: string;
  end_date: string;
  generated_at: string;
  kpis: {
    dau: number;
    new_users: number;
    recommendation_impressions: number;
    recommendation_clicks: number;
    recommendation_ctr: number;
    tryon_started: number;
    tryon_completed: number;
    tryon_completion_rate: number;
    booking_submits: number;
    completed_orders: number;
    revenue_cents: number;
    average_order_value_cents: number;
    click_to_tryon_rate: number;
    tryon_to_booking_rate: number;
    booking_to_order_rate: number;
    click_to_order_rate: number;
    arpu_cents: number;
    revenue_conversion_rate: number;
  };
  funnel: Array<{
    key: string;
    label: string;
    count: number;
    conversion_rate: number;
    step_rate: number;
    dropoff_rate: number;
    dropoff_count: number;
  }>;
  trends: Array<{
    date: string;
    recommendation_clicks: number;
    tryon_started: number;
    tryons: number;
    tryon_completed: number;
    booking_submits: number;
    bookings: number;
    completed_orders: number;
    revenue_cents: number;
  }>;
  top_styles: OpsAnalyticsRankItem[];
  top_shops: OpsAnalyticsRankItem[];
};

export type OpsAnalyticsRankItem = {
  id: string;
  name: string;
  image_url?: string | null;
  impressions: number;
  clicks: number;
  ctr: number;
  tryons: number;
  tryon_rate: number;
  bookings: number;
  booking_rate: number;
  completed_orders: number;
  completion_rate: number;
  revenue_cents: number;
  revenue_share: number;
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
  latest_hand_image_url?: string | null;
  latest_tryon_result_image_url?: string | null;
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
  merchant_uid: number;
  merchant_name: string;
  merchant_phone?: string | null;
  merchant_last_login_ip_location?: string | null;
  name: string;
  city: string;
  address: string;
  contact_phone?: string | null;
  created_at: string;
  booking_count: number;
  completed_booking_count: number;
};

export type OpsPost = {
  id: string;
  author_user_id: string;
  author_uid: number;
  author_name: string;
  author_role: string;
  title: string;
  description: string;
  image_url: string;
  local_image_path: string;
  tags: string[];
  is_hidden: boolean;
  shop_id?: string | null;
  shop_name?: string | null;
  shop_city?: string | null;
  verified_booking_id?: string | null;
  created_at: string;
  updated_at: string;
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
  expiry_date?: string;
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

export type OpenSkillScheduledTask = {
  id: string;
  name: string;
  skill_name: string;
  description: string;
  schedule_label: string;
  cron: string;
  timezone: string;
  enabled: boolean;
  status: string;
  collection_status: string;
  next_run_at?: string | null;
  last_run_at?: string | null;
  last_status?: string | null;
  last_message: string;
  log_path: string;
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

export type OpsMarkdownReport = {
  report_date: string;
  date_key: string;
  markdown_content: string;
  local_file_path: string;
  created_at: string;
};

export type OpsHtmlReport = {
  report_date: string;
  date_key: string;
  html_content: string;
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

export type TrendNailStyle = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  tags: string[];
  popularity_score: number;
  like_count: number;
  claim_count: number;
  can_do_style: boolean;
};

export type TrendNailCampaign = {
  id: string;
  title: string;
  description: string;
  status: string;
  created_by: string;
  created_at: string;
  merchant_count: number;
  claim_count: number;
  styles: TrendNailStyle[];
};

const XHS_WEEKLY_REPORT_FILE = "xhs-weekly-nail-report.html";
export const XHS_WEEKLY_REPORT_WEEKS = [
  { year: 2026, week: 21, label: "2026 W21" },
  { year: 2026, week: 22, label: "2026 W22" },
] as const;

export type XhsWeeklyReportWeek = (typeof XHS_WEEKLY_REPORT_WEEKS)[number];

const XHS_WEEKLY_REPORT_CACHE_PREFIX = "xhs-weekly-report-html:v2:";
const XHS_WEEKLY_REPORT_MEMORY_CACHE = new Map<string, OpsHtmlReport | null>();

function shanghaiDateKey(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}${part("month")}${part("day")}`;
}

function dateKeyToReportDate(dateKey: string): string {
  return `${dateKey.slice(0, 4)}-${dateKey.slice(4, 6)}-${dateKey.slice(6, 8)}`;
}

function xhsReportUrl(dateKey: string, fileName: string): string {
  return `${API_ORIGIN}/xhs-daily-report-assets/${dateKey}/${fileName}`;
}

async function fetchXhsMarkdownReport(dateKey: string, fileName: string): Promise<OpsMarkdownReport | null> {
  const url = xhsReportUrl(dateKey, fileName);
  const response = await fetch(url, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return {
    report_date: dateKeyToReportDate(dateKey),
    date_key: dateKey,
    markdown_content: await response.text(),
    local_file_path: url,
    created_at: response.headers.get("last-modified") ?? new Date().toISOString(),
  };
}

async function fetchXhsMarkdownReportHistory(fileName: string, limit = 30): Promise<OpsMarkdownReport[]> {
  const dayMs = 24 * 60 * 60 * 1000;
  const reports = await Promise.all(
    Array.from({ length: limit }, (_, index) => fetchXhsMarkdownReport(shanghaiDateKey(new Date(Date.now() - index * dayMs)), fileName)),
  );
  return reports.filter((item): item is OpsMarkdownReport => Boolean(item));
}

async function fetchXhsWeeklyHtmlReport(week: XhsWeeklyReportWeek = XHS_WEEKLY_REPORT_WEEKS[0]): Promise<OpsHtmlReport | null> {
  const url = `${API_ORIGIN}/${XHS_WEEKLY_REPORT_FILE}`;
  const cacheKey = `${XHS_WEEKLY_REPORT_CACHE_PREFIX}${week.year}-W${week.week}`;
  const memoryCached = XHS_WEEKLY_REPORT_MEMORY_CACHE.get(cacheKey);
  if (memoryCached !== undefined) return memoryCached;

  const stored = readXhsWeeklyReportCache(cacheKey);
  if (stored !== undefined) {
    XHS_WEEKLY_REPORT_MEMORY_CACHE.set(cacheKey, stored);
    return stored;
  }

  const response = await fetch(url, { cache: "force-cache" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  const todayKey = shanghaiDateKey(new Date());
  const htmlContent = await response.text();
  const report = {
    report_date: dateKeyToReportDate(todayKey),
    date_key: `${week.year}-W${String(week.week).padStart(2, "0")}`,
    html_content: normalizeXhsWeeklyReportHtml(htmlContent, week),
    local_file_path: url,
    created_at: response.headers.get("last-modified") ?? new Date().toISOString(),
  };
  XHS_WEEKLY_REPORT_MEMORY_CACHE.set(cacheKey, report);
  writeXhsWeeklyReportCache(cacheKey, report);
  return report;
}

function readXhsWeeklyReportCache(cacheKey: string): OpsHtmlReport | null | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = window.sessionStorage.getItem(cacheKey);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as OpsHtmlReport | null;
  } catch {
    window.sessionStorage.removeItem(cacheKey);
    return undefined;
  }
}

function writeXhsWeeklyReportCache(cacheKey: string, report: OpsHtmlReport | null) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(cacheKey, JSON.stringify(report));
  } catch {
    // Storage can be full or unavailable in private browsing; in-memory cache still works.
  }
}

function normalizeXhsWeeklyReportHtml(html: string, week: XhsWeeklyReportWeek): string {
  return html
    .replace(/焕甲小红书美甲运营周报/g, "小红书美甲趋势周报")
    .replace(
      /(["'])([^"']*xhs-popular-nail-posts-crawler\/assets\/([^"']+))\1/g,
      (_match, quote: string, _src: string, assetPath: string) => {
        return `${quote}${API_ORIGIN}/openclaw-assets/${assetPath}${quote}`;
      },
    )
    .replace(
      /(["'])(?:https?:\/\/[^"']+)?\/openclaw-assets\/(\d{8}\/[^"']+)\1/g,
      (_match, quote: string, assetPath: string) => `${quote}${API_ORIGIN}/openclaw-assets/${assetPath}${quote}`,
    );
}

export const api = {
  login: (username: string, password: string) =>
    request<{ access_token: string; token_type: string }>("/ops/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
      skipAuth: true,
    }),
  getDashboard: () => request<OpsDashboard>("/ops/dashboard"),
  getAnalyticsOverview: (startDate?: string, endDate?: string) => {
    const search = new URLSearchParams();
    if (startDate) search.set("start_date", startDate);
    if (endDate) search.set("end_date", endDate);
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<OpsAnalyticsOverview>(`/ops/analytics/overview${suffix}`);
  },
  getUsers: (query = "", limit = 10, offset = 0) =>
    request<ListResponse<OpsUser>>(`/ops/users?query=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`),
  getUser: (id: string) => request<OpsUser>(`/ops/users/${id}`),
  getMerchants: (query = "", city = "", limit = 10, offset = 0) =>
    request<ListResponse<OpsMerchant>>(
      `/ops/merchants?query=${encodeURIComponent(query)}&city=${encodeURIComponent(city)}&limit=${limit}&offset=${offset}`,
    ),
  getMerchantCities: () => request<string[]>("/ops/merchants/cities"),
  getMerchant: (id: string) => request<OpsMerchant>(`/ops/merchants/${id}`),
  getPosts: (query = "", limit = 50, offset = 0) =>
    request<ListResponse<OpsPost>>(`/ops/posts?query=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`),
  getPost: (id: string) => request<OpsPost>(`/ops/posts/${id}`),
  createCouponGrant: (payload: CouponGrantPayload) =>
    request<CouponGrant>("/ops/coupons/grants", { method: "POST", body: JSON.stringify(payload) }),
  getCouponGrants: (limit = 50, offset = 0) => request<ListResponse<CouponGrant>>(`/ops/coupons/grants?limit=${limit}&offset=${offset}`),
  chat: (messages: ChatMessage[]) =>
    request<ChatResponse>("/ops/ai/chat", { method: "POST", body: JSON.stringify({ messages }) }),
  getOpenSkillScheduledTasks: () => request<{ items: OpenSkillScheduledTask[] }>("/ops/openclaw/scheduled-tasks"),
  generateReport: () => request<ReportGenerateResponse>("/ops/reports/generate", { method: "POST" }),
  saveReport: (payload: ReportGenerateResponse) =>
    request<OpsReport>("/ops/reports/save", { method: "POST", body: JSON.stringify(payload) }),
  getTodayReport: () => request<OpsReport | null>("/ops/reports/today"),
  getTodayXhsNailReport: (week?: XhsWeeklyReportWeek) => fetchXhsWeeklyHtmlReport(week),
  getXhsNailReportHistory: () => Promise.resolve([] as OpsMarkdownReport[]),
  getPerformance: () => request<PerformanceMetrics>("/ops/metrics/performance"),
  getTrendNailCandidates: (limit = 20) => request<{ items: TrendNailStyle[] }>(`/ops/trend-nails/candidates?limit=${limit}`),
  createTrendNailCampaign: (payload: { title: string; description: string; style_ids: string[]; merchant_user_ids?: string[] | null }) =>
    request<TrendNailCampaign>("/ops/trend-nail-campaigns", { method: "POST", body: JSON.stringify(payload) }),
  createAutoTrendNailCampaign: (force = false, limit = 12) =>
    request<TrendNailCampaign | null>(`/ops/trend-nail-campaigns/auto?force=${force ? "true" : "false"}&limit=${limit}`, {
      method: "POST",
    }),
  getTrendNailCampaign: (id: string) => request<TrendNailCampaign>(`/ops/trend-nail-campaigns/${id}`),
};

export function resolveAssetUrl(value?: string | null): string {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("assets/")) return `${API_ORIGIN}/openclaw-assets/${value.slice("assets/".length)}`;
  if (value.startsWith("/")) return `${API_ORIGIN}${value}`;
  if (value.startsWith("data/")) return `${API_ORIGIN}/files/${value.slice("data/".length)}`;
  return `${API_ORIGIN}/${value}`;
}
