const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";
const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, "");

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export type OverviewMetrics = {
  report_date: string;
  homepage_impressions: number;
  homepage_clicks: number;
  homepage_ctr: number;
  fastest_rising_styles: Array<{ style_id: string; title: string; image_url: string; delta_score: number }>;
  series: Array<{ date: string; impressions: number; clicks: number; ctr: number }>;
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

export type PerformanceMetrics = {
  report_date: string;
  top_clicked_styles: Array<Record<string, unknown>>;
  top_exposed_styles: Array<Record<string, unknown>>;
  high_impression_low_ctr: Array<Record<string, unknown>>;
  low_impression_high_ctr: Array<Record<string, unknown>>;
};

export type JobLog = {
  id: string;
  job_name: string;
  status: string;
  message: string;
  payload_json: Record<string, unknown>;
  started_at: string;
  finished_at?: string | null;
};

export const api = {
  getOverview: () => request<OverviewMetrics>("/ops/metrics/overview"),
  getTodayReport: () => request<OpsReport | null>("/ops/reports/today"),
  getReportHistory: () => request<OpsReport[]>("/ops/reports/history"),
  getPerformance: () => request<PerformanceMetrics>("/ops/metrics/performance"),
  getJobLogs: () => request<JobLog[]>("/jobs/logs"),
};

export function resolveAssetUrl(value?: string | null): string {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/")) return `${API_ORIGIN}${value}`;
  return `${API_ORIGIN}/${value}`;
}
