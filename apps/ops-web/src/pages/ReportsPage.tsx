import { App, Card, Empty, Select, Space, Typography } from "antd";
import { useCallback, useEffect, useState } from "react";
import { api, OpsMarkdownReport } from "../api/client";
import { MarkdownPreview } from "../components/MarkdownPreview";

export function ReportsPage() {
  const { message } = App.useApp();
  const [xhsReport, setXhsReport] = useState<OpsMarkdownReport | null>(null);
  const [xhsHistory, setXhsHistory] = useState<OpsMarkdownReport[]>([]);
  const [selectedXhsReport, setSelectedXhsReport] = useState<OpsMarkdownReport | null>(null);
  const [loading, setLoading] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const [todayXhs, xhsReportHistory] = await Promise.all([
        api.getTodayXhsNailReport(),
        api.getXhsNailReportHistory(),
      ]);
      setXhsReport(todayXhs);
      setXhsHistory(xhsReportHistory);
      setSelectedXhsReport(todayXhs ?? xhsReportHistory[0] ?? null);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const activeXhsReport = selectedXhsReport ?? xhsReport;
  const historyOptions = xhsHistory.map((item) => ({ label: item.report_date, value: item.date_key }));

  return (
    <Space direction="vertical" size={10} className="page-stack reports-page">
      <div className="page-title-row">
        <Typography.Title level={3} className="page-title">
          运营日报
        </Typography.Title>
        <Select
          className="report-history-select"
          placeholder="历史记录"
          value={activeXhsReport?.date_key}
          loading={loading}
          options={historyOptions}
          onChange={(dateKey) => {
            setSelectedXhsReport(xhsHistory.find((item) => item.date_key === dateKey) ?? null);
          }}
        />
      </div>

      <Card loading={loading}>
        {activeXhsReport ? <MarkdownPreview content={activeXhsReport.markdown_content} /> : <Empty description="暂无运营日报" />}
      </Card>
    </Space>
  );
}
