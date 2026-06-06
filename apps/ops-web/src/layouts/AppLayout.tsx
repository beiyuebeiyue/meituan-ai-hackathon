import {
  BellOutlined,
  FireOutlined,
  GlobalOutlined,
  DashboardOutlined,
  MoonOutlined,
  RobotOutlined,
  MenuOutlined,
  LeftOutlined,
  LogoutOutlined,
  QuestionCircleOutlined,
  ReadOutlined,
  RightOutlined,
  SunOutlined,
  TagsOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar, Button, Drawer, Grid, Layout, Menu, Space, Typography } from "antd";
import { useContext, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearOpsToken } from "../api/client";
import brandLogo from "../assets/logo.png";
import { OpsChatWidget } from "../components/OpsChatWidget";
import { OpsThemeContext } from "../theme";

const { Header, Sider, Content } = Layout;

const pageMeta = [
  { path: "/dashboard", title: "分析页", description: "核心转化、营收与门店表现" },
  { path: "/monitor", title: "监控页", description: "实时交易、活动热度与资源状态" },
  { path: "/users", title: "用户", description: "用户行为、登录来源与运营动作" },
  { path: "/merchants", title: "商家", description: "门店资料、商家数据与履约情况" },
  { path: "/posts", title: "帖子", description: "内容审核、作者与互动数据" },
  { path: "/trend-nails", title: "热门推款", description: "自动发现上周热门款式并推荐给商家" },
  { path: "/coupons", title: "发券记录", description: "运营券发放记录与到期状态" },
  { path: "/reports", title: "运营周报", description: "小红书美甲趋势与运营复盘" },
  { path: "/chatbot", title: "运营小嘉", description: "运营问题、工具调用与 OpenClaw 能力" },
  { path: "/profile/settings", title: "个人设置", description: "后台账号与偏好设置" },
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
  { key: "/coupons", icon: <TagsOutlined />, label: "发券记录" },
  { key: "/reports", icon: <ReadOutlined />, label: "运营周报" },
  {
    key: "profile",
    icon: <UserOutlined />,
    label: "个人页",
    children: [{ key: "/profile/settings", label: "个人设置" }],
  },
  {
    key: "chatbot",
    icon: <RobotOutlined />,
    label: "运营小嘉",
    children: [
      { key: "/chatbot", label: "对话" },
      { key: "external:openclaw", label: "OpenClaw 后台" },
    ],
  },
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleMode } = useContext(OpsThemeContext);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const showChatWidget = location.pathname !== "/chatbot";
  const currentPage =
    pageMeta.find((item) => location.pathname === item.path) ??
    pageMeta.find((item) => location.pathname.startsWith(item.path)) ??
    pageMeta[0];
  const renderMenu = () => (
    <Menu
      mode="inline"
      defaultOpenKeys={["dashboard", "members", "profile", "chatbot"]}
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
              <Typography.Text type="secondary" className="ops-header-subtitle">
                {currentPage.description}
              </Typography.Text>
            </span>
          </Space>
          <Space className="ops-header-actions">
            <Button
              type="text"
              icon={mode === "dark" ? <SunOutlined /> : <MoonOutlined />}
              onClick={toggleMode}
              aria-label={mode === "dark" ? "切换白天主题" : "切换黑夜主题"}
              title={mode === "dark" ? "切换白天主题" : "切换黑夜主题"}
            />
            <Button type="text" icon={<QuestionCircleOutlined />} />
            <Button type="text" icon={<GlobalOutlined />} />
            <Button type="text" icon={<BellOutlined />} />
            <Avatar size={28} style={{ background: "#f3f4f6", color: "#111827" }}>
              A
            </Avatar>
            <Typography.Text type="secondary" className="ops-header-user-name">
              admin
            </Typography.Text>
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={() => {
                clearOpsToken();
                navigate("/login", { replace: true });
              }}
            >
              退出
            </Button>
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
