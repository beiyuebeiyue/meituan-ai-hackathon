import { FileTextOutlined, ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import { App, Button, Card, Col, Empty, Row, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import { api, OpsReport, ReportGenerateResponse } from "../api/client";

export function ReportsPage() {
  const { message } = App.useApp();
  const [todayReport, setTodayReport] = useState<OpsReport | null>(null);
  const [history, setHistory] = useState<OpsReport[]>([]);
  const [generated, setGenerated] = useState<ReportGenerateResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const [today, reportHistory] = await Promise.all([api.getTodayReport(), api.getReportHistory()]);
      setTodayReport(today);
      setHistory(reportHistory);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const activeReport = generated ?? todayReport;
  const columns: ColumnsType<OpsReport> = [
    { title: "日期", dataIndex: "report_date", width: 140 },
    { title: "摘要", dataIndex: "summary_text" },
    {
      title: "生成时间",
      dataIndex: "created_at",
      width: 180,
      render: (value: string) => new Date(value).toLocaleString("zh-CN"),
    },
  ];

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <div className="page-title-row">
        <Typography.Title level={3} className="page-title">
          日报
        </Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadReports}>
            刷新
          </Button>
          <Button
            icon={<FileTextOutlined />}
            type="primary"
            onClick={async () => {
              setLoading(true);
              try {
                const result = await api.generateReport();
                setGenerated(result);
                message.success("已生成");
              } catch (error) {
                message.error(error instanceof Error ? error.message : "生成失败");
              } finally {
                setLoading(false);
              }
            }}
          >
            生成今日日报
          </Button>
          <Button
            icon={<SaveOutlined />}
            disabled={!generated}
            onClick={async () => {
              if (!generated) return;
              try {
                await api.saveReport(generated);
                message.success("已保存");
                setGenerated(null);
                loadReports();
              } catch (error) {
                message.error(error instanceof Error ? error.message : "保存失败");
              }
            }}
          >
            保存
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title="当前日报" loading={loading}>
            {activeReport ? (
              <pre className="report-preview">{activeReport.markdown_content}</pre>
            ) : (
              <Empty description="今日暂无日报" />
            )}
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="历史记录">
            <Table
              rowKey="id"
              columns={columns}
              dataSource={history}
              loading={loading}
              pagination={{ pageSize: 8, showSizeChanger: false }}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
