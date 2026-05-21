import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { App, Button, Descriptions, Drawer, Input, Select, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import { api, OpsMerchant } from "../api/client";

export function MerchantsPage() {
  const { message } = App.useApp();
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [merchants, setMerchants] = useState<OpsMerchant[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<OpsMerchant | null>(null);

  const loadMerchants = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getMerchants(query, city);
      setMerchants(data.items);
      setTotal(data.total);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [city, message, query]);

  useEffect(() => {
    loadMerchants();
  }, [loadMerchants]);

  useEffect(() => {
    api
      .getMerchantCities()
      .then(setCities)
      .catch((error) => message.error(error instanceof Error ? error.message : "城市加载失败"));
  }, [message]);

  const columns: ColumnsType<OpsMerchant> = [
    { title: "门店", dataIndex: "name" },
    { title: "商家", dataIndex: "merchant_name", width: 140 },
    { title: "城市", dataIndex: "city", width: 100 },
    { title: "地址", dataIndex: "address" },
    { title: "联系电话", dataIndex: "contact_phone", width: 140 },
    { title: "预定单", dataIndex: "booking_count", width: 100 },
    { title: "完成单", dataIndex: "completed_booking_count", width: 100 },
  ];

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <div className="page-title-row">
        <Typography.Title level={3} className="page-title">
          商家
        </Typography.Title>
        <Space.Compact>
          <Select
            allowClear
            className="merchant-city-select"
            placeholder="城市"
            value={city || undefined}
            options={cities.map((item) => ({ label: item, value: item }))}
            onChange={(value) => setCity(value ?? "")}
          />
          <Input
            allowClear
            placeholder="搜索门店、商家、电话"
            prefix={<SearchOutlined />}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onPressEnter={loadMerchants}
          />
          <Button icon={<ReloadOutlined />} onClick={loadMerchants}>
            刷新
          </Button>
        </Space.Compact>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={merchants}
        loading={loading}
        scroll={{ x: "max-content" }}
        pagination={{ total, pageSize: 50, showSizeChanger: false }}
        onRow={(record) => ({ onClick: () => setSelected(record) })}
      />

      <Drawer title="商家详情" open={Boolean(selected)} width={520} onClose={() => setSelected(null)}>
        {selected && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="门店">{selected.name}</Descriptions.Item>
            <Descriptions.Item label="商家">{selected.merchant_name}</Descriptions.Item>
            <Descriptions.Item label="商家手机">{selected.merchant_phone || "-"}</Descriptions.Item>
            <Descriptions.Item label="城市">{selected.city}</Descriptions.Item>
            <Descriptions.Item label="地址">{selected.address || "-"}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{selected.contact_phone || "-"}</Descriptions.Item>
            <Descriptions.Item label="预定单">{selected.booking_count}</Descriptions.Item>
            <Descriptions.Item label="完成单">{selected.completed_booking_count}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{new Date(selected.created_at).toLocaleString("zh-CN")}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

    </Space>
  );
}
