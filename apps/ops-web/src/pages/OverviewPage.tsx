import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, OpsReport, OverviewMetrics, resolveAssetUrl } from "../api/client";
import { MetricCard } from "../components/MetricCard";

export function OverviewPage() {
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [report, setReport] = useState<OpsReport | null>(null);

  useEffect(() => {
    void Promise.all([api.getOverview(), api.getTodayReport()]).then(([overviewData, reportData]) => {
      setOverview(overviewData);
      setReport(reportData);
    });
  }, []);

  return (
    <div className="page-stack">
      <section className="hero">
        <div>
          <p className="eyebrow">Today</p>
          <h2>美甲趋势总览</h2>
          <p>{report?.summary_text ?? "先导入种子并生成 demo 指标后，这里会展示今日策略摘要。"}</p>
        </div>
        <div className="hero-pill">{overview?.report_date ?? "未生成"}</div>
      </section>

      <div className="metric-grid">
        <MetricCard label="首页曝光量" value={String(overview?.homepage_impressions ?? 0)} />
        <MetricCard label="首页点击量" value={String(overview?.homepage_clicks ?? 0)} />
        <MetricCard
          label="首页 CTR"
          value={`${((overview?.homepage_ctr ?? 0) * 100).toFixed(1)}%`}
          hint="点击 / 曝光"
        />
      </div>

      <section className="panel panel-tall">
        <div className="panel-head">
          <h3>近 7 天走势</h3>
        </div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={overview?.series ?? []}>
              <defs>
                <linearGradient id="impressionsGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#ff6b4a" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#ffefdf" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1d6cc" />
              <XAxis dataKey="date" stroke="#8b5c4c" />
              <YAxis stroke="#8b5c4c" />
              <Tooltip />
              <Area type="monotone" dataKey="impressions" stroke="#e7643f" fill="url(#impressionsGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>今日热度上涨最快</h3>
        </div>
        <div className="list">
          {(overview?.fastest_rising_styles ?? []).map((item) => (
            <article className="style-row" key={item.style_id}>
              <div className="style-row-main">
                <div className="thumb">
                  <img src={resolveAssetUrl(item.image_url)} alt={item.title} />
                </div>
                <div>
                  <h4>{item.title}</h4>
                  <p>热度增量 {item.delta_score.toFixed(1)}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
