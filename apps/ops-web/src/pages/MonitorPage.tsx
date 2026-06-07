import { Card, Col, Row, Tag, Typography } from "antd";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef } from "react";
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
import type { OpsDashboard, PopularNail } from "../api/client";
import chinaGeoJson from "../assets/geo/china.json";

echarts.use([CanvasRenderer, GeoComponent, MapChart, TooltipComponent, VisualMapComponent]);
const monitorChinaGeoJson = {
  ...(chinaGeoJson as { type: string; features: Array<{ properties?: { name?: string } }> }),
  features: (chinaGeoJson as { features: Array<{ properties?: { name?: string } }> }).features.filter((feature) => {
    const name = feature.properties?.name?.trim();
    return Boolean(name) && name !== "南海诸岛";
  }),
};
echarts.registerMap("china", monitorChinaGeoJson as Parameters<typeof echarts.registerMap>[1]);

const accentColors = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];
const provinceHeat = [
  { name: "北京市", value: 186 },
  { name: "天津市", value: 92 },
  { name: "河北省", value: 108 },
  { name: "山西省", value: 74 },
  { name: "内蒙古自治区", value: 62 },
  { name: "辽宁省", value: 98 },
  { name: "吉林省", value: 56 },
  { name: "黑龙江省", value: 54 },
  { name: "上海市", value: 228 },
  { name: "江苏省", value: 196 },
  { name: "浙江省", value: 212 },
  { name: "安徽省", value: 114 },
  { name: "福建省", value: 126 },
  { name: "江西省", value: 78 },
  { name: "山东省", value: 148 },
  { name: "河南省", value: 118 },
  { name: "湖北省", value: 132 },
  { name: "湖南省", value: 106 },
  { name: "广东省", value: 286 },
  { name: "广西壮族自治区", value: 82 },
  { name: "海南省", value: 66 },
  { name: "重庆市", value: 136 },
  { name: "四川省", value: 174 },
  { name: "贵州省", value: 72 },
  { name: "云南省", value: 76 },
  { name: "西藏自治区", value: 18 },
  { name: "陕西省", value: 108 },
  { name: "甘肃省", value: 42 },
  { name: "青海省", value: 24 },
  { name: "宁夏回族自治区", value: 32 },
  { name: "新疆维吾尔自治区", value: 46 },
  { name: "台湾省", value: 38 },
  { name: "香港特别行政区", value: 84 },
  { name: "澳门特别行政区", value: 36 },
];

const mockDashboard: OpsDashboard = {
  report_date: "2026-06-06",
  timezone: "Asia/Shanghai",
  metrics: {
    users: { total: 18642, today: 326 },
    merchants: { total: 928, today: 18 },
    images: { total: 42860, today: 1376 },
    likes: { total: 318900, today: 18420 },
    collects: { total: 126500, today: 6820 },
    shares: { total: 43800, today: 2140 },
    tryon_users: { total: 7260, today: 468 },
    bookings: { total: 3610, today: 286 },
    completed_bookings: { total: 2148, today: 142 },
    revenue: { total: 1832600, today: 76800 },
  },
  popular_nails: [
    {
      note_id: "mock-1",
      keyword: "猫眼",
      title: "春夏清透猫眼",
      desc: "高热度趋势",
      tag_list: ["猫眼", "清透", "显白"],
      image_list: [],
      liked_count: 3260,
      collected_count: 1280,
      share_count: 420,
    },
    {
      note_id: "mock-2",
      keyword: "裸粉",
      title: "裸粉通勤法式",
      desc: "门店预约高频款",
      tag_list: ["裸粉", "法式", "通勤"],
      image_list: [],
      liked_count: 2840,
      collected_count: 1160,
      share_count: 360,
    },
    {
      note_id: "mock-3",
      keyword: "碎钻",
      title: "显白碎钻渐变",
      desc: "转化表现稳定",
      tag_list: ["碎钻", "渐变", "显白"],
      image_list: [],
      liked_count: 2380,
      collected_count: 940,
      share_count: 310,
    },
  ],
};

