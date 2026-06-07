import { DownOutlined, GiftOutlined, StopOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { App, Button, Descriptions, Drawer, Dropdown, Image, Input, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import { api, OpsUser } from "../api/client";
import { CouponGrantModal } from "../components/CouponGrantModal";

const PAGE_SIZE = 10;
const USERS_CACHE_TTL_MS = 5 * 60 * 1000;

type UsersCacheEntry = {
  items: OpsUser[];
  total: number;
  cachedAt: number;
};

const usersPageCache = new Map<string, UsersCacheEntry>();
const userDetailCache = new Map<string, { item: OpsUser; cachedAt: number }>();

function usersCacheKey(query: string, page: number) {
  return JSON.stringify({ query, page, pageSize: PAGE_SIZE });
}

function isFresh(cachedAt: number) {
  return Date.now() - cachedAt < USERS_CACHE_TTL_MS;
}

function UserDemoImage({ src, alt }: { src?: string | null; alt: string }) {
  if (!src) return <>-</>;
  return (
    <Image
      src={src}
      alt={alt}
      width={160}
      height={160}
      style={{ objectFit: "cover", borderRadius: 12 }}
    />
  );
}

export function UsersPage() {
  const { message } = App.useApp();
  const [inputQuery, setInputQuery] = useState("");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<OpsUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<OpsUser | null>(null);
  const [couponTarget, setCouponTarget] = useState<OpsUser | null>(null);

  const applyUsers = useCallback((items: OpsUser[], totalCount: number) => {
    setUsers(items);
    setTotal(totalCount);
    items.forEach((item) => userDetailCache.set(item.id, { item, cachedAt: Date.now() }));
  }, []);

  const loadUsers = useCallback(async (forceRefresh = false) => {
    const key = usersCacheKey(query, page);
    const cached = usersPageCache.get(key);
    if (!forceRefresh && cached && isFresh(cached.cachedAt)) {
      applyUsers(cached.items, cached.total);
      return;
    }

    setLoading(true);
    try {
      const data = await api.getUsers(query, PAGE_SIZE, (page - 1) * PAGE_SIZE);
      usersPageCache.set(key, { items: data.items, total: data.total, cachedAt: Date.now() });
      applyUsers(data.items, data.total);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [applyUsers, message, page, query]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function runSearch() {
    setPage(1);
    setQuery(inputQuery.trim());
  }

  async function openUserDetail(record: OpsUser) {
    const cached = userDetailCache.get(record.id);
    if (cached && isFresh(cached.cachedAt)) {
      setSelected(cached.item);
      return;
    }
    setSelected(record);
    try {
      const fresh = await api.getUser(record.id);
      userDetailCache.set(record.id, { item: fresh, cachedAt: Date.now() });
      setSelected(fresh);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载用户详情失败");
    }
  }

  function refreshUsers() {
    userDetailCache.clear();
    void loadUsers(true);
  }

  const columns: ColumnsType<OpsUser> = [
    { title: "UID", dataIndex: "uid", width: 110 },
    { title: "用户名", dataIndex: "username", render: (value: string) => <Typography.Text strong>{value}</Typography.Text> },
    { title: "手机", dataIndex: "phone" },
    { title: "预约", dataIndex: "booking_count", width: 90 },
    { title: "AI 焕手", dataIndex: "tryon_count", width: 100 },
    { title: "Like", dataIndex: "like_count", width: 90 },
    { title: "Collect", dataIndex: "collect_count", width: 90 },
    {
      title: "操作",
      width: 120,
      render: (_, record) => (
        <Dropdown
          menu={{
            items: [
              { key: "coupon", icon: <GiftOutlined />, label: "发券" },
              { key: "ban", icon: <StopOutlined />, label: "封禁" },
            ],
            onClick: ({ key, domEvent }) => {
              domEvent.stopPropagation();
              if (key === "coupon") {
                setCouponTarget(record);
                return;
              }
              message.info("封禁功能为 Demo 展示，暂未实际生效");
            },
          }}
          trigger={["click"]}
        >
          <Button onClick={(event) => event.stopPropagation()}>
            操作 <DownOutlined />
          </Button>
        </Dropdown>
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
            value={inputQuery}
            onChange={(event) => setInputQuery(event.target.value)}
            onPressEnter={runSearch}
          />
          <Button type="primary" onClick={runSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={refreshUsers}>
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
        pagination={{
          current: page,
          total,
          pageSize: PAGE_SIZE,
          showSizeChanger: false,
          onChange: setPage,
        }}
        onRow={(record) => ({ onClick: () => void openUserDetail(record) })}
      />

      <Drawer title="用户详情" open={Boolean(selected)} width={460} onClose={() => setSelected(null)}>
        {selected && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="用户名">
              <Typography.Text strong>{selected.username}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="UID">{selected.uid}</Descriptions.Item>
            <Descriptions.Item label="手机">{selected.phone || "-"}</Descriptions.Item>
            <Descriptions.Item label="预约数">{selected.booking_count}</Descriptions.Item>
            <Descriptions.Item label="AI 焕手">{selected.tryon_count}</Descriptions.Item>
            <Descriptions.Item label="上传首图">
              <UserDemoImage src={selected.latest_hand_image_url} alt={`${selected.username} 上传首图`} />
            </Descriptions.Item>
            <Descriptions.Item label="焕甲结果图">
              <UserDemoImage src={selected.latest_tryon_result_image_url} alt={`${selected.username} 焕甲结果图`} />
            </Descriptions.Item>
            <Descriptions.Item label="Like">{selected.like_count}</Descriptions.Item>
            <Descriptions.Item label="Collect">{selected.collect_count}</Descriptions.Item>
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
