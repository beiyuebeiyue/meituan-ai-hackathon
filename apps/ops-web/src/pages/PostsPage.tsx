import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { App, Button, Descriptions, Drawer, Image, Input, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import { api, OpsPost, resolveAssetUrl } from "../api/client";

const PAGE_SIZE = 10;
const POSTS_CACHE_TTL_MS = 5 * 60 * 1000;

type PostsCacheEntry = {
  items: OpsPost[];
  total: number;
  cachedAt: number;
};

const postsPageCache = new Map<string, PostsCacheEntry>();
const preloadedPostImages = new Set<string>();

function postsCacheKey(query: string, page: number) {
  return JSON.stringify({ query, page, pageSize: PAGE_SIZE });
}

function preloadPostImages(items: OpsPost[]) {
  items.forEach((item) => {
    const url = resolveAssetUrl(item.image_url);
    if (!url || preloadedPostImages.has(url)) return;
    preloadedPostImages.add(url);
    const image = new window.Image();
    image.decoding = "async";
    image.src = url;
  });
}

export function PostsPage() {
  const { message } = App.useApp();
  const [inputQuery, setInputQuery] = useState("");
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<OpsPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<OpsPost | null>(null);

  const applyPosts = useCallback((items: OpsPost[], totalCount: number) => {
    setPosts(items);
    setTotal(totalCount);
    preloadPostImages(items);
  }, []);

  const loadPosts = useCallback(async (forceRefresh = false) => {
    const key = postsCacheKey(query, page);
    const cached = postsPageCache.get(key);
    if (!forceRefresh && cached && Date.now() - cached.cachedAt < POSTS_CACHE_TTL_MS) {
      applyPosts(cached.items, cached.total);
      return;
    }

    setLoading(true);
    try {
      const data = await api.getPosts(query, PAGE_SIZE, (page - 1) * PAGE_SIZE);
      postsPageCache.set(key, { items: data.items, total: data.total, cachedAt: Date.now() });
      applyPosts(data.items, data.total);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [applyPosts, message, page, query]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  function runSearch() {
    setPage(1);
    setQuery(inputQuery.trim());
  }

  const columns: ColumnsType<OpsPost> = [
    {
      title: "图片",
      dataIndex: "image_url",
      width: 96,
      render: (value: string) => <Image width={64} height={64} className="ops-post-thumb" src={resolveAssetUrl(value)} preview={false} />,
    },
    {
      title: "帖子",
      dataIndex: "title",
      render: (_, record) => (
        <div className="ops-post-title-cell">
          <Typography.Text strong className="ops-post-title-text">
            {record.title}
          </Typography.Text>
          <Typography.Text type="secondary" className="ops-post-description-text">
            {record.description || "-"}
          </Typography.Text>
        </div>
      ),
    },
    { title: "作者", dataIndex: "author_name", width: 140 },
    {
      title: "类型",
      dataIndex: "author_role",
      width: 100,
      render: (value: string) => (value === "merchant" ? "商家" : "用户"),
    },
    {
      title: "门店",
      dataIndex: "shop_name",
      width: 160,
      render: (value?: string | null, record?: OpsPost) => value || record?.shop_city || "-",
    },
    {
      title: "标签",
      dataIndex: "tags",
      width: 240,
      render: (tags: string[]) => (
        <Space size={[4, 4]} wrap>
          {tags.slice(0, 4).map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
          {tags.length > 4 ? <Tag>+{tags.length - 4}</Tag> : null}
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "is_hidden",
      width: 90,
      render: (value: boolean) => <Tag color={value ? "default" : "green"}>{value ? "隐藏" : "公开"}</Tag>,
    },
    {
      title: "发布时间",
      dataIndex: "created_at",
      width: 180,
      render: (value: string) => new Date(value).toLocaleString("zh-CN"),
    },
  ];

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <div className="page-title-row">
        <Typography.Title level={3} className="page-title">
          已发布帖子
        </Typography.Title>
        <Space.Compact>
          <Input
            allowClear
            placeholder="搜索标题、正文、标签、作者、门店"
            prefix={<SearchOutlined />}
            value={inputQuery}
            onChange={(event) => setInputQuery(event.target.value)}
            onPressEnter={runSearch}
          />
          <Button type="primary" onClick={runSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => loadPosts(true)}>
            刷新
          </Button>
        </Space.Compact>
      </div>

      <Table
        className="ops-posts-table"
        rowKey="id"
        columns={columns}
        dataSource={posts}
        loading={loading}
        scroll={{ x: "max-content" }}
        pagination={{
          current: page,
          total,
          pageSize: PAGE_SIZE,
          showSizeChanger: false,
          onChange: setPage,
        }}
        onRow={(record) => ({ onClick: () => setSelected(record) })}
      />

      <Drawer title="帖子详情" open={Boolean(selected)} width={620} onClose={() => setSelected(null)}>
        {selected && (
          <Space direction="vertical" size={16} className="full-width">
            <Image className="ops-post-detail-image" src={resolveAssetUrl(selected.image_url)} />
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="标题">{selected.title}</Descriptions.Item>
              <Descriptions.Item label="正文">{selected.description || "-"}</Descriptions.Item>
              <Descriptions.Item label="作者">
                {selected.author_name}（UID {selected.author_uid}）
              </Descriptions.Item>
              <Descriptions.Item label="作者类型">{selected.author_role === "merchant" ? "商家" : "用户"}</Descriptions.Item>
              <Descriptions.Item label="门店">{selected.shop_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="城市">{selected.shop_city || "-"}</Descriptions.Item>
              <Descriptions.Item label="状态">{selected.is_hidden ? "隐藏" : "公开"}</Descriptions.Item>
              <Descriptions.Item label="标签">
                <Space size={[4, 4]} wrap>
                  {selected.tags.length ? selected.tags.map((tag) => <Tag key={tag}>{tag}</Tag>) : "-"}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="发布时间">{new Date(selected.created_at).toLocaleString("zh-CN")}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{new Date(selected.updated_at).toLocaleString("zh-CN")}</Descriptions.Item>
              <Descriptions.Item label="本地图片">{selected.local_image_path || "-"}</Descriptions.Item>
              <Descriptions.Item label="关联预约">{selected.verified_booking_id || "-"}</Descriptions.Item>
            </Descriptions>
          </Space>
        )}
      </Drawer>
    </Space>
  );
}
