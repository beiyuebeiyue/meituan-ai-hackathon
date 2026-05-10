import { App, Card, Col, Empty, Row, Space, Spin, Tag, Typography } from "antd";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { api, OpsDashboard, PopularNail } from "../api/client";

const pieColors = ["#1677ff", "#52c41a", "#722ed1", "#faad14", "#13c2c2", "#eb2f96"];
const cityMarkers = [
  { name: "北京", x: 452, y: 154, value: 74 },
  { name: "上海", x: 530, y: 242, value: 82 },
  { name: "广州", x: 438, y: 338, value: 92 },
  { name: "深圳", x: 454, y: 356, value: 96 },
  { name: "成都", x: 316, y: 268, value: 68 },
  { name: "杭州", x: 506, y: 258, value: 78 },
  { name: "武汉", x: 420, y: 252, value: 64 },
  { name: "西安", x: 360, y: 214, value: 58 },
  { name: "重庆", x: 344, y: 288, value: 62 },
  { name: "郑州", x: 408, y: 208, value: 46 },
];

function formatNumber(value: number) {
  return value.toLocaleString("zh-CN");
}

function formatMoney(value: number) {
  return `${formatNumber(value)} 元`;
}

function activityEndTimestamp() {
  return Date.parse("2026-06-10T23:59:59.999+08:00");
}

