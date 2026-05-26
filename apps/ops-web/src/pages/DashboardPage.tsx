import { CalendarOutlined, ClockCircleOutlined, InfoCircleOutlined } from "@ant-design/icons";
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

type TrendMetric = "recommendation_clicks" | "tryon_completed" | "booking_submits" | "completed_orders" | "revenue";

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

function kpiTone(index: number) {
  return ["is-revenue", "is-order", "is-recommend", "is-tryon", "is-conversion", "is-aov"][index % 6];
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
                strokeColor={index < 2 ? "#ff6b45" : "#2563eb"}
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
            <CartesianGrid stroke="#eef2f7" vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
            <Tooltip formatter={(value) => (metric === "revenue" ? formatCents(Number(value) * 100) : formatNumber(Number(value)))} />
            <Line type="monotone" dataKey={metric} name={metricLabel} stroke="#2563eb" strokeWidth={3} dot={{ r: 3 }} />
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
  const [analytics, setAnalytics] = useState<OpsAnalyticsOverview | null>(null);
  const [analyticsRange, setAnalyticsRange] = useState<[string, string] | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .getAnalyticsOverview(analyticsRange?.[0], analyticsRange?.[1])
      .then(setAnalytics)
      .catch((error) => message.error(error instanceof Error ? error.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [analyticsRange, message]);

  if (loading) return <Spin />;
  if (!analytics) return <Empty description="暂无运营数据" />;

  return (
    <Space direction="vertical" size={20} className="page-stack analysis-page ops-command-page">
      <div className="ops-command-hero">
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            焕甲核心转化战情页
          </Typography.Title>
          <Typography.Text type="secondary">
            跟踪 AI 推荐、试戴、预约与成交链路。曝光/点击数据从埋点启用后统计。
          </Typography.Text>
        </div>
        <Space wrap>
          <DatePicker.RangePicker
            suffixIcon={<CalendarOutlined />}
            onChange={(_, dateStrings) => {
              setAnalyticsRange(dateStrings[0] && dateStrings[1] ? [dateStrings[0], dateStrings[1]] : undefined);
            }}
          />
          <Tag color="blue">
            {analytics.start_date} 至 {analytics.end_date}
          </Tag>
          <Tag icon={<ClockCircleOutlined />} color="default">
            更新 {formatDateTime(analytics.generated_at)}
          </Tag>
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

      <Card className="ops-command-note">
        <Space>
          <InfoCircleOutlined />
          <Typography.Text type="secondary">
            漏斗按统计窗口内事件数量聚合；服务端权威事件用于试戴和订单，客户端埋点用于推荐曝光、点击和预约入口行为。
          </Typography.Text>
        </Space>
      </Card>

      <RankingTables analytics={analytics} />
    </Space>
  );
}
