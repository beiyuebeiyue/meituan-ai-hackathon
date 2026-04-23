import { useEffect, useState } from "react";
import { api, PerformanceMetrics } from "../api/client";
import { StyleList } from "../components/StyleList";

export function PerformancePage() {
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);

  useEffect(() => {
    void api.getPerformance().then(setPerformance);
  }, []);

  return (
    <div className="page-stack">
      <section className="hero hero-compact">
        <div>
          <p className="eyebrow">Performance</p>
          <h2>款式表现分析</h2>
        </div>
        <div className="hero-pill">{performance?.report_date ?? "未生成"}</div>
      </section>
      <div className="grid-two">
        <StyleList title="点击率最高的款式" items={performance?.top_clicked_styles ?? []} />
        <StyleList title="曝光量最高的款式" items={performance?.top_exposed_styles ?? []} />
        <StyleList title="高曝光低点击款" items={performance?.high_impression_low_ctr ?? []} />
        <StyleList title="低曝光高点击款" items={performance?.low_impression_high_ctr ?? []} />
      </div>
    </div>
  );
}
