import { ReloadOutlined } from "@ant-design/icons";
import { App, Button, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import { api, CouponGrant } from "../api/client";

export function CouponsPage() {
  const { message } = App.useApp();
  const [grants, setGrants] = useState<CouponGrant[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadGrants = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getCouponGrants();
      setGrants(data.items);
      setTotal(data.total);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadGrants();
  }, [loadGrants]);

  const columns: ColumnsType<CouponGrant> = [
    {
      title: "目标",
      render: (_, record) => (
        <Space>
          <Tag>用户</Tag>
          {record.target_name}
        </Space>
      ),
    },
    { title: "券名", dataIndex: "coupon_name" },
    { title: "金额", dataIndex: "amount", width: 110, render: (value: number) => `¥${value}` },
    { title: "开始日期", dataIndex: "valid_from", width: 130, render: (value?: string) => value || "-" },
    { title: "结束日期", dataIndex: "valid_until", width: 130, render: (value?: string) => value || "-" },
    { title: "备注", dataIndex: "note" },
    { title: "创建人", dataIndex: "created_by", width: 110 },
    {
      title: "创建时间",
      dataIndex: "created_at",
      width: 180,
      render: (value: string) => new Date(value).toLocaleString("zh-CN"),
    },
  ];

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <div className="page-title-row">
        <Typography.Title level={3} className="page-title">
          发券记录
        </Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={loadGrants}>
          刷新
        </Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={grants}
        loading={loading}
        scroll={{ x: "max-content" }}
        pagination={{ total, pageSize: 50, showSizeChanger: false }}
      />
    </Space>
  );
}
