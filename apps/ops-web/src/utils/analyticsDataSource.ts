export type AnalyticsDataSource = "demo" | "real";

export const ANALYTICS_DATA_SOURCE_CHANGED_EVENT = "ops-analytics-data-source-changed";

let currentAnalyticsDataSource: AnalyticsDataSource = "demo";

export function getAnalyticsDataSource() {
  return currentAnalyticsDataSource;
}

export function setAnalyticsDataSource(dataSource: AnalyticsDataSource) {
  currentAnalyticsDataSource = dataSource;
  window.dispatchEvent(new CustomEvent<AnalyticsDataSource>(ANALYTICS_DATA_SOURCE_CHANGED_EVENT, { detail: dataSource }));
}