function formatNumber(value: number) {
  return value.toLocaleString("zh-CN");
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
  const dashboard = mockDashboard;

  const tags = useMemo(() => tagDistribution(dashboard?.popular_nails ?? []), [dashboard]);

  const values = monitorValues(dashboard);
  const forecast = series(values.todayRevenue);

  return (
    <div className="page-stack monitor-page">
      <Row gutter={[24, 24]}>
        <Col xs={24} xl={16}>
          <Card
            className="monitor-card monitor-map-card"
            title="全国交易热力图"
            extra={<Typography.Text type="secondary">省份数值为今日门店线索量</Typography.Text>}
          >
            <ChinaHeatMap />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card className="monitor-card monitor-side-card monitor-forecast-card" title="活动情况预测">
            <div className="monitor-forecast-head">
              <div>
                <Typography.Text type="secondary">活动状况</Typography.Text>
                <Typography.Title level={3}>正常</Typography.Title>
              </div>
              <Tag color="green">当前 {values.targetRate}%</Tag>
            </div>
            <div className="monitor-forecast-labels">
              <span>{formatNumber(Math.max(values.todayRevenue * 2, 142200))} 元</span>
              <span>{formatNumber(Math.max(values.todayRevenue, 70800))} 元</span>
            </div>
            <ResponsiveContainer width="100%" height={110}>
              <AreaChart data={forecast}>
                <Area type="monotone" dataKey="value" stroke="#2563eb" fill="#dbeafe" strokeWidth={2} />
                <Tooltip />
              </AreaChart>
            </ResponsiveContainer>
            <div className="monitor-time-axis">
              <span>00:00</span>
              <span>12:00</span>
              <span>23:00</span>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} xl={8}>
          <Card className="monitor-card monitor-bottom-card" title="核销效率">
            <Gauge value={values.verifyRate} />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card className="monitor-card monitor-bottom-card" title="各品类占比">
            <div className="monitor-ring-row">
              <Ring value={75} label="美甲预约" color="#2563eb" />
              <Ring value={48} label="AI 焕手" color="#10b981" />
              <Ring value={33} label="发券转化" color="#f59e0b" />
            </div>
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card className="monitor-card monitor-bottom-card" title="热门搜索">
            <div className="monitor-word-cloud">
              {tags.map((item, index) => (
                <span
                  key={item.name}
                  style={{
                    color: accentColors[index % accentColors.length],
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
      </Row>
    </div>
  );
}

function ChinaHeatMap() {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return undefined;

    const formatProvinceLabel = (name?: string) => {
      const item = provinceHeat.find((province) => province.name === name);
      if (!item) return name ?? "";
      const shortName = item.name
        .replace("壮族自治区", "")
        .replace("回族自治区", "")
        .replace("维吾尔自治区", "")
        .replace("特别行政区", "")
        .replace("自治区", "")
        .replace(/省|市/g, "");
      return `${shortName}\n${item.value}`;
    };

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
        max: 300,
        inRange: {
          color: ["#f8fafc", "#dbeafe", "#93c5fd", "#2563eb", "#f97316"],
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
            areaColor: "#f59e0b",
          },
          label: {
            show: true,
            color: "#111827",
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 16,
            formatter: (params: { name?: string }) => formatProvinceLabel(params.name),
            backgroundColor: "rgba(255,255,255,0.92)",
            borderColor: "rgba(17,24,39,0.12)",
            borderWidth: 1,
            borderRadius: 6,
            padding: [4, 6],
          },
        },
        label: {
          show: false,
          color: "#111827",
        },
      },
      series: [
        {
          type: "map",
          map: "china",
          geoIndex: 0,
          selectedMode: false,
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              color: "#111827",
              fontSize: 12,
              fontWeight: 700,
              lineHeight: 16,
              formatter: (params: { name?: string }) => formatProvinceLabel(params.name),
              backgroundColor: "rgba(255,255,255,0.92)",
              borderColor: "rgba(17,24,39,0.12)",
              borderWidth: 1,
              borderRadius: 6,
              padding: [4, 6],
            },
          },
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
    </div>
  );
}

function Gauge({ value }: { value: number }) {
  const angle = -150 + Math.min(100, Math.max(0, value)) * 2.4;
  return (
    <div className="monitor-gauge">
      <svg viewBox="0 0 240 160">
        <path d="M35 125 A85 85 0 0 1 205 125" className="gauge-track" />
        <path d="M35 125 A85 85 0 0 1 81 49" className="gauge-segment gauge-dark" />
        <path d="M81 49 A85 85 0 0 1 120 40" className="gauge-segment gauge-yellow" />
        <path d="M120 40 A85 85 0 0 1 169 59" className="gauge-segment gauge-green" />
        <path d="M169 59 A85 85 0 0 1 205 125" className="gauge-segment gauge-blue" />
        <line x1="120" y1="125" x2="120" y2="62" className="gauge-pointer" transform={`rotate(${angle} 120 125)`} />
        <circle cx="120" cy="125" r="12" className="gauge-center" />
      </svg>
      <div className="gauge-text">优</div>
    </div>
  );
}

function Ring({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="monitor-ring-item">
      <div className="monitor-ring" style={{ "--ring-value": `${value}%`, "--ring-color": color } as CSSProperties}>
        <span>{value}%</span>
      </div>
      <Typography.Text type="secondary">{label}</Typography.Text>
    </div>
  );
}
