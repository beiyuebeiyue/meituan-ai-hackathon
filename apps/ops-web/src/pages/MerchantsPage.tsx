import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { App, Button, Descriptions, Drawer, Input, Select, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import { api, OpsMerchant } from "../api/client";

const PAGE_SIZE = 10;
const MERCHANTS_CACHE_TTL_MS = 5 * 60 * 1000;

type MerchantsCacheEntry = {
  items: OpsMerchant[];
  total: number;
  cachedAt: number;
};

const merchantsPageCache = new Map<string, MerchantsCacheEntry>();
const merchantDetailCache = new Map<string, { item: OpsMerchant; cachedAt: number }>();
let merchantCitiesCache: { items: string[]; cachedAt: number } | null = null;

function merchantsCacheKey(query: string, city: string, page: number) {
  return JSON.stringify({ query, city, page, pageSize: PAGE_SIZE });
}

function isFresh(cachedAt: number) {
  return Date.now() - cachedAt < MERCHANTS_CACHE_TTL_MS;
}

export function MerchantsPage() {
  const { message } = App.useApp();
  const [inputQuery, setInputQuery] = useState("");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [merchants, setMerchants] = useState<OpsMerchant[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<OpsMerchant | null>(null);

  const applyMerchants = useCallback((items: OpsMerchant[], totalCount: number) => {
    setMerchants(items);
    setTotal(totalCount);
    items.forEach((item) => merchantDetailCache.set(item.id, { item, cachedAt: Date.now() }));
  }, []);

  const loadMerchants = useCallback(async (forceRefresh = false) => {
    const key = merchantsCacheKey(query, city, page);
    const cached = merchantsPageCache.get(key);
    if (!forceRefresh && cached && isFresh(cached.cachedAt)) {
      applyMerchants(cached.items, cached.total);
      return;
    }

    setLoading(true);
    try {
      const data = await api.getMerchants(query, city, PAGE_SIZE, (page - 1) * PAGE_SIZE);
      merchantsPageCache.set(key, { items: data.items, total: data.total, cachedAt: Date.now() });
      applyMerchants(data.items, data.total);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [applyMerchants, city, message, page, query]);

  useEffect(() => {
    loadMerchants();
  }, [loadMerchants]);

  useEffect(() => {
    if (merchantCitiesCache && isFresh(merchantCitiesCache.cachedAt)) {
      setCities(merchantCitiesCache.items);
      return;
    }
    api
      .getMerchantCities()
      .then((items) => {
        merchantCitiesCache = { items, cachedAt: Date.now() };
        setCities(items);
      })
      .catch((error) => message.error(error instanceof Error ? error.message : "城市加载失败"));
  }, [message]);

  function runSearch() {
    setPage(1);
    setQuery(inputQuery.trim());
  }

  async function openMerchantDetail(record: OpsMerchant) {
    const cached = merchantDetailCache.get(record.id);
    if (cached && isFresh(cached.cachedAt)) {
      setSelected(cached.item);
      return;
    }
    setSelected(record);
    try {
      const fresh = await api.getMerchant(record.id);
      merchantDetailCache.set(record.id, { item: fresh, cachedAt: Date.now() });
      setSelected(fresh);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载商家详情失败");
    }
  }

  function refreshMerchants() {
    merchantCitiesCache = null;
    merchantDetailCache.clear();
    void loadMerchants(true);
    api
      .getMerchantCities()
      .then((items) => {
        merchantCitiesCache = { items, cachedAt: Date.now() };
        setCities(items);
      })
      .catch((error) => message.error(error instanceof Error ? error.message : "城市加载失败"));
  }

  const columns: ColumnsType<OpsMerchant> = [
    { title: "UID", dataIndex: "merchant_uid", width: 100 },
    { title: "商家", dataIndex: "merchant_name", width: 140 },
    { title: "商家手机", dataIndex: "merchant_phone", width: 140, render: (value?: string | null) => value || "-" },
    { title: "门店", dataIndex: "name" },
    { title: "城市", dataIndex: "city", width: 100 },
    { title: "地址", dataIndex: "address" },
    { title: "门店电话", dataIndex: "contact_phone", width: 140, render: (value?: string | null) => value || "-" },
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
            onChange={(value) => {
              setPage(1);
              setCity(value ?? "");
            }}
          />
          <Input
            allowClear
            placeholder="搜索门店、商家、电话"
            prefix={<SearchOutlined />}
            value={inputQuery}
            onChange={(event) => setInputQuery(event.target.value)}
            onPressEnter={runSearch}
          />
          <Button type="primary" onClick={runSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={refreshMerchants}>
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
        pagination={{
          current: page,
          total,
          pageSize: PAGE_SIZE,
          showSizeChanger: false,
          onChange: setPage,
        }}
        onRow={(record) => ({ onClick: () => void openMerchantDetail(record) })}
      />

      <Drawer title="商家详情" open={Boolean(selected)} width={520} onClose={() => setSelected(null)}>
        {selected && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="门店">{selected.name}</Descriptions.Item>
            <Descriptions.Item label="商家">{selected.merchant_name}</Descriptions.Item>
            <Descriptions.Item label="商家 UID">{selected.merchant_uid}</Descriptions.Item>
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
