import { CalendarOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { App, Card, Col, DatePicker, Empty, Progress, Row, Segmented, Space, Spin, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, OpsAnalyticsOverview, OpsAnalyticsRankItem, resolveAssetUrl } from "../api/client";
import { ANALYTICS_DATA_SOURCE_CHANGED_EVENT, getAnalyticsDataSource } from "../utils/analyticsDataSource";
import type { AnalyticsDataSource } from "../utils/analyticsDataSource";

type TrendMetric = "recommendation_clicks" | "tryon_completed" | "booking_submits" | "completed_orders" | "revenue";

const ANALYTICS_CACHE_TTL_MS = 5 * 60 * 1000;

type AnalyticsCacheEntry = {
  data: OpsAnalyticsOverview;
  cachedAt: number;
};

const analyticsOverviewCache = new Map<string, AnalyticsCacheEntry>();
const analyticsOverviewRequests = new Map<string, Promise<OpsAnalyticsOverview>>();

function analyticsCacheKey(range: [string, string] | undefined) {
  return range ? `${range[0]}:${range[1]}` : "default";
}

function isFresh(cachedAt: number) {
  return Date.now() - cachedAt < ANALYTICS_CACHE_TTL_MS;
}

function loadAnalyticsOverview(startDate: string | undefined, endDate: string | undefined, key: string) {
  const existingRequest = analyticsOverviewRequests.get(key);
  if (existingRequest) return existingRequest;
  const request = api
    .getAnalyticsOverview(startDate, endDate)
    .then((data) => {
      analyticsOverviewCache.set(key, { data, cachedAt: Date.now() });
      return data;
    })
    .finally(() => {
      analyticsOverviewRequests.delete(key);
    });
  analyticsOverviewRequests.set(key, request);
  return request;
}

const trendOptions = [
  { label: "推荐点击", value: "recommendation_clicks" },
  { label: "试戴完成", value: "tryon_completed" },
  { label: "预约提交", value: "booking_submits" },
  { label: "完成订单", value: "completed_orders" },
  { label: "营业额", value: "revenue" },
] as const;

function formatNumber(value: number) {
  return value.toLocaleString("zh-CN");
}

function formatCents(value: number) {
  return `¥ ${(value / 100).toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function funnelColor(index: number) {
  return ["#2563eb", "#16a34a", "#f97316", "#a855f7", "#06b6d4", "#e11d48"][index % 6];
}

function kpiTone(index: number) {
  return ["is-revenue", "is-order", "is-recommend", "is-tryon", "is-conversion", "is-aov"][index % 6];
}

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultAnalyticsRange(): [string, string] {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 13);
  return [toDateString(start), toDateString(end)];
}

function resolveAnalyticsRange(range: [string, string] | undefined): [string, string] {
  return range ?? defaultAnalyticsRange();
}

function eachDate(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [toDateString(new Date())];
  }
  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end && dates.length < 62) {
    dates.push(toDateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function buildFunnel(steps: Array<{ key: string; label: string; count: number }>): OpsAnalyticsOverview["funnel"] {
  const firstCount = steps[0]?.count ?? 0;
  return steps.map((step, index) => {
    const previousCount = index === 0 ? step.count : steps[index - 1].count;
    const dropoffCount = Math.max(previousCount - step.count, 0);
    const stepRate = index === 0 ? 1 : rate(step.count, previousCount);
    return {
      ...step,
      conversion_rate: index === 0 ? 1 : rate(step.count, firstCount),
      step_rate: stepRate,
      dropoff_rate: index === 0 ? 0 : 1 - stepRate,
      dropoff_count: index === 0 ? 0 : dropoffCount,
    };
  });
}

const demoStyleImages = [
  "/openclaw-assets/20260520/images/6a0aab43000000000802676c/6a0aab43000000000802676c_03.webp",
  "/openclaw-assets/20260520/images/6a0abc370000000007021df1/6a0abc370000000007021df1_08.webp",
  "/openclaw-assets/20260520/images/6a0a895f000000003603178d/6a0a895f000000003603178d_03.webp",
  "/openclaw-assets/20260520/images/6a0acba1000000003701e3aa/6a0acba1000000003701e3aa_01.webp",
];

function demoRankItem(
  id: string,
  name: string,
  imageUrl: string | null,
  impressions: number,
  clicks: number,
  tryons: number,
  bookings: number,
  completedOrders: number,
  revenueCents: number,
  totalRevenueCents: number,
): OpsAnalyticsRankItem {
  return {
    id,
    name,
    image_url: imageUrl,
    impressions,
    clicks,
    ctr: rate(clicks, impressions),
    tryons,
    tryon_rate: rate(tryons, clicks),
    bookings,
    booking_rate: rate(bookings, tryons),
    completed_orders: completedOrders,
    completion_rate: rate(completedOrders, bookings),
    revenue_cents: revenueCents,
    revenue_share: rate(revenueCents, totalRevenueCents),
  };
}

function buildDemoAnalyticsOverview(range: [string, string] | undefined): OpsAnalyticsOverview {
  const [startDate, endDate] = resolveAnalyticsRange(range);
  const dates = eachDate(startDate, endDate);
  const trends = dates.map((date, index) => {
    const wave = Math.sin(index / 1.7) * 16;
    const weekendBoost = [5, 6].includes(new Date(`${date}T00:00:00`).getDay()) ? 24 : 0;
    const recommendationClicks = Math.max(92, Math.round(132 + index * 5.5 + wave + weekendBoost));
    const tryonStarted = Math.round(recommendationClicks * (0.46 + (index % 3) * 0.015));
    const tryonCompleted = Math.round(tryonStarted * (0.72 + (index % 4) * 0.018));
    const bookingSubmits = Math.round(tryonCompleted * (0.28 + (index % 2) * 0.035));
    const completedOrders = Math.max(8, Math.round(bookingSubmits * (0.42 + (index % 5) * 0.018)));
    return {
      date,
      recommendation_clicks: recommendationClicks,
      tryon_started: tryonStarted,
      tryons: tryonStarted,
      tryon_completed: tryonCompleted,
      booking_submits: bookingSubmits,
      bookings: bookingSubmits,
      completed_orders: completedOrders,
      revenue_cents: completedOrders * (15800 + (index % 4) * 1200),
    };
  });

  const recommendationClicks = trends.reduce((sum, item) => sum + item.recommendation_clicks, 0);
  const tryonStarted = trends.reduce((sum, item) => sum + item.tryon_started, 0);
  const tryonCompleted = trends.reduce((sum, item) => sum + item.tryon_completed, 0);
  const bookingSubmits = trends.reduce((sum, item) => sum + item.booking_submits, 0);
  const completedOrders = trends.reduce((sum, item) => sum + item.completed_orders, 0);
  const revenueCents = trends.reduce((sum, item) => sum + item.revenue_cents, 0);
  const recommendationImpressions = Math.round(recommendationClicks / 0.128);
  const dau = Math.max(280, Math.round(recommendationImpressions / Math.max(dates.length, 1) / 3.7));

  const topStyleRevenue = Math.round(revenueCents * 0.72);
  const topShopRevenue = Math.round(revenueCents * 0.86);

  return {
    start_date: startDate,
    end_date: endDate,
    generated_at: new Date().toISOString(),
    kpis: {
      dau,
      new_users: Math.round(dau * 0.18),
      recommendation_impressions: recommendationImpressions,
      recommendation_clicks: recommendationClicks,
      recommendation_ctr: rate(recommendationClicks, recommendationImpressions),
      tryon_started: tryonStarted,
      tryon_completed: tryonCompleted,
      tryon_completion_rate: rate(tryonCompleted, tryonStarted),
      booking_submits: bookingSubmits,
      completed_orders: completedOrders,
      revenue_cents: revenueCents,
      average_order_value_cents: Math.round(rate(revenueCents, completedOrders)),
      click_to_tryon_rate: rate(tryonStarted, recommendationClicks),
      tryon_to_booking_rate: rate(bookingSubmits, tryonCompleted),
      booking_to_order_rate: rate(completedOrders, bookingSubmits),
      click_to_order_rate: rate(completedOrders, recommendationClicks),
      arpu_cents: Math.round(rate(revenueCents, dau * Math.max(dates.length, 1))),
      revenue_conversion_rate: rate(revenueCents, recommendationImpressions * 16800),
    },
    funnel: buildFunnel([
      { key: "impression", label: "推荐曝光", count: recommendationImpressions },
      { key: "click", label: "推荐点击", count: recommendationClicks },
      { key: "tryon_start", label: "开始焕甲", count: tryonStarted },
      { key: "tryon_complete", label: "完成焕甲", count: tryonCompleted },
      { key: "booking_submit", label: "提交预约", count: bookingSubmits },
      { key: "completed_order", label: "完成订单", count: completedOrders },
    ]),
    trends,
    top_styles: [
      demoRankItem("demo-style-1", "星河猫眼通勤款", demoStyleImages[0], 18420, 2368, 1126, 326, 148, Math.round(topStyleRevenue * 0.34), revenueCents),
      demoRankItem("demo-style-2", "薄荷沁夏短甲", demoStyleImages[1], 15680, 2042, 964, 278, 121, Math.round(topStyleRevenue * 0.26), revenueCents),
      demoRankItem("demo-style-3", "裸粉法式微闪", demoStyleImages[2], 13940, 1716, 806, 231, 96, Math.round(topStyleRevenue * 0.21), revenueCents),
      demoRankItem("demo-style-4", "显白蝴蝶结甜酷款", demoStyleImages[3], 11820, 1424, 662, 188, 78, Math.round(topStyleRevenue * 0.19), revenueCents),
    ],
    top_shops: [
      demoRankItem("demo-shop-1", "焕甲测试美甲店", null, 24600, 0, 1492, 438, 196, Math.round(topShopRevenue * 0.36), revenueCents),
      demoRankItem("demo-shop-2", "福田中心猫眼美甲", null, 21380, 0, 1270, 372, 168, Math.round(topShopRevenue * 0.29), revenueCents),
      demoRankItem("demo-shop-3", "南山通勤美甲工作室", null, 17640, 0, 984, 304, 136, Math.round(topShopRevenue * 0.21), revenueCents),
      demoRankItem("demo-shop-4", "车公庙轻奢甲社", null, 14280, 0, 812, 246, 104, Math.round(topShopRevenue * 0.14), revenueCents),
    ],
  };
}

function AnalyticsKpiGrid({ analytics }: { analytics: OpsAnalyticsOverview }) {
  const kpis = analytics.kpis;
  const cards = [
    { label: "营业额", value: formatCents(kpis.revenue_cents), hint: `ARPU ${formatCents(kpis.arpu_cents)}` },
    { label: "完成订单", value: formatNumber(kpis.completed_orders), hint: `预约提交 ${formatNumber(kpis.booking_submits)}` },
    { label: "推荐点击率", value: formatPercent(kpis.recommendation_ctr), hint: `曝光 ${formatNumber(kpis.recommendation_impressions)} · 点击 ${formatNumber(kpis.recommendation_clicks)}` },
    { label: "焕甲完成率", value: formatPercent(kpis.tryon_completion_rate), hint: `开始 ${formatNumber(kpis.tryon_started)} · 完成 ${formatNumber(kpis.tryon_completed)}` },
    { label: "点击到成交率", value: formatPercent(kpis.click_to_order_rate), hint: `点击到试戴 ${formatPercent(kpis.click_to_tryon_rate)}` },
    { label: "客单价", value: formatCents(kpis.average_order_value_cents), hint: `收入转化 ${formatPercent(kpis.revenue_conversion_rate)}` },
  ];

  return (
    <Row gutter={[16, 16]}>
      {cards.map((card, index) => (
        <Col xs={24} sm={12} xl={8} xxl={4} key={card.label}>
          <Card className={`ops-command-kpi ${kpiTone(index)}`}>
            <Typography.Text type="secondary">{card.label}</Typography.Text>
            <div className="ops-command-kpi-value">{card.value}</div>
            <Typography.Text type="secondary">{card.hint}</Typography.Text>
          </Card>
        </Col>
      ))}
    </Row>
  );
}

function ConversionFunnel({ analytics }: { analytics: OpsAnalyticsOverview }) {
  const maxCount = Math.max(...analytics.funnel.map((step) => step.count), 1);
  return (
    <Card className="ops-command-card" title="核心转化漏斗">
      <div className="ops-funnel-list">
        {analytics.funnel.map((step, index) => (
          <div className="ops-funnel-row" key={step.key}>
            <div className="ops-funnel-index">{index + 1}</div>
            <div className="ops-funnel-main">
              <div className="ops-funnel-title">
                <span>{step.label}</span>
                <strong>{formatNumber(step.count)}</strong>
              </div>
              <Progress
                percent={Math.round((step.count / maxCount) * 100)}
                showInfo={false}
                strokeColor={funnelColor(index)}
              />
              <div className="ops-funnel-meta">
                {index === 0 ? (
                  <span>漏斗起点</span>
                ) : (
                  <>
                    <span>上一步转化 {formatPercent(step.step_rate)}</span>
                    <span>总转化 {formatPercent(step.conversion_rate)}</span>
                    <span>流失 {formatNumber(step.dropoff_count)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TrendPanel({ analytics }: { analytics: OpsAnalyticsOverview }) {
  const [metric, setMetric] = useState<TrendMetric>("recommendation_clicks");
  const rows = useMemo(
    () =>
      analytics.trends.map((item) => ({
        label: item.date.slice(5),
        recommendation_clicks: item.recommendation_clicks,
        tryon_completed: item.tryon_completed,
        booking_submits: item.booking_submits,
        completed_orders: item.completed_orders,
        revenue: Math.round(item.revenue_cents / 100),
      })),
    [analytics.trends],
  );
  const metricLabel = trendOptions.find((item) => item.value === metric)?.label ?? "趋势";

  return (
    <Card
      className="ops-command-card"
      title="趋势"
      extra={
        <Segmented
          size="small"
          value={metric}
          onChange={(value) => setMetric(value as TrendMetric)}
          options={[...trendOptions]}
        />
      }
    >
      {rows.length ? (
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={rows}>
            <CartesianGrid stroke="#eeeeee" vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
            <Tooltip formatter={(value) => (metric === "revenue" ? formatCents(Number(value) * 100) : formatNumber(Number(value)))} />
            <Line type="monotone" dataKey={metric} name={metricLabel} stroke="#2563eb" strokeWidth={3} dot={{ r: 3, fill: "#f97316" }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <Empty description="当前日期范围暂无趋势数据" />
      )}
    </Card>
  );
}

function rankColumns(kind: "style" | "shop"): ColumnsType<OpsAnalyticsRankItem> {
  const baseColumns: ColumnsType<OpsAnalyticsRankItem> = [
    {
      title: kind === "style" ? "款式" : "门店",
      key: "name",
      dataIndex: "name",
      fixed: "left",
      width: 230,
      render: (_: string, row) => (
        <Space>
          {row.image_url ? <img className="analytics-rank-thumb" src={resolveAssetUrl(row.image_url)} alt="" /> : null}
          <Typography.Text strong ellipsis style={{ maxWidth: 170 }}>
            {row.name}
          </Typography.Text>
        </Space>
      ),
    },
    { title: "曝光", key: "impressions", dataIndex: "impressions", width: 90, render: formatNumber },
    { title: "点击", key: "clicks", dataIndex: "clicks", width: 90, render: formatNumber },
    { title: "点击率", key: "ctr", dataIndex: "ctr", width: 90, render: formatPercent },
    { title: "试戴", key: "tryons", dataIndex: "tryons", width: 90, render: formatNumber },
    { title: "预约", key: "bookings", dataIndex: "bookings", width: 90, render: formatNumber },
    { title: "成交", key: "completed_orders", dataIndex: "completed_orders", width: 90, render: formatNumber },
    { title: "成交率", key: "completion_rate", dataIndex: "completion_rate", width: 90, render: formatPercent },
    { title: "营业额", key: "revenue_cents", dataIndex: "revenue_cents", width: 110, render: formatCents },
    { title: "收入贡献", key: "revenue_share", dataIndex: "revenue_share", width: 100, render: formatPercent },
  ];
  if (kind === "style") return baseColumns;
  return baseColumns.filter((column) => column.key !== "clicks" && column.key !== "ctr");
}

function RankingTables({ analytics }: { analytics: OpsAnalyticsOverview }) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={12}>
        <Card className="ops-command-card" title="Top 款式">
          <Table
            rowKey="id"
            size="small"
            columns={rankColumns("style")}
            dataSource={analytics.top_styles}
            pagination={false}
            scroll={{ x: 1060 }}
            locale={{ emptyText: "暂无款式转化数据" }}
          />
        </Card>
      </Col>
      <Col xs={24} xl={12}>
        <Card className="ops-command-card" title="Top 门店">
          <Table
            rowKey="id"
            size="small"
            columns={rankColumns("shop")}
            dataSource={analytics.top_shops}
            pagination={false}
            scroll={{ x: 860 }}
            locale={{ emptyText: "暂无门店转化数据" }}
          />
        </Card>
      </Col>
    </Row>
  );
}

export function DashboardPage() {
  const { message } = App.useApp();
  const [analyticsRange, setAnalyticsRange] = useState<[string, string] | undefined>();
  const [dataSource, setDataSource] = useState<AnalyticsDataSource>(() => getAnalyticsDataSource());
  const [analytics, setAnalytics] = useState<OpsAnalyticsOverview | null>(() => {
    return getAnalyticsDataSource() === "demo" ? buildDemoAnalyticsOverview(undefined) : null;
  });
  const [loading, setLoading] = useState(() => getAnalyticsDataSource() === "real");

  useEffect(() => {
    const handleDataSourceChanged = (event: Event) => {
      const nextDataSource = (event as CustomEvent<AnalyticsDataSource>).detail;
      if (nextDataSource === "demo" || nextDataSource === "real") {
        setDataSource(nextDataSource);
      }
    };
    window.addEventListener(ANALYTICS_DATA_SOURCE_CHANGED_EVENT, handleDataSourceChanged);
    return () => window.removeEventListener(ANALYTICS_DATA_SOURCE_CHANGED_EVENT, handleDataSourceChanged);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (dataSource === "demo") {
      setAnalytics(buildDemoAnalyticsOverview(analyticsRange));
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const key = analyticsCacheKey(analyticsRange);
    const cached = analyticsOverviewCache.get(key);
    if (cached && isFresh(cached.cachedAt)) {
      setAnalytics(cached.data);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(!cached);
    if (cached) setAnalytics(cached.data);
    loadAnalyticsOverview(analyticsRange?.[0], analyticsRange?.[1], key)
      .then((data) => {
        if (!cancelled) setAnalytics(data);
      })
      .catch((error) => {
        if (!cancelled) message.error(error instanceof Error ? error.message : "加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [analyticsRange, dataSource, message]);

  if (loading) return <Spin />;
  if (!analytics) return <Empty description="暂无运营数据" />;

  return (
    <Space direction="vertical" size={20} className="page-stack analysis-page ops-command-page">
      <div className="ops-command-toolbar">
        <Space wrap size={[8, 8]} className="ops-command-toolbar-meta">
          <Tag>
            统计区间 {analytics.start_date} 至 {analytics.end_date}
          </Tag>
          <Tag icon={<ClockCircleOutlined />} color="default">
            更新 {formatDateTime(analytics.generated_at)}
          </Tag>
        </Space>
        <Space wrap className="ops-command-toolbar-actions">
          <DatePicker.RangePicker
            suffixIcon={<CalendarOutlined />}
            onChange={(_, dateStrings) => {
              setAnalyticsRange(dateStrings[0] && dateStrings[1] ? [dateStrings[0], dateStrings[1]] : undefined);
            }}
          />
        </Space>
      </div>

      <AnalyticsKpiGrid analytics={analytics} />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={11}>
          <ConversionFunnel analytics={analytics} />
        </Col>
        <Col xs={24} xl={13}>
          <TrendPanel analytics={analytics} />
        </Col>
      </Row>

      <RankingTables analytics={analytics} />
    </Space>
  );
}
