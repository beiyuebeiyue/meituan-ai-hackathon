import { CalendarOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { App, Card, Col, DatePicker, Empty, Progress, Row, Segmented, Space, Spin, Tabs, Tag, Typography } from "antd";
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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, OpsDashboard, PopularNail } from "../api/client";

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

export function DashboardPage() {
  const { message } = App.useApp();
  const [dashboard, setDashboard] = useState<OpsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<MetricMode>("total");
  const [chartTab, setChartTab] = useState<ChartTab>("sales");

  useEffect(() => {
    api
      .getDashboard()
      .then(setDashboard)
      .catch((error) => message.error(error instanceof Error ? error.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [message]);

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
