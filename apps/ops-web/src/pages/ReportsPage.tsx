import { App, Card, Empty, Segmented, Space, Typography } from "antd";
import { useCallback, useEffect, useState } from "react";
import { api, OpsHtmlReport, XHS_WEEKLY_REPORT_WEEKS } from "../api/client";
import type { XhsWeeklyReportWeek } from "../api/client";

export function ReportsPage() {
  const { message } = App.useApp();
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
      <div className="page-title-row">
        <Typography.Title level={3} className="page-title">
          运营周报
        </Typography.Title>
        <Segmented
          value={selectedWeek.week}
          options={XHS_WEEKLY_REPORT_WEEKS.map((week) => ({ label: week.label, value: week.week }))}
          onChange={(value) => {
            const nextWeek = XHS_WEEKLY_REPORT_WEEKS.find((week) => week.week === value);
            if (nextWeek) setSelectedWeek(nextWeek);
          }}
        />
      </div>

      <Card loading={loading}>
        {xhsReport ? (
          <iframe
            className="xhs-weekly-report-frame"
            title="小红书美甲运营周报"
            srcDoc={xhsReport.html_content}
            sandbox="allow-same-origin"
          />
        ) : (
          <Empty description="暂无运营周报" />
        )}
      </Card>
    </Space>
  );
}
