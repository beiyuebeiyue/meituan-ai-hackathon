import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { App, Button, Card, Form, Input, Typography } from "antd";
import { Navigate, useNavigate } from "react-router-dom";
import { api, getOpsToken, setOpsToken } from "../api/client";
import brandLogo from "../assets/logo.png";

type LoginValues = {
  username: string;
  password: string;
};

export function LoginPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();

  if (getOpsToken()) return <Navigate to="/dashboard" replace />;

  return (
    <div className="login-page">
      <Card className="login-card">
        <div className="login-brand">
          <img src={brandLogo} alt="焕甲" />
          <Typography.Title level={3}>焕甲后台系统</Typography.Title>
        </div>
        <Form<LoginValues>
          layout="vertical"
          initialValues={{ username: "admin", password: "admin" }}
          onFinish={async (values) => {
            try {
              const token = await api.login(values.username, values.password);
              setOpsToken(token.access_token);
              message.success("已登录");
              navigate("/dashboard", { replace: true });
            } catch (error) {
              message.error(error instanceof Error ? error.message : "登录失败");
            }
          }}
        >
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]}>
            <Input prefix={<UserOutlined />} autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
            <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  );
}
