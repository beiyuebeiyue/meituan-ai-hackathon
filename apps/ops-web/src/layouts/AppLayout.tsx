import {
  BarChartOutlined,
  BellOutlined,
  GlobalOutlined,
  DashboardOutlined,
  RobotOutlined,
  LeftOutlined,
  LogoutOutlined,
  QuestionCircleOutlined,
  ReadOutlined,
  RightOutlined,
  ShopOutlined,
  TagsOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar, Button, Layout, Menu, Space, Typography } from "antd";
import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearOpsToken } from "../api/client";
import { OpsChatWidget } from "../components/OpsChatWidget";

const { Header, Sider, Content } = Layout;

const navItems = [
  {
    key: "dashboard",
    icon: <DashboardOutlined />,
    label: "Dashboard",
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
      { key: "/merchant-users", label: "商家用户" },
      { key: "/merchants", label: "门店" },
    ],
  },
  { key: "/coupons", icon: <TagsOutlined />, label: "发券记录" },
  { key: "/reports", icon: <ReadOutlined />, label: "日报" },
  {
    key: "profile",
    icon: <UserOutlined />,
    label: "个人页",
    children: [{ key: "/profile/settings", label: "个人设置" }],
  },
  { key: "/chatbot", icon: <RobotOutlined />, label: "运营小嘉" },
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const showChatWidget = location.pathname !== "/chatbot";

  return (
    <Layout className="ops-shell">
      <Sider className="ops-sider" width={280} collapsedWidth={80} collapsed={collapsed}>
        <div className="ops-brand">
          <span className="ops-brand-logo">
            <BarChartOutlined />
          </span>
          {!collapsed && <span>焕甲后台系统</span>}
        </div>
        <Button
          className="ops-collapse"
          shape="circle"
          icon={collapsed ? <RightOutlined /> : <LeftOutlined />}
          onClick={() => setCollapsed(!collapsed)}
        />
        <Menu
          mode="inline"
          defaultOpenKeys={["dashboard", "members", "profile"]}
          selectedKeys={[location.pathname]}
          items={navItems}
          onClick={({ key }) => {
            if (String(key).startsWith("/")) navigate(key);
          }}
        />
      </Sider>
      <Layout>
        <Header className="ops-header">
          <Typography.Text type="secondary">焕甲后台系统</Typography.Text>
          <Space>
            <Button type="text" icon={<QuestionCircleOutlined />} />
            <Button type="text" icon={<GlobalOutlined />} />
            <Button type="text" icon={<BellOutlined />} />
            <Avatar size={28} style={{ background: "#e6f4ff", color: "#1677ff" }}>
              A
            </Avatar>
            <Typography.Text type="secondary">admin</Typography.Text>
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
        <Content className="ops-content">
          <Outlet />
        </Content>
        {showChatWidget ? <OpsChatWidget /> : null}
      </Layout>
    </Layout>
  );
}
