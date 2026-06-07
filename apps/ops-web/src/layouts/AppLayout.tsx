import {
  BellOutlined,
  CheckOutlined,
  DownOutlined,
  FireOutlined,
  GlobalOutlined,
  DashboardOutlined,
  RobotOutlined,
  MenuOutlined,
  LeftOutlined,
  LogoutOutlined,
  ReadOutlined,
  RightOutlined,
  SettingOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar, Button, Drawer, Dropdown, Grid, Layout, Menu, Popover, Space, Typography } from "antd";
import type { MenuProps } from "antd";
import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearOpsToken } from "../api/client";
import brandLogo from "../assets/logo.png";
import { OpsChatWidget } from "../components/OpsChatWidget";
import { getAnalyticsDataSource, setAnalyticsDataSource as setGlobalAnalyticsDataSource } from "../utils/analyticsDataSource";
import type { AnalyticsDataSource } from "../utils/analyticsDataSource";

const { Header, Sider, Content } = Layout;
type OpsLanguage = "zh" | "en";
const OPS_LANGUAGE_KEY = "ops-language";

const pageMeta = [
  { path: "/dashboard", title: "分析页", description: "核心转化、营收与门店表现" },
  { path: "/monitor", title: "监控页", description: "实时交易、活动热度与资源状态" },
  { path: "/users", title: "用户", description: "" },
  { path: "/merchants", title: "商家", description: "" },
  { path: "/posts", title: "帖子", description: "内容审核、作者与互动数据" },
  { path: "/trend-nails", title: "热门推款", description: "自动发现上周热门款式并推荐给商家" },
  { path: "/reports", title: "运营周报", description: "小红书美甲趋势与运营复盘" },
  { path: "/chatbot", title: "运营小嘉", description: "运营问题、工具调用与 OpenClaw 能力" },
  { path: "/openclaw/schedules", title: "定期任务", description: "查看 OpenClaw 自动运行的 skill 与排期" },
  { path: "/profile/settings", title: "设置", description: "后台账号与偏好设置" },
];

