import { GiftOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { App, Button, Descriptions, Drawer, Input, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import { api, OpsUser } from "../api/client";
import { CouponGrantModal } from "../components/CouponGrantModal";

export function UsersPage() {
  const { message } = App.useApp();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<OpsUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<OpsUser | null>(null);
  const [couponTarget, setCouponTarget] = useState<OpsUser | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getUsers(query);
      setUsers(data.items);
      setTotal(data.total);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [message, query]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const columns: ColumnsType<OpsUser> = [
    { title: "UID", dataIndex: "uid", width: 110 },
    { title: "用户名", dataIndex: "username" },
    { title: "手机", dataIndex: "phone" },
    { title: "最近 IP 属地", dataIndex: "last_login_ip_location", width: 130, render: (value?: string) => value || "-" },
    { title: "预约", dataIndex: "booking_count", width: 90 },
    { title: "AI 焕手", dataIndex: "tryon_count", width: 100 },
    { title: "Like", dataIndex: "like_count", width: 90 },
    { title: "Collect", dataIndex: "collect_count", width: 90 },
    {
      title: "操作",
      width: 120,
      render: (_, record) => (
        <Button
          icon={<GiftOutlined />}
          onClick={(event) => {
            event.stopPropagation();
            setCouponTarget(record);
          }}
        >
          发券
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <div className="page-title-row">
        <Typography.Title level={3} className="page-title">
          用户
        </Typography.Title>
        <Space.Compact>
          <Input
            allowClear
            placeholder="搜索用户名、手机"
            prefix={<SearchOutlined />}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onPressEnter={loadUsers}
          />
          <Button icon={<ReloadOutlined />} onClick={loadUsers}>
            刷新
          </Button>
        </Space.Compact>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={users}
        loading={loading}
        scroll={{ x: "max-content" }}
        pagination={{ total, pageSize: 50, showSizeChanger: false }}
        onRow={(record) => ({ onClick: () => setSelected(record) })}
      />

      <Drawer title="用户详情" open={Boolean(selected)} width={460} onClose={() => setSelected(null)}>
        {selected && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="用户名">{selected.username}</Descriptions.Item>
            <Descriptions.Item label="UID">{selected.uid}</Descriptions.Item>
            <Descriptions.Item label="手机">{selected.phone || "-"}</Descriptions.Item>
            <Descriptions.Item label="最近 IP 属地">{selected.last_login_ip_location || "-"}</Descriptions.Item>
            <Descriptions.Item label="预约数">{selected.booking_count}</Descriptions.Item>
            <Descriptions.Item label="AI 焕手">{selected.tryon_count}</Descriptions.Item>
            <Descriptions.Item label="Like">{selected.like_count}</Descriptions.Item>
            <Descriptions.Item label="Collect">{selected.collect_count}</Descriptions.Item>
            <Descriptions.Item label="注册时间">{new Date(selected.created_at).toLocaleString("zh-CN")}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      <CouponGrantModal
        open={Boolean(couponTarget)}
        target={
          couponTarget
            ? { type: "user", id: couponTarget.id, name: couponTarget.username }
            : undefined
        }
        onCancel={() => setCouponTarget(null)}
        onDone={() => setCouponTarget(null)}
      />
    </Space>
  );
}
