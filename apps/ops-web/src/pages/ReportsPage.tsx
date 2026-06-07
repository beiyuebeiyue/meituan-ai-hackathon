import { App, Card, DatePicker, Empty, Select, Space } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { api, OpsHtmlReport, XHS_WEEKLY_REPORT_WEEKS } from "../api/client";
import type { XhsWeeklyReportWeek } from "../api/client";
import { buildOpsWeeklyReportHtml } from "../utils/opsWeeklyReportHtml";

type ReportPanel = "ops" | "xhs";

export function ReportsPage({ panel }: { panel: ReportPanel }) {
  const { message } = App.useApp();
  const [selectedOpsDate, setSelectedOpsDate] = useState(() => dayjs());
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
    if (panel === "xhs") {
      loadReports();
    }
  }, [loadReports, panel]);

  return (
    <Space direction="vertical" size={10} className="page-stack reports-page">
      <div className="report-toolbar">
        {panel === "ops" ? (
          <DatePicker
            allowClear={false}
            value={selectedOpsDate}
            onChange={(value) => {
              if (value) setSelectedOpsDate(value);
            }}
          />
        ) : (
          <Select
            className="report-week-select"
            value={selectedWeek.week}
            options={XHS_WEEKLY_REPORT_WEEKS.map((week) => ({ label: week.label, value: week.week }))}
            onChange={(value) => {
              const nextWeek = XHS_WEEKLY_REPORT_WEEKS.find((week) => week.week === value);
              if (nextWeek) setSelectedWeek(nextWeek);
            }}
          />
        )}
      </div>

      <Card loading={panel === "xhs" && loading}>
        {panel === "ops" ? (
          <iframe
            className="xhs-weekly-report-frame"
            title="焕甲运营数据日报"
            srcDoc={buildOpsWeeklyReportHtml(selectedOpsDate.toDate())}
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