const navItems = [
  {
    key: "dashboard",
    icon: <DashboardOutlined />,
    label: "总览",
    children: [
      { key: "/dashboard", label: "分析页" },
      { key: "/monitor", label: "监控页" },
    ],
  },
  {
    key: "members",
    icon: <UserOutlined />,
    label: "用户与商家",
    children: [
      { key: "/users", label: "用户" },
      { key: "/merchants", label: "商家" },
      { key: "/posts", label: "帖子" },
      { key: "/trend-nails", icon: <FireOutlined />, label: "热门推款" },
    ],
  },
  { key: "/reports", icon: <ReadOutlined />, label: "运营周报" },
  {
    key: "chatbot",
    icon: <RobotOutlined />,
    label: "AI 运营",
    children: [
      { key: "/chatbot", label: "运营小嘉" },
      { key: "/openclaw/schedules", label: "定期任务" },
      { key: "external:openclaw", label: "OpenClaw 后台" },
    ],
  },
  { key: "/profile/settings", icon: <SettingOutlined />, label: "设置" },
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [analyticsDataSource, setAnalyticsDataSource] = useState<AnalyticsDataSource>(() => getAnalyticsDataSource());
  const [opsLanguage, setOpsLanguage] = useState<OpsLanguage>(() => {
    if (typeof window === "undefined") return "zh";
    return window.localStorage.getItem(OPS_LANGUAGE_KEY) === "en" ? "en" : "zh";
  });
  const showChatWidget = location.pathname !== "/chatbot";
  const currentPage =
    pageMeta.find((item) => location.pathname === item.path) ??
    pageMeta.find((item) => location.pathname.startsWith(item.path)) ??
    pageMeta[0];
  const renderMenu = () => (
    <Menu
      mode="inline"
      defaultOpenKeys={["dashboard", "members", "chatbot"]}
      selectedKeys={[location.pathname]}
      items={navItems}
      onClick={({ key }) => {
        const menuKey = String(key);
        if (menuKey === "external:openclaw") {
          window.open(`${window.location.origin}/openclaw-gateway/`, "_blank", "noopener,noreferrer");
          setMobileMenuOpen(false);
          return;
        }
        if (menuKey.startsWith("/")) {
          navigate(menuKey);
          setMobileMenuOpen(false);
        }
      }}
    />
  );
  const changeAnalyticsDataSource = (nextDataSource: AnalyticsDataSource) => {
    setAnalyticsDataSource(nextDataSource === "real" ? "demo" : nextDataSource);
    setGlobalAnalyticsDataSource(nextDataSource === "real" ? "demo" : nextDataSource);
  };
  const changeOpsLanguage = (nextLanguage: OpsLanguage) => {
    setOpsLanguage(nextLanguage);
    window.localStorage.setItem(OPS_LANGUAGE_KEY, nextLanguage);
  };
  const logout = () => {
    clearOpsToken();
    navigate("/login", { replace: true });
  };
  const headerDropdownItems: MenuProps["items"] = [
    {
      type: "group",
      label: "数据源",
      children: [
        {
          key: "data:demo",
          label: "Demo 数据",
          icon: analyticsDataSource === "demo" ? <CheckOutlined /> : null,
        },
      ],
    },
    { type: "divider" },
    {
      type: "group",
      label: "语言",
      children: [
        {
          key: "language:zh",
          label: "中文",
          icon: opsLanguage === "zh" ? <CheckOutlined /> : <GlobalOutlined />,
        },
        {
          key: "language:en",
          label: "English",
          icon: opsLanguage === "en" ? <CheckOutlined /> : <GlobalOutlined />,
        },
      ],
    },
    { type: "divider" },
    {
      key: "logout",
      label: "退出登录",
      icon: <LogoutOutlined />,
      danger: true,
    },
  ];
  const notificationsEmptyState = (
    <div className="ops-notification-empty">
      <Typography.Text strong>当前暂无通知</Typography.Text>
      <Typography.Text type="secondary">新的运营提醒会显示在这里</Typography.Text>
    </div>
  );

  return (
    <Layout className="ops-shell">
      <Sider className="ops-sider" width={280} collapsedWidth={80} collapsed={collapsed}>
        <div className="ops-brand">
          <span className="ops-brand-logo" aria-hidden="true">
            <img src={brandLogo} alt="" />
          </span>
          {!collapsed && <span>焕甲后台系统</span>}
        </div>
        <Button
          className="ops-collapse"
          shape="circle"
          icon={collapsed ? <RightOutlined /> : <LeftOutlined />}
          onClick={() => setCollapsed(!collapsed)}
        />
        {renderMenu()}
      </Sider>
      <Layout>
        <Header className="ops-header">
          <Space className="ops-header-left">
            {isMobile ? <Button type="text" icon={<MenuOutlined />} onClick={() => setMobileMenuOpen(true)} /> : null}
            <span className="ops-header-title-group">
              <Typography.Text strong className="ops-header-title">
                {currentPage.title}
              </Typography.Text>
              {currentPage.description ? (
                <Typography.Text type="secondary" className="ops-header-subtitle">
                  {currentPage.description}
                </Typography.Text>
              ) : null}
            </span>
          </Space>
          <Space className="ops-header-actions">
            <Popover
              trigger="click"
              placement="bottomRight"
              content={notificationsEmptyState}
              overlayClassName="ops-notification-popover"
            >
              <Button type="text" aria-label="通知" icon={<BellOutlined />} />
            </Popover>
            <Dropdown
              trigger={["click"]}
              placement="bottomRight"
              menu={{
                items: headerDropdownItems,
                selectedKeys: [`data:${analyticsDataSource}`, `language:${opsLanguage}`],
                onClick: ({ key }) => {
                  const menuKey = String(key);
                  if (menuKey === "data:demo" || menuKey === "data:real") {
                    changeAnalyticsDataSource(menuKey.replace("data:", "") as AnalyticsDataSource);
                  }
                  if (menuKey === "language:zh" || menuKey === "language:en") {
                    changeOpsLanguage(menuKey.replace("language:", "") as OpsLanguage);
                  }
                  if (menuKey === "logout") {
                    logout();
                  }
                },
              }}
            >
              <Button type="text" className="ops-header-account-button">
                <Avatar size={28} style={{ background: "#f3f4f6", color: "#111827" }}>
                  A
                </Avatar>
                <span className="ops-header-user-name">admin</span>
                <DownOutlined className="ops-header-account-caret" />
              </Button>
            </Dropdown>
          </Space>
        </Header>
        <Drawer
          className="ops-mobile-menu"
          title={
            <span className="ops-mobile-brand-title">
              <span className="ops-brand-logo" aria-hidden="true">
                <img src={brandLogo} alt="" />
              </span>
              焕甲后台系统
            </span>
          }
          placement="left"
          width={300}
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        >
          {renderMenu()}
        </Drawer>
        <Content className="ops-content">
          <Outlet />
        </Content>
        {showChatWidget ? <OpsChatWidget /> : null}
      </Layout>
    </Layout>
  );
}