function activityCountdown() {
  const remaining = Math.max(0, activityEndTimestamp() - Date.now());
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  const milliseconds = remaining % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}:${String(milliseconds).padStart(3, "0")}`;
}

function series(base: number) {
  const seed = Math.max(base, 100);
  return Array.from({ length: 24 }, (_, index) => ({
    label: `${String(index).padStart(2, "0")}:00`,
    value: Math.round(seed * (0.18 + ((index * 17 + 9) % 74) / 100)),
  }));
}

function tagDistribution(notes: PopularNail[]) {
  const counts = new Map<string, number>();
  notes.forEach((note) => {
    note.tag_list.slice(0, 3).forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
  });
  const rows = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }));
  return rows.length
    ? rows
    : [
        { name: "法式", value: 24 },
        { name: "猫眼", value: 18 },
        { name: "裸粉", value: 16 },
        { name: "显白", value: 13 },
        { name: "通勤", value: 10 },
      ];
}

function monitorValues(dashboard: OpsDashboard) {
  const todayRevenue = dashboard.metrics.revenue.today || dashboard.metrics.revenue.total;
  const completed = dashboard.metrics.completed_bookings.total;
  const bookings = dashboard.metrics.bookings.total;
  const targetRate = bookings ? Math.min(100, Math.round((completed / bookings) * 100)) : 78;
  return {
    todayRevenue,
    targetRate,
    perSecond: Math.max(1, Math.round(todayRevenue / 3600)),
    verifyRate: Math.max(35, targetRate),
    resourceRate: Math.max(20, 100 - Math.round((dashboard.metrics.tryon_users.today / Math.max(dashboard.metrics.users.total, 1)) * 100)),
  };
}

export function MonitorPage() {
  const { message } = App.useApp();
  const [dashboard, setDashboard] = useState<OpsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [remainingTime, setRemainingTime] = useState(activityCountdown);

  useEffect(() => {
    api
      .getDashboard()
      .then(setDashboard)
      .catch((error) => message.error(error instanceof Error ? error.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [message]);

  useEffect(() => {
    const timer = window.setInterval(() => setRemainingTime(activityCountdown()), 100);
    return () => window.clearInterval(timer);
  }, []);

  const tags = useMemo(() => tagDistribution(dashboard?.popular_nails ?? []), [dashboard]);

  if (loading) return <Spin />;
  if (!dashboard) return <Empty />;

  const values = monitorValues(dashboard);
  const forecast = series(values.todayRevenue);

  return (
    <Space direction="vertical" size={24} className="page-stack monitor-page">
      <Row gutter={[24, 24]}>
        <Col xs={24} xl={18}>
          <Card className="monitor-card monitor-map-card" title="活动实时交易情况">
            <div className="monitor-kpis">
              <Metric label="今日交易总额" value={formatMoney(values.todayRevenue)} />
              <Metric label="销售目标完成率" value={`${values.targetRate}%`} />
              <Metric label="活动剩余时间" value={remainingTime} />
              <Metric label="每秒交易总额" value={formatMoney(values.perSecond)} />
            </div>
            <ChinaHeatMap />
          </Card>
        </Col>
        <Col xs={24} xl={6}>
          <Space direction="vertical" size={24} className="full-width">
            <Card className="monitor-card monitor-side-card" title="活动情况预测">
              <Typography.Text type="secondary">目标评估</Typography.Text>
              <Typography.Title level={3}>有望达到预期</Typography.Title>
              <div className="monitor-forecast-labels">
                <span>{formatNumber(Math.max(values.todayRevenue * 2, 142200))} 元</span>
                <span>{formatNumber(Math.max(values.todayRevenue, 70800))} 元</span>
              </div>
              <ResponsiveContainer width="100%" height={110}>
                <AreaChart data={forecast}>
                  <Area type="monotone" dataKey="value" stroke="#79a7ff" fill="#dce8ff" strokeWidth={2} />
                  <Tooltip />
                </AreaChart>
              </ResponsiveContainer>
              <div className="monitor-time-axis">
                <span>00:00</span>
                <span>12:00</span>
                <span>23:00</span>
              </div>
            </Card>
            <Card className="monitor-card monitor-side-card" title="核销效率">
              <Gauge value={values.verifyRate} />
            </Card>
          </Space>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} xl={10}>
          <Card className="monitor-card monitor-bottom-card" title="各品类占比">
            <div className="monitor-ring-row">
              <Ring value={75} label="美甲预约" />
              <Ring value={48} label="AI 焕手" />
              <Ring value={33} label="发券转化" />
            </div>
          </Card>
        </Col>
        <Col xs={24} xl={7}>
          <Card className="monitor-card monitor-bottom-card" title="热门搜索">
            <div className="monitor-word-cloud">
              {tags.map((item, index) => (
                <span
                  key={item.name}
                  style={{
                    color: pieColors[index % pieColors.length],
                    fontSize: `${15 + Math.min(item.value * 2, 18)}px`,
                    transform: `rotate(${[-18, 14, -28, 22, -8, 30, -14, 18][index % 8]}deg)`,
                  }}
                >
                  {item.name}
                </span>
              ))}
            </div>
          </Card>
        </Col>
        <Col xs={24} xl={7}>
          <Card className="monitor-card monitor-bottom-card" title="资源剩余">
            <div className="monitor-water-wrap">
              <div className="monitor-water" style={{ "--water-level": `${values.resourceRate}%` } as CSSProperties}>
                <span>{values.resourceRate}%</span>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Typography.Text type="secondary">{label}</Typography.Text>
      <div className="monitor-kpi-value">{value}</div>
    </div>
  );
}

function ChinaHeatMap() {
  return (
    <div className="china-map-wrap">
      <svg viewBox="0 0 760 460" role="img" aria-label="中国业务热力分布">
        <path
          className="china-map-shape"
          d="M135 172 L180 130 L246 140 L280 104 L350 112 L392 86 L442 118 L502 104 L570 142 L626 188 L615 252 L660 312 L610 352 L542 342 L502 386 L442 366 L398 394 L324 372 L294 318 L226 306 L188 260 L146 238 Z"
        />
        <path
          className="china-map-shape china-map-island"
          d="M562 380 C590 388 606 408 596 430 C570 430 548 416 548 392 Z"
        />
        <path className="china-map-shape china-map-island" d="M612 352 C628 356 638 368 632 382 C614 382 604 372 606 360 Z" />
        <path className="china-map-border" d="M248 142 L276 214 L336 260 L396 250 L458 292 L520 248 L572 268" />
        <path className="china-map-border" d="M354 116 L366 188 L430 206 L502 174" />
        {cityMarkers.map((item) => (
          <g key={item.name}>
            <circle className="china-map-pulse" cx={item.x} cy={item.y} r={item.value / 4} />
            <circle className="china-map-dot" cx={item.x} cy={item.y} r={Math.max(6, item.value / 12)} />
            <text x={item.x + 10} y={item.y - 8} className="china-map-label">
              {item.name}
            </text>
          </g>
        ))}
      </svg>
      <div className="china-map-legend">
        <Tag color="purple">高热度</Tag>
        <Tag color="blue">交易活跃</Tag>
        <Tag color="green">门店增长</Tag>
      </div>
    </div>
  );
}

function Gauge({ value }: { value: number }) {
  const angle = -150 + Math.min(100, Math.max(0, value)) * 2.4;
  return (
    <div className="monitor-gauge">
      <svg viewBox="0 0 240 160">
        <path d="M35 125 A85 85 0 0 1 205 125" className="gauge-track" />
        <path d="M35 125 A85 85 0 0 1 81 49" className="gauge-segment gauge-blue" />
        <path d="M81 49 A85 85 0 0 1 120 40" className="gauge-segment gauge-green" />
        <path d="M120 40 A85 85 0 0 1 169 59" className="gauge-segment gauge-yellow" />
        <path d="M169 59 A85 85 0 0 1 205 125" className="gauge-segment gauge-dark" />
        <line x1="120" y1="125" x2="120" y2="62" className="gauge-pointer" transform={`rotate(${angle} 120 125)`} />
        <circle cx="120" cy="125" r="12" className="gauge-center" />
        <text x="120" y="150" textAnchor="middle" className="gauge-text">
          优
        </text>
      </svg>
    </div>
  );
}

function Ring({ value, label }: { value: number; label: string }) {
  return (
    <div className="monitor-ring-item">
      <div className="monitor-ring" style={{ "--ring-value": `${value}%` } as CSSProperties}>
        <span>{value}%</span>
      </div>
      <Typography.Text type="secondary">{label}</Typography.Text>
    </div>
  );
}
