import { useEffect, useMemo, useState } from "react";
import { api, OpsReport } from "../api/client";

export function ReportsPage() {
  const [reports, setReports] = useState<OpsReport[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    void api.getReportHistory().then((items) => {
      setReports(items);
      setSelectedId(items[0]?.id ?? null);
    });
  }, []);

  const selected = useMemo(() => reports.find((item) => item.id === selectedId) ?? null, [reports, selectedId]);

  return (
    <div className="two-column">
      <section className="panel">
        <div className="panel-head">
          <h3>历史报告</h3>
        </div>
        <div className="list">
          {reports.map((report) => (
            <button
              key={report.id}
              className={report.id === selectedId ? "report-item report-item-active" : "report-item"}
              onClick={() => setSelectedId(report.id)}
            >
              <span>{report.report_date}</span>
              <small>{report.summary_text}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>报告详情</h3>
        </div>
        {selected ? <pre className="markdown-view">{selected.markdown_content}</pre> : <div className="empty">暂无报告</div>}
      </section>
    </div>
  );
}
