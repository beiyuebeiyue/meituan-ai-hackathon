import { Card, Space, Table, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { api, type OpenSkillScheduledTask } from "../api/client";

function formatDateTime(value?: string | null) {
  if (!value) return "尚未运行";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function statusTag(task: OpenSkillScheduledTask) {
  if (!task.enabled) return <Tag color="default">已停用</Tag>;
  if (task.status === "running") return <Tag color="processing">运行中</Tag>;
  if (task.last_status === "failed" || task.status === "failed") return <Tag color="error">失败</Tag>;
  if (task.last_status === "success") return <Tag color="success">已运行</Tag>;
  return <Tag color="blue">已排期</Tag>;
}

export function OpenSkillTasksPage() {
  const [tasks, setTasks] = useState<OpenSkillScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = () => {
      api
        .getOpenSkillScheduledTasks()
        .then((response) => {
          if (alive) setTasks(response.items);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    };
    load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="openskills-page">
      <Card title="定期任务" className="openskills-table-card">
        <Table
          loading={loading}
          rowKey="id"
          dataSource={tasks}
          pagination={false}
          columns={[
            {
              title: "任务",
              dataIndex: "name",
              render: (_value, record) => (
                <Space direction="vertical" size={2}>
                  <Typography.Text strong>{record.name}</Typography.Text>
                  <Typography.Text type="secondary">{record.description}</Typography.Text>
                </Space>
              ),
            },
            {
              title: "Skill",
              dataIndex: "skill_name",
              render: (value) => <Tag color="geekblue">{value}</Tag>,
            },
            {
              title: "排期",
              dataIndex: "schedule_label",
              render: (_value, record) => <Typography.Text>{record.schedule_label}</Typography.Text>,
            },
            {
              title: "状态",
              render: (_value, record) => statusTag(record),
            },
            {
              title: "上次运行",
              dataIndex: "last_run_at",
              render: (_value, record) => (
                <Space direction="vertical" size={2}>
                  <Typography.Text>{formatDateTime(record.last_run_at)}</Typography.Text>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
