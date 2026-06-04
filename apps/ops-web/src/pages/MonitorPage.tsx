import { App, Card, Col, Empty, Row, Space, Spin, Tag, Typography } from "antd";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapChart } from "echarts/charts";
import { GeoComponent, TooltipComponent, VisualMapComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { api, OpsDashboard, PopularNail } from "../api/client";
import chinaGeoJson from "../assets/geo/china.json";

echarts.use([CanvasRenderer, GeoComponent, MapChart, TooltipComponent, VisualMapComponent]);
echarts.registerMap("china", chinaGeoJson as Parameters<typeof echarts.registerMap>[1]);

const pieColors = ["#111827", "#374151", "#4b5563", "#6b7280", "#9ca3af", "#525252"];
const provinceHeat = [
  { name: "北京市", value: 74 },
  { name: "上海市", value: 82 },
  { name: "广东省", value: 96 },
  { name: "四川省", value: 68 },
  { name: "浙江省", value: 78 },
  { name: "湖北省", value: 64 },
  { name: "陕西省", value: 58 },
  { name: "重庆市", value: 62 },
  { name: "河南省", value: 46 },
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
  const targetRate = 12;
  return {
    todayRevenue,
    targetRate,
    perSecond: Math.max(1, Math.round(todayRevenue / 3600)),
    verifyRate: Math.max(35, targetRate),
    resourceRate: 87,
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
                  <Area type="monotone" dataKey="value" stroke="#4b5563" fill="#eeeeee" strokeWidth={2} />
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
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return undefined;

    const chart = echarts.init(chartRef.current);
    chart.setOption({
      tooltip: {
        trigger: "item",
        borderWidth: 0,
        formatter: (params: { componentSubType?: string; name?: string; value?: unknown }) => {
          return params.name ? `${params.name}<br/>业务热度：${params.value ?? 0}` : "";
        },
      },
      visualMap: {
        show: false,
        min: 0,
        max: 100,
        inRange: {
          color: ["#f5f5f5", "#e5e7eb", "#9ca3af", "#374151"],
        },
      },
      geo: {
        map: "china",
        roam: false,
        zoom: 1.2,
        layoutCenter: ["50%", "54%"],
        layoutSize: "92%",
        itemStyle: {
          areaColor: "#f3f4f6",
          borderColor: "#d1d5db",
          borderWidth: 1,
        },
        emphasis: {
          itemStyle: {
            areaColor: "#e5e7eb",
          },
          label: {
            show: false,
            color: "#111827",
          },
        },
      },
      series: [
        {
          type: "map",
          map: "china",
          geoIndex: 0,
          selectedMode: false,
          data: provinceHeat,
        },
      ],
    });

    const resize = () => chart.resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      chart.dispose();
    };
  }, []);

  return (
    <div className="china-map-wrap">
      <div ref={chartRef} className="china-map-chart" role="img" aria-label="中国业务热力分布" />
      <div className="china-map-legend">
        <Tag>高热度</Tag>
        <Tag>交易活跃</Tag>
        <Tag>门店增长</Tag>
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
