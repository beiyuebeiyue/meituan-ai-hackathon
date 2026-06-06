import { App as AntdApp, Button, Card, Checkbox, Col, Empty, Input, Row, Space, Spin, Statistic, Tag, Typography } from "antd";
import { FireOutlined, RobotOutlined, SendOutlined } from "@ant-design/icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api, resolveAssetUrl, TrendNailStyle } from "../api/client";

const { Text, Title, Paragraph } = Typography;

function CandidateCard({
  item,
  checked,
  onToggle,
}: {
  item: TrendNailStyle;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Card
      hoverable
      onClick={onToggle}
      cover={
        <div style={{ height: 180, overflow: "hidden", background: "#f5f5f5" }}>
          <img
            alt={item.title}
            src={resolveAssetUrl(item.image_url)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>
      }
      styles={{ body: { padding: 14 } }}
    >
      <Space direction="vertical" size={8} style={{ width: "100%" }}>
        <Space align="start" style={{ justifyContent: "space-between", width: "100%" }}>
          <Text strong ellipsis style={{ maxWidth: 190 }}>
            {item.title}
          </Text>
          <Checkbox checked={checked} onChange={onToggle} onClick={(event) => event.stopPropagation()} />
        </Space>
        <Space size={[4, 4]} wrap>
          {(item.tags.length ? item.tags.slice(0, 3) : ["手工甲"]).map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </Space>
        <Space split={<Text type="secondary">·</Text>}>
          <Text type="secondary">{item.like_count} 赞</Text>
          <Text type="secondary">{item.claim_count} 家已登记</Text>
        </Space>
      </Space>
    </Card>
  );
}

export function TrendNailsPage() {
  const { message } = AntdApp.useApp();
  const [title, setTitle] = useState("本周热门手工甲");
  const [description, setDescription] = useState("这些是近期适合推给商家的热门手工甲，商家可一键登记“我也能做”。");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastCampaignId, setLastCampaignId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["trend-nail-candidates"],
    queryFn: () => api.getTrendNailCandidates(30),
  });

  const selectedStyles = useMemo(
    () => (query.data?.items ?? []).filter((item) => selectedIds.includes(item.id)),
    [query.data?.items, selectedIds],
  );

  const campaignQuery = useQuery({
    queryKey: ["trend-nail-campaign", lastCampaignId],
    queryFn: () => api.getTrendNailCampaign(lastCampaignId ?? ""),
    enabled: Boolean(lastCampaignId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createTrendNailCampaign({
        title: title.trim() || "热门手工甲推送",
        description: description.trim(),
        style_ids: selectedIds,
        merchant_user_ids: null,
      }),
    onSuccess: (campaign) => {
      setLastCampaignId(campaign.id);
      message.success(`已推送给 ${campaign.merchant_count} 个商家账号`);
      setSelectedIds([]);
    },
    onError: (error: Error) => {
      let detail = error.message;
      try {
        detail = (JSON.parse(error.message) as { detail?: string }).detail ?? detail;
      } catch {
        // keep response text
      }
      message.error(detail);
    },
  });

  const autoCreateMutation = useMutation({
    mutationFn: () => api.createAutoTrendNailCampaign(false, 12),
    onSuccess: (campaign) => {
      if (!campaign) {
        message.warning("暂无可自动推送的热门手工甲款式");
        return;
      }
      setLastCampaignId(campaign.id);
      message.success(`本周自动推送已就绪，覆盖 ${campaign.merchant_count} 个商家账号`);
      query.refetch();
    },
    onError: (error: Error) => {
      let detail = error.message;
      try {
        detail = (JSON.parse(error.message) as { detail?: string }).detail ?? detail;
      } catch {
        // keep response text
      }
      message.error(detail);
    },
  });

  const toggleSelection = (styleId: string) => {
    setSelectedIds((current) => (current.includes(styleId) ? current.filter((id) => id !== styleId) : [...current, styleId]));
  };

  return (
    <div className="ops-page">
      <div className="ops-page-header">
        <div>
          <Title level={2}>热门手工甲推送</Title>
          <Paragraph type="secondary">
            运营选择手工甲候选款并推送给商家。商家点击“我也能做”后，用户焕甲选店时对应门店会优先展示。
          </Paragraph>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title="推送方案">
            <Space direction="vertical" size={14} style={{ width: "100%" }}>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="方案标题" />
              <Input.TextArea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="给商家的推送说明"
                rows={4}
              />
              <div>
                <Text type="secondary">已选择 {selectedIds.length} 款</Text>
                {selectedStyles.length ? (
                  <div style={{ marginTop: 8 }}>
                    {selectedStyles.map((item) => (
                      <Tag key={item.id} style={{ marginBottom: 6 }}>
                        {item.title}
                      </Tag>
                    ))}
                  </div>
                ) : null}
              </div>
              <Button
                type="primary"
                icon={<SendOutlined />}
                block
                disabled={!selectedIds.length}
                loading={createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                推送给全部商家
              </Button>
              <Button
                icon={<RobotOutlined />}
                block
                loading={autoCreateMutation.isPending}
                onClick={() => autoCreateMutation.mutate()}
              >
                自动生成本周推送
              </Button>
            </Space>
          </Card>
          {campaignQuery.data ? (
            <Card title="最近一次推送效果" style={{ marginTop: 16 }}>
              <Row gutter={12}>
                <Col span={12}>
                  <Statistic title="推送商家" value={campaignQuery.data.merchant_count} />
                </Col>
                <Col span={12}>
                  <Statistic title="已登记" value={campaignQuery.data.claim_count} />
                </Col>
              </Row>
            </Card>
          ) : null}
        </Col>
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <FireOutlined />
                手工甲候选池
              </Space>
            }
          >
            {query.isLoading ? (
              <div style={{ padding: 48, textAlign: "center" }}>
                <Spin />
              </div>
            ) : (query.data?.items ?? []).length ? (
              <Row gutter={[16, 16]}>
                {(query.data?.items ?? []).map((item) => (
                  <Col xs={24} md={12} xl={8} key={item.id}>
                    <CandidateCard item={item} checked={selectedIds.includes(item.id)} onToggle={() => toggleSelection(item.id)} />
                  </Col>
                ))}
              </Row>
            ) : (
              <Empty description="当前还没有手工甲候选。请先让商家发布或绑定门店发布手工甲款式。" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
