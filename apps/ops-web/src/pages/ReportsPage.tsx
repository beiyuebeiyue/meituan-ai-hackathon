import { App, Card, Empty, Space, Typography } from "antd";
import { useCallback, useEffect, useState } from "react";
import { api, OpsHtmlReport } from "../api/client";

export function ReportsPage() {
  const { message } = App.useApp();
  const [xhsReport, setXhsReport] = useState<OpsHtmlReport | null>(null);
  const [loading, setLoading] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const todayXhs = await api.getTodayXhsNailReport();
      setXhsReport(todayXhs);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  return (
    <Space direction="vertical" size={10} className="page-stack reports-page">
      <div className="page-title-row">
        <Typography.Title level={3} className="page-title">
          运营周报
        </Typography.Title>
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
