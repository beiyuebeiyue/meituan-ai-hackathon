import { App, Card, Empty, Segmented, Select, Space } from "antd";
import { useCallback, useEffect, useState } from "react";
import { api, OpsHtmlReport, XHS_WEEKLY_REPORT_WEEKS } from "../api/client";
import type { XhsWeeklyReportWeek } from "../api/client";
import { buildOpsWeeklyReportHtml } from "../utils/opsWeeklyReportHtml";

type ReportPanel = "ops" | "xhs";

export function ReportsPage() {
  const { message } = App.useApp();
  const [activePanel, setActivePanel] = useState<ReportPanel>("ops");
  const [selectedWeek, setSelectedWeek] = useState<XhsWeeklyReportWeek>(XHS_WEEKLY_REPORT_WEEKS[0]);
  const [xhsReport, setXhsReport] = useState<OpsHtmlReport | null>(null);
  const [loading, setLoading] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const todayXhs = await api.getTodayXhsNailReport(selectedWeek);
      setXhsReport(todayXhs);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [message, selectedWeek]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  return (
    <Space direction="vertical" size={10} className="page-stack reports-page">
      <div className="report-toolbar">
        <Segmented
          value={activePanel}
          options={[
            { label: "运营数据周报", value: "ops" },
            { label: "美甲趋势周报", value: "xhs" },
          ]}
          onChange={(value) => setActivePanel(value as ReportPanel)}
        />
        {activePanel === "xhs" ? (
          <Select
            className="report-week-select"
            value={selectedWeek.week}
            options={XHS_WEEKLY_REPORT_WEEKS.map((week) => ({ label: week.label, value: week.week }))}
            onChange={(value) => {
              const nextWeek = XHS_WEEKLY_REPORT_WEEKS.find((week) => week.week === value);
              if (nextWeek) setSelectedWeek(nextWeek);
            }}
          />
        ) : null}
      </div>

      <Card loading={activePanel === "xhs" && loading}>
        {activePanel === "ops" ? (
          <iframe
            className="xhs-weekly-report-frame"
            title="焕甲运营数据周报"
            srcDoc={buildOpsWeeklyReportHtml()}
            sandbox="allow-same-origin"
          />
        ) : xhsReport ? (
          <iframe
            className="xhs-weekly-report-frame"
            title="小红书美甲趋势周报"
            srcDoc={xhsReport.html_content}
            sandbox="allow-same-origin"
          />
        ) : (
          <Empty description="暂无小红书美甲趋势周报" />
        )}
      </Card>
    </Space>
  );
}
