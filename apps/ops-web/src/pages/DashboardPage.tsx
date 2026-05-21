import { CalendarOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { App, Card, Col, DatePicker, Empty, Progress, Row, Segmented, Space, Spin, Table, Tabs, Tag, Typography } from "antd";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, OpsAnalyticsOverview, OpsAnalyticsRankItem, OpsDashboard, PopularNail, resolveAssetUrl } from "../api/client";

type MetricMode = "total" | "today";
type ChartTab = "sales" | "visits";

const yearLabels = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
const todayLabels = ["0时", "2时", "4时", "6时", "8时", "10时", "12时", "14时", "16时", "18时", "20时", "22时"];
const pieColors = ["#1677ff", "#52c41a", "#722ed1", "#faad14", "#13c2c2"];

function formatNumber(value: number) {
  return value.toLocaleString("zh-CN");
}

function formatMoney(value: number) {
  return `¥ ${formatNumber(value)}`;
}

function formatCents(value: number) {
  return `¥ ${(value / 100).toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function metricValue(dashboard: OpsDashboard, mode: MetricMode) {
  const metrics = dashboard.metrics;
  const visits = metrics.images[mode] + metrics.likes[mode] + metrics.collects[mode] + metrics.shares[mode];
  const totalVisits = metrics.images.total + metrics.likes.total + metrics.collects.total + metrics.shares.total;
  const bookings = metrics.bookings.total;
  const activityRate = bookings ? Math.round((metrics.completed_bookings.total / bookings) * 100) : 0;
  return {
    sales: metrics.revenue[mode],
    visits,
    totalVisits,
    payments: metrics.completed_bookings[mode],
    bookings: metrics.bookings[mode],
    activityRate,
  };
}

function scaledSeries(base: number, offset = 0, labels = yearLabels) {
  const seed = Math.max(base, 12);
  return labels.map((label, index) => ({
    label,
    value: Math.round(seed * (0.36 + ((index * 37 + offset) % 72) / 100)),
  }));
}

function chartLabels(mode: MetricMode) {
  return mode === "today" ? todayLabels : yearLabels;
}

function tagDistribution(notes: PopularNail[]) {
  const counts = new Map<string, number>();
  notes.forEach((note) => {
    note.tag_list.slice(0, 3).forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));
}

function rankRows(notes: PopularNail[], fallbackCount: number) {
  if (notes.length) {
    return notes.slice(0, 7).map((note, index) => ({
      id: note.note_id,
      name: note.title || `热门美甲 ${index + 1}`,
      value: note.liked_count || fallbackCount,
    }));
  }
  return Array.from({ length: 7 }, (_, index) => ({
    id: String(index),
    name: `工专路 ${index} 号店`,
    value: 323234,
  }));
}

function SummaryCard({
  title,
  label,
  value,
  footer,
  children,
}: {
  title: string;
  label: string;
  value: string;
  footer: string;
  children?: ReactNode;
}) {
  return (
    <Card className="analysis-stat-card" title={title}>
      <div className="analysis-stat-label">
        <span>{label}</span>
        <InfoCircleOutlined />
      </div>
      <div className="analysis-stat-value">{value}</div>
      <div className="analysis-stat-visual">{children}</div>
      <div className="analysis-stat-footer">{footer}</div>
    </Card>
  );
}

function AnalyticsConversionSection({
  analytics,
  onRangeChange,
}: {
  analytics: OpsAnalyticsOverview;
  onRangeChange: (range?: [string, string]) => void;
}) {
  const kpis = analytics.kpis;
  const trendRows = analytics.trends.length
    ? analytics.trends.map((item) => ({
        label: item.date.slice(5),
        tryons: item.tryons,
        bookings: item.bookings,
        completed: item.completed_orders,
        revenue: Math.round(item.revenue_cents / 100),
      }))
    : [{ label: analytics.start_date.slice(5), tryons: 0, bookings: 0, completed: 0, revenue: 0 }];
  const rankColumns = [
    {
      title: "对象",
      dataIndex: "name",
      render: (_: string, row: OpsAnalyticsRankItem) => (
        <Space>
          {row.image_url ? <img className="analytics-rank-thumb" src={resolveAssetUrl(row.image_url)} alt="" /> : null}
          <Typography.Text strong ellipsis style={{ maxWidth: 180 }}>
            {row.name}
          </Typography.Text>
        </Space>
      ),
    },
    { title: "曝光", dataIndex: "impressions", render: formatNumber },
    { title: "点击率", dataIndex: "ctr", render: formatPercent },
    { title: "试戴", dataIndex: "tryons", render: formatNumber },
    { title: "预约", dataIndex: "bookings", render: formatNumber },
    { title: "完成", dataIndex: "completed_orders", render: formatNumber },
    { title: "营业额", dataIndex: "revenue_cents", render: formatCents },
  ];

  return (
    <Space direction="vertical" size={16} className="analytics-section">
      <div className="analytics-section-head">
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            转化分析
          </Typography.Title>
          <Typography.Text type="secondary">曝光/点击类数据自埋点启用后统计，试戴和订单为后端权威事件。</Typography.Text>
        </div>
        <Space>
          <DatePicker.RangePicker
            suffixIcon={<CalendarOutlined />}
            onChange={(_, dateStrings) => {
              onRangeChange(dateStrings[0] && dateStrings[1] ? [dateStrings[0], dateStrings[1]] : undefined);
            }}
          />
          <Tag color="blue">
            {analytics.start_date} 至 {analytics.end_date}
          </Tag>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} xl={6}>
          <Card className="analytics-kpi-card">
            <Typography.Text type="secondary">营业额</Typography.Text>
            <div className="analytics-kpi-value">{formatCents(kpis.revenue_cents)}</div>
            <Typography.Text type="secondary">客单价 {formatCents(kpis.average_order_value_cents)}</Typography.Text>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card className="analytics-kpi-card">
            <Typography.Text type="secondary">完成订单</Typography.Text>
            <div className="analytics-kpi-value">{formatNumber(kpis.completed_orders)}</div>
            <Typography.Text type="secondary">预约提交 {formatNumber(kpis.booking_submits)}</Typography.Text>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card className="analytics-kpi-card">
            <Typography.Text type="secondary">焕甲完成率</Typography.Text>
            <div className="analytics-kpi-value">{formatPercent(kpis.tryon_completion_rate)}</div>
            <Typography.Text type="secondary">开始试戴 {formatNumber(kpis.tryon_started)}</Typography.Text>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card className="analytics-kpi-card">
            <Typography.Text type="secondary">推荐点击率</Typography.Text>
            <div className="analytics-kpi-value">{formatPercent(kpis.recommendation_ctr)}</div>
            <Typography.Text type="secondary">推荐曝光 {formatNumber(kpis.recommendation_impressions)}</Typography.Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title="关键漏斗">
            <div className="analytics-funnel">
              {analytics.funnel.map((step, index) => (
                <div key={step.key} className="analytics-funnel-step">
                  <div className="analytics-funnel-label">
                    <span>{step.label}</span>
                    <strong>{formatNumber(step.count)}</strong>
                  </div>
                  <Progress
                    percent={Math.round((index === 0 ? 1 : step.conversion_rate) * 100)}
                    strokeColor={index < 2 ? "#ff6b45" : "#1677ff"}
                  />
                  {index > 0 ? <Typography.Text type="secondary">上一步转化 {formatPercent(step.step_rate)} · 流失 {formatPercent(step.dropoff_rate)}</Typography.Text> : null}
                </div>
              ))}
            </div>
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="趋势">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={trendRows}>
                <CartesianGrid stroke="#f1f3f7" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="tryons" name="试戴" stroke="#1677ff" strokeWidth={2} />
                <Line type="monotone" dataKey="bookings" name="预约" stroke="#52c41a" strokeWidth={2} />
                <Line type="monotone" dataKey="completed" name="完成订单" stroke="#ff6b45" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card title="Top 款式">
            <Table rowKey="id" size="small" columns={rankColumns} dataSource={analytics.top_styles} pagination={false} locale={{ emptyText: "暂无款式转化数据" }} />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="Top 门店">
            <Table rowKey="id" size="small" columns={rankColumns.filter((column) => column.title !== "点击率")} dataSource={analytics.top_shops} pagination={false} locale={{ emptyText: "暂无门店转化数据" }} />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}

export function DashboardPage() {
  const { message } = App.useApp();
  const [dashboard, setDashboard] = useState<OpsDashboard | null>(null);
  const [analytics, setAnalytics] = useState<OpsAnalyticsOverview | null>(null);
  const [analyticsRange, setAnalyticsRange] = useState<[string, string] | undefined>();
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<MetricMode>("total");
  const [chartTab, setChartTab] = useState<ChartTab>("sales");

  useEffect(() => {
    setLoading(true);
    Promise.all([api.getDashboard(), api.getAnalyticsOverview(analyticsRange?.[0], analyticsRange?.[1])])
      .then(([nextDashboard, nextAnalytics]) => {
        setDashboard(nextDashboard);
        setAnalytics(nextAnalytics);
      })
      .catch((error) => message.error(error instanceof Error ? error.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [analyticsRange, message]);

  const tagRows = useMemo(() => tagDistribution(dashboard?.popular_nails ?? []), [dashboard]);

  if (loading) return <Spin />;
  if (!dashboard) return <Empty />;

  const values = metricValue(dashboard, mode);
  const labels = chartLabels(mode);
  const salesSeries = scaledSeries(values.sales, 13, labels);
  const visitSeries = scaledSeries(values.visits, 7, labels);
  const paymentSeries = scaledSeries(values.payments, 17, labels);
  const chartSeries = chartTab === "sales" ? salesSeries : visitSeries;
  const ranks = rankRows(dashboard.popular_nails, values.sales);

  return (
    <Space direction="vertical" size={24} className="page-stack analysis-page">
      <div className="analysis-mode-row">
        <Segmented
          value={mode}
          onChange={(value) => setMode(value as MetricMode)}
          options={[
            { label: "累计", value: "total" },
            { label: "今日", value: "today" },
          ]}
        />
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} md={12} xl={6}>
          <SummaryCard
            title="总销售额"
            label={mode === "today" ? "今日销售额" : "总销售额"}
            value={formatMoney(values.sales)}
            footer={`${mode === "today" ? "累计销售额" : "日销售额"} ${formatMoney(mode === "today" ? dashboard.metrics.revenue.total : dashboard.metrics.revenue.today)}`}
          >
            <div className="analysis-growth-line">
              <span>
                周同比 12% <span className="trend-up">▲</span>
              </span>
              <span>
                日同比 11% <span className="trend-down">▼</span>
              </span>
            </div>
          </SummaryCard>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <SummaryCard title="访问量" label="访问量" value={formatNumber(values.visits)} footer={`日访问量 ${formatNumber(dashboard.metrics.images.today)}`}>
            <ResponsiveContainer width="100%" height={54}>
              <AreaChart data={visitSeries}>
                <Area type="monotone" dataKey="value" stroke="#b084f5" fill="#eadcff" strokeWidth={2} />
                <Tooltip />
              </AreaChart>
            </ResponsiveContainer>
          </SummaryCard>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <SummaryCard title="支付笔数" label="支付笔数" value={formatNumber(values.payments)} footer={`转化率 ${values.activityRate}%`}>
            <ResponsiveContainer width="100%" height={54}>
              <BarChart data={paymentSeries}>
                <Bar dataKey="value" fill="#2f80ed" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SummaryCard>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <SummaryCard title="运营活动效果" label="运营活动效果" value={`${values.activityRate}%`} footer="周同比 12%  日同比 11%">
            <Progress percent={values.activityRate} showInfo={false} strokeColor={{ from: "#2f80ed", to: "#73d13d" }} />
          </SummaryCard>
        </Col>
      </Row>

      {analytics ? <AnalyticsConversionSection analytics={analytics} onRangeChange={setAnalyticsRange} /> : null}

      <Card className="analysis-main-card">
        <div className="analysis-card-toolbar">
          <Tabs
            activeKey={chartTab}
            onChange={(key) => setChartTab(key as ChartTab)}
            items={[
              { key: "sales", label: "销售额" },
              { key: "visits", label: "访问量" },
            ]}
          />
          <Space className="analysis-period-actions">
            <ButtonLike active={mode === "today"} onClick={() => setMode("today")}>
              今日
            </ButtonLike>
            <ButtonLike>本周</ButtonLike>
            <ButtonLike>本月</ButtonLike>
            <ButtonLike active={mode === "total"} onClick={() => setMode("total")}>
              本年
            </ButtonLike>
            <DatePicker.RangePicker suffixIcon={<CalendarOutlined />} />
          </Space>
        </div>

        <Row gutter={[28, 24]}>
          <Col xs={24} xl={17}>
            <div className="analysis-large-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartSeries}>
                  <CartesianGrid stroke="#f1f3f7" vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2f80ed" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Col>
          <Col xs={24} xl={7}>
            <Typography.Title level={5} className="analysis-rank-title">
              门店销售额排名
            </Typography.Title>
            <div className="analysis-rank-list">
              {ranks.map((item, index) => (
                <div className="analysis-rank-row" key={item.id}>
                  <span className={index < 3 ? "rank-dot rank-dot-dark" : "rank-dot"}>{index + 1}</span>
                  <span className="analysis-rank-name">{item.name}</span>
                  <span className="analysis-rank-value">{formatNumber(item.value)}</span>
                </div>
              ))}
            </div>
          </Col>
        </Row>
      </Card>

      <Row gutter={[24, 24]}>
        <Col xs={24} xl={12}>
          <Card className="analysis-bottom-card" title="线上热门搜索" extra="...">
            {tagRows.length === 0 ? (
              <Empty description="暂无标签数据" />
            ) : (
              <div className="analysis-search-panel">
                <div className="analysis-search-metrics">
                  <div>
                    <Typography.Text type="secondary">搜索用户数</Typography.Text>
                    <div className="analysis-search-number">
                      17.1 <span>▲</span>
                    </div>
                  </div>
                  <div>
                    <Typography.Text type="secondary">人均搜索次数</Typography.Text>
                    <div className="analysis-search-number">
                      26.2 <span>▼</span>
                    </div>
                  </div>
                </div>
                <div className="analysis-search-table">
                  <div className="analysis-search-head">
                    <span>排名</span>
                    <span>搜索关键词</span>
                    <span>用户数</span>
                    <span>周涨幅</span>
                  </div>
                  {tagRows.map((item, index) => (
                    <div className="analysis-search-row" key={item.name}>
                      <span>{index + 1}</span>
                      <span>{item.name}</span>
                      <span>{item.value}</span>
                      <span>{12 + index * 3}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card
            className="analysis-bottom-card"
            title="销售额类别占比"
            extra={
              <Segmented
                size="small"
                options={[
                  { label: "全部渠道", value: "all" },
                  { label: "线上", value: "online" },
                  { label: "门店", value: "store" },
                ]}
                defaultValue="all"
              />
            }
          >
            {tagRows.length === 0 ? (
              <Empty description="暂无标签数据" />
            ) : (
              <div className="analysis-pie-row">
                <ResponsiveContainer width="62%" height={280}>
                  <PieChart>
                    <Pie data={tagRows} dataKey="value" nameKey="name" innerRadius={76} outerRadius={110}>
                      {tagRows.map((entry, index) => (
                        <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <Space direction="vertical">
                  {tagRows.map((item, index) => (
                    <Tag key={item.name} color={pieColors[index % pieColors.length]}>
                      {item.name}: {item.value}
                    </Tag>
                  ))}
                </Space>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </Space>
  );
}

function ButtonLike({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" className={`analysis-period-button${active ? " is-active" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}
