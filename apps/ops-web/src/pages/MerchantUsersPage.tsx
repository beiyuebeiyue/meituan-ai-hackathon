import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { App, Button, Descriptions, Drawer, Input, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import { api, OpsMerchantUser } from "../api/client";

export function MerchantUsersPage() {
  const { message } = App.useApp();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<OpsMerchantUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<OpsMerchantUser | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getMerchantUsers(query);
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

  const columns: ColumnsType<OpsMerchantUser> = [
    { title: "UID", dataIndex: "uid", width: 100 },
    { title: "用户名", dataIndex: "username" },
    { title: "手机", dataIndex: "phone", width: 140 },
    { title: "最近 IP 属地", dataIndex: "last_login_ip_location", width: 130, render: (value?: string) => value || "-" },
    { title: "门店数", dataIndex: "shop_count", width: 100 },
    { title: "预定单", dataIndex: "booking_count", width: 100 },
    { title: "完成单", dataIndex: "completed_booking_count", width: 100 },
  ];

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <div className="page-title-row">
        <Typography.Title level={3} className="page-title">
          商家用户
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
        pagination={{ total, pageSize: 50, showSizeChanger: false }}
        onRow={(record) => ({ onClick: () => setSelected(record) })}
      />

      <Drawer title="商家用户详情" open={Boolean(selected)} width={460} onClose={() => setSelected(null)}>
        {selected && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="用户名">{selected.username}</Descriptions.Item>
            <Descriptions.Item label="UID">{selected.uid}</Descriptions.Item>
            <Descriptions.Item label="手机">{selected.phone || "-"}</Descriptions.Item>
            <Descriptions.Item label="最近 IP 属地">{selected.last_login_ip_location || "-"}</Descriptions.Item>
            <Descriptions.Item label="门店数">{selected.shop_count}</Descriptions.Item>
            <Descriptions.Item label="预定单">{selected.booking_count}</Descriptions.Item>
            <Descriptions.Item label="完成单">{selected.completed_booking_count}</Descriptions.Item>
            <Descriptions.Item label="注册时间">{new Date(selected.created_at).toLocaleString("zh-CN")}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </Space>
  );
}
